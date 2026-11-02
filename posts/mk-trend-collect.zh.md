# 关于自动化趋势收集的整理

一句话总结：趋势收集的流程是“选择来源 → 获取数据 → 去重 → 摘要 → 人工筛选”，其中困难的并非摘要环节，而是获取阶段所面临的限制和条款。

这是一份学习笔记，并未直接部署到生产服务中，仅阅读了官方文档并运行了小型示例。以下内容属于与日常工作无关的通用理论。

## 什么是趋势收集

在营销领域，趋势收集是指每天收集“当下人们都在关注和讨论什么”的工作。如果由人工操作，每天早上都需要花费时间浏览社区、新闻和搜索词。自动化则是利用脚本代替人工进行收集，并将结果汇总展示在一页中。

实现自动化并不意味着能预测“什么会火”，它只是收集已经出现的信号，至于将这些信号作为内容主题，仍需由人来决定。关于主题库及后续内容的衔接，请参见 [详细内容 → 内容日历自动化](#/post/mk-content-calendar)。

## 整体流程

```
[소스 목록] → [가져오기] → [정리·중복 제거] → [점수·요약] → [사람이 선택] → [주제 풀]
 RSS·API·검색어   스케줄러    URL 정규화      빈도·LLM       후보 5~10개
```

具体步骤如下：

1. **来源列表**：确定从何处获取数据的文件。
2. **获取数据**：在预定时间运行的调度器（如 cron）。
3. **整理**：由于同一篇文章可能发布在多个地方，需对 URL 进行规范化以去除重复项。
4. **评分与摘要**：先进行类似词频的简单计算，摘要部分则使用 LLM。
5. **筛选**：人工浏览后，将选中的主题移入主题库。

## 来源主要有三种类型

| 类型 | 示例 | 优点 | 局限 |
|---|---|---|---|
| 馈源 (RSS) | 博客、新闻网站 | 格式固定且轻量 | 仅限提供该服务的网站 |
| 官方 API | YouTube Data API、Google Trends API 等 | 符合条款规范，数据结构化 | 存在调用限制和审批流程 |
| 网页抓取 | 搜索结果、社区列表 | 无所不能 | 受条款限制、易被反爬或结构变更影响 |

起初看来，仅使用 RSS 和官方 API 起步更为合适。我认为网页抓取应作为最后的手段。

**RSS。** 根据 RSS 2.0 规范，一篇文章是一个 `item`，其中包含 `title`、`link`、`description`、`pubDate`、`guid` 等元素。所有元素均为可选，只需提供 `title` 或 `description` 其中之一即可。`guid` 是用于唯一标识文章的字符串，规范中明确指出应将其用于判断“是否已看过该文章”。这是一个非常适合去重的字段，但由于某些网站可能不填充 guid，因此同时使用链接更为稳妥。

**YouTube。** Data API 的 `search.list` 每次调用消耗 1 个单位，但官方文档规定每日上限为 100 次，并设有单独的配额桶。其他方法的默认日限额为 10,000 单位，并在太平洋时间午夜重置。`videos.list` 每次调用也消耗 1 个单位。因此，设计上应采取“节省搜索调用，对已知视频 ID 使用 `videos.list` 获取播放量”的策略。（注：再次查看同一文档时数字可能会发生变化，实现时需重新查阅。）

**Google Trends。** 官方 API 在 Search Central 文档中有介绍，但目前仍处于 Alpha 阶段。文档中注明“尚无法向所有人开放”，需申请成为 Alpha 测试者。该 API 提供最近 5 年的数据，支持日、周、月、年维度，且数值经过归一化处理（0-100），尺度一致，因此可以串联多个请求。网页界面一次最多比较 8 个搜索词，而 API 则支持数十个。由于普通开发者目前无法直接使用，必须先申请才能使用。

## 条款与限制

获取数据在技术上是否可行，与是否符合规定是两回事。

- **robots.txt**：这是告知爬虫“此处可访问/不可访问”的规则。RFC 9309 指出，这并非赋予或剥夺访问权限的手段，实际的访问控制应通过 HTTP 认证等其他机制实现。换言之，robots.txt 中允许并不代表条款上没问题；反之，若被禁止则应遵守。
- **服务条款**：每个网站的服务条款中可能包含禁止自动收集的条款，这需要逐站查阅，我并未检查所有网站。
- **登录区域与隐私数据**：需要登录的区域以及混合了个人信息的數據，不应纳入趋势收集范围。
- **官方 API 限制**：存在调用限额。试图通过轮换多个密钥来绕过限额往往违反服务条款，具体需视各服务商而定。
- **社区 API（如 Reddit）**：其价格和限额政策据称经常变动。

## 亲自运行的小型示例

以下是用于去重并统计词频的 Python 代码，仅使用标准库，无需外部依赖。我在本地运行了示例 XML（未连接互联网），特意添加了带有 `utm_source` 参数的链接以测试去重逻辑是否生效：

```python
import xml.etree.ElementTree as ET, hashlib, re
from collections import Counter

SAMPLE = """<rss version="2.0"><channel>
<item><title>New video model released</title><link>https://a.example/1?utm_source=x</link><guid>a1</guid></item>
<item><title>New video model released</title><link>https://a.example/1</link><guid>a1</guid></item>
<item><title>Short video ads: what works</title><link>https://b.example/2</link><guid>b2</guid></item>
<item><title>Video model pricing cut</title><link>https://c.example/3</link><guid>c3</guid></item>
</channel></rss>"""

def norm(u):                       # 쿼리·해시 제거
    return re.sub(r'[?#].*$', '', u)

seen, titles = set(), []
for it in ET.fromstring(SAMPLE).iter('item'):
    key = hashlib.sha1(norm(it.findtext('link')).encode()).hexdigest()
    if key in seen:
        continue
    seen.add(key)
    titles.append(it.findtext('title'))

stop = {'a', 'the', 'what', 'new'}
words = Counter(w for t in titles for w in re.findall(r'[a-z]+', t.lower())
                if w not in stop and len(w) > 2)
print(len(titles), words.most_common(3))
```

运行后输出结果为 `3 [('video', 3), ('model', 2), ('released', 1)]`。在 4 条数据中成功过滤掉 1 条重复项，且“video”和"model"被正确归类为高频词。示例中未包含实际获取 RSS 的联网调用部分。

<details>
<summary>详细解析：实际开发时建议添加的功能</summary>

- **请求间隔**：避免在短时间内向同一站点发起大量请求。通常每天抓取几次已足够。
- **条件请求**：若服务器返回 `ETag` 或 `Last-Modified` 头，可在后续请求中携带这些参数；若内容未变更，则无需接收响应体。具体支持情况因网站而异。
- **数据存储**：建议仅保存标题、链接、日期和摘要等元数据，而非全文。从版权角度看，这样更为稳妥。存储并分发完整正文是另一个层面的问题。
- **评分机制**：初期只需对“同时在多个来源出现的词汇”给予加分。例如，同一天在三个地方出现的关键词，其信号强度应高于仅在单一来源出现的词。
- **摘要生成**：将 20~30 个标题一次性输入 LLM，请求生成"5 个分组及其代表标题”。仅输入标题可节省 Token；由于摘要可能存在偏差，建议保留原文链接以便人工查阅原文。
- **错误处理**：针对每个数据源单独捕获异常并记录日志，确保单个源失败不会导致整个程序崩溃。

</details>

## 成本估算

假设场景为：每日采集一次，20 个数据源，约 200 个标题，LLM 摘要调用 1 次。若平均每个标题约消耗 20 个 Token，则输入总量约为 4,000 Token 左右；若每次摘要输出约 500 Token，则每日仅需一次调用即可完成。虽然模型单价会变动，无法给出确切数字，但按此规模计算，月成本预计在几百至几千元人民币之间。

| 项目 | 方式 | 成本 |
|---|---|---|
| RSS 采集 | 脚本 | 0 元 |
| YouTube Data API | 基础配额内 | 0 元 |
| Google Trends API | Alpha 版，需申请 | - |
| 摘要生成 | LLM 每日 1 次 | 估算每月数百~数千元 |
| 服务器 | 个人电脑或现有服务器 | 0 元（电费除外） |

时间成本往往高于金钱成本。需要花费时间管理数据源列表、修复损坏的 RSS 订阅以及阅读服务条款。

## 如果自行开发

1. **创建数据源列表文件**：初期可包含 10 个 RSS 和几个 YouTube 频道。
2. **编写每日运行脚本**：将标题、链接、日期等信息存入 JSON 文件。
3. **URL 规范化去重**：去除重复项，仅保留最近 24 小时的数据。
4. **生成报告文档**：输出高频词列表及 LLM 生成的分组摘要，整合为单页文档。
5. **人工筛选与整理**：将值得关注的主题内容转移至主题地图（Topic Map）。
6. **评估成果**：需另行建立机制分析哪些主题反响良好，否则无法判断采集策略是否有效。例如：[详细 → 制作成果仪表盘](#/post/mk-dashboard)。

关于如何利用采集到的趋势进行创作或实验，可参考以下专题：
- [详细 → 缩略图与文案 A/B 测试](#/post/mk-ab-test)
- [详细 → 短视频自动化流水线](#/post/mk-shortform-pipeline)

此外，评论区反馈转化为趋势分析的内容，请参阅：[详细 → 评论与私信自动回复机器人](#/post/mk-comment-bot)。

## 常见误区

- **掌握趋势就能预判爆款** → 实际上你收集的是已经流行的内容，存在滞后性；若他人也在关注相同列表，情况会更明显。
- **只要技术上可行就可以抓取** → 技术可行性与违反服务条款或侵犯版权是两回事。
- **LLM 已生成摘要，无需人工审阅** → 摘要可能出错，关键决策环节仍需人工把关更为安全。

[← 概念地图](#/post/ai-map)

## 参考链接

- YouTube Data API 配额成本计算：https://developers.google.com/youtube/v3/determine_quota_cost
- Google Search Central, Google Trends API (Alpha): https://developers.google.com/search/apis/trends
- RFC 9309, Robots Exclusion Protocol: https://www.rfc-editor.org/rfc/rfc9309
- RSS 2.0 规范 (RSS Advisory Board): https://www.rssboard.org/rss-specification