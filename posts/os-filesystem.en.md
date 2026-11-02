[Overview](#/post/cs-os) focused on processes and memory, while the disk is covered separately here. The file system is a hierarchy that makes the disk appear as named files and directories to the OS. Since a disk consists merely of a sequence of blocks of equal size, the OS must keep track of which block belongs to which file.

## What Lies Above the Disk

OSTEP uses a simple file system (vsfs) for explanation purposes, which divides the disk into 4KB blocks and allocates roles as follows:

| Area | Function |
|---|---|
| Superblock | Information about the entire file system (number of inodes, number of data blocks, location of the inode table, etc.) |
| Inode bitmap · Data bitmap | Indicates which inodes and data blocks are free |
| Inode table | Metadata for each file |
| Data block | File contents |

Actual file systems are more complex than this, but the underlying structure is similar. The key component here is the inode.

## Inode

An inode (index node) is a structure that holds metadata for a single file. It contains information such as size, owner, permissions, timestamps, and pointers indicating where the data blocks are located. The file name is not stored inside the inode; names are managed by directories.

Given an inode number (i-number), you can calculate the inode's location on the disk. If an inode is 256 bytes and the inode table starts at offset 12KB, then the 32nd inode is located 32 × 256 = 8192 bytes after the start of the table. Since disks are read in sectors (typically 512 bytes), this address is converted to a sector number for reading.

### Block Pointers and Large Files

If only a few pointers are stored in an inode, large files cannot be accommodated. Therefore, in addition to direct pointers (which point directly to data blocks), indirect pointers that reference blocks containing pointers are used. If more space is needed, double indirect and triple indirect pointers can be added to reference blocks of indirect pointers.

Using OSTEP's example values (4KB blocks, 4-byte pointers, 12 direct pointers), I performed a direct calculation:

```python
B = 4096; P = 4
n = B // P
print("블록당 포인터", n)
print("직접 12개:", 12 * B)
print("+단일 간접:", (12 + n) * B)
print("+이중 간접:", (12 + n + n * n) * B)
print("+삼중 간접:", (12 + n + n * n + n ** 3) * B)
```

```
블록당 포인터 1024
직접 12개: 49152
+단일 간접: 4243456
+이중 간접: 4299210752
+삼중 간접: 4402345721856
```

With 12 direct pointers, the capacity is 48KB; including single indirect pointers reaches approximately 4MB; with double indirect pointers, it reaches approximately 4GB; and with triple indirect pointers, it reaches approximately 4TB. Each time a pointer is followed, an additional disk read is required, so reading towards the end of a large file incurs higher costs.

## Directories and Paths

A directory is also a file. Its contents are merely a list of "name → inode number". Therefore, finding a file involves reading directories one by one along a path to obtain the corresponding inode number.

The process of opening `/foo/bar`, as described by OSTEP, is as follows:

1. The inode number of the root directory must be known in advance (usually 2 on Unix-like file systems), and that inode is read.
2. From the data block pointed to by that inode, `foo` is found to obtain its inode number.
3. The inode for `foo` is read, and `bar` is found within its data block.
4. The inode for `bar` is read, permissions are checked, an entry is created in the process's open file table, and a file descriptor is returned.

Each additional level of depth in the path adds one more inode read and one more directory data read. During reads (`read`), the bitmap is not consulted; it is only examined when allocating new blocks. Closing (`close`) simply releases the descriptor without any disk I/O.

## Hard Links and Symbolic Links

Because names and inodes are separated, multiple names can be attached to the same inode. This is a hard link. The inode contains a link count that decreases each time a name is deleted; when it reaches 0, the file is actually deleted. I verified this directly (on Windows NTFS).

```python
import os, tempfile
d = tempfile.mkdtemp()
p = os.path.join(d, "a.txt")
open(p, "w").write("hello world\n")
l = os.path.join(d, "b.txt")
os.link(p, l)
s1, s2 = os.stat(p), os.stat(l)
print("same ino", s1.st_ino == s2.st_ino, "nlink", s1.st_nlink)
os.remove(p)
print("nlink", os.stat(l).st_nlink, "content", open(l).read().strip())
```

```
same ino True nlink 2
nlink 1 content hello world
```

Even after deleting the original name, the content remained. A symbolic link is a separate file containing another path string; if the target disappears, the link breaks.

## System Call Perspective: File Descriptors

A process opens a file using `open` and receives an integer (file descriptor). According to the man page, the returned number is the smallest number not currently open in that process. Since 0, 1, and 2 are typically reserved for standard input, output, and error, the first opened file becomes 3.

The file descriptor points to an entry in the system-wide open file description table, which includes read/write offsets. Therefore, opening the same file twice results in separate offsets, while descriptors duplicated via `dup` or inherited via `fork` share the same offset.

```python
import os
fd1 = os.open(p, os.O_RDONLY)
fd2 = os.open(p, os.O_RDONLY)
print("fds", fd1, fd2)
os.read(fd1, 5)
print("fd1", os.lseek(fd1, 0, os.SEEK_CUR), "fd2", os.lseek(fd2, 0, os.SEEK_CUR))
fd3 = os.dup(fd1)
print("dup", os.lseek(fd3, 0, os.SEEK_CUR))
os.read(fd3, 1)
print("fd1 after dup read", os.lseek(fd1, 0, os.SEEK_CUR))
```

```
fds 3 4
fd1 5 fd2 0
dup 5
fd1 after dup read 6
```

Reading 5 bytes from fd1 advanced only fd1's position to 5; fd3, created via `dup`, started at the same offset of 5, and reading from fd3 also advanced fd1's position. I also confirmed that reopening after closing all descriptors returns 3 again (reuse of the smallest number).

A child process created with `fork` shares the same open file description as its parent ([see Process and Thread](#/post/os-process-thread)). `O_APPEND` combines moving the offset to the end of the file before writing with the write operation itself, ensuring that multiple processes appending to the same log file do not overwrite each other. Issues involving multiple processes accessing the same resource stem from problems like [synchronization and deadlock](#/post/os-sync-deadlock).

<details>
<summary>O_SYNC and when writes hit the disk</summary>

Just because `write` has returned does not mean the data is on the disk. According to the man page, `O_SYNC` guarantees a level of completion similar to calling `fsync` after every `write`, while `O_DSYNC` only guarantees metadata (such as file length) required to read back the data, akin to `fdatasync`. Timestamps and similar attributes are excluded. This is why databases call `fsync` during commit, linking it to the Durability (D) property of [transactions and isolation levels](#/post/db-transaction).
</details>

## Disk Access Time and Scheduling

Hard drives take three distinct steps for a single read: seeking to the target track, waiting for the desired sector to rotate under the head, and the actual data transfer. Among these three, seek time and rotational latency are large, while transfer time is relatively small. OSTEP also presents calculations showing that the average seek distance is one-third of the total distance.

Therefore, when multiple requests accumulate, disk scheduling involves reordering them to reduce head movement.

| Method | Idea | Problem |
|---|---|---|
| FCFS | Process in order received | Head moves back and forth extensively |
| SSTF | Start with the closest track from current position | Starvation of distant track requests |
| SCAN (Elevator) | Sweep in one direction and return at the end | Returning passes through middle tracks twice, favoring them |
| C-SCAN | Sweep in one direction only; return to start upon reaching the end and sweep again | |

OSTEP also introduces F-SCAN, a variant of SCAN that queues incoming requests while sweeping. A small simulation compared movement distances. The textbook example uses the request list [98, 183, 37, 122, 14, 124, 65, 67] with a starting position of 53.

```python
def fcfs(h, q):
    t = 0
    for r in q:
        t += abs(r - h); h = r
    return t

def sstf(h, q):
    q = list(q); t = 0; order = []
    while q:
        r = min(q, key=lambda x: abs(x - h))
        q.remove(r); order.append(r); t += abs(r - h); h = r
    return t, order

def scan(h, q):  # 위쪽으로 먼저, 마지막 요청에서 방향 전환
    up = sorted(r for r in q if r >= h)
    dn = sorted((r for r in q if r < h), reverse=True)
    t = 0
    for r in up + dn:
        t += abs(r - h); h = r
    return t

q = [98, 183, 37, 122, 14, 124, 65, 67]
print(fcfs(53, q)); print(sstf(53, q)); print(scan(53, q))
```

```
640
(236, [65, 67, 37, 14, 98, 122, 124, 183])
299
```

The results were FCFS: 640, SSTF: 236, SCAN: 299. While SSTF yields the shortest distance, this is because the queue is fixed; if requests continue to arrive, one side may starve. The above SCAN does not go to the end of the disk but returns from the last request, making it closer to a variant called LOOK.

This calculation does not directly apply to SSDs, which lack heads. This article's simulation is based on rotating disk drives.

## Common Misconceptions

- Deleting a file immediately removes its data: The data is actually freed when the link count reaches zero and there are no open handles; deleting just one name may be all that happens.
- File names are stored inside the file: Names reside in directory entries, not in the inode.
- A successful `write` means data is saved to disk: When data hits the disk depends on calls like `fsync` or flags.
- Opening a file once is one read operation: It follows inode and directory blocks according to path depth.
- SSTF is always the best for disk scheduling: While distance is short, it suffers from starvation issues.

On Windows, attempting to delete an open file with Python's `os.remove` raised an error ("file in use" / WinError 32). Whether deletion of open files is allowed varies by operating system.

## Going Deeper

The indirect reference chain from name → inode → data blocks forms the backbone of the file system, while file descriptors and open file descriptions overlay process-specific usage states on top. Since disks are slow, design has evolved toward reducing access via scheduling and caching; similar thinking appears in [memory management and virtual memory](#/post/os-memory) page replacement and [CDN and caching strategies](#/post/infra-cdn-cache).

## Reference Links

- OSTEP, File System Implementation: https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf
- OSTEP, Hard Disk Drives: https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf
- Linux man-pages, open(2): https://man7.org/linux/man-pages/man2/open.2.html

← Concept Map ([#/post/cs-map])

Related posts: [Operating System Basics](#/post/cs-os) · [Memory Management and Virtual Memory](#/post/os-memory) · [Synchronization and Deadlocks](#/post/os-sync-deadlock)