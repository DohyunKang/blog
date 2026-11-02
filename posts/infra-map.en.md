Running a service often brings terms like load balancers, CDNs, caching, rate limiting, and auto-scaling into the conversation. All of these are devices placed somewhere along the path from the user to the database; therefore, I've briefly introduced them one by one based on this path. For more details, follow the links below.

## Overview of Relationships

```
사용자 → DNS → CDN(엣지 캐시) → 로드밸런서 → 앱 서버 → 캐시 → DB
                                   ↑               ↑
                          레이트 리밋(문 앞에서 제한)   오토스케일링(서버 수 조절)
앱 서버 → (LLM API를 부르는 서비스라면) 큐·캐시·타임아웃을 한 겹 더
```

## 1. First, View the Entire Path

**The Journey of a Single Request**: Entering an address and pressing Enter involves traversing multiple stages from DNS to the database. Since bottlenecks usually occur at one or two points, it's crucial to identify where time is being lost first.
[Read more → The Journey of a Single Request](#/post/infra-request-journey)

## 2. Receiving and Distributing Upfront

**CDN and Caching Layers**: Caches store copies of responses from the origin server closer to users. Managing how long to trust these copies via `Cache-Control` headers is what truly requires attention.
[Read more → CDN and Caching Layers](#/post/infra-cdn-cache)

**Load Balancer**: Load balancers distribute requests across multiple servers and prevent routing traffic to dead servers. While the distribution method matters, quickly removing failed servers seems even more critical.
[Read more → Load Balancer](#/post/infra-load-balancer)

## 3. Handling High Traffic

**Rate Limiting and Traffic Control**: These mechanisms reject requests that a server cannot handle at the gateway. Depending on the algorithm used, they may allow bursts or enforce strict boundaries.
[Read more → Rate Limiting and Traffic Control](#/post/infra-rate-limit)

**Auto-scaling and Scaling**: There are two scaling approaches: vertical and horizontal. To enable automatic scaling, servers must not maintain state.
[Read more → Auto-scaling and Scaling](#/post/infra-autoscaling)

## If It's an AI Service

**AI Service Serving Architecture**: Services invoking LLM APIs are slow, occasionally fail, and incur costs per call. Therefore, layers of queues, caches, and timeouts should be added along the request path.
[Read more → AI Service Serving Architecture](#/post/infra-ai-serving)

## Related Articles

- For caching and Redis, see [Read more → Caching and Redis](#/post/db-cache-redis).
- For deploying and running servers, see [Read more → Cloud Basics](#/post/cloud-basics).
- If you're curious about LLM calls themselves, see [Read more → What is an LLM?](#/post/ai-llm)

← Concept Map ([#/post/ai-map])