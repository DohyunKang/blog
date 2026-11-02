モデル設計において、どのアルゴリズムを使用するかを決定する前に、「このモデルは未知のデータでも適切に動作するかどうやって確認するのか」を決める段階です。筆記試験では分割比率、過学習と過少学習、交差検証の種類が頻出しますが、実習では `train_test_split` と `cross_val_score` をそのまま使用します。

## モデル選択の手順

まず問題のタイプを決定します。予測対象が数値であれば回帰、カテゴリであれば分類、正解なしでグループ化するのであればクラスタリングです。この区別が決まれば、利用可能なモデルと評価指標も同時に絞り込まれます。

| 目標 | タイプ | 例 |
|---|---|---|
| 連続値の予測 | 回帰 | 家賃、売上 |
| カテゴリの予測 | 分類 | 離脱の有無、スパムの有無 |
| 正解なしで構造を発見 | クラスタリング・関連性 | 顧客セグメント |

次に、解釈が必要か、データの量はどれくらいか、変数の数はいくつかを考慮して候補を 2〜3 つに絞ります。この単元では候補を一つに特定することはほとんどなく、同じ条件下で比較するための枠組みを作るのが目的です。各モデルについては [詳細 → 教師あり学習モデル](#/post/bd-supervised) で別途解説します。

## データを 3 つに分ける理由

学習に使ったデータでスコアを付けると、モデルが暗記したものを確認することになり、スコアが高くなりすぎます。そのためデータを分割して役割を与えます。

| 名前 | 役割 | 使用時期 |
|---|---|---|
| 訓練 (train) | モデルのパラメータ学習 | 学習時 |
| 検証 (validation) | ハイパーパラメータ調整、モデル比較 | チューニング時 |
| 試験 (test) | 最終性能確認 | 最後に一度 |

scikit-learn のドキュメントも同様の構造で説明しています。試験データは最後の評価にのみ使用し、ハイパーパラメータを調整する際は検証データを別途用意して、試験データの情報がモデルに漏れるのを防ぎます。比率は 6:2:2 や 7:3 などよく使われる値があるだけで、決まり事ではありません。データが少ない場合、検証データを別に取るのが負担になるため交差検証を使用します。

分類ではクラス比率が崩れないようにするため層化抽出 (`stratify=y`) を使用します。がん診断データで確認したところ、全体の陽性率が 0.627 のとき、訓練は 0.626、試験は 0.632 でした。分割サイズは 569 件を 6:2:2 に分け、341/114/114 件となりました。

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)
Xtr2, Xva, ytr2, yva = train_test_split(
    Xtr, ytr, test_size=0.25, stratify=ytr, random_state=42)
print(len(Xtr2), len(Xva), len(Xte))  # 341 114 114
```

試験で `random_state` を指定するのは、結果を同じように再現するためです。この値を与えないと実行するたびに分割が変わり、スコアも変わります。

## 過少学習と過学習

モデルが単純すぎてパターンを捉えられなければ過少学習、複雑すぎて訓練データのノイズまで覚えてしまえば過学習です。scikit-learn の例題では多項式の次数でこれを示しています。次数 1 は直線なので当てられず、4 でほぼ当てられ、15 ではノイズまで追従して検証誤差が爆発します。

| 状態 | 訓練性能 | 検証性能 | 原因 |
|---|---|---|---|
| 過少学習 | 低 | 低 | モデルが単純 |
| 適切 | 高 | 高 | バランス |
| 過学習 | 非常に高 | 訓練より顕著に低 | モデルが複雑、データが少ない |

判断基準は訓練スコアと検証スコアの差です。決定木の深さを変えて直接確認しました。

```python
from sklearn.tree import DecisionTreeClassifier

for d in [1, 2, 3, 5, 10, None]:
    m = DecisionTreeClassifier(max_depth=d, random_state=0).fit(Xtr2, ytr2)
    print(d, round(m.score(Xtr2, ytr2), 3), round(m.score(Xva, yva), 3))
