모형 평가는 "이 모형이 새 데이터에서 얼마나 맞히나"를 숫자로 재는 단원이고, 시험에서는 혼동행렬을 보고 지표를 직접 계산하는 문제가 가장 자주 나온다. 지표 이름과 공식을 외우는 것보다 어느 상황에서 어느 지표를 보는지가 같이 묶여 있어야 헷갈리지 않는다.

## 혼동행렬부터

분류 모형이 낸 예측을 실제 값과 비교해 네 칸으로 센 표다. 이걸 기준으로 거의 모든 분류 지표가 나온다.

| | 예측 양성 | 예측 음성 |
|---|---|---|
| 실제 양성 | TP (맞게 양성) | FN (놓친 양성) |
| 실제 음성 | FP (잘못 양성) | TN (맞게 음성) |

이름은 "예측이 맞았나(T/F) + 예측한 쪽(P/N)" 순서로 읽으면 된다. FP는 양성이라고 했는데 틀렸다는 뜻이다. FN은 음성이라고 했는데 틀렸다는 뜻이다.

scikit-learn에서는 행이 실제, 열이 예측이다. 이진 분류에서 `confusion_matrix(...).ravel()`을 하면 `tn, fp, fn, tp` 순서로 나온다. 시험 문제의 표는 행·열 방향이 문제마다 다를 수 있어서, 표를 볼 때 어느 쪽이 실제인지부터 확인해야 한다.

## 지표 공식

| 지표 | 공식 | 한 줄 의미 |
|---|---|---|
| 정확도 | (TP+TN) / 전체 | 전체 중 맞힌 비율 |
| 정밀도 | TP / (TP+FP) | 양성이라고 한 것 중 진짜 양성 |
| 재현율(민감도) | TP / (TP+FN) | 진짜 양성 중 찾아낸 비율 |
| 특이도 | TN / (TN+FP) | 진짜 음성 중 맞힌 비율 |
| F1 | 2·정밀도·재현율 / (정밀도+재현율) | 정밀도와 재현율의 조화평균 |

정밀도는 "양성이라고 말한 것"이 분모이고, 재현율은 "실제 양성"이 분모다. 이 분모만 기억하면 둘이 안 섞인다.

## 직접 돌려 본 예

양성 5개, 음성 15개인 데이터 20개에서 모형이 이렇게 예측했다고 해 보자. 아래 코드는 실행해서 나온 값이다.

```python
from sklearn.metrics import (confusion_matrix, accuracy_score,
                             precision_score, recall_score, f1_score)

y_true = [1,1,1,1,1] + [0]*15
y_pred = [1,1,1,0,0] + [1,1] + [0]*13

print(confusion_matrix(y_true, y_pred))
print(accuracy_score(y_true, y_pred), precision_score(y_true, y_pred),
      recall_score(y_true, y_pred), f1_score(y_true, y_pred))
```

```
[[13  2]
 [ 2  3]]
0.8 0.6 0.6 0.6
```

TN 13, FP 2, FN 2, TP 3이다. 정확도는 16/20으로 0.8, 정밀도는 3/5, 재현율도 3/5, F1도 0.6이다. 손으로 계산한 값과 같다. 정확도는 0.8로 그럴듯한데 양성을 절반 가까이 놓쳤다.

## 정확도가 속이는 경우

같은 데이터에서 모형이 무조건 음성만 낸다고 하면 이렇게 된다.

```python
z = [0]*20
print(accuracy_score(y_true, z), recall_score(y_true, z), f1_score(y_true, z, zero_division=0))
# 0.75 0.0 0.0
```

