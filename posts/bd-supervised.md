지도학습은 정답(레이블)이 붙은 데이터로 모형을 학습시키는 방식이다. 정답이 숫자면 회귀, 범주면 분류다. 빅데이터분석기사에서는 모형 이름을 보고 특징을 바로 떠올리는 문제와, 코드를 돌려 결과를 해석하는 실기 문제가 나온다. 시험 일정과 응시료는 공식 사이트에서 확인한다. 데이터를 나누고 검증하는 쪽은 [자세히 → 분석 모형 설계](#/post/bd-model-design)에 있고, 이 글은 모형 자체만 다룬다.

## 한눈에 보는 모형 표

| 모형 | 한 줄 특징 | 시험에서 묻는 것 |
|---|---|---|
| 선형·다중 회귀 | 직선(평면)을 맞춰 숫자를 예측 | 가정, 다중공선성, 결정계수 |
| 로지스틱 회귀 | 확률을 0~1로 바꿔 분류 | 오즈, 시그모이드, 계수 해석 |
| 의사결정나무 | 질문을 이어 가며 데이터를 나눔 | 불순도(지니·엔트로피), 가지치기 |
| SVM | 두 집단 사이 간격(마진)이 가장 넓은 경계 | 서포트 벡터, 커널, C·gamma |
| 앙상블 | 모형 여러 개를 합침 | 배깅·부스팅 차이, 랜덤 포레스트 |
| 신경망 | 은닉층을 쌓아 비선형을 학습 | 활성화 함수, 역전파, 과적합 |

회귀는 [자세히 → 탐색적 분석과 기초 통계](#/post/bd-eda-stats)의 상관·회귀와 이어지니 가정과 해석은 거기서 먼저 잡는 편이 낫다.

## 로지스틱 회귀

이름은 회귀인데 분류 모형이다. 선형식 값을 시그모이드 함수에 넣어 0~1 사이 확률로 바꾸고, 보통 0.5를 기준으로 클래스를 정한다. scikit-learn 문서는 이진 분류에서 확률을 1 / (1 + exp(-(Xw + w0)))로 쓰고, 로그 손실에 규제 항을 더해 최소화한다고 설명한다. 여러 클래스일 때는 클래스마다 가중치를 두고 softmax로 확률을 만든다.

규제 세기는 C로 조절하는데, C는 규제 강도의 역수라서 클수록 규제가 약하다. 기출에서 "계수를 0으로 만드는 규제가 뭐냐"를 물으면 라쏘(L1)다. 릿지(L2)는 계수를 줄이기만 하고 0으로 만들지는 않는다. 라쏘가 변수 선택 효과를 내는 이유는 [자세히 → 변수 선택과 차원 축소](#/post/bd-feature-select)에서 이어진다.

## 의사결정나무

각 노드에서 "어느 변수를 어느 기준값으로 나눌 때 자식 노드가 가장 깨끗해지나"를 찾는다. 깨끗한 정도를 재는 값이 불순도이고, 분류에서는 지니 지수와 엔트로피를 쓴다. 한 단계씩 가장 좋은 분할만 고르는 탐욕적 방식이라 전체 최적 트리를 보장하지는 않는다.

장점은 해석이 쉽고 스케일링이 거의 필요 없다는 점이다. 단점은 두 가지로 외우면 된다. 제한 없이 키우면 학습 데이터에 과적합하고, 데이터가 조금 바뀌면 나무 모양이 크게 달라진다. 과적합은 가지치기로 막는다. 미리 멈추는 사전 가지치기(최대 깊이, 잎 최소 표본 수)와 다 키운 뒤 자르는 사후 가지치기(비용 복잡도, ccp_alpha)가 있다.

## SVM

두 클래스를 가르는 경계 중 양쪽 간격이 가장 넓은 것을 고른다. 경계 결정에 쓰이는 건 경계에 가까운 일부 점이고, 이게 서포트 벡터다. 직선으로 안 갈리면 커널로 공간을 바꿔 푼다. 선형, 다항, RBF, 시그모이드 커널이 있다.

- C: 경계를 어긴 점에 주는 벌점. 작으면 경계가 부드럽고, 크면 학습 데이터를 다 맞히려 든다.
- gamma: 점 하나의 영향 범위. 크면 가까운 점만 영향을 줘서 과적합하기 쉽다.

SVM은 변수 크기에 민감해서 스케일링이 사실상 필수다. 실기에서 SVM 점수가 이상하게 낮으면 스케일링부터 의심한다. 직접 돌려 본 결과는 아래 실습에 있다.

## 앙상블

약한 모형 여러 개를 합쳐 한 모형보다 낫게 만든다. 배깅과 부스팅이 갈리는 지점이 자주 나온다.

| | 배깅 · 랜덤 포레스트 | 부스팅 |
|---|---|---|
| 만드는 순서 | 병렬(서로 독립) | 순차(앞 모형의 실수를 보완) |
| 주로 줄이는 것 | 분산 | 편향 |
| 개별 모형 | 깊게 키운 나무 | 얕은 나무 |
| 예 | Random Forest | AdaBoost, Gradient Boosting |

랜덤 포레스트는 나무마다 부트스트랩 표본을 쓰고, 분할할 때 변수 일부만 무작위로 후보에 올린다. 나무끼리 오차가 덜 닮게 되어 평균을 내면 오차가 상쇄된다. AdaBoost는 틀린 표본의 가중치를 올려 다음 모형이 어려운 표본에 집중하게 하고, Gradient Boosting는 현재 예측의 손실 기울기를 다음 나무가 맞추게 한다. 학습률(learning_rate)로 한 걸음 크기를 줄여 과적합을 누른다.

## 신경망

입력층과 출력층 사이에 은닉층을 두고, 각 뉴런이 입력의 가중합에 활성화 함수를 거쳐 다음 층으로 넘긴다. 활성화 함수 덕분에 비선형 관계를 배울 수 있다. 출력층은 이진 분류면 로지스틱, 다중 분류면 softmax, 회귀면 항등 함수를 쓴다. 학습은 출력에서 구한 오차를 거꾸로 전파해 가중치를 고치는 역전파로 한다. 초기값에 따라 결과가 달라지고, 스케일링에 민감하며, 층과 뉴런 수를 정해야 하는 게 단점이다.

## 직접 돌려 본 비교

유방암 진단 데이터(scikit-learn 내장, 표본 569개 변수 30개)를 7:3으로 나누고 모형별 정확도를 쟀다. 환경은 scikit-learn 1.9.1이다. 잠깐 보는 용도라 교차검증은 하지 않았고, 데이터를 다시 나누면 숫자는 조금 달라진다.

<details>
<summary>코드 열기</summary>

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

| 모형 | 학습 정확도 | 테스트 정확도 |
|---|---|---|
| 로지스틱(스케일링) | 0.987 | 0.988 |
| 나무, 깊이 제한 없음 | 1.000 | 0.918 |
| 나무, max_depth=3 | 0.980 | 0.924 |
| SVM, 스케일링 안 함 | 0.920 | 0.906 |
| SVM, 스케일링 함 | 0.982 | 0.977 |
| 랜덤 포레스트 | 1.000 | 0.936 |
| 그래디언트 부스팅 | 1.000 | 0.942 |
| 신경망(MLP) | 0.997 | 0.982 |

읽을 곳은 세 군데다. 제한 없는 나무는 학습 1.000에 테스트 0.918로 격차가 커서 과적합 모양이고, 깊이를 3으로 막으면 학습은 내려가고 테스트는 조금 오른다. SVM은 스케일링 하나로 테스트가 0.906에서 0.977이 됐다. 로지스틱은 C를 0.01, 1, 100으로 바꿔 보니 계수 절댓값 합이 3.82, 15.81, 107.23으로 커졌고 테스트 정확도는 0.942, 0.988, 0.953이었다. 규제가 강할수록 계수가 줄어든다는 말이 숫자로 보인다. 이 데이터에서는 단순한 로지스틱이 가장 높았는데, 복잡한 모형이 항상 낫다는 보장이 없다는 예로 보면 된다.

## 자주 나오는 유형

- 과적합 진단: 학습 점수는 높고 테스트 점수가 낮으면 과적합이다. 나무는 가지치기, SVM은 C·gamma 조정, 신경망은 규제나 층 줄이기로 답한다.
- 모형 고르기: 해석이 중요하면 로지스틱·나무, 정확도가 우선이면 앙상블·SVM·신경망 쪽으로 답한다.
- 배깅 대 부스팅: 병렬이냐 순차냐, 분산을 줄이냐 편향을 줄이냐 두 축으로 구분한다.
- 스케일링이 필요한 모형: SVM, 신경망은 필요하고 나무 계열은 거의 필요 없다.

기출 원문은 옮기지 않았다. 문제를 보면 이 네 유형 중 어디에 들어가는지 먼저 분류한다. 점수를 어떻게 읽는지는 [자세히 → 모형 평가](#/post/bd-evaluation)에, 실기용 코드 흐름은 [자세히 → 실기 파이썬 요점](#/post/bd-practical-python)에 정리한다.

## 흔한 오해

- 로지스틱 회귀는 회귀 문제용이다: 출력이 확률이고 쓰임은 분류다.
- 정확도가 100%에 가까우면 좋은 모형이다: 학습 데이터 기준이면 오히려 과적합 신호다.
- 랜덤 포레스트도 부스팅처럼 앞 모형을 보완한다: 포레스트는 나무를 서로 독립적으로 만든다.
- 신경망은 스케일링 없이도 된다: 문서가 스케일링을 강하게 권한다.

## 근거 링크

- scikit-learn, Decision Trees: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn, Support Vector Machines: https://scikit-learn.org/stable/modules/svm.html
- scikit-learn, Ensembles: https://scikit-learn.org/stable/modules/ensemble.html
- scikit-learn, Linear Models (로지스틱·릿지·라쏘): https://scikit-learn.org/stable/modules/linear_model.html
- scikit-learn, Neural network models (supervised): https://scikit-learn.org/stable/modules/neural_networks_supervised.html

← 개념 map으로 ([빅데이터분석기사 map](#/post/bd-map))

관련 글: [분석 모형 설계](#/post/bd-model-design) · [비지도학습 모형](#/post/bd-unsupervised) · [모형 평가](#/post/bd-evaluation)
