SOLID 是面向对象设计中五个原则的首字母缩写，旨在让代码在变更时更加稳健。与其说这是一套规则集，不如将其视为一份检查清单：当代码出现异常时，用它来排查原因。

## 术语来源

根据维基百科，Robert C. Martin 于 2000 年在论文《设计原则与设计模式》中介绍了这些基本原则；而"SOLID"这一缩写则由 Michael Feathers 大约在 2004 年提出。

| 字母 | 名称 | 一句话解释 |
|---|---|---|
| S | 单一职责 | 修改类的理由应只有一个 |
| O | 开闭原则 | 对扩展开放，对修改关闭 |
| L | 里氏替换 | 子类对象可替代父类对象且不影响系统正常运行 |
| I | 接口隔离 | 客户端不应依赖其不使用的接口方法 |
| D | 依赖倒置 | 应依赖抽象而非具体类 |

[先阅读 → 过程式编程 vs 面向对象](#/post/cs-procedural-oop) 有助于更好地理解类、继承和接口相关话题。

以下示例将围绕“订单处理”这一场景展开，代码使用 Python 编写并可直接运行以验证结果。

## S：修改理由应唯一

最初的定义为“一个类不应有多个修改理由”。Martin 后来在文章中将其从“人”的角度进行了解释：模块应仅对单一利益相关者（actor）负责。

原文示例为 `Employee` 类。其中 `calculatePay` 由财务部门调用，`reportHours` 由运营部门调用，`save` 由技术部门调用，但这些功能却集中在一个类中。若因一方需求修改代码，可能破坏其他方的功能，因此建议拆分。

将其映射到订单场景：违反原则的是 `Order` 类，它同时负责计算总额、应用折扣、保存至数据库以及发送邮件。看到此类结构时，我通常发现导入列表异常冗长。改进方案十分简单。

```python
@dataclass
class Order:
    items: list  # (이름, 가격)
    def total(self): return sum(p for _, p in self.items)

class OrderRepository:          # 저장만 안다
    def __init__(self): self.rows = []
    def save(self, order): self.rows.append(order)
```

订单仅关注金额，而存储由专门的存储层处理。“折扣率变更”与“数据库变更”发生在不同文件中。

## O：新功能不应影响现有代码

每当新增一种折扣类型，就在 `if` 语句中追加逻辑，这是典型的违反行为。

```python
def checkout_bad(order, kind):
    t = order.total()
    if kind == "vip": return int(t*0.9)
    elif kind == "coupon": return max(t-3000,0)
    return t
```

若新增“优惠券折扣”，就必须修改原本运行良好的函数，甚至可能破坏 VIP 相关逻辑。因此，应将折扣策略提取为独立类，并通过添加新类来支持新政策。

```python
class Discount(ABC):
    @abstractmethod
    def apply(self, price: int) -> int: ...

class NoDiscount(Discount):
    def apply(self, price): return price
class VipDiscount(Discount):
    def apply(self, price): return int(price * 0.9)
class CouponDiscount(Discount):
    def apply(self, price): return max(price - 3000, 0)

def checkout(order, discount: Discount):
    return discount.apply(order.total())
```

对于总价为 14,000 元的订单：
- `checkout_bad(o, "vip")` 返回 12,600  
- `checkout(o, VipDiscount())` 也返回 12,600  
- `CouponDiscount()` 返回 11,000  

结果一致，且引入新折扣时无需修改 `checkout` 函数。该结构与策略模式类似。[详见 → 设计模式](#/post/cs-design-patterns)

## L：子类能否替代父类？

维基百科引用的表述是：“使用基类的函数在派生类出现时仍应正常工作”。虽然继承通常意味着"is-a"关系，但该原则关注的是“行为是否遵守承诺”。

经典反例是正方形。数学中正方形是矩形的一种，但在代码中却可能引发问题。

```python
class Rectangle:
    def __init__(self, w, h): self.w, self.h = w, h
    def set_width(self, w): self.w = w
    def set_height(self, h): self.h = h
    def area(self): return self.w * self.h

class Square(Rectangle):
    def set_width(self, w): self.w = self.h = w
    def set_height(self, h): self.w = self.h = h

def stretch(r):
    r.set_width(5); r.set_height(2)
    return r.area()
```

执行 `stretch(Rectangle(1,1))` 返回 10，而 `stretch(Square(1,1))` 返回 4。`stretch` 函数基于“宽度和高度可独立变化”的假设编写，但 `Square` 违背了这一假设。类型正确但行为不符的情况即为此类。通常的解决方案是放弃继承，将两者设为 `Shape` 的兄弟类，并在父类中仅承诺提供 `area()` 方法。

常见的违反信号包括：子类抛出 `NotImplementedError`，或子类跳过父类方法中的验证逻辑。

## I：只依赖所需接口

原文核心思想是：“不要强制客户端依赖其不使用的接口方法”。若打印机、扫描仪和传真机共用一个接口，则仅具备打印功能的设备也必须实现 `scan()` 方法，通常做法是返回空实现或抛出异常。

```python
class Printer(Protocol):
    def print_doc(self, d): ...
class Scanner(Protocol):
    def scan(self): ...

def run_print(p: Printer, d):      # 인쇄만 필요하면 Printer만 요구
    return p.print_doc(d)
```

测试了仅支持打印的 `OfficePrinter` 与同时支持打印和扫描的 `Combo`，两者在 `run_print` 调用下均通过。接口越小，对实现方和测试时构造模拟对象都越方便。

## D：高层模块不应依赖低层细节

若核心逻辑（如订单处理）直接依赖邮件发送等具体实现，则在更换邮件服务或进行测试时，核心逻辑也会随之波动。因此，逻辑层应依赖抽象接口（如 `Notifier`），而具体实现由外部注入。

```python
class Notifier(ABC):
    @abstractmethod
    def send(self, to, msg): ...

class OrderService:
    def __init__(self, repo, notifier: Notifier):
        self.repo, self.notifier = repo, notifier
    def place(self, order, user, discount: Discount):
        self.repo.save(order)
        paid = checkout(order, discount)
        self.notifier.send(user, f"결제 {paid}원")
        return paid
```

在测试中，加入 `FakeNotifier` 后，`place` 返回了 12,600，并在假对象上积累了 `('a@x.com', '결제 12600원')`，同时向存储库写入了一条记录。这相当于在没有邮件服务器的情况下验证了整个逻辑。这就是依赖注入（通过构造函数传递），而依赖倒置则是“将箭头方向转向内部抽象”的设计原则。两者并非同一回事：注入是一种方法，而倒置更接近目的。关于这一设计原则在分层结构中如何应用，详见 [详细 → 分层架构](#/post/be-layered-architecture)。从测试角度切入，请参见 [详细 → 后端测试](#/post/be-testing)。

## 常见误解

- 类越小越好：S 并不意味着“每个方法对应一个类”。目标是将彼此关联的事物聚合在一起；因此，过度拆分会让阅读者不得不跟随文件跳转而感到疲惫。关于内聚与耦合的讨论，请参见 [详细 → 耦合度·内聚度](#/post/be-coupling-cohesion)。
- 从一开始就要引入接口和抽象类：在不发生变化的地方引入抽象只会增加代码量。如果折扣只有一种类型，使用 `if` 也是可以的。当第二种变体真正出现时，再进行拆分更为稳妥。
- 遵循 SOLID 就是好的设计：原则是工具。它们有时会相互冲突（例如为了 O 而增加抽象会导致代码复杂化），且因语言而异。在支持函数作为值传递的语言中，可以用一个函数替代 `Discount` 类来实现 O。
- L 是关于继承的，所以不使用继承也无妨：这适用于所有实现接口的情况。问题在于“是否遵守相同的契约”。

<details>
<summary>详细解析：违反原则的快速对照表</summary>

| 出现此类迹象时 | 值得怀疑的原则 |
|---|---|
| 一个文件因多人、多种原因频繁修改 | S |
| 每次功能添加都需打开相同的 `if/elif` 进行修改 | O |
| 子类清空父类方法或用异常阻止调用 | L |
| 实现时存在大量空方法 | I |
| 测试中无法剥离外部服务 | D |

无需死记硬背，若在修改过程中遇到表中所述的不便之处，即可联想到对应的原则。该表的“迹象”列是对上述示例中发生事件的简化概括，并非官方列表。

</details>

## 参考链接

- Wikipedia, SOLID: https://en.wikipedia.org/wiki/SOLID
- Robert C. Martin, The Single Responsibility Principle (2014): https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html

← [概念地图](#/post/cs-map)

相关文章：[过程式编程 vs 面向对象](#/post/cs-procedural-oop) · [设计模式](#/post/cs-design-patterns) · [耦合度·内聚度](#/post/be-coupling-cohesion)