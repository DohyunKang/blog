로컬에서 모델을 돌리는 도구라고 하면 Ollama나 llama.cpp부터 떠오르는데, 최근 소식을 찾다 보니 러스트로 만든 추론 엔진 mistral.rs가 눈에 들어왔다. 저장소 README와 릴리스 페이지를 열어서 뭘 하는 물건인지 정리했다. 숫자는 2026년 11월 2일에 확인한 값이다.

## 어떤 프로젝트인가

저장소 한 줄 소개는 "Fast, flexible LLM inference"다. 러스트로 쓴 LLM 추론 엔진이고, Hugging Face의 러스트 ML 라이브러리 Candle 위에 만들어졌다. 이름 때문에 헷갈리기 쉬운데 Mistral AI와는 관계가 없다고 README에 적혀 있다. 라이선스는 MIT다. 확인한 시점에 별은 7.8k개였다.

[자세히 → LLM](#/post/ai-llm)은 모델 자체 이야기이고, 여기서 말하는 추론 엔진은 이미 학습된 모델을 받아서 입력에 대한 출력을 만들어 주는 실행 쪽 소프트웨어를 가리킨다. 비슷한 위치의 도구는 [오픈소스 분석: llama.cpp](#/post/repo-llama-cpp), [오픈소스 분석: Ollama](#/post/repo-ollama), [오픈소스 분석: vLLM](#/post/repo-vllm) 글에서 따로 다뤘다.

## 설치하고 띄우는 법

README에 나온 설치 명령은 이렇다.

```
# macOS / Linux
curl -fsSL https://mistralrs.dev/install.sh | sh

# Windows (PowerShell)
irm https://mistralrs.dev/install.ps1 | iex
```

모델을 띄우는 명령은 한 줄이다.

```
mistralrs serve -m Qwen/Qwen3-4B --quant 4
```

실행하면 `http://localhost:1234/ui`에서 내장 웹 UI를 열 수 있다. 코드에서 바로 쓰고 싶으면 파이썬은 `pip install mistralrs`, 러스트는 `cargo add mistralrs`로 라이브러리처럼 가져다 쓴다. 서버로 띄우는 방법과 프로세스 안에서 부르는 방법이 둘 다 있는 셈이다.

## 지원 범위

플랫폼은 CUDA(엔비디아 GPU), Metal(애플 실리콘), CPU이고, macOS·Linux·Windows에서 돈다. CPU용 도커 이미지도 배포한다고 한다. 모델 종류는 텍스트만이 아니다. 비전, 비디오, 오디오 입력 모델에 음성 생성, 이미지 생성, 임베딩 모델까지 지원 목록에 있고, 45개 이상의 아키텍처를 지원한다고 적혀 있다. [멀티모달](#/post/ai-multimodal)이나 [임베딩](#/post/ai-embedding)을 같은 엔진으로 돌려 볼 수 있다는 얘기다.

양자화 쪽은 형식이 꽤 많다. ISQ, GGUF(2~8비트), UQFF, GPTQ, AWQ, HQQ, FP8, BNB가 목록에 있다. ISQ는 in-situ quantization의 줄임말로, 모델을 불러올 때 그 자리에서 양자화하는 방식이다. 위 실행 예의 `--quant 4`가 이런 흐름에 해당한다. 양자화가 왜 필요한지, VRAM이 얼마나 드는지는 [로컬 모델 돌리기](#/post/ml-local-models)에 정리해 뒀다.

## 서버를 띄웠을 때 노출되는 것

`mistralrs serve`는 OpenAI 호환 `/v1` 엔드포인트를 연다. 기존에 OpenAI API 형식으로 짜 둔 클라이언트를 주소만 바꿔서 붙일 수 있다는 뜻이다. 여기에 Anthropic 호환 `/v1/messages`와 `/v1/messages/count_tokens` 엔드포인트도 있고, Prometheus용 `/metrics`도 노출한다. 로컬 서버를 서비스처럼 모니터링하려는 사람에게는 이 `/metrics`가 꽤 쓸모 있어 보인다.

릴리스 노트에는 이 Anthropic 호환 쪽이 계속 다듬어진 흔적이 있다. v0.9.3 항목에 "Improved Anthropic Messages and Claude Code support"라는 줄이 있다.

## 속도와 메모리 관련 기능

README가 내세우는 기능은 다음과 같다.

| 기능 | 설명 |
| --- | --- |
| 연속 배칭(continuous batching) | 요청이 들어오는 대로 배치에 합친다 |
| PagedAttention + 프리픽스 캐싱 | KV 캐시를 페이지 단위로 관리하고 앞부분이 같은 프롬프트는 재사용한다 |
| FlashAttention V2/V3 | CUDA에서 어텐션 계산을 빠르게 한다 |
| 멀티 GPU·분산 추론 | 모델을 여러 장치에 나눠 올린다 |
| LoRA·X-LoRA 어댑터 | 파인튜닝된 어댑터를 얹는다 |
| 멀티 모델 로드·언로드 | 실행 중에 모델을 올리고 내린다 |

KV 캐시나 배칭이 무슨 얘기인지는 [추론 최적화](#/post/ml-inference)에서 풀어 썼다. 표의 PagedAttention은 [오픈소스 분석: vLLM](#/post/repo-vllm)에서 다룬 것과 같은 이름이다.

이 외에 `mistralrs tune`이라는 명령이 있다. 내 하드웨어를 보고 어떤 양자화와 장치 배치(device mapping)가 좋을지 추천해 준다고 한다.

## 에이전트용 도구가 내장돼 있다

추론 엔진인데 에이전트 기능도 들어 있는 게 특이했다. README에는 내장 도구로 웹 검색, 파이썬 코드 실행, 셸 실행, MCP 클라이언트, 도구 호출이 나온다. 모델이 [도구 호출](#/post/ai-tool-use)을 요청하면 엔진 쪽에서 바로 실행해 주는 구조로 보인다. 외부 도구를 붙이는 표준인 [MCP](#/post/ai-mcp)도 클라이언트로 지원한다.

그래서인지 릴리스 노트에 보안 관련 수정이 눈에 띈다. v0.9.4에는 이런 항목이 있다.

- 열려 있던 Dependabot 보안 경고 수정
- calibration 저장 경로 제한, 채팅 ID 검증
- 디코딩하는 GIF 프레임과 오디오 샘플 수에 상한 두기
- 웹 검색과 추출 도구가 원격 가져오기 방어 로직을 공유하게 변경

셸 실행이나 웹 가져오기를 엔진이 직접 하니까 이런 방어가 필요해지는 것 같다. 로컬 서버라도 이런 도구를 켤 때는 어디까지 허용할지 한 번 생각해 볼 만하다.

<details>
<summary>최근 릴리스 세 개 정리</summary>

릴리스 페이지에서 읽은 내용이다.

v0.9.5 (10월 19일)
- 도구 호출·추론 구분자는 특수 토큰으로 나왔을 때만 인정
- Qwen3.8-Flash-Next 지원 추가
- CUDA 13.4 지원, radix top-k 커널의 GCC 13+ 문제 수정
- ISQ 출력 작업을 배치할 때 생기던 교착 상태 수정
- Metal에서 Paged Attention을 기본 백엔드로 변경

v0.9.4 (9월 24일)
- 보안 경고·서버·도구 하드닝 수정 (위 본문 참고)
- candle 의존성 갱신, CUDA 빌드와 추론 복구
- CUDA 그래프 인스턴스 플래그 문제 수정

v0.9.3 (9월 7일)
- 동시성과 스케줄러 성능 개선
- FP8 정식 지원, DFlash 디코딩 동시 실행
- `mistralrs_sequences_capacity` 메트릭 추가, prefill/decode 초당 토큰 수를 따로 로깅
- 사용량에 캐시된 프롬프트 토큰 보고
- Anthropic Messages·Claude Code 지원 개선
- NVFP4 체크포인트 로딩, cuTile Blackwell 가속

</details>

## 한 달 반 동안의 변화

릴리스 날짜를 보면 9월 7일, 9월 24일, 10월 19일에 각각 올라왔다. 내용 흐름이 재미있다. 9월 초에는 스케줄러와 FP8 같은 성능 항목이, 9월 말에는 보안 수정이, 10월에는 새 모델 지원과 CUDA 13.4 대응이 중심이다. 새 모델이 나오면 지원을 바로 붙이는 방식이라, 쓰려는 모델이 지원 목록에 있는지는 릴리스 노트에서 확인하는 편이 빠르다. 10월 릴리스에서 Metal의 Paged Attention이 기본값이 된 것도 맥에서 쓰는 사람에게는 체감이 있을 변화다.

## 써 보려면

README 기준으로 이런 순서로 보면 된다.

1. 설치 스크립트로 설치한다.
2. 작은 모델로 `mistralrs serve -m <모델> --quant 4`를 띄우고 `/ui`로 접속한다.
3. OpenAI 호환 주소로 기존 클라이언트를 붙여 본다.
4. `mistralrs tune`으로 내 GPU에 맞는 설정을 받아 본다.

양자화 형식, 배칭, 멀티 GPU, 내장 도구까지 한 엔진에 넣은 구성이라는 점이 README를 읽고 가장 먼저 눈에 들어왔다.

## 근거 링크

- [EricLBuehler/mistral.rs (GitHub 저장소)](https://github.com/EricLBuehler/mistral.rs) — 2026-11-02 확인
- [mistral.rs 릴리스 페이지](https://github.com/EricLBuehler/mistral.rs/releases) — 2026-11-02 확인

← [개념 map으로](#/post/ai-map)

관련 글: [로컬 모델 돌리기](#/post/ml-local-models) · [추론 최적화](#/post/ml-inference) · [오픈소스 분석: llama.cpp](#/post/repo-llama-cpp)
