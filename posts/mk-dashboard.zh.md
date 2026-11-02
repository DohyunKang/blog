绩效仪表盘的首要任务并非制作漂亮的图表，而是确定“如何统计哪些数字”。在结构上，只需划分“收集 → 存储 → 查看”三个环节，初期便已足够。

## 什么是仪表盘

发布内容后，各平台会分别累积浏览量、点赞数、评论数等数据。仪表盘的作用是将这些数据汇总在一屏中，让人一目了然地看到“近期什么表现最好”。在自动化流程中，顺序通常是：通过 [内容日历](#/post/mk-content-calendar) 发布，利用 [短视频流水线](#/post/mk-shortform-pipeline) 制作，最后在此界面查看结果。

起初我以为选对工具就是一切。但梳理后发现，工具之前还有三个更优先的要素：要回答什么问题、与问题匹配的指标是什么、以及能从何处以何种频率获取这些数字。

## 先确定指标

即使名称相同，不同平台的含义也可能不同。YouTube Analytics API 文档指出，`views`“根据报告类型代表不同的数值”。其他文档中定义的指标如下：

| 指标 | 文档定义（要点） |
|---|---|
| estimatedMinutesWatched | 观看频道和视频的总分钟数 |
| averageViewDuration | 单次播放的平均时长（秒） |
| subscribersGained | 新增订阅数 |
| likes / shares | 点赞数 / 通过分享按钮分享的次数 |

Instagram 媒体洞察的数据口径也类似地存在差异。`reach`是估算的至少看过一次媒体的独立账户数量，而包含重复曝光的 `impressions`则与之不同。文档指出，自 2024 年 7 月 2 日起创建的媒体将不再提供 `impressions` 数据。`total_interactions`则是点赞、收藏、评论和分享的总和，并扣除取消操作后的净值。

因此，将指标分为三类来管理更为方便：

- **规模**：浏览量、触达量。衡量传播范围有多大
- **反应**：点赞、评论、分享、收藏。衡量用户是否有互动行为
- **结果**：订阅增长、链接点击、咨询等。衡量是否达成原始目标

仅看规模时，数字大的内容似乎就赢了。因此，我们还需同时提供一个“反应数除以规模”的比率指标。

```
참여율 = (좋아요 + 댓글 + 공유 + 저장) / 조회
```

定义取决于撰写者的判断，需明确分母是使用浏览量还是触达量并加以记录。否则当后续数字变更时，无法区分是定义发生了变化还是实际绩效发生了改变。在 [A/B 测试](#/post/mk-ab-test) 中，首先确定一个基准对比指标也是出于同样的原因。

## 结构：收集 → 存储 → 查看

```
[플랫폼 API] --(하루 1번 스케줄)--> [수집 스크립트] --> [DB 표] --> [쿼리] --> [차트/표]
   YouTube / Instagram              API 호출·정리       스냅샷 저장    집계       화면
```

划分这三个环节的原因是它们各自的故障模式各不相同：

- **收集**：可能因令牌过期、调用限额或响应格式变更而失败。即使失败，已存储的历史数据也必须保持完好。
- **存储**：原样保存原始数值。若仅存储计算后的值，则在重新定义指标时将无法重建历史数据。
- **查看**：无论定义或展示方式如何变化，都不应影响收集环节。

在收集阶段需注意文档中的几点说明：Instagram 洞察数据最多可能延迟 48 小时，且数据保留期限最长为 2 年。故事（Story）类指标仅可查询 24 小时，文档建议通过 `story_insights` Webhook 在过期前拉取数据。此外，若无可查询的值，返回的并非 0，而是空结果；若将“无数据”与"0"视为相同并统一存储，会导致平均值计算错误。

像 [趋势收集](#/post/mk-trend-collect) 这样通过 API 获取数据时，通常先受限于调用限额和条款，因此建议将调用频率降至每天一两次，其余时间则使用已存储的值进行查看。

## 最小化实现

存储层可从单个 SQLite 数据库起步。表结构宜采用“一篇文章 × 一天”为一行的形式。由于平台提供的数据为累计值，每日保存快照后，增量可通过后续差值计算得出。

```python
import sqlite3, random, datetime as dt

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE post_metrics (
  post_id TEXT, platform TEXT, fetched_on TEXT,
  views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER,
  PRIMARY KEY (post_id, fetched_on)
);
""")

random.seed(1)
start = dt.date(2026, 10, 1)
rows = []
for i in range(6):
    pid = f"p{i+1}"
    plat = "reels" if i % 2 == 0 else "shorts"
    base = random.randint(800, 3000)
    for d in range(7):                      # 하루 한 번 스냅샷(누적값)
        v = int(base * (1 - 0.5 ** (d + 1)))
        rows.append((pid, plat, str(start + dt.timedelta(days=d)),
                     v, v // 20, v // 80, v // 100, v // 60))
db.executemany("INSERT INTO post_metrics VALUES (?,?,?,?,?,?,?,?)", rows)

# 각 글의 최신 스냅샷만 골라 참여율 계산
q = """
SELECT platform, post_id, views,
       ROUND(1.0 * (likes + comments + shares + saves) / views, 4) AS eng_rate
FROM post_metrics m
WHERE fetched_on = (SELECT MAX(fetched_on) FROM post_metrics WHERE post_id = m.post_id)
ORDER BY eng_rate DESC
"""
for r in db.execute(q): print(r)

# 일별 증가분(누적값 차이)
q2 = """
SELECT fetched_on, SUM(views - COALESCE(prev,0)) AS new_views FROM (
  SELECT post_id, fetched_on, views,
         LAG(views) OVER (PARTITION BY post_id ORDER BY fetched_on) AS prev
  FROM post_metrics)
GROUP BY fetched_on ORDER BY fetched_on
"""
print()
for r in db.execute(q2): print(r)
```

上述代码已使用虚构数据直接运行验证。输出前半部分为各文章的参与率，后半部分为每日新增浏览量。由于使用的是虚构数据，数值本身无实际意义，仅确认了查询逻辑能正确“只选取最新快照”以及“从累计值中计算日增量”。

具备以上条件后，界面仅需一个表格即可启动。如需图表，可在后续阶段添加。

<details>
<summary>详细解析：查询语句的作用</summary>

第一个查询中的 `WHERE fetched_on = (SELECT MAX(...))` 会保留每篇文章在最新日期对应的行。由于存储的是累计值，最新一行即代表截至当前的总和。若遗漏此行而累加全部数据，会导致同一浏览量被每日重复计算。
</details>

第二条查询使用窗口函数 `LAG` 将同一篇文章前一天的数值并排显示，然后从当天数值中减去该值以计算当日增长量。由于第一天没有前一天数据，因此使用 `COALESCE` 填充为 0。在实际采集过程中，可能会出现“因前一日采集失败导致无记录”的情况；若当日的增长量被累加到次日合并显示，则必须标记缺失的日期。

存储表的主键设为 `(post_id, fetched_on)` 也有其原因：这是为了确保即使同一天执行两次采集，也仅保留一行记录。实际上，应将 `INSERT` 改为 `INSERT OR REPLACE`，以便在重新运行时不报错。

</details>

<details>
<summary>详细解析：规模扩大后的变化</summary>

若文章数量仅为数十篇且平台有两个，使用 SQLite 配合 cron（或定时任务）已足够。随着团队共同查看数据或数据持续增长，可选方案包括部署 PostgreSQL 等服务器型数据库，以及集成 Metabase、Looker Studio 等 BI 工具。无论选择哪种方案，上述三栏结构保持不变，仅需替换其中一栏；因此从一开始就划分好各栏位，后续迁移将更为便捷。此部分尚未针对各类工具进行直接对比。

</details>

## 常见误区

- 数字越多越好：适合决策者查看的指标只需四到五个，其余应予以折叠隐藏。
- 浏览量即成效：浏览量仅反映规模，而结果栏中的数值才真正代表成效，需根据具体目标定义。
- 平台界面已展示数据故无需自建：若涉及多个平台且设有保留期限，自行归档更有利于跨平台比较与长期趋势分析。
- 自动采集即数据准确：受延迟、估算值及指标定义变更影响，解读时应视为“大致如此”。

## 参考链接

- YouTube Analytics API 指标列表：https://developers.google.com/youtube/analytics/metrics
- Instagram Platform Media Insights 参考文档：https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights

← 概念图 (#/post/ai-map)

相关文章：[内容日历自动化](#/post/mk-content-calendar) · [A/B 测试](#/post/mk-ab-test) · [趋势采集](#/post/mk-trend-collect)