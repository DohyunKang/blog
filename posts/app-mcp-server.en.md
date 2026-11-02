An MCP server is a program that exposes functions with names and descriptions to the outside world. The official tutorial also creates a server with two weather inquiry tools. Since the specification itself is summarized in the [MCP](#/post/ai-mcp) article, this post focuses only on the flow of actually building and running it.

## What the Server Does

A server can expose three things: resources (data read like files), tools (functions called by the model), and prompts (pre-written templates). The official tutorial focuses primarily on tools, and so does this article.

The flow for calling a tool is as follows, based on the tutorial description:

| Step | What Happens |
| --- | --- |
| 1 | The client sends the user's question to the model |
| 2 | The model decides which tool to call by looking at the list of available tools |
| 3 | The client sends a tool invocation request to the MCP server |
| 4 | The server executes the function and returns the result |
| 5 | The result goes to the model, which responds with text |

The server does not talk directly to the model. There is always a client in front of the model, and the server only needs to respond to two requests: `tools/list` (give me the list) and `tools/call` (execute this). How the model selects tools is covered in the [tool invocation](#/post/ai-tool-use) article.

## What I Built

This is a server for saving and searching notes. It has two tools, and the storage backend is simply a dictionary. I deliberately built it without external APIs to understand the server structure without network complications.

The environment follows the official tutorial: creating a project with `uv` and installing `mcp[cli]`. The documentation requires Python 3.10+ and MCP Python SDK 2.0.0+. I installed it in a venv using pip, and version 2.3.0 was installed.

```python
# notes_server.py
import logging
from mcp.server import MCPServer

logging.basicConfig(level=logging.INFO)  # 로그는 stderr로 나간다
log = logging.getLogger(__name__)

mcp = MCPServer("notes")
NOTES: dict[str, str] = {}

@mcp.tool()
def add_note(title: str, body: str) -> str:
    """메모를 저장한다. 같은 제목이 있으면 덮어쓴다."""
    NOTES[title] = body
    log.info("saved %s", title)
    return f"저장함: {title}"

@mcp.tool()
def search_notes(keyword: str) -> list[str]:
    """제목이나 본문에 keyword가 들어간 메모의 제목 목록을 돌려준다."""
    return [t for t, b in NOTES.items() if keyword in t or keyword in b]

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

That is all the code. According to the tutorial description, `MCPServer` automatically generates tool definitions using Python type hints and docstrings. Therefore, function argument names and types become the input schema, and the docstring becomes the tool description. No separate JSON schema is used.

Ultimately, when a model selects a tool, it only sees the name, description, and arguments. If you write a docstring roughly, the tool will be selected roughly as well. I felt that this line in the server code was the most important part.

## Running and Verifying

`mcp.run(transport="stdio")` starts the server with standard input/output. When run directly, it waits for input without producing any output. The client launches this process and exchanges JSON-RPC messages via stdin/stdout.

Therefore, you should not use `print()` on stdout. As per the tutorial warning, writing to stdout breaks the JSON-RPC message and crashes the server. For logging, use the standard `logging` module and send logs to stderr. The `logging.basicConfig` in the code above defaults to stderr. It is stated that HTTP-style servers may write logs to stdout.

There are two ways to test:

First is a Python script that calls directly via the SDK client. I launched the server as a child process and tested listing tools and invoking them.

```python
# client_test.py
import asyncio, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command=sys.executable, args=["notes_server.py"])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
            for t in tools.tools:
                print(t.name, "|", t.description)
            print(await s.call_tool("add_note", {"title": "mcp", "body": "서버 만들기 공부"}))
            print(await s.call_tool("search_notes", {"keyword": "공부"}))

asyncio.run(main())
```

Upon execution, both tools appeared with descriptions; `add_note` returned "Saved: mcp", and `search_notes("공부")` returned `['mcp']`. The input schema also included argument names and `required` fields exactly as expected. Test automation is convenient with this approach. General principles of testing are covered in the [testing](#/post/be-testing) article.

Second is MCP Inspector, an official development tool launched via `npx @modelcontextprotocol/inspector <server run command>`. In the web interface, you can select tools, add arguments, invoke them, and view the exchanged JSON-RPC messages. The documentation states that Node 22.19.0+ is required, and there are also `--cli` and `--tui` modes for use without a browser. The debugging guide recommends using Inspector for standalone testing as the first step when the server fails to start.

## Connecting to Claude Desktop

To inform the client about the server, you use a configuration file. For Claude Desktop, write the server under the `mcpServers` key in `claude_desktop_config.json`. On Windows, the file location is `%AppData%\Claude\claude_desktop_config.json`. Adapting the tutorial example to my filename results in the following structure:

```json
{
  "mcpServers": {
    "notes": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\ABSOLUTE\\PATH\\TO\\notes",
        "run",
        "notes_server.py"
      ]
    }
  }
}
```

Paths must always be absolute. According to the debugging documentation, the working directory may not be set when the client starts the server, causing relative paths to break. Changes only take effect after saving and completely closing and restarting Claude Desktop; simply closing the window is insufficient. Upon restart, the server should appear in the connector menu of the input field. If it does not appear, check the logs (`%AppData%\Claude\logs`'s `mcp*.log`).

## How to return errors

The goal is for the model to read the reason when a tool fails and attempt to correct it. The specification divides errors into two categories: protocol errors, such as missing tool names or malformed requests, are returned as JSON-RPC errors. Tool execution errors, such as API failures, input value errors, or logic errors, should be returned with `isError: true` in the result, and the client is advised to pass this to the model so it can self-correct.

I checked how this actually appears in the SDK. When creating a tool that throws a standard `ValueError` when there is no note, I called it and indeed received `is_error=True`, but the message was only "Error executing tool get_note". The reason I wrote was not passed to the model. Looking at the docstring of the SDK source code, expected failures were supposed to throw a `ToolError`. I changed it accordingly.

```python
from mcp.server.mcpserver.exceptions import ToolError

