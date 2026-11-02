스택은 마지막에 넣은 걸 먼저 꺼내고, 큐는 먼저 넣은 걸 먼저 꺼낸다. 덱은 양쪽 끝에서 다 넣고 뺄 수 있는 통이다. 코딩 테스트에서는 이 셋을 "어느 쪽 끝으로 넣고 어느 쪽 끝으로 빼나"만 정하면 거의 끝난다.

## 셋이 뭐가 다른가

| | 넣는 곳 | 빼는 곳 | 순서 | 파이썬에서 |
|---|---|---|---|---|
| 스택 | 뒤 | 뒤 | 후입선출(LIFO) | `list`의 `append`, `pop` |
| 큐 | 뒤 | 앞 | 선입선출(FIFO) | `deque`의 `append`, `popleft` |
| 덱 | 앞·뒤 | 앞·뒤 | 둘 다 | `deque`의 `append`, `appendleft`, `pop`, `popleft` |

접시 쌓기가 스택이고, 줄 서기가 큐다. 덱은 둘을 합친 모양이라 스택으로도 큐로도 쓸 수 있다. 그래서 파이썬에서는 큐가 필요하면 그냥 `deque`를 쓰면 된다.

## 파이썬에서 왜 큐에 리스트를 쓰면 안 되나

리스트로 큐를 만들 수는 있다. `pop(0)`으로 앞에서 빼면 된다. 문제는 느리다는 점이다. 파이썬 문서에 따르면 리스트는 `pop(0)`과 `insert(0, v)`에서 나머지 원소를 전부 한 칸씩 옮기느라 O(n)이 든다. 반면 `deque`는 양쪽 끝 추가·삭제가 O(1)이다. 튜토리얼 문서도 리스트로 큐를 만드는 건 효율이 나쁘니 `collections.deque`를 쓰라고 한다.

