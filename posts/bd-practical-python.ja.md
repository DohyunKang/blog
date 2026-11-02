実技 Python は、データを取得して前処理を行い、モデルを作成し、評価した後に結果をファイルとして出力する一連の流れです。覚えるべきは関数名よりもこの順序です。試験日程・受験料・出題形式については公式サイトで確認してください。この記事は単元の知識ではなくコードの流れのみを整理したものです。概念については前の単元の記事で別途解説します。

## 流れは六つのステップ

| 手順 | 作業内容 | 主に使用するもの |
|---|---|---|
| 1 | データの確認・欠損値チェック | `df.shape`, `df.isna().sum()` |
| 2 | 欠損値・異常値の処理 | `fillna`, `dropna`, 四分位数 |
| 3 | カテゴリ変数のエンコーディング | `pd.get_dummies` |
| 4 | 学習データ・テストデータの分割 | `train_test_split` |
| 5 | スケーリング・モデル学習 | `StandardScaler`, `RandomForestClassifier` |
| 6 | 評価・保存 | `accuracy_score`, `roc_auc_score`, `to_csv` |

順序が間違えると失敗する箇所は二つあります。スケーラーは分割後に学習データのみでフィットさせる必要がありますし、エンコーディングは分割前に一度に行うことで列名のズレを防ぐことができます。理由は下のコード例と一緒に確認してください。

概念については [詳細 → データ前処理](#/post/bd-preprocessing)、[詳細 → 分析モデル設計](#/post/bd-model-design) をご覧ください。

## サンプルデータ

試験用データではなく、自作した練習用のデータです。年齢・所得に意図的に欠損値を挿入しています。

```python
import numpy as np, pandas as pd
rng = np.random.default_rng(0)
n = 200
df = pd.DataFrame({
    "age": rng.integers(20, 70, n).astype(float),
    "income": rng.normal(4000, 800, n).round(0),
    "grade": rng.choice(["A", "B", "C"], n),
})
df["buy"] = ((df["income"] > 4000) ^ (rng.random(n) < 0.2)).astype(int)
df.loc[rng.choice(n, 20, replace=False), "age"] = np.nan
df.loc[rng.choice(n, 10, replace=False), "income"] = np.nan
print(df.isna().sum())
print(df.shape)
```

実行すると `age` は 20、`income` は 10、`grade`・`buy` は 0 が出力され、形状は `(200, 4)` になります。実技でもデータをロードした直後にこの二行（形状と欠損値の個数）を表示する癖をつけるのがおすすめです。

## 欠損値処理

pandas のドキュメントを基準にすると、`isna()` は欠損の有無を同じ形状の真/偽で返し、`dropna()` は欠損がある行（デフォルト）または列を削除し、`fillna()` は削除せずに値で埋めます。一言で覚えるなら「探す、消す、埋める」です。

```python
num_cols = ["age", "income"]
df[num_cols] = df[num_cols].fillna(df[num_cols].median())
print(df.isna().sum().sum())   # 0
```

数値列は平均や中央値で埋めるのが一般的です。異常値が含まれている場合、平均は引きずられるため中央値の方が安全です。埋めた後に `isna().sum().sum()` が 0 になるか確認すれば完了です。

<details>
<summary>四分位数を用いて異常値を除外する</summary>

IQR方式では、Q1 − 1.5×IQR 未満または Q3 + 1.5×IQR を超える値を異常値とみなします。

```python
s = pd.DataFrame({"v": [1, 2, 5]})
q1, q3 = s["v"].quantile([.25, .75])
iqr = q3 - q1
kept = s[(s.v >= q1 - 1.5*iqr) & (s.v <= q3 + 1.5*iqr)]
```

値が 1, 2, 5 の場合、Q1 は 1.5、Q3 は 3.5 と計算され、すべて残ります。試験では「除外すべきか」「置換すべきか」は問題文を先に読む必要があります。
</details>

## カテゴリ変数のエンコーディング

文字列列はモデルが読み込めないため数値に変換します。ワンホットエンコーディングは `pd.get_dummies` です。

```python
X = pd.get_dummies(df.drop(columns="buy"), columns=["grade"], drop_first=True)
y = df["buy"]
print(list(X.columns))   # ['age', 'income', 'grade_B', 'grade_C']
```

`drop_first=True` を指定すると基準カテゴリ (A) が除外され、列が一つ減ります。カテゴリが三つなら列は二つになります。このオプションを指定しなくても木系モデルは動作しますが、回帰系モデルでは列同士が重複する問題が発生する可能性があるため、指定した方が無難です。

## 分割とスケーリング

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

sc = StandardScaler().fit(X_tr[num_cols])
X_tr = X_tr.copy(); X_te = X_te.copy()
X_tr[num_cols] = sc.transform(X_tr[num_cols])
X_te[num_cols] = sc.transform(X_te[num_cols])
```

三点がポイントです。

- `random_state` を固定します。次の実行でも同じ分割結果が得られます。
- `stratify=y` はクラス比率を学習データ・テストデータで似たように保ちます。分類問題で使用します。
- スケーラーは `fit` を学習データのみで行い、テストデータには `transform` のみを実行します。テストデータの情報が学習に漏れるのを防ぐためです。

[詳細 → 分析モデル設計](#/post/bd-model-design) で過学習・交差検証を一緒に確認すれば、なぜこの順序が重要なのかにつながります。

## モデル学習と予測

```python
from sklearn.ensemble import RandomForestClassifier

m = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)
pred  = m.predict(X_te)
proba = m.predict_proba(X_te)[:, 1]
print(m.classes_)   # [0 1]
```

scikit-learn のドキュメントを基準にすると、`n_estimators` のデフォルト値は 100 で `random_state` のデフォルト値は None であり、設定しないと実行ごとに結果が異なります。`predict_proba` は `(サンプル数, クラス数)` の形状の確率を返し、列の順序は `classes_` に従います。そのため `[:, 1]` はクラス 1 の確率です。問題で「確率を提出せよ」とあれば `predict` ではなくこちらを使用します。

モデルごとの特徴については [詳細 → 教師あり学習モデル](#/post/bd-supervised) をご覧ください。コードの形状はほぼ同じなので、`RandomForestClassifier` の代わりに `LogisticRegression`、`DecisionTreeClassifier`、`SVC` を入れるだけでよく、残りの `fit`・`predict` はそのまま使用できます。

## 評価

```python
from sklearn.metrics import (accuracy_score, f1_score,
                             roc_auc_score, confusion_matrix)

