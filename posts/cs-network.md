네트워크는 층을 나눠서 보면 정리된다. 주소를 IP로 바꾸고(DNS), 연결을 맺고(TCP), 암호화를 세우고(TLS), 그 위에서 요청과 응답을 주고받는다(HTTP). 이 네 단계가 순서대로 일어난다.

## 층으로 나눠 보기

네트워크 얘기에서 제일 먼저 나오는 게 OSI 7계층과 TCP/IP 4계층이다. 둘 다 "통신을 역할별로 쪼개 놓은 그림"이고, 실제 인터넷이 쓰는 건 TCP/IP 쪽이다. 7계층은 설명용으로 더 자주 쓰인다.

| TCP/IP | OSI 대응 | 하는 일 | 예 |
|---|---|---|---|
| 애플리케이션 | 5~7 | 앱끼리 말하는 규칙 | HTTP, DNS, TLS |
| 전송 | 4 | 프로세스(포트) 끼리 전달 | TCP, UDP |
| 인터넷 | 3 | 목적지 IP까지 길 찾기 | IP |
| 링크 | 1~2 | 바로 옆 기기까지 전달 | 이더넷, Wi-Fi |

TLS는 어느 층인지 말이 갈린다. 보통 전송과 애플리케이션 사이쯤으로 그려서, 표에서는 애플리케이션 쪽에 뒀다.

층을 나누는 이유는 단순하다. 위층은 아래층이 어떻게 전달하는지 몰라도 된다. HTTP는 "신뢰할 수 있는 통로가 있다"고 가정하고 쓰고, 그 통로가 Wi-Fi든 유선이든 신경 쓰지 않는다. 각 층 데이터는 아래로 내려갈 때마다 헤더가 하나씩 붙는다(캡슐화).

## 주소를 IP로 바꾸는 DNS

사람은 `example.com`을 치고 컴퓨터는 IP로 통신하니까 중간에 번역이 필요하다. MDN은 DNS를 도메인 이름과 IP 같은 정보를 관리하는 "계층적이고 분산된 이름 지정 시스템"이라고 한다. 한 곳에 전화번호부가 있는 게 아니라 여러 서버가 나눠서 들고 있다는 뜻이다.

파이썬에서는 이 번역이 한 줄이다.

```python
import socket
print(socket.getaddrinfo('example.com', 443, proto=socket.IPPROTO_TCP)[0][4])
# ('104.20.23.154', 443)   <- 실행해서 나온 값, 시점·위치마다 다를 수 있다
```

이 줄 하나가 내 PC의 리졸버(운영체제)에 질문을 던지는 것이다. 대충 캐시에 있으면 바로 답하고, 없으면 상위 DNS 서버에 물어 내려가는 식으로 알고 있다.

## 연결을 맺는 TCP

IP를 알았으면 연결을 맺는다. TCP는 데이터를 보내기 전에 서로 순서번호를 맞추는 과정이 있고, 이게 3-way handshake다. RFC 9293 기준으로 흐름은 이렇다.

1. 클라이언트가 SYN을 보낸다(자기 초기 순서번호 ISN을 담아서).
2. 서버가 자기 SYN과 함께 클라이언트 SYN에 대한 ACK를 보낸다(SYN-ACK).
3. 클라이언트가 서버 SYN에 대한 ACK를 보낸다. 이때부터 연결이 ESTABLISHED가 되고 데이터가 오간다.

```
클라이언트                    서버
   |---- SYN, seq=100 ------->|
   |<--- SYN, seq=300, ACK=101-|
   |---- ACK=301 ------------>|
   |====== 데이터 ============|
```

RFC 그림의 숫자(100, 300)를 그대로 가져온 예시다. 실제 ISN은 시계와 비밀 키를 섞은 방식으로 정한다고 되어 있어서 마음대로 100부터 시작하지 않는다.

왜 세 번이냐가 처음엔 이상한데, 양쪽이 각자 자기 시작 번호를 알리고 상대가 받았다고 확인하는 게 필요해서다. 두 번이면 서버의 번호를 클라이언트가 받았는지 서버가 모른다.

