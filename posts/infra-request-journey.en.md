When you press Enter in the browser, a single request passes sequentially through DNS, CDN, Load Balancer, Server, Cache, and Database, with time accumulating at each stage. When performance is slow, the first step is to identify which part of this path is the bottleneck.

## Overview in One Page

```
브라우저
  │ 1. DNS: 도메인 → IP 주소
  ▼
CDN(엣지)  ── 캐시에 있으면 여기서 응답하고 끝
  │ 2. 없으면 원본 서버 쪽으로
  ▼
로드밸런서 ── 살아 있는 서버 중 하나를 고름
  │
  ▼
앱 서버 ──── 3. 캐시(Redis 등)를 먼저 확인
  │            있으면 바로 응답
  ▼
DB ───────── 4. 캐시에 없을 때만 조회
```

Actual services may omit some of these components. Some services don't use a CDN, and others might have only one server, meaning no load balancer is needed. However, the overall structure remains similar, so we've organized it in this order.

## 1. DNS: Resolving Names to Addresses

The browser's first task is to find the IP address of the domain. The flow described by AWS documentation is as follows: the browser asks a DNS resolver (typically operated by an ISP or corporate network), which then queries the root name servers, followed by the TLD name servers (e.g., .com), and finally the authoritative name server for that specific domain. Once the answer is received, the resolver caches the IP address for a set duration, allowing it to respond immediately to subsequent queries without repeating the process.

Therefore, finding the same domain a second time is faster. The caching duration is called TTL (Time To Live). Setting a longer TTL reduces lookup frequency, but changing the server IP will still leave the old address cached for some time.

## 2. Establishing Connection: TCP and TLS

Knowing the IP doesn't mean data exchange can begin immediately. First, a TCP connection (handshake) must be established, and if using HTTPS, an additional TLS negotiation is required. MDN's explanation on latency breaks down the process into DNS resolution, connection establishment, TLS negotiation, request transmission, server processing, and response reception, noting that the initial slowness often stems from these preparatory steps occurring together. Once a connection is established, subsequent requests avoid incurring this cost again.

Here, most of the time comes from distance. The handshake requires multiple round trips, and each round trip takes longer the farther away the server is. This is precisely why CDNs are needed—to place servers closer to users.

## 3. CDN: Serving Content from Nearby Locations

According to MDN, a CDN consists of a group of servers distributed across various regions, each holding copies of data so that the nearest location handles the request. This approach works well for files shared among everyone, such as images, CSS, and JavaScript. If a copy exists at the edge (cache hit), the request ends there; otherwise (cache miss), it goes to the origin server to fetch and cache the content. Consequently, the number of requests reaching the origin server decreases accordingly.

MDN also adds an important note worth remembering: CDNs introduce an additional external dependency. Connecting a new domain incurs extra DNS lookup and connection costs, which could actually slow things down. Speed isn't guaranteed in all cases.

