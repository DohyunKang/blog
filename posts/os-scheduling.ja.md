スケジューリングとは、実行準備が整ったプロセスが複数ある場合に、CPU を誰に、どれだけ割り当てるかを決定することです。概要記事（[OS の基礎](#/post/cs-os)）では FIFO、SJF、Round Robin を一行ずつだけ軽く触れただけで、ここでは各アルゴリズムがどの指標を良くしようとして作られたのか、そして指標同士がなぜ衝突するのかを数値を追って解説します。

## まず 2 つの指標

スケジューリングを比較するには基準（メトリクス）が必要です。「OSTEP（教科書）」では 2 つを採用しています。

- **ターンアラウンド時間 (turnaround)**: タスクが到着してから完了するまでの時間です。完了時刻 − 到着時刻です。
- **レスポンスタイム (response)**: タスクが到着してから最初に CPU を得るまでの時間です。初回実行時刻 − 到着時刻です。

バッチシステムであればターンアラウンド時間が重要で、ターミナル前に人が座っている場合はレスポンスタイムが重要です。教科書は、分时コンピュータ（タイムシェアリング）が登場した頃からレスポンスタイムという指標が生まれたと説明しています。この 2 つの指標を 1 つのアルゴリズムで同時に良くすることは難しいというのがこの記事の主旨です。

「先取 (preemptive)」という言葉も先に整理しておきます。非先取スケジューラーは、1 つのタスクを最後まで回して次に移ります。一方、先取スケジューラーは実行中のタスクを中断して別のタスクに切り替えることができ、これにはコンテキストスイッチが必要です。教科書では、現代のスケジューラーは事実上すべて先取型であると記しています。コンテキストスイッチ自体については [プロセスとスレッド](#/post/os-process-thread) で扱います。

## FCFS (FIFO) とホスト効果

到着順に処理します。実装が最も簡単です。タスク A(100 秒)、B(10 秒)、C(10 秒) がこの順序で同時に到着したとします。

- 完了時刻: A 100, B 110, C 120
- 平均ターンアラウンド時間: (100+110+120)/3 = 110

短い B と C が長い A の後に待機します。教科書はこの現象をホスト効果 (convoy effect) と呼びます。

## SJF と STCF

最も短いタスクから回すとどうなるでしょうか。同じ入力に対して B、C、A の順で回せば完了時刻は 10, 20, 120 になり、平均ターンアラウンド時間は 50 です。110 から 50 に減りました。すべてのタスクが同時に到着するという仮定の下では SJF が最適であると教科書は記しています。

しかし、仮定の 1 つを崩すと崩壊します。A が 0 秒に、B と C が 10 秒に到着すると、非先取 SJF はすでに回っている A を最後まで待ちます。平均ターンアラウンド時間は再び 103.33 になります。解決策が STCF (Shortest Time-to-Completion First, 先取型 SJF) です。新しいタスクが入ってくるたびに、残り時間が最も短いタスクを選びます。B と C が来ると A を中断してそれらを先に回し、平均ターンアラウンド時間を 50 に戻します。

SJF シリーズには現実的な弱点があります。タスクがどれくらい時間がかかるかを事前に知る必要があります。オペレーティングシステムは通常、それを知らないため、以下のような MLFQ が登場しました。

## Round Robin とレスポンスタイム

SJF シリーズはレスポンスタイムが悪いです。A、B、C がそれぞれ 5 秒で同時に到着すると、SJF のレスポンスタイムは 0, 5, 10 で平均 5 です。Round Robin はタスクを時間スライス (quantum) 分だけ回して次のタスクに切り替えます。スライスを 1 秒とすれば初回実行時刻が 0, 1, 2 になり、平均レスポンスタイムは 1 です。

代償はターンアラウンド時間です。同じ入力に対して RR では A が 13、B が 14、C が 15 で終わって平均 14 となり、SJF は 5, 10, 15 で平均 10 です。教科書は RR をターンアラウンド時間の基準でほぼ最悪に近いポリシーと呼びます。タスクを可能な限り長く伸ばす方式だからです。より一般的に、短い時間単位で CPU を公平に分けるポリシーはターンアラウンド時間が悪いです。公平性とターンアラウンド時間はトレードオフの関係にあります。

スライス長もまた別のトレードオフです。短すぎるとコンテキストスイッチのコストが支配的になります。教科書の例ではスライスが 10ms で切り替えに 1ms かかれば時間の約 10% を切り替えに使い、スライスを 100ms に増やせば 1% 以下に下がります。切り替えはレジスタを変えるだけでなく、CPU キャッシュや TLB に蓄積された状態も破棄してしまうためコストが大きいという説明もあります。

<details>
<summary>指標を直接計算してみる (実行確認済み)</summary>

1 秒単位でシミュレーションするコードで上記の数字を再現しました。ポリシーごとに「次に誰を回すか」だけが異なります。

```python
from collections import deque

def metrics(jobs, first, done):
    ta = {n: done[n]-jobs[n][0] for n in jobs}
    rt = {n: first[n]-jobs[n][0] for n in jobs}
    return ta, rt, sum(ta.values())/len(ta), sum(rt.values())/len(rt)

def simulate(jobs, pick):
    rem = {n: l for n, (a, l) in jobs.items()}
    first, done = {}, {}
    t = 0; running = None
    while len(done) < len(jobs):
        ready = [n for n in jobs if jobs[n][0] <= t and n not in done]
        if not ready:
            t += 1; continue
        n = pick(ready, rem, running, jobs)
        first.setdefault(n, t)
        rem[n] -= 1; t += 1; running = n
        if rem[n] == 0:
            done[n] = t; running = None
    return metrics(jobs, first, done)

def fifo(ready, rem, running, jobs):
    return running if running in ready else min(ready, key=lambda n: jobs[n][0])
def sjf(ready, rem, running, jobs):   # 비선점
    return running if running in ready else min(ready, key=lambda n: jobs[n][1])
def stcf(ready, rem, running, jobs):  # 선점
    return min(ready, key=lambda n: rem[n])

def rr(jobs, q):
    rem = {n: l for n, (a, l) in jobs.items()}
    first, done = {}, {}; t = 0; queue = deque(); arrived = set()
    def admit(t):
        for n in jobs:
            if jobs[n][0] <= t and n not in arrived:
                arrived.add(n); queue.append(n)
    admit(0)
    while len(done) < len(jobs):
        if not queue:
            t += 1; admit(t); continue
        n = queue.popleft(); first.setdefault(n, t)
        run = min(q, rem[n]); t += run; rem[n] -= run
        admit(t)
        if rem[n]: queue.append(n)
        else: done[n] = t
    return metrics(jobs, first, done)

J1 = {"A": (0, 100), "B": (0, 10), "C": (0, 10)}
J2 = {"A": (0, 100), "B": (10, 10), "C": (10, 10)}
J3 = {"A": (0, 5), "B": (0, 5), "C": (0, 5)}
print(simulate(J1, fifo)[2:])   # (110.0, 70.0)
print(simulate(J1, sjf)[2:])    # (50.0, 10.0)
print(simulate(J2, sjf)[2:])    # (103.33, 63.33)
print(simulate(J2, stcf)[2:])   # (50.0, 3.33)
print(simulate(J3, sjf)[2:])    # (10.0, 5.0)
print(rr(J3, 1)[2:])            # (14.0, 1.0)
```

| 入力 | ポリシー | 平均ターンアラウンド | 平均レスポンスタイム |
|---|---|---|---|
| A100・B10・C10 同時到着 | FCFS | 110 | 70 |
| 同じ入力 | SJF | 50 | 10 |
| A は 0, B・C は 10 に到着 | SJF(非先取) | 103.33 | 63.33 |
| 同じ入力 | STCF | 50 | 3.33 |
| 5・5・5 同時到着 | SJF | 10 | 5 |
| 同じ入力 | RR(スライス 1) | 14 | 1 |
</details>

<details>
<summary>RR スライス長を変えると (実行確認済み)</summary>

`rr(J1, q)` のコードでスライスの長さを変更して、A100・B10・C10 の入力を試行した。

| スライス | 平均ターンアラウンド時間 | 平均応答時間 |
|---|---|---|
| 1 | 59.67 | 1.00 |
| 5 | 58.33 | 5.00 |
| 10 | 56.67 | 10.00 |
| 50 | 83.33 | 36.67 |
| 100 | 110.00 | 70.00 |

スライスが最も長い 100 の場合、すべてのタスクが一気に完了するため FCFS と同じ数値が得られる。スライスを小さくすると応答性は向上する。このシミュレーションでは切り替えコストが存在しないためターンアラウンド時間は一貫して改善に見えるが、実際には前述の切り替えコストが逆方向に作用している。
</details>

## 優先度スケジューリング

各タスクに優先度を付与し、高いものから実行する。SJF は「短いほど優先度が高い」と定義された優先度スケジューリングの一種とみなせる。非抢占式では現在実行中のタスクが完了するまで切り替わらず、抢占式ではより優先度の高いタスクが到着した瞬間に CPU を奪う。

P1(24), P2(3), P3(3) が同時に到着し、優先度が P2 > P3 > P1 であると仮定する。非抢占式で実行すると完了時刻は P2 で 3、P3 で 6、P1 で 30 となり、平均ターンアラウンド時間は 13 である。同じ入力を FCFS(P1, P2, P3 の順) で実行すると 24, 27, 30 となり、平均は 27 となる。

弱点は、高い優先度のタスクが連続して到着すると低い優先度のタスクが CPU を受け取れず「飢餓 (starvation)」に陥ることである。次の節の MLFQ はこの問題を正面から扱っている。

## MLFQ: SJF に近い挙動を事前知識なしで実現

MLFQ(Multi-Level Feedback Queue) は複数の異なる優先度のキューを設け、タスクの振る舞いを観察して優先度を動的に変更する。教科書はこのアルゴリズムが解決しようとする問題を次のように述べている。「タスクの長さを知らずに、短いタスクには速い応答を与えつつ、長いタスクも不必要に妨げずターンアラウンド時間を短縮したい」という要件である。

基本ルールは以下の通りだ。

- ルール 1: 優先度の高いタスクが実行される。
- ルール 2: 優先度が同じ場合は Round Robin で実行する。
- ルール 3: 新しいタスクは最も上位のキューから開始する。
- ルール 4: あるレベルで割り当て量 (allotment) を使い切ると、1 つ下のキューへ降格する。
- ルール 5: 一定時間 S ごとにすべてのタスクを最も上位のキューに戻す (priority boost)。

当初はすべてのタスクが短いと仮定して最上位に配置する。本当に短ければそこで完了し、長ければ徐々に下位のキューへ降りていく。タスクの長さも知らずに振る舞いから SJF に近い挙動を実現する方式である。対話型タスクは I/O が頻繁なので上位に残り続け、CPU だけを消費する長いタスクは下位へ移動する。

ルール 4 を「割り当て量を使い切る前に I/O で CPU を解放してもそのレベルに留まる」と解釈すると、2 つの問題が生まれると教科書は指摘している。1 つ目は飢餓である。対話型タスクが連続して到着すると、下位キューの長いタスクは CPU を受け取れなくなる。2 つ目はスケジューラを欺くことだ。割り当て量がほぼ尽きる直前に意図的に短い I/O を呼び出すと、常に最上位に留まってしまう。ルール 5(周期的な boost) が飢餓を防ぎ、各レベルで消費した総時間を基準とした降格ルール 4 が欺きを防ぐ。教科書は S が大きすぎると長いタスクが餓死し、小さすぎると対話型タスクが自分の分を受け取れないと述べている。したがってこれらの値は自動的に決まる調節パラメータではない。

実装はシステムによって異なる。教科書によると Solaris のスライスクラスはデフォルト 60 クイ、20ms から数百 ms に増えるスライス時間、約 1 秒ごとに boost を行う表形式の方式である。FreeBSD 4.3 スケジューラは表ではなく、時間の経過とともに CPU 使用量を減らす式で優先度を計算する。

<details>
<summary>MLFQ の飢餓と boost の直接確認 (実行確認済み)</summary>

キューを 3 つ、割り当て量を 10ms に単純化したシミュレーターだ。長いタスク L は 0ms に到着し、10ms の短いタスクが 20ms から 10ms ごとに 1 つずつ連続して到着する (CPU は常に満杯になる)。

```python
from collections import deque

def mlfq(jobs, levels=3, allot=10, boost=None, T=300):
    q = [deque() for _ in range(levels)]
    rem = {n: v[1] for n, v in jobs.items()}
    used = {n: 0 for n in jobs}; lvl = {}; cpu = {n: 0 for n in jobs}
    for t in range(T):
        for n, (a, l) in jobs.items():
            if a == t: lvl[n] = 0; q[0].append(n)
        if boost and t > 0 and t % boost == 0:      # 규칙 5
            for L in range(1, levels):
                while q[L]: q[0].append(q[L].popleft())
            for n in lvl: lvl[n] = 0; used[n] = 0
        n = next((q[L][0] for L in range(levels) if q[L]), None)
        if n is None: continue
        L = lvl[n]
        cpu[n] += 1; rem[n] -= 1; used[n] += 1
        if rem[n] == 0:
            q[L].popleft()
        elif used[n] >= allot:                       # 할당량 소진 -> 강등
            q[L].popleft(); used[n] = 0
            lvl[n] = min(L + 1, levels - 1); q[lvl[n]].append(n)
    return cpu

jobs = {"L": (0, 1000)}
for i in range(30):
    jobs[f"i{i}"] = (20 + i * 10, 10)

print(mlfq(jobs, boost=None)["L"])   # 20
print(mlfq(jobs, boost=100)["L"])    # 40
```

300ms 間において L が受け取った CPU は boost を適用しない場合 20ms、100ms および 200ms で boost を適用した場合 40ms だった。20ms は新しいタスクが到着する前に単独で実行されていた時間であり、その後は新しいタスクが途切れることなく一度も実行できなかった。boost を適用すると 100ms および 200ms の時点で L が最上位に昇り 10ms ずつ獲得する。非常に小さな分ではあるが餓死しないことが要点だ。
</details>

## よくある誤解

- SJF（Shortest Job First）が最も良い：平均返却時間が最も良いため、反応速度が良いわけではない。5・5・5 の入力の場合、SJF の平均反応時間は 5、RR は 1 であった。
- RR（Round Robin）は公平だから常に良い：返却時間は悪化する可能性がある。5・5・5 の入力の場合、RR は平均 14、SJF は 10 であった。
- タイムスライスが短いほど良い：反応は良くなるが、コンテキストスイッチのコストが増加する。
- 先着順だと速い：到着時刻がバラバラな場合、STCF（Shortest Time to Completion First）の方が SJF より優れていたのは事実だが、先着順はコンテキストスイッチというコストを払うことになる。
- 優先順位が高いといつかは実行される：低い優先順位のタスクは、高い優先順位のタスクが連続して到着すると実行されない可能性がある。そのため、MLFQ（Multi-Level Feedback Queue）にはブースト機構がある。

メモリが不足した際に起こることは、[メモリ管理と仮想メモリー](#/post/os-memory) で続きます。

## 根拠リンク

- OSTEP, Scheduling: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf
- OSTEP, Scheduling: The Multi-Level Feedback Queue: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf

← 概念マップへ (#/post/cs-map)

関連記事：[オペレーティングシステム基礎](#/post/cs-os) · [プロセスとスレッド](#/post/os-process-thread) · [同期とデッドロック](#/post/os-sync-deadlock)