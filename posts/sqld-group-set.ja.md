SQLD では、GROUP BY のグループ化順序、集計関数と NULL、WHERE と HAVING の実行順序、ROLLUP・CUBE・GROUPING SETS の結果行数、集合演算子の重複処理に関する問題が頻出します。以下の例は DuckDB で直接実行して結果を確認したものです。試験環境（Oracle）との文法の違いについては別途記載しています。

## サンプルテーブル

説明に使用するテーブルには 7 名の従業員がいます。部門 (dept)、職位 (job)、給与 (sal)、手当 (comm) の 4 つの列のみを持っています。

| id | dept | job | sal | comm |
|---|---|---|---|---|
| 1 | SALES | CLERK | 300 | 50 |
| 2 | SALES | CLERK | 320 | NULL |
| 3 | SALES | SENIOR | 400 | NULL |
| 4 | DEV | CLERK | 350 | NULL |
| 5 | DEV | SENIOR | 450 | NULL |
| 6 | DEV | SENIOR | 470 | NULL |
| 7 | HR | CLERK | 310 | NULL |

## 集計関数

集計関数は複数の行を受け取り、単一の値を返します。COUNT、SUM、AVG、MAX、MIN が基本です。

- `COUNT(*)` は行数を数えます。NULL も含めて数えます。
- `COUNT(列)` はその列が NULL でない行のみを数えます。
- SUM、AVG、MAX、MIN は NULL をスキップして計算します。
- 行が存在しない場合、`COUNT` は 0 を、それ以外は NULL を返します。

```sql
SELECT COUNT(*), COUNT(comm), AVG(sal), AVG(comm) FROM emp;
-- 7, 1, 371.43, 50
```

手当がある人は 1 人だけなので `COUNT(comm)` は 1 であり、`AVG(comm)` は 7 で割った値ではなく 50 です。NULL の行が分母から除外されるためです。この部分は定番の罠であり、計算問題が出た場合はまず NULL が何個あるかを確認します。

