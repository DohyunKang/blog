MCP is an open standard that unifies how AI apps connect to external systems like files, databases, and search engines. The official documentation likens it to a "USB-C port for AI apps." Because the standard is unified, once a server is built, multiple apps can use it in the same way.

## What Problem Does It Solve?

Without MCP, each AI app would need custom code to connect to external services. If there are N apps and M services, there would be N×M connections. This calculation is not from the official documentation but my own summary. MCP introduces a common standard between them so that apps only need to know how to talk to MCP, and services only need to become MCP servers.

The official documentation lists these benefits from the user's perspective: developers save time and reduce complexity when building and integrating AI apps or agents; AI apps gain access to data and tool ecosystems; and end-users get apps that can do more. Supported platforms mentioned in the docs include Claude, ChatGPT, Visual Studio Code, and Cursor. Phrases like "build once, connect everywhere" also appear.

The scope is narrow. The architecture document states: "MCP focuses only on the protocol for exchanging context; it does not specify how AI apps use LLMs or how they manage received context." Which model calls what when is handled by the app side. This connects to [context](#/post/ai-context).

## Structure: Host, Client, Server

There are three participants.

| Name | Role | Example |
|---|---|---|
| MCP Host | AI app. Creates and manages clients. | Claude Code, Claude Desktop, VS Code |
| MCP Client | Maintains a connection to one server and passes received context back to the host. | An object inside the host |
| MCP Server | A program that provides context. | Filesystem server, Sentry server |

The core concept is that one client attaches to one server. The documentation's examples make this easy to understand. If VS Code connects to a Sentry MCP server, one client object is created; if it also connects to a local filesystem server, another client object is created.

```
호스트(AI 앱)
 ├─ 클라이언트 1 ── 서버 A (로컬: 파일시스템)
 ├─ 클라이언트 2 ── 서버 B (로컬: DB)
 └─ 클라이언트 3 ── 서버 C (원격: Sentry)
```

The term "server" can be confusing, but the documentation clarifies: a server refers to any program that provides context, regardless of where it runs. Running on your PC makes it a local server; running across the internet makes it a remote server.

### Two Layers: Data Layer and Transport Layer

- **Data Layer**: Based on JSON-RPC 2.0, it defines message structure and semantics. It includes discovery, tools/resources/prompts, and notifications.
- **Transport Layer**: The channel that actually carries messages. There are two options:
  - **stdio**: Processes within the same PC exchange data via standard input/output. No network overhead. Primarily used for local servers, usually interacting with one client.
  - **Streamable HTTP**: Uses HTTP POST and optionally includes Server-Sent Events. Designed for remote servers and typically handles multiple clients. Authentication uses bearer tokens or API keys; the documentation recommends OAuth for token issuance.

## Three Things a Server Provides

A server can provide three primitives. It's interesting that each has different rules about who decides how it's used.

| Type | What It Is | Example | Who Decides Usage (Spec Wording) |
|---|---|---|---|
| Tools | Executable functions | File operations, API calls, DB queries | model-controlled, called automatically by the model |
| Resources | Contextual data | File contents, DB records, schemas | application-driven, decided by how the host app inserts them |
| Prompts | Reusable templates | System prompts, few-shot examples | user-controlled, selected directly by the user |

Grouped by documentation examples: a database server could provide tools for querying, resources containing the schema, and prompts including few-shot examples of using those tools.

The documentation shows an example of exposing prompts via slash commands. Tools are called by the model, but the spec states: "There should always be a human in the loop to refuse actions (SHOULD)" for safety and trust. It advises showing which tools are exposed, indicating them when called, and requesting confirmation. However, the protocol does not enforce this interaction pattern, as noted in the same document.

All three use `*/list` endpoints to retrieve lists and support retrieval methods: `resources/read` for resources, `prompts/get` for prompts, and `tools/call` for tools. Since lists are dynamic, if tools change, the server sends a notification so the client can refresh its list.

<details>
<summary>Detailed explanation: Shape of tool call exchange</summary>

Here is an example of the architecture document summarized: First, sending `tools/list` returns a list of tools from the server. Each tool includes a `name`, `title`, `description`, and an `inputSchema` specifying the input format in JSON Schema.

```json
{ "method": "tools/call",
  "params": { "name": "weather_current",
              "arguments": { "location": "San Francisco", "units": "imperial" } } }
```

The response contains text, images, and other content in a `content` array. The specification divides tool execution errors into two categories: requests that are fundamentally incorrect, akin to unknown tools, return as JSON-RPC errors; while input or logic errors, such as incorrect date formats, are returned with `isError: true`. This allows the model to read the error, correct it, and retry.

The host-side flow follows the pseudocode in the document: when the model indicates it wants to use a tool, the app intercepts that call and forwards it to the appropriate server, then inserts the result back into the model's conversation.

Note that the document read here (marked as latest version 2026-07-28) describes an stateless approach where each request sends the protocol version and capabilities in `_meta`. Previous versions are known to have had an initialization step for negotiation at connection start.

</details>

## What the server requests from the client

There are also reverse-direction features. Based on the latest document, there is elicitation, where the server requests additional input or confirmation from the user. `sampling` (where the server requests completion from the client's LLM) and `logging` are marked as deprecated starting from this version. This section is subject to change between versions, so you must refer to the documentation for the specific version you are using.

## How does it differ from general function calling?

| | function calling | MCP |
|---|---|---|
| Nature | A way for model APIs to express tool calls | A connection standard between an app and external systems |
| Tool Definition | App code inserts them directly per request | Server informs via `tools/list` |
| Tool Execution | Implemented directly by the app | Executed by the server (can be remote, even across organizations) |
| Scope | Tools only | Tools, resources, and prompts |

The two are not in competition; they operate at different layers. The host passes the list of tools received from the MCP server to the model, and when the model issues a call, it is delivered to the server via `tools/call`. From the model's perspective, it is still a tool call; what has changed is where that tool originates. Since the document states "MCP does not dictate how AI apps use LLMs," the model API side remains untouched.

Therefore, the benefit lies not in "how to call tools within one app," but in "how an app and a tool creator can connect even without knowing each other."

## Security Considerations

Since MCP servers can execute code or read data, connecting to them is essentially granting permissions. Below are only the points highlighted in official security documentation and tool specifications.

- **Local Server Risks**: Configuration files may contain malicious startup commands, the server itself may contain malicious code, or a running local server could be probed via DNS rebinding. The document explicitly requires approval (MUST) for the actual command to be executed when connecting to a locally configured server and recommends running it with minimum privileges in a sandbox.
- **Token Pass-through Prohibited**: It is an anti-pattern for an MCP server to accept tokens issued for others and pass them directly to downstream APIs. The document states that servers must only accept tokens issued to themselves (MUST NOT accept others).
- **Confused Deputy**: If an MCP proxy server connecting to a third-party API overlaps fixed client IDs, dynamic client registration, or consent cookies, authentication codes can be stolen without user consent. Obtaining separate consent per client is essential.
- **SSRF**: Malicious servers could fill OAuth metadata URLs with internal network addresses or cloud metadata endpoints (e.g., 169.254.169.254), tricking the client into following them. Countermeasures include blocking private IPs and enforcing HTTPS.
- **Minimize Scope**: Receiving broad scopes like `files:*` or `admin:*` from the start increases damage if a token is leaked. It is recommended to start with small, read-only scopes and elevate privileges only when necessary.
- **Tool Specification Recommendations**: Servers must perform input validation, access control, call rate limiting, and output sanitization (MUST). Clients should obtain user confirmation for sensitive actions and display inputs to the user before sending them to the server (SHOULD). Tool annotations (metadata describing behavior) must not be trusted unless they come from a trusted server (MUST consider untrusted).

Since tool results and descriptions returned by the server ultimately enter the model's context, connecting only to trusted servers is the baseline understanding. This is my judgment after reading the document, rather than content explicitly written in it.

## Common Misconceptions

- MCP is not a tool; it's a standard for attaching tools. Tools are provided by servers.  
- Using MCP doesn't make the model smarter; the model remains unchanged—it simply gains access to more context and can perform more actions.  
- Servers aren't only remote: local servers running on your PC via stdio are common.  
- The standard provides guidance, but actual safety depends on choosing the server and the client's approval UI.  
- Tools exist, but so do resources and prompts. They seem less used besides tools, though that's just perception—I couldn't find statistics to confirm it.  

← [Concept map](#/post/ai-map)

Related posts: [Harness](#/post/ai-harness) · [Context](#/post/ai-context) · [Prompt](#/post/ai-prompt)

## Reference links

- MCP introduction: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP architecture overview: https://modelcontextprotocol.io/docs/learn/architecture
- Specification, tools: https://modelcontextprotocol.io/specification/latest/server/tools
- Specification, resources: https://modelcontextprotocol.io/specification/latest/server/resources
- Specification, prompts: https://modelcontextprotocol.io/specification/latest/server/prompts
- Security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices