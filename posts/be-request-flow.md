요청 하나는 클라이언트가 보내고, 서버의 프레임워크가 미들웨어 줄을 차례로 통과시킨 뒤 라우터가 맞는 핸들러를 골라 주고, 핸들러가 DB를 거쳐 만든 응답이 같은 길을 거슬러 돌아온다.

## 쉬운 말로 먼저

식당 주문에 비유하면 이해가 빠르다. 손님(클라이언트)이 주문서(요청)를 낸다. 입구 직원이 대기자 명단에 적고(로깅), 예약 손님인지 확인하고(인증), 메뉴판을 보고 어느 주방 담당에게 보낼지 정한다(라우팅). 담당자가 창고(DB)를 뒤져 요리를 만들고, 접시(응답)가 홀로 나간다.

백엔드 코드는 이 중간 과정을 짠다. 브라우저는 요청만 보내고 응답만 받으니 중간은 보이지 않는다.

## 요청과 응답의 모양

HTTP 요청은 메서드(GET, POST 등), 자원 경로, 프로토콜 버전, 선택적인 헤더, 선택적인 본문으로 되어 있다. 응답은 프로토콜 버전, 상태 코드와 짧은 메시지, 헤더, 선택적인 본문이다. MDN 예시를 줄이면 이렇다.

```http
GET /users/1 HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: application/json
```

