HTTP 是一种协议，当客户端发送请求时，服务器会返回一个响应。整个流程（DNS → TCP → TLS → HTTP）已在 [详见 → 网络基础](#/post/cs-network) 中概述，本文将深入探讨 HTTP 消息本身及其上的规则（方法、状态码、缓存），以及 HTTPS 和不同版本之间的差异。以下代码均已在本地运行测试。

## 消息是文本

HTTP/1.1 消息由起始行、多行头部、空行和本体组成。换行符为 `\r\n`。我通过 Python socket 直接发送了请求字符串，并打印了原始响应。

```python
import socket
s = socket.create_connection(('127.0.0.1', port))   # port: 로컬에 띄운 http.server
s.sendall(b'GET / HTTP/1.1\r\nHost: x\r\n\r\n')
print(s.recv(4096).decode())
```

响应如下（Date 字段已省略）：

```
HTTP/1.1 200 OK
Server: BaseHTTP/0.6 Python/3.13.15
Content-Length: 11
ETag: "8097d38e"
Cache-Control: no-cache

<h1>hi</h1>
```

此处 `Content-Length` 非常重要。由于响应会连续到达同一个 TCP 连接上，接收方必须知道本体何时结束。如果预先知道长度，则使用 `Content-Length`；否则使用 `Transfer-Encoding: chunked`，以块为单位附加长度信息。在相同服务器上创建 `/chunk` 路径并发起请求，原始响应如下：

```
b'...Transfer-Encoding: chunked\r\n\r\n6\r\nhello \r\n7\r\nchunked\r\n0\r\n\r\n'
```

其中的 `6` 和 `7` 是每个块的长度（十六进制），最后的 `0` 表示结束标记。如果使用 `http.client` 接收相同路径的请求，块会被合并，得到 `b'hello chunked'`。这是客户端库代为解析的部分。

即使连续向同一个 socket 发送多个请求，连接也不会断开。由于服务器响应 `HTTP/1.1`，默认启用持久连接，因此通过单个 socket 处理了 4 个请求（GET、条件 GET、chunk GET、POST）。

## 方法：安全与幂等

HTTP 方法表示“希望对该资源执行什么操作”。MDN 将其分为两种属性：安全（safe）指不改变服务器状态的只读操作；幂等（idempotent）指多次发送相同请求后，服务器状态与发送一次后的结果一致。所有安全的方法都是幂等的。

| 方法 | 安全 | 幂等 | 可缓存 |
|---|---|---|---|
| GET | O | O | O |
| HEAD | O | O | O |
| OPTIONS | O | O | X |
| PUT | X | O | X |
| DELETE | X | O | X |
| POST | X | X | 条件 |
| PATCH | X | X | 条件 |

此表在实际工作中有意义的原因在于重试场景。当响应中途中断导致无法判断是否成功时，`PUT /users/42`（整体覆盖）再次发送会得到相同结果；而 `POST /users` 可能导致创建两个用户。如何在 API 中选择方法可参考 [详见 → API 与 REST](#/post/be-api-rest)。

<details>
<summary>尝试发送 POST</summary>

包含本体的请求必须通过 `Content-Length` 告知长度。向同一本地服务器通过 socket 发送后，响应首行为 `HTTP/1.1 201 Created`。

```python
s.sendall(b'POST /u HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\nab')
print(s.recv(4096).decode().splitlines()[0])
```

服务器仅读取了 2 字节本体即结束，这得益于长度头部。若该长度错误，会导致后续请求起始位置被误读。

</details>

## 状态码从第一位开始解读

| 类别 | 含义 |
|---|---|
| 1xx | 进行中（中间响应） |
| 2xx | 已接收并处理 |
| 3xx | 需执行额外操作，如重定向到其他 URL |
| 4xx | 请求错误 |
| 5xx | 服务器无法正确处理有效请求 |

单独整理易混淆的组合：

- 301 和 302 分别表示永久/临时重定向；307 和 308 分别是 302 和 301 的对应版本，区别在于它们不会改变请求方法。因此即使 POST 被重定向，仍保持为 POST。
- 401 名称为 Unauthorized，实际含义是“未认证”；403 表示已知用户但无权限，重新登录也无法解决 403。
- 404 表示资源未找到，有些服务器为避免暴露资源存在性而用 404 代替 403。
- 429 表示在单位时间内请求过多；503 表示因维护或过载暂时不可用。两者均可通过 `Retry-After` 头部告知何时重试。
- 304 并非错误，而是缓存响应，下文将详细说明。

## 缓存与条件请求

前述服务器已下发 `ETag` 和 `Cache-Control: no-cache`。`no-cache` 并非“禁止存储”，而是“写入前需向服务器确认”；真正禁止存储的是 `no-store`。因名称相似，这是最容易混淆的一对。

| | no-cache | no-store |
|---|---|---|
| 是否存储 | 是 | 否 |
| 是否可重用 | 经服务器验证后 | 不可用 |
| 内容未变化时 | 返回 304，无本体 | 每次返回 200 |

收到 `ETag` 并将其放入 `If-None-Match` 头字段，通过相同的连接再次发起请求。

```
GET / HTTP/1.1
If-None-Match: "8097d38e"

HTTP/1.1 304 Not Modified
ETag: "8097d38e"
```

服务器仅返回了响应头，没有正文。客户端可以直接使用本地已有的副本。如果内容已更改，服务器会返回状态码 200、新的 `ETag` 以及新的正文。对于文件名中包含版本号的静态文件，可以采用类似 `Cache-Control: public, max-age=31536000, immutable` 的方式，明确告知其长期有效且不可变，从而避免向服务器发起验证请求；这种模式在 MDN 的推荐示例中有所提及。关于缓存不仅存在于浏览器中还存在于中间层（CDN）的情况，详见 [详细 → CDN 与缓存层级](#/post/infra-cdn-cache)。

## HTTPS: TLS 握手概述

HTTPS 是将 HTTP 消息封装在 TLS 通道中进行传输。TLS 1.3 (RFC 8446) 的握手流程大致如下：

1. 客户端发送 ClientHello，其中包含支持的加密套件以及用于密钥交换的公钥（key_share）。
2. 服务器通过 ServerHello 选择加密套件并返回其 key_share。从此时起，双方均可生成用于握手的密钥，因此后续的握手消息将被加密。
3. 服务器发送证书链（Certificate），并使用该证书的私钥对之前的握手过程进行签名（CertificateVerify）以证明密钥所有权。最后通过 Finished 消息确认整个握手内容。
4. 当客户端也发送 Finished 后，应用数据（HTTP）即可开始传输。

首次连接需要 1 次往返（1-RTT）。如果服务器返回的 key_share 组不匹配，则需通过 HelloRetryRequest 再次协商。如果之前已共享密钥（PSK），则可以在第一次飞行中同时发送数据（0-RTT），但这些初始数据不具备前向保密性且易受重放攻击。因此，RFC 规定仅应发送那些即使被重新处理也无妨的幂等请求。上述方法表在此处再次适用。

我在本地进行了验证。使用 `openssl` 创建了自签名证书，并通过 Python 的 `ssl` 库在同一进程中启动了服务器和客户端。

```python
cc = ssl.create_default_context(cafile='c.pem')
t = cc.wrap_socket(raw, server_hostname='localhost')
print(t.version(), t.cipher())
print(t.getpeercert()['subject'])
t.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
```

输出结果如下：

```
TLSv1.3 ('TLS_AES_256_GCM_SHA384', 'TLSv1.3', 256)
((('commonName', 'localhost'),),)
b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'
```

协商成功使用了 TLS 1.3，客户端已验证了证书名称（`server_hostname`），而服务器端的 `recv` 接收到了解密后的明文 HTTP 请求。在 TLS 之上，HTTP 消息的格式完全保持不变。关于证书、签名和哈希如何建立信任的详细内容，请参阅 [详细 → 加密·哈希·认证基础](#/post/sec-authn-crypto)。

<details>
<summary>运行环境</summary>

- Python 3.13，`ssl.OPENSSL_VERSION` 为 OpenSSL 3.0.x，`ssl.HAS_TLSv1_3` 为 True。
- 证书是使用 `openssl req -x509` 生成的有效期为 1 天的自签名证书，subjectAltName 中包含了 localhost。
- 上述本地实验在同一台 PC 上进行，因此未测量往返时间（RTT）差异。

</details>

## 各版本间的差异：1.1, 2, 3

这三个版本的含义（方法、状态码、头字段概念）相同，但传输方式不同。

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 格式 | 文本 | 二进制 | 二进制 |
| 单个连接中 | 按顺序发送请求（曾支持管道化） | 同时发送多个请求（多路复用） | 同时发送，各流独立 |
| 底层传输 | TCP | TCP | QUIC (基于 UDP) |
| 头字段 | 每次原样发送 | 压缩 | 压缩 |

HTTP/1.1 虽然支持连接复用，但存在“队头阻塞”问题（即必须等待前一个响应结束才能接收下一个响应），浏览器因此为每个来源最多建立 6 个 TCP 连接以绕过此限制。HTTP/2 允许在单个连接中并行发送请求，从而消除了这一限制。然而，由于 HTTP/2 仍运行在 TCP 之上，若发生数据包丢失，TCP 会进行重传，在此期间该连接上的所有流都必须等待。HTTP/3 则使用基于 UDP 的 QUIC 替代 TCP，QUIC 针对每个流独立进行丢包检测和重传，因此只有发生丢包的流会被阻塞。关于 TCP 自身的工作原理，详见 [详细 → TCP 与 UDP](#/post/net-tcp-udp)。

## 常见误解

- 304 不是错误。它是表示缓存副本仍然有效的正常响应。
- `no-cache` 并不意味着不要缓存。它的意思是：可以存储，但在重新使用之前需要向服务器验证。
- 401 和 403 含义不同。401 表示未通过认证，而 403 表示无权访问。
- HTTP/2 并不能消除 TCP 的所有限制。解决这些限制的改进体现在 HTTP/3 中。
- 即使是 HTTPS，HTTP 消息本身也保持不变。发生变化的是其下方的传输通道。

## 推荐阅读

← [概念地图](#/post/cs-map)

- [详细 → Socket 与 WebSocket](#/post/net-socket): 对上面使用的 Socket 代码进行更详细的说明
- [详细 → DNS 与 IP·路由](#/post/net-dns-routing): 建立连接之前发生的事件
- [详细 → API 与 REST](#/post/be-api-rest): 在 API 中使用方法和状态码的方法

## 参考链接

- MDN, HTTP 请求方法：https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
- MDN, HTTP 响应状态码：https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- MDN, HTTP 的演进：https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP
- MDN, HTTP 缓存：https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- RFC 8446, The Transport Layer Security (TLS) Protocol Version 1.3: https://www.rfc-editor.org/rfc/rfc8446.html