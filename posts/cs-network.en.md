Networks become clear when broken down into layers. Addresses are converted to IP (via DNS), connections are established (TCP), encryption is set up (TLS), and requests and responses are exchanged on top of that (HTTP). These four steps occur in sequence.

## Looking at the Layers

The first concepts introduced when discussing networks are the OSI 7-layer model and the TCP/IP 4-layer model. Both are "diagrams that split communication by function," but the actual Internet uses TCP/IP. The 7-layer model is more frequently used for explanation purposes.

| TCP/IP | OSI Equivalent | Function | Example |
|---|---|---|---|
| Application | 5–7 | Rules for apps to communicate with each other | HTTP, DNS, TLS |
| Transport | 4 | Delivery between processes (ports) | TCP, UDP |
| Internet | 3 | Routing to the destination IP | IP |
| Link | 1–2 | Delivery to immediately adjacent devices | Ethernet, Wi-Fi |

There is some debate about which layer TLS belongs to. It is usually depicted between the Transport and Application layers, so in this table it is placed on the Application side.

The reason for dividing into layers is simple: upper layers do not need to know how lower layers deliver data. HTTP operates under the assumption that a "reliable channel exists" and does not care whether that channel is Wi-Fi or wired. As data moves down each layer, a header is appended (encapsulation).

## DNS: Converting Addresses to IP

Humans type `example.com`, but computers communicate using IPs, so translation is required in between. MDN describes DNS as a "hierarchical and distributed naming system" that manages information such as domain names and IPs. This means there isn't a single phonebook; instead, multiple servers share the load.

In Python, this translation takes just one line:

```python
import socket
print(socket.getaddrinfo('example.com', 443, proto=socket.IPPROTO_TCP)[0][4])
# ('104.20.23.154', 443)   <- 실행해서 나온 값, 시점·위치마다 다를 수 있다
```

This single line asks the resolver (operating system) on your PC for the answer. If it's in the cache, the response is immediate; otherwise, it queries upstream DNS servers.

## Establishing a Connection with TCP

Once you know the IP, you establish a connection. Before sending data, TCP ensures both sides agree on sequence numbers, which is known as the 3-way handshake. Based on RFC 9293, the flow is as follows:

1. The client sends a SYN (containing its initial sequence number, ISN).
2. The server responds with its own SYN and an ACK for the client's SYN (SYN-ACK).
3. The client sends an ACK for the server's SYN. From this point onward, the connection is ESTABLISHED and data flows.

```
클라이언트                    서버
   |---- SYN, seq=100 ------->|
   |<--- SYN, seq=300, ACK=101-|
   |---- ACK=301 ------------>|
   |====== 데이터 ============|
```

This is an example using the numbers (100, 300) directly from the RFC diagram. Actual ISNs are determined by mixing a clock with a secret key, so they do not simply start at 100 arbitrarily.

The reason for three steps may seem strange at first, but it is necessary for both sides to announce their starting numbers and confirm receipt of each other's. With only two steps, the server would not know if the client received its number.

Reliability stems from this foundation. Each byte has a number, ACKs are sent cumulatively, lost packets are retransmitted, errors are detected via checksums, and the receiver adjusts speed based on the advertised window size (flow control). Congestion control is mandatory, though its definition is in separate documents as noted in the RFC. To close, FIN messages are exchanged, and the side that closes first stays in TIME-WAIT for 2×MSL. There is also a method to terminate abruptly using RST.

<details>
<summary>TCP vs UDP: Try it yourself</summary>

I tested two types of sockets within the same PC and ran both to check the output.

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

The outputs were `Server received: b'ping'`, `Client received: b'pong'`, and `UDP: b'hi'`. The handshake occurs inside the `create_connection` call and is not visible in the code. UDP does not have `connect` or `accept` itself.

</details>

## What's the Difference Between TCP and UDP?

| | TCP | UDP |
|---|---|---|
| Connection | Established first | None |
| Order & Retransmission | Guaranteed | None (handled by app) |
| Overhead | High | Low |
| Use Cases | Web, email, files | Real-time voice/video, games, etc. |