주소창에 주소를 넣으면 브라우저가 TCP 연결을 열거나 있던 연결을 재사용하고, 위 같은 요청을 보낸다. 응답이 HTML이면 브라우저가 파싱하면서 거기 적힌 스크립트·CSS·이미지를 다시 요청한다. 한 번 엔터를 쳤는데 서버에 요청이 여러 개 가는 이유다. 화면이 그려지는 쪽은 [브라우저가 화면을 그리는 과정 → 렌더링](#/post/fe-browser-render)에서 따로 본다.

클라이언트와 서버 사이에 프록시가 끼기도 한다. MDN은 프록시가 캐시, 필터링, 로드 밸런싱, 인증, 로깅을 할 수 있다고 적는다. 서버 앞단에 이런 것들이 얼마나 줄줄이 서 있는지는 [요청이 서버에 닿기까지 → 여정](#/post/infra-request-journey)에서 다룬다.

## 서버 안에서

서버 프로세스에 요청이 도착하면 프레임워크(Express, FastAPI, Spring 등)가 받아서 요청 객체와 응답 객체로 바꿔 준다. 그 다음 순서는 대체로 이렇다.

| 단계 | 하는 일 | 예 |
|---|---|---|
| 미들웨어 | 모든(또는 일부) 요청이 지나는 공통 처리 | 로깅, 인증, JSON 파싱, CORS |
| 라우팅 | 메서드와 경로로 핸들러 선택 | `GET /users/:id` |
| 핸들러 | 실제 비즈니스 로직 | 사용자 조회 |
| 데이터 접근 | DB·캐시·외부 API 호출 | SQL 실행 |
| 응답 | 상태 코드·헤더·본문 만들기 | `200` + JSON |
| 에러 처리 | 어디서든 난 예외를 모아 응답으로 | `500` |

경로에서 `:id` 같은 부분은 자리 표시자고, 라우터가 실제 값을 꺼내 핸들러에 넘긴다. API 경로를 어떻게 설계하는지는 [REST API](#/post/be-api-rest)에 있다.

## 미들웨어는 줄이다

Express 문서의 정의로는 미들웨어는 요청(`req`), 응답(`res`), 다음 미들웨어(`next`)에 접근할 수 있는 함수다. 코드를 실행하거나, req와 res를 바꾸거나, 요청-응답 주기를 끝내거나, 다음으로 넘길 수 있다. 응답을 끝내지 않으면 반드시 `next()`를 불러야 하고, 안 부르면 요청이 그냥 멈춘다.

그리고 정의된 순서대로 실행된다. 같은 경로의 핸들러도 순서대로 검사해서, 앞에서 응답을 보냈으면 뒤의 것은 실행되지 않는다. 그래서 인증 미들웨어는 라우트보다 앞에 둔다. 순서를 잘못 두면 인증 없이 지나가는 길이 생긴다.

종류는 Express 기준으로 앱 전체에 붙는 것, 라우터에 붙는 것, 에러 처리용(인자가 `(err, req, res, next)` 네 개), 내장(`express.json` 등), 서드파티로 나뉜다. 에러 처리 미들웨어는 인자 네 개를 다 선언해야 하고, 안 쓰는 `next`도 적어야 한다. 아니면 일반 미들웨어로 취급돼 에러가 오지 않는다고 문서에 나와 있다.

이 구조는 양파 껍질처럼 생각하면 편하다. 요청은 바깥 껍질부터 안으로 들어가고, 응답은 안에서 바깥으로 나온다. 로깅 미들웨어가 "들어올 때 한 줄, 나갈 때 한 줄"을 남길 수 있는 이유다.

## 직접 돌려 본 미니 프레임워크

개념만 읽으면 흐릿해서, 파이썬 표준 라이브러리만으로 라우팅과 미들웨어 줄을 흉내 내 봤다. 실제 프레임워크는 훨씬 복잡하지만 뼈대는 같다.

<details>
<summary>코드 (실행 확인함)</summary>

```python
import re

class App:
    def __init__(self):
        self.middlewares = []
        self.routes = []          # (method, regex, handler)

    def use(self, fn):
        self.middlewares.append(fn)

    def route(self, method, path):
        regex = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", path) + "$")
        def deco(fn):
            self.routes.append((method, regex, fn))
            return fn
        return deco

    def handle(self, method, path, body=None):
        req = {"method": method, "path": path, "body": body, "params": {}}

        def dispatch(req):
            for m, rx, fn in self.routes:
                hit = rx.match(req["path"])
                if m == req["method"] and hit:
                    req["params"] = hit.groupdict()
                    return fn(req)
            return {"status": 404, "body": "not found"}

        chain = dispatch
        for mw in reversed(self.middlewares):
            chain = (lambda mw, nxt: lambda r: mw(r, nxt))(mw, chain)
        try:
            return chain(req)
        except Exception as e:
            return {"status": 500, "body": f"error: {e}"}

app = App()
DB = {"1": "kim", "2": "lee"}
log = []

def logger(req, nxt):
    log.append(f"-> {req['method']} {req['path']}")
    res = nxt(req)
    log.append(f"<- {res['status']}")
    return res

def auth(req, nxt):
    if req["path"].startswith("/admin"):
        return {"status": 401, "body": "login required"}
    return nxt(req)

app.use(logger)
app.use(auth)

@app.route("GET", "/users/:id")
def get_user(req):
    name = DB[req["params"]["id"]]
    return {"status": 200, "body": {"id": req["params"]["id"], "name": name}}

for args in [("GET", "/users/1"), ("GET", "/users/9"), ("GET", "/nope"), ("GET", "/admin/x")]:
    print(args, app.handle(*args))
print("\n".join(log))
```

실행 결과.

```
('GET', '/users/1') {'status': 200, 'body': {'id': '1', 'name': 'kim'}}
('GET', '/users/9') {'status': 500, 'body': "error: '9'"}
('GET', '/nope') {'status': 404, 'body': 'not found'}
('GET', '/admin/x') {'status': 401, 'body': 'login required'}
-> GET /users/1
<- 200
-> GET /users/9
-> GET /nope
<- 404
-> GET /admin/x
<- 401
```

</details>

결과에서 눈에 띄는 게 세 가지다.

- `/admin/x`는 인증 미들웨어에서 끊겨서 핸들러까지 가지 못하고 401이 나왔다. 그래도 로거는 바깥 껍질이라 들어올 때와 나갈 때를 둘 다 남겼다.
- `/nope`는 맞는 라우트가 없어서 404다. 404도 오류가 아니라 라우터가 "맞는 게 없다"고 돌려주는 정상 응답이다.
- `/users/9`는 DB에 없는 키를 읽다 예외가 났고, 바깥에서 잡아 500으로 바꿨다. 그런데 로그에는 `-> GET /users/9`만 있고 `<-` 줄이 없다. 예외가 로거를 건너뛰고 올라가서 나갈 때의 로그가 빠진 것이다. 이 코드에서는 로거가 예외를 잡지 않기 때문이고, 실제 서비스에서 에러 로그가 한 줄 비는 것도 비슷한 이유일 수 있다. 에러 처리를 어디에 두느냐가 중요한 이유가 이거였다. 에러를 모으는 방법은 [에러와 로깅](#/post/be-error-logging)에서 이어진다.

이 코드의 `9`는 "없는 사용자니까 404"가 맞는데 500이 나왔다. 핸들러에서 "없음"과 "서버 고장"을 구분하지 않으면 이렇게 된다.

## DB는 어디에 끼나

핸들러가 SQL을 직접 쓰기도 하고, 서비스 계층이나 저장소 계층을 거치기도 한다. 이렇게 층을 나누는 이유와 방식은 [계층 구조](#/post/be-layered-architecture)에서 정리한다. DB 호출은 보통 요청 시간에서 가장 큰 덩어리라서, 느릴 때 제일 먼저 의심하는 곳이다. 쿼리를 빠르게 하는 이야기는 [인덱스](#/post/db-index)에 있다.

핸들러가 오래 걸리는 일(메일 발송, 영상 변환)을 요청 안에서 끝까지 하면 클라이언트가 계속 기다린다. 그런 건 큐에 넣고 먼저 응답을 돌려주는 방식을 쓰는데, [비동기와 큐](#/post/be-async-queue)에서 본다.

## 흔한 오해

- 요청은 곧 서버 하나라고 생각하기 쉽다. MDN 설명으로도 서버는 부하를 나눠 맡는 여러 대일 수 있고, 클라이언트는 어느 대에 닿았는지 모른다.
- 미들웨어에서 응답을 보냈는데 `next()`도 부르면 뒤 핸들러가 또 응답하려다 오류가 난다. 응답을 끝냈으면 넘기지 않는다.
- 상태 코드는 서버가 정한 약속이라 `200`을 보내면서 본문에 "실패"를 적어도 동작은 한다. 다만 클라이언트·프록시·모니터링이 상태 코드를 보고 움직이니 코드를 맞춰 보내는 편이 낫다.
- 순서는 중요하지 않다고 생각하기 쉽다. 위 데모처럼 미들웨어는 등록한 순서가 곧 실행 순서다.

---

## 근거 링크
- MDN, An overview of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview (읽음)
- Express, Using middleware: https://expressjs.com/en/guide/using-middleware.html (읽음)

← [개념 지도로](#/post/be-map)

관련 글: [REST API](#/post/be-api-rest) · [계층 구조](#/post/be-layered-architecture) · [요청이 서버에 닿기까지](#/post/infra-request-journey)
