Socket 是操作系统提供的通信端点，TCP Socket 仅传递字节流而非消息。WebSocket 始于一次 HTTP 请求，其规则是在同一个 TCP 连接上允许双方随时发送消息。

概述见 [网络基础](#/post/cs-network) 和 [操作系统基础](#/post/cs-os)，本文重点在于直接操作 Socket API 以观察其行为。

## Socket 是什么

程序若要通过网络通信，必须向操作系统求助，而 Socket 便是发出请求的“抓手”。在 Python 中，`socket.socket()` 返回的对象即为 Socket，可将其视为类似文件的读写对象，并绑定到由 IP 地址和端口组成的端点上。

Python 官方 Socket HOWTO 明确区分了服务器 Socket 与客户端 Socket：服务器 Socket 既不发送也不接收数据，仅用于创建客户端 Socket。按调用顺序来看如下：

| | 服务器 | 客户端 |
|---|---|---|
| 1 | `socket()` 创建端点 | `socket()` |
| 2 | `bind()` 绑定地址与端口 | |
| 3 | `listen()` 监听连接 | |
| 4 | `accept()` 取出一个连接并接收新 Socket | `connect()` |
| 5 | `recv()` / `sendall()` | `sendall()` / `recv()` |
| 6 | `close()` | `close()` |

`accept()` 返回的 Socket 用于实际对话，而监听 Socket 则继续保留以接收后续连接。3-way handshake（三次握手）由操作系统在 `connect()` 与 `accept()` 之间的某个时刻自动完成。这部分内容将在 [TCP 与 UDP](#/post/net-tcp-udp) 中单独讨论。

## recv 并不返回完整消息

初学 Socket 时最常见的误解是“发送一次就能接收一次”。我曾亲自测试：客户端分两次分别发送 `hello` 和 `world`，服务器则在 0.3 秒后读取数据。

```python
import socket, threading, time
srv = socket.socket(); srv.bind(('127.0.0.1', 0)); srv.listen()
port = srv.getsockname()[1]
def server():
    c, addr = srv.accept()
    time.sleep(0.3)
    print('recv 1:', c.recv(100))
    print('recv 2:', c.recv(100))
    c.close()
threading.Thread(target=server).start()
c = socket.create_connection(('127.0.0.1', port))
c.sendall(b'hello'); c.sendall(b'world')
c.close()
```

输出结果如下：

```
recv 1: b'helloworld'
recv 2: b''
```

两次发送的内容被合并为一次返回，而第二次 `recv` 收到的是空字节流。空字节流表示对方已关闭连接。HOWTO 中也提到同样的观点：Socket 没有消息结束标记，因此必须约定消息边界——要么采用固定长度，要么使用分隔符，要么在开头注明长度，要么通过关闭连接来通知。

合并返回的情况是在我本地 PC 上设置延迟所致，具体如何分割则因环境而异。但无论如何，应用程序都必须自行确定消息边界。

## 带长度的帧（Framing）

实践中常见的方法是添加长度前缀：在前 4 个字节中写入正文长度，然后读取相应数量的数据。这里还需注意一点：`recv(n)` 并非承诺返回 n 个字节，而是表示最多返回 n 个字节，因此需循环调用直到恰好收到 n 个字节。HOWTO 也指出，一次 `recv` 可能无法接收完长度为 5 的字符串。

```python
import socket, struct, threading

def recv_exact(s, n):
    buf = b''
    while len(buf) < n:
        chunk = s.recv(n - len(buf))
        if not chunk:
            raise ConnectionError('closed')
        buf += chunk
    return buf

def send_msg(s, data):
    s.sendall(struct.pack('!I', len(data)) + data)

def recv_msg(s):
    (n,) = struct.unpack('!I', recv_exact(s, 4))
    return recv_exact(s, n)

srv = socket.socket(); srv.bind(('127.0.0.1', 0)); srv.listen()
port = srv.getsockname()[1]
def server():
    c, _ = srv.accept()
    for _ in range(3):
        print('받음:', recv_msg(c))
    c.close()
threading.Thread(target=server).start()
c = socket.create_connection(('127.0.0.1', port))
for m in [b'hello', b'world', '안녕'.encode()]:
    send_msg(c, m)
c.close()
```

```
받음: b'hello'
받음: b'world'
받음: b'\xec\x95\x88\xeb\x85\x95'
```

`'!I'` 是无符号 4 字节整数，采用网络字节序（大端序）。对于中文字符串，长度是按 UTF-8 编码后的字节数计算的。正是由于遵循此规则，相同的数据才会在本例中被精确分割为三个部分，而不同于前面的示例。

HTTP 通过 `Content-Length` 头或 chunked 传输机制解决类似问题。WebSocket 帧中也包含长度字段，将在后文介绍。

## 阻塞与并发连接

`accept()` 和 `recv()` 默认是阻塞式的：在数据到达前会一直挂起当前线程。HOWTO 警告说，若对方未关闭连接却已断开，Socket 可能会长时间挂起。虽然为每个连接分配一个线程较为简单，但阻塞的连接会持续占用该线程。关于线程的更多内容将在 [进程与线程](#/post/os-process-thread) 中继续探讨。

替代方案是非阻塞 Socket 和 `select`。根据 HOWTO 的描述，`select` 可筛选出可读或可写的 Socket；当服务器 Socket 变为可读状态时，调用 `accept()` 几乎必然成功。此外，在 Windows 上 `select` 仅适用于 Socket，而在 Unix 系统上也可用于文件。我使用 Python 标准库 `selectors` 封装后，用单个线程同时处理了三个客户端。

<details>
<summary>使用 selectors 实现的单线程 Echo 服务器（运行验证）</summary>

```python
import socket, selectors, threading
sel = selectors.DefaultSelector()
srv = socket.socket(); srv.bind(('127.0.0.1', 0)); srv.listen(); srv.setblocking(False)
port = srv.getsockname()[1]
sel.register(srv, selectors.EVENT_READ, 'accept')

def loop():
    done = 0
    while done < 3:
        for key, _ in sel.select(timeout=2):
            if key.data == 'accept':
                c, _ = srv.accept(); c.setblocking(False)
                sel.register(c, selectors.EVENT_READ, 'client')
            else:
                c = key.fileobj
                d = c.recv(100)
                if d:
                    c.sendall(d.upper())
                else:
                    sel.unregister(c); c.close(); done += 1

t = threading.Thread(target=loop); t.start()
res = {}
def client(i):
    s = socket.create_connection(('127.0.0.1', port))
    s.sendall(f'client{i}'.encode()); res[i] = s.recv(100); s.close()
cs = [threading.Thread(target=client, args=(i,)) for i in range(3)]
[x.start() for x in cs]; [x.join() for x in cs]; t.join()
print(sorted(res.items()))
```

```
[(0, b'CLIENT0'), (1, b'CLIENT1'), (2, b'CLIENT2')]
```

服务器循环仅使用一个线程，而三个客户端各自在独立线程中运行。这是一个简单示例，假设 Echo 数据较短，`sendall` 能立即完成。若服务器需处理大数据量，则还需关注可写事件。

</details>

这种方式就是事件循环。Python 的 `asyncio` 或 Node.js 都采用类似的模式，这类服务器不针对每个请求创建新线程，而是通过这种方式处理大量连接。关于 HTTP 请求的具体处理流程，请参阅 [请求处理流程](#/post/be-request-flow)。

## 为什么需要 WebSocket

HTTP 协议要求客户端必须先发起请求，服务器才能响应。对于聊天、股价行情或通知等需要服务器主动推送的场景，必须使用轮询（polling）机制定期询问。WebSocket 改变了这一模式。根据 MDN 的描述，WebSocket 在浏览器和服务器之间建立双向会话，从而可以在不进行轮询的情况下进行消息收发。

RFC 6455 中有一句关键的话：WebSocket 是独立于 HTTP、运行在 TCP 之上的协议；它与 HTTP 的关系仅在于握手过程是一个有效的 HTTP Upgrade 请求。因此，80 和 443 端口可以与 HTTP 服务器共用。

## 握手：从 HTTP 开始，以 101 状态码结束

客户端发送普通的 HTTP GET 请求。请求头中包含 `Upgrade: websocket`、由 16 字节随机数经 base64 编码生成的 `Sec-WebSocket-Key`，以及版本号 13。服务器则以 `101 Switching Protocols` 响应，并在 `Sec-WebSocket-Accept` 头中填入计算后的值。

- 在客户端密钥字符串后追加固定 GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`。
- 计算 SHA-1 哈希值。
- 将结果进行 base64 编码。

我使用 RFC 中给出的示例密钥进行了计算：

```python
import hashlib, base64
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
key = 'dGhlIHNhbXBsZSBub25jZQ=='
print(base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode())
# s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

得到了这个值。该计算过程用于证明服务器理解 WebSocket 握手，并非用于认证或加密。加密由 `wss://`（即 TLS）负责。如果收到非 101 的状态码，则意味着升级失败，将按普通 HTTP 规则处理。这种请求/响应格式与在 [HTTP 和 HTTPS](#/post/net-http) 中看到的相同。

## 帧：连接上交换的数据单元

握手完成后，同一个 TCP 连接便成为 WebSocket 帧的传输通道。前面提到 TCP 不提供消息边界，而 WebSocket 通过在帧头中指定长度来解决这一问题。根据 RFC 标准，帧头的结构如下：

| 字段 | 含义 |
|---|---|
| FIN | 该帧是否为消息的最后一片 |
| opcode | 0x1 文本、0x2 二进制、0x8 关闭、0x9 ping、0xA pong、0x0 延续片 |
| MASK | 是否附加了掩码密钥 |
| 长度 | 0~125 表示实际长度；126 表示后续 2 字节为长度；127 表示后续 8 字节为长度 |

客户端发送的帧必须经过掩码处理，服务器应拒绝未掩码的帧。服务器发送的帧则不需要掩码。其原理是对 payload 的第 i 个字节与密钥的第 `i mod 4` 个字节进行 XOR 运算。RFC 规定这样做是为了防止中间设备（如缓存代理）产生混淆，并阻止恶意脚本随意篡改传输中的字节。密钥必须是不可预测的。请注意，掩码并非加密。

ping 和 pong 是用于连接保活的控制帧。接收方需用 pong 响应 ping，双方交换 close 帧则关闭 TCP 连接。

## 用 Python 实现一次 WebSocket 通信

以上述规则为基础，我尝试仅使用 socket 库（不依赖第三方库）实现了 WebSocket。服务器端负责处理握手响应以及帧的读写，客户端发送经过掩码处理的文本帧。该实现故意省略了长度大于 126 的消息、分片消息及 ping 处理，属于最小化实现。

<details>
<summary>仅用 socket 实现的 WebSocket 回声服务（可运行验证）</summary>

```python
import socket, threading, hashlib, base64, os, struct
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

def recv_exact(s, n):
    b = b''
    while len(b) < n:
        c = s.recv(n - len(b))
        if not c: raise ConnectionError
        b += c
    return b

def read_frame(s):
    b1, b2 = recv_exact(s, 2)
    op, masked, n = b1 & 0x0F, b2 & 0x80, b2 & 0x7F
    if n == 126: n = struct.unpack('!H', recv_exact(s, 2))[0]
    elif n == 127: n = struct.unpack('!Q', recv_exact(s, 8))[0]
    mask = recv_exact(s, 4) if masked else None
    p = recv_exact(s, n)
    if mask: p = bytes(x ^ mask[i % 4] for i, x in enumerate(p))
    return op, p

def make_frame(op, payload, mask):
    h = bytes([0x80 | op])
    n = len(payload); m = 0x80 if mask else 0
    h += bytes([m | n]) if n < 126 else bytes([m | 126]) + struct.pack('!H', n)
    if mask:
        k = os.urandom(4)
        payload = k + bytes(x ^ k[i % 4] for i, x in enumerate(payload))
    return h + payload

srv = socket.socket(); srv.bind(('127.0.0.1', 0)); srv.listen()
port = srv.getsockname()[1]

def server():
    c, _ = srv.accept()
    req = b''
    while b'\r\n\r\n' not in req: req += c.recv(1024)
    hdr = dict(l.split(': ', 1) for l in req.decode().split('\r\n')[1:] if ': ' in l)
    acc = base64.b64encode(hashlib.sha1((hdr['Sec-WebSocket-Key'] + GUID).encode()).digest()).decode()
    c.sendall(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
               f'Sec-WebSocket-Accept: {acc}\r\n\r\n').encode())
    op, p = read_frame(c)
    print('서버가 받은 것:', op, p)
    c.sendall(make_frame(1, b'echo: ' + p, mask=False))
    c.close()

threading.Thread(target=server).start()
c = socket.create_connection(('127.0.0.1', port))
key = base64.b64encode(os.urandom(16)).decode()
c.sendall((f'GET /chat HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
           f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
resp = b''
while b'\r\n\r\n' not in resp: resp += c.recv(1024)
print(resp.decode().split('\r\n')[0])
exp = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
print('accept 일치:', exp in resp.decode())
c.sendall(make_frame(1, 'hi'.encode(), mask=True))
print('클라가 받은 것:', read_frame(c))
```

```
HTTP/1.1 101 Switching Protocols
accept 일치: True
서버가 받은 것: 1 b'hi'
클라가 받은 것: (1, b'echo: hi')
```

opcode 1 代表文本帧。在握手阶段读取头部的代码并未假设单次 `recv` 就能获取完整请求，而是循环读取直到出现空行为止。前面提到的边界问题在此处依然存在。

</details>

从结果可以看出，WebSocket 并非一种新的传输机制，而是在 TCP socket 之上叠加了“用 HTTP 打招呼、用帧说话”的约定。

## 常见误解

- "WebSocket 与 TCP 是不同的连接"：它们实际上是同一个 TCP 连接。握手完成后，仅仅是该连接的通信方式发生了变化。
- "一次 `send` 对应对方的一次 `recv`"：数据可以像上述实验那样连续发送，应用程序需要自行界定边界。
- "掩码是安全功能"：RFC 中阐明的目的是防止中间设备混淆以及恶意脚本对字节的篡改。隐藏内容是由 TLS 完成的。
- "WebSocket 总是优于轮询"：由于连接保持打开状态，服务器必须为每个连接持有资源。这一点会引出与 [负载均衡器](#/post/infra-load-balancer) 或 [异步处理与消息队列](#/post/be-async-queue) 相关的设计考量。
- "浏览器 `WebSocket` 会自动调节速度"：MDN 指出该 API 不支持背压（即接收方无法承受时，发送方减速的机制）。如果消息到达速度快于处理能力，可能导致内存耗尽或 CPU 占用率达到 100%；若遇到此类问题，建议使用 WebTransport API。

## 推荐阅读文章

← [CS·设计基础地图](#/post/cs-map)（概念图）

- [详细 → TCP 与 UDP](#/post/net-tcp-udp)：负责在套接字层管理连接和传输的组件
- [详细 → HTTP 与 HTTPS](#/post/net-http)：WebSocket 握手所基于的 HTTP 形态
- [详细 → 同步与死锁](#/post/os-sync-deadlock)：使用线程处理套接字时随之而来的问题

## 参考链接

- Python 官方文档，Socket Programming HOWTO: https://docs.python.org/3/howto/sockets.html
- RFC 6455, The WebSocket Protocol（仅阅读前 100,000 字符）: https://www.rfc-editor.org/rfc/rfc6455.html
- MDN, The WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API