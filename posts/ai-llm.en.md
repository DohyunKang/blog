An LLM (Large Language Model) is a model trained on an enormous scale to predict the next token following a given sequence of tokens. The "secret" behind AI systems referred to as conversational agents lies mostly in this mechanism.

## First, in simple terms

When you type "Today for lunch" into a smartphone keyboard, candidate words appear. An LLM is essentially an extreme version of this feature. Instead of showing a few candidates, it assigns probabilities to all possible next tokens and selects one. It appends the selected token and then predicts the next one again in that state. Repeating this hundreds of times generates a paragraph.

When first hearing this explanation, one might think, "Is that all?" It handles code generation and translation, yet its core mechanism is just predicting the next token. However, this is essentially correct. Rather than saying "that's all," it's more accurate to say, "by doing this on an immense scale, it achieves far more." We will look at this in order below.

## Tokens: The Unit Models Read

Models do not read text as characters or words directly; they read it in pieces called tokens. A token can be a whole word, part of a word, or even a single character. Frequently occurring chunks are treated as one token, while rare words are split into multiple pieces.

One root of this approach is subword segmentation. The 2015 paper by Sennrich et al. addressed the problem where translation models could not handle rare words with a fixed vocabulary by representing words as sequences of subword pieces. I only read the abstract of that paper, and the exact method used by tokenizers in modern LLMs varies by model. Below is a hypothetical segmentation created to illustrate the concept; it does not reflect actual tokenizer results.

| Original Text | Hypothetical Token Segmentation |
|---|---|
| 점심 | `점심` |
| 형태소분석 | `형태`, `소`, `분석` |
| unbelievable | `un`, `believ`, `able` |

