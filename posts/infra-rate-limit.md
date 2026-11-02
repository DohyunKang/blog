레이트 리밋은 일정 시간 동안 받아 주는 요청 수에 상한을 두고, 넘으면 처리하지 않고 돌려보내는 장치다. 서버를 지키려는 목적이 첫째고, 한 사용자가 자원을 독차지하지 못하게 하는 게 둘째다.

## 왜 필요한가

서버가 처리할 수 있는 양은 정해져 있는데 요청은 한꺼번에 몰릴 수 있다. 버그 난 스크립트가 무한 루프로 API를 두드릴 수도 있고, 이벤트로 진짜 사용자가 몰릴 수도 있다. 아무 제한이 없으면 한 명의 폭주가 나머지 전원의 응답을 느리게 만든다.

Stripe가 2017년에 쓴 글에는 이런 얘기가 나온다. 제일 중요한 제한은 사용자별 초당 요청 수 제한이었고, 한 달에 수백만 건을 거절했는데 대부분 테스트 모드에서 돌던 폭주 스크립트였다고 한다. 악의적인 공격보다 실수로 돌아간 코드가 더 흔했다는 얘기다. 숫자는 그 글이 쓰인 시점 기준이다.

요청이 몰리는 걸 서버 대수로 해결하는 방법([자세히 → 오토스케일링](#/post/infra-autoscaling))도 있지만, 서버가 늘어나는 데는 시간이 걸리고 돈도 든다. 레이트 리밋은 그 사이를 버티게 해 주는 쪽이다. 요청을 어디로 나눠 보내는지는 [로드 밸런서](#/post/infra-load-balancer) 글에 따로 적었다.

## 어디서 세나

보통 기준은 셋 중 하나다.

| 기준 | 세는 대상 | 특징 |
|---|---|---|
| IP | 요청을 보낸 주소 | 로그인 전에도 쓸 수 있지만, 한 회사 망이 같은 IP로 보이면 억울하게 막힌다 |
| 사용자/API 키 | 인증된 계정 | 가장 공정하다. 인증 뒤에서만 가능하다 |
| 엔드포인트 | 특정 경로 | 로그인·결제처럼 무거운 곳만 더 빡빡하게 건다 |

RFC 6585는 429를 정의하면서, 서버가 사용자를 어떻게 식별하고 요청을 어떻게 세는지는 정하지 않는다고 적는다. 인증 정보나 쿠키로 식별할 수 있고, 리소스별·서버 전체·여러 서버 합산 모두 가능하다고만 되어 있다. 그러니까 기준은 서비스가 정하는 거다.

여러 서버가 있으면 카운터를 서버마다 따로 두면 안 된다. 서버 3대가 각자 "초당 10개"를 허용하면 사용자는 사실상 30개를 보낼 수 있다. 그래서 카운터는 보통 서버들이 같이 보는 곳에 둔다. Stripe는 토큰 버킷을 Redis 위에 구현했다고 적었다. 이 부분은 [Redis 캐시](#/post/db-cache-redis) 글과 이어진다.

## 알고리즘 세 가지

### 고정 윈도우

시간을 10초 같은 칸으로 자르고 칸마다 카운터를 둔다. 10초에 5개까지 허용이면, 칸이 바뀔 때 카운터를 0으로 되돌린다. 구현이 제일 쉽다.

약점은 칸 경계다. 9.9초에 5개, 10.0초에 5개를 보내면 각 칸 기준으로는 둘 다 허용인데, 실제로는 0.1초 안에 10개가 들어간다. 아래에서 직접 돌려 확인했다.

### 슬라이딩 윈도우

"지금부터 거꾸로 10초 안에 몇 개 왔나"를 센다. 요청 시각을 전부 기록해 두는 방식(슬라이딩 로그)은 정확하지만 요청마다 기록을 들고 있어야 해서 메모리를 쓴다. 경계 문제가 없는 대신 비용이 든다.

### 토큰 버킷

가장 많이 보이는 방식이다. 버킷에 토큰이 최대 N개 들어 있고, 일정 속도로 토큰이 다시 채워진다. 요청 하나가 오면 토큰 하나를 꺼내고, 버킷이 비어 있으면 거절한다. 사용자마다 버킷이 하나씩 있다.

파라미터가 둘이다. 용량(capacity)은 한 번에 받아 줄 수 있는 버스트의 크기이고, 채우는 속도(refill rate)는 오래 지속했을 때의 평균 속도다. 용량 5, 초당 1개로 잡으면 평소엔 초당 1개씩 가다가, 한동안 쉬었다 오면 한꺼번에 5개까지는 받아 준다. 사용자들은 조용히 있다가 한 번에 몰아서 보내는 일이 많아서, 이 성질이 현실과 잘 맞는다.

<details>
<summary>세 방식을 Python으로 돌려 본 것</summary>

```python
from collections import deque

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=0.0):
        self.capacity, self.rate = capacity, refill_per_sec
        self.tokens, self.last = float(capacity), now
    def allow(self, now, cost=1):
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

class FixedWindow:
    def __init__(self, limit, window):
        self.limit, self.window = limit, window
        self.start, self.count = 0.0, 0
    def allow(self, now):
        if now - self.start >= self.window:
            self.start = now - (now % self.window); self.count = 0
        if self.count < self.limit:
            self.count += 1; return True
        return False

class SlidingLog:
    def __init__(self, limit, window):
        self.limit, self.window, self.log = limit, window, deque()
    def allow(self, now):
        while self.log and self.log[0] <= now - self.window:
            self.log.popleft()
        if len(self.log) < self.limit:
            self.log.append(now); return True
        return False
```

실행 결과는 이랬다.

- 토큰 버킷(용량 5, 초당 1개): 시각 0에 10개를 한꺼번에 보내면 5개만 통과. 3초 뒤에 5개를 보내면 앞의 3개만 통과.
- 10초에 5개 제한, 9.9초에 5개 + 10.0초에 5개: 고정 윈도우는 0.1초 안에 10개 허용, 슬라이딩 로그는 5개만 허용.

토큰을 시간 흐름에 따라 "한꺼번에 계산해서" 채운다는 점이 구현의 요령이다. 타이머로 토큰을 하나씩 넣는 게 아니라, 요청이 올 때 마지막 시각과의 차이만큼 더한다. 그래서 사용자 수만큼 타이머를 돌릴 필요가 없다.

</details>

## 429와 클라이언트가 할 일

거절할 때는 HTTP 429 Too Many Requests를 돌려주는 게 표준이다. MDN은 "클라이언트가 주어진 시간 동안 너무 많은 요청을 보냈다"는 뜻이라고 설명한다. 응답에 `Retry-After` 헤더를 붙이면 얼마 뒤에 다시 보내라고 알려 줄 수 있다. 값은 초 단위 숫자일 수도 있고 HTTP 날짜일 수도 있어서 클라이언트가 둘 다 읽어야 한다. RFC 6585에서 이 헤더는 붙여도 되는 선택 사항이다.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

받는 쪽이 429를 받고 곧바로 다시 보내면 상황이 더 나빠진다. 그래서 재시도에는 규칙이 필요하다. AWS Builders' Library의 글이 정리한 내용은 이렇다.

- 재시도는 이미 힘든 시스템에 요청을 더 얹는다. 문제가 고쳐진 뒤에도 부하를 높게 붙잡아 회복을 늦출 수 있다.
- 단계마다 재시도하면 곱해진다. 5개 계층이 각각 3번씩 재시도하면 맨 아래 DB는 243배 부하를 받을 수 있다. 그래서 한 지점에서만 재시도하라고 권한다.
- 지수 백오프(대기 시간을 점점 늘림)에 상한과 횟수 제한을 둔다.
- 지터(jitter), 즉 무작위 편차를 더한다. 같은 순간에 실패한 클라이언트들이 같은 간격으로 물러나면 같은 순간에 다시 몰린다.
- 재시도에도 토큰 버킷을 쓴다. 토큰이 있는 동안만 재시도하고, 떨어지면 느린 속도로만 한다. AWS SDK에 2016년에 들어갔다고 한다.
- 부작용이 있는 호출은 멱등하지 않으면 재시도가 위험하다.

지터가 얼마나 차이 나는지 시뮬레이션해 봤다. 100개 클라이언트가 같은 순간에 실패해서 세 번째 시도(대기 4초)를 한다고 하면, 지터가 없을 땐 한 초에 100개가 몰렸고 0~4초 사이 무작위로 했을 땐 한 초 최대 27개였다. 난수 시드를 고정한 한 번의 실험이라 정확한 숫자보다 방향만 본 것이다.

## 막는 것 말고 줄 세우는 것

레이트 리밋은 넘치는 요청을 버린다. 버리면 안 되는 일은 다르게 다뤄야 한다.

- 큐잉: 요청을 바로 처리하지 않고 큐에 넣고 워커가 자기 속도로 꺼내 처리한다. 사용자는 접수만 되고 결과는 나중에 받는다. 이 구조는 [비동기 큐](#/post/be-async-queue) 글에 있다.
- 백프레셔(backpressure): 처리하는 쪽이 느려지면 그 사실을 앞쪽에 전달해서 보내는 속도를 낮추게 하는 것. 큐가 가득 차면 새 요청을 거절하거나 생산자를 기다리게 한다. 큐가 한없이 길어지면 지연만 늘어나므로 길이에도 상한이 필요하다.
- 동시 요청 제한: 초당 몇 개가 아니라 지금 처리 중인 요청이 몇 개인지를 센다. Stripe는 CPU를 많이 쓰는 엔드포인트에서 재시도가 겹쳐 생기는 경합을 막으려고 이걸 썼다.
- 부하 차단(load shedding): 서버 전체가 한계에 가까워지면 중요한 요청 몫을 남겨 두고 덜 중요한 것부터 버린다. Stripe 글에서는 결제 생성 같은 핵심 호출용으로 일부 용량을 따로 잡아 두고, 목록 조회 같은 덜 중요한 호출은 넘치면 503으로 돌려보냈다고 한다.

Stripe는 이 네 가지(요청 속도, 동시 요청, 서비스 전체 부하 차단, 워커 사용률 기준 차단)를 겹쳐 쓴다고 적는다. 하나로 다 막으려 하지 않고 층을 나눈 거다.

## 흔한 오해

- 429는 서버 장애가 아니다. 서버는 멀쩡하고 클라이언트가 할당량을 넘긴 것이다. 장애 때는 5xx가 나온다. 다만 서버가 자기 보호를 위해 일부러 보내는 503은 클라이언트 입장에서 비슷해 보인다.
- 레이트 리밋이 있으면 DDoS가 막힌다는 건 과한 기대다. 앱 서버까지 온 요청을 세는 거라 그 앞에서 네트워크가 먼저 막혀 버리는 공격에는 소용이 없고, 그런 건 더 앞단에서 처리한다. 이 글에서 확인한 범위 밖이라 자세히는 못 적는다.
- IP만 세면 충분하다는 것도 아니다. 같은 망의 사용자가 한 IP로 묶이고, 공격자는 IP를 바꾼다.
- 한도는 한 번 정하고 끝이 아니다. 너무 낮으면 정상 사용자가 막히고 너무 높으면 소용이 없어서, 실제 트래픽을 보면서 조정해야 한다.
- LLM API처럼 토큰 수로 한도를 거는 서비스도 있다. 요청 수 대신 토큰을 비용으로 삼는 건 토큰 버킷의 `cost` 인자와 같은 생각이다. 비용 쪽 얘기는 [AI 앱 원가](#/post/app-cost)에 있다.

## 근거 링크

- Stripe, Scaling your API with rate limiters (2017): https://stripe.com/blog/rate-limiters
- MDN, 429 Too Many Requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
- RFC 6585 section 4: https://www.rfc-editor.org/rfc/rfc6585#section-4
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter

← [개념 map으로](#/post/infra-map)

관련 글: [로드 밸런서](#/post/infra-load-balancer) · [오토스케일링](#/post/infra-autoscaling) · [비동기 큐](#/post/be-async-queue)
