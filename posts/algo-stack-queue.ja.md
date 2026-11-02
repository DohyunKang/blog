スタックは最後に入れたものを先に取り出し、キューは最初に入れたものを先に取り出します。デクは両端からどちらも入れたり取り出したりできる容器です。コーディングテストでは、この 3 つのうち「どちらの端に挿入し、どちらの端から削除するか」を決めればほぼ終わりです。

## 3 つの違いは何か

| | 挿入場所 | 削除場所 | 順序 | Python で |
|---|---|---|---|---|
| スタック | 後 | 後 | 後入れ先出し (LIFO) | `list` の `append`, `pop` |
| キュー | 後 | 前 | 先入れ先出し (FIFO) | `deque` の `append`, `popleft` |
| デク | 前・後 | 前・後 | 両方 | `deque` の `append`, `appendleft`, `pop`, `popleft` |

お皿を積み重ねるのがスタック、列に並ぶのがキューです。デクは両方を合わせたような形なので、スタックとしてもキューとしても使えます。そのため Python ではキューが必要なら単に `deque` を使えばよいのです。

## なぜ Python でリストを使ってキューを作るのはダメなのか

リストでキューを作ることは可能です。`pop(0)` で先頭から削除すればよいだけです。問題は速度が遅いことです。Python のドキュメントによると、リストは `pop(0)` や `insert(0, v)` を行う際、残りの要素をすべて 1 つずつ移動させる必要があるため O(n) となります。一方 `deque` は両端の追加・削除が O(1) です。チュートリアルドキュメントもリストでキューを作るのは効率が悪いと指摘し、`collections.deque` を使うよう勧めています。

