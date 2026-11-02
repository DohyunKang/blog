The performance dashboard was less about making pretty charts and more about deciding "what numbers to count and how." Structurally, a three-column flow of Collect → Store → View was sufficient at the start.

## What is a Dashboard?

After posting content, metrics like views, likes, and comments accumulate separately on each platform. A dashboard aggregates these into a single screen to give you an immediate overview of "what's trending lately." In automation workflows, this follows the sequence: post via [Content Calendar](#/post/mk-content-calendar), create using the [Short-form Pipeline](#/post/mk-shortform-pipeline), and then verify results on this screen.

Initially, I thought choosing tools was the main task. However, upon reflection, three things came before tool selection: what question you want to answer, which metrics align with that question, and where/how often you can fetch those numbers.

## Define Metrics First

Even with the same name, meanings vary by platform. The YouTube Analytics API documentation states that `views` "can represent different numbers depending on the report type." Other defined metrics include:

| Metric | Definition (Summary) |
|---|---|
| estimatedMinutesWatched | Total minutes watched across channel and videos |
| averageViewDuration | Average duration per view (in seconds) |
| subscribersGained | Number of new subscribers |
| likes / shares | Number of likes / number of shares via share button |

Instagram Media Insights operates similarly. `reach` estimates the number of unique accounts that viewed media at least once, whereas `impressions` counts total views including repeats from the same user. Note that `impressions` are no longer provided for media created after July 2, 2024, according to the documentation. `total_interactions` is the sum of likes, saves, comments, and shares, minus any cancellations.

Therefore, I split metrics into three categories:

- **Scale**: Views, Reach. How far did it spread?
- **Reaction**: Likes, Comments, Shares, Saves. Did viewers take action?
- **Outcome**: Subscriber growth, Link clicks, Inquiries. Did we achieve the original goal?

Focusing only on scale favors content with high raw numbers. That's why I also include a ratio of Reaction divided by Scale.

```
참여율 = (좋아요 + 댓글 + 공유 + 저장) / 조회
```

Since definitions are subjective to the writer, you must explicitly state whether the denominator is Views or Reach to avoid confusion later when numbers change—otherwise, it becomes unclear if the definition changed or actual performance shifted. The same logic applies in [A/B Testing](#/post/mk-ab-test), where establishing a baseline metric first ensures valid comparisons.

## Structure: Collect → Store → View

```
[플랫폼 API] --(하루 1번 스케줄)--> [수집 스크립트] --> [DB 표] --> [쿼리] --> [차트/표]
   YouTube / Instagram              API 호출·정리       스냅샷 저장    집계       화면
```

We separate these columns because each fails differently:

- **Collect**: Breaks due to token expiration, rate limits, or response format changes. Past stored values must remain intact even if collection fails.
- **Store**: Accumulates raw numbers as-is. Storing only calculated values prevents reconstructing history if definitions change.
- **View**: Can adapt to definition or display changes without affecting the collection layer.

Key considerations for collection include: Instagram Insights data can be up to 48 hours delayed, and retention periods are capped at two years. Story metrics expire after 24 hours; the documentation advises using `story_insights` webhooks to capture them before expiration. Also, note that missing values return empty results rather than zero; storing both as zero will skew averages.

As with [Trend Collection](#/post/mk-trend-collect), API calls are subject to limits and terms, so limit daily calls to once or twice and rely on stored values for the rest.

## Minimal Implementation

You can start with a single SQLite database. The table structure stacks one row per "Post × Date." Since platform data is cumulative, taking a daily snapshot allows you to calculate daily increments later by differencing.

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

I tested this code directly with dummy data. The output's first section shows engagement rates per post, and the second shows new views per date. While the numbers themselves are meaningless in dummy data, the query successfully verifies that it "selects only the latest snapshot" and "calculates daily increments from cumulative totals."

With this setup, a single table suffices for the initial screen; charts can be added later as needed.

<details>
<summary>Detailed Explanation: What the Query Does</summary>

The `WHERE fetched_on = (SELECT MAX(...))` clause in the first query retains only the row with the latest date for each post. Since values are cumulative, the latest row represents the total up to that point. Summing all rows instead would double-count views daily.
</details>

The second query uses the `LAG` window function to append yesterday's value for the same post and subtracts it from today's value to calculate the daily increase. For the first day, since there is no prior day, `COALESCE` is used to insert 0. In actual collection scenarios, days may occur where "no rows exist because yesterday's collection failed." On such days, the increase amount gets lumped into the following day, making it appear combined; therefore, missing days must be marked.

There is also a reason why the primary key of the storage table is `(post_id, fetched_on)`. This is a mechanism to ensure only one row remains even if collection runs twice on the same day. In practice, `INSERT` should be changed to `INSERT OR REPLACE` so that re-execution proceeds without errors.

</details>

<details>
<summary>Detailed explanation: What changes as scale increases</summary>

If you have only a few dozen posts and two platforms, SQLite combined with cron (or scheduled tasks) is considered sufficient. If the team needs to view data together or if the dataset continues to grow, options include using a server-based database like Postgres and BI tools such as Metabase or Looker Studio. Regardless of which path you choose, the three-column structure mentioned above should remain intact, with only one column replaced; this design makes it easy to migrate later by dividing columns from the start. This section does not directly compare tools individually.

</details>

## Common Misconceptions

- **More numbers mean a better dashboard:** A few key metrics (around five or six) that enable decision-making are preferable; the rest should be folded away.
- **Views equal performance:** Views reflect only scale; the number in the result column depends on your specific objectives and defines what constitutes performance.
- **Platform screens already show this, so it's unnecessary:** If you have multiple platforms and a defined retention period, maintaining your own stored data is better suited for comparison and long-term trend analysis.
- **Automated collection means accurate numbers:** Due to delays, estimates, and definition changes, interpreting the data as "approximately this much" is appropriate.

## Reference Links

- YouTube Analytics API metrics list: https://developers.google.com/youtube/analytics/metrics
- Instagram Platform, Media Insights reference: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights

← Concept map (#/post/ai-map)

Related posts: [Automated Content Calendar](#/post/mk-content-calendar) · [A/B Testing](#/post/mk-ab-test) · [Trend Collection](#/post/mk-trend-collect)