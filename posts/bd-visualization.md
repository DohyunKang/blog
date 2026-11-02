빅데이터분석기사 필기 4과목 뒷부분은 결과를 어떻게 보여 주고 해석하느냐를 다룬다. 계산 문제는 거의 없고, 어떤 그래프가 어떤 상황에 맞는지와 지표·결과를 읽고 결론을 고르는 문제가 중심이다. 모형 평가 지표 자체는 [자세히 → 모형 평가](#/post/bd-evaluation)에 따로 정리했고, 여기서는 그 숫자를 어떻게 해석하고 전달하는지를 본다.

시험 일정과 응시료는 공식 사이트에서 확인하면 된다. 이 글은 단원 핵심과 자주 묻는 유형만 다룬다.

## 시각화는 질문에 맞춰 고른다

그래프는 보여 주고 싶은 관계가 정해지면 거의 따라 정해진다.

| 보여 줄 것 | 대표 그래프 | 메모 |
|---|---|---|
| 한 변수의 분포 | 히스토그램, 상자그림 | 상자그림은 중앙값·사분위수·이상값을 한 번에 보인다 |
| 두 수치 변수의 관계 | 산점도 | 상관이 있는지, 이상값이 있는지 먼저 본다 |
| 여러 변수 사이 상관 | 상관 행렬 히트맵 | 색 진하기로 상관계수 크기를 읽는다 |
| 범주별 크기 비교 | 막대그래프 | 범주 순서가 없으면 크기순 정렬이 읽기 쉽다 |
| 시간에 따른 변화 | 선그래프 | 시계열은 기본 |
| 전체 대비 구성 | 파이·누적 막대 | 항목이 많으면 막대가 낫다 |
| 분류 결과 | 혼동행렬, ROC 곡선 | 임계값에 따른 변화를 본다 |

시험에서는 "이 목적에는 어떤 그래프가 맞는가"를 묻는 형태가 많다. 분포는 히스토그램·상자그림, 관계는 산점도, 추세는 선그래프로 묶어 두면 대부분 걸러진다.

한 가지 더, 시각화는 데이터를 정직하게 보여야 한다. 축을 중간에서 자르면 작은 차이가 크게 보이고, 파이 조각이 너무 많으면 비교가 안 된다. 보고서용 그래프는 제목·축 이름·단위가 빠지지 않는 것이 기본이다.

## 해석에서 구분해야 하는 세 가지

해석 문제는 대개 서로 비슷해 보이는 개념을 구분하는지 묻는다.

### 1. 변수 중요도 (무엇이 모형에 중요한가)

트리 계열 모형은 학습하면서 각 변수가 불순도를 얼마나 줄였는지로 중요도를 준다. 아래는 유방암 진단 데이터(scikit-learn 내장)로 랜덤포레스트를 학습해 직접 돌린 결과다.

<details>
<summary>실행 코드와 결과 (pandas, scikit-learn으로 실행해 확인)</summary>

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

불순도 기반 상위 5개

```
worst perimeter         0.141
worst area              0.132
worst concave points    0.122
worst radius            0.085
mean concave points     0.077
```

순열 중요도 상위 5개

```
worst texture      0.011
mean texture       0.005
concavity error    0.005
symmetry error     0.005
perimeter error    0.005
```
</details>

같은 모형인데 두 순위가 전혀 다르게 나왔다. 불순도 기반은 크기(perimeter, area, radius)가 위로 올라왔고, 순열 중요도는 값이 전부 0.01 이하로 아주 작다. 이 데이터에는 반지름·둘레·면적처럼 서로 거의 같은 정보를 담은 변수가 여럿 있기 때문이다. scikit-learn 문서도 상관 높은 변수가 있으면 하나를 섞어도 나머지로 정보를 복구할 수 있어서 둘 다 중요도가 낮게 나올 수 있다고 설명한다. 그래서 상관 높은 변수는 묶어서 대표 하나만 두는 방식을 권한다.

정리하면 이렇다.

| 구분 | 불순도 기반(트리 내장) | 순열 중요도 |
|---|---|---|
| 계산 | 학습 중 불순도 감소량 합 | 변수 하나를 섞고 점수가 얼마나 떨어지는지 |
| 적용 모형 | 트리 계열 | 어떤 모형이든 |
| 약점 | 수치형·고유값 많은 변수에 치우침 | 상관 높은 변수가 있으면 둘 다 낮게 나옴 |
| 데이터 | 학습 데이터 기준 | 시험(검증) 데이터에서 계산 가능 |

둘 다 모형이 그 변수에 얼마나 기대는지를 보여 줄 뿐이고, 변수 자체의 예측력이나 인과를 말하는 건 아니다. 이 부분이 시험에서도 보기 문장으로 자주 변형된다.

### 2. 변수의 효과 방향 (어느 쪽으로 영향을 주는가)

중요도는 크기만 알려 주고 방향은 모른다. 방향은 모형에 따라 읽는 법이 다르다.

- 선형·로지스틱 회귀는 계수의 부호와 크기로 읽는다. 로지스틱 회귀 계수는 로그 오즈 변화이고, `exp(계수)`가 오즈비다.
- 트리 계열은 부분 의존 그래프(PDP)로 본다. 한 변수 값을 바꿔 가며 나머지는 평균을 내서 예측이 어떻게 변하는지 그린다.

<details>
<summary>로지스틱 계수와 부분 의존 값 (직접 실행)</summary>

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

결과

```
worst texture          -1.23
worst concave points   -1.00
worst area             -0.95
{'worst texture': 0.293}

[10.4 14.1 17.7 21.4 25.1]
[0.662 0.656 0.527 0.524 0.524]
```
</details>

표준화한 뒤 학습했기 때문에 `worst texture` 계수 -1.23은 이 변수가 표준편차 1만큼 커질 때 로그 오즈가 1.23 줄어든다는 뜻이다. 오즈비로는 0.293, 약 0.29배다. 이 데이터에서 타깃 1은 양성(benign)이라 음수 계수는 양성 쪽 확률을 낮추는 방향이다.

부분 의존 값은 `worst radius`가 커질수록 양성 확률 평균이 0.66에서 0.52로 내려갔다. 가운데에서 가장 크게 꺾이고 양 끝은 평평한데, 평균 한 줄만 봐서는 이런 구간별 차이를 놓치기 쉽다. 문서에 따르면 개별 샘플마다 선을 그리는 ICE 플롯이 평균 속에 숨은 이질적인 효과를 보여 준다. 또 PDP와 ICE는 관심 변수가 나머지 변수와 독립이라고 가정하기 때문에, 상관 높은 변수가 있으면 비현실적인 데이터 점이 섞여 곡선이 왜곡될 수 있다.

### 3. 임계값과 예측 결과 (어느 지점에서 자를 것인가)

분류 모형은 확률을 내놓고, 어디서 양성으로 자를지는 사람이 정한다. 같은 모형에서 임계값만 바꿔 혼동행렬이 어떻게 변하는지 돌려 봤다.

<details>
<summary>임계값별 혼동행렬 (직접 실행)</summary>

```python
from sklearn.metrics import confusion_matrix, roc_auc_score
pp = rf.predict_proba(Xte)[:, 1]
print("auc", round(roc_auc_score(yte, pp), 3))
for t in (0.5, 0.8, 0.95):
    tn, fp, fn, tp = confusion_matrix(yte, (pp >= t).astype(int)).ravel()
    print(t, "TN", tn, "FP", fp, "FN", fn, "TP", tp)
```

결과

```
auc 0.992
0.5  TN 58  FP 6  FN 4   TP 103
0.8  TN 64  FP 0  FN 12  TP 95
0.95 TN 64  FP 0  FN 31  TP 76
```
</details>

| 임계값 | 거짓 양성(FP) | 거짓 음성(FN) |
|---|---|---|
| 0.5 | 6 | 4 |
| 0.8 | 0 | 12 |
| 0.95 | 0 | 31 |

AUC는 0.992로 변하지 않는데 임계값에 따라 오류의 종류가 완전히 바뀐다. 임계값을 올리면 양성이라고 부르는 기준이 엄격해져서 FP가 줄고 FN이 늘었다. 그러니 어느 오류가 더 뼈아픈지가 임계값 선택 기준이다. 질병 선별처럼 놓치면 안 되는 문제는 재현율을, 스팸 필터처럼 정상 메일을 막으면 안 되는 문제는 정밀도를 우선한다. 각 지표의 정의는 [자세히 → 모형 평가](#/post/bd-evaluation)에 있다.

## 결과 보고서와 모형 운영

분석 결과는 모형을 쓸 사람에게 전달돼야 끝난다. 보고서에는 보통 다음이 들어간다.

1. 분석 목적과 데이터 설명(출처, 기간, 크기)
2. 전처리와 모형 선택 과정, 사용한 지표
3. 결과 요약(핵심 수치와 해석)
4. 한계와 활용 방안

해석할 때는 상관과 인과를 구분하는 게 기본이다. 변수 중요도가 높다고 그 변수가 결과의 원인인 건 아니다. 학습·검증·시험 데이터를 나눈 이유와 과적합 점검은 [자세히 → 분석 모형 설계](#/post/bd-model-design)를 같이 보면 이어진다.

모형은 배포한 뒤에도 관리 대상이다. 시간이 지나면 입력 데이터의 분포가 달라져 성능이 떨어질 수 있어서, 성능 지표를 계속 모니터링하고 필요하면 재학습하는 식으로 운영한다. 모형을 어떤 알고리즘으로 만들었는지는 [자세히 → 지도학습 모형](#/post/bd-supervised)과 [자세히 → 비지도학습 모형](#/post/bd-unsupervised)에서 다룬다.

## 풀 때 보는 순서

해석 문제는 보기 문장을 아래 순서로 걸러 보면 편했다.

- 어떤 그래프를 고르는 문제인가 → 보여 줄 관계(분포·관계·추세·구성)부터 정한다.
- 중요도를 묻는가, 방향을 묻는가 → 중요도는 크기만, 방향은 계수 부호나 PDP.
- "중요도가 높으면 원인이다" 같은 보기 → 상관과 인과 구분으로 거른다.
- 오류 종류를 묻는가 → FP·FN 중 무엇이 더 큰 손실인지로 임계값을 정한다.

실기에서는 이 흐름을 코드로 옮기는 연습이 필요하다. 그 부분은 [자세히 → 실기 파이썬 요점](#/post/bd-practical-python)에 이어진다.

← [개념 map으로 (#/post/bd-map)](#/post/bd-map)

관련 글: [모형 평가](#/post/bd-evaluation), [분석 모형 설계](#/post/bd-model-design), [실기 파이썬 요점](#/post/bd-practical-python)

## 근거 링크

- scikit-learn, Permutation feature importance: https://scikit-learn.org/stable/modules/permutation_importance.html
- scikit-learn, Partial Dependence and Individual Conditional Expectation plots: https://scikit-learn.org/stable/modules/partial_dependence.html
