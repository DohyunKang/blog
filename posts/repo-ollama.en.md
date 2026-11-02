I traced the flow from receiving a request to generating a response by examining the Ollama source code. To summarize: inference calculations are handled by a separate process (`llama.cpp`'s `llama-server`), while Ollama acts as a Go server that manages model files, calculates memory usage, and determines when to load or unload models.

The baseline is the main branch (commit c1db5f9) as of 2026-10-31. Since this repository changes rapidly, the file and function names below are accurate only for this specific point in time.

## What project is this?

GitHub describes it as a tool to run open models locally or in the cloud. It provides command-line interface (CLI), REST API, and Python·JavaScript libraries under an MIT license. The source code is written in Go (`go.mod`, `main.go` confirm this). The `README.md` also mentions that it was built on top of llama.cpp. Understanding what these statements mean in the actual code is the core focus of this article. For what an LLM is, see [details → LLM](#/post/ai-llm).

## Directory Structure

I've listed only the top-level folders necessary to understand the flow.

| Folder | Purpose |
|---|---|
| `main.go`, `cmd/` | Execution entry points. Uses cobra to create commands like `serve`, `run`, and `pull`. |
| `server/` | HTTP routing (`routes.go`), model scheduler (`sched.go`), model assembly (`images.go`), and prompt generation (`prompt.go`). |
| `llm/` | Spawns the inference process and handles conversation (`server.go`, `llama_server.go`). |
| `manifest/` | Rules for storing model manifests and blobs (files). |
| `api/` | Request/response types and clients. |
| `openai/`, `anthropic/`, `middleware/` | Converts incoming requests compatible with OpenAI·Anthropic APIs into the Ollama format. |
| `envconfig/` | Collection of `OLLAMA_*` environment variables. |
| `discover/`, `ml/` | GPU detection and device/memory information. |
| `llama/` | Contains a pinned version of llama.cpp source with compatibility patches (`compat/`). |
| `mlxrunner/`, `mlx/` | Separate execution path based on Apple's MLX. |

The `llama/` folder does not contain the entire llama.cpp source code. Instead, the `LLAMA_CPP_VERSION` file pins a tag like `b11963`, and during the build process, the source is fetched and patched via `llama/compat/`. (See `llama/README.md` for details). I recall that in earlier versions, the source was copied directly into the repository, but this is not the case at this point in time.

## Core Flow: The Path of a Single Request

Running `ollama serve` triggers `RunServer` in `cmd/cmd.go`, which opens port 11434 and calls `server.Serve`. Here, the router and scheduler are initialized together. A single request flows through as follows:

```
클라이언트 → (gin 라우터) /api/chat
  → ChatHandler            (server/routes.go)
  → scheduleRunnerForModel → sched.getRunner   (server/sched.go)
  → [없으면] 스케줄러가 load() → llama-server 프로세스 실행
  → chatPrompt()           템플릿으로 메시지를 프롬프트 문자열로
  → runner.Completion()    llama-server에 HTTP로 전달, 토큰을 스트리밍으로 받음
  → 클라이언트에 JSON 조각으로 전달
```

### 1. Routing

`GenerateRoutes()` registers paths with the Gin router. `/api/generate`, `/api/chat`, and `/api/embed` are Ollama-specific endpoints, while `/v1/chat/completions`, `/v1/embeddings`, `/v1/responses`, and `/v1/messages` are compatibility endpoints. Interestingly, all compatibility paths ultimately route to the same `ChatHandler`. The `middleware.ChatMiddleware` converts OpenAI formats into Ollama formats for requests and reverses this conversion for responses. Regardless of the format, there is only one core logic.

### 2. Model Lookup and Scheduling

The `ChatHandler` parses the request and calls `scheduleRunnerForModel`. This function checks whether the model supports required capabilities (such as vision or tool calling) using `CheckCapabilities`, combines options, and passes the request to `sched.getRunner`.

Inside `getRunner`, the flow branches. If the model is already loaded (`s.loaded[key]`) and does not need reloading (`needsReload`), it uses that runner immediately. Otherwise, it places the request into the `pendingReqCh` channel. If the channel is full, it returns `ErrMaxQueue` ("server busy..."). The default queue limit is defined by `OLLAMA_MAX_QUEUE`, set to 512.

Pending requests are processed sequentially by a single goroutine named `processPending`. As noted in the comment: "Block other requests until we get this pending request running," indicating that model loading happens serially, one at a time. The processing order is roughly as follows:

- If no models are loaded, it immediately loads them using `load()`.
- If models exist, it first checks whether a new model can be added via `load(..., requireFull=true)`. If not, it returns true, and the scheduler selects models to unload using `findRunnerToUnload`, setting their `sessionDuration=0` to expire them. After unloading (`unloadedCh`), it retries.
- The maximum number of models that can be loaded simultaneously is set by `OLLAMA_MAX_LOADED_MODELS`; if 0, it's automatic. In automatic mode, it calculates 3 models per GPU (`defaultModelsPerGPU = 3`).

### 3. What Happens When Loading a Model

`load()` sets `numParallel` (default 1). Embedding models are fixed at 1, and certain architecture names (qwen3vl, qwen35, lfm2, nemotron_h, etc.) that do not support parallelism are also lowered to 1. Next, it creates a runner object using `llm.NewLlamaServer` and calls `Load`.

The actual process startup is handled by `startLlamaServer` in `llm/llama_server.go`, which finds an available port (via `ResolveTCPAddr("localhost:0")`) and executes `exec.Command` with arguments like this.

```
llama-server --model <GGUF 경로> --port <빈 포트> --host 127.0.0.1 --no-webui --offline ...
```

Options such as the number of GPU layers (`-ngl`), thread count (`-t`), flash attention, KV cache type, and context shift (`--context-shift`) are appended conditionally. Afterward, it pings `/health` until the server is ready (`getServerStatus`). One comment in this file well explains this structure: "All GGUF models are served via the upstream llama-server subprocess." At this point, all GGUF models run as llama-server subprocesses.

Thus, the `llm.LlamaServer` interface (including `Completion`, `Chat`, `Embedding`, `Tokenize`, etc.) marks the boundary between Ollama and the inference engine. The Ollama core only knows about this interface and is designed to be agnostic to whether llama-server or an MLX runner runs in the background.

### 4. How Memory Is Allocated

There is a lengthy block of memory calculation code near `load()`. It checks available GPU memory and uses `selectLlamaServerPlacement` to decide which GPU to use and whether to concentrate the model on a single GPU. If the user doesn't specify `num_ctx`, the default value is determined based on VRAM size (in the `switch` inside `Serve`, values like 262144 appear when VRAM exceeds 47GiB). If loading fails due to out-of-memory, `reduceAutoNumCtxForLoadOOM` reduces the context or batch size and retries. This code automatically adjusts for the issue discussed in [the "larger windows mean larger KV caches" section](#/post/ai-context-window), where Ollama dynamically manages this via this logic.

### 5. Prompt Construction and Response Delivery

Once a model is loaded, `chatPrompt` (`server/prompt.go`) converts the message list into a single string by inserting it into the model template. It also truncates old messages if the context exceeds limits. Tool definitions and thinking settings are also applied at this stage. The resulting string is sent to llama-server via HTTP through `r.Completion`, and as tokens stream back, callback functions pass JSON fragments to the client. The file also includes a direct route (`r.Chat`) that calls `/v1/chat/completions`, allowing for the use of llama-server-side chat templates (jinja) depending on the model.

### 6. Unloading

When a request finishes, a signal is sent via `finishedReqCh`, and `processCompleted` decrements the reference count (`refCount`). If it reaches 0, the `sessionDuration` timer is triggered. The default duration is 5 minutes (from `OLLAMA_KEEP_ALIVE`'s default, `envconfig.KeepAlive`). Once the timer expires, `unload()` calls `llama.Close()` to terminate the subprocess. If `keep_alive: 0` is provided in the request, the model unloads immediately upon completion. This explains why the first call to a model is slow while subsequent ones are faster.

## How Are Model Files Stored

Models pulled via `ollama pull` are stored similarly to Docker images. Opening `~/.ollama/models/manifests/registry.ollama.ai/library/bge-m3/latest` on your PC reveals a JSON manifest containing a `layers` array with entries like `application/vnd.ollama.image.model` (approximately 1.16GB) and `...license`, each accompanied by a sha256 hash. The actual files reside in `blobs/sha256-...`. These media type constants (model, projector, adapter, template, system, etc.) are defined in `manifest/layer.go`. When multiple models share the same layer, it is stored only once. Since templates and system prompts are also layers, weights are not copied when creating a new model via a `Modelfile`.

<details>
<summary>Example: Models with the same name are uploaded differently each time (needsReload)</summary>

`runnerRef.needsReload` compares whether an already-uploaded runner matches the current request. If request options (such as `num_ctx`) have changed, if adapter or projector paths differ, or if the runner process has died, it is treated as needing a re-upload. Consequently, even with the same model name, changing `num_ctx` on every call may cause continuous reloading and slower performance. This is an estimation derived from the items this function compares; actual loading times were not measured.

</details>

## Common Misconceptions

- Ollama performs inference using its own engine: At this point in the source code, GGUF models are computed by the llama-server process. Ollama handles management, scheduling, and API interfacing. The MLX runner for Apple Silicon (`mlxrunner/`) exists via a separate path.
- Once a model is pulled, it remains in memory indefinitely: By default, it is evicted after 5 minutes. The list shown by `ollama ps` reflects only currently loaded models.
- High concurrent requests automatically improve speed: The default for `OLLAMA_NUM_PARALLEL` is 1, and some architectures force the code to 1. If the queue overflows, errors occur. Service-oriented serving structures are covered in detail in [AI Serving →](#/post/infra-ai-serving) and [vLLM Analysis →](#/post/repo-vllm).
- Compatibility with OpenAI means internal implementation follows OpenAI methods: The compatibility layer is front-end middleware; internally, everything is unified to the Ollama format.

## After Reading

The project, which seemed to be an inference engine, is actually a "Model Manager + Memory Scheduler + API Translator". For details on inference, continue reading [llama.cpp Analysis →](#/post/repo-llama-cpp). This article covers the server-side flow as well.

## Reference Links

- Ollama Repository: https://github.com/ollama/ollama (README, MIT License; source cloned and read as of 2026-10-31)
- `server/routes.go`, `server/sched.go`, `llm/server.go`, `llm/llama_server.go`, `envconfig/config.go`, `manifest/layer.go`, `llama/README.md` (all within the above repository; verified by opening directly)

← Related articles: [llama.cpp Analysis](#/post/repo-llama-cpp) · [vLLM Analysis](#/post/repo-vllm) · [AI Serving](#/post/infra-ai-serving)