SQLD 学習ノート第 10 回を一堂に集めました。科目 1 は設計（モデリング）、科目 2 は SQL です。試験日程・受験料は変更される可能性があるため、公式ウェブサイトでご確認ください。

## 一目で見る順序

```
1과목 데이터 모델링의 이해
 모델링 → 엔터티·속성 → 관계·식별자 → 정규화·성능
2과목 SQL 기본 및 활용
 SELECT·함수 → 조인·서브쿼리 → GROUP BY·집합 → 윈도우·고급 → DML·DDL → DCL·절차형
```

## 科目 1. データモデリング

**モデリング段階と ERD**: コンセプト・ロジカル・フィジカル段階と 3 つのスキーマを区別します。
[詳しく → データモデリングの理解](#/post/sqld-modeling)

**エンティティと属性**: 分類基準と特徴を把握します。
[詳しく → エンティティと属性](#/post/sqld-entity-attr)

**関係と識別子**: 関係は度数・選択性、識別子は PK の出所に分けて考えます。
[詳しく → 関係と識別子](#/post/sqld-relation-identifier)

**正規化と性能**: 重複を排除する正規化と意図的に戻す反正規化。
[詳しく → 正規化と性能 データモデリング](#/post/sqld-norm-perf)

## 科目 2. SQL 基礎および応用

**SELECT と関数**: 記述順序と実行順序、NULL の処理。
[詳しく → SELECT と関数](#/post/sqld-select-func)

**JOIN とサブクエリ**: テーブルを結合することと、クエリ内のクエリ。
[詳しく → JOIN とサブクエリ](#/post/sqld-join-subquery)

**GROUP BY と集合演算**: 集計、ROLLUP・CUBE、UNION シリーズ。
[詳しく → GROUP BY と集合演算](#/post/sqld-group-set)

**ウィンドウ関数と高度な SQL**: ランク・LAG、TOP N、階層型、PIVOT。
[詳しく → ウィンドウ関数と高度な SQL](#/post/sqld-window-advanced)

**DML・TCL・DDL と制約条件**: データ変更、確定、構造定義。
[詳しく → DML・TCL・DDL と制約条件](#/post/sqld-dml-ddl)

**DCL と手続き型 SQL**: 権限付与と保存プログラム。
[詳しく → DCL と手続き型 SQL](#/post/sqld-dcl-procedure)

## 関連記事

[DB map](#/post/db-map) では、インデックスやトランザクションなど実務的な DB 記事を読むことができます。