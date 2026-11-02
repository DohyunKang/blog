You may have managed to get the server running, but knowing whether it's actually working properly afterward requires additional preparation. That preparation involves monitoring, logging, and alerting.

## Three Signals

The information extractable from an operating system can be broadly categorized into three types. The OpenTelemetry documentation also refers to this same trio as signals (signal).

| Signal | One-line Definition | Question It Answers |
|---|---|---|
| Metrics | Numbers recorded over time (request count, error rate, memory usage) | What is the current state? Is it different from usual? |
| Logs | Records of individual events that occurred | What happened at that time? |
| Traces | The path a single request took through multiple services | Where did it slow down? Where did it fail? |

OpenTelemetry describes traces as "the path of requests passing through an application," metrics as "values measured at runtime," and logs as "records of events."

Typically, the order is as follows: metrics graphs alert you first to anomalies, then traces narrow down the scope, and finally, logs reveal the root cause sentence. Numbers are cheap and fast but lack context; logs provide reasons but are voluminous and hard to sift through. Therefore, we don't rely on just one; instead, we use all three together.

## Metrics: What to Watch

There are too many things to watch, so a benchmark is needed. Google's SRE book's "Four Golden Signals" are the most frequently cited.

| Signal | Meaning |
|---|---|
| Latency | The time taken to process a single request. Success and failure are viewed separately. |
| Traffic | The volume of incoming requests to the system (e.g., requests per second). |
| Errors | The ratio of failed requests. This includes not just 500 errors, but also cases where the response is 200 but the content is incorrect, or failures due to excessive slowness. |
| Saturation | How full the most constrained resource has become. |

The reason for viewing failures separately is that quickly failing requests can lower average latency, making the situation appear better than it is. Many systems degrade in performance before reaching 100% saturation, so a target utilization rate should be set.

### Percentiles Instead of Averages

Latency is misleading when viewed as an average. The code below simulates a scenario where 980 out of 1,000 requests take around 100ms, while 20 take 3 seconds.

```python
import random
lat = sorted([random.gauss(100, 20) for _ in range(980)] + [3000] * 20)
avg = sum(lat) / len(lat)
p50 = lat[len(lat) // 2]
p99 = lat[int(len(lat) * 0.99) - 1]
print(round(avg), round(p50), round(p99))   # 실행 결과 예: 156 99 3000
```

The average is 156ms, which seems fine, but p99 is 3,000ms. This means one out of every 50 requests waited 3 seconds. p50 represents the median, and p99 indicates that 99% of requests completed within this time. Latency alerts should be based on tail values like p95 or p99 rather than averages.

## Logs: From Human-Readable to Machine-Searchable

