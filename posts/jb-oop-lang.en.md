The Object-Oriented section of the Information Processing Technician exam includes both terminology questions and code output problems, so you must memorize concepts and practice tracing code by hand. Exam schedules and eligibility requirements can be checked on the official site, so here we focus only on concepts and solution methods.

## What is Object-Oriented Programming?

It views a program as an interaction among "objects," which are bundles of data and the operations that manipulate that data. Procedural programming places weight on calling functions in sequence, whereas object-oriented programming first determines what data should be paired with what operations.

Let's review the basic terminology.

| Term | Meaning |
|---|---|
| Class | Blueprint for creating objects; defines attributes (variables) and methods (functions). |
| Object (Instance) | The actual thing created from a class. |
| Method | An action an object can perform. |
| Message | A request sent to an object to execute a method. |
| Constructor | A method executed first when an object is created. |

Topics related to modeling (class diagrams, relationships) are covered separately in [Details → UML and Object-Oriented Analysis](#/post/jb-uml).

## Four Key Characteristics

The exam includes questions where you must match explanations with these four characteristics.

| Characteristic | One-Line Explanation | Appearance in Code |
|---|---|---|
| Encapsulation | Bundles data and operations, hides internals, and exposes only what is needed. | private attributes + getter/setter |
| Inheritance | Child inherits parent's attributes and methods. | `extends`, `class B(A)` |
| Polymorphism | Requests with the same name behave differently depending on the object. | Overriding, overloading |
| Abstraction | Expresses only the common core in a simplified way. | Abstract classes, interfaces |

When memorizing, it's easy to confuse information hiding and encapsulation. Information hiding is the goal of "hiding internals," while encapsulation is the method used to achieve that, which matched the exam questions.

## Common Mistakes with Polymorphism

Polymorphism splits into two terms.

| Distinction | Overloading | Overriding |
|---|---|---|
| Function | Multiple methods with the same name but different numbers or types of parameters. | Child redefines a parent method with the same name and parameters. |
| Relationship | Within the same class. | Between parent and child. |
| Decision Time | At compile time. | At runtime. |

The Java official tutorial describes this runtime decision as "virtual method invocation." The JVM calls the method in the class of the actual object the variable points to, not based on the variable's declared type. The tutorial example shows that calling a method on a `Bicycle`-type variable holding a `MountainBike` object executes the `MountainBike`'s method.

The Python documentation goes further, stating that all methods in Python are essentially virtual. Since Python lacks the concept of a declared type, it always looks up based on the actual object.

This rule covers almost everything in code output problems: look at what object the variable points to, regardless of its type.

<details>
<summary>Example 1 — Overriding and super</summary>

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

When executed, this produces:

```
a:...
b:멍
c:멍!
```

`intro` exists only in `Animal`; calling `self.speak()` inside it executes the `speak` method of the actual object `self` points to. The Python documentation also notes that if a parent method calls another method of `self`, the child's override is called instead. `Puppy` uses `super()` to receive results from the parent (`Dog`) and appends "!" to them.
</details>

## Tips for Reading Code

C, Java, and Python are all included. Although syntax differs, the reading order is similar.

1. Find where it starts: C and Java begin with `main`, while Python starts at the bottom execution statement.
2. Draw boxes on paper for each variable and write values line by line. Relying solely on mental tracking often leads to errors.
3. For loops, trace only the first two or three iterations to identify the pattern, then skip ahead using that rule.
4. When an object appears, first note what actual object the variable points to.
5. Finally, review the output format (newlines, spaces).

### Common Pitfalls by Language

| Language | Frequent Trouble Spots |
|---|---|
| C | Integer division discards decimals. Difference between pre-increment (`++i`) and post-increment (`i++`). Relationship between pointers and array names. Null character appended to end of character arrays. |
| Java | Overriding is based on the actual object; overloading is based on the declared type. Static members exist once per class, not per object. Parent constructor executes first. |
| Python | Indentation defines blocks. Lists and dictionaries are references, so they change together. `//` is integer division, `/` is floating-point division. Slicing `a[1:3]` excludes the end index. |

The C and Java items reflect fundamental language rules that frequently appear in exam questions in the same format. It's advisable to practice compiling and verifying these separately.

## Two Python Pitfalls

Python's brevity can actually hide traps more easily. There are two places where the official tutorial explicitly warns about this, and I ran them to see what happens.

### Class Variables vs Instance Variables

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

The result is `2 1 3`. `n` is separate for each object, while `total` belongs to the class and is shared across all instances. This is equivalent to a static variable in Java.

### Making a List a Class Variable

```python
class Bag:
    items = []
    def put(self, v):
        self.items.append(v)

p, q = Bag(), Bag()
p.put(1); q.put(2)
print(p.items, q.items)
```

The result is `[1, 2] [1, 2]`. Both objects share the same list. The documentation illustrates this issue with the toy example `tricks = []`, and suggests the solution is to create a new list inside `__init__` using `self.items = []` so that each object has its own.

<details>
<summary>Multiple Inheritance and Method Resolution Order</summary>

Python can have multiple parents. The resolution order can be seen via `클래스.__mro__`.

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

`super()` does not call the "immediate parent"; instead, it calls the next class in this order. For example, `D`'s `super()` goes to `B`, and `B`'s `super()` goes to `C` rather than `A`. Hence, the order is `DBCA`. The documentation states that for simple cases, it follows depth-first, left-to-right, but adds that the actual rule is more complex. Following this order is a habit that applies equally to general polymorphism problems.
</details>

## Access Control and Leading Underscores

Python has no true private members. According to the documentation, `_spam` is merely a convention meaning "not part of the public API," while starting with two underscores like `__spam` triggers name mangling to `_클래스이름__spam`. This mechanism isn't intended to prevent access but rather to avoid conflicts when child classes use the same name. In discussions about encapsulation, any statement claiming "Python completely blocks access" should be considered incorrect.

Java has distinct access modifiers: `private`, `protected`, `public`, and no modifier (default). The distinction between these terms is frequently asked about due to terminology issues.

## Summary of Common Patterns

| Type | Solution Approach |
|---|---|
| Feature·Term Matching | Solve using the four tables above plus overloading/overriding tables |
| Inheritance·Overriding Output | Start from the actual object's class and trace upward to find the method definition |
| Constructor Call Order | Continue output in the order: parent constructor → child constructor |
| static·Class Variables | Draw separate boxes for per-object values and class-level values to track them |
| Operator·Loop Output | Draw variable boxes and process line by line |

Original exam questions are not included here. It is best to solve problems directly from official practice collections or learning websites. Practicing with basic language-specific problems on 프로그래머스 while tracing the code manually can also be helpful.

Design principles and patterns are covered in [Details → Design Patterns](#/post/jb-design-pattern), structural topics in [Details → Software Architecture](#/post/jb-architecture-pattern). Since data structures often appear alongside code reading, you may also find [Details → Data Structures](#/post/jb-data-structure) and [Details → Sorting·Searching and Algorithm Complexity](#/post/jb-algorithm-complexity) useful.

## Reference Links

- Python Official Tutorial, Classes: https://docs.python.org/3/tutorial/classes.html
- Oracle Java Tutorials, Polymorphism: https://docs.oracle.com/javase/tutorial/java/IandI/polymorphism.html

← Concept Map (#/post/jb-map)

Related posts: [UML and Object-Oriented Analysis](#/post/jb-uml) · [Design Patterns](#/post/jb-design-pattern) · [Data Structures](#/post/jb-data-structure)