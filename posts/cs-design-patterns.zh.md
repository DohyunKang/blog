设计模式是对面向对象设计中经常遇到的问题及其解决方案进行命名并收集的产物。乍一看，仅凭名称和分类容易混淆，但结合具体情境理解后就会变得清晰许多。

## 什么是模式

1994 年，Gamma、Helm、Johnson 和 Vlissides 四人合著的《设计模式：可复用面向对象软件的基础》是这一领域的起点。由于有四位作者，他们常被称为 GoF（Gang of Four）。书中收录了 23 种模式。可以将其视为一本将开发者反复使用却未命名的结构进行命名归类的书籍。

模式并非库，而是设计的形态。它不是用来复制粘贴的代码，而更接近于一种技巧：“在这种情境下，这样划分对象会比较方便”。有了名称后，只需说一句“这里用观察者模式”，关于结构的讨论便告一段落，从而缩短了沟通成本。

它与之前整理的 [SOLID 原则](#/post/cs-solid) 关系密切。大多数模式都是对“对扩展开放，对修改关闭”、“依赖接口而非实现”等原则的体现。要读懂模式，首先需要具备 [过程式与面向对象](#/post/cs-procedural-oop) 的感知能力。

## 三大分类

GoF 根据目的将模式分为三类：

| 分类 | 解决什么问题 | 代表模式 |
|---|---|---|
| 创建型 (Creational) | 如何创建对象 | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| 结构型 (Structural) | 如何组合类与对象 | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 行为型 (Behavioral) | 对象间如何分配职责与通信 | Observer, Strategy, Command, State, Iterator, Template Method 等 |

按原著标准，创建型有 5 个，结构型有 7 个，行为型有 11 个，合计 23 个。部分网站（如 Refactoring.guru）介绍时排除了 Interpreter，共 22 个，数量差异似乎源于此。以书籍为准，总数为 23 个更为稳妥。

行为型模式列表（Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor）较长，最容易混淆。以下是逐一解释：

- Chain of Responsibility: 将请求沿对象链传递，直到找到能处理的对象
- Command: 将请求封装为对象，便于存储、撤销或排队
- Iterator: 在不暴露内部结构的前提下逐个遍历元素
- Mediator: 对象间不直接通信，而是通过中介者进行交互
- Memento: 保存状态以便后续恢复（回滚）
- State: 根据状态改变行为，将不同状态分离为独立对象
- Template Method: 算法骨架由父类定义，具体步骤由子类实现
- Visitor: 保持结构不变，仅在上方添加新的操作逻辑

## 通过代码查看典型模式

以下代码均使用 Python 编写并实际运行验证了输出结果。

### Singleton：单例模式

当程序中需要且仅需要一个实例（如配置对象）时使用。

```python
class Config:
    _inst = None
    def __new__(cls):
        if cls._inst is None:
            cls._inst = super().__new__(cls)
            cls._inst.values = {}
        return cls._inst

a, b = Config(), Config()
a.values["mode"] = "dev"
print(a is b, b.values)   # True {'mode': 'dev'}
```

虽然方便，但类似于全局变量，导致测试困难并引入隐式依赖。在多线程环境中，仅靠上述代码是不够的，还需要处理锁机制（此处未进行实际运行验证）。

### Factory Method：工厂方法模式

使得调用方无需知道具体要创建哪个类。

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, msg): ...
class Email(Notifier):
    def send(self, msg): return f"email: {msg}"
class Sms(Notifier):
    def send(self, msg): return f"sms: {msg}"

def make_notifier(kind):
    return {"email": Email, "sms": Sms}[kind]()

print(make_notifier("sms").send("hi"))   # sms: hi
```

严格来说，GoF 中的工厂方法是父类定义创建方法，子类进行覆写的形式。上述代码更接近用函数简化的简单工厂，核心思想可概括为“将对象创建委托给子类”。

### Adapter：适配器模式

当旧代码的方法名与当前使用的不一致时，通过中间层进行适配。

```python
class OldPrinter:
    def print_text(self, s): return f"[old] {s}"
class NewPrinter:
    def __init__(self, old): self.old = old
    def write(self, s): return self.old.print_text(s)

