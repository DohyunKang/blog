[개요](#/post/cs-os)에서는 프로세스와 메모리 위주로 봤고, 디스크 쪽은 여기서 따로 판다. 파일 시스템은 디스크를 이름 붙은 파일과 디렉터리로 보이게 만드는 계층이다. 디스크는 같은 크기의 블록이 줄지어 있을 뿐이라, 어느 블록이 어느 파일 것인지 OS가 따로 적어 두어야 한다.

## 디스크 위에 무엇이 있나

OSTEP가 설명용으로 든 단순한 파일 시스템(vsfs)은 디스크를 4KB 블록으로 나누고 역할을 이렇게 나눈다.

| 영역 | 하는 일 |
|---|---|
| 슈퍼블록 | 파일 시스템 전체 정보(inode 개수, 데이터 블록 개수, inode 테이블 시작 위치 등) |
| inode 비트맵·데이터 비트맵 | inode와 데이터 블록 중 어느 것이 비었는지 표시 |
| inode 테이블 | 파일마다 하나씩 있는 메타데이터 |
| 데이터 블록 | 파일 내용 |

실제 파일 시스템은 이보다 복잡하지만 뼈대는 비슷하다고 한다. 여기서 중요한 건 inode다.

## inode

inode(index node)는 파일 하나의 메타데이터를 담은 구조다. 크기, 소유자, 권한, 시각, 그리고 데이터 블록이 어디 있는지 가리키는 포인터가 들어 있다. 파일 이름은 inode 안에 없다. 이름은 디렉터리가 들고 있다.

inode 번호(i-number)가 있으면 inode가 디스크 어디 있는지 계산으로 나온다. inode가 256바이트고 inode 테이블이 12KB 지점에서 시작한다면, 32번 inode는 테이블 시작에서 32 × 256 = 8192바이트 뒤에 있다. 디스크는 섹터(보통 512바이트) 단위로 읽으니 그 주소를 섹터 번호로 바꿔 읽는다.

### 블록 포인터와 큰 파일

inode에 포인터를 몇 개만 넣으면 큰 파일을 못 담는다. 그래서 직접 포인터(데이터 블록을 바로 가리킴) 몇 개에 더해, 포인터들이 든 블록을 한 번 거쳐 가는 간접 포인터를 둔다. 여기서 더 필요하면 간접 블록을 가리키는 이중 간접, 삼중 간접으로 늘린다.

OSTEP의 예시 수치(블록 4KB, 포인터 4바이트, 직접 포인터 12개)로 직접 계산해 봤다.

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

직접 12개는 48KB, 단일 간접까지 약 4MB, 이중 간접까지 약 4GB, 삼중 간접까지 약 4TB다. 포인터 한 번 따라갈 때마다 디스크 읽기가 한 번 더 붙으니, 큰 파일의 뒤쪽을 읽을수록 비용이 늘어난다.

## 디렉터리와 경로

디렉터리도 파일이다. 내용이 "이름 → inode 번호" 목록일 뿐이다. 그래서 파일을 찾는다는 건 경로를 따라 디렉터리를 하나씩 읽으며 번호를 얻는 일이다.

`/foo/bar`를 여는 과정은 OSTEP 설명으로는 이렇다.

1. 루트 디렉터리의 inode 번호는 미리 알려져 있어야 하고(유닉스 계열 파일 시스템에서는 보통 2번), 그 inode를 읽는다.
2. 그 inode가 가리키는 루트 디렉터리 데이터 블록에서 `foo`를 찾아 inode 번호를 얻는다.
3. `foo`의 inode를 읽고, 그 데이터 블록에서 `bar`를 찾는다.
4. `bar`의 inode를 읽고, 권한을 확인하고, 프로세스의 열린 파일 테이블에 항목을 만들어 파일 디스크립터를 돌려준다.

경로가 한 단계 깊어질 때마다 inode 읽기와 디렉터리 데이터 읽기가 한 번씩 더 붙는다. 읽기(read) 때는 비트맵을 보지 않는다. 블록을 새로 할당할 때만 비트맵을 본다. 닫기(close)는 디스크 I/O 없이 디스크립터만 해제한다.

## 하드 링크와 심볼릭 링크

이름과 inode가 분리돼 있어서 같은 inode에 이름을 두 개 붙일 수 있다. 하드 링크가 그것이다. inode에는 링크 수가 있어서, 이름이 하나 지워질 때마다 줄고 0이 되면 파일이 실제로 지워진다. 직접 확인했다(Windows NTFS에서 실행).

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

원래 이름을 지워도 내용이 남았다. 심볼릭 링크는 다른 경로 문자열을 담은 별도 파일이라 원본이 사라지면 끊어진다.

## 시스템 콜 관점: 파일 디스크립터

프로세스는 `open`으로 파일을 열고 정수 하나(파일 디스크립터)를 받는다. man 페이지 기준으로 반환되는 번호는 그 프로세스에서 열려 있지 않은 가장 작은 번호다. 0, 1, 2는 보통 표준 입력·출력·오류라서 첫 파일은 3번이 된다.

디스크립터가 가리키는 건 시스템 전체 테이블의 열린 파일 기록(open file description)이고, 여기에 읽기·쓰기 위치(offset)가 있다. 그래서 같은 파일을 두 번 `open`하면 offset이 따로고, `dup`이나 `fork`로 복제한 디스크립터는 offset을 같이 쓴다.

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

fd1에서 5바이트 읽었더니 fd1의 위치만 5가 됐고, `dup`으로 만든 fd3은 같은 5에서 시작해 fd3으로 읽은 만큼 fd1 위치도 움직였다. 다 닫고 다시 열었을 때 3번이 다시 나오는 것도 확인했다(가장 작은 번호 재사용).

`fork`로 만든 자식 프로세스도 부모와 같은 열린 파일 기록을 공유한다([프로세스와 스레드](#/post/os-process-thread) 참고). `O_APPEND`는 쓰기 직전에 offset을 파일 끝으로 옮기는 동작과 쓰기를 한 단계로 묶어서, 여러 프로세스가 같은 로그 파일 끝에 덧붙일 때 서로 덮어쓰지 않게 해 준다. 여러 프로세스가 같은 자원을 만지는 문제는 [동기화와 교착상태](#/post/os-sync-deadlock)와 같은 줄기다.

<details>
<summary>O_SYNC와 쓰기가 디스크에 닿는 시점</summary>

`write`가 돌아왔다고 데이터가 디스크에 있는 건 아니다. man 페이지에 따르면 `O_SYNC`는 매 `write` 뒤에 `fsync`를 한 것과 비슷한 수준의 완료를 보장하고, `O_DSYNC`는 `fdatasync`처럼 데이터를 다시 읽는 데 필요한 메타데이터(파일 길이 등)까지만 보장한다. 수정 시각 같은 건 제외된다. 데이터베이스가 커밋 때 `fsync`를 부르는 이유가 이것이고, [트랜잭션과 격리 수준](#/post/db-transaction)의 내구성(D)과 이어진다.
</details>

## 디스크 접근 시간과 스케줄링

하드디스크는 한 번 읽는 데 시간이 세 덩어리로 든다. 헤드를 목표 트랙으로 옮기는 탐색(seek), 원하는 섹터가 헤드 밑으로 돌아오기를 기다리는 회전 지연, 실제 전송이다. 세 가지 중 탐색과 회전 지연이 크고, 전송은 상대적으로 작다. OSTEP는 평균 탐색 거리가 전체 거리의 3분의 1이라는 계산도 보여 준다.

그래서 요청이 여러 개 쌓였을 때 순서를 바꿔 헤드 이동을 줄이는 게 디스크 스케줄링이다.

| 방식 | 아이디어 | 문제 |
|---|---|---|
| FCFS | 온 순서대로 | 헤드가 이리저리 크게 움직임 |
| SSTF | 지금 위치에서 가장 가까운 트랙부터 | 먼 트랙 요청이 계속 밀리는 기아(starvation) |
| SCAN(엘리베이터) | 한 방향으로 훑으며 처리하고 끝에서 되돌아옴 | 되돌아올 때 가운데 트랙을 두 번 지나서 가운데에 유리 |
| C-SCAN | 한 방향으로만 훑고 끝에 닿으면 처음으로 돌아가 다시 훑음 | |

OSTEP는 SCAN 변형으로 F-SCAN(훑는 동안 들어온 요청을 큐에 얼려 두는 방식)도 소개한다. 작은 시뮬레이션으로 이동 거리를 비교했다. 교과서에서 흔히 쓰는 요청 열 [98, 183, 37, 122, 14, 124, 65, 67], 시작 위치 53이다.

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

FCFS 640, SSTF 236, SCAN 299가 나왔다. SSTF가 가장 짧지만 이 큐가 고정돼 있기 때문이고, 요청이 계속 들어오면 한쪽이 굶을 수 있다. 위 SCAN은 디스크 끝까지 가지 않고 마지막 요청에서 돌아오는 형태라 엄밀히는 LOOK이라 부르는 변형에 가깝다.

SSD는 헤드가 없어서 이 계산이 그대로 맞지는 않는다. 이 글의 시뮬레이션은 회전식 디스크 기준이다.

## 흔한 오해

- 파일을 지우면 데이터가 바로 사라진다: 링크 수가 0이 되고 열어 둔 곳이 없을 때 실제로 해제된다. 이름 하나를 지운 것일 뿐일 수 있다.
- 파일 이름은 파일 안에 들어 있다: 이름은 디렉터리 항목에 있고, inode에는 없다.
- `write`가 성공하면 디스크에 저장된 것이다: 디스크 반영 시점은 `fsync` 같은 호출이나 플래그에 달려 있다.
- 파일 하나 여는 건 한 번의 읽기다: 경로 깊이만큼 inode와 디렉터리 블록을 따라간다.
- 디스크 스케줄링은 항상 SSTF가 최고다: 거리는 짧지만 기아 문제가 있다.

윈도우에서 열어 둔 파일을 파이썬 `os.remove`로 지우려 하자 "다른 프로세스가 사용 중"이라는 오류(WinError 32)가 났다. 열려 있는 파일의 삭제 허용 여부는 OS마다 다르게 동작한다.

## 이어 보면

이름 → inode → 데이터 블록으로 이어지는 간접 참조가 파일 시스템의 뼈대고, 파일 디스크립터와 열린 파일 테이블이 그 위에 프로세스별 사용 상태를 얹는다. 디스크는 느리니 스케줄링과 캐시로 접근을 줄이는 쪽으로 설계가 흘러왔고, 같은 생각이 [메모리 관리와 가상 메모리](#/post/os-memory)의 페이지 교체나 [CDN과 캐시 전략](#/post/infra-cdn-cache)에도 나온다.

## 근거 링크

- OSTEP, File System Implementation: https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf
- OSTEP, Hard Disk Drives: https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf
- Linux man-pages, open(2): https://man7.org/linux/man-pages/man2/open.2.html

← 개념 지도로 (#/post/cs-map)

관련 글: [운영체제 기초](#/post/cs-os) · [메모리 관리와 가상 메모리](#/post/os-memory) · [동기화와 교착상태](#/post/os-sync-deadlock)
