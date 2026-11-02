The job of the transport layer is to narrow "communication between computers" down to "communication between processes." IP merely sends packets to the destination computer, but it is the port number that determines which program inside that computer receives them. Both TCP and UDP use ports, but what sits on top of them differs significantly. The layer structure itself can be found in [Details → OSI 7 Layers and TCP/IP](#/post/net-osi-tcpip), and the big picture starting from the browser address bar is covered in [Overview → Network Basics](#/post/cs-network). Here, we go only inside the transport layer.

## UDP: Ports, Length, and Checksum

UDP (RFC 768) has an 8-byte header. The source port, destination port, length, and checksum are each 16 bits. The source port is optional; if not used, 0 is inserted. The checksum is calculated including the UDP header and data, plus a pseudo-header containing the source and destination addresses, protocol, and length. It's a structure designed to catch datagrams that go to the wrong place.

RFCs describe UDP as a transaction-oriented datagram mode and state that delivery and duplicate prevention are not guaranteed. There are no procedures for establishing or closing connections. If a reliable stream where order is preserved is needed, TCP is recommended.

```python
import struct
hdr = struct.pack('!HHHH', 5000, 53, 8 + 5, 0)   # 출발지, 목적지, 길이(헤더+데이터 5바이트), 체크섬
print(len(hdr), struct.unpack('!HHHH', hdr))
# 8 (5000, 53, 13, 0)
```

This is the output from running it. The header length of 8 is printed as is.

## TCP: Byte Stream and Header

The TCP (RFC 9293) header is 20 bytes without options. It contains two ports (16 bits each), sequence number (32 bits), acknowledgment number (32 bits), header length (4 bits, in units of 32 bits), eight flags (CWR, ECE, URG, ACK, PSH, RST, SYN, FIN), window (16 bits), checksum, and urgent pointer; options may follow. The sequence number is the "byte number of the first byte sent," and for a segment with SYN enabled, it is the initial sequence number (ISN). The acknowledgment number is the "next expected number."

```python
import struct
tcp = struct.pack('!HHIIBBHHH', 50000, 80, 100, 0, 5 << 4, 0x02, 65535, 0, 0)
sp, dp, seq, ack, off, fl, win, ck, ug = struct.unpack('!HHIIBBHHH', tcp)
print(len(tcp), (off >> 4) * 4, bool(fl & 2), seq)
# 20 20 True 100
```

The result was 20 bytes, the header length field also indicated 20, SYN flag was set, and the sequence number was 100. Since this is a directly constructed byte sequence, it is not an actual captured packet.

The core point is that TCP handles a byte stream rather than messages. This is why the sequence number is a "byte number" rather than a "message number." Direct inspection via sockets reveals that boundaries disappear.

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

The execution results were `TCP recv: b'helloworld'` and `UDP recv: b'hello' b'world'`. In TCP, the two sent items were read as one chunk (this is not always the case; how much is read at once depends on timing and the OS). UDP came out separately in its sent units. Programs exchanging messages via TCP must directly create boundaries using length fields or delimiters. Further discussion on sockets continues in [Details → Sockets and WebSockets](#/post/net-socket).

## Establishing and Closing Connections

Before sending data, a 3-way handshake is performed. The client sends a SYN containing its own ISN, the server responds with its own SYN and an ACK for the client's ISN, and the client sends an ACK for the server's ISN. This three-step process involves both sides informing each other of their starting numbers and confirming receipt. RFC 9293 also allows simultaneous opening where both sides send SYN at the same time.

To close, FINs are exchanged. In a normal termination, the side that closes first goes through FIN-WAIT-1 and FIN-WAIT-2 before entering TIME-WAIT, while the receiving side goes through CLOSE-WAIT and LAST-ACK. If both sides close simultaneously, they pass through the CLOSING state. It is also possible to have a half-close where one side closes while keeping the other direction open.

<details>
<summary>State Names and TIME-WAIT</summary>

The states defined in RFC 9293 are LISTEN, SYN-SENT, SYN-RECEIVED, ESTABLISHED, FIN-WAIT-1, FIN-WAIT-2, CLOSE-WAIT, CLOSING, LAST-ACK, TIME-WAIT, and CLOSED. CLOSED is a virtual name indicating a state where no connection exists at all.

The side that closes first must remain in TIME-WAIT for 2×MSL. This document sets MSL to 2 minutes, making the total approximately 4 minutes.

</details>

The closing process is commonly called a "4-way handshake," but RFCs describe it as FIN exchange and allow half-closing. It is closer to closing separately in each direction rather than a fixed four-way round trip.

## Flow Control: The Receiver's Constraints

Flow control is a mechanism that ensures "sending only what the receiver can handle." The receiver indicates its current acceptable range via the window field in the header. This field is 16 bits, with a maximum of 65535; if a larger value is needed, a window scaling extension (RFC 7323) applies a multiplier. If the window is 0, the peer cannot send data other than ACKs.

If the receiving program does not read data, the kernel buffer fills up, causing the sender to stop. I verified that this actually happens.

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

When executed, if the receiver does not read, `send` gets blocked and raises a BlockingIOError; once the receiver reads and frees the buffer, sending resumes again (both print True). The amount of data accumulated before blocking depends on OS buffer settings.

## Congestion Control: Network Concerns

While flow control protects the receiver, congestion control protects the intermediate network. RFC 9293 states that congestion control is an essential component of TCP and points to separate documents like RFC 5681 for specific algorithms.

The sender maintains a cwnd (congestion window), and the amount of unacknowledged data it can send at once is limited to the smaller of cwnd and rwnd (receiver window). ssthresh marks the boundary between the two modes.

| Phase | Condition | cwnd Increase |
|---|---|---|
| Slow Start | cwnd < ssthresh | Increases by up to SMSS per new data ACK, roughly doubling every RTT |
| Congestion Avoidance | cwnd > ssthresh | Increases by approximately one segment per RTT |

The initial window is typically 2–4 segments depending on segment size (per RFC 5681). The initial ssthresh is set arbitrarily high but must be reduced upon detecting congestion.

There are two ways to detect loss:  
- If the timer expires, reduce ssthresh to max(FlightSize/2, 2×SMSS) and reset cwnd to one segment to restart slow start.  
- If three duplicate ACKs arrive (3 duplicate ACK), perform fast retransmit by immediately retransmitting the corresponding segment without waiting for the timer. In subsequent fast recovery, keep cwnd at ssthresh + 3×SMSS and increase it by SMSS per duplicate ACK; when an ACK for new data arrives, reset cwnd to ssthresh.

The following is a toy model created only to illustrate the shape of these rules. cwnd is plotted in segments per RTT unit, and this is not an actual TCP implementation.

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

At 16, slow start ends and cwnd increases by one step at a time; after a timeout it drops to 1 and then doubles again. The sawtooth pattern is the basic shape of congestion control graphs.

## When Choosing UDP

UDP sacrifices reliability but offers no connection setup delay and avoids waiting for retransmissions that block subsequent data. Therefore, it is used for real-time applications like voice and video calls, gaming, and short query-response interactions where losing a single packet is acceptable. Applications can implement ordering and retransmission directly on top of UDP if needed. For details on name resolution, see [DNS and IP/Routing](#/post/net-dns-routing); upper-layer protocols are covered in [HTTP and HTTPS](#/post/net-http). How the operating system handles sockets is linked to [Operating System Fundamentals](#/post/cs-os).

## Common Misconceptions

- "UDP is fast": It has low latency simply because it lacks retransmission, ordering, and connection setup; however, lost data is just discarded.  
- "TCP delivers messages as-is": As shown in the execution results above, TCP is a byte stream where message boundaries are not preserved.  
- "The 3-way handshake is a security procedure": It is merely a process for synchronizing sequence numbers; encryption is handled by TLS.  
- "TCP guarantees data delivery": It ensures that if data arrives, it comes in order; the application must detect when the connection breaks and data could not be delivered.

← Concept map: [CS & Design Fundamentals](#/post/cs-map)

- [Details → OSI 7-Layer Model and TCP/IP](#/post/net-osi-tcpip)
- [Details → Sockets and WebSockets](#/post/net-socket)
- [Details → HTTP and HTTPS](#/post/net-http)

## Reference Links

- RFC 768, User Datagram Protocol: https://www.rfc-editor.org/rfc/rfc768.html
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293.html
- RFC 5681, TCP Congestion Control: https://www.rfc-editor.org/rfc/rfc5681.html