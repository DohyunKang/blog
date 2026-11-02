# 변수 선택과 차원 축소

변수가 30개인 데이터와 5개인 데이터가 있을 때, 같은 모형이라면 대개 적은 쪽이 다루기 편하다. 학습이 빠르고, 해석하기 쉽고, 과적합 위험도 낮다. 그래서 모형을 만들기 전에 변수를 줄이는 단계가 들어간다. 줄이는 방법은 크게 둘로 갈린다.

| 구분 | 하는 일 | 결과 변수 | 대표 기법 |
|---|---|---|---|
| 변수 선택 | 원래 변수 중 일부만 고른다 | 원래 변수 그대로 | 필터·래퍼·임베디드 |
| 차원 축소 | 변수를 합쳐 새 변수를 만든다 | 새로 만든 변수 | PCA 등 |

시험에서는 이 둘의 구분과, 변수 선택 안에서 세 방식을 가르는 문제가 자주 나온다. 기출 문장을 외우기보다 "어떤 기준으로 고르는가"를 잡아 두는 쪽이 편했다.

[전처리](#/post/bd-preprocessing)에서 결측치와 스케일을 정리한 뒤, 모형을 고르기 전([모형 설계](#/post/bd-model-design))에 이 단계가 온다고 보면 된다.

## 필터: 모형 없이 통계량으로 거른다

변수 하나하나를 통계량으로 점수 매겨서 높은 것만 남긴다. 모형을 돌리지 않아서 빠르다. scikit-learn 문서는 분산이 작은 변수를 버리는 `VarianceThreshold`, 점수 상위 k개를 남기는 `SelectKBest`를 필터 쪽으로 소개한다. 점수 함수는 분류에서 `chi2`, `f_classif`, `mutual_info_classif`, 회귀에서 `f_regression` 등이다.

- 분산이 거의 0인 변수는 정보가 없다.
- 상관계수가 높은 변수 쌍은 하나만 남긴다([상관분석](#/post/bd-eda-stats) 참고). 독립변수끼리 너무 닮으면 다중공선성이 생긴다.
- 변수와 목표변수의 관계를 검정 통계량(F값, 카이제곱 등)으로 점수화한다.

약점은 변수를 따로따로 본다는 점이다. 혼자서는 약하지만 둘이 합치면 효과가 있는 변수 조합은 놓친다.

## 래퍼: 모형을 돌려 가며 고른다

변수 부분집합을 바꿔 가며 모형을 반복해서 학습시키고, 성능이 좋은 조합을 고른다. 정확하지만 비싸다. 문서에서는 `RFE`(재귀적 변수 제거)를 래퍼로 다룬다. 계수나 중요도를 내놓는 모형을 학습시키고, 가장 약한 변수를 빼고, 원하는 개수가 남을 때까지 반복한다. 교차검증으로 개수를 정해 주는 `RFECV`도 있다.

시험에서 자주 보는 이름은 따로 있다.

| 방식 | 움직임 |
|---|---|
| 전진 선택 | 빈 상태에서 가장 도움이 되는 변수를 하나씩 추가 |
| 후진 제거 | 전부 넣고 가장 도움 안 되는 변수를 하나씩 제거 |
| 단계적 선택 | 추가하다가 필요 없어진 변수는 다시 제거 |

## 임베디드: 학습하면서 같이 고른다

모형이 학습하는 과정에서 변수의 중요도가 정해지고, 그걸 기준으로 자른다. 문서는 `SelectFromModel`을 메타 변환기로 소개한다. 중요도가 임곗값 이상인 변수만 남기는데, 임곗값은 숫자나 `"mean"`, `"median"` 같은 문자열로 준다.

- L1 규제(라쏘): 계수 일부를 정확히 0으로 만들어 변수가 빠진다. 규제를 세게 줄수록 남는 변수가 줄어든다. 문서 기준으로 Lasso는 alpha가 클수록, 분류 모형은 C가 작을수록 변수가 줄어든다.
- L2 규제(릿지): 계수를 작게 누르지만 0으로 만들지는 않는다. 그래서 변수 선택보다는 계수 안정화에 가깝다.
- 트리 계열: 랜덤포레스트 같은 앙상블의 변수 중요도를 쓴다.

세 방식을 한 줄로 외우면 이렇다. 필터는 모형 전에, 래퍼는 모형을 반복 학습하며, 임베디드는 모형 학습 안에서 고른다. 속도는 필터가 빠르고 래퍼가 느리다.

## 실제로 돌려 본 결과

유방암 진단 데이터(`load_breast_cancer`, 569개 행, 변수 30개)로 해 봤다. 훈련 70%, 시험 30%로 나눴고 변수 선택은 훈련 데이터로만 맞췄다. 시험 데이터를 보고 변수를 고르면 평가가 부풀려지기 때문이다.

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.feature_selection import SelectKBest, f_classif, RFE, SelectFromModel
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True, as_frame=True)
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)

# 필터: 상관 0.9 넘는 쌍에서 하나씩 제거
corr = Xtr.corr().abs()
up = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
drop = [c for c in up.columns if (up[c] > 0.9).any()]
print(len(drop), Xtr.shape[1] - len(drop))   # 11 19

# 필터: F검정 점수 상위 5개
skb = SelectKBest(f_classif, k=5).fit(Xtr, ytr)

# 래퍼: RFE (표준화 후 로지스틱)
sc = StandardScaler().fit(Xtr)
rfe = RFE(LogisticRegression(max_iter=1000), n_features_to_select=5)
rfe.fit(sc.transform(Xtr), ytr)

# 임베디드: 랜덤포레스트 중요도 (평균 이상)
sfm = SelectFromModel(
    RandomForestClassifier(n_estimators=200, random_state=42)).fit(Xtr, ytr)
```

각 방식으로 고른 변수로 로지스틱 회귀를 다시 학습해 시험 데이터 정확도를 쟀다.

| 변수 구성 | 변수 수 | 시험 정확도 |
|---|---|---|
| 전체 | 30 | 0.988 |
| 상관 높은 변수 제거(필터) | 19 | 0.977 |
| RFE(래퍼) | 5 | 0.953 |
| 랜덤포레스트 중요도(임베디드) | 10 | 0.936 |
| SelectKBest(필터) | 5 | 0.924 |

변수를 30개에서 5개로 줄여도 정확도는 크게 떨어지지 않았다. 다만 이 표는 시드 하나, 분할 하나의 결과다. 순위가 늘 이렇게 나온다고 볼 수는 없다. 눈에 띈 건 SelectKBest가 고른 5개 중 `mean perimeter`, `worst radius`, `worst perimeter`가 모두 크기를 나타내는 서로 닮은 변수라는 점이다. 필터가 변수를 따로 보기 때문에 비슷한 변수를 같이 골랐고, RFE는 `area error`, `worst texture`처럼 성격이 다른 변수가 섞였다. 이 데이터에서는 그 차이가 정확도 차이로 보였다.

<details>
<summary>변수 중요도 상위 값과 분산 필터</summary>

랜덤포레스트 중요도 상위 5개는 `worst perimeter`(0.141), `worst area`(0.132), `worst concave points`(0.122), `worst radius`(0.085), `mean concave points`(0.077) 순으로 나왔다. 반지름·둘레·면적은 서로 거의 같은 정보라서 중요도가 나눠 잡힌다.

`VarianceThreshold(threshold=1.0)`을 걸면 10개가 남는데, 남는 변수가 전부 값의 단위가 큰 변수(둘레·면적 등)였다. 분산은 단위에 민감해서, 스케일이 다른 변수끼리 분산으로 거르면 중요도와 상관없이 단위 큰 변수만 살아남는다. 분산 필터는 표준화 전에 쓸 때 조심해야 한다.
</details>

## 차원 축소와 PCA

선택은 원래 변수를 고르는 것이고, PCA(주성분분석)는 변수들을 선형결합해 서로 직교하는 새 축을 만든다. 첫 번째 축이 분산을 가장 많이 설명하고, 두 번째는 그다음, 이런 식이다. 문서 설명으로는 PCA가 각 변수의 평균은 빼 주지만 스케일은 맞춰 주지 않는다. 단위가 다른 변수가 섞여 있으면 먼저 표준화를 해야 한다.

같은 데이터로 확인했다. 표준화한 뒤 PCA를 걸었더니 설명 분산 비율이 PC1 0.452, PC2 0.196, PC3 0.089였다. 누적 90%에 7개, 95%에 10개 주성분이 필요했다. 표준화를 빼고 PCA를 걸면 PC1이 전체 분산의 0.985를 차지했다. 단위가 큰 변수(면적 등) 하나가 축을 독점한 것이다.

```python
from sklearn.decomposition import PCA

pca = PCA(n_components=0.95).fit(sc.transform(Xtr))   # 누적 95%까지
print(pca.n_components_)                              # 10
Ztr = pca.transform(sc.transform(Xtr))
Zte = pca.transform(sc.transform(Xte))
m = LogisticRegression(max_iter=1000).fit(Ztr, ytr)
print(round(m.score(Zte, yte), 3))                    # 0.971
```

`n_components`에 0과 1 사이 실수를 주면 누적 설명 분산이 그 값에 닿는 최소 개수를 골라 준다. 30개 변수가 10개 주성분이 되었고 정확도는 0.971이었다.

시험에서는 주성분 개수를 정하는 기준이 나온다. 누적 설명 분산 비율이 일정 수준(예를 들어 80~90%)에 닿는 지점, 또는 스크리 플롯에서 꺾이는 팔꿈치 지점을 쓴다. 계산 쪽에서는 공분산(또는 상관) 행렬의 고유값 분해와 연결된다. 고유값이 클수록 그 축이 설명하는 분산이 크다.

PCA의 단점도 같이 묶어 둔다.

- 새 축이 원래 변수의 혼합이라 의미를 해석하기 어렵다.
- 분산이 큰 방향을 찾을 뿐이라, 목표변수와 관련이 있는지는 보지 않는다.
- 선형 변환이라 곡선 구조는 못 잡는다.

군집이나 시각화에서 PCA를 쓰는 건 [비지도학습](#/post/bd-unsupervised)에서 이어서 본다.

## 파생변수

있는 변수를 조합해 새 변수를 만드는 것도 변수 엔지니어링이다. 키와 몸무게로 BMI를 만들거나, 날짜에서 요일·월을 뽑거나, 구매 횟수와 금액으로 평균 구매액을 만드는 식이다. 범주형은 더미(원-핫) 변수로, 연속형은 구간화(binning)로 바꿀 수 있다. 파생변수는 도메인 지식에서 나오는 경우가 많고, 모형이 스스로 찾기 어려운 비율·차이 같은 관계를 직접 넣어 주는 효과가 있다. 만든 변수가 기존 변수와 거의 겹치면 다시 상관분석으로 걸러야 한다.

## 시험 대비로 묶어 보면

- 필터·래퍼·임베디드는 "모형을 쓰는가, 언제 쓰는가"로 구분한다.
- 전진 선택, 후진 제거, 단계적 선택은 래퍼 쪽 이름이다.
- 라쏘는 L1이라 변수가 0이 되고, 릿지는 L2라 0이 되지 않는다.
- PCA는 선택이 아니라 새 변수를 만드는 방법이고, 표준화가 먼저다.
- 주성분 수는 누적 설명 분산이나 스크리 플롯으로 정한다.
- 변수 선택은 훈련 데이터로만 맞추고 시험 데이터에는 그대로 적용한다.

실기에서는 위 코드처럼 `train_test_split` 뒤에 `fit`은 훈련에만, `transform`은 둘 다에 쓰는 순서가 기본이다. 변수 선택과 PCA 모두 같은 규칙이다. 시험 일정과 응시 방법은 공식 사이트에서 확인하면 된다.

## 근거 링크

- [scikit-learn: Feature selection](https://scikit-learn.org/stable/modules/feature_selection.html)
- [scikit-learn: Decomposing signals in components (PCA)](https://scikit-learn.org/stable/modules/decomposition.html#pca)

← [개념 지도로](#/post/bd-map)

관련 글: [데이터 전처리](#/post/bd-preprocessing) · [분석 모형 설계](#/post/bd-model-design) · [비지도학습 모형](#/post/bd-unsupervised)
