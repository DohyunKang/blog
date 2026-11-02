分层架构是根据职责将代码划分为不同层次，且上层仅调用下层的结构。后端最常见的控制器 - 服务 - 仓库模式就是这种形态。

## 这是一种怎样的结构

一个请求进来时，其中的工作往往是混杂在一起的：读取请求、校验值、应用规则、读写数据库、生成响应。如果把这些都塞进一个函数里，起初虽然快，但很快就会变得混乱不堪。因此，需要按工作类型划分层次。

| 层 | 职责 | 常见名称 |
|---|---|---|
| 表现（Presentation） | 接收 HTTP 请求、验证输入格式、构建响应 | 控制器、路由器、处理器 |
| 领域（Domain） | 规则、验证、计算，将多个操作组合成单一单元 | 服务 |
| 数据访问 | 读写数据库及外部存储 | 仓库、DAO |

Martin Fowler 的文章将这一结构划分为表现 / 领域 / 数据访问三个部分。层次是逻辑上的划分，既可以全部放在一台服务器内，也可以物理上分开部署。这与“分层”（tier）的说法无关。

## 依赖方向是关键

仅仅划分了层次并不意味着就是分层架构。必须遵循“上层只调用下层”的规则。

```
컨트롤러 → 서비스 → 리포지토리 → DB
```

控制器知道服务，服务知道仓库，反之则不行。如果仓库调用控制器，或服务直接触碰 HTTP 请求对象，那么划分层次的意義就消失了。如果在服务中混入 HTTP 概念，就无法在 CLI 或批处理任务中复用相同的逻辑。

Fowler 的文章中也提到了变体：在领域和数据之间放置一个映射器（Mapper），使领域层不直接知晓存储层，这种模式常被称为“六边形架构”。本文主要关注基本形态。

## 为什么要划分层次

Fowler 指出的最主要理由是“需要关注的范围缩小了”。观察某一层时，几乎可以忽略其他层。此外还有以下优势：

