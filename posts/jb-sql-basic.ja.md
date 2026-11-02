情報処理技術者試験における SQL は、長い文法を記述させるのではなく、短いクエリを示して結果や分類を選ばせる形式で出題されます。そのため、命令がどの分類に属するか、ジョインの種類ごとの結果行数の違い、ビューとインデックスの目的の違いを区別できることが重要です。以下のクエリは、Python に含まれる SQLite で直接実行し、結果を確認しました。試験の基準は Oracle 系文法であり、方言が異なる部分は別途記載します。出題問題の原文は掲載せず、どのような形式で出題されるかのみ記述します。試験日程と受験料は公式サイトで確認してください。

## 分類から暗記する

| 分類 | コマンド | 役割 |
|---|---|---|
| DDL (定義語) | CREATE, ALTER, DROP, TRUNCATE | テーブル・ビュー・インデックスなどのオブジェクトの構造を作成、変更、削除します |
| DML (操作語) | SELECT, INSERT, UPDATE, DELETE | 行を読み込み、追加、修正、削除を行います |
| DCL (制御語) | GRANT, REVOKE | ユーザー権限を付与または取り消します |
| TCL (トランザクション制御語) | COMMIT, ROLLBACK, SAVEPOINT | DML の結果を確定または元に戻します |

試験で分類を問う問題は、ほとんどがこの表そのままです。罠は TRUNCATE です。行を削除するので DML のように思えますが、DDL に分類されます。また、DROP はテーブル構造そのものを消去し、DELETE は行のみを削除します。この違いは選択肢でよく混同させられます。

DDL の ALTER は列の追加・変更・削除に使用します。DROP に付く CASCADE と RESTRICT は参照するオブジェクトがある場合、一緒に削除するか阻止するかを指定するオプションです。

SQL コマンドを分類ごとにさらに詳しくまとめた記事は SQLD にあります。[詳細 → DML・TCL・DDL と制約条件](#/post/sqld-dml-ddl)

## トランザクション制御は短く

TCL は COMMIT、ROLLBACK、SAVEPOINT の 3 つです。SAVEPOINT はトランザクションの途中で名前を付けておき、そこまでの戻しを可能にします。実際に実行して確認した流れは以下の通りです。

```sql
BEGIN;
DELETE FROM emp WHERE emp_id = 1;
SAVEPOINT a;
DELETE FROM emp WHERE emp_id = 2;
ROLLBACK TO a;   -- 2번 삭제만 취소
COMMIT;          -- 1번 삭제는 확정
-- 남은 행: emp_id 2, 3
```

Oracle では BEGIN を使わず最初の DML でトランザクションを開始します。SQLite は上記のように BEGIN を使用します。トランザクションの性質 (ACID) と並行制御については別の記事にあります。[詳細 → 正規化とトランザクション](#/post/jb-normalization-transaction)

## サンプルテーブル

以降のクエリは以下の 2 つのテーブルを基準としています。4 名の従業員のうち choi の部署が NULL であり、人事部には従業員はいません。

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER REFERENCES dept(dept_id));
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'kim',3000,10),(2,'lee',4000,20),
                       (3,'park',5000,20),(4,'choi',2500,NULL);
```

## ジョイン

ジョインは 2 つのテーブルの行を条件で連結します。種類ごとに結果行数が試験のポイントです。

| 種類 | 残す行 | 上記データでの結果 |
|---|---|---|
| INNER JOIN | 両側にペアがある行のみ | kim, lee, park (3 行) |
| LEFT OUTER JOIN | 左側全体、ペアがない場合は NULL | 上記 3 行 + choi(部署 NULL) = 4 行 |
| RIGHT OUTER JOIN | 右側全体 | 人事部が NULL の従業員と共に表示されます |
| FULL OUTER JOIN | 両側全体 | 両側のペアのない行が全て表示されます |
| CROSS JOIN | すべての組み合わせ | 4 × 3 = 12 行 |

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
-- choi|NULL, kim|영업, lee|개발, park|개발

SELECT d.dname, e.ename
FROM dept d LEFT JOIN emp e ON e.dept_id = d.dept_id;
-- 인사|NULL 이 포함된다
```

