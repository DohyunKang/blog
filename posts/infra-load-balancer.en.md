A load balancer sits in front of multiple servers, distributing incoming requests and ensuring they are not sent to dead servers. This is why clients only need to know a single address even when the server count increases.

## What a Load Balancer Does

With a single server, the service dies immediately if that server goes down. With two servers, you must decide which server receives each request; this is the role of the load balancer. Its main functions are:

- Distributes requests across multiple servers.
- Checks server health and sends traffic only to healthy servers.

AWS documentation explains it similarly: a load balancer accepts client requests and forwards them to registered targets, continuously monitoring target status. If a target becomes unhealthy, traffic is stopped; once it recovers, traffic resumes. The full path a request takes through the service is detailed in [Request Journey →](#/post/infra-request-journey), while this section focuses solely on the load balancer component.

## L4 vs L7

Load balancers are categorized by their operating layer. If network layer names feel unfamiliar, you can first read [Network Basics →](#/post/cs-network).

| Category | L4 (Transport Layer) | L7 (Application Layer) |
|---|---|---|
| What it sees | IP, port, TCP connection | HTTP path, host, headers, cookies |
| Distribution unit | Single connection | Single request |
| Capabilities | Quickly distributes connections only | Rules like `/api` to server group A, `/img` to server group B |
| AWS name | Network Load Balancer | Application Load Balancer |

Based on AWS documentation, NLB selects targets using flow hash derived from protocol, source IP/port, destination IP/port, and TCP sequence number; once a TCP connection is established, it remains with the same target until completion. ALB evaluates listener rules in order of priority to determine which rule applies, then selects a target within that rule's target group. The default algorithm is round robin.

L7 can inspect request content, making it smarter but requiring more work. Rather than declaring one better than the other, the key question is whether you need to route by path. If simple connection distribution suffices, use L4; if address-based rules are needed, use L7.

## Distribution Algorithms

The algorithm determines how requests are distributed. The following summary follows the approach documented in nginx.

| Method | Behavior |
|---|---|
| Round Robin | Sends requests sequentially in a rotating order (default in nginx) |
| Weight | Assigns different quotas per server; e.g., `weight=3` means 3 out of every 5 requests go to that server |
| Least Connections | Sends requests to the server with the fewest active connections |
| IP Hash | Generates a hash based on client IP so the same user always reaches the same server |
| Least Time | Selects servers with shorter average response times and fewer connections |

Round robin works well when server performance and request weights are similar. Problems arise when request durations vary significantly: even if heavy requests pile up on one server, round robin remains unaware and simply follows the sequence.

### Self-Run Simulation

To visualize the differences, I created a simple simulation. Requests arrive at approximately 60 per second; 5% are heavy requests taking 1.5 seconds, while the rest take 0.02 seconds. Server #0 was configured to be four times slower than others. The maximum number of concurrent requests held by each server was observed.

<details>
<summary>Simulation code (run with Python for verification)</summary>

```python
import heapq, random, itertools

class RoundRobin:
    def __init__(self, n):
        self.cycle = itertools.cycle(range(n))
    def pick(self, active):
        return next(self.cycle)

class LeastConn:
    def pick(self, active):
        return min(range(len(active)), key=lambda i: active[i])

def simulate(lb, n_servers=3, n_req=3000, seed=1):
    rnd = random.Random(seed)
    active = [0] * n_servers
    done = []  # (finish_time, server)
    peak = [0] * n_servers
    t = 0.0
    for _ in range(n_req):
        t += rnd.expovariate(60)           # 초당 약 60개 도착
        while done and done[0][0] <= t:
            _, s = heapq.heappop(done)
            active[s] -= 1
        s = lb.pick(active)
        active[s] += 1
        peak[s] = max(peak[s], active[s])
        # 요청 처리 시간: 대부분 짧고 가끔 아주 김, 0번 서버는 4배 느림
        dur = (1.5 if rnd.random() < 0.05 else 0.02) * (4 if s == 0 else 1)
        heapq.heappush(done, (t + dur, s))
    return peak

print("round robin peak:", simulate(RoundRobin(3)))
print("least conn  peak:", simulate(LeastConn()))
```

</details>

The results were as follows:

```
round robin peak: [16, 7, 6]
least conn  peak: [7, 6, 6]
```

In round robin, up to 16 requests accumulated on the slow Server #0, whereas least connections capped at 7. Even among three identical servers, mixing in a slow one causes such divergence. Note that this is a toy model using arbitrarily chosen numbers, not actual service metrics; only the trend matters.

For reference, AWS Classic Load Balancer uses round robin for TCP listeners and least outstanding requests for HTTP/HTTPS listeners, as documented. Essentially, connection-count-based methods are the default for long-running requests.

## Health Checks

Even with perfect distribution, sending requests to dead servers is useless. Therefore, load balancers continuously check whether servers are alive. There are two approaches:

- Active: The load balancer periodically probes addresses like `/health` directly.
- Passive: Actual requests are sent; if they fail, the server is marked as unhealthy.

The information from the nginx open-source documentation describes a manual method. The `max_fails` parameter defines how many consecutive failures within the `fail_timeout` period should be considered as a server failure; the default value is 1. Setting `max_fails=3 fail_timeout=30s` means that if a server fails 3 times within 30 seconds, it will be removed from the pool for 30 seconds. After this time passes, the system gradually tests the server with actual client requests, and if successful, it is restored as being alive. A drawback of the manual method is that failed requests must still reach the user at least once.

Determining how far to check during health checks is a challenge. If you only verify whether the process is running, the server appears normal even if the database connection is lost. Conversely, checking up to the database can cause the entire server to drop when the database experiences an issue. Rather than declaring one approach definitively correct, this seems to be a problem that should be configured per service.

## Sticky Sessions

Problems arise if login states are kept in server memory. When a request moves from Server A to Server B, Server B does not recognize the user. The nginx documentation also notes that round-robin and least-connection methods do not guarantee that the same client will always go to the same server.

There are two solutions:

1. **Sticky sessions**: Continuously send the same user to the same server. Nginx's `ip_hash` directive achieves this, and according to the documentation, if a server becomes unavailable, other clients are routed elsewhere. AWS ALB also supports sticky session settings.
2. **Stateless servers**: Store sessions in an external storage like Redis so that any server can read the same information regardless of where the request is directed. See [Redis and Caching](#/post/db-cache-redis) for more details.

Sticky sessions are easy to implement but have side effects. Using IP hashing can cause many users behind a shared corporate IP to be concentrated on a single server, and if that server dies, all attached sessions are lost. If you frequently scale servers up or down, the stateless approach is preferable. This topic continues in [Auto-scaling and Scaling](#/post/infra-autoscaling).

## Deploying Across Multiple Zones

AWS documentation states that load balancer nodes are created for each Availability Zone (AZ). ALB requires at least two AZs to be enabled. In this scenario, enabling cross-zone balancing changes the distribution ratio. The documentation example shows a case with 2 targets in AZ A and 8 targets in AZ B.

| Setting | Each Target in AZ A | Each Target in AZ B |
|---|---|---|
| Cross-zone enabled | 10% | 10% |
| Cross-zone disabled | 25% | 6.25% |

When each node receives 50% of client traffic, disabling cross-zone balancing causes distribution only within the same zone, so servers in the zone with fewer targets receive more traffic. According to the documentation, ALB always has cross-zone balancing enabled at the load balancer level, while NLB has it disabled by default.

## Common Misconceptions

- It is easy to think that deploying a load balancer automatically provides high availability. However, if there is only one load balancer instance, it becomes a single point of failure. AWS mitigates this issue by distributing load balancer nodes across multiple AZs.
- It is easy to assume that round-robin distributes load evenly. While it balances the number of requests, it does not balance request weight. The simulation above illustrates this.
- Some believe that having a load balancer increases speed. It only enables using multiple servers; the processing time per request remains unchanged. Preventing traffic from skewing to one side can reduce slowdowns but does not inherently increase speed.
- Load balancers and rate limiting are separate concerns. Distributing requests is distinct from blocking excessive requests, which is covered in [Rate Limiting and Traffic Control](#/post/infra-rate-limit).

## Reference Links

- nginx, Using nginx as HTTP load balancer: https://nginx.org/en/docs/http/load_balancing.html
- AWS, How Elastic Load Balancing works: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html

← [Concept Map](#/post/infra-map)

Related posts: [The Journey of a Single Request](#/post/infra-request-journey) · [Auto-scaling and Scaling](#/post/infra-autoscaling) · [CDN and Caching Layers](#/post/infra-cdn-cache)