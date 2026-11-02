收到请求后，不要试图立即完成所有任务，而是将待办事项写入队列，先返回响应，再由后台的 Worker 进行处理，这才是异步处理的基本形态。虽然这样做更便捷，但随之而来的挑战是重试和重复执行。

## 同步与异步

以用户注册为例，需要完成的任务如下：保存至数据库、发送欢迎邮件、更新统计数据。如果全部在请求内按顺序执行，那就是同步处理。如果邮件服务器延迟 3 秒，用户也要等待 3 秒；如果邮件服务器宕机，整个注册就会失败。

异步处理则是将任务拆分为"仅保存 DB 并响应，邮件稍后发送”。稍后要做的任务需要记录在某个地方，这个地方就是队列。请求本身的流程已在 [请求处理流程](#/post/be-request-flow) 中整理过。

| | 同步 | 异步 |
|---|---|---|
| 响应时机 | 所有任务完成后 | 接收请求后 |
| 缓慢的外部服务 | 用户需一同等待 | 由 Worker 单独等待 |
| 失败时 | 用户立即看到错误 | 用户不知情，系统需重试 |
| 结果确认 | 包含在响应中 | 需通过状态查询或通知另行告知 |

最后一行尤其令人头疼。如果只完成接收就结束，就需要额外的方法来告知用户“是否已处理”。

## 消息队列是什么