If logs are left as plain text strings like `print("Error occurred")`, they become unsearchable later. Nowadays, structured formats like JSON are used, and each request is assigned an ID. Where to catch errors and what to retain is covered separately in [detailed → Error Handling and Logging](#/post/be-error-logging).

```python
import json, time, uuid

def log(level, msg, **kw):
    print(json.dumps({"ts": round(time.time(), 3), "level": level,
                      "msg": msg, **kw}, ensure_ascii=False))

rid = "req-" + uuid.uuid4().hex[:6]
log("info", "order created", request_id=rid, user_id=42, took_ms=120)
log("error", "payment failed", request_id=rid, upstream="pay-api", took_ms=3000)
```

Executing this outputs one JSON object per line. Searching by `request_id` allows you to collect and view only the traces of a single request. If services are split into multiple components, this ID must be passed between services, which is the fundamental concept behind tracing.

Three things to watch out for in logs:

- Do not log passwords, tokens, keys, or personal information. Once entered into logs, they get replicated across multiple locations. Key management is covered in [detailed → Secrets and Environment Variables Management](#/post/cloud-secrets).
- Distinguish levels. Normal flow should be `info`, while issues meant for human review should be `error`. Logging everything as `error` will bury real errors.
- Monitor volume. Logs directly translate to storage costs and search expenses, which equate to money. If you log the entire body for every request, your bill will reflect it immediately.

## Traces: A Map for a Single Request

A trace records how long each segment (span) took by dividing a single request into multiple segments. For example, if an API server calls a database and then an external payment API, approximately three spans are created, making it immediately clear which part was slow. In services composed of a single server, logs and metrics usually suffice; however, the value of traces increases significantly when services are split across multiple components or when serverless functions are chained together. More about serverless can be found in [detailed → Serverless](#/post/cloud-serverless).

OpenTelemetry is a vendor-neutral project that standardizes methods for collecting these three signals. A key advantage is that once instrumentation is embedded in an application, you can change the destination (storage or dashboard) without modifying the application code.

<details>
<summary>Two Collection Methods (Collapsed)</summary>

- Pull: The monitoring server periodically visits the application's metric endpoints to read data. Prometheus is a representative example.
- Push: The application or agent directly sends collected data to the collection server. This approach is more natural for short-lived tasks or serverless environments.

Regardless of the approach, apps typically only "expose numbers," while separate tools handle storage, graphing, and notifications.
</details>

## Notification Design

The hardest part of monitoring is not data collection but notification. Too many notifications lead to them being ignored; too few mean users report outages before you do.

Google SRE books and Prometheus documentation share similar advice:

- Notify on symptoms, not causes. "Error rate surge, slow response" is a real user problem, whereas "CPU 90%" might not be if the user isn't affected. High CPU usage alone doesn't warrant an urgent alert if users aren't impacted.
- Trigger calls (pages) only for urgent situations requiring human intervention. The SRE book states that tasks suitable for mechanical processing should not result in a call.
- Email alerts tend to become noise when piled up; it's recommended to view non-urgent issues on dashboards instead.
- Alerts should be minimal and targeted at where users are suffering. Include links to relevant dashboards so the specific component causing the issue can be immediately identified.
- Allow room for temporary fluctuations by setting conditions that must persist for a certain duration before triggering an alert.
- Notify when capacity approaches limits, even if there's no immediate user impact, as this will soon lead to an outage.
- For batch jobs, base decisions on time intervals spanning multiple execution cycles. If one failure doesn't require human intervention, it's better to run the job more frequently.

The same documents also advise monitoring the monitoring system itself. A dead notification server isn't silent; it's blind. Therefore, a separate blackbox check that probes external services is recommended.

| Category | Whitebox | Blackbox |
|---|---|---|
| Observation Point | System internals (metrics, logs) | External behavior visible to users |
| Strength | Detects imminent issues, retries hiding failures, aids debugging | Reflects what is actually broken right now |
| Weakness | Internal metrics generate noise | Cannot predict issues that haven't occurred yet |

Using both is common practice; calls are typically directed toward blackbox and symptom-based alerts.

## Basic Steps When an Outage Occurs

Incident response prioritizes minimizing damage over finding the cause immediately. The following steps reflect general operational procedures rather than specific documentation, so they may vary by team.

1. **Impact Assessment**: Determine who is affected, to what extent, and since when.
2. **Recent Changes Check**: If a recent deployment or configuration change occurred, reverting is often the fastest solution. Deployment-related details can be found in [CI/CD](#/post/cloud-cicd).
3. **Mitigation**: Rollback, reduce traffic, or scale up instances. Root cause analysis can follow later.
4. **Root Cause Analysis**: Pinpoint the timeframe using metrics, narrow down the segment with traces, and locate specific log entries.
5. **Post-Incident Review**: Improve notifications, tests, and documentation to prevent recurrence. Write reports focused on structural fixes rather than blaming individuals.

Scaling instances is covered separately in [Auto-scaling](#/post/infra-autoscaling).

## Common Misconceptions

- Monitoring and observability are not the same. Monitoring involves observing predefined metrics, whereas observability refers to the ability to explain previously unseen problems by digging into signals. Note that definitions vary slightly across documents; this article adopts a general approach.
- Creating more metrics isn't always better. Graphs no one views only incur costs.
- Having dashboards doesn't eliminate the need for alerts. Humans don't watch screens 24/7.
- Assuming an average latency is acceptable means the service is fine is contradicted by the code example above.
- The belief that more alerts equal safety is also incorrect. If every alert is ignored immediately, it's equivalent to having no alerts at all.

← Concept map: ([Cloud Map](#/post/cloud-map))

Related articles: [Error Handling and Logging](#/post/be-error-logging) · [CI/CD](#/post/cloud-cicd) · [Auto-scaling](#/post/infra-autoscaling)

## Reference Links

- OpenTelemetry, Signals: https://opentelemetry.io/docs/concepts/signals/
- Google SRE Book, Monitoring Distributed Systems: https://sre.google/sre-book/monitoring-distributed-systems/
- Prometheus, Alerting practices: https://prometheus.io/docs/practices/alerting/