機械学習とは、人間がルールを記述せず、データを提示してモデル自身がルールに対応する数値（重み）を自ら決定させる手法です。深層学習はその中でも、層を深く積み重ねたニューラルネットワークを用いるアプローチです。

## 簡単な説明から

スパムメールをフィルタリングするプログラムを作ることを考えましょう。従来の方法は、「件名に『当選』が含まれていればスパム」といったルールを人間が一つずつ記述するものです。機械学習は逆に進みます。スパムと非スパムのラベル付きメールを大量に与え、それらを区別するルールをモデルがデータから見つけるようにします。

そのルールの実体は数値です。入力を受け取り、いくつかの数値（重み）を掛け合わせて足し合わせ、答えを出す仕組みですが、最初はこれらの数値が乱立しており、答えも不正確です。学習とは、この数値を少しずつ修正して誤答を減らすプロセスです。「学習する」という言葉が壮大に聞こえても、実際に行っているのは数値の修正作業です。

深層学習も同じ枠組みです。扱う数値の数が数万から数十億へと増え、掛け算と足し算の段階を複数の層で積み重ねた点が異なります。層構造については [詳しく → ニューラルネットワークとバックプロパゲーション](#/post/ml-neural-net) で扱います。LLM もこの枠組みの上に成り立っています。[詳しく → LLM](#/post/ai-llm)

## 学習の 3 つの部品

学習を分解すると、以下の 3 つの要素があります。

| 部品 | 役割 | 例 |
|---|---|---|
| モデル | 入力から答えを出す仕組み。内部には調整可能な数値（パラメータ）があります | `予測 = w × 入力 + b` |
| 損失関数 | 答えがどれだけ間違っているかを 1 つの数値で測ります | 誤差の二乗平均 (MSE) |
| 最適化 | 損失が減る方向にパラメータを修正します | 勾配降下法 |

この 3 つが動作する順序は常に同じです。現在の数値で予測を行い、損失を計算し、損失が減る方向に数値を少し修正してこれを繰り返します。

## 損失関数

損失関数は、「どれだけ間違っているか」を 1 つの数値に集約する関数です。数値が小さいほど正解に近いことを意味します。1 つの数値にまとめる必要があるのは、それによって「損失が減る方向」という明確な方向性を定めることができるからです。

回帰（数値当て）では、誤差の二乗平均である MSE が一般的です。二乗することで、負の誤差と正の誤差が相殺されず、大きく外れた場合に大きなペナルティが課されます。分類（スパムか否か）では、通常はクロスエントロピーという別の損失関数を使います。こちらは正解の確率低めにしたほど損失が大きくなる仕組みですが、数式についてはここでは割愛します。

損失を何にするかは、「どのようなモデルを望むか」を決めることになります。なぜならモデルは損失だけを減らそうとするからです。

## 勾配降下法

勾配降下法 (gradient descent) は、損失が最も低い地点を探して降りていく方法です。Google の機械学習講座では以下のように説明しています。重みとバイアスを 0 付近から始めて、損失を計算し、損失が減る方向を見つけ、その方向に少し移動するのを繰り返します。さらに減らなければ止めます。

霧のかかった山を下りたと想像すると分かりやすいです。頂上は見えませんが、足元の傾斜しか感じられません。傾斜が下がる方向に一歩歩き、また足元を感じて、これを繰り返します。足元の傾斜が勾配 (gradient) で、一歩の大きさが学習率 (learning rate) です。更新式は以下の通りです。

`新しい値 = 古い値 − 学習率 × 勾配`

学習率が小さすぎると降りるのに時間がかかり、大きすぎると谷を飛び越えてしまい、逆に損失が増大する可能性があります。そのため、学習率は人間が設定する値（ハイパーパラメータ）の中で最初に触れるものと言えます。

実際に回してみました。5 つの点 (`y ≈ 2x + 1` の付近に少し揺らぎのある値) に直線を当てはめるコードです。

```python
import numpy as np
x = np.array([1,2,3,4,5], dtype=float)
y = np.array([3.1,4.9,7.2,8.8,11.1])
w, b, lr = 0.0, 0.0, 0.01
for step in range(1, 1001):
    pred = w*x + b
    err = pred - y
    loss = (err**2).mean()
    gw = 2*(err*x).mean()   # 손실을 w로 미분한 값
    gb = 2*err.mean()       # 손실을 b로 미분한 값
    w -= lr*gw; b -= lr*gb
    if step in (1,10,100,1000):
        print(step, round(loss,4), round(w,3), round(b,3))
```

実行結果は以下の通りでした。

| 反復 | 損失 | w | b |
|---|---|---|---|
| 1 | 57.222 | 0.501 | 0.14 |
| 10 | 0.5012 | 1.972 | 0.563 |
| 100 | 0.0414 | 2.081 | 0.72 |
| 1000 | 0.0214 | 1.994 | 1.034 |

損失は 57 から 0.02 に低下し、w は 2、b は 1 の付近に収束しました。最初の 10 回で大部分が降りており、以降はゆっくりと微調整されている様子です。ニューラルネットワークもこの枠組みをそのまま使っています。パラメータが無数に増えた場合でも効率的に勾配を求める手法がバックプロパゲーションです。

## 過学習

学習の目標は訓練データを当てることではなく、初めて見るデータも当てられることです。Google の講座での表現では、この能力を一般化 (generalization) と呼び、その逆の状態を過学習 (overfitting) と呼びます。訓練データには非常に良く当てているが、新しいデータには当てられない状態です。

試験勉強に例えると、出題された問題の答えだけを丸暗記したケースです。出題問題は満点ですが、問題が少し変わると間違えてしまいます。パラメータが多くデータが少ないほど、このような暗記は容易になります。これは、データに含まれるノイズ（偶然の揺らぎ）さえもルールとして暗記してしまうためです。

これも回してみました。`sin(2x)` にノイズを混ぜて 60 点を作成し、30 点で学習（訓練）、15 点で検証しながら多項式の次数を変えました。次数が高いほどモデルは複雑になります。

```python
import numpy as np
rng = np.random.default_rng(0)
x = rng.uniform(-1,1,60)
y = np.sin(2*x) + rng.normal(0,0.2,60)
idx = rng.permutation(60)
tr, va, te = idx[:30], idx[30:45], idx[45:]
def mse(p,i): return float(((np.polyval(p,x[i])-y[i])**2).mean())
for d in (1,3,9,15):
    p = np.polyfit(x[tr], y[tr], d)
    print(d, round(mse(p,tr),3), round(mse(p,va),3))
```

| Epoch | Training Loss | Validation Loss |
|---|---|---|
| 1 | 0.075 | 0.07 |
| 3 | 0.032 | 0.044 |
| 9 | 0.024 | 0.048 |
| 15 | 0.021 | 0.936 |

Training loss continues to decrease as the epoch increases. Validation loss is lowest around epoch 3 and jumps up to 0.936 at epoch 15. If we only looked at the training numbers, epoch 15 would appear to be the best model. Conversely, epoch 1 is too simple, resulting in high values for both metrics; this is called underfitting.

Google's course also conveys the same signal: if the training loss keeps decreasing or flattens out while the validation loss starts rising at some point, it indicates overfitting.

## Training · Validation · Testing

In the experiment above, we would not have detected overfitting without validation data. Therefore, data is usually split into three sets.

| Data | Usage |
|---|---|
| Training (training) | Used to adjust parameters |
| Validation (validation) | Used to check for overfitting during training and to make choices such as model type or learning rate |
| Testing (test) | Used once at the end to gauge how well the model performs in a real environment |

The reason for keeping test data separate is that validation data becomes "seen" data during the selection process. If we repeatedly select based on validation scores, the model may inadvertently adapt to the validation set. Test values must remain honest and should not be used in such selection processes. In the code above, `te` occupies that spot; in this experiment, it was left empty as it was not used separately.

Methods to reduce overfitting include increasing the amount of data, simplifying the model, applying regularization (adding penalties for large parameters), or stopping training when validation loss starts to rise (early stopping).

## Common Misconceptions

- High training accuracy means a good model: As shown in the table above, training loss continues to decrease as complexity increases. What matters is the performance on unseen data.
- Making models larger is always better: If a model is too large relative to the data, overfitting becomes easier. However, cases like large-scale LLMs that use enormous amounts of data are different situations and should not be conflated with the small examples discussed here.
- Learning is memorizing answers: Memorizing is overfitting. The goal is to learn rules (generalization).
- Gradient descent always reaches the minimum: This holds true for simple loss landscapes (convex), such as fitting a straight line. For complex cases like neural networks, there is no such guarantee.
- Deep learning is entirely different from machine learning: Deep learning is a subset of machine learning. The three components mentioned above and data splitting apply directly here.

## What to Read Next

Once you grasp that learning involves adjusting numbers, questions diverge in two directions: one asks "what structure holds these numbers" ([Details → Neural Networks and Backpropagation](#/post/ml-neural-net)), and the other asks "what do large models look at and how do they learn first" ([Details → Pretraining and RLHF](#/post/ml-pretraining)). Further adjusting already trained models with your own data is covered in [Details → Fine-tuning](#/post/ml-finetuning). Converting text to number vectors via [Details → Embedding](#/post/ai-embedding) also sits atop the same "number adjustment" concept.

<details>
<summary>Detailed Explanation: Calculating One Step of Gradient Descent by Hand</summary>

Let's say we have a point `(x=2, y=5)`, model `prediction = w × x`, initial `w = 0`, and learning rate `0.1`.

- Prediction = 0 × 2 = 0, Error = 0 − 5 = −5
- Loss = Error² = 25
- Differentiating loss with respect to w gives `2 × Error × x = 2 × (−5) × 2 = −20`
- New w = 0 − 0.1 × (−20) = 2

A negative gradient means "increasing w reduces the loss," and the minus sign in the update rule sends w in that direction. At new w = 2, prediction becomes 4, reducing error to −1. Doing it again yields a gradient of `2 × (−1) × 2 = −4`, making w = 2.4, getting closer to the correct answer of 2.5.

The numpy code above averages this over 5 points and performs the update jointly for both w and b.

</details>

## Reference Links

- Google, Machine Learning Crash Course, Overfitting: https://developers.google.com/machine-learning/crash-course/overfitting/overfitting
- Google, Machine Learning Crash Course, Gradient descent: https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent

[← Concept Map](#/post/ml-map)

関連記事：[ニューラルネットワークとバックプロパゲーション](#/post/ml-neural-net) · [事前学習と RLHF](#/post/ml-pretraining) · [ファインチューニング](#/post/ml-finetuning)