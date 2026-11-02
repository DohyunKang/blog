规范化是将相同事实避免重复记录在多个地方的操作，而 1NF 到 3NF 则是将这一过程划分为三个阶段的规则。

## 为什么要拆分表

最初，人们往往希望像 Excel 一样将所有信息集中在一个表中。例如，如果每一行代表一笔订单，包含客户姓名、邮箱、商品、价格和数量，这样看起来很方便。问题在于，相同的客户邮箱和相同商品价格会在每一行中重复出现。

Microsoft 的文档也以此类话题开篇：规范化是整理数据的过程，它是依据消除重复数据和解决异常依赖的规则来创建表并建立它们之间关系的操作。例如，若要轻松更新客户地址，则应将地址信息仅保留在 Customers 表中的一处。

由重复引发的典型问题通常被归纳为三类（Wikipedia 整理）：

| 名称 | 会发生什么？ |
|---|---|
| 更新异常 | 仅修改部分重复值会导致同一事实产生两个不同的答案 |
| 插入异常 | 若缺少其他数据，则无法录入某些事实（例如：在分配课程前无法录入新教授信息） |
| 删除异常 | 删除一行记录时，连带导致其他相关事实也消失 |

规范化的目的正是预防这些异常结构的发生。这一概念于 1970 年随 Codd 的关系模型一同提出。1NF 确立于当时，2NF 和 3NF 则在 1971 年定义，BCNF 由 Codd 与 Boyce 于 1974 年共同定义。

## 亲手实践示例：将所有数据放在一张表中

我用 SQLite 创建了一个小表，其中包含两笔订单，键盘出现了两次。

```sql
CREATE TABLE flat(order_id INT, customer TEXT, email TEXT,
                  product TEXT, price INT, qty INT);
INSERT INTO flat VALUES
 (1,'민수','m@x.com','키보드',50000,1),
 (1,'민수','m@x.com','마우스',20000,2),
 (2,'지영','j@x.com','키보드',50000,1);
-- 2번 주문의 키보드 가격만 고쳤다
UPDATE flat SET price=55000 WHERE order_id=2 AND product='키보드';
SELECT DISTINCT price FROM flat WHERE product='키보드';
```

结果返回了两行：50000 和 55000，即键盘价格出现了两个值。这就是更新异常的表现形式。

## 1NF、2NF、3NF

若将三个阶段浓缩为一句话，可概括如下：

| 阶段 | 规则 | 违反时会出现的问题 |
|---|---|---|
| 1NF | 每个单元格只存一个值；不创建重复的列（如 Class1, Class2…） | 当项目数量增加到三项时，需额外添加列 |
| 2NF | 若主键由多个字段组成，则仅依赖于主键部分字段的属性应单独拆分 | 商品价格会在每一行订单中重复出现 |
| 3NF | 消除非键属性之间的相互依赖 | 因客户等级导致折扣率在每一行中重复出现 |

Microsoft 文档中的学生示例很好地说明了这一点。最初是一个包含 Class1、Class2、Class3 列的表。在 1NF 阶段，将课程信息逐行展开；在 2NF 阶段，将学生信息与选课信息分离；在 3NF 阶段，由于 Adv-Room（导师房间号）是归属于教授而非学生的属性，因此将其移至 Faculty 表。

我曾混淆过 2NF 和 3NF，后来是这样记忆的：2NF 问的是“是否依赖于整个主键”，而 3NF 问的是“是否仅依赖于主键（未经过其他普通列）”。根据 Wikipedia 的定义，3NF 是指不存在非键属性之间的传递依赖的状态。

<details>
<summary>详细解析：将订单示例拆分至 3NF 的结果</summary>

将上述扁平化表拆分后，会得到四个表：客户、商品、订单、订单项。

```sql
CREATE TABLE customer(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE);
CREATE TABLE product(id INTEGER PRIMARY KEY, name TEXT, price INT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,
                    customer_id INT REFERENCES customer(id));
CREATE TABLE order_item(
  order_id INT REFERENCES orders(id),
  product_id INT REFERENCES product(id),
  qty INT, unit_price INT,
  PRIMARY KEY(order_id, product_id));
```

