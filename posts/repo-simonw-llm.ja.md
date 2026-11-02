# simonw/llm 소스 읽기: 몇 개의 플러그인과 하나의 for 루프로 돌아가는 LLM CLI

한 줄 요약: 모델 호출은 `Model.execute()` 하나로 뭉뚱그리고, 나머지는 pluggy 플러그인과 `while` 루프로 붙여 둔 구조였다.

## 이 레포가 뭔지

simonw(Simon Willison) 가 만든 LLM 호출용 CLI이자 파이썬 라이브러리다. 확인한 시점 (2026-11-02) 에 별이 약 1 만 2 천 개였고 라이선스는 Apache-2.0, 마지막 push 는 10 월 30 일이었다. `llm "질문"`을 치면 모델이 답하고, 그 기록이 SQLite 에 쌓인다. 모델 종류 (OpenAI, 로컬 모델 등) 는 플러그인으로 늘린다.

작은 코어라는 말에 끌려 골랐는데, 막상 열어 보니 `llm/models.py` 가 3,700 줄, `llm/cli.py` 가 크기로 147KB 였다. 줄 수로 작지는 않았다. 다만 파일 종류가 적고 역할이 갈려 있어서 읽을 만했다.

## 디렉터리 구조

`llm/` 아래만 봤다. (tests, docs 는 열어 보지 않았다.)

- `__init__.py`: 모델 찾기 (`get_model`), 키 찾기 (`get_key`), 별칭, 기본 모델 같은 공용 함수
- `models.py`: 핵심. `Prompt`, `Response`, `Conversation`, `ChainResponse`, `Model`/`KeyModel`, `Tool`, `Toolbox`
- `cli.py`: click 기반 명령들
- `hookspecs.py`: 플러그인이 끼어들 수 있는 자리 6 곳
- `plugins.py`: 플러그인을 불러오는 코드
- `default_plugins/`: 기본 탑재 플러그인. `openai_models.py`(3,100 줄), `default_tools.py`
- `logs.py`, `migrations.py`: SQLite 로그 저장
- `embeddings.py`, `templates.py`, `parts.py`, `serialization.py`, `utils.py` 등

작은 파일은 정말 작다. `errors.py` 는 예외 세 개 (`ModelError`, `NeedsKeyException`, `ConversationNotSupported`) 가 전부였다.

## 핵심 흐름

`llm "hi"`를 쳤을 때를 따라가 봤다. cli.py 의 `prompt()` 함수가 출발점이고, 큰 흐름은 이랬다.

1. 플러그인 로드. `plugins.py` 의 `load_plugins()`가 setuptools entry point(그룹 이름 "llm")로 설치된 플러그인을 `pm.load_setuptools_entrypoints("llm")`로 부른다. 그다음 `DEFAULT_PLUGINS`에 적힌 두 개(openai_models, default_tools)를 import해서 등록한다.
2. 모델 찾기. `get_model(name)`이 `get_model_aliases()`에서 이름을 찾는다. 이 목록은 `get_models_with_aliases()`가 `pm.hook.register_models`를 호출해서 플러그인들이 `register(model, aliases=...)`로 넣은 것들이다. 사용자 별칭은 `user_dir()/aliases.json`에서 읽어 얹는다. 이름을 안 주면 `get_default_model()`이 `default_model.txt`를 읽고, 없으면 `DEFAULT_MODEL`을 쓴다(지금 코드엔 `"gpt-6-luna"`라고 적혀 있었다).
3. 키 찾기. `get_key()`는 순서가 정해져 있다. 명령줄로 준 값(또는 `keys.json`의 별칭) → `keys.json`에 저장된 키 → 환경변수.
4. 프롬프트 객체 만들기. `Model.prompt()`가 인자들을 `Prompt`에 담아 `Response`를 돌려준다. 이 시점엔 아직 호출 전이다.
5. 실제 호출은 늦게. `Response.__iter__`를 돌리거나 `.text()`를 부를 때 `_force()`가 `list(self)`로 돌려서 그때서야 `_iter_events()`가 `model.execute()`를 부른다.
6. 도구 호출이 있으면 루프. `ChainResponse.responses()`가 응답마다 `execute_tool_calls()`를 해서 결과를 다음 `Prompt`에 실어 다시 모델을 부른다. 도구 호출이 더 없으면 끝.
7. 끝나면 `_on_done()`이 불려서 `log_to_db()`가 `LogStore(db).log(self)`로 SQLite 에 저장한다.

### 코드 발췌 1: 호출은 `execute()` 하나로

```python
class KeyModel(_Model):
    @abstractmethod
    def execute(self, prompt, stream, response, conversation, key):
        ...
```

This is the method that the model plugin implements. It simply needs to `yield` one string (or `StreamEvent`) at a time. Looking at OpenAI's `Chat.execute` (in openai_models.py), it runs `client.chat.completions.create(..., stream=True)` and yields delta text and tool call fragments. Since tool call arguments arrive in pieces via streaming, they were concatenated using `tool_calls[idx].function.arguments += ...`.

### Code Excerpt 2: The Essence of the Agent Loop

```python
current_response = initial_response
while current_response:
    count += 1
    yield current_response
    if self.chain_limit and count >= self.chain_limit and current_response.tool_calls():
        raise ValueError(f"Chain limit of {self.chain_limit} exceeded.")
    tool_results = current_response.execute_tool_calls(...)
    if tool_results:
        current_response = Response(Prompt("", self.model, tools=..., tool_results=tool_results, messages=next_chain, ...), ...)
    else:
        current_response = None
        break
```

