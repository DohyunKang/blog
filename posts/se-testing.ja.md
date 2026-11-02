# テスト概要

[ソフトウェア工学の基礎](#/post/cs-sw-engineering) と [バックエンドテスト](#/post/be-testing) で既に概観しました。単体・統合・システムへの分類やピラミッド構造もそこにあります。本稿はさらに一歩踏み込み、「そのテストケースをどのように選び、どれくらい実施すべきか、どのような順序で記述するか」を扱います。

## テストは証明ではなくサンプリングである

入力が持つ値の数は事実上無限です。すべてを実行することは不可能なので、いくつかを選び実行します。「通過した」ということは「選んだ入力では間違っていない」という意味であり、「間違いがない」という意味ではありません。したがって、テスト設計は結局、どのサンプルがバグを捉えるかという問題になります。

サンプルを選ぶ基準は主に 2 つあります。1 つ目は仕様（要件）のみを見て選ぶブラックボックス手法、もう 1 つ目はコード構造を見て選ぶホワイトボックス手法です。

| | 見るもの | 代表的な手法 | 見つけやすいもの |
|---|---|---|---|
| ブラックボックス | 入力・出力仕様 | 同値分割、境界値、決定テーブル | 仕様に反する動作、見落としたケース |
| ホワイトボックス | コードの分岐・パス | 文句・分岐・条件カバレッジ | 一度も実行されていないコード |

## ブラックボックス：同値分割と境界値

入力を「プログラムが同じように扱う束」で区切ったものが同値分割です。同じ束内ではどのような値を入れても同じ結果になるはずなので、各束から一つだけ選びます。次に、束の境界では条件式を `<` で書くべきところを `<=` で書くようなミスが起きやすいため、境界値は別途入力します。

例として配送料関数を捉えました。5kg 以下で 3,000 円、20kg 以下で 5,000 円、それ以上で 9,000 円で、会員は半額、0 以下の重量はエラーです。

```python
# shipping.py
def shipping_fee(weight_kg, is_member):
    if weight_kg <= 0:
        raise ValueError("weight must be positive")
    if weight_kg <= 5:
        fee = 3000
    elif weight_kg <= 20:
        fee = 5000
    else:
        fee = 9000
    if is_member:
        fee = fee // 2
    return fee
```

```python
# test_shipping.py
import pytest
from shipping import shipping_fee

@pytest.mark.parametrize("w, expected", [
    (0.1, 3000), (5, 3000),     # 첫 구간 안쪽, 경계
    (5.1, 5000), (20, 5000),    # 둘째 구간
    (20.1, 9000), (100, 9000),  # 셋째 구간
])
def test_fee_by_weight(w, expected):
    assert shipping_fee(w, False) == expected

def test_member_half():
    assert shipping_fee(10, True) == 2500

@pytest.mark.parametrize("w", [0, -1])
def test_invalid_weight(w):
    with pytest.raises(ValueError):
        shipping_fee(w, False)
```

`pytest` で実行すると 9 つが通過しました。ケースをいくつかの数字に減らしたにもかかわらず、3 つの区間、2 つの境界、エラー入力まですべて含まれています。`parametrize` は同じテスト本体に入力・期待値テーブルを渡す方式なので、ケースを増やしてもコードが長くなりません。

<details>
<summary>決定テーブル：条件が複数重なった場合</summary>

条件が 2 つ以上重なると、同値分割だけでは組み合わせが抜け落ちやすくなります。決定テーブルは条件の真/偽の組み合わせを行に使い、各組み合わせの結果を記述する表です。上記関数の場合は「5kg 以下かどうか × 会員かどうか」のように組み合わせを一行ずつ書き、空欄がないか確認します。空欄があれば仕様に記載されていない組み合わせがあることを意味するため、コードではなく要件側の質問が一つ生まれます。
</details>

## ホワイトボックス：カバレッジ

カバレッジはテストがコードのどの程度を実行したかを測る指標です。種類によって厳密さが異なります。

| 種類 | 基準 |
|---|---|
| 文句 (statement) | すべての文が一度は実行される |
| 分岐 (branch) | すべての `if` の真の場合と偽の場合の両方が実行される |
| 条件 (condition) | `and`・`or` で束縛された条件の一つ一つが真・偽の両方になる |

文句カバレッジが 100% でも分岐は空っぽである可能性があります。実際に確認しました。クーポンがある場合 1,000 円を引く関数を置き、どの行が実行されたかを `sys.settrace` で計測しました。

```python
def final_price(price, coupon):
    discount = 0
    if coupon:
        discount = 1000
    return price - discount
```

| 投入したテスト | 実行された文句 |
|---|---|
| `coupon=True` のみ | 4 / 4 |
| `coupon=False` のみ | 3 / 4 |
| 両方 | 4 / 4 |

`coupon=True` のみで文句はすべて実行されます。しかし、`if` が偽のパス、すなわちクーポンがない場合は一度も実行されていません。そこにバグがあっても文句カバレッジ 100% は静かに通過します。`else` がない `if` がこのような穴を作ります。そのため、文句よりも分岐カバレッジを最低基準として見る方が多いです。

カバレッジで注意すべき点は方向性です。低い場合は「実行されていないコードがある」という確実なシグナルですが、高いからといって「よく検証した」という意味ではありません。カバレッジはコードが実行されたかどうかのみを見て、`assert` が適切にあるかは見ていません。`assert` がないテストでもカバレッジは上げられます。

## TDD：テストを先に書く順序

TDD はテスト手法というより記述の順序です。[Martin Fowler の説明](https://martinfowler.com/bliki/TestDrivenDevelopment.html) を基準にすると以下のようになります。まず必要なテストリストを書き、一つを選びます。次にまだない機能に対するテストを書き (Red)、そのテストのみが通過するだけのコードを書き (Green)、コードを整理します (Refactor)。これをリストが空になるまで繰り返します。本稿では最後のリファクタリング段階を最も多くスキップする段階として挙げられており、スキップするとコード断片が積み重なった塊になると言われています。

閏年判定で一周回ってみました。最初は最も単純に 4 で割り切れるなら閏年と実装しました。

```python
def is_leap(y):
    return y % 4 == 0
```

```python
from tdd import is_leap
def test_basic():   assert is_leap(2024) and not is_leap(2023)
def test_century(): assert not is_leap(1900)
def test_400():     assert is_leap(2000)
```

回すと `test_century` が `assert not True` で失敗します (Red)。このテストをパスさせるためにコードを修正します。

```python
def is_leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
```

再度実行するとすべてパスしました (Green)。最初から完成した式を使うのではなく、一度テストが失敗する様子を見てから修正するのがポイントです。まず失敗する様子を見ることで、そのテストが本当にその不具合を検出しているか確認できます。

TDD の良い点はテストが常に残ることですが、代わりに設計がまだ固まっていない初期段階ではテストも頻繁に修正する必要があります。どこまで適用するかはチームによって異なります。

## テストダブル：本物に代わる偽物

単体テストでメール送信や DB などの外部依存を本物を使うと遅く不安定になります。その代わりに偽物を挿入することを「テストダブル」と呼びます。[Fowler の分類](https://martinfowler.com/bliki/TestDouble.html) では種類が次のように分かれます。

| 種類 | 役割 |
|---|---|
| Dummy | 引数の位置を埋めるだけで実際には使用されない |
| Stub | 事前に決めた答えだけを返す |
| Fake | 動作はするが簡易実装（例：メモリ DB） |
| Spy | スタブだが、どのように呼び出されたかも記録する |
| Mock | 期待される呼び出しを事前に記述し、検証時に確認する |

Python では `unittest.mock.Mock` で作成します。在庫が 5 未満の場合にメールを送信する関数で確認しました。

```python
from unittest.mock import Mock

def notify_if_low(stock, mailer):
    if stock < 5:
        mailer.send("재고 부족")
        return True
    return False

mailer = Mock()
assert notify_if_low(3, mailer) is True
mailer.send.assert_called_once_with("재고 부족")

mailer2 = Mock()
assert notify_if_low(10, mailer2) is False
mailer2.send.assert_not_called()
```

例外なく最後まで実行できました。ここで検証対象は戻り値ではなく「メールを送信したか/送信しなかったか」という振る舞いです。戻り値では確認できない結果を見る場合にモックを使います。ただし、呼び出し方法まで細かく固定してしまうと内部実装を変更するたびにテストが壊れてしまいます。可能であれば結果（状態）を確認し、モックは必要な場所だけに使いましょう。

## コードレビューも品質活動です

テストがコードを実行して発見する方法なら、コードレビューは人が読んで見つける方法です。両者が捉えるものは異なります。テストは動作エラーを捉え、レビューは読みづらさのある構造・名前・設計の問題を捉えます。Google の [レビューアガイド](https://google.github.io/eng-practices/review/reviewer/standard.html) では基準を以下のように定めています。完璧でなくてもコード全体の健康状態を確実に改善する変更であれば承認し、些細な指摘は「Nit:」としてマークして著者が無視できるようにします。逆にコードの健康状態を明らかに悪化させる変更は、緊急事態でない限り通過させません。

## よくある誤解

- テストがすべてパスしているからバグがない？パスするのは選択された入力での話です。サンプルが悪いとパスしても意味がありません。
- カバーレージ 100% で十分？上で見たように文の 100% でも分岐が空っぽの場合があり、assert がなくてもカバーレージは上がります。
- モックを多用するほど良い単体テスト？モックが増えると実装に縛られてリファクタリングの際に一緒に壊れてしまいます。
- TDD はテストを書くだけ？最後の「リファクタリング」の段階まで進まなければ TDD ではありません。

[詳細 → 要件と設計](#/post/se-requirements-design) では「検証可能な要件」をどのように使うか続き、これらのテストを自動的に実行するのは [バージョン管理と CI/CD](#/post/se-cicd) で扱います。

## リンク集

- [Martin Fowler, Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Martin Fowler, Test Double](https://martinfowler.com/bliki/TestDouble.html)
- [Google Engineering Practices, The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)

← コンセプトマップ ([ソフトウェア工学の基礎](#/post/cs-sw-engineering))

関連記事：[バックエンドテスト](#/post/be-testing) · [開発手法](#/post/se-methodology) · [バージョン管理と CI/CD](#/post/se-cicd)