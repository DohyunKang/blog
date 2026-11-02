デザインパターンとは、オブジェクト指向設計において繰り返し現れる問題とその解決の形に名前を付けたものです。情報処理技術者試験の勉強では、名前、分類、一行での役割をセットで覚えるのが基本です。試験日程や受験料は変更される可能性があるため、必ず公式サイトで確認してください。

パターン自体をゆっくり理解したい方は [デザインパターン概念記事](#/post/cs-design-patterns) に別途まとめておきました。本稿は試験勉強用に単元の要点のみを抽出したものです。

## 骨格から

1994 年に Erich Gamma、Richard Helm、Ralph Johnson、John Vlissides の 4 名が著した「Design Patterns: Elements of Reusable Object-Oriented Software」に 23 のパターンが掲載されています。著者 4 人なので GoF（Gang of Four）と呼ばれます。そのため、試験で問われるデザインパターンはほとんどがこの 23 つです。

23 は目的に応じて 3 つの分類に分けられます。

| 分類 | 数 | 解決しようとする問題 | パターン |
|---|---|---|---|
| 作成 | 5 | オブジェクトをどのように作るか | Abstract Factory, Builder, Factory Method, Prototype, Singleton |
| 構造 | 7 | クラス・オブジェクトをどのように組み合わせるか | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 振る舞い | 11 | オブジェクト同士で役割とコミュニケーションをどのように分担するか | Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

Refactoring.guru は Interpreter を除外して振る舞いパターンを 10 つとして示しています。試験教材は通常本を基準とするため、23 つを暗記しておけば問題ありません。

分類名は暗記順序が重要なので、「作成 5、構造 7、振る舞い 11」を先に口に出して覚えておきましょう。個数が分かれば、暗記で漏れそうなパターンもすぐに気づけます。

## 作成パターン一行ずつ

- Singleton: インスタンスをただ一つだけ作り、どこからでも同じものを使います。設定オブジェクトが典型的な例です。
- Factory Method: オブジェクトを作る仕事をサブクラスに任せて渡します。
- Abstract Factory: 互に関連するオブジェクトの集合（製品群）を、具体的なクラス名なしで作ります。
- Builder: 複雑なオブジェクトを段階的に組み立てます。同じ組み立てプロセスで異なる結果物を作ることができます。
- Prototype: 新規作成せず、元を複製して作ります。

混同しやすいペアは Factory Method と Abstract Factory です。一つの製品を作るメソッドをサブクラスに任せる場合は Factory Method、関連する複数の製品を一括で作ってくれるファクトリの場合は Abstract Factory と区別します。

## 構造パターン一行ずつ

- Adapter: インターフェースが合わない二つの間に挟まって合わせます。コンセント変換アダプタと同じ役割です。
- Bridge: 抽象部分と実装部分を分け、それぞれを独立して拡張できるようにします。
- Composite: 部分と全体を同じ方法で扱います。フォルダの中にフォルダとファイルが共存する木構造が例です。
- Decorator: 既存のオブジェクトを包んで機能を追加します。継承ではなく包装で機能を増やします。
- Facade: 複雑なサブシステムの前には単純な窓口一つを置きます。
- Flyweight: 同じものを複数作らず共有してメモリを節約します。
- Proxy: 代理オブジェクトを前面に置き、アクセスを代わりに受けます。アクセス制御、遅延生成などに使います。

Adapter と Facade は特に似て見えます。Adapter は既に存在するインターフェースを別の形に変える方であり、Facade は多数をまとめて単純な入り口を新たに作る方です。Decorator と Proxy もどちらもオブジェクトを包みますが、機能を追加するなら Decorator、アクセスを遮断して制御するなら Proxy と覚えます。

## 振る舞いパターン一行ずつ

- Chain of Responsibility: リクエストを処理するオブジェクトが出るまで鎖のように渡します。
- Command: リクエストそのものをオブジェクトにして保存し、キャンセルしたり並べたりできます。
- Interpreter: 単純な言語の文法をクラスで表現して解釈します。
- Iterator: 内部構造を露にせず一つずつ巡回します。
- Mediator: オブジェクト同士が直接話さず仲介者を介します。
- Memento: オブジェクトの状態を保存しておいて復元します。やり直し（undo）に使います。
- Observer: 一つのオブジェクトが変われば購読中のオブジェクトたちに通知します。
- State: 状態によって行動が変わるのを状態オブジェクトで分離します。
- Strategy: アルゴリズムをオブジェクトとして外して取り替えます。
- Template Method: アルゴリズムの骨格は親が定め、詳細なステップは子が埋めます。
- Visitor: 構造はそのままにしてその上で行う演算を別途追加します。

State と Strategy は構造が似ています。状態の変化に応じて自らが変わる場合は State、使用する側がアルゴリズムを選び取り付ける場合は Strategy です。

## キーワードでペアにする

説明を与えられてパターン名を選ぶ形式だと考えて勉強すると便利です。説明の中のキーワードとパターンをこのように対応させておきます。

| 説明に出てくる言葉 | パターン |
|---|---|
| 一つだけ、グローバルアクセス | Singleton |
| 複製 | Prototype |
| ステップごとの組み立て | Builder |
| 製品群 | Abstract Factory |
| サブクラスが生成を決定する | Factory Method |
| インターフェースの変換 | Adapter |
| 抽象と実装の分離 | Bridge |
| ツリー、部分 - 全体 | Composite |
| 機能の追加 | Decorator |
| シングルエントリーポイント | Facade |
| 共有によるメモリの節約 | Flyweight |
| 代理 | Proxy |
| チェーンで渡す | Chain of Responsibility |
| リクエストをオブジェクトにする | Command |
| 巡回 | Iterator |
| 仲介者 | Mediator |
| 状態の保存・復元 | Memento |
| 変更通知 | Observer |
| 状態ごとの振る舞い | State |
| アルゴリズムの差し替え | Strategy |
| スケルトンと詳細ステップ | Template Method |
| 演算を構造の外へ | Visitor |
| 文法解釈 | Interpreter |

## コードを読む問題への備え

パターン名は示されず、コードだけが提示される形式もあるかもしれません。その場合はクラス同士がどのように結びついているかを見ます。以下のコードは実際に実行して出力を確認しました。

### Decorator は包む形

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, c): self.c = c
    def cost(self): return self.c.cost() + 500

