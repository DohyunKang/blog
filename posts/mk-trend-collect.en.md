# Automating Trend Collection: A Summary

One-liner summary: The trend collection pipeline follows the sequence "Select Source → Fetch → Deduplicate → Summarize → Human Selection." The challenging part isn't summarization, but rather the limits and terms of service associated with the fetching stage.

This is a study note; I haven't deployed it directly to production services. Instead, I read the official documentation and ran small examples. These are general principles unrelated to daily work at my company.

## What is Trend Collection?

In marketing, trend collection involves gathering daily insights into "what people are searching for and talking about." If done manually, this requires time each morning browsing communities, news sites, and search terms. Automation replaces this by having a script collect the data and present it in a single view.

Automation does not predict "what will go viral"; it merely aggregates existing signals. Deciding which topics to use for content remains a human decision. For details on connecting this to topic pools and ongoing discussions, see [Content Calendar Automation →](#/post/mk-content-calendar).

## Overall Flow

```
[소스 목록] → [가져오기] → [정리·중복 제거] → [점수·요약] → [사람이 선택] → [주제 풀]
 RSS·API·검색어   스케줄러    URL 정규화      빈도·LLM       후보 5~10개
```

Breaking it down step by step:

1. **Source List**: A single file defining where to fetch data from.
2. **Fetch**: A scheduler (like cron) that runs at specified intervals.
3. **Deduplication**: Since the same content often appears across multiple locations, URLs are normalized to remove duplicates.
4. **Scoring & Summarization**: Simple calculations like word frequency come first; summarization is handled by an LLM.
5. **Selection**: A human reviews the results and moves selected items into the topic pool.

## Three Main Types of Sources

| Type | Example | Advantages | Limitations |
|---|---|---|---|
| Feed (RSS) | Blogs, News Sites | Fixed format; lightweight | Limited to sites that provide it |
| Official API | YouTube Data API, Google Trends API | Safe per terms of service; structured data | Limits and approval processes |
| Web Scraping | Search results, Community lists | Highly flexible | Terms of service, blocking, structural changes |

Initially, starting with RSS feeds and official APIs seems appropriate. I believe scraping should be reserved as a last resort.

**RSS.** According to the RSS 2.0 specification, a single post is an `item`, containing fields like `title`, `link`, `description`, `pubDate`, and `guid`. All elements are optional; having just one of `title` or `description` suffices. The `guid` is a string uniquely identifying the post, recommended by the spec for determining "have I seen this before." It's perfect for deduplication, but since some sites may not populate the `guid`, it's safer to also use the link.

**YouTube.** The `search.list` method in the Data API costs 1 unit per call, though official documentation notes a separate bucket allowing up to 100 calls per day. Other methods default to 10,000 units per day and reset at midnight Pacific Time. The `videos.list` method also costs 1 unit per call. Therefore, the design strategy becomes "save search calls and use `videos.list` to fetch view counts for video IDs you already know." (Note: Revisiting the same documentation later may show changed numbers, so re-checking is necessary during implementation.)

**Google Trends.** The official API is introduced in the Search Central documentation but is currently in alpha. The documentation states "not yet available to everyone," requiring application via an alpha tester form. It provides data for the last 5 years in daily, weekly, monthly, and yearly intervals using a consistent scale from 0–100 that isn't normalized, allowing requests to be chained together. While the web interface compares up to 8 search terms at once, the API supports dozens. Since general developers cannot use it immediately, an application is required first.

## Terms of Service and Limits

Whether a method works technically and whether it's permissible are separate concerns.

- **robots.txt**: This rule informs crawlers "you may/may not come here." RFC 9309 states this does not grant or deny access rights; actual access control must be handled via other means like HTTP authentication. In other words, being allowed in `robots.txt` doesn't mean it's compliant with terms of service. Conversely, if blocked, you should respect it.
- **Terms of Service**: Some sites may prohibit automated collection in their user agreements. These need to be checked site-by-site; I haven't verified every site.
- **Login-required areas and data mixed with personal information** should remain outside the scope of trend collection.
- **Official APIs have limits**. Rotating multiple keys to bypass limits often violates terms of service. This varies by service, so verification is needed.
- **Community APIs (e.g., Reddit)** are known for frequently changing pricing and limit policies.

## Small Example Run Directly

Below is the code to deduplicate a few RSS items and count word frequencies. It uses only standard libraries, runs offline with sample XML, and includes logic to check whether links with `utm_source` are correctly filtered as duplicates.

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

Running it produced `3 [('video', 3), ('model', 2), ('released', 1)]`. Out of 4 items, one duplicate was removed, and "video" and "model" were identified as top-level terms. The network call section for fetching actual feeds is not included in this example.

<details>
<summary>Detailed explanation: things to add when implementing this</summary>

- Request spacing: Do not send requests to the same site in quick succession; a few times per day is sufficient.
- Conditional requests: If the server provides `ETag` or `Last-Modified`, you can include these headers in subsequent requests and skip fetching the body if there are no changes. Support for this varies by site.
- Storage: Storing only the title, link, date, and summary (rather than the full original text) is lighter from a copyright perspective. Storing and redistributing the full body is a separate issue.
- Scoring: Initially, adding bonus points to words appearing simultaneously across multiple sources is sufficient. This treats keywords appearing in three places on the same day as having a stronger signal than those appearing in only one.
- Summarization: Feed 20–30 titles at once to an LLM and request "5 grouped summaries and representative titles." Including only titles uses fewer tokens. Since summaries can be inaccurate, keep links so users can view the original text if needed.
- Error handling: Catch exceptions per source so that if one fails, the entire process doesn't stop; just log the error.

</details>

## Cost Estimation

Assumptions: Collect once daily from 20 sources, approximately 200 titles, and one LLM summarization pass. Assuming an average of 20 tokens per title, input is around 4,000 tokens. If output for one summarization is roughly 500 tokens, a single daily call suffices. Exact model pricing varies, but this volume suggests monthly costs in the range of a few hundred to a few thousand won.

| Item | Method | Cost |
|---|---|---|
| RSS Collection | Script | 0 won |
| YouTube Data API | Within free quota | 0 won |
| Google Trends API | Alpha, requires application | - |
| Summarization | LLM once daily | Estimated few hundred to few thousand won/month |
| Server | Personal PC or existing server | 0 won (electricity) |

Time costs more than money. You'll spend time managing source lists, fixing broken feeds, and reading terms of service.

## If Building It Yourself

1. Create a source list file. Start with 10 RSS feeds and a few YouTube channels.
2. Run a script once daily to accumulate titles, links, and dates into JSON.
3. Normalize URLs to remove duplicates and retain only the last 24 hours of data.
4. Generate a single-page document showing top word frequencies and LLM grouped summaries.
5. Move only topics worth human review to your topic pool.
6. Track outcomes separately (e.g., [→ Performance Dashboard](#/post/mk-dashboard)) to understand which topics resonate; without this, you can't verify if collection is effective.

For creating content or videos based on collected trends, see [→ Thumbnail/Copy A/B Testing](#/post/mk-ab-test) for comparative experiments, and [→ Short-form Automation Pipeline](#/post/mk-shortform-pipeline) for assembling short-form content. Discussions on using comment/DM reactions as trends connect to [→ Comment/DM Response Automation](#/post/mk-comment-bot).

## Common Misconceptions

- "Knowing trends tells you what will go viral" → You're collecting what's already trending; others may be looking at the same list.
- "If I can scrape it, I can use it" → Technical feasibility is separate from terms of service and copyright compliance.
- "LLM summarization means humans don't need to review" → Summaries can be inaccurate, so human oversight in selecting candidates remains essential.

[← Concept Map](#/post/ai-map)

## Reference Links

- YouTube Data API Quota Cost Calculation: https://developers.google.com/youtube/v3/determine_quota_cost
- Google Search Central, Google Trends API (Alpha): https://developers.google.com/search/apis/trends
- RFC 9309, Robots Exclusion Protocol: https://www.rfc-editor.org/rfc/rfc9309
- RSS 2.0 Specification (RSS Advisory Board): https://www.rssboard.org/rss-specification