手続き指向とオブジェクト指向は、コードで問題を分割する基準が異なるため、手続き指向では関数（やるべきこと）に、オブジェクト指向ではオブジェクト（データとそのデータを扱う動作）に分割します。

## 両方の方式とは何か

手続き指向 (procedural) はプログラムを手順、つまり関数やサブルーチンの連続として記述します。ウィキペディアの説明によると、プログラムは変数・データ構造・サブルーチンに分けられ、その手順が別個にデータ構造を扱う方式です。Fortran、COBOL、Pascal、C などの古い言語が代表的な例です。

オブジェクト指向 (object-oriented) は、データとそのデータを扱う動作を一つのオブジェクトに束ねます。オブジェクトは決まった窓口（メソッド）を通じてのみ外部とやり取りを行います。同じ文書でこの両者の違いはこの程度にまとめられています。

| | 手続き指向 | オブジェクト指向 |
|---|---|---|
| 分割の単位 | 関数 | クラス・オブジェクト |
| データと動作 | 別々 | 一体 |
| 問いかけ | どのような順序で処理するか | このデータは誰が責任を持つのか |
| 適している場所 | 流れが単一の線に見える作業 | 状態があり、種類が増えるもの |

Python は両方に対応します。関数だけ使ってもクラスを使ってもよいので比較しやすいです。

## 同じ問題を両方の方式で

口座への入金と出金を扱う問題で試しました。まず手続き指向です。口座は単なる辞書であり、動作は外部の関数です。

```python
def make_account(owner, balance=0):
    return {"owner": owner, "balance": balance}

def deposit(acc, amount):
    if amount <= 0:
        raise ValueError("amount must be positive")
    acc["balance"] += amount

def withdraw(acc, amount):
    if amount > acc["balance"]:
        raise ValueError("insufficient funds")
    acc["balance"] -= amount

a = make_account("kim", 100)
deposit(a, 50)
withdraw(a, 30)
print(a)              # {'owner': 'kim', 'balance': 120}
a["balance"] = -999   # 막을 방법이 없다
```

読みやすく短いです。ただし、口座データがあらゆる関数からアクセス可能であるため、最後の行のように検証なしに値を変更できてしまいます。検証は関数を通過する人だけが守る必要があります。

同じことをクラスで記述するとこのようになります。

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount
```

残高を `_balance` として設定し、読み取りのみ `balance` で公開しています。`acc.balance = 5` とすると AttributeError が発生しました（実際に実行して確認）。ルールがデータの隣に付いているため、値がどのように変化するかはこのクラスを見るだけでわかります。

## クラス・カプセル化

クラスはオブジェクトを生成するための型であり、オブジェクトはその型で作られた実体です。Python の公式チュートリアルによると、クラスはデータと動作を束ねて新しいタイプを作成します。メソッドの最初の引数はそのオブジェクト自身 (`self`) であり、これを省略することはできません。`__init__` はオブジェクト作成時に実行される初期化関数です。

カプセル化とは、内部データを隠蔽し、決まった窓口を通じてのみアクセスできるようにすることです。混乱を招く点は、Python に真の private なものがないことです。チュートリアルには「外部からアクセスできない private インスタンス変数は Python には存在しない」とあります。代わりに、アンダースコア (_) で始まる名前 (`_spam`) は公開 API ではないという約束として使用します。二つのアンダースコア (`__spam`) の場合は `_クラス名__spam` という形式に変換され、これはサブクラスとの名前衝突を避けるためのものです（アクセス自体は依然として可能であることをチュートリアルも明記しています）。したがって、Python のカプセル化は強制ではなく約束に近いと言えます。

## 継承

継承は既存のクラスを受け継ぎ、必要な部分のみを追加または変更するものです。利息がつく貯蓄口座と限度を超えて引き出せる普通預金口座を作成しました。

```python
class SavingsAccount(Account):
    def __init__(self, owner, balance=0, rate=0.02):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        self.deposit(self._balance * self.rate)