执行验证后发现以下三点：

- 只需修改一处 product 表中的键盘价格，即可统一为 55000。
- 尝试向不存在的客户 ID 99 插入订单时，会抛出 `FOREIGN KEY constraint failed` 错误（SQLite 需启用 `PRAGMA foreign_keys=ON`）。
- 通过 JOIN 将订单、客户和商品重新关联，结果与最初的扁平表内容一致。

在 order_item 表中单独存储 unit_price 是有意为之的设计。即使商品后续价格变更，历史订单仍应保留当时的价格。虽然这看起来像重复数据，但它代表的是“下单时刻的事实”，因此属于不同性质的数据。这部分设计并非来自文档，而是在构建示例过程中确定的。

</details>

## 绘制 ERD

建模是在拆分表之前，先明确“有哪些实体以及它们如何相互关联”的工作。这种图称为 ERD（实体 - 关系图）。我采用的步骤如下：

1. 提取名词：客户、商品、订单。
2. 列出各实体的属性：例如客户包含姓名和邮箱。
3. 确定关系基数：一名客户可下多个订单（1:N），订单与商品之间是多对多（N:M）关系。
4. N:M 关系需通过中间表解决：因此产生了 order_item 表。

用文本表示大致如下：

```
customer 1 ──< orders 1 ──< order_item >── 1 product
```

其中 `──<` 表示“多个”。与其死记硬背规范化规则，不如从 ERD 出发，先处理 N:M 关系并将属性归位，通常自然就能接近 3NF。不过，这并非我亲自验证的结果，而是手绘过程中产生的直观感受。

## 反规范化

进行规范化后，表的数量会增加，读取数据时所需的 JOIN 操作也随之增多。Microsoft 文档也指出，若严格遵循 3NF，可能会产生大量小表（如城市、邮政编码、负责人等），从而导致性能下降。该文档还建议：仅对频繁变更的数据应用 3NF。

因此，故意允许冗余的做法被称为反规范化。例如：

- 在订单表中预先存储总金额，不在列表画面中计算合计。
- 在文章表中设置评论数量列。

但需要自己负责编写代码来确保数值不出现偏差。这种方法适用于读操作压倒性多且 JOIN 被确认为瓶颈的场景；首先应查看是否可以通过 [索引](#/post/db-index) 解决。为了减少读负载而单独存储值的方法，将在 [缓存](#/post/db-cache-redis) 相关文章中继续讨论。

## 常见误解

- 规范化：分得越多越好：文档指出第三范式（3NF）是大多数应用所需的最高级别，并说明第四范式（4NF）和第五范式（5NF）在实践中很少被考虑。
- 规范化会变慢：JOIN 增多确实可能导致变慢，但这需要测量确认；同时也要评估冗余带来的数据不一致成本。
- 反规范化是设计错误：有意识的反规范化是一种选择；无意识产生的冗余才是问题所在。
- 使用 NoSQL 就不需要规范化：文档型数据库经常采用故意组合存储的建模方式。相关内容在 [NoSQL 文章](#/post/db-nosql) 中讨论。

另外，Microsoft 文档将第四范式（4NF）称为 BCNF，而 Wikipedia 则将 BCNF 描述为比第三范式更严格的独立形式。由于两者表述不同，此处采用 Wikipedia 的解释来理解 BCNF。处理表间关系的 SQL 方法参见 [关系型数据库与 SQL](#/post/db-rdb-sql)，拆分后的表一次性修复所需内容则涉及 [事务](#/post/db-transaction)。

## 参考链接

- Microsoft Learn, Database normalization description: https://learn.microsoft.com/en-us/office/troubleshoot/access/database-normalization-description
- Wikipedia, Database normalization: https://en.wikipedia.org/wiki/Database_normalization

← 概念图 (#/post/db-map)

相关文章：[关系型数据库与 SQL](#/post/db-rdb-sql) · [索引](#/post/db-index) · [NoSQL](#/post/db-nosql)