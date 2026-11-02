在后端开发中，我们的目标并非彻底消除错误，而是将“需要谁知晓的错误”进行分类并分别处理，这种分类的产物就是错误响应和日志。

## 什么是错误处理

服务器在处理单个请求时，会依次执行输入校验、数据库查询、外部 API 调用等操作。任何一个阶段都可能失败。错误处理就是在发生失败时，预先定义服务器该如何应对。主要需要确定以下三点：

- 向调用方返回什么（错误响应）
- 是重试还是放弃（重试策略）
- 留下什么信息以便后续排查原因（日志记录）

请求在服务器内部经过的路径已在 [详细说明 → 请求处理流程](#/post/be-request-flow) 中单独阐述。可以认为，错误可能出现在这条路径上的任何位置。

## 异常分类的依据

如果将所有错误都统一抛出为 `Exception`，上层就无法进行区分。因此需要对错误进行分类。我认为适合使用的分类标准主要有两个：

| 分类依据 | 示例 | 通常处理方式 |
|---|---|---|
| 客户端问题 | 输入格式错误、资源不存在、权限不足 | 返回 4xx 状态码，重试无效 |
| 服务端或外部问题 | 数据库连接断开、外部 API 超时、程序 Bug | 返回 5xx 状态码，若为临时性问题可重试 |

此外，在异常类中添加一个属性来标识“是否允许重试”会更方便。下面的代码即为此种设计。每种错误类型都包含 HTTP 状态码、机器可读的错误代码字符串以及是否支持重试的信息。

```python
class AppError(Exception):
    status = 500; code = "internal_error"; retryable = False
class NotFound(AppError):
    status = 404; code = "order_not_found"
class Upstream(AppError):
    status = 502; code = "upstream_failed"; retryable = True
```

基本做法是：不要在错误发生处立即吞掉异常，而是将其向上传递到能够处理的层级。如果返回 `None` 来隐藏错误，可能会导致问题在无关紧要的地方突然爆发，且难以追溯原因。关于分层结构的讨论可参考 [详细说明 → 分层架构](#/post/be-layered-architecture)。通常在最外层（接收请求的层）统一捕获异常并转换为响应，内层则仅抛出具有业务意义的异常。

## 错误响应规范

如果每个服务甚至每个端点的错误响应格式都不一致，调用方就必须逐一适配。因此需要制定统一的规范。

当然也有标准可循。RFC 9457（HTTP API 的问题详情）定义了以 `application/problem+json` JSON 对象形式返回错误的方案。该对象包含五个成员：

| 成员 | 含义 |
|---|---|
| type | 指向问题类型的 URI；若无则使用 `about:blank` |
| title | 问题类型的简短描述，同一类型应保持一致 |
| status | 服务器生成的 HTTP 状态码，必须与响应的实际状态码一致 |
| detail | 针对本次事件的说明，有助于客户端修复问题 |
| instance | 指向本次发生事件的标识符 |

文档中还有几点值得注意：未知的扩展成员应由客户端忽略；`detail` 字符串是供人类阅读的，因此不应由客户端进行解析；机器可读的信息应放入扩展成员中；若 `status` 成员与实际 HTTP 状态码不一致（例如被中间设备修改），应以实际 HTTP 状态码为准。

我基于上述异常类构建的响应格式如下：

```json
{"type": "https://example.com/errors/order_not_found", "title": "order_not_found", "status": 404, "detail": "order 7 not found"}
```

响应中不包含堆栈跟踪、数据库查询等内部信息，这些内容仅保留在日志中。如何选择合适的状态码可参考 [详细说明 → REST API](#/post/be-api-rest)。

## 重试与超时

外部 API 偶尔会变慢或失败，此时进行重试是常见做法。但若盲目重试，情况可能更糟。AWS Builders' Library 文章的核心观点如下：

- 所有远程调用都应设置超时时间。超时过长会占用资源等待，过短则导致不必要的重试流量增加。
- 重试对临时性故障有帮助，但对服务器而言是一种负担。在高负载状态下集中重试会延缓系统恢复。
- 各调用层级的重试次数会相乘。文章举例指出，随着层级叠加，数据库负载可能增加高达 243 倍。
- 因此，重试应采用递增间隔（指数退避），并限制最大重试次数。
- 若重试间隔相同，失败的客户端会在同一时刻集中重试，故需加入随机值（抖动）以分散请求。
- 对于有副作用的调用，仅在幂等操作时进行重试才是安全的。读取操作通常具有幂等性，而创建类 API 则未必如此。

异常处理中设置 `retryable` 的原因在此处体现。对于 404 错误，重试三次后得到的依然是同样的 404。相反，如果像创建支付那样对非幂等操作直接进行重试，可能会导致支付被重复执行两次。关于幂等性以及工作端的重试机制，请参见 [详细说明 → 异步处理与消息队列](#/post/be-async-queue)。由于请求量过大导致服务器拒绝的情况，则参考 [详细说明 → 速率限制](#/post/infra-rate-limit)。

重试代码编写如下：每次尝试时将等待上限翻倍，并在从 0 到该上限的范围内随机选择一个值（这是对 AWS 文章中所述方式的简化，并非直接使用原文中的代码）。

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

通过一个在第三次调用时成功的模拟函数进行测试，结果显示输出了两行重试警告日志并返回了 `ok`。而对于不可重试的 `NotFound` 异常，则仅出现一次错误日志。

## 结构化日志

如果日志仅保留为人类可读的文本字符串，后续检索将非常困难。例如，要查找“订单 7 查询失败，用户 12"这类信息，必须使用正则表达式进行提取。结构化日志则是以类似 JSON 的键值对形式记录每一行日志。

```json
{"level": "WARNING", "msg": "retry", "request_id": "req-123", "attempt": 1, "wait": 0.004, "code": "upstream_failed"}
```

这样可以通过 `request_id` 收集同一请求的所有日志，按 `code` 分类统计，并按 `level` 过滤，变得十分方便。为每个请求附加 ID 并将多条日志关联起来的习惯尤其有用。在 Python 中，我们将 ID 放入 `contextvars`，让格式化器在每一行日志中添加该 ID。完整的格式化器代码已折叠收起。

日志级别大致划分如下：

| 级别 | 使用场景 |
|---|---|
| DEBUG | 开发过程中记录详细数值 |
| INFO | 正常流程中的主要里程碑 |
| WARNING | 存在问题但已处理（如重试等） |
| ERROR | 请求失败 |

如果将同一错误在每一层都记录日志，会导致一条错误产生多行日志，难以统计。通常只在最外层捕获时记录一次更为整洁。密码、令牌、API 密钥等不应写入日志。关于密钥管理，请参见 [详细说明 → 密钥管理](#/post/sec-keys)。日志的收集、分析及告警设置等内容，则与 [详细说明 → 可观测性](#/post/cloud-observability) 相关。

## 常见误解

- 隐藏错误就能提升稳定性：被隐藏的错误往往会在其他地方以更难以察觉的形式出现。
- 失败后直接重试：不可重试的错误会导致资源浪费；非幂等操作的重试则可能引发事故。在高负载情况下，还会进一步加剧服务器压力。
- 将所有情况都记录为 ERROR：连已处理的问题也标记为 ERROR，会掩盖真正的故障。
- 错误消息越详细越好：如果内部信息泄露到用户可见的响应中，将构成安全问题；详细信息应仅保留在日志中。
- 日志可以事后补充：大多数故障发生在未记录日志的地方。从一开始就加入请求 ID 和错误代码更为妥当。

<details>
<summary>详细说明：结构化日志格式化器完整代码</summary>

仅使用了标准库 `logging`。通过 `extra=` 传递的键会作为属性附加到记录对象中，因此除基本属性外的其余内容会被放入 JSON 中。

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

如果存在 `exc_info`（例如使用 `log.exception` 记录时），堆栈跟踪也会作为一个字段包含在内。在 Web 框架中，只需在请求入口处调用一次 `request_id.set(...)`，后续日志便会自动附加该 ID。

</details>

<details>
<summary>详细说明：实际运行验证结果</summary>

将上述异常类、`retry`、格式化器及问题响应转换代码整合后，直接用 Python 运行测试。模拟函数在第三次调用时成功，输出两行重试警告日志后返回 `ok`；而 `NotFound` 则在不重试的情况下输出一行 ERROR 日志及问题响应的 JSON。抖动值（jitter）每次运行均不同。

</details>

## 参考链接

- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457.html
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter
- （仅部分阅读）Python Logging Cookbook: https://docs.python.org/3/howto/logging-cookbook.html
- RFC 9110, HTTP Semantics: https://www.rfc-editor.org/rfc/rfc9110.html

← [概念图](#/post/be-map)

相关文章：[请求处理流程](#/post/be-request-flow) · [异步处理与消息队列](#/post/be-async-queue) · [可观测性](#/post/cloud-observability)