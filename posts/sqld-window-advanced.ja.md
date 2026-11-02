ウィンドウ関数は、GROUP BY のように行を結合せず、各行に対して計算結果を 1 つずつ付与する関数です。SQLD の 2 科目では、ランク付け、前後の行参照、累積合計、TOP N、階層型クエリ、PIVOT、正規表現がこの単元に含まれます。試験日程と受験料は公式サイトで確認してください。

## ウィンドウ関数とは何か

集計関数はグループごとに結果を 1 行にまとめます。ウィンドウ関数（分析関数）は同じ計算を行いますが、入力行数をそのまま維持します。Oracle のドキュメントの表現では「各行に対して 1 つの結果を返す集計」となります。

形はいつも同じです。

```
함수() OVER ( [PARTITION BY ...] [ORDER BY ...] [윈도잉 절] )
```

- PARTITION BY: グループを分割します。省略すると全体が 1 つのグループになります。GROUP BY と異なり、行は結合されません。
- ORDER BY: グループ内のソート基準です。
- ウィンドウ節 (ROWS/RANGE): 計算に使用する行の範囲です。ORDER BY を指定する必要があります。

実行順序も覚えておくと便利です。ウィンドウ関数は FROM、WHERE、GROUP BY、HAVING の後に評価されます。そのため SELECT 節と ORDER BY 節でのみ使用でき、WHERE 節では使えません。ランク付けでフィルタリングするには一度ラップする必要があります。これが試験で誤答選択肢としてよく出題されるポイントです。

## ランク関数の 3 つ

同点の場合の番号割り当て方が 3 つの関数の違いです。以下は部門別の給与順位を直接実行した結果です（テーブルは仮想データ）。

| ename | deptno | sal | RANK | DENSE_RANK | ROW_NUMBER |
|---|---|---|---|---|---|
| A | 10 | 500 | 1 | 1 | 1 |
| B | 10 | 500 | 1 | 1 | 2 |
| C | 10 | 400 | 3 | 2 | 3 |
| D | 10 | 300 | 4 | 3 | 4 |

- RANK: 同点の場合、同じ番号を割り当て、次の番号を飛ばします (1, 1, 3)。
- DENSE_RANK: 同点の場合、同じ番号を割り当て、飛ばしません (1, 1, 2)。
- ROW_NUMBER: 同点であっても必ず異なる番号になります。同点同士で誰が先か決まっていないため、結果を固定するにはソートキーを追加する必要があります (`ORDER BY sal DESC, ename`)。

```sql
select ename, deptno, sal,
  rank()       over (partition by deptno order by sal desc) rnk,
  dense_rank() over (partition by deptno order by sal desc) drnk,
  row_number() over (partition by deptno order by sal desc, ename) rn
from emp;
```

## 前後の行、累積、比率

- LAG(カラム, n): n 行前の値。LEAD(カラム, n): n 行後の値。最初の行の LAG、最後の行の LEAD は NULL になります（デフォルト値を 3 つ目の引数に渡すことができます）。
- FIRST_VALUE / LAST_VALUE: ウィンドウ内の最初の値と最後の値。
- SUM などの集計関数に OVER を付与すると、累積・移動合計になります。
- RATIO_TO_REPORT(x): グループ合計に対する x の比率。
- NTILE(n): グループを n つの区間に分割します。
- CUME_DIST, PERCENT_RANK: 累積分布と相対順位。

月別売上において、前月の値と次月の値を付与すると以下のようになります。

```sql
select month, amount,
  lag(amount,1)  over (order by month) prev,
  lead(amount,1) over (order by month) nxt
from sales where product='x';
-- (1, 10, NULL, 20) (2, 20, 10, 30) (3, 30, 20, NULL)
```

<details>
<summary>ウィンドウ節の詳細 (ROWS と RANGE, デフォルト範囲)</summary>

境界キーワードは 5 つあります。

| キーワード | 意味 |
|---|---|
| UNBOUNDED PRECEDING | パーティションの最前（開始点のみ） |
| UNBOUNDED FOLLOWING | パーティションの最後（終了点のみ） |
| CURRENT ROW | 現在の行 |
| n PRECEDING | 現在行基準で n 行前 |
| n FOLLOWING | 現在行基準で n 行後 |

- ROWS は物理的な行数で、RANGE は ORDER BY の値の距離（日付間隔など）で範囲を指定します。
- ORDER BY を使用してウィンドウ節を省略すると、デフォルト範囲は `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` になります。そのため `SUM(x) OVER (ORDER BY ...)` は累積合計になります。
- 同点の行がある場合、RANGE では同点の行に同じ結果を与え、ROWS では行順によって結果が異なる可能性があります。
- LAST_VALUE はデフォルト範囲が現在行までであるため、パーティションの真の最終値を取得するには `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` を追加して使用します。