(models.py `ChainResponse.responses()`, shortened and moved.) What is referred to as the "agent" is just this single `while` loop. If there is a tool call in the response, it executes it, appends the result, and calls again; otherwise, it stops. The only thing preventing an infinite loop is `chain_limit`.

### Code Excerpt 3: Exception Handling for Tool Execution

```python
try:
    result = tool.implementation(**implementation_arguments)
    ...
except PauseChain as ex:
    raise
except Exception as ex:
    result = f"Error: {ex}"
    exception = ex
```

Even if a tool fails, the program doesn't crash; instead, a string like `"Error: ..."` is sent to the model as the result. It seems the intention was to allow the model to see the error and retry (the intent was inferred from comments since there were none in the code). If a non-existent tool name is called, it generates an error result `'tool "x" does not exist'`. Conversely, `PauseChain` is raised outward without being converted into an error, allowing for human intervention to resume later.

## Plugin Structure

`hookspecs.py` is about 30 lines long and contains all the extension points here:

- `register_commands(cli)`
- `register_models(register, model_aliases)`
- `register_embedding_models(register)`
- `register_template_loaders(register)`
- `register_fragment_loaders(register)`
- `register_tools(register)`

Built-in features follow the same pattern. `default_tools.py` essentially only calls `register(llm_version)` and `register(llm_time)` from `register_tools` decorated with `@llm.hookimpl`. Creating a function as a tool was done via `Tool.function()`. The function name becomes the tool name, the docstring becomes the description, and the signature generates a JSON schema. Therefore, just having a single line of docstring in `llm_time()` makes it a usable tool for the model.

## Thoughts After Reading

- Keeping the response as an "object to be executed later" was significant. Even calling `prompt()` doesn't trigger network traffic; characters are emitted only when extracted. Streaming, receiving all at once, and logging are all handled by a single `Response`.
- I was surprised that the tool loop is simpler than expected. Just a `while` loop without a framework. I realized my own agents could also start with something this simple.
- On the other hand, `models.py` grew to 3,700 lines, likely because sync/async pairs (`Response`/`AsyncResponse`, `ChainResponse`/`AsyncChainResponse`) were almost duplicated separately. Structurally, it appeared that way.
- The default model being set to `gpt-6-luna` is written exactly as of the date this repository was read.

<details>
<summary>Detailed Explanation: How Response Executes Later</summary>

Inside `Response`, there are `_chunks` (received text fragments), `_done` (whether it's finished), and `_tool_calls`. The `__iter__` method yields `_chunks` as-is if `_done` is true; otherwise, it receives from the model via `_iter_events()`, processes them through `_process_chunk()`, and yields them. Once all iterations are complete, it records the conversation via `conversation._record_response(self)`, measures the time, sets `_done = True`, and calls `_on_done()`. Therefore, reading the same response twice results in only one network call.

`stream_events()` is for emitting events such as `tool_call_name`, not just text. According to comments, whichever of `__iter__` or `stream_events` runs first consumes the original generator, and after completion, each regenerates from its own buffer.

`ChainResponse.__iter__` inserts a single space before and after when rounds change if there is no whitespace. Comments indicate this prevents things like `"...have dragons.Now that I..."` from sticking together. This is for display purposes only and does not enter stored events.

`responses()` の開始部には、続行処理も含まれています。以前の実行が完了していないツールコール（中断または一時停止された場合）で終わっている場合は、それを実行してからループを開始します。
</details>

<details>
<summary>詳細な解説：キーと設定ファイルの場所</summary>

`user_dir()` は、環境変数 `LLM_USER_PATH` が存在する場合はそのフォルダを、存在しない場合は `click.get_app_dir("io.datasette.llm")` を使用し、フォルダが存在しない場合は作成します。ここに `keys.json`（キー）、`aliases.json`（別名）、`default_model.txt`（デフォルトモデル）が格納されます。`get_key()` の優先順位はコードのコメント通り「保存されたキーが環境変数を上書き」でした。つまり、保存したキーの方が環境変数よりも優先されます。

プラグインのテスト用として `LLM_LOAD_PLUGINS` という環境変数が用意されており、カンマ区切りで指定したパッケージのみを読み込むことができます。テスト中（`sys._called_from_test`）には、インストールされたプラグインは自動的に読み込まれません。
</details>

## 参照リンク

- レポジトリ: https://github.com/simonw/llm
- `llm/models.py`: https://github.com/simonw/llm/blob/main/llm/models.py (`ChainResponse.responses`, `Response.execute_tool_calls`, `KeyModel`)
- `llm/__init__.py`: https://github.com/simonw/llm/blob/main/llm/__init__.py (`get_model`, `get_key`, `user_dir`)
- `llm/plugins.py`: https://github.com/simonw/llm/blob/main/llm/plugins.py
- `llm/hookspecs.py`: https://github.com/simonw/llm/blob/main/llm/hookspecs.py
- `llm/default_plugins/openai_models.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/openai_models.py
- `llm/default_plugins/default_tools.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/default_tools.py
- `llm/cli.py`: https://github.com/simonw/llm/blob/main/llm/cli.py

(2026-11-02 時点、main ブランチを GitHub API で読み込みました。clone は行っていません。)