[Learn more → CDN and Caching](#/post/infra-cdn-cache)

## 4. Load Balancer: Deciding Which Server to Route To

Requests coming from the origin side are received by the load balancer. Based on AWS documentation, a load balancer distributes incoming traffic across multiple targets (instances, containers, etc.) and continuously checks their health, routing requests only to healthy servers. The goal is to maintain uninterrupted request flow even when servers are added or removed. Encryption and decryption can also be handled by the load balancer itself.

Thus, if one server fails, users may not even notice. When scaling up the number of servers, it's done alongside [auto-scaling](#/post/infra-autoscaling), where newly provisioned servers automatically register with the load balancer.

[Learn more → Load Balancers](#/post/infra-load-balancer)

## 5. App Server, Cache, and Database

When a request reaches the app server, code executes. Authentication is verified, and necessary data is retrieved. Frequently accessed data is stored in caches like Redis and checked first. If found, it's retrieved directly from memory for an immediate response; otherwise, the database is queried, and the result is cached afterward.

Database queries are typically the most expensive operation here. Caches are placed in front to avoid repeatedly scanning disks for the same questions. If a query itself is slow, check first whether an [index](#/post/db-index) exists. How requests flow within a server is covered separately.

[Learn more → Caching and Redis](#/post/db-cache-redis) · [Learn more → Request Flow Inside a Server](#/post/be-request-flow)

## 6. Where Does Latency Accumulate?

We've compiled a table summarizing roughly where time is spent at each stage. We deliberately omitted specific numbers, as they vary significantly depending on the environment, making it difficult to generalize with a single value.

| Stage | Reason for Delay | How to Reduce It |
|---|---|---|
| DNS | Resolver queries multiple servers sequentially | Use resolver cache (TTL), reduce number of domains |
| TCP/TLS | Multiple round trips proportional to distance | Reuse connections, place users closer (CDN) |
| CDN | Round trip to origin on cache miss | Create responses suitable for caching |
| Load Balancer | Usually short; involves server selection | Ensure only healthy servers receive traffic |
| App Server | Code processing, external calls | Reduce unnecessary calls, use caching |
| Database | Disk reads, query structure | Use indexes, caching, and optimize queries |

web.dev defines TTFB (Time to First Byte) as the sum of redirect, DNS, connection and TLS handshake, plus the time from request to first byte. A rough guideline is that under 0.8 seconds is acceptable, while over 1.8 seconds indicates poor performance. However, this is noted as a "rule of thumb for most sites."

## My Own Measurements

After only reading about it theoretically, I measured it myself on my PC. Using Python sockets, I measured DNS lookup, TCP connection, and HTTP request (first byte) to example.com step by step. Since I used plain text HTTP on port 80 instead of HTTPS, the TLS segment was excluded.

```
DNS 11ms / TCP 153ms / 첫 바이트 145ms / 다운로드 2ms / 합계 311ms
DNS 10ms / TCP 113ms / 첫 바이트 120ms / 다운로드 0ms / 합계 243ms
DNS 10ms / TCP 114ms / 첫 바이트 119ms / 다운로드 0ms / 합계 243ms
```

DNS took around 10ms, while TCP connection and waiting for the first byte each took between 110–150ms. The download was negligible since the page was small. These numbers confirmed what is often said: if the server is far away, distance dominates connection time and latency. However, these results reflect my PC's location and network conditions at that moment; they could be completely different elsewhere. DNS being fast might also have been due to caching.

<details>
<summary>Detailed explanation: measurement code and how to read it</summary>

```python
import socket, time, sys
host = sys.argv[1]
t0 = time.perf_counter()
ip = socket.getaddrinfo(host, 80, socket.AF_INET)[0][4][0]   # DNS
t1 = time.perf_counter()
s = socket.create_connection((ip, 80), timeout=10)           # TCP
t2 = time.perf_counter()
s.sendall(f"GET / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode())
s.recv(1)                                                      # 첫 바이트
t3 = time.perf_counter()
while s.recv(65536):                                           # 나머지 다운로드
    pass
t4 = time.perf_counter()
ms = lambda a, b: round((b - a) * 1000)
print(f"DNS {ms(t0,t1)}ms / TCP {ms(t1,t2)}ms / 첫 바이트 {ms(t2,t3)}ms / 다운로드 {ms(t3,t4)}ms / 합계 {ms(t0,t4)}ms")
```

The values above are from running the code three times. "First byte" refers to the time from sending the request until the server returns its first character, so it includes both server processing time and round-trip latency. To separate these two, you need server-side logs or timing headers.

I also tried measuring up to TLS with HTTPS, but certificate validation errors on this PC prevented measuring that segment. I did not disable validation.

In a browser, you can see the same stages (DNS, connection, TLS, waiting, download) by clicking on a request in the Network tab of DevTools. This approach is more convenient than writing your own code.

</details>

## Common Misconceptions

- **Only fast server code matters:** Server processing is just one segment of the journey. DNS and connection delays upstream, CDN misses, or database issues downstream can often be larger bottlenecks.
- **Using a CDN always makes things faster:** It only helps if responses are cacheable; as shown above, adding another domain can sometimes slow things down.
- **Just enable caching:** Cached values can become stale, so you must also set when to discard them (TTL).
- **A load balancer means servers won't die:** If one server fails, others can take over, but if all servers slow down for the same reason, the load balancer cannot fix it.

When encountering a slow service, measure each segment in the order of the table above first. Suspecting the database based on intuition alone often leads to fixing the wrong thing. This per-segment measurement continues further in [observability](#/post/cloud-observability).

## Reference Links

- MDN, Understanding latency: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Understanding_latency
- MDN, CDN (Glossary): https://developer.mozilla.org/en-US/docs/Glossary/CDN
- web.dev, Time to First Byte (TTFB): https://web.dev/articles/ttfb
- AWS, What is Elastic Load Balancing?: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html
- AWS, What is DNS (Route 53): https://aws.amazon.com/route53/what-is-dns/

← [Concept map](#/post/infra-map)

Related posts: [Load Balancer](#/post/infra-load-balancer) · [CDN and Caching](#/post/infra-cdn-cache) · [Caching and Redis](#/post/db-cache-redis)