累積合計と比率の例（直接実行した結果）。

```sql
select month, product, amount,
  sum(amount) over (order by month, product
                    rows between unbounded preceding and current row) run,
  sum(amount) over (partition by month) month_total,
  round(100.0*amount/sum(amount) over (partition by month),1) pct
from sales order by month, product;
-- (1,'x',10, 10,15,66.7) (1,'y',5, 15,15,33.3) (2,'x',20, 35,35,57.1) ...
```
</details>

## TOP N

ウィンドウ関数を使った解決策は、ランク付けを行った後、外部クエリでフィルタリングします。

```sql
select * from (
  select ename, deptno, sal,
         rank() over (partition by deptno order by sal desc) rnk
  from emp
) where rnk <= 2;
```

上記仮想データを実行すると、10 番部門では同点の 2 名 (A, B) が 1 位となり、20 番部門では E, F が表示されます。RANK を使用すると同点のため N 名より多くなることがあり、ROW_NUMBER を使用すると正確に N 名になります。試験ではこの違いを問われます。

DBMS によって TOP N の文法全体が異なる点もよく出題されます。

| DBMS | 문법 |
|---|---|
| Oracle | `ROWNUM <= n` (정렬은 서브쿼리 안에서), 12c 이후 `FETCH FIRST n ROWS ONLY` |
| SQL Server | `SELECT TOP (n) ...`, 동점까지 포함하려면 `WITH TIES` |

Oracle 의 `ROWNUM` 은 정렬 전에 번호가 붙기 때문에 `WHERE ROWNUM <= 3 ... ORDER BY` 순서로 쓰면 정렬된 상위 3 개가 아닙니다. 인라인 뷰로 먼저 정렬하고 바깥에서 자릅니다. `FETCH FIRST n ROWS WITH TIES` 는 마지막 행과 동점인 행까지 같이 돌려주고 ORDER BY 가 필요합니다 (Oracle 12c 이후 동작).

## 계층형 질의

조직도, 메뉴, 댓글처럼 부모 - 자식이 한 테이블 안에 있는 데이터를 트리 순서로 읽는 문법입니다. Oracle 은 CONNECT BY 를 사용합니다.

```sql
SELECT last_name, employee_id, manager_id, LEVEL
  FROM employees
  START WITH employee_id = 100
  CONNECT BY PRIOR employee_id = manager_id
  ORDER SIBLINGS BY last_name;
```

| 요소 | 의미 |
|---|---|
| START WITH | 루트 행을 정하는 조건 |
| CONNECT BY | 부모 - 자식 연결 조건. 한쪽에 PRIOR 가 있어야 합니다 |
| PRIOR | 부모 행의 값을 가리키는 연산자 |
| LEVEL | 깊이. 루트가 1 |
| NOCYCLE | 순환이 있어도 에러 대신 행을 돌려줍니다 (없으면 ORA-01436) |
| ORDER SIBLINGS BY | 계층 순서를 유지한 채 형제끼리만 정렬 |
| SYS_CONNECT_BY_PATH(col, '/') | 루트부터 현재 행까지의 경로 |
| CONNECT_BY_ISLEAF | 자식이 없으면 1 |
| CONNECT_BY_ROOT col | 최상위 조상의 값 |

`CONNECT BY PRIOR employee_id = manager_id` 는 부모의 사원번호가 자식의 매니저 번호와 같다는 뜻이라서 위에서 아래로 (순방향) 내려갑니다. PRIOR 를 반대쪽에 붙이면 아래에서 위로 (역방향) 올라갑니다. 방향 문제가 나오면 PRIOR 가 어느 쪽에 붙었는지부터 봅니다. WHERE 조건은 계층을 다 만든 뒤 행마다 적용되고, 일반 ORDER BY 나 GROUP BY 를 쓰면 계층 순서가 깨집니다.

SQL Server 는 CONNECT BY 가 없고 재귀 CTE 를 사용합니다. Oracle 문서도 더 유연한 방법으로 재귀 WITH 를 안내합니다. 아래는 SQLite 에서 직접 돌린 재귀 쿼리입니다 (조직도는 가상 데이터).

