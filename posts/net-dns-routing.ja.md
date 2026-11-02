ネットワークにおける「アドレス」には 2 つのタイプがある。人間が打ち込む名前（`example.com`）と、機械が使用する番号（IP アドレス）である。DNS は名前を番号に変換し、ルーティングはその番号を見てパケットを次のホップに渡す。[概要](#/post/cs-network) では DNS を「1 行翻訳」として軽く触れただけだったが、ここではその仕組みを詳しく見ていく。

## DNS は木である

DNS のネームスペースは木構造である。RFC 1034 に基づき、各ノードにラベルが付けられ、あるノードの名前は、そのノードからルートまでのラベルを連結したものである。`www.example.com` はルートの下に `com`、さらにその下に `example`、さらにその下に `www` がある。1 つのラベルは 63 バイト以下、全体の名前は 255 バイト以下と定められている。

この木を 1 つのサーバーがすべて持つのではなく、**ゾーン (zone)** に分割して担当する。ある組織が自分の下位ネームを直接管理すると宣言すれば、その枝が 1 つのゾーンとなり、そのゾーンのネームサーバーが**権限 (authoritative) サーバー**となる。権限サーバーは自分のゾーン内のデータのみで応答する。応答、エラー、あるいは「より近いサーバーはこちら」という案内（referral）のいずれかを返す。

## リゾルバーと権限サーバー

私たちの PC がルートから直接尋ねるわけではない。通常は**再帰 (recursive) リゾルバー**に一度尋ねる。リゾルバーはその代わりに回って尋ね、最終的な答えかエラーだけを返す。案内のような中間結果はクライアントには与えない。

リゾルバーが行う作業は概ね以下の通りである。

| ステップ | 行うこと |
|---|---|
| 1 | キャッシュを確認する。あればそのまま答える |
| 2 | なければ、知っているサーバーの中で最も近い場所を尋ねる。わからない場合はルートサーバーから |
| 3 | 受け取った案内に従って `com` → `example.com` 方向のサーバーへ降りていく |
| 4 | 権限サーバーから答えを受け取り、キャッシュに格納して返す |
| 5 | 答えが CNAME（別名）の場合、その名前ですべてを最初から繰り返す |

キャッシュ期間は、レコードに付随する**TTL**（秒単位）で決まる。TTL 0 はキャッシュしないという意味である。「存在しない名前」という答えもキャッシュできるため、DNS レコードを変更してもすぐに世界中に反映されず、すでにキャッシュしているリゾルバーが TTL が切れるまで古い値を保持し続ける可能性がある。

主なレコードの種類は以下の通りである（RFC 1035）。

| 種類 | 格納する内容 |
|---|---|
| A | ホストの IPv4 アドレス |
| NS | そのゾーンの権限ネームサーバー |
| CNAME | 別名が指し示す元の名称 |
| MX | メールサーバーと優先順位 |
| TXT | 文字列 |

## DNS クエリを直接作成してみる

DNS クエリは実際には小さなバイトの塊である。12 バイトのヘッダー（ID、フラグ、質問・回答・権限・追加の個数それぞれ 2 バイト）に 1 つの質問を付ければよい。名前については点を代わりに「長さ + 文字」の組み合わせとして書き、長さ 0 で終わらせる。Python を使ってクエリを作成し、公開リゾルバー（8.8.8.8）の 53 番ポートへ UDP で送信した。

```python
import struct, socket

def build(name, qtype=1, id=0x1234):
    hdr = struct.pack('!HHHHHH', id, 0x0100, 1, 0, 0, 0)  # 0x0100 = RD(재귀 요청) 비트
    q = b''.join(bytes([len(l)]) + l.encode() for l in name.split('.')) + b'\0'
    return hdr + q + struct.pack('!HH', qtype, 1)          # 타입 A, 클래스 IN

pkt = build('example.com')
print(pkt.hex())
# 123401000001000000000000076578616d706c6503636f6d0000010001
```

出力における `07 6578616d706c65` は長さ 7 の `example`、`03 636f6d` は `com`、`00` は終端を示している。このパケットを送信して受信した応答を解釈すると、以下のような結果となった。

```
('example.com', A, TTL 300, '104.20.23.154')
('example.com', A, TTL 300, '172.66.147.243')
```

2 つのアドレスが返され、TTL は 300 秒であった。実行時点や場所によって値は異なる可能性がある。応答解析コードは下に折りたたんでいる。

<details>
<summary>応答解析コード（圧縮ポインタ処理を含む）</summary>

応答内で同じ名前が繰り返される場合、名前を再度書かず、前方の位置を指し示す 2 バイトの**ポインター**を使用する（RFC 1035 の圧縮）。最初の 2 ビットが `11` であればポインターであり、残りの 14 ビットはメッセージ開始からのオフセットである。

```python
def name_at(d, o):
    parts, end = [], None
    while True:
        l = d[o]
        if l == 0:
            o += 1; break
        if l & 0xC0 == 0xC0:                    # 압축 포인터
            ptr = ((l & 0x3F) << 8) | d[o+1]
            if end is None: end = o + 2
            o = ptr; continue
        parts.append(d[o+1:o+1+l].decode()); o += 1 + l
    return '.'.join(parts), (end if end is not None else o)

def parse(d):
    id, fl, qd, an, ns, ar = struct.unpack('!HHHHHH', d[:12]); o = 12
    for _ in range(qd):
        n, o = name_at(d, o); o += 4
    out = []
    for _ in range(an):
        n, o = name_at(d, o)
        t, c, ttl, rl = struct.unpack('!HHIH', d[o:o+10]); o += 10
        v = socket.inet_ntoa(d[o:o+4]) if t == 1 else (name_at(d, o)[0] if t == 5 else d[o:o+rl].hex())
        out.append((n, t, ttl, v)); o += rl
    return fl & 0xF, out        # (RCODE, 답 목록)

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(3)
s.sendto(pkt, ('8.8.8.8', 53))
print(parse(s.recvfrom(512)[0]))
```

UDP メッセージは 512 バイト以下と定められており、それを超えると切り捨てて送信し、TC（truncated）ビットを立てると RFC 1035 に記載されている。[UDP と TCP が分かれた理由](#/post/net-tcp-udp)については別途整理している。

</details>

DNS が UDP の上で動作することはコードからそのまま見て取れる。接続を確立する段階なしに `sendto` で一度クエリを送り、`recvfrom` で一度応答が返ってくる。同じソケット API を TCP でも使用する様子は [ソケットプログラミング](#/post/net-socket) に続く。

## IP アドレスとサブネット

IPv4 アドレスは 32 ビットの数字である。人間が読み書きしやすいように 8 ビットごとに区切って `192.168.10.70` と書く。このアドレスは前半部分（ネットワーク）と後半部分（そのネットワーク内のホスト）に分かれる。どこまでが前半部分かは**プレフィックス長さ**で示す。`192.168.10.0/26` は最初の 26 ビットがネットワークであることを意味する。RFC 4632 で整理された CIDR 表記であり、従来の A・B・C クラスのようにサイズが固定されているわけではなく、2 の累乗サイズのブロックであれば何でも使用できる。

Python の標準ライブラリ `ipaddress` を使って確認した。

```python
import ipaddress
n = ipaddress.ip_network('192.168.10.0/26')
print(n.netmask, n.network_address, n.broadcast_address, n.num_addresses)
# 255.255.255.192 192.168.10.0 192.168.10.63 64
print(list(n.hosts())[0], list(n.hosts())[-1])        # 192.168.10.1 192.168.10.62
print(ipaddress.ip_address('192.168.10.70') in n)     # False
print(list(ipaddress.ip_network('192.168.10.0/24').subnets(new_prefix=26)))
# [192.168.10.0/26, 192.168.10.64/26, 192.168.10.128/26, 192.168.10.192/26]
print(ipaddress.ip_address('10.1.2.3').is_private, ipaddress.ip_address('8.8.8.8').is_private)
# True False
```

- `/26` is a block of 64 addresses, which is $2^6$. The first (`.0`) and last (`.63`) are the network address and broadcast address, respectively, so only `.1` to `.62`, totaling 62, can be used for hosts.
- `192.168.10.70` is outside this block and falls into the next block, `192.168.10.64/26`.
- Splitting a `/24` into `/26` yields four pieces. Subnetting involves increasing the prefix length to divide a large block into smaller ones like this.
- Private ranges like `10.x.x.x` return `is_private` as True, while public addresses like 8.8.8.8 return False.

<details>
<summary>"First 26 bits" viewed as bits</summary>

```python
print(bin(int(ipaddress.ip_address('192.168.10.70'))))
# 0b11000000101010000000101001000110
```

When adjusted to 32 bits, it is `11000000 10101000 00001010 01000110`. The first 26 bits are up to `11000000 10101000 00001010 01`, which matches the first 26 bits of `192.168.10.64`. Therefore, 70 belongs to the `.64/26` block. The subnet mask `255.255.255.192` is a value where the first 26 bits are filled with 1s (the last byte `11000000` equals 192).

</details>

## Routing: The most specific prefix wins

When a router receives a packet, it checks the **routing table** based on the destination IP. The table is a list of "send packets with this prefix to this direction." Multiple entries may match simultaneously; in such cases, the rule is that **the longest prefix wins** (longest-match). RFC 4632 also states that when there are overlaps, the more specific path takes precedence.

I created a simple table and tested it myself.

```python
import ipaddress
table = [('0.0.0.0/0', 'A'), ('10.0.0.0/8', 'B'), ('10.1.0.0/16', 'C'), ('10.1.2.0/24', 'D')]
tbl = [(ipaddress.ip_network(p), h) for p, h in table]

def lookup(ip):
    ip = ipaddress.ip_address(ip)
    c = [(n, h) for n, h in tbl if ip in n]
    return max(c, key=lambda x: x[0].prefixlen)

for ip in ['10.1.2.9', '10.1.9.9', '10.9.9.9', '8.8.8.8']:
    n, h = lookup(ip); print(ip, '->', n, h)
```

```
10.1.2.9 -> 10.1.2.0/24 D
10.1.9.9 -> 10.1.0.0/16 C
10.9.9.9 -> 10.0.0.0/8 B
8.8.8.8 -> 0.0.0.0/0 A
```

`10.1.2.9` matches three of the four entries (/8, /16, /24), but since /24 is the most specific, it goes to D. `0.0.0.0/0` has a prefix length of 0 and matches any address; when no other entry matches, this last one becomes the **default route**.

The code above demonstrates the concept by iterating through all entries.

## Why group by prefix?

Routers cannot hold every address in the world individually. Therefore, addresses are divided according to the structure of providers (ISPs), and providers aggregate their customers' blocks into a single large prefix for advertisement (aggregation). RFC 4632 explains that this way, even if a provider's customer base grows, external routers only need to know one entry. However, it also notes limitations: sites with multiple connections or those changing providers without changing numbers must advertise separately, which can break aggregation.

There are side effects to longest-match as well. Since longer prefixes win, if someone falsely advertises a more specific route within another's block, traffic may leak that way. RFCs suggest path filtering and prefix length limits as countermeasures.

## From name to packet

Connecting the two reveals how a single line in the address bar unfolds:

1. The browser asks the OS resolver for `example.com`.
2. The resolver checks its cache; if not found, it queries from the root down to the authoritative server to receive the IP.
3. A TCP connection is established using that IP, with the destination field of the packet containing the IP.
4. When the packet leaves my PC, my routing table is used. If it's in the same subnet, it goes directly; otherwise, it goes via the gateway of the default route.
5. Routers along the path each determine the next hop using longest-match.

Viewed by layers, DNS belongs to the application layer, while IP and routing belong to the internet layer. This distinction is covered separately in [OSI and TCP/IP](#/post/net-osi-tcpip). How HTTP communicates on top of this is covered in [HTTP](#/post/net-http).

<details>
<summary>A few common misconceptions</summary>

- "DNS has a single server worldwide": It's a distributed structure divided into zones, with separate authoritative servers for each name.
- "Changing records reflects immediately": Resolvers that have already cached the record may continue using the old value until the TTL expires.
- "IP address equals location": Prefixes are divided according to provider structure, and routers determine the next hop based solely on the prefix.
- "The number of hosts in a subnet is $2^n$": Network and broadcast addresses must be excluded, so /26 has 62 usable hosts, not 64 (as in the code above).
- "Routers know the entire path to the destination": Each router only determines the next hop.

</details>

← Concept map (#/post/cs-map)

Related articles: [Network Basics](#/post/cs-network) · [TCP and UDP](#/post/net-tcp-udp) · [Socket Programming](#/post/net-socket)

## Reference Links

- RFC 1034、ドメイン名 - コンセプトとファシリティ: https://www.rfc-editor.org/rfc/rfc1034
- RFC 1035、ドメイン名 - 実装と仕様: https://www.rfc-editor.org/rfc/rfc1035
- RFC 4632、クラスレスインタードメインルーティング (CIDR): https://www.rfc-editor.org/rfc/rfc4632