```

| max_depth | 訓練精度 | 検証精度 |
|---|---|---|
| 1 | 0.927 | 0.895 |
| 2 | 0.968 | 0.947 |
| 3 | 0.971 | 0.947 |
| 5 | 0.997 | 0.956 |
| 10 | 1.000 | 0.956 |
| None | 1.000 | 0.956 |

深さが 1 のときはどちらも低いため過少学習側です。深さを増やすと訓練スコアは 1.0 まで上がりますが、検証スコアは 0.956 で止まります。訓練が満点なのに検証が追いつかない差が過学習の形状です。このデータでは深さ 5 以上から訓練のみ上がり、検証はそのままでした。

<details>
<summary>過学習を減らす方法のまとめ</summary>

- データをさらに集める。
- モデルを単純にする（木の深さ制限、変数の削減）。変数については [詳細 → 特徴量選択と次元削減](#/post/bd-feature-select) で扱います。
- 規制をかける（リッジ・ラッソなどのペナルティ）。
- 剪定、早期停止を使用する。
- 交差検証でハイパーパラメータを選択する。

上記の表で深さを制限するのは、2 つ目の方法の例です。
</details>

## 交差検証

検証データを一度だけ分割すると、どのように切られたかによってスコアが揺らぎます。交差検証は訓練データを k 個に分割して、交互に検証データとして使用し平均を計算します。すべてのデータが訓練と検証に一度ずつ使われるため、データが少ない場合に有利ですが、代わりにモデルを k 回学習する必要があります。

| 方法 | 内容 | 特徴 |
|---|---|---|
| Hold-out | 一度分割 | 速いが、分割によって揺らぎが生じる |
| k-fold | k 個のブロックを交互に検証 | 最も一般的、k 回学習 |
| 層別 k-fold | ブロックごとにクラス比率を維持 | 不均衡分類に使用 |
| LOOCV (leave-one-out) | k をデータ数に設定 | 1 つずつ除外して検証、計算量が多い |
| ブートストラップ | 復元抽出で訓練サンプルを生成 | 重複したサンプルを除いた残りで検証 |

scikit-learn のドキュメントによると、`shuffle` はデフォルトでオフになっているため、データがソートされている場合は `shuffle=True` を指定する必要があります。また、分類器に `cv` に整数を渡すと、`cross_val_score` が層別方式をデフォルトで使用します。

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

skf = StratifiedKFold(5, shuffle=True, random_state=0)
for d in [1, 2, 3, 5, None]:
    s = cross_val_score(
        DecisionTreeClassifier(max_depth=d, random_state=0), Xtr, ytr, cv=skf)
    print(d, s.round(3), round(s.mean(), 3))
```

| max_depth | 5 つの fold の平均 |
|---|---|
| 1 | 0.895 |
| 2 | 0.932 |
| 3 | 0.914 |
| 5 | 0.916 |
| None | 0.914 |

検証データを一度除外した場合は、深さ 5 以上が最も良さそうに見えたものの、5 つのブロックで回すと深さ 2 が最も高くなりました。同じモデルでもどのように分割するかによって結論が変わることをそのまま示しています。fold ごとのスコアの幅もかなり大きかったです（深さ 3 は 0.846〜0.945）。

<details>
<summary>交差検証におけるデータ漏洩（前処理）</summary>

スケーリングや変数選択を全体データに対して先に実行して分割して検証すると、検証ブロックの統計情報が訓練に混ざってしまいます。scikit-learn のドキュメントが推奨する方法は、前処理とモデルを `Pipeline` で束ねて、各 fold ごとに訓練ブロックのみで前処理を再調整することです。

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

p = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
s = cross_val_score(p, Xtr, ytr, cv=skf)
print(round(s.mean(), 3))  # 0.974
```

同じ訓練データにおいて、決定木よりもこのロジスティック回帰パイプラインの交差検証平均スコアが高かった（0.974）。このような方法で候補モデルを同一の分割で比較するのがモデル選択です。前処理自体については [詳細 → データ前処理](#/post/bd-preprocessing) を参照してください。
</details>

## 試験データは最後に一度だけ

交差検証で選んだ設定を、訓練データの全体で再度学習させた後、試験データに対して一度だけ評価します。深さ 3 で学習して試験データに適用したところ、精度は 0.939 でした。試験スコアを見てモデルを修正し始めると、試験データが検証データになってしまい、最終スコアの意義が失われます。スコアをどの指標で読むかは [詳細 → モデル評価](#/post/bd-evaluation) を参照してください。

## よく混同される点

- 検証データと試験データは異なります。検証はチューニングに使用し、試験は最後に一度だけ使用します。
- 訓練精度が高いからといって良いモデルではありません。間隔（ギャップ）を見る必要があります。
- 交差検証はモデルを作成する方法ではなく、性能を推定する方法です。学習は各 fold ごとに新しく行います。
- 層別は分類のクラス比率を合わせるため、回帰にはそのまま使用できません。
- 比率 7:3 や 6:2:2 は慣習であり、公式ではありません。

実習でこの流れをコード 하나로 つなげてみるのは [詳細 → 実践 Python まとめ](#/post/bd-practical-python) にあります。

## 参考文献リンク

- scikit-learn, Cross-validation: evaluating estimator performance — https://scikit-learn.org/stable/modules/cross_validation.html
- scikit-learn, Underfitting vs. Overfitting — https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html

← 概念マップへ (#/post/bd-map)

関連記事：[分析モデル設計の前半・変数選択と次元削減](#/post/bd-feature-select) · [教師あり学習モデル](#/post/bd-supervised) · [モデル評価](#/post/bd-evaluation)