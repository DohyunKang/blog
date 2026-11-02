Building an app with an LLM often involves more work around the model calls than the calls themselves. You need to decide on the structure, how to attach external documents, how much it will cost, how to measure success, where to set boundaries, and how to connect tools. This series walks through these six areas one by one; this post serves as the table of contents. If you're unfamiliar with the terminology, start with the [AI Concept Map](#/post/ai-map).

## Overview of the Flow

```
구조를 정한다   → 에이전트 설계 패턴
지식을 붙인다   → RAG 직접 만들기
도구를 붙인다   → MCP 서버 만들어 보기
돈을 계산한다   → AI 서비스 원가 구조
품질을 잰다     → LLM 앱 평가
바깥에서 막는다 → 가드레일과 안전장치
```

## 1. Decisions Before Building

**Agent Design Patterns**: For each pattern, I've summarized whether it's better to follow a predefined workflow before building an agent or to handle tasks directly via LLM calls. The starting point is determining if a single LLM call suffices; if not, where to set boundaries and where to delegate to the model.
[Read more → Agent Design Patterns](#/post/app-agent-design)

**AI Service Cost Structure**: Since users incur token fees with every use, calculate the cost per call first, then multiply by the number of calls and users to estimate monthly costs.
[Read more → AI Service Cost Structure](#/post/app-cost)

## 2. Adding Features

**Building RAG from Scratch**: Without using a library, I built and ran a RAG system in just dozens of lines of Python, covering five key steps: document chunking, vector creation, retrieval, and evaluation. The concepts are explained in the [RAG](#/post/ai-rag) post.
[Read more → Building RAG from Scratch](#/post/app-rag-build)

**Building an MCP Server**: This involves attaching names and descriptions to a few functions and exposing them externally; I directly ran a server with two tools using a single Python file. The specification is covered in the [MCP](#/post/ai-mcp) post.
[Read more → Building an MCP Server](#/post/app-mcp-server)

## 3. Measuring Success and Maintaining Safety

**LLM App Evaluation**: Relying on intuition to check prompts after each tweak can lead to silent failures; instead, use a predefined set of questions and scoring criteria to evaluate consistently.
[Read more → LLM App Evaluation](#/post/app-eval)

**Guardrails and Safety Mechanisms**: Asking the model to be careful isn't sufficient for safety; you must implement specific points in your app's code to block incorrect inputs or actions. Correcting the model's tone isn't enough—it's about installing locks on the outside doors.
[Read more → Guardrails and Safety Mechanisms](#/post/app-guardrails)

## Reading Order

If you're starting from scratch, read in this order: Design Patterns → Cost → RAG → MCP Server → Evaluation → Guardrails. If you already have an app built, pick just one area where you're stuck and read that section.

← [Back to Concept Map](#/post/ai-map)

Related posts: [RAG](#/post/ai-rag) · [MCP](#/post/ai-mcp) · [Harness and Harness Engineering](#/post/ai-harness)