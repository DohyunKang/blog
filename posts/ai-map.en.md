Studying AI can feel like being overwhelmed by a sudden flood of terminology. Terms like prompt, context, RAG, MCP, and harness are so intertwined that looking at them individually makes little sense. That's why I've listed the key terms first, with links below for those who want to dive deeper. The order follows a bottom-up approach: Model → Input → Memory → External Connections.

## Overview of Relationships

```
생성형 AI ⊃ LLM
LLM  ←  프롬프트(입력)  ←  컨텍스트(그 순간 모델이 보는 전체)
컨텍스트 = 컨텍스트 윈도우 안에 담기는 것 (토큰으로 센다)
컨텍스트에 외부 지식을 넣는 방법 = RAG (임베딩으로 찾는다)
컨텍스트에 도구를 연결하는 규격 = MCP
이 전부를 돌리고 관리하는 모델 바깥의 코드 = 하네스
모델이 틀린 말을 그럴듯하게 하는 현상 = 할루시네이션
```

## 1. What is a Model?

**Generative AI**: Unlike traditional AI that only classified or predicted, this type creates new text, images, and sound.
[Learn more → What is Generative AI](#/post/ai-generative)

**LLM (Large Language Model)**: A model trained on massive scales to predict the next token after a given piece of text. Chatbots are essentially interfaces built on top of these models.
[Learn more → What is an LLM](#/post/ai-llm)

## 2. What Do You Give the Model?

**Prompt**: The entire input provided to the model. Best practices include being clear, providing examples, and specifying formats.
[Learn more → Prompts and Prompt Engineering](#/post/ai-prompt)

**Context**: The full text the model sees at once when generating an answer. This includes the prompt itself; designing what to include is called context engineering.
[Learn more → Context and Context Engineering](#/post/ai-context)

**Context Window & Tokens**: The maximum amount of content the context can hold, measured in tokens. As conversations grow longer, you must resend the entire history with each call, increasing both cost and time.
[Learn more → Context Windows and Tokens](#/post/ai-context-window)

## 3. How Do You Tell It What Not to Know?

**Embedding**: A method that converts text into numerical coordinates so that similar meanings can be found together.
[Learn more → Embeddings and Vector Search](#/post/ai-embedding)

**RAG (Retrieval-Augmented Generation)**: Like giving the model a book to study before an exam. It first retrieves necessary documents and adds them to the context.
[Learn more → RAG](#/post/ai-rag)

**Hallucination**: Plausible but incorrect answers that arise because the model is designed to guess when it doesn't know something.
[Learn more → Hallucinations](#/post/ai-hallucination)

## 4. How Does It Connect to the Outside World?

**MCP (Model Context Protocol)**: A connection standard for linking AI apps with external tools. Once a tool is created, it can be plugged into multiple apps.
[Learn more → MCP](#/post/ai-mcp)

**Harness**: Code that manages loops, tools, permissions, and logs outside the model. The scope referenced varies slightly depending on the data source.
[Learn more → Harness and Harness Engineering](#/post/ai-harness)

## 5. Which Models to Use and How to Use Them Well?

**AI Model Map**: A reference of major models by company, including open/closed models, size tiers, and selection criteria (as of 2026-11-02).
[Learn more → AI Model Map](#/post/ai-models)

**How to Save Claude Tokens**: Understanding where tokens are consumed, using caching, `/clear`, `/compact`, and sharing model usage.
[Learn more → How to Save Claude Tokens](#/post/claude-tokens)

**Claude Skills & Settings**: Usage of `CLAUDE.md`, skills, hooks, sub-agents, permissions, and when to use MCP.
[Learn more → Claude Code Skills & Settings](#/post/claude-skills)

## 6. How Do Conversations Continue and Memory Work?

**Sessions and Conversation History**: Chatbots don't "remember" via the model itself; instead, the app resends the entire history with each call.
[Learn more → Sessions and Conversation History](#/post/ai-session)

**Compaction & Memory**: Compaction replaces past conversations with summaries, while memory stores these summaries outside the window so they can be retrieved if needed.
[Learn more → Compaction and Memory](#/post/ai-compaction)

**Prompt Caching**: A feature that processes identical initial parts of requests once and reuses them. The prefix must match exactly from the start.
[Learn more → Prompt Caching](#/post/ai-prompt-caching)

## 7. Tools and Agents

**Tool Use**: Instead of directly executing functions, the model sends a request like "execute this with these arguments," while your code handles the actual execution.
[Learn more → Tool Use (Function Calling)](#/post/ai-tool-use)

**Agent & Agent Loop**: A structure where the model uses tools, reviews results, and re-evaluates until the task is complete. The core logic is a `while` loop.
[Learn more → Agents and Agent Loops](#/post/ai-agent-loop)

**Sub-agents & Multi-agents**: A method where certain tasks are delegated to new contexts, receiving only summaries in return. This is beneficial when work can be parallelized and summaries suffice.
[Learn more → Sub-agents and Multi-agents](#/post/ai-subagent)

**Skill**: A method where the procedure, data, and scripts for a specific task are bundled into a single folder and retrieved only when needed. Only the name and description always remain accessible.
[Learn more → Skills](#/post/ai-skills)

**Comparison of skills by model/tool**: Claude, Codex, Gemini CLI, and Cursor all share a similar structure of instruction file → skill → deployment package; they are essentially the same with only different names.
[Learn more → Comparison of vendor-specific skills and extensions](#/post/ai-vendor-skills)

## 8. Model output and input formats

**Sampling (temperature·top-p)**: Values that adjust how the model selects the next word from a probability distribution. Recent trends in Claude suggest these values are becoming less usable, so current status is also documented.
[Learn more → Sampling: temperature·top-p](#/post/ai-sampling)

**Reasoning models·thought tokens**: Models that write out their internal thinking process before providing an answer. Even if not visible on the screen, this incurs output token costs and adds latency.
[Learn more → Reasoning models and thought tokens](#/post/ai-reasoning)

**Structured output**: A feature that forces the model to conform to a predefined shape (schema). There is a difference in reliability between requesting something and enforcing it.
[Learn more → Structured output (JSON·schema)](#/post/ai-structured-output)

**Multimodal**: Refers to handling not just text, but also images and audio. Images are converted into tokens and appear in the same window as text.
[Learn more → Multimodal](#/post/ai-multimodal)

## 9. Principles: How models are built

**Machine learning·deep learning basics**: A method where data is shown, and the model independently adjusts numbers (weights) that correspond to rules. Deep learning uses neural networks with deep layers.
[Learn more → Machine learning·deep learning basics](#/post/ml-basics)

**Neural networks·backpropagation**: Functions composed of layered calculations involving multiplication, addition, and bending, along with methods to calculate in reverse which weights to adjust.
[Learn more → Neural networks and backpropagation](#/post/ml-neural-net)

**Transformer·attention**: A structure that calculates scores for how much words within a sentence refer to each other. Modern LLMs almost exclusively use this as their backbone.
[Learn more → Transformers and attention](#/post/ml-transformer)

**From pretraining to RLHF**: Three stages: guessing the next word using internet text (pretraining), demonstrating how to answer (SFT), and pushing towards human-preferred outputs (RLHF).
[Learn more → From pretraining to RLHF](#/post/ml-pretraining)

**Fine-tuning**: Teaching a completed model again with your own data. The required GPU resources vary significantly depending on whether you adjust the entire model or only part of it (LoRA/QLoRA).
[Learn more → Fine-tuning: full vs LoRA/QLoRA](#/post/ml-finetuning)

**Local models**: A method where models run directly on your PC. Whether a model fits is mostly determined by VRAM calculations.
[Learn more → Running local models](#/post/ml-local-models)

**Inference optimization**: A collection of techniques including KV cache, batching, streaming, and speculative decoding that work together to produce answers faster and cheaper.
[Learn more → Inference optimization](#/post/ml-inference)

**Image generation (diffusion)**: Models that create images by gradually removing noise from pure randomness.
[Learn more → Image generation models (diffusion)](#/post/ml-diffusion)

## 10. Building LLM apps

**Agent design patterns**: Organized by pattern, advising to first check if a task can be done with a single call or via a defined workflow before building an agent.
[Learn more → Agent design patterns](#/post/app-agent-design)

**Building RAG directly**: Creating RAG with dozens of lines of Python without libraries, including how to identify and fix errors.
[Learn more → Building RAG directly](#/post/app-rag-build)

**LLM app cost structure**: Calculate the monthly cost per user by multiplying the token value per call by the number of calls and users.
[Learn more → LLM app cost structure](#/post/app-cost)

**LLM app evaluation**: Instead of relying on intuition, assign scores based on predefined questions and grading criteria, allowing for consistent comparison when making improvements.
[Learn more → LLM app evaluation](#/post/app-eval)

**Guardrails and safety mechanisms**: Rather than asking the model to be careful, install blocking gates outside the model in the code.
[Learn more → Guardrails and safety mechanisms](#/post/app-guardrails)

**Building an MCP server**: Since this involves attaching names and descriptions to functions, I directly ran a two-tool server.
[Learn more → Building an MCP server](#/post/app-mcp-server)

## 11. More Claude usage

**Collection of Popular Claude Skills**: We've reviewed skills that are already widely used, categorized by type, from the official Anthropic repository and community.  
[Read more → Collection of Popular Claude Skills](#/post/claude-popular-skills)

## 12. Open Source Analysis

**Ollama**: Inference computation is handled by a separate process, while Ollama serves as a Go server responsible for managing model files and GPU allocation.  
[Read more → Open Source Analysis: Ollama](#/post/repo-ollama)

**llama.cpp**: An inference engine built from the GGUF file format, the ggml computation library, and loops running on top of them. Quantization is implemented directly within the tensor format inside the files.  
[Read more → Open Source Analysis: llama.cpp](#/post/repo-llama-cpp)

**vLLM**: A server that finely partitions KV cache and uses a scheduler to distribute tokens per step.  
[Read more → Open Source Analysis: vLLM](#/post/repo-vllm)

**simonw/llm**: A structure where model invocation is centralized in one place, with the rest connected via plugins and while loops.  
[Read more → Open Source Analysis: simonw/llm](#/post/repo-simonw-llm)