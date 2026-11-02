Multimodal means that a model handles not only text but also other types of input (or output) such as images and audio together. Ultimately, images are converted into tokens and enter the same context window as text.

## What is Multimodal?

Modality refers to the form in which information is contained. Text, images, audio, and video each represent a single modality. A model that accepts only text is called unimodal, while one that handles two or more is referred to as multimodal.

It helps to distinguish between input and output directions first to avoid confusion.

| | Input (Understanding) | Output (Generation) |
|---|---|---|
| Image | Analyzing photos, reading charts, interpreting screenshots | Drawing images |
| Audio | Transcribing speech to text | Reading text aloud |
| Video | Summarizing frame by frame | Generating video |

When an [LLM](#/post/ai-llm) is said to "see" an image, it typically refers to the input side (left column). Models that generate images often belong to a different family, which are discussed separately in articles on [diffusion models](#/post/ml-diffusion) and [generative AI](#/post/ai-generative). Whether a single model performs both functions varies by product.

## Principle: How Images Are Inserted into the Model

Text is split into tokens and converted into numeric vectors. Images follow a similar path. The core idea is dividing an image into small patches.

The abstract of the Vision Transformer (ViT) paper states that applying a pure transformer directly to a sequence of image patches works well for image classification, implying that convolutional neural networks are not strictly necessary. We understand this as the transformer handling image patches in the same structure used for text tokens.

The next challenge is ensuring that text and images meet in the same space. CLIP is a prime example. According to the OpenAI paper abstract, it was trained using 400 million (image, text) pairs collected from the internet, learning to match captions with images. As a result, it can perform new classifications based solely on text descriptions without predefined label lists (zero-shot), and evaluations were conducted across more than 30 datasets. This concept of "placing text and images in the same coordinate system" connects to [embedding](#/post/ai-embedding).

Up to this point, we are discussing architectures that use a separate image encoder connected to a text model. The internal structures of most modern commercial models remain undisclosed.

## Example: How Claude Processes Images

This information was confirmed from Anthropic's vision documentation.

- Images are divided into 28×28 pixel patches, with each patch representing one visual token.
- The number of tokens is calculated as ⌈width/28⌉ × ⌈height/28⌉.
- Very large images are resized while maintaining aspect ratio before processing. Limits vary by model generation. Standard limits are a maximum side length of 1,568px and up to 1,568 tokens; for high-resolution modes in models after Claude 4.7, the limit is a maximum side length of 2,576px and up to 4,784 tokens.
- Supported formats include JPEG, PNG, GIF, and WebP. Animations are not supported; only the first frame is used.
- Per request, the API supports up to 600 images (100 for models with a 200k token context window), while claude.ai allows up to 20 images per turn. The maximum size per image is 8000×8000px.
- Transmission methods include direct base64 insertion, URL, and file_id via the Files API.

Here are a few examples from the documentation table:

| Image Size | Standard Mode Tokens | High-Resolution Mode Tokens |
|---|---|---|
| 200×200 | 64 | 64 |
| 1000×1000 | 1,296 | 1,296 |
| 1920×1080 | 1,560 (resized to 1456×819) | 2,691 |
| 3840×2160 | 1,560 | 4,784 |

For a 1000×1000 image, 36×36=1,296, which matches the formula. Even for the same 4K image, high-resolution models consume nearly three times more tokens than standard mode. The documentation advises resizing images beforehand if fine detail is not required.

## Token Cost Sensibility

Image tokens occupy the [context window](#/post/ai-context-window) alongside text tokens and are billed at the same input rate. According to calculation examples in the documentation, a 1000×1000 image costs approximately $1.30 for every million input tokens on a $1 model, and about $5.18 for every million tokens on a high-resolution model priced at $4. These prices are based on the time of document publication, so check current pricing before use.

In my estimation, one image is roughly equivalent to around 1,000 text tokens. Keeping several screenshots in a conversation means each turn requires re-sending them as input, significantly increasing the cost. The documentation also recommends using the Files API for images that will be reused repeatedly, since inserting them via base64 causes the conversation to grow longer and adds image bytes to every request.

## Common Misconceptions

- **Sees images "with its eyes"**: In reality, it reads images that have been split into pieces and converted into tokens. It is prone to errors with small, blurry, or rotated images.
- **Counts objects inside images accurately**: Documents explicitly state limitations. Accuracy may be compromised when there are many objects. Locations and coordinates are also approximations.
- **Images come for free**: As mentioned above, they count as tokens and cost money.
- **What it says is true**: Hallucinations can occur even in image interpretation. Documents specify that the model does not identify people's names and should not be used for interpreting diagnostic CT or MRI scans.
- **Multimodal means audio and video too**: This varies by model. Claude Vision handles images (and attached documents), using only the first frame of GIFs.

<details>
<summary>Detailed explanation: Why are there resolution and token limits?</summary>

Models have a fixed limit on the number of tokens they can process at once. As image size increases, the number of pieces grows quadratically (since both width and height increase). Therefore, vendors set an upper bound based on the longest side and maximum token count; if exceeded, they reduce the image while maintaining its aspect ratio.

One practical takeaway: Sending a larger image does not always mean better understanding. Since parts exceeding the limit are cropped anyway, pre-scaling images to fit the limit beforehand reduces transmission size and latency. Documents provide similar guidance for this purpose.

</details>

## Reference Links

- Anthropic documentation, Vision: https://platform.claude.com/docs/en/build-with-claude/vision
- Radford et al., CLIP (Learning Transferable Visual Models From Natural Language Supervision): https://arxiv.org/abs/2103.00020
- Dosovitskiy et al., ViT (An Image is Worth 16x16 Words): https://arxiv.org/abs/2010.11929

← Concept map: (#/post/ai-map)

Related articles: [Embedding](#/post/ai-embedding) · [Context Window](#/post/ai-context-window) · [Diffusion Models](#/post/ml-diffusion)