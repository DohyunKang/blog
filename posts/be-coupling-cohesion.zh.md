耦合度衡量的是一个模块内的元素围绕单一目的聚集的程度，而内聚度则衡量模块之间相互了解和依赖的程度。优秀的模块应当具有高内聚和低耦合。

## 通俗解释

用抽屉柜来比喻就更容易理解了。如果一个抽屉里只放袜子，那么它的内聚度高；如果袜子和收据、电池混在一起，则内聚度低。耦合度则是抽屉与抽屉之间的关系。如果要打开袜子抽屉就必须触动电池抽屉内部的格子，这就属于高耦合状态。

用代码来表达就是：

- **内聚度**：在一个类、函数或文件内部，元素为完成同一任务而聚集的程度。越高越好。
- **耦合度**：修改一个模块时导致其他模块一同出错的程度。越低越好。

这两个概念并非孤立存在，而是紧密关联的。如果一个模块被塞入各种杂项任务，其内聚度就会下降；同时，所有需要使用该任务的模块都会依赖它，从而导致耦合度上升。这正是我们在划分模块时使用这两个维度的原因。关于设计原则的内容，请参见 [详细说明 → SOLID](#/post/cs-solid)。

## 为什么要关注

这决定了代码是否易于修改。如果耦合度低，修改一个模块的影响范围就小，且在测试时也容易替换为模拟对象（假对象）。如果内聚度高，就会出现“只需查看这一个文件即可理解此功能”的情况，阅读起来也更轻松。反之，如果两者都很差，修改一处却可能在完全无关的地方引发 bug。关于测试方面的内容，将在 [详细说明 → 测试](#/post/be-testing) 中讨论。

## 内聚度的类型

这是广泛使用的分类法，按从弱到强的顺序排列。Wikipedia 的 cohesion 条目也列出了相同的七个阶段。

| 阶段 | 名称 | 聚集原因 | 示例 |
|---|---|---|---|
| 1 (弱) | 偶然性 | 无特定原因 | `Utils` 类中包含各种函数 |
| 2 | 逻辑性 | 属于相似类别 | 将所有输入处理函数放在一处 |
| 3 | 时间性 | 在同一时间点执行 | 启动时运行的初始化集合 |
| 4 | 过程性 | 按预定顺序执行 | 权限检查后打开文件 |
| 5 | 通信性 | 处理相同数据 | 读写同一订单记录的函数 |
| 6 | 顺序性 | 前一个输出作为后一个输入 | 解析 → 验证 → 转换流水线 |
| 7 (强) | 功能性 | 为了单一功能 | 单个税费计算函数 |

在实际工作中，最常见的是顶部名为 `utils`、`common`、`helper` 等名称的模块。名称越笼统，偶然性内聚的可能性就越大。

## 耦合度的类型

这一部分按从强到弱的顺序阅读。下表对应 Wikipedia coupling 条目中提出的六种类型，并采用了国内常用的命名（内容·公共·外部·控制·标记·数据）。

| 阶段 | 名称 | 说明 |
|---|---|---|
| 1 (强) | 内容耦合 | 直接触碰其他模块的内部代码或数据 |
| 2 | 公共耦合 | 多个模块共享同一全局数据 |
| 3 | 外部耦合 | 共同依赖外部定义的数据格式、协议或设备 |
| 4 | 控制耦合 | 通过传递标志位来控制对方行为 |
| 5 | 标记耦合 (Stamp Coupling) | 整体传递结构体或对象，但仅使用其中一部分 |
| 6 (弱) | 数据耦合 | 仅通过参数传递所需的值 |

在此分类中，数据耦合被认为是最理想的。不过，“零耦合”并不存在。如果模块之间完全互不关联，系统就无法运作。因此目标不是彻底消除耦合，而是将其控制在较弱且可见的形式上。值得一提的是，有些资料将消息耦合（通过队列或事件进行通信）列为单独阶段，但我所参考的文档中并未包含此类分类，故未在表中列出。

<details>
<summary>各耦合度示例代码（展开）</summary>

```python
# 공통 결합: 전역 변수를 여러 함수가 같이 씀
config = {"tax": 0.1}
def price_a(x): return x * (1 + config["tax"])
def price_b(x): return x * (1 + config["tax"])   # config가 바뀌면 둘 다 영향

# 제어 결합: mode 값으로 상대 동작을 정함
def process(order, mode):
    if mode == "pay": ...
    elif mode == "cancel": ...

# 스탬프 결합: 객체 전체를 받지만 이름만 씀
def greet(user):            # user에는 필드가 20개
    return "hi " + user.name

# 자료 결합: 필요한 값만 받음
def greet2(name):
    return "hi " + name
```

控制耦合的产生是因为调用方必须了解被调用方内部的分支逻辑。如果将 `pay` 和 `cancel` 拆分为独立函数，标志位即可消除。

</details>

## 示例与改进

以订单服务为例。首先是高耦合的情况：

```python
class OrderServiceBad:
    def __init__(self):
        self.repo = MySqlRepo()   # 구체 클래스를 안에서 직접 만듦
        self.mailer = Mailer()
    def place(self, order):
        self.repo.save(order)
        self.mailer.send("a@b.c", "ok")
```

若要更改数据库或在测试中禁用邮件发送，必须打开并修改这个类，因为它不仅知道 `MySqlRepo` 和 `Mailer` 的存在，还知晓它们的创建方式。改进方案是将构建工作移出模块，仅接收所需内容。

```python
class OrderService:
    def __init__(self, repo, notifier):   # 의존을 밖에서 주입
        self.repo, self.notifier = repo, notifier
    def place(self, order):
        self.repo.save(order)
        self.notifier.send("a@b.c", "ok")
```

现在可以注入模拟存储库和模拟通知服务进行测试。如下所示直接运行后测试通过：

```python
class FakeRepo:
    def __init__(self): self.saved = []
    def save(self, o): self.saved.append(o)
class FakeNotifier:
    def __init__(self): self.sent = []
    def send(self, to, body): self.sent.append((to, body))

r, n = FakeRepo(), FakeNotifier()
OrderService(r, n).place({"id": 1})
assert r.saved == [{"id": 1}] and n.sent == [("a@b.c", "ok")]
```

这种从外部提供依赖的方式称为依赖注入（DI）。在划分控制器、服务和仓库时，让每一层只看到下一层的接口承诺而非具体实现，也是同样的思路。关于 [详细说明 → 分层架构](#/post/be-layered-architecture) 的内容请继续阅读。请求流经这些模块的路径可在 [详细说明 → 请求流程](#/post/be-request-flow) 中找到。

提高内聚性，从命名开始往往更容易。如果一个模块的名字无法用一句话描述，或者名字中包含“和”，这通常意味着它混合了多个职责。将 `OrderUtils` 拆分为 `PriceCalculator`、`OrderValidator` 等，各自的功能内聚性就会更强。

## 常见误区

- 耦合度越低越好：为了降低耦合而层层叠加接口和层次，反而会让系统更难维护。过度抽象那些变化可能性小的部分也是适得其反。
- 高内聚意味着类很小：这与类的规模无关。即使一个类包含很多方法，只要它们只负责一件事，内聚性就很高。
- 模块切得越细越好：如果一个功能分散在多个文件中，修改该功能时就需要查看多处，这恰恰是内聚性被破坏的表现。
- 分类表直接反映实际业务标准：分类表只是整理思路的工具。在实际工作中，关注“修改这个模块时需要同时改动多少处”更为重要。

## 参考资料链接

- [Coupling (computer programming) - Wikipedia](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
- [Cohesion (computer science) - Wikipedia](https://en.wikipedia.org/wiki/Cohesion_(computer_science))

← [概念地图](#/post/be-map)

相关文章：[分层架构](#/post/be-layered-architecture) · [SOLID](#/post/cs-solid) · [测试](#/post/be-testing)