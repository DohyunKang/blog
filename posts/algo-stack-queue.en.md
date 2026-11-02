A stack pops the last item added, while a queue pops the first item added. A deque is a container where you can add and remove items from both ends. In coding tests, once you decide which end to add to and which end to remove from, you're almost done.

## What are the differences between them?

| | Add at | Remove at | Order | Python equivalent |
|---|---|---|---|---|
| Stack | Back | Back | Last In First Out (LIFO) | `list`'s `append`, `pop` |
| Queue | Back | Front | First In First Out (FIFO) | `deque`'s `append`, `popleft` |
| Deque | Front & Back | Front & Back | Both | `deque`'s `append`, `appendleft`, `pop`, `popleft` |

Stacking plates is a stack, and lining up in a queue is a queue. A deque combines both shapes, so it can be used as either a stack or a queue. That's why in Python, if you need a queue, you can just use `deque`.

## Why shouldn't we use a list for a queue in Python?

You can create a queue using a list by removing from the front with `pop(0)`. The problem is that it's slow. According to the Python documentation, lists take O(n) time for `pop(0)` and `insert(0, v)` because all remaining elements must be shifted one position. In contrast, `deque` allows O(1) addition and deletion at both ends. The tutorial documentation also states that creating a queue with a list is inefficient and recommends using `collections.deque`.

