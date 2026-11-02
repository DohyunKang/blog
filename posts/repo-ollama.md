Ollama 소스를 내려받아 요청이 들어와서 답이 나가는 길을 따라가 봤다. 결론부터 적으면, 추론 계산은 별도 프로세스(llama.cpp의 llama-server)가 하고, Ollama는 그 앞에서 모델 파일을 관리하고 메모리를 계산해서 언제 올리고 내릴지 정하는 Go 서버였다.

기준은 2026-10-31자 main 브랜치(커밋 c1db5f9)다. 이 저장소는 변화가 빨라서, 아래 파일·함수 이름은 이 시점 기준이다.

## 무슨 프로젝트인가

GitHub 소개는 로컬이나 클라우드에서 오픈 모델을 돌리는 도구라고 한다. 명령줄(CLI), REST API, Python·JavaScript 라이브러리를 제공하고 라이선스는 MIT다. 소스는 Go다(`go.mod`, `main.go`가 그렇다). `README.md`에는 llama.cpp 위에 만들어졌다는 말도 있다. 이 말이 코드에서 실제로 어떤 모양인지가 이번 글의 핵심이다. LLM이 뭔지는 [자세히 → LLM](#/post/ai-llm)에 있다.

## 디렉터리 구조

최상위 폴더 중 흐름을 이해하는 데 필요한 것만 추렸다.

| 폴더 | 하는 일 |
|---|---|
| `main.go`, `cmd/` | 실행 진입점. cobra로 `serve`, `run`, `pull` 같은 명령을 만든다 |
| `server/` | HTTP 라우팅(`routes.go`), 모델 스케줄러(`sched.go`), 모델 조립(`images.go`), 프롬프트 만들기(`prompt.go`) |
| `llm/` | 추론 프로세스를 띄우고 대화하는 쪽(`server.go`, `llama_server.go`) |
| `manifest/` | 모델 매니페스트와 블롭(파일) 저장 규칙 |
| `api/` | 요청·응답 타입, 클라이언트 |
| `openai/`, `anthropic/`, `middleware/` | OpenAI·Anthropic 호환 API로 들어온 요청을 Ollama 형식으로 바꾼다 |
| `envconfig/` | `OLLAMA_*` 환경변수 모음 |
| `discover/`, `ml/` | GPU 탐지, 장치·메모리 정보 |
| `llama/` | llama.cpp 버전 고정과 호환 패치(`compat/`) |
| `mlxrunner/`, `mlx/` | 애플 MLX 기반 별도 실행 경로 |

`llama/` 폴더에는 llama.cpp 소스가 통째로 들어 있지 않다. `LLAMA_CPP_VERSION` 파일이 `b11963` 같은 태그를 고정하고, 빌드할 때 그 소스를 받아 `llama/compat/`의 패치를 적용하는 방식이다(`llama/README.md`에 설명이 있다). 옛날에는 소스를 복사해 넣었던 걸로 기억하는데, 이 시점 소스에서는 아니다.

## 핵심 흐름: 요청 하나가 지나가는 길

`ollama serve`를 치면 `cmd/cmd.go`의 `RunServer`가 11434 포트를 열고 `server.Serve`를 호출한다. 여기서 라우터와 스케줄러가 같이 만들어진다. 요청 하나는 이렇게 간다.

```
클라이언트 → (gin 라우터) /api/chat
  → ChatHandler            (server/routes.go)
  → scheduleRunnerForModel → sched.getRunner   (server/sched.go)
  → [없으면] 스케줄러가 load() → llama-server 프로세스 실행
  → chatPrompt()           템플릿으로 메시지를 프롬프트 문자열로
  → runner.Completion()    llama-server에 HTTP로 전달, 토큰을 스트리밍으로 받음
  → 클라이언트에 JSON 조각으로 전달
```

### 1. 라우팅

`GenerateRoutes()`가 gin 라우터에 경로를 등록한다. `/api/generate`, `/api/chat`, `/api/embed`가 Ollama 고유 경로고, `/v1/chat/completions`, `/v1/embeddings`, `/v1/responses`, `/v1/messages`는 호환 경로다. 재미있는 건 호환 경로도 결국 같은 `ChatHandler`로 간다는 점이다. 앞에 `middleware.ChatMiddleware`가 OpenAI 형식을 Ollama 형식으로 바꿔 주고, 응답은 반대로 바꿔 준다. 형식이 여러 개여도 핵심 로직은 하나인 셈이다.

### 2. 모델 찾기와 스케줄링

`ChatHandler`는 요청을 파싱하고 `scheduleRunnerForModel`을 부른다. 이 함수는 모델이 요구하는 기능(비전, 도구 호출 등)을 지원하는지 `CheckCapabilities`로 확인하고, 옵션을 합친 뒤 `sched.getRunner`에 요청을 넘긴다.

`getRunner`에서 길이 갈린다. 이미 올라가 있는 모델(`s.loaded[key]`)이고 다시 올릴 필요(`needsReload`)가 없으면 바로 그 러너를 쓴다. 아니면 요청을 `pendingReqCh` 채널에 넣는다. 채널이 가득 차면 `ErrMaxQueue`("server busy...")를 돌려준다. 기본 대기열은 `OLLAMA_MAX_QUEUE`가 512다.

대기 요청은 `processPending` 고루틴 하나가 순서대로 처리한다. 주석이 "Block other requests until we get this pending request running"이라고 되어 있어서, 로딩은 한 번에 하나씩 직렬로 한다는 걸 알 수 있다. 처리 순서는 대략 이렇다.

- 올라간 모델이 하나도 없으면 `load()`로 바로 올린다.
- 있으면 새 모델이 같이 들어갈 수 있는지 `load(..., requireFull=true)`로 먼저 본다. 안 들어가면 true를 돌려주고, 스케줄러가 `findRunnerToUnload`로 내릴 모델을 골라 `sessionDuration=0`으로 만들어 만료시킨다. 내려간 뒤(`unloadedCh`) 다시 시도한다.
- 동시에 올릴 수 있는 모델 수는 `OLLAMA_MAX_LOADED_MODELS`로 정하고, 0이면 자동이다. 자동일 때는 GPU 하나당 3개(`defaultModelsPerGPU = 3`)로 계산한다.

### 3. 올릴 때 일어나는 일

`load()`는 `numParallel`(기본 1)을 정한다. 임베딩 모델은 1로 고정하고, 몇몇 아키텍처 이름(qwen3vl, qwen35, lfm2, nemotron_h 등)은 병렬을 지원하지 않아서 1로 낮춘다. 그다음 `llm.NewLlamaServer`로 러너 객체를 만들고 `Load`를 부른다.

`llm/llama_server.go`의 `startLlamaServer`가 실제로 프로세스를 띄운다. 빈 포트를 찾아서(`ResolveTCPAddr("localhost:0")`) 이런 식의 인자로 `exec.Command`를 실행한다.

```
llama-server --model <GGUF 경로> --port <빈 포트> --host 127.0.0.1 --no-webui --offline ...
```

GPU 레이어 수(`-ngl`), 스레드 수(`-t`), 플래시 어텐션, KV 캐시 타입, 컨텍스트 이동(`--context-shift`) 같은 옵션도 조건에 따라 붙는다. 이후 `/health`를 두드려서 준비될 때까지 기다린다(`getServerStatus`). 이 파일 주석 하나가 이 구조를 잘 말해 준다. `NewLlamaServer`의 설명이 "All GGUF models are served via the upstream llama-server subprocess"다. 이 시점에서는 GGUF 모델이 전부 llama-server 서브프로세스로 돈다.

그래서 `llm.LlamaServer` 인터페이스(`Completion`, `Chat`, `Embedding`, `Tokenize` 등)가 Ollama와 추론 엔진 사이의 경계다. Ollama 본체는 이 인터페이스만 알고, 뒤에서 llama-server가 돌든 MLX 러너가 돌든 상관없게 짜여 있다.

### 4. 메모리를 어떻게 정하나

`load()` 근처에는 메모리 계산 코드가 길게 있다. 사용 가능한 GPU 메모리를 보고 `selectLlamaServerPlacement`로 어느 GPU에 올릴지, 단일 GPU에 들어가면 하나에 몰아 넣을지 정한다. 컨텍스트 길이(`num_ctx`)를 사용자가 지정하지 않았으면 VRAM 크기로 기본값을 정한다(`Serve` 안의 `switch`에서 VRAM이 47GiB 이상이면 262144 같은 값이 보인다). 로딩 중에 메모리 부족으로 죽으면 `reduceAutoNumCtxForLoadOOM`이 컨텍스트나 배치를 줄여서 한 번 더 시도한다. [자세히 → 컨텍스트 윈도우](#/post/ai-context-window)에서 다룬 "창이 클수록 KV 캐시가 커진다"는 문제를 Ollama가 이 코드로 자동 조절하는 셈이다.

### 5. 프롬프트 만들기와 응답 전달

모델이 올라가면 `chatPrompt`(`server/prompt.go`)가 메시지 목록을 모델 템플릿에 넣어 하나의 문자열로 만든다. 컨텍스트가 넘치면 오래된 메시지를 잘라 내는 일도 여기서 한다. 도구 정의, 생각(thinking) 설정도 이 단계에서 반영된다. 그 문자열이 `r.Completion`을 통해 llama-server에 HTTP로 가고, 토큰이 스트리밍으로 돌아오는 대로 콜백 함수가 JSON 조각으로 클라이언트에 흘려보낸다. 파일 안에는 `/v1/chat/completions`를 직접 부르는 경로(`r.Chat`)도 있어서, 모델에 따라 llama-server 쪽 채팅 템플릿(jinja)을 쓰는 방법도 존재한다.

### 6. 내리기

요청이 끝나면 `finishedReqCh`로 신호가 가고 `processCompleted`가 참조 수(`refCount`)를 줄인다. 0이 되면 `sessionDuration` 타이머를 건다. 기본값은 5분(`OLLAMA_KEEP_ALIVE`의 기본, `envconfig.KeepAlive`)이다. 타이머가 만료되면 `unload()`가 `llama.Close()`를 불러서 서브프로세스를 끝낸다. 요청에서 `keep_alive: 0`을 주면 끝나자마자 내려간다. 모델을 처음 부를 때만 느리고 그다음은 빠른 이유가 이거다.

## 모델 파일은 어떻게 저장되나

`ollama pull`로 받은 모델은 도커 이미지와 비슷하게 저장된다. 내 PC에서 `~/.ollama/models/manifests/registry.ollama.ai/library/bge-m3/latest`를 열어 보면 JSON 매니페스트가 있고, `layers` 배열에 `application/vnd.ollama.image.model`(약 1.16GB), `...license` 같은 레이어가 sha256 해시와 함께 적혀 있다. 실제 파일은 `blobs/sha256-...`다. `manifest/layer.go`에 이 미디어 타입 상수(model, projector, adapter, template, system 등)가 정의되어 있다. 같은 레이어를 여러 모델이 공유하면 한 번만 저장된다. 템플릿과 시스템 프롬프트도 레이어라서 `Modelfile`로 모델을 새로 만들어도 가중치는 복사되지 않는다.

<details>
<summary>예시: 같은 이름의 모델이 매번 다르게 올라가는 경우 (needsReload)</summary>

`runnerRef.needsReload`는 이미 올라간 러너가 이번 요청과 맞는지 비교한다. 요청의 옵션(`num_ctx` 등)이 바뀌었거나, 어댑터·프로젝터 경로가 다르거나, 러너 프로세스가 이미 죽었으면 다시 올린다고 본다. 그래서 같은 모델 이름이어도 호출마다 `num_ctx`를 바꾸면 계속 다시 로딩되어 느려질 수 있다. 이건 이 함수가 비교하는 항목에서 읽어 낸 추정이고, 실제 로딩 시간은 돌려 보지 않았다.

</details>

## 흔한 오해

- Ollama가 자기 엔진으로 추론한다: 이 시점 소스에서 GGUF 모델은 llama-server 프로세스가 계산한다. Ollama는 관리·스케줄링·API 쪽이다. 애플 실리콘용 MLX 러너(`mlxrunner/`)는 별도 경로로 존재한다.
- 모델을 한 번 받으면 항상 메모리에 있다: 기본 5분 뒤에 내려간다. `ollama ps`에서 보이는 목록은 지금 올라가 있는 것만이다.
- 동시 요청이 많으면 알아서 빨라진다: `OLLAMA_NUM_PARALLEL` 기본이 1이고, 일부 아키텍처는 코드가 1로 강제한다. 대기열이 넘치면 에러가 난다. 서비스용 서빙 구조는 [자세히 → AI 서빙](#/post/infra-ai-serving)과 자세히 → vLLM 분석이 다룬다.
- OpenAI 호환이라서 내부도 OpenAI 방식이다: 호환 레이어는 앞쪽 미들웨어이고 내부는 Ollama 형식으로 통일된다.

## 읽고 나서

엔진인 줄 알았던 프로젝트가 사실은 "모델 관리자 + 메모리 스케줄러 + API 변환기"였다. 추론 쪽이 궁금하면 자세히 → llama.cpp 분석으로 이어서 봐야 한다. 이 글은 서버 쪽 흐름까지다.

## 확인 못 함

- `ollama run`·`pull`·`push`의 다운로드 로직(`server/download.go`)과 `create` 흐름은 읽지 않았다.
- MLX 러너(`mlxrunner/`), 클라우드 프록시, 이미지·음성 경로는 열어 보지 않았다.
- llama-server의 내부 동작과 성능은 확인하지 않았다. 직접 돌려서 로딩 시간이나 처리량을 잰 건 없다(로컬에서는 매니페스트 파일만 열어 봤다).
- 이 저장소는 자주 바뀌어서 위 함수 이름·기본값이 다른 시점에는 다를 수 있다. 줄 번호는 적지 않았다.

## 근거 링크

- Ollama 저장소: https://github.com/ollama/ollama (README, MIT 라이선스, 2026-10-31 기준 소스를 clone해서 읽음)
- `server/routes.go`, `server/sched.go`, `llm/server.go`, `llm/llama_server.go`, `envconfig/config.go`, `manifest/layer.go`, `llama/README.md` (모두 위 저장소 안, 직접 열어 확인)

← 관련 글: llama.cpp 분석 · vLLM 분석 · [AI 서빙](#/post/infra-ai-serving)
