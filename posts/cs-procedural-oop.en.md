Procedural and object-oriented programming differ in how they divide the same problem into code: procedural approaches split it into functions (tasks), while object-oriented approaches split it into objects (data and the operations that manipulate that data).

## What are these two approaches?

Procedural programming writes a program as a sequence of procedures, i.e., functions or subroutines. According to Wikipedia, a program is divided into variables, data structures, and subroutines, with procedures operating on those data structures separately. Representative languages include older ones like Fortran, COBOL, Pascal, and C.

Object-oriented programming bundles data and the operations that manipulate it into a single object. An object communicates with the outside world only through predefined gateways (methods). The same document summarizes the differences between the two as follows:

| | Procedural | Object-Oriented |
|---|---|---|
| Unit of division | Function | Class·Object |
| Data and operations | Separate | Together in one unit |
| Question asked | In what order should we process? | Who is responsible for this data? |
| Suitable context | Tasks where flow appears linear | Situations with state and growing variety |

Python supports both approaches. Since you can use only functions or only classes, it's a good language for comparison.

## Solving the same problem in both ways

We tried solving an account deposit and withdrawal problem. First, the procedural approach: the account is just a dictionary, and operations are external functions.

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

It's easy to read and short. However, the account data is accessible by any function, so values can be changed without validation, as shown in the last line. Validation is only enforced by whoever passes through the functions.

Using classes for the same thing looks like this:

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

We kept the balance as `_balance` and exposed only reading via `balance`. Attempting `acc.balance = 5` raised an AttributeError (confirmed directly). Since the rules are attached to the data, you can understand how values change by looking at just this class.

## Classes and Encapsulation

A class is a template for creating objects, and an object is the concrete instance created from that template. According to the official Python tutorial, a class bundles data and operations to create a new type. The first argument of a method is the object itself (`self`), which cannot be omitted. `__init__` is the initialization function executed when creating an object.

Encapsulation hides internal data and allows interaction only through predefined gateways. A point of confusion was that Python has no true private members. The tutorial states, "There are no private instance variables in Python that cannot be accessed from outside." Instead, names starting with a single underscore (`_spam`) are used as a convention to indicate they are not part of the public API. Names starting with double underscores (`__spam`) are mangled to `_ClassName__spam` to avoid name clashes with subclasses; however, this is not meant to prevent access (the tutorial notes that access is still possible). Thus, Python's encapsulation is closer to a convention than an enforcement.

## Inheritance

Inheritance allows you to extend or modify existing classes by taking them over and adding or changing only what's needed. We created a savings account that accrues interest and a checking account with overdraft limits.

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

The `deposit` method in `CheckingAccount` reuses the one from `Account`, while `withdraw` is overridden. The `super()` function is used to call methods from the parent class. The tutorial notes that all methods in Python are effectively virtual. Therefore, when a parent method calls another method, the child's version can be invoked instead.

## Polymorphism

Polymorphism means that the same call behaves differently depending on the object type.

```python
for acc in [SavingsAccount("lee", 1000), CheckingAccount("park", 10)]:
    acc.withdraw(40)
    print(type(acc).__name__, acc.balance)
# SavingsAccount 960
# CheckingAccount -30
```

The caller only knows `withdraw(40)`. For a checking account with a balance of 10 and an overdraft limit of 50, the result is -30; for a savings account, it becomes 960. In a procedural approach, this would require continuously adding `if account_type == ...` checks inside functions.

<details>
<summary>Python's polymorphism works without inheritance (duck typing)</summary>

Although the tutorial doesn't use the terms "polymorphism" or "duck typing," it conveys the same idea: code expecting an abstract type can accept any class that mimics the required methods, regardless of its inheritance hierarchy. For example, any class with `__iter__()` and `__next__()` can be used in a `for` loop, irrespective of which parent class it inherits from.

Thus, in Python, if a class has a `withdraw` method, it can be used in the above loop even without inheriting from `Account`. This differs from languages like Java, where interface inheritance is mandatory. Inheritance is "a means to inherit code," while polymorphism is "the property of being callable by the same method name," so they are best considered separately.

</details>

## When to use what

The criteria for choosing an approach are as follows. When the flow is linear and data is simple (e.g., scripts that read files, transform them, and save them), procedural programming is shorter and better. When there are many concepts with state and their types keep increasing (e.g., account types, payment methods), object-oriented programming becomes more organized. When designing large-scale code, principles are added on top of object-oriented design; these are continued in [SOLID principles → details](#/post/cs-solid) and [design patterns → details](#/post/cs-design-patterns). The sense of how to split classes is connected to [coupling and cohesion → details](#/post/be-coupling-cohesion), and discussions on layering code by role in service code are found in [layered architecture → details](#/post/be-layered-architecture).

## Common Misconceptions

- Object-oriented programming is a better approach: Both are different tools, and forcing classes into short scripts only makes the code longer. Modern code also mixes functions and objects.
- Using classes means you're using object-oriented programming: Classes that only hold data while actions reside in external functions are closer to dictionaries with names.
- More inheritance leads to better reusability: Deep inheritance hierarchies break easily when parents are modified, causing cascading failures in children. Alternatives for this issue are discussed in the aforementioned SOLID and design patterns articles.
- Python has private members too: As mentioned above, it's only about conventions and name mangling.

## Reference Links

- Python official tutorial, Classes: https://docs.python.org/3/tutorial/classes.html
- Wikipedia, Procedural programming: https://en.wikipedia.org/wiki/Procedural_programming

← Concept map (#/post/cs-map)

Related articles: [SOLID principles](#/post/cs-solid) · [design patterns](#/post/cs-design-patterns) · [coupling and cohesion](#/post/be-coupling-cohesion)