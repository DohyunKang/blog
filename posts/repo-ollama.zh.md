下载并追踪了 Ollama 的源码，梳理了从接收请求到返回响应的完整流程。结论先行：推理计算由独立进程（llama.cpp 的 llama-server）负责，而 Ollama 则是一个 Go 语言编写的服务器，位于其前端，负责管理模型文件、计算内存占用，并决定何时加载或卸载模型。

基准版本为 2026-10-31 的 main 分支（提交 c1db5f9）。由于该仓库更新频繁，以下提及的文件和函数名称均以该时间点为准。

## 这是什么项目？

GitHub 上的介绍称其为在本地或云端运行开源模型的工具。它提供命令行界面 (CLI)、REST API 以及 Python/JavaScript 库，采用 MIT 许可证。源码使用 Go 编写（如 `go.mod` 和 `main.go` 所示）。`README.md` 中提到该项目构建于 llama.cpp 之上。本文的核心在于探讨这一描述在代码中的具体实现形式。有关 LLM 的详细介绍请参见 [详情 → LLM](#/post/ai-llm)。

## 目录结构

以下仅列出顶级目录中对于理解流程至关重要的部分。

| 文件夹 | 功能说明 |
|---|---|
| `main.go`, `cmd/` | 程序入口点。使用 cobra 库创建了 `serve`、`run`、`pull` 等命令 |
| `server/` | HTTP 路由 (`routes.go`)、模型调度器 (`sched.go`)、模型组装 (`images.go`)、提示词构建 (`prompt.go`) |
| `llm/` | 启动推理进程并进行对话 (`server.go`, `llama_server.go`) |
| `manifest/` | 模型清单与 Blob（文件）存储规则 |
| `api/` | 请求/响应类型定义及客户端代码 |
| `openai/`, `anthropic/`, `middleware/` | 将来自 OpenAI/Anthropic 兼容 API 的请求转换为 Ollama 格式 |
| `envconfig/` | 收集 `OLLAMA_*` 环境变量配置 |
| `discover/`, `ml/` | GPU 探测、设备及内存信息获取 |
| `llama/` | 固定 llama.cpp 版本并应用兼容补丁 (`compat/`) |
| `mlxrunner/`, `mlx/` | 基于 Apple MLX 的独立执行路径 |

注意：`llama/` 文件夹中并未直接包含完整的 llama.cpp 源码。通过 `LLAMA_CPP_VERSION` 文件固定标签（如 `b11963`），在构建时下载该源码并应用位于 `llama/compat/` 的补丁（详见 `llama/README.md`）。记忆中早期版本是直接复制源码放入，但当前版本已不再采用此方式。

## 核心流程：单个请求的流转路径

执行 `ollama serve` 后，`cmd/cmd.go` 中的 `RunServer` 会打开 11434 端口并调用 `server.Serve`，此时路由器和调度器也随之创建。单个请求的处理流程如下所示：

```
클라이언트 → (gin 라우터) /api/chat
  → ChatHandler            (server/routes.go)
  → scheduleRunnerForModel → sched.getRunner   (server/sched.go)
  → [없으면] 스케줄러가 load() → llama-server 프로세스 실행
  → chatPrompt()           템플릿으로 메시지를 프롬프트 문자열로
  → runner.Completion()    llama-server에 HTTP로 전달, 토큰을 스트리밍으로 받음
  → 클라이언트에 JSON 조각으로 전달
```

### 1. 路由分发

`GenerateRoutes()` 函数向 Gin 路由器注册路径。`/api/generate`、`/api/chat`、`/api/embed` 是 Ollama 特有的路径，而 `/v1/chat/completions`、`/v1/embeddings`、`/v1/responses`、`/v1/messages` 则是兼容路径。有趣的是，无论何种兼容路径，最终都会路由到同一个 `ChatHandler`。在 `middleware.ChatMiddleware` 中，入站请求被从 OpenAI 格式转换为 Ollama 格式，出站响应则反之转换。尽管存在多种格式，核心逻辑却只有一个。

### 2. 模型查找与调度

`ChatHandler` 解析请求后调用 `scheduleRunnerForModel`。该函数首先通过 `CheckCapabilities` 检查模型是否支持所需功能（如视觉处理、工具调用等），合并选项后将请求传递给 `sched.getRunner`。

在 `getRunner` 中，流程根据情况分叉：
- 如果模型已加载 (`s.loaded[key]`) 且无需重新加载 (`needsReload`)，则直接使用现有 Runner。
- 否则，将请求放入 `pendingReqCh` 通道。若通道已满，则返回 `ErrMaxQueue` ("server busy...") 错误。默认队列大小由 `OLLAMA_MAX_QUEUE` 设定为 512。

待处理的请求由单个 `processPending` 协程按顺序处理。注释中提到："Block other requests until we get this pending request running"（阻塞其他请求，直到当前待处理请求开始运行），这表明模型加载是串行进行的，一次只加载一个。处理顺序大致如下：

- 如果没有已加载的模型，则直接使用 `load()` 进行加载。
- 如果已有模型，则先通过 `load(..., requireFull=true)` 检查新模型是否可以一起加载。如果无法加载，则返回 true，调度器调用 `findRunnerToUnload` 选择要卸载的模型，并将其 `sessionDuration` 设置为 0 以使其过期。卸载后（`unloadedCh`）再次尝试。
- 同时可加载的模型数量由 `OLLAMA_MAX_LOADED_MODELS` 设定，若为 0 则自动计算。自动模式下，按每 GPU 3 个模型（`defaultModelsPerGPU = 3`）进行计算。

### 3. 加载时发生的过程

`load()` 会设定 `numParallel`（默认为 1）。嵌入模型固定为 1，某些架构名称（如 qwen3vl, qwen35, lfm2, nemotron_h 等）不支持并行处理，因此将其降低为 1。随后通过 `llm.NewLlamaServer` 创建运行器对象并调用 `Load`。

`llm/llama_server.go` 中的 `startLlamaServer` 实际负责启动进程。它会查找空闲端口（`ResolveTCPAddr("localhost:0")`），并以类似参数执行 `exec.Command`。

```
llama-server --model <GGUF 경로> --port <빈 포트> --host 127.0.0.1 --no-webui --offline ...
```

GPU 层数（`-ngl`）、线程数（`-t`）、Flash Attention、KV 缓存类型、上下文偏移（`--context-shift`）等选项也会根据条件添加。之后通过访问 `/health` 等待服务器准备就绪（`getServerStatus`）。该文件中的注释很好地说明了这一结构。`NewLlamaServer` 的描述为"All GGUF models are served via the upstream llama-server subprocess"。此时，所有 GGUF 模型均通过 llama-server 子进程运行。

因此，`llm.LlamaServer` 接口（包括 `Completion`, `Chat`, `Embedding`, `Tokenize` 等）构成了 Ollama 与推理引擎之间的边界。Ollama 主体仅知晓此接口，无论后台是 llama-server 还是 MLX 运行器在运行，其实现均不依赖具体后端。

### 4. 内存如何分配

在 `load()` 附近有一段较长的内存计算代码。它根据可用的 GPU 内存，通过 `selectLlamaServerPlacement` 决定将模型部署到哪个 GPU，以及是否将所有内容放入单个 GPU。如果用户未指定上下文长度（`num_ctx`），则会根据 VRAM 大小自动设定默认值（在 `Serve` 内部的 `switch` 中，若 VRAM ≥ 47GiB，则显示如 262144 等数值）。若在加载过程中因内存不足而崩溃，`reduceAutoNumCtxForLoadOOM` 会减小上下文或批处理大小并再次尝试。[详见 → 上下文窗口](#/post/ai-context-window) 中讨论的“窗口越大，KV 缓存越大”的问题，正是通过此代码由 Ollama 自动调节。

### 5. 构建提示词与传递响应

模型加载后，`chatPrompt`（`server/prompt.go`）会将消息列表填入模型模板，生成单个字符串。若上下文超出限制，此处也会截断旧消息。工具定义、思考（thinking）设置等也在此阶段应用。该字符串通过 `r.Completion` 以 HTTP 请求发送至 llama-server，令牌以流式方式返回时，回调函数将 JSON 片段逐块推送给客户端。文件中还包含直接调用 `/v1/chat/completions` 的路径（`r.Chat`），因此也存在根据模型使用 llama-server 侧聊天模板（jinja）的方法。

### 6. 卸载

请求结束后，信号发送至 `finishedReqCh`，`processCompleted` 会减少引用计数（`refCount`）。当计数降为 0 时，启动 `sessionDuration` 定时器。默认值为 5 分钟（即 `OLLAMA_KEEP_ALIVE` 的默认值，对应 `envconfig.KeepAlive`）。定时器到期后，`unload()` 会调用 `llama.Close()` 终止子进程。若在请求中设置 `keep_alive: 0`，则会在完成后立即卸载。首次调用模型较慢，后续调用较快，原因即在于此。

## 模型文件如何存储

通过 `ollama pull` 拉取的模型以类似于 Docker 镜像的方式存储。在本地 PC 上打开 `~/.ollama/models/manifests/registry.ollama.ai/library/bge-m3/latest`，可以看到 JSON 清单文件，其中 `layers` 数组列出了如 `application/vnd.ollama.image.model`（约 1.16GB）、`...license` 等层，并附带 sha256 哈希值。实际文件位于 `blobs/sha256-...`。这些媒体类型常量（包括 model、projector、adapter、template、system 等）在 `manifest/layer.go` 中定义。由于同一层可被多个模型共享，因此只需存储一次。模板和系统提示符也是层的一部分，因此即使通过 `Modelfile` 创建新模型，权重也不会被复制。

<details>
<summary>示例：同名模型每次上传内容不同（needsReload）</summary>

`runnerRef.needsReload` 用于比较已运行的推理器是否与当前请求匹配。如果请求选项（如 `num_ctx`）发生变化、适配器或项目器路径不同，或者推理器进程已终止，则视为需要重新加载。因此，即使模型名称相同，若每次调用都更改 `num_ctx`，会导致持续重新加载，从而变慢。此判断基于该函数从比较项中提取的推测，实际加载时间尚未验证。

</details>

## 常见误解

- Ollama 使用自身引擎进行推理：在此版本的源码中，GGUF 模型的计算由 llama-server 进程完成。Ollama 主要负责管理、调度和 API 转换。适用于 Apple Silicon 的 MLX 推理器（`mlxrunner/`）存在于独立路径中。
- 下载一次模型后始终驻留内存：默认情况下，5 分钟后会自动卸载。`ollama ps` 显示的列表仅为当前正在运行的模型。
- 并发请求增多会自动变快：`OLLAMA_NUM_PARALLEL` 的默认值为 1，部分架构的代码强制设为 1。若队列溢出则会产生错误。适用于服务的部署结构详见 [深入解析 → AI 服务](#/post/infra-ai-serving) 与 [深入解析 → vLLM 分析](#/post/repo-vllm)。
- 因兼容 OpenAI 而内部也采用 OpenAI 方式：兼容层仅位于前端中间件，内部统一采用 Ollama 格式。

## 阅读之后

原本以为是推理引擎的项目，实际上是一个“模型管理器 + 内存调度器 + API 转换器”。若对推理部分感兴趣，请继续参考 [深入解析 → llama.cpp 分析](#/post/repo-llama-cpp)。本文涵盖服务器端流程。

## 参考资料链接

- Ollama 仓库：https://github.com/ollama/ollama（README、MIT 许可证，截至 2026-10-31 克隆源码阅读）
- `server/routes.go`、`server/sched.go`、`llm/server.go`、`llm/llama_server.go`、`envconfig/config.go`、`manifest/layer.go`、`llama/README.md`（均位于上述仓库内，可直接打开查看）

← 相关文章：[llama.cpp 分析](#/post/repo-llama-cpp) · [vLLM 分析](#/post/repo-vllm) · [AI 服务](#/post/infra-ai-serving)