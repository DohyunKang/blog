MCP 服务器是一个附带了名称和描述的函数列表并向外部暴露的程序。官方教程也创建了一个包含两个天气查询工具的服务器。规范本身已在 [MCP](#/post/ai-mcp) 文章中整理，因此本文仅记录实际构建和运行的流程。

## 服务器的工作内容

服务器可以提供的功能有三类：资源（类似文件的数据）、工具（模型调用的函数）和提示词（预先编写的模板）。官方教程主要围绕工具展开，本文也仅创建工具。

工具被调用的流程如下（基于教程说明）：

| 顺序 | 发生的事件 |
| --- | --- |
| 1 | 客户端将用户的问题发送给模型 |
| 2 | 模型查看可用的工具列表并决定调用哪个 |
| 3 | 客户端向 MCP 服务器发送工具调用请求 |
| 4 | 服务器执行函数并返回结果 |
| 5 | 结果进入模型，模型生成文本回答 |

服务器并不直接与模型对话。模型前方始终存在一个客户端，服务器只需响应 `tools/list`（请列出列表）和 `tools/call`（请执行此操作）这两个请求即可。模型如何选择工具详见 [工具调用](#/post/ai-tool-use) 文章。

## 构建示例

这是一个用于存储和搜索笔记的服务器。包含两个工具，存储库仅为一个简单的字典。特意在不使用外部 API 的情况下构建，以便仅观察服务器结构而不涉及网络问题。

环境配置遵循官方教程：使用 `uv` 创建项目并安装 `mcp[cli]`。文档要求 Python 3.10 及以上版本和 MCP Python SDK 2.0.0 及以上版本。我在虚拟环境中通过 pip 安装了库，最终安装了 2.3.0 版本。

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

代码仅此而已。根据教程说明，`MCPServer` 会自动利用 Python 类型提示和 docstring 定义工具。因此，函数的参数名称和类型成为输入模式（input schema），而 docstring 则作为工具描述。无需单独使用 JSON 模式。

模型选择工具时关注的最终只有名称、描述和参数。如果随意编写 docstring，模型也会大致做出相应选择。我认为服务器代码中最关键的行就在这里。

## 运行与验证

`mcp.run(transport="stdio")` 通过标准输入输出启动服务器。直接运行时不会有任何输出，仅等待输入。客户端启动此进程并通过 stdin/stdout 交换 JSON-RPC 消息。

因此不能在 stdout 中使用 `print()`。正如教程警告所述，在 stdout 上写入会导致 JSON-RPC 消息损坏并使服务器崩溃。日志应使用标准的 `logging` 模块并发送至 stderr。上述代码中的 `logging.basicConfig` 默认将日志输出到 stderr。对于 HTTP 方式的服务器，允许在 stdout 上写入日志。

测试分为两种。

第一种是通过 SDK 客户端直接调用的 Python 脚本。我将服务器作为子进程启动，并执行了列表查询和工具调用。

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

运行后，两个工具连同描述一同出现：`add_note` 返回 "已保存：mcp"，而 `search_notes("공부")`（即 `search_notes("学习")`）返回了 `['mcp']`。输入模式中也保留了参数名称和 `required` 字段。这种方式的测试自动化非常方便。关于测试的一般理论详见 [测试](#/post/be-testing) 文章。

第二种是 MCP Inspector。这是官方开发工具，可通过 `npx @modelcontextprotocol/inspector <服务器运行命令>` 启动。在 Web 界面中可以选择工具、输入参数并调用，同时查看往返的 JSON-RPC 消息。根据文档，需要 Node 22.19.0 及以上版本，同时也存在无需浏览器的 `--cli` 和 `--tui` 模式。调试指南将 Inspector 作为服务器无法启动时的首选独立测试手段。

## 连接到 Claude Desktop

向客户端告知服务器的信息位于设置文件中。Claude Desktop 在 `claude_desktop_config.json` 的 `mcpServers` 键下记录服务器。以 Windows 为例，文件位置为 `%AppData%\Claude\claude_desktop_config.json`。调整教程示例以匹配我的文件名后，内容如下：

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

路径必须使用绝对路径。根据调试文档，当客户端启动服务器时，工作目录可能未确定，导致相对路径失效。修改后需保存并完全关闭 Claude Desktop 再重新启动才能生效，仅关闭窗口是不够的。启动后，输入框的连接器菜单中应显示服务器；若未显示，请查看日志（位于 `%AppData%\Claude\logs` 下的 `mcp*.log`）。

## 如何返回错误

目标是：当工具执行失败时，让模型读取原因并自行修正重试。规范将错误分为两类：缺少工具名称或请求格式错误的协议类错误应返回 JSON-RPC 错误；而 API 调用失败、输入值错误或逻辑错误等工具执行类错误，则需在结果中附带 `isError: true`，并建议客户端将此信息传递给模型以自行修正。

我实际测试了 SDK 的表现。创建一个在缺少内存时抛出普通 `ValueError` 的工具并调用它，虽然返回了 `is_error=True`，但消息仅显示 "Error executing tool get_note"，我编写的具体原因并未传达给模型。查阅 SDK 源码的 docstring 后发现，预期的失败应抛出 `ToolError`。于是修改后重新测试。

```python
from mcp.server.mcpserver.exceptions import ToolError

@mcp.tool()
def get_note(title: str) -> str:
    """제목으로 메모를 읽는다."""
    raise ToolError(f"'{title}' 메모가 없다. search_notes로 먼저 찾아 봐라.")
```

结果 content 返回为："Error executing tool get_note: '없는거' 메모가 없다. search_notes 로 먼저 찾아 봐라."（错误执行工具 get_note：不存在名为'없는거'的笔记。请先用 search_notes 查找）。如果在错误信息中注明接下来该做什么，模型就能直接照做。对于未预期的异常，则被视为崩溃，仅将错误名称传给模型，而在服务器日志中保留堆栈跟踪。

## 开发时需注意的事项

- 工具名称：规范建议使用 1~128 个字符，仅限英文大小写字母、数字、下划线、连字符和点；避免使用空格或逗号。
- 若需在服务端维护状态，规范建议使用句柄（handle）。由于 MCP 协议本身不支持会话级别的状态管理，类似购物车的状态应由创建工具返回 ID，后续调用将该 ID 作为参数传入。我的笔记服务器采用全局字典实现，因此不适用此模式——这仅适用于练习场景。
- 输入验证由服务端负责：规范的“服务端安全”部分包含输入验证、访问控制、调用速率限制和输出清理等内容。
- 必须允许用户拒绝：规范指出在工具调用前应设置人工批准或拒绝环节。这是客户端需遵守的部分，但作为服务端开发者，对于删除、发送等危险操作的工具也需谨慎发布。关于混入工具结果中的指令注入问题，已在 [提示词注入](#/post/sec-prompt-injection) 文章中讨论。
- 需要外部服务密钥的服务器应通过设置文件中的 `env` 传递，密钥管理属于 [秘密管理](#/post/cloud-secrets) 范畴。

## 常见误解

- “服务器调用模型”：服务器仅响应请求；与模型对话的是客户端。
- “在服务器代码中使用 print 调试即可”：在 stdio 服务器中，print 会破坏协议，应使用 stderr 输出日志。
- “修改代码后立即生效”：Claude Desktop 需完全关闭后重新启动才能应用更改。
- “抛出异常即可自动传递错误信息”：普通异常会隐藏具体原因；预期的失败应通过 `ToolError` 明确提供原因。此行为基于我测试的 SDK 2.3.0 版本确认。

← [概念图谱](#/post/app-map)

相关文章：[MCP](#/post/ai-mcp) · [工具调用](#/post/ai-tool-use) · [智能体设计](#/post/app-agent-design)

## 参考链接

- Build an MCP server（官方教程）: https://modelcontextprotocol.io/docs/develop/build-server
- MCP Inspector: https://modelcontextprotocol.io/docs/tools/inspector
- Debugging: https://modelcontextprotocol.io/docs/tools/debugging
- 规范，工具：https://modelcontextprotocol.io/specification/latest/server/tools
- 自行测试的 SDK：PyPI 上的 mcp 2.3.0（包含源码中 ToolError 的 docstring）