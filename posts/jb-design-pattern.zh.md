设计模式是在面向对象设计中为反复出现的问题及其解决方案命名的。在备考信息处理技术员时，将名称、分类和一句话作用进行配对记忆是基本方法。考试日程和报名费用会有变动，请以官方网站为准。

关于如何慢慢深入理解模式本身，已在 [设计模式概念文章](#/post/cs-design-patterns) 中单独整理；本文则是为应试而提炼的各章节核心要点。

## 从骨架开始

1994 年，Erich Gamma、Richard Helm、Ralph Johnson 和 John Vlissides 四人合著的《Design Patterns: Elements of Reusable Object-Oriented Software》一书中收录了 23 个模式。由于有四位作者，他们被称为 GoF（四人帮）。因此，考试中提到的设计模式大多指这 23 个。

这 23 个模式按目的可分为三大类：

| 分类 | 数量 | 要解决的问题 | 模式 |
|---|---|---|---|
| 创建型 | 5 | 如何创建对象 | Abstract Factory, Builder, Factory Method, Prototype, Singleton |
| 结构型 | 7 | 如何组合类与对象 | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 行为型 | 11 | 对象之间如何分配职责与沟通 | Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

Refactoring.guru 将 Interpreter 排除在外，仅列出 10 个行为模式。由于考试教材通常以书籍为准，因此建议按 23 个记忆。

分类名称的记忆顺序很重要，应先熟记“创建型 5 个、结构型 7 个、行为型 11 个”。知道数量后，若漏记某个模式也能立刻察觉。

## 创建型模式一句话总结

- Singleton：只创建一个实例，并在任何地方共享使用它。配置对象是典型例子。
- Factory Method：将对象的创建工作交由子类决定。
- Abstract Factory：在不指定具体类名的情况下，创建一组相互关联的对象（产品族）。
- Builder：分步骤组装复杂对象。相同的组装过程可生成不同的结果。
- Prototype：不重新创建，而是复制已有实例来生成新对象。

容易混淆的是 Factory Method 和 Abstract Factory。若将创建单个产品的方法交给子类实现，则为 Factory Method；若一次性创建多个相关产品的工厂，则为 Abstract Factory。

## 结构型模式一句话总结

- Adapter：适配两个接口不匹配的组件，使其兼容。类似于电源转换适配器。
- Bridge：将抽象部分与实现部分分离，使它们可独立扩展。
- Composite：以相同方式处理部分与整体。文件夹内包含子文件夹和文件的树形结构即为例证。
- Decorator：通过包裹现有对象来添加功能。用组合而非继承来扩展功能。
- Facade：在复杂的子系统前提供一个简单的统一入口。
- Flyweight：共享同一对象以节省内存，避免重复创建。
- Proxy：放置一个代理对象来拦截访问请求。用于访问控制、延迟初始化等场景。

Adapter 和 Facade 看起来尤其相似。Adapter 是将已有接口转换为另一种形式；Facade 则是将多个组件封装起来，创建一个新的简单入口。Decorator 和 Proxy 也都涉及包裹对象，但若添加功能则为 Decorator，若拦截并控制访问则为 Proxy。

## 行为型模式一句话总结

- Chain of Responsibility：像链条一样将请求传递下去，直到有对象能处理它为止。
- Command：将请求本身封装为对象进行存储，支持撤销和队列管理。
- Interpreter：用类表达简单语言的语法并进行解释执行。
- Iterator：在不暴露内部结构的前提下逐个遍历元素。
- Mediator：对象之间不直接通信，而是通过中介者协调。
- Memento：保存对象状态以便后续恢复，常用于撤销（undo）操作。
- Observer：当某个对象状态改变时，通知所有订阅该对象的观察者。
- State：根据当前状态调整行为，将不同状态的行为分离到独立对象中。
- Strategy：将算法封装为对象，便于动态切换。
- Template Method：定义算法的骨架由父类确定，具体步骤由子类实现。
- Visitor：保持结构不变，在其上添加新的操作。

State 和 Strategy 的结构非常相似。如果状态变化时系统能自我改变，那就是 State；如果是使用方选择并装配算法，那就是 Strategy。

## 通过关键词进行配对

将问题理解为“给出描述并选择模式名称”，这样学习会更容易。可以将描述中的核心词汇与模式进行如下配对：

| 描述中出现的词汇 | 模式 |
|---|---|
| 单一实例、全局访问 | Singleton |
| 复制 | Prototype |
| 分步组装 | Builder |
| 产品族 | Abstract Factory |
| 子类决定创建对象 | Factory Method |
| 接口转换 | Adapter |
| 抽象与实现分离 | Bridge |
| 树形结构、部分 - 整体 | Composite |
| 功能叠加 | Decorator |
| 单一入口 | Facade |
| 共享以节省内存 | Flyweight |
| 代理 | Proxy |
| 责任链传递 | Chain of Responsibility |
| 将请求封装为对象 | Command |
| 遍历 | Iterator |
| 协调者 | Mediator |
| 状态保存与恢复 | Memento |
| 变更通知 | Observer |
| 针对不同状态的行为 | State |
| 算法替换 | Strategy |
| 骨架与具体步骤 | Template Method |
| 将运算移至结构之外 | Visitor |
| 语法解释 | Interpreter |

## 应对代码阅读问题

有时题目不会直接给出模式名称，而是展示代码。此时应观察类之间是如何关联的。以下代码已实际运行并验证了输出结果。

### Decorator 是层层包裹的结构

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, c): self.c = c
    def cost(self): return self.c.cost() + 500

