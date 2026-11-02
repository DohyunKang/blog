転送層の仕事は、「コンピュータ間の通信」を「プロセス間の通信」に狭めることです。IP は宛先コンピュータまでパケットを送るだけで、そのコンピュータ内のどのプログラムに渡すかはポート番号が決めます。TCP と UDP はどちらもポートを使いますが、その上に載せるものが大きく異なります。階層構造自体は [詳細 → OSI 7 層と TCP/IP](#/post/net-osi-tcpip) にあり、ブラウザのアドレスバーから続く全体像は [概要 → ネットワーク基礎](#/post/cs-network) にあります。ここでは転送層の中身のみに入ります。

## UDP: ポート、長さ、チェックサム

UDP(RFC 768) のヘッダーは 8 バイトです。送信元ポート、宛先ポート、長さ、チェックサムのそれぞれが 16 ビットです。送信元ポートはオプションであり使わない場合は 0 を入れます。チェックサムは UDP ヘッダーとデータに加え、送信元・宛先アドレス、プロトコル、長さを束ねた擬似ヘッダーも含めて計算します。間違った宛先に送られてしまったデータグラムをキャッチしようとする構造です。

RFC は UDP をトランザクション指向のデータグラムモードとして説明し、転送と重複防止は保証しないと記述しています。接続を結ぶ・切る手順もありません。順序が守られる信頼性の高いストリームが必要なら TCP を使うよう案内します。

```python
import struct
hdr = struct.pack('!HHHH', 5000, 53, 8 + 5, 0)   # 출발지, 목적지, 길이(헤더+데이터 5바이트), 체크섬
print(len(hdr), struct.unpack('!HHHH', hdr))
# 8 (5000, 53, 13, 0)
```

実行した結果です。ヘッダー長が 8 という値がそのまま出力されています。

## TCP: バイトストリームとヘッダー

TCP(RFC 9293) のヘッダーはオプションがない場合 20 バイトです。ポート 2 つ（それぞれ 16 ビット）、シーケンス番号（32 ビット）、確認応答番号（32 ビット）、ヘッダー長さ（4 ビット、32 ビット単位）、フラグ 8 つ（CWR, ECE, URG, ACK, PSH, RST, SYN, FIN）、ウィンドウ（16 ビット）、チェックサム、緊急ポインタが入り、その後にオプションが追加される可能性があります。シーケンス番号は「送信されたデータの最初のバイト番号」であり、SYN フラグが立っているセグメントでは初期シーケンス番号 (ISN) です。確認応答番号は「次に受け取る番号」です。

```python
import struct
tcp = struct.pack('!HHIIBBHHH', 50000, 80, 100, 0, 5 << 4, 0x02, 65535, 0, 0)
sp, dp, seq, ack, off, fl, win, ck, ug = struct.unpack('!HHIIBBHHH', tcp)
print(len(tcp), (off >> 4) * 4, bool(fl & 2), seq)
# 20 20 True 100
```

20 バイトで、ヘッダー長さフィールドが指す長さも 20、SYN フラグが立っており、シーケンス番号が 100 となっています。これは直接作成したバイト列であり、実際のパケットをキャプチャしたものではありません。

核心は TCP がメッセージではなくバイトストリームを扱う点です。シーケンス番号が「メッセージ番号」ではなく「バイト番号」であるのもそのためです。ソケットで直接確認すると境界が消えているのが見えます。

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

実行結果は `TCP recv: b'helloworld'`、`UDP recv: b'hello' b'world'` でした。2 回送ったものが TCP では 1 つの塊として読み込まれました（常にそうなるわけではなく、一度にどれくらい読み込まれるかはタイミングと OS に依存します）。UDP は送信した単位のまま別々に返ってきました。TCP でメッセージをやり取りするプログラムは長さフィールドや区切り文字で境界を自分で作る必要があります。このようなソケットの話は [詳細 → ソケットと WebSockets](#/post/net-socket) で続きます。

## 接続の確立と解放

データを送る前に 3-way handshake を行います。クライアントが自分の ISN を含めて SYN を送り、サーバーが自分の SYN とともに相手の ISN に対する ACK を送り、クライアントがサーバーの ISN に対する ACK を送ります。両者が互いの開始番号を知らせ、相手が受け取ったことを確認する過程なので 3 回になります。RFC 9293 は両者が同時に SYN を送る同時開放も許可しています。

解放する際は FIN をやり取りします。正常な終了では先に切る側は FIN-WAIT-1、FIN-WAIT-2 を経て TIME-WAIT に入り、受け取る側は CLOSE-WAIT、LAST-ACK を通ります。両者が同時に切ると CLOSING 状態を通過します。一方だけ切って反対方向は開いておく半解放も可能です。

<details>
<summary>状態名と TIME-WAIT</summary>

RFC 9293 で定義される状態は LISTEN, SYN-SENT, SYN-RECEIVED, ESTABLISHED, FIN-WAIT-1, FIN-WAIT-2, CLOSE-WAIT, CLOSING, LAST-ACK, TIME-WAIT, CLOSED です。CLOSED は接続が全くない状態を指す仮の名称です。

先に切った側は TIME-WAIT で 2×MSL 間留まる必要があります。この文書では MSL を 2 分と定めているため、約 4 分です。

</details>

解放過程はよく「4-way handshake」と呼ばれますが、RFC はこれを FIN の交換として説明し、半開放を許可しています。固定された 4 回の往復というよりは、方向ごとに別々に切るものに近いと言えます。

## フロー制御：受け取る側の事情

フロー制御は「受け取る側が処理できる量だけ送る」という装置です。受け取る側はヘッダーのウィンドウフィールドで現在受けられる範囲を知らせます。16 ビットなので最大 65535 であり、より大きな値が必要ならウィンドウスケール拡張 (RFC 7323) で倍率を適用します。ウィンドウが 0 なら相手は ACK 以外のデータを送ることはできません。

データを受信側が読み取らないと、カーネルバッファが満杯になり、送信側で Windows が停止してしまいます。実際にこれが発生するか確認しました。

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

実行すると、相手側が読み取らない間は `send` がブロックされ `BlockingIOError` が発生し、相手が読み取って空にした後に再度送られます（両方とも True が出力されました）。ブロックされるまでの量は OS のバッファ設定によって異なります。

## 輻輳制御：ネットワーク事情

フロー制御が受信側を守るなら、輻輳制御は中間のネットワークを守ります。RFC 9293 は輻輳制御を TCP の必須要素としており、具体的なアルゴリズムについては RFC 5681 などの別のドキュメントを参照しています。

送信側は cwnd（輻輳ウィンドウ）を持ち、一度に送信できる未確認データは cwnd と rwnd（受信ウィンドウ）のうち小さい方の値までです。ssthresh はこの 2 つのモードを分ける閾値です。

| 区間 | 条件 | cwnd の増加 |
|---|---|---|
| スロースタート | cwnd < ssthresh | 新しいデータの ACK ごとに最大 SMSS ずつ、結果として RTT ごとに約 2 倍に |
| 輻輳回避 | cwnd > ssthresh | RTT ごとにセグメント 1 つ分 |

初期ウィンドウはセグメントサイズに応じて 2〜4 セグメントです（RFC 5681 基準）。初期 ssthresh は適当に大きく設定しますが、輻輳を検知したら減らす必要があります。

損失を検出する方法は 2 つあります。タイマーが切れると ssthresh を max(FlightSize/2, 2×SMSS) に下げ、cwnd をセグメント 1 つに戻してスロースタートからやり直します。同じ ACK が 3 回重複して届くと（3 duplicate ACK）、タイマーを待たずにそのセグメントを即座に再送信する「ファストリトライ」を行います。続くファストリカバリーでは cwnd を ssthresh + 3×SMSS に置き、重複 ACK ごとに SMSS ずつ増やしていき、新しいデータを確認する ACK が届くと cwnd を ssthresh に戻します。

以下はこれらの規則の形状だけを確認するために作った玩具モデルです。RTT 単位で cwnd をセグメント数として表しており、実際の TCP 実装ではありません。

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

16 でスロースタートが終了し、1 つずつ上がっていった後、タイムアウトで 1 に落ちた後に再び 2 倍ずつ上がります。ギザギザの形状が輻輳制御グラフの基本形です。

## UDP を選ぶ場合

信頼性を提供しない代わりに、UDP は接続設定の遅延がなく、再送信によるデータの待機もありません。そのため、一つでも失われても次のものがすぐに必要なリアルタイム音声・映像やゲーム、短い問い合わせ・応答などに使用されます。必要であればアプリが UDP 上で順序と再送信を直接実装します。名前解決については [詳細 → DNS と IP・ルーティング](#/post/net-dns-routing)、上位プロトコルについては [詳細 → HTTP と HTTPS](#/post/net-http) を参照してください。ソケットをオペレーティングシステムがどのように扱うかは [概要 → OS 基礎](#/post/cs-os) と関連しています。

## よくある誤解

- "UDP は速い": 再送信・順序合わせ・接続設定がないため遅延は短いだけで、失われたデータは単に消えてしまいます。
- "TCP はメッセージをそのまま伝達する": 上記の実行結果のように TCP はバイトストリームであり、境界が保存されません。
- "3-way handshake はセキュリティ手順": 順序番号を合わせる過程です。暗号化は TLS が担当します。
- "TCP はデータが必ず届く": 届いた場合は順序通り届くという意味で、接続が切れた場合は伝達できなかったことをアプリが知る必要があります。

← コンセプトマップで [CS・設計基礎 map](#/post/cs-map)

- [詳細 → OSI 7 層と TCP/IP](#/post/net-osi-tcpip)
- [詳細 → ソケットと WebSockets](#/post/net-socket)
- [詳細 → HTTP と HTTPS](#/post/net-http)

## 参考文献リンク

- RFC 768, User Datagram Protocol: https://www.rfc-editor.org/rfc/rfc768.html
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293.html
- RFC 5681, TCP Congestion Control: https://www.rfc-editor.org/rfc/rfc5681.html