print(confusion_matrix(y_te, pred))
print(accuracy_score(y_te, pred), f1_score(y_te, pred), roc_auc_score(y_te, proba))
```

上記のサンプルデータで実行した結果、混同行列は `[[18 4] [4 14]]`、精度 0.8、F1 スコア約 0.778、AUC 約 0.836 となりました。数値そのものよりも引数の形状が重要です。

| 指標 | 入力するもの |
|---|---|
| 精度、F1 | 正解値、**予測クラス** |
| AUC | 正解値、**予測確率** |

AUC にクラス (0/1) を入れるとエラーは出ませんが、値が変わります。関数ごとに受け取る引数が異なる点は間違いやすいところです。指標の意味は [詳細 → モデル評価](#/post/bd-evaluation) で確認してください。

## 結果の保存

```python
out = pd.DataFrame({"pred": proba})
out.to_csv("result.csv", index=False)
```

`index=False` を外すと、先頭に番号列が一つ追加されます。提出形式が決まっている問題では、この一行が減点の原因になりやすいため、列名と列数は問題の指示通り合わせる必要があります。

## よく間違える箇所

- テストデータにも `fit` を適用します。`fit` は訓練用だけで、試験には `transform` や `predict` のみを使用します。
- `random_state` を指定せずに結果が毎回変わります。
- 符号化を訓練・試験で別々に行うと列がずれます。
- 目的変数 (`buy`) を `X` にそのまま残してしまいます。
- AUC に確率の代わりにクラスを入力します。

この記事のコードは、Python 3 で pandas 3.1.0、scikit-learn 1.9.1 を使用して実行し確認しました。試験環境のバージョンは異なる可能性があるため、関数の引数は公式ドキュメントで再確認するのが適切です。

---

← [概念マップへ](#/post/bd-map)

関連記事: [データ前処理](#/post/bd-preprocessing) · [教師あり学習モデル](#/post/bd-supervised) · [モデル評価](#/post/bd-evaluation)

## 根拠リンク

- [pandas ドキュメント — 欠損値の扱い](https://pandas.pydata.org/docs/user_guide/missing_data.html)
- [scikit-learn ドキュメント — RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)