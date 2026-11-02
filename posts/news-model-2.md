Moonshot AI가 Kimi K3의 가중치를 Hugging Face에 올렸고, 모델 카드와 라이선스 파일을 직접 읽어 보니 "공개"의 뜻이 생각보다 여러 겹이었다. (확인한 시점: 2026-11-02)

## 무슨 모델인가

Kimi K3는 텍스트와 이미지를 받는 Mixture-of-Experts 모델이다. 모델 카드는 스스로를 "open-weight, native multimodal agentic model"이라고 소개한다. 숫자는 카드에 적힌 그대로 옮긴다.

| 항목 | 값 |
|---|---|
| 전체 파라미터 | 2.8T |
| 토큰당 활성 파라미터 | 104B |
| 층 수 | 93 (그중 1개는 dense) |
| 전문가(expert) | 896개 중 16개 선택, 공유 2개 |
| 컨텍스트 길이 | 1,048,576 토큰 |
| 비전 인코더 | MoonViT-V2 (401M) |
| 어휘 크기 | 160K |

MoE는 전체 파라미터를 다 쓰지 않고 토큰마다 일부 전문가만 켜는 구조다. 2.8조 중 104억만 매 토큰에 쓰이니, 계산량은 활성 파라미터 쪽에 가깝고 메모리는 전체 쪽에 가깝다. 이 차이가 뒤에서 "돌릴 수 있나" 얘기로 이어진다. 기본 개념은 [자세히 → LLM이란 무엇인가](#/post/ai-llm)에 있다.

## 구조에서 눈에 띄는 것

카드와 GitHub 저장소가 같은 얘기를 한다. 93개 층 중 69개가 KDA(Kimi Delta Attention), 24개가 Gated MLA 어텐션이다. 블로그는 KDA를 "어텐션을 키우는 효율적인 토대"라고 부르고, 또 하나의 새 요소인 Attention Residuals(AttnRes)는 층을 지나며 표현을 균일하게 쌓지 않고 깊이 방향으로 필요한 것을 골라 가져오는 방식이라고 설명한다. 블로그는 이런 구조 변경으로 K2 대비 전체 스케일링 효율이 약 2.5배 좋아졌다고 적는데, 이건 Moonshot 쪽 주장이다.

100만 토큰 컨텍스트를 실제로 쓸 때의 비용과 품질 문제는 [자세히 → 컨텍스트 윈도우와 토큰](#/post/ai-context-window)에서 따로 정리했다.

## 가중치 형식: 양자화가 기본

카드에 따르면 SFT 단계부터 양자화 인식 학습(QAT)을 했고, 가중치는 MXFP4, 활성값은 MXFP8이다. 학습 때부터 낮은 정밀도를 염두에 둔 모델이라, 나중에 줄이는 보통의 양자화와 출발점이 다르다. Hugging Face 파일의 텐서 타입은 F32, BF16, U8로 표시된다.

<details>
<summary>MXFP4면 용량이 얼마쯤 되나 (어림 계산)</summary>

파라미터 하나가 4비트면 0.5바이트다. 2.8조 × 0.5바이트는 대략 1.4TB다. 스케일 값과 일부 고정밀 텐서가 더해지니 실제 저장소는 이보다 크다. 이건 어림 계산이고, 정확한 용량은 저장소의 파일 목록으로 봐야 한다.

활성 파라미터가 104B라고 해서 104B짜리 모델 메모리만 있으면 되는 건 아니다. 어떤 전문가가 켜질지는 토큰마다 달라서, 전체 전문가가 메모리에 올라가 있어야 빠르게 돈다. 일반적인 VRAM 계산법은 [자세히 → 로컬 모델 돌리기](#/post/ml-local-models)에 있다.
</details>

## 어떻게 돌리나

카드가 안내하는 길은 네 가지다.

- 호스팅 API: platform.kimi.ai에서 모델 이름 `kimi-k3`, OpenAI·Anthropic 호환 엔드포인트
- 직접 서빙: vLLM, SGLang, TokenSpeed를 권장 엔진으로 적어 놨다
- Docker Model Runner: `docker model run hf.co/moonshotai/Kimi-K3`
- llama.cpp·Ollama·LM Studio용 GGUF 양자화는 카드의 quantizations 목록을 통해 연결된다

서빙 엔진이 요청을 묶고 KV 캐시를 다루는 원리는 [자세히 → 추론 최적화](#/post/ml-inference)에 적어 뒀다.

## 생각 모드가 항상 켜져 있다

이 부분이 API를 쓸 때 제일 눈에 띄었다. 카드 기준으로 Thinking은 항상 켜져 있고, 결과는 `reasoning_content`에 담긴다. `reasoning_effort`는 low, high, max를 받고 기본값이 max다. 여러 턴으로 도구를 쓸 때는 어시스턴트 메시지를 `content`만이 아니라 `reasoning_content`와 `tool_calls`까지 통째로 다시 보내라고 한다. 생각 토큰이 출력 요금과 지연에 미치는 영향은 [자세히 → 추론 모델과 생각 토큰](#/post/ai-reasoning)에서 다뤘다.

API 가격은 블로그에 적혀 있다. 100만 토큰당 캐시 적중 입력 $0.30, 캐시 미적중 입력 $3.00, 출력 $15.00이다. 캐시 적중이 열 배 싼 구조라 긴 대화일수록 접두를 고정해 두는 게 중요해진다. 이 원리는 [자세히 → 프롬프트 캐싱](#/post/ai-prompt-caching)에 있다.

## 성능 숫자

모델 카드의 표(최대 추론 강도 기준)에서 몇 개만 옮긴다.

| 벤치마크 | 점수 |
|---|---|
| GPQA Diamond | 93.5 |
| Terminal-Bench 2.1 | 88.3 |
| BrowseComp | 91.2 |
| OSWorld-Verified | 84.8 |
| MCPMark-Verified | 94.5 |
| HLE-Full (도구 없음 / 있음) | 43.5 / 56.0 |

전부 Moonshot이 카드에 올린 자체 보고 수치다. 블로그는 전체적으로 Claude Fable 5와 GPT 5.6 Sol에는 "still trails", 즉 아직 못 미친다고 스스로 적고, 평가한 다른 모델들보다는 꾸준히 앞섰다고 말한다. 벤치마크 숫자를 읽는 법은 모델이 새로 나올 때마다 다시 봐야 해서 [자세히 → AI 모델 map](#/post/ai-models)에 따로 모아 두는 중이다.

<details>
<summary>카드에 있는 다른 점수들</summary>

DeepSWE 67.5, FrontierSWE 81.2, ProgramBench 77.8, SWE-Marathon 42.0, MCP-Atlas 84.2, Toolathlon-Verified 76.5, GDPval-AA v2 1686(Elo), OmniDocBench 91.1, Video-MME(자막 포함) 90.0, MMMU-Pro 81.6 / 83.4(도구 없음 / 있음), MathVision 94.3 / 97.8. 카드 안에서도 기준일이 항목마다 다르다. 일부는 2026년 7월 23일 Artificial Analysis 기준이고, FrontierSWE는 7월 16일 기준이다.
</details>

## 라이선스: MIT도 Apache도 아니다

Hugging Face 카드의 라이선스 이름은 "Kimi K3 License"이고 코드와 가중치에 같이 적용된다. LICENSE 파일을 열어 읽은 내용은 이렇다.

- 사용·복사·수정·배포·재라이선스·판매와, 실행·배포·파인튜닝·파생물 제작이 무료로 허용된다.
- 조건은 저작권 고지를 남기고 법을 지키는 것이다.
- 제3자에게 추론이나 파인튜닝을 API 같은 형태로 제공하는 "Model as a Service" 사업은 합산 매출이 12개월 연속 기준 2천만 달러를 넘으면 Moonshot과 별도 계약이 필요하다.
- 월간 활성 사용자 1억 명 초과 또는 월 매출 2천만 달러 초과 제품은 UI에 "Kimi K3"를 눈에 띄게 표시해야 한다.
- 내부 사용, 그리고 Moonshot 공식 제품이나 인증 추론 파트너를 통한 사용은 이 MaaS·표시 의무에서 빠진다.

개인이나 작은 팀이 쓰는 데는 걸릴 게 거의 없고, 이 모델로 남에게 API 장사를 크게 하려는 곳에만 선이 그어져 있다. 라이선스 원문은 법률 문서라, 실제로 상업 서비스에 쓸 때는 원문을 직접 읽어야 한다.

## 읽고 나서 든 생각

오픈웨이트라는 말이 "내 PC에서 돌린다"와 같은 뜻이 아니라는 걸 이 모델이 제일 잘 보여 주는 것 같다. 가중치는 누구나 받을 수 있는데, 전체 전문가를 올릴 메모리가 있는 곳은 많지 않다. 그래서 카드가 API, 서빙 엔진, GGUF 같은 여러 경로를 한꺼번에 안내하는 것 같다. 내 쪽에서 쓴다면 로컬보다는 호환 API로 먼저 붙여 보는 쪽이 현실적이다. 캐시 적중가가 낮게 잡혀 있어서 에이전트처럼 긴 맥락을 반복해서 보내는 용도에 맞춰진 가격이라는 인상도 받았다.

← [개념 map으로](#/post/ai-map)

관련 글: [자세히 → LLM이란 무엇인가](#/post/ai-llm) · [자세히 → 로컬 모델 돌리기](#/post/ml-local-models) · [자세히 → 추론 최적화](#/post/ml-inference)

## 근거 링크

- Hugging Face 모델 카드: https://huggingface.co/moonshotai/Kimi-K3
- Hugging Face 라이선스 파일: https://huggingface.co/moonshotai/Kimi-K3/blob/main/LICENSE
- GitHub 저장소: https://github.com/MoonshotAI/Kimi-K3
- Moonshot 공식 블로그: https://www.kimi.com/blog/kimi-k3
