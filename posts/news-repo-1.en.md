This week's GitHub trending list was dominated by agent skills and harnesses, but there was one repository with a distinctly different focus: **TradingAgents** from TauricResearch. This project translates the role division of a trading company into LLM agents.

## What I Saw in This Week's Trending

Out of the top 15 trending repositories for the week, 13 were AI-related. Most focused on tools like skills attached to coding agents, `CLAUDE.md`, memory management, and harnesses. However, **TradingAgents** stood out as the only project where the core theme was the structure of agents collaborating by dividing roles among themselves.

The data was checked on November 2, 2026. At that time, according to GitHub metrics, the repository had approximately 119,000 stars (displayed as 120k in the header) and 22,900 forks. These numbers change daily. The license is Apache-2.0, and the latest release was v0.7.1 (October 2026).

## What the Project Does

The README introduces this as a multi-agent trading framework built on top of LLMs and LangGraph. The core concept is mimicking the organizational structure of an actual trading firm. Agents discuss market conditions before making decisions.

Roles are divided as follows:

| Stage | Role | Responsibilities |
|---|---|---|
| Analyst Team | Fundamental, Sentiment (News·StockTwits·Reddit), Macro News, Technical Indicators (MACD, RSI, etc.) | Review data in parallel and generate reports individually. |
| Research Team | Bullish Researchers, Bearish Researchers | Debate over the analyst reports. |
| Trader | Trader | Synthesizes reports to determine trade timing and size. |
| Risk & Operations | Risk Management, Portfolio Manager | Evaluate proposals for approval or rejection. Approved orders are sent to a simulated exchange. |

In short, the workflow follows: Analysis → Discussion → Decision → Risk Review → Approval. Instead of a single model answering at once, this structure breaks down a problem into multiple perspectives and encourages agents to challenge each other.

This architecture aligns closely with patterns discussed in agent design literature. The part where analysts work simultaneously represents parallelization, while the confrontation between bullish and bearish agents resembles an evaluation stage where one agent reviews another's output. These patterns are documented separately in [Detailed → Agent Design Patterns](#/post/app-agent-design). The fact that each role uses its own context also connects to [Detailed → Sub-agents and Multi-agents](#/post/ai-subagent).

## Which Models Can Run It

The list of supported providers is extensive. Supported providers include OpenAI, Google, Anthropic, xAI, DeepSeek, Qwen, GLM, MiniMax, OpenRouter, Mistral, Kimi, Groq, NVIDIA NIM, AWS Bedrock, and Azure OpenAI. Local models can be connected via Ollama. Any OpenAI-compatible endpoint can be used, and it is noted that ChatGPT Plus or Pro subscriptions also work.

The fact that one repository supports so many providers suggests that a common usage pattern has emerged: keeping the agent structure intact while swapping out the underlying model. This implies that each individual agent acts as a thin layer calling an [LLM](#/post/ai-llm).

## How to Use It

According to the README, Python 3.11 or higher is required, with examples using version 3.13. After cloning the repository, install it via `pip install .` (or `uv pip install .`) and launch the CLI using `tradingagents` or `python -m cli.main`. In Python code, you can also import and use `TradingAgentsGraph`. To run with Docker, copy `.env.example` to `.env`, fill in the keys, and execute `docker compose run --rm tradingagents`.

Additional features listed include persistent memory logs, checkpoint-based resumption, backtesting over stock/date grids, execution considering portfolios, and support for non-US markets via Yahoo Finance tickers.

<details>
<summary>What does the paper say?</summary>

The paper linked in the README is arXiv:2412.20138 "TradingAgents: Multi-Agents LLM Financial Trading Framework". It was first uploaded on December 28, 2024, with the latest revision being v7 on June 3, 2025.

Based on the abstract, three main claims are made: that organizing LLM agents into an organizational structure similar to a real trading firm is an under-explored area; that this framework outperforms baseline models in cumulative returns, Sharpe ratio, and maximum drawdown; and therefore, multi-agent structures show promise. These metrics are results from the experimental conditions of the paper and do not reflect performance with actual capital deployed.

</details>

## Related Notes

The README states that this project is intended for research purposes only and does not constitute financial, investment, or trading advice. It also notes that performance depends on factors such as the model used, temperature settings, data quality, and the inherent variability of results. Even with identical inputs, discussion content may differ, making it difficult to rely on any single output as a definitive basis.

The rationale behind structuring the discussions is closely related to this point: multiple iterations of cross-examination are expected to be more stable than a single call. However, this comes at the cost of increased API calls proportional to the number of roles, thereby raising expenses accordingly. The structure varies significantly in terms of token usage per run depending on how many loops the [agent loop](#/post/ai-agent-loop) completes.

I read this repo less as an investment tool and more as a sample demonstrating multi-agent architecture. It serves as a good example for observing how roles are decomposed and what sequence they interact in. For direct experimentation, it is best to use the simulated trading platform.

## Reference Links

- [TauricResearch/TradingAgents (GitHub)](https://github.com/TauricResearch/TradingAgents)
- [GitHub Trending Weekly](https://github.com/trending?since=weekly)
- [TradingAgents paper (arXiv:2412.20138)](https://arxiv.org/abs/2412.20138)

---

← [Concept Map](#/post/ai-map)

Related posts: [Agent Design Patterns](#/post/app-agent-design) · [Sub-agents and Multi-agents](#/post/ai-subagent) · [Agents and Agent Loops](#/post/ai-agent-loop)