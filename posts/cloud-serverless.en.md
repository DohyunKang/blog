Serverless does not mean there are no servers; rather, it means the cloud provider handles starting, stopping, and scaling the servers, while you only upload your function code.

## What is Serverless?

The name can be confusing. Servers definitely exist. However, instead of renting a server to install an OS and keep processes running, you simply deploy your code (functions). When a request comes in, the cloud automatically creates and runs the execution environment; when there are no requests, the environment is shut down. That's why it's called "Serverless"—you don't have to worry about managing servers.

Vercel documents say something similar: each request triggers a function invocation, and if there is no traffic, the usage drops to zero. AWS Lambda is the representative service for this approach.

Check [Server & Cloud Basics → Cloud Fundamentals](#/post/cloud-basics) first to easily compare it with "rented servers."

| | Directly Managed Servers (VMs, etc.) | Serverless |
|---|---|---|
| Running State | Servers are always on | Executes only when a request arrives |
| Scaling | You determine the number and size of servers | Environment scales automatically as requests increase |
| Pricing | Based on uptime time | Based on execution count and duration |
| State | Can store data in memory or disk | Must assume state is lost after execution ends |

## How Functions Execute

The flow described in Lambda documentation consists of three stages: Init when an environment is created, Invoke when processing a request, and Shutdown when cleaning up the environment.

During **Init**, you enable extensions, launch the runtime, and execute parts of your code outside the handler (such as imports, configuration, and database connections). During **Invoke**, the handler runs. After it finishes, the environment isn't immediately destroyed; instead, it's frozen and reused for subsequent requests to the same function by thawing it again. According to the documentation, you shouldn't assume an environment is permanently maintained even if it lasts several hours, as environments are eventually replaced.

This reuse gives meaning to code placement. Variables and connections placed outside the handler can persist across requests. As recommended in the documentation, creating and reusing resources like database connections during the initialization phase (outside the handler) is standard practice.

Here's a small example I tested by running it: the code outside the handler executes once, while the handler runs for every request.

```python
import time

time.sleep(0.2)                    # Init: 라이브러리 로드, 연결 생성 흉내
CONN = {"opened": time.time()}     # 핸들러 바깥: 환경이 살아 있는 동안 재사용
calls = 0

def handler(event, context=None):  # Invoke: 요청마다 실행
    global calls
    calls += 1
    return {"call": calls, "conn_age_ms": round((time.time() - CONN["opened"]) * 1000)}

for _ in range(3):
    print(handler({}))
    time.sleep(0.05)
```

When run, `call` increases from 1 to 2 to 3, and `conn_age_ms` grows from 0 to 50 to 101, simulating that connections aren't recreated for each request but are instead reused. This was a local Python simulation, not actual Lambda execution.

## Cold Start

If no usable environment exists when a request arrives, one must be created anew. The code is downloaded, the environment is launched, and the Init code runs before the handler can start. This initial period is called the **cold start**. If an existing environment is reused, it's referred to as a **warm start**.

Lambda documentation states that cold starts typically occur in less than 1% of invocations and vary in duration from under 100ms to over 1 second. They are also more common in development or testing functions with infrequent traffic. These figures are general guidelines from the documentation; you should benchmark how long it takes for your specific functions.

Time spent during Init ultimately comes from your code. The documentation lists package size (libraries, layers), amount of initialization work, and connection setup speed as key factors. To reduce cold start times, do the opposite: bring only necessary libraries and create objects on unused paths only when needed.

If predictable startup time is essential, there's an option called **Provisioned Concurrency**, which pre-creates environments—but this reintroduces costs for keeping them running. **SnapStart** supports a limited set of runtimes by storing snapshots of initialized environments and resuming from them.

## Limits

These are the notable limits within Lambda's default allocations:

| Item | Value |
|---|---|
| Maximum execution duration per invocation | 900 seconds (15 minutes) |
| Memory | 128MB ~ 10,240MB (CPU scales proportionally with memory) |
| Synchronous request/response size | 6MB each |
| Concurrent executions | Default 1,000 (based on account and region; can be increased upon request) |
| Deployment package | 250MB after unzipping zip archives; container images up to 10GB |
| /tmp storage | 512MB ~ 10,240MB |

The source is the AWS quotas documentation, which notes that new accounts may start with lower values. These numbers can change, so always check again when using them.

More important than the numbers is the mindset: since the environment disappears after execution, store state in a database or storage rather than within the function. Tasks exceeding 15 minutes should be split or handled via other approaches (containers, workflows). If requests surge simultaneously, you may hit concurrency limits, and the backend database might struggle to handle that level of concurrency. This connects to [Database Scaling](#/post/db-scaling).

## Cost

The cost is calculated based on the number of requests and execution time (allocated memory in GB × seconds). Based on AWS pricing for x86 architecture in the US East (Virginia) region, the rate is $0.20 per 1 million requests and $0.0000166667 per GB-second. The first 1 million requests and 400,000 GB-seconds are free each month.

Here is an example calculation I performed: If a 512MB function runs 1 million times with a duration of 200ms each, the total execution time is 1,000,000 × 0.2 seconds × 0.5 GB = 100,000 GB-seconds. Multiplying 100,000 by $0.0000166667 gives approximately $1.67. Adding the request charge of $0.20 results in a total of about $1.87. This is the cost before applying the free tier; since this usage falls within the free limits, the actual cost would be $0. Note that costs for other services (API Gateway, data transfer, logs) are not included in this calculation.

Conversely, for a service receiving steady requests throughout the day, keeping a server running might end up being cheaper. The point where it becomes more expensive varies depending on traffic and execution time, so no general threshold number could be determined.

Vercel Functions use a slightly different pricing model. According to their documentation, costs are based on Active CPU, Provisioned Memory, and the number of invocations. They mention "Fluid compute," a method where a single instance handles multiple requests simultaneously, utilizing waiting time (such as external API response delays). This approach is said to reduce cold starts and lower costs.

## When it's a good fit vs. when it's not

- **Good fits:** APIs called occasionally, receiving webhooks, generating thumbnails upon file upload, scheduled tasks, and services with fluctuating traffic.
- **Less suitable:** Tasks lasting longer than 15 minutes, persistent connections that must always be active (like WebSocket servers), environments where latency is extremely sensitive, and programs relying on local disk or memory state.

Compared to containers, [Docker and Containers](#/post/cloud-docker) are closer to "I define the entire environment," whereas serverless is closer to "I leave the environment and just provide the code." The two concepts often overlap; for instance, Lambda can also upload container images. Information about automatic scaling is covered separately in [Auto-scaling](#/post/infra-autoscaling).

## Common Misconceptions

- **There are no servers:** There are servers; I simply do not manage them.
- **It's always cheap:** It is cheaper when requests are infrequent and short. Costs can change if usage becomes consistent and high.
- **It's always slow:** Cold starts only occur on some invocations. However, if these occur for the user, it feels slow.
- **You can persist state in variables:** This works only by accident while resources are reused. You should not rely on this.
- **It scales infinitely:** There are limits to concurrent executions and backend system capacity.

<details>
<summary>Detailed explanation: The journey of a single request</summary>

When a request arrives, the front-end (such as API Gateway or CDN) receives it and invokes the function. If an available environment exists, the request is routed there; otherwise, a new one is created, the initialization phase runs, and then the handler executes. Once the response is sent, the environment is frozen. If requests arrive in a burst, multiple environments are created simultaneously. According to Lambda documentation, there is also a limit on the number of environments a single function can scale up to every 10 seconds (1,000 instances).

If an error or timeout occurs during execution, the environment is reset, and the next invocation starts from initialization again. The documentation notes that contents in `/tmp` are not deleted even in this case. The full request flow is covered separately in [The Journey of a Request](#/post/infra-request-journey).

Logs and metrics must be managed separately, as discussed in [Observability](#/post/cloud-observability). Lambda leaves values such as Duration, Billed Duration, and Init Duration in the REPORT log, as shown in documentation examples.

</details>

## Reference Links

- AWS, Lambda execution environment lifecycle: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html
- AWS, Lambda quotas: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
- AWS, Lambda pricing: https://aws.amazon.com/lambda/pricing/
- Vercel, Vercel Functions: https://vercel.com/docs/functions

← Concept map (#/post/cloud-map)

Related articles: [Cloud Basics](#/post/cloud-basics) · [Docker and Containers](#/post/cloud-docker) · [Auto-scaling](#/post/infra-autoscaling)