デザインパターンとは、オブジェクト指向設計で頻出する問題とその解決法に名前を付けて集めたものです。名前の分類だけ見ると混乱しますが、文脈とあわせて読むと 훨씬（はるかに）理解しやすくなります。

## パターンとは何か

1994 年に Gamma, Helm, Johnson, Vlissides の 4 人が著した「Design Patterns: Elements of Reusable Object-Oriented Software」が起源です。著者の 4 人から通称 GoF(Gang of Four) と呼ばれています。この書には 23 つのパターンが掲載されています。開発者が独自に名付けずに繰り返し使用していた構造を、名前をつけてまとめた本と言えます。

パターンはライブラリではなく設計の形です。コピペするコードではなく、「このような状況ではオブジェクトをこう分割すると便利だった」という知恵に近いものです。名前があれば「ここには Observer を入れよう」と一言で構造化の話が終わって、会話も短くなります。

以前にまとめた [SOLID 原則](#/post/cs-solid) と深い関係があります。パターンはほとんどが「拡張には開き、修正には閉じる」「実装ではなくインターフェースに依存する」などの原則を実現した形です。[手続き型とオブジェクト指向](#/post/cs-procedural-oop) の感覚が先にあると、パターンも読みやすくなります。

## 3 つの分類

GoF はパターンを目的に応じて 3 つに分類しています。

| 分類 | 何を解決するか | 代表的なパターン |
|---|---|---|
| 生成 (Creational) | オブジェクトをどう作るか | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| 構造 (Structural) | クラス・オブジェクトをどう組み合わせるか | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 振る舞い (Behavioral) | オブジェクト同士の役割分担・通信をどうするか | Observer, Strategy, Command, State, Iterator, Template Method など |

原著に基づく数は、生成 5、構造 7、振る舞い 11 で合計 23 です。一部のサイト（Refactoring.guru）は Interpreter を除外して 22 と紹介していますが、原著との数の違いはこのためと思われます。数は原著基準の 23 とするのが安全です。

振る舞いパターンリスト (Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor) が長いため最も混乱しやすいです。一行ずつ並べると以下のようになります。

- Chain of Responsibility: 要求を処理できるオブジェクトが出るまで順次渡す
- Command: 要求そのものをオブジェクト化して保存・取消し・キューイング
- Iterator: 内部構造は隠しつつ一つずつ巡回する
- Mediator: オブジェクト同士が直接話さず仲介者を介する
- Memento: 状態を保存しておいて復元（巻き戻し）
- State: 動作が状態によって変わるものを状態オブジェクトに分離
- Template Method: アルゴリズムの骨格は親クラス、詳細ステップは子クラス
- Visitor: 構造はそのままにし、その上で行う作業だけを別途追加

## 代表的なパターンのコードで見る

以下のコードはすべて Python で直接実行し、出力も確認しました。

### Singleton: インスタンスを一つだけ

プログラム全体で一つしか存在してはいけない設定オブジェクトなどに使います。

```python
class Config:
    _inst = None
    def __new__(cls):
        if cls._inst is None:
            cls._inst = super().__new__(cls)
            cls._inst.values = {}
        return cls._inst

a, b = Config(), Config()
a.values["mode"] = "dev"
print(a is b, b.values)   # True {'mode': 'dev'}
```

手軽ですがグローバル変数と似ていてテストが難しくなり、隠れた依存関係が生じます。マルチスレッドでは上記コードだけでは不十分でロック処理が必要です（この部分は実行していません）。

### Factory Method: 作る側を隠す

どのクラスを作るか呼ぶ側に知らなくてもよくなります。

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, msg): ...
class Email(Notifier):
    def send(self, msg): return f"email: {msg}"
class Sms(Notifier):
    def send(self, msg): return f"sms: {msg}"

def make_notifier(kind):
    return {"email": Email, "sms": Sms}[kind]()

print(make_notifier("sms").send("hi"))   # sms: hi
```

厳密には GoF の Factory Method は親クラスが生成メソッドを定義し、子がオーバーライドする形式です。上記コードは同じ意図を関数で簡略化したシンプルファクトリに近いものです。一行にまとめると「オブジェクトの生成をサブクラスに委譲」です。

### Adapter: 合わないインターフェースを接続する

古いコードのメソッド名と現在の使い方が異なる場合、間に挟んで合わせます。

```python
class OldPrinter:
    def print_text(self, s): return f"[old] {s}"
class NewPrinter:
    def __init__(self, old): self.old = old
    def write(self, s): return self.old.print_text(s)

