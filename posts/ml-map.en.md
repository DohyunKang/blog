[AI Concept Map](#/post/ai-map) covers the terminology from a high-level overview, whereas this article dives deeper into how models actually learn and operate. The flow is: Basics of Learning → Structure → How Models Are Built → Local Handling Methods → Running Them → Image Models. Read just one line per section first, then follow the links for details on what interests you.

## Overview of the Flow

```
학습 기초(손실·경사하강법)
  → 신경망과 역전파
    → 트랜스포머(어텐션)
      → 사전학습 → 지시 튜닝(SFT) → 선호 학습(RLHF·DPO)
        → 파인튜닝(LoRA/QLoRA)
        → 로컬에서 돌리기(양자화·VRAM)
        → 추론 최적화(KV 캐시·배치)
(별도 계열) 이미지 생성 = 확산 모델
```

## 1. What is Learning?

**Machine Learning & Deep Learning Basics**: Learning involves numerically measuring error (loss) and iteratively adjusting weights. It doesn't end just because a model fits training data well; overfitting and splitting into validation/test sets are also covered.
[Read more → Machine Learning & Deep Learning Basics](#/post/ml-basics)

**Neural Networks & Backpropagation**: A neural network is a function built by stacking layers of multiply, add, and non-linear operations. Backpropagation is the method for calculating which direction to adjust weights based on output errors.
[Read more → Neural Networks & Backpropagation](#/post/ml-neural-net)

## 2. The Backbone of LLMs

**Transformers & Attention**: This structure calculates scores indicating how much each word attends to other words in a sentence. It captures context without reading sequentially, and most modern LLMs rely on this backbone.
[Read more → Transformers & Attention](#/post/ml-transformer)

## 3. How Chatbots Are Built

**From Pre-training to RLHF**: This covers pre-training (learning to predict the next word after consuming text), supervised fine-tuning (SFT) for answering questions, and reinforcement learning from human feedback (RLHF/DPO) to steer behavior toward human preferences. A conversational model emerges only after these three stages.
[Read more → From Pre-training to RLHF](#/post/ml-pretraining)

## 4. Local Handling

**Fine-tuning: Full Model vs LoRA/QLoRA**: This involves teaching a pre-trained model again using your own data. Using LoRA allows fine-tuning without modifying the entire model, significantly reducing the required GPU resources.
[Read more → Fine-tuning: Full Model vs LoRA/QLoRA](#/post/ml-finetuning)

## 5. Running Models

**Running Local Models**: Whether a model fits on your PC's graphics card depends roughly on parameter count, quantization bits, and context length. Quantization and VRAM calculations are central to this decision.
[Read more → Running Local Models](#/post/ml-local-models)

**Inference Optimization**: This is about running rather than building. Techniques like KV cache, batching, streaming, and speculative decoding ultimately determine how GPU memory is allocated and utilized.
[Read more → Inference Optimization](#/post/ml-inference)

## Beyond Text: Images

**Image Generation Models (Diffusion)**: These models don't draw pictures directly but learn to gradually remove noise. Understanding this principle makes reading ComfyUI node configurations easier.
[Read more → Image Generation Models (Diffusion)](#/post/ml-diffusion)

## Articles to Read Next

- [AI Concept Map](#/post/ai-map): A guide covering terms like prompts, context, and RAG from a high level.
- [What is an LLM?](#/post/ai-llm): The foundational concepts for the models introduced in this map.
- [LLM App Development Map](#/post/app-map): How to apply these principles to build services.

← Back to Concept Map ([#/post/ai-map])