When looking at coding test problems, you often get stuck wondering "What type is this?". So, I wrote one line for each of the 11 algorithm articles, categorized by type. First, estimate the complexity to see if it fits within the time limit, then group them in the order: Data Structures → Search → Graphs → Optimization. The explanations and code are in each respective article.

## Order for Choosing Based on the Problem

| What is visible in the problem | Type to consider first |
|---|---|
| Large input size, double loop implies Time Limit Exceeded | Estimate complexity → Hashing, Prefix Sums, Two Pointers |
| "Have I seen this value before?", counting occurrences | Hashing |
| Sum or length of continuous intervals | Prefix sums, Two pointers, Sliding window |
| Parentheses, "first larger number from the right", processing in order | Stack, Queue |
| Search in sorted data, "what is the maximum possible value" | Binary search, Parametric search |
| Try all cases but backtrack if stuck | Recursion, Backtracking |
| Structure connected by cells, points, or edges | BFS, DFS |
| Edges with costs, grouping same sides, precedence relationships | Dijkstra's algorithm, Union-Find, Topological sort |
| Reuse the answer to smaller subproblems | Dynamic Programming (DP) |
| Seems like always picking the best option at each step | Greedy (verify counterexamples) |
| Repeatedly extract the smallest (or largest) item | Heap, Priority Queue |

## 1. Foundation: Complexity

**Time complexity and Python basics**: How to estimate "will this solution pass within the time limit" based on input size, common performance bottlenecks in Python, and basic input/output for coding tests.
[Details → Time complexity and Python basics](#/post/algo-complexity)

## 2. Types Solved with Data Structures

**Arrays, Strings, Hashing**: Types where you count something once and store it, rather than counting repeatedly. The storage locations are prefix sum arrays or hashes (dict, set).
[Details → Arrays, Strings, Hashing](#/post/algo-array-hash)

**Stacks, Queues, Deques**: The difference is whether you remove the last added item or the first added item. Problems like parenthesis checking, Next Greater Element, and card rotation belong here. In Python, distinguishing between lists and deque usually solves most of these.
[Details → Stacks, Queues, Deques](#/post/algo-stack-queue)

**Trees, Heaps, Priority Queues**: Half the challenge with trees is whether you can directly write the traversal order in code; for heaps, use `heapq` to continuously extract the smallest (or largest) item.
[Details → Trees, Heaps, Priority Queues](#/post/algo-tree-heap)

## 3. Types that Reduce the Range

**Two Pointers, Sliding Window, Prefix Sums**: Three methods to solve continuous interval problems in O(N) by shifting only the end without re-summing the interval every time.
[Details → Two Pointers, Sliding Window, Prefix Sums](#/post/algo-two-pointer)

**Sorting and Binary Search**: Sorting almost always ends with `sorted()`, and what to practice is binary search (discarding half of sorted data) and parametric search (binary searching the answer itself).
[Details → Sorting and Binary Search](#/post/algo-sort-search)

## 4. Types that Follow Cases

**Recursion and Backtracking**: Recursion changes the problem into smaller, identical problems; backtracking is a search method where you try options one by one via recursion and backtrack if stuck. Permutations, combinations, and N-Queens are representative problems.
[Details → Recursion and Backtracking](#/post/algo-recursion)

**BFS, DFS, and Graphs**: The only difference is whether you push the next location to a queue or a stack. Grid problems like connected components, shortest distance in a maze, and area size can all be solved with the same framework.
[Details → BFS, DFS, and Graphs](#/post/algo-graph-search)

**Shortest Path, Union-Find, Topological Sort**: These are three types that frequently appear above BFS/DFS. Finding paths with costs (Dijkstra), grouping same sides (Union-Find), and determining order (Topological sort).
[Details → Shortest Path, Union-Find, Topological Sort](#/post/algo-shortest-path)

## 5. Types that Optimize the Answer

**Dynamic Programming (DP)**: A method to store answers to avoid solving the same subproblem twice. If you just set up the recurrence relation, the code follows naturally. Covers knapsack, LIS, and coin problems.
[Details → Dynamic Programming (DP)](#/post/algo-dp)

**Greedy**: A way of choosing the best-looking option at every moment without looking back. The core is distinguishing between problems where this method works and those where it fails, so counterexamples are discussed together.
[Details → Greedy](#/post/algo-greedy)

## Suggested Study Order

After grasping complexity, study in this order: Data Structures (Hashing, Stacks/Queues) → Binary Search/Two Pointers → Recursion/BFS/DFS → DP/Greedy. This way, earlier articles serve as material for later ones. It is easier to study Dijkstra and Heaps after covering Graphs and Data Structures.