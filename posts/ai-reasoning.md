추론 모델은 답을 내기 전에 혼자 생각하는 글(생각 토큰)을 먼저 쓰는 모델이고, 그 글이 화면에 안 보여도 출력 토큰 요금과 대기 시간으로 그대로 돌아온다.

## 먼저 쉬운 말로

수학 문제를 암산으로 바로 답하는 사람이 있고, 종이에 풀이를 쓰면서 푸는 사람이 있다. 일반 LLM은 앞의 쪽에 가깝고, 추론 모델은 뒤의 쪽이다. 질문을 받으면 답 앞에 "생각"을 길게 적고, 그걸 바탕으로 최종 답을 쓴다. 이 풀이 부분이 생각 토큰(thinking tokens, OpenAI 쪽 용어로는 reasoning tokens)이다.

[LLM](#/post/ai-llm)은 원래 다음 토큰을 하나씩 이어 쓰는 방식이라, 답에 도달하기까지 쓸 수 있는 글의 양이 곧 "계산할 수 있는 양"이 된다. 중간 풀이를 쓰게 하면 어려운 문제를 더 잘 푼다. 이걸 모델 안에 아예 넣은 게 추론 모델이다.

## 원리: 생각을 쓰게 하면 왜 나아지나

뿌리가 되는 논문은 Wei 등의 2022년 chain-of-thought 논문이다. 예시에 중간 추론 단계를 같이 보여 주면 모델이 그걸 따라 하고, 충분히 큰 모델에서 산술·상식·기호 추론 성능이 올랐다. 초록 기준으로 540B 모델에 예시 8개만 줘도 GSM8K(초등 수학 문장제)에서 당시 최고 수준을 냈다고 한다. 여기서는 사람이 프롬프트에 풀이 예시를 넣었다.

추론 모델은 이 풀이를 프롬프트가 아니라 모델이 알아서 하게 만든 쪽이다. 다만 내부를 어떻게 학습했는지는 이번에 읽은 문서들에 나오지 않아서 확인 못 했다. 내가 확인한 건 API에서 어떻게 보이고 어떻게 과금되는지까지다.

## API에서 보이는 모습

Anthropic과 OpenAI 문서가 말하는 공통점은 이렇다.

| | Claude(thinking) | OpenAI(reasoning) |
|---|---|---|
| 이름 | 생각 블록, thinking tokens | reasoning tokens |
| 보이는지 | 요약본이 오거나 생략(omitted) 가능 | API로는 안 보임 |
| 과금 | 출력 토큰 | 출력 토큰 |
| 창 차지 | 한다(`max_tokens`에 포함) | 한다 |
| 깊이 조절 | effort(low~max) | reasoning.effort(none~max 등, 모델별) |

Anthropic 문서에서 눈에 띈 건 과금 쪽이다. 화면에 오는 건 요약된 생각인데, 요금은 요약본이 아니라 실제로 모델이 만든 전체 생각 토큰 기준으로 나간다. 문서 표현으로는 청구되는 출력 토큰 수와 응답에서 보이는 토큰 수가 일치하지 않는다. `display`를 `omitted`로 해서 아예 안 받아도 청구는 같다. 얼마나 썼는지는 응답의 `usage.output_tokens_details.thinking_tokens`로 볼 수 있다.

OpenAI 문서도 비슷하다. 추론 토큰은 API로 보이지 않지만 컨텍스트 창을 쓰고 출력 토큰으로 과금된다. 그리고 처음 시작할 때 추론과 출력을 위해 최소 25,000 토큰 정도를 남겨 두라고 권한다. 이 숫자 때문에 창이 꽉 차면 답이 하나도 안 나온 채 `incomplete`로 끝날 수 있다고 한다.

[컨텍스트 윈도우](#/post/ai-context-window) 관점에서 보면 생각 토큰은 내가 쓴 글이 아닌데도 자리를 먹는 입력·출력이다.

## 비용·지연: 왜 신경 써야 하나

생각 토큰이 곧 출력 토큰이라서 두 가지가 같이 늘어난다.

- 돈: 출력 토큰은 보통 입력 토큰보다 단가가 높다(단가는 모델마다 달라서 숫자는 적지 않는다). 질문은 한 줄인데 생각이 수천 토큰이면 요금은 생각 쪽이 지배한다. 기능 단위 원가는 [AI 서비스 원가](#/post/app-cost)에서 따로 다룬다.
- 시간: 답의 첫 글자가 나오기 전에 생각을 먼저 쓰니 체감 대기가 길다. 스트리밍으로 받아도 생각 구간이 지나야 본문이 나온다.

그래서 깊이를 조절하는 손잡이가 있다.

## 깊이 조절: budget에서 effort로

Anthropic 문서가 보여 주는 변화가 재밌었다. 예전 방식(extended thinking)은 `budget_tokens`로 생각 예산을 직접 정했다. 최소 1,024 토큰이고 `max_tokens`보다 작아야 하며, 목표치일 뿐 엄격한 상한은 아니다. 그런데 이 방식은 지금 deprecated로 표시돼 있고, 문서 기준으로 Claude 4.7 이후 모델은 이 방식을 아예 거절(400 오류)한다.

대신 쓰는 게 적응형(adaptive) 생각이다. 모델이 요청마다 생각할지 말지, 얼마나 할지를 스스로 정하고, 나는 `effort`(low, medium, high, xhigh, max)로 성향만 잡는다. 문서에서 읽은 특징을 추리면 이렇다.

- 쉬운 질문은 생각 없이 바로 답할 수 있다. 그래서 "모든 턴에 생각 블록이 있다"고 가정하는 코드를 짜면 안 된다.
- 비용 상한은 `max_tokens`가 맡는다. 생각과 답을 합친 총량의 하드 캡이다. 생각이 길어져 이게 먼저 차면 답이 잘리니, 생각 없는 답 기준으로 잡은 값은 너무 작을 수 있다.
- 생각을 줄이고 싶으면 프롬프트로 "덜 생각해"라고 하기 전에 effort를 낮추라는 게 문서 권고다. 일부 모델은 프롬프트로는 잘 안 줄어든다고도 적혀 있다.
- effort를 중간에 바꾸면 프롬프트 캐시가 깨진다. 한 대화 안에서는 값을 고정하는 게 낫다. [프롬프트 캐싱](#/post/ai-prompt-caching)과 얽히는 부분이다.

기본 effort는 모델마다 달라서(문서에는 어떤 모델은 high, 어떤 모델은 medium) 쓸 때 문서의 모델별 표를 봐야 한다.

## 그럼 언제 쓰나

OpenAI 문서는 복잡한 문제 풀이, 코딩, 과학적 추론, 여러 단계의 에이전트 작업에 추론 모델을 권한다. [에이전트 루프](#/post/ai-agent-loop)에서는 도구 결과를 받을 때마다 다음 행동을 생각하는 쪽이 유리하고, Anthropic 문서도 도구 호출 사이에 생각이 끼어드는(interleaved) 동작을 설명한다. 반대로 문장 다듬기, 분류, 단순 추출처럼 답이 바로 나오는 일은 생각이 필요 없다. 이건 문서가 직접 비교한 문장이 아니라 위 내용을 보고 내가 정리한 기준이다.

## 흔한 오해

- 추론 모델은 환각이 없다: 생각을 한다고 [환각](#/post/ai-hallucination)이 사라진다는 근거는 이번에 읽은 문서에 없었다. 확인 못 했다.
- 보이는 요약이 실제 생각 전부다: 요약본이다. 요금도 요약이 아니라 전체 기준이다.
- 오래 생각할수록 항상 좋다: 문서는 예산이 커질수록 수익이 체감된다고 적는다(Anthropic, 작업에 따라 다름). 지연과 비용은 확실히 늘어난다.
- 생각 토큰은 공짜 부가 기능이다: 출력 토큰으로 과금된다.
- [샘플링](#/post/ai-sampling) 설정(temperature 등)이 그대로 먹힌다: 이번 조사에서는 확인하지 않았다. 모델별 제한이 있을 수 있어 문서를 봐야 한다.

<details>
<summary>자세한 풀이: Anthropic 과금 구조</summary>

문서 기준으로 생각을 쓰면 세 가지가 청구된다.

1. 생각하는 동안 쓴 토큰(출력 토큰으로 청구).
2. 이전 턴의 생각 블록 중 컨텍스트에 남아 있는 것(입력 토큰으로 청구). 모델에 따라 모든 턴을 남기기도 하고 마지막 턴만 남기기도 한다.
3. 일반 답변 출력 토큰.

생각 요약을 만드는 비용은 따로 청구하지 않는다고 한다. `output_tokens`가 청구 기준의 총합이고 `thinking_tokens`는 그 안의 내역(읽기 전용)이다. 예시 응답에서는 `output_tokens` 348 중 `thinking_tokens`가 312였다. 문서의 예시 숫자일 뿐 평균이 아니다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: Claude의 생각 토큰 과금, budget_tokens 규칙(최소 1,024, max_tokens 미만, 목표치), deprecated 상태와 adaptive·effort 전환, 캐시 무효화(Anthropic 문서). OpenAI의 추론 토큰 비가시·출력 과금·25,000 토큰 권장·effort 값(OpenAI 문서). chain-of-thought 논문의 초록.

확인 못 함: 추론 모델의 내부 학습 방식, 추론 모델과 환각의 관계, 추론 모델에서 샘플링 설정이 어떻게 되는지, 모델별 구체적 단가와 지연 수치, 문서를 나눠 읽은 뒤 바뀌었을 수 있는 모델 목록(문서는 자주 바뀐다).

</details>

## 근거 링크

- Anthropic 문서, Extended thinking: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- Anthropic 문서, Steering thinking(effort, 과금): https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
- OpenAI 문서, Reasoning: https://developers.openai.com/api/docs/guides/reasoning
- Wei et al., Chain-of-Thought Prompting Elicits Reasoning in LLMs(초록): https://arxiv.org/abs/2201.11903

← 개념 지도로 (#/post/ai-map)

관련 글: [프롬프트 캐싱](#/post/ai-prompt-caching) · [에이전트 루프](#/post/ai-agent-loop) · [AI 서비스 원가](#/post/app-cost)
