실기 파이썬은 데이터를 받아서 전처리하고, 모형을 만들고, 평가한 뒤 결과를 파일로 내는 한 줄기 흐름이다. 외울 건 함수 이름보다 이 순서다. 시험 일정·응시료·출제 형식은 공식 사이트에서 확인하자. 이 글은 단원 지식이 아니라 코드 흐름만 정리한 것이다. 개념은 앞 단원 글에서 따로 본다.

## 흐름은 여섯 칸

| 순서 | 할 일 | 주로 쓰는 것 |
|---|---|---|
| 1 | 데이터 보기·결측 확인 | `df.shape`, `df.isna().sum()` |
| 2 | 결측·이상값 처리 | `fillna`, `dropna`, 사분위수 |
| 3 | 범주형 인코딩 | `pd.get_dummies` |
| 4 | 훈련·시험 분할 | `train_test_split` |
| 5 | 스케일링·모형 학습 | `StandardScaler`, `RandomForestClassifier` |
| 6 | 평가·저장 | `accuracy_score`, `roc_auc_score`, `to_csv` |

순서가 바뀌면 틀리는 곳이 둘 있다. 스케일러는 분할한 뒤 훈련 데이터로만 맞춰야 하고, 인코딩은 분할 전에 한꺼번에 하는 편이 열 이름이 어긋나지 않는다. 이유는 아래 코드에서 같이 본다.

