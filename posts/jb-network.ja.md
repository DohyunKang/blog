情報処理技術者試験のネットワーク分野では、暗記すべき中心は階層の区別であり、出題パターンとしては「この機能は何の階層か」と「この IP アドレス範囲でホストが何台あるか」が頻繁に出題されます。まずはこの 2 つを押さえておきましょう。試験日程と受験料については公式サイトで確認してください。

## まず全体像

ネットワークを一塊として見ると難解ですが、階層に分けて見れば整理がつきます。上位の階層は「何をやり取りするか」を扱い、下位の階層は「どのように実装するか」を扱います。各階層は下の階層がやってくれることを信頼して自らの役割を果たします。

- 応用階層の HTTP は、リクエストとレスポンスをやり取りする規則です。
- 伝送階層の TCP は、そのリクエストが欠けずに順番通りに届くよう責任を負います。
- ネットワーク階層の IP は、どのコンピュータへ行くのかアドレスを付け、経路を選びます。

ブラウザにアドレスを入力した際、これらの階層が実際にどのような順序で動作するかは、[詳細 → ネットワーク基礎 (CS)](#/post/cs-network) と [詳細 → 1 つのリクエストの旅](#/post/infra-request-journey) で別途整理しています。ここでは試験に出る範囲に絞って見ていきましょう。

## OSI 7 階層

OSI 7 階層は、通信を 7 つの段階に分けた参照モデルです。上から下へ順に、応用、表現、セッション、伝送、ネットワーク、データリンク、物理となります。試験問題は大半が「次の説明が指す階層は？」という形式なので、各階層にキーワードを一つずつ付けておくと早いです。

| 階層 | 担当業務 | キーワード |
|---|---|---|
| 7 応用 | ユーザーが利用するサービスの規則 | HTTP などのプロトコル |
| 6 表現 | データの表現方式の変換 | 変換、圧縮、暗号化 |
| 5 セッション | 通信接続の開始と終了の管理 | セッション、同期 |
| 4 伝送 | エンドポイント間の転送 | TCP, UDP, ポート |
| 3 ネットワーク | アドレス指定と経路選択 | IP, ルーティング |
| 2 データリンク | 隣接する機器までの転送 | フレーム、エラー検出 |
| 1 物理 | 信号を電気・光として送出 | ケーブル、伝送媒体 |

暗記のコツは二つです。第一に、番号は下から 1 です。物理が 1 階層で応用が 7 階層です。第二に、問題で「経路」「アドレス」が出れば 3 階層、「ポート」「信頼性」が出れば 4 階層としてまず除外します。

<details>
<summary>OSI と TCP/IP を並べて見ると</summary>

実際のインターネットは OSI よりも階層の少ない TCP/IP モデルで説明されることが多いです。通常、応用、伝送、インターネット、ネットワークアクセスの 4 つの階層にまとめられます。OSI の 5・6・7 を応用一つに、1・2 をネットワークアクセス一つに合わせたような形です。

| OSI | TCP/IP |
|---|---|
| 応用・表現・セッション | 応用 |
| 伝送 | 伝送 |
| ネットワーク | インターネット |
| データリンク・物理 | ネットワークアクセス |

試験では両モデルを並べて「どの階層に該当するか」を問うような形で出題されます。上記の表のように統合される方向だけ覚えておけば OK です。
</details>

## 伝送階層：TCP

TCP はアプリケーションに対して、順序が保証された信頼性の高いバイトストリームを提供します。RFC 9293 を基準にすると、信頼性は以下の 3 つの装置によって作られています。シーケンス番号（sequence number）で欠落したデータを検知し、セグメントごとに付与されるチェックサムでエラーを検出し、再送によって両方を修正します。

もう一つ重要なのがポート番号です。ポートはどの応用サービスにデータを送るかを区別し、同じ 2 つのコンピュータ間でも複数のストリームが同時に存在しても混ざらないようにしてくれます。IP アドレスがコンピュータを見つける番号なら、ポートはそのコンピュータ内のサービスを見つける番号です。

### 3-way handshake

TCP はデータを送る前に接続を結びます。試験ではほぼ毎回出題される部分です。

1. まず接続を開こうとする方が SYN を送信します。自分の初期シーケンス番号が含まれています。
2. 受け取る方が SYN-ACK で応答します。
3. 最初の方が ACK を送ると接続が完了します。

そのため、名称は 3 回やり取りする「握手」です。順序を SYN, SYN-ACK, ACK と丸ごと暗記しておけば OK です。

閉じる際は、方向ごとに FIN を送り、相手がそれを確認（ACK）してくれます。先に閉じた方は TIME-WAIT 状態になり、2×MSL 間待機します。RST を受けると接続状態を即座に破棄します。試験では「接続終了時に FIN を使う」「RST は強制的に切る」といった程度の区別で出題されます。

[詳細 → オペレーティングシステム](#/post/jb-os) で扱われるプロセスとポートがどのように繋がっているかも併せて見ると理解しやすくなります。

<details>
<summary>TCP と UDP を問題で区別する方法</summary>

問題で「接続を先に結び、順序と再送を保証する」とあれば TCP です。逆に「接続設定なしにただ送る、速いが保証はない」という文句であれば UDP で答えます。両プロトコルとも伝送階層にある点は同じです。保証するかしないかが分岐点です。
</details>

## 応用階層：HTTP

HTTP is an application-layer protocol. According to the MDN description, it typically operates on top of TCP or on top of encrypted TCP using TLS. In a client-server structure, requests are always initiated by the client first; there is no case where the server initiates communication first.

A request consists of a method, path, version, headers (optional), and body (optional). A response consists of a version, status code, status message, headers, and body (optional). Since HTTP is stateless, there are no connections between consecutive requests on the same connection. To maintain states such as login sessions, cookies are layered on top. The statement "HTTP is stateless and cookies compensate for the state" is often seen in exam questions.

For how this is used in APIs, see [Integration Implementation and Interfaces →](#/post/jb-integration-api) for details.

## IP Addresses and Subnets

The core of the network layer is the IP address. IPv4 is 32 bits, and IPv6 is 128 bits. The Python `ipaddress` documentation also shows that `max_prefixlen` for IPv4 is 32 and for IPv6 is 128.

Subnet calculation problems are fixed. For example, if the address is `192.168.10.77/26`, the first 26 bits are the network part, and the last 6 bits are the host part.

- Subnet mask: Since the first 26 bits are 1, it is 255.255.255.192
- Number of addresses: With 6 host bits, it is $2^6$, which is 64
- Usable hosts: Subtracting the network address and broadcast address from 64 gives 62
- Network address: Since it is divided in units of 64, the start of the range containing 77 is 192.168.10.64
- Broadcast address: The end of the range is 192.168.10.127

I verified whether this calculation is correct by running it in Python.

```python
import ipaddress

def info(cidr):
    n = ipaddress.ip_network(cidr, strict=False)
    hosts = list(n.hosts())
    print(cidr, "mask", n.netmask, "network", n.network_address,
          "broadcast", n.broadcast_address, "hosts", len(hosts))

info("192.168.10.77/26")
info("10.0.0.0/24")
```

```
192.168.10.77/26 mask 255.255.255.192 network 192.168.10.64 broadcast 192.168.10.127 hosts 62
10.0.0.0/24 mask 255.255.255.0 network 10.0.0.0 broadcast 10.0.0.255 hosts 254
```

`hosts()` returns a list excluding the network and broadcast addresses from IPv4 as documented. In exams, when asked for "the number of usable hosts," the answer is always $2^n - 2$.

### Subnet Division

Problems involving further dividing a block also appear. Dividing `192.168.10.0/24` into `/26` yields four blocks.

```python
import ipaddress
print(list(ipaddress.ip_network("192.168.10.0/24").subnets(new_prefix=26)))
```

```
[IPv4Network('192.168.10.0/26'), IPv4Network('192.168.10.64/26'), IPv4Network('192.168.10.128/26'), IPv4Network('192.168.10.192/26')]
```

Increasing the prefix by 2 bits results in four pieces, each with 64 addresses. Doubling the number of pieces and halving the addresses per piece occurs for every bit added. Knowing this relationship means you do not need to memorize tables.

<details>
<summary>Solving subnet problems</summary>

1. Calculate the number of host bits from the prefix length by subtracting the prefix from 32.
2. $2^{\text{host bits}}$ is the number of addresses in one block.
3. Determine which block the last octet of the address belongs to by dividing by the block size.
4. The first address of that block is the network address, and the last address is the broadcast address.
5. Usable hosts are obtained by subtracting 2 from the number of addresses in the block.

In the example above, since the block size is 64, 77 falls into the range from 64 to 127. Therefore, the network address is .64 and the broadcast address is .127.
</details>

## Routing

Routing involves selecting the next hop based on the destination address and is handled by Layer 3. Data passes through multiple devices, gradually approaching the destination, with each device deciding only on the next path ahead of it. In exams, questions often involve classifying routing protocol names, so it is advisable to review the protocol list in the textbook separately.

## Common Confusions

- Distinguishing between Layer 3 and Layer 4: Addresses and paths belong to Layer 3, while ports and reliability belong to Layer 4.
- Ports and IP: IP selects the computer, while a port selects the service within it.
- Number of hosts in a subnet: You must subtract 2 from $2^n$. Forgetting to subtract is the most common mistake.
- The statement that HTTP is stateless: While sessions can be created using cookies, the protocol itself is stateless.

Networking is closely related to information security units. Encryption communication and authentication are continued in [Information Security →](#/post/jb-security).

← Concept map (#/post/jb-map)

Related articles
- [Operating Systems](#/post/jb-os)
- [Integration Implementation and Interfaces](#/post/jb-integration-api)
- [Information Security](#/post/jb-security)

## Reference Links
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293
- MDN, HTTP Overview: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- Python documentation, ipaddress: https://docs.python.org/3/library/ipaddress.html