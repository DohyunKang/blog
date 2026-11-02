소켓은 OS가 주는 통신 끝점이고, TCP 소켓은 메시지가 아니라 바이트 흐름만 넘겨준다. 웹소켓은 HTTP 요청 하나로 시작해서, 같은 TCP 연결 위에서 양쪽이 아무 때나 메시지를 보내는 규칙이다.

개요는 [네트워크 기초](#/post/cs-network)와 [운영체제 기초](#/post/cs-os)에 있고, 여기서는 소켓 API를 직접 만져서 보이는 것에 집중한다.

## 소켓이 뭔가

프로그램이 네트워크로 통신하려면 OS에 부탁해야 한다. 그 부탁의 손잡이가 소켓이다. 파이썬에서는 `socket.socket()`이 돌려주는 객체이고, 파일처럼 읽고 쓰는 대상으로 보면 된다. 주소(IP)와 포트가 합쳐진 끝점에 붙는다.

Python 공식 소켓 HOWTO는 서버 소켓과 클라이언트 소켓을 확실히 나눠 설명한다. 서버 소켓은 데이터를 보내지도 받지도 않고, 클라이언트 소켓을 만들어 낼 뿐이다. 호출 순서로 보면 이렇다.

| | 서버 | 클라이언트 |
|---|---|---|
| 1 | `socket()` 끝점 만들기 | `socket()` |
| 2 | `bind()` 주소·포트에 붙이기 | |
| 3 | `listen()` 접속 대기 | |
| 4 | `accept()` 접속 하나를 꺼내 새 소켓 받기 | `connect()` |
| 5 | `recv()` / `sendall()` | `sendall()` / `recv()` |
| 6 | `close()` | `close()` |

`accept()`가 돌려주는 소켓이 실제 대화용이고, 대기용 소켓은 계속 남아 다음 접속을 받는다. 3-way handshake는 `connect()`와 `accept()` 사이 어딘가에서 OS가 알아서 한다. 이 부분은 [TCP와 UDP](#/post/net-tcp-udp)에서 따로 본다.

## recv는 메시지를 돌려주지 않는다

처음 소켓을 쓸 때 제일 많이 하는 착각이 "한 번 보내면 한 번 받는다"다. 직접 해 봤다. 클라이언트가 `hello`와 `world`를 따로 두 번 보내고, 서버는 0.3초 늦게 읽는다.

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

출력은 이랬다.

```
recv 1: b'helloworld'
recv 2: b''
```

두 번 보낸 게 한 번에 붙어서 왔고, 두 번째 `recv`는 빈 바이트다. 빈 바이트는 상대가 연결을 닫았다는 신호다. HOWTO에도 같은 말이 있다. 소켓에는 메시지 끝 표시가 없고, 메시지 경계는 고정 길이이거나, 구분자로 끝나거나, 길이를 앞에 적어 보내거나, 연결을 닫아서 알리는 넷 중 하나로 정해야 한다.

붙어서 온 건 내 PC 루프백에서 지연을 줬을 때의 결과고, 어떻게 쪼개져 오는지는 환경마다 다르다. 어느 쪽이든 앱이 경계를 직접 정해야 한다는 건 같다.

## 길이를 앞에 붙이는 프레이밍

실무에서 흔한 방법은 길이 접두다. 앞 4바이트에 본문 길이를 적고 그만큼 읽는다. 여기서 또 하나 조심할 게 있다. `recv(n)`은 n바이트를 다 채워 준다는 약속이 아니라 최대 n바이트라는 뜻이어서, 정확히 n바이트가 찰 때까지 반복해야 한다. HOWTO도 길이 5글자를 한 번의 `recv`로 못 받을 수 있다고 적는다.

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

`'!I'`는 네트워크 바이트 순서(빅 엔디언)의 부호 없는 4바이트 정수다. 한글은 UTF-8로 인코딩한 바이트 수 기준으로 길이를 센다. 같은 데이터가 앞 예제와 달리 정확히 세 덩어리로 나뉜 건 이 규칙을 둔 덕분이다.

HTTP가 `Content-Length` 헤더나 chunked 전송을 두는 것도 같은 문제를 푸는 방식으로 읽힌다. 웹소켓 프레임에도 길이 필드가 있는데 뒤에서 나온다.

## 블로킹과 동시 접속

`accept()`와 `recv()`는 기본이 블로킹이다. 데이터가 올 때까지 그 줄에서 멈춘다. HOWTO는 상대가 연결을 닫지도 않고 사라지면 소켓이 한참 매달릴 수 있다고 경고한다. 접속 하나당 스레드 하나를 쓰면 쉽지만, 멈춘 연결은 스레드 하나를 그대로 붙잡는다. 스레드 쪽 이야기는 [프로세스와 스레드](#/post/os-process-thread)에서 이어진다.

대안은 논블로킹 소켓과 `select`다. HOWTO 설명으로는 `select`가 읽을 수 있는 소켓, 쓸 수 있는 소켓을 골라 돌려주고, 서버 소켓이 읽기 가능으로 나오면 `accept()`가 거의 확실히 성공한다. 그리고 윈도우에서 `select`는 소켓에만 쓸 수 있고, 유닉스에서는 파일에도 쓸 수 있다고 한다. 파이썬 표준 라이브러리 `selectors`로 감싸서 스레드 하나로 세 클라이언트를 받아 봤다.

<details>
<summary>selectors로 스레드 하나 에코 서버 (실행 확인)</summary>

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

서버 루프는 스레드 하나이고, 클라이언트 세 개는 각자 스레드로 돌렸다. 에코 데이터가 짧아서 `sendall`이 바로 끝난다고 가정한 단순한 예제다. 큰 데이터를 보내는 서버라면 쓰기 가능 이벤트까지 같이 봐야 한다.

</details>

이 방식이 이벤트 루프다. 파이썬 `asyncio`나 Node.js가 같은 모양이고, 요청마다 스레드를 만들지 않는 서버가 이렇게 많은 연결을 다룬다. 그 위에서 HTTP 요청이 어떻게 처리되는지는 [요청이 처리되는 흐름](#/post/be-request-flow)에서 본다.

## 웹소켓이 필요한 이유

HTTP는 클라이언트가 먼저 요청해야 서버가 답한다. 서버가 먼저 말하고 싶은 채팅, 시세, 알림 같은 경우에는 주기적으로 물어보는 폴링을 해야 한다. 웹소켓은 이걸 바꾼다. MDN 설명으로는 브라우저와 서버 사이에 양방향 세션을 열어서, 응답을 보려고 폴링하지 않고도 메시지를 주고받는다.

RFC 6455에서 중요한 문장은, 웹소켓이 HTTP와 별개로 TCP 위에 얹는 프로토콜이고 HTTP와의 관계는 핸드셰이크가 유효한 HTTP Upgrade 요청이라는 점뿐이라는 것이다. 그래서 80, 443 포트를 HTTP 서버와 같이 쓸 수 있다.

## 핸드셰이크: HTTP로 시작해서 101로 넘어간다

클라이언트는 일반 HTTP GET을 보낸다. 헤더에 `Upgrade: websocket`, 16바이트 난수를 base64로 만든 `Sec-WebSocket-Key`, 버전 13이 들어간다. 서버는 `101 Switching Protocols`로 답하고, `Sec-WebSocket-Accept`에 이렇게 만든 값을 넣는다.

- 클라이언트 키 문자열 뒤에 고정 GUID `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`을 붙인다.
- SHA-1 해시를 구한다.
- base64로 인코딩한다.

RFC에 실린 예시 키로 계산해 봤다.

```python
import hashlib, base64
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
key = 'dGhlIHNhbXBsZSBub25jZQ=='
print(base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode())
# s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

이 값이 나왔다. 이 계산은 서버가 웹소켓 핸드셰이크를 이해했다는 증거로 쓰이고, 인증이나 암호화가 아니다. 암호화는 `wss://`, 곧 TLS가 맡는다. 101이 아닌 다른 상태 코드를 받으면 업그레이드가 안 된 것이고 평범한 HTTP 규칙으로 처리한다. 이 요청·응답 모양은 [HTTP와 HTTPS](#/post/net-http)에서 본 것과 같다.

## 프레임: 연결 위에서 오가는 단위

핸드셰이크가 끝나면 같은 TCP 연결이 웹소켓 프레임을 주고받는 통로가 된다. 앞에서 TCP가 경계를 안 준다고 했는데, 웹소켓은 프레임 헤더에 길이를 넣어서 그 문제를 푼 셈이다. RFC 기준 헤더 구성은 이렇다.

| 필드 | 뜻 |
|---|---|
| FIN | 이 프레임이 메시지의 마지막 조각인지 |
| opcode | 0x1 텍스트, 0x2 바이너리, 0x8 close, 0x9 ping, 0xA pong, 0x0 이어지는 조각 |
| MASK | 마스킹 키가 붙었는지 |
| 길이 | 0~125는 그대로, 126이면 뒤 2바이트, 127이면 뒤 8바이트가 길이 |

클라이언트가 보내는 프레임은 반드시 마스킹해야 하고, 서버는 마스킹하지 않은 프레임을 거부해야 한다. 서버가 보내는 프레임은 마스킹하지 않는다. 방식은 payload의 i번째 바이트를 키의 `i mod 4`번째 바이트와 XOR 하는 것이다. RFC가 든 이유는 캐시 프록시 같은 중간 장치를 혼동시키지 않고, 악성 스크립트가 전선에 실리는 바이트를 마음대로 고르지 못하게 하려는 것이다. 키는 예측할 수 없어야 한다고 되어 있다. 마스킹이 암호화는 아니다.

ping과 pong은 연결 확인용 제어 프레임이다. 받은 쪽은 pong으로 응답하고, close를 주고받으면 TCP 연결을 닫는다.

## 파이썬으로 웹소켓 한 번 오가기

위 규칙을 라이브러리 없이 소켓만으로 구현해 봤다. 서버 쪽은 핸드셰이크 응답과 프레임 읽기·쓰기를 하고, 클라이언트는 마스킹한 텍스트 프레임을 보낸다. 126 이상 길이와 조각 메시지, ping 처리는 일부러 뺀 최소 구현이다.

<details>
<summary>소켓만으로 만든 웹소켓 에코 (실행 확인)</summary>

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

opcode 1은 텍스트 프레임이다. 핸드셰이크에서 헤더를 읽는 부분은 요청이 한 번의 `recv`에 다 온다고 가정하지 않고 빈 줄이 나올 때까지 반복해서 읽는다. 앞에서 본 경계 문제가 여기서도 그대로 나온다.

</details>

결과를 보면 웹소켓이 새로운 전송 수단이 아니라, TCP 소켓 위에 "HTTP로 인사하고 프레임으로 말한다"는 약속을 얹은 것임이 코드로 보인다.

## 흔한 오해

- "웹소켓은 TCP와 다른 연결이다": 같은 TCP 연결이다. 핸드셰이크가 끝난 뒤 그 연결의 말투만 바뀐다.
- "소켓 한 번 `send`는 상대의 한 번 `recv`로 온다": 위 실험처럼 붙어서 올 수 있다. 앱이 경계를 정해야 한다.
- "마스킹은 보안 기능이다": RFC가 밝힌 목적은 중간 장치 혼동과 악의적 스크립트의 바이트 조작 방지다. 내용을 숨기는 건 TLS가 한다.
- "웹소켓은 무조건 폴링보다 낫다": 연결을 계속 열어 두므로 서버가 연결 수만큼 자원을 들고 있어야 한다. 이 부분은 [로드밸런서](#/post/infra-load-balancer)나 [비동기 처리와 메시지 큐](#/post/be-async-queue)와 함께 설계로 이어진다.
- "브라우저 `WebSocket`은 알아서 속도를 조절해 준다": MDN은 이 API가 백프레셔(받는 쪽이 감당 못 할 때 보내는 쪽을 늦추는 장치)를 지원하지 않는다고 적는다. 메시지가 처리 속도보다 빨리 오면 메모리가 차거나 CPU가 100%가 될 수 있다고 하고, 그게 문제면 WebTransport API를 보라고 한다.

## 같이 보면 좋은 글

← 개념 지도로 [CS·설계 기초 지도](#/post/cs-map)

- [자세히 → TCP와 UDP](#/post/net-tcp-udp): 소켓 아래에서 연결과 전달을 맡는 쪽
- [자세히 → HTTP와 HTTPS](#/post/net-http): 웹소켓 핸드셰이크가 올라타는 HTTP의 모양
- [자세히 → 동기화와 교착상태](#/post/os-sync-deadlock): 스레드로 소켓을 다룰 때 따라오는 문제

## 근거 링크

- Python 공식 문서, Socket Programming HOWTO: https://docs.python.org/3/howto/sockets.html
- RFC 6455, The WebSocket Protocol (앞 100,000자까지만 읽음): https://www.rfc-editor.org/rfc/rfc6455.html
- MDN, The WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
