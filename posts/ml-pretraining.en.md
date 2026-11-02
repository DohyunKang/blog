LLMs are not built in a single step. They undergo three stages: pre-training, where the model learns to predict the next word by reading internet text; supervised fine-tuning (SFT), where it learns how to answer questions; and preference learning, where it is steered toward responses humans prefer.

## First, the big picture

The first pre-trained models could speak well but couldn't converse. If asked "What is the capital of France?", they might respond with a similar question like "What is the capital of Germany?" instead of an answer. This is because they were only trained to continue text plausibly. Therefore, two additional stages are stacked on top.

| Stage | Task | Data | Result |
|---|---|---|---|
| 1. Pre-training | Predict next token | Vast amounts of web, books, code, etc. | Basic model with language and knowledge |
| 2. Supervised Fine-Tuning (SFT) | Follow question-answer examples | Thousands to tens of thousands of human-written exemplars | Model that understands instructions |
| 3. Preference Learning (RLHF, DPO) | Adjust toward responses humans prefer | Multiple answers to the same question + rankings | Helpful and less harmful tone |

How tokens work and how the model calculates the next token inside are explained separately in [Details → Transformer](#/post/ml-transformer) and [Details → LLM](#/post/ai-llm). Here, we focus only on what is learned at each stage.

## Stage 1: Pre-training

The method is simple. Text is fed in chunks, and the model is trained to predict the next token given the preceding ones. Since the correct answer already exists in the original text, no human labeling is needed. This approach is called self-supervised learning. If the prediction is wrong, parameters are adjusted slightly to reduce error. This process is repeated over trillions of tokens. Concepts like grammar, common sense, code syntax, and multiple languages come along for the ride because predicting the next word requires understanding them. However, this stage also costs the most money. The subsequent two stages involve far less data and computation compared to this one.

### Model Size and Data Volume

Determining how large a model should be and how much text to feed it remains a constant challenge. DeepMind's Chinchilla paper (2022) stated that, given the same computational budget, it is better to scale both model size and training token count proportionally. Doubling the model size means doubling the data as well. At the time, larger models only increased parameters while keeping data nearly constant, leading to claims that they were in an "underfed" state. Comparing a 280B-parameter Gopher with a 70B model plus four times more data (Chinchilla) under the same budget showed Chinchilla winning on multiple tasks; its average MMLU accuracy was 67.5%, over 7 points higher than Gopher's.

However, this is research from 2022, and

## Stage 2: Supervised Fine-Tuning (SFT)

This stage directly shows the pre-trained model "how to answer such questions." Humans (labelers) write questions and ideal answers, and the model learns by following these examples in the same way as during pre-training (predicting the next token). The only difference is the data. Therefore, SFT is less about injecting new knowledge and more about extracting existing capabilities into a "response format."

An example has the limitation of having only one ideal answer. For the same question, there can be multiple good answers, but the model isn't told which is better. The next stage addresses this. Discussions on adjusting parameters for other purposes (such as adapting to specific tasks) are covered in [Details → Fine-tuning](#/post/ml-finetuning).

## Stage 3: Preference Learning

When a model generates multiple answers to the same question, humans rank them by saying "this one is better." The model is then steered toward responses people prefer using this comparative data.

### RLHF (Reinforcement Learning from Human Feedback)

OpenAI's InstructGPT paper (2022) is a representative case. According to the green book, the process goes as follows: GPT-3 is first fine-tuned with ideal answers written by labelers (SFT), then human ranking data for model outputs is collected, and finally, the model is adjusted again using reinforcement learning based on human feedback. As a result, the output of 1.3B-parameter InstructGPT was more preferred in human evaluations than that of 175B GPT-3, despite having approximately 100 times fewer parameters. It was more truthful and less harmful, with almost no performance drop on public NLP benchmarks. However, it still made simple mistakes.

<details>
<summary>Detailed explanation: What actually happens inside RLHF</summary>

RLHF is typically explained in two parts:

1. Reward Model Training: A separate model is trained to output "how many points this answer gets" based on human-ranked data. It acts as a judge instead of humans.
2. Reinforcement Learning: The model generates an answer, the reward model assigns a score, and the model is adjusted to increase its score. Constraints are applied here to prevent the model from deviating too far from the original model; otherwise, it would only maximize scores while producing strange responses.


</details>

### DPO

RLHF has faced criticism for its complexity and instability, as it requires building a separate reward model and running reinforcement learning. DPO (Direct Preference Optimization, 2023) addresses this issue. According to the paper's abstract, DPO reformulates the reward model to derive an optimal policy in closed form, thereby simplifying the RLHF objective into a straightforward classification loss. It eliminates the need for a separate reward model or sampling model outputs during training. The authors report that their method performs as well as or better than existing approaches on summarization and single-turn dialogue tasks.

In simple terms, DPO takes pairs of "good answer A" and "bad answer B" directly, increasing the probability of A while decreasing that of B. Its much simpler implementation has made it widely adopted. However, this does not mean RLHF is obsolete; usage depends on each model.

## Where Does Pretraining Data Come From?

Mostly from public text sources such as web crawling, books, code repositories, and academic papers. It is known that data cleaning processes—including deduplication, quality filtering, and removal of harmful content—are applied to address issues like repeated articles or low-quality content mixed in. However, most commercial models do not disclose exactly which data they used or how much.

## What You Can See by Knowing This

- Models often tell plausible lies because pretraining trains them to predict "what comes next" rather than "truthful statements." Preference learning provides some correction but cannot eliminate hallucinations entirely. For more details, see [Hallucination →](#/post/ai-hallucination).
- The polite tone in responses stems from the model being steered toward human-preferred outputs during the third stage of training.
- Even within the same model, varying answers arise not from learning but from sampling during inference. For more details, see [Sampling →](#/post/ai-sampling).

## Common Misconceptions

- Models learn in real-time from user conversations: Parameters do not change during usage; conversation content serves only as input. Whether such data is used for training future versions depends on the service terms.
- RLHF injects knowledge: Knowledge primarily comes from pretraining. Preference learning adjusts speaking style and attitude.
- Larger parameters always mean better performance: InstructGPT showed that a 1.3B model was preferred over a 175B one, and Chinchilla demonstrated that feeding more data to smaller models can win. Model size alone is not decisive; data volume and subsequent training stages also significantly impact performance.
- DPO is completely different from RLHF: Both use human preference data. The difference lies in skipping the reward model and reinforcement learning stages.

← Concept map ([#/post/ml-map])

Related articles: [Transformer](#/post/ml-transformer) · [Fine-tuning: Full vs LoRA/QLoRA](#/post/ml-finetuning) · [What is an LLM?](#/post/ai-llm)

## Reference Links

- Ouyang et al., Training language models to follow instructions with human feedback (InstructGPT): https://arxiv.org/abs/2203.02155
- Rafailov et al., Direct Preference Optimization: https://arxiv.org/abs/2305.18290
- Hoffmann et al., Training Compute-Optimal Large Language Models (Chinchilla): https://arxiv.org/abs/2203.15556