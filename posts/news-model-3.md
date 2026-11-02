모델이 새로 나오면 발표 글에는 늘 점수표가 붙는다. SWE-bench, HLE, OSWorld 같은 이름이 줄줄이 나오고 어느 모델이 몇 점인지 비교한다. 그런데 올가을에는 점수보다 점수표 쪽이 뉴스였다. Epoch AI가 벤치마크 자체를 감사하는 'Benchmark Reviews'를 내놓았고, 이미 널리 쓰이는 시험지 여럿이 "Flawed(결함 있음)" 판정을 받았다. 아래 내용은 2026년 11월 2일에 Epoch 페이지를 열어 확인한 것이다.

## 무슨 프로젝트인가

Benchmark Reviews는 벤치마크 하나하나를 검토해서 판정을 붙이는 목록이다. 판정은 세 가지다.

| 판정 | 뜻 |
|---|---|
| Verified | 검토했고 큰 문제를 못 찾음 |
| Flawed | 점수에 영향을 주는 오류가 충분히 큼 |
| Not enough info | 공개된 정보가 부족해서 판단 못 함 |

Flawed의 기준은 채점 오류가 점수의 20% 이상에 영향을 주는 경우다. Epoch는 자기들이 만든 벤치마크는 이해 충돌 때문에 검토하지 않는다고 적어 두었다. 검토 우선순위는 영향도, 많이 인용되는 정도, 아직 안 다뤄진 능력인지 하는 세 가지다.

## 지금까지 목록

확인한 시점(2026-11-02) 기준으로 24개가 올라와 있고, 첫 리뷰는 8월 10일 자였다. 이 중 널리 아는 이름만 추리면 이렇다.

| 벤치마크 | 판정 | 리뷰 날짜 |
|---|---|---|
| Humanity's Last Exam | Flawed | 8월 11일 |
| SWE-bench Verified | Flawed | 9월 3일 |
| SWE-Bench Pro | Flawed | 9월 1일 |
| Terminal-Bench 4.0.0 | Flawed | 9월 4일 |
| Berkeley Function Calling Leaderboard v4 | Flawed | 9월 10일 |
| SimpleQA Verified | Verified | 9월 10일 |
| OSWorld 2.1 | Flawed | 9월 28일 |
| GraphWalks | Verified | 9월 29일 |

전체로 보면 Flawed가 많고 Verified는 소수, 나머지는 정보 부족이다. 정보 부족은 공개된 자료가 모자라서 판단을 보류한 경우다.

## 시험지가 틀렸다는 게 어떤 모습인가

세 개를 열어 봤다. 오류의 종류가 서로 달라서 같이 보면 이해가 쉽다.

HLE는 문제 48개를 무작위로 뽑아 사람이 직접 확인했다. 22개(46%)에서 점수를 바꿀 만한 오류가 나왔다. 12개는 문제 자체가 성립하지 않았고, 예를 들어 "4-point DFT"를 물었는데 주어진 수열이 8개였다. 나머지는 정답 키가 틀려서 맞는 답이 오답 처리되거나 틀린 답이 정답 처리될 수 있는 문제였다. 표본이 48개라서 어느 모델 순위가 바뀌는지까지는 리뷰가 추정하지 않았다.

SWE-bench Verified는 Epoch가 직접 표본을 뽑지 않았다. 2월에 OpenAI가 낸 감사 결과를 근거로 삼았다. 그 감사는 전체의 27.6%를 살펴봤고, 그중 59.4%에서 기능상 맞는 풀이를 떨어뜨리는 테스트가 있었다. 곱하면 전체의 최소 16.4%가 깨진 셈이다. 여기에 오염 문제가 붙는다. 9월 3일 시점에 문제와 정답이 100% 공개 상태이고, OpenAI는 테스트한 최전선 모델이 모두 일부 문제와 풀이를 학습 중에 본 것으로 결론 냈다. 그래서 Epoch는 "측정하려던 능력을 더 이상 재지 못한다"는 쪽으로 판정했다.

OSWorld 2.1은 컴퓨터 조작 과제 108개 중 50개를 골라 봤다. 36개 과제에서 오류 40건이 나왔다. 유형은 세 가지로 갈린다.

- 불가능한 과제: 6개월 약정이 설정 화면에 없는데 채점기는 그걸 기대함
- 거짓 양성: 문서 130개를 전부 올리면 선택 과정 없이 만점
- 거짓 음성: 답이 "Salesforce License renewal"인데 키가 "Salesforce License"라서 0점

