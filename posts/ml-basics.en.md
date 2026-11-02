Machine learning is an approach where rules are not written by humans; instead, data is provided, and the model itself learns to determine the numbers (weights) corresponding to those rules. Deep learning refers to the subset that uses neural networks with deeply stacked layers.

## Starting with Simple Terms

Imagine building a program to filter out spam emails. The traditional method involves humans writing rules one by one, such as "If the subject contains 'Winner', it's spam." Machine learning takes the opposite approach: provide a large number of emails labeled as spam and those that are not, and let the model find the rules to distinguish between them from the data.

The essence of these rules is numbers. The system accepts input, multiplies several numbers (weights), adds them up, and produces an answer. Initially, these numbers are chaotic, resulting in poor answers. Learning is the process of gradually correcting these numbers to reduce errors. While the term "learning" sounds grand, the actual task is simply adjusting numbers.

Deep learning follows the same framework but differs in scale: the number of parameters increases from a few to millions or even billions, and multiple layers of multiplication and addition are stacked. The layered structure is discussed in [detail → Neural Networks and Backpropagation](#/post/ml-neural-net). LLMs also operate on top of this framework. [See more → LLM](#/post/ai-llm)

## The Three Components of Learning

Breaking down learning reveals three key components:

| Component | Function | Example |
|---|---|---|
| Model | A mechanism to produce an answer from input; contains adjustable numbers (parameters). | `prediction = w × input + b` |
| Loss Function | Quantifies how wrong the answer is with a single number. | Mean Squared Error (MSE), which averages squared errors |
| Optimizer | Adjusts parameters to reduce the loss. | Gradient Descent |

The order of operation for these three is always the same: make a prediction with current numbers, calculate the loss, slightly adjust the numbers in the direction that reduces the loss, and repeat this process.

## Loss Function

A loss function is a function that condenses "how wrong" into a single number. The smaller the number, the better the fit. The reason for reducing it to a single number is to establish a clear direction: "towards reducing the loss."

In regression (predicting numbers), MSE (Mean Squared Error) is common, where errors are squared and averaged. Squaring ensures that negative and positive errors do not cancel each other out, and larger mistakes incur greater penalties. In classification (spam or not spam), a different loss called cross-entropy is typically used. Here, the lower the predicted probability for the correct answer, the higher the loss; however, the formula is not derived here.

Choosing what to use as the loss function determines "what kind of model you want," because the model will only try to minimize the loss.

## Gradient Descent

Gradient descent is a method to find and descend towards the lowest point of the loss. Google's machine learning course explains it this way: start weights and biases near zero, calculate the loss, find the direction that reduces the loss, and move slightly in that direction; repeat until no further reduction occurs.

Thinking of it as descending a foggy mountain makes it easier to understand: you cannot see the peak, but you can feel the slope beneath your feet. Take a step downhill, feel the slope again, and repeat. The slope beneath your feet is the gradient, and the size of each step is the learning rate. The update rule is as follows:

`new_value = old_value - learning_rate × gradient`

If the learning rate is too small, it takes a long time to descend; if too large, you might skip over valleys and actually increase the loss. Therefore, the learning rate is said to be one of the hyperparameters set by humans that we encounter first.

I ran this directly. Here is code fitting a straight line to five points (`y ≈ 2x + 1` with slight noise).

```python
import numpy as np
x = np.array([1,2,3,4,5], dtype=float)
y = np.array([3.1,4.9,7.2,8.8,11.1])
w, b, lr = 0.0, 0.0, 0.01
for step in range(1, 1001):
    pred = w*x + b
    err = pred - y
    loss = (err**2).mean()
    gw = 2*(err*x).mean()   # 손실을 w로 미분한 값
    gb = 2*err.mean()       # 손실을 b로 미분한 값
    w -= lr*gw; b -= lr*gb
    if step in (1,10,100,1000):
        print(step, round(loss,4), round(w,3), round(b,3))
```

The execution results were as follows:

| Iteration | Loss | w | b |
|---|---|---|---|
| 1 | 57.222 | 0.501 | 0.14 |
| 10 | 0.5012 | 1.972 | 0.563 |
| 100 | 0.0414 | 2.081 | 0.72 |
| 1000 | 0.0214 | 1.994 | 1.034 |

The loss dropped from 57 to 0.02, and w converged near 2 while b converged near 1. Most of the descent happens within the first ten iterations, followed by gradual refinement thereafter. Neural networks use this same framework; when there are countless parameters, backpropagation is the efficient method for calculating gradients.

## Overfitting

The goal of learning is not to match training data but to match unseen data. Using Google's course terminology, this ability is called generalization, and the opposite state is overfitting. A model that fits training data very well but fails on new data is considered overfitted.

Using an analogy with exam preparation, it's like memorizing only the answers to past questions verbatim. You might get full marks on past papers, but any slight change in the question causes you to fail. This kind of rote memorization becomes easier when a model has many parameters and limited data, because it ends up memorizing noise (random fluctuations) mixed into the data as rules.

I also ran this experiment. I created 60 points by adding noise to `sin(2x)`, trained with 30 points, and validated with 15 points while varying the degree of the polynomial. Higher degrees make the model more complex.

```python
import numpy as np
rng = np.random.default_rng(0)
x = rng.uniform(-1,1,60)
y = np.sin(2*x) + rng.normal(0,0.2,60)
idx = rng.permutation(60)
tr, va, te = idx[:30], idx[30:45], idx[45:]
def mse(p,i): return float(((np.polyval(p,x[i])-y[i])**2).mean())
for d in (1,3,9,15):
    p = np.polyfit(x[tr], y[tr], d)
    print(d, round(mse(p,tr),3), round(mse(p,va),3))
```

| Epoch | Training Loss | Validation Loss |
|---|---|---|
| 1 | 0.075 | 0.07 |
| 3 | 0.032 | 0.044 |
| 9 | 0.024 | 0.048 |
| 15 | 0.021 | 0.936 |

Training loss continues to decrease as the epoch increases. Validation loss is lowest around epoch 3 and spikes up to 0.936 at epoch 15. If we only looked at the training numbers, epoch 15 would appear to be the best model. Conversely, epoch 1 is too simple, resulting in high values for both metrics; this is referred to as underfitting.

The Google course conveys the same signal: when training loss continues to decrease or flattens out but validation loss starts rising at some point, it indicates overfitting.

## Training, Validation, and Test Sets

Without validation data in the experiment above, we would not have detected overfitting. Therefore, data is typically split into three sets.

| Data | Usage |
|---|---|
| Training | Used to adjust parameters |
| Validation | Used to detect overfitting during training and to make choices such as model type and learning rate |
| Test | Used once at the end to estimate performance in a real environment |

The reason for keeping test data separate is that validation data becomes "seen" during the selection process. If we repeatedly choose models based on validation scores, the model may inadvertently adapt to the validation set. The test set must never be used during this selection process to ensure honest evaluation values. In the code above, `te` occupies that position, and in this experiment, it was left unused.

Methods to reduce overfitting include increasing the amount of data, simplifying the model, applying regularization (adding penalties for large parameters), or stopping training when validation loss begins to rise (early stopping).

## Common Misconceptions

- **High training accuracy means a good model:** As shown in the table above, training loss continues to decrease as complexity increases. What matters is performance on unseen data.
- **Larger models are always better:** If a model is too large relative to the data, it becomes prone to overfitting. However, cases like large-scale LLMs that use massive amounts of data are different; we should not apply the logic from this article directly to such scenarios.
- **Learning is memorizing answers:** Memorization is overfitting. The goal is to learn rules (generalization).
- **Gradient descent always reaches the minimum:** This holds true for simple loss landscapes (convex), such as fitting a straight line. For complex cases like neural networks, there is no such guarantee.
- **Deep learning is entirely different from machine learning:** Deep learning is a subset of machine learning. The three components mentioned above and data splitting apply directly here.

## What to Read Next

Once you grasp that learning involves adjusting numbers, questions diverge in two directions: one asks "what structure holds these numbers" ([See details → Neural Networks and Backpropagation](#/post/ml-neural-net)), and the other asks "what do large models look at first and how do they learn initially" ([See details → Pretraining and RLHF](#/post/ml-pretraining)). Further aligning a pre-trained model with your own data is covered in [See details → Fine-tuning](#/post/ml-finetuning). Converting text into number vectors, known as [See details → Embeddings](#/post/ai-embedding), also sits atop this "number adjustment."

<details>
<summary>Detailed explanation: Calculating one step of gradient descent by hand</summary>

Let's assume a single point `(x=2, y=5)`, a model `prediction = w × x`, an initial `w = 0`, and a learning rate of `0.1`.

- Prediction = 0 × 2 = 0, Error = 0 − 5 = −5
- Loss = Error² = 25
- Differentiating loss with respect to w gives `2 × Error × x = 2 × (−5) × 2 = −20`
- New w = 0 − 0.1 × (−20) = 2

A negative gradient means "increasing w reduces the loss," and the minus sign in the update rule directs w to increase. At the new w = 2, the prediction is 4, and the error decreases to −1. Doing this again yields a gradient of `2 × (−1) × 2 = −4`, resulting in w = 2.4, which gets closer to the correct answer of 2.5.

The numpy code above averages this over 5 points and performs the update simultaneously for both w and b.

</details>

## Reference Links

- Google, Machine Learning Crash Course, Overfitting: https://developers.google.com/machine-learning/crash-course/overfitting/overfitting
- Google, Machine Learning Crash Course, Gradient descent: https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent

[← Concept map](#/post/ml-map)

Related posts: [Neural Networks and Backpropagation](#/post/ml-neural-net) · [Pre-training and RLHF](#/post/ml-pretraining) · [Fine-tuning](#/post/ml-finetuning)