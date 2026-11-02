The layered model divides communication into layers, where each layer is responsible only for its own header and remains unaware of the others. When sending data, headers are added one by one from top to bottom; when receiving, they are peeled off one by one from bottom to top.

We will now delve a step further into the content briefly reviewed in the [Overview](#/post/cs-network) table. Here, we examine exactly what each layer does, how headers are attached, and why both models have persisted.

## Why Divide into Layers?

Network communication involves multiple tasks happening simultaneously: carrying signals over wires, sending them to neighboring devices, finding a path across multiple networks, delivering data to processes, and enabling applications to communicate with each other. If these were handled as a single monolithic unit, changing from Wi-Fi to wired connections would require modifying the entire web browser stack. By dividing into layers, we can replace an entire layer without affecting the layers above or below it.

Each layer uses only the services provided by the layer beneath it and communicates with its peer layer using agreed-upon rules (protocols). While actual data flows down through the lower layers and back up, logically, it is as if entities at the same layer are communicating directly.

## OSI 7-Layer Model

OSI stands for Open Systems Interconnection, a reference model created by ISO, reportedly published in 1984 as ISO 7498. It consists of seven layers.

| Layer | Name | PDU (Protocol Data Unit) | Function |
|---|---|---|---|
| 7 | Application | Data | Protocols interacting with the user (e.g., HTTP) |
| 6 | Presentation | Data | Format conversion, encryption, compression |
| 5 | Session | Data | Establishment, management, and termination of sessions |
| 4 | Transport | Segment | End-to-end delivery, segmentation, acknowledgment, multiplexing |
| 3 | Network | Packet | Addressing and path selection across multiple networks |
| 2 | Data Link | Frame | Delivery between adjacent nodes, error detection |
| 1 | Physical | Bit | Transmission of bits via electrical, radio, or optical signals |

The varying names of data units per layer are a frequent topic in exam questions. However, conceptually, the name simply represents "the unit handled by that layer." For instance, units at the transport layer are called segments (for TCP) or datagrams (for UDP), while those at the network layer are called packets.

[Read more → TCP and UDP](#/post/net-tcp-udp) discusses separately how reliability is implemented at the transport layer in detail.

## TCP/IP 4-Layer Model

The actual internet uses the TCP/IP model. Section 1.1.3 of RFC 1122 describes the protocol stack as four layers from top to bottom: Application, Transport, Internet, and Link. The Internet layer includes IP, ICMP, and IGMP; the Transport layer includes TCP and UDP; and the Link layer handles interfaces with directly connected networks.

The correspondence is roughly as follows: the TCP/IP Application layer covers OSI layers 5–7, the Transport layer corresponds to OSI layer 4, the Internet layer to OSI layer 3, and the Link layer to OSI layers 1–2. Since they do not align perfectly, we must say "roughly."

| OSI | TCP/IP | Representative Protocols |
|---|---|---|
| 5·6·7 | Application | HTTP, DNS, SMTP |
| 4 | Transport | TCP, UDP |
| 3 | Internet | IP, ICMP |
| 1·2 | Link | Ethernet, Wi-Fi |

The OSI model was designed from the outset as a reference model with strictly defined layer roles. In contrast, TCP/IP is known to be a looser structure developed around the same time with support from the U.S. Department of Defense. As a result, OSI protocols were not widely adopted, and the internet evolved atop TCP/IP. Consequently, the 7-layer model remains as a common language for explaining names and concepts, while the 4-layer model persists as the form of actual implementation.

Section 1.3.1 of RFC 1122 notes that even within protocol stacks and recommended implementations, strict layering is described as an "incomplete model." It also mentions that actual implementations often cross layer boundaries and share data structures. Therefore, you do not need to memorize the layered model as if it were an inviolable law.

## Encapsulation: Headers Are Added Layer by Layer

When sending data, each layer receives a unit from the layer above, attaches its own header in front of it, and passes it down. This process is called encapsulation. On the receiving side, the outermost header is read and peeled off first, moving upward.

```
응용 데이터
[UDP 헤더 | 응용 데이터]                       전송 계층
[IP 헤더 | UDP 헤더 | 응용 데이터]              인터넷 계층
[이더넷 헤더 | IP 헤더 | UDP 헤더 | 데이터]      링크 계층
```

Reading only text descriptions can be abstract, so I implemented headers directly. I filled a `struct` with 14 bytes for Ethernet, 20 bytes for IPv4, and 8 bytes for UDP, calculated checksums, and then peeled off the layers one by one on the receiving side, similar to how a receiver would process them. The address and port numbers used are arbitrary examples.

```python
import struct, socket

def checksum(b):
    if len(b) % 2: b += b'\x00'
    s = sum(struct.unpack('!%dH' % (len(b)//2), b))
    while s >> 16: s = (s & 0xffff) + (s >> 16)
    return ~s & 0xffff

payload = b'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n'   # 응용 데이터

# 전송 계층: UDP 헤더 8바이트 (포트, 길이, 체크섬)
src_ip, dst_ip = socket.inet_aton('192.168.0.10'), socket.inet_aton('93.184.216.34')
udp_len = 8 + len(payload)
pseudo = src_ip + dst_ip + struct.pack('!BBH', 0, 17, udp_len)
hdr0 = struct.pack('!HHHH', 50000, 53, udp_len, 0)
udp = struct.pack('!HHHH', 50000, 53, udp_len, checksum(pseudo + hdr0 + payload)) + payload

# 인터넷 계층: IPv4 헤더 20바이트
ip0 = struct.pack('!BBHHHBBH4s4s', 0x45, 0, 20 + len(udp), 1, 0, 64, 17, 0, src_ip, dst_ip)
ip = ip0[:10] + struct.pack('!H', checksum(ip0)) + ip0[12:] + udp

# 링크 계층: 이더넷 헤더 14바이트
frame = bytes.fromhex('aabbccddeeff') + bytes.fromhex('112233445566') + struct.pack('!H', 0x0800) + ip
print('앱 데이터', len(payload), '| UDP', len(udp), '| IP', len(ip), '| 프레임', len(frame))

# 받는 쪽: 한 겹씩 벗긴다
dst, src, et = struct.unpack('!6s6sH', frame[:14]); body = frame[14:]
print('이더넷 type=0x%04x' % et)
vihl, _, tot, _, _, ttl, proto, ck, s, d = struct.unpack('!BBHHHBBH4s4s', body[:20])
print('IP ihl=%d ttl=%d proto=%d %s -> %s' % (vihl & 15, ttl, proto, socket.inet_ntoa(s), socket.inet_ntoa(d)))
print('IP 헤더 체크섬 검증(0이면 정상):', checksum(body[:20]))
sp, dp, ln, _ = struct.unpack('!HHHH', body[20:28])
print('UDP %d -> %d len=%d' % (sp, dp, ln))
print(body[28:])
```

The execution produced the following output:

```
앱 데이터 37 | UDP 45 | IP 65 | 프레임 79
이더넷 type=0x0800
IP ihl=5 ttl=64 proto=17 192.168.0.10 -> 93.184.216.34
IP 헤더 체크섬 검증(0이면 정상): 0
UDP 50000 -> 53 len=45
b'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n'
```

A 37-byte data unit became 45 bytes after passing through UDP, 65 bytes after passing through IP, and finally 79 bytes after passing through Ethernet. The size increases by the header size at each layer as we move down the stack.

The numbers also serve as connectors between layers. For example, the `type` field in the Ethernet header with value `0x0800` indicates that the payload is IPv4, and the `proto` field in the IP header with value `17` indicates that the payload is UDP. The receiving side uses these values to determine which parser to pass the data to next. When sending upward, each header records its own destination, forming a self-describing structure.

<details>
<summary>Expanding on the header fields</summary>

- Ethernet: 6 bytes for destination MAC, 6 bytes for source MAC, and 2 bytes for type. MAC addresses are only meaningful within the same link. Every time a packet crosses a router, this header is rebuilt, while the IP header remains unchanged.
- IPv4: The first byte `0x45` indicates version 4 and a header length of 5 (×4 bytes = 20 bytes). TTL decreases with each router hop to prevent infinite loops. The header checksum validates only the header itself. In the code above, a verification result of 0 means that when the entire header is recombined, the checksum correctly sums to 0.
- UDP: Source and destination ports, length, and checksum. The checksum includes a pseudo-header containing IP addresses; this allows detection of packets arriving at the wrong destination due to incorrect addresses.

</details>

## Addresses differ at each layer

The most confusing aspect initially was that "who" is addressed differs at each layer.

| Layer | Address | Target Referenced | Scope |
|---|---|---|---|
| Link | MAC | Network card | Within the same link |
| Internet | IP | Host (interface) | Between networks |
| Transport | Port | Process | Within a single host |

While a packet traverses routers, the IP address remains constant, but the MAC address changes at each hop. How the route is selected continues in [Details → DNS and IP Routing](#/post/net-dns-routing).

## Distance between layers and code

In the apps I write, these layers are almost invisible. Once a socket is opened, everything below the transport layer is managed by the operating system. See [Details → Socket and Server Programming](#/post/net-socket) to examine this boundary in code. You can think of the socket API as acting as an interface between the application and transport layers. Request/response rules above the application layer are covered in [Details → HTTP and HTTPS](#/post/net-http). Where the network stack resides within the operating system connects to kernel discussions in [Overview](#/post/cs-os).

## Common Misconceptions

- "Memorizing the 7 layers means you know networking": The 7-layer model is closer to descriptive vocabulary. Many actual protocols do not fit neatly into a single layer. Whether TLS belongs at layer 5 or 6, and whether it sits between transport and application, varies depending on the diagram.
- "The Internet operates according to the OSI model": The Internet uses TCP/IP. A suite of OSI protocols was not widely adopted.
- "Boundaries between layers are strictly enforced": RFC 1122 itself states that strict layering is an incomplete model. Implementations cross boundaries due to performance considerations.
- "MAC address is the destination host's address": The MAC address is for the next hop, not the final destination. The final destination is carried in the IP header.

← Concept map (#/post/cs-map)

Related posts: [TCP and UDP](#/post/net-tcp-udp), [HTTP and HTTPS](#/post/net-http), [DNS and IP Routing](#/post/net-dns-routing)

## Reference Links

- RFC 1122, Requirements for Internet Hosts: https://www.rfc-editor.org/rfc/rfc1122
- OSI model (Wikipedia): https://en.wikipedia.org/wiki/OSI_model