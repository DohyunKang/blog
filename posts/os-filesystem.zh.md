[概述](#/post/cs-os)中主要关注了进程和内存，而磁盘部分则在此单独讨论。文件系统是一个层级结构，它将磁盘呈现为带名称的文件和目录。磁盘本质上只是一系列相同大小的块，操作系统必须记录哪个块属于哪个文件。

## 磁盘上有什么

OSTEP 用于说明的简单文件系统（vsfs）将磁盘划分为 4KB 的块，并分配如下功能：

| 区域 | 作用 |
|---|---|
| 超级块 | 整个文件系统的信息（inode 数量、数据块数量、inode 表起始位置等） |
| inode 位图·数据位图 | 标记哪些 inode 和数据块是空闲的 |
| inode 表 | 每个文件一个元数据记录 |
| 数据块 | 文件内容 |

实际文件系统比这更复杂，但骨架类似。这里重要的是 inode。

## inode

inode（索引节点）是一个包含单个文件元数据的结构。它包括文件大小、所有者、权限、时间戳，以及指向数据块的指针。文件名并不存储在 inode 中；名称由目录持有。

如果知道 inode 编号（i-number），就可以通过计算确定该 inode 在磁盘上的位置。假设 inode 大小为 256 字节，且 inode 表从 12KB 处开始，那么第 32 号 inode 位于起始位置之后 32 × 256 = 8192 字节处。由于磁盘以扇区（通常为 512 字节）为单位读取，因此将该地址转换为扇区编号后进行读取。

### 块指针与大文件

如果 inode 中只包含少量指针，则无法容纳大文件。因此，除了几个直接指针（直接指向数据块）外，还设置了间接指针（通过一个包含指针的块来访问）。如果需要更多空间，可扩展为指向间接块的双重间接和三重间接指针。

使用 OSTEP 示例数值（4KB 块、4 字节指针、12 个直接指针）进行了直接计算：

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

直接指针支持 12 个块即 48KB，加上单级间接可达约 4MB，加上双级间接可达约 4GB，加上三级间接可达约 4TB。每跟随一次指针就需要额外一次磁盘读取，因此读取大文件末尾时成本会增加。

## 目录与路径

目录也是一种文件，其内容仅是“名称 → inode 编号”的列表。因此，查找文件的过程是沿着路径逐个读取目录并获取 inode 编号。

打开 `/foo/bar` 的过程，根据 OSTEP 的描述如下：

1. 根目录的 inode 编号必须预先已知（在类 Unix 文件系统通常为 2），并读取该 inode。
2. 从该 inode 指向的根目录数据块中找到 `foo`，获取其 inode 编号。
3. 读取 `foo` 的 inode，并在其数据块中找到 `bar`。
4. 读取 `bar` 的 inode，检查权限，并在进程的打开文件表中创建条目，返回文件描述符。

路径每深入一级，就需要额外进行一次 inode 读取和目录数据读取。在读取（read）操作时不查看位图；仅在分配新块时才查看位图。关闭（close）操作仅释放描述符，无需磁盘 I/O。

## 硬链接与符号链接

由于名称与 inode 分离，可以为同一个 inode 添加多个名称，这就是硬链接。inode 中包含链接计数，每删除一个名称该计数减一；当计数变为 0 时，文件才会真正被删除。已通过实际测试验证（在 Windows NTFS 上运行）。

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

即使删除原始名称，内容依然存在。符号链接是一个独立的文件，包含指向其他路径的字符串；若原文件消失，链接即断裂。

## 系统调用视角：文件描述符

进程通过 `open` 打开文件并接收一个整数（文件描述符）。根据 man 页面标准，返回的编号是该进程中尚未使用的最小编号。0、1、2 通常分别对应标准输入、输出和错误，因此第一个文件的描述符通常为 3。

文件描述符指向系统全局表中的打开文件记录（open file description），其中包含读取/写入位置（offset）。因此，对同一文件调用两次 `open` 会得到不同的 offset；而通过 `dup` 或 `fork` 复制的描述符则共享相同的 offset。

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

从 fd1 读取了 5 字节后，fd1 的位置变为 5；由 `dup` 创建的 fd3 也从同一位置 5 开始，且通过 fd3 读取的内容也会同步移动 fd1 的位置。关闭所有文件后重新打开时，编号 3 再次出现，也验证了最小编号的复用机制。

使用 `fork` 创建的子进程也会共享与父进程相同的打开文件描述符（参见 [进程与线程](#/post/os-process-thread)）。`O_APPEND` 将“在写入前将偏移量移动到文件末尾”和“执行写入”这两个操作合并为一个原子步骤，从而确保多个进程向同一个日志文件的末尾追加数据时不会相互覆盖。多个进程操作同一资源的问题根源在于 [同步与死锁](#/post/os-sync-deadlock)。

<details>
<summary>O_SYNC 与数据落盘时机</summary>

`write` 返回并不代表数据已经写入磁盘。根据 man 页面，`O_SYNC` 保证的完成级别类似于每次 `write` 后都调用 `fsync`；而 `O_DSYNC` 仅像 `fdatasync` 一样，保证更新数据所需读取元数据（如文件大小）的部分，不包括修改时间等属性。数据库在提交事务时调用 `fsync` 的原因即在于此，这也与 [事务与隔离级别](#/post/db-transaction) 中的持久性（D）特性相关。
</details>

## 磁盘访问时间与时序调度

机械硬盘进行一次读取操作的时间大致分为三个部分：将磁头移动到目标磁道的寻道时间（seek）、等待目标扇区旋转到磁头下方的旋转延迟，以及实际数据传输时间。其中，寻道时间和旋转延迟占比较大，而传输时间相对较小。OSTEP 的研究也表明，平均寻道距离约为整个磁盘半径的三分之一。

因此，当有多个请求堆积时，通过调整请求顺序以减少磁头移动，就是磁盘调度算法的核心目标。

| 方式 | 思路 | 问题 |
|---|---|---|
| FCFS | 按到达顺序处理 | 磁头频繁大幅度移动 |
| SSTF | 从当前位置开始，优先处理最近的磁道 | 远处磁道的请求持续被推迟，导致饥饿（starvation） |
| SCAN（电梯算法） | 单向扫描处理，到达末端后返回 | 返回途中会再次经过中间磁道，对中间区域有利 |
| C-SCAN | 单向扫描，到达末端后直接跳转回起点重新开始扫描 | |

OSTEP 还介绍了 SCAN 的变体 F-SCAN（在扫描过程中将新到达的请求放入队列等待）。文章通过小型模拟对比了移动距离。教科书中常用的请求序列 [98, 183, 37, 122, 14, 124, 65, 67]，起始位置为 53。

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

结果显示：FCFS 为 640，SSTF 为 236，SCAN 为 299。虽然 SSTF 的总移动距离最短，但由于该队列是固定的，若请求持续到达，仍可能导致某一侧的请求饥饿。上述 SCAN 并未扫描到磁盘末端，而是在最后一个请求处返回，严格来说更接近 LOOK 算法的变体。

SSD 没有磁头，因此上述计算并不完全适用。本文的模拟是基于旋转式硬盘进行的。

## 常见误区

- **删除文件后数据立即消失**：只有当链接数降为 0 且没有任何进程打开该文件时，数据才会真正被释放；仅仅删除文件名可能并未删除数据本身。
- **文件名存储在文件内部**：文件名存在于目录项中，而非 inode 内。
- **`write` 成功即表示已写入磁盘**：数据落盘时机取决于是否调用 `fsync` 等系统调用或相关标志位。
- **打开一个文件只需一次读取**：需要沿着路径深度遍历 inode 和目录块。
- **磁盘调度算法中 SSTF 总是最优**：虽然移动距离短，但存在饥饿问题。

在 Windows 上尝试用 Python 的 `os.remove` 删除已打开的文件时，会抛出“文件被其他进程使用”的错误（WinError 32）。不同操作系统对允许删除已打开文件的处理方式各不相同。

## 进一步思考

从文件名到 inode，再到数据块的间接引用构成了文件系统的骨架；而文件描述符和打开文件表则在此基础上记录了每个进程的使用状态。由于磁盘速度较慢，系统设计倾向于通过调度和缓存来减少访问次数；这种思路同样体现在 [内存管理与虚拟内存](#/post/os-memory) 中的页面置换算法，以及 [CDN 与缓存策略](#/post/infra-cdn-cache) 中。

## 参考资料链接

- OSTEP, File System Implementation: https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf
- OSTEP, Hard Disk Drives: https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf
- Linux man-pages, open(2): https://man7.org/linux/man-pages/man2/open.2.html

← 概念地图 (#/post/cs-map)

相关文章：[操作系统基础](#/post/cs-os) · [内存管理与虚拟内存](#/post/os-memory) · [同步与死锁](#/post/os-sync-deadlock)