I tested it myself. Removing 50,000 elements from the front took about 0.155 seconds for a list and about 0.002 seconds for a deque on my PC. Since this was measured once, I only noted that the difference is in the order of magnitude. With inputs of 100,000 or 1,000,000, this difference becomes a time limit exceeded error. The reason the complexity diverges so much is explained in [Time Complexity and Python Basics](#/post/algo-complexity).

For stacks, a list is sufficient. Adding and removing from the end is O(1) for lists as well.

## Representative Problems

I've listed only the problem names without copying the full descriptions. All are from Programmers, and I opened each problem page to verify the title and type.

- Programmers Valid Parentheses: Determines if a parenthesis string is valid. This is the most basic use of a stack.
- Programmers Next Greater Element (Next Greater Number): Finds the first larger number to the right of each element. This type involves stacking elements in a stack that haven't found their answer yet.
- Programmers Stock Prices: Calculates the duration where prices do not drop from each point. It uses the same approach as Next Greater Element.
- Programmers Card Piles: Checks if words can be formed in a given order when only the top card of two piles can be used. This is exactly like using a queue to remove from the front for each pile.
- Programmers Process: Removes from the front and sends back to the rear if something more important appears later. This type involves adding (priority, position) to a queue.
- Programmers Make Two Queues Equal Sum: Moves elements between two queues to make their sums equal. This is exactly the operation of removing from the front of one queue and adding to the back of another.

- [Valid Parentheses](https://school.programmers.co.kr/learn/courses/30/lessons/12909)
- [Next Greater Element](https://school.programmers.co.kr/learn/courses/30/lessons/154539)
- [Stock Prices](https://school.programmers.co.kr/learn/courses/30/lessons/42584)
- [Card Piles](https://school.programmers.co.kr/learn/courses/30/lessons/159994)
- [Process](https://school.programmers.co.kr/learn/courses/30/lessons/42587)
- [Make Two Queues Equal Sum](https://school.programmers.co.kr/learn/courses/30/lessons/118667)

## Order of Thinking for Solutions

1. Look at the processing order. If you process from the most recent, it's a stack; if you process in the order they arrived, it's a queue.
2. If you see parenthesis matching, undo operations (rollback), or "closest ~", suspect a stack first.
3. If you simulate removing from the front and adding to the back, it's a queue.
4. If you touch both ends, it's a deque.
5. Check if you can finish in one pass (O(n)). Stack problems usually involve adding and removing once per element, so the overall complexity is O(n).

## Python Code

The code below has all been run directly to verify the results with example inputs.

### Valid Parentheses

```python
def valid(s):
    st = []
    for c in s:
        if c == '(':
            st.append(c)
        elif not st:      # 닫는데 짝이 없음
            return False
        else:
            st.pop()
    return not st         # 남은 게 없어야 올바름

print(valid("(())()"), valid("(()"), valid("())("))
# True False False
```

### Next Greater Element (Stack with indices)

```python
def nge(a):
    res = [-1] * len(a)
    st = []                       # 아직 오큰수를 못 찾은 인덱스
    for i, x in enumerate(a):
        while st and a[st[-1]] < x:
            res[st.pop()] = x     # x가 그들의 오큰수
        st.append(i)
    return res

print(nge([3, 5, 2, 7]))  # [5, 7, 7, -1]
print(nge([9, 5, 4, 8]))  # [-1, 8, 8, -1]
```

### Card Piles (Queue)

```python
from collections import deque

def can_make(cards1, cards2, goal):
    q1, q2 = deque(cards1), deque(cards2)
    for w in goal:
        if q1 and q1[0] == w:
            q1.popleft()          # 첫 뭉치의 맨 앞 카드 사용
        elif q2 and q2[0] == w:
            q2.popleft()          # 둘째 뭉치의 맨 앞 카드 사용
        else:
            return "No"
    return "Yes"

print(can_make(["i", "drink", "water"], ["want", "to"],
               ["i", "want", "to", "drink", "water"]))   # Yes
print(can_make(["i", "water", "drink"], ["want", "to"],
               ["i", "want", "to", "drink", "water"]))   # No
```

<details>
<summary>Stock Prices and Process Code</summary>

Stock Prices is similar to Next Greater Element, but when the value "drops", it removes from the stack and records the distance.

```python
def prices(p):
    ans = [0] * len(p)
    st = []
    for i, x in enumerate(p):
        while st and p[st[-1]] > x:
            j = st.pop()
            ans[j] = i - j
        st.append(i)
    for j in st:                  # 끝까지 안 떨어진 것들
        ans[j] = len(p) - 1 - j
    return ans

print(prices([1, 2, 3, 2, 3]))  # [4, 3, 1, 1, 0]
```

The process inserts (priority, initial position) into the queue and skips to the back if any remaining items have higher priority than the one popped. Since we iterate with `any` every time, the worst-case complexity is O(n²). The constraint of 100 or fewer priorities checked on the problem page is sufficient.

```python
from collections import deque

def printer(pr, loc):
    q = deque((p, i) for i, p in enumerate(pr))
    cnt = 0
    while q:
        p, i = q.popleft()
        if any(p < x for x, _ in q):
            q.append((p, i))
        else:
            cnt += 1
            if i == loc:
                return cnt

print(printer([2, 1, 3, 2], 2))        # 1
print(printer([1, 1, 9, 1, 1, 1], 0))  # 5
```

</details>

## Time and Space Complexity

| Problem | Time | Space | Reason |
|---|---|---|---|
| Valid Parentheses | O(n) | O(n) | Check each character once; worst case, all are pushed onto the stack |
| Next Greater Element / Stock Prices | O(n) | O(n) | Each element enters and leaves the stack exactly once |
| Card Stacks | O(n) | O(n) | Only check the front of the deque for each word |
| Process | O(n²) | O(n) | Scan remaining priorities every time an item is popped |

I was initially confused why "Next Greater Element" is O(n) despite having a `while` loop inside the main loop. The total number of iterations across all inner `while` loops does not exceed the number of elements because each element enters and leaves the stack exactly once. This method of summing up total counts is fundamental for analyzing stack-based algorithm complexities.

## Common Mistakes

- Using `list.pop(0)` on a queue leads to Time Limit Exceeded (TLE).
- Calling `pop()` on an empty stack causes an `IndexError`. Always check `if st` before popping.
- In "Next Greater Element," push indices instead of values when calculating distance or position.
- Attempting to slice a `deque`. Slicing like `q[1:3]` is not supported, and accessing middle elements is O(n), making it unsuitable for frequent index-based access. This conclusion is based on the Python documentation's note about slow middle access; I did not verify the exact cost myself.

## Using Deques

Deques are appropriate for problems utilizing both ends. They are used to transfer elements between two deques, as in "Make Two Queues Equal," and to organize candidates front-to-back within a window, as in "Maximum Value in Sliding Window." Creating with `deque(maxlen=k)` automatically shifts out the opposite end when full, which is convenient for maintaining only the most recent k elements. Sliding windows are covered in detail at [Two Pointers · Sliding Window · Prefix Sum](#/post/algo-two-pointer).

## Connections to Other Types

- Queues form the core of Breadth-First Search (BFS), while stacks (or recursion) form the core of Depth-First Search (DFS). [See more → BFS, DFS, and Graphs](#/post/algo-graph-search)
- Recursive calls accumulate on the call stack; excessively deep recursion fails for the same reason. [See more → Recursion and Backtracking](#/post/algo-recursion)
- Changing the extraction order from "arrival order" to "priority" results in a Priority Queue. [See more → Trees, Heaps, and Priority Queues](#/post/algo-tree-heap)
- Problems involving counting pairs or frequencies while scanning strings or arrays often involve hash maps. [See more → Arrays, Strings, and Hash Maps](#/post/algo-array-hash)

## Reference Links

- Python Documentation, collections.deque: https://docs.python.org/3/library/collections.html (Verifies O(1) for both ends, O(n) for list `pop(0)`, and `maxlen` behavior)
- Python Tutorial, Data Structures (Using lists as stacks/queues): https://docs.python.org/3/tutorial/datastructures.html
- Problems Used (Programmers; opened pages to verify title/type):
    - Valid Parentheses: https://school.programmers.co.kr/learn/courses/30/lessons/12909
    - Next Greater Element: https://school.programmers.co.kr/learn/courses/30/lessons/154539
    - Stock Prices: https://school.programmers.co.kr/learn/courses/30/lessons/42584
    - Card Stacks: https://school.programmers.co.kr/learn/courses/30/lessons/159994
    - Process: https://school.programmers.co.kr/learn/courses/30/lessons/42587
    - Make Two Queues Equal: https://school.programmers.co.kr/learn/courses/30/lessons/118667

← Concept Map (#/post/algo-map)

Related Articles: [Arrays, Strings, and Hash Maps](#/post/algo-array-hash) · [BFS, DFS, and Graphs](#/post/algo-graph-search) · [Trees, Heaps, and Priority Queues](#/post/algo-tree-heap)