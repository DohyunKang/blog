레이어드 아키텍처는 코드를 맡은 일에 따라 층으로 나누고, 위층이 아래층만 부르게 하는 구조다. 백엔드에서 가장 흔한 컨트롤러·서비스·리포지토리 구조가 이 모양이다.

## 뭘 하는 구조인가

요청 하나가 들어오면 하는 일이 섞여 있다. 요청을 읽고, 값이 맞는지 보고, 규칙을 적용하고, DB에 읽고 쓰고, 응답을 만든다. 이걸 함수 하나에 다 넣으면 처음엔 빠르지만 금방 뒤엉킨다. 그래서 일의 종류별로 층을 나눈다.

| 층 | 맡은 일 | 흔한 이름 |
|---|---|---|
| 표현(프레젠테이션) | HTTP 요청 받기, 입력 형식 확인, 응답 만들기 | 컨트롤러, 라우터, 핸들러 |
| 도메인(비즈니스) | 규칙·검증·계산, 여러 작업을 한 단위로 묶기 | 서비스 |
| 데이터 접근 | DB·외부 저장소 읽고 쓰기 | 리포지토리, DAO |

Martin Fowler의 글은 이걸 표현 / 도메인 / 데이터 접근 세 덩어리로 나눈다. 층은 논리적인 구분이라 한 서버 안에 다 있어도 되고, 물리적으로 나눠 띄워도 된다고 한다. 서버를 나누는 얘기(tier)와는 별개다.

## 의존 방향이 핵심이다

층을 나눴다고 레이어드가 되는 건 아니다. 위에서 아래로만 부른다는 규칙이 있어야 한다.

```
컨트롤러 → 서비스 → 리포지토리 → DB
```

컨트롤러는 서비스를 알고, 서비스는 리포지토리를 안다. 반대는 안 된다. 리포지토리가 컨트롤러를 부르거나, 서비스가 HTTP 요청 객체를 직접 만지면 층을 나눈 의미가 사라진다. 서비스에 HTTP 개념이 섞이면 같은 로직을 CLI나 배치에서 못 쓴다.

Fowler 글에는 변형도 나온다. 도메인과 데이터 사이에 매퍼를 두어 도메인이 저장소를 직접 알지 못하게 하는 방식이고, 이게 흔히 헥사고날 아키텍처라 불리는 모양이라고 한다. 이 글의 그림은 기본형 위주로 본다.

## 왜 나누나

Fowler가 꼽는 가장 큰 이유는 "신경 써야 할 범위가 줄어든다"는 것이다. 한 층을 볼 때 나머지는 거의 무시해도 된다. 그 밖에 이런 이점이 있다.

