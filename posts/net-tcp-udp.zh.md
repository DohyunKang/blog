传输层的工作是将“计算机之间的通信”缩小为“进程之间的通信”。IP 仅负责将数据包发送到目标计算机，而数据包交给该计算机内的哪个程序则由端口号决定。TCP 和 UDP 都使用端口，但在此之上提供的服务截然不同。关于分层结构本身，请参见 [详情 → OSI 7 层与 TCP/IP](#/post/net-osi-tcpip)；关于从浏览器地址栏开始的宏观图景，请参见 [概览 → 网络基础](#/post/cs-network)。本文将仅深入传输层内部。

## UDP：端口、长度与校验和

UDP (RFC 768) 的头部长度为 8 字节。源端口、目的端口、长度和校验和各自为 16 位。源端口是可选的，若不使用则填入 0。校验和的计算范围包括 UDP 头部和数据，以及由源地址、目的地址、协议号和长度组成的伪头部。这是一种旨在捕获发往错误位置的数据报的结构。

RFC 将 UDP 描述为面向事务的数据报模式，并指出其不保证交付和去重。UDP 没有建立和断开连接的流程。如果需要有序且可靠的字节流，则建议使用 TCP。

```python
import struct
hdr = struct.pack('!HHHH', 5000, 53, 8 + 5, 0)   # 출발지, 목적지, 길이(헤더+데이터 5바이트), 체크섬
print(len(hdr), struct.unpack('!HHHH', hdr))
# 8 (5000, 53, 13, 0)
```

这是运行后得到的结果。头部长度为 8 这一点直接显示出来。

## TCP：字节流与头部

TCP (RFC 9293) 的头部在无非选项的情况下为 20 字节。包含 2 个端口（各 16 位）、序列号（32 位）、确认号（32 位）、头部长度（4 位，单位为 32 位）、标志位 8 个（CWR, ECE, URG, ACK, PSH, RST, SYN, FIN）、窗口大小（16 位）、校验和以及紧急指针。其后还可附加选项。序列号代表“已发送数据的第一个字节编号”；在 SYN 标志置位的段中，它是初始序列号 (ISN)。确认号代表“下一个期望接收的编号”。

```python
import struct
tcp = struct.pack('!HHIIBBHHH', 50000, 80, 100, 0, 5 << 4, 0x02, 65535, 0, 0)
sp, dp, seq, ack, off, fl, win, ck, ug = struct.unpack('!HHIIBBHHH', tcp)
print(len(tcp), (off >> 4) * 4, bool(fl & 2), seq)
# 20 20 True 100
```

结果显示为 20 字节，头部长度字段指示的长度也为 20，SYN 标志已置位，序列号为 100。由于这是直接构造的字节序列，并非实际抓取的包。

核心在于 TCP 处理的是字节流而非消息。因此，序列号是“字节编号”而非“消息编号”。通过套接字直接观察即可发现边界消失的现象。

```python
import socket, time
s = socket.socket(); s.bind(('127.0.0.1', 0)); s.listen()
c = socket.create_connection(s.getsockname()); a, _ = s.accept()
c.sendall(b'hello'); c.sendall(b'world'); time.sleep(0.2)
print('TCP recv:', a.recv(100))

u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); u.bind(('127.0.0.1', 0))
t = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
t.sendto(b'hello', u.getsockname()); t.sendto(b'world', u.getsockname()); time.sleep(0.2)
print('UDP recv:', u.recvfrom(100)[0], u.recvfrom(100)[0])
```

运行结果为 `TCP recv: b'helloworld'` 和 `UDP recv: b'hello' b'world'`。在 TCP 中，两次发送的内容被读作一个整体（并非总是如此，读取多少取决于时机和操作系统）。UDP 则按照发送的单位分别返回。使用 TCP 进行消息交互的程序必须自行通过长度字段或分隔符来构建边界。关于此类套接字的更多内容，请参见 [详情 → 套接字与 Web 套接字](#/post/net-socket)。

## 连接建立与断开

在发送数据之前，需执行三次握手。客户端携带自己的 ISN 发送 SYN，服务器携带自己的 SYN 以及对端 ISN 的 ACK 进行回复，随后客户端再发送针对服务器 ISN 的 ACK。这是一个双方告知各自起始编号并确认对方已接收的过程，因此需要三次交互。RFC 9293 允许双方同时发送 SYN 以建立连接（即被动打开）。

断开时则交换 FIN。在正常关闭过程中，主动关闭方会经历 FIN-WAIT-1 和 FIN-WAIT-2 状态，最终进入 TIME-WAIT；被动接收方则会经历 CLOSE-WAIT 和 LAST-ACK 状态。若双方同时关闭，则会经过 CLOSING 状态。此外，仅关闭一个方向而保持另一个方向打开的半关闭也是可行的。

<details>
<summary>状态名称与 TIME-WAIT</summary>

RFC 9293 定义的状态包括：LISTEN, SYN-SENT, SYN-RECEIVED, ESTABLISHED, FIN-WAIT-1, FIN-WAIT-2, CLOSE-WAIT, CLOSING, LAST-ACK, TIME-WAIT, CLOSED。CLOSED 是一个虚拟名称，用于指代完全不存在连接的状态。

主动关闭方必须在 TIME-WAIT 状态下停留 2×MSL 的时间。本文档将 MSL 设定为 2 分钟，因此约为 4 分钟。

</details>

断开过程常被称为“四次挥手”，但 RFC 将其描述为 FIN 交换，并允许半关闭。这并非固定的四次往返，而更像是每个方向分别进行关闭。

## 流量控制：接收方的考量

流量控制是一种机制，确保“发送方只发送接收方能处理的数据量”。接收方通过头部中的窗口字段告知当前可接收的范围。该字段为 16 位，最大值为 65535；若需要更大的值，则应用窗口缩放扩展（RFC 7323）进行比例调整。若窗口为 0，则对方除发送 ACK 外无法发送任何数据。

如果接收方不读取数据，内核缓冲区会填满，导致发送方停止传输。我已经验证了这种现象确实存在。

```python
import socket, time
s2 = socket.socket(); s2.bind(('127.0.0.1', 0)); s2.listen()
c2 = socket.create_connection(s2.getsockname()); a2, _ = s2.accept()
c2.setblocking(False); sent = 0
try:
    while True: sent += c2.send(b'x' * 65536)
except BlockingIOError:
    print('상대가 안 읽는 중 전송 멈춤, 지금까지', sent > 0)

a2.setblocking(False)
try:
    while a2.recv(1 << 20): pass
except BlockingIOError: pass
time.sleep(0.2)
print('읽어 주니 다시 전송 가능:', c2.send(b'x' * 65536) > 0)
```

运行后，在对方不读取期间，`send` 会被阻塞并抛出 BlockingIOError；当对方读取并清空缓冲区后，发送会恢复（两次均输出 True）。发生阻塞前累积的数据量取决于 OS 的缓冲区设置。

## 拥塞控制：维护网络中间状态

如果流量控制是保护接收方，那么拥塞控制则是保护中间的网络路径。RFC 9293 指出拥塞控制是 TCP 的必要组成部分，并引用 RFC 5681 等独立文档作为具体算法的参考。

发送方单独维护 cwnd（拥塞窗口），一次可发送的未确认数据量取 cwnd 和 rwnd（接收窗口）中的较小值。ssthresh 是区分两种模式的阈值。

| 阶段 | 条件 | cwnd 增长方式 |
|---|---|---|
| 慢启动 | cwnd < ssthresh | 每收到一个新数据的 ACK，增加最多 SMSS；结果上，每个 RTT 大约翻倍 |
| 拥塞避免 | cwnd > ssthresh | 每个 RTT 增加约一个段的大小 |

初始窗口通常为 2~4 个段（基于 RFC 5681）。初始 ssthresh 可设为较大值，但一旦检测到拥塞则需降低。

检测数据丢失有两种方式：若超时发生，则将 ssthresh 降至 max(FlightSize/2, 2×SMSS)，并将 cwnd 重置为 1 个段，重新从慢启动开始；若收到 3 次重复 ACK，则无需等待超时，立即重传对应段（快速重传）。随后的快速恢复阶段中，cwnd 设为 ssthresh + 3×SMSS，每收到一个重复 ACK 增加 SMSS，直到收到确认新数据的 ACK 时，将 cwnd 重置为 ssthresh。

以下模型仅用于演示该规则的行为形态：cwnd 以段数表示，单位为 RTT；并非实际 TCP 实现。

```python
cwnd, ss = 1, 16
out = []
for r in range(1, 13):
    out.append(cwnd)
    if r == 9:                      # 타임아웃이 났다고 가정
        ss = max(cwnd // 2, 2); cwnd = 1
    elif cwnd < ss:
        cwnd = cwnd * 2             # 슬로 스타트
    else:
        cwnd += 1                   # 혼잡 회피
print(out)
# [1, 2, 4, 8, 16, 17, 18, 19, 20, 1, 2, 4]
```

在 16 处慢启动结束，随后逐段增长；超时后降至 1，再重新翻倍增长。锯齿状波形是拥塞控制图形的典型特征。

## 选择 UDP 的场景

UDP 不提供可靠性，但避免了连接建立延迟，也无需因重传而等待后续数据。因此适用于实时语音、视频、游戏以及短查询响应等场景：即使丢失一个数据包，下一个包仍可立即发送。必要时，应用程序可在 UDP 之上自行实现顺序和重传机制。名称解析详见 [DNS 与 IP/路由](#/post/net-dns-routing)，上层协议如 HTTP/HTTPS 参见 [HTTP 与 HTTPS](#/post/net-http)，操作系统对套接口的处理则参考 [操作系统基础](#/post/cs-os)。

## 常见误解

- "UDP 更快”：仅因无需重传、顺序调整或连接建立而导致延迟较低，丢失的数据包会直接消失。
- "TCP 原样传递消息”：如上实验所示，TCP 是字节流，不保留消息边界。
- "3-way handshake 是安全流程”：这只是同步序列号的过程，加密由 TLS 负责。
- "TCP 保证数据必达”：指数据按序到达；若连接断开，应用程序需自行感知无法传递的事实。

← 概念地图：[CS·设计基础 map](#/post/cs-map)

- [详解 → OSI 7 层与 TCP/IP](#/post/net-osi-tcpip)
- [详解 → 套接字与 WebSocket](#/post/net-socket)
- [详解 → HTTP 与 HTTPS](#/post/net-http)

## 参考链接

- RFC 768, User Datagram Protocol: https://www.rfc-editor.org/rfc/rfc768.html
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293.html
- RFC 5681, TCP Congestion Control: https://www.rfc-editor.org/rfc/rfc5681.html