速率限制（Rate Limiting）是一种机制，用于在特定时间内对接收的请求数量设置上限。一旦超过该上限，服务器将拒绝处理请求并将其返回。其首要目的是保护服务器，其次是防止单个用户独占资源。

## 为什么需要它

服务器的处理能力是有限的，但请求可能会突然集中涌入。程序错误或脚本可能导致无限循环并不断调用 API，或者由于事件导致大量真实用户同时访问。如果没有任何限制，个别用户的过度请求会导致其他所有用户的响应变慢。

Stripe 在 2017 年的一篇文章中提到，最重要的限制是每秒每用户的请求数限制。他们每月拒绝了数百万次请求，其中大多数是在测试环境中运行的滥用脚本造成的。这表明，与恶意的攻击相比，因代码错误导致的滥用更为常见。文中的数据基于文章撰写时的情况。

虽然可以通过增加服务器数量来解决请求过载问题（[详情 → 自动扩展](#/post/infra-autoscaling)），但增加服务器需要时间和成本。速率限制则是在此期间提供缓冲的解决方案。关于如何将请求分发到不同服务器的内容，在 [负载均衡器](#/post/infra-load-balancer) 文章中另有说明。

## 如何计数

通常有三种标准：

| 标准 | 计数对象 | 特点 |
|---|---|---|
| IP | 发送请求的地址 | 即使未登录也可使用，但如果整个公司网络共享同一 IP，可能会导致无辜用户被限制 |
| 用户/API 密钥 | 已认证的账户 | 最公平。仅在认证后才能使用 |
| 端点 | 特定路径 | 对如登录、支付等关键操作施加更严格的限制 |

RFC 6585 在定义 HTTP 429 状态码时指出，并未规定服务器应如何识别用户以及如何计数请求。仅说明可以通过认证信息或 Cookie 进行识别，并且可以针对单个资源、整个服务器或多个服务器的总和进行计数。因此，具体的计数标准由服务方自行决定。

如果存在多个服务器，不能为每个服务器单独设置计数器。如果三台服务器各自允许“每秒 10 个”请求，那么用户实际上可以发送 30 个请求。因此，计数器通常放置在所有服务器共同可见的位置。Stripe 提到他们是在 Redis 上实现了令牌桶算法。这部分内容将在 [Redis 缓存](#/post/db-cache-redis) 文章中继续讨论。

## 三种算法

### 固定窗口

将时间划分为固定的区间（例如 10 秒），并在每个区间内设置计数器。如果允许每 10 秒最多 5 个请求，则在窗口切换时将计数器重置为 0。这种方法的实现最为简单。

其缺点在于窗口边界问题。如果在 9.9 秒发送 5 个请求，在 10.0 秒再发送 5 个请求，根据每个窗口的标准，两者都被允许，但实际上在 0.1 秒内就进入了 10 个请求。我在下面通过实际运行进行了验证。

### 滑动窗口

统计“从当前时刻往前推 10 秒内有多少个请求”。记录所有请求的时间戳（滑动日志）虽然准确，但需要为每个请求保存记录，因此占用更多内存。这种方法没有边界问题，但成本较高。

### 令牌桶

这是最常见的算法。桶中最多可容纳 N 个令牌，并以恒定速率补充令牌。每当有一个请求到达时，就消耗一个令牌；如果桶为空，则拒绝请求。每个用户都有一个独立的桶。

该算法有两个参数：容量（capacity）表示一次可以接受的突发流量大小，而填充速率（refill rate）则表示长期运行时的平均速度。如果设置为容量 5、每秒 1 个，那么在平时会按每秒 1 个的速度处理，而在休息一段时间后，可以一次性接受多达 5 个请求。由于用户往往在安静一段时间后集中发送大量请求，这种特性与现实情况非常契合。

<details>
<summary>用 Python 实现的三种算法示例</summary>

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

运行结果如下：

- 令牌桶（容量 5，每秒 1 个）：如果在时间 0 一次性发送 10 个请求，只有前 5 个通过。如果在 3 秒后再次发送 5 个请求，则前面的 3 个通过。
- 限制为每 10 秒 5 个请求，在 9.9 秒发送 5 个 + 10.0 秒发送 5 个：固定窗口允许在 0.1 秒内进入 10 个请求，而滑动日志只允许 5 个。

实现的关键在于“根据时间流逝一次性计算”并补充令牌。不是通过定时器逐个添加令牌，而是在收到请求时，根据与上次时间的差值增加相应数量的令牌。因此，不需要为每个用户运行一个定时器。

</details>

## 429 与客户端应采取的措施

拒绝请求时，标准做法是返回 HTTP 429 Too Many Requests。MDN 解释说，这表示“客户端在给定时间内发送了过多请求”。如果在响应中添加 `Retry-After` 头，可以告知客户端多久之后可以重试。该值的单位可以是秒，也可以是 HTTP 日期格式，因此客户端需要能够解析这两种格式。RFC 6585 指出，这是一个可选的头部字段。

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

如果接收方收到 429 状态码后立即重发请求，情况会变得更糟。因此，重试需要遵循一定的规则。AWS Builders' Library 的文章总结了以下内容：

- 重试会给已经不堪重负的系统增加更多请求。即使问题得到修复，高负载仍可能延缓系统的恢复。
- 每层都进行重试会导致负载成倍增长。如果 5 个层级各自重试 3 次，最底层的数据库可能会承受 243 倍的负载。因此建议仅在单一节点处进行重试。
- 对指数退避（逐步增加等待时间）设置上限和次数限制。
- 添加抖动（jitter），即引入随机偏差。如果失败的客户端在同一时刻以相同间隔退出，它们会在同一时刻再次聚集。
- 在重试中也使用令牌桶机制。仅在令牌充足时进行重试；令牌耗尽后则以较慢的速度执行。据称 AWS SDK 于 2016 年引入了此功能。
- 对于有副作用的调用，若非幂等，则重试存在风险。

我们模拟了抖动带来的差异。假设有 100 个客户端在同一时刻失败并进行第三次尝试（等待 4 秒），若无抖动，每秒会有 100 个请求涌入；而在 0~4 秒之间随机退避时，每秒最多为 27 个。由于这是一次固定随机数种子的实验，我们关注的是趋势而非精确数值。

## 不是封堵而是疏导

速率限制会丢弃超出限额的请求。对于不应被丢弃的情况，需采取不同的处理方式。

- **队列化（Queuing）**：不立即处理请求，而是将其放入队列，由工作进程按自身节奏取出并处理。用户仅收到“已接收”确认，结果稍后返回。该结构在 [异步队列](#/post/be-async-queue) 文章中有所介绍。
- **背压（Backpressure）**：当处理端变慢时，将这一事实反馈给上游，从而降低发送速度。当队列满时，可拒绝新请求或让生产者等待。若队列无限增长只会增加延迟，因此也需要对队列长度设置上限。
- **并发请求限制**：不是统计每秒的请求数，而是统计当前正在处理的请求数量。Stripe 在 CPU 密集型端点中使用此方法，以防止因重试叠加导致的竞态条件。
- **负载 shedding（负载 Shedding）**：当整个服务器接近极限时，保留重要请求的配额，优先丢弃次要请求。在 Stripe 的文章中提到，会为创建支付等核心调用预留部分容量，而对列表查询等非关键调用，若超出限制则返回 503 状态码。

Stripe 指出同时采用这四种策略（请求速率、并发请求、服务整体负载 Shedding、基于工作进程使用率的限制），而非试图用单一手段解决所有问题，而是分层应对。

## 常见误解

- 429 并非表示服务器故障。此时服务器运行正常，只是客户端超出了分配限额；而真正的故障通常会返回 5xx 状态码。不过，出于自我保护目的主动发送的 503 对客户端而言看起来类似故障。
- 认为有了速率限制就能防止 DDoS 攻击是过度期待。速率限制统计的是到达应用服务器的请求，因此无法防御在网络层面就被拦截的攻击；此类攻击应在更前端处理。本文讨论范围之外，故不作详述。
- 仅统计 IP 地址也不足够。同一网络的用户可能被绑定到同一个 IP，而攻击者会频繁更换 IP。
- 设定一次限额并非一劳永逸。若限额过低会导致正常用户受阻，过高则失去意义，因此需根据实际流量动态调整。
- 也存在像 LLM API 那样以 token 数量作为限额的服务。用 token 而非请求次数计费，其思路与令牌桶中的 `cost` 参数一致。关于成本方面的讨论可参考 [AI 应用成本](#/post/app-cost)。

## 参考资料链接

- Stripe, Scaling your API with rate limiters (2017): https://stripe.com/blog/rate-limiters
- MDN, 429 Too Many Requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
- RFC 6585 section 4: https://www.rfc-editor.org/rfc/rfc6585#section-4
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter

← [概念地图](#/post/infra-map)

相关文章：[负载均衡器](#/post/infra-load-balancer) · [自动伸缩](#/post/infra-autoscaling) · [异步队列](#/post/be-async-queue)