In the backend, we don't eliminate errors; instead, we categorize them based on "who needs to know about the error" and handle each category accordingly. The result of this categorization is error responses and logs.

## What is Error Handling?

When a server receives a request, it performs a series of operations such as input validation, database queries, and external API calls. Failure can occur at any stage. Error handling defines how the server should behave when something fails. There are three main aspects to decide:

- What to return to the caller (error response)
- Whether to retry or give up
- What to log for later troubleshooting

The path a request takes through the server is described in detail in [Request Processing Flow](#/post/be-request-flow). You can think of errors as potentially surfacing anywhere along that path.

## Criteria for Categorizing Exceptions

If all errors are thrown as a single `Exception`, there's no way to distinguish them at higher levels. Therefore, we categorize them. The two criteria I found most useful are:

| Criterion | Examples | Typical Handling |
|---|---|---|
| Client Error | Invalid input format, missing resource, unauthorized access | Respond with 4xx; retrying is useless |
| Server or External Issue | Database disconnection, external API timeout, bug | Respond with 5xx; retry may help if the issue is temporary |

It's convenient to attach a property indicating "whether retrying is allowed" to the exception class. The code below shows this structure. Each error type includes an HTTP status code, a machine-readable string code, and whether retries are permitted.

```python
class AppError(Exception):
    status = 500; code = "internal_error"; retryable = False
class NotFound(AppError):
    status = 404; code = "order_not_found"
class Upstream(AppError):
    status = 502; code = "upstream_failed"; retryable = True
```

Exceptions should not be swallowed immediately where they occur but propagated up to the layer capable of handling them. Hiding errors by returning `None` when a value is missing can cause issues to surface unexpectedly elsewhere, making root cause analysis difficult. This relates to layered architecture, discussed further in [Layered Structure](#/post/be-layered-architecture). Typically, the outermost layer (the request-handling layer) catches exceptions once and converts them into responses, while inner layers only throw meaningful exceptions.

## Error Response Specification

If error response formats vary by service—or even by endpoint—the caller must adapt individually. Therefore, we establish a specification.

There are standards available. RFC 9457 (Problem Details for HTTP APIs) defines returning errors as an `application/problem+json` JSON object with five members:

| Member | Meaning |
|---|---|
| type | URI pointing to the problem type; defaults to `about:blank` if omitted |
| title | Short description of the problem type; should be consistent for the same type |
| status | HTTP status code issued by the server; must match the actual response status code |
| detail | Description specific to this incident; helpful for client-side correction |
| instance | Identifier pointing to this specific occurrence |

A few points stood out in the document. Unknown extension members should be ignored by clients. The `detail` string is intended for human reading, so clients are advised not to parse it. Machine-readable information should go into extension members. Additionally, if the `status` member differs from the actual HTTP status code (e.g., due to intermediate devices), trust the actual HTTP status code.

My response built using the above exception class looked like this:

```json
{"type": "https://example.com/errors/order_not_found", "title": "order_not_found", "status": 404, "detail": "order 7 not found"}
```

Internal information such as stack traces or database queries is not included in the response; it's reserved for logs. How to choose status codes overlaps with content covered in [REST API](#/post/be-api-rest).

## Retries and Timeouts

External APIs are occasionally slow or fail. In such cases, retrying may help. However, blind retries can make things worse. The key points from the AWS Builders' Library article were:

- Always set a timeout for remote calls. Too long a timeout holds resources while waiting; too short increases unnecessary retry traffic.
- Retries help with transient failures but impose overhead on the server. Under overload conditions, excessive retries delay recovery.
- Retries compound across layers. The article notes that with multiple layers, database load can increase up to 243 times.
- Therefore, retries should use increasing intervals (exponential backoff) and have a maximum count.
- If intervals are uniform, failed clients may retry simultaneously; adding randomness (jitter) helps spread them out.
- For calls with side effects, retries are safe only if the operation is idempotent. Reads are generally idempotent, but creation APIs may not be.

The reason for marking exceptions as `retryable` is explained here. Retrying a 404 three times will still result in the same 404. Conversely, retrying non-idempotent calls like payment creation can lead to double charging. Idempotency and retries on the worker side are covered in [more detail → Async Processing and Message Queues](#/post/be-async-queue). When the server rejects requests due to being overwhelmed, see [more detail → Rate Limiting](#/post/infra-rate-limit).

The retry code is implemented as follows: the wait time doubles with each attempt, and a random value is chosen between 0 and that limit (a simplified version of the approach described in an AWS article; it does not use the exact code from the article).

```python
def retry(fn, tries=4, base=0.01, cap=0.1):
    for i in range(tries):
        try:
            return fn()
        except AppError as e:
            if not e.retryable or i == tries - 1:
                raise
            wait = random.uniform(0, min(cap, base * 2 ** i))
            log.warning("retry", extra={"attempt": i + 1, "wait": round(wait, 3), "code": e.code})
            time.sleep(wait)
```

When I ran this using a fake function that succeeds on the third call, two retry warning logs were printed followed by `ok`. For non-retryable `NotFound`, the error was raised immediately on the first attempt.

## Structured Logging

Leaving logs as plain text makes them difficult to search later. You would have to use regular expressions to extract information like "Order 7 lookup failed, user 12". Structured logging records each line as key-value pairs, similar to JSON.

```json
{"level": "WARNING", "msg": "retry", "request_id": "req-123", "attempt": 1, "wait": 0.004, "code": "upstream_failed"}
```

This allows you to easily gather all logs for a request using `request_id`, count by `code`, and filter by `level`. The habit of attaching an ID to every request to group multiple logs is particularly useful. In Python, I used `contextvars` to store the ID and had the formatter append it to each line; the full formatter code is included below.

Log levels are roughly categorized as follows:

| Level | When to Use |
|---|---|
| DEBUG | Detailed values during development |
| INFO | Major milestones in normal flow |
| WARNING | Issues occurred but were handled (e.g., retries) |
| ERROR | The request failed |

Logging the same error at multiple hierarchy levels results in multiple lines for a single event, making counting difficult. It is cleaner to log it once, typically where it is caught on the outermost layer. Passwords, tokens, and API keys should never be logged. Key management is covered in [more detail → Key Management](#/post/sec-keys). Aggregating logs and setting up alerts are covered in [more detail → Observability](#/post/cloud-observability).

## Common Misconceptions

- Hiding errors makes the system stable: Hidden errors often surface elsewhere in a more difficult-to-diagnose form.
- Retry on failure: Retrying non-retryable errors is wasteful, and retrying non-idempotent calls can cause incidents. Overloading the server by retrying exacerbates the problem.
- Log everything as ERROR: Logging handled issues as ERROR obscures real outages.
- More detailed error messages are better: Exposing internal information in responses visible to users creates security vulnerabilities; keep details in logs only.
- Add logs later if needed: Outages often occur where logging was not implemented initially. It is better to include request IDs and error codes from the start.

<details>
<summary>Detailed explanation: Full structured log formatter code</summary>

Only the standard `logging` library was used. Keys passed via `extra=` are attached as record attributes, so everything except default attributes is included in the JSON output.

```python
import json, logging, contextvars

request_id = contextvars.ContextVar("request_id", default="-")

class JsonFormatter(logging.Formatter):
    _SKIP = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}
    def format(self, r):
        d = {"level": r.levelname, "msg": r.getMessage(), "request_id": request_id.get()}
        d.update({k: v for k, v in r.__dict__.items() if k not in self._SKIP})
        if r.exc_info:
            d["exc"] = self.formatException(r.exc_info)
        return json.dumps(d, ensure_ascii=False, default=str)

h = logging.StreamHandler(); h.setFormatter(JsonFormatter())
log = logging.getLogger("app"); log.addHandler(h); log.setLevel(logging.INFO)

log.error("request failed", extra={"code": "order_not_found", "status": 404})
```

If `exc_info` is present (when using `log.exception`), the stack trace is also included as a field. In web frameworks, calling `request_id.set(...)` once at the request entry point automatically appends the ID to subsequent logs.

</details>

<details>
<summary>Detailed explanation: Results from running the code</summary>

I combined the exception class, `retry`, formatter, and problem response conversion code into a Python script and ran it directly. The fake function succeeding on the third call produced two retry warning logs followed by `ok`. For `NotFound`, there was no retry; instead, one ERROR log line and the problematic response JSON were output. The jitter value varies with each execution.

</details>

## Reference Links

- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457.html
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter
- (Partially read) Python Logging Cookbook: https://docs.python.org/3/howto/logging-cookbook.html
- RFC 9110, HTTP Semantics: https://www.rfc-editor.org/rfc/rfc9110.html

← [Concept Map](#/post/be-map)

Related posts: [Request processing flow](#/post/be-request-flow) · [Asynchronous processing and message queues](#/post/be-async-queue) · [Observability](#/post/cloud-observability)