NULL を 0 と見なし平均を計算したい場合は `AVG(NVL(comm, 0))` のように変更する必要があります。NVL は Oracle 関数です。この話は [詳しく → SELECT 文と関数](#/post/sqld-select-func) でさらに扱っています。

## GROUP BY と HAVING

GROUP BY は指定した列の値が同じ行同士を束ねて、グループごとに 1 行にまとめるものです。ルールは 2 つあります。

- SELECT リストには GROUP BY で使用した列、集計関数、定数のみを含めることができます。それ以外の列を使用すると Oracle は ORA-00979 エラーを発生させます。
- グループを除外する条件は WHERE ではなく HAVING に書きます。WHERE はグループ化前に行を除外し、HAVING はグループ化した後にグループを除外します。

```sql
SELECT dept, COUNT(*), SUM(sal)
FROM emp
GROUP BY dept
HAVING SUM(sal) >= 1000
ORDER BY dept;
-- DEV 3 1270 / SALES 3 1020   (HR은 310이라 빠짐)
```

SQL が実行される論理的順序はこのように覚えると便利です。

| 順序 | クロース | 行うこと |
|---|---|---|
| 1 | FROM | テーブルを指定する |
| 2 | WHERE | 行を除外する |
| 3 | GROUP BY | グループ化する |
| 4 | HAVING | グループを除外する |
| 5 | SELECT | 列を選択する |
| 6 | ORDER BY | ソートする |

ORDER BY が SELECT の後に位置するため、SELECT で付けた別名を ORDER BY でも使用できます。Oracle ドキュメントも別名は ORDER BY のみで使用できると記載しています。

<details>
<summary>WHERE に集計関数を使うとダメな理由</summary>

WHERE は 3（グループ化）よりも前に実行されます。この時点ではまだグループが存在しないため、`SUM(sal)` などの値が存在しません。そのため `WHERE SUM(sal) >= 1000` はエラーになります。同じ条件が「部門合計」ではなく「行単一の値」に関するものであれば WHERE でも使用できます。例えば `WHERE sal >= 400` はグループ化前に給与が 400 以上の行のみを残します。パフォーマンスの観点からも、グループ条件でなければ WHERE で先に絞った方が良いでしょう。

</details>

## ROLLUP, CUBE, GROUPING SETS

GROUP BY 1 つで小計と合計を一度に抽出する拡張構文です。Oracle ドキュメントではこれを UNION ALL で別途まとめる代わりに、1 つのクエリブロックで処理してテーブルを 1 回だけ読み取る方法であると説明しています。

### ROLLUP

`ROLLUP(a, b)` は右側の列から一つずつ取り除ながら小計を作成します。列が n 個あれば集計レベルは n+1 個になります。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
```

| dept | job | SUM(sal) |
|---|---|---|
| DEV | CLERK | 350 |
| DEV | SENIOR | 920 |
| DEV | NULL | 1270 |
| HR | CLERK | 310 |
| HR | NULL | 310 |
| SALES | CLERK | 620 |
| SALES | SENIOR | 400 |
| SALES | NULL | 1020 |
| NULL | NULL | 2600 |

`(dept, job)` 詳細行、`(dept)` 部門小計、`()` 総計が結果に含まれています。列の順序を逆にして `ROLLUP(job, dept)` とすると、小計の基準が職位に変わります。順序が結果を決定するという点は試験でよく出題されます。

### CUBE

`CUBE(a, b)` は列の可能な組み合わせをすべて作成します。列が n 個の場合、2 の n 乗レベルになります。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY CUBE(dept, job)
ORDER BY dept, job;
```

ROLLUP の結果に職位別の小計行がさらに 2 行追加されます。

| dept | job | SUM(sal) |
|---|---|---|
| NULL | CLERK | 1280 |
| NULL | SENIOR | 1320 |

ROLLUP の 9 行目に職位別の 2 行が加わり、合計で 11 行になります。組み合わせが `(dept, job)`, `(dept)`, `(job)`, `()` の 4 つであるためです。CUBE は列の順序を変えても結果行の集合は同じです。

### GROUPING SETS

`GROUPING SETS` は私が指定したグループのみを計算します。小計の中で必要なものだけを選ぶ際に使います。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY GROUPING SETS ((dept), (job))
ORDER BY dept, job;
-- 부서별 3줄 + 직급별 2줄 = 5줄
```

総計も、詳細行も出力されません。指定された `(dept)` と `(job)` のみ出力されます。列の順序が変わっても結果が同じという点は CUBE と同様です。

<details>
<summary>3 つの文法を GROUPING SETS で展開すると</summary>

Oracle ドキュメントに登場する同等な表現です。

- `ROLLUP(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a), ())`
- `CUBE(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a,c), (b,c), (a), (b), (c), ())` (8 個)
- `GROUPING SETS (a, b, (b,c))` = `GROUP BY a` UNION ALL `GROUP BY b` UNION ALL `GROUP BY b, c`

括弧で囲んだ `(b, c)` は 1 つの塊として扱います。`ROLLUP(a, (b, c))` は `(a,b,c)`, `(a)`, `()` の 3 レベルであり、b 単独の小計は出力されません。

</details>

### GROUPING 関数

ROLLUP・CUBE の小計行では該当列が NULL として返されます。しかし実際のデータにも NULL が存在し得るため、NULL を見ただけでは小計かどうかの区別がつきません。`GROUPING(列)` はその NULL が小計によるものである場合は 1、そうでない場合は 0 を返します。

```sql
SELECT dept, job, SUM(sal), GROUPING(dept), GROUPING(job)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
-- DEV / NULL / 1270 / 0 / 1   (직급 자리가 소계)
-- NULL / NULL / 2600 / 1 / 1  (총계)
```

Oracle ドキュメントの例は `DECODE(GROUPING(department_name), 1, 'ALL DEPARTMENTS', department_name)` のように小計行に名前を付ける用途です。同じカテゴリで `GROUPING_ID` は複数の列の GROUPING 値をビットベクトル番号として返し、`GROUP_ID` は重複したグループを区別します。

## 集合演算子

2 つの SELECT 結果を上から下へ結合したり引いたりする演算です。JOIN が列を横に並べたのであれば、集合演算は行を縦方向に扱います。JOIN は [詳細 → JOIN とサブクエリ](#/post/sqld-join-subquery) にあります。

| 演算子 | 結果 | 重複 |
|---|---|---|
| UNION | 和集合 | 除去 |
| UNION ALL | 和集合 | 保持 |
| INTERSECT | 積集合 | 除去 |
| MINUS | 差集合 (前の結果から後の結果を引く) | 除去 |

MINUS は Oracle の名前であり、duckdb や PostgreSQL などの場所では EXCEPT と書きます。以下の結果は EXCEPT を使って取得しました。

```sql
SELECT job FROM emp WHERE dept = 'SALES'
UNION ALL
SELECT job FROM emp WHERE dept = 'DEV';
-- CLERK CLERK SENIOR CLERK SENIOR SENIOR  (6행)

