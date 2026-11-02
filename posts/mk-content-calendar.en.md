Content calendar automation is divided into three stages: building up a pool of topics, slotting them into dates, and publishing them when the time comes. Among these, the parts that absolutely require human involvement are selecting the topics and verifying them just before posting.

## What is a Content Calendar?

A content calendar is essentially a table where you pre-write "what day, which channel, what post." A single Excel sheet suffices. Having this table eliminates the morning dilemma of wondering, "What should I post today?"

Automation partially replaces the task of humans filling out this table. However, since it's not a monolithic block, it's easier to think about it in parts.

| Stage | Task | Automation Difficulty |
|---|---|---|
| 1. Topic Pool | Build up a stash of publishable material | Easy to gather; hard for humans to select |
| 2. Scheduling | Slot material into dates, days of the week, and channels | Easy if rules are defined |
| 3. Production | Create text, images, and videos | AI drafts; human reviews |
| 4. Schedule & Publish | Post at designated times | Varies by platform policies |
| 5. Logging | Record whether it was posted and the response | Easy |

## Topic Pool

The topic pool is a warehouse of material without assigned dates yet. Write down each item line by line and note its status (draft, confirmed, published). Material comes from questions you usually receive, reactions to past posts, and seasonal schedules. We have separately organized how to automatically scrape trends. [Learn more → Trend Collection Automation](#/post/mk-trend-collect)

If the pool runs dry, the calendar stops. Therefore, it's practical to track the pool size by asking, "How many weeks' worth remain?" Receiving a notification when it drops below four weeks' worth is sufficient.

AI can be used here to expand the material pool. For example, give one topic and receive ten variations of that topic. However, such generated material tends to be similar, so you must keep a step for filtering them yourself. Since LLMs select the next word based on probability, they tend to produce average content. [Learn more → What is an LLM?](#/post/ai-llm)

## Scheduling: Slotting into Dates with Rules

Scheduling doesn't require AI; simple rules suffice. My written rules are as follows:

- Post six times a week, fixing the type for each day (pillars like tips, reviews, product introductions).
- Prevent the same topic from appearing again within the last three posts.
- When the pool runs dry, refill it but exclude recently used items.

I ran this directly with Python using eight coffee-related topics as examples.

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

Running this produced 12 lines for two weeks' worth of content.

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

Initially, when refilling an empty pool, I reused the original list, causing the same topic to appear consecutively for two days in a row. The code above fixes that issue. If even such a trivial rule is missing, the calendar immediately feels awkward.

## Production: Creating Repetitive Flows

If each line of the calendar changes status from "Draft → Review → Confirmed → Published," production flows line by line. In the production stage, you give the AI a topic and type to receive a draft. If you receive the result in a fixed shape like JSON, you can use it directly in the next stage (scheduling). [Learn more → Structured Output (JSON·Schema)](#/post/ai-structured-output)

For short videos, there is a separate production pipeline. [Learn more → Short-form Automation Pipeline](#/post/mk-shortform-pipeline)

If the rate of drafts accumulating exceeds the posting rate, review becomes the bottleneck. Even with automation, I decided that the final check must remain with a human.

## Scheduling and Publishing

The part where things are posted at the right time splits into two cases: platforms offering scheduling features, and manually calling an API at specific times.

I only list what is confirmed from official documentation.

- Instagram (Meta) Content Publishing API: Requires a Professional account and involves two steps to post. First, create a container via `/<IG_ID>/media`, then publish via `/<IG_ID>/media_publish`. Media must be hosted at a publicly accessible address at the time of posting. While the documentation states an API limit of 100 posts per 24 hours, another sentence in the same document regarding carousels mentions a limit of 50, creating a contradiction.
- YouTube Data API `videos.insert`: You can set the scheduled publish time via `status.publishAt` in the request body. The specific timestamp format was not detailed in the page I just read.

Since platforms differ in API allowances and review processes, it is common to mix "API posting" for some channels and "manual posting" for others in a calendar. I found it more comfortable to abandon the idea of making every channel fully automated.

## What Drives Repetitive Execution?

To execute the task of "finding that day's line and posting it at 9 AM daily," there are roughly three main methods.

| Method | Characteristics (as found in the document) |
|---|---|
| n8n Schedule Trigger | Configurable by second, minute, hour, day, week, or month, or via cron. The workflow must be saved and published to activate. The timezone is set in the workflow configuration; if not specified, the instance's default timezone is used. |
| GitHub Actions `schedule` | Uses a 5-field cron syntax with a minimum interval of 5 minutes. Under high load, executions may be delayed or some jobs discarded. The default timezone is UTC. Runs only on the default branch, and public repositories are automatically disabled if inactive for 60 days. |
| My computer's task scheduler | Free, but requires the computer to be running. |

The point that "some tasks may be discarded" in GitHub Actions stood out to me. If something must go up on time, there needs to be a mechanism to retry if it's missed. I've organized retries and queues separately. [Read more → Async processing and message queues](#/post/be-async-queue)

n8n also has settings for handling missed executions (with "skip" as the default). The core principle is the same regardless of the tool: decide in advance what to do if an execution is missed.

## Tools and Costs

Costs come from two places: AI call charges used during creation, and server/tool costs for running the workflow.

AI call charges are calculated as: number of words × (input tokens + output tokens) × unit price. With about 6 posts per week and roughly 26 per month, even with a small model, the cost is minimal. There's a separate calculation method. [Read more → AI service cost structure](#/post/app-cost)

For running costs, you can start in the free tier (e.g., GitHub Actions schedules or your own computer) if the scale is small.

## If Building It Yourself

If I were building this, I'd start with the following steps:

1. Create a spreadsheet sheet with a topic pool (topic, type, status).
2. Fill 2–4 weeks' worth of entries using a batch script like the one above, then review and delete manually.
3. Leave draft generation to AI and paste the results into the "draft" column of the same sheet.
4. Initially publish manually, then migrate channel by channel via API.
5. After posting, record views and engagement in the same sheet for reflection in the next batch. [Read more → Building a performance dashboard](#/post/mk-dashboard)

## Common Misconceptions

- Automating with a calendar automatically improves content quality: Automation only reduces the effort of posting; it doesn't improve the quality of the material itself.
- Having a scheduling feature means full automation: Exceptions like reviews, token expiration, and posting failures still remain.
- Posting more is always better: If review time becomes a bottleneck, increasing volume won't help as much as ensuring a few posts go out reliably over the long term.

<details>
<summary>Detailed explanation: Status values and failure handling</summary>

Adding a status column to each calendar row simplifies failure handling. For example, flow through `draft → approved → scheduled → posted`, and if it fails in between, record `failed` along with the reason. The morning runner fetches only rows where today's date matches and the status is `approved` for posting; upon success, change the status to `posted`. To prevent duplicate posting of the same row, lock it by changing the status to `scheduled` before posting.

To handle cases where the runner misses a day, you can also search for rows with dates prior to today that are still `approved` and send notifications. Whether to automatically post late depends on the channel's nature. This is part of the design discussion; I haven't actually run this yet.

</details>

## Reference Links

- Meta, Instagram Platform Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- Google, YouTube Data API videos.insert: https://developers.google.com/youtube/v3/docs/videos/insert
- GitHub Docs, Events that trigger workflows (schedule): https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule
- n8n Docs, Schedule Trigger node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/

← Concept map (#/post/ai-map)

Related posts: [Trend collection automation](#/post/mk-trend-collect) · [Short-form automation pipeline](#/post/mk-shortform-pipeline) · [Building a performance dashboard](#/post/mk-dashboard)