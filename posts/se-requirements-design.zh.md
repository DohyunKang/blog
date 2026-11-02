[概述](#/post/cs-sw-engineering)中仅简要浏览了需求、UML 和设计。在此，我们将进一步探讨这三者是如何衔接的。需求回答了“做什么”，设计回答了“做成什么样”；如果设计不能反向验证需求，两者就会脱节。

## 需求分析的工作内容

需求阶段更接近于整理而非单纯记录。不同利益相关者的说法各异，同一词汇含义不同，且存在未言明的假设。因此，通常按以下顺序进行：推导（倾听）→ 分析（发现冲突与遗漏）→ 规格说明（文档化）→ 验证（利益相关者确认）。

功能需求与非功能需求的区分在概述中已涉及。再补充一点：功能是“系统做什么”，非功能则是“系统怎么做”的形态。正如维基百科所述，非功能需求也称为质量属性，必须具体且可衡量。以同样例子说明，展示记录数量是功能，而该数量需多新则是非功能。

非功能需求是选择架构的依据。后续在选择架构风格时，也需首先确定这些质量属性的优先级。

### 用用例描述功能需求

用例描述了外部参与者（人或系统）为实现目标而与系统进行交互的过程。虽然没有固定的格式，但常用形式如下：

| 项目 | 内容 |
|---|---|
| 名称 | 单一用户目标（例如：下单商品） |
| 参与者 | 下单者、支付系统 |
| 主成功场景 | 编号的步骤。每一步代表一次交互 |
| 扩展 | 若主路径在步骤 3 分支，则记为 3a、3b |

步骤中应记录目标与响应（如“下单者确认订单”），而非具体操作（如“点击下单按钮”），并避免提及界面元素。这样即使界面变更，需求依然保持不变。

内容整理遵循 [Fowler 风格的用例说明](https://en.wikipedia.org/wiki/Use_case)。

### 需求 ID 与追溯

为每个需求编号后，可通过表格追踪“该需求由哪个设计要素负责、由哪个测试验证”。这便是追溯（traceability）。缺失的单元格即为漏洞。简单演示如下：

```python
reqs = {"R1": "회원은 이메일로 로그인한다", "R2": "로그인 응답은 1초 안에", "R3": "비밀번호는 해시로 저장한다"}
design = {"R1": ["AuthService.login"], "R2": [], "R3": ["UserRepo.save"]}
tests = {"R1": ["test_login_ok"], "R2": ["test_login_latency"], "R3": []}
for r in reqs:
    gaps = [n for n, m in (("설계", design), ("테스트", tests)) if not m[r]]
    print(r, "OK" if not gaps else "빠짐: " + ",".join(gaps))
```

执行结果为 `R1 OK`、`R2 缺项：设计`、`R3 缺项：测试`。R2 虽有测试，但设计中未规定如何保持 1 秒延迟；R3 虽已实现，却缺乏验证测试。仅用文档管理时，此表也能完成相同工作。

<details>
<summary>良好需求的条件</summary>

- 每句一个需求。“登录并发送通知”应拆分为两个。
- 必须可验证。“快速”不可行，“1 秒内”可行。
- 不得相互冲突。这是分析阶段需过滤的内容。
- 记录需求而非解决方案。“使用 Redis"是设计决策，并非需求。
</details>

## 设计分为两层

设计通常分为确定整体结构的架构设计和定义模块内部细节的详细设计。若需求回答“是什么”，则架构设计决定“如何划分组件及组件间如何通信”。此时非功能需求作用最大，如可扩展性或易变性等要求会推动结构演变。

## UML 基础

UML 是由 OMG 管理的表示法。介绍页面将其描述为用于可视化、规范、构建和文档化分布式对象系统的图形语言。若将图表分为展示结构与展示动作两类来理解，则不易混淆。类、组件、部署属于结构侧；用例、序列、状态、活动图属于动作侧。这种划分遵循标准分类。

概述中已列出表格，此处仅说明阅读方法：

- 类图：方框代表类，连线表示关系（关联、继承、聚合、组合、依赖）。记住“继承是空心三角形箭头”这一形态即可。
- 序列图：自上而下表示时间流逝，横向箭头代表消息。单个用例的主成功场景可直接转换为序列图。
- 状态图：适用于具有状态的对象，如订单从“已接收 → 已支付 → 配送中 → 完成”的状态流转，记录从某事件进入某状态的过程。

按“用例 → 序列 → 类”的顺序向下推导，场景中各步骤变为消息，接收消息方则对应类的某个方法。以此视角观察，各类 UML 图表间的关系比单独记忆更为清晰。

[详情 → 面向对象](#/post/cs-procedural-oop) · [详情 → SOLID 原则](#/post/cs-solid)

已从 [UML 介绍 (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML) 确认定义。

## 架构风格

架构风格是一组具有共同特征的架构集合。它不要求特定的技术。容器与微服务之间确实存在某种程度的契合，但风格的本质在于施加约束。通过限制可能存在的要素及其相互连接方式，遵守这些约束便能获得期望的特性。

以微服务为例，其约束如下：每个服务承担单一职责、服务之间相互独立、数据仅由拥有该数据的服務持有。遵守这些约束后，将变得易于独立部署、隔离故障以及频繁更新。

| 风格 | 处理依赖的方式 | 适用领域 |
|---|---|---|
| N-tier（分层） | 上层仅调用下层 | 传统业务系统、变更不频繁的场景 |
| Web-Queue-Worker | 将 Web 与 Worker 通过队列分离 | 简单领域中包含部分重型处理的场景 |
| 微服务 | 按功能纵向拆分并通过 API 调用 | 复杂领域、频繁变更的场景 |
| 事件驱动 | 将发布者和订阅者通过事件分离 | IoT、实时处理 |

上表分类源自 [Azure Architecture Center 的架构风格指南](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)。其中还包含大数据和大数据计算等内容，因超出软件工程课程范围故已剔除。

文档中反复强调的一点是：复杂度必须与领域相匹配。设计得过于简单会导致依赖无法管理的“大泥球”；反之，微服务则会引入服务发现、数据一致性和分布式系统管理等复杂性，文档指出这更适合具备成熟开发与运维能力的组织。异步消息传递虽然解耦，但也会带来最终一致性和重复消息问题。

[详见 → 分层架构](#/post/be-layered-architecture)

### 直接调用与事件的代码对比

分层架构采用直接调用，而事件驱动架构中调用方并不知晓被调用方。我们使用两种方式实现了相同的订单功能并进行了运行测试。

```python
class Inventory:
    def reduce(self, item): print("재고 감소:", item)
class Mail:
    def send(self, item): print("메일 발송:", item)

class OrderLayered:               # 주문이 두 모듈을 직접 안다
    def __init__(self): self.inv, self.mail = Inventory(), Mail()
    def place(self, item):
        self.inv.reduce(item); self.mail.send(item)

class Bus:
    def __init__(self): self.subs = {}
    def subscribe(self, ev, fn): self.subs.setdefault(ev, []).append(fn)
    def publish(self, ev, data):
        for fn in self.subs.get(ev, []): fn(data)

class OrderEvent:                 # 주문은 이벤트만 낸다
    def __init__(self, bus): self.bus = bus
    def place(self, item): self.bus.publish("order_placed", item)

OrderLayered().place("책")
bus = Bus(); bus.subscribe("order_placed", Inventory().reduce); bus.subscribe("order_placed", Mail().send)
OrderEvent(bus).place("책")
bus.subscribe("order_placed", lambda i: print("포인트 적립:", i))  # 주문 코드는 그대로
OrderEvent(bus).place("펜")
```

运行结果显示，“书”的订单在两种方式下均记录了库存减少和发送邮件；在添加一个订阅后，“笔”的订单额外记录了积分累积。若要使用分层架构实现相同功能，需修改 `OrderLayered.place`。而在事件驱动方式中，调用顺序并未显式体现在代码中，因此需要追踪谁接收了该事件。上述异步与事件的代价在此小示例中同样存在。

## 从需求中选择风格

先选择风格再适配需求是本末倒置。文档建议的顺序是：首先分析问题性质，确定核心业务驱动力及其衍生的非功能性需求（架构特性），然后进行优先级排序并做出选择。例如，若发布时间紧迫，则优先考虑可维护性、测试便利性和可靠性；若预算紧张，则优先追求简单性。一旦选定风格，后期变更成本高昂，因此初期投入更多精力审视是值得的。

## 常见误解

- 需求在最初就全部确定？这是瀑布模型的观点；敏捷开发则以需求变更为前提进行短周期迭代。无论哪种方式，都将可追踪的记录保留下来是相同的。
- 微服务因为是最新技术所以总是更好？它同样存在约束和代价。若领域简单，分层架构或 Web-Queue-Worker 更为合适。
- UML 必须绘制所有内容？只需绘制难以用语言描述的部分。
- 非功能性需求可以稍后考虑？由于结构决定其影响力，必须在设计之前确定。

## 参考链接

- [Non-functional requirement (Wikipedia)](https://en.wikipedia.org/wiki/Non-functional_requirement)
- [Use case (Wikipedia)](https://en.wikipedia.org/wiki/Use_case)
- [About the Unified Modeling Language Specification (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML)
- [Architecture styles (Azure Architecture Center)](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)

相关文章：[软件工程基础](#/post/cs-sw-engineering) · [分层架构](#/post/be-layered-architecture) · [SOLID 原则](#/post/cs-solid)