Ollama のソースコードをダウンロードし、リクエストが来て回答が出るまでの流れを追跡しました。結論から述べると、推論計算は別プロセス（`llama.cpp` の `llama-server`）が行い、Ollama はその前にモデルファイルを管理しメモリを計算していつアップロード・ダウンロードするかを決定する Go サーバーです。

基準は 2026-10-31 の main ブランチ（コミット c1db5f9）です。このリポジトリは変化が激しいため、以下のファイル名や関数名はこの時点でのものです。

## プロジェクトとは何か

GitHub 上の紹介では、「ローカルまたはクラウドでオープンソースモデルを実行するためのツール」とされています。コマンドラインインターフェース (CLI)、REST API、Python・JavaScript ライブラリを提供し、ライセンスは MIT です。ソースコードは Go で書かれています（`go.mod` や `main.go` がそれを示しています）。`README.md` には `llama.cpp` の上に構築されたとも記載されています。この「どのように実装されているか」が今回の記事の核心です。LLM とは何かについては [詳細 → LLM](#/post/ai-llm) を参照してください。

## ディレクトリ構造

最上位フォルダのうち、流れを理解するために必要なもののみを抽出しました。

| フォルダ | 役割 |
|---|---|
| `main.go`, `cmd/` | 実行エントリーポイント。Cobra を用いて `serve`、`run`、`pull` などのコマンドを作成します |
| `server/` | HTTP ルーティング (`routes.go`)、モデルスケジューラ (`sched.go`)、モデルアセンブリ (`images.go`)、プロンプト生成 (`prompt.go`) |
| `llm/` | 推論プロセスを起動し対話を行う側 (`server.go`, `llama_server.go`) |
| `manifest/` | モデルマニフェストとブロープ（ファイル）の保存ルール |
| `api/` | リクエスト・レスポンスタイプ、クライアント |
| `openai/`, `anthropic/`, `middleware/` | OpenAI や Anthropic 互換 API から来たリクエストを Ollama 形式に変換します |
| `envconfig/` | `OLLAMA_*` 環境変数の集まり |
| `discover/`, `ml/` | GPU 検出、デバイス・メモリ情報 |
| `llama/` | `llama.cpp` バージョンの固定と互換性パッチ (`compat/`) |
| `mlxrunner/`, `mlx/` | Apple MLX ベースの別の実行パス |

`llama/` フォルダには `llama.cpp` のソースコードがそのまま入っていません。`LLAMA_CPP_VERSION` ファイルが `b11963` などのタグを固定し、ビルド時にそのソースを取得して `llama/compat/` のパッチを適用する方式です（`llama/README.md` に説明があります）。以前はソースをコピーして入れていたようですが、この時点のソースではそのような仕組みではありません。

## コアフロー：1 つのリクエストが通る道

`ollama serve` を実行すると `cmd/cmd.go` の `RunServer` が 11434 ポートを開放し `server.Serve` を呼び出します。ここでルーターとスケジューラが同時に作成されます。1 つのリクエストは以下のように進みます。

```
클라이언트 → (gin 라우터) /api/chat
  → ChatHandler            (server/routes.go)
  → scheduleRunnerForModel → sched.getRunner   (server/sched.go)
  → [없으면] 스케줄러가 load() → llama-server 프로세스 실행
  → chatPrompt()           템플릿으로 메시지를 프롬프트 문자열로
  → runner.Completion()    llama-server에 HTTP로 전달, 토큰을 스트리밍으로 받음
  → 클라이언트에 JSON 조각으로 전달
```

### 1. ルーティング

`GenerateRoutes()` が Gin ルーターにパスを登録します。`/api/generate`、`/api/chat`、`/api/embed` は Ollama 固有のパスであり、`/v1/chat/completions`、`/v1/embeddings`、`/v1/responses`、`/v1/messages` は互換パスです。興味深いのは、互換パスも結局同じ `ChatHandler` に到達する点です。前面に `middleware.ChatMiddleware` が OpenAI 形式を Ollama 形式に変換し、レスポンスは逆に変換します。形式が複数あってもコアロジックは 1 つしかないことになります。

### 2. モデル検索とスケジューリング

`ChatHandler` はリクエストをパースし `scheduleRunnerForModel` を呼び出します。この関数はモデルが必要な機能（ビジョン、ツール呼び出しなど）をサポートしているか `CheckCapabilities` で確認し、オプションを合成した後、要求を `sched.getRunner` に渡します。

`getRunner` では分岐が発生します。すでにロードされているモデル (`s.loaded[key]`) であり、再アップロードが必要ない (`needsReload`) 場合はそのランナーをそのまま使用します。あるいは要求を `pendingReqCh` チャンネルに投入します。チャンネルが満杯になると `ErrMaxQueue` ("server busy...") を返します。デフォルトのキューサイズは `OLLAMA_MAX_QUEUE` が 512 です。

待機中の要求は `processPending` という 1 つのゴルーチンが順番に処理します。コメントには "Block other requests until we get this pending request running" とあり、ロードは 1 回に 1 つずつシリアルに行うことがわかります。処理順序は概ね以下の通りです。

- If no model is uploaded, it is immediately loaded using `load()`.
- If one exists, it first checks whether a new model can be included via `load(..., requireFull=true)`. If not, it returns true; the scheduler then selects a model to unload using `findRunnerToUnload`, sets its `sessionDuration=0` to expire it, and retries after it is unloaded (`unloadedCh`).
- The maximum number of models that can be loaded simultaneously is set by `OLLAMA_MAX_LOADED_MODELS`; if 0, it is automatic. In automatic mode, the calculation assumes 3 models per GPU (`defaultModelsPerGPU = 3`).

### 3. What happens when loading a model

`load()` sets `numParallel` (default 1). Embedding models are fixed at 1, and certain architecture names (qwen3vl, qwen35, lfm2, nemotron_h, etc.) do not support parallelism, so their value is lowered to 1. Next, a runner object is created via `llm.NewLlamaServer`, and `Load` is called.

The actual process launch is handled by `startLlamaServer` in `llm/llama_server.go`. It finds an available port (e.g., using `ResolveTCPAddr("localhost:0")`) and executes `exec.Command` with arguments like this.

```
llama-server --model <GGUF 경로> --port <빈 포트> --host 127.0.0.1 --no-webui --offline ...
```

Options such as the number of GPU layers (`-ngl`), thread count (`-t`), flash attention, KV cache type, and context shift (`--context-shift`) are appended conditionally. Subsequently, it waits for readiness by polling `/health` until the server is prepared (`getServerStatus`). One comment in this file clearly explains this structure: "All GGUF models are served via the upstream llama-server subprocess." At this point, all GGUF models run as llama-server subprocesses.

Therefore, the `llm.LlamaServer` interface (including methods like `Completion`, `Chat`, `Embedding`, `Tokenize`, etc.) serves as the boundary between Ollama and the inference engine. The Ollama core only knows this interface; it is implemented regardless of whether llama-server or an MLX runner runs in the background.

### 4. How memory is allocated

There is a lengthy block of memory calculation code near `load()`. It examines available GPU memory to decide which GPU to use via `selectLlamaServerPlacement`, and whether to concentrate all models on a single GPU if so. If the user does not specify context length (`num_ctx`), a default value is set based on VRAM size (e.g., 262144 appears in the `switch` inside `Serve` when VRAM is ≥ 47GiB). If loading fails due to memory shortage, `reduceAutoNumCtxForLoadOOM` reduces the context or batch size and retries. The issue discussed in [the "larger window means larger KV cache" section](#/post/ai-context-window) is automatically adjusted by Ollama through this code.

### 5. Prompt construction and response delivery

Once a model is loaded, `chatPrompt` (`server/prompt.go`) converts the message list into a single string by inserting it into the model template. If the context exceeds limits, older messages are trimmed here. Tool definitions and thinking settings are also applied at this stage. The resulting string is sent to llama-server via HTTP through `r.Completion`, and as tokens stream back, the callback function streams JSON fragments to the client. The file also includes a direct path to `/v1/chat/completions` (`r.Chat`), allowing the use of llama-side chat templates (jinja) depending on the model.

### 6. Unloading

After a request completes, a signal is sent via `finishedReqCh`, and `processCompleted` decrements the reference count (`refCount`). When it reaches 0, the `sessionDuration` timer is triggered. The default duration is 5 minutes (the default for `OLLAMA_KEEP_ALIVE` and `envconfig.KeepAlive`). Once the timer expires, `unload()` calls `llama.Close()` to terminate the subprocess. If `keep_alive: 0` is specified in the request, the model unloads immediately upon completion. This is why the first invocation of a model is slow while subsequent ones are fast.

## How are model files stored

`ollama pull`로 가져온 모델은 도커 이미지와 유사하게 저장됩니다. 내 PC에서 `~/.ollama/models/manifests/registry.ollama.ai/library/bge-m3/latest`를 열어 보면 JSON 매니페스트가 있으며, `layers` 배열에는 `application/vnd.ollama.image.model`(약 1.16GB), `...license`와 같은 레이어가 sha256 해시와 함께 기록되어 있습니다. 실제 파일은 `blobs/sha256-...`에 위치합니다. `manifest/layer.go`에는 이 미디어 타입 상수(model, projector, adapter, template, system 등) 가 정의되어 있습니다. 동일한 레이어를 여러 모델이 공유하면 한 번만 저장됩니다. 템플릿과 시스템 프롬프트도 레이어이므로 `Modelfile`로 모델을 새로 생성해도 가중치는 복사되지 않습니다.

<details>
<summary>예시: 같은 이름의 모델이 매번 다르게 올라가는 경우 (needsReload)</summary>

`runnerRef.needsReload`는 이미 올라간 러너가 이번 요청과 일치하는지 비교합니다. 요청 옵션(`num_ctx` 등) 이 변경되었거나, 어댑터·프로젝터 경로가 다르거나, 러너 프로세스가 종료된 상태라면 다시 올린 것으로 간주합니다. 따라서 같은 모델 이름이라도 호출마다 `num_ctx` 를 변경하면 계속 재로딩되어 느려질 수 있습니다. 이는 해당 함수에서 비교 항목을 읽어 낸 추정치이며, 실제 로딩 시간은 테스트하지 않았습니다.

</details>

## 흔한 오해

- Ollama 가 자체 엔진으로 추론한다: 이 시점 소스에서는 GGUF 모델은 llama-server 프로세스가 계산합니다. Ollama 는 관리·스케줄링·API 처리를 담당합니다. 애플 실리콘용 MLX 러너(`mlxrunner/`)는 별도의 경로로 존재합니다.
- 모델을 한 번 받으면 항상 메모리에 있다: 기본 5 분 뒤에는 내려갑니다. `ollama ps`에서 보이는 목록은 현재 올라가 있는 모델만 표시됩니다.
- 동시 요청이 많으면 알아서 빨라진다: `OLLAMA_NUM_PARALLEL` 의 기본값은 1이며, 일부 아키텍처는 코드를 1 로 강제합니다. 대기열이 넘치면 에러가 발생합니다. 서비스용 서빙 구조는 [자세히 → AI 서빙](#/post/infra-ai-serving) 과 [자세히 → vLLM 분석](#/post/repo-vllm) 에서 다룹니다.
- OpenAI 호환이라서 내부도 OpenAI 방식이다: 호환 레이어는 앞쪽 미들웨어이며, 내부에서는 Ollama 형식으로 통일됩니다.

## 읽고 나서

엔진인 줄 알았던 프로젝트가 사실은 "모델 관리자 + 메모리 스케줄러 + API 변환기"였습니다. 추론 쪽이 궁금하다면 [자세히 → llama.cpp 분석](#/post/repo-llama-cpp) 으로 이어서 보아야 합니다. 이 글은 서버 쪽 흐름까지 다룹니다.

## 근거 링크

- Ollama 저장소: https://github.com/ollama/ollama (README, MIT 라이선스, 2026-10-31 기준 소스를 clone 해서 읽음)
- `server/routes.go`, `server/sched.go`, `llm/server.go`, `llm/llama_server.go`, `envconfig/config.go`, `manifest/layer.go`, `llama/README.md`(모두 위 저장소 안, 직접 열어 확인)

← 관련 글: [llama.cpp 분석](#/post/repo-llama-cpp) · [vLLM 분석](#/post/repo-vllm) · [AI 서빙](#/post/infra-ai-serving)