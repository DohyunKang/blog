グラフ DB は、データを表（行・列）ではなく、点（ノード）と線（関係）として保存するデータベースです。Neo4j のドキュメントでは「ノード、関係、属性で保存し、表や文書形式で保存しない」と説明されています。代表的な製品は Neo4j で、クエリ言語は Cypher です。

## 関係型 DB との違い

関係型 DB では「友達の友達」を検索するには、同じテーブルを JOIN でつなげなければなりません。さらに一段階進むと、JOIN が一つ増えます。

```sql
-- 친구(friendship) 테이블을 두 번 JOIN해서 친구의 친구를 찾는 모양
SELECT f2.friend_id
FROM friendship f1
JOIN friendship f2 ON f1.friend_id = f2.user_id
WHERE f1.user_id = 1;
```

Neo4j のドキュメントはこの点を以下のように対比しています。関係型 DB は JOIN でデータを繋ぐため計算コストが大きい演算ですが、グラフ DB は JOIN を使わず、関係をノードの横に直接保存しているといいます。そのため、線に沿って歩く巡回が速いというのがドキュメントの説明です。また、スキーマが固定されていないためモデルを柔軟に変更しやすい点も挙げられています。

| | 関係型 DB | グラフ DB |
|---|---|---|
| 基本単位 | 表の行 | ノードと関係 |
| 関係表現 | 外部キー + JOIN | 関係を直接保存 |
| 得意な質問 | 集計、条件検索、構造化データ | 数段階離れた接続を見つける |
| スキーマ | 事前に固定する | 比較的柔軟 |

「グラフ DB が速い」と暗記すると間違いになります。上記の表のように、質問の形状によって使い分けられます。この点は下の「いつ合うのか」で改めて書きます。

## プロパティグラフモデル

Neo4j が採用しているモデルはプロパティグラフ（property graph）です。要素は 4 つあります。

- ノード：人物、映画などの対象。ラベル（`Person` など）を 0 個以上付けることができます。
- 関係：2 つのノードをつなぐ線。開始ノード、終了ノード、タイプがそれぞれ 1 つ必要で、方向性があります。
- 属性：ノードと関係に付与されるキー - 値ペア。関係にも付く点がポイントです（例：`ACTED_IN` に `role`）。
- ラベル：ノードを束ねる名札。

```
(Keanu:Person {name:'Keanu Reeves'}) -[:ACTED_IN {roles:[...]}]-> (Matrix:Movie {title:'The Matrix'})
```

矢印の方向があっても、クエリでは逆方向や方向なしでも辿ることができます。

## Cypher 例

Cypher は図を描くようにパターンを使います。ノードは括弧 `()`、関係は大括弧 `[]` と矢印です。以下は Neo4j ドキュメントの映画データセットの例文法に従ったものです。

作成。ノードにラベルと属性を与え、既存のノード間に関係を生成します。

```cypher
CREATE (charlie:Person:Actor {name: 'Charlie Sheen'}), (oliver:Person:Director {name: 'Oliver Stone'})

MATCH (charlie:Person {name: 'Charlie Sheen'}), (oliver:Person {name: 'Oliver Stone'})
CREATE (charlie)-[:ACTED_IN {role: 'Bud Fox'}]->(wallStreet:Movie {title: 'Wall Street'})<-[:DIRECTED]-(oliver)
```

検索。パターンに合うものを `MATCH` で捉えて `RETURN` で返します。

```cypher
MATCH (keanu:Person {name:'Keanu Reeves'})
RETURN keanu.name AS name, keanu.born AS born
```

関係の逆方向を辿る。映画から監督へ。

```cypher
MATCH (m:Movie {title: 'The Matrix'})<-[d:DIRECTED]-(p:Person)
RETURN p.name AS director
```

条件とソート。

```cypher
MATCH (bornInEighties:Person)
WHERE bornInEighties.born >= 1980 AND bornInEighties.born < 1990
RETURN bornInEighties.name AS name, bornInEighties.born AS born
ORDER BY born DESC
```

2 つ離れた人物。`--{2}` は「関係 2 回」という固定長のパターンです。前述の SQL で JOIN を 2 回使ったものが、ここでは数字 1 つで済みます。

