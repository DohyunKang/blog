LLM 无法记住之前的对话，之所以看起来像是在记忆，是因为应用程序在每次调用时都会将整个历史记录重新发送。

## 通俗解释

在 ChatGPT 或 Claude 等应用中继续对话时，模型似乎能记得之前说过的话并据此回答。因此，人们容易认为对话被保存在了模型内部，但查阅 API 文档后会发现事实恰恰相反。Anthropic 的 Messages API 文档指出，该 API 适用于"stateless multi-turn conversations"，即“无状态的多轮对话”。OpenAI 的文档也说明，每次文本生成请求都是独立的、无状态的。

所谓“无状态”，意味着当一个请求结束后，服务器并不会保留该对话。对于下一个请求，必须将之前的部分一并发送，模型才能知晓上下文。从模型的视角来看，它每次都像是在面对一个新的人；这就像收到一张写有前情提要的纸条并阅读它一样。

## 术语先行

- **消息 (Message)**：一次发言。通常由角色（role，如 user、assistant）和内容组成。
- **对话历史 (History)**：迄今为止的消息列表。在 API 中通过 `messages` 数组发送。
- **轮次 (Turn)**：将用户的一次发言和模型的一次回复捆绑为一个单位。
- **会话 (Session)**：被归为同一组对话的一块内容。本文中使用该词指代应用程序连续写入同一记录的范畴。这并非官方定义的术语，不同产品的含义略有差异。
- **上下文 (Context)**：模型一次性所能查看的完整输入。历史记录只是其中的一部分。[详情 → 上下文](#/post/ai-context)

## 原理：每次都重新发送记录

Anthropic 文档中的示例如下：创建新消息时，将之前的轮次放入 `messages` 中一并发送，模型便会据此生成下一条消息。

```json
[
  {"role": "user", "content": "Hello there."},
  {"role": "assistant", "content": "Hi, I'm Claude. How can I help you?"},
  {"role": "user", "content": "Can you explain LLMs in plain English?"}
]
```

发送第三个请求时，前两轮的记录也会一同发送。模型生成的回答（assistant）也需要由应用程序接收并保存，随后再次发送。按顺序描述应用程序所做的工作如下：

| 步骤 | 操作 | 执行方 |
|---|---|---|
| 1 | 将用户输入附加到历史记录末尾 | 应用 |
| 2 | 将整个历史记录发送至 API | 应用 |
| 3 | 生成回答 | 模型 |
| 4 | 将接收到的回答附加到历史记录末尾并保存 | 应用 |

模型仅负责第 3 步。第 1、2、4 步以及数据存储位置均由应用程序处理。因此，即使是同一个模型，不同应用的记忆方式也各不相同。

## 实际验证结果

此处并未使用真正的模型，而是构建了一个仅根据接收到的消息进行回答的模拟函数以模仿其结构。以下代码用 Python 直接运行，并输出了相应结果：

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

对于相同的提问，若附带历史记录则回答“道贤”，若不附带则回答“不知道”。这并非模型变得更聪明了，而是输入内容发生了变化。这是一个为展示结构而制作的玩具示例，与实际模型的回答机制无关。

## 成本与限制由此产生

由于每次都需要发送全部记录，因此会产生两方面的问题：

首先，对话越长，单个请求的输入 token 数量就越多。OpenAI 文档指出，即使通过 `previous_response_id` 附加之前的响应，也无法降低成本。这是因为链式结构中所有的先前输入 token 都会被计入输入费用。无论应用程序直接加载历史记录还是由服务器代为处理，模型需要读取的数据量是相同的。例如，第十轮请求仍需重新阅读前九轮的内容。

其次，上下文窗口存在上限。OpenAI 文档将上下文窗口定义为单个请求中可使用的最大 token 数，包括输入、输出和推理 token。一旦超出限制，内容可能会被截断。因此，当历史记录变长时，必须对开头部分进行摘要或丢弃。相关内容将在下一篇文章中探讨。[详情 → 压缩与记忆](#/post/ai-compaction)

若要降低成本，可以采用缓存重复前缀的方法。对此另有整理。[详情 → 提示词缓存](#/post/ai-prompt-caching)

## 服务器也可代为管理记录

现在出现了将记录管理交由 API 而非应用程序处理的选项。以 OpenAI 文档为标准，主要有三种方式：

| 方式 | 记录存储位置 | 备注 |
|---|---|---|
| 直接发送 | 我的应用 | 最基础的方式，由我决定发送什么内容 |
| `previous_response_id` | OpenAI 服务器 | 传递之前响应的 ID 以延续对话。默认保存 30 天；若将 `store` 设为 false 则不保存 |
| Conversations API | OpenAI 服务器 | 具有唯一 ID 的对话对象，可长期保留。文档指出不受 30 天限制 |

虽然由服务器代为管理会使代码更简洁，但我将无法直接掌控进入模型的内容。

## 会话与长期记忆是不同的概念

历史记录仅在单次对话内延续。开启新对话即意味着新的历史记录，模型无法知晓之前的对话。然而，应用程序有时会表现得仿佛记得过去的对话，这通常是因为使用了不同于历史记录的独立存储机制。

Anthropic 的记忆工具文档就是一个例子。该工具在对话之间将信息保存为文件并重新读取。关键在于存储发生在客户端：以文档形式表达，Claude 仅请求文件操作，执行由我的应用程序完成，数据也存储在我指定的存储库（目录、数据库等）中，而非堆积在模型内部。

| | 对话记录 | 长期记忆（如记忆工具） |
|---|---|---|
| 范围 | 单个会话 | 多个会话 |
| 位置 | 每个请求的输入内 | 外部存储库，需要时读取并加入输入 |
| 发送量 | 全部 | 仅需要的部分 |
| 管理方 | 应用 | 应用（模型请求读写文件） |

文档中值得注意的是，如果启用该工具，系统提示会自动附加“在操作前始终先查看 memory 目录”的指令。这是基于上下文随时可能被重置的假设，要求将进展记录在文件中，以便在会话中断后能够继续。[详情 → 上下文窗口](#/post/ai-context-window)

## 常见误解

- 模型记住了对话：记住的是应用程序发送的记录。如果不发送，模型就不知道。
- 在新对话中认识我是因为模型学习了：通常是将外部存储库的内容加入输入所致。各产品方式不同，需查阅公开说明才能了解特定应用的具体做法。
- 服务器提供记录就是免费的：如上所述，OpenAI 文档指出之前的 token 也会作为输入计费。
- 记录越长越好：存在窗口上限，且并非越长越有用。
- 因为有会话 ID，所以模型中存有状态：ID 仅是服务器查找记录的钥匙，每个请求中模型读取的终究是输入 token。

<details>
<summary>详细解析：如果由应用程序创建会话</summary>

自行实现时需注意以下几点：

- 生成会话 ID，并按 ID 存储 messages 数组（可使用内存、数据库等）。
- 每次请求在数组末尾追加用户输入，收到响应后也追加 assistant 消息。若使用工具，则同时追加工具请求和结果。
- 当数组过长时，对旧部分进行摘要或截断。保留哪些内容属于设计决策。
- 为避免用户数据混杂，应将会话 ID 与用户关联绑定。若记录中包含个人信息，还需规定保存期限。

OpenAI 文档建议在使用推理模型时，将整个响应的 `output` 数组重新放入输入中，以防止推理项中断。也就是说，并非所有情况都只需“仅保存 assistant 语句”。

</details>

## 参考链接

- Anthropic, Messages API: https://platform.claude.com/docs/en/api/messages
- Anthropic, Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- OpenAI, Conversation state: https://developers.openai.com/api/docs/guides/conversation-state

← [概念图](#/post/ai-map)

相关文章：[压缩与记忆](#/post/ai-compaction) · [上下文与上下文工程](#/post/ai-context) · [提示缓存](#/post/ai-prompt-caching)