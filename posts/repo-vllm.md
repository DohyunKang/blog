vLLM은 LLM을 서버로 띄워 여러 요청을 한꺼번에 처리하는 추론 엔진이고, 핵심은 GPU 메모리를 잘게 쪼개 쓰는 KV 캐시 관리와 매 스텝 토큰을 나눠 주는 스케줄러였다.

## 뭐 하는 물건인지

모델 파일을 받아서 OpenAI 호환 API 서버로 띄워 주는 오픈소스다. 혼자 한 번 돌리는 용도보다 여러 사람이 동시에 요청을 보내는 상황에 맞춰져 있다. [자세히 → AI 서빙](#/post/infra-ai-serving)

이 글은 2026-11-02 기준 main 브랜치(커밋 16d6673)를 얕게 clone해서 읽은 내용이다. 코드는 빠르게 바뀌어서 파일 위치나 줄 수는 금방 달라질 수 있다. 읽은 곳은 `vllm/v1/` 아래 스케줄러, KV 캐시 관리, 엔진 루프 쪽이다. 모델 구현이나 CUDA 커널은 읽지 않았다.

## 문제: KV 캐시가 메모리를 다 먹는다

LLM은 토큰을 하나씩 만든다. 이때 앞 토큰들의 key/value 값을 매번 다시 계산하지 않으려고 GPU에 저장해 두는데, 이게 KV 캐시다. 요청마다 길이가 다르고 답이 언제 끝날지 몰라서, 예전 방식은 최대 길이만큼 연속된 공간을 미리 잡아 뒀다. vLLM 블로그는 이런 기존 시스템이 단편화와 과예약 때문에 메모리의 60~80%를 낭비한다고 적는다. 낭비된 만큼 한 번에 올릴 요청 수(배치)가 줄고, 처리량도 줄어든다.

## 원리 1: PagedAttention, 블록으로 쪼개기

운영체제의 가상 메모리와 같은 발상이다. 한 요청의 KV 캐시를 고정 크기 블록으로 자르고, 블록은 GPU 메모리에서 떨어져 있어도 된다. 요청마다 "논리 블록 → 물리 블록" 표(block table)를 가지고, 토큰이 생길 때만 블록을 새로 받는다.

| | 예전 방식 | PagedAttention |
|---|---|---|
| 공간 잡기 | 최대 길이만큼 연속으로 미리 | 필요할 때 블록 하나씩 |
| 낭비 | 단편화·과예약 | 요청의 마지막 블록 안쪽 정도 |
| 공유 | 어려움 | 같은 물리 블록을 여러 요청이 가리킴 |

블로그 수치로는 낭비가 마지막 블록에서만 생기고 4% 미만이다. 논문 초록은 같은 지연 시간에서 FasterTransformer, Orca 대비 처리량 2~4배를 주장한다. 블로그는 HF Transformers 대비 최대 24배, TGI 대비 최대 3.5배라고 쓰는데, LLaMA-7B(A10G)·13B(A100 40GB)에 ShareGPT 길이 분포로 잰 값이다. 2023년 시점의 비교라서 지금 버전끼리 붙이면 다를 것이다.

블록 하나의 토큰 수는 설정값 `block_size`이고, 코드(`config/cache.py`)에서 기본값이 16으로 박혀 있었다. 블록 풀은 `v1/core/block_pool.py`의 `BlockPool`이 맡는다. 미리 만들어 둔 블록 객체들이 있고, 빈 블록은 큐로 관리하며, 해시로 블록을 찾는 표를 따로 둔다.

## 원리 2: 앞부분 재사용(prefix caching)

같은 시스템 프롬프트로 시작하는 요청이 많으면 그 앞부분의 KV는 같다. 그걸 다시 계산하지 않고 이미 만들어진 블록을 가져다 쓴다. 코드의 `hash_block_tokens`가 하는 일은 한 줄로 요약된다. 블록의 해시 = hash(앞 블록의 해시, 이 블록의 토큰들, 추가 키). 앞 블록 해시가 섞이니 "이 블록의 토큰이 같다"가 아니라 "여기까지의 앞부분이 전부 같다"일 때만 맞는다.

이 구조를 흉내 낸 장난감 코드를 돌려 봤다(블록 크기 4, sha256, 실제 코드와는 다름).

```python
import hashlib
B = 4
def chain(tokens):
    h = b"root"; out = []
    for i in range(0, len(tokens)//B*B, B):
        h = hashlib.sha256(h + bytes(tokens[i:i+B])).digest()
        out.append(h.hex()[:6])
    return out

a = list(range(10))                    # 0..9
b = list(range(4)) + [50,51,52,53,54,55]  # 첫 블록만 같음
c = [7] + list(range(1,10))            # 첫 토큰만 다름
```

결과는 이랬다. 실행해서 확인했다.

```
a: ['dec0e9', 'cabceb']
b: ['dec0e9', '5785bf']   # 첫 블록 재사용, 둘째부터 다름
c: ['423961', 'd3738b']   # 첫 블록이 다르니 뒤도 전부 다름
```

c는 둘째 블록의 토큰(4~7)이 a와 같은데도 해시가 다르다. 앞이 다르기 때문이다. 그래서 재사용은 "처음부터 이어진 같은 구간"에만 된다. 공식 설계 문서도 완전히 찬 블록만 캐시하고, 가장 긴 일치 구간만 재사용한다고 적는다.

또 하나, 프롬프트가 전부 캐시에 있어도 마지막 토큰은 다시 계산한다. 다음 토큰을 고를 logits가 필요해서다. `kv_cache_manager.py`의 `get_computed_blocks`에 `prompt_length - 1`로 제한한다는 주석이 있다. 이 제한 때문에 마지막 블록 하나가 통째로 다시 계산될 수도 있다고 주석에 나온다.

해시 기본값은 sha256이다(`config/cache.py`의 `prefix_caching_hash_algo`). 문서는 더 빠른 xxhash 계열이 있지만 충돌 위험이 있어 여러 사용자가 쓰는 환경에선 신경 써야 한다고 한다. 요청마다 cache salt를 주면 같은 salt끼리만 캐시를 공유한다.

쫓아내는 방식은 LRU다. 안 쓰는 블록은 해시가 붙은 채로 빈 블록 큐에 들어가 있다가, 새 블록이 필요해서 큐 앞에서 꺼내질 때 해시가 지워지고 재사용 대상에서 빠진다. 요청이 끝나면 블록은 뒤쪽부터 큐에 돌아간다. 뒤쪽 블록일수록 다시 쓰일 가능성이 낮으니 먼저 쫓겨나게 하려는 것이다(공식 문서).

## 원리 3: 스케줄러, 토큰 예산을 나눠 준다

`v1/core/sched/scheduler.py`의 `Scheduler.schedule()`이 한 스텝마다 어떤 요청에 토큰을 몇 개 줄지 정한다. 3,700줄이 넘는 파일인데, 맨 위 주석이 구조를 잘 설명한다. 요약하면 이렇다.

- "decoding 단계"와 "prefill 단계"를 따로 나누지 않는다.
- 요청마다 `num_computed_tokens`(이미 계산한 수)와 `num_tokens_with_spec`(프롬프트+출력+추측 토큰)만 있다.
- 매 스텝 앞의 수가 뒤의 수를 따라잡도록 토큰을 배정한다.
- 이 한 규칙으로 chunked prefill, prefix caching, speculative decoding을 다 다룬다.

스텝의 총 예산은 `max_num_scheduled_tokens`이고, 설정의 `max_num_batched_tokens` 기본값은 2048, `max_num_seqs` 기본값은 128이다(`config/scheduler.py`). 흐름은 이렇게 읽혔다.

1. 이미 돌고 있는 요청(`running`)부터 순서대로 본다. 필요한 토큰 수를 예산 안에서 정하고 `allocate_slots`로 KV 블록을 받는다.
2. 예산이 남으면 대기 중인 요청(`waiting`)을 꺼내 앞부분 캐시를 조회하고 이어서 prefill을 시작한다.
3. 긴 프롬프트는 한 번에 다 넣지 않고 예산만큼 잘라서 넣는다(chunked prefill). `enable_chunked_prefill`이 꺼져 있고 남은 예산보다 길면 그 자리에서 멈춘다. `long_prefill_token_threshold`로 한 요청이 한 스텝에 쓰는 prefill 양에 상한도 둘 수 있다.

덕분에 긴 프롬프트 하나가 들어와도 이미 돌던 요청들의 다음 토큰이 같이 한 배치에 실린다. 새 요청이 끝날 때까지 다른 요청이 서 있지 않는다. 이걸 연속 배칭(continuous batching)이라고 부르는 걸로 알고 있다. [자세히 → 모델 추론](#/post/ml-inference)

### 블록이 모자라면

`allocate_slots`가 `None`을 주면 KV 블록이 없다는 뜻이다. 그러면 우선순위가 가장 낮은 요청을 하나 쫓아낸다(`_preempt_request`). 정책이 FCFS면 `running[-1]`(가장 늦게 들어온 것), PRIORITY면 우선순위 값이 가장 큰 것이다. 쫓겨난 요청은 블록을 반납하고 `num_computed_tokens = 0`이 된 채 `waiting` 맨 앞으로 돌아간다. 즉 나중에 처음부터 다시 계산한다. 메모리를 아끼는 대신 연산을 한 번 더 쓰는 선택이다. 쫓겨난 횟수는 `num_preemptions`에 쌓인다. 이 부분은 해당 함수를 읽은 것이고, 쫓겨난 요청이 이어서 prefix cache를 얼마나 되살리는지는 실행해 보지 않았다.

### 엔진 루프

`v1/engine/core.py`의 `step()`이 전체 뼈대다. 읽은 대로 줄이면 이렇다.

```
scheduler_output = scheduler.schedule()
future = model_executor.execute_model(scheduler_output, non_block=True)
...
model_output = future.result()   # 없으면 sample_tokens 호출
outputs = scheduler.update_from_output(scheduler_output, model_output)
```

스케줄 → GPU 실행 → 결과 반영 순서이고, 이 루프가 계속 돈다. `update_from_output`에서 요청이 끝났는지 판단하고 블록을 반납한다는 건 함수 이름과 흐름에서 읽었고, 세부 구현은 다 읽지 않았다.

## 흔한 오해

- vLLM이 모델을 빠르게 만드는 거다: 모델 계산 자체를 바꾸는 게 아니라 메모리를 덜 낭비해서 더 많은 요청을 한 배치에 올리는 쪽이다. 한 요청만 보내면 이득이 작다.
- 앞부분 캐시는 단어가 같으면 쓰인다: 위 장난감 예시처럼 처음부터 이어서 같아야 한다. 문장 중간에 같은 구간이 있어도 못 쓴다.
- 캐시를 켜면 답이 달라진다: 공식 문서는 출력을 바꾸지 않고 재계산만 줄인다고 한다.
- 메모리가 모자라면 요청이 실패한다: 이 코드에선 먼저 다른 요청을 쫓아내고 나중에 다시 계산한다. 대기열 사정에 따라 지연은 늘 수 있다.

<details>
<summary>자세한 풀이: 파일별로 본 것</summary>

| 파일 | 본 것 |
|---|---|
| `v1/core/sched/scheduler.py` | `schedule()`, `_preempt_request()`, `update_from_output()` 위치, 토큰 예산 변수 |
| `v1/core/kv_cache_manager.py` | `get_computed_blocks`(캐시 조회), `allocate_slots`(블록 할당), `free` |
| `v1/core/block_pool.py` | `BlockPool`, 해시→블록 표, 빈 블록 큐, `free_blocks`의 축출 순서 설명 |
| `v1/core/kv_cache_utils.py` | `hash_block_tokens`: (앞 해시, 토큰, extra_keys)를 해시 |
| `v1/core/sched/request_queue.py` | FCFS 큐와 우선순위 큐 |
| `v1/engine/core.py` | `step()` 루프 |
| `config/cache.py`, `config/scheduler.py` | 기본값(block_size 16, 해시 sha256, prefix caching 기본 켜짐, 배치 토큰 2048, 시퀀스 128) |

최신 main에는 하이브리드 모델(Mamba, 슬라이딩 윈도우), 여러 KV 캐시 그룹, 외부 커넥터(KV를 다른 곳으로 넘기기), 추측 디코딩 같은 분기가 스케줄러 곳곳에 섞여 있다. 그래서 논문의 단순한 그림과 코드는 꽤 다르다. 위 설명은 가장 기본 경로만 따라간 것이다.

</details>

<details>
<summary>자세한 풀이: 공부 순서 추천</summary>

처음 읽는다면 `core.py`의 `step()`, 그다음 `schedule()` 맨 위 주석, 그다음 `block_pool.py`의 클래스 설명 순서가 부담이 적었다. 파일이 크니까 함수 이름으로 검색하며 보는 편이 낫다.

</details>

← 개념 지도로 [(AI 개념 지도)](#/post/ai-map)

관련 글: [Ollama 분석](#/post/repo-ollama) · [llama.cpp 분석](#/post/repo-llama-cpp) · [AI 서빙](#/post/infra-ai-serving)

## 근거 링크

- Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention: https://arxiv.org/abs/2309.06180
- vLLM 블로그, vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention: https://vllm.ai/blog/2023-06-20-vllm
- vLLM 문서, Automatic Prefix Caching 설계: https://docs.vllm.ai/en/latest/design/prefix_caching/
- vLLM 소스(2026-11-02, 커밋 16d6673): https://github.com/vllm-project/vllm