@mcp.tool()
def get_note(title: str) -> str:
    """제목으로 메모를 읽는다."""
    raise ToolError(f"'{title}' 메모가 없다. search_notes로 먼저 찾아 봐라.")
```

The result content came back as "Error executing tool get_note: 'missing' note does not exist. Please search with search_notes first." If you include what to do next in the error message, the model can follow it directly. Unexpected exceptions are treated as crashes; only the name reaches the model, while the traceback remains in the server logs.

## Things to consider when creating

- Tool names should use only lowercase/uppercase English letters, digits, underscores, hyphens, and dots, as recommended by the specification (1–128 characters). Avoid spaces or commas.
- If you want to maintain state on the server, the specification recommends using handles. Since MCP has no session at the protocol level, states like a shopping cart should be created by a tool that returns an ID, and subsequent calls receive that ID as an argument. My note server uses a single global dictionary, so this approach does not apply; it's just for practice.
- Input validation is handled by the server. The specification's server security section includes input validation, access control, rate limiting on calls, and output sanitization.
- Human rejection must be possible. The specification states that there should be a step where a human approves or rejects before tool invocation. This is the client's responsibility to uphold, but those building servers must also be cautious when releasing dangerous tools like delete or send operations. Issues with instructions mixed into tool results are covered in the [prompt injection](#/post/sec-prompt-injection) article.
- Servers requiring keys for external services should pass them via the `env` in the configuration file; key management is a problem similar to [secret management](#/post/cloud-secrets).

## Common misconceptions

- The server calls the model: The server only responds to requests; it is the client that talks to the model.
- Debugging with print statements in server code is sufficient: In stdio servers, `print` breaks the protocol; use stderr for logs instead.
- Code changes are reflected immediately: Claude Desktop must be completely closed and restarted.
- Errors are automatically handled by throwing exceptions: Generic exceptions hide the reason. Expected failures should explicitly write the reason using `ToolError`. This behavior was confirmed in my custom SDK version 2.3.0.

← [Concept map](#/post/app-map)

Related articles: [MCP](#/post/ai-mcp) · [Tool invocation](#/post/ai-tool-use) · [Agent design](#/post/app-agent-design)

## Reference links

- Build an MCP server (official tutorial): https://modelcontextprotocol.io/docs/develop/build-server
- MCP Inspector: https://modelcontextprotocol.io/docs/tools/inspector
- Debugging: https://modelcontextprotocol.io/docs/tools/debugging
- Specification, tools: https://modelcontextprotocol.io/specification/latest/server/tools
- SDK executed directly: mcp 2.3.0 on PyPI (including ToolError docstring from source)