정확도는 0.75인데 양성은 하나도 못 찾았다. 클래스 비율이 많이 기울어진 데이터(불량 탐지, 이상 거래 같은)에서는 정확도가 높아도 쓸모없는 모형일 수 있다. 이때는 재현율, F1, AUC를 같이 본다. 불균형 자체를 다루는 방법은 [자세히 → 데이터 전처리](#/post/bd-preprocessing)에 있다.

## 어떤 지표를 볼까

| 상황 | 중요한 지표 | 이유 |
|---|---|---|
| 암 진단, 불량 탐지처럼 놓치면 큰일 | 재현율 | FN을 줄여야 한다 |
| 스팸 필터, 추천처럼 잘못 잡으면 곤란 | 정밀도 | FP를 줄여야 한다 |
| 둘 다 필요하고 클래스가 불균형 | F1 | 한쪽만 높은 모형을 걸러 준다 |
| 클래스 비율이 비슷 | 정확도 | 단순해서 충분하다 |

정밀도와 재현율은 보통 한쪽을 올리면 다른 쪽이 내려가는 관계라서 하나로 묶은 F1을 쓴다. scikit-learn 문서에 따르면 F1은 F-beta에서 beta=1인 경우이고, 정밀도와 재현율에 같은 비중을 둔다.

## ROC 곡선과 AUC

분류 모형은 대개 양성일 확률을 내고, 그 확률을 몇 이상일 때 양성으로 볼지(임계값)에 따라 결과가 달라진다. ROC 곡선은 임계값을 바꿔 가며 TPR(= 재현율)을 세로축, FPR(= 1 − 특이도)을 가로축에 찍은 선이다. AUC는 이 곡선 아래 넓이다.

- 곡선이 왼쪽 위 모서리에 붙을수록 좋은 모형이다.
- 무작위로 찍는 모형은 대각선이고 AUC가 0.5다.
- AUC는 1에 가까울수록 좋다.
- 임계값 하나에 묶이지 않고 모형의 순위 매기는 능력을 본다.

작은 예로 확인했다.

```python
from sklearn.metrics import roc_auc_score, roc_curve

s = [0.9,0.8,0.7,0.4,0.3, 0.6,0.5,0.35,0.2,0.1,0.1,0.15,0.2,0.05,0.1,0.3,0.25,0.1,0.05,0.02]
print(roc_auc_score(y_true, s))   # 0.9266...
fpr, tpr, th = roc_curve(y_true, s)
```

임계값이 0.9, 0.7, 0.5 …로 내려갈 때 (FPR, TPR)이 (0, 0.2) → (0, 0.6) → (0.133, 0.6) → … → (1, 1)로 이동하고, 그 넓이가 0.927이다. 임계값을 낮출수록 양성을 많이 잡아 TPR이 오르지만 FPR도 같이 오른다.

<details>
<summary>임계값을 바꾸면 혼동행렬이 어떻게 변하나</summary>

위 점수에서 임계값을 0.5로 잡으면 점수가 0.5 이상인 것을 양성으로 본다. 이 값 이상인 것은 실제 양성 3개(0.9, 0.8, 0.7)와 실제 음성 2개(0.6, 0.5)라서 TP 3, FP 2가 되고, 앞의 혼동행렬과 같은 결과가 된다. 임계값을 0.3으로 내리면 실제 양성 5개를 다 잡지만(TPR 1.0) 실제 음성도 4개가 양성으로 넘어와 FPR이 약 0.27이 된다. roc_curve가 돌려준 표에서 임계값 0.5 줄이 (0.133, 0.6), 0.3 줄이 (0.267, 1.0)이다.

임계값을 정하는 일은 결국 위 표의 "어떤 지표를 볼까"와 같은 질문이다. 놓치면 안 되면 낮추고, 잘못 잡으면 안 되면 올린다.
</details>

## 회귀 모형 평가

예측 값이 숫자인 회귀는 오차를 센다. 실제 값을 y, 예측 값을 ŷ, 표본 수를 n이라 하면 다음과 같다.

| 지표 | 공식 | 특징 |
|---|---|---|
| MSE | (1/n) Σ (y − ŷ)² | 큰 오차에 크게 벌점 |
| RMSE | √MSE | 원래 단위로 돌아와 해석이 쉽다 |
| MAE | (1/n) Σ \|y − ŷ\| | 이상값 영향이 상대적으로 작다 |
| MAPE | (100/n) Σ \|y − ŷ\| / \|y\| | 퍼센트 오차, 실제 값이 0이면 못 쓴다 |
| R² | 1 − Σ(y − ŷ)² / Σ(y − ȳ)² | 평균으로 찍는 것보다 얼마나 나은가 |

네 개짜리 작은 예로 계산했다.

```python
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

yt = np.array([3, 5, 2.5, 7]); yp = np.array([2.5, 5, 4, 8])
mse = mean_squared_error(yt, yp)
print(mse, mse**0.5, mean_absolute_error(yt, yp), r2_score(yt, yp))
# 0.875 0.935... 0.75 0.724...
```

오차가 −0.5, 0, 1.5, 1이라 제곱 평균이 0.875, 절댓값 평균이 0.75다. 시험에서는 오차 값이 주어지고 MSE·RMSE·MAE를 손으로 구하라는 형태가 자주 나온다.

R²는 1에 가까울수록 설명을 잘 한다. 변수를 추가하면 R²는 오르기만 하는 성질이 있어서, 변수 개수가 다른 모형을 비교할 때는 수정 결정계수를 같이 본다. scikit-learn 문서에 따르면 R²는 회귀 모형의 기본 `score`이고, 제곱오차와 같은 순위를 준다.

## 하이퍼파라미터 튜닝

모형 평가는 튜닝과 이어진다. 의사결정나무의 깊이처럼 학습 전에 사람이 정해 주는 값이 하이퍼파라미터이고, 후보를 돌려 가며 교차검증 점수가 가장 좋은 값을 고르는 일이 튜닝이다. 데이터 분할과 교차검증 쪽은 [자세히 → 분석 모형 설계](#/post/bd-model-design)에서 다룬다.

- 그리드 서치: 후보 조합을 전부 시도한다. scikit-learn의 `GridSearchCV`다.
- 랜덤 서치: 후보 분포에서 정해진 횟수만큼 뽑아 시도한다. `RandomizedSearchCV`다. 문서는 시도 횟수를 파라미터 수와 따로 정할 수 있다는 점을 장점으로 든다.

직접 돌려 본 것이다. 유방암 데이터에서 나무 깊이와 잎 최소 표본 수를 5겹 교차검증, F1 기준으로 골랐다.

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import f1_score, confusion_matrix

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

g = GridSearchCV(DecisionTreeClassifier(random_state=42),
                 {'max_depth': [2,3,4,5], 'min_samples_leaf': [1,5,10]},
                 cv=5, scoring='f1')
g.fit(Xtr, ytr)
print(g.best_params_, round(g.best_score_, 4))
p = g.predict(Xte)
print(round(f1_score(yte, p), 4), confusion_matrix(yte, p).tolist())
```

```
{'max_depth': 4, 'min_samples_leaf': 1} 0.9514
0.951 [[39, 3], [4, 68]]
```

최적은 깊이 4, 잎 최소 1이었다. 교차검증 F1이 0.9514, 따로 떼어 둔 시험 데이터 F1이 0.951로 비슷하게 나왔다. 이 비슷함이 중요하다. scikit-learn 문서도 튜닝에 쓴 데이터로 최종 성능을 보고하지 말고, 개발용 데이터로 튜닝한 뒤 평가용 데이터로 한 번만 재라고 권한다.

<details>
<summary>교차검증 점수를 보는 법</summary>

교차검증은 훈련 데이터를 k조각으로 나눠 한 조각씩 검증용으로 돌려 가며 k번 점수를 낸다. 깊이 3인 나무를 정확도로 5겹 돌리면 이렇게 나왔다.

```python
from sklearn.model_selection import cross_val_score
print(cross_val_score(DecisionTreeClassifier(max_depth=3, random_state=42), Xtr, ytr, cv=5).round(3))
# [0.934 0.923 0.901 0.901 0.967]
```

조각마다 0.90에서 0.97까지 흔들린다. 평균만 보지 말고 흔들림이 큰지도 같이 봐야 한다. 점수 차가 크면 데이터가 적거나 모형이 불안정하다는 신호로 읽는다.
</details>

## 흔한 오해

- 정확도가 높으면 좋은 모형이라는 생각. 위 예처럼 전부 음성이라고 해도 0.75가 나온다.
- 정밀도와 재현율의 분모를 바꿔 외우는 것. 정밀도는 예측 양성, 재현율은 실제 양성이다.
- AUC 0.5가 "50점"이라는 해석. 무작위로 찍는 수준이라는 뜻이다.
- 튜닝에 쓴 데이터로 최종 성능을 말하는 것. 점수가 부풀려진다.
- 회귀에서 MAPE를 아무 데나 쓰는 것. 실제 값이 0이면 계산이 안 된다.

## 시험에서 보는 순서

1. 혼동행렬이 나오면 행·열이 실제인지 예측인지부터 본다.
2. TP·FP·FN·TN을 정하고 요구한 지표의 분모를 쓴다.
3. 불균형이 보이면 정확도 말고 재현율·F1을 고른다.
4. ROC는 왼쪽 위로 붙을수록 좋고 AUC는 0.5가 무작위다.
5. 회귀는 오차를 먼저 적고 MSE → RMSE 순서로 계산한다.

기출 문제는 해마다 달라서 원문은 싣지 않았다. 시험 일정과 응시 관련 사항은 공식 사이트에서 확인하면 된다. 실기에서 이 지표들을 코드로 한 번에 뽑는 흐름은 [자세히 → 실기 파이썬 요점](#/post/bd-practical-python)에 이어서 정리했고, 모델 쪽 배경은 [자세히 → 지도학습 모형](#/post/bd-supervised)에 있다.

## 근거 링크

- scikit-learn, Metrics and scoring: https://scikit-learn.org/stable/modules/model_evaluation.html
- scikit-learn, Tuning the hyper-parameters of an estimator: https://scikit-learn.org/stable/modules/grid_search.html

← [개념 지도로](#/post/bd-map)

관련 글: [분석 모형 설계](#/post/bd-model-design) · [지도학습 모형](#/post/bd-supervised) · [실기 파이썬 요점](#/post/bd-practical-python)
