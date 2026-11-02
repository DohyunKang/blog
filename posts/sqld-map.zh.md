SQLD 学习笔记合集。第一科是设计（建模），第二科是 SQL。考试时间和报名费用会有变动，请前往官方网站确认。

## 一览顺序

```
1과목 데이터 모델링의 이해
 모델링 → 엔터티·속성 → 관계·식별자 → 정규화·성능
2과목 SQL 기본 및 활용
 SELECT·함수 → 조인·서브쿼리 → GROUP BY·집합 → 윈도우·고급 → DML·DDL → DCL·절차형
```

## 1 科：数据建模

**建模阶段与 ERD**：区分概念、逻辑、物理三个阶段及三范式 Schema。
[详情 → 理解数据建模](#/post/sqld-modeling)

**实体与属性**：掌握分类依据与特征。
[详情 → 实体与属性](#/post/sqld-entity-attr)

**关系与标识符**：将关系分为度（基数）和选择性，将标识符分为 PK 的来源等类别。
[详情 → 关系与标识符](#/post/sqld-relation-identifier)

**规范化与性能**：去除冗余的规范化与故意退化的反规范化。
[详情 → 规范化与性能数据建模](#/post/sqld-norm-perf)

## 2 科：SQL 基础与应用

**SELECT 与函数**：书写顺序、执行顺序及 NULL 值处理。
[详情 → SELECT 与函数](#/post/sqld-select-func)

**连接与子查询**：表之间的关联以及查询内部的嵌套查询。
[详情 → 连接与子查询](#/post/sqld-join-subquery)

**GROUP BY 与集合运算**：聚合、ROLLUP·CUBE、UNION 系列操作。
[详情 → GROUP BY 与集合运算](#/post/sqld-group-set)

**窗口函数与高级 SQL**：排名、LAG、TOP N、层级查询、PIVOT。
[详情 → 窗口函数与高级 SQL](#/post/sqld-window-advanced)

**DML·TCL·DDL 与约束条件**：数据修改、事务提交/回滚、结构定义。
[详情 → DML·TCL·DDL 与约束条件](#/post/sqld-dml-ddl)

**DCL 与过程化 SQL**：权限授予与存储程序。
[详情 → DCL 与过程化 SQL](#/post/sqld-dcl-procedure)

## 相关文章

在 [DB map](#/post/db-map) 中可以阅读关于索引、事务等实战方向的数据库文章。