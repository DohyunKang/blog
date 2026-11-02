HTTP is a protocol where the server returns one response when the client sends a request. We have already reviewed the entire flow (DNS → TCP → TLS → HTTP) in [Details → Network Basics](#/post/cs-network), and here we look more deeply at the HTTP message itself, the rules layered on top of it (methods, status codes, caching), and the differences between HTTPS and various versions. The code below was all executed locally.

## Messages are Text

An HTTP/1.1 message consists of a start line, multiple header lines, an empty line, and then the body. Line breaks are `\r\n`. I sent request strings directly via Python sockets and printed the responses as they came.

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

Here, `Content-Length` is important. Since responses continue over a single TCP connection, the receiver must know where the body ends. If the length is known in advance, use `Content-Length`; otherwise, send chunk-by-chunk lengths using `Transfer-Encoding: chunked`. I created a `/chunk` path on the same server and received it raw as follows.

```
b'...Transfer-Encoding: chunked\r\n\r\n6\r\nhello \r\n7\r\nchunked\r\n0\r\n\r\n'
```

The `6` and `7` are the lengths of each chunk (in hexadecimal), and the final `0` marks the end. If you receive this path via `http.client`, the chunks are merged to produce `b'hello chunked'`. This is the part where the client library handles the decoding for you.

Even if requests are sent consecutively on the same socket, the connection is not broken. When the server responds with `HTTP/1.1`, persistence is the default, so I processed four requests (GET, conditional GET, chunked GET, POST) over a single socket.

## Methods: Safe and Idempotent

Methods state "what you want to do with this resource," and MDN categorizes them by two properties. **Safe** means read-only operations that do not change server state, while **idempotent** means that sending the same request multiple times results in the same server state as sending it once. All safe methods are idempotent.

| Method | Safe | Idempotent | Cacheable |
|---|---|---|---|
| GET | O | O | O |
| HEAD | O | O | O |
| OPTIONS | O | O | X |
| PUT | X | O | X |
| DELETE | X | O | X |
| POST | X | X | Conditional |
| PATCH | X | X | Conditional |

This table is practically meaningful due to retries. When a response is interrupted mid-way and success is uncertain, re-sending `PUT /users/42` (overwriting entirely) yields the same result, whereas re-sending `POST /users` could create two users. How to choose methods in an API continues in [Details → APIs and REST](#/post/be-api-rest).

<details>
<summary>Sending a POST</summary>

Requests with a body must specify the length via `Content-Length`. I sent this to the same local socket, and the first line of the response was `HTTP/1.1 201 Created`.

```python
s.sendall(b'POST /u HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\nab')
print(s.recv(4096).decode().splitlines()[0])
```

The server reading only the first 2 bytes of the body is thanks to the length header. If this length is incorrect, the start of the next request will be misread.

</details>

## Status Codes: Read the First Digit

| Class | Meaning |
|---|---|
| 1xx | Informational (intermediate response) |
| 2xx | Success (processed) |
| 3xx | Redirection (additional action required) |
| 4xx | Client Error (request malformed) |
| 5xx | Server Error (unable to process request) |

Here are clarifications on commonly confused pairs:

- **301** and **302** indicate permanent and temporary redirects, respectively. **307** and **308** are their counterparts but differ in that they do not change the method; thus, a POST redirected with 307 remains a POST.
- **401** is named "Unauthorized" but means "authentication failed," whereas **403** means "you are identified but lack permission." Logging in again will resolve 401, but not 403.
- **404** means the resource was not found; however, some servers use 404 instead of 403 to hide the existence of a resource.
- **429** indicates too many requests in a given time window, while **503** means the service is currently unavailable due to maintenance or overload. Both can include a `Retry-After` header to inform when to retry.
- **304** is not an error but a cacheable response; we will see this below.

## Caching and Conditional Requests

The server above provided `ETag` and `Cache-Control: no-cache`. Note that `no-cache` does not mean "do not store"; it means "revalidate with the server before using." To prevent storage entirely, use `no-store`. This is the most commonly confused pair due to their names.

| | no-cache | no-store |
|---|---|---|
| Store | Yes | No |
| Reuse | After server validation | Not applicable |
| If unchanged | 304, no body | Always 200 |

`ETag` を受け取ったものを `If-None-Match` ヘッダーに設定して、同じ接続で再度リクエストを送信した。

```
GET / HTTP/1.1
If-None-Match: "8097d38e"

HTTP/1.1 304 Not Modified
ETag: "8097d38e"
```

本文ではなくヘッダーのみが返ってきた。クライアントは保持しているキャッシュをそのまま使用すればよい。内容が変更された場合、サーバーは新しい `ETag` とともに 200 ステータスコードと新しい本文を返す。ファイル名にバージョンが含まれる静的なファイルについては、MDN が推奨する例として、`Cache-Control: public, max-age=31536000, immutable` のように非常に新鮮であると明示し、サーバーへの問い合わせを回避するパターンが紹介されている。キャッシュがブラウザだけでなく中間（CDN）にも存在するという話は、[詳細 → CDN とキャッシュ階層](#/post/infra-cdn-cache) を参照のこと。

## HTTPS: TLS ハンドシェイクの概要

HTTPS は HTTP メッセージを TLS チャンネル内に封入して送信するものである。TLS 1.3(RFC 8446) のハンドシェイクは概ね以下の通り進行する。

1. クライアントが ClientHello を送信する。サポートする暗号スイートと、鍵交換用の公開値 (key_share) が含まれる。
2. サーバーが ServerHello でスイートを決定し、自身の key_share を返す。この時点から両者がハンドシェイク用キーを生成できるようになるため、以降のハンドシェイクメッセージは暗号化される。
3. サーバーが証明書チェーン (Certificate) を送信し、その証明書の秘密鍵を用いてこれまでのハンドシェイクに署名 (CertificateVerify) することでキー所有権を証明する。Finished で全体の内容を確認する。
4. クライアントも Finished を送信すると、アプリケーションデータ (HTTP) の通信が始まる。

最初の接続では 1 往復 (1-RTT) である。サーバーから送られた key_share グループが一致しない場合は、HelloRetryRequest でさらにやり取りを行う。以前に共有されたキー (PSK) が存在すれば、最初のフライトでデータを同時に送信する 0-RTT も可能だが、この初期データには順方向の秘密性がなく、再送信攻撃に対して脆弱である。そのため、RFC では冪等なリクエストのように再度処理されても問題ないものだけを傳送すると記載されている。上記のメソッド表はこの文脈で再び利用される。

ローカル環境で確認してみた。`openssl` を用いて自己署名証明書を作成し、Python の `ssl` モジュールを用いてサーバーとクライアントを同じプロセス内で動作させた。

```python
cc = ssl.create_default_context(cafile='c.pem')
t = cc.wrap_socket(raw, server_hostname='localhost')
print(t.version(), t.cipher())
print(t.getpeercert()['subject'])
t.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
```

出力は以下の通りだった。

```
TLSv1.3 ('TLS_AES_256_GCM_SHA384', 'TLSv1.3', 256)
((('commonName', 'localhost'),),)
b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'
```

TLS 1.3 がネゴシエートされ、クライアントが証明書のホスト名を確認した (`server_hostname`)。サーバー側の `recv` では復号化された平文の HTTP リクエストがそのまま到着していた。TLS の上でも HTTP メッセージの形式は一切変わらない。証明書・署名・ハッシュがどのように信頼性を構築するかについては、[詳細 → 暗号化・ハッシュ・認証の基礎](#/post/sec-authn-crypto) を参照のこと。

<details>
<summary>実行環境</summary>

- Python 3.13, `ssl.OPENSSL_VERSION` は OpenSSL 3.0.x, `ssl.HAS_TLSv1_3` は True。
- 証明書は `openssl req -x509` で作成した 1 日間の自己署名証明書であり、subjectAltName に localhost を設定している。
- 上記のローカル実験は同一 PC 内で行ったため、往復時間 (RTT) の差は測定していない。

</details>

## バージョンごとの違い：1.1, 2, 3

3 つのバージョンの意味（メソッド、ステータスコード、ヘッダーの概念）は同じだが、伝送方式が異なる。

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 形式 | テキスト | バイナリ | バイナリ |
| 接続 1 つあたり | リクエストを順次（パイプラインは存在したが） | 複数のリクエストを同時に（マルチプレクシング） | 同時、ストリームごとに独立 |
| 下の伝送 | TCP | TCP | QUIC(UDP の上) |
| ヘッダー | 毎回そのまま | 圧縮 | 圧縮 |

1.1 では接続の再利用が可能になったが、前のレスポンスが終わるまで次のレスポンスを受け取れない head-of-line 問題があり、ブラウザはドメインあたり TCP 接続を最大 6 つ開いて回避していた。HTTP/2 は 1 つの接続内で並列リクエストを許可することでこの制約を取り除いた。ただし、TCP の上だけで動作するため、パケットが 1 つ失われると TCP が再送信する間、その接続上のすべてのストリームが待機することになる。HTTP/3 では TCP の代わりに UDP 上の QUIC を使用し、QUIC は各ストリームごとに損失検知と再送信を個別に行うため、損失が発生したストリームのみが停止する。TCP 自体の動作については [詳細 → TCP と UDP](#/post/net-tcp-udp) で引き続き解説する。

## よくある誤解

- 304 はエラーではない。キャッシュされたコピーがまだ有効であるという正常なレスポンスである。
- `no-cache` はキャッシュしないという意味ではない。保存は行うが、再利用する前に確認するという意味である。
- 401 と 403 は同じ意味ではない。認証されていないものと、権限がないものの違いである。
- HTTP/2 が TCP の限界をすべて解消するわけではない。その限界を解決したのは HTTP/3 側である。
- HTTPS でも HTTP メッセージ自体はそのまま変わらない。変化するのはその下のチャネルである。

## おすすめの記事

← [概念図で](#/post/cs-map)

- [자세히 → 소켓과 웹소켓](#/post/net-socket): 위에서 쓴 소켓 코드를 더 자세히
- [자세히 → DNS 와 IP·라우팅](#/post/net-dns-routing): 연결 맺기 전에 일어나는 일
- [자세히 → API 와 REST](#/post/be-api-rest): 메서드와 상태코드를 API 에서 쓰는 법

## 근거 링크

- MDN, HTTP request methods: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- MDN, Evolution of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP
- MDN, HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- RFC 8446, The Transport Layer Security (TLS) Protocol Version 1.3: https://www.rfc-editor.org/rfc/rfc8446.html