同じ LEFT JOIN でもテーブルの順序を変えると残る方が異なります。上記 2 つのクエリでは、最初のものは choi が、2 つ目のものは人事部が NULL のペアと共に残りました。RIGHT と FULL は上記表の説明通り読み取れます。

その他、同名の列で自動連結する NATURAL JOIN、同じテーブルをエイリアスとして 2 回使用する SELF JOIN、等号以外の条件で繋ぐ NON-EQUI JOIN などの用語も出題されます。用語だけ区別できれば問題ありません。

ジョインとサブクエリについては SQLD にさらに詳しく解説した記事があります。[詳細 → ジョインとサブクエリ](#/post/sqld-join-subquery)

## GROUP BY と HAVING

グループ化して集計した後で条件を掛けるのは HAVING、グループ化する前に行を除外するのは WHERE です。集計関数は WHERE では使用できません。

```sql
SELECT dept_id, COUNT(*), AVG(sal) FROM emp GROUP BY dept_id;
-- NULL|1|2500.0,  10|1|3000.0,  20|2|4500.0

SELECT dept_id, COUNT(*) FROM emp GROUP BY dept_id HAVING COUNT(*) >= 2;
-- 20|2
```

NULL 部署も GROUP BY では 1 つのグループとしてまとめられます。また `COUNT(*)` と `COUNT(列)` は異なります。上記データでは `COUNT(*)` は 4、`COUNT(dept_id)` は 3 となりました。列名を入れると NULL は数えられません。この違いは計算問題でよく出題されます。

集合演算 (UNION, UNION ALL, INTERSECT, EXCEPT) も同じカテゴリです。UNION は重複を除去し、UNION ALL は残します。[詳細 → グループ・集合演算](#/post/sqld-group-set)

## サブクエリと NULL の罠

サブクエリは括弧内の SELECT です。単一行を返す場合は比較演算子で使い、複数行の場合は IN, ANY, ALL, EXISTS と共に使います。

```sql
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);
-- lee, park      (평균 3625보다 큰 사원)

SELECT dname FROM dept d
WHERE EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);
-- 개발, 영업
```

試験で頻出するトピックは NOT IN と NULL です。サブクエリの結果に 1 つでも NULL が含まれている場合、NOT IN は何行も返しません。

```sql
SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);
-- 결과 없음 (emp.dept_id에 NULL이 있어서)

SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);
-- 인사
```

人事部に社員がいないにもかかわらず、最初のクエリは空の結果を返しました。これは NULL との比較が真でも偽でもない UNKNOWN になるためです。このようなデータでは NOT EXISTS を使うと、同じ問題が発生しません。

## ビュー

ビューは、SELECT 文に名前を付けて保存しておいた仮想テーブルです。データを別途コピーして保存するのではなく、参照するたびに元のテーブルから読み取ります。

```sql
CREATE VIEW v_dev AS SELECT ename, sal FROM emp WHERE dept_id = 20;
SELECT * FROM v_dev;               -- lee 4000, park 5000
UPDATE emp SET sal = 9999 WHERE emp_id = 2;
SELECT * FROM v_dev;               -- lee 9999, park 5000
```

元データを修正すると、ビューの結果も即座に変わりました。試験でビューの特徴として問われる内容は以下の通りです。

| 項目 | 内容 |
|---|---|
| 目的 | セキュリティ（表示する列・行のみ）、複雑なクエリの単純化、論理的独立性 |
| 保存 | 定義(SELECT 文)のみを保存し、データは保存しません |
| 削除 | DROP VIEW。元のテーブルはそのままです |
| 更新 | JOIN や集計関数、DISTINCT が含まれるビューの更新は制限されます (SQLite はビュー自体を読み取り専用として扱います) |
| インデックス | ビューにはインデックスを作成できないとみなすのが一般的な試験解答です |

<details>
<summary>インデックスの有無は DBMS によって異なります</summary>

通常のビューはデータを保存しないため、インデックスの対象にならないという説明が教科書の基本です。逆に、結果を実際に格納する物理ビュー (Materialized View) は別概念であり、インデックスを設けられる DBMS もあります。試験問題で単に「ビュー」と書かれていれば、通常のビューとして解釈します。
</details>

## インデックス

インデックスは、特定の列の値によって行を素早く見つけるための独立した構造です。作成しておくと検索は高速化されますが、INSERT・UPDATE・DELETE の際にもインデックスを更新するため、書き込みは遅くなります。また、保存容量も増えます。

```sql
CREATE INDEX idx_emp_dept ON emp(dept_id);
EXPLAIN QUERY PLAN SELECT * FROM emp WHERE dept_id = 20;
-- SEARCH emp USING INDEX idx_emp_dept (dept_id=?)
```

インデックスを作成する前はテーブル全体をスキャンする方式でしたが、作成後は上記のようにインデックスを追って検索すると実行計画で示されました。試験では、インデックスがどの列に効果的か、クラスタードと非クラスタードの違い、B-Tree 構造などが問われます。実行計画を読み取る問題が出た場合は、「INDEX を使用しているか、全スキャンを行っているか」を区別できれば十分です。

物理設計に関するインデックスやパーティションの内容は別途整理しています。[詳細 → DB 物理設計と分散 DB](#/post/jb-physical-design)。インデックス構造については [詳細 → インデックス](#/post/db-index) でさらに解説しています。

## 制約と整合性

整合性は、データが不正な値にならないように防ぐ規則です。試験では、実体整合性 (主キーは NULL や重複不可)、参照整合性 (外部キーは参照先の値か NULL)、ドメイン整合性 (許可される値の範囲) を区別します。

```sql
DELETE FROM dept WHERE dept_id = 20;
-- FOREIGN KEY constraint failed  (emp가 20번 부서를 참조하는 중)
```

外部キーで参照されている親行を削除しようとしても、参照整合性の制約によりブロックされます。外部キーオプションとして ON DELETE CASCADE (子も同時に削除)、SET NULL (子の外部キーを NULL にする) を設定できます。SQLite では `PRAGMA foreign_keys=ON` をオンにしてこのチェックを行う必要があります。キーの種類とリレーションシップモデルについては [詳細 → データベース基礎とデータモデル](#/post/jb-db-concept) にまとめました。

## DCL

DCL は権限付与 (GRANT) と回収 (REVOKE) の 2 つです。形式は以下の通りです。

```sql
GRANT SELECT, INSERT ON emp TO user1 WITH GRANT OPTION;
REVOKE INSERT ON emp FROM user1;
```

WITH GRANT OPTION を付けて権限を受けたユーザーは、その権限を他のユーザーに再度付与できます。このオプションは試験で単行文問題としてよく出題される素材です。SQLite には GRANT や REVOKE が存在しないため、上記の 2 つの文を実際に実行することはできず、形式のみ記載しました。

## よく出るパターンのまとめ

| パターン | 解法 |
|---|---|
| コマンドのカテゴリを選ぶ | DDL・DML・DCL・TCL の表で即座に判断、TRUNCATE は DDL |
| JOIN 結果の行数 | 基準となる側を確認し、マッチしない行が残るかどうかをチェック |
| GROUP BY 結果 | まず WHERE でフィルタし、次にグループ化、最後に HAVING でフィルタする順序 |
| COUNT 計算 | `COUNT(*)` は全件、`COUNT(列)` は NULL を除く |
| サブクエリ結果 | 内側のクエリ結果を先に求めて、外側に代入する |
| ビュー・インデックスの説明を選ぶ | ビューは仮想でデータ保存なし / インデックスは読み込み高速、書き込み低速 |

結果を問う問題は、データを表に描いて段階を追って手計算するのが最も安全でした。上記の例題を手でまず予想して実行し、正解と照らし合わせるように練習すると良いでしょう。

← [概念マップへ](#/post/jb-map)

関連記事：[正規化とトランザクション](#/post/jb-normalization-transaction) · [DB 物理設計と分散 DB](#/post/jb-physical-design) · [データベース基礎とデータモデル](#/post/jb-db-concept)

## 引用リンク

- SQLite SAVEPOINT 文書：https://www.sqlite.org/lang_savepoint.html
- SQLite CREATE VIEW 文書（SQLite ではビューは読み取り専用）：https://www.sqlite.org/lang_createview.html
- 直接実行：Python 3 内蔵 sqlite3 (SQLite 3.50.4) でこの記事のクエリ結果を確認した。