A neural network is a function composed of layers of "multiply, add, and bend once" calculations, while backpropagation is the method that calculates backwards from the output to determine how much and in which direction to adjust the numbers (weights) inside.

## A Single Neuron

A neuron sounds grand but its calculation is simple. It multiplies input numbers by weights, sums them up, adds a bias, and then passes the result through an activation function.

```
출력 = 활성화( w1*x1 + w2*x2 + ... + b )
```

Weights and biases are the numbers that change during learning. What learning is, what loss is, and what gradient descent is are explained separately in [details → Machine Learning & Deep Learning Basics](#/post/ml-basics), so here we focus only on attaching these concepts to neural networks.

## Layers and Activation Functions

A layer (layer) is a row of neurons connected together. Connecting an input layer → hidden layer(s) → output layer forms a neural network. A single layer is calculated with one matrix multiplication. If there are 2 inputs and 4 neurons, the weights form a 2×4 matrix.

However, without activation functions, stacking multiple layers is useless. Performing matrix multiplication twice is equivalent to multiplying once by the combined matrix, meaning you can only express linear relationships. To make stacking layers worthwhile, a non-linear function must be inserted in between.

| Function | Shape | Usage |
|---|---|---|
| Sigmoid | Compresses into 0~1 | Outputs interpreted as probabilities |
| tanh | Compresses into -1~1 | Hidden layers in small neural networks |
| ReLU | Negative values become 0, positive values stay unchanged | Default for deep neural networks |

ReLU became the default because it is computationally cheap and, since its slope is 1 for positive values, signals degrade less even as layers deepen.

## Forward Propagation

The process of feeding inputs through layers sequentially to obtain an output is called forward propagation (forward). The output is compared with the true value using a loss function to produce a single number (the loss). Learning involves adjusting weights slightly in the direction that reduces this loss.

The problem is that there can be tens of millions to tens of billions of weights. If we check each one individually—"how does the loss change if I increase this weight slightly?"—we would have to run forward propagation as many times as there are weights. Backpropagation finishes this entire task with a single backward calculation.

## Backpropagation: Multiplying Backwards

The essence of backpropagation (backprop) is the chain rule. If a function is nested like f(g(x)), the influence of x on f is "the influence of x on g × the influence of g on f." Since a neural network is a stack of such nested functions, starting from the loss and multiplying influences (gradients) layer by layer backwards allows us to compute the gradient for every weight.

The CS231n notes explain this using a circuit of connected gates. Each gate only knows its local gradient with respect to its own input. By multiplying that local gradient with the gradient flowing down from behind and passing it forward, we are done. Several rules emerge:

- Addition gates pass the gradient unchanged to both sides.
- Multiplication gates pass the product of the relative input values (inputs swap roles).
- If a variable is used in multiple branches, gradients from all branches are summed.
- Intermediate values computed during forward propagation are stored and reused when going backwards.

Because of the last item, learning consumes a lot of memory. During inference, intermediate values can be discarded, but they must be retained for backpropagation.

According to Wikipedia's summary, backpropagation strictly refers only to computing gradients, while adjusting weights using those gradients is the job of optimizers like SGD or Adam. In everyday conversation, the two are combined and casually referred to as "learning via backpropagation."

The speed also stems from this: since gradients for each layer are computed once and reused from the preceding layer, it is far cheaper than recalculating separately for each weight. The 1986 paper by Rumelhart, Hinton, and Williams is cited as popularizing this method for training hidden layers, though Wikipedia notes that similar ideas were discovered independently multiple times in a tangled history.

## XOR Solved Directly

XOR (output 1 only when inputs differ) cannot be separated by a single straight line, so it cannot be solved without a hidden layer. I implemented a neural network with 4 neurons in the hidden layer using only NumPy and ran it. This is backpropagation code written by hand.

```python
import numpy as np
rng = np.random.default_rng(1)
X = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
y = np.array([[0],[1],[1],[0]], dtype=float)
W1 = rng.normal(0, 1, (2, 4)); b1 = np.zeros((1, 4))
W2 = rng.normal(0, 1, (4, 1)); b2 = np.zeros((1, 1))
sigmoid = lambda z: 1 / (1 + np.exp(-z))
lr = 1.0
for step in range(5001):
    # 순전파
    h = np.tanh(X @ W1 + b1)
    p = sigmoid(h @ W2 + b2)
    loss = np.mean((p - y) ** 2)
    # 역전파: 출력 쪽에서 거꾸로
    dp = 2 * (p - y) / len(X)
    dz2 = dp * p * (1 - p)            # 시그모이드 미분
    dW2 = h.T @ dz2; db2 = dz2.sum(0, keepdims=True)
    dh = dz2 @ W2.T
    dz1 = dh * (1 - h ** 2)           # tanh 미분
    dW1 = X.T @ dz1; db1 = dz1.sum(0, keepdims=True)
    # 경사하강법
    W1 -= lr * dW1; b1 -= lr * db1; W2 -= lr * dW2; b2 -= lr * db2
    if step % 1000 == 0:
        print(step, round(float(loss), 4))
print(np.round(p, 2).ravel())
```

Execution results (NumPy 2.5.4, Python 3):

```
0 0.24
1000 0.0008
2000 0.0003
3000 0.0002
4000 0.0002
5000 0.0001
[0.   0.99 0.99 0.01]
```

The loss dropped from 0.24 to 0.0001, and the output converged to [0, 1, 1, 0]. I also verified correctness using numerical differentiation: changing one weight by a tiny amount yielded a loss change of -1.2166e-05, while the gradient computed via backpropagation was -1.2169e-05—almost identical. Comparing directly like this once is safe for hand-written backpropagation code.

What was interesting was when the seed was set to 0. The same code got stuck near a loss of 0.125, with outputs frozen at [0.01, 0.5, 0.99, 0.5]. This demonstrates that poor initial weights can trap the model in a shallow local minimum. Seeds 1 through 4 all converged successfully.

<details>
<summary>If you unpack the backpropagation code line by line</summary>

The loss is $L = \text{mean}((p - y)^2)$, where $p = \sigma(z_2)$, $z_2 = h \cdot W_2 + b_2$, $h = \tanh(z_1)$, and $z_1 = X \cdot W_1 + b_1$. We move backward one layer at a time from the loss.

1. $dp = \partial L / \partial p = 2(p - y) / N$. This is the derivative of the squared error.
2. $dz_2 = dp \cdot p(1 - p)$. We use the fact that the derivative of the sigmoid is $\sigma(1 - \sigma)$.
3. $dW_2 = h^\top \cdot dz_2$. Since $z_2 = h \cdot W_2$, the gradient with respect to $W_2$ takes the form of multiplying by $h$, following the rule that a multiplication gate passes gradients scaled by its input.
4. $dh = dz_2 \cdot W_2^\top$. This is the gradient flowing toward $h$ from the same multiplication.
5. $dz_1 = dh \cdot (1 - h^2)$. The derivative of $\tanh$ is $1 - \tanh^2$.
6. $dW_1 = X^\top \cdot dz_1$. The first layer follows the same pattern.

For biases, since they are additive gates, we receive the gradient directly and sum it over the 4 samples (`sum(0)`). Each line represents "gradient from behind × local gradient of this gate".
</details>

## Common Misconceptions

- The statement that neural networks mimic the brain is merely an etymological origin; actual computation involves matrix multiplications and non-linear functions as described above.
- Backpropagation is not the entire learning algorithm; it computes gradients, while the optimizer performs the updates.
- Stacking more layers does not always improve performance. If activation functions are chosen poorly, gradients may vanish or explode as they propagate through layers, preventing learning. This has led to mechanisms like ReLU and residual connections.
- The claim that neural networks are universal approximators means that theoretically, with sufficient size, they can approximate any function, but this does not guarantee successful training. As in the seed 0 example above, training may fail.

## Next Steps

Building on this structure, stacking many more layers and incorporating attention mechanisms is detailed in [Transformer and Attention →](#/post/ml-transformer), while large-scale training on text data results in [LLMs →](#/post/ai-llm). The breakdown of the training stages continues in [From Pretraining to RLHF →](#/post/ml-pretraining). Discussions on how words are treated as numeric embeddings within neural networks can be found in [Embeddings →](#/post/ai-embedding).

## Reference Links

- CS231n, Backpropagation, Intuitions: https://cs231n.github.io/optimization-2/ (read)
- Wikipedia, Backpropagation: https://en.wikipedia.org/wiki/Backpropagation (read up to the first 100,000 characters)
- Rumelhart, Hinton, Williams, "Learning representations by back-propagating errors", Nature 323 (1986): https://www.nature.com/articles/323533a0 (mentioned as a citation in Wikipedia)

← [Concept Map →](#/post/ai-map)
Related articles: [Machine Learning & Deep Learning Basics →](#/post/ml-basics) · [Transformer and Attention →](#/post/ml-transformer) · [From Pretraining to RLHF →](#/post/ml-pretraining)