개념 쪽은 [자세히 → 데이터 전처리](#/post/bd-preprocessing), [자세히 → 분석 모형 설계](#/post/bd-model-design)에 있다.

## 예제 데이터

시험 데이터가 아니라 직접 만든 연습용 데이터다. 나이·소득에 결측을 일부러 넣었다.

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

실행하면 `age` 20, `income` 10, `grade`·`buy` 0이 나오고 모양은 `(200, 4)`다. 실기에서도 데이터를 열면 제일 먼저 이 두 줄(모양, 결측 개수)을 찍는 습관이 좋다.

## 결측 처리

pandas 문서 기준으로 `isna()`는 결측 여부를 같은 모양의 참/거짓으로 돌려주고, `dropna()`는 결측이 있는 행(기본)이나 열을 지우고, `fillna()`는 지우지 않고 값으로 채운다. 줄 하나로 외우면 "찾고, 지우고, 채우고"다.

```python
num_cols = ["age", "income"]
df[num_cols] = df[num_cols].fillna(df[num_cols].median())
print(df.isna().sum().sum())   # 0
```

숫자 열은 평균이나 중앙값으로 채우는 게 흔한 선택이다. 이상값이 있으면 평균이 끌려가므로 중앙값이 안전하다. 채운 뒤 `isna().sum().sum()`이 0인지 확인하면 끝이다.

<details>
<summary>이상값을 사분위수로 거르기</summary>

IQR 방식은 Q1 − 1.5×IQR 아래, Q3 + 1.5×IQR 위를 이상값으로 본다.

```python
s = pd.DataFrame({"v": [1, 2, 5]})
q1, q3 = s["v"].quantile([.25, .75])
iqr = q3 - q1
kept = s[(s.v >= q1 - 1.5*iqr) & (s.v <= q3 + 1.5*iqr)]
```

값이 1, 2, 5면 Q1 1.5, Q3 3.5로 계산되고 셋 다 남는다. 시험에서는 "제거하라"인지 "대체하라"인지 문제 문장을 먼저 읽어야 한다.
</details>

## 범주형 인코딩

문자열 열은 모형이 못 읽으니 숫자로 바꾼다. 원-핫은 `pd.get_dummies`다.

```python
X = pd.get_dummies(df.drop(columns="buy"), columns=["grade"], drop_first=True)
y = df["buy"]
print(list(X.columns))   # ['age', 'income', 'grade_B', 'grade_C']
```

`drop_first=True`를 주면 기준 범주(A)가 빠져서 열이 하나 줄어든다. 범주가 셋이면 열은 둘이다. 이 옵션을 안 줘도 트리 계열 모형은 돌아가지만, 회귀 계열에서는 열끼리 겹치는 문제가 생길 수 있어 주는 쪽이 무난하다.

## 분할과 스케일링

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

세 가지가 포인트다.

- `random_state`를 고정한다. 다음 실행에도 같은 분할이 나온다.
- `stratify=y`는 클래스 비율을 훈련·시험에 비슷하게 유지한다. 분류에서 쓴다.
- 스케일러는 `fit`을 훈련 데이터에만 하고, 시험 데이터에는 `transform`만 한다. 시험 데이터 정보가 학습에 새는 걸 막는 것이다.

[자세히 → 분석 모형 설계](#/post/bd-model-design)에서 과적합·교차검증을 같이 보면 이 순서가 왜 중요한지 이어진다.

## 모형 학습과 예측

```python
from sklearn.ensemble import RandomForestClassifier

m = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)
pred  = m.predict(X_te)
proba = m.predict_proba(X_te)[:, 1]
print(m.classes_)   # [0 1]
```

scikit-learn 문서 기준으로 `n_estimators` 기본값은 100이고 `random_state` 기본값은 None이라서 안 정하면 실행마다 결과가 달라진다. `predict_proba`는 `(샘플 수, 클래스 수)` 모양의 확률을 주고, 열 순서는 `classes_`를 따른다. 그래서 `[:, 1]`이 클래스 1의 확률이다. 문제에서 "확률을 제출하라"면 `predict`가 아니라 이쪽이다.

모형 종류별 특징은 [자세히 → 지도학습 모형](#/post/bd-supervised)에 있다. 코드 모양은 거의 같아서 `RandomForestClassifier` 자리에 `LogisticRegression`, `DecisionTreeClassifier`, `SVC`를 넣으면 되고, 나머지 `fit`·`predict`는 그대로다.

## 평가

```python
from sklearn.metrics import (accuracy_score, f1_score,
                             roc_auc_score, confusion_matrix)

print(confusion_matrix(y_te, pred))
print(accuracy_score(y_te, pred), f1_score(y_te, pred), roc_auc_score(y_te, proba))
```

위 예제 데이터에서 실행했을 때 혼동행렬은 `[[18 4] [4 14]]`, 정확도 0.8, F1 약 0.778, AUC 약 0.836이 나왔다. 숫자 자체보다 인자 모양이 중요하다.

| 지표 | 넣는 것 |
|---|---|
| 정확도, F1 | 실제값, **예측 클래스** |
| AUC | 실제값, **예측 확률** |

AUC에 클래스(0/1)를 넣으면 에러는 안 나지만 값이 달라진다. 함수마다 받는 인자가 다른 점이 실수하기 쉬운 곳이다. 지표 뜻은 [자세히 → 모형 평가](#/post/bd-evaluation)에서 본다.

## 결과 저장

```python
out = pd.DataFrame({"pred": proba})
out.to_csv("result.csv", index=False)
```

`index=False`를 빼면 맨 앞에 번호 열이 하나 더 붙는다. 제출 형식이 정해진 문제에서 이 한 줄이 감점 원인이 되기 쉬우니 열 이름과 열 개수는 문제 지시대로 맞춘다.

## 자주 틀리는 곳

- 테스트 데이터에도 `fit`을 한다. `fit`은 훈련에만, 시험에는 `transform`·`predict`만.
- `random_state`를 안 줘서 결과가 매번 바뀐다.
- 인코딩을 훈련·시험에 따로 해서 열이 어긋난다.
- 목표 변수(`buy`)를 `X`에 그대로 남겨 둔다.
- AUC에 확률 대신 클래스를 넣는다.

이 글의 코드는 파이썬 3에서 pandas 3.1.0, scikit-learn 1.9.1로 실행해 확인했다. 시험 환경의 버전은 다를 수 있으니 함수 인자는 공식 문서로 다시 보는 게 맞다.

---

← [개념 map으로](#/post/bd-map)

관련 글: [데이터 전처리](#/post/bd-preprocessing) · [지도학습 모형](#/post/bd-supervised) · [모형 평가](#/post/bd-evaluation)

## 근거 링크

- [pandas 문서 — Working with missing data](https://pandas.pydata.org/docs/user_guide/missing_data.html)
- [scikit-learn 문서 — RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)