class CheckingAccount(Account):
    def withdraw(self, amount):          # 덮어쓰기(오버라이딩)
        if amount > self._balance + 50:
            raise ValueError("overdraft limit")
        self._balance -= amount
```

`deposit` は `Account` のものをそのまま使い、`CheckingAccount` は `withdraw` を差し替えています。`super()` は親クラスのメソッドを呼び出す際に使用します。チュートリアルでは Python のすべてのメソッドが事実上仮想 (virtual) であると述べられています。そのため、親のメソッドが他のメソッドを呼び出すと、子クラスのものも呼び出される可能性があります。

## 多態性

多態性とは、同じ呼び出しがオブジェクトの種類によって異なる動作をするものです。

```python
for acc in [SavingsAccount("lee", 1000), CheckingAccount("park", 10)]:
    acc.withdraw(40)
    print(type(acc).__name__, acc.balance)
# SavingsAccount 960
# CheckingAccount -30
```

呼び出し側は `withdraw(40)` のみを知っています。残高が 10 の普通預金口座では限度額 50 以内であるため -30 となり、貯蓄口座では 960 になりました。手続き指向であれば関数内に `if 口座種類 == ...` が続々と追加される場所です。

<details>
<summary>Python の多態性は継承なしでも可能（デフォルトタイピング）</summary>

チュートリアルは「多態性」や「デフォルトタイピング」という用語は使用しませんが、同じことを述べています。ある抽象タイプを期待するコードに対して、そのタイプのメソッドを模倣した別のクラスを渡してもよいということです。例えば `__iter__()` と `__next__()` を持つクラスであれば、どの親クラスを継承しているかに関係なく `for` 文に使用できます。

したがって Python では `withdraw` メソッドさえあれば、`Account` を継承していないクラスも上記の反復処理に含めることができます。Java などのインターフェース継承が必須な言語とは異なります。継承は「コードを受け継ぐ手段」であり、多態性は「同じメソッド名で呼ぶ性質」であるため、別々に考えるのが適切だと思います。

</details>

## いつ何をすべきか

学習の基準は以下の通りである。処理の流れが単一でデータも単純な場合（ファイルを読み込んで変換し保存するスクリプト）は、手続き指向が短くて良い。状態を持つ概念が多く、種類も増え続ける場合（口座の種類、決済手段など）は、オブジェクト指向の方が整理しやすい。大きなコードを設計する際には、オブジェクト指向の上にさらに原則が加わるが、それは [詳細 → SOLID 原則](#/post/cs-solid) と [詳細 → デザインパターン](#/post/cs-design-patterns) で続く。クラスをどのように分割すべきかの感覚は [詳細 → 結合度と凝集度](#/post/be-coupling-cohesion) と続き、サービスコードで役割ごとに層を分ける話は [詳細 → 階層型アーキテクチャ](#/post/be-layered-architecture) にある。

## よくある誤解

- オブジェクト指向の方が良い方法である：両者は異なる道具であり、短いスクリプトに無理やりクラスを入れるとコードだけが長くなる。現代のコードでも関数とオブジェクトを混在させて使用する。
- クラスを使えばオブジェクト指向である：データだけを保持し動作は外部関数にあるクラスは、名前をつけた辞書に近い。
- 継承を多用すれば再利用が良くなる：継承が深くなると親を変更する際に子が一気に壊れてしまう。この部分の代替案は上記の SOLID・デザインパターンの記事で扱う。
- Python にも private が存在する：前述した通り、約束と名前の変更だけである。

## 根拠となるリンク

- Python 公式チュートリアル、Classes: https://docs.python.org/3/tutorial/classes.html
- Wikipedia, Procedural programming: https://en.wikipedia.org/wiki/Procedural_programming

← 概念マップへ (#/post/cs-map)

関連記事：[SOLID 原則](#/post/cs-solid) · [デザインパターン](#/post/cs-design-patterns) · [結合度と凝集度](#/post/be-coupling-cohesion)