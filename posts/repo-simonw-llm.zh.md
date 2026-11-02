# 阅读 simonw/llm 源码：一个仅由几个插件和 for 循环驱动的 LLM CLI

一句话总结：模型调用被封装在 `Model.execute()` 中，其余部分则通过 pluggy 插件机制和 `while` 循环构建而成。

## 这个仓库是做什么的

这是由 simonw（Simon Willison）开发的用于调用 LLM 的命令行工具及 Python 库。截至核查时间（2026-11-02），该仓库约有 12,000 个星标，采用 Apache-2.0 许可证，最后一次推送时间为 10 月 30 日。执行 `llm "问题"` 即可让模型回答，且所有记录会持久化到 SQLite 数据库中。支持不同模型类型（如 OpenAI、本地模型等）可通过插件扩展。

我最初是被其“轻量级核心”的描述吸引而选择阅读它，但打开后发现 `llm/models.py` 有 3,700 行代码，`llm/cli.py` 文件大小达 147KB，并不算小。不过由于文件数量较少且职责划分清晰，整体结构仍值得深入研读。

## 目录结构

仅查看了 `llm/` 目录下的内容（未查看 tests 和 docs）。

- `__init__.py`：包含公共函数，如查找模型 (`get_model`)、获取密钥 (`get_key`)、别名处理及默认模型设置等。
- `models.py`：核心模块。定义了 `Prompt`、`Response`、`Conversation`、`ChainResponse`、`Model`/`KeyModel`、`Tool`、`Toolbox` 等类。
- `cli.py`：基于 click 的命令接口。
- `hookspecs.py`：定义了 6 个插件可注册的钩子点。
- `plugins.py`：负责加载插件的代码。
- `default_plugins/`：内置默认插件目录，包含 `openai_models.py`（3,100 行）和 `default_tools.py`。
- `logs.py`、`migrations.py`：用于 SQLite 日志存储。
- 其他文件包括 `embeddings.py`、`templates.py`、`parts.py`、`serialization.py`、`utils.py` 等。

小文件确实非常精简。例如 `errors.py` 仅定义了三个异常类：`ModelError`、`NeedsKeyException` 和 `ConversationNotSupported`。

## 核心流程

追踪了执行 `llm "hi"` 时的完整流程。起点是 `cli.py` 中的 `prompt()` 函数，整体流程如下：

1. **加载插件**：`plugins.py` 中的 `load_plugins()` 通过 setuptools entry point（组名为 "llm"）调用 `pm.load_setuptools_entrypoints("llm")` 来加载已安装的插件。随后导入并注册 `DEFAULT_PLUGINS` 中列出的两个默认插件（openai_models 和 default_tools）。
2. **查找模型**：`get_model(name)` 在 `get_model_aliases()` 中查找模型名称。该列表由 `get_models_with_aliases()` 通过调用 `pm.hook.register_models` 收集，插件通过 `register(model, aliases=...)` 注册模型及其别名。用户自定义别名则从 `user_dir()/aliases.json` 读取并合并。若未指定模型名，则调用 `get_default_model()` 读取 `default_model.txt`；若无此文件，则使用 `DEFAULT_MODEL`（当前代码中为 `"gpt-6-luna"`）。
3. **查找密钥**：`get_key()` 的优先级顺序明确：命令行参数 → `keys.json` 中的别名 → 环境变量。
4. **创建 Prompt 对象**：`Model.prompt()` 将参数封装进 `Prompt` 对象，并返回一个 `Response` 对象。此时尚未真正调用模型。
5. **实际调用延迟执行**：当遍历 `Response.__iter__` 或调用 `.text()` 时，会触发 `_force()`，进而通过 `list(self)` 调用 `_iter_events()`，最终在此时才执行 `model.execute()`。
6. **工具调用循环**：若存在工具调用，`ChainResponse.responses()` 会对每个响应调用 `execute_tool_calls()`，将结果封装进下一个 `Prompt` 并再次调用模型。若无更多工具调用则流程结束。
7. **完成后处理**：流程结束后会触发 `_on_done()`，进而调用 `log_to_db()`，通过 `LogStore(db).log(self)` 将记录存入 SQLite。

### 代码摘录 1：调用仅由 `execute()` 完成

```python
class KeyModel(_Model):
    @abstractmethod
    def execute(self, prompt, stream, response, conversation, key):
        ...
```

这是模型插件需要实现的方法：逐个 `yield` 字符串（或 `StreamEvent`）即可。查看 OpenAI 侧的 `Chat.execute`（openai_models.py），它是通过运行 `client.chat.completions.create(..., stream=True)` 来 `yield` 增量文本和 tool call 片段。由于 tool call 参数是以流的形式分片传入，因此需要像 `tool_calls[idx].function.arguments += ...` 这样进行拼接。

### 代码摘录 2：Agent 循环的本质

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

(models.py 中的 `ChainResponse.responses()`，已简化中间部分并移入此处。) 所谓 Agent，不过就是这个 `while` 循环。如果有 tool call，则执行并将结果附加后再次调用；如果没有，则停止。防止无限循环的只有 `chain_limit` 这一个变量。