```sql
with recursive t(id, name, lvl, path) as (
  select id, name, 1, '/'||name from org where mgr is null
  union all
  select o.id, o.name, t.lvl+1, t.path||'/'||o.name
  from org o join t on o.mgr = t.id)
select * from t order by path;
-- (1,'King',1,'/King') (2,'Kim',2,'/King/Kim') (4,'Park',3,'/King/Kim/Park') (3,'Lee',2,'/King/Lee')
```

첫 SELECT 가 START WITH, 두 번째 SELECT 의 조인 조건이 CONNECT BY, `lvl` 이 LEVEL, `path` 가 SYS_CONNECT_BY_PATH 에 대응한다고 보면 됩니다.

## PIVOT 과 UNPIVOT

PIVOT 은 행을 열로 돌립니다. 집계하면서 돌리기 때문에, 쓰지 않은 컬럼들로 암묵적인 GROUP BY 가 걸립니다.

```sql
SELECT *
FROM (SELECT product, quarter, amount FROM sales)
PIVOT (
  SUM(amount) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2, 'Q3' AS q3, 'Q4' AS q4)
);
```

UNPIVOT 은 반대로 열을 행으로 돌립니다. 기본은 NULL 행을 제외합니다 (`EXCLUDE NULLS`).

```sql
SELECT product, quarter, amount
FROM sales_wide
UNPIVOT (amount FOR quarter IN (q1 AS 'Q1', q2 AS 'Q2', q3 AS 'Q3', q4 AS 'Q4'));
```

PIVOT 문법이 없는 DBMS 에서나 PIVOT 이 나오기 전에 쓰던 방식이 CASE 와 집계 함수를 같이 쓰는 방법입니다. SQLD 시험에는 이쪽도 나옵니다. 직접 돌린 결과입니다.

```sql
select month,
  sum(case when product='x' then amount end) x,
  sum(case when product='y' then amount end) y
from sales group by month;
-- (1,10,5) (2,20,15) (3,30,NULL)
```

해당 조건에 맞는 값이 없으면 SUM 이 NULL 을 돌려준다는 점도 위 결과에서 보입니다 (3 월의 y).

## 정규표현식

Oracle 의 `REGEXP_LIKE(원본, 패턴 [, 옵션])` 은 LIKE 의 정규식 버전이고 POSIX 표준을 따릅니다. 옵션은 한 글자씩입니다.

| 옵션 | 효과 |
|---|---|
| i | 대소문자 구분 안 함 |
| c | 대소문자·악센트 구분 |
| n | `.`이 줄바꿈도 매치 |
| m | `^`, `$`가 각 줄의 시작·끝 |
| x | 패턴의 공백 무시 |

```sql
SELECT first_name FROM employees
WHERE REGEXP_LIKE (first_name, '^Ste(v|ph)en$');   -- Steven, Stephen
```

같은 계열로 REGEXP_INSTR, REGEXP_REPLACE, REGEXP_SUBSTR 이 있습니다. 기호 자체는 일반 정규식과 같습니다 (`^` 시작, `$` 끝, `|` 또는, `()` 그룹). 시험에서는 함수 이름과 기본 기호를 알아보는 정도로 나온다고 보고 준비하면 됩니다.

## 자주 걸리는 부분

- 윈도우 함수는 WHERE 에 못 씁니다. 감싸서 거릅니다.
- RANK 는 번호를 건너뛰고, DENSE_RANK 는 안 건너뛰고, ROW_NUMBER 는 동점도 구분합니다.
- LAG 의 첫 행, LEAD 의 마지막 행은 NULL 입니다.
- PARTITION BY 는 행을 합치지 않습니다.
- 계층형 질의에서 PRIOR 위치가 방향을 정합니다.
- Oracle ROWNUM 은 정렬 전에 매겨집니다.

윈도우 함수를 처음 보면 OVER 안이 복잡해 보이는데, 위 세 칸에 뭘 넣었는지만 보면 읽힙니다.

[← 개념 map 으로](#/post/sqld-map)

関連記事: [GROUP BY と集合演算](#/post/sqld-group-set), [JOIN とサブクエリ](#/post/sqld-join-subquery), [SELECT と関数](#/post/sqld-select-func), [DML・TCL・DDL と制約条件](#/post/sqld-dml-ddl)

## 根拠リンク

- [Oracle Database 19c SQL Language Reference – Analytic Functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Analytic-Functions.html)
- [Oracle Database 19c SQL Language Reference – Hierarchical Queries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Hierarchical-Queries.html)
- [Oracle Database 19c SQL Language Reference – SELECT (PIVOT/UNPIVOT)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html)
- [Oracle Database 19c SQL Language Reference – Pattern-matching Conditions (REGEXP_LIKE)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)