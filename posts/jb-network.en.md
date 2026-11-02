The Network section of the Information Processing Technician exam centers on understanding layers, with questions repeatedly asking "Which layer does this function belong to?" and "How many hosts are in this IP range." Master these two concepts first. Check the exam schedule and registration fee on the official website.

## The Big Picture First

Viewing the network as a single block can be overwhelming; breaking it down by layers makes it manageable. Upper layers handle "what content is exchanged," while lower layers handle "how it is delivered." Each layer relies solely on the services provided by the layer directly below it to perform its own functions.

- The HTTP protocol in the Application Layer defines the rules for exchanging requests and responses.
- TCP in the Transport Layer ensures that requests are delivered completely and in order.
- IP in the Network Layer attaches addresses to determine the destination computer and selects the path.

When you type an address into a browser, the actual sequence of operations across these layers is detailed separately in [Details → Network Basics (CS)](#/post/cs-network) and [Details → The Journey of One Request](#/post/infra-request-journey). Here, we focus on what appears on the exam.

## OSI 7-Layer Model

The OSI 7-layer model is a reference model that divides communication into seven steps. From top to bottom, the layers are: Application, Presentation, Session, Transport, Network, Data Link, and Physical. Exam questions mostly take the form "Which layer does the following description refer to?", so memorizing one keyword per layer will help you answer quickly.

| Layer | Responsibility | Keywords |
|---|---|---|
| 7 Application | Rules for user-facing services | Protocols like HTTP |
| 6 Presentation | Data representation conversion | Conversion, compression, encryption |
| 5 Session | Management of communication connection start and end | Session, synchronization |
| 4 Transport | Delivery between end-to-end endpoints | TCP, UDP, ports |
| 3 Network | Addressing and path selection | IP, routing |
| 2 Data Link | Delivery to the immediately adjacent device | Frames, error detection |
| 1 Physical | Transmission of signals as electricity or light | Cables, transmission media |

There are two tips for memorization. First, the numbering starts from the bottom; Physical is Layer 1 and Application is Layer 7. Second, if a question mentions "path" or "address," think Layer 3 first; if it mentions "port" or "reliability," think Layer 4 first.

<details>
<summary>Comparing OSI and TCP/IP side by side</summary>

The actual Internet is often described using the TCP/IP model, which has fewer layers than OSI. It is typically grouped into four layers: Application, Transport, Internet, and Network Access. This combines OSI's Layers 5-7 into one Application layer and merges Layers 1-2 into one Network Access layer.

| OSI | TCP/IP |
|---|---|
| Application, Presentation, Session | Application |
| Transport | Transport |
| Network | Internet |
| Data Link, Physical | Network Access |

Exams often present both models side by side and ask which layer corresponds to a given description. Just remember the merging direction shown in the table above.
</details>

## Transport Layer: TCP

TCP provides applications with a reliable byte stream where order is guaranteed. Based on RFC 9293, reliability is achieved through three mechanisms: sequence numbers detect missing data, checksums attached to each segment identify errors, and retransmission corrects both issues.

Another important concept is the port number. Ports distinguish which application service should receive the data and prevent mixing of multiple simultaneous flows between the same two computers. If an IP address is the number used to find a computer, a port number is the number used to find a specific service within that computer.

### 3-way Handshake

TCP establishes a connection before sending data. This is a part that appears almost every time on exams.

1. The side initiating the connection first sends a SYN packet containing its initial sequence number.
2. The receiving side responds with a SYN-ACK.
3. When the initiator sends an ACK, the connection is established.

Thus, it is called a three-way handshake. You can memorize the sequence as SYN, SYN-ACK, and ACK all at once.

When closing the connection, each side sends a FIN, and the other side acknowledges it with an ACK. The side that closes first enters a TIME-WAIT state and waits for 2×MSL. If an RST is received, the connection state is immediately discarded. Exams typically distinguish these by stating "FIN is used during connection termination" and "RST forcibly breaks the connection."

[Details → Operating System](#/post/jb-os) also covers how processes and ports are connected; reviewing that together will make it easier to understand.

<details>
<summary>How to distinguish TCP and UDP in problems</summary>

If a problem states "establishes a connection first and guarantees order and retransmission," the answer is TCP. Conversely, if the statement says "sends without setting up a connection; fast but no guarantee," the answer is UDP. Both protocols belong to the Transport Layer; the distinction lies in whether they provide guarantees or not.
</details>

## Application Layer: HTTP

HTTP is an application-layer protocol. According to the MDN description, it typically operates over TCP or over encrypted TCP using TLS. In a client-server architecture, requests are always initiated by the client; the server never initiates communication first.

Requests consist of a method, path, version, headers (optional), and body (optional). Responses include the version, status code, status message, headers, and an optional body. Because HTTP is stateless, there are no connections between consecutive requests on the same connection. To maintain states like login sessions, cookies are layered on top. The statement "HTTP is stateless, and cookies supplement the state" is a common topic in exam questions.

For how this is used in APIs, see [Integration Implementation and Interfaces](#/post/jb-integration-api) for more details.

## IP Addresses and Subnets

The core of the network layer is the IP address. IPv4 uses 32 bits, while IPv6 uses 128 bits. The Python `ipaddress` documentation also shows that `max_prefixlen` for IPv4 is 32 and for IPv6 is 128.

Subnet calculations are fixed. For example, with `192.168.10.77/26`, the first 26 bits represent the network portion, and the remaining 6 bits represent the host portion.

- Subnet mask: Since the first 26 bits are 1s, the mask is 255.255.255.192
- Number of addresses: With 6 host bits, there are $2^6$, or 64 addresses
- Usable hosts: Subtracting the network address and broadcast address from 64 leaves 62 usable hosts
- Network address: Breaking into blocks of 64, the range containing 77 starts at 192.168.10.64
- Broadcast address: The end of the range is 192.168.10.127

I verified this calculation using Python.

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

The `hosts()` function returns a list excluding the network and broadcast addresses, as documented. In exams, when asked for "the number of usable hosts," always subtract 2 from $2^n$.

### Subnet Division

Problems involving further subdivision of a block also appear. Dividing `192.168.10.0/24` into `/26` yields four blocks.

```python
import ipaddress
print(list(ipaddress.ip_network("192.168.10.0/24").subnets(new_prefix=26)))
```

```
[IPv4Network('192.168.10.0/26'), IPv4Network('192.168.10.64/26'), IPv4Network('192.168.10.128/26'), IPv4Network('192.168.10.192/26')]
```

Increasing the prefix by 2 bits results in four pieces, each with 64 addresses. Each time a bit is added to the prefix, the number of pieces doubles and the number of addresses per piece halves. Understanding this relationship means you don't need to memorize tables.

<details>
<summary>Solving Subnet Problems</summary>

1. Calculate the number of host bits by subtracting the prefix length from 32.
2. The number of addresses in a block is $2^{\text{host bits}}$.
3. Determine which block the last octet of the address belongs to by dividing by the block size.
4. The first address of that block is the network address, and the last is the broadcast address.
5. Usable hosts are calculated by subtracting 2 from the total addresses in the block.

In the example above, since the block size is 64, 77 falls within the range from 64 to 127. Therefore, the network address is .64 and the broadcast address is .127.
</details>

## Routing

Routing involves selecting the next hop based on the destination address and is handled by Layer 3. Data passes through multiple devices, gradually approaching its destination, with each device deciding only on the immediate next path. In exams, questions often ask to classify routing protocols by name, so it's advisable to review the protocol list in your textbook beforehand.

## Common Confusions

- Distinguishing between Layer 3 and Layer 4: Addresses and paths belong to Layer 3, while ports and reliability belong to Layer 4.
- Ports vs. IP: IP addresses select a computer, while ports select a service within that computer.
- Subnet host count: Always subtract 2 from $2^n$; forgetting this step is the most common mistake.
- HTTP being stateless: While sessions can be created using cookies, the protocol itself remains stateless.

Networking is closely related to information security. Encryption and authentication are covered in [Information Security](#/post/jb-security).

← Concept map (#/post/jb-map)

Related articles
- [Operating Systems](#/post/jb-os)
- [Integration Implementation and Interfaces](#/post/jb-integration-api)
- [Information Security](#/post/jb-security)

## Reference Links
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293
- MDN, HTTP Overview: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- Python documentation, ipaddress: https://docs.python.org/3/library/ipaddress.html