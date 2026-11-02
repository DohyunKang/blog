HTTP is a protocol where the server returns a single response after the client sends a request. We have already reviewed the full flow (DNS → TCP → TLS → HTTP) in [Network Basics](#/post/cs-network), and here we dive deeper into HTTP messages themselves, the rules layered on top (methods, status codes, caching), and differences between HTTPS and various versions. The code below was all executed locally.

## Messages are Text

An HTTP/1.1 message consists of a start line, multiple header lines, an empty line, and then the body. Line breaks are `\r\n`. I sent request strings directly via Python sockets and printed the responses as received.

```python
import socket
s = socket.create_connection(('127.0.0.1', port))   # port: 로컬에 띄운 http.server
s.sendall(b'GET / HTTP/1.1\r\nHost: x\r\n\r\n')
print(s.recv(4096).decode())
```

The response looked like this (Date omitted).

```
HTTP/1.1 200 OK
Server: BaseHTTP/0.6 Python/3.13.15
Content-Length: 11
ETag: "8097d38e"
Cache-Control: no-cache

<h1>hi</h1>
```

Here, `Content-Length` is important. Since responses may continue over a single TCP connection, the receiver must know where the body ends. If the length is known in advance, use `Content-Length`; otherwise, send chunked data with `Transfer-Encoding: chunked`. I created a `/chunk` path on the same server and received raw output like this upon request.

```
b'...Transfer-Encoding: chunked\r\n\r\n6\r\nhello \r\n7\r\nchunked\r\n0\r\n\r\n'
```

The `6` and `7` are the lengths of each chunk (in hexadecimal), and the final `0` marks the end. When using `http.client` to receive the same path, the chunks are combined into `b'hello chunked'`. This part is handled by the client library on your behalf.

Even when sending requests consecutively over the same socket, the connection does not break. Since the server responds with `HTTP/1.1`, persistent connections are the default, allowing four requests (GET, conditional GET, chunked GET, POST) to be processed over a single socket.

## Methods: Safe and Idempotent

Methods indicate "what you want to do with this resource," and MDN categorizes them by two properties. **Safe** means read-only operations that do not change server state. **Idempotent** means that sending the same request multiple times results in the same server state as sending it once. All safe methods are idempotent.

| Method | Safe | Idempotent | Cacheable |
|---|---|---|---|
| GET | O | O | O |
| HEAD | O | O | O |
| OPTIONS | O | O | X |
| PUT | X | O | X |
| DELETE | X | O | X |
| POST | X | X | Conditional |
| PATCH | X | X | Conditional |

This table is practically meaningful due to retries. When a response is interrupted mid-way and success is uncertain, re-sending `PUT /users/42` (overwrite entirely) yields the same result, whereas re-sending `POST /users` could create two users. How to choose methods in an API continues in [APIs and REST](#/post/be-api-rest).

<details>
<summary>Sending a POST</summary>

Requests with a body must specify the length using `Content-Length`. I sent this via socket to the same local server, and the first line of the response was `HTTP/1.1 201 Created`.

```python
s.sendall(b'POST /u HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\nab')
print(s.recv(4096).decode().splitlines()[0])
```

The fact that the server read only 2 bytes of the body is thanks to the length header. If this length is incorrect, the next request's start will be misread.

</details>

## Status Codes: Read the First Digit

| Class | Meaning |
|---|---|
| 1xx | Informational (intermediate response) |
| 2xx | Success (processed) |
| 3xx | Redirection (additional action required) |
| 4xx | Client Error (request was invalid) |
| 5xx | Server Error (server could not process the request) |

Here are some commonly confused pairs:

- `301` and `302` indicate permanent or temporary redirects, while `307` and `308` are their counterparts that preserve the original method. Thus, even if a POST is redirected, it remains a POST.
- `401 Unauthorized` means "authentication failed," whereas `403 Forbidden` means "you are identified but not authorized." Logging in again won't resolve a `403`.
- `404 Not Found` indicates the resource was not found; some servers use `404` instead of `403` to hide the existence of a resource.
- `429 Too Many Requests` means too many requests were sent within a certain time, while `503 Service Unavailable` means the server is currently unable to handle requests due to maintenance or overload. Both can include a `Retry-After` header to indicate when to retry.
- `304 Not Modified` is not an error but a cacheable response; we'll see more about that below.

## Caching and Conditional Requests

Earlier, the server provided `ETag` and `Cache-Control: no-cache`. Note that `no-cache` does not mean "do not store"; it means "verify with the server before using." To prevent storage entirely, use `no-store`. This pair is often confused due to their names.

| | no-cache | no-store |
|---|---|---|
| Store | Yes | No |
| Reuse | After server verification | Not applicable |
| If unchanged | Returns 304 with no body | Always returns 200 |

Sent a request again on the same connection with the received `ETag` in the `If-None-Match` header.

```
GET / HTTP/1.1
If-None-Match: "8097d38e"

HTTP/1.1 304 Not Modified
ETag: "8097d38e"
```

Only headers arrived without a body. The client can simply reuse its existing copy. If the content has changed, the server returns a 200 status along with a new `ETag` and the new body. For static files where the filename includes a version number, patterns like `Cache-Control: public, max-age=31536000, immutable` inform the server that the resource is fresh for a long time, preventing further checks; this pattern is recommended by MDN. The fact that caching also occurs at intermediate layers (CDNs) rather than just in the browser continues in [more detail → CDNs and Caching Layers](#/post/infra-cdn-cache).

## HTTPS: TLS Handshake Overview

HTTPS sends HTTP messages inside a TLS channel. The handshake for TLS 1.3 (RFC 8446) generally flows as follows:

1. The client sends a ClientHello, including supported cipher suites and the key exchange public value (`key_share`).
2. The server selects a suite via ServerHello and returns its own `key_share`. From this point onward, both parties can generate handshake keys, so subsequent handshake messages are encrypted.
3. The server sends the certificate chain (Certificate) and signs the entire handshake history up to that point with the private key of that certificate (CertificateVerify) to prove ownership of the key. It confirms the entire content via Finished.
4. Once the client also sends Finished, application data (HTTP) flows through.

For the initial connection, this takes one round trip (1-RTT). If the `key_share` group sent by the server does not match, the process goes back once more with a HelloRetryRequest. If a previously shared key (PSK) exists, 0-RTT is possible by sending data in the first flight; however, this initial data lacks forward secrecy and is vulnerable to replay attacks. Therefore, RFCs specify that only idempotent requests suitable for reprocessing should be sent. The method table above is used again here.

I verified this locally. I created a self-signed certificate using `openssl` and ran both the server and client in the same process using Python's `ssl`.

```python
cc = ssl.create_default_context(cafile='c.pem')
t = cc.wrap_socket(raw, server_hostname='localhost')
print(t.version(), t.cipher())
print(t.getpeercert()['subject'])
t.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
```

The output was as follows:

```
TLSv1.3 ('TLS_AES_256_GCM_SHA384', 'TLSv1.3', 256)
((('commonName', 'localhost'),),)
b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'
```

TLS 1.3 was negotiated, the client verified the certificate name (`server_hostname`), and the decrypted plaintext HTTP request arrived intact at the server-side `recv`. The format of HTTP messages remains unchanged even over TLS. For details on how certificates, signatures, and hashes establish trust, see [more detail → Fundamentals of Encryption, Hashing, and Authentication](#/post/sec-authn-crypto).

<details>
<summary>Execution Environment</summary>

- Python 3.13; `ssl.OPENSSL_VERSION` is OpenSSL 3.0.x; `ssl.HAS_TLSv1_3` is True.
- The certificate was a one-day self-signed certificate created with `openssl req -x509`, with `localhost` added to the subjectAltName.
- Since the local experiment was conducted on a single PC, round-trip time (RTT) differences were not measured.

</details>

## Differences by Version: 1.1, 2, 3

The meanings of the three versions (methods, status codes, header concepts) are the same, but their transmission methods differ.

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Format | Text | Binary | Binary |
| On a single connection | Requests in order (pipelining existed) | Multiple requests simultaneously (multiplexing) | Simultaneously, independent per stream |
| Underlying transport | TCP | TCP | QUIC (over UDP) |
| Headers | Sent as-is every time | Compressed | Compressed |

HTTP/1.1 reused connections but suffered from the head-of-line blocking issue where a subsequent response could not be received until the preceding response finished; browsers worked around this by opening up to six TCP connections per origin. HTTP/2 allowed parallel requests on a single connection, eliminating this constraint. However, since it runs over a single TCP connection, if one packet is lost and TCP retransmits it, all streams on that connection must wait. HTTP/3 uses QUIC over UDP instead of TCP; QUIC handles loss detection and retransmission per stream, so only the affected streams are blocked. For more details on TCP's operation, see [more detail → TCP and UDP](#/post/net-tcp-udp).

## Common Misconceptions

- 304 is not an error; it is a normal response indicating that the cached copy is still valid.
- `no-cache` does not mean "do not cache"; it means to store but verify before reuse.
- 401 and 403 are not the same; one indicates authentication failure, while the other indicates insufficient authorization.
- HTTP/2 does not eliminate all limitations of TCP; those are addressed by HTTP/3.
- Even with HTTPS, the HTTP message itself remains unchanged; only the underlying channel changes.

## Related Reading

← [Concept Map](#/post/cs-map)

- [More details → Sockets and WebSockets](#/post/net-socket): More detailed explanation of the socket code used above
- [More details → DNS, IP, and Routing](#/post/net-dns-routing): What happens before establishing a connection
- [More details → APIs and REST](#/post/be-api-rest): How to use methods and status codes in APIs

## Reference Links

- MDN, HTTP request methods: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- MDN, Evolution of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP
- MDN, HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- RFC 8446, The Transport Layer Security (TLS) Protocol Version 1.3: https://www.rfc-editor.org/rfc/rfc8446.html