消息队列是一条连接发送方（生产者）和接收方（消费者，通常称为 Worker）的纽带。生产者将消息放入队列后即告完成，Worker 则按自己的速度取出并处理。由于双方无需直接通信，因此也用于降低 [模块耦合度](#/post/be-coupling-cohesion)。

```
API 서버 --(메시지 넣기)--> [ 큐 ] --(꺼내기)--> 워커 1
                                      └-------> 워커 2
```

- 即使流量瞬间激增，队列也能起到缓冲作用。如果 Worker 处理不过来，队列只会变长，而不会导致服务器立即崩溃。
- 增加 Worker 数量可以提升吞吐量。可以独立于 API 服务器扩展 Worker。
- 即使 Worker 短暂宕机，消息仍保留在队列中。

典型的实现包括 RabbitMQ、Amazon SQS、Kafka 等。本文基于前文文档中确认的行为进行阐述。由于 Kafka 的结构不同（基于日志），此处不予讨论。

## Worker 获取消息的方式

这是核心所在。如果 Worker 一收到消息就立即从队列中删除，那么在处理过程中若 Worker 宕机，消息就会丢失。因此，队列需要区分“已接收”和“已完成”。

RabbitMQ 在手动 ack 模式下，Worker 必须在处理完成后发送 `ack` 才能丢弃消息。如果发送 `nack` 或 `reject`，则根据 `requeue` 选项决定是重新入队，还是发送到配置的死信交换机（若未设置则丢弃）。如果在没有发送 ack 的情况下连接断开，该消息会自动重新入队，且重传的消息会标记为 `redeliver`。自动 ack 模式在发送瞬间即视为已传递，因此若在处理前连接断开，就会丢失消息。文档也指出此模式对许多用途不安全。

SQS 的机制略有不同。收到消息后，它不会立即从队列中删除，而只是在一定时间内对其他 Worker 不可见。这段时间称为可见性超时（Visibility Timeout），默认值为 30 秒。如果 Worker 在此时间内未通过 `DeleteMessage` 删除消息，消息将重新可见，并由同一 Worker 或其他 Worker 再次领取。如果处理耗时较长，可使用 `ChangeMessageVisibility` 延长该时间，但上限为 12 小时。

尽管名称不同，其结构本质相同：在确认完成之前，队列持有消息；若未收到确认，则重新返回。

## 因此产生了重复执行

在上述架构中，有一件事是无法避免的。假设 Worker 已发送邮件，但在发送 ack 之前宕机了。从队列的角度来看，它无法判断任务是否已完成，于是会再次投递。另一个 Worker 将再次收到并处理同一封邮件。

SQS 文档明确指出，即使存在可见性超时，其也是“至少一次”（at-least-once）投递模型，因此同一条消息可能会多次到达。RabbitMQ 文档虽未直接使用"at-least-once"一词，但通过重传机制表达了相同的意思：消费者必须具备幂等性。也就是说，通常的做法不是期望队列能“恰好一次”，而是设计成“既然至少会来一次，那就让它即使来两次也没关系”。

## 幂等性

幂等性是指无论执行多少次相同的请求，其结果都与执行一次时相同。例如 `balance = 100` 无论执行多少次，余额始终是 100；而 `balance += 100` 则每次执行都会改变结果。如果 Worker 需要执行类似后者的操作，就必须单独记录已处理一次的凭证。

Stripe API 的实现方式很容易理解。如果客户端在请求中指定并发送 `Idempotency-Key`，服务器会保存首次请求的状态码和正文；对于相同键的重试请求，服务器将直接返回之前保存的响应。该键的最大长度为 255 个字符，推荐使用类似 UUID v4 的随机字符串。基于 v1 版本，超过 24 小时的键可能会被删除；如果相同的键对应不同的参数，则会抛出错误。虽然这是关于外部 API 的内容，但在队列工作器中也可以将消息 ID 作为键来采用同样的做法。

在 [API 与 REST](#/post/be-api-rest) 一节中我们总结过：GET 原本就是幂等的，而 POST 则不是；但如果 POST 请求处于可重试的环境中，就需要这样的键。

## 重试与死信队列

处理过程中如果发生错误，会进行重试。不过，如果立即连续重试，只会让已经不堪重负的外部服务雪上加霜，因此通常会采用逐渐增加间隔的指数退避策略。临时性故障可以通过重试解决，但如果消息本身已损坏，无论重试多少次都无法成功。

因此需要设置重试次数限制，一旦超过限制就将消息转移到专门的队列中，这就是死信队列（DLQ）。在 SQS 中，`redrive policy` 的 `maxReceiveCount` 属性用于设定“消费者接收该消息多少次后将其移至 DLQ"。文档指出，如果将该值设得太低（例如 1），消息一旦失败就会立即进入 DLQ，从而失去了重试的机会，因此应适当调高该值。对于已堆积在 DLQ 中的消息，需要查看日志分析原因，修复问题后再通过 redrive 将其移回原队列。也有建议指出，DLQ 的保留期限应比原队列更长。此外，如果在 FIFO 队列中使用 DLQ，可能会导致顺序混乱，需注意这一点。

仅拥有 DLQ 是不够的，还需要在消息堆积时触发通知。接下来的部分将接续 [错误处理与日志记录](#/post/be-error-logging)。

## 亲自测试的示例

下面通过代码简化演示了这一概念：使用 deque 作为队列，用一个循环模拟工作器，邮件发送过程被设定为有 30% 的概率失败。我们还特意向队列中插入了两条相同 id 的消息（m3）。

<details>
<summary>代码与结果（已用 Python 运行验证）</summary>

```python
import random
from collections import deque

random.seed(1)
queue = deque()
dlq = []
done = set()       # 처리 끝낸 메시지 id (멱등성 키)
sent_mail = []     # 부수효과

def send_mail(msg):
    # 30% 확률로 일시 실패
    if random.random() < 0.3:
        raise RuntimeError("smtp timeout")
    sent_mail.append(msg["to"])

def handle(msg):
    if msg["id"] in done:        # 이미 처리한 id면 건너뜀
        return
    send_mail(msg)
    done.add(msg["id"])

MAX = 3
for i in range(10):
    queue.append({"id": f"m{i}", "to": f"user{i}", "tries": 0})
queue.append({"id": "m3", "to": "user3", "tries": 0})  # 중복 발행

while queue:
    msg = queue.popleft()
    try:
        handle(msg)
    except Exception:
        msg["tries"] += 1
        if msg["tries"] >= MAX:
            dlq.append(msg["id"])
        else:
            queue.append(msg)

print("sent", len(sent_mail), "unique", len(set(sent_mail)))
print("dlq", dlq)
```

运行结果如下：

```
sent 10 unique 10
dlq []
```

共插入了 11 条消息（其中一条为重复），最终发送了 10 封邮件，收件人为 10 人。中间失败的消息被重新排到队尾进行重试；对于重复的 m3 消息，由于 `done` 中已存在其 id，因此被跳过。由于本次测试中未出现连续三次失败的记录（受种子值影响），DLQ 保持为空。如果提高失败概率，应该也能观察到有消息进入 DLQ，但我们并未进行此类测试。

这段代码仅用于概念演示：`done` 存储在内存中，一旦工作器崩溃数据就会丢失；而且“发送邮件”与“写入 done"并非在同一事务中完成，若在此期间工作器崩溃，仍可能导致重复处理。在实际应用中，应将 `done` 存入数据库，并利用唯一性约束来防止重复。

</details>

## 常见误解

- **使用队列就能保证消息只被处理一次**：如上所述，至少处理一次是基本前提。
- **有队列就保证顺序**：像 SQS 标准队列那样并不保证顺序；FIFO 队列仅在消息组 ID 级别上保证顺序。必要时需确认所使用的队列类型。
- **改为异步就一定更快**：虽然减少了用户等待时间，但整体吞吐量未必提升。如果工作器跟不上处理速度，只会让队列越来越长。
- **所有场景都必须使用队列**：对于需要立即返回结果或逻辑简单的服务，同步方式可能更合适。若采用队列，还需自行处理重试、去重和状态检查等事宜，系统复杂度会随之增加。

← [概念映射图](#/post/be-map)

相关文章：[请求处理流程](#/post/be-request-flow) / [模块内聚与耦合](#/post/be-coupling-cohesion) / [错误处理与日志记录](#/post/be-error-logging)

## 参考链接
- Amazon SQS visibility timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- Amazon SQS dead-letter queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- RabbitMQ Consumer Acknowledgements: https://www.rabbitmq.com/docs/confirms
- Stripe Idempotent requests: https://docs.stripe.com/api/idempotent_requests