- **测试**：如果规则集中在服务层，就可以在不依赖 HTTP 或数据库的情况下仅测试规则。在仓库位置注入假对象可以加快测试速度。[详情 → 测试](#/post/be-testing)
- **替换**：同一套服务可以被 Web、移动 API、CLI 共同使用。不过 Fowler 也指出，实际中更换数据库的情况并不多见。
- **职责分离**：容易判断输入校验错误、规则错误、查询错误分别属于哪一层的问题。

## 示例代码

下面用 Python 写了一个简单的下单示例：如果订单总额超过限额则拒绝。

```python
import sqlite3
from dataclasses import dataclass

@dataclass
class Order:
    id: int | None
    user_id: int
    amount: int

class OrderRepository:                      # 데이터 접근
    def __init__(self, conn):
        self.conn = conn
    def save(self, o: Order) -> Order:
        cur = self.conn.execute(
            "INSERT INTO orders(user_id, amount) VALUES (?, ?)", (o.user_id, o.amount))
        return Order(cur.lastrowid, o.user_id, o.amount)
    def total_of(self, user_id: int) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM orders WHERE user_id=?", (user_id,)).fetchone()
        return row[0]

class OrderError(Exception):
    pass

class OrderService:                         # 규칙 + 트랜잭션 경계
    LIMIT = 100_000
    def __init__(self, repo, conn):
        self.repo, self.conn = repo, conn
    def place(self, user_id: int, amount: int) -> Order:
        if amount <= 0:
            raise OrderError("amount must be positive")
        with self.conn:                     # 한 트랜잭션
            if self.repo.total_of(user_id) + amount > self.LIMIT:
                raise OrderError("limit exceeded")
            return self.repo.save(Order(None, user_id, amount))

def post_order(service, body: dict):        # 표현: HTTP와 에러 코드만 안다
    try:
        o = service.place(body["user_id"], body["amount"])
        return 201, {"id": o.id}
    except OrderError as e:
        return 400, {"error": str(e)}
```

亲自运行后，6 万韩元的订单返回 `201`，紧接着的 5 万元订单因超限返回 `400`，负数金额也返回 `400`。即使在仓库位置替换为内存列表构成的假对象，服务依然正常运行。这就是划分层次带来的优势。不过这里并未实际挂载到 Web 框架中进行测试。

整理各层所“知道”与“不知道”的内容如下：

| 层 | 知晓的内容 | 不知晓的内容 |
|---|---|---|
| 控制器 | HTTP 状态码、请求格式 | SQL、存储方式 |
| 服务 | 规则、哪些操作应组合为一个单元 | HTTP、具体的数据库 |
| 仓库 | 查询语句、表结构 | 为何要读取这些数据 |

## 事务放在哪一层

当需要批量处理多个存储操作时，其边界通常设在服务层。因为每个仓库方法只执行一个查询，而界定哪些操作属于一个单元则由了解规则的 service 来决定。上文示例中的 `with self.conn:` 即位于此处。

Spring 文档的示例也是在服务类上添加 `@Transactional`。文档并未明确写道“必须放在服务层”，只是示例如此。文档明确强调的是：注解应加在具体类上，而非接口上。在 AspectJ 模式下，接口上的注解无法被识别，可能导致回滚测试前看似正常，实则被静默忽略。

## 何时过度使用

分层架构并非总是有益的。

- 有时服务仅仅将控制器接收的数据原封不动地传递给仓库，中间没有任何规则。这种情况下，虽然划分了层次，但代码量增加，运行时只是在文件间来回跳转。这在小型 CRUD 应用中很常见。
- 如果每一层都创建独立的对象（DTO、实体）来承载相同数据，并频繁进行转换，会导致样板代码激增。
- 所有规则都集中在服务层，而领域对象仅持有字段的结构，常被称为“贫血领域模型（anemic domain model）”。这一术语据称源自 Fowler 的文章。

Fowler 的文章虽未直接警告过度分层的问题，但指出在大型系统中若将层次作为最高级划分会带来问题，因此建议按领域划分，并在其内部再设层次。此外，他还指出按团队（前端团队、后端团队、DB 团队）划分层次是一种反模式。

如果确立一个标准，那么我认为：只要存在规则，无论规则有多少行，都应保留服务层；而对于完全没有规则的只读 API，则可以减少层级。这仅是我的个人判断，并非出自权威出处。

## 常见误解

- 层级越多越好：层级在职责划分时才有意义。空白的层级只会增加成本。
- 层级等于服务器数量：层级是代码的逻辑划分，与服务器层数（tier）是完全不同的概念。
- 在控制器中编写规则也能运行所以没问题：虽然能运行，但相同的规则需要在其他入口点（如部署、队列消费者）中重复编写。
- 每个表对应一个仓储：这种做法很常见，但这并非铁律。有时也会按聚合单元（例如订单与订单项）来组织。

<details>
<summary>详细解析：单次请求经过各层的顺序</summary>

1. 控制器读取 JSON 正文，检查必填字段是否存在以及类型是否正确。若不符合则返回 400。
2. 调用服务层。服务层会验证金额是否为正数、是否超出限额等规则。违反规则时抛出异常。
3. 服务层开启事务，从仓储读取并保存汇总数据。
4. 若发生异常，事务将被回滚，控制器将异常转换为相应的 HTTP 状态码并响应。

其中，将异常转换为 HTTP 状态码的工作应由表现层负责。如果让服务层直接抛出 `400`，则意味着服务层需要了解 HTTP 协议。错误处理的方式应另行整理。[详情 → 错误处理与日志记录](#/post/be-error-logging)

</details>

## 推荐阅读文章

- [详细 → 请求在服务器端的处理流程](#/post/be-request-flow)
- [详细 → 耦合度与内聚度](#/post/be-coupling-cohesion)
- [详细 → SOLID](#/post/cs-solid)
- [详细 → 设计模式](#/post/cs-design-patterns)

← [概念映射图](#/post/be-map)

## 参考链接

- Martin Fowler, PresentationDomainDataLayering: https://martinfowler.com/bliki/PresentationDomainDataLayering.html
- Spring Framework 文档，使用 @Transactional: https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html
- Martin Fowler, AnemicDomainModel: https://martinfowler.com/bliki/AnemicDomainModel.html