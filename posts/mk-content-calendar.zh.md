内容日历自动化分为三个阶段：积累主题、按日期安排发布，以及到期时发布。其中，人必须亲自参与的是选择主题以及在发布前的确认环节。

## 什么是内容日历

内容日历是一张预先写好的表格，记录了“哪天、在哪个渠道、发什么文章”。哪怕只是一张 Excel 表格也可以。有了这张表，当天早上就不必再为“今天发什么”而发愁了。

自动化就是让人工填写这张表的某些环节由系统代劳。但由于它并非一个整体，分块思考会更轻松。

| 阶段 | 工作内容 | 自动化难度 |
|---|---|---|
| 1. 主题池 | 积累可发布的素材 | 收集容易，筛选靠人 |
| 2. 排期 | 将素材填入日期、星期和渠道 | 只要定好规则就很简单 |
| 3. 制作 | 撰写文章、制作图片和视频 | AI 生成初稿，人工审核 |
| 4. 预约·发布 | 在预定时间发布 | 视各平台政策而定 |
| 5. 记录 | 记录是否已发布及反响如何 | 很简单 |

## 主题池

主题池是一个尚未分配日期的素材仓库。每条记录需注明状态（草稿、已定稿、已发布）。素材来源包括：平时收到的提问、过往文章的反馈、季节性活动等。关于自动抓取趋势的方法，已另行整理。[详情 → 趋势收集自动化](#/post/mk-trend-collect)

一旦主题池耗尽，内容日历就会停滞不前。因此，实用做法是将主题池容量以“还能支撑几周”来衡量。当降至 4 周以下时，即可触发补货提醒。

在此环节可引入 AI 来扩充素材：给定一个主题，要求生成"10 个该主题的变体”。然而，如此生成的素材往往大同小异，因此仍需保留人工筛选步骤。由于 LLM 是基于概率选择下一个词，容易产生大量平庸的素材。[详情 → LLM 是什么](#/post/ai-llm)

## 排期：用规则填入日期

排期无需 AI，仅需设定规则即可。我制定的规则如下：

- 每周发布 6 篇，固定每日内容类型（如技巧、评测、产品介绍等支柱栏目）。
- 同一主题在最近 3 篇内不得重复出现。
- 当主题池耗尽时重新填充，但需剔除近期已使用的主题。

我曾直接用 Python 实现此逻辑，示例中插入了 8 条关于咖啡的主题。

```python
from datetime import date, timedelta
import random

pool = ["커피 원두 고르는 법", "집에서 라테 만들기", "드립 vs 에스프레소", "원두 보관법",
        "디카페인 이야기", "그라인더 청소", "여름 아이스커피", "콜드브루 비율"]
slots = [(0, "팁"), (1, "후기"), (2, "팁"), (3, "제품"), (4, "후기"), (5, "팁")]  # 요일 0=월

def make_calendar(start, weeks, seed=1):
    rnd = random.Random(seed)
    topics = pool[:]
    rnd.shuffle(topics)
    cal, used = [], []
    for w in range(weeks):
        for dow, kind in slots:
            if not topics:                      # 풀이 비면 다시 채우되, 최근 3개는 뺀다
                topics = [x for x in pool if x not in used[-3:]]
                rnd.shuffle(topics)
            t = topics.pop()
            used.append(t)
            d = start + timedelta(days=7 * w + dow)
            cal.append({"date": d.isoformat(), "kind": kind, "topic": t, "status": "draft"})
    return cal

for r in make_calendar(date(2026, 11, 2), 2):
    print(r["date"], r["kind"], r["topic"], r["status"])
```

运行后生成了 2 周共 12 条内容。

```
2026-11-02 팁 드립 vs 에스프레소 draft
2026-11-03 후기 디카페인 이야기 draft
2026-11-04 팁 커피 원두 고르는 법 draft
2026-11-05 제품 콜드브루 비율 draft
2026-11-06 후기 그라인더 청소 draft
2026-11-07 팁 집에서 라테 만들기 draft
2026-11-09 팁 여름 아이스커피 draft
2026-11-10 후기 원두 보관법 draft
2026-11-11 팁 그라인더 청소 draft
2026-11-12 제품 콜드브루 비율 draft
2026-11-13 후기 커피 원두 고르는 법 draft
2026-11-14 팁 디카페인 이야기 draft
```

最初若直接复用主题池为空时生成的列表，会导致相同主题连续两天出现。上述代码正是对此问题的修正。哪怕遗漏这样一条细微规则，整个日历也会显得格格不入。

## 制作：构建可重复的流程

若将内容日历的每一行状态设置为“草稿 → 审核 → 定稿 → 已发布”，则制作流程可逐条推进。在制作阶段，向 AI 提供主题和类型以获取初稿。若结果能以 JSON 等固定格式返回，即可在下一阶段（预约）直接复用。[详情 → 结构化输出（JSON·Schema）](#/post/ai-structured-output)

对于短视频，则需独立的自动化流水线。[详情 → 短视频自动化流水线](#/post/mk-shortform-pipeline)

若初稿生成速度快于发布速度，审核环节将成为瓶颈。即便实现自动化，最终确认仍应由人工负责。

## 预约与发布

到了发布时间，操作分为两种情况：平台提供预约功能，或手动调用 API 按时间发布。

以下仅列出经官方文档确认的内容：

- Instagram (Meta) 内容发布 API：需使用专业账户，分两步完成。首先通过 `/<IG_ID>/media` 创建容器，再通过 `/<IG_ID>/media_publish` 进行发布。媒体文件必须在发布时刻可公开访问的地址上。文档称 24 小时内可通过 API 上传 100 个内容，但同一文档的轮播部分又提到限制为 50 个，两者存在矛盾。
- YouTube Data API `videos.insert`：可在请求正文中的 `status.publishAt` 字段指定发布时间。具体时间格式在本次阅读的页面中未详细说明。

由于各平台的 API 权限范围和审核机制不同，日历中混合使用“某渠道通过 API 发布、另一渠道手动发布”的情况十分常见。放弃将所有渠道完全自动化的想法，反而让人更安心。

## 循环执行由什么驱动

要实现“每天早上 9 点查找当日内容并发布”，主要有三种实现方式。

| 方法 | 特点（文档中确认的内容） |
|---|---|
| n8n Schedule Trigger | 可设置秒、分、时、日、周、月单位或 cron。必须保存并发布工作流才能启用。时区在工作流设置中指定，若未设置则使用实例时区 |
| GitHub Actions `schedule` | 5 位 cron，最小间隔为 5 分钟。负载过大时可能导致延迟或部分任务被丢弃，默认时区为 UTC。仅在默认分支上运行，公开仓库若 60 天内无活动会自动停用 |
| 本地计算机的任务计划程序 | 免费，但需确保计算机处于开机状态 |

GitHub Actions“部分任务可能被丢弃”这一点尤为引人注目。如果内容必须在特定时间发布，一旦错过就需要重试机制。关于重试和队列的处理方式已另行整理。[详情 → 异步处理与消息队列](#/post/be-async-queue)

n8n 端也有相关设置来处理错过的执行（默认跳过）。无论哪种方案，核心在于提前规划“错过时该如何应对”。

## 工具与成本

成本来自两个方面：制作内容时产生的 AI 调用费用，以及运行服务器和工具的开销。

AI 调用费用按以下公式计算：字数 × (输入 token + 输出 token) × 单价。每周约 6 篇，每月约 26 篇，意味着调用次数约为 26 次左右，即使使用小模型负担也不大。具体计算方法另见下文。[详情 → AI 服务成本结构](#/post/app-cost)

运行方面，若规模较小，可从免费区间起步（如 GitHub Actions 的调度或本地计算机）。

## 如果自行制作

如果由我来做，我会按以下步骤开始：

1. 在一张电子表格中建立主题池（包含主题、类型、状态列）。
2. 使用类似的批量脚本填充 2~4 周的内容，人工审核并删除不合适的条目。
3. 初稿生成交由 AI 完成，将结果填入同一表格的“初稿”列。
4. 发布初期手动操作，随后逐个渠道通过 API 迁移。
5. 发布后在相同表格中记录浏览量与互动数据，以便纳入下一批处理。[详情 → 制作成效仪表板](#/post/mk-dashboard)

## 常见误区

- 自动化日历就能让内容质量自动提升：自动化仅减少发布工作量，素材质量仍需保持原状。
- 具备预约功能即等于完全自动化：仍存在审核、token 过期、发布失败等异常情况。
- 发布越多越好：若审核时间成为瓶颈，增加数量不如确保每周稳定发布几篇更能持久运营。

<details>
<summary>详细解析：状态值与失败处理</summary>

在日历行中增加一列“状态”可简化失败处理。例如流程为 `draft → approved → scheduled → posted`，若中途失败则记录为 `failed` 并填写失败原因。早晨的执行器仅提取今日且状态为 `approved` 的行进行发布，成功后将状态改为 `posted`。为防止重复发布，可在发布前将状态改为 `scheduled` 以锁定该行。

若执行器某天遗漏运行，可额外查找“日期早于今天但状态仍为 approved 的行”，并发送通知。是否自动补发需根据渠道特性决定。这部分属于架构设计问题，尚未实际部署测试。

</details>

## 参考链接

- Meta, Instagram Platform Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- Google, YouTube Data API videos.insert: https://developers.google.com/youtube/v3/docs/videos/insert
- GitHub Docs, Events that trigger workflows (schedule): https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule
- n8n Docs, Schedule Trigger node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/

← 概念图 (#/post/ai-map)

相关文章：[趋势收集自动化](#/post/mk-trend-collect) · [短视频自动化流水线](#/post/mk-shortform-pipeline) · [制作成效仪表板](#/post/mk-dashboard)