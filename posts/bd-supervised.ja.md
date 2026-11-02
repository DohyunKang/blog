教師学習とは、ラベルが付けられたデータを用いてモデルを学習させる手法です。正解が数値の場合は回帰、カテゴリの場合は分類となります。ビッグデータ分析技士の試験では、モデル名から特徴を即座に想起させる問題や、コードを実行して結果を解釈する実技問題が出題されます。試験日程と受験料は公式サイトで確認してください。データを分割して検証する方法については [詳細 → 分析モデル設計](#/post/bd-model-design) を参照し、本稿ではモデル自体のみについて解説します。

## モデル一覧表

| モデル | 一言での特徴 | 試験で問われること |
|---|---|---|
| 線形・多重回帰 | 直線（平面）にフィットさせて数値を予測 | 仮定、多重共线性、決定係数 |
| ロジスティック回帰 | 確率を 0~1 の範囲に変換して分類 | オッズ、シグモイド、係数の解釈 |
| 決定木 | 質問を繰り返しながらデータを分割 | 不純度（ジニ・エントロピー）、剪定 |
| SVM | 2 つのクラスの間で最も広いマージンを持つ境界 | サポートベクトル、カーネル、C・gamma |
| アンサンブル | 複数のモデルを組み合わせる | バギングとブースティングの違い、ランダムフォレスト |
| ニューラルネットワーク | ヒドロ層を重ねて非線形性を学習 | 活性化関数、誤差逆伝播法、過学習 |

回帰については [詳細 → 探索的解析と基礎統計](#/post/bd-eda-stats) の相関・回帰と続き、仮定や解釈はそこで先に把握しておくのが良いです。

## ロジスティック回帰

名前は回帰ですが分類モデルです。線形式の値をシグモイド関数に代入して 0~1 の間の確率に変換し、通常は 0.5 を基準にクラスを決定します。scikit-learn のドキュメントでは二値分類において確率は 1 / (1 + exp(-(Xw + w0))) と表され、ログ損失に正則化項を加えて最小化すると説明されています。複数のクラスがある場合は各クラスごとに重みを置き、softmax で確率を生成します。

正則化の強さは C で調整しますが、C は正則化強度の逆数なので大きいほど正則化が弱くなります。過去問で「係数を 0 にしてしまう正則化は何か」と問われたらラッソ (L1) です。リッジ (L2) は係数を小さくするだけで 0 にすることはしません。ラッソが変数選択効果をもたらす理由は [詳細 → 特徴量選択と次元削減](#/post/bd-feature-select) で続きます。

## 決定木

各ノードで「どの変数をどの基準値で分割すると子ノードが最も純粋になるか」を探します。純粋さを測る指標が不純度であり、分類ではジニ指数とエントロピーが使われます。一度に最も良い分割を選ぶ貪欲な手法のため、全体の最適木を保証するわけではありません。

長所は解釈が容易でスケーリングがほぼ不要という点です。短所は 2 つ覚えておけば十分です。制限なく成長させると学習データに対して過学習し、データが少し変わっても木の形状が大きく変わります。過学習は剪定で防ぎます。事前に止める事前剪定（最大深度、葉の最小サンプル数）と、育ててから切る事後剪定（コスト複雑度、ccp_alpha）があります。

## SVM

2 つのクラスを分ける境界の中で、両側の間隔が最も広いものを選びます。境界の決定に使われるのは境界に近い一部の点であり、これがサポートベクトルです。直線で分割できない場合はカーネルで空間を変換して解きます。線形、多項式、RBF、シグモイドカーネルがあります。

- C: 境界を逸脱した点に課す罰則。小さければ境界が滑らかになり、大きければ学習データをすべて当てようとしてしまいます。
- gamma: 1 つの点の影響範囲。大きければ近い点のみ影響を与えるため過学習しやすくなります。

SVM は変数のサイズに敏感でスケーリングが事実上必須です。実技で SVM のスコアが異常に低い場合はまずスケーリングを疑います。実際に動かした結果は下の演習にあります。

## アンサンブル

弱いモデルを複数組み合わせることで、1 つのモデルよりも優れた性能を実現します。バギングとブースティングの違いがよく問われます。

| | バギング・ランダムフォレスト | ブースティング |
|---|---|---|
| 生成順序 | 並列（互いに独立） | 順次（前のモデルの誤りを補完） |
| 主に減らすもの | 分散 | 偏り |
| 個別モデル | 深く育てた木 | 浅い木 |
| 例 | Random Forest | AdaBoost, Gradient Boosting |

ランダムフォレストは各木ごとにブートストラップサンプルを使用し、分割時に変数の一部だけを無作為に候補に立てます。木同士の誤差が似ていないため平均を取ると誤差が相殺されます。AdaBoost は誤ったサンプルの重みを上げて次のモデルが困難なサンプルに集中させ、Gradient Boosting は現在の予測の損失勾配を次の木が追従させるようにします。学習率 (learning_rate) で一歩の大きさを小さくして過学習を抑えます。

## ニューラルネットワーク

入力層と出力層の間に隠れ層を置き、各ニューロンは入力の加重和に活性化関数を適用した後、次の層へ渡します。活性化関数のおかげで非線形な関係を学習できます。出力層は二値分類ならロジスティック、多クラス分類ならソフトマックス、回帰なら恒等関数を用います。学習は、出力側で求めた誤差を逆方向に伝播させて重みを修正するバックプロパゲーションで行います。初期値によって結果が異なり、スケーリングに敏感で、層の数やニューロンの数を決定しなければならないのが欠点です。

## 手動実行による比較

乳がん診断データ（scikit-learn 内蔵、サンプル数 569、変数 30）を 7:3 に分割し、モデルごとの精度を計測しました。環境は scikit-learn 1.9.1 です。一時的な確認のためクロスバリデーションは行わず、データを再度分割すると数字が若干異なります。

<details>
<summary>コードを開く</summary>

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

models = {
    "logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
    "tree_full": DecisionTreeClassifier(random_state=42),
    "tree_d3": DecisionTreeClassifier(max_depth=3, random_state=42),
    "svm_noscale": SVC(),
    "svm_scale": make_pipeline(StandardScaler(), SVC()),
    "rf": RandomForestClassifier(random_state=42),
    "gb": GradientBoostingClassifier(random_state=42),
    "mlp": make_pipeline(StandardScaler(), MLPClassifier(max_iter=1000, random_state=42)),
}
for name, m in models.items():
    m.fit(Xtr, ytr)
    print(name, round(m.score(Xtr, ytr), 3), round(m.score(Xte, yte), 3))
```

</details>

| モデル | 学習精度 | テスト精度 |
|---|---|---|
| ロジスティック（スケーリングあり） | 0.987 | 0.988 |
| 木、深さ制限なし | 1.000 | 0.918 |
| 木、max_depth=3 | 0.980 | 0.924 |
| SVM、スケーリングなし | 0.920 | 0.906 |
| SVM、スケーリングあり | 0.982 | 0.977 |
| ランダムフォレスト | 1.000 | 0.936 |
| グラディエントブースティング | 1.000 | 0.942 |
| ニューラルネットワーク (MLP) | 0.997 | 0.982 |

読むべきポイントは主に三つです。深さ制限のない木は学習精度が 1.000 でテスト精度が 0.918 と乖離が大きく、過学習の兆候です。深さを 3 に制限すると学習精度は下がり、テスト精度は若干上がります。SVM はスケーリングの有無だけでテスト精度が 0.906 から 0.977 に変化しました。ロジスティック回帰では C を 0.01、1、100 に変えると係数の絶対値の和がそれぞれ 3.82、15.81、107.23 と増大し、テスト精度は 0.942、0.988、0.953 となりました。規制が強まると係数が小さくなるという事実は数字から読み取れます。このデータセットでは単純なロジスティック回帰が最も高かったため、複雑なモデルが常に優れているとは限らない例と言えます。

## よくあるパターン

- **過学習の診断**: 学習スコアが高くテストスコアが低い場合は過学習です。木の場合は剪定、SVM の場合は C や gamma の調整、ニューラルネットワークの場合は規制や層の削減で対応します。
- **モデルの選択**: 解釈性が重要ならロジスティック回帰・木、精度を最優先ならアンサンブル・SVM・ニューラルネットワークを選ぶべきです。
- **バッグング対ブースティング**: 並列処理か順次処理か、分散を減らすかバイアスを減らすかの二軸で分類できます。
- **スケーリングが必要なモデル**: SVM とニューラルネットワークでは必要ですが、木系モデルではほぼ不要です。

出典原文は翻訳していません。問題を見ると、この四つのパターンのうちどこに該当するかをまず分類します。スコアの読み方は [詳細 → モデル評価](#/post/bd-evaluation) に、実技用のコードの流れは [詳細 → 実技 Python 要点](#/post/bd-practical-python) にまとめました。

## よくある誤解

- **ロジスティック回帰は回帰問題用である**: 出力は確率であり、用途は分類です。
- **精度が 100% に近いほど良いモデルである**: 学習データ基準であればむしろ過学習のシグナルです。
- **ランダムフォレストもブースティングのように前のモデルを補完する**: フォレストは木同士を互いに独立に作ります。
- **ニューラルネットワークはスケーリングなしでもよい**: ドキュメントではスケーリングを強く推奨しています。

## 根拠となるリンク

- scikit-learn, Decision Trees: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn, Support Vector Machines: https://scikit-learn.org/stable/modules/svm.html
- scikit-learn, Ensembles: https://scikit-learn.org/stable/modules/ensemble.html
- scikit-learn, Linear Models (ロジスティック・リッジ・ラッソ): https://scikit-learn.org/stable/modules/linear_model.html
- scikit-learn, Neural network models (supervised): https://scikit-learn.org/stable/modules/neural_networks_supervised.html

← 概念マップへ ([ビッグデータ分析士 map](#/post/bd-map))

関連記事: [分析モデルの設計](#/post/bd-model-design) · [非教師あり学習モデル](#/post/bd-unsupervised) · [モデル評価](#/post/bd-evaluation)