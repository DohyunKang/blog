CDN is a collection of cache servers that replicate responses from the origin server at locations closer to the user (edge) and serve them instead. The benefit is speed, but what actually requires attention is determining how long to trust a replica via the `Cache-Control` header and how to clear incorrect replicas when they remain.

## First, in simple terms

If a server in Seoul is used by users in the US, every request must cross the ocean. Receiving an image this way is slow. Therefore, we keep a copy of the same image in the US as well, so US users receive it from there. The server that holds this copy is the CDN edge. For the order of requests, see [details → Journey of a single request](#/post/infra-request-journey).

With copies available, the origin server is less busy. Even if 100,000 users receive the same logo, the origin is queried only a few times by the edges. Both speed and server load are reduced simultaneously, so CDN is almost always placed in front of static files.

## Cache hierarchy has multiple layers

Cache is not in one place; it is layered.

| Layer | Who uses it? | Example |
|---|---|---|
| Browser cache | One user (private cache) | JS file stored on disk |
| CDN edge | Multiple users (shared cache) | Servers like Cloudflare |
| Origin front-end / App cache | Inside the server | Redis, etc., [details → Cache and Redis](#/post/db-cache-redis) |

MDN divides cache into two main categories: private cache used by a single person (mainly browser) and shared cache used by multiple people. CDN is classified under "managed cache" in the shared category. The importance of this distinction comes from `private` and `s-maxage` below.

## Cache headers: How long to trust a copy

The origin attaches `Cache-Control` to the response to say, "Handle it like this." Only frequently viewed items are listed.

- `max-age=seconds`: Fresh for this duration. During this time, use the replica without asking the origin.
- `s-maxage=seconds`: Time applicable only to shared cache (CDN). Takes precedence over `max-age` in shared cache; browsers ignore it. If `max-age=60, s-maxage=3600`, the browser trusts for 60 seconds and the CDN for 1 hour.
- `no-cache`: Contrary to its name, storage is allowed. However, you must check with the origin every time before using ("Is it still valid?").
- `no-store`: Means do not store anywhere.
- `private`: Means browsers may store, but shared caches like CDN should not.
- `public`: Means responses to requests with an Authorization header can also be stored. MDN notes this should only be used when necessary.
- `immutable`: This file will never change; no need to revalidate on refresh.

It is easy to misunderstand `no-cache` and `no-store` initially. Storing itself is prevented by `no-store`. `no-cache` means "store, but check every time before use."

### When stale: Conditional requests

When the freshness time expires, the replica becomes stale. Instead of discarding it immediately, ask the origin again. If the server returns a value like `ETag: "33a64df5"` (like a content fingerprint), the cache sends a request with `If-None-Match: "33a64df5"`. If nothing has changed, the server responds only with `304 Not Modified` without the body, and the cache reuses the existing replica as fresh. If it has changed, a `200` response with the new body is returned. This saves bandwidth by not sending the body when unchanged.

### stale-while-revalidate

The web.dev example is `Cache-Control: max-age=1, stale-while-revalidate=59`. For the first second, it is fresh and used as-is. Between 1 and 60 seconds, the stale replica is served first while the origin is checked in the background to refresh the copy. After 60 seconds, the stale copy cannot be used, so the network is waited for. Users do not wait; refreshing happens in the background. If the browser does not support this directive, it follows only `max-age`.

When the origin is down, there is `stale-if-error`. With `max-age=604800, stale-if-error=86400`, it is fresh for 7 days, and for the following day, if errors like 500, 502, 503, or 504 occur, the stale replica is served instead.

## Invalidation: Clearing incorrect copies

The longer you trust a copy, the more users see old content even after fixing the origin. There are mainly two solutions.

第一はファイル名を変更すること（cache busting）です。MDN は、バージョン番号を付与する `bundle.v123.js` のような方法や、コンテンツのハッシュ値をファイル名に含める方法を挙げています。コンテンツが変更されると URL が変わるため、古いコピーは無効化されます。したがって、このようなファイルには `Cache-Control: public, max-age=31536000, immutable`(1 年) を設定しても安全です。

第二は CDN に直接削除を指示すること（purge）です。Cloudflare のドキュメントを基準にすると、URL 単位、全体、キャッシュタグ、ホスト名、URL プレフィックス単位などがあります。ドキュメントでは URL 単位の削除を推奨しており、大規模な変更がある場合にのみ全削除を使用するよう述べています。削除の代わりに「陳腐化表示」を行う invalidation もあり、次のリクエスト時にオリジンを確認し、変更されていないものはそのまま使用します。削除リクエストにはプランごとの制限もあります（例：Free プランでは全体・タグ・ホスト・プレフィックスの削除が分間 5 回）。削除リクエストに 200 が返っても「受理された」だけであり、確認するには再度受け取って `CF-Cache-Status` が `HIT` でないかを確認する必要があります。

簡単な直接実行によるシミュレーションがあります。

<details>
<summary>詳細な解説：エッジキャッシュを模倣した Python コードと結果（実際に実行済み）</summary>

TTL 60 秒のエッジを単純化して作成しました。実際の CDN の動作ではなく、概念の確認用です。

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

結果は以下の通りでした。

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

63 秒でオリジンは既に v2 でしたが、エッジが v1 を返すことが無効化が必要な理由です。このシミュレーションでの命中率は 8 回中 5 回、0.625 です。

</details>

## 静的と動的を分けておく

CDN に何を任せるかはファイルの性質で区別します。

| | 静的（画像・JS・CSS・フォント） | 動的（API 応答・ログイン後のページ） |
|---|---|---|
| ユーザーごとに異なる | いいえ | はい |
| CDN キャッシュ | 長く、ハッシュファイル名 + immutable | 通常はなし、あっても短い |
| ヘッダー例 | `public, max-age=31536000, immutable` | `private` または `no-store` |

HTML は中間的な存在です。ファイル名を変更して更新できないため、MDN は HTML に `no-cache` + `ETag`(毎回確認) をデフォルトで推奨しています。ユーザー固有の内容であれば `private` も追加します。そして HTML が参照する JS・CSS はハッシュ名を用いて長くキャッシュします。HTML は毎回確認し、その中のファイルは長く使うという組み合わせです。ページをサーバーで作成するかブラウザで作成するかによってキャッシュ可能な範囲が異なる話は [詳細 → レンダリング方式](#/post/fe-rendering-modes) に続きます。

Cloudflare はデフォルトでファイル拡張子を見てキャッシュし、HTML と JSON はデフォルトでキャッシュしないという記載があります。さらにキャッシュするには Cache Rule を別途作成します。そして `Set-Cookie` が応答に含まれている場合や、`private`・`no-store`・`no-cache`・`max-age=0` が付与されている場合、または GET 以外のリクエストの場合はキャッシュしません。クッキー一つでキャッシュがブロックされることは頻繁に見られます。

## CDN 側からステータスを確認

CDN の応答ヘッダーからキャッシュがどのように処理されたか確認できます。Cloudflare の `CF-Cache-Status` の値は以下の通りです。

| 値 | 意味 |
|---|---|
| HIT | キャッシュにあるためそこから返す |
| MISS | キャッシュ対象だが存在しないためオリジンから取得する |
| EXPIRED | コピーが古いためオリジンから新しいものを受け取る |
| REVALIDATED | オリジンが「まだ有効」と確認してコピーを返す |
| STALE | オリジンに到達できないため古くなったコピーを返す |
| UPDATING | 古いものを返しつつ裏側で更新中 |
| DYNAMIC | キャッシュ対象ではないためすぐにオリジンへ進む |
| BYPASS | キャッシュ対象だったが、オリジンがキャッシュ不可とマークされたため保存しない |

ログインしたユーザーのページが `HIT` で返ってくると危険なシグナルです。他の人の画面が表示されてしまう可能性があります。MDN もパーソナライズされたコンテンツは共有キャッシュには入れず、クッキーがあるからといって自動的に `private` になるわけではないため、`Cache-Control: private` を直接付与するよう述べています。`Vary` をクッキーに掛けて区別しようとする方式も推奨されていないようです。

## よくある誤解

- `no-cache` は「キャッシュしない」という意味ではない。保存し、毎回再確認する（リファレvalidate）という意味である。保存禁止は `no-store` だ。
- キャッシュすれば常に高速になる：最初の要求は MISS なのでオリジンサーバーにアクセスする必要がある。ほとんど繰り返されない URL はヒット率が低いためメリットが小さい。
- ヘッダーがないとキャッシュできない：誤りである。MDN によると、`Last-Modified` ヘッダーがあれば、クライアントは更新頻度を推測するために 10% の不鮮度（stale）を許容してキャッシュできるとあるため、ヘッダーは常に明示する必要がある。Cloudflare も `Cache-Control` ヘッダーがない場合、200 レスポンスを 120 分間デフォルトでキャッシュするというルールがある。
- purge すれば即座にすべてのユーザーに反映される：削除要求に対する 200 レスポンスは受付確認のみである。ブラウザ内のコピーは CDN の削除操作では消えない。これは文書で直接確認した記述ではなく、「private キャッシュが別個のもの」という区別から推測されたものである。
- キャッシュキーは URL だけを見る：デフォルトは URL だが、`Vary` ヘッダーに指定された要求ヘッダーもキーに加算される。`Vary: Accept-Language` の場合、言語ごとに別々に保存される。`Vary: User-Agent` はバリエーションが多すぎてヒット率が崩壊するため避けるべきである。

## 続く話題

AI 分野にも同様の発想がある。同じプロンプトの前半部分を再度計算しない [詳細 → プロンプトキャッシング](#/post/ai-prompt-caching) がそれだ。リクエストを先頭で分ける [詳細 → ロードバランサー](#/post/infra-load-balancer) と並べて見ると、「オリジンサーバーへのアクセスを減らす」という同じ目的が見て取れる。Web パフォーマンスという観点については [詳細 → フロントエンドパフォーマンス](#/post/fe-performance) を参照のこと。

## 根拠リンク

- MDN, HTTP キャッシング: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- MDN, Cache-Control: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- web.dev, Stale-while-revalidate で最新の状態を保つ: https://web.dev/articles/stale-while-revalidate
- Cloudflare Docs, デフォルトのキャッシュ動作: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cloudflare Docs, Cloudflare キャッシュレスポンス: https://developers.cloudflare.com/cache/concepts/cache-responses/
- Cloudflare Docs, キャッシュの削除 (Purge): https://developers.cloudflare.com/cache/how-to/purge-cache/

← 概念マップへ (#/post/infra-map)

関連記事：[1 つの要求が通る道](#/post/infra-request-journey) · [ロードバランサー](#/post/infra-load-balancer) · [キャッシュと Redis](#/post/db-cache-redis)