```cypher
MATCH (tom:Person {name:'Tom Hanks'})--{2}(colleagues:Person)
RETURN DISTINCT colleagues.name AS name, colleagues.born AS bornIn
ORDER BY bornIn
LIMIT 5
```

<details>
<summary>詳細な解説：段階数がわからない場合（可変長）</summary>

ドキュメントの量化（quantified）パスパターンは、反復回数を範囲として指定できます。ドキュメントの例は駅を辿る形状です。

```cypher
(n:Stop)-[:NEXT]->{1,10}(m:Stop)
```

`->{1,10}` は `NEXT` 関係を 1 回から 10 回まで反復するという意味です。人物関係に変えると `(a:Person)-[:KNOWS]->{1,3}(b:Person)` のように書けます。`KNOWS` は私が挙げた例の名前です。

ドキュメントには古式な星印形式（`*1..3`）もまだ残っていますが、GQL 標準に準拠しているのは上記の量化の方だと記載されています。両者の意味は少し異なるため、ドキュメントのリンクされた参照を確認して使う必要があります。

反復回数の上限を設けずに任意の段階を許可すると、グラフが大きい場合結果が爆発する可能性があるため、上限を与える方が安全に見えます。

</details>

## 知識グラフ・LLM との接点

事実を「主語 - 関係 - 目的語」と記述すれば、それがそのままノード - 関係 - ノードとなります。こうして蓄積された事実の網が [知識グラフ](#/post/ai-knowledge-graph) で、それを保存する候補がグラフ DB です。点と線の約束事を定める話は [オントロジー・トリプル](#/post/ai-ontology-triple) で続きます。

[LLM](#/post/ai-llm) とは 2 つの点で結びついています。一つは質問に答える資料をグラフから探し出すことで、文書断片だけを検索する [RAG](#/post/ai-rag) と異なり、関係を追って収集します ([GraphRAG](#/post/ai-graphrag))。もう一つはモデルが自然語の質問を Cypher に変換してくれる点ですが、この際作成されたクエリが間違っていたりスキーマと合わなかったりする可能性があるため、実行前の確認段階が必要です。関係が明示的に保存されているため、どのような経路で答えが出たかを辿ることができ、[ハルシネーション](#/post/ai-hallucination) のチェックが容易になると理解しています。

## 使いどころと合わない場合

合うのは、関係が質問の中心にある場合です。

- 間接的に接続されたものを検索する質問（友人の友人、同じ作品に出演した人物など）
- 「どのように繋がっているか」が答えとなるパスや推薦に関する質問
- 関係の種類が頻繁に増減し、スキーマを固定したくないデータ

逆の場合は当てはまらない。

- 注文や決済のように行を集計して合計値を出す定型業務。これはリレーショナル DB が長年磨き上げられた領域である。
- 関係性がほとんどなく、単一クエリが中心のデータ
- チームが SQL に慣れているのに Cypher は初めてという場合の運用負荷

文書で言及されている利点（JOIN の不要さ、柔軟なモデル）はあくまでグラフ巡回に該当する。そのため、既存のリレーショナル DB を完全に置き換えるよりも、関係性が重要な部分だけを別個にグラフとして扱う構成の方が現実的だと考える。

## よくある誤解

- グラフ DB は SQL より常に高速である：集計や単純なクエリはリレーショナルの方が優れている。「高速」というのは接続を辿るクエリの話だ。
- グラフ DB はスキーマを持たない：それは「柔軟性」を意味するだけで、ノードや関係をどのようにモデル化するかは依然として設計が必要である。文書によれば、ノードにインデックスや制約を適用できるとも言われている。
- グラフ DB を追加すれば LLM の回答が正確になる：グラフに含まれる事実が間違っていたり欠落していたりすれば、そのまま誤った結果となる。グラフを作成することが本業である。

## 根拠リンク

- Neo4j, Graph database concepts: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/
- Neo4j Cypher Manual, Basic queries: https://neo4j.com/docs/cypher-manual/current/queries/basic/
- Neo4j Cypher Manual, CREATE: https://neo4j.com/docs/cypher-manual/current/clauses/create/
- Neo4j Cypher Manual, Variable-length patterns: https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/

← [概念マップ](#/post/ai-map)

関連記事：[知識グラフ](#/post/ai-knowledge-graph) · [GraphRAG](#/post/ai-graphrag) · [RAG](#/post/ai-rag)