로드밸런서는 서버 여러 대 앞에 서서 들어온 요청을 나눠 주고, 죽은 서버로는 보내지 않게 막아 주는 장치다. 서버를 늘려도 클라이언트는 주소 하나만 알면 되는 이유가 이거다.

## 로드밸런서가 하는 일

서버가 한 대면 그 서버가 죽는 순간 서비스도 같이 죽는다. 두 대로 늘리면 누가 요청을 어느 서버로 보낼지 정해야 한다. 이 역할을 맡는 게 로드밸런서다. 하는 일은 크게 둘이다.

- 요청을 여러 서버에 나눈다.
- 서버 상태를 확인해서 멀쩡한 서버로만 보낸다.

AWS 문서도 같은 식으로 설명한다. 로드밸런서는 클라이언트 요청을 받아 등록된 대상(target)으로 보내고, 대상의 상태를 계속 보다가 비정상이면 트래픽을 끊고 정상으로 돌아오면 다시 보낸다. 요청이 서비스 전체에서 어디를 지나가는지는 [자세히 → 요청 하나가 거치는 길](#/post/infra-request-journey)에 정리해 뒀고, 여기서는 그 중 로드밸런서 칸만 본다.

## L4와 L7

로드밸런서는 어느 계층에서 보느냐로 나뉜다. 네트워크 계층 이름이 낯설면 [자세히 → 네트워크 기초](#/post/cs-network)를 먼저 봐도 된다.

| 구분 | L4 (전송 계층) | L7 (애플리케이션 계층) |
|---|---|---|
| 보는 것 | IP, 포트, TCP 연결 | HTTP 경로, 호스트, 헤더, 쿠키 |
| 분산 단위 | 연결 하나 | 요청 하나 |
| 할 수 있는 것 | 빠르게 연결만 나눈다 | `/api`는 A 서버군, `/img`는 B 서버군 같은 규칙 |
| AWS 이름 | Network Load Balancer | Application Load Balancer |

AWS 문서 기준으로 NLB는 프로토콜, 출발지 IP·포트, 목적지 IP·포트, TCP 시퀀스 번호로 flow hash를 만들어 대상을 고르고, 한 번 맺은 TCP 연결은 끝날 때까지 같은 대상으로 간다. ALB는 리스너 규칙을 우선순위대로 평가해서 어느 규칙을 쓸지 정하고, 그 규칙의 대상 그룹 안에서 대상을 고른다. 기본 알고리즘은 라운드 로빈이다.

L7은 요청 내용을 읽을 수 있어서 똑똑하지만 그만큼 일을 더 한다. 어느 쪽이 낫다는 얘기보다는 경로별로 서버를 나눌 필요가 있느냐가 기준으로 보인다. 그냥 연결만 빠르게 나누면 되면 L4, 주소 규칙이 필요하면 L7이다.

## 분산 알고리즘

요청을 어떻게 나눌지는 알고리즘이 정한다. nginx 문서에 나온 방식을 기준으로 정리했다.

| 방식 | 동작 |
|---|---|
| 라운드 로빈 | 순서대로 돌아가며 보낸다. nginx 기본값 |
| 가중치(weight) | 서버마다 몫을 다르게 준다. `weight=3`이면 5번 중 3번이 그 서버로 간다 |
| 최소 연결(least_conn) | 지금 처리 중인 연결이 가장 적은 서버로 보낸다 |
| IP 해시(ip_hash) | 클라이언트 IP로 해시를 만들어 같은 사람은 같은 서버로 보낸다 |
| 최소 시간(least_time) | 평균 응답 시간이 짧고 연결이 적은 서버를 고른다 |

라운드 로빈은 단순해서 서버 성능과 요청 무게가 비슷할 때 잘 맞는다. 문제는 요청마다 걸리는 시간이 들쭉날쭉할 때다. 무거운 요청이 한 서버에 몰려도 라운드 로빈은 그걸 모르고 차례만 지킨다.

### 직접 돌려 본 것

차이를 눈으로 보고 싶어서 아주 단순한 시뮬레이션을 짰다. 요청은 초당 약 60개가 들어오고, 5%는 1.5초 걸리는 무거운 요청이고 나머지는 0.02초다. 서버 0번은 다른 서버보다 4배 느리게 설정했다. 각 서버가 동시에 들고 있던 요청 수의 최댓값을 봤다.

<details>
<summary>시뮬레이션 코드 (python으로 실행해서 확인함)</summary>

```python
import heapq, random, itertools

class RoundRobin:
    def __init__(self, n):
        self.cycle = itertools.cycle(range(n))
    def pick(self, active):
        return next(self.cycle)

class LeastConn:
    def pick(self, active):
        return min(range(len(active)), key=lambda i: active[i])

def simulate(lb, n_servers=3, n_req=3000, seed=1):
    rnd = random.Random(seed)
    active = [0] * n_servers
    done = []  # (finish_time, server)
    peak = [0] * n_servers
    t = 0.0
    for _ in range(n_req):
        t += rnd.expovariate(60)           # 초당 약 60개 도착
        while done and done[0][0] <= t:
            _, s = heapq.heappop(done)
            active[s] -= 1
        s = lb.pick(active)
        active[s] += 1
        peak[s] = max(peak[s], active[s])
        # 요청 처리 시간: 대부분 짧고 가끔 아주 김, 0번 서버는 4배 느림
        dur = (1.5 if rnd.random() < 0.05 else 0.02) * (4 if s == 0 else 1)
        heapq.heappush(done, (t + dur, s))
    return peak

print("round robin peak:", simulate(RoundRobin(3)))
print("least conn  peak:", simulate(LeastConn()))
```

</details>

결과는 이랬다.

```
round robin peak: [16, 7, 6]
least conn  peak: [7, 6, 6]
```

라운드 로빈에서는 느린 0번 서버에 요청이 16개까지 쌓였고, 최소 연결은 7개에서 막았다. 같은 서버 세 대인데 느린 서버가 섞이면 이렇게 갈린다. 다만 이건 내가 임의로 정한 숫자로 돌린 장난감 모델이라 실제 서비스 수치는 아니다. 방향만 보면 된다.

참고로 AWS Classic Load Balancer는 TCP 리스너에는 라운드 로빈, HTTP·HTTPS 리스너에는 최소 처리 중 요청(least outstanding requests)을 쓴다고 문서에 적혀 있다. 요청이 긴 쪽은 연결 수를 보는 방식이 기본값이 되는 셈이다.

## 헬스 체크

아무리 잘 나눠도 죽은 서버로 보내면 소용없다. 그래서 로드밸런서는 서버가 살아 있는지 계속 확인한다. 방식은 둘로 나뉜다.

- 능동(active): 로드밸런서가 주기적으로 `/health` 같은 주소를 직접 찔러 본다.
- 수동(passive): 실제 요청을 보내 보고 실패하면 그 서버를 문제로 표시한다.

nginx 오픈소스 문서에 나오는 건 수동 방식이다. `max_fails`는 `fail_timeout` 시간 안에 연속 실패가 몇 번이면 서버를 실패로 볼지 정하는 값이고 기본은 1이다. `max_fails=3 fail_timeout=30s`로 두면 30초 안에 3번 실패했을 때 그 서버를 30초 동안 뺀다. 시간이 지나면 실제 클라이언트 요청으로 조금씩 시험해 보고, 성공하면 다시 살아 있는 것으로 돌린다. 수동 방식은 실패한 요청이 최소 한 번은 사용자에게 간다는 점이 걸린다.

헬스 체크용 주소는 어디까지 확인할지가 고민거리다. 프로세스가 떠 있는지만 보면 DB가 끊겨도 정상으로 나오고, DB까지 확인하면 DB 한 번 흔들릴 때 서버 전체가 한꺼번에 빠질 수 있다. 어느 쪽이 맞다고 못 박기보다 서비스마다 정하는 문제로 보인다.

## 세션 고정

로그인 상태를 서버 메모리에 들고 있으면 문제가 생긴다. 요청이 A 서버에서 B 서버로 넘어가는 순간 B는 그 사람을 모른다. nginx 문서도 라운드 로빈과 최소 연결은 같은 클라이언트가 같은 서버로 가는 걸 보장하지 않는다고 적는다.

해결 방법은 둘이다.

1. 세션 고정(sticky session): 같은 사용자를 같은 서버로 계속 보낸다. nginx의 `ip_hash`가 한 예고, 문서 기준으로 해당 서버가 쓸 수 없을 때를 빼면 같은 클라이언트는 같은 서버로 간다. AWS ALB에도 sticky 설정이 있는 것으로 알려져 있다.
2. 서버를 상태 없이 만든다: 세션을 Redis 같은 바깥 저장소에 두면 어느 서버로 가도 같은 정보를 읽는다. [자세히 → Redis와 캐시](#/post/db-cache-redis) 참고.

세션 고정은 쉽지만 부작용이 있다. IP 해시를 쓰면 회사 같은 공용 IP 뒤의 많은 사람이 한 서버로 몰릴 수 있고, 그 서버가 죽으면 거기 붙어 있던 세션이 날아간다. 서버를 늘리고 줄이는 일이 잦다면 상태 없는 쪽이 편하다. 이 얘기는 [자세히 → 오토스케일링과 확장](#/post/infra-autoscaling)에서 이어진다.

## 여러 존에 걸칠 때

AWS 문서에는 가용 영역(AZ)마다 로드밸런서 노드가 생긴다고 나온다. ALB는 AZ를 두 개 이상 켜야 한다. 이때 cross-zone 설정이 분산 비율을 바꾼다. 문서 예시는 A존에 대상 2개, B존에 대상 8개가 있는 경우다.

| 설정 | A존 대상 각각 | B존 대상 각각 |
|---|---|---|
| cross-zone 켬 | 10% | 10% |
| cross-zone 끔 | 25% | 6.25% |

각 노드가 클라이언트 트래픽의 50%씩 받는 상태에서, 끄면 자기 존 안에서만 나누기 때문에 대상이 적은 존의 서버가 더 많이 맞는다. 문서 기준으로 ALB는 로드밸런서 수준에서 항상 켜져 있고, NLB는 기본이 꺼져 있다.

## 흔한 오해

- 로드밸런서를 두면 고가용성이 저절로 생긴다고 생각하기 쉽다. 로드밸런서 자체가 한 대면 거기가 단일 장애점이다. AWS는 로드밸런서 노드를 여러 AZ에 둬서 이 문제를 줄인다고 설명한다.
- 라운드 로빈이면 부하가 고르게 나뉜다고 생각하기 쉽다. 요청 개수는 고르지만 요청 무게는 고르지 않다. 위 시뮬레이션이 그 예다.
- 로드밸런서가 있으면 속도가 빨라진다고 보기도 한다. 서버를 여러 대 쓸 수 있게 해 줄 뿐, 요청 하나의 처리 시간은 그대로다. 한쪽으로 쏠리는 걸 막으면 느려지는 걸 줄여 줄 수는 있다.
- 로드밸런서와 레이트 리밋은 다른 일이다. 요청을 나누는 것과 너무 많은 요청을 막는 것은 별개고, 후자는 [자세히 → 레이트 리밋과 트래픽 제어](#/post/infra-rate-limit)에서 다룬다.

## 근거 링크

- nginx, Using nginx as HTTP load balancer: https://nginx.org/en/docs/http/load_balancing.html
- AWS, How Elastic Load Balancing works: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html

← [개념 지도로](#/post/infra-map)

관련 글: [요청 하나가 거치는 길](#/post/infra-request-journey) · [오토스케일링과 확장](#/post/infra-autoscaling) · [CDN과 캐싱 계층](#/post/infra-cdn-cache)
