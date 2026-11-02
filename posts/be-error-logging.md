백엔드에서 에러는 없애는 게 아니라 "누가 알아야 하는 에러인지"를 나눠서 처리하는 일이었고, 그 나눔의 결과물이 에러 응답과 로그였다.

## 에러 처리가 뭔지

서버는 요청 하나가 들어오면 입력 검사, DB 조회, 외부 API 호출 같은 걸 줄줄이 한다. 어느 단계에서든 실패할 수 있다. 에러 처리는 실패했을 때 서버가 어떻게 행동할지 정해 두는 것이다. 크게 세 가지를 정한다.

- 호출한 쪽에 뭘 돌려줄지(에러 응답)
- 다시 해 볼지, 포기할지(재시도)
- 나중에 원인을 찾을 수 있게 뭘 남길지(로깅)

요청이 어떤 길로 서버를 지나가는지는 [자세히 → 요청이 처리되는 흐름](#/post/be-request-flow)에 따로 적었다. 에러는 그 길 어디서든 튀어나올 수 있다고 생각하면 된다.

## 예외를 나누는 기준

에러를 전부 `Exception` 하나로 던지면 위쪽에서 구분할 방법이 없다. 그래서 종류를 나눈다. 내가 쓰기 편하다고 느낀 기준은 두 가지다.

| 기준 | 예 | 보통 처리 |
|---|---|---|
| 클라이언트 잘못 | 입력 형식 틀림, 없는 리소스, 권한 없음 | 4xx로 응답, 재시도해도 소용없음 |
| 서버·외부 문제 | DB 끊김, 외부 API 타임아웃, 버그 | 5xx로 응답, 일시적이면 재시도 가능 |

여기에 "재시도해도 되는 에러인가"를 예외 클래스에 속성으로 달아 두면 편하다. 아래 코드가 그 모양이다. 에러 종류마다 HTTP 상태 코드, 기계가 읽는 코드 문자열, 재시도 가능 여부를 갖는다.

```python
class AppError(Exception):
    status = 500; code = "internal_error"; retryable = False
class NotFound(AppError):
    status = 404; code = "order_not_found"
class Upstream(AppError):
    status = 502; code = "upstream_failed"; retryable = True
```

예외는 일어난 자리에서 바로 삼키지 않고, 처리할 수 있는 계층까지 올려 보내는 게 기본이다. 값이 없다고 `None`을 돌려주면서 에러를 숨기면, 나중에 엉뚱한 곳에서 터져서 원인을 찾기 어렵다. 계층을 나누는 얘기는 [자세히 → 계층형 구조](#/post/be-layered-architecture)와 이어진다. 보통 맨 바깥(요청을 받는 층)에서 한 번에 잡아서 응답으로 바꾸고, 안쪽 층은 의미 있는 예외만 던진다.

## 에러 응답 규약

에러 응답 모양이 서비스마다, 심지어 엔드포인트마다 다르면 호출하는 쪽이 일일이 맞춰야 한다. 그래서 규약을 정해 둔다.

표준도 있다. RFC 9457(Problem Details for HTTP APIs)은 에러를 `application/problem+json` JSON 객체로 돌려주는 방식을 정의한다. 멤버는 다섯 개다.

| 멤버 | 뜻 |
|---|---|
| type | 문제 종류를 가리키는 URI. 없으면 `about:blank` |
| title | 문제 종류의 짧은 설명. 같은 종류면 매번 같음 |
| status | 서버가 낸 HTTP 상태 코드. 응답의 실제 코드와 같아야 함 |
| detail | 이번 건에 대한 설명. 클라이언트가 고치는 데 도움이 되는 내용 |
| instance | 이번 발생 건을 가리키는 식별자 |

문서에서 눈에 띈 점이 몇 개 있었다. 모르는 확장 멤버는 클라이언트가 무시해야 한다. `detail` 문자열은 사람이 읽으라고 있는 것이어서 클라이언트가 그걸 파싱하지 말라고 한다. 기계가 읽을 정보는 확장 멤버에 넣으라는 뜻이다. 그리고 `status` 멤버와 실제 HTTP 상태 코드가 어긋나면(중간 장비가 바꾼 경우 등) 실제 HTTP 상태 코드를 믿으라고 한다.

내가 위 예외 클래스로 만든 응답은 이런 모양이었다.

```json
{"type": "https://example.com/errors/order_not_found", "title": "order_not_found", "status": 404, "detail": "order 7 not found"}
```

응답에는 스택 트레이스나 DB 쿼리 같은 내부 정보를 넣지 않는다. 그건 로그에만 남긴다. 상태 코드를 어떻게 고르는지는 [자세히 → REST API](#/post/be-api-rest)와 겹친다.

## 재시도와 타임아웃

외부 API는 가끔 느리거나 실패한다. 이때 다시 해 보는 게 재시도다. 그런데 무작정 하면 더 나빠질 수 있다. AWS Builders' Library 글의 요점은 이랬다.

- 원격 호출에는 항상 타임아웃을 둔다. 너무 길면 자원을 붙잡고 기다리고, 너무 짧으면 불필요한 재시도 트래픽이 늘어난다.
- 재시도는 일시적인 실패에 도움이 되지만 서버 입장에서는 부담이다. 과부하 상태에서 재시도가 몰리면 회복이 늦어진다.
- 호출 계층마다 재시도하면 곱해진다. 글에는 계층이 쌓이면 DB 부하가 243배까지 늘 수 있다는 예가 나온다.
- 그래서 재시도는 간격을 점점 늘리고(지수 백오프), 횟수에도 상한을 둔다.
- 간격이 같으면 실패한 클라이언트들이 같은 시각에 다시 몰리니까 무작위 값(지터)을 섞어서 흩는다.
- 부작용이 있는 호출은 멱등할 때만 재시도해도 안전하다. 읽기는 대체로 멱등이고, 생성 API는 아닐 수 있다.

예외에 `retryable`을 달아 둔 이유가 여기서 나온다. 404를 세 번 재시도해 봐야 같은 404다. 반대로 결제 생성처럼 멱등하지 않은 호출을 그냥 재시도하면 두 번 결제될 수 있다. 멱등성과 워커 쪽 재시도는 [자세히 → 비동기 처리와 메시지 큐](#/post/be-async-queue)에서 이어진다. 요청이 너무 많아서 서버가 거절하는 쪽은 자세히 → 속도 제한에 있다.

재시도 코드는 이렇게 짰다. 시도마다 대기 상한을 두 배로 늘리고 0부터 그 상한 사이에서 무작위로 고르는 방식이다(AWS 글이 설명하는 방식을 간단히 옮긴 것이고, 글에 나온 코드 그대로는 아니다).

```python
def retry(fn, tries=4, base=0.01, cap=0.1):
    for i in range(tries):
        try:
            return fn()
        except AppError as e:
            if not e.retryable or i == tries - 1:
                raise
            wait = random.uniform(0, min(cap, base * 2 ** i))
            log.warning("retry", extra={"attempt": i + 1, "wait": round(wait, 3), "code": e.code})
            time.sleep(wait)
```

세 번째 호출에서 성공하도록 만든 가짜 함수로 돌려 보니, 재시도 경고 로그가 두 줄 찍히고 `ok`가 나왔다. 재시도 불가인 `NotFound`는 한 번 만에 올라왔다.

## 구조화 로그

로그는 사람이 읽는 문장으로만 남기면 나중에 검색이 힘들다. "주문 7번 조회 실패, 사용자 12"를 정규식으로 긁어야 한다. 구조화 로그는 한 줄을 JSON 같은 키-값으로 남기는 방식이다.

```json
{"level": "WARNING", "msg": "retry", "request_id": "req-123", "attempt": 1, "wait": 0.004, "code": "upstream_failed"}
```

이러면 `request_id`로 한 요청의 로그를 전부 모으고, `code`별로 세고, `level`로 거르는 게 쉽다. 요청마다 id를 붙여 여러 로그를 묶는 습관이 특히 유용했다. Python에서는 `contextvars`에 id를 넣어 두고 포매터가 매 줄에 붙이게 했다. 포매터 전체는 접기에 넣었다.

로그 레벨은 대략 이렇게 나눠 쓴다.

| 레벨 | 쓰는 때 |
|---|---|
| DEBUG | 개발 중 자세한 값 |
| INFO | 정상 흐름의 큰 이정표 |
| WARNING | 문제는 있지만 처리됨(재시도 등) |
| ERROR | 요청이 실패함 |

같은 에러를 계층마다 로그로 남기면 한 건이 여러 줄로 찍혀서 세기가 어렵다. 한 번만, 보통 맨 바깥에서 잡을 때 남기는 편이 깔끔했다. 비밀번호·토큰·API 키는 로그에 남기지 않는다. 키 다루기는 자세히 → 키 관리에 있다. 로그를 모아 보고 알림까지 거는 쪽은 자세히 → 관측 가능성과 이어진다.

## 흔한 오해

- 에러는 숨기면 안정적이다: 숨긴 에러는 다른 곳에서 더 알아보기 힘든 모양으로 나온다.
- 실패하면 일단 재시도: 재시도 불가 에러는 낭비고, 멱등하지 않은 호출은 사고가 된다. 과부하일 때는 서버를 더 괴롭힌다.
- 모든 걸 ERROR로 남긴다: 처리된 문제까지 ERROR면 진짜 장애가 묻힌다.
- 에러 메시지는 자세할수록 좋다: 사용자에게 보이는 응답에 내부 정보가 나가면 보안 문제가 된다. 자세한 건 로그에만 둔다.
- 로그는 나중에 필요하면 붙이면 된다: 장애는 보통 로그를 안 넣은 곳에서 난다. 요청 id와 에러 코드 정도는 처음부터 넣어 두는 게 낫다.

<details>
<summary>자세한 풀이: 구조화 로그 포매터 전체 코드</summary>

표준 라이브러리 `logging`만 썼다. `extra=`로 넘긴 키는 레코드 속성으로 붙으니까, 기본 속성을 뺀 나머지를 JSON에 넣는다.

```python
import json, logging, contextvars

request_id = contextvars.ContextVar("request_id", default="-")

class JsonFormatter(logging.Formatter):
    _SKIP = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}
    def format(self, r):
        d = {"level": r.levelname, "msg": r.getMessage(), "request_id": request_id.get()}
        d.update({k: v for k, v in r.__dict__.items() if k not in self._SKIP})
        if r.exc_info:
            d["exc"] = self.formatException(r.exc_info)
        return json.dumps(d, ensure_ascii=False, default=str)

h = logging.StreamHandler(); h.setFormatter(JsonFormatter())
log = logging.getLogger("app"); log.addHandler(h); log.setLevel(logging.INFO)

log.error("request failed", extra={"code": "order_not_found", "status": 404})
```

`exc_info`가 있으면(`log.exception`으로 남길 때) 스택 트레이스도 한 필드로 들어간다. 웹 프레임워크에서는 요청 진입 지점에서 `request_id.set(...)`을 한 번 해 주면 이후 로그에 자동으로 붙는다.

</details>

<details>
<summary>자세한 풀이: 실행해서 확인한 것</summary>

위 예외 클래스, `retry`, 포매터, 문제 응답 변환 코드를 합쳐서 Python으로 직접 돌렸다. 세 번째 호출에서 성공하는 가짜 함수는 재시도 경고 2줄 뒤 `ok`를 냈고, `NotFound`는 재시도 없이 ERROR 로그 1줄과 문제 응답 JSON을 냈다. 지터 값은 실행마다 다르다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: RFC 9457의 멤버와 클라이언트 지침(문서를 열어 읽음). AWS Builders' Library 글의 타임아웃·재시도·백오프·지터·멱등성 요지. 코드 동작(직접 실행).

확인 못 함: 상태 코드별(400, 401, 409, 422, 429, 502 등) 공식 정의와 `Retry-After` 헤더 규정(RFC 9110 본문을 읽지 못함). Python logging 쿡북의 구조화 로깅 절 본문(일부만 열림). OpenTelemetry 같은 로그 표준 필드 규약. AWS 글의 243배 예시의 구체적 조건은 글의 요약으로만 확인.

</details>

## 근거 링크

- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457.html
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter
- (일부만 읽음) Python Logging Cookbook: https://docs.python.org/3/howto/logging-cookbook.html
- (읽지 못함) RFC 9110, HTTP Semantics: https://www.rfc-editor.org/rfc/rfc9110.html

← 개념 지도로

관련 글: [요청이 처리되는 흐름](#/post/be-request-flow) · [비동기 처리와 메시지 큐](#/post/be-async-queue) · 관측 가능성
