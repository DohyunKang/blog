[RAG](#/post/ai-rag) 听起来概念很简单，但一旦动手实现，就会发现关键步骤早已固定：如何切分文档、用什么构建向量、检索多少条结果进行拼接、以及如何评估效果。本文按顺序梳理这五个环节，记录了在不依赖任何外部服务的情况下运行的最小化代码实现。代码已亲自执行验证。

## 待构建的功能

以公司内部的 FAQ 为例，处理三份简短文档（退款、配送、账户），当收到提问时，检索相关片段并通过提示词生成回答。特意省略了模型调用部分：无论使用何种 API，“发送生成的提示词”仅需一行代码，因此所有需要学习的内容都在这之前。

```
문서 → 청킹 → 임베딩 → 저장(벡터 DB 자리) → [질문] → 검색 → 프롬프트 → (모델) → 답
```

| 步骤 | 本文代码实现 | 实际应用场景 |
|---|---|---|
| 切分 (Chunking) | 按段落收集，超过字数则切断 | 基于 token、标题单元等策略 |
| 嵌入 (Embedding) | 2-gram 字符哈希（玩具版） | 使用嵌入模型 API 或本地模型 |
| 向量数据库 | 单个 numpy 矩阵 | 文档增多时改用向量数据库 |
| 检索 | 余弦相似度取前 k 个 | 混合检索、重排序 |
| 提示词 (Prompt) | 附加资料与问题 | 相同逻辑 |

嵌入部分之所以是“玩具版”，原因在于真正的嵌入模型需要安装或密钥，导致无法直接运行本文代码。因此仅替换一个函数（`embed`），其余部分保持不变。玩具版嵌入仅依据字符重叠程度进行匹配，并非语义搜索。[嵌入](#/post/ai-embedding) 所实现的真正功能（意义相近则距离更近）在此代码中并未体现。

## 完整代码

```python
import re, zlib
import numpy as np

DOCS = {
    "refund.md": "환불 규정\n\n구매 후 7일 이내에는 사유와 관계없이 전액 환불된다. 7일이 지나면 환불되지 않는다.\n\n디지털 상품은 다운로드를 시작하면 환불이 어렵다.",
    "shipping.md": "배송 안내\n\n주문 후 평일 기준 2~3일 안에 도착한다. 제주와 도서 지역은 하루가 더 걸린다.\n\n배송 조회는 마이페이지의 주문 내역에서 한다.",
    "account.md": "계정 안내\n\n비밀번호를 잊으면 로그인 화면의 비밀번호 찾기에서 이메일로 재설정 링크를 받는다.\n\n탈퇴하면 주문 내역은 5년간 보관된다.",
}

def chunk(text, size=70, overlap=15):
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    out, buf = [], ""
    for p in paras:
        if buf and len(buf) + len(p) > size:
            out.append(buf)
            buf = buf[-overlap:] + "\n" + p
        else:
            buf = (buf + "\n" + p) if buf else p
    if buf:
        out.append(buf)
    return out

DIM = 512
def embed(text):
    # 장난감 임베딩: 글자 2-gram을 해시해서 벡터에 더한다.
    v = np.zeros(DIM)
    t = re.sub(r"\s+", "", text)
    for i in range(len(t) - 1):
        v[zlib.crc32(t[i:i+2].encode()) % DIM] += 1
    n = np.linalg.norm(v)
    return v / n if n else v

index = []  # (출처, 청크, 벡터)
for name, text in DOCS.items():
    for c in chunk(text):
        index.append((name, c, embed(c)))
M = np.stack([v for _, _, v in index])

def search(q, k=2):
    scores = M @ embed(q)
    top = np.argsort(-scores)[:k]
    return [(index[i][0], index[i][1], float(scores[i])) for i in top]

def build_prompt(q, hits):
    ctx = "\n\n".join(f"[자료 {i+1}: {n}] {c}" for i, (n, c, _) in enumerate(hits))
    return f"다음 자료만 근거로 답하라. 자료에 없으면 모른다고 답하라.\n\n{ctx}\n\n질문: {q}"

EVAL = [
    ("환불은 며칠 안에 해야 해?", "refund.md"),
    ("배송은 얼마나 걸려?", "shipping.md"),
    ("비밀번호 까먹었어", "account.md"),
    ("제주도는 배송이 더 느려?", "shipping.md"),
]

if __name__ == "__main__":
    print(len(index), "chunks")
    hit = 0
    for q, gold in EVAL:
        r = search(q, 1)
        ok = gold in [n for n, _, _ in r]
        hit += ok
        print(ok, q, "->", [n for n, _, _ in r])
    print("hit@1 =", hit / len(EVAL))
    print(build_prompt(EVAL[0][0], search(EVAL[0][0], 2)))
```

运行后生成 6 个文本块，4 个评估问题的正确答案均被排在首位检索结果中（hit@1 = 1.0）。最后输出将发送给模型的提示词。

## 1. 切分 (Chunking)

切分是将文档划分为检索单元的过程。代码中以空行分隔段落，收集段落直至超过 `size` 阈值则切断为一个块；下一个块从上一块的末尾 `overlap` 个字符开始。

运行后可直观看到这种简单重叠带来的问题：某个块以“过了这个期限就不再退款。”开头。由于按字符数重叠，导致在单词中间被截断。若不了解前一句是"7 日”，仅凭此片段无法理解其含义。若改用句子作为重叠单位而非字符数，则可避免此类问题。Anthropic 的 Contextual Retrieval 文章也指出，块大小、边界及重叠会影响检索性能，通常建议块大小不超过数百 token。

此外，合适的块大小因数据而异。本文使用的 70 字符是特意设定的较小值，因为示例文档过短。

## 2. 嵌入 (Embedding)

`embed` 将文本转换为长度为 512 的数字列表。玩具版方法是将每两个字符切分后取哈希值对应位置加 1，最后将向量长度归一化为 1。若将长度归一化为 1，则两向量的点积即等于余弦相似度，检索仅需一次矩阵乘法即可完成。

若使用 Python 内置 `hash()` 函数，每次运行结果会不同（因字符串哈希在不同进程中随机打乱）。因此改用 `zlib.crc32`。最初使用 `hash()` 编写后，意识到评估数值可能波动，故进行了更改。

切换为真实模型时需注意两点：文档与问题必须使用同一模型进行嵌入；若不保存嵌入维度与模型名称，更换模型后旧向量与新向量将混合。

## 3. 存储 (Storage)

`index` 存储块列表，`M` 是堆叠向量的矩阵。对于数千个块而言，此方案已足够。矩阵乘法速度快且代码易理解。若超过数十万个块、涉及多台服务器或文档频繁更新，则需引入向量数据库。向量数据库主要提供三项功能：通过近似最近邻搜索避免全量比较、将数据持久化至磁盘、利用元数据进行过滤。当前代码尚未实现这三项功能。[详情 → 向量数据库](#/post/db-vector)

存储时同时记录来源（文件名）是为了在提示词中附带出处。只有标明来源，模型才能在回答时说明“依据哪份资料”，也便于人工核查。

## 4. 检索 (Search)

`search` 将问题嵌入后，计算其与所有块的点积，返回得分最高的 k 个结果。k 的取值并无标准答案。Anthropic 的文章中对比了传入模型 5、10、20 个候选的情况，发现 20 个效果最佳。虽然增加数量可提高包含正确答案的概率，但过多可能导致模型注意力分散，因此建议自行实验验证。

仅靠语义搜索也可能遗漏像错误代码这样精确的词汇，这一点同样在文中提及。因此，常将基于单词匹配的 BM25 与语义搜索结合使用，并对两者的排名进行合并，形成混合检索方案。本文的代码中并未实现这一部分，因为文档规模较小，无法验证其差异。

## 5. 提示词（Prompt）

`build_prompt`会将资料按编号和来源列出，并将问题置于最后。指令包含两项：“仅依据资料作答”、“若资料中没有则回答不知道”。若无此指令，模型会用自身知识填补资料中缺失的内容（即产生[幻觉](#/post/ai-hallucination)）。编写提示词的要点另见 [提示词工程](#/post/ai-prompt)。

实际部署模型时，只需将该字符串作为 API 的用户消息发送即可。资料必须放入 [上下文窗口](#/post/ai-context-window) 内，因此需检查 k 与块大小（chunk size）的乘积是否未超出限制。

## 评估

这是最容易遗忘的阶段。代码中预留了标记为 `EVAL` 的问题与答案文档对，即由此开始。只需判断检索结果是否将正确答案文档带入了前 k 个结果（hit@k），即可获得大量信息。这成为区分错误源于检索还是模型的首要依据：

- 正确答案的块未出现在搜索结果中 → 检索问题（涉及分块、嵌入模型、k 值）
- 正确答案的块存在但回答错误 → 提示词或模型问题

本文中的 hit@1 = 1.0 不可轻信。这仅是一个由 4 个问题、3 个文档组成的极简单测试，且问题与文档使用了相同词汇，仅凭文本重叠即可命中。若将“退款”替换为“收回款项”，这种玩具级嵌入模型便会立即失效，但本文并未对此进行测试。评估问题应使用真实用户可能使用的措辞，并包含资料中未出现的表达，才具有实际意义。

[详情 → RAG 评估·应用评估](#/post/app-eval)

<details>
<summary>详细解析：用于衡量答案质量的指标</summary>

hit@k 仅衡量检索效果。若需进一步评估答案质量，可使用 Ragas。在文档列表页面中可见的指标名称包括：Context Precision（上下文精确率）、Context Recall（上下文召回率）、Faithfulness（忠实度）、Response Relevancy（回答相关性）。从名称来看，这些指标分别用于衡量是否获取了所需的块、答案是否忠实于所引用的资料、以及回答是否与问题相关。

若自行实现，建议手动构建 20~30 个问题 - 答案对，并在每次调整参数（如块大小、k 值、嵌入模型）后重新计算 hit@k。判断依据是数值是否提升，切勿凭直觉盲目修改，这是关键要点。

</details>

<details>
<summary>详细解析：可进一步扩展的方向</summary>

- 将嵌入替换为真实模型：仅更改 `embed` 函数，并将 `DIM` 调整为模型的维度。
- 混合检索：合并 BM25 分数与嵌入分数的排名，选取综合排名靠前的结果。Contextual Retrieval 相关文章指出采用了排名融合方法。
- 重排序：先广泛检索（文中为 150 条），再通过重排序模型缩减至不超过 20 条。
- 在块前添加一行上下文：旨在减少因块中缺失公司名称或时间段等问题。
- 缓存：若文档未变更，则无需重新计算嵌入。对重复使用相同资料的提示词，可通过 [提示词缓存](#/post/ai-prompt-caching) 降低成本。

</details>

## 参考链接

- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Ragas, Available Metrics（仅查看指标名称列表）: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- 本文代码：自行编写并运行（无链接）

← [概念地图](#/post/ai-map)

相关文章：[RAG](#/post/ai-rag) · [嵌入](#/post/ai-embedding) · [向量数据库](#/post/db-vector)