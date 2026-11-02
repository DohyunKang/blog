网络分层后便一目了然。将地址转换为 IP（DNS），建立连接（TCP），配置加密（TLS），并在此之上进行请求与响应的交互（HTTP）。这四个步骤按顺序发生。

## 分层观察

在网络讨论中，最先出现的概念是 OSI 7 层模型和 TCP/IP 4 层模型。两者都是“按功能划分通信的示意图”，而实际互联网使用的是 TCP/IP 体系。OSI 7 层模型更多用于教学说明。

| TCP/IP | OSI 对应层 | 功能 | 示例 |
|---|---|---|---|
| 应用层 | 5~7 | 应用程序间的通信规则 | HTTP, DNS, TLS |
| 传输层 | 4 | 进程（端口）之间的数据传输 | TCP, UDP |
| 网络层 | 3 | 寻址至目标 IP | IP |
| 链路层 | 1~2 | 向相邻设备传输数据 | 以太网，Wi-Fi |

关于 TLS 属于哪一层尚有争议。通常将其描绘在传输层与应用层之间，因此表中将其归入应用层一侧。

分层的原因很简单：上层无需知晓下层如何传输数据。HTTP 假设存在“可靠的通道”，而不管该通道是 Wi-Fi 还是有线网络。每一层的数据在下传时都会附加一个头部（封装）。

## 将地址转换为 IP：DNS

人类输入 `example.com`，而计算机使用 IP 进行通信，因此中间需要翻译。MDN 将 DNS 描述为管理域名与 IP 等信息的“分层且分布式的命名系统”。这意味着不存在单一的电话簿，而是由多台服务器共同维护。

在 Python 中，这一翻译仅需一行代码：

```python
import socket
print(socket.getaddrinfo('example.com', 443, proto=socket.IPPROTO_TCP)[0][4])
# ('104.20.23.154', 443)   <- 실행해서 나온 값, 시점·위치마다 다를 수 있다
```

这行代码实际上是向本机解析器（操作系统）发起查询。若缓存中存在则立即返回结果；否则则向下级 DNS 服务器逐级查询。

## 建立连接：TCP

已知 IP 后需建立连接。TCP 在发送数据前会协商序列号，此过程称为三次握手。依据 RFC 9293，流程如下：

1. 客户端发送 SYN（携带自身初始序列号 ISN）。
2. 服务器回复自己的 SYN，并附带对客户端 SYN 的确认（SYN-ACK）。
3. 客户端发送对服务器 SYN 的确认。从此连接进入 ESTABLISHED 状态，数据开始传输。

```
클라이언트                    서버
   |---- SYN, seq=100 ------->|
   |<--- SYN, seq=300, ACK=101-|
   |---- ACK=301 ------------>|
   |====== 데이터 ============|
```

此处示例直接沿用了 RFC 图中的数字（如 100、300）。实际上 ISN 是通过结合时钟与密钥生成的，因此并非随意从 100 开始。

为何需要三次？起初这似乎令人困惑，但双方需各自通告起始序号并确认对方已收到。若仅两次，服务器无法确认客户端是否收到了自己的序号。

可靠性由此保障：每个字节都有编号，ACK 采用累积确认机制，丢失的数据包会重传。通过校验和检测错误，并通过接收方通告的窗口大小调节速度（流量控制）。拥塞控制虽为必需，但其定义在 RFC 中注明位于其他文档。关闭连接时交换 FIN，先关闭的一方需等待 2×MSL 时间进入 TIME-WAIT 状态。此外也存在通过 RST 一次性中断连接的方式。

<details>
<summary>TCP vs UDP 直接测试</summary>

在同一台 PC 上测试了两种套接字类型，分别运行并检查输出。

```python
import socket, threading

# TCP: 연결(handshake)부터 맺고 주고받음
s = socket.socket(); s.bind(('127.0.0.1', 0)); s.listen()
port = s.getsockname()[1]
def srv():
    c, _ = s.accept()
    print('서버 받음:', c.recv(100)); c.sendall(b'pong'); c.close()
threading.Thread(target=srv).start()
c = socket.create_connection(('127.0.0.1', port))
c.sendall(b'ping'); print('클라 받음:', c.recv(100)); c.close()

# UDP: 연결 없이 그냥 던짐
u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); u.bind(('127.0.0.1', 0))
t = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
t.sendto(b'hi', ('127.0.0.1', u.getsockname()[1]))
print('UDP:', u.recvfrom(100)[0])
```

输出结果为：`服务器接收: b'ping'`, `客户端接收: b'pong'`, `UDP: b'hi'`。在调用 `create_connection` 时内部发生了握手过程，代码中并未显式体现。UDP 本身没有 `connect` 或 `accept` 操作。

</details>

## TCP 与 UDP 的区别

| | TCP | UDP |
|---|---|---|
| 连接 | 先建立 | 无 |
| 顺序·重传 | 保证 | 不保证（由应用自行处理） |
| 开销 | 较大 | 较小 |
| 应用场景 | Web、邮件、文件传输 | 实时语音/视频、游戏等 |

