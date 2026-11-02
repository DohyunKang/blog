API 是程序之间对话的窗口，而 REST 则是一种承诺：通过这个窗口，“用地址指定对象，用 HTTP 方法指定操作”。本文按顺序整理了该承诺的四个构成要素：方法、地址、状态码和幂等性。

## API 是什么

API（Application Programming Interface）是一个程序调用另一个程序功能的规则。如果拿餐厅来比喻，它更接近于菜单和点餐方式。你不需要知道厨房是如何制作的，只要按照菜单点的，就能得到对应的食物。

在 Web 语境下所说的 API，通常指通过 HTTP 进行交互的 API。客户端（如应用、浏览器或其他服务器）发送请求，服务器返回响应。关于这条路径的实际形态，详见 [网络基础 →](#/post/cs-network)；而请求在服务器内部的处理流程，则另见 [请求处理流程 →](#/post/be-request-flow)。

## REST 是一种约定

REST 并非一种协议或库，而是一种设计风格。它包含若干规则：用地址（URL）指向对象（资源），用 HTTP 方法描述操作，服务器每次请求都接收所需信息并处理（状态不由服务器持有）。遵循这些规则的 API 被称为 RESTful。

实际上，大多数 API 只是 loosely 地遵循这些规则。只要使用 JSON 进行数据交换，且 URL 大致像名词一样构成，通常就被称为"REST API"。是否完全遵守原始论文的所有约束往往不被追究。本文也基于这种常见的用法标准。

## 资源与地址

在 REST 中，地址是以“对象”为中心构建的，而非以“操作”为中心。例如，存在一个名为“用户”的对象，则地址如下：

| 地址 | 含义 |
|---|---|
| `/users` | 所有用户的集合 |
| `/users/42` | 第 42 号用户 |
| `/users/42/orders` | 第 42 号用户的订单列表 |

地址中不应包含如 `/getUser`、`/deleteUser` 这样的动词。是获取还是删除，应由方法而非地址来表明。使用复数名词，并采用小写字母和连字符的形式是惯例。

## HTTP 方法

即使地址相同，不同的方法也会执行不同的操作。

| 方法 | 作用 | 示例 |
|---|---|---|
| GET | 读取 | `GET /users/42` |
| POST | 创建新资源 | `POST /users` |
| PUT | 整体替换（若不存在则也可创建） | `PUT /users/42` |
| PATCH | 部分更新 | `PATCH /users/42` |
| DELETE | 删除 | `DELETE /users/42` |

PUT 与 PATCH 的区别在只想修改名称时尤为明显。PUT 会用新内容完全覆盖整个资源，缺失的字段将会消失；而 PATCH 仅修改发送的字段。不过这种区分属于惯例，不同 API 的实现也可能有所不同。

## 状态码

响应中会附带数字状态码。第一位数字代表大类：2xx 表示成功，3xx 表示重定向，4xx 表示客户端错误，5xx 表示服务器错误。基于 MDN 的状态码文档，以下是 API 中常见的状态码：

| 代码 | 含义 |
|---|---|
| 200 OK | 成功 |
| 201 Created | 成功且创建了新的资源（通常出现在 POST 之后） |
| 204 No Content | 成功但无返回内容（常见于删除操作后） |
| 400 Bad Request | 请求格式错误 |
| 401 Unauthorized | 并非字面意思的“未授权”，更接近“身份验证失败” |
| 403 Forbidden | 已知用户身份，但无权执行该操作 |
| 404 Not Found | 找不到该资源 |
| 409 Conflict | 与服务器当前状态冲突 |
| 422 Unprocessable Content | 格式正确但内容在语义上无效 |
| 429 Too Many Requests | 短时间内请求过于频繁 |
| 500 Internal Server Error | 服务器处理失败的通用错误 |
| 503 Service Unavailable | 服务器暂时无法提供服务（如维护或过载） |

401 和 403 容易混淆：未登录时返回 401，已登录但试图操作他人资源时返回 403。这两者的背景详见 [认证与授权 →](#/post/be-auth)。429 则与 [速率限制与流量控制 →](#/post/infra-rate-limit) 相关。

## 幂等性

这是本文讨论时间最长的概念之一。幂等（idempotent）意味着无论发送一次还是多次相同的请求，对服务器产生的效果都相同。MDN 解释道：正因如此，当客户端未收到响应时，可以安心地重新发送请求。

按方法分类，GET、PUT 和 DELETE 是幂等的，而 POST 和 PATCH 则不保证幂等。GET 作为只读操作（safe），自然是幂等的。

- PUT：即使两次发送“将 ID 42 的名称设为 lee"，最终结果都是名称为 lee。
- DELETE：无论发送多少次，最终状态都是不存在。虽然响应码可能不同（第一次返回 204，第二次返回 404），但对服务器产生的实际效果相同。MDN 文档中也提到了这个例子。
- POST：每次发送都会创建新资源。发送两次会产生两个资源。

因此，在网络中断导致未收到响应的情况下，如果自动重发 POST 请求，可能会导致订单被重复提交。在支付或订单 API 中，有些服务会在每次请求中添加唯一标识（如 `Idempotency-Key` 等头部字段），以便服务器过滤重复请求。该头部并非标准规定，不同服务可能使用不同的名称，本文仅列出其名称。

幂等性讨论的是“服务器预期的效果”。对于每次请求都记录一条日志的情况并不关心。此外，HTTP 规范并未强制要求这一点：即使是 GET 请求，服务器也可能在每次调用时改变返回的值，这会导致客户端受损。

## 亲自测试示例

仅使用 Python 标准库搭建了一个小型服务器，并发送了两次相同的请求（已在 Python 3.13.15 上验证运行）。

<details>
<summary>展开查看代码与执行结果</summary>

```python
import json, threading, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

db = {}
next_id = 1

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None):
        self.send_response(code)
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers(); self.wfile.write(data)
        else:
            self.send_header("Content-Length", "0"); self.end_headers()
    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")
    def do_POST(self):
        global next_id
        if self.path != "/users": return self.send(404, {"error": "not found"})
        b = self.body()
        if "name" not in b: return self.send(422, {"error": "name required"})
        uid = next_id; next_id += 1
        db[uid] = {"id": uid, **b}
        self.send(201, db[uid])
    def do_GET(self):
        if self.path == "/users": return self.send(200, list(db.values()))
        uid = int(self.path.rsplit("/", 1)[1])
        self.send(200, db[uid]) if uid in db else self.send(404, {"error": "not found"})
    def do_PUT(self):
        uid = int(self.path.rsplit("/", 1)[1])
        db[uid] = {"id": uid, **self.body()}
        self.send(200, db[uid])
    def do_DELETE(self):
        uid = int(self.path.rsplit("/", 1)[1])
        if db.pop(uid, None) is None: return self.send(404, {"error": "not found"})
        self.send(204)

s = HTTPServer(("127.0.0.1", 8765), H)
threading.Thread(target=s.serve_forever, daemon=True).start()

def call(m, p, b=None):
    r = urllib.request.Request("http://127.0.0.1:8765" + p, method=m,
        data=json.dumps(b).encode() if b is not None else None,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as x: t = x.read().decode(); print(m, p, x.status, t)
    except urllib.error.HTTPError as e:
        print(m, p, e.code, e.read().decode())

call("POST", "/users", {"name": "kim"})
call("POST", "/users", {"name": "kim"})
call("POST", "/users", {})
call("GET", "/users/1")
call("PUT", "/users/1", {"name": "lee"})
call("PUT", "/users/1", {"name": "lee"})
call("DELETE", "/users/1")
call("DELETE", "/users/1")
call("GET", "/users")
```

执行结果：

```
POST /users 201 {"id": 1, "name": "kim"}
POST /users 201 {"id": 2, "name": "kim"}
POST /users 422 {"error": "name required"}
GET /users/1 200 {"id": 1, "name": "kim"}
PUT /users/1 200 {"id": 1, "name": "lee"}
PUT /users/1 200 {"id": 1, "name": "lee"}
DELETE /users/1 204 
DELETE /users/1 404 {"error": "not found"}
GET /users 200 [{"id": 2, "name": "kim"}]
```

</details>

从结果中可以看到三点：POST 发送两次后，生成了 ID 为 1 和 2 的两个用户；PUT 即使发送两次，响应内容也完全相同，状态保持不变；DELETE 第一次返回 204，第二次返回 404，但最后一次 GET 请求显示资源已不存在，最终状态一致。对于返回空正文的请求返回 422 的部分是我自行设定的规则。使用 400 还是 422 取决于团队习惯。

原始请求与响应对如下所示：

```
POST /users HTTP/1.1
Content-Type: application/json

{"name": "kim"}

HTTP/1.1 201 Created
Content-Type: application/json

{"id": 1, "name": "kim"}
```

## 常见误解

- 人们常误以为 REST API 就是使用 JSON 的 API，但实际上 JSON 只是常见选择之一，并非 REST 的必要条件。
- 虽然常记“POST 用于创建、PUT 用于更新”，但 PUT 也可以创建不存在的资源。当客户端自行决定地址时使用 PUT，而由服务器生成 ID 时则多用 POST，这种情况很普遍。
- 有些 API 会先返回 200 状态码，并在响应体中包含 `"success": false`。虽然这种方式可行，但由于客户端、缓存和监控工具通常依据状态码进行判断，因此通过代码明确传达语义更为妥当。关于如何构建错误响应正文，请参见 [详细指南 → 错误处理与日志记录](#/post/be-error-logging)。
- 若将状态码 401 和 403 混用，客户端将无法区分是“需要重新登录”还是“需要请求权限”。

LLM 调用外部功能的工具调用（Tool calling）最终也常转化为此类 API 调用。相关内容请参见 [详细指南 → 工具调用 (Function calling)](#/post/ai-tool-use)。

## 参考链接

- MDN, Idempotent: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- 代码可在本地直接运行（Python 3.13.15）

相关文章：[认证与授权](#/post/be-auth) · [请求处理流程](#/post/be-request-flow) · [错误处理与日志记录](#/post/be-error-logging)