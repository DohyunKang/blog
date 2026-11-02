Guardrails is a term used to collectively refer to safety mechanisms that prevent LLM services from saying or doing things they shouldn't. Writing "do not" in the prompt is also a guardrail, as are attaching inspection code before and after the model, or restricting the permissions of tools the model can use.

## Why Are They Needed?

[LLM](#/post/ai-llm) receives both instructions and data as text. The developer's written instructions, the user's input text, and content fetched from web pages all enter the model as a single block of text. Therefore, if sentences resembling instructions are mixed into the data, the model may follow them. Most reasons for needing guardrails stem from this.

When companies operate services, they worry about three main things:

| Concern | What Happens? | OWASP Item |
|---|---|---|
| Prompt Injection | Input changes the model's behavior contrary to intent | LLM01 |
| Sensitive Information Leakage | Personal data, internal documents, keys, etc., leak into responses | LLM02 |
| Overprivileged Agents | The model causes harm using tools and permissions beyond what is necessary | LLM06 |

OWASP is famous for the Web Top 10, but they also publish a separate Top 10 for LLM applications. The 2025 edition includes, in addition to the three above, supply chain, data/model poisoning, improper output handling (LLM05), system prompt leakage (LLM07), vector/embedding weaknesses (LLM08), misinformation (LLM09), and unlimited consumption (LLM10). This article focuses on the three items in the table above.

## Prompt Injection

OWASP defines this as input that changes the LLM's behavior or output in unintended directions. It applies even to input invisible to human eyes if the model can read it. There are two types:

| Type | Who Inserts It? | Example |
|---|---|---|
| Direct | The service user themselves into the input field | Sending a chatbot a sentence like "Ignore previous instructions" |
| Indirect | Within external content the model reads | Instructions embedded in web pages, email bodies, uploaded files, or tool results |

Jailbreak is a form of direct injection, representing an attempt to completely bypass the model's safety rules.

Anthropic documents explain that the two threat models are different. In the direct case, the user is the attacker. In the indirect case, the user is trustworthy, but attack sentences exist in third-party content the model reads. Services that fetch documents via [RAG](#/post/ai-rag) or read the web via [tool use](#/post/ai-tool-use) tend to have a higher proportion of indirect cases.

OWASP notes that the impact varies depending on the service context and the level of permissions the model holds. The scope ranges from system prompt leakage, incorrect output, to command execution in connected systems. They clearly state that there is no way to completely prevent this problem; the focus must be on mitigating damage.

## Sensitive Information Leakage

Sensitive information, as defined by OWASP, includes personal data, financial and health records, corporate secrets, authentication credentials, legal documents, and more. The issue arises when content learned by the model or internal documents attached to prompts via the service leak into responses.

OWASP suggests the following countermeasures:

- Mask or remove sensitive information from learning and input data (masking, pattern-based deletion)
- Grant access only to data necessary for users and processes (principle of least privilege)
- Restrict external data sources accessible to the model
- Instruct users not to input sensitive information and publish data retention and usage policies
- Prevent users from changing or reading system initial settings

The same page also contains this statement: System prompt instructions that limit output types can be bypassed via prompt injection, so relying solely on them is insufficient. Therefore, preventing the model from accessing that data in the first place is superior to telling it "do not write such things in your response."

## Overprivileged Agents

[Agents](#/post/ai-agent-loop) proceed by selecting and using tools. OWASP refers to causing harm when a model's output is unexpected, ambiguous, or manipulated as Excessive Agency. Causes include hallucinations, direct/indirect injection, poisoned extensions, or other agents. The document highlights three root causes:

| Root Cause | Meaning | Direction |
|---|---|---|
| Excessive Functionality | Tools unnecessary for the service are attached | Reduce the number of tools and functions |
| Excessive Permissions | Access permissions broader than needed, or execution with a shared account that does everything | Execute with read-only scope or user's own permissions |
| Excessive Autonomy | Actions with significant impact executed without verification or approval | Human approval |

Notably, recommendations to use dedicated tools with narrow purposes rather than open-scope tools like shell execution stand out. It is advised not to leave permission judgment to the model but to enforce it via permission checks on the connected systems. The same criteria apply when attaching external tools via [MCP](#/post/ai-mcp).

## Defense in Layers

If you lay out the official guides side by side, defense organizes itself into four layers.

```
사용자 입력 → [1 입력 검사] → 모델 → [2 출력 검사] → 도구 실행 → [3 권한 최소화] → [4 사람 승인] → 실제 반영
```

| Layer | What it does | Basis |
|---|---|---|
| 1 Input Inspection | Filter known attack patterns, pre-classify risky inputs with lightweight models, limit input length | Anthropic, OpenAI, OWASP |
| 2 Output Inspection | Verify expected format via code, evaluate relevance and grounding, moderation, output token limits | OWASP, OpenAI |
| 3 Least Privilege | Only necessary tools, read-only access, sandboxing, never expose secret values | OWASP, Anthropic |
| 4 Human Approval | Humans verify high-impact actions and results in high-risk domains | OWASP, OpenAI |

### 1. Input Inspection

Anthropic documents recommend filtering user input with a lightweight model before it reaches the main model, limiting responses to simple classifications like "is this risky or not," and accepting structured output to branch code accordingly. They also advise using system prompts that include methods for rejecting inputs and filtering known injection patterns. OpenAI guides state that limiting input length reduces injection risks and suggest using validated dropdowns instead of free-form input.

Indirect injections hinge on structure. Summarizing Anthropic's recommendations yields the following:

- External content goes only into the `tool_result` field, not into system prompts or general user messages.
- Clearly state what that content is and where it came from in tool descriptions or result structures.
- Explicitly state in system prompts that tool outputs, documents, and search results are untrusted data that cannot be relied upon to change instructions.
- Wrap external strings in JSON to clearly demarcate the boundary between data and instructions.
- Pass content returned by tools to the model only after undergoing the same lightweight model inspection.

### 2. Output Inspection

OWASP recommends defining the expected output format and verifying it with decisive code. Checking whether responses are relevant to the question and grounded in provided materials is also essential. Filtering out baseless answers overlaps with addressing [hallucinations](#/post/ai-hallucination). OpenAI recommends using the Moderation API (free) and setting output token limits, and suggests returning verified backend content (e.g., the most appropriate help document) instead of text newly written by the model whenever possible.

### 3. Least Privilege

The excessive privileges discussed in the previous section correspond to this layer. Anthropic also advises preventing models from accessing secret values unnecessary for their operation, running tools within sandboxes, and narrowing privilege scopes to minimize damage from successful injections. OWASP adds executing within user authentication boundaries, logging and monitoring extension activities, and rate limiting.

### 4. Human Approval

OWASP recommends implementing human approval (human-in-the-loop) for high-risk actions. OpenAI guides state that humans must review outputs in high-risk domains and code generation, and reviewers should understand system limitations and be able to verify against original sources. Actions that are difficult to undo, such as sending emails, processing payments, or deleting data, are prime candidates for approval.

## Things to Do While Operating

- Test with documents, emails, and tool results intentionally containing attack strings before deployment. Anthropic recommends red-teaming your own agent directly, while OpenAI and OWASP also advocate for adversarial testing. These tests can be grouped under [evaluation](#/post/ai-evals) and repeated regularly.
- Periodically analyze outputs to find traces of successful injections and refine prompts and filters (Anthropic's continuous monitoring).
- Restrict or block users who repeatedly attempt the same bypasses (Anthropic's response to repeat offenders).
- Require user accounts and send stable, per-user identifiers with API calls so that abuse can be traced to specific users rather than affecting the entire organization (OpenAI's `safety_identifier`).
- Provide reporting channels with human responses.

This framework for bundling these pieces into service code is sometimes called a [harness](#/post/ai-harness), and guardrails are components placed before and after the model and at tool call points within it.

## Common Misconceptions

- Writing "do not ignore" in system prompts leads to blockage: While helpful, OWASP notes there is no single complete solution; prompts are just one layer among many.
- If the model improves, guardrails are unnecessary: Even Anthropic documents acknowledge that Claude has inherent resistance to such attacks but still recommend additional steps.
- Blocking input alone is sufficient: Indirect injections enter via tool results or documents without passing through input fields; separate layers for output and privileges are needed.
- Guardrails are the model's job: OWASP's stance is not to delegate privilege judgment to the model but to enforce it in connected systems.

<details>
<summary>Detailed explanation: Why indirect injections are difficult</summary>

Models do not receive instructions and data in completely separate input formats. System prompts, user messages, and tool results all enter as token sequences. Therefore, the model must independently determine whether an instruction within external content was actually issued by the user; since this determination is probabilistic, it cannot reach 100% accuracy.

The structure recommended by Anthropic—separating inputs (placing only in `tool_result`), specifying sources, and using JSON encoding—serves as a mechanism to make this determination easier. The documentation explains that closing quotation marks or tags to exit the instruction scope is blocked by JSON escaping. Even though these mechanisms reduce probability, they cannot bring it to zero; therefore, minimizing damage upon success through least privilege and deferring human approval remains necessary. This is why multiple defense layers are employed.

</details>

## Reference Links

- OWASP, Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
- OWASP, LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- OWASP, LLM02 Sensitive Information Disclosure: https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/
- OWASP, LLM06 Excessive Agency: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- Anthropic, Mitigate jailbreaks and prompt injections: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks
- OpenAI, Safety best practices: https://developers.openai.com/api/docs/guides/safety-best-practices

← [Concept Map](#/post/ai-map)

Related posts: [Tool Use](#/post/ai-tool-use) · [MCP](#/post/ai-mcp) · [Harness](#/post/ai-harness)