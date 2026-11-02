Fine-tuning is a method where you retrain an already trained model on example data to slightly adjust its weights. Unlike prompts or [RAG](#/post/ai-rag), which change the input shown to the model, fine-tuning changes the model itself. LoRA is one of the methods developed to make this cheaper.

## Which to choose: Prompt, RAG, or Fine-tuning?

All three are "methods to make the model answer as I want," but they differ in what changes.

| | Prompt | RAG | Fine-tuning |
|---|---|---|---|
| What changes | Instructions | Data the model reads | Model weights |
| Preparation | A few lines of text | Documents + search system | Example data + training environment |
| Speed of fixing | Immediately | Just fix the documents | Must retrain |
| Suitable problems | Instructions, format, role | Unknown knowledge, frequently changing documents | Consistent tone, output format, repetitive behavior |

The OpenAI fine-tuning documentation describes fine-tuning as teaching examples of behavior and lists classification, subtle translation, generating specific output formats, and correcting cases where instructions are not followed as suitable examples. Inserting knowledge is not on that list.

The usual order for choosing is from light to heavy. First, refine the [prompt](#/post/ai-prompt); if unknown information is the problem, use RAG; if the same mistake keeps repeating due to behavioral issues, consider fine-tuning. The documentation also advises creating evaluation criteria first and comparing fine-tuning results with the base model. This implies that whether fine-tuning is appropriate should be verified using [evaluation](#/post/ai-evals).

## What Fine-tuning Does

The weights of a pre-trained model consist of billions of numbers. Fine-tuning shows examples paired with inputs and desired outputs, gradually adjusting these numbers. Once training is complete, these changes are embedded in the weights, so the model behaves similarly without needing to attach long examples to the prompt.

There are broadly two approaches:

- Full fine-tuning: Trains all weights. It offers the most freedom but requires memory and storage space proportional to the model size because it updates all numbers. The LoRA paper cites GPT-3 175B as an example, raising the issue that distributing a separate 175B copy for each model is a significant burden.
- Parameter-Efficient Fine-Tuning (PEFT): Freezes most weights and trains only a small portion or newly added parts. LoRA is the representative method here; other methods like adapters also exist.

Note: If you are not directly serving an [LLM](#/post/ai-llm) but using it via API, you will use the provider's fine-tuning features instead of manipulating weights yourself. The OpenAI documentation notes that this platform is being phased out gradually (existing customers can continue generating work until January 6, 2027), so it's advisable to check current availability before proceeding.

## LoRA Principles

The paper is "LoRA: Low-Rank Adaptation of Large Language Models" by Hu et al., published in 2021 on arXiv (arXiv 2106.09685). The idea is as follows: Keep the pre-trained weight matrix W0 unchanged and constrain the change from training to be expressed as the product of two small matrices.

```
W0: d × k  (얼려 둠, 학습 안 함)
B : d × r  (학습)
A : r × k  (학습)
r : 랭크, d·k보다 훨씬 작은 수

출력 h = W0·x + B·A·x
```

Learning the entire change ΔW would require d×k numbers, but splitting it into B and A reduces it to r×(d+k) numbers. The justification given in the paper is that when adapting a model to a specific task, the necessary changes can be captured with low rank.

Initialization values are important. A starts with random Gaussian values, while B starts at 0. Therefore, at the start of training, BA is 0, and the model behaves exactly like the original model. The change includes a scaling factor α/r; according to the paper, α is fixed to an initial trial value and not tuned separately. Changing r also reduces the need to adjust other hyperparameters.

The application location is typically the query (Wq) and value (Wv) projection matrices of the attention mechanism in most experiments in the paper. The MLP part was frozen, and extending to that remains a follow-up task. The Hugging Face PEFT documentation also notes that LoRA is usually applied only to attention blocks in Transformers.

When deploying, if you pre-calculate W = W0 + BA, inference speed matches the original model. While inserting adapter layers adds an extra layer and increases latency, LoRA disappears when merged. In PEFT, `merge_and_unload()` performs this operation.

The paper also provides numbers: For GPT-3 175B with r=4 applied only to query and value matrices, the checkpoint size drops from about 350GB to about 35MB (roughly 10,000 times reduction), and GPU memory required for training decreases from about 1.2TB to 350GB. This is because parameters not involved in training do not need to store optimizer states. The paper also states that RoBERTa, DeBERTa, GPT-2, and GPT-3 achieved quality equal to or better than full fine-tuning.

<details>
<summary>Detailed explanation: How much do parameters decrease (direct calculation)</summary>

Let's assume one layer has weights of 4096 × 4096. In full fine-tuning, that amounts to 16,777,216 parameters. LoRA requires only r × (d + k) parameters.

| Rank r | LoRA Training Parameters | Ratio vs Full Model |
|---|---|---|
| 4 | 32,768 | ~0.2% |
| 8 | 65,536 | ~0.4% |
| 16 | 131,072 | ~0.8% |

The table above is a simple calculation based on a single matrix. The actual ratio within the entire model depends on which matrices LoRA is applied to.

</details>

<details>
<summary>Detailed Explanation: PEFT Configuration Example</summary>

The basic workflow from the Hugging Face PEFT documentation consists of four steps: create the base model, instantiate `LoraConfig`, wrap it with `get_peft_model()`, and then train as usual.

```python
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=8,
    lora_alpha=16,
    target_modules=["q_proj", "v_proj"],
    bias="none",
)
peft_model = get_peft_model(base_model, config)
# ... 학습 ...
merged = peft_model.merge_and_unload()
```

`r` denotes the rank of the update matrices; a lower value results in fewer trainable parameters. `lora_alpha` is the scaling factor, with a default scaling of `lora_alpha / r`. The names in `target_modules` vary depending on the model architecture. The code above is adapted from an example in the PEFT documentation.

</details>

## Advantages and Limitations of LoRA

The main advantage is that you can stack multiple lightweight LoRA files for different tasks onto a single base model. As noted in the PEFT documentation, thanks to frozen pre-trained weights, you can create several small and portable LoRA models tailored to various tasks. When switching tasks, you simply subtract BA and add another B'A'.

Limitations are also discussed in the paper. If you merge A and B into W to eliminate latency, it becomes difficult to process inputs from different tasks within a single batch. If latency is not critical, an alternative approach is to select a LoRA module per sample without merging.

## Requirements for Data Preparation

Based on OpenAI documentation, here are the guidelines:

- Format: JSONL, with one JSON object per line using chat message format.
- Quantity: A minimum of 10 lines; improvement was observed with documents containing 50–100 examples. It is recommended to start with well-crafted 50 examples and evaluate results.
- Evaluation Split: Set aside a portion of the collected data as a holdout control group for comparison between the fine-tuned model and the base model.
- Workflow Order: First, define datasets and evaluations specifying what constitutes a "good answer," then upload files, create tasks, run evaluations, and iterate.

Examples that specify "what is a good answer" serve as the learning signal; therefore, example quality takes precedence over quantity. If examples contain incorrect answers or inconsistent formats, the model will learn them directly. At this stage, you must also filter out personal information or internal secrets from the training data. Ensuring the model responds safely is covered separately in [Guardrails](#/post/ai-guardrails).

## Common Misconceptions

- Fine-tuning means the model memorizes our documents: The purpose of fine-tuning described in documents is to teach behavior, not just knowledge. If knowledge changes frequently or requires citations, RAG is more appropriate.
- Fine-tuning eliminates hallucinations: While fine-tuning can reduce hallucinations (the problems models fabricate), there is no evidence that it completely eliminates them. Direct evaluation is preferable.
- LoRA is a cheap but low-quality method: Papers report equal or better quality than full fine-tuning across multiple models, though this does not apply to every task.
- Fine-tuning requires massive amounts of data: OpenAI documentation notes improvements with just 50–100 examples, though requirements vary by task.
- Using LoRA slows down inference: When deployed merged, the speed matches the original model.
- You can reuse a model after changing it: LoRA is trained to match the weight structure of a specific base model; if the base model changes, you must retrain. This stems from the LoRA architecture (adding a matrix to W0). Refer to [AI Model Guide](#/post/ai-models) for model selection.

## Reference Links

- Hu et al., LoRA: Low-Rank Adaptation of Large Language Models: https://arxiv.org/abs/2106.09685 (Method explanation: https://ar5iv.labs.arxiv.org/html/2106.09685)
- Hugging Face PEFT, LoRA Conceptual Guide: https://huggingface.co/docs/peft/main/en/conceptual_guides/lora
- OpenAI, Supervised Fine-Tuning Guide: https://developers.openai.com/api/docs/guides/supervised-fine-tuning

← [Concept Map](#/post/ai-map)

Related Articles: [RAG](#/post/ai-rag) · [Prompts](#/post/ai-prompt) · [Evaluation](#/post/ai-evals)