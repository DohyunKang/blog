CDN 是一组缓存服务器，它将源服务器的响应复制到靠近用户的地点（边缘节点）并提供给用户。速度提升只是附带好处；真正需要关注的是：通过 `Cache-Control` 头决定可以信任副本多久，以及在发现错误副本时如何清除它们。

## 先说人话

如果美国用户使用位于首尔的服务器，每次请求都要跨越海洋。每接收一张图片都会很慢。因此，我们在美国也存放一份相同的图片副本，让美国用户从那里获取。存放这些副本的服务器就是 CDN 的边缘节点。请求经过的顺序详见 [详细 → 单个请求的路径](#/post/infra-request-journey)。

有了副本后，源服务器负载会减轻。即使有 10 万用户使用相同的 Logo，源服务器只需被边缘节点访问几次即可。速度和服务器负担同时降低，因此静态资源前几乎都会部署 CDN。

## 缓存是多层的

缓存并非单一位置，而是层层叠加的。

| 层级 | 使用者 | 示例 |
|---|---|---|
| 浏览器缓存 | 单个用户（私有缓存） | 磁盘上存储的 JS 文件 |
| CDN 边缘 | 多个用户（共享缓存） | Cloudflare 等服务的服务器 |
| 源站前段/应用缓存 | 服务器内部 | Redis 等，[详细 → 缓存与 Redis](#/post/db-cache-redis) |

MDN 将缓存主要分为两类：专属于个人的私有缓存（主要是浏览器）和多人共享的共享缓存。CDN 被归类为共享缓存中的“托管型缓存”。这一区分的重要性将在下方的 `private` 和 `s-maxage` 中体现。

## 缓存头：能信任副本多久

源服务器在响应中添加 `Cache-Control`，告知客户端“请按此方式处理”。通常只列出常用指令。

- `max-age=秒数`：在此时间段内内容新鲜。在此期间无需询问源服务器，直接使用副本。
- `s-maxage=秒数`：仅适用于共享缓存（CDN）的时间。在共享缓存中优先级高于 `max-age`；浏览器会忽略它。若设置 `max-age=60, s-maxage=3600`，浏览器信任 60 秒，而 CDN 信任 1 小时。
- `no-cache`：名称具有误导性，实际上仍可进行存储。但在使用前必须每次向源服务器确认“是否仍然有效”。
- `no-store`：意为禁止在任何地方存储。
- `private`：仅允许浏览器存储，禁止 CDN 等共享缓存存储。
- `public`：表示即使请求包含 Authorization 头，响应也可被缓存（MDN 指出仅在必要时使用）。
- `immutable`：该文件永不更改。刷新页面时也不会重新验证。

初学者容易将 `no-cache` 和 `no-store` 混淆。真正禁止存储的是 `no-store`；而 `no-cache` 是“可以存储，但每次使用前需确认”。

### 过期后：条件请求

当新鲜度时间过后，副本变为 stale（过期）。此时不会立即丢弃，而是向源服务器发起查询。若源服务器返回类似 `ETag: "33a64df5"` 的值（内容指纹），缓存会附加 `If-None-Match: "33a64df5"` 重新请求。若内容未变，服务器仅返回 `304 Not Modified`（无正文），缓存即可继续重用原有副本；若已变更，则返回 `200` 及新正文。由于不传输正文，这种方式更高效。

### stale-while-revalidate

web.dev 的示例为 `Cache-Control: max-age=1, stale-while-revalidate=59`。前 1 秒内容新鲜，直接返回；第 1 到 60 秒之间，先返回过期的副本，同时在后台向源服务器验证并更新副本；超过 60 秒后，若无法使用过期副本，则需等待网络响应。用户无需感知延迟，刷新操作在后台完成。若浏览器不支持该指令，则仅遵循 `max-age`。

当源服务器不可用时，可使用 `stale-if-error`。例如 `max-age=604800, stale-if-error=86400` 表示内容新鲜期为 7 天；此后若遇到 500、502、503、504 等错误，则返回过期副本作为替代。

## 无效化：清除错误副本

信任副本的时间越长，即使源服务器已更新，用户仍可能看到旧内容。解决方案主要有两种。

第一种方法是更改文件名（cache busting）。MDN 提到了类似 `bundle.v123.js` 的方式，即在文件名中加入版本号或内容哈希。一旦内容发生变化，URL 也会随之改变，因此旧的副本将不再被使用。因此，即使对这些文件设置 `Cache-Control: public, max-age=31536000, immutable`（1 年）也是安全的。

第二种方法是直接要求 CDN 清除缓存（purge）。以 Cloudflare 文档为准，清除方式包括单个 URL、全部、缓存标签、主机名、URL 前缀等。文档推荐按单个 URL 进行清除，并指出仅在内容发生广泛变更时才使用全部清除。除了清除之外，还有一种“标记为过期”的 invalidation 方式，即在下次请求时向源站确认，若内容未变则继续使用原缓存。此外，不同套餐的请求次数限制也不同（例如：Free 套餐对全部、标签、主机名、前缀的删除操作限制为每分钟 5 次）。即使收到状态码 200，也仅表示“已接收”，若要确认清除是否成功，需再次请求并检查 `CF-Cache-Status` 是否不再为 `HIT`。

下面是一个简单的自行测试模拟结果。

<details>
<summary>详细解析：模仿边缘缓存的 Python 代码及运行结果（已直接执行）</summary>

我们构建了一个 TTL 为 60 秒的简化版边缘节点，这并非真实的 CDN 行为，仅用于概念验证。

```python
class Edge:
    def __init__(s): s.c={}; s.hit=s.miss=0
    def get(s,url,now,origin):
        e=s.c.get(url)
        if e and now<e[1]: s.hit+=1; return e[0],'HIT'
        s.miss+=1; body,ttl=origin(url); s.c[url]=(body,now+ttl); return body,'MISS'
    def purge(s,url): s.c.pop(url,None)

ver={'v':1}
def origin(url): return (f"{url} content-v{ver['v']}", 60)
e=Edge()
for t in [0,10,20,59,61,62]:
    print(t,e.get('/app.js',t,origin))
ver['v']=2                       # 원본 배포
print(63,e.get('/app.js',63,origin))   # 아직 옛 복사본
e.purge('/app.js')
print(64,e.get('/app.js',64,origin))   # 지운 뒤 새 내용
```

结果如下：

```
0  MISS  v1
10 HIT   v1
20 HIT   v1
59 HIT   v1
61 MISS  v1   (TTL 끝나서 원본에 다시 감)
62 HIT   v1
63 HIT   v1   <- 원본은 v2인데 옛것을 내줌
64 MISS  v2   <- purge 뒤
```

在第 63 秒时，源站内容已是 v2，但边缘节点仍返回 v1，这正是需要执行无效化的原因。本模拟中的命中率约为 8 次中成功 5 次，即 0.625。

</details>

## 区分静态与动态资源

应根据文件特性决定交由 CDN 托管的内容类型。

| | 静态（图片、JS、CSS、字体） | 动态（API 响应、登录后页面） |
|---|---|---|
| 用户间不同 | 否 | 是 |
| CDN 缓存策略 | 长期，配合哈希文件名 + immutable | 通常不缓存；若缓存则期限较短 |
| 推荐头部设置 | `public, max-age=31536000, immutable` | `private` 或 `no-store` |

HTML 处于中间状态。由于无法通过更改文件名来更新，MDN 建议对 HTML 默认使用 `no-cache` + `ETag`（每次验证）。若内容因用户而异，则额外添加 `private`。此外，HTML 所引用的 JS 和 CSS 文件可通过哈希命名实现长期缓存。HTML 每次验证，而其内部引用的文件则长期使用，这种组合是合理的。关于页面是在服务器生成还是在浏览器生成会影响缓存范围的问题，详见 [详细内容 → 渲染方式](#/post/fe-rendering-modes)。

Cloudflare 默认根据文件扩展名进行缓存，文档指出 HTML 和 JSON 默认不缓存。若需额外缓存，需单独创建 Cache Rule。此外，若响应中包含 `Set-Cookie`，或带有 `private`、`no-store`、`no-cache`、`max-age=0` 等头部，或是非 GET 请求，则不会缓存。看起来仅因一个 cookie 就导致缓存失效的情况很常见。

## 查看 CDN 端的状态

可通过 CDN 响应头了解缓存的处理情况。Cloudflare 的 `CF-Cache-Status` 值含义如下：

| 值 | 含义 |
|---|---|
| HIT | 命中缓存，从此处返回内容 |
| MISS | 未命中缓存，从源站获取内容 |
| EXPIRED | 副本已过期，从源站重新获取 |
| REVALIDATED | 经源站确认“仍有效”，故返回副本 |
| STALE | 无法连接源站，返回过期的副本 |
| UPDATING | 返回过期副本的同时在后台更新 |
| DYNAMIC | 非缓存对象，直接转发至源站 |
| BYPASS | 本应缓存，但因源站标记为不可缓存而未存储 |

若登录用户的页面响应显示为 `HIT`，则是一个危险信号，可能导致其他用户看到相同内容。MDN 也指出，个性化内容不应放入共享缓存；仅因存在 cookie 并不会自动变为 `private`，因此需手动添加 `Cache-Control: private`。此外，也不推荐使用通过设置 `Vary` 头并关联 cookie 来区分内容的做法。

## 常见误解

- `no-cache` 并不意味着“不要缓存”，而是指“需要存储但每次都要重新验证”。禁止存储应使用 `no-store`。
- 缓存并不总是更快：首次请求会命中 MISS，需回源获取；对于几乎不会被重复访问的 URL，命中率低，收益有限。
- 没有头部就无法缓存：并非如此。只要存在 `Last-Modified` 头部，MDN 指出客户端可推测资源约 10% 仍为新鲜内容，从而进行缓存。因此建议始终显式设置相关头部。Cloudflare 也规定：若缺少 `Cache-Control` 头部，则默认将 200 响应缓存 120 分钟。
- purge（清除）后不会立即对所有用户生效：返回的 200 状态码仅表示已收到清除请求。存储在浏览器中的副本并不会因 CDN 清除而被删除。此结论并非直接来自文档原文，而是基于“私有缓存独立管理”这一区分逻辑推导得出。
- 缓存键默认仅查看 URL：基础是 URL，但 `Vary` 头部中列出的请求头会被加入缓存键。例如 `Vary: Accept-Language` 会按语言分别存储；而 `Vary: User-Agent` 由于类型过多导致命中率急剧下降，因此应避免使用。

## 后续话题

AI 领域也存在类似理念：不再重复计算相同提示词前缀的 [详细说明 → 提示词缓存](#/post/ai-prompt-caching) 即属此类。若将其与前端用于分流请求的 [详细说明 → 负载均衡器](#/post/infra-load-balancer) 一同看待，其目标同样是“减少回源请求”。关于 Web 性能视角的内容，请参见 [详细说明 → 前端性能](#/post/fe-performance)。

## 参考链接

- MDN, HTTP 缓存：https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- MDN, Cache-Control：https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- web.dev，通过 stale-while-revalidate 保持内容新鲜：https://web.dev/articles/stale-while-revalidate
- Cloudflare Docs，默认缓存行为：https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cloudflare Docs，Cloudflare 缓存响应：https://developers.cloudflare.com/cache/concepts/cache-responses/
- Cloudflare Docs，清除缓存：https://developers.cloudflare.com/cache/how-to/purge-cache/

← 概念图 (#/post/infra-map)

相关文章：[单个请求的完整路径](#/post/infra-request-journey) · [负载均衡器](#/post/infra-load-balancer) · [缓存与 Redis](#/post/db-cache-redis)