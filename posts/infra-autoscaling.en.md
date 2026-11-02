Auto-scaling is a mechanism that automatically adjusts the number or size of servers based on load. To run it effectively, two things come first: what metrics you use and whether your servers maintain state.

## What is scaling?

When people flock to a service, one server is no longer enough. There are two ways to scale up in this situation.

| | Vertical Scaling (scale up) | Horizontal Scaling (scale out) |
|---|---|---|
| Method | Replace a single server with a larger one | Increase the number of identical servers |
| Advantages | Requires minimal code changes | No practical limits; survives even if one node fails |
| Disadvantages | Limited by maximum size; requires downtime for replacement | Requires a load balancer to distribute requests and state synchronization between servers |

When people say "auto-scaling," they usually refer to horizontal scaling. Adding another server is easier to automate, while changing sizes often triggers a restart. The part about distributing requests across multiple servers is covered separately in [Load Balancers →](#/post/infra-load-balancer).

## What does "automatically scale" mean?

This is when a machine replaces a human watching a dashboard and adding servers. The process generally follows the same steps:

1. Measure metrics (e.g., CPU, request count).
2. Compare against target values.
3. Add more servers if needed, or remove them if capacity is sufficient.

AWS's target tracking documentation compares this to a thermostat: if you set a target average CPU of 50%, it scales up when usage rises above that threshold and scales down when it drops below. According to the docs, CloudWatch alarms are created and managed automatically by the service using this method.

Kubernetes' HPA (Horizontal Pod Autoscaler) follows the same concept. The formula from the official documentation is as follows:

```
원하는 개수 = ceil[ 현재 개수 × (현재 지표값 / 목표 지표값) ]
```

If you currently have 4 pods with an average CPU of 90% and a target of 50%, the calculation yields 4 × 1.8 = 7.2, which rounds up to 8 pods. The docs state that HPA performs this calculation every 15 seconds by default.

<details>
<summary>Detailed explanation: Running the formula in Python</summary>

The formula wasn't intuitive, so I implemented it in Python. `tol` represents a tolerance margin meaning "stay put if close to target," and 0.1 is the value I used.

```python
import math

def desired(cur, metric, target, tol=0.1):
    r = metric / target
    if abs(r - 1) <= tol:      # 목표 근처면 그대로
        return cur
    return math.ceil(cur * r)

print(desired(4, 90, 50))   # 8  (7.2를 올림)
print(desired(4, 52, 50))   # 4  (여유 구간 안이라 유지)
print(desired(10, 20, 50))  # 4  (줄이는 쪽도 같은 식)
print(desired(1, 60, 50))   # 2
```

The execution results were 8, 4, 4, 2. With rounding up, even a slight deficit triggers an additional pod. This reflects the principle that it's better to err on the side of having excess capacity rather than falling short.

</details>

## What metrics should we use for scaling?

Choosing the right metric is where many auto-scaling guides get stuck.

- **CPU Usage**: Most common. Suitable for compute-intensive servers, but may not rise on I/O-bound servers that wait for external responses, potentially masking slowness.
- **Request Count (per server)**: Intuitive for web services. AWS also provides `ALBRequestCountPerTarget` as a default metric per load balancer target.
- **Queue Length**: Suitable for workers processing tasks asynchronously. AWS docs advise against using raw message counts in SQS queues directly; instead, convert to messages per server. Simply scaling up servers doesn't guarantee proportional queue reduction. More on async processing and message queues is available [here →](#/post/be-async-queue).
- **Latency**: Directly reflects slowness, but AWS docs indicate it shouldn't be used for target tracking. While latency increases with load, it doesn't scale proportionally with the number of servers.

In simple terms, AWS's guideline is that metric values should decrease proportionally as you add more servers. Therefore, total request count from a load balancer won't work because it remains constant regardless of server count.

For Kubernetes, if you target CPU usage, the docs state that `requests` must be configured on containers. Without a request value, CPU usage cannot be calculated, and HPA will take no action based on that metric. Missing this detail often leads to confusion: "Why isn't it scaling?"

## Scaling down is more cautious than scaling up

It takes time for new servers to become ready. During this period, metrics remain high, potentially triggering another decision to scale up. This can lead to over-provisioning.

AWS handles this with a `warmup` period. Metrics from newly added servers are excluded from aggregation until warmup completes, and scaling-down actions are also disabled during this time. The goal, as stated in the docs, is "continue scaling but avoid over-scaling."

Scaling down works similarly. The docs note that target tracking scales down more slowly and applies conservative rounding to prevent rapid oscillations. For example, if you remove one server and load immediately exceeds the target again, this behavior avoids such fluctuations. This effect is especially pronounced in small groups.

<details>
<summary>Detailed explanation: Why small groups appear farther from target</summary>

The AWS documentation notes that with a small number of servers, the actual utilization rate may appear significantly different from the target value, so I verified this using numbers. Assuming a total load equivalent to 120% (two servers at 60% each) and setting the target at 50%:

- **Group of 2 servers**: 120 / 50 = 2.4 → rounds up to 3 servers. Dividing into 3 results in 40% per server, a 10%p difference from the target.
- **Group of 20 servers**: Total load 1200 / 50 = 24 servers. Each server is exactly at 50%.

Since we can only adjust in single-server increments, the impact of rounding up becomes more pronounced with fewer servers. In larger groups, each server represents a smaller proportion, so the actual utilization adheres better to the target.

</details>

## Why It's Problematic for Servers to Hold State

This is arguably the most critical part of this article. To freely scale servers up and down, the service must continue seamlessly regardless of which specific server disappears.

Let's assume user session information is stored in server memory. If a request moves from Server A to Server B, Server B will not recognize that user. The moment we reduce capacity and Server A disappears, that user gets logged out. Therefore, servers should be stateless, with state managed externally.

| Type of State | External Storage Location |
|---|---|
| Sessions, Temporary Values | Shared Cache (e.g., Redis) → [Details → Caching and Redis](#/post/db-cache-redis) |
| User Data | Database |
| Uploaded Files | Object Storage |
| Pending Processing Tasks | Message Queue |

With this setup, servers are identical replicas containing only code; the number of servers doesn't matter. New instances start working immediately upon launch, and there is nothing lost when an instance scales out. Whether to store sessions on the server or use tokens for authentication is covered in [Details → Authentication and Authorization](#/post/be-auth).

## What About the Database Without Servers?

Servers are easy to scale horizontally, but databases are not. Even if you scale up to dozens of servers, they all connect to the same database, shifting the bottleneck to the database itself. Methods like read replicas and sharding are documented separately in [Details → Database Scaling](#/post/db-scaling). One confirmation item established during this review is to calculate "how many connections scaled-out servers will hit per database" before applying auto-scaling.

## Common Misconceptions

- **Enabling auto-scaling handles traffic spikes automatically**: Servers take time to spin up, so they cannot respond instantly to sudden surges. Therefore, separate strategies are used, such as setting a generous minimum count or pre-reserving capacity. (Note: This point was derived from reasoning based on the warmup explanation above, rather than direct documentation review.)
- **Scaling up is sufficient**: Without scaling-down configurations, costs continue to accumulate. Conversely, AWS documentation states that you must set the minimum count to 0 for instances to scale down to zero when there are no requests.
- **Scaling servers alone makes things faster**: If the bottleneck lies in the database or external APIs, scaling servers yields no improvement.
- **Any metric works for scaling decisions**: The metric used must correlate proportionally with server count.
- **Returning 429 errors is enough when traffic is high**: Rate limiting and scaling are different defense mechanisms; they should be used together. → [Details → Rate Limiting](#/post/infra-rate-limit)

← Concept Map ([#/post/infra-map])

Related Articles: [The Journey of a Single Request](#/post/infra-request-journey) · [Load Balancer](#/post/infra-load-balancer) · [Caching and Redis](#/post/db-cache-redis)

## Reference Links

- Kubernetes, Horizontal Pod Autoscaling: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
- AWS, Target tracking scaling policies for Amazon EC2 Auto Scaling: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html