A prompt is the entire input given to a model, and prompt engineering is the process of refining that input to elicit the desired response. After reviewing various techniques, only a few have proven effective; the rest have lost relevance as models evolved or were exaggerated.

## What is a Prompt?

It's easy to think of a prompt as just a single question asked to a chatbot. More accurately, it is all the text received by the model before it generates a response. Since [LLM](#/post/ai-llm) are models that continue writing the next token based on what comes before them, the preceding context determines how the continuation unfolds. Prompt engineering is essentially about pondering "what should come before."

When using an API, input typically splits into two layers:

| | System Prompt | User Prompt |
|---|---|---|
| Who uses it? | App developer | App user (or filled by code) |
| Content | Role, tone, rules, output format | Question·document·data to be processed this time |
| Frequency of change | Almost fixed | Changes with each request |

The system prompt serves as the default settings underlying the entire conversation, while the user prompt addresses specific requests at that moment. From the model's perspective, both are ultimately input text, but since the API distinguishes between them, it is conventional to place rules in the system section.

## Techniques with Proven Effectiveness

The following items repeatedly appear in Anthropic's prompt guide:

### 1. Be Clear and Provide Reasons

This seems ordinary yet reportedly yields the greatest impact. An example from documentation was particularly illustrative: "Do not use ellipses" is less effective than "Do not use ellipses because this answer will be read by a text-to-speech system that doesn't know how to pronounce them." Providing reasons helps the model apply the intent to other cases as well. It's much like giving instructions to people.

### 2. Include Examples (Few-Shot)

This approach involves directly showing several input-output pairs within the prompt. Without examples, it's called zero-shot; with examples, it's few-shot. The GPT-3 paper (Brown et al., 2020) demonstrated that models can solve new tasks quite well using only textual examples provided during inference without changing any weights, marking the starting point of few-shot prompting. The guide recommends this as one of the most reliable methods for matching format, tone, and structure, suggesting 3–5 examples. Conditions include similarity to actual use cases, diversity among examples, and separating them from instructions using `<example>` tags.

An interesting study by Min et al. (2022) found that performance did not significantly drop even when randomly shuffling the answer labels in examples (tested across 12 models on classification and multiple-choice tasks). The factors influencing performance were more about the range of label candidates, input text distribution, and overall format rather than whether the labels were correct. This suggests examples are closer to "showing how to format answers" rather than "teaching the correct answer." However, this result is limited to the scope of that paper's tasks.

### 3. Define Structure and Output Format

Mixing instructions, context, examples, and input data in a single prompt can confuse the model about where instructions end. The guide recommends wrapping different types with tags like `<instructions>`, `<context>`, and `<input>`. For output format, it's better to specify directly: as JSON, without an introduction, or as a table, etc. If code needs to process the structured output, the guide suggests using the API's structured output or tool-calling features rather than relying solely on prompts.

### 4. Place Long Documents Above, Questions Below

When attaching long documents, place the document first and the question at the very end. The guide states that placing the question at the end can improve response quality by up to 30%, noting this comes from tests especially with complex inputs involving multiple documents. Since this is a conditional number, it shouldn't be generalized directly without caution.

### 5. Induce Reasoning

The chain-of-thought (CoT) paper by Wei et al. (2022) reported that including reasoning steps in examples improved arithmetic, common sense, and symbolic reasoning. With just 8 examples, a 540B model achieved state-of-the-art performance on the GSM8K math benchmark at the time. Following this, Kojima et al. (2022) reported that adding only one line—"Let's think step by step"—without examples boosted MultiArith accuracy from 17.7% to 78.7% and GSM8K from 10.4% to 40.7% in InstructGPT (text-davinci-002).

A point to note here is that these numbers are based on models from 2022. Many current models now include built-in thinking capabilities before answering, and guides also recommend using the model's adaptive thinking for complex tasks. Therefore, whether habitually appending "think step by step" is appropriate depends on the specific model. I haven't directly compared them myself.

## Overhyped or Less Useful Techniques

Having reviewed effective techniques, now we turn to the opposite side. This summary reflects what I've read so far.

