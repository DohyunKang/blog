llama.cpp 소스를 내려받아(커밋 785322d, 2026-11-01) 모델 파일이 열리고 토큰이 나올 때까지의 길을 따라가 봤다. 크게 세 덩어리였다. 파일 형식(GGUF), 계산 라이브러리(ggml), 그 위에서 루프를 도는 llama 쪽 코드. 양자화는 따로 붙은 기능이 아니라 파일 안의 텐서 형식 자체였다.

## 저장소 구조부터

최상위에 `src/`, `ggml/`, `include/`, `tools/`가 있다.

| 위치 | 하는 일 |
|---|---|
| `include/llama.h` | 바깥에서 부르는 C API. 모델 로드, 컨텍스트 생성, `llama_decode` 등 |
| `src/` | 모델·컨텍스트·KV 캐시·토크나이저·샘플러. `llama-context.cpp`가 약 4,800줄 |
| `src/models/` | 모델 구조마다 파일 하나씩(172개). 그래프를 만드는 코드 |
| `ggml/src/` | 텐서 연산과 백엔드. `ggml-cuda`, `ggml-metal`, `ggml-vulkan`, `ggml-cpu` 등 폴더가 나뉜다 |
| `tools/` | `cli`, `server`, `quantize`, `llama-bench`, `perplexity` 같은 실행 파일 |
| `convert_hf_to_gguf.py` | Hugging Face 모델을 GGUF로 바꾸는 스크립트 |

