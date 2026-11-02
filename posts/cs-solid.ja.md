SOLID は、オブジェクト指向設計において「コードが変更された際に壊れにくく」する 5 つの原則の頭文字です。ルール集というよりは、コードに不具合が見つかった際の原因を特定するためのチェックリストとして読むのが適しています。

## 言葉の由来

Wikipedia の情報によると、Robert C. Martin が 2000 年の論文「Design Principles and Design Patterns」で基本原則を紹介し、SOLID という頭文字は Michael Feathers が 2004 年頃につけたとされています。

| 文字 | 名前 | 一言 |
|---|---|---|
| S | 単一責任の原則 | クラスを変更する理由は一つであるべき |
| O | 開閉の原則 | 拡張には開放され、修正には閉じられているべき |
| L | リスクフ・置換の原則 | 親の位置に子を置いても問題ない状態にあるべき |
| I | インターフェース分離の原則 | 使用しないメソッドへの依存を強いない |
| D | 依存性の逆転の原則 | 具体クラスではなく抽象に依存せよ |

[詳しく → 手続き型 vs オブジェクト指向](#/post/cs-procedural-oop) を先に読んでおくと、クラス・継承・インターフェースの話がより理解しやすくなります。

以下の例では、注文処理という一つの状況を通して進めていきます。コードは Python で直接実行し、結果を確認しました。

## S: 変更の理由は一つだけ

当初の定義は「クラスを変更する理由が二つ以上あるべきではない」というものでした。Martin が後に書いた文章では、これを人間基準で解釈しています。モジュールは一つの利害関係者（アクター）に対してのみ責任を持つべきだという話です。

その文章の例は `Employee` クラスです。`calculatePay` は財務担当、`reportHours` は運用担当、`save` は技術担当がそれぞれ要求する機能ですが、これらが一つのクラスに混在しています。片方が変更を求めてコードを書き換えると、他の側の機能が壊れてしまう可能性があるため、分けるべきだという話です。

これを注文処理に置き換えると、違反しているのは `Order` が合計計算、割引、DB 保存、メール送信のすべてを行う点です。私はこのようなクラスを見ると、import 一覧が長くなることから始まります。改善点は単純です。

```python
@dataclass
class Order:
    items: list  # (이름, 가격)
    def total(self): return sum(p for _, p in self.items)

class OrderRepository:          # 저장만 안다
    def __init__(self): self.rows = []
    def save(self, order): self.rows.append(order)
```

注文は金額のみを知り、保存はリポジトリが担当します。「割引率が変更された」と「DB を変更した」のはそれぞれ異なるファイルで起きます。

## O: 新しい機能が既存コードを触らないように

割引の種類が増えるたびに `if` を追加するコードは典型的な違反です。

```python
def checkout_bad(order, kind):
    t = order.total()
    if kind == "vip": return int(t*0.9)
    elif kind == "coupon": return max(t-3000,0)
    return t
```

クーポン割引が一つ増えると、すでに正常に動作しているこの関数を開いて修正しなければなりません。修正中に VIP 関連の部分を壊す可能性もあります。そのため、割引をクラスとして外し、新しいポリシーは新しいクラスとして追加します。

```python
class Discount(ABC):
    @abstractmethod
    def apply(self, price: int) -> int: ...

class NoDiscount(Discount):
    def apply(self, price): return price
class VipDiscount(Discount):
    def apply(self, price): return int(price * 0.9)
class CouponDiscount(Discount):
    def apply(self, price): return max(price - 3000, 0)

def checkout(order, discount: Discount):
    return discount.apply(order.total())
```

合計 14,000 円の注文に対して `checkout_bad(o, "vip")` は 12,600、`checkout(o, VipDiscount())` も 12,600、`CouponDiscount()` は 11,000 が出力されました。結果は同じであり、新しい割引を追加する際に `checkout` を開かなくても済みます。この構造は戦略パターンと似た形状です。[詳しく → デザインパターン](#/post/cs-design-patterns)

## L: 親の位置に子を置いても問題ないか

Wikipedia が引用している文は「基底クラスを使用する関数が派生クラスを知らずともそのまま動作すべき」という趣旨です。継承すると is-a という関係がまず頭に浮かびますが、この原則は「動作が約束を守っているか」を見ます。

古典的な例は正方形です。数学では正方形は長方形の一種ですが、コードでは問題が生じます。

```python
class Rectangle:
    def __init__(self, w, h): self.w, self.h = w, h
    def set_width(self, w): self.w = w
    def set_height(self, h): self.h = h
    def area(self): return self.w * self.h

class Square(Rectangle):
    def set_width(self, w): self.w = self.h = w
    def set_height(self, h): self.w = self.h = h

def stretch(r):
    r.set_width(5); r.set_height(2)
    return r.area()
```

`stretch(Rectangle(1,1))` は 10、`stretch(Square(1,1))` は 4 が出力されました。`stretch` は「幅と高さは独立して変更される」と信じて書かれていましたが、`Square` がその信念を破りました。型は合っているのに動作が一致しないケースです。解決策は通常、継承を断念することです。両者を `Shape` の兄弟として置き、親には `area()` だけの約束を持たせます。

よく見られる違反の兆候は、子クラスで `NotImplementedError` を投げること、または親メソッドが行っていた検証を子がスキップすることです。

## I: 必要なものだけを要求する

「クライアントが使用しないメソッドへの依存を強いるな」が原文の趣旨です。プリンター・スキャナー・ファクシミリが一つのインターフェースにある場合、プリンターだけの機器も `scan()` を実装する必要があり、通常は空メソッドや例外で対応します。

```python
class Printer(Protocol):
    def print_doc(self, d): ...
class Scanner(Protocol):
    def scan(self): ...

def run_print(p: Printer, d):      # 인쇄만 필요하면 Printer만 요구
    return p.print_doc(d)
```

印刷のみを行う `OfficePrinter` と両方に対応する `Combo` の両方を `run_print` にまとめて実行し、どちらも通りました。インターフェースが小さいと、実装側も、テスト時にモックを作成する側も楽です。

## D: 内側は外側の実装を知らずに

コアロジック（注文処理）がメール送信などの詳細実装に直接依存すると、メールサービスを変更したりテストしたりした際にロジックまで揺さぶられます。そのため、ロジックは `Notifier` という抽象に依存し、実際の実装は外側から差し込みます。

```python
class Notifier(ABC):
    @abstractmethod
    def send(self, to, msg): ...

class OrderService:
    def __init__(self, repo, notifier: Notifier):
        self.repo, self.notifier = repo, notifier
    def place(self, order, user, discount: Discount):
        self.repo.save(order)
        paid = checkout(order, discount)
        self.notifier.send(user, f"결제 {paid}원")
        return paid
```

テストでは `FakeNotifier` を使用したところ、`place` が 12,600 を返し、偽物に `('a@x.com', '決済 12600 円')` が蓄積され、リポジトリには 1 件のデータが格納されました。メールサーバーなしでロジック全体を確認できたことになります。これが依存性注入（コンストラクタへの渡与）であり、依存性の逆転は「矢印の方向を内側の抽象化側に回す」という設計原則です。両者は同じ意味ではありません。注入は方法であり、逆転は目的に近いものです。階層構造においてこれがどのように使われるかは [詳細 → 階層型アーキテクチャ](#/post/be-layered-architecture) にて整理しました。テストの観点については [詳細 → バックエンドテスト](#/post/be-testing) を参照してください。

## よくある誤解

- クラスは必ず小さく分割するほど良い: S は「メソッド 1 つにクラス 1 つ」ではありません。同じ理由で変更されるものをまとめることが目標であり、あまり細かく分割すると読み手がファイルを追うことに疲れ果ててしまいます。凝集と結合に関する話は [詳細 → 結合度・凝集度](#/post/be-coupling-cohesion) を参照してください。
- 最初からインターフェースや抽象クラスを敷き詰める必要がある: 変わらない部分に抽象化を入れるとコードだけが膨れ上がります。割引が一種類しかない場合は `if` でも問題ありません。2 つ目の変形が実際に現れた際に分割する方が間違いが少ないです。
- SOLID を守れば良い設計になる: 原則は道具です。互いに衝突することもあります（O のために抽象化を増やすとコードが複雑化するなど）し、言語によって適用の仕方は異なります。関数を値として渡す言語では、`Discount` クラスの代わりに単一の関数を渡しても O が満たされます。
- L は継承の話なので継承を使わなければ問題ない: インターフェースを実装するすべてのケースに該当します。「同じ約束を守っているか」という問題です。

<details>
<summary>詳しい解説：違反臭の速見表</summary>

| このような臭いがしたら | 疑う原則 |
|---|---|
| 1 つのファイルを複数の人・複数の理由で頻繁に修正する | S |
| 機能追加ごとに同じ `if/elif` を開いて修正する | O |
| 子クラスが親メソッドを空にするか例外で防ぐ | L |
| 実装時に空のメソッドが多い | I |
| テストで外部サービスを切り離せない | D |

暗記する必要はありません。修正して不便に感じた点がこの表に該当すれば、その原則を思い浮かべればよいです。この表の「臭い」列は上記の例で起きたことを簡略化したものであり、公式リストではありません。

</details>

## 根拠リンク

- Wikipedia, SOLID: https://en.wikipedia.org/wiki/SOLID
- Robert C. Martin, The Single Responsibility Principle (2014): https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html

← [概念マップ](#/post/cs-map)

関連記事: [手続き型 vs オブジェクト指向](#/post/cs-procedural-oop) · [デザインパターン](#/post/cs-design-patterns) · [結合度・凝集度](#/post/be-coupling-cohesion)