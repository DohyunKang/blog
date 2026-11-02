# What is Generative AI?

Generative AI is an AI that creates new text, images, and sounds. Although we hear the term frequently, it can be confusing how it overlaps with artificial intelligence, machine learning, and deep learning, so I have organized this once.

## The Inclusion Relationship

These four terms are not separate entities but rather follow a structure where smaller concepts exist within larger ones.

```
인공지능 (사람이 하던 지능적인 일을 기계가 하게 하는 것 전체)
 └ 머신러닝 (규칙을 사람이 짜지 않고, 데이터에서 규칙을 배우게 하는 방법)
    └ 딥러닝 (머신러닝 중 층이 깊은 신경망을 쓰는 방법)
       └ 생성형 AI (딥러닝으로 새 결과물을 만들어 내는 모델들)
```

- **Artificial Intelligence**: This is the broadest term. Even a chess program that operates based on rules written by humans is referred to as AI.
- **Machine Learning**: Instead of "a person writing down the characteristics of cat photos," it shows tens of thousands of photos and lets the system find the characteristics itself.
- **Deep Learning**: Among machine learning methods, this refers to models where neural networks are stacked in multiple layers. Most areas with significantly improved performance in image, audio, and language fall under this category.
- **Generative AI**: These are deep learning models designed for "creation" purposes. LLMs also fall into this category. [More details → LLM](#/post/ai-llm)

To be precise, generative AI is not limited to deep learning; sentence generation was possible even with older statistical models. However, since almost everything we call generative AI today is based on deep learning, I drew it as shown in the figure above. This boundary reflects my way of organizing the concepts, and there is no official definition that strictly divides them this way.

## Discriminative Models vs. Generative Models

This is the core distinction.

- **Discriminative Model**: Given an input, it decides "what this is." For example, identifying a cat or dog from a photo, or determining if an email is spam. The output is one of predefined choices.
- **Generative Model**: It learns how data is distributed and creates new data similar to that distribution. The output is not a choice but actual text, images, or sound itself.

| | Discriminative Model | Generative Model |
|---|---|---|
| Question | What is this input? | How does such data look? |
| Output | Label, score | Text, image, audio |
| Example | Spam filter, face recognition | ChatGPT-style chatbots, image generators |
| Correct Answer | Easily determined as one answer | Multiple correct answers; can vary each time |

In simple terms, a counterfeit bill detector is a discriminative model, while the counterfeiter is a generative model. This analogy closely matches the structure of GAN, which is a single generative model (discussed below).

One point to note is that these two are not completely separate types. Discriminative components can exist within generative models, and generative models can also be used for classification. Therefore, I have accepted the distinction based on "what the purpose is."

## How Text, Images, and Sounds Are Created

While all three involve "creating little by little and connecting them," the methods of breaking things down differ.

### Text: Guessing the Next Token

The core of text generation is the Transformer architecture. In 2017, Vaswani et al.'s paper "Attention Is All You Need" proposed a model built solely on attention without recurrence or convolution, achieving the highest scores at the time for translation (English-German 28.4 BLEU, English-French single model 41.8 BLEU). The paper also highlighted that it is easier to parallelize, leading to faster training.

Current LLMs are based on this structure. The operation is simple:

1. Break the text into tokens (word pieces).
2. Based on the tokens seen so far, calculate the probability distribution of the next token.
3. Pick one from there and append it, then return to step 2.

So, instead of writing the entire text at once, it appends one token at a time. Because of the "picking" process based on probability, answers can vary even for the same question. This structure also serves as the background for hallucinations. [More details → Hallucination](#/post/ai-hallucination)

### Images: Carving Out from Noise

GANs were once representative in the image domain, but diffusion models are now known as the mainstream approach.

- **GAN (2014, Goodfellow et al.)**: It pits two neural networks against each other—a generator and a discriminator. The generator tries to fool the discriminator, while the discriminator tries to distinguish real from fake. The paper explains that in an ideal case, the generator learns to follow the distribution of the training data, and the discriminator outputs 1/2 everywhere. This leads to the analogy of the counterfeiter and the bill detector above.
- **Diffusion Models**: During training, they learn "how to reverse mixing" by gradually adding noise to images. When generating, they start with pure noise and remove it over multiple steps to create an image. Ho et al.'s DDPM paper in 2020 reported an FID of 3.17 on CIFAR-10, greatly publicizing this approach.

Creating images from text involves adding a "text condition." By converting the meaning of a sentence into a numerical vector and feeding it into the diffusion process, the direction of removing noise leans toward that sentence. This numerical vector is called an embedding. [More details → Embedding](#/post/ai-embedding)

In 2022, Rombach et al.'s Latent Diffusion paper stated that running this in a compressed latent space instead of pixels makes computation much lighter. The paper notes that pixel diffusion takes hundreds of GPU-days. While the Stable Diffusion series is known for using this method, I have not read through to the model documentation for those specific models in this article.

### Voice: Building a waveform or spectrogram sequence

Sound consists of waveforms made up of tens of thousands of numbers (samples) per second. In 2016, DeepMind's WaveNet constructed this by predicting the next sample based on each individual sample and the preceding ones, akin to "guessing the next word" in text. The paper was praised for producing more natural speech synthesis in English and Chinese compared to existing methods, and it is also said to have been used to create music pieces.

The exact structure of modern speech synthesis varies by model, so this article does not consolidate them into a single framework.

| | Unit | Generation Flow | Representative Idea |
|---|---|---|---|
| Text | Token | Predict next token given context | Transformer |
| Image | Pixel/Latent Value | Refine from noise over multiple steps | GAN, Diffusion |
| Audio | Sample | Predict next sample given context (WaveNet) | Autoregressive |

<details>
<summary>Detailed explanation: Discriminative vs. Generative models in equations</summary>

Discriminative models learn the probability p(y|x) of a label y given input x. Generative models learn the distribution of the data itself, p(x) (or p(x, y) if labels are present). If p(x) is known, one can sample from it to create new x. These equations represent general probability concepts and were not directly cited from papers in this article; they are included as foundational concepts.

</details>

<details>
<summary>Detailed explanation: Differences between GANs and Diffusion models in training</summary>

GANs train two networks simultaneously against each other. The paper refers to this as a minimax two-player game. While it is commonly said that achieving balance is difficult, this point was not mentioned in the abstract of the papers read for this article. Diffusion models learn step-by-step with the goal of removing noise. However, generation requires passing through multiple steps, making it slower, as noted in the Latent Diffusion paper.

</details>

## Common Misconceptions

- Generative AI copies from the internet: It learns the distribution of training data to create new content. However, whether results can be very similar to the training data is a separate issue not covered here.
- Generative AI knows facts: Since it generates plausible continuations, it does not inherently have mechanisms to verify factual accuracy.
- All deep learning is generative: Image classification and spam filtering also use deep learning; only models designed for creation are generative.
- Only chatbots are generative AI: Text is just one domain; images, audio, video, and code also fall under this category.

← Concept map (#/post/ai-map)

Related articles: [LLM](#/post/ai-llm) · [Embedding](#/post/ai-embedding) · [Hallucination](#/post/ai-hallucination)

## Reference Links

- Vaswani et al., Attention Is All You Need: https://arxiv.org/abs/1706.03762
- Goodfellow et al., Generative Adversarial Networks: https://arxiv.org/abs/1406.2661
- Ho et al., Denoising Diffusion Probabilistic Models: https://arxiv.org/abs/2006.11239
- Rombach et al., High-Resolution Image Synthesis with Latent Diffusion Models: https://arxiv.org/abs/2112.10752
- van den Oord et al., WaveNet: https://arxiv.org/abs/1609.03499