For the Information Processing Technician exam, the Data Structures unit rewards practice over rote memorization. Questions often require you to draw out scenarios on paper: what remains in a stack after operations, the traversal order of a tree, or the starting point for graph visits. This article organizes these concepts in that exact flow. Please check the official website for exam schedules and registration details.

## Overview of Classifications

| Category | Types | Core Question |
|---|---|---|
| Linear | Arrays, Linked Lists, Stacks, Queues, Deques | Which end do you insert from or remove from? |
| Non-linear | Trees, Graphs | In what order are nodes visited? |

Linear structures arrange data in a single line, whereas non-linear structures branch out from one node to multiple others. Exam questions typically fall into two types: classification checks (e.g., "Which of the following is not a linear structure?") and problems asking for the result after applying operations sequentially.

## Linear Structures

Arrays allow direct access via indices, but inserting in the middle requires shifting subsequent elements. Linked lists use pointers where each node points to the next; insertion only involves changing pointers, though finding the i-th element requires traversing from the start.

| | Access | Insert/Delete in Middle |
|---|---|---|
| Array | Fast (Index) | Slow (Requires shifting) |
| Linked List | Slow (Requires traversal) | Fast (Pointer modification) |

Stacks operate on a Last-In-First-Out (LIFO) principle, allowing insertion and removal only at one end. Queues follow First-In-First-Out (FIFO), inserting at the rear and removing from the front. Deques allow operations at both ends. Stacks are used for function calls, backtracking, and parenthesis matching, while queues manage task waiting lists processed in order. In Python, creating a queue using a list's `pop(0)` is O(n), so `deque` is preferred. Official documentation confirms that adding/removing from both ends of a deque is approximately O(1), whereas a list's `pop(0)` is O(n). Coding-related details are covered separately in [Stacks, Queues, and Deques](#/post/algo-stack-queue).

In exams, stacks almost always appear as "expression notation conversion."

### Expression Notation

There are three types based on operator placement.

| Name | Operator Position | Example (A+B) |
|---|---|---|
| Prefix | Before operands | +AB |
| Infix | Between operands | A+B |
| Postfix | After operands | AB+ |

The rule for converting infix to postfix is: output operands immediately; push operators onto a stack, but pop and output an operator if the top of the stack has equal or higher precedence. Push opening parentheses onto the stack and pop until matching closing parentheses are found. Finally, pop all remaining items from the stack. The results of applying these rules directly are as follows.

| Infix Expression | Postfix Expression |
|---|---|
| A+B*C | ABC*+ |
| (A+B)*C | AB+C* |
| A-B-C | AB-C- |

When precedence is equal, the left operand is processed first (left associativity). Postfix calculation is simpler: read from left to right, push numbers onto a stack, and when encountering an operator, pop two values, calculate, and push the result. For `3 4 2 * +`, it computes 4*2=8, then 3+8=11. Just be cautious that the first value popped is the right operand (order changes for subtraction/division).

<details>
<summary>Conversion & Calculation Code (Run directly to verify results)</summary>

```python
def topost(s):
    pr = {'+': 1, '-': 1, '*': 2, '/': 2}
    st, out = [], []
    for c in s:
        if c.isalnum():
            out.append(c)
        elif c == '(':
            st.append(c)
        elif c == ')':
            while st[-1] != '(':
                out.append(st.pop())
            st.pop()
        else:
            while st and st[-1] != '(' and pr[st[-1]] >= pr[c]:
                out.append(st.pop())
            st.append(c)
    while st:
        out.append(st.pop())
    return ''.join(out)

print(topost('A+B*C'), topost('(A+B)*C'), topost('A-B-C'))
# ABC*+ AB+C* AB-C-

def ev(s):
    st = []
    for c in s.split():
        if c in '+-*/':
            b = st.pop(); a = st.pop()
            st.append({'+': a+b, '-': a-b, '*': a*b, '/': a/b}[c])
        else:
            st.append(float(c))
    return st[0]

print(ev('3 4 2 * +'))  # 11.0
```

</details>

## Trees

Trees are connected structures without cycles. Terminology appears verbatim in exams.

| Term | Meaning |
|---|---|
| Root | Topmost node with no parent |
| Leaf (Terminal) | Node with no children |
| Degree | Number of children for a node (Tree degree is the maximum node degree) |
| Depth/Height | Distance from root / Length to deepest point |

A tree with n nodes has n-1 edges. In binary trees, each node has at most two children. For level i in a binary tree (with root at level 1), there are at most 2^(i-1) nodes. A binary tree of height h has at most 2^h - 1 nodes. Note whether the problem defines the root as level 0 or 1, as this affects formulas; always read conditions first.

### Traversal (Most Frequently Tested Section)

The three depth-first traversals differ only in when they visit themselves relative to subtrees. All three visit the left subtree before the right.

| Name | Order | Mnemonic |
|---|---|---|
| Preorder | Self → Left → Right | Self is first (Pre-order) |
| Inorder | Left → Self → Right | Self is middle |
| Postorder | Left → Right → Self | Self is last |

Level-order traversal visits layer by layer from the top, implemented using a queue. The results from running this on the example tree below are:

```
        A
       / \
      B   C
     / \   \
    D   E   F
```

| Traversal | Result |
|---|---|
| Preorder | A B D E C F |
| Inorder | D B E A C F |
| Postorder | D E B F C A |
| Level | A B C D E F |

Preorder, inorder, and postorder differ only in the timing of visiting a node; thus, marking the "three visits" for each node while reading reduces errors. Specifically, if you mark the left side when passing through yourself, it's preorder; the bottom (middle) is inorder; and the right side is postorder.

There are also problems involving reconstructing a tree from two traversal results. For a tree with unique values, the pair of preorder and inorder traversals uniquely determines the tree structure. It is well-known that this does not always hold for preorder and postorder pairs. The reconstruction method is as follows: the first value in the preorder sequence is the root; finding this value in the inorder sequence splits the left part into the left subtree and the right part into the right subtree. This process is repeated recursively.

<details>
<summary>Traversal and Reconstruction Code (Execution Check)</summary>

```python
from collections import deque

class N:
    def __init__(s, v, l=None, r=None):
        s.v, s.l, s.r = v, l, r

def pre(n):  return [] if not n else [n.v] + pre(n.l) + pre(n.r)
def ino(n):  return [] if not n else ino(n.l) + [n.v] + ino(n.r)
def post(n): return [] if not n else post(n.l) + post(n.r) + [n.v]

def level(n):
    q, out = deque([n]), []
    while q:
        x = q.popleft(); out.append(x.v)
        if x.l: q.append(x.l)
        if x.r: q.append(x.r)
    return out

t = N('A', N('B', N('D'), N('E')), N('C', None, N('F')))
print(pre(t), ino(t), post(t), level(t))

def build(p, i):                      # 전위 + 중위 -> 트리
    if not p: return None
    k = i.index(p[0])
    return N(p[0], build(p[1:k+1], i[:k]), build(p[k+1:], i[k+1:]))

print(post(build(list('ABDECF'), list('DBEACF'))))
# ['D', 'E', 'B', 'F', 'C', 'A']
```

</details>

### Binary Search Trees and Heaps

A Binary Search Tree (BST) is a tree that adheres to the rule where left children are smaller than their parent and right children are larger. Performing an inorder traversal on this tree yields values in ascending order. Inserting 50, 30, 70, 20, 40, 60, 80 sequentially and then performing an inorder traversal results in 20 30 40 50 60 70 80.

Search, insertion, and deletion have an average time complexity of O(log n). However, since the tree's shape depends on the input order, inserting sorted values like 10, 20, 30, 40 causes the tree to degenerate into a linked list leaning to one side, resulting in a worst-case complexity of O(n). The height of the above tree is 3, whereas inserting four sorted values results in a height of 4. To prevent this issue, balanced trees such as AVL exist. AVL is known as the first self-balancing binary search tree and adjusts the tree by checking and correcting heights during every insertion and deletion.

A heap is a complete binary tree where each parent is always greater than (max-heap) or smaller than (min-heap) its children. It is used in priority queues for quickly extracting maximum or minimum values. Using Python's `heapq`, inserting 5, 3, 8, 1, 2 and popping them one by one yields 1, 2, 3, 5, 8. Unlike BSTs, there are no size rules between siblings in a heap. For coding problems, detailed information is available at [Tree, Heap, Priority Queue → Details](#/post/algo-tree-heap).

## Graphs

A graph is a collection of vertices and edges. If directions are present, it is a directed graph; otherwise, it is an undirected graph. For an undirected graph with n vertices, the maximum number of edges is n(n-1)/2. A tree can be considered a type of graph that has no cycles and is connected.

There are two representation methods, as verified with the following graph (edges: 1-2, 1-3, 2-4, 3-4, 4-5).

| Method | Shape | Space | Characteristics |
|---|---|---|---|
| Adjacency Matrix | 1 in an n×n table if an edge exists | O(n²) | Immediately checks if two vertices are connected |
| Adjacency List | Neighbor list for each vertex | O(n+edges) | Uses less space when there are few edges |

The adjacency matrix for an undirected graph is symmetric across the diagonal. Summing all 1s in the matrix and dividing by 2 yields the number of edges, which is 5. Since the neighbors of vertex 4 are 2, 3, and 5, its degree is 3.

### Graph Traversal

Depth-first search (DFS) uses a stack (or recursion), while breadth-first search (BFS) uses a queue. Starting from vertex 1 and visiting neighbors in ascending order of their numbers results in the following:

| Method | Visit Order |
|---|---|
| DFS | 1 2 4 3 5 |
| BFS | 1 2 3 4 5 |

In exams, the condition specifying "the order in which neighbors are chosen" is stated in the problem, so you should follow it exactly. Similar to tree traversal, remembering that BFS = queue and DFS = stack determines the solution approach. Implementation details are available at [BFS, DFS, and Graphs → Details](#/post/algo-graph-search).

<details>
<summary>Graph Code (Execution Check)</summary>

```python
from collections import deque

E = [(1, 2), (1, 3), (2, 4), (3, 4), (4, 5)]
adj = {i: [] for i in range(1, 6)}
for a, b in E:
    adj[a].append(b); adj[b].append(a)

def dfs(g, s):
    seen, st = [], [s]
    while st:
        x = st.pop()
        if x in seen: continue
        seen.append(x)
        for y in sorted(g[x], reverse=True):   # 작은 번호가 먼저 나오도록
            st.append(y)
    return seen

def bfs(g, s):
    seen, q = [s], deque([s])
    while q:
        x = q.popleft()
        for y in sorted(g[x]):
            if y not in seen:
                seen.append(y); q.append(y)
    return seen

print(dfs(adj, 1), bfs(adj, 1))
# [1, 2, 4, 3, 5] [1, 2, 3, 4, 5]
```

</details>

## Common Patterns and Solution Order

| Type | Solution Order |
|---|---|
| Stack/Queue Operation Results | Apply operations one by one and write the current content on paper |
| Expression Notation Conversion/Calculation | Follow stack rules based on precedence and parentheses |
| Tree Traversal Results | Check the timing of visiting yourself and proceed from left to right |
| Reconstruction from Two Traversals | First value in preorder = root; split left/right using inorder |
| Node/Edge Count Calculation | A tree with n nodes has n-1 edges; a binary tree of height h has at most 2^h - 1 nodes |
| Graph Traversal | Check the starting vertex and neighbor selection conditions; DFS=stack, BFS=queue |
| Time Complexity Comparison | Distinguish between BST average O(log n) and worst-case O(n) |

## Common Mistakes

- Swapping the popping side of queues and stacks when applying them.
- Reversing the operand order for subtraction and division in postfix expression evaluation.
- Using the 2^h formula without verifying whether levels are counted from 0 or 1.
- Confusing inorder and postorder traversal results. Distinguish them by noting that for a root node, postorder ends last while preorder starts first.
- Memorizing that BSTs are "always O(log n)". If the shape leans to one side, it becomes O(n).

Sorting, Searching, and Complexity continues in detail at [→ Sorting, Searching, and Algorithmic Complexity](#/post/jb-algorithm-complexity). The practice problems are not copied verbatim from the original sources; only problem types have been organized. For solving actual problems, you can practice using official released materials.

## Reference Links

- Python documentation, `collections.deque` and list `pop(0)` cost: https://docs.python.org/3/library/collections.html
- Tree traversal (preorder, inorder, postorder, level-order; determining a tree from preorder + inorder): https://en.wikipedia.org/wiki/Tree_traversal
- Binary search tree (average/worst-case complexity, bias, AVL): https://en.wikipedia.org/wiki/Binary_search_tree

← Concept map (#/post/jb-map)

Related posts: [Sorting, Searching, and Algorithmic Complexity](#/post/jb-algorithm-complexity) · [Stacks, Queues, and Deques](#/post/algo-stack-queue) · [BFS, DFS, and Graphs](#/post/algo-graph-search)