バックエンドテストは、コードを修正した際に「以前動いていた機能がまだ動くか」を人間に代わって確認してくれるコードです。規模別に単体・統合・E2E に分け、下層（単体）を多く使うのが基本の形です。

## テストとは何か

テストは、コードを実行して結果が期待通りか比較するための別のコードです。関数に入力を渡し、出力された値が正しいかを `assert` で確認するといった具合です。人間が画面をクリックして確認することと同じ作業ですが、ボタン一つで数秒以内に数百回実行できる点が異なります。

バックエンドでこれが特に必要な理由は、目に見えないから です。フロントエンドは壊れると画面がおかしくなりますが、サーバー側の計算や DB の更新に誤りがあると、静かに間違った値が蓄積してしまいます。また、機能が増えるほど、ある箇所を修正した際に別の箇所で壊れる可能性も高まります。テストがあれば修正直後にそれを検知でき、[CI/CD](#/post/cloud-cicd) で自動実行させれば、壊れたコードがデプロイに渡るのを防げます。

## 規模別に分類すると

テストは「一度に実行する範囲の大きさをどう分けるか」で分類します。

| 種類 | 確認範囲 | 速度 | 不具合の原因特定 |
|---|---|---|---|
| 単体 (unit) | 関数・クラス一つ | 非常に速い | 容易 |
| 統合 (integration) | DB や外部サービスなどの接続ポイント一つ | 中程度 | 普通 |
| E2E(end-to-end) | デプロイされたシステム全体をユーザーフロー順に | 遅い | 困難 |

単体テストは周囲の依存物（DB、メール送信など）を偽物に変えて、コードの一部だけを確認します。統合テストはその偽物を本物に戻して、「我々のコードと DB が実際に噛み合っているか」を確認します。例えば SQL が文法エラーなく動作し、必要な行を変更しているかは、偽の DB では分かりません。E2E テストでは API を呼び出して注文が作成され、在庫が減るまでの全プロセスを、サーバー・DB・外部連携がすべて接続された状態で確認します。

## テストピラミッド

Martin Fowler の記事に出てくるテストピラミッドは、この 3 つの種類のどれをどれだけ使うかに関する経験則です。単体テストを最も多く、統合テストはその次に、E2E テストはごく少量使います。記事では E2E テストを「システム全体を使うため確信度は高いが、遅く、維持コストが高く、不安定 (flaky) になりやすい」と説明し、コアなユーザーフローのいくつかだけに制限するよう勧めています。逆に、E2E テストが最も多い形はアイスクリームコーンと呼ばれ、避けるべきパターンとして挙げられています。

```
        /\            E2E   : 핵심 흐름 몇 개
       /  \ 
      /----\          통합  : DB·외부 연동 지점마다 조금
     /      \ 
    /--------\        단위  : 가장 많이, 빠르게
```

同じ記事で知らされるルールもう一つあります。テストには維持コストがかかるため、可能な限り下層で確認し、上層のテストが壊れても下層は正常なら下層にテストを一つ追加するよう勧めています。上層のテストが下層と重複している場合は削除してもよいとも述べています。

なお、この記事では統合テストと E2E テストの間にも「契約 (contract) テスト」を置いています。サービス同士でやり取りするリクエスト・レスポンスの形式を両側が同じように理解しているか確認するテストです。サービスが一つしかないアプリであれば、当面は気にする必要はありません。

## 例：pytest で試してみる

Python では pytest をよく使います。ファイル名を `test_*.py` にし、関数名を `test_` で始めると自動的に発見して実行してくれます。以下は注文サービス一つに対して 3 つの層すべてを使った例です。在庫を確認し、減らし、メールを送るコードです。レイヤーを分けておくと（これは [レイヤードアーキテクチャ](#/post/be-layered-architecture) で扱います）、リポジトリやメーラーを外側から差し込めるためテストしやすくなります。

<details>
<summary>テスト対象のコード：shop.py</summary>

```python
class OutOfStock(Exception):
    pass

def apply_discount(price: int, percent: int) -> int:
    if not 0 <= percent <= 100:
        raise ValueError("percent must be 0..100")
    return price * (100 - percent) // 100

class OrderService:
    def __init__(self, repo, mailer):
        self.repo = repo
        self.mailer = mailer

    def place(self, user_email, item_id, qty):
        stock = self.repo.get_stock(item_id)
        if stock < qty:
            raise OutOfStock(item_id)
        self.repo.set_stock(item_id, stock - qty)
        self.mailer.send(user_email, f"주문 완료: {item_id} x{qty}")
        return stock - qty
```

</details>

<details>
<summary>テストコード：test_shop.py（単体・モック・統合）</summary>

```python
import sqlite3
from unittest.mock import Mock
import pytest
from shop import apply_discount, OrderService, OutOfStock

# 단위 테스트: 순수 함수
@pytest.mark.parametrize("price,pct,expected", [(10000, 10, 9000), (999, 0, 999), (500, 100, 0)])
def test_discount(price, pct, expected):
    assert apply_discount(price, pct) == expected

def test_discount_rejects_bad_percent():
    with pytest.raises(ValueError):
        apply_discount(1000, 120)

# 목을 쓴 테스트: 메일러를 가짜로 바꾼다
class FakeRepo:
    def __init__(self, stock):
        self.stock = {"A": stock}
    def get_stock(self, i): return self.stock[i]
    def set_stock(self, i, n): self.stock[i] = n

def test_place_sends_mail():
    mailer = Mock()
    svc = OrderService(FakeRepo(5), mailer)
    assert svc.place("a@b.c", "A", 2) == 3
    mailer.send.assert_called_once_with("a@b.c", "주문 완료: A x2")

def test_place_out_of_stock_no_mail():
    mailer = Mock()
    svc = OrderService(FakeRepo(1), mailer)
    with pytest.raises(OutOfStock):
        svc.place("a@b.c", "A", 2)
    mailer.send.assert_not_called()

# 통합 테스트: 진짜 SQL(메모리 SQLite)에 붙인다
class SqlRepo:
    def __init__(self, con): self.con = con
    def get_stock(self, i):
        return self.con.execute("SELECT qty FROM stock WHERE id=?", (i,)).fetchone()[0]
    def set_stock(self, i, n):
        self.con.execute("UPDATE stock SET qty=? WHERE id=?", (n, i))

@pytest.fixture
def con():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE stock (id TEXT PRIMARY KEY, qty INTEGER)")
    c.execute("INSERT INTO stock VALUES ('A', 5)")
    yield c
    c.close()

def test_place_with_real_db(con):
    svc = OrderService(SqlRepo(con), Mock())
    svc.place("a@b.c", "A", 4)
    assert SqlRepo(con).get_stock("A") == 1
```

上記 2 つのファイルで `python -m pytest -q` を実行すると `7 passed` が出力されました (pytest 9.2.0、ローカル実行確認)。

</details>

コードで注目すべき点は 4 つあります。

- `parametrize`: 入力と期待値をテーブル形式で与えると、同じテストが各値ごとに別々に実行されます。境界値（0%、100%）を入れるのが良いです。
- `pytest.raises`: 例外が発生するのが正常な場合を確認します。エラーをどう設計するかは [エラー処理とロギング](#/post/be-error-logging) と続きます。
- `Mock`: メーラーを偽物に変えて、「send がこの引数で一度呼ばれたか」だけ確認します。実際のメールは送信されません。在庫不足時にメールが送られなかったこと (`assert_not_called`) も確認できます。
- `fixture` と `yield`: メモリ SQLite を作成し、テストに渡して、終了時に閉じます。pytest ドキュメントの基準では `yield` 以降のコードが整理 (teardown) され、デフォルト範囲はテスト関数一つなので、各テストで新しい DB が生成されます。そのためテスト同士が互いに影響を与えません。

`test_place_with_real_db` は統合テストに該当する。同じ `OrderService` だが、代わりに実際の SQL が実行される。このテストは SQL 文法が間違っていると失敗し、前述の単体テストでは検出できない。

## API エンドポイントはどのようにテストするか

フレームワークで構築された API の場合、通常はフレームワークが提供するテストクライアントを用いてサーバーを起動せず、リクエストを模倣する。このようなテストはルーティング・検証・シリアライゼーションまで一連の処理を行うため、単体テストよりも統合テストに近い。ステータスコードとレスポンス本文の形式を確認することになるが、これは [API と REST](#/post/be-api-rest) で整理した規約に合致しているか確認する作業である。今回はフレームワークの例示を直接実行していないため、コードは掲載しなかった。

## どこまで実装すべきか

- すべての行をテストしようとはしない。問題が起きる可能性が高い計算（金額・権限・在庫など）から着手する。
- バグを修正する際、そのバグを再現するテストを先に作成して修正する。同じバグが再発することを防ぐ。
- カバーレッジ数値（コードの何％を実行したか）は、「テストでカバーされていない箇所はどこか」を見つけるために使用し、数値が高いから安全だと信じることはしない。実行のみを行って何も確認していないテストでも数値は上昇してしまうためである。
- AI 機能が組み込まれたアプリでは出力が毎回異なるため、`assert 等しい` は通用しない。これは別途 [LLM アプリの評価](#/post/app-eval) で扱っている。

## よくある誤解

- テストを多く実装すればバグがない：テストは「私が想定したケース」のみを確認する。「ないこと」を証明することはできず、「あること」を見つけるだけである。
- Mock を使用すればすべて解決する：偽物が真物と異なる動作をするとテストは通過するが、実際には失敗する。そのため DB などの接続点は統合テストで再度確認する。
- E2E が最も確実なのでそれだけで十分：確かに確実だが、遅く不安定であり、失敗した際に原因箇所を特定するのも難しい。ピラミッドの下部を厚くすべきという理由はここにある。
- テストは開発速度を低下させる：最初は時間がかかるが、コードが大きくなるほど手動での確認時間がさらに増える。ただしどの程度速くなるかはチームやプロジェクトによって異なるため、数値では言及しない。

## 根拠となるリンク

- Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html
- pytest ドキュメント、How to use fixtures: https://docs.pytest.org/en/stable/how-to/fixtures.html

← [概念マップへ](#/post/be-map)

関連記事：[エラー処理とロギング](#/post/be-error-logging) · [レイヤードアーキテクチャ](#/post/be-layered-architecture) · [CI/CD とデプロイ戦略](#/post/cloud-cicd)