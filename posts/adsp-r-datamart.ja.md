ADsP 3 과목 (データ分析) の前半部分である。R のデータ型と前処理、欠損値・外れ値、データマート（集約・派生変数）、データ結合と reshape までが一つのまとまりだ。概念は単純だが、「このコードを実行すると何が出力されるか」を問う形式が多いため、以下のコードはすべて R 4.6.2 で実際に実行した結果を記述したものである。

試験日程と受験料は公式ウェブサイトを確認すればよい。この記事では単元の核心と頻出するパターンのみを取り扱う。試験全体の流れは [詳細 → ADsP map](#/post/adsp-map) にある。

## データ型とデータ構造

R では、値の一つはベクトルの要素である。数字一つでも長さ 1 のベクトルだ。データ型は数値 (numeric)、整数 (integer)、文字 (character)、論理 (logical) の程度を覚えておけばよい。

`class(c(1L, 2L, 3L))` は "integer"、`class("a")` は "character"、`class(TRUE)` は "logical" である。数字を単に `c(1, 2)` と書くと整数ではなく実数 (double) として保存される。`1L` のように L を付けることで初めて整数になる。

| 構造 | 一行説明 | 同じデータ型のみ？ |
| --- | --- | --- |
| ベクトル | 1 次元、`c()` で作成する | はい |
| 行列 (matrix) | 2 次元 | はい |
| リスト (list) | 要素ごとに形式が異なっていてもよい | いいえ |
| データフレーム | 列ごとにデータ型が異なってもよい表、列の長さは等しくなければならない | 列内のみ |
| ファクター (factor) | カテゴリ型、`levels` でカテゴリリストを見る | カテゴリ |

R の公式マニュアルでは、データフレームを class が "data.frame" であるリストとして説明している。そのため `df$col` のようなリストアクセス構文もそのまま機能する。ファクターは同じ長さの異なるベクトルたちを離散グループに分けるベクトルであり、`ordered()` で作成すると順序付きファクターになる。

<details>
<summary>インデックスとファクターの実行結果</summary>

```r
v <- c(10, 20, 30); v[2]; v[-1]
# [1] 20
# [1] 20 30
l <- list(a=1, b="x"); l$b; l[["a"]]
# [1] "x"
# [1] 1
m <- matrix(1:6, nrow=2); m; dim(m)
#      [,1] [,2] [,3]
# [1,]    1    3    5
# [2,]    2    4    6
# [1] 2 3
f <- factor(c("low","high","mid","low"), levels=c("low","mid","high"), ordered=TRUE)
f
# [1] low  high mid  low
# Levels: low < mid < high
f[1] < f[2]
# [1] TRUE
```

`v[-1]` は最初の要素を除いた残りの要素である。行列は列方向に埋められる。この部分がよく混同される。順序付きファクターでは `<` 比較が機能する。通常のファクターにはこのような比較は適用されない。

</details>

## 欠損値

R では欠損は `NA` である。核心は、NA が含まれるベクトルをそのまま計算すると結果も NA になる点にある。

```r
df <- data.frame(id=1:4, dept=c("A","B","A","B"), sal=c(300,NA,500,400), stringsAsFactors=TRUE)
is.na(df$sal)               # FALSE TRUE FALSE FALSE
sum(is.na(df$sal))          # 1
mean(df$sal)                # NA
mean(df$sal, na.rm=TRUE)    # 400
complete.cases(df)          # TRUE FALSE TRUE TRUE
```

`na.rm=TRUE` を指定すると NA を除外して計算する。`complete.cases()` は行に NA が一つもない場合に TRUE を返す。`na.omit(df)` は NA が含まれる行を丸ごと捨て、上記データでは 2 行目が消えて 3 行が残りとなる。

論理演算でも NA は独特だ。`NA > 1` は NA である。しかし `NA & FALSE` は FALSE、`NA | TRUE` は TRUE である。相手が FALSE なら AND はいずれにせよ FALSE であり、相手が TRUE なら OR はいずれにせよ TRUE であるため、NA が結果に影響を与えない。

欠損値を処理する方法は主に二つある。行を削除するか（完全削除）、値で埋めるか（置換）だ。置換には平均や中央値などの代表値での置換、類似した個体の値を使う方法、予測モデルで埋める方法がある。平均で埋めると分散が減少するという問題が伴うと考えるべきだ。

```r
df2 <- df
df2$sal[is.na(df2$sal)] <- mean(df2$sal, na.rm=TRUE)
# 2번 행의 sal이 400으로 채워짐
```

## 外れ値

外れ値は他の値から大きく逸脱した値である。エラーかもしれないし、真の極端値かもしれないので、無条件に削除するのが正解ではない。試験では箱ひげ図 (boxplot) の基準が最も頻出する。

基準は第 1 四分位数 (Q1) と第 3 四分位数 (Q3) の差である IQR に 1.5 を掛けた境界線だ。Q1 - 1.5×IQR より小さいか、Q3 + 1.5×IQR より大きければ外れ値とみなす。R の `boxplot.stats()` ドキュメントもデフォルト値 `coef = 1.5` でひげの長さを定め、それ以外の点を `out` として返すと説明している。

```r
y <- c(10,12,11,13,12,11,95)
boxplot.stats(y)$out      # 95
q <- quantile(y)          # 25% = 11.0, 75% = 12.5
IQR(y)                    # 1.5
q[2]-1.5*IQR(y)           # 8.75
q[4]+1.5*IQR(y)           # 14.75
```

境界線が 8.75〜14.75 なので、95 は外れている。なお、`boxplot.stats()` が使うのは四分位数に似たヒンジ値であり、データ数が偶数の場合は `quantile()` の値と異なる可能性があるという記述がある。試験問題は通常手計算で解けるように出題されるので、概念を知っていればよい。

外れ値を処理する方法は削除、他の値での置換、変数変換（対数など）、区間で分割（カテゴリ化）などのものだ。外れ値が分析目的にとって重要なシグナルになり得る点は常に併せて問われる。

## データマート

データマートはデータウェアハウスから特定の部門やトピックに合わせて切り出された小さなリポジトリである。ウィキペディアの説明では、営業・財務・マーケティングのように一つの業務領域のために作成されたウェアハウスの部分集合であり、範囲が狭いためそのチームが頻繁に使用するデータに素早くアクセスできるようにする。ウェアハウス自体は [詳細 → データの理解](#/post/adsp-data-understanding) にある。

ADsP において、分析用に作成・整理した表という意味でよく使われる用語です。分析モデリング前にデータをこの形式に整える段階は、[詳細 → 分析方法論](#/post/adsp-methodology) のデータ準備段階と続きます。マートを作成する際に頻出する変数は主に 2 つあります。

| 変数 | 意味 | 例 |
| --- | --- | --- |
| 集計変数 | 原データを集計して作成した変数 | 顧客ごとの総購買額、月平均訪問回数 |
| 派生変数 | 既存の変数を用いて新たに計算したり条件で生成した変数 | 購買額が基準以上なら「優秀」、体重/身長² |

集計は行数が減ることが多く（複数の取引 → 1 つの顧客）、派生は列が増えます。集計変数は再利用性が高く、派生変数は状況によって解釈が変わるため主観が入ると整理されることが多いです。

```r
d <- data.frame(id=1:6, g=c("A","A","B","B","C","C"), v=c(1,2,3,4,5,6))
aggregate(v ~ g, data=d, FUN=sum)
#   g  v
# 1 A  3
# 2 B  7
# 3 C 11
d$grp <- ifelse(d$v>3, "hi", "lo")     # 파생변수
subset(d, v>2, select=c(id,v))         # 조건 행 + 열 선택
d[order(-d$v),][1:2,]                  # 내림차순 정렬 후 상위 2행
```

`aggregate` が集計変数、`ifelse` が派生変数を生成する例です。`scale(c(1,2,3))` のように標準化（平均 0、標準偏差 1）を行うことも前処理で一般的です。結果は -1, 0, 1 です。

## apply シリーズ

ループなしに関数を複数の箇所に適用する関数群です。名前が似ているため、戻り値の形式を区別する問題が生じます。

| 関数 | 適用対象 | 戻り値 |
| --- | --- | --- |
| `apply(m, 1 または 2, f)` | 行列の行 (1)・列 (2) | ベクトル |
| `lapply(x, f)` | リスト・ベクトルの各要素 | リスト |
| `sapply(x, f)` | lapply と同様だが可能なら単純化 | ベクトル・行列 |
| `tapply(x, グループ, f)` | グループ別 | グループ名が付けられた結果 |

```r
m2 <- matrix(1:6, nrow=2)
apply(m2, 1, sum); apply(m2, 2, sum)    # 9 12 / 3 7 11
lapply(list(a=1:3,b=4:6), mean)         # $a 2 $b 5  (리스트)
sapply(list(a=1:3,b=4:6), mean)         # a b / 2 5  (이름 붙은 벡터)
tapply(df$sal, df$dept, mean, na.rm=TRUE)   # A 400 / B 400
```

R マニュアルでは、`tapply()` をファクターで定義されたグループごとに関数を適用し、ファクターのレベル名が付けられた結果を返すと説明しています。上記では `tapply` の結果は NA を除いた平均であり、A および B の両方で 400 が出力されました。

## 結合：merge, rbind, cbind

`merge()` はデフォルトで 2 つのデータフレームに共通する列名で結合します（`by` のデフォルトは共通列名）。`all` を指定しない場合、両方に存在する行のみが残り、これは SQL の内部結合と等価です。結合の概念については [詳細 → 結合とサブクエリ](#/post/sqld-join-subquery) で同様の説明があります。

```r
a <- data.frame(id=c(1,2,3), x=c("a","b","c"))
b <- data.frame(id=c(2,3,4), y=c("p","q","r"))
merge(a,b)               # id 2,3 (교집합)
merge(a,b,all=TRUE)      # id 1,2,3,4 (전체 외부 조인, 없는 쪽은 NA)
merge(a,b,all.x=TRUE)    # id 1,2,3 (a 기준 왼쪽 조인)
```

`all=TRUE` は `all.x` と `all.y` をともに TRUE に指定するものであり、`all.x=TRUE` は左結合、`all.y=TRUE` は右結合です。結果の行数がいくつになるかを問う問題は代表的です。

`rbind` は行を下に追加するもの（列名が一致している必要があります）、`cbind` は列を横に追加するもの（行数が一致している必要があります）です。

## reshape: 広形と長形

reshape は同じ情報を広形 (wide) の表と長形 (long) の表の間で切り替えます。R ドキュメントの定義によれば、wide は 1 つの対象を 1 行にし、時点ごとの値を列に並べる形式、long は 1 つの対象が時点数分だけ複数の行になり、時間変数と識別変数が別途存在する形式です。

| 引数 | 役割 |
| --- | --- |
| `direction` | "wide" は long を wide に、"long" は wide を long に |
| `varying` | wide で時点ごとに分割された列名 |
| `idvar` | 同じ対象を束ねる識別変数 |
| `timevar` | 時点を区別する変数。long→wide では値が列名の後ろに付く |

```r
wide <- data.frame(id=1:2, t1=c(5,6), t2=c(7,8))
long <- reshape(wide, direction="long", varying=c("t1","t2"),
                v.names="score", timevar="time", times=1:2, idvar="id")
long
#     id time score
# 1.1  1    1     5
# 2.1  2    1     6
# 1.2  1    2     7
# 2.2  2    2     8
reshape(long, direction="wide", idvar="id", timevar="time", v.names="score")
#     id score.1 score.2
# 1.1  1       5       7
# 2.1  2       6       8
```

2 行×2 列の wide が 4 行の long に変わり、再度 wide に戻すと `score.1`, `score.2` のように時点が列名の後ろに付きました。行名に `1.1` などの値が残るのは、reshape が復元に必要な情報を保持しているためです。

## よくあるパターン

- コードを与えて出力値を問う問題。NA が含まれる場合の `mean` や、`v[-1]`, `apply(m, 1, sum)` のように短いコードが多いです。
- 欠損値処理方法の長所・短所を選ばせる問題。完全削除はサンプルサイズが減り、平均置換は分散が減少します。
- ボックスプロット基準での外れ値判定。Q1, Q3, IQR を求めて箱と比べます。
| 集計変数と派生変数の区別 | 集計で作成したものは集計変数、条件・計算で新たに作成したものは派生変数です。 |
- `merge` の `all` オプションによる結果行数の合わせ方。
- apply シリーズ関数の戻り値の形式を区別する。

解答にあたっては、まず NA が存在するかを確認し、次に関数が行・列・グループのいずれに適用されるかを確認すれば、ほとんどが絞り込めます。統計学の基礎については [詳細 → 統計分析基礎](#/post/adsp-stat-basic) に続きます。

← 概念マップへ ([ADsP map](#/post/adsp-map))

関連記事：[詳細 → データの理解](#/post/adsp-data-understanding) · [詳細 → 分析手法](#/post/adsp-methodology) · [詳細 → 統計分析基礎](#/post/adsp-stat-basic)

## 参照リンク

- [R merge ドキュメント (base)](https://stat.ethz.ch/R-manual/R-devel/library/base/html/merge.html)
- [R reshape ドキュメント (stats)](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/reshape.html)
- [R boxplot.stats ドキュメント (grDevices)](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html)
- [An Introduction to R — CRAN 公式マニュアル](https://cran.r-project.org/doc/manuals/r-release/R-intro.html)
- [Data mart — Wikipedia](https://en.wikipedia.org/wiki/Data_mart)