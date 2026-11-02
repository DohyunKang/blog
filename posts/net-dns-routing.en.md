In a network, there are two types of "addresses": the names typed by humans (e.g., `example.com`) and the numbers used by machines (IP addresses). DNS translates names into numbers, while routing uses those numbers to forward packets to the next hop. In [the overview](#/post/cs-network), we briefly mentioned DNS as a "one-line translation," but here we delve deeper into its inner workings.

## DNS is a Tree

The name space of DNS is structured like a tree. According to RFC 1034, each node has a label attached, and the full name of a node is formed by concatenating labels from that node up to the root. For `www.example.com`, the hierarchy under the root is `com`, then `example` below it, and finally `www` at the bottom. Each label can be no more than 63 bytes, and the entire name must not exceed 255 bytes.

This tree is not held entirely by a single server; instead, it is divided into **zones** and managed separately. If an organization declares that it will directly manage its subdomain, that branch becomes a zone, and the name servers for that zone are called **authoritative servers**. An authoritative server responds only with data from its own zone. It returns one of three responses: the actual answer, an error, or a referral pointing to "a closer server."

## Resolvers and Authoritative Servers

Our PC does not query directly from the root. Typically, we ask a **recursive resolver** once. The resolver then iteratively queries other servers on our behalf, returning only the final answer or an error. Intermediate results, such as referrals, are not provided to the client.

The tasks performed by a resolver are roughly as follows:

| Step | Action |
|---|---|
| 1 | Check the cache. If found, return the cached answer immediately. |
| 2 | If not in cache, query the closest known server; if unknown, start from the root servers. |
| 3 | Follow received referrals to descend toward servers for `com` → `example.com`. |
| 4 | Receive the answer from the authoritative server, store it in the cache, and return it. |
| 5 | If the answer is a CNAME (alias), restart the query process with that canonical name. |

The caching duration is determined by the **TTL** (in seconds) attached to each record. A TTL of 0 means "do not cache." Even negative answers ("name does not exist") can be cached. Therefore, even when DNS records are updated, changes do not reflect immediately worldwide; resolvers that have already cached the old value may continue using it until the TTL expires.

The main record types are as follows (RFC 1035):

| Type | Content |
|---|---|
| A | IPv4 address of a host |
| NS | Authoritative name server for that zone |
| CNAME | Original name pointed to by an alias |
| MX | Mail server and priority |
| TXT | String data |

## Creating DNS Queries Manually

DNS queries are essentially small byte sequences. They consist of a 12-byte header (ID, flags, and counts for questions, answers, authority, and additional sections—each 2 bytes) followed by one question. Names use "length + characters" instead of dots and end with a length of 0. Below is Python code that constructs a query and sends it to port 53 of a public resolver (8.8.8.8) via UDP:

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

In the output, `07 6578616d706c65` represents the 7-byte string `example`, `03 636f6d` represents `com`, and `00` marks the end. After sending this packet and interpreting the received response, we get:

```
('example.com', A, TTL 300, '104.20.23.154')
('example.com', A, TTL 300, '172.66.147.243')
```

Two addresses were returned, with a TTL of 300 seconds. Values may vary depending on the execution time and location. The response parsing code is folded below.

<details>
<summary>Response parsing code (including compressed pointer handling)</summary>

When the same name repeats within a response, RFC 1035 compression allows reusing the earlier position via a 2-byte **pointer** instead of rewriting the name. If the first two bits are `11`, it indicates a pointer, and the remaining 14 bits represent an offset from the start of the message.

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

UDP messages are limited to 512 bytes; if exceeded, they are truncated and sent with the TC (truncated) bit set, as specified in RFC 1035. [Why UDP and TCP diverge](#/post/net-tcp-udp) is covered separately.

</details>

The fact that DNS runs over UDP is evident directly from the code: without establishing a connection, a question is sent via a single `sendto`, and an answer arrives with a single `recvfrom`. The socket API usage pattern seen here continues in [socket programming](#/post/net-socket).

## IP Addresses and Subnets

An IPv4 address is a 32-bit number. For human readability, it is split into 8-bit chunks and written as `192.168.10.70`. This address is divided into a front part (network) and a back part (hosts within that network). The prefix length indicates where the front part ends. For example, `192.168.10.0/26` means the first 26 bits constitute the network. This CIDR notation, standardized in RFC 4632, allows blocks of any size that are powers of two, unlike the fixed-size A, B, and C classes of the past.

We verified this using Python's standard library `ipaddress`:

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

- `/26` is a block of 64 address blocks, which is $2^6$. The first (`.0`) and last (`.63`) addresses are reserved for the network address and broadcast address, respectively, leaving `.1` through `.62`—a total of 62 addresses—for hosts.
- `192.168.10.70` is outside this block and falls into the next block, `192.168.10.64/26`.
- Splitting a `/24` into `/26` yields four blocks. Subnetting involves increasing the prefix length to divide a larger block into smaller ones.
- Private ranges like `10.x.x.x` return `is_private` as True, while public addresses like 8.8.8.8 return False.

<details>
<summary>"First 26 bits" viewed in binary</summary>

```python
print(bin(int(ipaddress.ip_address('192.168.10.70'))))
# 0b11000000101010000000101001000110
```

When adjusted to 32 bits, it is `11000000 10101000 00001010 01000110`. The first 26 bits are `11000000 10101000 00001010 01`, which matches the first 26 bits of `192.168.10.64`. Therefore, 70 belongs to the `.64/26` block. The subnet mask `255.255.255.192` is the value obtained by setting the first 26 bits to 1 (the last byte `11000000` equals 192).

</details>

## Routing: The Most Specific Prefix Wins

When a router receives a packet, it examines the destination IP and consults its **routing table**. The table lists entries such as "packets for this prefix should be sent this way." Multiple entries may match simultaneously; in such cases, the rule is that **the longest prefix wins** (longest-match). RFC 4632 also states that when there are overlaps, the more specific path takes precedence.

I created a simple table and tested it manually.

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

`10.1.2.9` matches three of the four entries (/8, /16, /24), but since /24 is the most specific, traffic goes to D. `0.0.0.0/0` has a prefix length of 0 and matches any address; it serves as the **default route** when no other entry matches.

The code above demonstrates the concept by iterating through all entries.

## Why Group by Prefix?

Routers cannot store every IP address in the world individually. Therefore, addresses are allocated according to the structure of Internet Service Providers (ISPs), and ISPs aggregate their customers' blocks into a single large prefix for advertisement. RFC 4632 explains that with this approach, even if an ISP's customer base grows, external routers only need to know about one entry. However, it also notes limitations: sites with multiple connections or those changing providers without changing their numbers must advertise separately, which can break aggregation.

The longest-match rule also has side effects. Since longer prefixes win, malicious actors could falsely advertise more specific routes within someone else's block, causing traffic to leak in that direction. RFCs propose route filtering and prefix length limits as countermeasures.

## From Name to Packet

Connecting the two concepts reveals how a single line in the address bar unfolds:

1. The browser asks the OS resolver for `example.com`.
2. The resolver checks its cache; if not found, it queries from the root down to the authoritative server to obtain the IP.
3. A TCP connection is established using that IP, with the destination field of the packet containing the IP address.
4. When the packet leaves my PC, my routing table is used: if the destination is in the same subnet, it goes directly; otherwise, it goes via the default route's gateway.
5. Intermediate routers along the path each determine the next hop using longest-match.

Viewed as layers, DNS operates at the application layer, while IP and routing operate at the internet layer. This distinction is covered separately in [OSI and TCP/IP](#/post/net-osi-tcpip). How HTTP communicates on top of this is explained in [HTTP](#/post/net-http).

<details>
<summary>Common Misconceptions</summary>

- "DNS has a single server worldwide": It uses a distributed structure divided into zones, with separate authoritative servers for each name.
- "Changing records reflects immediately": Resolvers that have already cached the record may continue using the old value until the TTL expires.
- "IP address equals location": Prefixes are allocated according to ISP structure, and routers determine the next hop based solely on prefixes.
- "The number of hosts in a subnet is $2^n$": Network and broadcast addresses must be excluded, so /26 has 62 usable hosts, not 64 (as shown in the code above).
- "Routers know the entire path to the destination": Each router only determines the next hop.

</details>

← Concept map (#/post/cs-map)

Related articles: [Network Fundamentals](#/post/cs-network) · [TCP and UDP](#/post/net-tcp-udp) · [Socket Programming](#/post/net-socket)

## Reference Links

- RFC 1034, Domain Names - Concepts and Facilities: https://www.rfc-editor.org/rfc/rfc1034
- RFC 1035, Domain Names - Implementation and Specification: https://www.rfc-editor.org/rfc/rfc1035
- RFC 4632, Classless Inter-domain Routing (CIDR): https://www.rfc-editor.org/rfc/rfc4632