print(Milk(Milk(Coffee())).cost())   # 4000
```

同じメソッドを持つオブジェクトが別のオブジェクトを内側に抱え込み、呼び出しを渡しながら値を加えます。牛乳を 2 重に包んだので 3000 + 500 + 500 です。

### Observer は購読リストを回る形

```python
class Subject:
    def __init__(self): self.obs = []
    def attach(self, o): self.obs.append(o)
    def notify(self, v):
        for o in self.obs: o(v)

s = Subject()
s.attach(lambda v: print("A", v))
s.attach(lambda v: print("B", v))
s.notify(7)
# A 7
# B 7
```

登録順通りに通知が行きます。出力順序を問われる問題が出たら、登録順を追えばよいです。

### Template Method は親が枠組みを持つ形

```python
from abc import ABC, abstractmethod

class Report(ABC):
    def make(self): return self.head() + "|" + self.body()
    def head(self): return "H"
    @abstractmethod
    def body(self): ...

class Sales(Report):
    def body(self): return "sales"

print(Sales().make())   # H|sales
```

呼び出しは親の `make` が行い、空欄だけを子が埋めます。

<details>
<summary>Strategy と Adapter のコード</summary>

```python
def run(price, discount): return discount(price)
print(run(10000, lambda p: p * 0.9), run(10000, lambda p: p - 1000))
# 9000.0 9000

class Old:
    def old_send(self, m): return "old:" + m
class Adapter:
    def __init__(self, o): self.o = o
    def send(self, m): return self.o.old_send(m)

print(Adapter(Old()).send("x"))   # old:x
```

Strategy は割引方式などのアルゴリズムを関数やオブジェクトとして渡して差し替えます。Adapter は古いメソッド名 `old_send` を新しい名前 `send` につなぎます。

</details>

## 学習順序

1. 分類の 3 つと個数（5・7・11）を暗記する。
2. パターンごとにキーワードを一つずつ付ける。
3. 混同しやすいペア（Factory Method と Abstract Factory、Adapter と Facade、Decorator と Proxy、State と Strategy）は別々に比較する。
4. 過去問は公式サイトや正式な問題集で直接解き、間違えたパターンだけを表に戻って再度確認する。

パターンは [SOLID 原則](#/post/cs-solid) と一緒に見ると覚えやすいです。多くのパターンがインターフェースに依存し、拡張性を保つ方向だからです。クラス間の関係を図で読み取る感覚は [UML とオブジェクト指向分析](#/post/jb-uml)、パターンと名前が重複する大きな構造の話は [ソフトウェアアーキテクチャ](#/post/jb-architecture-pattern) で続きます。コード出力の読み取りは [オブジェクト指向と言語コードの読み方](#/post/jb-oop-lang) にまとめました。

## 根拠リンク

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← コンセプトマップへ (#/post/jb-map)

関連記事：[UML とオブジェクト指向分析](#/post/jb-uml) · [ソフトウェアアーキテクチャ](#/post/jb-architecture-pattern) · [オブジェクト指向と言語コードの読み方](#/post/jb-oop-lang)