A diffusion model is a model that learns how to reverse the process of gradually adding noise to an image. When generating images, it starts with pure noise and iteratively removes it in multiple steps.

## In a Nutshell

An LLM that writes text selects one token at a time ([details → LLM](#/post/ai-llm)). Image generation works differently. Instead of drawing pixel by pixel in order, it starts with the entire screen as noise and repeatedly asks, "How should this change to look less like noise?" dozens of times. Once the iterations are complete, the noise disappears, leaving behind an image.

This approach is called a **diffusion** model. The name comes from the physical concept of diffusion (ink spreading in water). The abstract of the DDPM paper also introduces it as a latent variable model inspired by non-equilibrium thermodynamics. Within [Generative AI](#/post/ai-generative), the component responsible for images generally belongs to this family.

## Principle: The Path to Destruction and the Path Back

There are two directions.

| | Action | Who does it |
|---|---|---|
| Forward (noising) | Gradually mixes noise into a real image until it becomes pure noise | Fixed formula, no learning required |
| Reverse (denoising) | Removes some noise from a noisy image | Neural network, this is the learning target |

The forward process is just a mathematical formula. The amount of mixing is determined by a schedule (how much to mix over how many steps). During training, it proceeds as follows:

1. Select one training image.
2. Randomly pick a step $t$.
3. Create an image with noise added up to that step.
4. Ask the neural network to identify "what this mixed noise was." We know the answer since we added it ourselves.
5. Adjust the weights based on the error. Repeat this for millions of images.

According to the DDPM paper abstract, this training uses a weighted variational bound and stems from connecting noise removal score matching with Langevin dynamics. In simpler terms, it's a regression problem where the model tries to predict the added noise.

During generation, there is no target image. Starting from pure noise, the neural network predicts the noise to subtract, then predicts again, and subtracts again for a predetermined number of times. This count corresponds to the `steps` value seen in the UI. Historically, **U-Net** architectures have been widely used; nowadays, [Transformer](#/post/ml-transformer)-based models are also employed (the Hugging Face model repository has separate folders for `unets` and `transformers`). Both are types of [neural networks](#/post/ml-neural-net).

<details>
<summary>Detailed explanation: Running the forward formula directly</summary>

The forward process can skip directly to a desired step. Let $x_0$ be the original image, $\epsilon$ be standard normal noise, and $\bar{a}_t$ be the cumulative product. Then:

    x_t = sqrt(abar_t) * x0 + sqrt(1 - abar_t) * eps

As $t$ increases, $\bar{a}_t$ approaches 0, leaving almost no trace of the original image. If the neural network accurately predicts $\epsilon$, we can invert the above equation to directly reconstruct $x_0$. Below is a test running this formula on an 8-element signal (using NumPy, executed directly for verification). The schedule was linear ($\beta$ from 1e-4 to 0.02, $T=1000$).

    import numpy as np
    T = 1000
    beta = np.linspace(1e-4, 0.02, T)
    abar = np.cumprod(1 - beta)
    rng = np.random.default_rng(0)
    x0 = np.sin(np.linspace(0, 6.28, 8))
    for t in (0, 100, 500, 999):
        eps = rng.standard_normal(8)
        xt = np.sqrt(abar[t]) * x0 + np.sqrt(1 - abar[t]) * eps
        x0h = (xt - np.sqrt(1 - abar[t]) * eps) / np.sqrt(abar[t])
        print(t, round(abar[t], 4), round(float(np.abs(xt - x0).mean()), 3), float(np.abs(x0h - x0).max()))

The output was as follows ($t$, $\bar{a}_t$, mean difference from original, reconstruction error with exact $\epsilon$):

| t | abar | Mean difference from original | Error when reconstructing with exact eps |
|---|---|---|---|
| 0 | 0.9999 | 0.005 | 0 |
| 100 | 0.8951 | 0.286 | 0 |
| 500 | 0.0778 | 0.625 | 0 |
| 999 | 0.0 | 0.788 | 0 |

At $t=999$, the original component is effectively 0, so it is almost pure noise. The reconstruction error is 0 because we used the exact $\epsilon$ as the answer; actual models approximate $\epsilon$, leading to errors. This is a toy experiment verifying the formula, not an image model.

</details>

## Why One in Latent Space

Running diffusion directly on pixels is expensive. A 512x512 color image has over 780,000 values, and this must pass through the neural network dozens of times. The abstract of the Latent Diffusion paper (the foundation of Stable Diffusion) points out that a pixel-space diffusion model requires "hundreds of GPUs" for optimization and is costly because inference involves sequential evaluation. The solution is to run diffusion in the latent space of a pre-trained autoencoder.

The flow is as follows:

    Image --(Encoder)--> Small Latent Representation --(Diffusion: Iterative Noise Removal)--> Clean Latent Representation --(Decoder)--> Image

Noise is removed from a compressed representation of the image, and only at the end is it decoded once into pixels via the decoder. Since the same work happens on much smaller tensors, computation is reduced. The paper abstract simply states that computational requirements are "significantly reduced."

It feels similar to [Embeddings](#/post/ai-embedding), but the purpose differs. Embeddings are vectors created to compare meanings, whereas latent representations here are compressed forms of images capable of being reconstructed.

## Conditioning with Text

Running it without conditions produces random images. To get images matching a prompt, text information must be provided to the neural network. The Latent Diffusion paper states that an attention layer was added to the architecture to accept condition inputs such as text or bounding boxes. Text is converted into vectors by a separate text encoder and fed in. Hugging Face documentation lists the text encoder, U-Net, and VAE as separate components of the pipeline. The discussion on handling text and images together continues in [Multimodal](#/post/ai-multimodal).

## Pipeline Components

The `diffusers` documentation describes the pipeline as a combination of models and schedulers. In summary, it is as follows:

| Component | Function |
|---|---|
| Text Encoder | Converts prompts into vectors |
| Noise Prediction Model (e.g., U-Net) | Predicts the noise in the current image |
| Scheduler (Sampler) | Receives predictions and calculates an image with "one less step of noise" |
| VAE (Autoencoder) | Translates between images and latent representations |

The documentation emphasizes that schedulers are separate from the model. During training, the scheduler defines the noise schedule; during inference, it accepts $x_t$ via a `step` function and returns $x_{t-1}$ from the previous step. Thus, one can swap out just the scheduler for the same model. This explains why there is a field to choose a sampler in the UI.

## How ComfyUI Presents These Components

The ComfyUI documentation introduces itself as a node-based interface and inference engine for generative AI. It claims to run on local devices and handle images, video, audio, and 3D. Nodes are connected with lines to create workflows.

Knowing the component table above allows one to read the node graph. The sequence typically involves nodes for loading model files, converting prompts into vectors, a sampling node (where `steps` and the sampler are defined), and a node for decoding latent representations into images, all connected in order.

The mention of running locally connects to [Local Models](#/post/ml-local-models) and [Inference](#/post/ml-inference). The number of steps corresponds to the number of neural network calls; therefore, increasing `steps` increases time proportionally. GPU memory is determined by model size and resolution.

## Common Misconceptions

- **The model stores and remixes learned images:** Structurally, it is not a storage repository. What remains after training are weights that predict noise.
- **Increasing steps always improves results:** Beyond a certain point, the difference diminishes while time increases.
- **It works on the same principle as an LLM:** While both use neural networks, the method of selecting the next token differs from the process of removing noise; they are distinct generation processes.
- **The prompt is the image itself:** Even with the same prompt, different images result if the initial noise differs. The seed (`seed`) is the value that fixes this initial noise.

← Concept map ([AI Concept Map](#/post/ai-map), [AI Principle Map](#/post/ml-map))

Related articles: [Generative AI](#/post/ai-generative) · [Multimodal](#/post/ai-multimodal) · [Local Models](#/post/ml-local-models)

## Reference Links

- Ho et al., Denoising Diffusion Probabilistic Models (abstract check): https://arxiv.org/abs/2006.11239
- Rombach et al., High-Resolution Image Synthesis with Latent Diffusion Models (abstract check): https://arxiv.org/abs/2112.10752
- Hugging Face diffusers, Philosophy: https://huggingface.co/docs/diffusers/en/conceptual/philosophy
- ComfyUI Docs introduction: https://docs.comfy.org/