- 테스트: 규칙이 서비스에 모여 있으면 HTTP나 DB 없이 규칙만 테스트할 수 있다. 리포지토리 자리에 가짜 객체를 끼우면 빠르다. [자세히 → 테스트](#/post/be-testing)
- 교체: 같은 서비스를 웹, 모바일 API, CLI가 같이 쓸 수 있다. 다만 Fowler도 DB를 갈아 끼우는 일은 실제로는 드물다고 적는다.
- 역할 분리: 입력 확인 실수, 규칙 실수, 쿼리 실수가 어느 층 문제인지 찾기 쉽다.

## 예시 코드

주문을 넣는 작은 예를 Python으로 짰다. 주문 합계가 한도를 넘으면 거절하는 규칙이다.

```python
import sqlite3
from dataclasses import dataclass

@dataclass
class Order:
    id: int | None
    user_id: int
    amount: int

class OrderRepository:                      # 데이터 접근
    def __init__(self, conn):
        self.conn = conn
    def save(self, o: Order) -> Order:
        cur = self.conn.execute(
            "INSERT INTO orders(user_id, amount) VALUES (?, ?)", (o.user_id, o.amount))
        return Order(cur.lastrowid, o.user_id, o.amount)
    def total_of(self, user_id: int) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM orders WHERE user_id=?", (user_id,)).fetchone()
        return row[0]

class OrderError(Exception):
    pass

class OrderService:                         # 규칙 + 트랜잭션 경계
    LIMIT = 100_000
    def __init__(self, repo, conn):
        self.repo, self.conn = repo, conn
    def place(self, user_id: int, amount: int) -> Order:
        if amount <= 0:
            raise OrderError("amount must be positive")
        with self.conn:                     # 한 트랜잭션
            if self.repo.total_of(user_id) + amount > self.LIMIT:
                raise OrderError("limit exceeded")
            return self.repo.save(Order(None, user_id, amount))

def post_order(service, body: dict):        # 표현: HTTP와 에러 코드만 안다
    try:
        o = service.place(body["user_id"], body["amount"])
        return 201, {"id": o.id}
    except OrderError as e:
        return 400, {"error": str(e)}
```

직접 돌려 보니 6만 원 주문은 `201`, 이어서 5만 원 주문은 한도 초과로 `400`, 음수 금액도 `400`이 나왔다. 리포지토리 자리에 메모리 리스트로 만든 가짜 객체를 넣어도 서비스가 그대로 돌았다. 이게 층을 나눠서 얻는 이점이다. 다만 실제 웹 프레임워크에 붙여 돌려 본 건 아니다.

층마다 누가 무엇을 아는지 정리하면 이렇다.

| 층 | 아는 것 | 모르는 것 |
|---|---|---|
| 컨트롤러 | HTTP 상태 코드, 요청 형식 | SQL, 저장 방식 |
| 서비스 | 규칙, 어떤 작업을 한 묶음으로 할지 | HTTP, 구체적인 DB |
| 리포지토리 | 쿼리, 테이블 | 왜 이 데이터를 읽는지 |

## 트랜잭션은 어느 층에 두나

여러 저장 작업을 한 묶음으로 처리해야 할 때 그 경계는 보통 서비스에 둔다. 리포지토리 메서드 하나는 쿼리 하나만 하고, 어디까지가 한 단위인지는 규칙을 아는 서비스가 정하기 때문이다. 위 예시의 `with self.conn:`이 그 자리다.

Spring 문서의 예시도 `@Transactional`을 서비스 클래스에 단다. 문서가 명시적으로 "서비스 층에 두라"고 쓴 건 아니고 예시가 그런 모양이다. 문서가 분명히 적은 건 인터페이스 말고 구체 클래스에 달라는 것이다. AspectJ 모드에서는 인터페이스에 단 어노테이션이 인식되지 않아 롤백 테스트 전까진 멀쩡해 보이다가 조용히 무시될 수 있다고 한다.

## 언제 과한가

레이어드가 항상 좋은 건 아니다.

- 서비스가 컨트롤러에서 받은 걸 리포지토리에 그대로 넘기기만 하는 경우가 있다. 규칙이 없는데 층만 있으면 코드가 늘고 읽을 때 파일만 왔다 갔다 한다. 작은 CRUD 앱에서 자주 나오는 모양이다.
- 층마다 같은 데이터를 담는 객체(DTO, 엔티티)를 따로 만들고 매번 옮겨 담으면 보일러플레이트가 는다.
- 규칙이 모두 서비스에 몰리고 도메인 객체는 필드만 들고 있는 구조를 흔히 "빈약한 도메인 모델(anemic domain model)"이라 부른다. 이 용어는 Fowler가 쓴 글로 알려져 있다.

Fowler 글은 과한 층에 대해 직접 경고하진 않지만, 커지는 시스템에서 레이어를 최상위 구분으로 쓰면 문제가 되니 도메인별로 나누고 그 안에서 층을 두라고 한다. 또 개발팀을 층별로(프론트팀, 백엔드팀, DB팀) 나누는 건 안티패턴이라고 적는다.

기준을 하나 정해 본다면, 규칙이 몇 줄이라도 있으면 서비스를 두고, 규칙이 전혀 없는 읽기 전용 API라면 층을 줄여도 된다고 생각한다. 이건 내 판단이고 출처가 있는 말은 아니다.

## 흔한 오해

- 층이 많을수록 좋다: 층은 일이 구분될 때 의미가 있다. 빈 층은 비용이다.
- 층은 서버 대수다: 층은 코드의 논리적 구분이고 서버 대수(tier)와는 다른 얘기다.
- 컨트롤러에 규칙을 써도 돌아가니 괜찮다: 돌아가긴 하지만 같은 규칙을 다른 진입점(배치, 큐 소비자)에서 다시 써야 한다.
- 리포지토리는 테이블마다 하나다: 흔히 그렇게 쓰지만 규칙은 아니다. 묶음 단위(예: 주문과 주문 항목)로 두기도 한다.

<details>
<summary>자세한 풀이: 요청 한 번이 층을 지나가는 순서</summary>

1. 컨트롤러가 JSON 본문을 읽고 필수 필드가 있는지, 타입이 맞는지 본다. 틀리면 400.
2. 서비스를 호출한다. 서비스는 금액이 양수인지, 한도를 넘지 않는지 같은 규칙을 본다. 규칙 위반은 예외로 올린다.
3. 서비스가 트랜잭션을 열고 리포지토리로 합계를 읽고 저장한다.
4. 예외가 나면 트랜잭션이 되돌려지고, 컨트롤러가 예외 종류에 맞는 상태 코드로 바꿔 응답한다.

여기서 예외를 HTTP 코드로 바꾸는 일은 표현 층 몫으로 둔다. 서비스가 `400`을 직접 말하면 서비스가 HTTP를 알게 된다. 에러를 다루는 방식은 따로 정리한다. [자세히 → 에러 처리와 로깅](#/post/be-error-logging)

</details>

## 같이 보면 좋은 글

- [자세히 → 요청이 서버에서 처리되는 흐름](#/post/be-request-flow)
- [자세히 → 결합도와 응집도](#/post/be-coupling-cohesion)
- [자세히 → SOLID](#/post/cs-solid)
- [자세히 → 디자인 패턴](#/post/cs-design-patterns)

← [개념 map으로](#/post/be-map)

## 근거 링크

- Martin Fowler, PresentationDomainDataLayering: https://martinfowler.com/bliki/PresentationDomainDataLayering.html
- Spring Framework 문서, Using @Transactional: https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html
- Martin Fowler, AnemicDomainModel: https://martinfowler.com/bliki/AnemicDomainModel.html