### 代码摘录 3：工具执行的异常处理

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

即使工具抛出异常，程序也不会崩溃，而是将 `"Error: ..."` 字符串作为结果发送给模型。看起来是希望模型看到错误后能重新尝试（由于代码中没有注释，这仅是我的推测）。如果调用不存在的工具，则会生成 `'tool "x" does not exist'` 这样的错误结果。相反，`PauseChain` 不会将其转换为异常，而是抛出到外部，以便在人工确认后继续后续流程。

## 插件结构

`hookspecs.py` 大约有 30 行，所有的扩展点都定义在这里：

- `register_commands(cli)`
- `register_models(register, model_aliases)`
- `register_embedding_models(register)`
- `register_template_loaders(register)`
- `register_fragment_loaders(register)`
- `register_tools(register)`

内置功能也采用相同的方式。`default_tools.py` 中，在带有 `@llm.hookimpl` 的 `register_tools` 里仅调用了 `register(llm_version)` 和 `register(llm_time)`。将单个函数注册为工具的是 `Tool.function()`。函数的名称作为工具名，docstring 作为描述，签名则用于生成 JSON Schema。因此，只要在 `llm_time()` 中添加一行 docstring，该函数即可成为模型可用的工具。

## 阅读后的思考

- 将响应设计为“稍后执行的对象”非常巧妙。调用 `prompt()` 时不会触发网络请求，只有在提取文本时才会发出。无论是流式传输、一次性接收还是日志记录，全部由同一个 `Response` 对象处理。
- 工具循环比我想象的简单得多，令人惊讶。无需框架，仅用一个 `while` 循环即可。我认为自己构建的 Agent 也可以从这个简单的起点开始。
- 另一方面，`models.py` 膨胀到 3,700 行，看起来是因为几乎通过复制粘贴保留了同步/异步对（`Response`/`AsyncResponse`、`ChainResponse`/`AsyncChainResponse`）。从结构上看确实如此。
- 默认模型设置为 `gpt-6-luna`，这是基于我阅读该存储库时的日期记录的。

<details>
<summary>详细解析：Response 延迟执行的方式</summary>

`Response` 内部包含 `_chunks`（接收到的文本片段）、`_done`（是否已完成）和 `_tool_calls`。`__iter__` 在 `_done` 为真时直接返回 `_chunks`，否则从模型获取数据并通过 `_iter_events()` 接收，再经过 `_process_chunk()` 处理后输出。全部执行完毕后，会调用 `conversation._record_response(self)` 将对话记录到上下文中，计时，并将 `_done` 设为 `True`，随后调用 `_on_done()`。因此，即使读取两次相同的响应，网络请求也只会发出一次。

`stream_events()` 不仅输出文本，还会输出如 `tool_call_name` 之类的事件。根据注释，在 `__iter__` 和 `stream_events` 中先执行的一方会消耗原始生成器，结束后双方各自将内容重放至各自的缓冲区。

`ChainResponse.__iter__` 会在轮次切换时，如果前后没有空格，则插入一个空格。注释中提到这是为了防止出现类似 `"...have dragons.Now that I..."` 这样粘连的情况。这仅用于显示，不会包含在存储的事件中。

`responses()` 的开头部分还包含续接处理。如果之前的对话以未执行的 tool call 结束（例如被中断或暂停的情况），则先从那里开始执行，然后再启动循环。
</details>

<details>
<summary>详细解析：密钥与配置文件位置</summary>

`user_dir()` 会优先检查环境变量 `LLM_USER_PATH`，如果存在则使用该文件夹；否则使用 `click.get_app_dir("io.datasette.llm")`，若该文件夹不存在则会自动创建。此目录下存放着 `keys.json`（密钥）、`aliases.json`（别名）和 `default_model.txt`（默认模型）。`get_key()` 的优先级顺序与代码注释一致，即“存储的密钥优先于环境变量”。换言之，已保存的密钥优先级高于环境变量。

存在用于插件测试的环境变量 `LLM_LOAD_PLUGINS`，通过逗号分隔可以仅加载指定的包。在测试期间（`sys._called_from_test`），不会自动加载已安装的插件。
</details>

## 参考链接

- 仓库：https://github.com/simonw/llm
- `llm/models.py`: https://github.com/simonw/llm/blob/main/llm/models.py (`ChainResponse.responses`, `Response.execute_tool_calls`, `KeyModel`)
- `llm/__init__.py`: https://github.com/simonw/llm/blob/main/llm/__init__.py (`get_model`, `get_key`, `user_dir`)
- `llm/plugins.py`: https://github.com/simonw/llm/blob/main/llm/plugins.py
- `llm/hookspecs.py`: https://github.com/simonw/llm/blob/main/llm/hookspecs.py
- `llm/default_plugins/openai_models.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/openai_models.py
- `llm/default_plugins/default_tools.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/default_tools.py
- `llm/cli.py`: https://github.com/simonw/llm/blob/main/llm/cli.py

（截至 2026-11-02，已通过 GitHub API 读取 main 分支，未进行克隆。）