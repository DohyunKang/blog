信息处理技术员考试中的面向对象部分，通常同时包含术语问题和代码输出问题，因此既要背诵概念，又要亲手编写代码。考试日程和报考要求可在官方网站查询，此处仅整理核心概念与解题思路。

## 什么是面向对象

将程序视为“数据及其操作数据的动作”所组成的“对象”之间的交互方式。面向过程侧重于按顺序调用函数，而面向对象则首先明确哪些数据应与哪些动作绑定。

先整理基本术语：

| 术语 | 含义 |
|---|---|
| 类 | 创建对象的蓝图。定义属性（变量）和方法（函数） |
| 对象（实例） | 通过类实际创建出来的实体 |
| 方法 | 对象可以执行的动作 |
| 消息 | 向对象发送以执行方法的请求 |
| 构造函数 | 创建对象时首先执行的初始化方法 |

关于建模相关内容（类图、关系等）已在 [详细说明 → UML 与面向对象分析](#/post/jb-uml) 中单独阐述。

## 四大特征

考试中常出现将以下四个特征与描述进行匹配的题目：

| 特征 | 一句话解释 | 代码中的体现 |
|---|---|---|
| 封装 | 将数据与操作绑定，隐藏内部细节，仅暴露必要部分 | private 属性 + getter/setter |
| 继承 | 子类继承父类的属性和方法 | `extends`, `class B(A)` |
| 多态 | 相同名称的请求在不同对象上表现出不同行为 | 重写、重载 |
| 抽象 | 提取共同核心，以简洁方式表达 | 抽象类、接口 |

容易混淆的是“信息隐藏”与“封装”。信息隐藏的目的是“隐藏内部”，而封装是实现这一目的的手段，这样理解即可应对考题。

## 多态中的易错点

多态涉及两个术语：重载与重写。

| 区分 | 重载 (Overloading) | 重写 (Overriding) |
|---|---|---|
| 作用 | 同一类中存在多个同名但参数个数或类型不同的方法 | 子类以相同名称和参数重新定义父类方法 |
| 关系 | 同一类内部 | 父子类之间 |
| 决定时机 | 编译时 | 运行时 |

Java 官方教程将这种运行时的方法选择称为“虚拟方法调用”。JVM 调用的是变量实际指向对象的类中的方法，而非变量声明的类型。教程示例中，向 `Bicycle` 类型变量赋值 `MountainBike` 对象并调用方法时，执行的是 `MountainBike` 的方法。

Python 文档更进一步，指出 Python 中的所有方法实际上都是虚拟的。由于 Python 不存在“声明类型”的概念，始终基于实际对象查找方法。

在代码输出类题目中，这一规则几乎涵盖全部考点：无论变量类型如何，关键在于判断其实际指向的对象是什么。

<details>
<summary>运行示例 1 — 重写与 super</summary>

```python
class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        return "..."
    def intro(self):
        return self.name + ":" + self.speak()

class Dog(Animal):
    def speak(self):
        return "멍"

class Puppy(Dog):
    def speak(self):
        return super().speak() + "!"

for a in [Animal("a"), Dog("b"), Puppy("c")]:
    print(a.intro())
```

运行结果如下：

```
a:...
b:멍
c:멍!
```

`intro` 方法仅存在于 `Animal` 类中，其中调用 `self.speak()` 时，会执行 `self` 实际指向对象的 `speak` 方法。Python 文档也指出，若父类方法调用了 `self` 的其他方法，则可能触发子类的重写版本。`Puppy` 类通过 `super()` 获取父类（`Dog`）的结果，并追加了 "!"。
</details>

## 代码阅读技巧

涵盖 C、Java、Python 三种语言。尽管语法不同，但阅读顺序基本一致：

1. 首先找到程序的入口点。C 和 Java 从 `main` 开始，Python 则从最下方的执行语句开始。
2. 为每个变量在纸上划格，逐行记录其值。仅靠脑内模拟极易出错。
3. 对于循环，只需跟踪前几次迭代即可发现规律，之后可依规律跳过。
4. 遇到对象时，先注明“该变量实际指向的对象是什么”。
5. 最后再次检查输出格式（换行、空格等）。

### 各语言高频考点

| 语言 | 常见陷阱 |
|---|---|
| C | 整数相除会丢弃小数部分。前置 (`++i`) 与后置 (`i++`) 的区别。指针与数组名的关系。字符数组末尾需添加空字符 `\0` |
| Java | 重写基于实际对象，重载基于声明类型选择。static 成员属于类而非对象。父类构造函数先执行 |
| Python | 缩进表示代码块。列表和字典是引用类型，修改会影响原对象。`//` 为整除，`/` 为浮点除法。切片 `a[1:3]` 不包含结束索引 |

C 和 Java 部分属于语言基础规则，在试卷中反复出现。建议提前自行编译练习以加深理解。

## 两个 Python 陷阱

Python 代码简短，反而容易隐藏陷阱。官方教程中有两处直接发出警告，我也进行了验证。

### 类变量与实例变量

```python
class Counter:
    total = 0
    def __init__(self):
        self.n = 0
    def add(self):
        self.n += 1
        Counter.total += 1

x, y = Counter(), Counter()
x.add(); x.add(); y.add()
print(x.n, y.n, Counter.total)
```

结果是 `2 1 3`。`n` 是每个对象独立的，而 `total` 是类共享的，因此会被累加。这与 Java 中的 static 变量位置相同。

### 将列表作为类变量

```python
class Bag:
    items = []
    def put(self, v):
        self.items.append(v)

p, q = Bag(), Bag()
p.put(1); q.put(2)
print(p.items, q.items)
```

结果是 `[1, 2] [1, 2]`。两个对象共享同一个列表。文档也使用同样的问题，并以玩具示例 `tricks = []` 展示，解决方法是在 `__init__` 中创建 `self.items = []`，为每个对象单独初始化。

<details>
<summary>多重继承与方法解析顺序</summary>

Python 可以拥有多个父类。解析顺序可以通过 `클래스.__mro__` 查看。

```python
class A:
    def hi(self): return "A"
class B(A):
    def hi(self): return "B" + super().hi()
class C(A):
    def hi(self): return "C" + super().hi()
class D(B, C):
    def hi(self): return "D" + super().hi()
print(D().hi())
print([k.__name__ for k in D.__mro__])
```

```
DBCA
['D', 'B', 'C', 'A', 'object']
```

`super()` 并非调用“直接上方的父类”，而是按照该顺序调用下一个类。`D` 中的 `super()` 会调用 `B`，而 `B` 中的 `super()` 不会调用 `A`，而是调用 `C`。因此顺序是 `DBCA`。文档指出在简单情况下遵循深度优先、左优先原则，并补充说明实际规则更为复杂。遵循该顺序的习惯同样适用于一般的多态性问题。
</details>

## 访问限制与下划线前缀

Python 中没有真正的 private（私有）。根据文档标准，`_spam` 仅是一种惯例，表示“不属于公开 API”；而以两个下划线开头如 `__spam`，则会发生名称改写（name mangling），变为 `_클래스이름__spam`。这并非为了阻止访问，而是为了避免子类使用相同名称时发生冲突的机制。在封装问题中，若出现"Python 完全禁止访问”的说法，应视为错误观点。

Java 拥有 `private`、`protected`、`public` 以及无修饰符的默认访问级别。这些区分常因术语问题而被频繁询问。

## 常见题型总结

| 类型 | 解题方式 |
|---|---|
| 特征·术语配对 | 利用上述四种表格与重载/重写表进行解答 |
| 继承·重写输出 | 从实际对象的类开始书写，然后向上查找该类的相应方法 |
| 构造函数调用顺序 | 按“父类构造函数 → 子类构造函数”的顺序连续输出 |
| static·类变量 | 分别绘制对象专属格与类专属格，追踪数值变化 |
| 运算符·循环输出 | 绘制变量格表格，逐行输出 |

此处未收录原题原文。建议直接在官方题库或学习网站中练习。在 Programmers（프로그래머스）上按语言完成基础题目并动手演练会有所帮助。

设计原则与模式详见 [详情 → 设计模式](#/post/jb-design-pattern)，结构相关内容见 [详情 → 软件架构](#/post/jb-architecture-pattern)。阅读代码时常会遇到涉及数据结构的问题，因此建议同时参考 [详情 → 数据结构](#/post/jb-data-structure) 与 [详情 → 排序·搜索与算法复杂度](#/post/jb-algorithm-complexity)。

## 参考资料链接

- Python 官方教程，类：https://docs.python.org/3/tutorial/classes.html
- Oracle Java Tutorials, Polymorphism: https://docs.oracle.com/javase/tutorial/java/IandI/polymorphism.html

← 概念地图 (#/post/jb-map)

相关文章：[UML 与面向对象分析](#/post/jb-uml) · [设计模式](#/post/jb-design-pattern) · [数据结构](#/post/jb-data-structure)