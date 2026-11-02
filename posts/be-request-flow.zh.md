一个请求由客户端发出，经过服务器框架依次处理中间件（middleware），路由（router）选择合适的手柄（handler），手柄通过数据库生成响应后，再沿原路返回。

## 先用通俗的话解释

用餐厅点餐来类比就更容易理解了。顾客（客户端）下单（发送请求）。门口服务员记录等待名单（日志记录）、确认是否为预订客人（身份验证）、查看菜单并决定将订单交给哪位厨师（路由）。厨师在仓库（数据库）中查找食材制作菜肴，最后盘子（响应）被端给顾客。

后端代码负责处理这一中间过程。浏览器只负责发送请求和接收响应，因此看不到中间的运作。

## 请求与响应的结构

HTTP 请求由方法（GET、POST 等）、资源路径、协议版本、可选的标头以及可选的正文组成。响应则包含协议版本、状态码及简短消息、标头和可选的正文。MDN 提供的示例如下：

```http
GET /users/1 HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: application/json
```

在地址栏输入网址后，浏览器会建立新的 TCP 连接或复用现有连接，并发送上述请求。如果响应是 HTML，浏览器会在解析过程中再次请求其中提及的脚本、CSS 和图像。这就是为什么按一次回车键，服务器却收到多个请求的原因。关于页面绘制过程，请参阅 [浏览器如何渲染页面 → 渲染](#/post/fe-browser-render)。

客户端与服务器之间有时还会插入代理（proxy）。MDN 指出代理可以实现缓存、过滤、负载均衡、身份验证和日志记录等功能。在服务器前端部署的这些组件层层叠叠的情况，在 [请求到达服务器的旅程 → 旅程](#/post/infra-request-journey) 中有详细说明。

## 服务器内部流程

当请求到达服务器进程时，框架（如 Express、FastAPI、Spring 等）接收请求并将其转换为请求对象和响应对象。后续流程大致如下：

| 阶段 | 功能 | 示例 |
|---|---|---|
| 中间件 | 所有或部分请求经过的通用处理 | 日志记录、身份验证、JSON 解析、CORS |
| 路由 | 根据方法和路径选择手柄 | `GET /users/:id` |
| 手柄 | 实际业务逻辑 | 查询用户 |
| 数据访问 | 调用数据库、缓存或外部 API | 执行 SQL |
| 响应 | 生成状态码、标头和正文 | `200` + JSON |
| 错误处理 | 收集任何位置的异常并返回响应 | `500` |

路径中的 `:id` 等部分是占位符，路由从中提取实际值并传递给手柄。关于如何设计 API 路径，请参阅 [REST API](#/post/be-api-rest)。

## 中间件是串联的

根据 Express 文档的定义，中间件是可以访问请求（req）、响应（res）和下一个中间件（next）的函数。它可以执行代码、修改 req 和 res、结束请求 - 响应周期，或将控制权传递给下一个中间件。如果未结束响应，必须调用 `next()`；否则请求将直接停止。

此外，它们按定义顺序依次执行。同一路径下的多个手柄也会按顺序检查：一旦前面的手柄已发送响应，后续的手柄将不再执行。因此，身份验证中间件应置于路由之前。若顺序错误，则会产生无需认证即可访问的路径。

根据 Express 的分类标准，中间件可分为全局附加到整个应用、附加到特定路由、用于错误处理（参数为 `(err, req, res, next)` 四个）、内置（如 `express.json`）以及第三方中间件。错误处理中间件必须声明全部四个参数，即使不使用 `next` 也需写出；否则会被视为普通中间件，文档指出若未发生错误则不会触发。

这种结构可以像洋葱皮一样理解：请求从外层向内层传递，响应从内层向外层返回。这就是为什么日志记录中间件可以在“进入时写一行，离开时再写一行”的原因。

## 亲手实现的微型框架

仅阅读概念可能感到模糊，因此我用 Python 标准库模拟了路由和中间件链的实现。实际框架更为复杂，但骨架相同。

<details>
<summary>代码（已验证可运行）</summary>

```python
import re

class App:
    def __init__(self):
        self.middlewares = []
        self.routes = []          # (method, regex, handler)

    def use(self, fn):
        self.middlewares.append(fn)

    def route(self, method, path):
        regex = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", path) + "$")
        def deco(fn):
            self.routes.append((method, regex, fn))
            return fn
        return deco

    def handle(self, method, path, body=None):
        req = {"method": method, "path": path, "body": body, "params": {}}

        def dispatch(req):
            for m, rx, fn in self.routes:
                hit = rx.match(req["path"])
                if m == req["method"] and hit:
                    req["params"] = hit.groupdict()
                    return fn(req)
            return {"status": 404, "body": "not found"}

        chain = dispatch
        for mw in reversed(self.middlewares):
            chain = (lambda mw, nxt: lambda r: mw(r, nxt))(mw, chain)
        try:
            return chain(req)
        except Exception as e:
            return {"status": 500, "body": f"error: {e}"}

app = App()
DB = {"1": "kim", "2": "lee"}
log = []

def logger(req, nxt):
    log.append(f"-> {req['method']} {req['path']}")
    res = nxt(req)
    log.append(f"<- {res['status']}")
    return res

def auth(req, nxt):
    if req["path"].startswith("/admin"):
        return {"status": 401, "body": "login required"}
    return nxt(req)

app.use(logger)
app.use(auth)

@app.route("GET", "/users/:id")
def get_user(req):
    name = DB[req["params"]["id"]]
    return {"status": 200, "body": {"id": req["params"]["id"], "name": name}}

for args in [("GET", "/users/1"), ("GET", "/users/9"), ("GET", "/nope"), ("GET", "/admin/x")]:
    print(args, app.handle(*args))
print("\n".join(log))
```

运行结果：

```
('GET', '/users/1') {'status': 200, 'body': {'id': '1', 'name': 'kim'}}
('GET', '/users/9') {'status': 500, 'body': "error: '9'"}
('GET', '/nope') {'status': 404, 'body': 'not found'}
('GET', '/admin/x') {'status': 401, 'body': 'login required'}
-> GET /users/1
<- 200
-> GET /users/9
-> GET /nope
<- 404
-> GET /admin/x
<- 401
```

</details>

从结果中可以看出三个显著特点。

- `/admin/x` 在认证中间件处被拦截，无法到达处理器，因此返回了 401。尽管如此，日志记录器作为外层包装，在进入和退出时都进行了记录。
- `/nope` 没有匹配的路线，因此返回 404。404 并非错误，而是路由器告知“无匹配项”的正常响应。
- `/users/9` 尝试读取数据库中不存在的键时抛出异常，并在外部捕获后转换为 500。然而日志中仅显示 `-> GET /users/9`，缺少 `<-` 行。这是因为异常跳过了日志记录器并向上冒泡，导致退出时的日志缺失。在此代码中，日志记录器未捕获异常；在实际服务中，错误日志出现单行空白的原因也可能类似。因此，错误处理放置的位置至关重要。关于如何收集错误，请参见 [错误与日志](#/post/be-error-logging)。

此代码中的 `9` 本应表示“用户不存在”，理应返回 404，却返回了 500。如果处理器无法区分“不存在”和“服务器故障”，就会出现这种情况。

## DB 位于何处

处理器可能直接使用 SQL，也可能经过服务层或存储层。分层的原因及方式在 [分层架构](#/post/be-layered-architecture) 中进行了总结。数据库调用通常是请求耗时中最主要的部分，因此当响应缓慢时，它往往是首先被怀疑的对象。关于如何加速查询，请参阅 [索引](#/post/db-index)。

如果处理器在请求内完成耗时操作（如发送邮件、视频转换），客户端将持续等待。对于此类情况，应采用将任务放入队列并先返回响应的模式，相关内容请参见 [异步与队列](#/post/be-async-queue)。

## 常见误解

- 容易误认为“一个请求对应一台服务器”。根据 MDN 的说明，服务器可以是多台分担负载的设备，而客户端并不知晓具体连接到了哪一台。
- 在中间件中已发送响应后，若仍调用 `next()`，后续处理器可能会尝试再次响应，从而导致错误。一旦响应结束，就不应继续传递。
- 状态码是服务器约定的协议，即使发送 `200` 并在正文中写入“失败”，请求仍会成功执行。然而，由于客户端、代理和监控系统会根据状态码采取行动，因此最好发送匹配的状态码。
- 容易误认为顺序无关紧要。正如上述示例所示，中间件的注册顺序即为其执行顺序。

---

## 参考链接
- MDN, HTTP 概述：https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview（已阅读）
- Express，使用中间件：https://expressjs.com/en/guide/using-middleware.html（已阅读）

← [概念地图](#/post/be-map)

相关文章：[REST API](#/post/be-api-rest) · [分层架构](#/post/be-layered-architecture) · [请求到达服务器的旅程](#/post/infra-request-journey)