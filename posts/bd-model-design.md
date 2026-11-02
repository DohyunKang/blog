분석 모형 설계는 어떤 알고리즘을 쓸지 고르기 전에 "이 모형이 처음 보는 데이터에서도 잘 맞는지 어떻게 확인할 건가"를 정해 두는 단계다. 필기에서는 분할 비율, 과적합과 과소적합, 교차검증 종류가 반복해서 나오는 쪽이고, 실기에서는 `train_test_split`과 `cross_val_score`로 그대로 이어진다.

## 모형을 고르는 순서

먼저 문제 유형을 정한다. 맞힐 값이 숫자면 회귀, 범주면 분류, 정답 없이 묶는 거면 군집이다. 이 구분이 정해져야 쓸 수 있는 모형과 평가 지표가 같이 좁혀진다.

| 목표 | 유형 | 예시 |
|---|---|---|
| 연속된 값 예측 | 회귀 | 집값, 매출 |
| 범주 예측 | 분류 | 이탈 여부, 스팸 여부 |
| 정답 없이 구조 찾기 | 군집·연관 | 고객 세그먼트 |

그다음은 해석이 필요한지, 데이터가 얼마나 되는지, 변수가 몇 개인지를 보고 후보를 두세 개 잡는다. 이 단원에서 후보를 하나로 못 박는 일은 거의 없고, 후보를 같은 조건에서 비교하는 틀을 만드는 게 목적이다. 모형 하나하나는 [자세히 → 지도학습 모형](#/post/bd-supervised)에서 따로 본다.

## 데이터를 셋으로 나누는 이유

훈련에 쓴 데이터로 점수를 매기면 모형이 외운 걸 확인하는 셈이라 점수가 부풀려진다. 그래서 데이터를 나눠서 역할을 준다.

| 이름 | 역할 | 쓰는 시점 |
|---|---|---|
| 훈련(train) | 모형의 파라미터를 학습 | 학습할 때 |
| 검증(validation) | 하이퍼파라미터 조정, 모형 비교 | 튜닝할 때 |
| 시험(test) | 최종 성능 확인 | 마지막에 한 번 |

scikit-learn 문서도 같은 구조로 설명한다. 시험 데이터는 마지막 평가에만 쓰고, 하이퍼파라미터를 조정할 땐 검증 데이터를 따로 둬서 시험 데이터 정보가 모형으로 새어 들어가지 않게 한다. 비율은 6:2:2나 7:3처럼 자주 쓰는 값이 있을 뿐 정해진 규칙은 아니다. 데이터가 적으면 검증을 따로 떼는 게 부담이 돼서 교차검증을 쓴다.

분류에서는 클래스 비율이 나뉜 쪽마다 비슷해야 해서 층화추출(`stratify=y`)을 쓴다. 암 진단 데이터로 확인해 보니 전체 양성 비율이 0.627일 때 훈련은 0.626, 시험은 0.632였다. 분할 크기는 569건을 6:2:2로 나눠 341/114/114건이 됐다.

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

시험에서 `random_state`를 주는 이유는 결과를 다시 똑같이 재현하기 위해서다. 이 값을 안 주면 실행할 때마다 분할이 달라져 점수도 달라진다.

## 과소적합과 과적합

모형이 너무 단순해서 패턴을 못 잡으면 과소적합, 너무 복잡해서 훈련 데이터의 잡음까지 배우면 과적합이다. scikit-learn 예제는 다항식 차수로 이걸 보여 준다. 차수 1은 직선이라 못 맞추고, 4는 거의 맞고, 15는 잡음까지 따라가서 검증 오차가 폭발한다.

| 상태 | 훈련 성능 | 검증 성능 | 원인 |
|---|---|---|---|
| 과소적합 | 낮음 | 낮음 | 모형이 단순함 |
| 적절 | 높음 | 높음 | 균형 |
| 과적합 | 매우 높음 | 훈련보다 눈에 띄게 낮음 | 모형이 복잡함, 데이터가 적음 |

판단 기준은 훈련 점수와 검증 점수의 간격이다. 결정나무 깊이를 바꿔서 직접 확인했다.

```python
from sklearn.tree import DecisionTreeClassifier

for d in [1, 2, 3, 5, 10, None]:
    m = DecisionTreeClassifier(max_depth=d, random_state=0).fit(Xtr2, ytr2)
    print(d, round(m.score(Xtr2, ytr2), 3), round(m.score(Xva, yva), 3))
```

| max_depth | 훈련 정확도 | 검증 정확도 |
|---|---|---|
| 1 | 0.927 | 0.895 |
| 2 | 0.968 | 0.947 |
| 3 | 0.971 | 0.947 |
| 5 | 0.997 | 0.956 |
| 10 | 1.000 | 0.956 |
| None | 1.000 | 0.956 |

깊이가 1일 땐 둘 다 낮아서 과소적합 쪽이다. 깊이를 늘리면 훈련 점수는 1.0까지 올라가는데 검증 점수는 0.956에서 멈춘다. 훈련이 만점인데 검증이 따라오지 못하는 간격이 과적합의 모양이다. 이 데이터에서는 깊이 5 이상부터 훈련만 오르고 검증은 그대로였다.

<details>
<summary>과적합을 줄이는 방법 정리</summary>

- 데이터를 더 모은다.
- 모형을 단순하게 한다(나무 깊이 제한, 변수 줄이기). 변수 쪽은 [자세히 → 변수 선택과 차원 축소](#/post/bd-feature-select)에서 다룬다.
- 규제를 건다(릿지·라쏘 같은 페널티).
- 가지치기, 조기 종료를 쓴다.
- 교차검증으로 하이퍼파라미터를 고른다.

위 표에서 깊이를 제한하는 게 두 번째 방법의 예다.
</details>

## 교차검증

검증 데이터를 한 번만 떼면 어떻게 잘렸느냐에 점수가 흔들린다. 교차검증은 훈련 데이터를 k조각으로 나눠서 한 조각씩 번갈아 검증에 쓰고 평균을 낸다. 모든 데이터가 훈련과 검증에 한 번씩 쓰이니 데이터가 적을 때 유리하고, 대신 모형을 k번 학습해야 한다.

| 방법 | 내용 | 특징 |
|---|---|---|
| 홀드아웃 | 한 번 나눔 | 빠르지만 분할에 따라 흔들림 |
| k-fold | k조각 번갈아 검증 | 가장 흔함, k번 학습 |
| 층화 k-fold | 조각마다 클래스 비율 유지 | 불균형 분류에 사용 |
| LOOCV(leave-one-out) | k를 데이터 수만큼 | 한 건씩 빼고 검증, 계산량 큼 |
| 부트스트랩 | 복원추출로 훈련 표본 생성 | 중복 뽑힌 표본 외 나머지로 검증 |

scikit-learn 문서에 따르면 `shuffle`은 기본이 꺼져 있어서 데이터가 정렬돼 있으면 `shuffle=True`를 줘야 하고, 분류기에 `cv`를 정수로 주면 `cross_val_score`가 층화 방식을 기본으로 쓴다.

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

skf = StratifiedKFold(5, shuffle=True, random_state=0)
for d in [1, 2, 3, 5, None]:
    s = cross_val_score(
        DecisionTreeClassifier(max_depth=d, random_state=0), Xtr, ytr, cv=skf)
    print(d, s.round(3), round(s.mean(), 3))
```

| max_depth | 5개 fold 평균 |
|---|---|
| 1 | 0.895 |
| 2 | 0.932 |
| 3 | 0.914 |
| 5 | 0.916 |
| None | 0.914 |

검증 데이터 한 번 뗐을 땐 깊이 5 이상이 제일 좋아 보였는데, 5조각으로 돌리니 깊이 2가 제일 높게 나왔다. 같은 모형이라도 어떻게 자르느냐에 따라 결론이 달라질 수 있다는 걸 그대로 보여 준다. fold마다 점수 폭도 꽤 컸다(깊이 3은 0.846~0.945).

<details>
<summary>교차검증에서 새는 전처리 (데이터 누수)</summary>

스케일링이나 변수 선택을 전체 데이터에 먼저 해 버리고 나눠서 검증하면, 검증 조각의 통계가 훈련에 섞인다. scikit-learn 문서가 권하는 방법은 전처리와 모형을 `Pipeline`으로 묶어서 fold마다 전처리를 훈련 조각에서만 다시 맞추는 것이다.

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

p = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
s = cross_val_score(p, Xtr, ytr, cv=skf)
print(round(s.mean(), 3))  # 0.974
```

같은 훈련 데이터에서 결정나무보다 이 로지스틱 회귀 파이프라인의 교차검증 평균이 높았다(0.974). 이런 식으로 후보 모형을 같은 분할로 비교하는 게 모형 선택이다. 전처리 자체는 [자세히 → 데이터 전처리](#/post/bd-preprocessing)에 있다.
</details>

## 시험 데이터는 마지막에 한 번

교차검증으로 고른 설정은 훈련 데이터 전체로 다시 학습한 뒤 시험 데이터로 한 번만 평가한다. 깊이 3으로 학습해서 시험 데이터에 적용했더니 정확도가 0.939였다. 시험 점수를 보고 모형을 다시 고치기 시작하면 시험 데이터가 검증 데이터가 돼 버려서 최종 점수의 의미가 없어진다. 점수를 어떤 지표로 읽을지는 [자세히 → 모형 평가](#/post/bd-evaluation)로 이어진다.

## 자주 헷갈리는 것

- 검증 데이터와 시험 데이터는 다르다. 검증은 튜닝에 쓰고, 시험은 끝에 한 번이다.
- 훈련 정확도가 높다고 좋은 모형이 아니다. 간격을 봐야 한다.
- 교차검증은 모형을 만드는 방법이 아니라 성능을 추정하는 방법이다. 학습은 fold마다 새로 한다.
- 층화는 분류의 클래스 비율을 맞추는 거라 회귀에는 그대로 쓰지 않는다.
- 비율 7:3, 6:2:2는 관행이지 공식이 아니다.

실기에서 이 흐름을 코드 하나로 이어 보는 건 [자세히 → 실기 파이썬 요점](#/post/bd-practical-python)에 둔다.

## 근거 링크

- scikit-learn, Cross-validation: evaluating estimator performance — https://scikit-learn.org/stable/modules/cross_validation.html
- scikit-learn, Underfitting vs. Overfitting — https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html

← 개념 지도로 (#/post/bd-map)

관련 글: [분석 모형 설계 앞단 · 변수 선택과 차원 축소](#/post/bd-feature-select) · [지도학습 모형](#/post/bd-supervised) · [모형 평가](#/post/bd-evaluation)
