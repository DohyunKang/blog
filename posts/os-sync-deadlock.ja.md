[概要](#/post/cs-os) では同期を「共有する場所で必要なもの」と簡潔に扱ってきました。ここではその部分を切り出し、なぜ値がずれてしまうのか、ロックとセマフォとは何か、デッドロックが発生する条件と回避方法までコードを実行しながら整理します。スレッドがメモリを共有するという前提は [プロセスとスレッド](#/post/os-process-thread) で先に扱いました。

## 競合状態とクリティカルセクション

複数のスレッドが同じ変数を読み書きすると、結果は実行順序によって変わります。これを競合状態 (race condition) と呼びます。`n += 1` は一行ですが、実際には読み取り、加算、書き込みの 3 つに分かれ、その間に他のスレッドが割り込む可能性があります。2 つのスレッドが同じ値を読み、それぞれ 1 を足して書き込んだ場合、増加分が一つ失われます。割り込まれてはいけないコード領域をクリティカルセクション (critical section) と呼びます。

クリティカルセクションを守るには、一度に一つのスレッドしか入れないようにする必要があります。これを相互排他 (mutual exclusion) と呼び、最も一般的なツールはロック (mutex) です。ロックを取得したスレッドだけが領域に入り、他のスレッドはロックが解放されるまで待ちます。スレッドがいつ切り替わるかはスケジューラーが決めるため、プログラムでは知ることはできません ([CPU スケジューリング](#/post/os-scheduling))。そのため「普通は問題ない」というコードには保証がありません。

<details>
<summary>ロックなし / ロックありで 4 つのスレッドが 2000 回ずつ加算（実行確認済み）</summary>

読み取りと書き込みの間に `time.sleep(0)` を入れて、スレッドが切り替わる隙間を意図的に作りました。

```python
import threading, time
n = 0
def inc(k):
    global n
    for _ in range(k):
        tmp = n
        time.sleep(0)
        n = tmp + 1

def run(f, *a):
    ts = [threading.Thread(target=f, args=a) for _ in range(4)]
    [t.start() for t in ts]; [t.join() for t in ts]

run(inc, 2000); print("no lock", n)   # 2074 (실행마다 다름)

n = 0
lk = threading.Lock()
def inc2(k):
    global n
    for _ in range(k):
        with lk:
            tmp = n; time.sleep(0); n = tmp + 1

run(inc2, 2000); print("lock", n)     # 8000
```

ロックがない場合、8000 になるはずの値が 2074 でした。この数字は実行ごとに異なります。ロックを使った方は同じ隙間があっても 8000 が出力されました。
</details>

## セマフォ

ロックが「入ってよいか、ダメなのか」のどちらか一方であるのに対し、セマフォ (semaphore) は整数を保持しているカウンターです。OSTEP の教科書は以下のように説明しています。演算は 2 つあり、POSIX での名前には `sem_wait()` と `sem_post()` があります。Dijkstra はこの 2 つを P() と V() と呼んでいました。

- `sem_wait`: 値を 1 減らし、減らした値が負なら待ちます。
- `sem_post`: 値を 1 増やし、待機中のスレッドがあれば一つ起こします。

教科書は、値が負のときにその絶対値が待機中のスレッド数である点も指摘しています。初期値が用途を決定します。

| 初期値 | 用途 | 例 |
|---|---|---|
| 1 | ロックの代わり（二進セマフォ） | クリティカルセクション保護 |
| 0 | 順序合わせ | 子が終了した後、親が続きを実行 |
| N | 同時に最大 N 個まで許可 | リソース N 個、バッファの空き N 個 |

初期値が N の場合の代表的な問題は生産者 - 消費者 (bounded buffer) です。N 個の区画を持つバッファに対して、片方が入れ、片方が取り出します。`empty`（初期値 N、空き数）と `full`（初期値 0、満タン数）、そしてバッファ自体を守る `mutex` を使います。満タンなら生産者が `empty` で、空なら消費者が `full` で待ちます。非同期キューはこの構造と同じ悩みを抱えています ([非同期処理とメッセージキュー](#/post/be-async-queue))。

OSTEP にはこの問題の誤った解法も掲載されています。mutex を `empty`/`full` より先に取得するとデッドロックになります。消費者が mutex を保持したまま `full` を待っていると、入れるための生産者は mutex を取得できず、永遠に入れられません。

<details>
<summary>セマフォを使った生産者 - 消費者と、mutex を先に取得した誤ったバージョン（実行確認済み）</summary>

```python
import threading, collections
N = 3
empty = threading.Semaphore(N); full = threading.Semaphore(0); mu = threading.Lock()
buf = collections.deque(); out = []

def prod():
    for i in range(10):
        empty.acquire()                 # 빈 칸 기다림
        with mu: buf.append(i); assert len(buf) <= N
        full.release()

def cons():
    for _ in range(10):
        full.acquire()                  # 찬 칸 기다림
        with mu: out.append(buf.popleft())
        empty.release()

p = threading.Thread(target=prod); c = threading.Thread(target=cons)
p.start(); c.start(); p.join(); c.join()
print(out)   # [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

4 回繰り返しても順序通りに出力され、バッファの長さが N を超えていませんでした。誤ったバージョンでは `with mu:` の中で `acquire` を呼ぶように変更しています。

```python
import time
def prod():
    for i in range(5):
        with mu:
            empty.acquire(); buf.append(i); full.release()
def cons():
    for _ in range(5):
        with mu:
            full.acquire(); buf.popleft(); empty.release()

c = threading.Thread(target=cons, daemon=True); p = threading.Thread(target=prod, daemon=True)
c.start(); time.sleep(.1); p.start()      # 소비자가 먼저 mu를 잡고 대기
c.join(1); p.join(1)
print("consumer alive:", c.is_alive(), "producer alive:", p.is_alive())
# consumer alive: True producer alive: True
```

1 秒待ってもどちらも終了しませんでした。
</details>

初期値を 0 にして順序を合わせるのも短いです。子スレッドが `release()` を呼ぶまで、親が `acquire()` で待ち続けると、ログに `child` が先に、`parent after` が後に出力されます（実行して確認済み）。

## デッドロック

ロックを使うと新たな問題が発生します。スレッド 1 がロック A を保持して B を待っているのに、スレッド 2 は B を保持して A を待っていると、どちらも動けなくなります。これがデッドロック (deadlock) です。ロックが一つしかない場合は発生せず、2 つ以上あり重なって取得したときに発生します。

OSTEP がまとめたデッドロックの 4 つの条件は以下の通りです（1971 年の論文を引用）。4 つが同時に成立して初めてデッドロックが発生し、どれか一つでも破れれば発生しません。

| 조건 | 意味 |
|---|---|
| 相互排他 | リソースを一度にスレッドが一つだけ独占する（ロックを取得） |
| 占有と待機 | リソースを既に保持したまま、他のリソースを待つ |
| 非強奪性 | 保持しているリソースを他から強制的に奪うことができない |
| 循環待機 | スレッド同士が円環状に互いの保持しているリソースを待つ |

教科書では目立たず発生する例として、Java の `Vector.addAll()` を挙げている。`v1.addAll(v2)` は内部で v1 と v2 のロックを両方取得するが、別のスレッドがほぼ同時に `v2.addAll(v1)` を呼び出すと順序が逆になりデッドロックになる可能性がある。呼び出し側からは 2 つのロックが使われていることが見えない。

<details>
<summary>逆順で 2 つのロックを取得すると止まる（実行確認済み）</summary>

```python
import threading, time
a = threading.Lock(); b = threading.Lock()
def w1():
    with a:
        time.sleep(.1)
        with b: pass
def w2():
    with b:
        time.sleep(.1)
        with a: pass

t1 = threading.Thread(target=w1, daemon=True); t2 = threading.Thread(target=w2, daemon=True)
t1.start(); t2.start(); t1.join(2); t2.join(2)
print("alive after 2s:", t1.is_alive(), "/", t2.is_alive())
# alive after 2s: True / True
```

2 秒経っても両方とも生きていた。エラーもなくただ立っているのがデッドロックの外観だ。`sleep(.1)` の間、互いにロックを一つずつ握らせてタイミングを合わせたものだ。
</details>

## 回避方法

OSTEP は 4 つの条件のうち一つを破ることで予防策を整理している。

- 循環待機の破り：ロックを取得する順序に全体的なルールを設ける。ロックが L1、L2 の 2 つある場合は常に L1 を先に取得する。教科書で最も実用的だと挙げられている方法だ。関数が 2 つのロックを引数として受け取る場合は、ロックのアドレス値を基準に順序を決めるコツも紹介している。欠点は順序が慣習に過ぎない点だ。コードベース全体を知る必要があるし、一箇所でも間違えれば再度発生する。
- 占有と待機の破り：必要なロックを一括で（原子的に）取得する。前述のグローバルロックを一つ置くようなものだが、どのロックが必要か事前に知る必要があり並行性が低下する。
- 非強奪性の破り：`trylock` で試しに取得し、失敗したら保持しているロックを解放して最初からやり直す。2 つのスレッドが互いに譲り合い続ける「活死（livelock）」が発生する可能性があり、再試行前にランダムな遅延を入れると減るとのことだ。
- 相互排他的破り：compare-and-swap などのハードウェア命令でロック不要のデータ構造を作る。簡単なことではない。

<details>
<summary>同じコード内で順序を統一し、タイムアウトで撤退する（実行確認済み）</summary>

2 つのスレッドが同じ順序（a の後で b）で取得するようにすると、上記のようなタイミングでも終わる。

```python
a = threading.Lock(); b = threading.Lock()
def w():
    with a:
        time.sleep(.1)
        with b: pass
ts = [threading.Thread(target=w, daemon=True) for _ in range(2)]
[t.start() for t in ts]; [t.join(2) for t in ts]
print("alive:", [t.is_alive() for t in ts])   # alive: [False, False]
```

撤退方式は 2 つ目のロックを `acquire(timeout=0.5)` で取得し失敗したら諦める。

```python
a = threading.Lock(); b = threading.Lock(); log = []
def x(first, second, name):
    with first:
        time.sleep(.1)
        if second.acquire(timeout=0.5): second.release(); log.append(name + " ok")
        else: log.append(name + " gave up")
t1 = threading.Thread(target=x, args=(a, b, "t1")); t2 = threading.Thread(target=x, args=(b, a, "t2"))
t1.start(); t2.start(); t1.join(); t2.join(); print(sorted(log))
# ['t1 ok', 't2 gave up']
```

t2 が諦めて b を解放したおかげで t1 が終わった。諦めた側が再度試行するコードは別途書く必要がある。
</details>

## 食事をしている哲学者

Dijkstra が出した有名な問題だ。哲学者 5 人が円卓に座っており、その間にはフォークが一つずつある（計 5 つ）。食べるには左と右のフォークの両方が必要だ。OSTEP も実用性は低いが有名だと紹介している。全員が左のフォークから拾うと、全員がフォークを一つずつ保持したまま右を待ちながら止まる。4 つの条件が揃ったデッドロックだ。教科書の解法は哲学者一人（4 番目）だけ拾う順序を逆にすることで循環待機を断ち、Dijkstra 自身もこのように解いたと書いている。

<details>
<summary>全員左優先 vs 番号順（実行確認済み）</summary>

```python
def dine(ordered):
    forks = [threading.Lock() for _ in range(5)]
    meals = [0] * 5
    def ph(i):
        l, r = i, (i + 1) % 5
        first, second = (min(l, r), max(l, r)) if ordered else (l, r)
        for _ in range(3):
            with forks[first]:
                time.sleep(.05)
                with forks[second]:
                    meals[i] += 1
    ts = [threading.Thread(target=ph, args=(i,), daemon=True) for i in range(5)]
    [t.start() for t in ts]; [t.join(2) for t in ts]
    return meals

print("naive", dine(False))     # [0, 0, 0, 0, 0]
print("ordered", dine(True))    # [3, 3, 3, 3, 3]
```

左優先方式は 4 回回して 3 回は全員 0 食で、一回だけ一人が 1 食食べて止まった。番号の小さいフォークから拾う方式は毎回全員 3 食食べた。このコードで順序が逆になるのは哲学者 4 のみで（フォーク 0 を先に）、残りは左優先と同じだ。
</details>

## よくある誤解

- ロックだけ使えば安全：ロックによってデッドロックが発生する。2 つ以上のロックがある場合は順序を決める必要がある。
- デッドロックと活死は同じ：デッドロックは誰も動けない状態であり、活死は動き続けているが進展がない状態だ。
- 再現できないなら安全：上記のコードでもタイミングを合わせてやらないと発生した。普段発生しないからといって順序が正しいコードではない。
- セマフォアはロックの別名：初期値が 1 ならロックのように使われるが、カウンターなので順序合わせや個数制限にも使う。

## 根拠リンク

- OSTEP, セマフォア (Semaphores): https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf
- OSTEP, よくある並行性問題 (Common Concurrency Problems): https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf

← 概念マップで (#/post/cs-map)

関連記事：[OS の基礎](#/post/cs-os) · [トランザクションと隔離レベル](#/post/db-transaction) · [非同期処理とメッセージキュー](#/post/be-async-queue)