| Technique | Evidence I Read | Verdict |
|---|---|---|
| "You are the world's best expert" persona | Zheng et al. (2023): Adding a persona to system prompts did not improve factual question accuracy; effects were nearly random | Weak for accuracy |
| Capitalization and emphasis words like "absolutely" or "must" | Anthropic guide: Latest models are more sensitive to system prompts, so phrases like "CRITICAL: You MUST" can over-activate; they recommend using plain sentences instead | Old model habits |
| Magical phrases (e.g., "I'll give you a tip," "take a deep breath") | - | Pending due to lack of evidence |
| Prefilling responses | Guide: Some models after Claude 4.6 no longer support prefilling for the last assistant turn | Varies by model |

This does not mean role assignment is completely useless. The guide states that providing just one sentence about a role in the system prompt focuses the tone and behavior accordingly. My understanding is this: roles are used to set tone, perspective, and criteria, but they should not be expected to make the model learn unknown facts. The paper focused on factual accuracy.

## Where Prompt Engineering Stands

The guide draws clear lines from the start. Before tweaking prompts, you must define success criteria, have a way to test them, and prepare an initial draft. It notes that issues like latency or cost are sometimes easier to resolve by changing models rather than prompts. Simply rewriting sentences without evaluation won't tell you if things are improving.

Moreover, the conversation has expanded recently. In agent-like structures where models repeatedly call tools, what matters more than writing a single well-crafted prompt is ensuring the right information is available before each model turn. This area is called [context engineering](#/post/ai-context). Prompts remain just one part within it. Writing instructions is still necessary, but layers have been added on top: conversation history, search results ([RAG](#/post/ai-rag)), tool definitions, and so on. There are also limits to how much can be included at once due to [context window](#/post/ai-context-window) constraints.

## Common Misconceptions

- Writing good prompts eliminates hallucinations: You can reduce them, but not eliminate them. Providing reference documents and instructing the model to say "I don't know" if information is missing is somewhat effective. I haven't directly verified this with numbers.
- There are secret phrases: Within my reading scope, no consistently effective phrase was found. What works clearly are straightforward elements like clarity, examples, and structure.
- Longer and more detailed is better: Providing necessary information without omission differs from writing longer texts. Some research suggests that increasing length can actually make outputs less stable (see context post).
- Once you write a good prompt, you're done: Models change, so the same prompt may yield different responses. Guides also separately collect points to adjust when migrating prompts from previous generations.

<details>
<summary>Detailed explanation: One example, three ways to accomplish the same task</summary>

Let's say we are classifying review sentences as positive or negative.

zero-shot:

```text
다음 리뷰가 긍정인지 부정인지 한 단어로 답해.
리뷰: 배송은 빨랐는데 포장이 엉망이었다.
```

few-shot (two examples, separated by tags):

```text
다음 리뷰를 긍정/부정/혼합 중 하나로 분류해. 한 단어로만 답해.
<examples>
<example>리뷰: 기대 이상이다. 또 살 것 같다. -> 긍정</example>
<example>리뷰: 사흘 만에 고장 났다. -> 부정</example>
</examples>
리뷰: 배송은 빨랐는데 포장이 엉망이었다.
```

Adding examples fixes the output format, even including options like "mixed" for the label type. Borrowing results from Min et al. shown above, what's important here isn't individual labels but rather the framework that outputs one of the three labels as a single word.

For CoT (Chain-of-Thought), it involves making the model write reasons first.

```text
먼저 <reasoning> 태그 안에 근거를 쓰고, 그다음 <answer> 태그 안에 결론만 써.
```

This makes it easy for code to separately extract answers and reasoning. This example was written by me and has not been performance-tested.

</details>

← [Concept map](#/post/ai-map)

Related posts: [Context and Context Engineering](#/post/ai-context) · [LLM](#/post/ai-llm) · [Hallucination](#/post/ai-hallucination)

## Reference Links

- Anthropic documentation, Prompt engineering overview: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
- Anthropic documentation, Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Brown et al., Language Models are Few-Shot Learners (GPT-3): https://arxiv.org/abs/2005.14165
- Wei et al., Chain-of-Thought Prompting Elicits Reasoning in Large Language Models: https://arxiv.org/abs/2201.11903
- Kojima et al., Large Language Models are Zero-Shot Reasoners: https://arxiv.org/abs/2205.11916
- Min et al., Rethinking the Role of Demonstrations: https://arxiv.org/abs/2202.12837
- Zheng et al., Is "A Helpful Assistant" the Best Role for LLMs?: https://arxiv.org/abs/2311.10054