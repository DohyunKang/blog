事务是将多个 SQL 语句捆绑为“要么全部成功，要么全部失败”的一个单位，而隔离级别则是设定同时运行的事务之间可以互相看到对方多少中间状态的配置。

## 什么是事务

用转账来理解会很轻松。从 A 账户扣除 30 元并给 B 账户增加 30 元需要两个查询。如果只执行了第一个查询服务器就挂了，那么 30 元就会凭空消失。将这两个查询捆绑在一起，规定“要么都生效，要么都当作没发生过”，这就是事务。

```sql
BEGIN;
UPDATE acc SET bal = bal - 30 WHERE id = 1;
UPDATE acc SET bal = bal + 30 WHERE id = 2;
COMMIT;   -- 문제가 생기면 COMMIT 대신 ROLLBACK
```

执行 `COMMIT` 后，整个事务组被确认；执行 `ROLLBACK` 后，自 `BEGIN` 之后的所有更改全部撤销。我亲自测试过：使用 Python 的 sqlite3 从 A 账户扣除 30 元后故意抛出异常并回滚，余额保持为 `[(1, 100), (2, 0)]` 原样不变。即使中途崩溃，也不会留下半吊子的状态。

## ACID

事务所遵循的四个特性以其首字母缩写称为 ACID。

| 字母 | 名称 | 一句话解释 |
|---|---|---|
| A | Atomicity (原子性) | 要么全部成功，要么全部失败 |
| C | Consistency (一致性) | 结束后约束条件（主键、外键、检查等）不会被破坏 |
| I | Isolation (隔离性) | 同时运行的事务看起来互不干扰 |
| D | Durability (持久性) | 已提交的数据即使发生故障也会保留 |

原子性和持久性相对容易理解。让人困惑的是一致性和隔离性。一致性并不意味着数据库会像魔法一样自动遵守业务规则，而是指它会在事务结束时阻止违反我声明的约束条件。隔离性则存在从“完全无干扰”到“部分可见”的不同阶段，这些阶段就是隔离级别。从这里开始才是本文的重点。

## 并发运行产生的问题

如果事务一个接一个地运行就不会有问题。但如果多个事务同时运行，可能会出现奇怪的情况。PostgreSQL 文档将其定义为四种情况：

- **脏读 (dirty read)**：读取了其他尚未提交的事务的更改。
- **不可重复读 (nonrepeatable read)**：两次读取同一行数据时，由于中间有其他事务提交导致值发生变化。
- **幻读 (phantom read)**：在相同条件下进行两次查询时，由于中间有其他事务提交，导致满足条件的行集合本身发生了变化。
- **序列化异常 (serialization anomaly)**：同时提交的结果与将这些事务按顺序逐个执行的任何顺序都不匹配。

