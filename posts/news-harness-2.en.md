The Microsoft Agent Framework alternated between Python and .NET releases throughout October, revealing where the current agent framework is focusing its efforts: approvals, context compression, and MCP compatibility.

## What is this framework?

The GitHub repository description states it is "a framework for building, orchestrating, and deploying AI agents and multi-agent workflows." It supports both Python and .NET with an MIT license. The Go version resides in a separate repository (agent-framework-go), and the official overview document notes that it is in public preview and requires Go 1.26 or higher.

The documentation divides this framework into four components:

| Component | Function |
| --- | --- |
| Agents | Processes input via LLMs, invokes tools and MCP servers, and generates responses |
| Harness Agent | An agent designed for long, multi-step tasks that bundles planning, task tracking, context compression, file access with memory, tool approvals, and observability |
| Workflows | Functional and graph-based flows that connect agents and functions via explicit execution paths |
| Integrations | Connections to model providers, tools, context suppliers, middleware, evaluation, and UIs |

Model providers mentioned in the documentation include Microsoft Foundry, Anthropic, Azure OpenAI, OpenAI, and Ollama; it is not limited to Microsoft models.

## Relationship with Semantic Kernel and AutoGen

The documentation describes Agent Framework as a "direct successor" to two projects. The same team built it by combining Semantic Kernel's session-based state management, type safety, filters, and telemetry with AutoGen's simple agent abstraction, then adding workflows that explicitly define execution paths. Separate migration guides are also available in the documentation for transitioning from each project.

A table in the docs clarifies when to use agents versus workflows: use agents for open-ended conversations or autonomous tool usage, and use workflows when steps are predefined and you need to directly control the execution order. Below that is a line stating: "If something can be written as a function, use a function instead of an AI agent."

[Learn more → Harness](#/post/ai-harness)

## October Release List

I extracted only the October releases from the repository release page. Python versions are tagged with `python-`, while .NET versions use `dotnet-`.

| Tag | Date | Notable Changes |
| --- | --- | --- |
| dotnet-1.25.0 | 10/14 | Auto-reject tool approval requests that receive no response; closed-list questions (workflows) |
| python-1.22.0 | 10/15 | Support for Python 3.15 (core and root packages); change in saved state format |
| python-1.23.0 | 10/22 | MCP 2.x compatibility; authentication scope now required on AG-UI endpoints |
| dotnet-1.26.0 | 10/23 | Reject duplicate tool approval request IDs; validate MCP call headers |
| python-1.24.0 | 10/30 | Default approval mode for local MCP tools; experimental feature allowing agents to trigger context compression themselves |
| dotnet-1.27.0 | 10/30 | Updated AgentServer dependency; changes in redirect handling |

Although the release notes do not include the year, the document date is October 2026, so I interpreted this as being from that year. This table reflects what was observed on the release page at the time of writing (November 2).

## Interesting Changes Among the Updates

Three items stood out:

First is tool approval. On the .NET side, approval requests that receive no response are automatically rejected, and duplicate approval requests with the same ID are not accepted. On the Python side, a default approval mode has been introduced for local MCP tools. This suggests a shift toward adding more granular human checkpoints rather than allowing agents to use tools freely.

Second is MCP. With python-1.23.0 introducing MCP 2.x compatibility, changes were made to transmission methods, error handling, and lifecycle management. The release notes mark this as a breaking change, so code that integrates with MCP servers must read the notes before upgrading.

[Learn more → MCP](#/post/ai-mcp)

Third is context compression. In python-1.24.0, an experimental feature was added allowing agents to trigger their own compression and reduce skills. This aligns with the Harness Agent description in the overview document, which also mentions context compression.

[Learn more → Compaction](#/post/ai-compaction)

<details>
<summary>List of breaking changes only</summary>

- python-1.22.0: Content identification, hosted execution, protocol metadata, playback, and stream merging are now unified across all providers. Runtimes prior to 1.22 cannot read new records containing `hosted` or `merge_mode`. The documentation advises against running old and new workers together in the same repository and warns not to downgrade after using new records.
- python-1.23.0: The AG-UI endpoint now requires an explicit authentication scope or a single-user declaration. The Docker shell option `extra_run_args` has been renamed to `unsafe_extra_run_args`.
- python-1.24.0: The beta `RedisContextProvider` rejects the legacy index schema; you must delete and re-add both the old index and context hash. Python 3.11 is now the supported baseline, and Python 3.10 will be dropped in the next release.
- dotnet-1.25.0: Cosmos chat metadata has been decoupled from the partition key strategy.
- dotnet-1.27.0: In Foundry hosted apps, use `builder.AddFoundryResponses(...)`. Local durable response files created before an upgrade will not be read.

</details>

## If You Try It Yourself

The introductory examples in the overview documentation are just a few lines. Python is installed via `pip install agent-framework`, and an `Agent` is created by passing a client, name, and instructions to it. Execution is performed with `await agent.run("...")`. While the examples use the Foundry client, the structure allows swapping in other provider clients.

One notable note of caution: Python does not automatically read `.env` files, so you must explicitly call `load_dotenv()` at startup if you want to use them. Environment variables can also be set directly in the shell.

The release cycle is roughly weekly, and breaking changes are marked almost every time. If you don't pin your version, you'll likely need to read the changelog notes with each release. At the time of review (November 2), the repository had 14.5k stars.

[Read more → Agent Loop](#/post/ai-agent-loop)

← Concept map (#/post/ai-map)

Related posts: [Harness](#/post/ai-harness), [MCP](#/post/ai-mcp), [Compaction](#/post/ai-compaction)

## Reference Links

- [microsoft/agent-framework (GitHub)](https://github.com/microsoft/agent-framework)
- [Releases · microsoft/agent-framework](https://github.com/microsoft/agent-framework/releases)
- [Microsoft Agent Framework Overview (Microsoft Learn)](https://learn.microsoft.com/en-us/agent-framework/overview/)