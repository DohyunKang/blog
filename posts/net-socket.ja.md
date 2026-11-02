ソケットは OS が提供する通信の終点であり、TCP ソケットはメッセージではなくバイトストリームのみを渡します。WebSocket は 1 つの HTTP リクエストで始まり、同じ TCP 接続上で両者がいつでもメッセージを送信する規則です。

概要は [ネットワーク基礎](#/post/cs-network) と [OS 基礎](#/post/cs-os) にあり、ここではソケット API を直接触れて見えるものだけに焦点を当てます。

## ソケットとは何か

プログラムがネットワークで通信するには OS に頼らなければなりません。その頼みの手すりとなるのがソケットです。Python では `socket.socket()` が返すオブジェクトであり、ファイルのように読み書きする対象とみなせます。IP アドレスとポートが組み合わさった終点に付きます。

Python 公式のソケット HOWTO は、サーバーソケットとクライアントソケットを明確に分けて説明しています。サーバーソケットはデータを送ることも受けることもせず、クライアントソケットを作るだけです。呼び出し順序で見ると以下のようになります。

| | サーバー | クライアント |
|---|---|---|
| 1 | `socket()` で終点作成 | `socket()` |
| 2 | `bind()` でアドレス・ポートに付与 | |
| 3 | `listen()` で接続待ち | |
| 4 | `accept()` で接続を抜き出し新しいソケット受領 | `connect()` |
| 5 | `recv()` / `sendall()` | `sendall()` / `recv()` |
| 6 | `close()` | `close()` |

`accept()` が返すソケットが実際の対話用であり、待ち受け用のソケットはそのまま残り次の接続を受けます。3-way handshake は `connect()` と `accept()` の間のどこかで OS が自動的に処理します。この部分は [TCP と UDP](#/post/net-tcp-udp) で改めて見ています。

## recv はメッセージを返しません

初めてソケットを使う際に最も多い誤解は「1 回送れば 1 回受かる」というものです。実際に試しました。クライアントが `hello` と `world` を別々に 2 回送り、サーバーは 0.3 秒遅れて読みます。

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

出力は以下のようになりました。

```
recv 1: b'helloworld'
recv 2: b''
```

2 回送ったものが 1 回にまとまって届き、2 回目の `recv` は空のバイトでした。空のバイトは相手が接続を閉じたというシグナルです。HOWTO でも同じことが書かれています。ソケットにはメッセージ終了のマークがなく、メッセージ境界は固定長であるか、区切り文字で終わるか、長さを先頭にして送るか、接続を閉じて知らせる 4 つの方法のいずれかで定める必要があります。

まとまって届いたのは自分の PC のループバックで遅延を与えた場合の結果であり、どのように分割されて届くかは環境によって異なります。どちらの場合でもアプリが境界を自分で決める必要がある点は同じです。

## 長さ付きのフレーム化

実務で一般的な方法は長さプレフィックスです。先頭の 4 バイトに本文の長さを記述し、その分だけ読み取ります。ここで注意すべき点があります。`recv(n)` は n バイトをすべて満たすという約束ではなく、最大 n バイトという意味なので、正確に n バイトになるまで繰り返す必要があります。HOWTO でも長さ 5 の文字を 1 回の `recv` では受けられないと書かれています。

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

`'!I'` はネットワークバイト順序（ビッグエンディアン）の符号なし 4 バイト整数です。日本語は UTF-8 でエンコードしたバイト数に基づいて長さを計ります。同じデータが先ほどの例とは異なり正確に 3 つの塊に分かれたのはこの規則のおかげです。

HTTP が `Content-Length` ヘッダーや chunked 転送を採用するのも同様の問題を解決する方法として読み取れます。WebSocket フレームにも長さフィールドがありますが、後述します。

## ブロッキングと同時接続

`accept()` と `recv()` はデフォルトでブロッキングです。データが来るまでその行で止まります。HOWTO では相手が接続を閉じず消えてもソケットが長時間待機する可能性があるとして警告しています。1 つの接続につき 1 つのスレッドを使うと簡単ですが、止まった接続はスレッドをそのまま保持します。スレッドに関する話は [プロセスとスレッド](#/post/os-process-thread) で続きます。

代替案はノンブロッキングソケットと `select` です。HOWTO の説明では `select` が読み込めるソケット、書き込めるソケットを選別して返すものであり、サーバーソケットが読み込み可能になると `accept()` はほぼ確実に成功します。また Windows では `select` はソケットにのみ使用でき、Unix 系ではファイルにも使用できるそうです。Python 標準ライブラリの `selectors` でラップして 1 つのスレッドで 3 つのクライアントを受け取ってみました。

<details>
<summary>selectors を使った 1 つのスレッドエコサーバー（実行確認）</summary>

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

サーバーループは 1 つのスレッドであり、クライアント 3 つはそれぞれスレッドで回しました。エコデータが短いため `sendall` がすぐに完了すると仮定した単純な例です。大きなデータを送るサーバーであれば書き込み可能イベントも合わせて見る必要があります。

</details>

このアプローチはイベントループです。Python の `asyncio` や Node.js が同じ仕組みであり、リクエストごとにスレッドを作成せず、これほど多くの接続を処理できるサーバーはこの方式を採用しています。HTTP リクエストがどのように処理されるかは、[リクエストの処理フロー](#/post/be-request-flow) を参照してください。

## ウェブソケットが必要な理由

HTTP はクライアントが最初に要求を送らなければ、サーバーは応答しません。サーバーから先に発言したいチャット、株価、通知などの場合は、定期的に問い合わせてくるポーリングを行う必要があります。ウェブソケットはこの仕組みを変えます。MDN の説明によれば、ブラウザとサーバー間に双方向のセッションを開き、応答のためにポーリングを行わずにメッセージをやり取りできる点が特徴です。

RFC 6455 にある重要な文は、ウェブソケットが HTTP とは別に TCP の上に載せるプロトコルであり、HTTP との関係はハンドシェイクが有効な HTTP Upgrade リクエストであるという点だけだということです。そのため、80 や 443 ポートは HTTP サーバーと同じように使用できます。

## ハンドシェーク：HTTP で始まり 101 で遷移する

クライアントは通常の HTTP GET を送信します。ヘッダーには `Upgrade: websocket`、16 バイトのランダム数を base64 でエンコードした `Sec-WebSocket-Key`、バージョン 13 が含まれます。サーバーは `101 Switching Protocols` で応答し、`Sec-WebSocket-Accept` に生成した値を入れます。

- クライアントキー文字列の後に固定 GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11` を追加します。
- SHA-1 ハッシュを計算します。
- base64 でエンコードします。

RFC に掲載された例のキーを使って計算してみました。

```python
import hashlib, base64
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
key = 'dGhlIHNhbXBsZSBub25jZQ=='
print(base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode())
# s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

この値が得られました。この計算はサーバーがウェブソケットハンドシェークを理解したことの証拠として使用され、認証や暗号化ではありません。暗号化は `wss://`、つまり TLS が担当します。101 以外のステータスコードを受け取るとアップグレードは失敗しており、通常の HTTP ルールで処理します。このリクエスト・レスポンスの形式は、[HTTP と HTTPS](#/post/net-http) で見たものと同じです。

## フレーム：接続上でやり取りされる単位

ハンドシェークが完了すると、同じ TCP 接続がウェブソケットフレームのやり取り経路となります。前述の通り TCP は境界を付与しないと言いましたが、ウェブソケットはフレームヘッダーに長さを含めることでこの問題を解決したことになります。RFC に基づくヘッダー構成は以下の通りです。

| フィールド | 意味 |
|---|---|
| FIN | このフレームがメッセージの最後の部分か |
| opcode | 0x1 テキスト、0x2 バイナリ、0x8 close、0x9 ping、0xA pong、0x0 次の部分 |
| MASK | マスキングキーが付いているか |
| 長さ | 0〜125 はそのまま、126 の場合は次の 2 バイト、127 の場合は次の 8 バイトが長さ |

クライアントが送信するフレームは必ずマスキングする必要があり、サーバーはマスキングされていないフレームを拒否する必要があります。サーバーが送信するフレームはマスキングしません。方式はペイロードの i 番目のバイトをキーの `i mod 4` 番目のバイトと XOR することです。RFC がこれを推奨している理由は、キャッシュプロキシなどの中間装置を混乱させず、悪意のあるスクリプトがフロントエンドに載せるバイトを自由に選択できないようにするためです。キーは予測不可能である必要があるとされています。マスキングは暗号化ではありません。

ping と pong は接続確認用の制御フレームです。受信側は pong で応答し、close をやり取りすると TCP 接続を閉じます。

## Python でウェブソケットを一から実装する

上記のルールをライブラリなしでソケットのみを使って実装してみました。サーバー側はハンドシェーク応答とフレームの読み書きを行い、クライアント側はマスキングされたテキストフレームを送信します。126 以上の長さやフラグメントメッセージ、ping 処理は意図的に省いた最小限の実装です。

<details>
<summary>ソケットのみで作成したウェブソケットエコー（実行確認）</summary>

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

opcode 1 はテキストフレームです。ハンドシェークでヘッダーを読み取る部分は、リクエストが一度の `recv` で全て来ることを仮定せず、空行が出るまで繰り返し読み取ります。前述の境界問題もここでもそのまま現れます。

</details>

結果を見ると、ウェブソケットは新しい転送手段ではなく、TCP ソケットの上に「HTTP で挨拶し、フレームで話す」という約束を載せたものであることがコードからわかります。

## よくある誤解

- "WebSocket は TCP と異なる接続である": 同じ TCP 接続です。ハンドシェイクが完了した後、その接続の通信プロトコル（プロトコル）のみが変更されます。
- "ソケットへの 1 回分の `send` は相手の 1 回分の `recv` で返ってくる": 上記の実験のように連続して届くことがあります。アプリケーション側で境界を区別する必要があります。
- "マスキングはセキュリティ機能である": RFC が明記した目的は、中間機器の混乱防止と悪意のあるスクリプトによるバイト操作の防止です。コンテンツを隠すのは TLS の役割です。
- "WebSocket は常にポーリングより優れている": 接続を常時維持するため、サーバー側は接続数に応じたリソースを確保する必要があります。この点は [ロードバランサー](#/post/infra-load-balancer) や [非同期処理とメッセージキュー](#/post/be-async-queue) とともに設計に反映されます。
- "ブラウザの `WebSocket` は自動的に速度制御を行う": MDN は、この API がバックプレッシャー（受け手が処理しきれない場合に送信側を遅らせる仕組み）をサポートしていないと述べています。メッセージが処理速度よりも速く届くとメモリ不足や CPU 使用率が 100% になる可能性があるとしており、問題がある場合は WebTransport API を検討するよう推奨しています。

## 関連記事

← コンセプトマップ [CS・設計基礎マップ](#/post/cs-map)

- [詳細 → TCP と UDP](#/post/net-tcp-udp): ソケットの下層で接続と転送を担当する部分
- [詳細 → HTTP と HTTPS](#/post/net-http): WebSocket のハンドシェイクが乗る HTTP の仕組み
- [詳細 → 同期とデッドロック](#/post/os-sync-deadlock): スレッドを使ってソケットを扱う際に発生する問題

## 引用リンク

- Python 公式ドキュメント、Socket Programming HOWTO: https://docs.python.org/3/howto/sockets.html
- RFC 6455, The WebSocket Protocol（冒頭 100,000 文字まで参照）: https://www.rfc-editor.org/rfc/rfc6455.html
- MDN, The WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API