[详情 → 索引](#/post/db-index) 讨论的是查询速度，而这里讨论的是“当同时访问相同数据时能看到什么”。

## 隔离级别

SQL 标准定义了四个隔离级别，每个级别允许上述现象的程度不同。标准基准如下：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 序列化异常 |
|---|---|---|---|---|
| Read Uncommitted | 允许 | 允许 | 允许 | 允许 |
| Read Committed | 不允许 | 允许 | 允许 | 允许 |
| Repeatable Read | 不允许 | 不允许 | 允许 | 允许 |
| Serializable | 不允许 | 不允许 | 不允许 | 不允许 |

级别越高（向上），越宽松且快速；级别越低（向下），越严格且昂贵。但这是标准的最小要求，实际数据库的实现各不相同。查看 PostgreSQL 文档表格可知：

- Read Uncommitted 仅保留了名称，实际上像 Read Committed 一样工作，因此不会发生脏读。
- Repeatable Read 比标准更强，也阻止了幻读，但仍允许序列化异常。
- 默认级别是 Read Committed。文档中提到“每个语句查看新的快照”。

MySQL (InnoDB) 或其他数据库即使使用相同的名称，行为也可能不同。本文仅基于确认过的 PostgreSQL 标准撰写。

## 各隔离级别的区别（PostgreSQL）

在 Read Committed 级别下，`SELECT` 只查看“查询开始前已提交的数据”。如果在同一个事务内执行两次相同的 `SELECT`，而在此期间有其他事务提交了更改，结果可能会不同。

Repeatable Read 会在事务的第一条语句中固定快照。此后的所有 `SELECT` 都会持续查看相同的数据。但如果我试图修改的行已被其他事务先更改并提交，则会引发以下错误：

```
ERROR:  could not serialize access due to concurrent update
```

文档在这种情况下建议：“中止当前事务并从头开始全部重试”。

Serializable 级别在 Repeatable Read（可重复读）的基础上，还能检测出那些因顺序执行而可能导致结果不同的依赖关系，并回滚其中一方。使用此级别时，应用程序需要做好重试的准备；正如文档所述，序列化失败会返回 SQLSTATE `40001`。

总而言之，隔离级别越高，“失败后重试”的责任就越落在应用程序身上。严格性的代价不仅在于性能，更在于需要编写重试代码。

## 仅靠隔离级别无法防止的问题：更新丢失

在讨论隔离级别时，容易忽略的是“更新丢失”（lost update）问题。这通常发生在代码先读取值、进行计算后再覆盖写入的场景中。下面用 Python 进行了复现：一个余额为 100 的账户，两个连接分别尝试扣除 30 和 50，期望最终余额为 20。

```python
x = a.execute("select bal from acc where id=1").fetchone()[0]   # 100
y = b.execute("select bal from acc where id=1").fetchone()[0]   # 100
a.execute("update acc set bal=? where id=1", (x - 30,))
b.execute("update acc set bal=? where id=1", (y - 50,))
# 결과: 50 (기대값 20)
```

由于两者都读到了 100 并各自计算后覆盖写入，导致第一个更新（扣 30）被第二个更新覆盖而丢失。该实验使用 sqlite3 完成（未安装 PostgreSQL，故未测试）。其目的在于展示典型的“读取 - 计算 - 写入”模式下的问题。解决方案是将计算逻辑交由数据库处理。

```python
a.execute("update acc set bal = bal - 30 where id=1")
b.execute("update acc set bal = bal - 50 where id=1")
# 결과: 20
```

`bal = bal - 30` 这一操作由数据库在单个语句内完成读写，因此不会出现覆盖问题。

## 锁：悲观与乐观

当需要基于已读取的值在应用程序中进行判断时，就需要使用锁。主要有两种方式：

**悲观锁**持有一种“冲突可能发生，不如先加锁”的态度。在 PostgreSQL 中，使用 `SELECT ... FOR UPDATE` 来实现。根据文档，被选中的行在当前事务结束前，其他事务无法对其进行锁定、修改或删除；任何此类尝试都将被阻塞，直到当前事务结束。

```sql
BEGIN;
SELECT bal FROM acc WHERE id = 1 FOR UPDATE;   -- 이 행을 잠근다
UPDATE acc SET bal = bal - 30 WHERE id = 1;
COMMIT;
```

**乐观锁**则持有一种“通常不会冲突，先执行操作，提交时再验证”的态度。通常做法是在行中添加一个 `version` 列，仅在读取时的版本号与当前版本一致时才允许更新。

```python
def save(conn, body, ver):
    return conn.execute(
        "update doc set body=?, ver=ver+1 where id=1 and ver=?", (body, ver)
    ).rowcount

save(a, 'A', 1)   # 1  (성공)
save(b, 'B', 1)   # 0  (이미 ver이 2라서 갱신된 행이 없음 -> 충돌)
```

如果 `rowcount` 为 0，说明该行已被他人修改，此时应重新读取并重试。实际运行结果显示：A 返回 1，B 返回 0。

| | 悲观锁 | 乐观锁 |
|---|---|---|
| 方式 | 读取时加锁 | 提交时检查版本 |
| 冲突频繁时 | 等待处理，稳定性高 | 重试次数多，资源浪费 |
| 冲突稀少时 | 仅产生锁开销 | 轻量高效 |
| 注意事项 | 持有时间过长可能导致等待或死锁 | 需要实现重试逻辑 |

与其争论哪种更好，不如根据冲突发生的频率来选择。

## 死锁

使用锁时可能发生死锁（deadlock）。例如：事务 1 修改账户 11111 后试图修改 22222，而事务 2 先修改 22222 再试图修改 11111，双方都会等待对方持有的锁，从而导致永久阻塞。

PostgreSQL 文档指出，数据库会自动检测死锁并终止其中一个相关事务。但无法预测具体哪个事务会被终止。预防措施中首要建议是：“始终按相同顺序获取多个对象的锁”。上述示例中，若两个事务以相同顺序执行更新，则不会发生死锁。如果难以统一顺序，另一种方法是重试因死锁而被终止的事务。此外，文档还警告：在持有锁的情况下等待用户输入，从而长时间保持事务开放的做法并不可取。

在此类场景中，结论依然是“重试”。无论是序列化失败、乐观锁冲突，还是死锁，最终都需通过“从头再来”来恢复。

## 常见误解

- **将操作放入事务就能解决并发问题**：事务保证的是原子性。并发控制由隔离级别和锁机制负责；在默认的 Read Committed（读已提交）级别下，前述的更新丢失等问题仍可能发生。
- **仅使用 Serializable 级别即可解决所有问题**：虽然它能防止冲突，但会导致部分事务失败；若无重试代码，错误将直接暴露给用户。
- **隔离级别的名称在各数据库中含义相同**：标准定义的是最低要求，实际实现各不相同。例如 PostgreSQL 中 Read Uncommitted 实际上按 Read Committed 的行为执行。
- **加锁会变慢，所以最好不用**：在冲突频繁的场景中，合理使用锁反而能有效避免重试风暴。

<details>
<summary>详细解析：为何引入快照和 MVCC</summary>

PostgreSQL 文档将 Read Uncommitted 映射为 Read Committed 的理由是：“这是唯一合理且符合 PostgreSQL 多版本并发控制（MVCC）架构的方式”。其结构是不覆盖写入行，而是保留多个版本，使每个事务只能读取到其自身时间点的版本快照。因此，读操作不会阻塞写操作。正因如此，不存在读取“脏”中间值的可能性。
</details>

我在上方使用 sqlite3 进行的验证也处于类似的语境中：在写入连接提交之前，通过读取连接进行查询，结果仍为 100；而在提交之后，结果变为 999。不过，由于 sqlite 的工作方式与 PostgreSQL 不同，因此未将其用于隔离级别的比较。

</details>

<details>
<summary>详细解析：术语整理</summary>

- **commit**（提交）：确认事务的更改。
- **rollback**（回滚）：取消事务的更改。
- **snapshot**（快照）：基于特定时间点所呈现的数据视图。
- **serializable**（可串行化）：即使并发执行，其结果等同于按顺序串行执行的结果。

</details>

## 参考链接

- PostgreSQL 文档，Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL 文档，Explicit Locking（死锁、SELECT FOR UPDATE）: https://www.postgresql.org/docs/current/explicit-locking.html

← [概念图谱](#/post/db-map)

相关文章：[索引](#/post/db-index) · [关系型数据库与 SQL 基础](#/post/db-rdb-sql) · [规范化与建模](#/post/db-normalization)