“UDP 更快”的说法只对了一半。它之所以延迟低，是因为没有重传和顺序调整；丢失的数据包则直接消失。对于实时通话，迟到的声音若无法补收便无意义，因此适合使用 UDP。也有在 UDP 之上由应用自行实现顺序与重传的案例。

## HTTP：一次请求，一次响应

HTTP 是应用层协议。根据 MDN 的描述，在客户端 - 服务器架构中，请求始终由客户端首先发起。消息格式如下：

```
GET / HTTP/1.1
Host: developer.mozilla.org
Accept-Language: fr
```

请求包含方法、路径、版本、头部以及（可选）正文。响应则包含版本、状态码（如 `200 OK`）、头部和正文。有关方法与状态码的具体用法，请参见 [API 与 REST →](#/post/be-api-rest) 后续文章。

HTTP 本身是无状态的。由于它不记得之前的请求，因此需要通过 Cookie 等头部信息来附加登录保持或购物车等功能。这种“无状态”特性也使得扩展服务器数量变得更加容易。

传输方式因版本而异。根据 MDN 的标准，1.0 版本为每个请求重新建立 TCP 连接，效率低下；1.1 版本引入了可复用连接的持久连接（Persistent Connection）；2.x 版本则在一个连接中实现多个消息的多路复用（Multiplexing）。HTTP/3 据称运行在基于 UDP 的 QUIC 协议之上。

## HTTPS 是在 HTTP 之上叠加了 TLS

MDN 将 TLS 描述为一种在不安全的网络中进行安全通信的协议，而 HTTPS 则是使用 TLS 保护 HTTP 的结果。其提供的保障可归纳为三点：

| 属性 | 含义 |
|---|---|
| 加密 | 防止中间人窃读 |
| 完整性 | 防止中间人篡改 |
| 认证 | 验证所连接的服务器是否确为该域名 |

在握手（handshake）过程中，双方协商 TLS 版本和加密套件，完成服务器认证并生成共享密钥。此后，所有的 HTTP 头部和正文都将使用该密钥进行加密。服务器认证是通过数字证书实现的。证书中包含服务器的公钥，并由 CA（证书颁发机构）的电子签名绑定到特定域名上。关于密钥、签名和哈希为何如此运作，将在 [详细 → 加密·哈希·认证基础](#/post/sec-authn-crypto) 中另行说明。

容易混淆的是顺序问题：首先通过 TCP 建立连接（三次握手），然后在此基础上进行 TLS 握手，最后才发送加密后的 HTTP 请求。使用 HTTPS 并不意味着不再需要 TCP。

## 在地址栏输入后发生的过程

将上述过程串联起来便是如下流程：

1. 通过 DNS 将域名解析为 IP 地址。
2. 与该 IP 的 443 端口建立 TCP 连接。
3. 通过 TLS 握手建立加密通道。
4. 发送 HTTP 请求并接收响应。
5. 接收响应中的 HTML 并在屏幕上渲染。[详细 → 浏览器渲染页面的过程](#/post/fe-browser-render)

关于服务器端该请求经过了哪些环节，可参考 [详细 → 单个请求的流转路径](#/post/infra-request-journey) 和 [详细 → 请求处理流程](#/post/be-request-flow)。

<details>
<summary>几个常见的误解</summary>

- "使用 HTTPS 就意味着服务器是安全的"：TLS 仅保护传输通道，并不能防止服务器代码中的漏洞。这是一个普遍观点，并非出自特定文档的原文。
- "HTTP 会保持连接"：HTTP 消息本身是无状态的。复用连接（持久连接）与记忆状态（会话）是两个不同的概念。
- "UDP 无法使用"：只是用途不同而已。在某些情况下，应用程序自行处理顺序和重传可能更为合适。
- "三次握手是安全流程"：它并非安全措施，而是双方同步序列号的过程。加密由 TLS 负责。
- "OSI 七层模型就是实际实现"：互联网是基于 TCP/IP 构建的，而 OSI 更接近于一种描述模型。

</details>

## 推荐阅读文章

← [CS·设计基础图谱](#/post/cs-map)（概念地图）

- [详细 → 操作系统基础](#/post/cs-os)：介绍 OS 如何处理套接字和端口
- [详细 → 负载均衡器](#/post/infra-load-balancer)：请求分发到多台服务器的节点
- [详细 → CDN 与缓存层级](#/post/infra-cdn-cache)：DNS 解析后的下一个目的地未必是服务器

## 参考链接

- MDN, HTTP 概述：https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- RFC 9293, 传输控制协议（仅阅读前 100,000 字符）：https://www.rfc-editor.org/rfc/rfc9293.html
- MDN, DNS（术语表）：https://developer.mozilla.org/en-US/docs/Glossary/DNS
- MDN, 传输层安全：https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security