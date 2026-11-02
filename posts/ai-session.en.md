LLMs do not remember past conversations; the illusion of memory arises because the app sends the entire conversation history with every request.

## In Simple Terms

When you continue a chat in apps like ChatGPT or Claude, they respond based on what was said earlier, making it seem like the model stores the conversation internally. However, the API documentation tells a different story. Anthropic's Messages API documentation describes this API as suitable for "stateless multi-turn conversations," meaning it does not retain state. OpenAI's documentation similarly states that text generation requests are independent and stateless.

Being stateless means that once a request is completed, the server does not hold onto that conversation. To make the model aware of previous context, you must send the earlier parts along with the next request. From the model's perspective, it encounters a new person every time, akin to receiving a note with the prior context written on it.

## Terminology First

- **Message**: A single turn of speech, typically consisting of a role (user, assistant) and content.
- **Conversation History**: The list of messages so far. In APIs, this is sent as a `messages` array.
- **Turn**: A unit comprising one user interaction followed by one model response.
- **Session**: A block of interactions grouped under the same conversation. In this article, we use it to refer to the scope where an app continues writing with the same history. There is no official standardized definition; meanings vary slightly across products.
- **Context**: The entire input the model sees at once. The history is just a part of this. [Learn more → Context](#/post/ai-context)

## Principle: Resending History Every Time

Here is an example from Anthropic's documentation. When creating a new message, you include previous turns in `messages` and send them; the model then generates the next message.

```json
[
  {"role": "user", "content": "Hello there."},
  {"role": "assistant", "content": "Hi, I'm Claude. How can I help you?"},
  {"role": "user", "content": "Can you explain LLMs in plain English?"}
]
```

When sending the third request, the first two lines are also included. The answer written by the model (assistant) must be received and stored by the app before being sent again. The sequence of actions performed by the app is as follows:

| Step | Action | Who |
|---|---|---|
| 1 | Append user input to the end of the history | App |
| 2 | Send the entire history to the API | App |
| 3 | Generate a response | Model |
| 4 | Append the received response to the end and save it | App |

The model only performs step 3. Steps 1, 2, 4, and where to store the data are all handled by the app. Therefore, even with the same model, different apps may remember things differently.

## What I Tested Directly

Instead of using a real model, I created a fake function that only responds based on received messages, mimicking the structure. I executed this code directly in Python and confirmed the results below.

```python
def fake_llm(messages):
    names = [m["content"].split("이름은 ")[1].split("야")[0]
             for m in messages if m["role"] == "user" and "이름은 " in m["content"]]
    last = messages[-1]["content"]
    if "뭐라고" in last:
        return names[-1] if names else "모르겠다"
    return "응"

history = []
def chat(text, keep=True):
    msgs = (history if keep else []) + [{"role": "user", "content": text}]
    reply = fake_llm(msgs)
    if keep:
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": reply})
    return reply, len(msgs)

print(chat("내 이름은 도현이야"))            # ('응', 1)
print(chat("내 이름 뭐라고 했지?"))          # ('도현이', 3)
print(chat("내 이름 뭐라고 했지?", keep=False))  # ('모르겠다', 1)
```

For the same question, sending the history yields "Do-hyun," while not sending it yields "I don't know." The model hasn't become smarter; rather, the input has changed. This is a toy created to demonstrate the structure and is unrelated to how actual models respond.

## Costs and Limitations Stem from Here

Sending all history every time leads to two issues.

First, as conversations get longer, the input tokens for a single request increase. OpenAI's documentation states that even appending previous responses via `previous_response_id` does not reduce costs. The explanation is that all previous input tokens in the chain are billed as input. Whether the app loads the history directly or the server does it on its behalf, the amount the model reads remains the same. The tenth request still reads the first nine turns.

Second, there is a limit to the context window. OpenAI's documentation defines the context window as the maximum number of tokens usable in a single request, including input, output, and inference tokens. Exceeding this limit may result in truncation. Therefore, if the history becomes too long, you must summarize or discard earlier parts. This leads to the next article. [Learn more → Compaction and Memory](#/post/ai-compaction)

To reduce costs, there is a method of caching repeated earlier parts. I have documented this separately. [Learn more → Prompt Caching](#/post/ai-prompt-caching)

## Servers Can Also Hold the History

An option has emerged where history storage can be delegated to the API side rather than the app. Based on OpenAI's documentation, there are three approaches:

| Method | Where History is Held | Notes |
|---|---|---|
| Send Directly | My App | The most basic approach; I choose what to send. |
| `previous_response_id` | OpenAI Server | Continue by passing the previous response ID. Stored for up to 30 days by default; storage is disabled if `store` is set to false. |
| Conversations API | OpenAI Server | Maintained as a conversation object with a unique ID. Documentation states it is not subject to the 30-day limit. |

While delegating to the server simplifies the code, it becomes harder for me to directly manage what enters the model.

## Sessions and Long-Term Memory Are Different

History continues only within a single conversation. Opening a new conversation creates a new history, so the model does not know about previous conversations. However, apps sometimes seem to know about past conversations. This is usually achieved using a storage mechanism different from the conversation history.

Anthropic's memory tool documentation is one example. This tool saves information to files between conversations and reads them back. The key point is that storage happens on the client side. In terms of document representation, Claude only requests file operations, while my application executes them, and data resides in a storage I define (directories, databases, etc.), not accumulated inside the model.

| | Conversation History | Long-term Memory (like memory tools) |
|---|---|---|
| Scope | One session | Multiple sessions |
| Location | Inside input of every request | External storage, read and added to input when needed |
| Amount Sent | Everything | Only what's necessary |
| Who Manages | App | App (model requests file operations for reading/writing) |

What stood out in the document is that if this tool is enabled, a directive like "always check the memory directory before working" is automatically added to the system prompt. Assuming context can be initialized at any time, it instructs writing progress to files so sessions can continue even if interrupted. [Read more → Context Window](#/post/ai-context-window)

## Common Misconceptions

- The model remembers conversations: It's the records sent by the app that are remembered. If not sent, it doesn't know.
- If the model knows me in a new conversation, it must have learned from training: Usually, content from separate storage is added to the input. Methods vary by product, so you need public documentation to understand how a specific app works.
- If the server stores records, it's free: As seen above, OpenAI documents state that previous tokens are also charged as part of the input.
- Longer history is always better: There's a window limit, and length doesn't necessarily mean better usage.
- Session ID means the model has state: The ID is just a key for the server to find records; what the model reads per request ultimately counts as input tokens.

<details>
<summary>Detailed explanation: If you create sessions on the app side</summary>

Here's a summary of considerations when implementing directly:

- Create session IDs and store messages arrays by ID (in memory, database, etc.).
- For each request, append user input to the end of the array; upon receiving a response, also append assistant messages. If using tools, include tool requests and results as well.
- When the array gets too long, summarize or truncate older parts. What to retain is part of the design.
- Keep user data separate by binding session IDs with users. If records contain personal information, retention periods must also be defined.

OpenAI documents recommend re-inserting the entire `output` array from responses when using inference models to prevent breaking inference chains. That means there are cases where "saving only assistant sentences" is not sufficient.

</details>

## Reference Links

- Anthropic, Messages API: https://platform.claude.com/docs/en/api/messages
- Anthropic, Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- OpenAI, Conversation state: https://developers.openai.com/api/docs/guides/conversation-state

← [Concept Map](#/post/ai-map)

Related posts: [Compaction and Memory](#/post/ai-compaction) · [Context and Context Engineering](#/post/ai-context) · [Prompt Caching](#/post/ai-prompt-caching)