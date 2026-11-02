전송 계층의 일은 "컴퓨터 사이의 통신"을 "프로세스 사이의 통신"으로 좁히는 것이다. IP는 목적지 컴퓨터까지 패킷을 보내 줄 뿐이고, 그 컴퓨터 안의 어느 프로그램에 줄지는 포트 번호가 정한다. TCP와 UDP는 둘 다 포트를 쓰지만 그 위에 얹어 주는 것이 크게 다르다. 층 구조 자체는 [자세히 → OSI 7계층과 TCP/IP](#/post/net-osi-tcpip)에 있고, 브라우저 주소창부터 이어지는 큰 그림은 [개요 → 네트워크 기초](#/post/cs-network)에 있다. 여기서는 전송 계층 안쪽으로만 들어간다.

## UDP: 포트, 길이, 체크섬

UDP(RFC 768)는 헤더가 8바이트다. 출발지 포트, 목적지 포트, 길이, 체크섬이 각각 16비트다. 출발지 포트는 선택 사항이라 안 쓰면 0을 넣는다. 체크섬은 UDP 헤더와 데이터에 더해 출발지·목적지 주소, 프로토콜, 길이를 묶은 의사 헤더까지 포함해서 계산한다. 엉뚱한 곳으로 잘못 간 데이터그램을 잡으려는 구조다.

RFC는 UDP를 트랜잭션 지향의 데이터그램 모드로 설명하고, 전달과 중복 방지는 보장하지 않는다고 적는다. 연결을 맺고 닫는 절차도 없다. 순서가 지켜지는 신뢰성 있는 스트림이 필요하면 TCP를 쓰라고 안내한다.

```python
import struct
hdr = struct.pack('!HHHH', 5000, 53, 8 + 5, 0)   # 출발지, 목적지, 길이(헤더+데이터 5바이트), 체크섬
print(len(hdr), struct.unpack('!HHHH', hdr))
# 8 (5000, 53, 13, 0)
```

실행해서 나온 값이다. 헤더 길이가 8이라는 게 그대로 찍힌다.

## TCP: 바이트 스트림과 헤더

TCP(RFC 9293) 헤더는 옵션이 없으면 20바이트다. 포트 2개(16비트씩), 순서번호(32비트), 확인응답 번호(32비트), 헤더 길이(4비트, 32비트 단위), 플래그 8개(CWR, ECE, URG, ACK, PSH, RST, SYN, FIN), 윈도우(16비트), 체크섬, 긴급 포인터가 들어가고 그 뒤에 옵션이 붙을 수 있다. 순서번호는 "보낸 데이터의 첫 바이트 번호"이고, SYN이 켜진 세그먼트에서는 초기 순서번호(ISN)다. 확인응답 번호는 "다음에 받을 번호"다.

```python
import struct
tcp = struct.pack('!HHIIBBHHH', 50000, 80, 100, 0, 5 << 4, 0x02, 65535, 0, 0)
sp, dp, seq, ack, off, fl, win, ck, ug = struct.unpack('!HHIIBBHHH', tcp)
print(len(tcp), (off >> 4) * 4, bool(fl & 2), seq)
# 20 20 True 100
```

20바이트, 헤더 길이 필드가 가리키는 길이도 20, SYN 플래그 켜짐, 순서번호 100으로 나왔다. 직접 만든 바이트열이라 실제 패킷을 캡처한 것은 아니다.

핵심은 TCP가 메시지가 아니라 바이트 스트림을 다룬다는 점이다. 순서번호가 "메시지 번호"가 아니라 "바이트 번호"인 것도 그래서다. 소켓으로 직접 확인하면 경계가 사라지는 게 보인다.

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

실행 결과는 `TCP recv: b'helloworld'`, `UDP recv: b'hello' b'world'`였다. 두 번 보낸 게 TCP에서는 한 덩어리로 읽혔다(항상 그런 건 아니고, 한 번에 얼마나 읽히는지는 타이밍과 OS에 달려 있다). UDP는 보낸 단위 그대로 따로 나왔다. TCP로 메시지를 주고받는 프로그램은 길이 필드나 구분자로 경계를 직접 만들어야 한다. 이런 소켓 이야기는 [자세히 → 소켓과 웹소켓](#/post/net-socket)에서 이어진다.

## 연결 맺기와 닫기

데이터를 보내기 전에 3-way handshake를 한다. 클라이언트가 자기 ISN을 담아 SYN을 보내고, 서버가 자기 SYN과 함께 상대 ISN에 대한 ACK를 보내고, 클라이언트가 서버 ISN에 대한 ACK를 보낸다. 양쪽이 각자의 시작 번호를 알리고 상대가 받았음을 확인하는 과정이라 세 번이 된다. RFC 9293은 양쪽이 동시에 SYN을 보내는 동시 열기도 허용한다.

닫을 때는 FIN을 주고받는다. 정상 종료에서 먼저 닫는 쪽은 FIN-WAIT-1, FIN-WAIT-2를 거쳐 TIME-WAIT에 들어가고, 받는 쪽은 CLOSE-WAIT, LAST-ACK을 거친다. 양쪽이 동시에 닫으면 CLOSING 상태를 지난다. 한쪽만 닫고 반대 방향은 열어 두는 반닫힘도 가능하다.

<details>
<summary>상태 이름과 TIME-WAIT</summary>

RFC 9293이 정의하는 상태는 LISTEN, SYN-SENT, SYN-RECEIVED, ESTABLISHED, FIN-WAIT-1, FIN-WAIT-2, CLOSE-WAIT, CLOSING, LAST-ACK, TIME-WAIT, CLOSED다. CLOSED는 연결이 아예 없는 상태를 가리키는 가상의 이름이다.

먼저 닫은 쪽은 TIME-WAIT에서 2×MSL 동안 머물러야 한다. 이 문서는 MSL을 2분으로 두니 약 4분이다.

</details>

닫는 과정을 흔히 "4-way handshake"라고 부르지만, RFC는 이를 FIN 교환으로 설명하고 반닫힘을 허용한다. 고정된 네 번 왕복이라기보다 방향마다 따로 닫는 것에 가깝다.

## 흐름 제어: 받는 쪽 사정

흐름 제어는 "받는 쪽이 감당할 만큼만 보낸다"는 장치다. 받는 쪽은 헤더의 윈도우 필드로 지금 받을 수 있는 범위를 알린다. 16비트라 최대 65535이고, 더 큰 값이 필요하면 윈도우 스케일링 확장(RFC 7323)으로 배율을 적용한다. 윈도우가 0이면 상대는 ACK 외의 데이터를 보낼 수 없다.

받는 프로그램이 데이터를 안 읽으면 커널 버퍼가 차고, 그러면 윈도우가 줄어 보내는 쪽이 멈춘다. 이게 실제로 보이는지 확인했다.

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

실행하면 상대가 안 읽는 동안 `send`가 막혀 BlockingIOError가 나고, 상대가 읽어 비운 뒤에는 다시 보내진다(둘 다 True가 출력됐다). 막히기까지 들어가는 양은 OS 버퍼 설정에 따라 다르다.

## 혼잡 제어: 네트워크 사정

흐름 제어가 받는 쪽을 지킨다면 혼잡 제어는 중간 네트워크를 지킨다. RFC 9293은 혼잡 제어가 TCP의 필수 요소라고 하면서 구체적인 알고리즘은 RFC 5681 같은 별도 문서를 가리킨다.

보내는 쪽은 cwnd(혼잡 윈도우)를 따로 들고 있고, 한 번에 보낼 수 있는 미확인 데이터는 cwnd와 rwnd(수신 윈도우) 중 작은 쪽까지다. ssthresh는 두 모드를 가르는 경계다.

| 구간 | 조건 | cwnd 증가 |
|---|---|---|
| 슬로 스타트 | cwnd < ssthresh | 새 데이터 ACK마다 최대 SMSS만큼, 결과적으로 RTT마다 대략 두 배 |
| 혼잡 회피 | cwnd > ssthresh | RTT마다 대략 세그먼트 1개 |

초기 윈도우는 세그먼트 크기에 따라 2~4개 세그먼트다(RFC 5681 기준). 초기 ssthresh는 임의로 크게 잡되 혼잡이 감지되면 줄여야 한다.

손실을 감지하는 길은 둘이다. 타이머가 만료되면 ssthresh를 max(FlightSize/2, 2×SMSS)로 낮추고 cwnd를 세그먼트 1개로 되돌려 슬로 스타트부터 다시 한다. 같은 ACK가 세 번 중복해서 오면(3 duplicate ACK) 타이머를 기다리지 않고 해당 세그먼트를 바로 재전송하는 빠른 재전송을 한다. 이어지는 빠른 회복에서는 cwnd를 ssthresh + 3×SMSS로 두고 중복 ACK마다 SMSS씩 늘리다가, 새 데이터를 확인하는 ACK가 오면 cwnd를 ssthresh로 되돌린다.

다음은 이 규칙의 모양만 보려고 만든 장난감 모델이다. RTT 단위로 cwnd를 세그먼트 수로 찍었고 실제 TCP 구현은 아니다.

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

16에서 슬로 스타트가 끝나고 한 칸씩 오르다가 타임아웃 뒤 1로 떨어져 다시 두 배씩 오른다. 톱니 모양이 혼잡 제어 그래프의 기본 형태다.

## UDP를 고르는 경우

신뢰성을 안 주는 대신 UDP는 연결 설정 지연이 없고, 재전송 때문에 뒤 데이터가 기다리는 일도 없다. 그래서 하나를 잃어도 다음 것이 바로 필요한 실시간 음성·영상, 게임, 짧은 질의·응답에 쓰인다. 필요하면 앱이 UDP 위에서 순서와 재전송을 직접 구현한다. 이름 해석은 [자세히 → DNS와 IP·라우팅](#/post/net-dns-routing), 위층 프로토콜은 [자세히 → HTTP와 HTTPS](#/post/net-http)에서 본다. 소켓을 운영체제가 어떻게 다루는지는 [개요 → 운영체제 기초](#/post/cs-os)와 연결된다.

## 흔한 오해

- "UDP는 빠르다": 재전송·순서 맞추기·연결 설정이 없어서 지연이 짧을 뿐이고, 잃어버린 데이터는 그냥 사라진다.
- "TCP는 메시지를 그대로 전달한다": 위 실행 결과처럼 TCP는 바이트 스트림이라 경계가 보존되지 않는다.
- "3-way handshake는 보안 절차다": 순서번호를 맞추는 과정이다. 암호화는 TLS가 맡는다.
- "TCP는 데이터가 반드시 도착한다": 도착하면 순서대로 온다는 것이고, 연결이 끊기면 전달하지 못했다는 걸 앱이 알아야 한다.

← 개념 지도로 [CS·설계 기초 map](#/post/cs-map)

- [자세히 → OSI 7계층과 TCP/IP](#/post/net-osi-tcpip)
- [자세히 → 소켓과 웹소켓](#/post/net-socket)
- [자세히 → HTTP와 HTTPS](#/post/net-http)

## 근거 링크

- RFC 768, User Datagram Protocol: https://www.rfc-editor.org/rfc/rfc768.html
- RFC 9293, Transmission Control Protocol: https://www.rfc-editor.org/rfc/rfc9293.html
- RFC 5681, TCP Congestion Control: https://www.rfc-editor.org/rfc/rfc5681.html
