ADsP 3과목(데이터 분석)의 앞부분이다. R 자료형과 전처리, 결측치·이상값, 데이터 마트(요약·파생변수), 데이터 합치기와 reshape까지가 한 덩어리다. 개념은 단순한데 "이 코드를 돌리면 뭐가 나오나"를 묻는 형태가 많아서, 아래 코드는 전부 R 4.6.2에서 직접 돌려 본 결과를 적었다.

시험 일정과 응시료는 공식 사이트에서 확인하면 된다. 이 글은 단원 핵심과 자주 나오는 유형만 다룬다. 시험 전체 흐름은 [자세히 → ADsP map](#/post/adsp-map)에 있다.

## 자료형과 자료구조

R에서 값 하나는 벡터의 원소다. 숫자 하나도 길이 1짜리 벡터다. 자료형은 숫자(numeric), 정수(integer), 문자(character), 논리(logical) 정도를 기억하면 된다.

`class(c(1L, 2L, 3L))`은 "integer", `class("a")`는 "character", `class(TRUE)`는 "logical"이다. 숫자를 그냥 `c(1, 2)`로 쓰면 정수가 아니라 실수(double)로 저장된다. `1L`처럼 L을 붙여야 정수다.

| 구조 | 한 줄 설명 | 같은 자료형만? |
| --- | --- | --- |
| 벡터 | 1차원, `c()`로 만든다 | 예 |
| 행렬(matrix) | 2차원 | 예 |
| 리스트(list) | 원소마다 형태가 달라도 된다 | 아니오 |
| 데이터프레임 | 열마다 자료형이 달라도 되는 표, 열 길이는 같아야 한다 | 열 안에서만 |
| 팩터(factor) | 범주형, `levels`로 범주 목록을 본다 | 범주 |

R 공식 매뉴얼은 데이터프레임을 class가 "data.frame"인 리스트로 설명한다. 그래서 `df$col`처럼 리스트 접근 문법이 그대로 먹힌다. 팩터는 같은 길이의 다른 벡터들을 이산 그룹으로 나누는 벡터이고, `ordered()`로 만들면 순서형 팩터가 된다.

<details>
<summary>인덱싱과 팩터 실행 결과</summary>

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

`v[-1]`은 첫 원소를 빼고 나머지다. 행렬은 열 방향으로 채워진다. 이 부분이 자주 헷갈린다. 순서형 팩터에서는 `<` 비교가 된다. 일반 팩터에는 이런 비교가 안 된다.

</details>

## 결측치

R에서 결측은 `NA`다. 핵심은 NA가 들어 있는 벡터를 그냥 계산하면 결과도 NA가 된다는 점이다.

```r
df <- data.frame(id=1:4, dept=c("A","B","A","B"), sal=c(300,NA,500,400), stringsAsFactors=TRUE)
is.na(df$sal)               # FALSE TRUE FALSE FALSE
sum(is.na(df$sal))          # 1
mean(df$sal)                # NA
mean(df$sal, na.rm=TRUE)    # 400
complete.cases(df)          # TRUE FALSE TRUE TRUE
```

`na.rm=TRUE`를 주면 NA를 빼고 계산한다. `complete.cases()`는 행에 NA가 하나도 없으면 TRUE를 준다. `na.omit(df)`는 NA가 있는 행을 통째로 버리고, 위 데이터에서는 2번 행이 사라져 3행이 남았다.

논리 연산에서도 NA는 독특하다. `NA > 1`은 NA다. 그런데 `NA & FALSE`는 FALSE, `NA | TRUE`는 TRUE다. 상대가 FALSE면 AND는 어차피 FALSE이고, 상대가 TRUE면 OR는 어차피 TRUE라서 NA가 결과에 영향을 못 준다.

결측을 처리하는 방법은 크게 둘이다. 행을 지우거나(완전 삭제), 값으로 채우거나(대체)다. 대체에는 평균·중앙값 같은 대표값 대체, 비슷한 개체의 값을 쓰는 방법, 예측 모형으로 채우는 방법이 있다. 평균으로 채우면 분산이 줄어드는 문제가 따라온다고 보면 된다.

```r
df2 <- df
df2$sal[is.na(df2$sal)] <- mean(df2$sal, na.rm=TRUE)
# 2번 행의 sal이 400으로 채워짐
```

## 이상값

이상값은 다른 값들에서 크게 벗어난 값이다. 오류일 수도 있고 진짜 극단값일 수도 있어서 무조건 지우는 게 답은 아니다. 시험에서는 상자그림(boxplot) 기준이 가장 자주 나온다.

기준은 1사분위수(Q1)와 3사분위수(Q3)의 차인 IQR에 1.5를 곱한 울타리다. Q1 - 1.5×IQR보다 작거나 Q3 + 1.5×IQR보다 크면 이상값으로 본다. R의 `boxplot.stats()` 문서도 기본값 `coef = 1.5`로 수염 길이를 정하고, 그 밖의 점을 `out`으로 돌려준다고 설명한다.

```r
y <- c(10,12,11,13,12,11,95)
boxplot.stats(y)$out      # 95
q <- quantile(y)          # 25% = 11.0, 75% = 12.5
IQR(y)                    # 1.5
q[2]-1.5*IQR(y)           # 8.75
q[4]+1.5*IQR(y)           # 14.75
```

울타리가 8.75~14.75라서 95만 밖에 있다. 참고로 `boxplot.stats()`가 쓰는 건 사분위수와 비슷한 hinge 값이고, 데이터 개수가 짝수면 `quantile()` 값과 다를 수 있다고 문서에 나온다. 시험 문제는 보통 손계산이 되게 나오니 개념만 알면 된다.

이상값을 처리하는 방법은 삭제, 다른 값으로 대체, 변수 변환(로그 등), 구간으로 나누기(범주화) 같은 것들이다. 이상값이 분석 목적에 중요한 신호일 수 있다는 점은 항상 같이 나온다.

## 데이터 마트

데이터 마트는 데이터 웨어하우스에서 특정 부서나 주제에 맞게 떼어 낸 작은 저장소다. 위키백과 설명으로는 영업·재무·마케팅처럼 한 업무 영역을 위해 만든 웨어하우스의 부분집합이고, 범위가 좁아서 그 팀이 자주 쓰는 데이터에 빨리 접근하게 해 준다. 웨어하우스 자체는 [자세히 → 데이터의 이해](#/post/adsp-data-understanding)에 있다.

ADsP에서는 분석용으로 변수를 만들어 정리한 표라는 뜻으로 많이 쓴다. 분석 모델링 전에 데이터를 이 모양으로 맞추는 단계는 [자세히 → 분석 방법론](#/post/adsp-methodology)의 데이터 준비 단계와 이어진다. 마트를 만들 때 자주 나오는 두 가지 변수가 있다.

| 변수 | 뜻 | 예 |
| --- | --- | --- |
| 요약변수 | 원자료를 집계해서 만든 변수 | 고객별 총구매액, 월 평균 방문 횟수 |
| 파생변수 | 기존 변수로 새로 계산하거나 조건으로 만든 변수 | 구매액이 기준 이상이면 "우수", 몸무게/키² |

요약은 행 수가 줄어드는 경우가 많고(거래 여러 건 → 고객 한 줄), 파생은 열이 늘어난다. 요약변수는 재활용성이 높고, 파생변수는 상황에 따라 해석이 달라질 수 있어 주관이 들어간다고 정리하곤 한다.

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

`aggregate`가 요약변수, `ifelse`가 파생변수를 만드는 예다. `scale(c(1,2,3))`처럼 표준화(평균 0, 표준편차 1)를 거는 것도 전처리에서 흔하다. 결과는 -1, 0, 1이다.

## apply 계열

반복문 없이 함수를 여러 곳에 적용하는 함수들이다. 이름이 비슷해서 반환 형태를 구분하는 문제가 나온다.

| 함수 | 적용 대상 | 반환 |
| --- | --- | --- |
| `apply(m, 1 또는 2, f)` | 행렬의 행(1)·열(2) | 벡터 |
| `lapply(x, f)` | 리스트·벡터의 각 원소 | 리스트 |
| `sapply(x, f)` | lapply와 같되 가능하면 단순화 | 벡터·행렬 |
| `tapply(x, 그룹, f)` | 그룹별 | 그룹 이름이 붙은 결과 |

```r
m2 <- matrix(1:6, nrow=2)
apply(m2, 1, sum); apply(m2, 2, sum)    # 9 12 / 3 7 11
lapply(list(a=1:3,b=4:6), mean)         # $a 2 $b 5  (리스트)
sapply(list(a=1:3,b=4:6), mean)         # a b / 2 5  (이름 붙은 벡터)
tapply(df$sal, df$dept, mean, na.rm=TRUE)   # A 400 / B 400
```

R 매뉴얼은 `tapply()`를 팩터로 정의된 그룹별로 함수를 적용하고 팩터 수준 이름이 붙은 결과를 준다고 설명한다. 위에서 `tapply` 결과는 NA를 뺀 평균이라 A, B 둘 다 400이 나왔다.

## 합치기: merge, rbind, cbind

`merge()`는 기본값이 두 데이터프레임에 공통으로 있는 열 이름으로 합치는 것이다(`by` 기본값이 공통 열 이름). `all`을 안 주면 양쪽에 다 있는 행만 남고, 이건 SQL의 내부 조인과 같다. 조인 개념은 [자세히 → 조인과 서브쿼리](#/post/sqld-join-subquery)와 같은 얘기다.

```r
a <- data.frame(id=c(1,2,3), x=c("a","b","c"))
b <- data.frame(id=c(2,3,4), y=c("p","q","r"))
merge(a,b)               # id 2,3 (교집합)
merge(a,b,all=TRUE)      # id 1,2,3,4 (전체 외부 조인, 없는 쪽은 NA)
merge(a,b,all.x=TRUE)    # id 1,2,3 (a 기준 왼쪽 조인)
```

`all=TRUE`는 `all.x`와 `all.y`를 둘 다 TRUE로 주는 것이고, `all.x=TRUE`는 왼쪽 조인, `all.y=TRUE`는 오른쪽 조인이다. 결과 행이 몇 개인지 묻는 문제가 대표적이다.

`rbind`는 행을 아래로 붙이는 것(열 이름이 같아야 한다), `cbind`는 열을 옆으로 붙이는 것(행 수가 같아야 한다)이다.

## reshape: 넓은 형태와 긴 형태

reshape는 같은 정보를 넓은(wide) 표와 긴(long) 표로 오가게 한다. R 문서의 정의로는, wide는 한 대상이 한 행이고 시점별 값이 열로 늘어서는 형태, long은 한 대상이 시점 수만큼 여러 행이고 시간 변수와 식별 변수가 따로 있는 형태다.

| 인자 | 역할 |
| --- | --- |
| `direction` | "wide"는 long을 wide로, "long"은 wide를 long으로 |
| `varying` | wide에서 시점별로 나뉜 열 이름들 |
| `idvar` | 같은 대상을 묶는 식별 변수 |
| `timevar` | 시점을 구분하는 변수. long→wide에서는 값이 열 이름 뒤에 붙는다 |

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

2행 × 2열짜리 wide가 4행 long이 됐고, 다시 wide로 돌리면 `score.1`, `score.2`처럼 시점이 이름 뒤에 붙었다. 행 이름에 `1.1` 같은 값이 남는 건 reshape가 되돌릴 정보를 들고 있어서다.

## 자주 나오는 유형

- 코드를 주고 출력값을 묻는 문제. `mean`에 NA가 있을 때, `v[-1]`, `apply(m, 1, sum)`처럼 짧은 코드가 많다.
- 결측 처리 방법의 장단점 고르기. 완전 삭제는 표본이 줄고, 평균 대체는 분산이 줄어든다.
- 상자그림 기준으로 이상값 판정. Q1, Q3, IQR을 구해 울타리와 비교한다.
- 요약변수와 파생변수 구분하기. 집계로 만든 건 요약, 조건·계산으로 새로 만든 건 파생이다.
- `merge`에서 `all` 옵션에 따라 결과 행 수 맞히기.
- apply 계열 함수의 반환 형태 구분.

풀 때는 먼저 NA가 있는지 보고, 그다음 함수가 행·열·그룹 중 어디에 적용되는지 확인하면 거의 걸러진다. 통계 쪽 기초는 [자세히 → 통계 분석 기초](#/post/adsp-stat-basic)로 이어진다.

← 개념 map으로 ([ADsP map](#/post/adsp-map))

관련 글: [자세히 → 데이터의 이해](#/post/adsp-data-understanding) · [자세히 → 분석 방법론](#/post/adsp-methodology) · [자세히 → 통계 분석 기초](#/post/adsp-stat-basic)

## 근거 링크

- [R merge 문서 (base)](https://stat.ethz.ch/R-manual/R-devel/library/base/html/merge.html)
- [R reshape 문서 (stats)](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/reshape.html)
- [R boxplot.stats 문서 (grDevices)](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html)
- [An Introduction to R — CRAN 공식 매뉴얼](https://cran.r-project.org/doc/manuals/r-release/R-intro.html)
- [Data mart — Wikipedia](https://en.wikipedia.org/wiki/Data_mart)