Tokens are directly tied to pricing. APIs typically calculate costs based on the number of input and output tokens (Anthropic's documentation mentions a feature to count tokens in advance, intended for managing costs and rate limits). Even if the meaning is the same, the token count can vary depending on the language.

As discussed in [Details → Context Window](#/post/ai-context-window), there is an upper limit to the number of tokens that can be processed at once.

## Next Token Prediction

From the model's perspective, its task is singular: given a sequence of tokens so far, it outputs a probability distribution for the next token.

```
입력: "대한민국의 수도는"
출력(예시용 가상의 확률):
  " 서울"  0.92
  " 부산"  0.01
  " 어디"  0.01
  ...
```

One token is sampled from this distribution. Always selecting the highest probability results in deterministic answers, whereas sampling according to probabilities leads to slight variations in responses even for the same question. Settings like `temperature`, commonly referred to, control this degree of randomness. Names and default values vary by product.

One crucial point here: the model does not verify whether "Seoul" is factually correct before selecting it. Instead, because the token "Seoul" frequently appears after such contexts during training, its probability is high. This distinction is the root of the hallucination problem discussed later. [Details → Hallucination](#/post/ai-hallucination)

## Parameters: Numbers Filled by Training

Inside a model lie vast numbers (weights). These are called parameters. Input tokens pass through these numbers, undergoing transformations until finally emerging as probabilities for the next token. Training is the process of gradually adjusting these numbers to reduce prediction errors.

- Before training: Numbers are close to random, and outputs are nonsensical text.
- During training: The model solves the "predict the next token" problem on massive amounts of text, adjusting numbers proportionally to its mistakes.
- After training: Numbers are fixed. Grammar, common sense, code patterns, and similar knowledge are embedded within these numbers.

The figures used to grasp scale were taken from papers. The GPT-3 paper (2020) trained an autoregressive language model with 175 billion parameters, noting it was ten times larger than some prior non-sparse language models. The architecture belongs to the transformer family proposed in the 2017 paper "Attention Is All You Need." This paper introduced a structure composed solely of attention mechanisms, without recurrence or convolution. This article does not cover exactly how attention is calculated; I plan to read separately and summarize later.

## How Pre-trained Models Generate Answers

The term "pre-trained" in the name means the model was first extensively trained on general text before being adapted for specific uses. No training occurs during usage; numbers remain fixed, and only calculations are performed based on input.

A single conversation flow proceeds as follows:

1. Concatenate the user's input, conversation history, and system instructions.
2. Segment into tokens.
3. The model outputs a probability distribution for the next token.
4. Sample one token and append it.
5. Repeat steps 3–4 until an end signal is received.

This is why answers appear to flow out character by character; in reality, tokens are being generated one at a time.

What was impressive about the GPT-3 paper is that it could be instructed with text alone, without separate task learning. The paper states that tasks and examples were specified "purely through text interaction with the model," with no gradient updates (additional training). This is the starting point for the current approach of adding a few examples to prompts. [Read more → Prompt](#/post/ai-prompt)

Information about recent events or internal documents that the model doesn't know is not contained in its parameters. Therefore, the method of providing necessary text as input is used. [Read more → RAG](#/post/ai-rag)

## Model Size: Bigger Is Always Better?

Generally, larger models perform better, but "number of parameters" alone is not the answer. Two papers demonstrate this.

- Chinchilla (2022): Argues that if a computing budget is fixed, both model size and training token count should be scaled up at the same ratio. The 70 billion parameter Chinchilla used similar compute to the 280 billion parameter Gopher but utilized four times more data.
- InstructGPT (2022): Outputs from a 1.3 billion parameter model fine-tuned with human feedback were preferred by evaluators over outputs from the 175B GPT-3, despite having approximately 1/100th the parameters.

In summary, size, data volume, and additional tuning each affect quality. Size also directly impacts cost; larger models require more computation to generate each token. Consequently, companies often sell both large and small versions of their models. Light classification tasks are handled by smaller models, while difficult reasoning tasks use larger ones.

## How Does It Differ from Existing Chatbots?

Previous rule-based chatbots had a structure where humans pre-defined questions and answers. If a keyword matched, the predefined answer appeared; otherwise, for unrecognized questions, "I don't understand" was returned.

| | Rule/Scenario Chatbot | LLM-based |
|---|---|---|
| Source of Answer | Text written by humans | Generated from learned parameters |
| Unseen Questions | Usually fails | Answers plausibly at first |
| When Wrong | No answer or irrelevant scenario | Plausible wrong answer |
| Cost to Build | Writing scenarios | Model training and invocation costs |
| Predictability of Behavior | Easy | Difficult |

While LLMs are flexible, they are difficult to control. Therefore, actual products do not rely on a single LLM but combine it with search, tool invocation, and rules. [Read more → Harness](#/post/ai-harness)

One more point: The conversational AI we use is not the LLM itself, but rather a pre-trained model that has been additionally tuned via human feedback, combined with conversational prompt formats and product features. The InstructGPT paper addresses this additional tuning. The paper suggests that training a model alone does not lead to following user intent and can result in false or harmful outputs, proposing fine-tuning with human feedback instead.

## Common Misconceptions

- **Retrieving answers via search:** An LLM in its base state generates responses based on patterns stored in its parameters. Products with search functionality separately invoke a search engine.
- **The model learns from your questions during conversation:** Learning does not occur during the conversation. The appearance of remembering previous dialogue is because records are re-inserted into the input. Whether the service uses data later for training depends on the terms of service.
- **It's mimicry, not understanding / It understands like a human:** Neither conclusion can be drawn from this text alone. The fact that it was trained via next-token prediction must be distinguished from what capabilities resulted from it.
- **More parameters always mean better performance:** As seen in the Chinchilla and InstructGPT cases, this depends on data volume and tuning.

<details>
<summary>Detailed explanation: How next-token prediction is learned</summary>

Viewing the text of training data as a sequence of tokens t1, t2, ..., tn, the goal is to predict tk based on preceding tokens (t1..t(k-1)) at each position. The lower the probability the model assigns to tk, the higher the loss; parameters are adjusted in the direction that reduces this loss. Since the correct answer is contained within the text itself, no separate human labeling is required. This type of learning is called self-supervised learning.

The term "autoregressive" mentioned in the GPT-3 paper abstract refers to the method of feeding the output generated from previous steps back as input for the next step. The aforementioned 5-step repetition exemplifies this.

</details>

← [Concept Map](#/post/ai-map)

Related articles: [Generative AI](#/post/ai-generative) · [Context Window](#/post/ai-context-window) · [Hallucination](#/post/ai-hallucination)

## Reference Links

- Brown et al., Language Models are Few-Shot Learners (GPT-3): https://arxiv.org/abs/2005.14165
- Hoffmann et al., Training Compute-Optimal Large Language Models (Chinchilla): https://arxiv.org/abs/2203.15556
- Ouyang et al., Training language models to follow instructions with human feedback (InstructGPT): https://arxiv.org/abs/2203.02155
- Vaswani et al., Attention Is All You Need: https://arxiv.org/abs/1706.03762
- Sennrich et al., Neural Machine Translation of Rare Words with Subword Units: https://arxiv.org/abs/1508.07909
- Anthropic documentation, Token counting: https://platform.claude.com/docs/en/build-with-claude/token-counting