신뢰성은 이 위에서 나온다. 바이트마다 번호가 있고 ACK는 누적으로 보내고, 잃어버린 건 재전송한다. 체크섬으로 오류를 잡고, 받는 쪽이 알리는 윈도우 크기로 속도를 조절한다(흐름 제어). 혼잡 제어는 필수지만 정의는 다른 문서에 있다고 RFC에 적혀 있다. 닫을 때는 FIN을 주고받고, 먼저 닫은 쪽은 TIME-WAIT에 2×MSL 동안 머문다. RST로 한 번에 끊는 방식도 있다.

<details>
<summary>TCP vs UDP 직접 돌려 보기</summary>

같은 PC 안에서 소켓 두 종류를 써 봤다. 둘 다 실행해서 출력 확인했다.

```python
import socket, threading

# TCP: 연결(handshake)부터 맺고 주고받음
s = socket.socket(); s.bind(('127.0.0.1', 0)); s.listen()
port = s.getsockname()[1]
def srv():
    c, _ = s.accept()
    print('서버 받음:', c.recv(100)); c.sendall(b'pong'); c.close()
threading.Thread(target=srv).start()
c = socket.create_connection(('127.0.0.1', port))
c.sendall(b'ping'); print('클라 받음:', c.recv(100)); c.close()

# UDP: 연결 없이 그냥 던짐
u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); u.bind(('127.0.0.1', 0))
t = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
t.sendto(b'hi', ('127.0.0.1', u.getsockname()[1]))
print('UDP:', u.recvfrom(100)[0])
```

출력은 `서버 받음: b'ping'`, `클라 받음: b'pong'`, `UDP: b'hi'`였다. `create_connection` 호출 안에서 handshake가 일어나고 코드에는 안 보인다. UDP는 `connect`/`accept` 자체가 없다.

</details>

## TCP와 UDP는 뭐가 다른가

| | TCP | UDP |
|---|---|---|
| 연결 | 먼저 맺는다 | 없다 |
| 순서·재전송 | 보장한다 | 없다(앱이 알아서) |
| 오버헤드 | 크다 | 작다 |
| 쓰는 곳 | 웹, 메일, 파일 | 실시간 음성·영상, 게임 등 |

"UDP는 빠르다"는 말은 반은 맞다. 재전송과 순서 맞추기를 안 해서 지연이 짧을 뿐이고, 잃어버린 패킷은 그냥 없어진다. 실시간 통화는 늦게 온 소리를 다시 받아 봐야 쓸모가 없으니 UDP가 어울린다. UDP 위에 순서·재전송을 앱이 직접 구현하는 경우도 있다.

## HTTP: 요청 하나, 응답 하나

HTTP는 애플리케이션 계층 프로토콜이고, MDN 설명으로는 클라이언트-서버 구조에서 요청을 항상 클라이언트가 먼저 보낸다. 메시지 모양은 이렇다.

```
GET / HTTP/1.1
Host: developer.mozilla.org
Accept-Language: fr
```

