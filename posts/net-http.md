HTTP는 클라이언트가 요청을 보내면 서버가 응답 하나를 돌려주는 프로토콜이다. 전체 흐름(DNS → TCP → TLS → HTTP)은 [자세히 → 네트워크 기초](#/post/cs-network)에서 한 번 훑었고, 여기서는 HTTP 메시지 자체와 그 위에 얹힌 규칙(메서드, 상태코드, 캐시), 그리고 HTTPS와 버전별 차이를 좀 더 깊이 본다. 아래 코드는 전부 로컬에서 실행해 본 것이다.

## 메시지는 텍스트다

HTTP/1.1 메시지는 시작 줄, 헤더 여러 줄, 빈 줄, 본문 순서다. 줄바꿈은 `\r\n`이다. 파이썬 소켓으로 요청 문자열을 직접 보내고 응답을 그대로 찍어 봤다.

```python
import socket
s = socket.create_connection(('127.0.0.1', port))   # port: 로컬에 띄운 http.server
s.sendall(b'GET / HTTP/1.1\r\nHost: x\r\n\r\n')
print(s.recv(4096).decode())
```

응답은 이랬다(Date는 생략).

```
HTTP/1.1 200 OK
Server: BaseHTTP/0.6 Python/3.13.15
Content-Length: 11
ETag: "8097d38e"
Cache-Control: no-cache

<h1>hi</h1>
```

여기서 `Content-Length`가 중요하다. 한 TCP 연결 위로 응답이 이어서 오기 때문에 받는 쪽은 본문이 어디서 끝나는지 알아야 한다. 길이를 미리 알면 `Content-Length`를 쓰고, 모르면 `Transfer-Encoding: chunked`로 조각마다 길이를 붙여 보낸다. 같은 서버에 `/chunk` 경로를 만들어 요청하니 날것으로는 이렇게 왔다.

```
b'...Transfer-Encoding: chunked\r\n\r\n6\r\nhello \r\n7\r\nchunked\r\n0\r\n\r\n'
```

`6`과 `7`은 각 조각의 길이(16진수)이고 마지막 `0`이 끝 표시다. `http.client`로 같은 경로를 받으면 조각이 합쳐져서 `b'hello chunked'`가 나온다. 클라이언트 라이브러리가 대신 풀어 주는 부분이다.

같은 소켓에 요청을 연달아 보내도 연결은 안 끊겼다. 서버가 `HTTP/1.1`로 답하면 기본이 지속 연결이라서, 요청 4개(GET, 조건부 GET, chunk GET, POST)를 소켓 하나로 처리했다.

## 메서드: 안전하다와 멱등하다

메서드는 "이 자원에 뭘 하고 싶은가"를 말하고, MDN은 두 가지 성질로 나눈다. 안전(safe)은 서버 상태를 바꾸지 않는 읽기 전용이라는 뜻이고, 멱등(idempotent)은 같은 요청을 여러 번 보내도 한 번 보낸 것과 서버 상태가 같다는 뜻이다. 안전한 메서드는 전부 멱등하다.

| 메서드 | 안전 | 멱등 | 캐시 가능 |
|---|---|---|---|
| GET | O | O | O |
| HEAD | O | O | O |
| OPTIONS | O | O | X |
| PUT | X | O | X |
| DELETE | X | O | X |
| POST | X | X | 조건부 |
| PATCH | X | X | 조건부 |

이 표가 실무에서 의미 있는 건 재시도 때문이다. 응답이 중간에 끊겨 성공했는지 모를 때 `PUT /users/42`(통째로 덮어쓰기)는 다시 보내도 결과가 같지만, `POST /users`는 사용자가 두 명 생길 수 있다. 메서드를 API에서 어떻게 고르는지는 [자세히 → API와 REST](#/post/be-api-rest)로 이어진다.

<details>
<summary>POST 보내 보기</summary>

본문이 있는 요청은 `Content-Length`로 길이를 알려야 한다. 같은 로컬 서버에 소켓으로 보냈고 응답 첫 줄은 `HTTP/1.1 201 Created`였다.

```python
s.sendall(b'POST /u HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\nab')
print(s.recv(4096).decode().splitlines()[0])
```

서버가 본문 2바이트만 읽고 끝낸 것도 길이 헤더 덕분이다. 이 길이가 틀리면 다음 요청의 시작을 잘못 읽게 된다.

</details>

## 상태코드는 첫 자리로 읽는다

| 대역 | 뜻 |
|---|---|
| 1xx | 진행 중(중간 응답) |
| 2xx | 받아서 처리했다 |
| 3xx | 다른 URL로 가야 한다 등 추가 동작 필요 |
| 4xx | 요청이 잘못됐다 |
| 5xx | 서버가 올바른 요청을 처리하지 못했다 |

헷갈리는 쌍만 따로 정리한다.

- 301과 302는 영구/임시 이동이고, 307과 308은 각각 302와 301의 짝인데 메서드를 바꾸지 않는다는 점이 다르다. 그래서 POST를 리다이렉트해도 POST로 남는다.
- 401은 이름은 Unauthorized지만 뜻은 "인증이 안 됐다"이고, 403은 누군지는 아는데 권한이 없다는 뜻이다. 다시 로그인해도 403은 안 풀린다.
- 404는 자원을 못 찾았다는 뜻인데, 존재 자체를 숨기려고 403 대신 404를 쓰는 서버도 있다.
- 429는 일정 시간에 너무 많이 보냈다는 뜻, 503은 점검이나 과부하로 지금은 못 받는다는 뜻이다. 둘 다 `Retry-After` 헤더로 언제 다시 올지 알릴 수 있다.
- 304는 오류가 아니라 캐시 응답이다. 아래에서 본다.

## 캐시와 조건부 요청

위에서 서버가 `ETag`와 `Cache-Control: no-cache`를 내려 줬다. `no-cache`는 "저장하지 마라"가 아니라 "쓰기 전에 서버에 물어봐라"라는 뜻이다. 저장 자체를 막는 건 `no-store`다. 이름 때문에 가장 많이 헷갈리는 쌍이다.

| | no-cache | no-store |
|---|---|---|
| 저장 | 한다 | 안 한다 |
| 재사용 | 서버에 확인 후 | 해당 없음 |
| 변화 없을 때 | 304, 본문 없음 | 매번 200 |

받은 `ETag`를 `If-None-Match`에 실어 같은 연결로 다시 요청했다.

```
GET / HTTP/1.1
If-None-Match: "8097d38e"

HTTP/1.1 304 Not Modified
ETag: "8097d38e"
```

본문 없이 헤더만 왔다. 클라이언트는 갖고 있던 사본을 그대로 쓰면 된다. 내용이 바뀌었다면 서버가 새 `ETag`와 함께 200과 새 본문을 준다. 파일 이름에 버전이 붙는 정적 파일은 `Cache-Control: public, max-age=31536000, immutable`처럼 아예 오래 신선하다고 알려 서버에 묻지도 않게 하는 패턴이 MDN에 권장 예로 나온다. 캐시가 브라우저 말고 중간(CDN)에도 있다는 이야기는 [자세히 → CDN과 캐싱 계층](#/post/infra-cdn-cache)에 이어진다.

## HTTPS: TLS 핸드셰이크 개요

HTTPS는 HTTP 메시지를 TLS 채널 안에 넣어 보내는 것이다. TLS 1.3(RFC 8446)의 핸드셰이크는 크게 이렇게 흐른다.

1. 클라이언트가 ClientHello를 보낸다. 지원하는 암호 스위트와 함께 키 교환용 공개값(key_share)이 들어 있다.
2. 서버가 ServerHello로 스위트를 고르고 자기 key_share를 돌려준다. 이 시점부터 양쪽이 핸드셰이크용 키를 만들 수 있어서 이후 핸드셰이크 메시지는 암호화된다.
3. 서버가 인증서 체인(Certificate)을 보내고, 그 인증서의 개인 키로 지금까지의 핸드셰이크에 서명(CertificateVerify)해서 키 소유를 증명한다. Finished로 전체 내용을 확인한다.
4. 클라이언트도 Finished를 보내면 애플리케이션 데이터(HTTP)가 흐른다.

처음 연결할 때 1 왕복(1-RTT)이다. 서버가 보낸 key_share 그룹이 맞지 않으면 HelloRetryRequest로 한 번 더 오간다. 이전에 공유한 키(PSK)가 있으면 첫 비행에 데이터를 같이 보내는 0-RTT도 되는데, 이 초기 데이터는 순방향 비밀성이 없고 재전송 공격에 약하다. 그래서 멱등한 요청처럼 다시 처리돼도 괜찮은 것만 보내라고 RFC가 적는다. 위의 메서드 표가 여기서 다시 쓰인다.

로컬에서 확인해 봤다. `openssl`로 자체 서명 인증서를 만들고, 파이썬 `ssl`로 서버와 클라이언트를 같은 프로세스에 띄웠다.

```python
cc = ssl.create_default_context(cafile='c.pem')
t = cc.wrap_socket(raw, server_hostname='localhost')
print(t.version(), t.cipher())
print(t.getpeercert()['subject'])
t.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
```

출력은 이랬다.

```
TLSv1.3 ('TLS_AES_256_GCM_SHA384', 'TLSv1.3', 256)
((('commonName', 'localhost'),),)
b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok'
```

TLS 1.3이 협상됐고, 클라이언트가 인증서의 이름을 확인했고(`server_hostname`), 서버 쪽 `recv`에는 복호화된 평문 HTTP 요청이 그대로 도착했다. TLS 위에서도 HTTP 메시지 모양은 하나도 안 바뀐다. 인증서·서명·해시가 어떻게 신뢰를 만드는지는 [자세히 → 암호화·해시·인증 기초](#/post/sec-authn-crypto)에 있다.

<details>
<summary>실행한 환경</summary>

- 파이썬 3.13, `ssl.OPENSSL_VERSION`은 OpenSSL 3.0.x, `ssl.HAS_TLSv1_3`은 True.
- 인증서는 `openssl req -x509`로 만든 1일짜리 자체 서명이고 subjectAltName에 localhost를 넣었다.
- 위 로컬 실험은 한 PC 안이라 왕복 시간(RTT) 차이는 측정하지 않았다.

</details>

## 버전별로 달라진 것: 1.1, 2, 3

세 버전의 의미(메서드, 상태코드, 헤더 개념)는 같고 전송 방식이 다르다.

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 형식 | 텍스트 | 바이너리 | 바이너리 |
| 연결 하나에서 | 요청을 순서대로(파이프라인은 있었음) | 여러 요청을 동시에(멀티플렉싱) | 동시에, 스트림별로 독립 |
| 아래 전송 | TCP | TCP | QUIC(UDP 위) |
| 헤더 | 매번 그대로 | 압축 | 압축 |

1.1은 연결을 재사용하게 됐지만 앞 응답이 끝나야 다음 응답을 받는 head-of-line 문제가 있었고, 브라우저는 출처당 TCP 연결을 6개까지 열어서 우회했다. HTTP/2는 한 연결에서 병렬 요청을 허용해 이 제약을 없앴다. 다만 TCP 하나 위에서 돌기 때문에 패킷이 하나 손실되어 TCP가 재전송하는 동안 그 연결의 모든 스트림이 같이 기다린다. HTTP/3은 TCP 대신 UDP 위의 QUIC을 쓰고, QUIC이 스트림마다 손실 감지와 재전송을 따로 해서 손실이 생긴 스트림만 막힌다. TCP 자체의 동작은 [자세히 → TCP와 UDP](#/post/net-tcp-udp)에서 이어서 본다.

## 흔한 오해

- 304는 에러가 아니다. 캐시 사본이 아직 유효하다는 정상 응답이다.
- `no-cache`는 캐시하지 말라는 뜻이 아니다. 저장은 하되 재사용 전에 확인하라는 뜻이다.
- 401과 403은 같은 말이 아니다. 인증이 안 된 것과 권한이 없는 것이다.
- HTTP/2가 TCP의 한계까지 없애 주지는 않는다. 그 한계를 푼 게 HTTP/3 쪽이다.
- HTTPS여도 HTTP 메시지 자체는 그대로다. 바뀌는 건 그 아래 채널이다.

## 같이 보면 좋은 글

← [개념 지도로](#/post/cs-map)

- [자세히 → 소켓과 웹소켓](#/post/net-socket): 위에서 쓴 소켓 코드를 더 자세히
- [자세히 → DNS와 IP·라우팅](#/post/net-dns-routing): 연결 맺기 전에 일어나는 일
- [자세히 → API와 REST](#/post/be-api-rest): 메서드와 상태코드를 API에서 쓰는 법

## 근거 링크

- MDN, HTTP request methods: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- MDN, Evolution of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP
- MDN, HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- RFC 8446, The Transport Layer Security (TLS) Protocol Version 1.3: https://www.rfc-editor.org/rfc/rfc8446.html
