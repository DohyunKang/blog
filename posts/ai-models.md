모델 이름은 석 달이면 바뀌니까 외우는 건 소용없고, 회사·크기·열린 모델인지 닫힌 모델인지로 나눠 두면 새 이름이 나와도 자리를 찾을 수 있었다. 아래 이름·가격·수치는 2026-11-02에 각 회사 공식 페이지에서 읽은 것만 적었다.

## 모델이 뭔지부터

여기서 모델은 [LLM](#/post/ai-llm)처럼 글을 읽고 쓰는 큰 신경망 하나를 말한다. 같은 회사 안에서도 크기가 다른 모델을 여러 개 낸다. 큰 모델은 어려운 일을 잘하지만 느리고 비싸고, 작은 모델은 빠르고 싸지만 어려운 일에서 밀린다. 그래서 "어느 회사가 제일 좋냐"보다 "내 일에 어느 크기가 맞냐"가 먼저인 경우가 많았다.

## 회사별로 지금 뭐가 있나

공식 모델 페이지에서 읽은 것을 표로 묶었다. 가격은 100만 토큰(MTok)당 입력/출력 달러다.

| 회사 | 모델(API 이름) | 가격 입력/출력 | 컨텍스트 | 비고 |
|---|---|---|---|---|
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`) | $10 / $50 | 1M | 가장 어려운 추론·긴 에이전트 작업용, 상대적으로 느림 |
| Anthropic | Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | 1M | 대부분 일의 시작점으로 문서가 권함 |
| Anthropic | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | 1M | 속도와 성능의 균형 |
| Anthropic | Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10~ / $0.50~ | 1M | 가장 빠르고 쌈, 분류·추출용 |
| OpenAI | GPT-6 Astra (`gpt-6-astra`) | $10 / $50 | 1.05M | 어려운 추론·코딩 |
| OpenAI | GPT-6.1 Sol (`gpt-6.1-sol`) | $2 / $10 | 1.05M | Astra에 가까운 성능, 낮은 가격 |
| OpenAI | GPT-6.1 Terra (`gpt-6.1-terra`) | $1 / $5 | 1.05M | 빠르고 효율적, 컴퓨터 사용·글쓰기 |
| OpenAI | GPT-6 Luna (`gpt-6-luna`) | $0.10 / $0.50 | 1.05M | 단순·대량 작업 |
| Google | Gemini 4 Argon (`gemini-4-argon`) | $2 / $10 (11/30까지, 12/1부터 $4 / $20) | 1M | 대표 추론 모델 |
| Google | Gemini 3.8 Flash (`gemini-3.8-flash`) | $0.75 / $3.75 (12/31까지, 이후 $1.5 / $7.5) | - | 긴 코딩·에이전트용 Flash |
| Google | Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | $0.30 / $2.50 | - | 3.5 중 가장 싸고 빠름 |
| DeepSeek | deepseek-v4-pro | $0.66 / $1.98 (비피크 기준, 캐시 미스) | 1M | 출력 최대 384K |
| DeepSeek | deepseek-flash | $0.15 / $0.6 (비피크 기준, 캐시 미스) | 1M | 출력 최대 384K |

읽다가 눈에 띈 것이 몇 개 있다.

- 세 회사(Anthropic·OpenAI·Google)의 대표 모델이 모두 컨텍스트 약 1M이다. 컨텍스트 숫자만으로는 더 이상 갈리지 않는다. 길다고 다 잘 쓰는 건 아니라는 건 [컨텍스트 윈도우](#/post/ai-context-window) 글에 적었다.
- 이름 체계가 회사마다 다르다. Claude는 이름이 크기(Fable·Opus·Sonnet·Haiku)를 뜻하고, OpenAI는 이름(Astra·Sol·Terra·Luna)이 등급 표시이고, Google은 Pro/Flash/Flash-Lite 같은 단어가 크기를 뜻한다. 가격표를 같이 봐야 어느 줄인지 알 수 있다.
- DeepSeek 가격은 시간대에 따라 두 배 차이가 난다. 문서상 평일 UTC 01~04시, 06~10시가 피크이고 나머지는 절반이다.

## 열린 모델과 닫힌 모델

닫힌 모델은 API로만 쓴다. 가중치(학습된 숫자 묶음)를 못 받는다. 열린 가중치(open weights) 모델은 가중치를 받아서 내 컴퓨터나 서버에 올려 돌릴 수 있다. 소스까지 다 공개했다는 뜻은 아니고, 라이선스 조건도 모델마다 달라서 상업 사용 가능 여부를 따로 봐야 한다.

| 회사 | 열린 쪽에서 확인한 것 | 라이선스 | 크기 |
|---|---|---|---|
| Qwen(알리바바) | Qwen3.8-27B | Apache-2.0 | 27B 밀집, 이미지·영상 이해 |
| Qwen(알리바바) | Qwen3.8-Flash-Next, Qwen3.8-2.4T-A95B | - | 180B / 2.4T(허깅페이스 목록의 크기 표시) |
| DeepSeek | V4.1-Flash, V4-Pro-0813 등 | Mistral 문서에서 V4.1 Flash는 MIT로 표시 | 허깅페이스 목록 기준 763B / 1.7T |
| Mistral | Mistral Large 4 | Mistral Ecosystem Open Weight License | - |
| Mistral | Mistral Small 4, Ministral 3 (3B/8B/14B) | Apache 2.0 | 작은 쪽 |
| Meta | Llama 4 Scout/Maverick | - | 허깅페이스 표시 109B / 402B (2025-05 이후 갱신 없음) |

Meta는 정리가 덜 됐다. 공식 허깅페이스 목록에서 읽은 가장 새 Llama가 Llama 4(2025년 5월 갱신)였다. 검색 결과에는 Meta가 2026년에 "Muse"라는 이름으로 열린 가중치를 냈다는 기사가 있었지만 출처가 한두 곳뿐이라

OpenAI는 이번에 읽은 모델 페이지에 gpt-oss 같은 열린 모델이 안 나왔다. 없다는 뜻이 아니라 그 페이지가 다루지 않았다는 뜻이다.

[자세히 → LLM](#/post/ai-llm)

## 크기 계열: 대·중·소

회사들이 크기를 비슷하게 나눈다는 게 표에서 보였다.

| 계열 | 예 | 맡기기 좋은 일 | 단가 감각 |
|---|---|---|---|
| 대 | Fable 5.1, GPT-6 Astra, Gemini 4 Argon | 어려운 추론, 몇 시간 도는 에이전트 | 입력 $10대 |
| 중 | Opus 5.5, Sonnet 5.5, GPT-6.1 Sol/Terra, Gemini 3.8 Flash | 코딩·문서·일반 업무 | $0.75~$4 |
| 소 | Haiku 5.5, GPT-6 Luna, Gemini 3.5 Flash-Lite | 분류·추출·라우팅, 대량 처리 | $0.10~$0.30 |

Anthropic 문서는 처음에 가장 싼 Haiku로 시작해 부족할 때만 올리는 방법과, 가장 센 모델로 시작해 줄여 가는 방법을 둘 다 소개한다. 어느 쪽이든 내 데이터로 평가를 돌려 보라고 한다.

## 추론 모델

추론 모델은 답을 내기 전에 생각 토큰을 먼저 쓰는 모델이다. 지금은 따로 "추론 모델"을 고르기보다 한 모델 안에서 생각의 양을 조절하는 쪽으로 가는 것 같다.

- Claude: 이번에 읽은 4개 모델 모두 적응형(adaptive) 생각이고, Fable·Opus는 항상 켜져 있다. `effort` 값으로 깊이를 조절한다. 문서는 모델을 바꾸기보다 effort를 조절하는 게 더 나은 수단인 경우가 많다고 적는다.
- OpenAI: 표에 "추론 단계"가 있다. Astra·Sol은 low에서 max, Terra·Luna는 none에서 max.
- DeepSeek: 생각 모드와 비생각 모드를 둘 다 지원하고 기본이 생각 모드다.
- Qwen3.8-27B: 생각 모드가 기본 켜짐이고 요청마다 끌 수 있다.

생각을 많이 시키면 출력 토큰이 늘어서 그만큼 돈과 시간이 든다. 이건 일반적인 구조 이야기다.

## 멀티모달

멀티모달은 글 말고 이미지·음성·영상도 다룬다는 뜻이다. Claude 문서는 현재 모델이 모두 텍스트·이미지 입력과 텍스트 출력을 지원한다고 한다. OpenAI도 최신 모델이 텍스트·이미지 입력, 텍스트 출력이다. 이미지·음성·영상을 만드는 쪽은 별도 모델이다. OpenAI는 GPT-Image-2.5와 실시간 음성(GPT-Live·GPT-Realtime) 계열을, Google은 Nano Banana(이미지)·Gemini Omni Flash(영상)·Lyria(음악)·TTS 계열을 따로 낸다. 오픈 쪽에서는 Qwen3.8-27B가 이미지·영상 이해를 지원하고, DeepSeek V4.1 Flash도 이미지-텍스트 입력으로 표시돼 있다.

<details>
<summary>자세한 풀이: 고르는 기준 다섯 가지</summary>

1. 성능: 벤치마크 순위는 이번에 따로 안 읽었다. 공식 문서 말대로 내 일을 담은 평가 세트를 만들어 돌리는 게 가장 믿을 만하다.
2. 가격: 입력/출력이 다르고 출력이 보통 비싸다. 캐시 읽기는 입력가의 일부(Claude는 문서상 2.5~10%)이고, Claude 배치 API는 50% 할인이다. 추론 모델은 생각 토큰이 출력으로 과금된다(Gemini 가격표에 "incl. thinking"으로 표시).
3. 속도: Claude 문서에 상대 지연이 Fable 느림, Opus 보통, Sonnet 빠름, Haiku 가장 빠름으로 나온다.
4. 컨텍스트: 이번에 읽은 대표 모델은 대부분 1M. 다만 품질은 별개다.
5. 로컬 가능 여부: 로컬은 열린 가중치 모델만 가능하다. 가중치 크기가 곧 필요한 메모리다. Qwen3.8-27B는 27B라 양자화하면 개인 GPU에도 올려 볼 만한 크기다. DeepSeek V4(수백 B~1.7T)나 Qwen 2.4T는 개인 장비로는 어렵다고 짐작한다.

</details>

## 흔한 오해

- 비싼 모델이 항상 낫다: 문서도 분류·추출 같은 대량 작업은 작은 모델로 시작하라고 한다. 어려운 일에서만 큰 모델 값을 한다.
- 열린 모델은 공짜다: 가중치는 받아도 돌릴 GPU와 전기와 운영이 든다. 서비스로 쓰면 이 비용을 따져야 한다. AI 기능을 만들 때는 사용자 한 명이 한 달에 쓰는 토큰 요금부터 계산해 보는 게 맞다.
- 컨텍스트가 1M이면 다 같은 급이다: 창 크기는 같아도 같은 수준으로 쓴다는 보장은 없다.
- 오픈소스와 열린 가중치는 같다: 가중치만 공개하고 학습 데이터·코드는 안 주는 경우가 많다. 라이선스도 Apache 2.0부터 회사 전용 라이선스까지 다르다. 위 표의 Mistral Large 4가 그 예다.
- 이름에 숫자가 크면 최신이다: Claude Fable 5.1과 Opus 5.5가 동시에 현행이다. 숫자는 계열 안에서만 비교된다.

← 개념 map으로 (#/post/ai-map)

관련 글: [LLM](#/post/ai-llm) · [컨텍스트 윈도우](#/post/ai-context-window) · [환각](#/post/ai-hallucination)

## 근거 링크 (2026-11-02에 읽음)

- Anthropic, Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic, Choosing the right model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- OpenAI, Models: https://developers.openai.com/api/docs/models
- Google, Gemini API models: https://ai.google.dev/gemini-api/docs/models
- Google, Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek, Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Mistral, Models overview: https://docs.mistral.ai/getting-started/models/models_overview/
- Qwen3.8-27B 모델 카드: https://huggingface.co/Qwen/Qwen3.8-27B
- Qwen 허깅페이스 조직: https://huggingface.co/Qwen
- DeepSeek 허깅페이스 조직: https://huggingface.co/deepseek-ai
- Meta Llama 허깅페이스 조직: https://huggingface.co/meta-llama
