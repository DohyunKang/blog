负载均衡器（Load Balancer）是一种部署在多台服务器之前的设备，它负责分发传入的请求，并防止将请求发送到已宕机的服务器。这就是为什么即使增加服务器数量，客户端也只需记住一个地址的原因。

## 负载均衡器的工作内容

如果只有一台服务器，那么一旦该服务器宕机，服务也会随之停止。当扩展到两台服务器时，就需要决定将请求分发到哪一台。承担这一角色的就是负载均衡器。它的主要工作可以概括为两点：

- 将请求分发到多台服务器；
- 检查服务器状态，仅将请求转发给健康的服务器。

AWS 文档也采用了类似的解释方式：负载均衡器接收客户端请求并将其发送到注册的目标（target），持续监控目标状态，若发现异常则切断流量，待恢复正常后再重新发送。关于请求在服务整体中的流转路径，已在 [详细 → 单个请求的旅程](#/post/infra-request-journey) 中整理；本文档仅聚焦其中的负载均衡器部分。

## L4 与 L7

负载均衡器可根据其工作层级进行分类。如果对网络层名称感到陌生，可先阅读 [详解 → 网络基础](#/post/cs-network)。

| 分类 | L4（传输层） | L7（应用层） |
|---|---|---|
| 观察内容 | IP、端口、TCP 连接 | HTTP 路径、主机名、头部、Cookie |
| 分发单位 | 单个连接 | 单个请求 |
| 功能能力 | 仅快速进行连接分发 | 可基于规则如 `/api` 路由至 A 服务器组、`/img` 路由至 B 服务器组等 |
| AWS 名称 | Network Load Balancer (NLB) | Application Load Balancer (ALB) |

根据 AWS 文档，NLB 通过协议、源 IP·端口、目的 IP·端口以及 TCP 序列号生成 flow hash 来选择目标，且一旦建立 TCP 连接，该连接将持续指向同一目标直至结束。ALB 则按优先级评估监听器规则以确定使用哪条规则，并在该规则对应的目标组内选择具体目标；默认算法为轮询（Round Robin）。

L7 能够读取请求内容，因此更“智能”，但也因此承担更多工作。与其争论哪种更好，不如以是否需要按路径划分服务器作为判断标准：若仅需快速分发连接，则选用 L4；若需基于地址规则进行分发，则选用 L7。

## 分发算法

请求如何分发由算法决定。以下整理基于 nginx 文档中介绍的方式。

| 方式 | 行为 |
|---|---|
| 轮询（Round Robin） | 按顺序依次转发；为 nginx 默认值 |
| 权重（Weight） | 为每台服务器分配不同份额；例如 `weight=3` 表示在 5 次请求中有 3 次会发往该服务器 |
| 最少连接（least_conn） | 将请求发送至当前正在处理的连接数最少的服务器 |
| IP 哈希（ip_hash） | 基于客户端 IP 生成哈希值，确保同一用户始终访问同一台服务器 |
| 最少时间（least_time） | 选择平均响应时间短且连接数较少的服务器 |

轮询算法简单，适用于服务器性能和请求负载相近的场景。问题出现在每次请求处理时间差异较大时：即使某台服务器承载了大量耗时较长的请求，轮询算法仍会无视这一点，仅机械地按顺序转发。

### 自行模拟验证

为了直观观察差异，我构建了一个极简的模拟程序。设定每秒约 60 个请求进入系统，其中 5% 为耗时 1.5 秒的重请求，其余为耗时 0.02 秒的轻请求。服务器 0 被设置为比其他服务器慢 4 倍。我们记录每台服务器同时持有的最大请求数。

<details>
<summary>模拟代码（使用 Python 运行验证）</summary>

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

结果如下：

```
round robin peak: [16, 7, 6]
least conn  peak: [7, 6, 6]
```

在轮询模式下，较慢的 0 号服务器积压了多达 16 个请求；而最少连接模式则将其限制在 7 个。三台性能相同的服务器中，一旦混入慢速服务器，情况便会如此分化。不过这只是基于我任意设定的数值运行的玩具模型，并非真实服务数据，仅用于说明趋势。

顺便提及，AWS Classic Load Balancer 的 TCP 监听器采用轮询算法，而 HTTP/HTTPS 监听器则使用“最少进行中请求”（least outstanding requests）策略；文档表明，对于耗时较长的请求，默认会采用基于连接数的判断方式。

## 健康检查

无论分发多么均衡，若将请求发送至已宕机的服务器也无济于事。因此，负载均衡器需持续监控服务器是否存活。其实现方式分为两类：

- **主动（active）**：负载均衡器定期主动探测如 `/health` 等地址；
- **被动（passive）**：通过实际发送请求并观察失败情况来标记服务器为异常。

Nginx 开源文档中描述的是手动方式。`max_fails` 用于设定在 `fail_timeout` 时间内连续失败多少次后判定服务器为不可用，默认值为 1。若设置为 `max_fails=3 fail_timeout=30s`，则意味着在 30 秒内发生 3 次失败时，将该服务器剔除 30 秒。超时后，Nginx 会通过少量实际客户端请求进行测试，若测试成功则将其恢复为可用状态。手动方式的弊端在于，失败的请求至少有一次会到达用户端。

健康检查地址的检查范围也是需要考虑的问题：仅检查进程是否存活，即使数据库断开也会显示正常；而若同时检查数据库，则在数据库出现波动时可能导致整个服务器瞬间不可用。与其强行断定哪种方式正确，不如将其视为需根据具体服务特点自行决定的问题。

## 会话保持

如果将登录状态保存在服务器内存中，就会出现问题。当请求从 A 服务器转发到 B 服务器时，B 服务器并不认识该用户。Nginx 文档也指出，轮询（round-robin）和最少连接（least connections）算法并不能保证同一客户端始终访问同一台服务器。

解决方案有两种：

1. **会话保持（sticky session）**：将同一用户持续引导至同一台服务器。Nginx 的 `ip_hash` 模块可实现此功能；根据文档，若排除该服务器无法使用的情况，同一客户端也会访问同一台服务器。AWS ALB 也支持 sticky 设置。
2. **无状态化服务器**：将会话存储到 Redis 等外部存储中，无论请求到达哪台服务器，均可读取相同的信息。[详情 → Redis 与缓存](#/post/db-cache-redis)。

会话保持虽简单，但存在副作用。使用 IP Hash 时，同一公司公用 IP 后的众多用户可能被集中转发至同一台服务器；若该服务器宕机，其上的所有会话将丢失。若频繁进行服务器的扩容或缩容，无状态化方案更为合适。相关内容在 [详情 → 自动伸缩与扩展](#/post/infra-autoscaling) 中继续讨论。

## 跨可用区部署时

AWS 文档指出，每个可用区（AZ）都会生成一个负载均衡器节点。ALB 必须启用至少两个可用区。此时，开启 cross-zone 设置会改变流量分发比例。文档示例为：A 可用区有 2 个后端目标，B 可用区有 8 个后端目标。

| 设置 | A 可用区每个目标 | B 可用区每个目标 |
|---|---|---|
| 开启 cross-zone | 10% | 10% |
| 关闭 cross-zone | 25% | 6.25% |

在各节点均接收客户端流量 50% 的状态下，若关闭 cross-zone，则仅在各自可用区内进行分配，因此后端目标较少的可用区中的服务器会承受更多流量。根据文档，ALB 在负载均衡器层面默认始终开启 cross-zone，而 NLB 默认是关闭的。

## 常见误解

- 容易误以为部署了负载均衡器就自动具备了高可用性。若负载均衡器本身只有一台，它便构成了单点故障。AWS 通过将负载均衡器节点分布在多个可用区来缓解此问题。
- 容易误以为轮询算法就能实现均匀负载分配。虽然它能平均分配请求数量，但无法均衡请求权重。上述模拟即为此例。
- 也容易误以为有了负载均衡器速度就会变快。它仅使多服务器成为可能，单个请求的处理时间并未改变。若能防止流量倾斜，确实可降低响应延迟。
- 负载均衡器与限流是两回事。分配请求与限制过多请求属于不同范畴，后者在 [详情 → 限流与流量控制](#/post/infra-rate-limit) 中详细讨论。

## 参考链接

- nginx, Using nginx as HTTP load balancer: https://nginx.org/en/docs/http/load_balancing.html
- AWS, How Elastic Load Balancing works: https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html

← [概念 map](#/post/infra-map)

相关文章：[单个请求的流转路径](#/post/infra-request-journey) · [自动伸缩与扩展](#/post/infra-autoscaling) · [CDN 与缓存层级](#/post/infra-cdn-cache)