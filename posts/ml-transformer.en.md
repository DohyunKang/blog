Transformers are a structure that calculates scores for how much words within a sentence refer to each other. Nowadays, almost all [LLM](#/post/ai-llm)s are built on this foundation.

## First, in simple terms

In the sentences "I went to the bank and withdrew money" and "I sat by the river bank to rest," the word 'bank' is spelled the same but has different meanings. The meaning is determined by surrounding words. Humans naturally scan the surroundings while reading a sentence; attention calculates this mechanism.

When processing one word, it looks at all words in the sentence, assigns higher weights to related words and lower weights to less relevant ones, and then computes a weighted average. This average becomes "a new representation of that word mixed with context." All words in the sentence are processed simultaneously in the same manner.

## Where did it come from?

It originated from the 2017 paper "Attention Is All You Need" (by Vaswani et al., 8 authors). Based on green standards, it is a model built solely with attention, without recurrence or convolution, and states that it is easier to parallelize and trains faster than existing structures. It achieved a BLEU score of 28.4 for English-German translation (WMT 2014) and a BLEU score of 41.8 for English-French translation after training on 8 GPUs for 3.5 days.

Previously, RNN-based models read words one by one from the beginning. Since processing the next word required processing the previous word first, parallelization was difficult. Transformers calculate all words simultaneously, making them well-suited for GPUs. The learning method seen in [Neural Networks and Backpropagation](#/post/ml-neural-net) is used as-is; it's essentially just changing the shape of the layers.

## Self-Attention: Q, K, V

The input is one embedding vector per word. Three weight matrices learned from this vector (W^Q, W^K, W^V) are multiplied by the input to create three vectors.

| Name | Role | Analogy |
|---|---|---|
| Q (query) | What this word is looking for | Search query |
| K (key) | What this word presents | Document title |
| V (value) | The content actually passed by this word | Document body |

The calculation consists of four steps.

1. Compute the dot product between my Q and all other words' Ks. A larger value means they match well.
2. Divide the scores by √d_k. In the Illustrated Transformer example, since the dimensionality of K is 64, it is divided by 8.
3. Apply softmax to convert them into weights that sum to 1.
4. Compute the weighted sum of Vs using these weights. This is the output for this word.

In formula notation, it is a single line: `softmax(QKᵀ/√d_k)V`. The entire sentence is bundled into one matrix and calculated at once.

[ Input X ] → X·Wq = Q, X·Wk = K, X·Wv = V → Q·Kᵀ ÷ √d_k → softmax → ×V → [ Output ]

Since Q and K come from the same input, it is called "self" attention. The sentence is looking at itself.

## Multi-Head

Performing attention once captures only one type of relationship. The paper divides this into 8 heads and runs them in parallel. Each head has its own Wq, Wk, and Wv, concatenates the results, and then restores the original size using the W^O matrix. It is designed so that each head sees different positions and different representation spaces. Exactly what role each head plays varies by model, and it is not always clear-cut for humans to interpret.

## Positional Encoding

Using only attention means there is no information about word order. "The dog bit the man" and "The man bit the dog" would become the same set of words. Therefore, different vectors corresponding to each position are added to the input embeddings.

The paper's method uses sine and cosine functions. It uses waveforms with different periods depending on position and dimension, with values ranging from -1 to 1. Since these values are determined by formula rather than learned, it is theoretically possible to extend them to longer sentences than seen during training. Nowadays, many models use other positional methods (such as rotary embeddings).

## Encoder and Decoder

The original paper was for translation purposes, so it consists of two parts.

| | Encoder | Decoder |
|---|---|---|
| Number of layers (paper) | 6 | 6 |
| Layer composition | Self-attention → Feed-forward | Masked self-attention → Encoder-decoder attention → Feed-forward |
| Function | Understands the input sentence as representations | Generates output one word at a time while looking at those representations |

Each sub-layer includes residual connections (adding the input to the output) and layer normalization. In the encoder-decoder attention, Q comes from the decoder, while K and V come from the top output of the encoder.

The first attention in the decoder has a mask. While generating words one by one, future words that have not yet appeared cannot be seen; therefore, scores for future positions are set to −∞ so that weights after softmax become 0. During training, even if the entire correct sentence is input at once, each position only sees what comes before it, enabling parallel training.

LLMs that continue writing text like the GPT series are known to use a decoder-only structure. How such models are trained is covered in [from pre-training to RLHF](#/post/ml-pretraining).

## Minimal Numpy Example

This code has been executed and verified. It directly calculates self-attention and masks with 4 tokens and 8 dimensions.

```python
import numpy as np
np.random.seed(0)

def softmax(x):
    x = x - x.max(axis=-1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)

def attention(x, Wq, Wk, Wv, causal=False):
    Q, K, V = x @ Wq, x @ Wk, x @ Wv
    scores = Q @ K.T / np.sqrt(K.shape[-1])
    if causal:
        mask = np.triu(np.ones_like(scores), k=1) == 1
        scores = np.where(mask, -1e9, scores)
    w = softmax(scores)
    return w @ V, w

def pos_enc(n, d):
    pos = np.arange(n)[:, None]
    i = np.arange(d // 2)[None, :]
    ang = pos / (10000 ** (2 * i / d))
    pe = np.zeros((n, d))
    pe[:, 0::2] = np.sin(ang)
    pe[:, 1::2] = np.cos(ang)
    return pe

n, d = 4, 8
x = np.random.randn(n, d) + pos_enc(n, d)
Wq, Wk, Wv = (np.random.randn(d, d) * 0.5 for _ in range(3))

out, w = attention(x, Wq, Wk, Wv)
print(out.shape)            # (4, 8)
print(np.round(w, 2))
print(w.sum(axis=1))        # 각 행 합 = 1

out_c, w_c = attention(x, Wq, Wk, Wv, causal=True)
print(np.round(w_c, 2))     # 위쪽 삼각형이 0
```

Running it shows that the sum of each row in the weight matrix is 1, and when `causal=True`, everything above the diagonal becomes 0. Since the first token only sees itself, its weights are `[1, 0, 0, 0]`. Because $W_q$, $W_k$, and $W_v$ are random, the weight values themselves have no meaning; learning is the process of filling these matrices.

<details>
<summary>Positional Encoding Formula and Attention Cost</summary>

The positional encoding from Section 3.5 of the paper takes the following form (matching the code above):

- $PE(pos, 2i) = \sin(pos / 10000^{2i/d})$
- $PE(pos, 2i+1) = \cos(pos / 10000^{2i/d})$

As the dimension index $i$ increases, the period becomes longer. Sine is applied to even dimensions and cosine to odd dimensions in an alternating pattern.

Attention generates scores for all pairs of tokens, resulting in a score matrix of size $n \times n$. As sentences get longer, both computation and memory scale quadratically with length. This is one reason why long [context windows](#/post/ai-context-window) are expensive. Methods to reduce this are discussed in [inference optimization](#/post/ml-inference).
</details>

## Common Misconceptions

- Be cautious interpreting attention weights as "the words the model used as reasons." Weights are intermediate calculation values, and with multiple heads and layers, a single weight diagram cannot fully explain the reasoning.
- Saying that Transformers "understand" sentences is merely convenient phrasing; the computation involves repeated matrix multiplications and softmax operations.
- Transformers are not language-specific. The same architecture is known to be used for images, audio, and more. Image-related models are covered in [image generation models (diffusion)](#/post/ml-diffusion).
- Encoders and decoders do not always both exist; the original structure was designed for translation tasks only.

## Summary

- For each token, Q·K·V are created, and context is mixed via $QK^T/\sqrt{d_k} \to \text{softmax} \to V$ weighted sums.
- Multiple heads are used, positional encoding is applied to the order, and future tokens are masked out.
- Parallel training is enabled because tokens are not read sequentially, but instead, costs scale quadratically with sequence length.

## Reference Links

- Vaswani et al., "Attention Is All You Need" (2017): https://arxiv.org/abs/1706.03762
- Jay Alammar, "The Illustrated Transformer": https://jalammar.github.io/illustrated-transformer/

← Concept map ([#/post/ml-map](#/post/ml-map))

Related posts: [Neural Networks and Backpropagation](#/post/ml-neural-net) · [What is an LLM?](#/post/ai-llm) · [Embeddings and Vector Search](#/post/ai-embedding)