README는 한 줄로 "LLM inference in C/C++"라고 소개한다. 학습 코드는 없고 추론이 주인공이다. 모델 구조 하나를 지원하려면 `src/models/`에 파일 하나를 추가하는 식이라, 새 모델이 나오면 이 폴더가 늘어나는 구조다. [자세히 → 추론](#/post/ml-inference)

## GGUF: 한 파일에 다 넣은 형식

`ggml/include/gguf.h` 맨 위 주석에 파일 구조가 그대로 적혀 있다. 순서는 이렇다.

1. 매직 `"GGUF"` 4바이트, 버전(현재 `GGUF_VERSION` 3)
2. 텐서 개수, 키-값 쌍 개수
3. 키-값 쌍들(모델 구조 이름, 층 수, 토크나이저 어휘 같은 메타데이터)
4. 텐서 정보들(이름, 차원, 데이터 타입, 데이터 위치)
5. 정렬된 텐서 데이터 덩어리

가중치만 있는 게 아니라 설정과 어휘표까지 한 파일에 들어간다. 그래서 `llama-cli -hf ...` 한 줄이면 파일 하나만 받아서 돈다. 텐서 정보에 "데이터 위치"가 있고 데이터가 정렬돼 있어서 `llama-model-loader.cpp`가 파일을 mmap으로 열 수 있다. mmap 쓰는 쪽 코드에는 "GGUF 데이터 구간이 정렬돼 있지 않으면 mmap 못 한다"는 예외도 있었다. 파일을 통째로 읽어 복사하는 대신 운영체제가 필요한 쪽만 메모리에 올려 주는 방식이다.

## 양자화는 블록 구조체다

`ggml/src/ggml-common.h`에 형식별 블록이 정의돼 있다. 대표로 Q4_0.

```c
#define QK4_0 32
typedef struct {
    ggml_half d;           // delta
    uint8_t qs[QK4_0 / 2]; // nibbles / quants
} block_q4_0;
```

가중치 32개를 한 블록으로 묶고, 블록마다 스케일 `d` 하나(2바이트)와 4비트 값 32개(16바이트)를 둔다. 18바이트에 32개니까 가중치 하나당 4.5비트다. 원래 16비트짜리라면 대략 3.5분의 1이다. 같은 방식으로 계산하면 Q8_0은 블록이 34바이트라 8.5비트, Q4_K는 256개 슈퍼블록에 144바이트(2+2+12+128)라 역시 4.5비트였다. 7B 파라미터에 4.5비트를 곱하면 약 3.9GB다. 이 숫자는 소스의 구조체에서 내가 계산한 값이고, 실제 파일 크기는 1차원 텐서 등이 다른 형식으로 남아서 조금 다르다(`llama.h`에도 Q4_0 설명에 "except 1d tensors"라고 적혀 있다). [자세히 → 로컬 모델](#/post/ml-local-models)

`quantize_row_q4_0_ref`(`ggml-quants.c`)를 읽으면 변환 과정이 짧다. 블록 안에서 절댓값이 가장 큰 값을 찾아 `d = max / -8`로 정하고, 각 값을 `d`로 나눠 +8.5 해서 0~15 정수로 자른다. 위쪽 16개와 아래쪽 16개를 한 바이트의 윗니블·아랫니블에 나눠 담는다. 이 함수를 파이썬으로 옮겨 32개짜리 랜덤 블록에 돌려 보니 18바이트가 나왔고, 복원했을 때 최대 오차가 0.147이었다. 스케일 `d`가 0.2986이라서 반 칸(d/2 ≈ 0.149) 안쪽에 들어간 값이다. 반올림 오차가 스케일의 절반 이하라는 뜻이다.

<details>
<summary>자세한 풀이: 블록 단위 오차가 왜 이렇게 되나</summary>

블록 안에서 가장 큰 값 하나가 스케일을 정하기 때문에, 블록 안에 튀는 값(outlier)이 하나 있으면 나머지 값들의 해상도가 같이 거칠어진다. 블록을 32개로 작게 쪼개는 이유가 이거라고 이해했다. 블록이 작으면 튀는 값의 영향이 그 블록 안에 갇힌다. 대신 블록마다 스케일을 저장해야 해서 비트가 늘어난다(4비트 값 + 스케일 몫 0.5비트 = 4.5비트).

Q4_K 쪽은 256개 슈퍼블록 안에 작은 블록들이 있고 그 스케일과 최솟값(`scales`, 6비트)을 다시 슈퍼블록 단위로 양자화한다(`ggml-common.h`의 주석: "scales and mins, quantized with 6 bits"). 스케일을 한 번 더 양자화하는 구조다. 이 K 형식이 왜 Q4_0보다 품질이 좋은지에 대한 수치 비교는 이번에 확인하지 못했다.

</details>

## 계산은 어떻게 하나

양자화된 가중치와 행렬곱을 할 때는 입력(활성값) 쪽도 8비트 블록(`block_q8_0`)으로 바꿔서 정수끼리 곱한다. `ggml-cpu/quants.c`의 `ggml_vec_dot_q4_0_q8_0_generic`이 그 기본(범용) 구현이다.

- 블록마다 `sumi`를 정수로 누적한다. 4비트 값은 `(qs & 0x0F) - 8`로 풀고 8비트 값과 곱한다.
- 블록이 끝나면 `sumi × 가중치 스케일 × 활성값 스케일`을 실수 합계에 더한다.

즉 "정수 곱을 크게 하고, 스케일은 블록당 한 번만 곱한다"는 구조다. 파일 이름 뒤에 `_generic`이 붙은 걸 보면 CPU 종류별로(AVX, NEON 등) 빠른 버전이 따로 있고 이건 기준 구현인 것 같다. 어떤 CPU에서 어느 버전이 실제로 선택되는지는 확인 못 했다.

연산을 어느 장치에서 할지는 `ggml-backend`가 맡는다. `llama_model_params`에 `n_gpu_layers`(VRAM에 올릴 층 수, 음수면 전부)가 있어서, 일부 층만 GPU에 두고 나머지는 CPU에서 돌리는 것도 된다. 이 부분 때문에 VRAM이 모자란 PC에서도 큰 모델이 느리게나마 돈다. [자세히 → 트랜스포머](#/post/ml-transformer)

## 추론 루프: llama_decode 한 번에 일어나는 일

`llama_context::decode`(`llama-context.cpp`)를 위에서부터 읽었다. 흐름은 이렇다.

1. 토큰이 비어 있으면 에러(-1)로 돌려보낸다.
2. 출력할 토큰이 몇 개인지 센다. 임베딩 모드면 전부, 일반 생성이면 마지막 위치만 필요하다.
3. `memory->init_batch(...)`로 배치를 작은 조각(ubatch)으로 나누고 KV 캐시에서 자리를 찾는다. 자리가 없으면 캐시를 정리(`memory_update`)한 뒤 한 번 더 시도하고, 그래도 안 되면 1을 반환한다.
4. ubatch마다 `process_ubatch`를 부른다.

`process_ubatch` 안에서는 지난번 그래프를 재사용할 수 있으면 그대로 쓰고, 아니면 `model.build_graph`로 계산 그래프를 새로 만든다. 그 뒤 입력 텐서에 값을 채우고(`set_inputs`), `graph_compute`로 실행한다. 한 ubatch가 실패하면 그 조각의 위치들을 메모리에서 지워 상태를 되돌리는 코드도 있었다.

배치 크기는 두 층이다. `llama.h`에서 `n_batch`는 `llama_decode`에 넣을 수 있는 논리적 최대치, `n_ubatch`는 실제로 한 번에 계산하는 물리적 최대치라고 설명한다. 프롬프트를 길게 넣으면 ubatch 단위로 쪼개져 처리된다.

`graph_compute(res->get_gf(), ubatch.n_tokens > 1)` 호출에서 두 번째 인자가 "토큰이 둘 이상인가"로 넘어간다. 프롬프트 처리(여러 토큰)와 생성(토큰 하나)을 구분해서 넘기는 걸로 보이는데, 내부에서 이 값으로 정확히 무엇을 바꾸는지는 읽지 못했다.

그래프는 모델마다 `src/models/`의 코드가 만든다. 예를 들어 `llama.cpp`(모델 파일 이름)는 임베딩 입력 → 층마다 `build_norm` → `ggml_rope_ext`로 Q·K에 위치 정보 → `build_attn` → `build_ffn` 순으로 쌓는다. 다음 토큰을 고르는 건 `llama_sampler`(체인 방식)로, 로짓에서 샘플러 체인을 거쳐 토큰 하나가 나온다. 이 루프를 바깥에서 직접 도는 건 `tools/cli`나 `tools/server` 같은 실행 파일이다. [자세히 → 샘플링](#/post/ai-sampling)

## Ollama·vLLM과 비교해서 보면

앞서 [Ollama](#/post/repo-ollama)를 읽었을 때 추론 계산은 별도 프로세스(llama-server)가 한다는 걸 봤다. 이 저장소가 바로 그 계산 쪽이다. Ollama가 모델 관리와 올리고 내리는 시점을 맡고, 실제 토큰 계산은 여기서 나온다. 반대로 [vLLM](#/post/repo-vllm)은 같은 일을 서버·다수 사용자 처리에 맞춰 만든 쪽이라 PagedAttention 같은 구조가 핵심이다. llama.cpp는 한 대 PC에서 파일 하나를 잘 돌리는 데에 무게가 있고, 요청 여러 개를 모아 처리하는 부분은 이번에 안 읽었다. [자세히 → AI 서빙](#/post/infra-ai-serving)

## 흔한 오해

- 양자화하면 모델이 다른 모델이 된다: 가중치 값의 정밀도만 줄이는 것이고 구조는 같다. 다만 오차가 쌓이니 비트가 낮을수록 품질이 떨어질 수 있다.
- GGUF는 압축 파일이다: 압축(zip)과 다르다. 4비트 값이 그대로 파일에 들어 있고, 계산도 그 형식을 직접 읽어서 한다.
- llama.cpp는 Llama 모델 전용이다: 이름 때문에 헷갈리지만 `src/models/`에 구조별 파일이 172개 있다.
- GPU가 없으면 못 돌린다: CPU 백엔드가 기본이다. GPU는 `ggml-cuda`, `ggml-metal` 같은 백엔드로 선택해서 얹는다.

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: 저장소 구조와 폴더별 역할(직접 파일 목록 확인), GGUF 파일 구조(`gguf.h` 주석), 블록 구조체 정의(Q4_0·Q8_0·Q4_K), `quantize_row_q4_0_ref` 동작과 파이썬 재현(18바이트, 복원 오차 d/2 이내), `ggml_vec_dot_q4_0_q8_0_generic`의 정수 누적 구조, `llama_context::decode`와 `process_ubatch`의 흐름, `n_batch`·`n_ubatch`·`n_gpu_layers` 정의(`llama.h`).

확인 못 함: 실제 모델을 돌려 본 속도·메모리(GPU 큰 모델 실행 금지라 안 함), CPU별 최적화 구현이 어떻게 선택되는지, K 형식과 Q4_0의 품질 수치 비교, `graph_compute`의 두 번째 인자 효과, 서버 쪽(요청 여러 개 처리) 동작, 컨텍스트 이동·압축(`memory_update`) 세부.

</details>

## 근거 링크

- llama.cpp 저장소: https://github.com/ggml-org/llama.cpp
- GGUF 구조 주석(gguf.h): https://github.com/ggml-org/llama.cpp/blob/master/ggml/include/gguf.h
- 블록 정의(ggml-common.h): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-common.h
- 양자화 구현(ggml-quants.c): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-quants.c
- 정수 내적(ggml-cpu/quants.c): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cpu/quants.c
- 추론 루프(llama-context.cpp): https://github.com/ggml-org/llama.cpp/blob/master/src/llama-context.cpp

← [개념 지도로](#/post/ai-map)

관련 글: [추론](#/post/ml-inference) · [로컬 모델](#/post/ml-local-models) · [Ollama](#/post/repo-ollama)
