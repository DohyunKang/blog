SQLD のこの単元は分量が比較的少ない。しかし、GRANT/REVOKE のオプションの違いやロールとは何か、プロシージャ・関数・トリガーの違いなどは頻出問題としてよく登場するため、まとめておく。スケジュールや受験に関する内容は公式サイトで確認すればよい。

SQL コマンドは性質に応じて DDL、DML、TCL、DCL に分類される。前者 3 つについては [DML・TCL・DDL と制約条件](#/post/sqld-dml-ddl) で取り扱ったが、本稿では残りの DCL と手続き型 SQL について述べる。

## DCL とは何か

DCL (Data Control Language) はデータへのアクセス権限を制御するコマンドである。試験に出るものは 2 つある。

| コマンド | 機能 |
|---|---|
| GRANT | ユーザーまたはロールに権限を与える |
| REVOKE | 付与した権限を取り消す |

権限は 2 つのタイプに分けられる。システム権限はテーブル作成やセッション接続などデータベース全体に関する権限であり、オブジェクト権限は特定のテーブルに対する SELECT や UPDATE など、単一のオブジェクトに関する権限である。文法もこれら 2 つで異なる。以下は Oracle 公式ドキュメントに載っている形式だ。

```sql
-- 시스템 권한·롤
GRANT 시스템권한 | 롤 TO 대상 [WITH ADMIN OPTION];

-- 객체 권한
GRANT 객체권한 ON 객체 TO 대상 [WITH GRANT OPTION];
```

対象 (grantee) にはユーザー、ロール、PUBLIC が含まれる。PUBLIC はすべてのユーザーを指す。

## 2 つのオプションが最も混乱しやすい

WITH ADMIN OPTION と WITH GRANT OPTION は名前が似ているが、適用される対象が異なる。試験ではこの 2 つを入れ替えた選択肢がよく出題される。

| | WITH ADMIN OPTION | WITH GRANT OPTION |
|---|---|---|
| 付く場所 | システム権限、ロール | オブジェクト権限 |
| 受け手ができること | その権限・ロールを他の人に与えられる | そのオブジェクト権限を他のユーザーまたはロールに与えられる |
| 制約 | ドキュメント基準では GLOBAL ロールは譲渡できない | ロールに与える際には使用できない |

暗記のポイントはシンプルにまとめた。ADMIN はシステム・ロール、GRANT はオブジェクトである。オプションだけを除去するコマンドは存在しないため、オプションをなくすには権限を完全に取り消し、オプションなしで再度付与する必要がある。

<details>
<summary>REVOKE で連鎖的な取り消しが起きる場合</summary>

オブジェクト権限を取り消すと、連鎖的に削除される。A が B に対して WITH GRANT OPTION を使ってオブジェクト権限を与え、B が C に再度与えた場合、A が B の権限を取り消した際に C の権限も同時に消失する。ドキュメントの例でも、あるユーザーの UPDATE を取り消すと、そのユーザーが譲渡した他のユーザーの権限まで連鎖的に削除される構造であった。そのオブジェクト権限に依存していたプロシージャや関数はそれ以上実行できず、そのオブジェクト上に作成されたビューは無効になる。

システム権限とロールを取り消す際、ドキュメントでは「他の人にも連鎖して広がる」という記述は別途記載されていない。試験では「オブジェクト権限の取り消しは連鎖的だが、システム権限ではない」といった形で区別して問われることが多い。

REVOKE には CASCADE CONSTRAINTS もある。REFERENCES 権限（または ALL）を取り消す際にのみ意味があり、その権限で相手が作成した参照整合性制約も同時に削除する。相手がそのような制約を設けている場合、このオプションは必須となる。

```sql
REVOKE REFERENCES ON hr.employees FROM oe CASCADE CONSTRAINTS;
```
</details>

## ロール (ROLE)

ユーザーごとに個別に権限を与えると、ユーザーが増えるほど管理が難しくなる。ロールとは複数の権限を束ねて名前をつけたものである。ロールに権限を格納しておき、それをユーザーに与えればよい。

- ユーザーにロールを与えると、そのユーザーは当該権限を使用できるようになる。ドキュメントの基準では、セッション内でロールが有効化されている場合に実際に権限が発揮される。
- ロールを他のロールにも与えることができる。すると、受け取るロールには権限が統合される。相互に授受する循環的な付与はできない。
- ロールを PUBLIC に与えると、すべてのユーザーで使用できる。
- ロールには REFERENCES 権限を与えることはできない。

試験では「ロールを使用すれば権限管理が容易になる」という文が正しい選択肢として出題されることが多い。DBMS ごとに事前に用意されたロールが存在し、その名称や構成は製品によって異なるため、使用する DBMS のドキュメントを確認する必要がある。

## 手続き型 SQL

通常の SQL は一文ずつ投げる方式である。手続き型 SQL は変数、条件分岐、反復処理などのプログラミング要素を SQL に組み込み、複数の文を 1 つにまとめ、それをデータベース内に名前をつけて保存する方式である。Oracle では PL/SQL、SQL Server では T-SQL と呼ばれる。保存単位は 3 つある。

| 種類 | 呼び出し方 | 値の返却 | 特徴 |
|---|---|---|---|
| プロシージャ | 明示的に呼び出す | 必須ではない | パラメータを受け取り、複数の作業をまとめる |
| 関数 | 明示的に呼び出す | 1 つの値を返す | 戻り値があるため SQL 文内でも使用できる |
| トリガー | イベント発生時に自動実行 | なし | パラメータも受け取らず、直接呼び出せない |

Oracle ドキュメントでは、トリガーは「テーブルに対する DML などのシステム定義イベントが発生すると、DB が自動的に実行する、DB に格納された命名された PL/SQL ユニット」と説明されています。オン・オフは可能ですが、直接呼び出すことはできず、新しいイベントも定義できません。これがプロシージャや関数との決定的な違いです。

### トリガーの読み方

試験ではトリガーの名前と構成要素に関する問題が出ます。覚えておくべき点は 3 つあります。

- BEFORE / AFTER: イベント文句より先に実行されるか、後に実行されるか。BEFORE トリガーでは値を書き込む前に変更できます。
- 行単位 / 文句単位: `FOR EACH ROW` を付与すると影響を受ける各行ごとに一度ずつ、付与しない場合は文句ごと（ステートメントごと）に一度実行されます。影響を受けた行が 0 件であっても、文句単位のトリガーは一度実行されます。
- :OLD / :NEW: 行の変更前値と後値。行単位トリガーのみで使用します。UPDATE では両方、INSERT では `:NEW`、DELETE では `:OLD` が意味を持ちます。

```sql
CREATE OR REPLACE TRIGGER emp_bi
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  :NEW.created_on := SYSDATE;
END;
/
```

上記は Oracle ドキュメントの例です。行が入力される前に作成日カラムに現在時刻を設定します。

動作を直接確認するために SQLite で同様の構造を実行してみました。SQLite は `:OLD` の代わりに `old.` を使用するなど文法が若干異なりますが、行単位 AFTER UPDATE トリガーが変更前後の値を読み取りログテーブルに蓄積する流れは同じです。

```sql
create table emp(id integer primary key, name text, sal integer);
create table sal_log(emp_id int, old_sal int, new_sal int);
create trigger trg_sal after update of sal on emp for each row
begin insert into sal_log values(old.id, old.sal, new.sal); end;

insert into emp values(1, 'kim', 300);
update emp set sal = 350 where id = 1;
select * from sal_log;   -- (1, 300, 350)
```

給与を 300 から 350 に変更すると、ログに `(1, 300, 350)` が一行蓄積されました。呼び出したことがないのに UPDATE だけでトリガーが実行された点はプロシージャとの違いです。

## よく出るパターン

- オプションのペア合わせ: `ADMIN OPTION` はシステム権限・ロール、`GRANT OPTION` はオブジェクト権限です。書き換えた選択肢は誤りです。
- 回収結果に関する問いかけ: A→B→C とオブジェクト権限が移った後、A が B の権限を回収すると C も消えます。
- ロールの性質: 権限の束であり、管理の利便性のために用意されたものです。ユーザーにも、他のロールにも与えることができます。
- プロシージャ・関数・トリガーの区別: 呼び出すか（プロシージャ・関数）、自動で動くか（トリガー）、値を返すか（関数）。
- トリガー要素: BEFORE/AFTER、行/文句単位、:OLD/:NEW がどのイベントで意味を持つのか。

解答する際は文書内のキーワードから見ていきます。選択肢に「自動的に」があればトリガー、「返却」があれば関数、「オブジェクト」があれば `GRANT OPTION` 側へまず絞り込むと、大抵は 2〜3 つに絞られます。問題で使用されている DBMS が Oracle か SQL Server かも併せて確認します。詳細な文法は製品ごとに異なります。

関連して一緒に読むと良い記事は、制約条件と DDL を扱った [DML・TCL・DDL と制約条件](#/post/sqld-dml-ddl)、基本の SELECT 文法の [SELECT と関数](#/post/sqld-select-func)、そして全体の流れを見る [SQLD map](#/post/sqld-map) です。

← 概念マップへ (#/post/sqld-map)

## 関連リンク

- Oracle Database SQL Language Reference, GRANT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GRANT.html
- Oracle Database SQL Language Reference, REVOKE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/REVOKE.html
- Oracle Database PL/SQL Language Reference, Triggers: https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-triggers.html