実際に計測してみました。5 万個の要素を先頭からすべて削除すると、リストは約 0.155 秒、deque は約 0.002 秒でした。これは私の PC で測定した値であり、正確な数値よりも「桁が異なる」程度に捉えてください。入力が 10 万、100 万になるとこの差は時間超過 (Time Limit Exceeded) に変わります。なぜ複雑度がこれほど変わるのかは [詳細 → 時間計算量と Python の基本](#/post/algo-complexity) に書いてあります。

スタックは逆にリストで十分です。末尾に挿入して削除するのはリストでも O(1) です。

## 代表的な問題

問題本文はそのままにして、名前のみ記載します。すべてプログラミング머스 (Programmers) の問題であり、問題ページを開いてタイトルとタイプを確認しました。

- プログラミング머스 正しい括弧: 括弧文字列が正しいか判定する。スタックの最も基本的な使い方です。
- プログラミング머스 後ろにある大きな数を探す (次の大きな数): 各要素の右側で最初に現れるより大きな数を求めます。スタックに「まだ答えが見つからない要素」を溜めておくタイプです。
- プログラミング머스 株価: 各時点での価格が下がっていない時間を求めます。次の大きな数と同じ枠組みです。
- プログラミング머스 カード束: 2 つのカード束のうち、先頭のカードしか使えない場合、与えられた順序で単語を作れるか確認します。束ごとに先頭から取り出すキューそのままです。
- プログラミング머스 プロセス: 先頭を取り出し、より重要なものが後ろにある場合は再び後ろに戻します。キューに (優先順位、位置) を同時に格納するタイプです。
- プログラミング머스 2 つのキューの和を等しくする: 2 つのキューの間で要素を移動させて和を等しくします。キューの先頭から取り出して別のキューの末尾に挿入する演算そのままです。

- [正しい括弧](https://school.programmers.co.kr/learn/courses/30/lessons/12909)
- [後ろにある大きな数を探す](https://school.programmers.co.kr/learn/courses/30/lessons/154539)
- [株価](https://school.programmers.co.kr/learn/courses/30/lessons/42584)
- [カード束](https://school.programmers.co.kr/learn/courses/30/lessons/159994)
- [プロセス](https://school.programmers.co.kr/learn/courses/30/lessons/42587)
- [2 つのキューの和を等しくする](https://school.programmers.co.kr/learn/courses/30/lessons/118667)

## 解法の思考順序

1. 処理する順序を確認します。最も最近のものから処理すればスタック、入った順に処理すればキューになります。
2. 括弧のペア、取り消し (undo)、"最も近い ~" が現れる場合はまずスタックを疑います。
3. 先頭から取り出して後ろに戻すシミュレーションならキューです。
4. 両端のどちらかを扱う場合はデクです。
5. 1 つのループ (O(n)) で終わらせることができるか確認します。スタックの問題は通常、要素ごとに挿入と削除を各 1 回行うため全体が O(n) です。

## Python コード

以下のコードはすべて実際に実行して、例題の入力結果を確認しました。

### 正しい括弧

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

### 次の大きな数 (スタックにインデックスを溜める)

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

### カード束 (キュー)

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
<summary>株価とプロセスのコード</summary>

株価は次の大きな数と似ていますが、値が「下がる」瞬間にスタックから取り出して距離を記録します。

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

プロセスはキューに (優先順位、初期位置) を登録し、取り出したものよりも高い優先順位のものが残っていれば後方に回します。毎回 `any` で巡回するため最悪ケースでは O(n²) となります。問題ページで確認した制限が優先順位数 100 個以下であるため十分です。

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

## 時間・空間計算量

| 問題 | 時間 | 空間 | 理由 |
|---|---|---|---|
| 正しい括弧 | O(n) | O(n) | 文字ごとに一度見て、最悪の場合スタックに全て積み上げる |
| 次の大きな数・株価 | O(n) | O(n) | 各要素がスタックに一度入って一度出される |
| カード束 | O(n) | O(n) | 単語ごとに deque の先頭のみを見る |
| プロセス | O(n²) | O(n) | 取り出すたびに残りの優先順位を巡回する |

次の大きな数が反復文の中に `while` を含んでいるにも関わらず O(n) であるのが最初は混乱しました。内側の `while` が回る回数の合計は要素数を越えません。一つの要素は一度入って一度だけ出るためです。このように「全体の回数を合わせて」数える方式がスタック問題の計算量計算の基本です。

## よくある間違い

- キューに `list.pop(0)` を使うとタイムアウトします。
- スタックが空なのに `pop()` して `IndexError` になります。取り出す前に `if st` で確認します。
| 次の大きな数 | 値の代わりにインデックスを積む必要がある場合に値を積みます。距離や位置を求める場合はインデックスを積みます。
- `deque` をスライシングしようとします。deque は `q[1:3]` などのスライスが使えず、中央要素へのアクセスも O(n) であるため、インデックスで頻繁に参照する用途には適していません。この部分は文書で中央へのアクセスが遅いという説明を根拠としたもので、正確なコストは直接確認していませんでした。

## デクを使う場合

両端をどちらも使う問題には deque が適しています。「2 つのキューの合計が等しくなるようにする」のように 2 つの deque の間で要素を移動させる問題や、「スライディングウィンドウ内の候補を前後に整理する」ような問題にも使います。`deque(maxlen=k)` で作成すると、満杯になった後に新しい要素を入れると反対側の端が自動的に押し出されるため、直近 k 個のみを維持する場合に便利です。スライディングウィンドウについては [詳細 → ツーポインタ・スライディングウィンドウ・累積和](#/post/algo-two-pointer) で扱っています。

## 他のタイプにつながる場所

- キューは BFS の本体です。スタック（または再帰）は DFS の本体です。[詳細 → BFS・DFS とグラフ](#/post/algo-graph-search)
- 再帰呼び出しが積み上がるものがコールスタックであり、再帰が深すぎると同じ原理で壊れます。[詳細 → 再帰とバックトラック](#/post/algo-recursion)
| 取り出す順序を「入った順序」ではなく「優先順位」に変えると優先순위キューになります。 | [詳細 → ツリー・ヒープ・優先順位キュー](#/post/algo-tree-heap)
- 文字列・配列を巡回してペアや個数を数える問題はハッシュとセットで出ます。[詳細 → 配列・文字列・ハッシュ](#/post/algo-array-hash)

## 根拠リンク

- Python ドキュメント、collections.deque: https://docs.python.org/3/library/collections.html (両端 O(1)、リスト `pop(0)` O(n)、`maxlen` の動作を確認)
- Python チュートリアル、データ構造（リストをスタック・キューとして使う）: https://docs.python.org/3/tutorial/datastructures.html
- 使用した問題（プログラマーズ、ページを開いてタイトル・タイプ確認）: 正しい括弧 https://school.programmers.co.kr/learn/courses/30/lessons/12909 · 次の大きな数を見つける https://school.programmers.co.kr/learn/courses/30/lessons/154539 · 株価 https://school.programmers.co.kr/learn/courses/30/lessons/42584 · カード束 https://school.programmers.co.kr/learn/courses/30/lessons/159994 · プロセス https://school.programmers.co.kr/learn/courses/30/lessons/42587 · 2 つのキューの合計が等しくなるようにする https://school.programmers.co.kr/learn/courses/30/lessons/118667

← コンセプトマップへ (#/post/algo-map)

関連記事: [配列・文字列・ハッシュ](#/post/algo-array-hash) · [BFS・DFS とグラフ](#/post/algo-graph-search) · [ツリー・ヒープ・優先順位キュー](#/post/algo-tree-heap)