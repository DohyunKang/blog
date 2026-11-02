在 SQLD 中，本单元的内容量相对较少。不过，GRANT/REVOKE 的选项差异、ROLLBACK（注：原文"롤"在此语境下指角色 ROLE，但根据后文及常见考点，此处应指角色概念；若确为 ROLLBACK 则需调整，结合上下文“ROL이 뭔지”应为角色 ROLE）的定义，以及过程、函数和触发器之间的区别，经常以选择题的形式出现，因此在此进行整理。关于考试日程和报名相关内容，请查阅官方网站。

SQL 命令根据其性质分为 DDL、DML、TCL 和 DCL。前三种在 [DML·TCL·DDL 与约束条件](#/post/sqld-dml-ddl) 中已经讨论过，本文则讲解剩余的 DCL 和过程化 SQL。

## DCL 是什么

DCL（Data Control Language）是用于控制数据访问权限的命令。考试中常考的两个命令如下：

| 命令 | 功能 |
|---|---|
| GRANT | 授予用户或角色权限 |
| REVOKE | 收回已授予的权限 |

权限分为两种类型：系统权限涉及数据库整体，例如创建表或连接会话；对象权限则针对特定对象，例如对某个表执行 SELECT 或 UPDATE。两者的语法也不同。以下是 Oracle 官方文档中的格式：

```sql
-- 시스템 권한·롤
GRANT 시스템권한 | 롤 TO 대상 [WITH ADMIN OPTION];

-- 객체 권한
GRANT 객체권한 ON 객체 TO 대상 [WITH GRANT OPTION];
```

目标（grantee）可以是用户、角色或 PUBLIC。PUBLIC 表示所有用户。

## 两个选项最容易混淆

WITH ADMIN OPTION 和 WITH GRANT OPTION 名称相似，但适用的对象不同。考试中经常会出现将这两个选项互换的干扰项。

| | WITH ADMIN OPTION | WITH GRANT OPTION |
|---|---|---|
| 适用位置 | 系统权限、角色 | 对象权限 |
| 接收者可执行的操作 | 可将该权限或角色授予他人 | 可将该对象权限授予其他用户或角色 |
| 限制 | 根据文档，GLOBAL 角色不可传递 | 不能授予角色 |

记忆方法很简单：ADMIN 对应系统和角色，GRANT 对应对象。由于没有单独的命令来移除选项，若要去除选项，必须先完全收回权限，然后再不带选项地重新授予。

<details>
<summary>REVOKE 中发生级联回收的情况</summary>

回收对象权限时，会级联删除相关权限。如果 A 使用 WITH GRANT OPTION 将对象权限授予 B，而 B 又将其授予 C，那么当 A 收回 B 的权限时，C 的权限也会随之消失。文档示例中显示，当一个用户的 UPDATE 权限被回收时，该用户转授给其他用户的权限也会被一并删除。依赖该对象权限的过程或函数将不再执行，在该对象上创建的视图也会失效。

在回收系统权限和角色时，文档通常不会特别说明会级联到其他用户。考试中常以“对象权限回收是级联的，而系统权限不是”这样的表述进行区分提问。

REVOKE 命令中还包含 CASCADE CONSTRAINTS 选项。它仅在回收 REFERENCES 权限（或 ALL）时有意义，会同时删除对方基于该权限创建的参照完整性约束条件。如果对方已创建此类约束条件，则该选项是必需的。

```sql
REVOKE REFERENCES ON hr.employees FROM oe CASCADE CONSTRAINTS;
```
</details>

## 角色（ROLE）

如果为每个用户单独授予权限，随着用户数量增加，管理会变得困难。角色是将多个权限捆绑并赋予名称的机制。可以将权限存入角色，再将角色授予用户。

- 将角色授予用户后，该用户即可使用其中的权限。根据文档标准，会话中必须启用角色，权限才能实际生效。
- 角色也可以授予其他角色。此时，接收角色的权限会合并到其中。不允许相互循环授予角色。
- 将角色授予 PUBLIC 后，所有用户均可使用。
- 角色不能授予 REFERENCES 权限。

考试中，“使用角色可以简化权限管理”这类陈述通常是正确选项。不同数据库管理系统（DBMS）都预定义了一些角色，其名称和组成因产品而异，请查阅所用 DBMS 的文档进行确认。

## 过程化 SQL

普通 SQL 采用逐条执行语句的方式。过程化 SQL 是将变量、条件语句、循环语句等编程元素引入 SQL，将多条语句组合成一个单元，并将其以命名形式存储在数据库中。Oracle 称之为 PL/SQL，SQL Server 称之为 T-SQL。存储单元有三种类型：

| 类型 | 调用方式 | 返回值 | 特点 |
|---|---|---|---|
| 过程（Procedure） | 显式调用 | 非必需 | 接收参数并执行多个操作 |
| 函数（Function） | 显式调用 | 返回一个值 | 因有返回值，可在 SQL 语句中使用 |
| 触发器（Trigger） | 事件发生时自动执行 | 无 | 无参数且无法直接调用 |

Oracle 文档将触发器（Trigger）描述为：“当发生系统定义的事件（例如针对表的 DML）时，数据库自动执行的、存储在数据库中的命名 PL/SQL 单元”。虽然可以启用或禁用它，但不能直接调用，也无法重新定义事件。这正是它与存储过程（Procedure）和函数（Function）的核心区别所在。

### 如何阅读触发器

考试中常会涉及触发器名称及其组成部分的题目。需要掌握以下三点：

- **BEFORE / AFTER**：指在事件语句执行之前还是之后运行。在 BEFORE 触发器中，可以在写入值之前进行修改。
- **行级 / 语句级**：如果附加 `FOR EACH ROW`，则针对受影响的每一行运行一次；如果不附加，则对每条语句只运行一次。即使受影响的行为数为 0，语句级触发器也会执行一次。
- **:OLD / :NEW**：表示行的旧值和新值。仅在行级触发器中使用。UPDATE 操作两者均有意义，INSERT 仅涉及 :NEW，DELETE 仅涉及 :OLD。

```sql
CREATE OR REPLACE TRIGGER emp_bi
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  :NEW.created_on := SYSDATE;
END;
/
```

以上是 Oracle 文档中的示例。它在插入行之前，将当前时间设置为创建日期列的值。

为了直接验证其行为，我用 SQLite 构建了相同结构进行测试。SQLite 的语法略有不同（例如使用 `old.` 代替 `:OLD`），但其行级 AFTER UPDATE 触发器读取变更前后值并写入日志表的流程是一致的。

```sql
create table emp(id integer primary key, name text, sal integer);
create table sal_log(emp_id int, old_sal int, new_sal int);
create trigger trg_sal after update of sal on emp for each row
begin insert into sal_log values(old.id, old.sal, new.sal); end;

insert into emp values(1, 'kim', 300);
update emp set sal = 350 where id = 1;
select * from sal_log;   -- (1, 300, 350)
```

将薪资从 300 改为 350 后，日志中增加了一行 `(1, 300, 350)`。尽管从未显式调用过该逻辑，仅通过一次 UPDATE 操作就触发了触发器，这正是它与存储过程的不同之处。

## 常见题型

- **选项配对**：`ADMIN OPTION` 用于系统权限和角色（Role），`GRANT OPTION` 用于对象权限。混淆使用的选项是错误的。
- **回收结果**：若对象权限已从 A 传递至 B，再传递至 C，随后 A 回收了授予 B 的权限，则授予 C 的权限也会随之消失。
- **角色的性质**：角色是权限集合，旨在便于管理。既可以授予用户，也可以授予其他角色。
- **存储过程、函数与触发器的区分**：是否可被调用（存储过程/函数）、是否自动执行（触发器）、是否返回值（函数）。
- **触发器要素**：BEFORE/AFTER、行级/语句级、:OLD/:NEW 各自在何种事件中有意义。

解题时，首先关注句子中的关键词。如果选项中包含“自动”，则指向触发器；包含“返回”，则指向函数；包含“对象”，则先缩小至 `GRANT OPTION` 相关选项。通常这样能迅速将选项缩减到两三个。此外，还需注意题目中使用的数据库管理系统是 Oracle 还是 SQL Server，因为具体语法因产品而异。

推荐阅读的相关文章包括：关于约束条件和 DDL 的 [DML·TCL·DDL 与约束条件](#/post/sqld-dml-ddl)、基础查询语法的 [SELECT 与函数](#/post/sqld-select-func)，以及查看整体流程的 [SQLD map](#/post/sqld-map)。

← 概念图 (#/post/sqld-map)

## 参考链接

- Oracle Database SQL Language Reference, GRANT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GRANT.html
- Oracle Database SQL Language Reference, REVOKE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/REVOKE.html
- Oracle Database PL/SQL Language Reference, Triggers: https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-triggers.html