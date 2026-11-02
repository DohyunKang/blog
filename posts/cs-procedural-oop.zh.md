过程式编程和面向对象编程在划分同一问题的代码方式上存在根本差异：前者按“函数（待办事项）”拆分，后者则按“对象（数据及其操作行为）”拆分。

## 两种范式是什么

过程式（procedural）编程将程序构建为一系列步骤，即函数或子程序的连续执行。维基百科将其描述为将程序划分为变量、数据结构与子程序，并通过这些步骤独立处理数据结构。Fortran、COBOL、Pascal、C 等早期语言是典型代表。

面向对象（object-oriented）编程则将数据及其操作行为封装进单一对象中。对象仅通过预设的接口（方法）与外部交互。同一文档中对这两者的差异做了如下总结：

| | 过程式 | 面向对象 |
|---|---|---|
| 划分单元 | 函数 | 类·对象 |
| 数据与行为 | 分离存在 | 融为一体 |
| 核心问题 | 按什么顺序处理 | 谁负责这些数据 |
| 适用场景 | 流程呈线性、单一的工作流 | 具备状态且类型不断扩展的系统 |

Python 同时支持这两种范式，既可使用纯函数，也可使用类，因此非常适合进行比较。

## 用两种方式解决同一问题

我们以“向账户存款和取款”为例进行演示。首先看过程式实现：账户只是一个字典，操作由外部函数完成。

```python
def make_account(owner, balance=0):
    return {"owner": owner, "balance": balance}

def deposit(acc, amount):
    if amount <= 0:
        raise ValueError("amount must be positive")
    acc["balance"] += amount

def withdraw(acc, amount):
    if amount > acc["balance"]:
        raise ValueError("insufficient funds")
    acc["balance"] -= amount

a = make_account("kim", 100)
deposit(a, 50)
withdraw(a, 30)
print(a)              # {'owner': 'kim', 'balance': 120}
a["balance"] = -999   # 막을 방법이 없다
```

代码简洁易读。但问题是账户数据对任何函数都开放，如同最后一行所示，可在无验证的情况下直接修改值；验证逻辑仅由调用特定函数的人遵守。

若改用类来实现，则如下所示：

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount
```

余额内部属性设为 `_balance`，对外只暴露 `balance` 用于读取。执行 `acc.balance = 5` 会抛出 AttributeError（已亲自复现）。由于规则与数据紧密耦合，仅查看该类即可理解其状态变化逻辑。

## 类与封装

类是创建对象的模板，对象则是基于该模板生成的实例。根据 Python 官方教程，类用于将数据与行为组合成新的类型。方法的首个参数必须是对象自身（`self`），且不可省略。`__init__` 是在创建对象时执行的初始化函数。

封装是指隐藏内部数据，仅通过预设接口进行交互。令人困惑的是：Python 中并不存在真正的私有成员。教程明确指出：“Python 中没有无法从外部访问的私有实例变量”。取而代之的是，以下划线开头的名称（如 `_spam`）是一种约定，表示“非公开 API"；双下划线开头（如 `__spam`）则会被重命名为 `_ClassName__spam`，目的是避免子类命名冲突，而非真正阻止访问（教程也说明访问仍然可行）。因此，Python 的封装更接近于一种约定，而非强制机制。

## 继承

继承是指复用现有类，并仅添加或修改所需部分的功能。我们创建了两种账户：带利息的储蓄账户和可超额提款的支票账户。

```python
class SavingsAccount(Account):
    def __init__(self, owner, balance=0, rate=0.02):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        self.deposit(self._balance * self.rate)

class CheckingAccount(Account):
    def withdraw(self, amount):          # 덮어쓰기(오버라이딩)
        if amount > self._balance + 50:
            raise ValueError("overdraft limit")
        self._balance -= amount
```

`deposit` 方法直接复用了 `Account` 类中的实现，而 `CheckingAccount` 仅替换了 `withdraw` 方法。`super()` 用于调用父类的方法。教程指出：Python 中所有方法在本质上都是虚方法（virtual methods）。因此，当父类方法被调用时，若子类重写了该方法，则实际执行的是子类的版本。

## 多态

多态性是指同一调用根据对象类型表现出不同行为。

```python
for acc in [SavingsAccount("lee", 1000), CheckingAccount("park", 10)]:
    acc.withdraw(40)
    print(type(acc).__name__, acc.balance)
# SavingsAccount 960
# CheckingAccount -30
```

调用方仅需知道 `withdraw(40)`。余额为 10 的支票账户因限额为 50，结果变为 -30；而储蓄账户则变为 960。若采用过程式编程，此处需在函数内部不断添加类似 `if account_type == ...` 的条件判断。

<details>
<summary>Python 的多态无需继承即可实现（得益于鸭子类型）</summary>

教程虽未使用“多态”或“鸭子类型”等术语，但表达了相同思想：代码若期望某种抽象类型，可传入任何具备相应方法的其他类实例。例如，只要类实现了 `__iter__()` 和 `__next__()` 方法，无论其继承自哪个父类，均可用于 `for` 循环。

因此，在 Python 中，只要实现 `withdraw` 方法，即使未继承 `Account` 的类也能参与上述迭代逻辑。这与 Java 等必须显式继承接口的语言不同。我认为：继承是“获取代码的手段”，而多态是“通过相同方法名调用的特性”，二者应分开理解。

</details>

## 何时使用哪种

判断标准如下：如果流程为单一线性且数据简单（如读取文件、转换并保存的脚本），则采用过程式编程更为简洁高效。当涉及具有状态的概念较多且种类持续增加时（例如账户类型、支付手段），面向对象编程则更为合适。在设计大型代码时，应在面向对象之上遵循更多原则，相关内容可参考 [详细 → SOLID 原则](#/post/cs-solid) 与 [详细 → 设计模式](#/post/cs-design-patterns)。关于如何划分类的感觉，可参见 [详细 → 耦合度与内聚度](#/post/be-coupling-cohesion)；而在服务代码中按角色分层的内容，则见 [详细 → 分层架构](#/post/be-layered-architecture)。

## 常见误解

- 面向对象是更好的方式：两者只是工具不同，在简短脚本中强行加入类只会让代码变长。现代代码也常混合使用函数与对象。
- 使用了类就是面向对象：仅存储数据、行为由外部函数实现的类，本质上接近于“重命名的字典”。
- 继承用得越多越利于复用：继承层级过深会导致修改父类时子类接连出错。此问题的替代方案将在上述关于 SOLID 与设计模式的文章中讨论。
- Python 也有 private：如上所述，仅靠约定和名称改写而已。

## 参考链接

- Python 官方教程，Classes: https://docs.python.org/3/tutorial/classes.html
- Wikipedia, Procedural programming: https://en.wikipedia.org/wiki/Procedural_programming

← 概念地图 (#/post/cs-map)

相关文章：[SOLID 原则](#/post/cs-solid) · [设计模式](#/post/cs-design-patterns) · [耦合度与内聚度](#/post/be-coupling-cohesion)