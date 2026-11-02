A rate limiter is a mechanism that sets an upper limit on the number of requests accepted within a certain period; any requests exceeding this limit are rejected and returned without processing. The primary purpose is to protect the server, while the secondary goal is to prevent a single user from monopolizing resources.

## Why is it needed?

Servers have a fixed capacity for handling requests, but these requests can arrive in sudden bursts. Bugs or scripts might trigger infinite loops that hammer an API, or genuine users might flood the system via events. Without any limits, one runaway user slows down responses for everyone else.

An article written by Stripe in 2017 mentions this issue. The most important limit was the requests-per-second limit per user; millions of requests were rejected monthly, mostly from brute-force scripts running in test mode. This suggests that accidental code errors are more common than malicious attacks (based on the time the article was written).

While increasing server count can solve request surges ([see details → Autoscaling](#/post/infra-autoscaling)), it takes time and costs money. Rate limiters bridge this gap. How requests are distributed is covered in the [Load Balancer](#/post/infra-load-balancer) article.

## Where to count

Typically, there are three criteria:

| Criterion | Target for Counting | Characteristics |
|---|---|---|
| IP | Address of the requester | Can be used even before login, but if a company's network shares an IP, legitimate users may be unfairly blocked. |
| User/API Key | Authenticated account | Most fair; only applicable after authentication. |
| Endpoint | Specific path | Applies stricter limits to heavy operations like login or payment processing. |

RFC 6585 defines HTTP 429 but states that the server does not specify how it identifies users or counts requests. It only mentions that identification can be done via authentication information or cookies, and counting can apply per resource, for the entire server, or across multiple servers combined. Therefore, the criterion is determined by the service itself.

If there are multiple servers, counters cannot be maintained separately on each server. If three servers each allow "10 per second," users could effectively send 30 requests. Thus, counters are usually placed in a shared location accessible to all servers. Stripe implemented token buckets on top of Redis. This connects to the [Redis Cache](#/post/db-cache-redis) article.

## Three Algorithms

### Fixed Window

Time is divided into intervals (e.g., 10 seconds), with a counter for each interval. If the limit is 5 per 10-second window, the counter resets to zero when the interval changes. This is the easiest to implement.

The drawback lies at the interval boundaries. Sending 5 requests at 9.9 seconds and another 5 at 10.0 seconds would both be allowed within their respective windows, but in reality, 10 requests arrive within 0.1 seconds. I verified this directly below.

### Sliding Window

This counts "how many requests arrived in the last 10 seconds from now." Recording the timestamp of every request (sliding log) is accurate but consumes memory because it must store records for each request. While it avoids boundary issues, it incurs higher costs.

### Token Bucket

This is the most common approach. A bucket holds a maximum of N tokens and refills at a constant rate. When a request arrives, one token is consumed; if the bucket is empty, the request is rejected. Each user has their own bucket.

There are two parameters: capacity (the size of the burst that can be handled at once) and refill rate (the average speed over time). With a capacity of 5 and a refill rate of 1 per second, the system normally handles 1 request per second but allows up to 5 requests after a period of inactivity. Since users often behave quietly before sending bursts, this characteristic aligns well with reality.

<details>
<summary>Demonstration of the three methods using Python</summary>

```python
from collections import deque

class TokenBucket:
    def __init__(self, capacity, refill_per_sec, now=0.0):
        self.capacity, self.rate = capacity, refill_per_sec
        self.tokens, self.last = float(capacity), now
    def allow(self, now, cost=1):
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

class FixedWindow:
    def __init__(self, limit, window):
        self.limit, self.window = limit, window
        self.start, self.count = 0.0, 0
    def allow(self, now):
        if now - self.start >= self.window:
            self.start = now - (now % self.window); self.count = 0
        if self.count < self.limit:
            self.count += 1; return True
        return False

class SlidingLog:
    def __init__(self, limit, window):
        self.limit, self.window, self.log = limit, window, deque()
    def allow(self, now):
        while self.log and self.log[0] <= now - self.window:
            self.log.popleft()
        if len(self.log) < self.limit:
            self.log.append(now); return True
        return False
```

The execution results were as follows:

- Token Bucket (capacity 5, refill rate 1 per second): Sending 10 requests at time 0 allows only 5 to pass. Sending another 5 at 3 seconds allows only the first 3 to pass.
- Limit of 5 per 10-second window, with 5 sent at 9.9s and 5 at 10.0s: The fixed window allows 10 within 0.1 seconds, while the sliding log allows only 5.

The key implementation trick is to "calculate tokens in bulk" based on the flow of time rather than adding them one by one using a timer. Instead of incrementing tokens individually via a timer, the difference from the last timestamp is added when a request arrives. Thus, there is no need to run timers for each user.

</details>

## 429 and What the Client Should Do

When rejecting requests, returning HTTP 429 Too Many Requests is the standard. MDN explains this as "the client has sent too many requests within a given time." Attaching a `Retry-After` header in the response informs the client when to retry. The value can be either a number of seconds or an HTTP date, so the client must handle both formats. RFC 6585 specifies that including this header is optional.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

If the recipient receives a 429 response and immediately retries, the situation worsens. Therefore, rules are necessary for retries. The content summarized from AWS Builders' Library is as follows:

- Retrying adds more requests to an already stressed system. Even after the issue is resolved, high load can persist and delay recovery.
- Retrying at each step compounds exponentially. If five layers each retry three times, the bottom database could face 243x the load. Thus, retries are recommended only from a single point.
- Set limits on both the maximum number of retries and the exponential backoff (gradually increasing wait time).
- Add jitter, i.e., random deviation. If clients that fail at the same moment retreat with the same interval, they will converge again at the same moment.
- Use a token bucket for retries. Retry only while tokens are available; once depleted, proceed slowly. It is said that this was added to AWS SDK in 2016.
- Calls with side effects are dangerous if not idempotent when retrying.

I simulated how much jitter makes a difference. If 100 clients fail at the same moment and attempt their third retry (with a 4-second wait), without jitter, all 100 would pile up in one second. With random timing between 0 and 4 seconds, the maximum was 27 per second. This was a single experiment with a fixed random seed, so I observed the direction rather than exact numbers.

## Organizing Instead of Blocking

Rate limiters discard excess requests. Things that should not be discarded must be handled differently.

- **Queuing**: Instead of processing requests immediately, enqueue them and let workers process them at their own pace. The user is acknowledged upon submission, with results received later. This structure is described in the [asynchronous queue](#/post/be-async-queue) article.
- **Backpressure**: When the processing side slows down, inform the upstream to reduce sending speed. If the queue fills up, reject new requests or make the producer wait. Since an infinitely long queue only increases latency, a limit on queue length is also necessary.
- **Concurrent request limiting**: Count not just requests per second, but how many are currently being processed. Stripe used this to prevent race conditions caused by overlapping retries on CPU-intensive endpoints.
- **Load shedding**: When the entire server approaches its limit, reserve capacity for critical requests and discard less important ones first. In a Stripe article, it is mentioned that some capacity is reserved specifically for core calls like payment creation, while less critical calls like list retrieval are returned with a 503 if they exceed limits.

Stripe notes that these four (request rate, concurrent requests, overall service load shedding, and worker utilization-based throttling) are used in combination. Rather than trying to block everything at once, layers are applied.

## Common Misconceptions

- A 429 does not mean the server is down. The server is fine; the client has exceeded its allocation. Server errors return 5xx codes. However, a 503 sent intentionally for self-protection may appear similar from the client's perspective.
- Expecting rate limits to stop DDoS attacks is excessive. Since rate limiters count requests reaching the app server, they are ineffective against network-level attacks that block traffic before it reaches the application; such attacks must be handled earlier in the stack. This falls outside the scope of this article.
- Counting only by IP is insufficient. Users on the same network may share an IP, and attackers change IPs.
- Limits are not set once and for all. If too low, legitimate users are blocked; if too high, they serve no purpose. Adjustments must be made based on actual traffic patterns.
- Some services, like LLM APIs, impose limits based on token count rather than request count. Using tokens as the cost metric is akin to the `cost` factor in a token bucket. Discussions on costs can be found in [AI app cost](#/post/app-cost).

## Reference Links

- Stripe, Scaling your API with rate limiters (2017): https://stripe.com/blog/rate-limiters
- MDN, 429 Too Many Requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
- RFC 6585 section 4: https://www.rfc-editor.org/rfc/rfc6585#section-4
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter

← [Concept map](#/post/infra-map)

Related articles: [Load balancer](#/post/infra-load-balancer) · [Auto-scaling](#/post/infra-autoscaling) · [Asynchronous queue](#/post/be-async-queue)