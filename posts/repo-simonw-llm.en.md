# Reading the simonw/llm Source Code: An LLM CLI That Runs on Just a Few Plugins and a for Loop

One-sentence summary: Model invocation is consolidated into a single `Model.execute()` call, while the rest of the logic is structured around pluggy plugins and a `while` loop.

## What Is This Repo?

It's an LLM calling CLI and Python library created by simonw (Simon Willison). As of my last check (2026-11-02), it had approximately 12,000 stars, is licensed under Apache-2.0, and its last push was on October 30. Typing `llm "question"` invokes a model to answer, with the conversation history persisted in SQLite. Model types (e.g., OpenAI, local models) are extended via plugins.

I chose this project because it's described as having a small core, but upon opening it, I found that `llm/models.py` is 3,700 lines long and `llm/cli.py` is 147KB in size—not particularly small by line count. However, the limited number of files and their clear separation of responsibilities make it very readable.

## Directory Structure

I only examined the contents under `llm/`. (I did not look into `tests` or `docs`.)

- `__init__.py`: Contains utility functions for finding models (`get_model`), retrieving keys (`get_key`), handling aliases, and defining default models.
- `models.py`: The core module. Defines classes such as `Prompt`, `Response`, `Conversation`, `ChainResponse`, `Model`/`KeyModel`, `Tool`, and `Toolbox`.
- `cli.py`: Click-based command definitions.
- `hookspecs.py`: Specifies 6 hook points where plugins can intervene.
- `plugins.py`: Code for loading plugins.
- `default_plugins/`: Default bundled plugins, including `openai_models.py` (3,100 lines) and `default_tools.py`.
- `logs.py`, `migrations.py`: Handle SQLite logging.
- Other files include `embeddings.py`, `templates.py`, `parts.py`, `serialization.py`, `utils.py`, etc.

The small files are genuinely tiny. For instance, `errors.py` contains only three exceptions: `ModelError`, `NeedsKeyException`, and `ConversationNotSupported`.

## Core Flow

I traced the execution flow starting from typing `llm "hi"`. The entry point is the `prompt()` function in `cli.py`, and the high-level flow is as follows:

1. **Load Plugins**: `plugins.py`'s `load_plugins()` calls `pm.load_setuptools_entrypoints("llm")` to load plugins installed via setuptools entry points (group name "llm"). It then imports and registers two plugins listed in `DEFAULT_PLUGINS`: `openai_models` and `default_tools`.
2. **Find the Model**: `get_model(name)` looks up the model name in `get_model_aliases()`. This list is populated by calling `pm.hook.register_models`, where plugins register models via `register(model, aliases=...)`. User-defined aliases are read from `user_dir()/aliases.json` and added to the list. If no name is provided, `get_default_model()` reads `default_model.txt`; if that doesn't exist, it falls back to `DEFAULT_MODEL` (currently set to `"gpt-6-luna"` in the code).
3. **Find the Key**: `get_key()` follows a specific order: value provided via command-line arguments (or an alias from `keys.json`) → key stored in `keys.json` → environment variable.
4. **Create Prompt Object**: `Model.prompt()` packs the arguments into a `Prompt` object and returns a `Response`. At this stage, the model has not yet been called.
5. **Actual Invocation Happens Later**: The model is invoked when iterating over `Response.__iter__` or calling `.text()`. Specifically, `_force()` converts `list(self)`, which triggers `_iter_events()` to call `model.execute()` at that moment.
6. **Loop for Tool Calls**: If tool calls are present, `ChainResponse.responses()` invokes `execute_tool_calls()` for each response, passing the results to the next `Prompt` and calling the model again. The process ends when no more tool calls remain.
7. **Completion Hook**: Upon completion, `_on_done()` is called, which in turn invokes `log_to_db()`, saving the log via `LogStore(db).log(self)` to SQLite.

### Code Excerpt 1: Invocation via `execute()`

```python
class KeyModel(_Model):
    @abstractmethod
    def execute(self, prompt, stream, response, conversation, key):
        ...
```

This is the method the plugin implements. It simply needs to `yield` one string (or `StreamEvent`) at a time. Looking at OpenAI's `Chat.execute` (in `openai_models.py`), it runs `client.chat.completions.create(..., stream=True)` and yields delta text and tool call fragments. Since tool call arguments arrive in pieces via streaming, they were concatenated using `tool_calls[idx].function.arguments += ...`.

### Code Excerpt 2: The Identity of the Agent Loop

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

(models.py `ChainResponse.responses()`, shortened and moved.) What is referred to as the "agent" is just this single `while` loop. If a tool call exists in the response, it executes it, appends the result, and calls again; otherwise, it stops. The only thing preventing an infinite loop is `chain_limit`.

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