print(Milk(Milk(Coffee())).cost())   # 4000
```

具有相同方法的对象内部包含另一个对象，并在调用时累加值。就像牛奶被包裹了两次，因此是 3000 + 500 + 500。

### Observer 是遍历订阅列表的结构

```python
class Subject:
    def __init__(self): self.obs = []
    def attach(self, o): self.obs.append(o)
    def notify(self, v):
        for o in self.obs: o(v)

s = Subject()
s.attach(lambda v: print("A", v))
s.attach(lambda v: print("B", v))
s.notify(7)
# A 7
# B 7
```

通知按注册顺序依次发出。如果遇到询问输出顺序的问题，只需遵循注册顺序即可。

### Template Method 是父类定义框架的结构

```python
from abc import ABC, abstractmethod

class Report(ABC):
    def make(self): return self.head() + "|" + self.body()
    def head(self): return "H"
    @abstractmethod
    def body(self): ...

class Sales(Report):
    def body(self): return "sales"

print(Sales().make())   # H|sales
```

调用由父类的 `make` 方法执行，子类仅填充原本为空的位置。

<details>
<summary>Strategy 和 Adapter 的代码</summary>

```python
def run(price, discount): return discount(price)
print(run(10000, lambda p: p * 0.9), run(10000, lambda p: p - 1000))
# 9000.0 9000

class Old:
    def old_send(self, m): return "old:" + m
class Adapter:
    def __init__(self, o): self.o = o
    def send(self, m): return self.o.old_send(m)

print(Adapter(Old()).send("x"))   # old:x
```

Strategy 通过函数或对象传递并替换算法（如折扣方式）。Adapter 将旧方法名 `old_send` 连接到新方法名 `send`。

</details>

## 学习顺序

1. 记忆三大分类及其数量（5·7·11）。
2. 为每个模式添加一个关键词。
3. 单独对比容易混淆的成对模式（Factory Method 与 Abstract Factory、Adapter 与 Facade、Decorator 与 Proxy、State 与 Strategy）。
4. 真题请前往官方站点或正规习题集亲自练习，仅针对做错的模式返回表格中再次复习。

结合 [SOLID 原则](#/post/cs-solid) 一起学习会更易记忆。因为许多模式都依赖于接口，并朝着可扩展的方向发展。关于类之间关系的图形化理解，可参考 [UML 与面向对象分析](#/post/jb-uml)；涉及与模式名称重叠的大型结构讨论，请参见 [软件架构](#/post/jb-architecture-pattern)；代码输出阅读相关内容则整理在 [面向对象与语言代码阅读](#/post/jb-oop-lang) 中。

## 参考链接

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← 概念地图 (#/post/jb-map)

相关文章：[UML 与面向对象分析](#/post/jb-uml) · [软件架构](#/post/jb-architecture-pattern) · [面向对象与语言代码阅读](#/post/jb-oop-lang)