print(NewPrinter(OldPrinter()).write("hello"))   # [old] hello
```

### Decorator: 機能を重ねて着せる

継承せずに機能を追加します。コーヒーにミルクやショットを追加するようなものです。

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 500
class Shot:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 700

print(Shot(Milk(Coffee())).cost())   # 4200
```

包む側と包まれる側が同じインターフェース（ここでは cost）を持つため、何層でも積み重ねられます。組み合わせが増えたとしても「ミルクショットコーヒー」などのクラスを一つずつ作る必要はありません。

### Observer: 変化したことを知らせる

一つのオブジェクトの状態が変わると、購読している側へ自動的に通知します。イベント処理や通知はこの形です。

```python
class Subject:
    def __init__(self): self.obs = []
    def subscribe(self, f): self.obs.append(f)
    def notify(self, v):
        for f in self.obs: f(v)

s = Subject()
s.subscribe(lambda v: print("A got", v))
s.subscribe(lambda v: print("B got", v))
s.notify(42)   # A got 42 / B got 42
```

### Strategy: アルゴリズムを差し替える

割引計算のように「方法」が複数あり、状況に応じて切り替えたい場合に使います。

```python
def won(p): return p
def vip(p): return int(p * 0.9)

class Cart:
    def __init__(self, strategy): self.strategy = strategy
    def total(self, p): return self.strategy(p)

print(Cart(won).total(10000), Cart(vip).total(10000))   # 10000 9000
```

if-else による分岐を、ここでは関数というオブジェクトに置き換えることで、新しい方式を追加する際に既存コードを変更する必要がなくなります。これは SOLID の「開閉原則」を実践した例であり、印象に残りました。

## 混同しやすいペア

- Decorator と Proxy: どちらも同じインターフェースでラップしているように見えますが、意図は異なります。Decorator は機能を追加し、Proxy はアクセスを制御します（遅延読み込み、権限確認など）。
- Adapter と Facade: Adapter は一つのインターフェースを別の形に変換し、Facade は複雑な複数のクラスの前に単純な窓口を置きます。
- Strategy と State: 構造は似ていますが、Strategy は外部からアルゴリズムを選択して装着するのに対し、State はオブジェクト自身の状態に応じて動作が変化します。
- Factory Method と Abstract Factory: 前者は単一の製品を作成し、後者は互いに関連する製品群を一度に作成します。

このような外見が似ているパターンは、コード構造よりも意図で区別すべきだという指摘が頻繁にあります。

## よくある誤解

- 「使うほど良い設計だ」: 問題がないのにパターンを無理やり適用すると、クラスが増えただけで読みづらくなります。必要な時に適用する方が良いでしょう。
- 「パターンはオブジェクト指向言語だけで使う」: 書籍がオブジェクト指向基準に過ぎません。前述の Strategy の例のように、関数を値として渡せる言語では、クラスを使わずに 훨씬短く記述できます。
- 「暗記すれば設計ができる」: 名前を知っていることと状況を理解することは異なります。設計は状況を理解することから生まれます。
- 「Singleton は常に良い」: 最も簡単に使えますが、最も批判されやすいパターンです。グローバル状態になりがちです。

<details>
<summary>詳細な解説：キーワードでパターンを探す</summary>

パターンを識別する際は、「このような説明はどのパターンか」と考えます。キーワードとパターンを紐付けておくと早いです。

| 説明キーワード | パターン |
|---|---|
| インスタンス一つ、グローバルアクセス | Singleton |
| 生成をサブクラスに委譲 | Factory Method |
| 関連するオブジェクト群の生成 | Abstract Factory |
| 複雑なオブジェクトの段階的組み立て | Builder |
| 既存オブジェクトの複製による生成 | Prototype |
| インターフェースの変換 | Adapter |
| 抽象と実装の分離 | Bridge |
| 部分 - 全体の木構造 | Composite |
| 機能の動的追加 | Decorator |
| 複雑なサブシステムへの単一窓口 | Facade |
| 同じオブジェクトの共有によるメモリ節約 | Flyweight |
| 代理オブジェクトによるアクセス制御 | Proxy |
| 変更を購読者に通知 | Observer |
| アルゴリズムの置換 | Strategy |
| リクエストをオブジェクトにカプセル化 | Command |

</details>

## 参考文献リンク

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← 概念マップへ (#/post/cs-map)

関連記事：[SOLID 原則](#/post/cs-solid) · [手続き型とオブジェクト指向](#/post/cs-procedural-oop) · [結合度と凝集度](#/post/be-coupling-cohesion)