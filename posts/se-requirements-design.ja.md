[Overview](#/post/cs-sw-engineering) 에서 요구사항, UML, 설계를 한 줄씩만 훑었다. 여기서는 그 셋이 어떻게 이어지는지를 조금 더 파고든다. 요구사항은 "무엇을", 설계는 "어떤 모양으로"에 대한 답이고, 설계가 요구사항 쪽으로 거꾸로 확인되지 않으면 둘은 따로 논다.

## Requirements Analysis Tasks

요구사항 단계는 받아 적기가 아니라 정리하는 일에 가깝다. 이해관계자마다 말이 다르고, 같은 단어를 다른 뜻으로 쓰고, 말하지 않은 전제가 있다. 그래서 흔히 도출 (듣기) → 분석 (충돌·빠짐 찾기) → 명세 (문서로 적기) → 검증 (이해관계자가 확인) 순으로 돌린다.

기능 요구사항과 비기능 요구사항의 구분은 개요에서 다뤘다. 한 가지만 더 보면, 기능은 "시스템이 ~한다", 비기능은 "시스템이 ~하다"의 모양이다. 위키피디아의 설명대로 비기능 요구사항은 품질 속성이라고도 부르고, 구체적이고 측정 가능하게 적어야 한다. 같은 예를 들면, 레코드 수를 보여 주는 건 기능이고 그 수가 얼마나 최신이어야 하는지는 비기능이다.

비기능 요구사항은 아키텍처를 고르는 기준이 된다. 뒤에 나올 아키텍처 스타일을 고를 때도 이 품질 속성의 우선순위부터 정하라고 한다.

### Writing Functional Requirements via Use Cases

유스케이스는 외부 행위자 (사람이나 다른 시스템) 가 목표를 이루려고 시스템과 주고받는 과정을 적은 것이다. 정해진 하나의 서식은 없고, 많이 쓰이는 모양은 이렇다.

| 항목 | 내용 |
|---|---|
| 이름 | 사용자 목표 하나 (예: 상품 주문하기) |
| 행위자 | 주문자, 결제 시스템 |
| 주 성공 시나리오 | 번호 붙인 단계. 한 단계가 한 번의 상호작용 |
| 확장 | 주 경로 3 단계에서 갈라지면 3a, 3b 로 적음 |

단계에는 "주문 버튼을 누른다"보다 "주문자가 주문을 확정한다"처럼 목표와 응답을 적고 화면 요소는 피한다. 그래야 화면이 바뀌어도 요구사항은 그대로 남는다.

[Fowler-style Use Case explanation](https://en.wikipedia.org/wiki/Use_case) 을 따라 정리했다.

### Requirements ID and Traceability

요구사항마다 번호를 달아 두면 "이 요구는 어느 설계 요소가 맡고, 어느 테스트가 확인하나"를 표로 이을 수 있다. 이게 추적 (traceability) 이다. 빠진 칸이 곧 구멍이다. 간단히 돌려 봤다.

```python
reqs = {"R1": "회원은 이메일로 로그인한다", "R2": "로그인 응답은 1초 안에", "R3": "비밀번호는 해시로 저장한다"}
design = {"R1": ["AuthService.login"], "R2": [], "R3": ["UserRepo.save"]}
tests = {"R1": ["test_login_ok"], "R2": ["test_login_latency"], "R3": []}
for r in reqs:
    gaps = [n for n, m in (("설계", design), ("테스트", tests)) if not m[r]]
    print(r, "OK" if not gaps else "빠짐: " + ",".join(gaps))
```

실행 결과는 `R1 OK`, `R2 빠짐: 설계`, `R3 빠짐: 테스트`였다. R2 는 시험은 있는데 어디서 1 초를 지킬지 설계가 없고, R3 은 만들기는 했는데 확인하는 시험이 없다. 문서로만 관리해도 이 표 하나가 하는 일은 같다.

<details>
<summary>조건 of Good Requirements</summary>

- 한 문장에 한 요구. "로그인하고 알림을 보낸다"는 둘로 쪼갠다.
- 확인할 수 있어야 한다. "빠르게"는 못 하고 "1 초 안에"는 한다.
- 서로 충돌하지 않아야 한다. 분석 단계에서 걸러야 하는 것이 이것이다.
- 해결책이 아니라 필요를 적는다. "Redis 를 쓴다"는 설계 결정이지 요구가 아니다.
</details>

## Design is Divided into Two Layers

설계는 보통 큰 구조를 정하는 아키텍처 설계와, 모듈 안을 정하는 상세 설계로 나눈다. 요구사항이 "무엇"이었다면 아키텍처 설계는 "어떤 덩어리로 나누고 그 덩어리가 어떻게 말하는가"를 정한다. 여기서 비기능 요구사항이 가장 크게 작용한다. 확장성이나 변경 용이성 같은 요구가 구조를 밀어낸다.

## UML Basics

UML 은 OMG 가 관리하는 표기법으로, 소개 페이지에서는 분산 객체 시스템의 산출물을 시각화하고 명세하고 구성하고 문서화하는 그래픽 언어라고 설명한다. 다이어그램은 구조를 보여 주는 것과 동작을 보여 주는 것으로 나눠 이해하면 덜 헷갈린다. 클래스·컴포넌트·배치가 구조 쪽이고, 유스케이스·시퀀스·상태·액티비티가 동작 쪽이다. 어느 쪽이 어느 쪽인지는 표준 분류를 따른 것이다.

개요에서 표로 나열했으니 여기서는 읽는 법만 적는다.

- 클래스 다이어그램: 상자 하나가 클래스. 선은 관계 (연관, 상속, 집합, 합성, 의존). 상속은 속이 빈 삼각형 화살표라는 식의 모양은 한 번 외워 두면 된다.
- 시퀀스 다이어그램: 위에서 아래로 시간이 흐르고, 가로 화살표가 메시지다. 유스케이스 하나의 주 성공 시나리오를 그대로 시퀀스로 옮길 수 있다.
- 상태 다이어그램: 주문이 "접수 → 결제됨 → 배송 중 → 완료"처럼 상태가 있는 것에 쓴다. 어떤 이벤트에서 어떤 상태로 가는지를 적는다.

유스케이스 → 시퀀스 → 클래스 순으로 내려가면, 시나리오의 각 단계가 메시지가 되고 메시지를 받는 쪽이 클래스의 메서드가 된다. 이 흐름으로 보면 UML 종류를 따로 외울 때보다 서로의 관계가 보인다.

[자세히 → 객체지향](#/post/cs-procedural-oop) · [자세히 → SOLID 원칙](#/post/cs-solid)

[UML Introduction (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML) 에서 정의를 확인했다.

## アーキテクチャスタイル

アーキテクチャスタイルとは、共通する特徴を共有するアーキテクチャの一群を指します。特定の技術は要求しません。マイクロサービスとコンテナの間には相性が良い程度の適合性はあります。スタイルの本質は制約です。どのような要素が存在し、それらがどのように接続できるかを制限し、その制約を守れば望ましい性質が現れます。

マイクロサービスを例にとると、制約は以下の通りです。1 つのサービスは 1 つの責任を担うこと、サービス同士は独立していること、データは所有するサービスのみが保持することです。これらを遵守することで、別々のデプロイが可能になり、障害を隔離し、頻繁なアップデートが容易になります。

| スタイル | 依存関係の扱い方 | 適した領域 |
|---|---|---|
| N-tier (階層型) | 上位層は下位層のみを呼び出す | 従来の業務システム、変更が少ない場所 |
| Web-Queue-Worker | ウェブとワーカーをキューで分離 | シンプルなドメインだが一部に重い処理がある場所 |
| マイクロサービス | 機能ごとに縦割りし API で呼び出し | 複雑なドメイン、頻繁な変更 |
| イベント駆動 | 発行者と購読者をイベントで分離 | IoT、リアルタイム処理 |

上記の表は [Azure Architecture Center のスタイルガイド](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/) から引用した分類です。ここではビッグデータやビッグコンピューティングも含まれていますが、ソフトウェア工学の授業範囲を超えるため除外しました。

文書で繰り返し強調されている点は以下の通りです。複雑さはドメインに適合させる必要があります。あまり単純に設計すると、依存関係が管理できない「大きな泥のかたまり」になってしまいます。逆にマイクロサービスは、サービス探索、データ一貫性、分散システム管理といった複雑さを引き起こし、文書では成熟した開発・運用能力を持つ組織に適しているとしています。非同期メッセージングは結合を緩和する代わりに、最終的な一貫性と重複メッセージの問題を生み出します。

[詳細 → レイヤー化アーキテクチャ](#/post/be-layered-architecture)

### 直接呼び出しとイベント、コードによる比較

階層型では呼び出しが直接的であり、イベント駆動型では呼び出す側が受け取る側を知らず知れません。同じ注文機能をこの 2 つの方式で実装して動作させました。

```python
class Inventory:
    def reduce(self, item): print("재고 감소:", item)
class Mail:
    def send(self, item): print("메일 발송:", item)

class OrderLayered:               # 주문이 두 모듈을 직접 안다
    def __init__(self): self.inv, self.mail = Inventory(), Mail()
    def place(self, item):
        self.inv.reduce(item); self.mail.send(item)

class Bus:
    def __init__(self): self.subs = {}
    def subscribe(self, ev, fn): self.subs.setdefault(ev, []).append(fn)
    def publish(self, ev, data):
        for fn in self.subs.get(ev, []): fn(data)

class OrderEvent:                 # 주문은 이벤트만 낸다
    def __init__(self, bus): self.bus = bus
    def place(self, item): self.bus.publish("order_placed", item)

OrderLayered().place("책")
bus = Bus(); bus.subscribe("order_placed", Inventory().reduce); bus.subscribe("order_placed", Mail().send)
OrderEvent(bus).place("책")
bus.subscribe("order_placed", lambda i: print("포인트 적립:", i))  # 주문 코드는 그대로
OrderEvent(bus).place("펜")
```

実行すると「本」の注文については両方の方式とも在庫減少とメール送信が記録され、購読を追加した後に「ペン」の注文ではポイント付与が追加で記録されます。階層型で同じことを行うには `OrderLayered.place` を修正する必要があります。一方、イベント方式では呼び出し順序がコードに明示されていないため、誰がこのイベントを受け取るかを追跡する必要があります。前述の非同期・イベントの代償は、この小さな例にも表れています。

## 要件からスタイルを選ぶ

まずスタイルを決めてから要件を当てはめるのは逆です。文書が推奨する順序は、問題の性質を見て、コアなビジネス動機とそこから派生する非機能要件（アーキテクチャ特性）を定め、優先順位をつけた上で選択することです。リリース時期が急ぐ場合は保守性・テスト容易性・信頼性を、予算が逼迫している場合はシンプルさを重視します。スタイルを決めると変更にはコストがかかるため、初期段階でより深く検討する価値があるとしています。

## よくある誤解

- 要件は最初からすべて確定させるのか？これはウォーターフォール方式の話であり、アジャイルでは変化を前提として短周期で回します。どちらの場合でも、追跡できるように記録しておく点は同じです。
- マイクロサービスが最新なので常に優れているのか？制約があり代償も大きいです。ドメインが単純であれば階層型や Web-Queue-Worker が適しています。
- UML はすべてを描画しなければならないのか？言葉で説明しにくい部分のみを描画します。
- 非機能要件は後から手をつけるのか？構造を決定する力となるため、設計前に定める必要があります。

## 引用リンク

- [Non-functional requirement (Wikipedia)](https://en.wikipedia.org/wiki/Non-functional_requirement)
- [Use case (Wikipedia)](https://en.wikipedia.org/wiki/Use_case)
- [About the Unified Modeling Language Specification (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML)
- [Architecture styles (Azure Architecture Center)](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)

関連記事：[ソフトウェア工学基礎](#/post/cs-sw-engineering) · [レイヤー化アーキテクチャ](#/post/be-layered-architecture) · [SOLID 原則](#/post/cs-solid)