감사한 범위의 만점 기준으로 영향이 최대 50.4%라고 적었고, 이는 측정된 손실이 아니라 상한이라고 못 박았다. 이 벤치마크에서 GPT-6 Astra 한 모델은 잘못된 채점 때문에 영향받은 과제에서 점수의 약 20.8%를 잃은 것으로 계산됐다.

<details>
<summary>거짓 양성과 거짓 음성, 한 번에 정리</summary>

채점기가 하는 일은 "이 답이 맞나"를 판정하는 것이라서 틀리는 방향이 두 가지다.

- 거짓 음성(false negative): 맞는 답을 틀렸다고 함. 모델 점수가 실제보다 낮게 나온다. SWE-bench의 깐깐한 테스트, OSWorld의 문자열 불일치가 여기에 해당한다.
- 거짓 양성(false positive): 틀린 답이나 편법을 맞다고 함. 점수가 실제보다 높게 나온다. OSWorld의 문서 전부 올리기, SWE-bench에서 보고된 만점 편법이 여기에 해당한다.
- 불가능 문제: 조건이 모순이거나 빠져 있어서 누구도 맞힐 수 없음. 점수 상한이 100%보다 낮아진다.

두 방향이 섞이면 서로 상쇄되어 괜찮아 보일 수도 있지만, 어느 모델이 어느 쪽 오류를 더 타는지가 다르기 때문에 순위가 흔들릴 수 있다.

</details>

## 리뷰 방식에서 눈에 띈 점

HLE와 OSWorld 리뷰 모두 AI를 먼저 돌려서 의심스러운 문제를 걸러 내고, 사람이 하나씩 확인해서 확정하는 순서였다. OSWorld에서는 과제마다 하위 에이전트를 하나씩 붙여서 훑었다고 적혀 있다. 에이전트가 후보를 뽑고 사람이 확정하는 구조는 [서브에이전트](#/post/ai-subagent) 글에서 정리한 병렬 작업 방식과 닮았다. 다만 증거 기준을 못 넘긴 지적은 버렸다고 한다.

또 하나는 리뷰가 부분 검토라는 점이다. Flawed 기준을 넘는 순간 검토를 멈춘다. 그래서 Flawed 판정을 받은 벤치마크는 그 이후 항목(평가 환경 편향 등)이 평가되지 않은 채로 남는다. HLE와 SWE-bench 페이지 모두 개발자 응답이 아직 링크되어 있지 않았다.

## 점수표를 볼 때 달라지는 것

모델 발표의 비교표를 볼 때 이제 벤치마크 이름 옆에 Epoch 판정이 있는지 한 번 보게 된다. Flawed가 붙었다고 점수가 의미 없는 것은 아니다. 20%라는 선은 Epoch가 정한 기준이고, 같은 오류가 모든 모델에 비슷하게 작용하면 순위는 대체로 유지될 수도 있다. 다만 "몇 점 올랐다"는 차이가 작을 때는 시험지 오류 범위 안일 수 있다.

[LLM 앱 평가](#/post/app-eval)에서 다루는 골든셋과 채점기 점검도 같은 이야기다. 공개 벤치마크를 믿기 어려워질수록, 내 앱에서 직접 돌리는 작은 평가셋이 더 쓸모 있어진다. 모델 선택 자체는 [AI 모델 지도](#/post/ai-models)에서 계열별로 볼 수 있다.

## 근거 링크

- Epoch AI, Benchmark Reviews 목록과 문서: https://epoch.ai/data/benchmark-reviews-documentation/included-benchmarks
- Epoch AI, Humanity's Last Exam 리뷰: https://epoch.ai/benchmarks/hle/review
- Epoch AI, SWE-bench Verified 리뷰: https://epoch.ai/benchmarks/swe-bench-verified/review
- Epoch AI, OSWorld 2.1 리뷰: https://epoch.ai/benchmarks/osworld-2-1/review
- Epoch AI, FrontierMath Tiers 1-3 (v2): https://epoch.ai/benchmarks/frontiermath-tiers-1-3-v2

← 개념 지도로 (#/post/ai-map)

관련 글: [AI 모델 지도](#/post/ai-models) · [LLM 앱 평가](#/post/app-eval) · [할루시네이션](#/post/ai-hallucination)