Even if a tool fails, the program doesn't crash; instead, a string like `"Error: ..."` is sent to the model as the result. It seems the intent was to allow the model to see the error and retry (the intention is inferred from code comments since there are none). If a non-existent tool name is called, it generates an error result like `'tool "x" does not exist'`. Conversely, `PauseChain` raises an exception outward without converting it to an error, allowing for human review before resuming later.

## Plugin Structure

`hookspecs.py` is about 30 lines and contains all the extension points:

- `register_commands(cli)`
- `register_models(register, model_aliases)`
- `register_embedding_models(register)`
- `register_template_loaders(register)`
- `register_fragment_loaders(register)`
- `register_tools(register)`

Built-in features follow the same pattern. `default_tools.py` essentially only calls `register(llm_version)` and `register(llm_time)` from `register_tools`, which is decorated with `@llm.hookimpl`. Creating a tool from a single function was done via `Tool.function()`. The function name becomes the tool name, the docstring provides the description, and the signature generates a JSON schema. Therefore, just having one line of docstring in `llm_time()` makes it a usable tool for the model.

## Thoughts After Reading

- Keeping responses as "objects executed later" was significant. Calling `prompt()` doesn't trigger network requests; data is only fetched when extracting text. Streaming, receiving all at once, and logging are all handled by a single `Response` object.
- I was surprised by how simple the tool loop actually is. Just a `while` loop without a framework. I realized that even my own agents could start with something this simple.
- On the other hand, `models.py` grew to 3,700 lines, likely due to almost copy-pasting sync/async pairs (`Response`/`AsyncResponse`, `ChainResponse`/`AsyncChainResponse`). The structure appeared that way upon reading.
- The default model being set to `gpt-6-luna` is written exactly as it was on the date this repository was read.

<details>
<summary>Detailed Explanation: How Response Executes Later</summary>

Inside `Response`, there are `_chunks` (received text fragments), `_done` (whether finished), and `_tool_calls`. The `__iter__` method yields `_chunks` directly if `_done` is true; otherwise, it receives from the model via `_iter_events()`, processes them through `_process_chunk()`, and yields them. Once complete, it records the conversation via `conversation._record_response(self)`, measures time, sets `_done = True`, and calls `_on_done()`. This ensures that reading the same response twice only triggers one network call.

`stream_events()` is for yielding events beyond just text, such as `tool_call_name`. According to comments, whichever of `__iter__` or `stream_events` runs first consumes the original generator; after completion, each regenerates from its own buffer.

`ChainResponse.__iter__` inserts a single space before and after when rounds change if there is no whitespace between them. Comments indicate this prevents issues like "...have dragons.Now that I..." where text gets concatenated improperly. This is for display purposes only and does not affect stored events.

At the beginning of `responses()`, there is also handling for continuation. If a previous conversation ends with a tool call that did not execute (was interrupted or paused), it executes from that point before starting the loop.
</details>

<details>
<summary>Detailed explanation: keys and settings file location</summary>

`user_dir()` uses the folder specified by the environment variable `LLM_USER_PATH` if it exists; otherwise, it uses `click.get_app_dir("io.datasette.llm")` and creates the folder if it does not exist. This directory contains `keys.json` (API keys), `aliases.json` (aliases), and `default_model.txt` (default model). The priority order for `get_key()` was originally stated in the code comments as "stored key overrides environment variables," meaning a stored key takes precedence over environment variables.

There is an environment variable `LLM_LOAD_PLUGINS` for plugin testing, which allows loading only the packages listed with commas. During testing (`sys._called_from_test`), installed plugins are not automatically loaded.
</details>

## Source links

- Repo: https://github.com/simonw/llm
- `llm/models.py`: https://github.com/simonw/llm/blob/main/llm/models.py (`ChainResponse.responses`, `Response.execute_tool_calls`, `KeyModel`)
- `llm/__init__.py`: https://github.com/simonw/llm/blob/main/llm/__init__.py (`get_model`, `get_key`, `user_dir`)
- `llm/plugins.py`: https://github.com/simonw/llm/blob/main/llm/plugins.py
- `llm/hookspecs.py`: https://github.com/simonw/llm/blob/main/llm/hookspecs.py
- `llm/default_plugins/openai_models.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/openai_models.py
- `llm/default_plugins/default_tools.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/default_tools.py
- `llm/cli.py`: https://github.com/simonw/llm/blob/main/llm/cli.py

(As of 2026-11-02, the main branch was read via the GitHub API; no clone was performed.)