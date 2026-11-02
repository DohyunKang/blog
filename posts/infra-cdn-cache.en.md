A CDN is a collection of cache servers that store copies of responses from the origin server at locations closer to users (the edge) and serve them instead. The speed improvement is a bonus; the real concern is determining how long to trust a copy via the `Cache-Control` header, and knowing how to clear incorrect copies when they persist.

## First, in simple terms

If a server in Seoul is used by a user in the US, every request must cross the ocean. Receiving an image this way is slow. Therefore, we keep a copy of the same image in the US as well, and let the US user fetch it from there. The server that holds this copy is the CDN edge. For the order of requests, see [the detailed journey → Request Journey](#/post/infra-request-journey).

With copies available, the origin server is less busy. Even if 100,000 users receive the same logo, the origin server only receives a few requests from the edge locations. Both speed and server load are reduced simultaneously, so CDNs are almost always placed in front of static files.

## Cache layers are multiple

Caching isn't done in just one place; it's layered.

| Layer | Who uses it? | Example |
|---|---|---|
| Browser cache | One user (private cache) | JS file stored on disk |
| CDN edge | Multiple users (shared cache) | Servers like Cloudflare |
| Origin front-end / App cache | Inside the server | Redis, etc., [see → Cache and Redis](#/post/db-cache-redis) |

MDN broadly divides caching into two categories: private cache, which is dedicated to a single person (primarily the browser), and shared cache, which is used by multiple people. CDNs fall under "managed cache" in the shared category. This distinction matters because of what comes below regarding `private` and `s-maxage`.

## Cache Headers: How long to trust a copy

The origin attaches `Cache-Control` to the response to say, "Handle this like this," listing only the relevant directives.

- `max-age=seconds`: Fresh for this duration. During this time, use the copy without asking the origin.
- `s-maxage=seconds`: Applies only to shared cache (CDN). Takes precedence over `max-age` in shared caches; browsers ignore it. If `max-age=60, s-maxage=3600`, the browser trusts for 60 seconds, while the CDN trusts for 1 hour.
- `no-cache`: Contrary to its name, storage is allowed. However, you must check with the origin every time before using it ("Is it still valid?").
- `no-store`: Means do not store anywhere.
- `private`: Means only the browser should store; shared caches like CDNs must not.
- `public`: Implies that responses to requests with an Authorization header can also be stored. MDN notes this should be used only when necessary.
- `immutable`: This file will never change. No need to revalidate upon refresh.

It's easy to initially misunderstand `no-cache` and `no-store`. `no-store` prevents storage itself. `no-cache` means "store it, but verify every time before use."

### When stale: Conditional Requests

Once the freshness period expires, the copy becomes stale. Instead of discarding it immediately, you ask the origin again. If the server returns a value like `ETag: "33a64df5"` (a content fingerprint), the cache sends back `If-None-Match: "33a64df5"` in the request. If nothing has changed, the server responds with just `304 Not Modified` without the body, and the cache reuses the existing copy as fresh. If it has changed, a `200` response with the new body arrives. This saves bandwidth by not sending the body when unchanged.

### stale-while-revalidate

The web.dev example is `Cache-Control: max-age=1, stale-while-revalidate=59`. For the first second, it's fresh and used as-is. Between 1 and 60 seconds, the stale copy is served first while the origin is checked in the background to refresh the copy. After 60 seconds, the stale copy cannot be used, and the network wait begins. Users don't wait; the refresh happens in the background. If the browser doesn't support this directive, it follows only `max-age`.

When the origin is down, there's `stale-if-error`. With `max-age=604800, stale-if-error=86400`, the content is fresh for 7 days; thereafter, for one day, if errors like 500, 502, 503, or 504 occur, the stale copy is served instead.

## Invalidating: Clearing incorrect copies

The longer you trust a copy, the more users see old content even after fixing the origin. There are mainly two ways to solve this.

First is changing the filename (cache busting). MDN cites methods like embedding a version number, e.g., `bundle.v123.js`, or including a content hash in the filename. Since the URL changes when the content updates, old copies are simply no longer used. Therefore, it is safe to serve such files with `Cache-Control: public, max-age=31536000, immutable` (1 year).

Second is directly asking the CDN to delete content (purge). Based on Cloudflare documentation, options include per-URL, entire cache, cache tags, hostname, URL prefix, etc. The documentation recommends per-URL deletion and suggests using full cache deletion only for broad changes. There is also "invalidation," which merely marks content as stale; the next request checks the origin, and if unchanged, uses the existing copy. Request limits vary by plan (e.g., Free plans allow 5 deletions per minute for entire, tag, hostname, or prefix). Even receiving a `200` status on a deletion request only means "received"; to verify success, you must check again that `CF-Cache-Status` is not `HIT`.

A simple simulation I ran directly is provided below.

<details>
<summary>Detailed explanation: Python code and results mimicking edge cache (executed directly)</summary>

I created a simplified edge with a 60-second TTL for demonstration purposes; this does not reflect actual CDN behavior but serves to verify the concept.

```python
class Edge:
    def __init__(s): s.c={}; s.hit=s.miss=0
    def get(s,url,now,origin):
        e=s.c.get(url)
        if e and now<e[1]: s.hit+=1; return e[0],'HIT'
        s.miss+=1; body,ttl=origin(url); s.c[url]=(body,now+ttl); return body,'MISS'
    def purge(s,url): s.c.pop(url,None)

ver={'v':1}
def origin(url): return (f"{url} content-v{ver['v']}", 60)
e=Edge()
for t in [0,10,20,59,61,62]:
    print(t,e.get('/app.js',t,origin))
ver['v']=2                       # 원본 배포
print(63,e.get('/app.js',63,origin))   # 아직 옛 복사본
e.purge('/app.js')
print(64,e.get('/app.js',64,origin))   # 지운 뒤 새 내용
```

The results were as follows:

```
0  MISS  v1
10 HIT   v1
20 HIT   v1
59 HIT   v1
61 MISS  v1   (TTL 끝나서 원본에 다시 감)
62 HIT   v1
63 HIT   v1   <- 원본은 v2인데 옛것을 내줌
64 MISS  v2   <- purge 뒤
```

At 63 seconds, the origin already served v2, yet the edge still delivered v1—this is why invalidation is necessary. In this simulation, the hit rate was 5 out of 8 requests, or 0.625.

</details>

## Separate static and dynamic content

Decide what to delegate to the CDN based on file characteristics.

| | Static (images·JS·CSS·fonts) | Dynamic (API responses·logged-in pages) |
|---|---|---|
| Varies per user | No | Yes |
| CDN cache | Long, with hash filename + immutable | Usually not used; if used, keep it short |
| Header example | `public, max-age=31536000, immutable` | `private` or `no-store` |

HTML is in between. Since you cannot update HTML by changing filenames, MDN recommends `no-cache` + `ETag` (check every time) as default for HTML. For user-specific content, add `private`. Additionally, the JS and CSS referenced by HTML should be cached long using hashed filenames. The combination of checking HTML every time while caching its internal files for a long duration is effective. Whether pages are generated on the server or in the browser affects cacheability; see [Rendering modes → detailed](#/post/fe-rendering-modes) for more.

Cloudflare caches based on file extensions by default and does not cache HTML and JSON unless specified, according to documentation. To enable additional caching, create a Cache Rule separately. Caching is disabled if the response contains `Set-Cookie`, includes `private`·`no-store`·`no-cache`·`max-age=0`, or if the request method is not GET. It appears common for a single cookie to block caching.

## Viewing status from the CDN side

You can observe how caching was handled via CDN response headers. Cloudflare's `CF-Cache-Status` values are as follows:

| Value | Meaning |
|---|---|
| HIT | Served from cache |
| MISS | Not in cache; fetched from origin |
| EXPIRED | Copy expired; fetched fresh from origin |
| REVALIDATED | Origin confirmed "still valid"; served cached copy |
| STALE | Could not reach origin; served stale copy |
| UPDATING | Serving stale copy while refreshing in background |
| DYNAMIC | Not cacheable; forwarded directly to origin |
| BYPASS | Was cacheable, but origin marked as non-cacheable; not stored |

If a logged-in user's page returns `HIT`, it is a warning sign. Other users' screens could be affected. MDN also states that personalized content should not go to shared caches and that the presence of cookies does not automatically make content private; you must explicitly add `Cache-Control: private`. Using `Vary` with cookies for differentiation is also discouraged.

## Common Misconceptions

- `no-cache` does not mean "do not cache"; it means "cache but revalidate on every request." To prevent caching entirely, use `no-store`.
- Caching is always faster: the first request results in a MISS and must fetch from the origin. For URLs that are rarely requested, the hit rate is low, so the benefit is minimal.
- If there are no headers, caching is impossible: incorrect. According to MDN, if only `Last-Modified` is present, the client can infer freshness (approximately 10% of the age) and cache accordingly. Therefore, it is recommended to always specify headers explicitly. Cloudflare also has a default rule that caches 200 responses for 120 minutes if no `Cache-Control` header is provided.
- Purging immediately reflects changes to all users: incorrect. A 200 response to a purge request merely confirms receipt of the deletion request. Copies stored in browsers are not removed by CDN purging. This point is inferred from the distinction that private caching operates separately, rather than being directly stated in documentation.
- Cache keys consider only the URL: by default, yes, but additional request headers specified in the `Vary` header are also included in the cache key. For example, `Vary: Accept-Language` results in separate storage per language. `Vary: User-Agent` is generally discouraged because the large number of variants drastically reduces hit rates.

## Related Concepts

Similar ideas apply to AI as well. [Prompt caching](#/post/ai-prompt-caching), which avoids recalculating the same initial part of a prompt, operates on this principle. When viewed alongside load balancers that split requests at the edge ([자세히 → 로드 밸런서](#/post/infra-load-balancer)), the shared goal becomes evident: reducing requests that reach the origin. Perspectives on web performance can be found in [Frontend Performance](#/post/fe-performance).

## Reference Links

- MDN, HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- MDN, Cache-Control: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- web.dev, Keeping things fresh with stale-while-revalidate: https://web.dev/articles/stale-while-revalidate
- Cloudflare Docs, Default cache behavior: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cloudflare Docs, Cloudflare cache responses: https://developers.cloudflare.com/cache/concepts/cache-responses/
- Cloudflare Docs, Purge cache: https://developers.cloudflare.com/cache/how-to/purge-cache/

← Concept map (#/post/infra-map)

Related posts: [The Journey of a Single Request](#/post/infra-request-journey) · [Load Balancers](#/post/infra-load-balancer) · [Caching and Redis](#/post/db-cache-redis)