요청은 메서드, 경로, 버전, 헤더, (있으면) 본문이다. 응답은 버전, 상태 코드(`200 OK` 같은), 헤더, 본문이다. [자세히 → API와 REST](#/post/be-api-rest)에서 메서드와 상태 코드를 어떻게 쓰는지 이어서 본다.

HTTP 자체는 상태가 없다. 앞 요청을 기억하지 않으니 로그인 유지나 장바구니는 쿠키 같은 헤더로 덧붙여서 만든다. 이 "상태 없음"이 서버를 여러 대로 늘리기 쉽게 만드는 쪽이기도 하다. 

전송 방식은 버전마다 달랐다. MDN 기준으로 1.0은 요청마다 TCP 연결을 새로 열어서 비효율적이었고, 1.1이 연결을 재사용하는 지속 연결을 넣었고, 2는 한 연결에서 여러 메시지를 멀티플렉싱한다. HTTP/3은 UDP 기반 QUIC 위에서 돈다고 알려져 있다.

## HTTPS는 HTTP에 TLS를 얹은 것

MDN은 TLS를 신뢰할 수 없는 네트워크에서 안전하게 통신하게 하는 프로토콜이라고 하고, HTTP를 TLS로 보호한 게 HTTPS다. 주는 것은 세 가지로 정리된다.

| 속성 | 뜻 |
|---|---|
| 암호화 | 중간에서 읽을 수 없다 |
| 무결성 | 중간에서 몰래 바꿀 수 없다 |
| 인증 | 접속한 서버가 진짜 그 도메인인지 확인한다 |

handshake에서 TLS 버전과 암호 스위트를 정하고, 서버를 인증하고, 비밀 키를 합의한다. 이후 HTTP 헤더와 본문을 전부 그 키로 암호화한다. 서버 인증은 인증서로 한다. 인증서에는 서버 공개 키가 CA의 전자서명과 함께 들어 있어서 도메인에 키가 묶인다. 키·서명·해시가 왜 그렇게 동작하는지는 [자세히 → 암호화·해시·인증 기초](#/post/sec-authn-crypto)에 따로 적는다.

헷갈렸던 점은 순서다. 연결은 TCP로 먼저 맺고(3-way), 그 위에서 TLS handshake를 하고, 그다음에야 HTTP 요청이 암호화돼서 나간다. HTTPS라고 해서 TCP가 필요 없어지는 게 아니다.

## 주소창에 치고 나서 일어나는 일

여기까지를 이어 붙이면 이렇다.

1. DNS로 도메인을 IP로 바꾼다.
2. 그 IP의 443 포트로 TCP 연결을 맺는다.
3. TLS handshake로 암호화를 세운다.
4. HTTP 요청을 보내고 응답을 받는다.
5. 응답 HTML을 받아 화면에 그린다. [자세히 → 브라우저가 화면을 그리는 과정](#/post/fe-browser-render)

서버 쪽에서 이 요청이 어디를 거치는지는 [자세히 → 요청 하나가 거치는 길](#/post/infra-request-journey)과 [자세히 → 요청이 처리되는 흐름](#/post/be-request-flow)에서 본다.

<details>
<summary>흔한 오해 몇 개</summary>

- "HTTPS면 서버가 안전하다": TLS는 전송 구간을 보호할 뿐, 서버 코드의 취약점까지 막아 주지 않는다. 이건 일반론이고 따로 문서로 확인한 문장은 아니다.
- "HTTP는 연결을 유지한다": HTTP 메시지 자체는 상태가 없다. 연결을 재사용하는 것(지속 연결)과 상태를 기억하는 것(세션)은 다른 얘기다.
- "UDP는 못 쓸 프로토콜": 용도가 다를 뿐이다. 앱이 순서·재전송을 직접 다루는 편이 나은 경우가 있다.
- "3-way는 보안 절차": 보안이 아니라 양쪽 순서번호를 맞추는 과정이다. 암호화는 TLS가 한다.
- "OSI 7계층이 실제 구현이다": 인터넷은 TCP/IP 기준으로 만들어졌고 OSI는 설명 모델에 가깝다.

</details>

## 같이 보면 좋은 글

← 개념 map으로 [CS·설계 기초 map](#/post/cs-map)

- [자세히 → 운영체제 기초](#/post/cs-os): 소켓과 포트를 OS가 어떻게 다루는지
- [자세히 → 로드밸런서](#/post/infra-load-balancer): 요청이 여러 서버로 나뉘는 지점
- [자세히 → CDN과 캐싱 계층](#/post/infra-cdn-cache): DNS 다음에 요청이 닿는 곳이 서버가 아닐 수도 있다

## 근거 링크

- MDN, An overview of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview
- RFC 9293, Transmission Control Protocol (앞 100,000자까지만 읽음): https://www.rfc-editor.org/rfc/rfc9293.html
- MDN, DNS (Glossary): https://developer.mozilla.org/en-US/docs/Glossary/DNS
- MDN, Transport Layer Security: https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security

