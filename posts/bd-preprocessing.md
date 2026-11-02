빅데이터분석기사에서 전처리는 필기와 실기 양쪽에 걸쳐 나온다. 필기에서는 개념과 용어를 고르고, 실기에서는 같은 작업을 pandas·scikit-learn(R을 쓰면 R 함수)으로 직접 한다. 그래서 용어, 언제 쓰는지, 코드 한 줄을 세트로 묶어 외우는 편이 낫다. 데이터를 모으고 저장하는 앞 단계는 [자세히 → 데이터 수집과 저장](#/post/bd-collection-storage)에 있다.

## 한눈에 보는 흐름

| 작업 | 풀려는 문제 | 대표 방법 |
|---|---|---|
| 결측치 처리 | 값이 비어 있다 | 삭제, 평균·중앙값·최빈값 대체, 보간 |
| 이상치 처리 | 혼자 튀는 값이 있다 | IQR 기준, 표준화 점수, 제거·대체 |
| 변환 | 값의 범위·모양이 제각각이다 | 정규화, 표준화, 로그 변환, 구간화 |
| 인코딩 | 문자 범주를 모형이 못 읽는다 | 원-핫, 레이블 인코딩 |
| 불균형 처리 | 한 클래스가 너무 적다 | 오버샘플링, 언더샘플링, 가중치 |
| 분할 | 평가를 공정하게 하고 싶다 | 학습·검증·테스트, 층화 분할 |

아래 예제는 전부 같은 작은 표로 돌렸다. 나이 6명, 소득 6명, 도시 6명짜리다.

```python
import pandas as pd, numpy as np
df = pd.DataFrame({
    'age':[25,30,np.nan,45,28,100],
    'income':[300,350,400,np.nan,320,330],
    'city':['서울','부산','서울','대구','부산','서울']})
print(df.isna().sum())   # age 1, income 1, city 0
```

## 결측치

pandas는 비어 있는 값을 float 열에서는 NaN으로 둔다. 정수 열에 NaN이 하나라도 들어오면 float로 바뀐다. 비었는지 확인할 때는 `==`가 아니라 `isna()`를 쓴다. NaN끼리는 같다고 나오지 않기 때문이다.

처리 방법은 크게 셋이다.

| 방법 | 코드 | 언제 |
|---|---|---|
| 삭제 | `df.dropna()` | 비율이 작고 무작위로 빠졌을 때 |
| 대체 | `df.fillna(값)` | 평균(수치), 중앙값(치우친 수치), 최빈값(범주) |
| 보간 | `s.interpolate()`, `s.ffill()` | 시간 순서가 있는 자료 |

```python
df.dropna()             # 6행 중 4행만 남는다
df.fillna({'age': df['age'].median(), 'income': df['income'].mean()})
# age의 빈칸은 30, income의 빈칸은 340이 들어간다
pd.Series([1, np.nan, 3]).interpolate().tolist()  # [1.0, 2.0, 3.0]
pd.Series([1, np.nan, 3]).ffill().tolist()        # [1.0, 1.0, 3.0]
```

여기서 `dropna()`가 6행을 4행으로 줄인 점을 눈여겨봤다. 열이 많으면 한 행에 빈칸이 하나만 있어도 행 전체가 날아간다. 그래서 시험에서는 삭제보다 대체가 먼저 나오는 경우가 많다.

대체 값은 분포에 따라 고른다. 나이에 100이 섞여 있으면 평균이 끌려 올라가므로 중앙값이 안전하다. `interpolate()`는 기본이 선형 보간이고, 앞 값을 그대로 가져오는 `ffill()`은 결과가 다르다. 위 두 줄 출력이 그 차이다.

<details>
<summary>결측 발생 유형 (MCAR·MAR·MNAR)</summary>

결측이 왜 생겼는지로 세 유형을 나눈다.

| 유형 | 뜻 | 예 |
|---|---|---|
| MCAR | 완전 무작위로 빠짐 | 센서가 우연히 한 번 끊김 |
| MAR | 다른 관측 변수에 따라 빠짐 | 젊은 층이 소득 문항을 더 자주 건너뜀 |
| MNAR | 빠진 값 자체에 따라 빠짐 | 소득이 높은 사람이 소득을 안 적음 |

MCAR이면 삭제해도 편향이 작고, MNAR이면 삭제·대체 모두 조심해야 한다고 정리해 두면 된다.
</details>

## 이상치

이상치는 다른 값들과 동떨어진 값이다. 오류일 수도 있고 진짜 극단값일 수도 있어서, 지우기 전에 원인부터 본다. 시험에서는 IQR 기준이 가장 자주 나온다.

기준은 Q1 − 1.5×IQR 아래, Q3 + 1.5×IQR 위다. 나이 값 25, 30, 45, 28, 100(결측 제외)으로 계산하면 다음과 같다.

```python
x = df[['age']].dropna()
q1, q3 = x['age'].quantile([.25, .75])   # 28.0, 45.0
iqr = q3 - q1                            # 17.0
lo, hi = q1 - 1.5*iqr, q3 + 1.5*iqr      # 2.5, 70.5
x[(x.age < lo) | (x.age > hi)]           # 100만 걸린다
```

하한 2.5, 상한 70.5라서 100만 이상치로 잡힌다. 표준화 점수(z-score)로 보는 방법도 있다. 보통 절댓값 3을 넘으면 이상치로 본다. 평균과 표준편차 자체가 이상치에 끌려가므로 표본이 작으면 IQR 쪽이 덜 흔들린다.

처리는 제거, 상·하한값으로 대체, 변환(로그 등), 그대로 두고 이상치에 강한 방법 쓰기 중에서 고른다. 탐색 단계에서 이상치를 어떻게 읽는지는 [자세히 → 탐색적 분석과 기초 통계](#/post/bd-eda-stats)와 이어진다.

## 변환

### 정규화와 표준화

둘 다 변수의 단위·범위를 맞추는 작업이다. 거리 기반 모형(k-NN, k-평균)이나 경사하강법을 쓰는 모형은 단위가 큰 변수가 결과를 지배하기 쉬워서 필요하다. 트리 기반 모형은 보통 크게 상관없다고 알려져 있다.

| 이름 | 식 | 결과 범위 | scikit-learn |
|---|---|---|---|
| 최소-최대 정규화 | (x − min) / (max − min) | 0~1 | `MinMaxScaler` |
| 표준화(z-score) | (x − 평균) / 표준편차 | 평균 0, 표준편차 1 | `StandardScaler` |
| 로버스트 스케일링 | 중앙값·사분위수 기준 | 이상치 영향이 작다 | `RobustScaler` |

같은 나이 값 [25, 30, 45, 28, 100]에 두 방법을 적용했다.

```python
from sklearn.preprocessing import StandardScaler, MinMaxScaler
StandardScaler().fit_transform(x).ravel().round(3)
# [-0.734 -0.556 -0.021 -0.627  1.939]
MinMaxScaler().fit_transform(x).ravel().round(3)
# [0.    0.067 0.267 0.04  1.   ]
```

최소-최대는 100 하나 때문에 나머지가 0~0.27 사이에 몰렸다. 이상치가 있으면 정규화 결과가 이렇게 한쪽으로 쏠린다. 그래서 이상치가 많을 땐 로버스트 스케일링을 쓴다는 설명이 붙는다. 용어는 이름이 헷갈리는 편이라, 필기에서는 식을 보고 이름을 고르는 문제로 나올 수 있다.

### 학습 데이터로만 맞춘다

스케일러는 학습 데이터에 `fit`하고, 테스트 데이터에는 `transform`만 한다. 전체 데이터로 맞추면 테스트 데이터의 정보가 학습에 새어 들어간다. scikit-learn 문서도 파이프라인으로 묶어 이 순서를 지키라고 보여 준다.

```python
tr = pd.DataFrame({'v':[1,2,3,4]}); te = pd.DataFrame({'v':[10]})
s = MinMaxScaler().fit(tr)
s.transform(te)    # [[3.]]
```

학습 범위가 1~4인데 테스트 값 10은 3이 나온다. 0~1을 벗어나는 게 정상이다. 이걸 억지로 막으려고 전체로 `fit`하면 안 된다.

### 로그 변환과 구간화

오른쪽으로 길게 치우친 변수는 로그를 취해 모양을 줄인다. `np.log1p([1,10,100,1000])`은 약 0.693, 2.398, 4.615, 6.909로, 1000배 차이가 10배 차이 정도로 줄어든다. 0 이하가 있으면 `log`가 안 되니 `log1p`를 쓴다.

구간화는 연속값을 범주로 바꾼다. `pd.cut`은 구간 폭을 직접 정하고, `pd.qcut`은 개수가 비슷해지게 자른다.

```python
pd.cut(pd.Series([5,15,25,35,45]), bins=[0,20,40,60], labels=['a','b','c']).tolist()
# ['a','a','b','b','c']
pd.qcut(pd.Series(range(1,9)), 4, labels=False).tolist()
# [0,0,1,1,2,2,3,3]
```

## 인코딩

문자로 된 범주는 숫자로 바꿔야 모형에 들어간다. 범주 사이에 순서가 없으면 원-핫, 순서가 있으면 레이블(서열) 인코딩이 기본이다. 순서 없는 범주에 1, 2, 3을 붙이면 모형이 숫자 크기를 의미로 읽을 수 있다.

```python
pd.get_dummies(df['city'], dtype=int)
#    대구  부산  서울
# 0   0   0   1
# 1   0   1   0
# ...
pd.get_dummies(df['city'], drop_first=True, dtype=int)   # 열 하나를 뺀다
```

범주가 세 개면 열이 세 개 생긴다. `drop_first=True`는 한 열을 빼서 나머지로 복원되게 한다(더미 변수 함정을 피하는 용도). scikit-learn의 `OneHotEncoder`는 같은 일을 하고, 학습에 없던 범주가 테스트에 나올 때의 처리 옵션(`handle_unknown`)과 `drop` 옵션이 있다. 범주 종류가 아주 많으면 열이 폭발하므로 빈도 낮은 범주를 묶는 방법을 쓴다.

## 불균형 데이터

양성 5%, 음성 95%인 자료는 모두 음성이라고 찍어도 정확도가 95%다. 그래서 불균형 자료에서는 정확도가 아니라 재현율·F1 같은 지표를 본다. 지표는 [자세히 → 모형 평가](#/post/bd-evaluation)에서 다룬다.

처리 방법은 세 갈래다.

| 방법 | 내용 | 주의 |
|---|---|---|
| 오버샘플링 | 적은 쪽을 늘린다 (복원 추출 복제, SMOTE) | 복제는 과적합이 쉽다 |
| 언더샘플링 | 많은 쪽을 줄인다 | 정보가 버려진다 |
| 가중치 | 손실에서 적은 클래스에 가중 (`class_weight`) | 자료는 그대로 둔다 |

`make_classification(n_samples=1000, weights=[.95,.05])`로 만든 자료는 클래스가 946 대 54였다. 여기에 `sklearn.utils.resample`을 쓰면 다음처럼 된다.

```python
from sklearn.utils import resample
up = resample(Xm, replace=True,  n_samples=946, random_state=0)  # 54개 -> 946개
dn = resample(Xj, replace=False, n_samples=54,  random_state=0)  # 946개 -> 54개
```

SMOTE는 적은 쪽 표본 사이를 이어 새 표본을 만드는 방식이라고 정리해 두었다. 샘플링은 학습 데이터에만 적용하고 테스트 데이터는 원래 비율을 유지한다.

## 분할

학습·검증·테스트로 나눠 평가한다. 클래스 비율을 유지하려면 `stratify`를 쓴다.

```python
from sklearn.model_selection import train_test_split
a, b, c, d = train_test_split(X, y, test_size=.2, stratify=y, random_state=0)
np.bincount(c), np.bincount(d)   # [757 43], [189 11]
```

학습 쪽 43/800, 테스트 쪽 11/200으로 둘 다 약 5%대다. `stratify`가 없으면 적은 클래스가 한쪽에 몰릴 수 있다. 분할과 교차검증의 설계는 [자세히 → 분석 모형 설계](#/post/bd-model-design)에서 이어진다.

## 자주 나오는 유형

- 결측 처리 방법의 장단점과 어떤 값으로 대체할지 고르기
- IQR 기준으로 이상치 경계값 계산하기
- 정규화·표준화 식을 보고 이름 맞히기, 이상치에 강한 쪽 고르기
- 순서 없는 범주에 원-핫을 써야 하는 이유
- 불균형 자료에서 정확도가 왜 위험한지, 샘플링 방법 구분
- 스케일러를 어느 데이터에 `fit`하는지(학습 데이터만)

실기에서는 `isna().sum()`, `fillna`, 스케일러 `fit_transform`/`transform` 구분, `get_dummies`, `train_test_split`이 한 세트로 나온다. 시험 일정과 응시 요건은 공식 사이트에서 확인한다.

변수를 줄이고 고르는 단계는 [자세히 → 변수 선택과 차원 축소](#/post/bd-feature-select)에서 이어진다.

← [개념 지도로](#/post/bd-map)

관련 글: [탐색적 분석과 기초 통계](#/post/bd-eda-stats), [변수 선택과 차원 축소](#/post/bd-feature-select), [모형 평가](#/post/bd-evaluation)

## 근거 링크

- scikit-learn, Preprocessing data: https://scikit-learn.org/stable/modules/preprocessing.html
- pandas, Working with missing data: https://pandas.pydata.org/docs/user_guide/missing_data.html