print(NewPrinter(OldPrinter()).write("hello"))   # [old] hello
```

### Decorator：装饰器模式

在不使用继承的情况下为对象添加功能。类似于在咖啡中加入牛奶或浓缩咖啡。

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 500
class Shot:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 700

print(Shot(Milk(Coffee())).cost())   # 4200
```

装饰者和被装饰者拥有相同的接口（此处为 cost），因此可以叠加任意多层。随着组合增多，无需为“牛奶浓缩咖啡”等特定组合单独创建类。

### Observer：观察者模式

当一个对象的状态发生变化时，自动通知所有订阅者。事件处理和通知机制即为此类。

```python
class Subject:
    def __init__(self): self.obs = []
    def subscribe(self, f): self.obs.append(f)
    def notify(self, v):
        for f in self.obs: f(v)

s = Subject()
s.subscribe(lambda v: print("A got", v))
s.subscribe(lambda v: print("B got", v))
s.notify(42)   # A got 42 / B got 42
```

### Strategy：策略模式

适用于存在多种“方式”且需根据情境切换的情况，如折扣计算。

```python
def won(p): return p
def vip(p): return int(p * 0.9)

class Cart:
    def __init__(self, strategy): self.strategy = strategy
    def total(self, p): return self.strategy(p)

print(Cart(won).total(10000), Cart(vip).total(10000))   # 10000 9000
```

如果将原本使用 if-else 进行分支的逻辑提取为对象（此处为函数），那么在添加新方式时就不需要改动现有代码。这是一个完美体现 SOLID 中“开闭原则”的例子，令人印象深刻。

## 容易混淆的成对概念

- **Decorator**与**Proxy**：两者都通过相同的接口进行包装，但意图不同。Decorator 用于添加功能，而 Proxy 用于控制访问（如延迟加载、权限验证等）。
- **Adapter**与**Facade**：Adapter 将一个接口转换为另一种形式，而 Facade 在复杂的多个类之前提供一个简单的统一入口。
- **Strategy**与**State**：结构相似。Strategy 由外部选择并插入算法，而 State 则根据对象自身的状态改变其行为。
- **Factory Method**与**Abstract Factory**：前者用于创建单个产品，后者用于一次性创建一组相互关联的产品。

对于形状相似的这些模式，常有人说应该依据意图而非代码结构来区分。

## 常见误区

- **用得越多越好**：如果系统没有问题却强行套用模式，只会增加类数量并降低可读性。应在需要时才应用。
- **模式仅用于面向对象语言**：书籍多以面向对象为基准，但在像函数可作为值传递的语言中（如上述 Strategy 示例），无需类即可更简洁地实现。
- **记住名字就等于掌握了设计**：知道名称与理解情境是两回事。设计源于对情境的洞察。
- **Singleton 总是好的**：它最容易使用，但也最常受到批评。因为它容易导致全局状态问题。

<details>
<summary>详细解析：通过关键词识别模式</summary>

在识别模式时，通常会思考“这种描述对应哪种模式”。将关键词与模式关联起来能更快判断。

| 描述关键词 | 模式 |
|---|---|
| 单个实例、全局访问 | Singleton |
| 将创建委托给子类 | Factory Method |
| 创建相关对象群 | Abstract Factory |
| 分步组装复杂对象 | Builder |
| 通过现有对象复制生成 | Prototype |
| 接口转换 | Adapter |
| 分离抽象与实现 | Bridge |
| 部分 - 整体树结构 | Composite |
| 动态添加功能 | Decorator |
| 为复杂子系统提供单一入口 | Facade |
| 通过共享同一对象节省内存 | Flyweight |
| 通过代理对象控制访问 | Proxy |
| 向订阅者通知变更 | Observer |
| 替换算法 | Strategy |
| 将请求封装为对象 | Command |

</details>

## 参考链接

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← 概念图 (#/post/cs-map)

相关文章：[SOLID 原则](#/post/cs-solid) · [过程式与面向对象](#/post/cs-procedural-oop) · [耦合度与内聚度](#/post/be-coupling-cohesion)