A socket is a communication endpoint provided by the OS, and a TCP socket only passes a stream of bytes, not messages. WebSockets start with a single HTTP request and follow rules where both sides can send messages at any time over the same TCP connection.

The overview is in [Network Basics](#/post/cs-network) and [Operating System Basics](#/post/cs-os), and here we focus on directly interacting with the socket API to see what happens.

## What is a Socket?

To communicate over a network, a program must ask the OS for help. The socket is the handle for that request. In Python, it's an object returned by `socket.socket()`, which you can treat as a file-like object for reading and writing. It attaches to an endpoint combining an address (IP) and a port.

The official Python Socket HOWTO clearly distinguishes between server sockets and client sockets. A server socket does not send or receive data itself; it only creates client sockets. Looking at the call order, it goes like this:

| | Server | Client |
|---|---|---|
| 1 | `socket()` create endpoint | `socket()` |
| 2 | `bind()` attach to address·port | |
| 3 | `listen()` wait for connections | |
| 4 | `accept()` take out one connection and get a new socket | `connect()` |
| 5 | `recv()` / `sendall()` | `sendall()` / `recv()` |
| 6 | `close()` | `close()` |

The socket returned by `accept()` is for actual conversation, while the listening socket remains open to accept the next connection. The 3-way handshake happens somewhere between `connect()` and `accept()`, handled automatically by the OS. We'll cover that separately in [TCP and UDP](#/post/net-tcp-udp).

## recv Does Not Return Messages

The most common mistake when first using sockets is assuming "send once, receive once." I tried it myself. The client sent `hello` and `world` separately twice, and the server read them 0.3 seconds later.

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

The output was:

```
recv 1: b'helloworld'
recv 2: b''
```

The two sends arrived together as one chunk, and the second `recv` returned empty bytes. Empty bytes signal that the other side has closed the connection. The HOWTO says the same thing: sockets have no message end markers; you must define message boundaries using fixed length, delimiters, length prefixes, or closing the connection.

The combined arrival was due to delay introduced in my PC's loopback; how data gets split varies by environment. Regardless, the app must define boundaries itself.

## Framing with Length Prefixes

A common method in practice is prefixing the length. Write the body length in the first 4 bytes and read that many. Be careful here: `recv(n)` doesn't promise to fill n bytes; it means up to n bytes, so you must loop until exactly n bytes are received. The HOWTO notes that a length of 5 characters might not be received in one `recv` call.

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

`'!I'` is an unsigned 4-byte integer in network byte order (big endian). For Korean, the length is counted based on the number of bytes after UTF-8 encoding. Thanks to this rule, the same data was split into exactly three chunks, unlike the earlier example.

HTTP solves the same problem with `Content-Length` headers or chunked transfer encoding. WebSockets frames also include a length field, which appears later.

## Blocking and Concurrent Connections

`accept()` and `recv()` are blocking by default; they stop at that line until data arrives. The HOWTO warns that if the other side doesn't close the connection but disappears, the socket can hang for a long time. Using one thread per connection is simple, but hanging connections keep threads occupied. Thread-related topics continue in [Processes and Threads](#/post/os-process-thread).

Alternatives are non-blocking sockets and `select`. According to the HOWTO, `select` returns sockets that can be read or written; when a server socket becomes readable, `accept()` almost certainly succeeds. On Windows, `select` works only with sockets, while on Unix it also works with files. I wrapped this in Python's standard library `selectors` and accepted three clients with a single thread.

<details>
<summary>Single-threaded echo server using selectors (run to verify)</summary>

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

The server loop runs on one thread, while the three clients each run in their own threads. This is a simple example assuming `sendall` finishes immediately because the echoed data is short. A server sending large data would also need to handle write-ready events.

</details>

This is the event loop. Python's `asyncio` and Node.js follow this same pattern; servers that don't create a thread for each request handle many connections this way. For how HTTP requests are processed on top of this, see [the request processing flow](#/post/be-request-flow).

## Why WebSockets Are Needed

HTTP requires the client to initiate a request before the server can respond. For scenarios where the server needs to speak first—such as chat, stock prices, or notifications—you must use polling to periodically check for updates. WebSockets change this paradigm. As MDN explains, WebSockets open a bidirectional session between the browser and the server, allowing messages to be exchanged without needing to poll for responses.

RFC 6455 states an important point: WebSockets are a protocol layered on top of TCP independently of HTTP; its relationship with HTTP is solely defined by a valid HTTP Upgrade request during the handshake. Therefore, ports 80 and 443 can be shared with standard HTTP servers.

## Handshake: Starting with HTTP and Transitioning to 101

The client sends a standard HTTP GET request. The headers include `Upgrade: websocket`, a `Sec-WebSocket-Key` consisting of a 16-byte random number encoded in base64, and version 13. The server responds with `101 Switching Protocols` and includes the computed value in the `Sec-WebSocket-Accept` header.

The calculation steps are:
- Append the fixed GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` to the client key string.
- Compute the SHA-1 hash.
- Encode the result in base64.

I calculated this using the example key provided in the RFC:

```python
import hashlib, base64
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
key = 'dGhlIHNhbXBsZSBub25jZQ=='
print(base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode())
# s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

This is the resulting value. This calculation serves as proof that the server understands the WebSocket handshake; it is not used for authentication or encryption. Encryption is handled by `wss://`, which implies TLS. If a status code other than 101 is received, the upgrade fails, and the request is processed according to standard HTTP rules. This request/response format is similar to what was discussed in [HTTP and HTTPS](#/post/net-http).

## Frame: The Unit Exchanged Over the Connection

Once the handshake is complete, the same TCP connection becomes the channel for exchanging WebSocket frames. As mentioned earlier, TCP does not provide boundaries; however, WebSockets solve this by including the length in the frame header. According to the RFC, the header structure is as follows:

| Field | Meaning |
|---|---|
| FIN | Indicates if this frame is the last piece of a message |
| opcode | 0x1 text, 0x2 binary, 0x8 close, 0x9 ping, 0xA pong, 0x0 continuing frame |
| MASK | Indicates if a masking key is applied |
| Length | If 0–125, the length is direct; if 126, the next 2 bytes are the length; if 127, the next 8 bytes are the length |

Frames sent by the client must be masked, and the server must reject unmasked frames. Frames sent by the server are not masked. The method involves XORing the $i$-th byte of the payload with the $i \mod 4$-th byte of the key. The reason given in the RFC is to prevent intermediate devices like cache proxies from being confused and to ensure that malicious scripts cannot arbitrarily modify bytes transmitted on the wire. The key must be unpredictable, as stated in the RFC. Masking is not encryption.

Ping and Pong are control frames used for connection health checks. The receiver responds with a pong, and exchanging close frames terminates the TCP connection.

## Implementing WebSockets in Python Without Libraries

I implemented the above rules using only sockets without any libraries. The server side handles the handshake response and reading/writing frames, while the client sends masked text frames. This is a minimal implementation intentionally excluding lengths over 126, fragmented messages, and ping handling.

<details>
<summary>WebSocket Echo Implemented with Only Sockets (Execution Verification)</summary>

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

Opcode 1 represents a text frame. The section reading the header during the handshake assumes that the request arrives in a single `recv` call; instead, it reads repeatedly until an empty line is received. The boundary issue observed earlier persists here as well.

</details>

Looking at the results, it becomes clear from the code that WebSockets are not a new transport mechanism but rather a promise layered on top of TCP sockets: "say hello via HTTP and speak via frames."

## Common Misconceptions

- "WebSockets are a different connection than TCP": They use the same TCP connection. Only the protocol changes after the handshake is complete.
- "One `send` on a socket corresponds to one `recv` on the other side": As shown in the experiment above, data can arrive in bursts. The application must define boundaries.
- "Masking is a security feature": The purpose stated in the RFC is to prevent intermediate devices from being confused and to prevent malicious scripts from manipulating bytes. Hiding content is handled by TLS.
- "WebSockets are always better than polling": Since the connection remains open, the server must hold resources for each connection. This aspect leads into design considerations involving [load balancers](#/post/infra-load-balancer) or [asynchronous processing and message queues](#/post/be-async-queue).
- "The browser's `WebSocket` automatically adjusts speed": MDN notes that this API does not support backpressure (a mechanism to slow down the sender when the receiver cannot handle incoming data). If messages arrive faster than they can be processed, memory may fill up or CPU usage could reach 100%. In such cases, it recommends using the WebTransport API.

## Related Reading

← Concept map: [CS & Design Fundamentals](#/post/cs-map)

- [Read more → TCP and UDP](#/post/net-tcp-udp): The layer below sockets responsible for connections and delivery
- [Read more → HTTP and HTTPS](#/post/net-http): The shape of HTTP that WebSockets ride on for the handshake
- [Read more → Synchronization and Deadlocks](#/post/os-sync-deadlock): Issues that arise when handling sockets with threads

## Reference Links

- Python official documentation, Socket Programming HOWTO: https://docs.python.org/3/howto/sockets.html
- RFC 6455, The WebSocket Protocol (read only the first 100,000 characters): https://www.rfc-editor.org/rfc/rfc6455.html
- MDN, The WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API