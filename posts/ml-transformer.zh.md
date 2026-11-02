Transformer 是一种通过计算句子中词语之间相互参考程度的分数来构建结构的模型。如今，绝大多数 [LLM](#/post/ai-llm) 都以此为基础架构。

## 先说人话

在“去银行取钱”和“坐在江边的银行休息”这两个句子中，“银行”虽然写法相同，但含义不同。确定其含义的是周围的词语。人类在阅读句子时会自然地扫视上下文，而注意力（attention）机制正是通过计算来实现这一点的。

在处理一个单词时，模型会查看句子中的所有单词，对关系密切的单词赋予较大的权重，对关系较远的单词赋予较小的权重，然后计算加权平均值。这个平均值就变成了“融合了上下文的该单词的新表达”。以此方式同时处理句子中的所有单词。

## 出自何处

出自 2017 年的论文《Attention Is All You Need》（Vaswani 等 8 人）。以绿色为基准，该模型仅使用注意力机制构建，无需循环（recurrence）或卷积（convolution），相比原有结构更易于并行化且训练速度更快。据称在英德翻译（WMT 2014）任务中取得了 28.4 BLEU 分数；在英法翻译任务中，使用 8 张 GPU 训练了 3.5 天，达到了 41.8 BLEU 分数。

在此之前，RNN 系列模型是从前往后逐个读取单词的。由于必须处理完前面的单词才能处理下一个单词，因此难以并行运行。Transformer 则同时计算所有单词，非常适合 GPU 运算。[神经网络与反向传播](#/post/ml-neural-net) 中介绍的训练方式继续沿用，只是层的结构发生了变化而已。

## Self-Attention：Q、K、V

输入是代表每个单词的一个 [嵌入](#/post/ai-embedding) 向量。将该向量分别乘以三个学习得到的矩阵（W^Q, W^K, W^V），生成三种向量。

| 名称 | 角色 | 比喻 |
|---|---|---|
| Q (query) | 该单词寻找的内容 | 搜索词 |
| K (key) | 该单词展示的内容 | 文档标题 |
| V (value) | 该单词实际传递的内容 | 文档正文 |

计算分为四个步骤。

1. 计算自身的 Q 与所有单词的 K 的内积。数值越大，表示两者越匹配。
2. 将分数除以 √d_k。在 Illustrated Transformer 文章的示例中，K 的维度为 64，因此除以 8。
3. 应用 softmax 函数，将其转换为总和为 1 的权重。
4. 使用该权重对 V 进行加权求和。这就是该单词的输出。

用公式表示即为 `softmax(QKᵀ/√d_k)V`，只需一行代码即可对整个句子以矩阵形式一次性计算。

[ 输入 X ] → X·Wq = Q, X·Wk = K, X·Wv = V → Q·Kᵀ ÷ √d_k → softmax → ×V → [ 输出 ]

由于 Q 和 K 源自相同的输入，因此被称为“自（Self）”注意力。这意味着句子在审视其自身。

## 多头机制

仅进行一次注意力计算只能捕捉一种关系。论文将这一过程分为 8 个头并行运行。每个头拥有独立的 Wq、Wk、Wv，将结果拼接后，再通过 W^O 矩阵还原为原始维度。这种设计旨在让每个头关注不同的位置或表达空间。具体到每个头的确切作用因模型而异，并非所有情况都能被人类直观解读。

## 位置编码

仅使用注意力机制则缺乏单词顺序信息。“狗咬了人”和“人咬了狗”会变成相同的单词集合。因此，需要在输入嵌入中加上代表不同位置的向量。

论文采用的方法是正弦和余弦函数。根据位置和维度使用具有不同周期的波形，数值范围在 -1 到 1 之间。由于这些值是由公式确定的而非学习得到的，理论上可以将模型应用于比训练时更长的句子。如今的模型常采用其他位置编码方式（如旋转编码等）。

## 编码器与解码器

原始论文旨在用于翻译任务，因此由两部分组成。

| | 编码器 | 解码器 |
|---|---|---|
| 层数（论文） | 6 层 | 6 层 |
| 层内结构 | 自注意力 → 前馈网络 | 掩码自注意力 → 编码器 - 解码器注意力 → 前馈网络 |
| 功能 | 将输入句子转化为理解后的表达 | 基于该表达逐个生成输出单词 |

每个子层都包含残差连接（将输入加到输出上）和层归一化。在编码器 - 解码器注意力机制中，Q 来自解码器，而 K 和 V 来自编码器最顶层的输出。

解码器的第一个注意力层包含掩码。在逐个生成单词的过程中，尚未出现的后续单词无法被查看，因此将未来位置的分数设为 −∞，使得经过 softmax 后的权重变为 0。训练时，即使一次性输入整个目标句子，每个位置也只能看到其前面的部分，从而支持并行训练。

像 GPT 系列那样续写文章的 LLM，其结构被称为仅使用解码器（decoder-only）。关于如何训练这样的模型，请参见 [从预训练到 RLHF](#/post/ml-pretraining)。

## 最小化 NumPy 示例

这是经过运行验证的代码。它计算了 4 个 token、8 维度的自注意力机制和掩码。

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

运行后可以看到，权重矩阵的每一行之和为 1；当 `causal=True` 时，对角线上方全部变为 0。第一个词只看到自己，因此权重为 `[1, 0, 0, 0]`。由于 $W_q$、$W_k$、$W_v$ 是随机的，权重值本身没有特定含义。训练过程就是填充这些矩阵的过程。

<details>
<summary>位置编码公式与注意力成本</summary>

论文第 3.5 节的位置编码形式如下（与上述代码一致）：

- $PE(pos, 2i) = \sin(pos / 10000^{2i/d})$
- $PE(pos, 2i+1) = \cos(pos / 10000^{2i/d})$

维度编号 $i$ 越大，周期越长。偶数维度使用正弦，奇数维度交替使用余弦。

注意力机制会为所有词对生成分数，因此分数矩阵大小为 $n \times n$。句子越长，计算量和内存消耗随长度平方增长。长 [上下文窗口](#/post/ai-context-window) 昂贵的原因之一就在于此。减少这种开销的方法在 [推理优化](#/post/ml-inference) 中进行了讨论。
</details>

## 常见误解

- 需谨慎解读“注意力权重即‘模型引用的词’”。权重仅是计算中间值，且存在多个头和层，单张权重图无法完整解释。
- 说 Transformer“理解句子”只是一种通俗表达，其本质是矩阵乘法与 softmax 的重复运算。
- Transformer 并非仅用于语言任务。同样的结构也被应用于图像、音频等领域。图像方面可参见 [图像生成模型（扩散）](#/post/ml-diffusion)。
- 并非所有模型都同时包含编码器和解码器。原始结构仅用于翻译任务。

## 总结

- 为每个词生成 $Q \cdot K \cdot V$，通过 $QK^T/\sqrt{d_k} \to \text{softmax} \to V$ 加权求和来混合上下文信息。
- 设置多个头，按顺序加入位置编码，并用掩码遮蔽未来内容。
- 由于不按顺序读取，因此支持并行训练；但代价是计算成本随长度平方增长。

## 参考链接

- Vaswani et al., "Attention Is All You Need" (2017): https://arxiv.org/abs/1706.03762
- Jay Alammar, "The Illustrated Transformer": https://jalammar.github.io/illustrated-transformer/

← 概念图 (#/post/ml-map)

相关文章：[神经网络与反向传播](#/post/ml-neural-net) · [LLM 是什么](#/post/ai-llm) · [嵌入与向量搜索](#/post/ai-embedding)