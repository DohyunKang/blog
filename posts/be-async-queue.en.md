Upon receiving a request, the basic pattern of asynchronous processing is not to finish everything immediately but to queue the tasks, respond first, and have workers handle them in the background. While this makes things easier, it brings the homework of retries and duplicates.

## Synchronous vs Asynchronous

Taking user registration as an example, the tasks involved are: saving to the database, sending a welcome email, and updating statistics. If all these are done sequentially within the request, it's synchronous processing. If the mail server is 3 seconds slow, the user waits 3 seconds; if the mail server dies, the registration itself fails.

Asynchronous processing divides this into "save to DB and respond, send the email later." Tasks for later must be recorded somewhere, and that place is the queue. The request flow itself is summarized in [the request processing flow](#/post/be-request-flow).

| | Synchronous | Asynchronous |
|---|---|---|
| Response timing | After all tasks are complete | After accepting the task |
| Slow external services | User waits along with the service | Worker waits separately |
| On failure | User sees error immediately | User is unaware; system must retry |
| Result verification | Included in response | Must be checked via status query or notification |

The last row is surprisingly cumbersome. If you just accept and finish, you need a separate way to inform the user "Has it been processed?"

## What is a Message Queue?

A message queue is a line that connects the sender (producer) and receiver (consumer, commonly called a worker). The producer ends its job once it puts a message into the queue, and the worker picks up and processes messages at its own pace. Since they don't need to know about each other directly, it's also used to reduce [coupling and cohesion](#/post/be-coupling-cohesion).

```
API 서버 --(메시지 넣기)--> [ 큐 ] --(꺼내기)--> 워커 1
                                      └-------> 워커 2
```

- Even if traffic surges all at once, the queue acts as a buffer. If workers can't keep up, the queue just gets longer; the server doesn't crash immediately.
- Increasing workers increases throughput. You can scale the API server and workers separately.
- Even if a worker dies temporarily, messages remain in the queue.

Typical implementations include RabbitMQ, Amazon SQS, Kafka, and others. This article is written based on the behaviors confirmed in the documents for the first two. Kafka has a different structure (log-based) and is not covered here.

## How Workers Consume Messages

This is the core part. If a worker deletes a message from the queue immediately upon receiving it, the message disappears if the worker dies during processing. Therefore, queues distinguish between "received" and "finished."

RabbitMQ, in manual ack mode, requires the worker to send an `ack` after finishing processing for the message to be discarded. Sending `nack` or `reject` causes the message to be requeued based on the `requeue` option, sent to a dead-letter exchange if configured, or discarded if not. If the connection breaks without an ack, that message automatically re-enters the queue, and redelivered messages are marked with `redeliver`. In automatic ack mode, delivery is assumed upon sending; thus, if the connection breaks before processing, the message is lost. The documentation also notes this mode is unsafe for many use cases.

SQS works a bit differently. Upon receiving a message, it's not deleted from the queue but becomes invisible to other workers for a certain period. This duration is the visibility timeout, with a default of 30 seconds. If the worker doesn't delete it via `DeleteMessage` within this time, the message becomes visible again and is picked up by either the same or another worker. For long-running processes, you can extend the time using `ChangeMessageVisibility`, but there's a limit of 12 hours.

Despite different names, the structure is the same: the queue holds the message until confirmation that it's done; without confirmation, it gives it back.

## So Duplicates Occur

One unavoidable thing happens in this structure. Suppose a worker sends an email and dies just before sending the ack. From the queue's perspective, there's no way to know if processing was complete, so it reissues the message. Another worker receives and sends the same email again.

The SQS documentation explicitly states that even with visibility timeouts, it's an at-least-once delivery model, meaning the same message can arrive more than once. RabbitMQ documentation doesn't use the phrase "at-least-once," but since redelivery occurs, it implies consumers must be idempotent. In other words, instead of expecting "exactly once" from the queue, the usual approach is to design for "since it comes at least once, let's make sure handling twice is fine."

## Idempotency

Idempotency is the property where performing the same request multiple times yields the same result as doing it once. `balance = 100` remains 100 regardless of how many times it's executed, but `balance += 100` changes each time. If a worker must perform such an operation, it must separately record that processing has occurred once.

The way the Stripe API handles this is easy to understand. If a client sends an `Idempotency-Key`, the server stores the status code and body of the first request, and returns the stored response unchanged for any subsequent retries with the same key. The key can be up to 255 characters long, and using a random string like a UUID v4 is recommended. Keys older than 24 hours (based on version 1) may be deleted, and if parameters differ for the same key, an error is returned. Although this is about external APIs, you can apply the same approach within queue workers by using the message ID as the key.

[APIs and REST](#/post/be-api-rest) summarizes that GET requests are originally idempotent, while POST requests are not. However, if POST requests occur in an environment where retries are possible, such keys become necessary.

## Retries and Dead Letter Queues

If an error occurs during processing, the task is retried. However, immediately retrying without delay can further burden already struggling external services, so exponential backoff with increasing intervals is often used. While transient failures are resolved by retries, messages that are fundamentally broken will not succeed no matter how many times they are retried.

Therefore, a retry limit is set; once exceeded, the message is moved to a separate queue known as a Dead Letter Queue (DLQ). In SQS, the `maxReceiveCount` in the redrive policy determines "how many times a consumer receives this message before it is moved to the DLQ." The documentation advises against setting this value too low (e.g., 1), as a single failure would immediately move the message to the DLQ, leaving no room for retries; thus, the value should be increased accordingly. Messages accumulated in the DLQ should have their causes analyzed via logs or be fixed and then redriven back to the original queue. It is also recommended to set the retention period for the DLQ longer than that of the original queue. There is a warning that using a DLQ with FIFO queues may disrupt message ordering.

Having a DLQ alone is not sufficient; you must also configure notifications to alert when messages accumulate. This leads into the next section on [Error Handling and Logging](#/post/be-error-logging).

## Example Implementation

I implemented a simplified code example to demonstrate the concept. The queue uses `deque`, the worker consists of a single loop, and email sending fails with a 30% probability. A message with the same ID (m3) was intentionally added twice.

<details>
<summary>Code and Results (verified by running in Python)</summary>

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

The execution results were as follows:

```
sent 10 unique 10
dlq []
```

Eleven messages (one of which was a duplicate) were inserted, resulting in 10 emails sent to 10 recipients. Failed messages encountered in the middle were appended to the back and retried. The duplicate m3 was skipped because its ID was present in `done`. Due to the seed value, there were no messages that failed three consecutive times this time, so the DLQ remained empty. If the failure probability were increased, you would also see messages entering the DLQ, but I did not test that scenario.

This code is for conceptual demonstration only. Since `done` resides in memory, it disappears if the worker dies. Additionally, since "sending email" and "recording to done" are not part of a single transaction, duplicates can still occur if the process dies between these steps. In practice, you would store `done` in a database and use unique constraints to prevent duplicates.

</details>

## Common Misconceptions

- **Using a queue ensures messages are processed exactly once:** As shown above, processing at least once is the baseline.
- **Queues guarantee message ordering:** Some queues, like standard SQS queues, do not guarantee order; FIFO queues maintain order only within message group IDs. You must verify the queue type if ordering is required.
- **Switching to asynchronous execution always speeds things up:** While user-perceived wait time decreases, overall throughput does not necessarily increase. If workers cannot keep up, the queue simply grows longer.
- **Queues should always be used:** Synchronous processing is better for tasks where results are needed immediately or for simple services. Handling retries, duplicate processing, and status verification directly increases complexity.

← [Concept Map](#/post/be-map)

Related articles: [Request Processing Flow](#/post/be-request-flow) / [Modular Cohesion and Coupling](#/post/be-coupling-cohesion) / [Error Handling and Logging](#/post/be-error-logging)

## Reference Links
- Amazon SQS visibility timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- Amazon SQS dead-letter queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- RabbitMQ Consumer Acknowledgements: https://www.rabbitmq.com/docs/confirms
- Stripe Idempotent requests: https://docs.stripe.com/api/idempotent_requests