직접 재 봤다. 원소 5만 개를 앞에서부터 전부 뺐더니 리스트는 약 0.155초, deque는 약 0.002초였다. 내 PC에서 한 번 잰 값이라 정확한 수치보다 "자릿수가 다르다" 정도로만 봤다. 입력이 10만, 100만으로 가면 이 차이가 시간 초과로 바뀐다. 복잡도가 왜 이렇게 갈리는지는 [자세히 → 시간복잡도와 파이썬 기본](#/post/algo-complexity)에 적어 뒀다.

스택은 반대로 리스트로 충분하다. 끝에서 넣고 빼는 건 리스트도 O(1)이다.

## 대표 문제

문제 본문은 옮기지 않고 이름만 적는다. 전부 프로그래머스 문제이고, 문제 페이지를 열어 제목과 유형을 확인했다.

- 프로그래머스 올바른 괄호: 괄호 문자열이 올바른지 판별한다. 스택의 가장 기본 쓰임이다.
- 프로그래머스 뒤에 있는 큰 수 찾기(오큰수): 각 원소의 오른쪽에서 처음 나오는 더 큰 수를 구한다. 스택에 "아직 답을 못 찾은 원소"를 쌓아 두는 유형이다.
- 프로그래머스 주식가격: 각 시점의 가격이 떨어지지 않은 시간을 구한다. 오큰수와 같은 틀이다.
- 프로그래머스 카드 뭉치: 두 카드 뭉치의 맨 앞 카드만 쓸 수 있을 때, 주어진 순서대로 단어를 만들 수 있는지 본다. 뭉치마다 앞에서 꺼내는 큐 그대로다.
- 프로그래머스 프로세스: 앞에서 꺼내 보고 더 중요한 게 뒤에 있으면 다시 뒤로 보낸다. 큐에 (우선순위, 위치)를 같이 넣는 유형이다.
- 프로그래머스 두 큐 합 같게 만들기: 두 큐 사이에서 원소를 옮겨 합을 같게 만든다. 큐의 앞에서 꺼내 다른 큐의 뒤에 넣는 연산 그대로다.

- [올바른 괄호](https://school.programmers.co.kr/learn/courses/30/lessons/12909)
- [뒤에 있는 큰 수 찾기](https://school.programmers.co.kr/learn/courses/30/lessons/154539)
- [주식가격](https://school.programmers.co.kr/learn/courses/30/lessons/42584)
- [카드 뭉치](https://school.programmers.co.kr/learn/courses/30/lessons/159994)
- [프로세스](https://school.programmers.co.kr/learn/courses/30/lessons/42587)
- [두 큐 합 같게 만들기](https://school.programmers.co.kr/learn/courses/30/lessons/118667)

## 풀이 생각 순서

1. 처리하는 순서를 본다. 가장 최근 것부터 처리하면 스택, 들어온 순서대로 처리하면 큐 후보다.
2. 괄호 짝, 되돌리기(undo), "가장 가까운 ~"가 나오면 스택을 먼저 의심한다.
3. 앞에서 빼고 뒤로 다시 넣는 시뮬레이션이면 큐다.
4. 양쪽 끝을 다 건드리면 덱이다.
5. 반복문 한 번(O(n))에 끝낼 수 있는지 본다. 스택 문제는 대개 원소마다 넣고 빼는 게 한 번씩이라 전체가 O(n)이다.

## Python 코드

아래 코드는 전부 직접 돌려서 예시 입력의 결과를 확인했다.

### 올바른 괄호

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

### 오큰수 (스택에 인덱스를 쌓는다)

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

### 카드 뭉치 (큐)

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
<summary>주식가격과 프로세스 코드</summary>

주식가격은 오큰수와 비슷한데, 값이 "떨어지는" 순간 스택에서 꺼내 거리를 기록한다.

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

프로세스는 큐에 (우선순위, 처음 위치)를 넣고, 꺼낸 것보다 높은 우선순위가 남아 있으면 뒤로 돌린다. 매번 `any`로 훑기 때문에 최악에는 O(n²)이다. 문제 페이지에서 확인한 제한이 우선순위 개수 100개 이하라 충분하다.

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

## 시간·공간 복잡도

| 문제 | 시간 | 공간 | 이유 |
|---|---|---|---|
| 올바른 괄호 | O(n) | O(n) | 글자마다 한 번 보고, 최악에는 전부 스택에 쌓임 |
| 오큰수·주식가격 | O(n) | O(n) | 각 원소가 스택에 한 번 들어가고 한 번 나옴 |
| 카드 뭉치 | O(n) | O(n) | 단어마다 deque의 맨 앞만 봄 |
| 프로세스 | O(n²) | O(n) | 꺼낼 때마다 남은 우선순위를 훑음 |

오큰수가 반복문 안에 `while`이 있는데도 O(n)인 게 처음엔 헷갈렸다. 안쪽 `while`이 도는 횟수를 전부 합치면 원소 수를 넘지 못한다. 한 원소는 한 번 들어가서 한 번만 나오기 때문이다. 이렇게 "전체 횟수를 합쳐서" 세는 방식이 스택 문제 복잡도 계산의 기본이다.

## 흔한 실수

- 큐에 `list.pop(0)`을 쓰다가 시간 초과가 난다.
- 스택이 비었는데 `pop()`을 해서 `IndexError`가 난다. 꺼내기 전에 `if st`로 확인한다.
- 오큰수에서 값 대신 인덱스를 쌓아야 하는 경우에 값을 쌓는다. 거리나 위치를 구해야 하면 인덱스를 쌓는다.
- `deque`를 슬라이싱하려고 한다. deque는 `q[1:3]` 같은 슬라이스가 안 되고, 가운데 원소 접근도 O(n)이라 인덱스로 자주 뒤지는 용도에는 맞지 않다. 이 부분은 문서에서 가운데 접근이 느리다는 설명을 근거로 한 것이라, 정확한 비용은 직접 재 보지 않았다.

## 덱을 쓸 때

양쪽 끝을 다 쓰는 문제에는 덱이 맞다. 두 큐 합 같게 만들기처럼 두 deque 사이에서 원소를 옮기는 문제가 있고, 슬라이딩 윈도우 최댓값처럼 "윈도우 안에서 후보를 앞뒤로 정리"하는 문제에도 쓴다. `deque(maxlen=k)`로 만들면 가득 찬 뒤에 새 원소를 넣을 때 반대쪽 끝이 자동으로 밀려나서, 최근 k개만 유지할 때 편하다. 슬라이딩 윈도우는 [자세히 → 투 포인터·슬라이딩 윈도우·누적합](#/post/algo-two-pointer)에서 다룬다.

## 다른 유형과 이어지는 곳

- 큐는 BFS의 몸통이다. 스택(또는 재귀)은 DFS의 몸통이다. [자세히 → BFS·DFS와 그래프](#/post/algo-graph-search)
- 재귀 호출이 쌓이는 것 자체가 호출 스택이라, 재귀가 너무 깊으면 같은 원리로 터진다. [자세히 → 재귀와 백트래킹](#/post/algo-recursion)
- 꺼내는 순서를 "들어온 순서"가 아니라 "우선순위"로 바꾸면 우선순위 큐다. [자세히 → 트리·힙·우선순위 큐](#/post/algo-tree-heap)
- 문자열·배열을 훑으며 짝이나 개수를 세는 문제는 해시와 같이 나온다. [자세히 → 배열·문자열·해시](#/post/algo-array-hash)

## 근거 링크

- Python 문서, collections.deque: https://docs.python.org/3/library/collections.html (양쪽 끝 O(1), 리스트 `pop(0)` O(n), `maxlen` 동작을 확인)
- Python 튜토리얼, 자료구조(리스트를 스택·큐로 쓰기): https://docs.python.org/3/tutorial/datastructures.html
- 사용한 문제(프로그래머스, 페이지를 열어 제목·유형 확인): 올바른 괄호 https://school.programmers.co.kr/learn/courses/30/lessons/12909 · 뒤에 있는 큰 수 찾기 https://school.programmers.co.kr/learn/courses/30/lessons/154539 · 주식가격 https://school.programmers.co.kr/learn/courses/30/lessons/42584 · 카드 뭉치 https://school.programmers.co.kr/learn/courses/30/lessons/159994 · 프로세스 https://school.programmers.co.kr/learn/courses/30/lessons/42587 · 두 큐 합 같게 만들기 https://school.programmers.co.kr/learn/courses/30/lessons/118667

## 확인 못 함

- 위 코드는 예시 입력 몇 개로만 돌렸고, 실제 채점 사이트에서 통과하는지는 확인 못 했다.
- 시간 비교(0.155초 대 0.002초)는 내 PC에서 한 번 잰 값이다.
- 프로세스의 O(n²) 풀이가 실제 채점을 통과하는지는 확인 못 했다(제한은 우선순위 100개 이하).
- 두 큐 합 같게 만들기는 코드를 쓰지 않았고, 문제 페이지의 제목·요약만 확인했다.

← 개념 지도로 (#/post/algo-map)

관련 글: [배열·문자열·해시](#/post/algo-array-hash) · [BFS·DFS와 그래프](#/post/algo-graph-search) · [트리·힙·우선순위 큐](#/post/algo-tree-heap)
