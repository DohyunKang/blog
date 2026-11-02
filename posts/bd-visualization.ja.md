ビッグデータ分析技師筆記試験の第 4 科目の後半は、結果をどのように提示し解釈するかを扱います。計算問題はほとんどなく、どのグラフがどのような状況に適しているか、指標や結果を読み込んで結論を選ぶ問題が中心です。モデル評価指標自体は [詳細へ → モデル評価](#/post/bd-evaluation) に別途整理しており、ここではその数字をどのように解釈して伝えるかを扱います。

試験日程と受験料は公式サイトで確認してください。この記事では単元の核心とよくある出題パターンのみを取り上げます。

## 視覚化は目的に合わせて選ぶ

グラフは示したい関係が決まればほぼ自動的に決まります。

| 示す内容 | 代表的なグラフ | メモ |
|---|---|---|
| 1 つの変数の分布 | ヒストグラム、箱ひげ図 | 箱ひげ図は中央値・四分位数・外れ値を一度に示します |
| 2 つの数値変数の関係 | 散布図 | 相関があるか、外れ値がないかまず確認します |
| 複数の変数間の相関 | 相関行列ヒートマップ | 色の濃淡で相関係数の大きさを読み取ります |
| カテゴリ別の大きさ比較 | 棒グラフ | カテゴリに順序がない場合は大きさ順に並べると読み取りやすいです |
| 時間経過に伴う変化 | 折れ線グラフ | 時系列は基本です |
| 全体に対する構成比 | パイ図・累積棒グラフ | 項目が多い場合は棒グラフの方が適しています |
| 分類結果 | 混同行列、ROC 曲線 | 閾値による変化を確認します |

試験では「この目的にはどのグラフが適切か」という形式の問題が多いです。分布はヒストグラム・箱ひげ図、関係は散布図、傾向は折れ線グラフにまとめおけば大部分を網羅できます。

さらに一点、視覚化はデータを正直に示す必要があります。軸の真ん中から切ると小さな差が大きく見え、パイ図のセクションが多すぎると比較できません。レポート用のグラフにはタイトル・軸名・単位が欠けてはいけません。

## 解釈で区別すべき 3 つのポイント

解釈問題は、互いに似ている概念を区別できるかを問うことが多いです。

### 1. 変数の重要性（何がモデルに重要か）

ツリー系モデルは学習中に各変数が不純度をどれだけ減らしたかで重要性を与えます。以下は乳がん診断データ（scikit-learn 内蔵）でランダムフォレストを学習させて実際に実行した結果です。

<details>
<summary>実行コードと結果（pandas、scikit-learn で実行して確認）</summary>

```python
import pandas as pd, numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

d = load_breast_cancer(as_frame=True)
X, y = d.data, d.target
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)

rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(Xtr, ytr)

# 트리 불순도 기반 중요도
imp = pd.Series(rf.feature_importances_, index=X.columns)
print(imp.sort_values(ascending=False).head(5).round(3))

# 순열 중요도 (시험 데이터에서)
pi = permutation_importance(rf, Xte, yte, n_repeats=10, random_state=42)
print(pd.Series(pi.importances_mean, index=X.columns)
        .sort_values(ascending=False).head(5).round(3))
```

不純度に基づく上位 5 つ

```
worst perimeter         0.141
worst area              0.132
worst concave points    0.122
worst radius            0.085
mean concave points     0.077
```

置換重要性の上位 5 つ

```
worst texture      0.011
mean texture       0.005
concavity error    0.005
symmetry error     0.005
perimeter error    0.005
```
</details>

同じモデルなのに 2 つの順位が全く異なります。不純度ベースではサイズ（perimeter, area, radius）が上に上がり、置換重要性では値は全て 0.01 以下と非常に小さいです。このデータには半径・周長・面積のように互いにほぼ同じ情報を含まれる変数が複数あるためです。scikit-learn のドキュメントでも、相関の高い変数があれば一つを混ぜても残りで情報を復元できるため両方とも重要性が低く出る可能性があるとして説明しています。そのため、相関の高い変数はまとめて代表の一つだけにする方式を推奨します。

まとめると以下のようになります。

| 区分 | 不純度ベース（ツリー内蔵） | 置換重要性 |
|---|---|---|
| 計算 | 学習中の不純度減少量の合計 | 変数一つを混ぜてスコアがどれだけ低下するか |
| 適用モデル | ツリー系 | どんなモデルでも |
| 弱点 | 数値型・固有値が多い変数に偏り | 相関の高い変数があれば両方とも低く出る |
| データ | 学習データ基準 | 試験（検証）データで計算可能 |

どちらもモデルがその変数にどれだけ依存しているかを示すだけで、変数自体の予測力や因果関係を述べているわけではありません。この部分は試験でも選択肢文としてよく変形されます。

### 2. 変数の効果方向（どちらに影響を与えるか）

重要性は大きさのみを知らせ、方向は分かりません。方向はモデルによって読み方が異なります。

- 線形・ロジスティック回帰では係数の符号と大きさで読み取ります。ロジスティック回帰の係数は対数オッズの変化であり、`exp(係数)`がオッズ比です。
- ツリー系は部分依存グラフ（PDP）でみます。一つの変数の値を変えながら残りは平均して予測がどう変わるかを描きます。

<details>
<summary>ロジスティック係数と部分依存値（直接実行）</summary>

```python
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import partial_dependence

lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
lr.fit(Xtr, ytr)
coef = pd.Series(lr[-1].coef_[0], index=X.columns).sort_values()
print(coef.head(3).round(2))
print(np.exp(coef.head(1)).round(3).to_dict())

pdp = partial_dependence(rf, Xte, ["worst radius"], grid_resolution=5)
print(pdp["grid_values"][0].round(1))
print(pdp["average"][0].round(3))
```

結果

```
worst texture          -1.23
worst concave points   -1.00
worst area             -0.95
{'worst texture': 0.293}

[10.4 14.1 17.7 21.4 25.1]
[0.662 0.656 0.527 0.524 0.524]
```
</details>

標準化してから学習したため、`worst texture` の係数 -1.23 はこの変数が標準偏差 1 つ増えると対数オッズが 1.23 減少することを意味します。オッズ比では 0.293、約 0.29 倍です。このデータでターゲット 1 は陽性（benign）なので、負の係数は陽性側の確率を低下させる方向です。

部分依存値は、`worst radius`が大きくなるにつれて陽性確率の平均が 0.66 から 0.52 に低下しました。中央部で最も大きく曲がり、両端は平坦ですが、平均の単一の線だけではこの区間ごとの差異を見逃しやすくなります。文書によると、個々のサンプルごとに線を引いた ICE プロットは、平均に隠れた異質な効果を示します。また、PDP と ICE は、対象変数が他の変数と独立であると仮定しているため、相関の高い変数が存在すると非現実的なデータ点が混ざり曲線が歪められる可能性があります。

### 3. 閾値と予測結果（どこで切るか）

分類モデルは確率を出力し、陽性として切り取る地点は人間が決めます。同じモデルにおいて閾値を変えてみることにより、混乱行列がどのように変化するかを確認しました。

<details>
<summary>閾値別の混乱行列（直接実行）</summary>

```python
from sklearn.metrics import confusion_matrix, roc_auc_score
pp = rf.predict_proba(Xte)[:, 1]
print("auc", round(roc_auc_score(yte, pp), 3))
for t in (0.5, 0.8, 0.95):
    tn, fp, fn, tp = confusion_matrix(yte, (pp >= t).astype(int)).ravel()
    print(t, "TN", tn, "FP", fp, "FN", fn, "TP", tp)
```

結果

```
auc 0.992
0.5  TN 58  FP 6  FN 4   TP 103
0.8  TN 64  FP 0  FN 12  TP 95
0.95 TN 64  FP 0  FN 31  TP 76
```
</details>

| 閾値 | 偽陽性 (FP) | 偽陰性 (FN) |
|---|---|---|
| 0.5 | 6 | 4 |
| 0.8 | 0 | 12 |
| 0.95 | 0 | 31 |

AUC は 0.992 で変化しませんが、閾値によってエラーの種類は完全に変わります。閾値を上げると陽性とする基準が厳格化されるため、FP が減少し FN が増加します。したがって、どのエラーがより痛手になるかが閾値選択の基準となります。疾患スクリーニングのように見逃してはいけない問題では再現率を、スパムフィルターのように正常メールをブロックしてはいけない問題では精密度を優先します。各指標の定義は [詳細 → モデル評価](#/post/bd-evaluation) を参照してください。

## 結果レポートとモデル運用

分析結果はモデルを使用する人に伝えられなければ完了しません。レポートには通常、以下の項目が含まれます。

1. 分析目的とデータ説明（出所、期間、サイズ）
2. 前処理とモデル選択のプロセス、使用した指標
3. 結果の要約（主要数値と解釈）
4. 限界と活用方法

解釈する際には相関と因果を区別することが基本です。変数の重要度が高いからといって、その変数が結果の原因であるとは限りません。学習・検証・試験データを分けた理由と過学習の確認は、[詳細 → 分析モデル設計](#/post/bd-model-design) を併せて読むことで続きます。

モデルはデプロイ後も管理対象です。時間が経過すると入力データの分布が変化し性能が低下する可能性があるため、性能指標を継続的に監視し、必要に応じて再学習を行うなどの運用を行います。モデルをどのようなアルゴリズムで作成したかは、[詳細 → 教師あり学習モデル](#/post/bd-supervised) と [詳細 → 教師なし学習モデル](#/post/bd-unsupervised) で扱います。

## 解く際の順序

解釈問題は、以下の順序で選択肢を絞り込むとスムーズです。

- どのようなグラフを選ぶ問題か → 示す関係（分布・関係・傾向・構成）から決定します。
- 重要度を問うのか、方向性を問うのか → 重要度は大きさのみ、方向性は係数の符号または PDP です。
- 「重要度が高いと原因である」といった選択肢 → 相関と因果の区別で除外します。
- エラーの種類を問うのか → FP と FN のうちどちらがより大きな損失かによって閾値を決定します。

実技では、このフローをコードに落とし込む練習が必要です。その部分は [詳細 → 実技 Python 要点](#/post/bd-practical-python) を併せて読むことで続きます。

← [概念マップへ (#/post/bd-map)](#/post/bd-map)

関連記事：[モデル評価](#/post/bd-evaluation)、[分析モデル設計](#/post/bd-model-design)、[実技 Python 要点](#/post/bd-practical-python)

## 参照リンク

- scikit-learn, Permutation feature importance: https://scikit-learn.org/stable/modules/permutation_importance.html
- scikit-learn, Partial Dependence and Individual Conditional Expectation plots: https://scikit-learn.org/stable/modules/partial_dependence.html