The statement "UDP is fast" is half true. It has low latency simply because it lacks retransmission and ordering; lost packets are just gone. For real-time calls, late-arriving audio is useless anyway, making UDP suitable. In some cases, apps implement ordering and retransmission directly on top of UDP.

## HTTP: One Request, One Response

HTTP is an application-layer protocol. According to MDN, in a client-server structure, the client always initiates the request. The message format looks like this:

```
GET / HTTP/1.1
Host: developer.mozilla.org
Accept-Language: fr
```

A request consists of a method, path, version, headers, and optionally a body. A response includes a version, status code (e.g., `200 OK`), headers, and a body. For details on how methods and status codes are used, see [API and REST →](#/post/be-api-rest).

HTTP itself is stateless. Since it does not remember previous requests, features like login persistence or shopping carts are implemented by adding headers such as cookies. This "statelessness" also makes it easier to scale servers across multiple instances.

Transmission methods varied by version. According to MDN, HTTP/1.0 was inefficient because it opened a new TCP connection for every request; HTTP/1.1 introduced persistent connections that reuse the connection; and HTTP/2 multiplexes multiple messages over a single connection. HTTP/3 is known to run on top of UDP-based QUIC.

## HTTPS is HTTP with TLS layered on top

MDN describes TLS as a protocol that enables secure communication over untrusted networks, and HTTPS is HTTP protected by TLS. The benefits can be summarized in three points:

| Attribute | Meaning |
|---|---|
| Encryption | Prevents intermediaries from reading the content |
| Integrity | Prevents intermediaries from tampering with the content |
| Authentication | Verifies that the connected server is indeed the domain it claims to be |

During the handshake, the TLS version and cipher suite are negotiated, the server is authenticated, and a shared secret key is established. Subsequently, all HTTP headers and body content are encrypted using this key. Server authentication is performed via certificates. A certificate contains the server's public key along with a digital signature from a Certificate Authority (CA), binding the key to the domain. Why keys, signatures, and hashes work in such specific ways is explained separately in [Encryption, Hashing, and Authentication Basics →](#/post/sec-authn-crypto).

A common point of confusion is the order of operations: a connection is first established via TCP (3-way handshake), followed by the TLS handshake, and only then are HTTP requests sent encrypted. HTTPS does not eliminate the need for TCP.

## What happens after you type in the address bar

Putting it all together, the process looks like this:

1. The domain name is resolved to an IP address via DNS.
2. A TCP connection is established to port 443 of that IP.
3. Encryption is set up via the TLS handshake.
4. An HTTP request is sent and a response is received.
5. The HTML in the response is rendered on the screen. [See details → How browsers render pages](#/post/fe-browser-render)

For information on where this request goes on the server side, see [The Journey of a Single Request →](#/post/infra-request-journey) and [How Requests Are Processed →](#/post/be-request-flow).

<details>
<summary>A few common misconceptions</summary>

- "HTTPS means the server is safe": TLS only protects the transmission channel; it does not protect against vulnerabilities in the server code. This is a general statement, not a specific documented guarantee.
- "HTTP maintains connections": HTTP messages themselves are stateless. Reusing connections (persistent connections) and maintaining state (sessions) are different concepts.
- "UDP cannot be used": It simply serves a different purpose. There are cases where it is better for applications to handle ordering and retransmission directly.
- "3-way handshake is a security procedure": It is not about security; rather, it aligns sequence numbers between both parties. Encryption is handled by TLS.
- "The OSI 7-layer model reflects actual implementation": The internet was built based on TCP/IP, while the OSI model is closer to an explanatory framework.

</details>

## Related Reading

← [CS & Design Basics Map](#/post/cs-map) via concept map

- [Operating System Basics →](#/post/cs-os): How the OS handles sockets and ports
- [Load Balancer →](#/post/infra-load-balancer): Where requests are distributed across multiple servers
- [CDN and Caching Layer →](#/post/infra-cdn-cache): The destination after DNS may not always be a server

## Reference Links

- MDN, An overview of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- RFC 9293, Transmission Control Protocol (read only the first 100,000 characters): https://www.rfc-editor.org/rfc/rfc9293.html
- MDN, DNS (Glossary): https://developer.mozilla.org/en-US/docs/Glossary/DNS
- MDN, Transport Layer Security: https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security