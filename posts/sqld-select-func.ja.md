SQLD 2 科目（SQL 基礎および応用）の最初の単元である。SELECT は記述順序と実行順序が異なり、問題は通常その違いや NULL で分かれる。概念は簡単だが、結果を正確に当てる問題が多いので、実際に実行した結果も併せて記載する。

試験日程と受験料は公式サイトで確認できる。この稿では単元の核心と頻出のタイプのみを取り扱う。データモデリングに関する内容は [詳細 → データモデリングの理解](#/post/sqld-modeling) にある。

## 記述順序と実行順序

SELECT 文は以下のように記述する。

```
SELECT 열 → FROM 테이블 → WHERE 조건 → GROUP BY → HAVING → ORDER BY
```

一方、実行の流れは異なる。SQL Server のドキュメントで整理された論理的処理順序は FROM, ON, JOIN, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, TOP である。同ドキュメントでは、実際の物理的な実行はオプティマイザによって決定されるため変化しうると補足している。試験で問われるのはあくまでこの論理的順序だ。

この順序から直ちに導かれるルールがある。

| 状況 | 理由 |
|---|---|
| WHERE で SELECT のエイリアスを使えない | エイリアスは SELECT ステージで生成されるが、WHERE はそれより前であるため |
| ORDER BY ではエイリアスを使える | ORDER BY が SELECT の後にあるため |
| WHERE で集計関数を使えない | グループは WHERE の後に作成される。グループ条件は HAVING であるため |

HAVING と集計については [詳細 → GROUP BY と集合演算](#/post/sqld-group-set) で別途解説する。

## WHERE と演算子

比較には `=, <>, <, >, <=, >=` を使い、範囲・リスト・パターンは以下のように記述する。

| 演算子 | 意味 |
|---|---|
| BETWEEN a AND b | a 以上 b 以下。両端の値を含む |
| IN (a, b, c) | リスト内のいずれかと等しい。OR で結んだものと等しい |
| LIKE | パターン比較。`%` は 0 文字以上、`_` は正確に 1 文字 |
| IS NULL / IS NOT NULL | NULL の有無 |

LIKE は Oracle ドキュメントを基準として大文字小文字を区別し、`ESCAPE` で指定した文字の後の `%` や `_` は一般文字として扱う。例えば `LIKE '_a%'` は 2 番目の文字が a の値である。以下の例データでは `'Park'` が該当する。

論理演算子の優先順位は NOT, AND, OR の順である。AND が OR より先に結合されるため、括弧がないと意図とは異なる解釈になる。次の 2 つのクエリは同じ結果を出すものの、読み方の違いがある。

```
WHERE sal >= 300 AND dept = 'A' OR dept = 'B'     -- (sal>=300 AND dept='A') OR dept='B'
WHERE sal >= 300 AND (dept = 'A' OR dept = 'B')   -- 괄호가 있으면 이쪽
```

問題では、同じ結果が出る偶然なデータが与えられることもあるので、結果だけを見て判断せず、結合順序を考慮して解くのが安全だ。

## NULL が最も間違えやすい

NULL は値がないことを意味し、0 や空文字列でもない。NULL が関与する比較や演算はほぼ NULL（不確定）になる。以下の例は SQLite で実際に実行して確認したものである。

<details>
<summary>サンプルテーブル（SQLite で実行して確認）</summary>

```sql
create table emp(id int, name text, dept text, sal int, comm int);
insert into emp values
 (1,'Kim','A',300,null),
 (2,'Lee','A',250,50),
 (3,'Park','B',400,null),
 (4,'Choi',null,200,0),
 (5,'Jung','B',350,100);
```

</details>

以下は上記テーブルで実行した結果である。

| クエリ | 結果 |
|---|---|
| `WHERE comm = NULL` | 0 件 |
| `WHERE comm IS NULL` | 2 件（id 1, 3） |
| `SELECT sal + comm` | id 1, 3 は NULL、他は値 |
| `COUNT(*)`, `COUNT(comm)` | 5, 3 |
| `AVG(comm)` | 50.0（0, 50, 100 の平均。NULL 行は除外される） |
| `WHERE dept <> 'A'` | id 3, 5（dept が NULL の id 4 は除外される） |
| `WHERE dept NOT IN ('A', NULL)` | 0 件 |

まとめると以下の通りである。

- 比較演算に NULL が含まれると、真でも偽でもない「不確定」となり、行がフィルタリングされる。そのため `= NULL` は常に 0 件になり、`IS NULL` を使う必要がある。
- NULL が関与する算術演算の結果は NULL になる。
- `COUNT(*)` は行数を数え、`COUNT(列)` と `AVG` は NULL をスキップする。合計・平均の問題でこの違いが頻出する。
- `NOT IN` のリストに NULL が一つでも含まれると、どの行も返らない。サブクエリの結果に NULL が混じる場合に頻出の罠である。

## NULL 処理関数

| 関数 | 動作 |
|---|---|
| NVL(a, b) | a が NULL の場合 b、そうでない場合は a（Oracle） |
| COALESCE(a, b, c, ...) | 最初に出てくる NULL でない値。標準 SQL である |
| NULLIF(a, b) | a と b が等しい場合は NULL、異なる場合は a |

NVL は Oracle 関数であり、COALESCE も同様の動作を複数の引数で実行できます。NULLIF は `CASE WHEN a = b THEN NULL ELSE a END` と同等です。よくある使い道は、0 で割ることを避けることです。`total / NULLIF(cnt, 0)` のように使用すると、cnt が 0 の場合は NULL が返されます。

上記のテーブルで実行した結果です。

```sql
select id, sal + coalesce(comm, 0) from emp order by id;
-- (1,300) (2,300) (3,400) (4,200) (5,450)

select id, nullif(comm, 0) from emp order by id;
-- (1,None) (2,50) (3,None) (4,None) (5,100)
```

## 文字・数値関数

試験では結果値を直接問う問題が出るため、引数の意味を正確に理解しておく必要があります。

| 関数 | 説明 |
|---|---|
| UPPER / LOWER | 大文字 / 小文字 |
| LENGTH | 文字数 |
| SUBSTR(文字列，開始位置，長さ) | 開始位置から指定した長さ分取得。長さを省略すると末尾まで |
| REPLACE(文字列，検索値，置換値) | 置換 |
| ROUND(数値，n) | n 桁までの四捨五入。n が負の値の場合は小数点左側の桁 |
| ABS, MOD | 絶対値、剰余 |

SUBSTR は Oracle のドキュメントに基づくと、開始位置が 0 の場合は 1 とみなされ、負の値の場合は文字列の末尾から数えます。`SUBSTR('ABCDEFG', -5, 4)` は `CDEF` になります。

ROUND の負の桁は小数点左側から数えます。Oracle ドキュメントの例では `ROUND(15.193, -1)` は 20 です。負の値については絶対値を四捨五入した後に符号を付与するため、`ROUND(-15.193, -1)` は -20 になります。

## 日付関数

日付はほとんどが Oracle の基準に基づいています。確認したのは `ADD_MONTHS(日付，n)` です。n ヶ月後の日付を返し、開始日がその月の末日であるか、結果となる月にその日がない場合は結果となる月の末日となります。例えば 1 月 31 日に 1 ヶ月加算すると 2 月の末日になります。この末日の規則は試験で罠になりやすいです。

日付形式の変換 (`TO_CHAR`, `TO_DATE`) は形式文字列を暗記するタイプですが、該当ドキュメントの形式要素表を一度確認しておけば十分です。

## CASE

条件分岐には 2 つのパターンがあります。

```sql
select id,
  case when sal >= 350 then 'H' when sal >= 250 then 'M' else 'L' end
from emp order by id;
-- (1,'M') (2,'M') (3,'H') (4,'L') (5,'H')

select id, case dept when 'A' then 1 when 'B' then 2 end
from emp order by id;
-- (1,1) (2,1) (3,2) (4,None) (5,2)
```

上側は条件式を上から見て、最初に真となるものを見つけるとそこで止まります。そのため `sal >= 350` を最初に入れる必要があります。順序を逆転させると 400 も M になります。下側は単一の値と比較する単純な CASE で、どの条件にも一致せず ELSE もない場合は NULL となります。dept が NULL の id 4 が該当します。単純な CASE は `=` 比較であるため、NULL をマッチングできない点も覚えておいてください。

## よく出るパターン

- クエリを与えられ、結果の行数や値を問う問題。NULL 行がどこで除外されるかを追跡する必要があります。
- 実行順序の違いによりエラーになるクエリの選択。WHERE で別칭（エイリアス）を使用したり、集計関数を WHERE に使用したケースです。
- `NOT IN` と NULL の組み合わせ、`= NULL` の比較。
- AND/OR の優先順位によって結果が変わる WHERE 条件。
- 関数に引数を渡した際の動作 (SUBSTR, ROUND, NVL, ADD_MONTHS)。

解答する際は、まず FROM と WHERE で行を絞り込み、次に SELECT で計算された値を確認します。NULL が存在する場合、各行ごとに個別に評価されます。

← 概念マップ ([SQLD map](#/post/sqld-map))

関連記事：[詳細 → ジョインとサブクエリ](#/post/sqld-join-subquery) · [詳細 → GROUP BY と集合演算](#/post/sqld-group-set) · [詳細 → 関係型 DB と SQL の基礎](#/post/db-rdb-sql)

## 参考文献

- [SELECT (Transact-SQL) — Microsoft Learn (論理的処理順序)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql)
- [Oracle NVL](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NVL.html)
- [Oracle NULLIF](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NULLIF.html)
- [Oracle LIKE 条件](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)
- [Oracle SUBSTR](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SUBSTR.html)
- [Oracle ROUND(number)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROUND-number.html)
- [Oracle ADD_MONTHS](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ADD_MONTHS.html)