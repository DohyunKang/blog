API는 프로그램끼리 대화하는 창구이고, REST는 그 창구를 "주소로 대상을 정하고 HTTP 메서드로 동작을 정하는" 방식으로 만들자는 약속이다. 이 글은 그 약속의 구성 요소를 메서드, 주소, 상태 코드, 멱등성 순서로 정리한 것이다.

## API가 뭔지

API(Application Programming Interface)는 한 프로그램이 다른 프로그램의 기능을 부르는 규칙이다. 식당으로 치면 메뉴판과 주문 방법에 가깝다. 주방에서 어떻게 만드는지는 몰라도, 메뉴판대로 말하면 음식이 나온다.

웹에서 말하는 API는 보통 HTTP로 주고받는 API를 뜻한다. 클라이언트(앱, 브라우저, 다른 서버)가 요청을 보내고, 서버가 응답을 돌려준다. 이 길이 실제로 어떻게 생겼는지는 [자세히 → 네트워크 기초](#/post/cs-network)에, 요청이 서버 안에서 처리되는 과정은 [자세히 → 요청이 처리되는 흐름](#/post/be-request-flow)에 따로 정리한다.

## REST는 약속이다

REST는 프로토콜이나 라이브러리가 아니라 설계 스타일이다. 규칙이 몇 개 있다. 대상(리소스)을 주소(URL)로 가리키고, 동작은 HTTP 메서드로 말하고, 서버는 요청마다 필요한 정보를 다 받아서 처리한다(상태를 서버가 들고 있지 않는다). 이 규칙을 잘 따르는 API를 RESTful하다고 부른다.

실제로는 규칙을 느슨하게 따르는 API가 대부분이다. JSON을 주고받고 URL이 대충 명사로 되어 있으면 보통 "REST API"라고 부른다. 원 논문의 제약을 전부 지키는지는 따지지 않는 경우가 많다. 이 글도 그 흔한 쓰임을 기준으로 한다.

## 리소스와 주소

REST에서는 동작이 아니라 대상 중심으로 주소를 만든다. 사용자라는 대상이 있으면 이렇게 간다.

| 주소 | 뜻 |
|---|---|
| `/users` | 사용자 전체 모음 |
| `/users/42` | 42번 사용자 하나 |
| `/users/42/orders` | 42번 사용자의 주문들 |

주소에는 `/getUser`, `/deleteUser` 같은 동사를 넣지 않는다. 가져올지 지울지는 주소가 아니라 메서드가 말하기 때문이다. 복수형 명사를 쓰고, 소문자와 하이픈으로 쓰는 쪽이 관례다.

## HTTP 메서드

같은 주소라도 메서드에 따라 하는 일이 달라진다.

| 메서드 | 하는 일 | 예 |
|---|---|---|
| GET | 읽기 | `GET /users/42` |
| POST | 새로 만들기 | `POST /users` |
| PUT | 통째로 바꾸기(없으면 만들기도 함) | `PUT /users/42` |
| PATCH | 일부만 바꾸기 | `PATCH /users/42` |
| DELETE | 지우기 | `DELETE /users/42` |

PUT과 PATCH의 차이는 이름만 바꾸고 싶을 때 드러난다. PUT은 사용자 전체를 새 내용으로 덮어쓰는 쪽이라 빠진 필드는 사라질 수 있고, PATCH는 보낸 필드만 고친다. 다만 이 구분은 관례여서 API마다 다르게 구현하기도 한다.

## 상태 코드

응답에는 숫자 코드가 붙는다. 첫 자리가 큰 분류다. 2xx는 성공, 3xx는 다른 곳으로 가라는 안내, 4xx는 요청한 쪽 잘못, 5xx는 서버 쪽 문제다. MDN 상태 코드 문서 기준으로 API에서 자주 만나는 것만 추리면 이렇다.

| 코드 | 뜻 |
|---|---|
| 200 OK | 성공 |
| 201 Created | 성공했고 새 리소스가 생김(보통 POST 뒤) |
| 204 No Content | 성공했지만 돌려줄 내용이 없음(삭제 뒤에 흔함) |
| 400 Bad Request | 요청 형식이 잘못됨 |
| 401 Unauthorized | 이름과 달리 "인증 안 됨"에 가까움 |
| 403 Forbidden | 누군지는 알지만 권한이 없음 |
| 404 Not Found | 그 리소스를 못 찾음 |
| 409 Conflict | 서버의 현재 상태와 충돌 |
| 422 Unprocessable Content | 형식은 맞는데 내용이 의미상 틀림 |
| 429 Too Many Requests | 짧은 시간에 너무 많이 보냄 |
| 500 Internal Server Error | 서버가 처리 못 한 일반적 오류 |
| 503 Service Unavailable | 서버가 일시적으로 못 받음(점검·과부하) |

401과 403은 자주 헷갈린다. 로그인을 안 했으면 401, 로그인은 했는데 남의 것을 건드리면 403이다. 이 둘이 나오는 배경은 [자세히 → 인증과 인가](#/post/be-auth)에서 다룬다. 429는 [자세히 → 레이트 리밋과 트래픽 제어](#/post/infra-rate-limit)와 이어진다.

## 멱등성

이 글에서 제일 오래 붙잡은 개념이다. 멱등(idempotent)은 같은 요청을 한 번 보내든 여러 번 보내든 서버에 남는 효과가 같다는 뜻이다. MDN은 이래서 응답을 못 받았을 때 클라이언트가 안심하고 다시 보낼 수 있다고 설명한다.

메서드별로는 GET, PUT, DELETE가 멱등이고, POST와 PATCH는 멱등이라고 보장되지 않는다. GET은 읽기 전용(safe)이라 당연히 멱등이다.

- PUT: "42번 이름을 lee로" 를 두 번 보내도 결과는 똑같이 이름이 lee다.
- DELETE: 두 번 보내도 결국 없는 상태다. 첫 번째는 204, 두 번째는 404처럼 응답 코드는 달라도 서버에 남은 효과는 같다. MDN 문서에도 이 예가 나온다.
- POST: 보낼 때마다 새로 만든다. 두 번 보내면 두 개가 생긴다.

그래서 네트워크가 끊겨서 응답을 못 받은 상황에서 POST를 자동으로 다시 보내면 주문이 두 번 들어갈 수 있다. 결제나 주문 API에서는 요청마다 고유 키(Idempotency-Key 같은 헤더)를 붙여 서버가 중복을 걸러내게 하는 방식을 쓰는 곳이 있다. 이 헤더는 표준으로 확정된 게 아니라 서비스마다 다를 수 있어서 이 글에서는 이름만 적어 둔다.

멱등성은 "서버가 의도한 효과"에 대한 얘기다. 요청마다 로그가 한 줄씩 남는 건 상관하지 않는다. 그리고 HTTP 규격이 이를 강제하지는 않는다. GET인데 호출할 때마다 값을 바꾸는 서버도 만들 수 있고, 그러면 쓰는 쪽이 당한다.

## 직접 돌려 본 예시

파이썬 표준 라이브러리만으로 작은 서버를 띄우고 같은 요청을 두 번씩 보내 봤다(Python 3.13.15에서 실행 확인).

<details>
<summary>코드와 실행 결과 펼치기</summary>

```python
import json, threading, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

db = {}
next_id = 1

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None):
        self.send_response(code)
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers(); self.wfile.write(data)
        else:
            self.send_header("Content-Length", "0"); self.end_headers()
    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")
    def do_POST(self):
        global next_id
        if self.path != "/users": return self.send(404, {"error": "not found"})
        b = self.body()
        if "name" not in b: return self.send(422, {"error": "name required"})
        uid = next_id; next_id += 1
        db[uid] = {"id": uid, **b}
        self.send(201, db[uid])
    def do_GET(self):
        if self.path == "/users": return self.send(200, list(db.values()))
        uid = int(self.path.rsplit("/", 1)[1])
        self.send(200, db[uid]) if uid in db else self.send(404, {"error": "not found"})
    def do_PUT(self):
        uid = int(self.path.rsplit("/", 1)[1])
        db[uid] = {"id": uid, **self.body()}
        self.send(200, db[uid])
    def do_DELETE(self):
        uid = int(self.path.rsplit("/", 1)[1])
        if db.pop(uid, None) is None: return self.send(404, {"error": "not found"})
        self.send(204)

s = HTTPServer(("127.0.0.1", 8765), H)
threading.Thread(target=s.serve_forever, daemon=True).start()

def call(m, p, b=None):
    r = urllib.request.Request("http://127.0.0.1:8765" + p, method=m,
        data=json.dumps(b).encode() if b is not None else None,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as x: t = x.read().decode(); print(m, p, x.status, t)
    except urllib.error.HTTPError as e:
        print(m, p, e.code, e.read().decode())

call("POST", "/users", {"name": "kim"})
call("POST", "/users", {"name": "kim"})
call("POST", "/users", {})
call("GET", "/users/1")
call("PUT", "/users/1", {"name": "lee"})
call("PUT", "/users/1", {"name": "lee"})
call("DELETE", "/users/1")
call("DELETE", "/users/1")
call("GET", "/users")
```

실행 결과:

```
POST /users 201 {"id": 1, "name": "kim"}
POST /users 201 {"id": 2, "name": "kim"}
POST /users 422 {"error": "name required"}
GET /users/1 200 {"id": 1, "name": "kim"}
PUT /users/1 200 {"id": 1, "name": "lee"}
PUT /users/1 200 {"id": 1, "name": "lee"}
DELETE /users/1 204 
DELETE /users/1 404 {"error": "not found"}
GET /users 200 [{"id": 2, "name": "kim"}]
```

</details>

결과에서 볼 것은 세 가지다. POST를 두 번 보냈더니 id가 1, 2로 사용자가 둘 생겼다. PUT은 두 번 보내도 응답이 똑같았고 상태도 그대로였다. DELETE는 첫 번째가 204, 두 번째가 404였는데, 마지막 GET을 보면 1번이 없다는 최종 상태는 같다. 빈 본문을 가진 요청에 422를 돌려주는 부분은 내가 임의로 정한 규칙이다. 400과 422 중 어느 쪽을 쓸지는 팀마다 다르다.

요청·응답 한 쌍을 날것으로 보면 이렇게 생겼다.

```
POST /users HTTP/1.1
Content-Type: application/json

{"name": "kim"}

HTTP/1.1 201 Created
Content-Type: application/json

{"id": 1, "name": "kim"}
```

## 흔한 오해

- REST API는 JSON을 쓰는 API라고 생각하기 쉬운데, JSON은 흔한 선택일 뿐이고 REST의 조건은 아니다.
- POST는 만들기, PUT은 수정이라고 외우지만 PUT도 없는 리소스를 만들 수 있다. 주소를 클라이언트가 정하면 PUT, 서버가 id를 정하면 POST를 쓰는 식으로 갈리는 경우가 많다.
- 에러도 일단 200으로 주고 본문에 `"success": false`를 넣는 API가 있다. 동작은 하지만 클라이언트·캐시·모니터링 도구가 상태 코드를 보고 판단하는 경우가 많아서, 코드로 의미를 알려 주는 편이 낫다. 오류 응답 본문을 어떻게 짤지는 [자세히 → 에러 처리와 로깅](#/post/be-error-logging)에서 이어진다.
- 상태 코드 401과 403을 같은 것으로 쓰면 클라이언트가 "다시 로그인해야 하나, 권한 요청을 해야 하나"를 구분하지 못한다.

LLM이 외부 기능을 부르는 도구 호출도 결국 이런 API 호출로 이어지는 경우가 많다. 그쪽은 [자세히 → 도구 호출(Function calling)](#/post/ai-tool-use)에 있다.

## 근거 링크

- MDN, Idempotent: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- 코드는 로컬에서 직접 실행(Python 3.13.15)

관련 글: [인증과 인가](#/post/be-auth) · [요청이 처리되는 흐름](#/post/be-request-flow) · [에러 처리와 로깅](#/post/be-error-logging)
