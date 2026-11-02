응집도는 한 모듈 안의 요소들이 얼마나 한 가지 목적으로 모여 있는지, 결합도는 모듈끼리 얼마나 서로를 알고 의존하는지다. 좋은 모듈은 응집도가 높고 결합도가 낮다.

## 쉬운 말로

서랍장으로 비유하면 이해가 빨랐다. 한 서랍에 양말만 들어 있으면 응집도가 높은 것이고, 양말·영수증·건전지가 섞여 있으면 낮은 것이다. 결합도는 서랍끼리의 관계다. 양말 서랍을 열려면 건전지 서랍 안쪽 칸을 건드려야 한다면 결합도가 높은 상태다.

코드로 옮기면 이렇다.

- 응집도: 한 클래스·함수·파일 안에서 요소들이 같은 일을 위해 모여 있는 정도. 높을수록 좋다.
- 결합도: 한 모듈을 고칠 때 다른 모듈이 같이 깨지는 정도. 낮을수록 좋다.

둘은 따로 노는 개념이 아니라 거의 같이 움직인다. 한 모듈에 잡다한 일을 몰아 넣으면 응집도가 떨어지고, 그 일을 쓰려는 다른 모듈들이 전부 이 모듈에 매달리게 되니 결합도도 올라간다. 모듈을 나누는 기준을 세울 때 이 두 축이 쓰이는 이유다. 설계 원칙 쪽 이야기는 [자세히 → SOLID](#/post/cs-solid)에서 이어진다.

## 왜 신경 쓰나

고치기 쉬운지가 갈린다. 결합도가 낮으면 모듈 하나를 바꿔도 영향 범위가 좁고, 테스트할 때 가짜 객체로 갈아 끼우기 쉽다. 응집도가 높으면 "이 기능은 이 파일 하나만 보면 된다"가 되어 읽기도 쉽다. 반대로 둘이 나쁘면 한 군데를 고치고 엉뚱한 곳에서 버그가 나는 일이 생긴다. 테스트 쪽은 [자세히 → 테스트](#/post/be-testing)에서 다룬다.

## 응집도 종류

널리 쓰이는 분류이고, 약한 것부터 강한 것 순이다. Wikipedia의 cohesion 항목도 같은 7단계를 든다.

| 단계 | 이름 | 묶인 이유 | 예 |
|---|---|---|---|
| 1 (약함) | 우연적 | 이유가 없음 | `Utils` 클래스에 온갖 함수 |
| 2 | 논리적 | 비슷한 종류라서 | 모든 입력 처리 함수를 한곳에 |
| 3 | 시간적 | 같은 시점에 실행돼서 | 시작할 때 도는 초기화 묶음 |
| 4 | 절차적 | 정해진 순서로 실행돼서 | 권한 확인 후 파일 열기 |
| 5 | 통신적 | 같은 데이터를 다뤄서 | 같은 주문 레코드를 읽고 쓰는 함수들 |
| 6 | 순차적 | 앞 출력이 뒤 입력이라서 | 파싱 → 검증 → 변환 파이프라인 |
| 7 (강함) | 기능적 | 하나의 기능을 위해서 | 세금 계산 함수 하나 |

실무에서 자주 보는 건 맨 위의 `utils`, `common`, `helper` 같은 이름이다. 이름이 뭉뚱그려질수록 우연적 응집이기 쉽다.

## 결합도 종류

이쪽은 강한 것부터 약한 것 순으로 읽는다. 아래는 Wikipedia coupling 항목에 나오는 여섯 가지에, 국내에서 흔히 쓰는 이름(내용·공통·외부·제어·스탬프·자료)을 맞춘 것이다.

| 단계 | 이름 | 내용 |
|---|---|---|
| 1 (강함) | 내용 결합 | 다른 모듈의 내부 코드·데이터를 직접 건드림 |
| 2 | 공통 결합 | 여러 모듈이 같은 전역 데이터를 씀 |
| 3 | 외부 결합 | 외부에서 정해진 데이터 형식·프로토콜·장치에 같이 묶임 |
| 4 | 제어 결합 | 플래그를 넘겨서 상대 동작을 조종함 |
| 5 | 스탬프 결합 | 구조체·객체를 통째로 넘기는데 일부만 씀 |
| 6 (약함) | 자료 결합 | 필요한 값만 인자로 주고받음 |

이 분류에서는 자료 결합이 가장 바람직하다고 본다. 다만 "결합도 0"은 없다. 모듈끼리 아예 안 엮이면 시스템이 되지 않으니, 목표는 없애는 게 아니라 약하고 눈에 보이는 형태로 두는 것이다. 참고로 메시지 결합(큐나 이벤트로 주고받음)을 별도 단계로 두는 자료도 있는데, 내가 연 문서에는 없어서 표에서는 뺐다.

<details>
<summary>각 결합도 예시 코드(펼치기)</summary>

```python
# 공통 결합: 전역 변수를 여러 함수가 같이 씀
config = {"tax": 0.1}
def price_a(x): return x * (1 + config["tax"])
def price_b(x): return x * (1 + config["tax"])   # config가 바뀌면 둘 다 영향

# 제어 결합: mode 값으로 상대 동작을 정함
def process(order, mode):
    if mode == "pay": ...
    elif mode == "cancel": ...

# 스탬프 결합: 객체 전체를 받지만 이름만 씀
def greet(user):            # user에는 필드가 20개
    return "hi " + user.name

# 자료 결합: 필요한 값만 받음
def greet2(name):
    return "hi " + name
```

제어 결합은 호출하는 쪽이 받는 쪽 내부 분기를 알아야 해서 생긴다. `pay`와 `cancel`을 별개 함수로 나누면 플래그가 사라진다.

</details>

## 예시와 개선

주문 서비스를 예로 들어 봤다. 먼저 결합도가 높은 쪽이다.

```python
class OrderServiceBad:
    def __init__(self):
        self.repo = MySqlRepo()   # 구체 클래스를 안에서 직접 만듦
        self.mailer = Mailer()
    def place(self, order):
        self.repo.save(order)
        self.mailer.send("a@b.c", "ok")
```

DB를 바꾸거나 테스트에서 메일을 막으려면 이 클래스를 열어서 고쳐야 한다. 서비스가 `MySqlRepo`와 `Mailer`의 존재와 생성 방법까지 알고 있기 때문이다. 개선은 만드는 일을 밖으로 빼고 필요한 것만 받는 것이다.

```python
class OrderService:
    def __init__(self, repo, notifier):   # 의존을 밖에서 주입
        self.repo, self.notifier = repo, notifier
    def place(self, order):
        self.repo.save(order)
        self.notifier.send("a@b.c", "ok")
```

이제 가짜 저장소·가짜 알림을 넣어 테스트할 수 있다. 아래처럼 직접 돌려 보니 통과했다.

```python
class FakeRepo:
    def __init__(self): self.saved = []
    def save(self, o): self.saved.append(o)
class FakeNotifier:
    def __init__(self): self.sent = []
    def send(self, to, body): self.sent.append((to, body))

r, n = FakeRepo(), FakeNotifier()
OrderService(r, n).place({"id": 1})
assert r.saved == [{"id": 1}] and n.sent == [("a@b.c", "ok")]
```

이렇게 의존을 밖에서 넣어 주는 방식이 의존성 주입(DI)이다. 컨트롤러·서비스·리포지토리를 나눌 때 각 층이 아래층의 구체 구현이 아니라 약속(인터페이스)만 보게 하는 것도 같은 생각이다. [자세히 → 레이어드 아키텍처](#/post/be-layered-architecture)에서 이어서 본다. 요청이 이 모듈들을 거쳐 가는 길은 [자세히 → 요청 흐름](#/post/be-request-flow)에 있다.

응집도 쪽 개선은 이름 붙이기에서 시작하는 편이 쉬웠다. 모듈 이름을 한 문장으로 설명할 수 없거나, 설명에 "그리고"가 들어가면 일이 둘 이상 섞인 신호다. `OrderUtils`를 `PriceCalculator`, `OrderValidator`로 쪼개면 각각이 기능적 응집에 가까워진다.

## 흔한 오해

- 결합도는 낮을수록 무조건 좋다: 낮추려고 인터페이스와 계층을 겹겹이 만들면 오히려 따라가기 어려워진다. 바뀔 가능성이 낮은 곳까지 추상화하면 과하다.
- 응집도가 높으면 클래스가 작다: 크기와는 별개다. 줄 수가 많아도 한 가지 일이면 응집도가 높다.
- 모듈을 잘게 쪼갤수록 좋다: 한 기능이 파일 열 개에 흩어지면 그 기능을 바꿀 때 열 군데를 봐야 한다. 응집이 깨진 것이다.
- 분류표가 실무 기준 그대로다: 분류표는 사고를 정리하는 도구다. 실무에서는 "이 모듈을 바꿀 때 몇 군데를 같이 고치나"를 보는 쪽이 빨랐다.

## 근거 링크

- [Coupling (computer programming) - Wikipedia](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
- [Cohesion (computer science) - Wikipedia](https://en.wikipedia.org/wiki/Cohesion_(computer_science))

← [개념 map으로](#/post/be-map)

관련 글: [레이어드 아키텍처](#/post/be-layered-architecture) · [SOLID](#/post/cs-solid) · [테스트](#/post/be-testing)