-- UNION이면 CLERK, SENIOR (2행)

SELECT job FROM emp WHERE dept = 'SALES'
INTERSECT
SELECT job FROM emp WHERE dept = 'HR';
-- CLERK

SELECT job FROM emp WHERE dept = 'DEV'
MINUS   -- duckdb에서는 EXCEPT
SELECT job FROM emp WHERE dept = 'HR';
-- SENIOR
```

UNION は重複を排除する処理がさらに 1 回必要になる演算です。重複がないことが分かっている場合は UNION ALL を使う方が簡単です。

Oracle ドキュメントにまとめられたルールは以下の通りです。

- 2 つの SELECT の列数が同じでなければならず、同じ位置の列は同じデータ型グループ（数値・文字）である必要があります。片方にない列は `TO_CHAR(NULL)` などに合わせてください。
- ORDER BY は最後に 1 回だけ使用します。各 SELECT 内では使用できません。
- 演算子の優先順位は同じで、左から処理します。INTERSECT を他の演算子と混ぜる場合は括弧で順序を明確にするとドキュメントに記載されています。

<details>
<summary>解き方の手順</summary>

集合演算の問題はこの順序で解きました。

1. 各 SELECT が返す行をまず個別に記述します。
2. 演算子を左から順に適用します。UNION と INTERSECT、MINUS が混ざっている場合は括弧があるか確認します。
3. 重複除去の有無 (UNION ALL か) を最後に再度確認します。
4. 列数・型が合っていない場合はエラーという選択肢が正解である可能性があります。

</details>

## よく出るパターンのまとめ

- COUNT(*) と COUNT(カラム)、AVG の NULL 処理結果値の計算
- WHERE と HAVING の位置、HAVING を使わず集計関数を WHERE に記述した誤った SQL の見分け方
- GROUP BY に含まれないカラムを SELECT に使用した文がなぜエラーになるのか
- ROLLUP、CUBE、GROUPING SETS の結果行数の計算
- GROUPING 関数の値が 1 である行を見つける方法
- UNION と UNION ALL の結果行数の違い、INTERSECT・MINUS の結果

ウィンドウ関数を用いてグループ内での順位付けを行うのは、[詳細 → ウィンドウ関数と高度な SQL](#/post/sqld-window-advanced) で続きます。試験日程と受験料は公式ウェブサイトでご確認ください。

← 概念マップで (#/post/sqld-map)

関連記事：[SELECT 文と関数](#/post/sqld-select-func) · [結合とサブクエリ](#/post/sqld-join-subquery) · [ウィンドウ関数と高度な SQL](#/post/sqld-window-advanced)

## 根拠リンク

- Oracle Database 19c SQL Language Reference, SELECT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html
- Oracle Database 19c, GROUPING 関数: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GROUPING.html
- Oracle Database 19c, UNION ALL・INTERSECT・MINUS オペレーター: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html
- Oracle Database 19c Data Warehousing Guide, SQL for Aggregation: https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/sql-aggregation-data-warehouses.html