NoSQL は単一の技術名ではなく、関係型 (RDB) のテーブル形式ではない保存方式を総称する言葉であり、4 つの形態 (Key-Value, Document, Column, Graph) にはそれぞれ得意なことが異なります。

## NoSQL とは何か

名前だけ見ると「SQL が없는 DB（ない DB）」のように思えますが、実際には「関係型テーブルモデルではない DB」に近いものです。一部の製品では SQL に似たクエリ言語を使用することもあります。そのため、定義よりも分類で捉える方が理解しやすいでしょう。

RDB はデータを表（テーブル）に格納し、キーによって連結します。[詳細 → 関係型 DB と SQL の基礎](#/post/db-rdb-sql)正規化を行うと重複がなくなる代わりに、読み込む際にジョインで再度結合する必要があります。[詳細 → 正規化とモデリング](#/post/db-normalization)NoSQL 系は「読み取る際にもそのまま保存しておく」という方向に進むケースが多いです。その代償として、ジョインやトランザクションなどのサポートが弱かったり、 вовсе なかったりする製品もあります。

## 4 つの形態

| 種類 | 保存形式 | 代表的な製品 | 得意なこと |
|---|---|---|---|
| Key-Value | キー 1 つに値 1 つ | Redis | セッション、キャッシュ、カウンター |
| Document | JSON に似たドキュメント | MongoDB | 一塊として読み書きするデータ |
| Column(wide-column) | パーティションキーで分割された行と列は柔軟 | Cassandra | 書き込みが多い大容量分散システム |
| Graph | ノードと関係 | Neo4j | 関係を追跡するクエリ |

### Key-Value

最も単純です。辞書 (dict) のようにキーで挿入し、キーで抽出します。値の中身については DB が気にしないことが多く、そのため高速でシンプルです。キーではなく値で検索することはできません、あるいは高価です。

Redis は Key-Value ですが、値が単なる文字列だけではありません。公式ドキュメントでは Redis を「データ構造サーバー」と紹介しており、値として文字列、ハッシュ、リスト、セット、ソート済みセット (sorted set)、ストリーム、JSON などの複数のデータ構造を提供すると説明しています。キャッシュに関する話は別途あります。[詳細 → キャッシュと Redis](#/post/db-cache-redis)

### Document

JSON 形式のドキュメントを丸ごと保存します。MongoDB のドキュメントでは、同じコレクション内でもドキュメントごとにフィールドが異なっており、フィールドを追加する際に既存のドキュメントを書き換えるかマイグレーションを実行する必要がないと説明されています。必要であればスキーマ検証 (schema validation) で構造を強制することも可能です。つまり「スキーマがない」というよりは、「スキーマを DB ではなくアプリケーション側で管理する」に近いものです。

設計原則として、次の文が挙げられます。「同時にアクセスするデータは一緒に保存する」。注文と注文項目のように常に一緒に読み取るものはドキュメント内に埋め込み (embedding) し、大きくて稀にしか読み込まないものは別途置き参照 (referencing) します。ドキュメントの例としては、商品ページでは最新のレビュー 5 つだけを表示し、全レビューは別のコレクションに格納するケースです。

同じ注文を 2 つの方法で配置すると差が現れます。実行して確認した結果です。

```python
import json, sqlite3

order = {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}
print(json.dumps(order, ensure_ascii=False))
# {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}

db = sqlite3.connect(":memory:")
db.executescript("""
create table orders(id int primary key, user text);
create table order_items(order_id int, sku text, qty int);
insert into orders values (1,'kim');
insert into order_items values (1,'A1',2),(1,'B7',1);
""")
print(db.execute("""select o.user, i.sku, i.qty
  from orders o join order_items i on i.order_id=o.id where o.id=1""").fetchall())
# [('kim', 'A1', 2), ('kim', 'B7', 1)]
```

ドキュメント系は読み込み 1 回で完了しますが、RDB 系では 2 つのテーブルをジョインします。逆に「SKU A1 を購入したすべての注文」を検索したり、商品名を一括変更したりする場合は、データがドキュメントに分散している方がむしろ面倒です。読み込み側に合わせた形状にするなら、他側が不便になるのは仕方ありません。

### Column(wide-column)

名称のせいで「カラム指向分析 DB」と混同されやすいです。ここで言及するのは Cassandra などのワイドカラムストレージです。Cassandra の公式ドキュメントではこれをパーティショニングされたワイドカラムストレージとして説明しています。行の基本キーの最初の部分がパーティションキーであり、この値がその行をクラスターのどのノードが保持するかを決定します。効率的なクエリにはパーティションキーが含まれる必要があります。ドキュメントに外部キーやパーティションを跨ぐジョインがあると説明する箇所はなく、そのため「クエリに合わせてテーブルを作成する」といった設計になります。ドキュメントがこの表現を直接使用していませんでした。

<details>
<summary>Column 系はクエリを先に設計するという点</summary>

RDB はデータ形状を先に整理し、クエリは後に SQL で作成します。パーティションキーで検索する構造では逆に「どのようなクエリを発射するか」が先に出て、そのクエリに適合するテーブルを作成します。同じデータを別のクエリ用途のために一度追加保存することもあります。この説明は Cassandra ドキュメントから直接確認した文ではなく、パーティションキーの構造から理解した内容です。
</details>

### Graph

ノード（人、商品）と関係（フォロー、購入）を保存します。Neo4j のドキュメントによると、ノードはラベルと属性を持ち、関係は方向とタイプがそれぞれ 1 つあり、関係も属性を持つことができます。ドキュメントでは、RDB では JOIN が高価である一方、グラフ DB は関係をノードの隣に直接保存して追跡するため高速であると述べています。

「友の友」クエリを小規模データで検証した。SQLite の再帰クエリと隣接リスト BFS が同じ結果を返した。

```python
db.executescript("""
create table follows(a text, b text);
insert into follows values ('kim','lee'),('lee','park'),('lee','choi'),('park','jung');
""")
q = """
with recursive reach(person, depth) as (
  select 'kim', 0
  union
  select f.b, r.depth+1 from reach r join follows f on f.a=r.person where r.depth<2
)
select person, min(depth) from reach where depth>0 group by person order by 2,1
"""
print(db.execute(q).fetchall())
# [('lee', 1), ('choi', 2), ('park', 2)]
```

2 ステップ以内の探索は SQL でも可能だ。ドキュメントの主旨は、深さが深まりクエリが複雑化するとグラフの方が扱いやすいという点であり、この程度の小規模データで速度差を確認したわけではない。

## 分散が入ると：CAP

NoSQL を話題にすると CAP が連動して出てくる。分散ストレージでは一貫性 (Consistency)、可用性 (Availability)、分割耐性 (Partition tolerance) のうち 2 つしか保証できないという定理だ。Eric Brewer が 2000 年に推測として提示し、2002 年に Gilbert と Lynch が証明した。

ここで言う一貫性は ACID の一貫性と異なる。「読み取った値が最新の書き込みか（あるいはエラー）」という意味だ。[詳細 → トランザクションと隔離レベル](#/post/db-transaction) 可用性は、生存しているノードへのリクエストには応答が返ってくるという意味で、最新値である保証はない。

「3 つのうち 2 つを選ぶ」という表現は誤解を生む。ネットワーク分割は現実では避けられないため、実際の選択は分割が発生した間、一貫性を選ぶか可用性を選ぶかだ。Brewer 自身も後にこの式の理解が誤導されやすいと指摘し、分割がない場合は両方を満たせるという。2010 年に Abadi はこれに PACELC を加えた。分割がある場合は可用性対一貫性、ない場合は遅延 (latency) 対一貫性をどうするかという拡張だ。

そのため「Cassandra は AP、MongoDB は CP」といったステッカーは注意して読むべきだ。設定によって変わる製品が多く、レプリケーションとシャarding に関する話は次の記事に続く。[詳細 → レプリケーションとシャディング](#/post/db-scaling)

## よくある誤解

- NoSQL は SQL が不要：分類名に過ぎず、SQL に似た言語を持つ製品もある。
- NoSQL は RDB より速い：形状が合うクエリでは速いが、合わないクエリではむしろ遅かったりできないたりする。
- スキーマがないため設計も不要：ドキュメント DB でも埋め込むか参照するかを決定する必要があり、決まないとアプリコードに散らばる。
- NoSQL はトランザクションができない：製品によって異なる。

## どのように選ぶか

最初は「NoSQL にするべきか」という問いではなく、「私のクエリはどのような形状か」を先に問うのが正しかった。

| このような状況なら | まず見るべきもの |
|---|---|
| 関係が多く整合性が重要、クエリが頻繁に変化する | RDB |
| キー一つで高速な読み書き、キャッシュ・セッション | Key-Value |
| 一塊として読み取るデータ、フィールドが頻繁に変わる | Document |
| 書き込みが非常に多くパーティションキーのみで検索する | Wide-column |
| 関係を複数段階追う必要がある | Graph |

特別な理由がない限り RDB から始める方が負担が少ない。クエリが自由でトランザクションに対応できるからだ。ベクトル検索のような新たな要件は専用のストレージで別途扱う。[詳細 → ベクトル DB](#/post/db-vector)

← [概念マップへ](#/post/db-map)

関連記事：[インデックス](#/post/db-index) · [キャッシュと Redis](#/post/db-cache-redis) · [レプリケーションとシャディング](#/post/db-scaling)

## 根拠となるリンク

- MongoDB データモデリングの紹介: https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- Redis データタイプ: https://redis.io/docs/latest/develop/data-types/
- CAP 定理 (Wikipedia): https://en.wikipedia.org/wiki/CAP_theorem
- Cassandra アーキテクチャ概要: https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html
- Neo4j グラフ DB の紹介: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/