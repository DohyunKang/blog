An API is a gateway for programs to communicate with each other, and REST is the promise to build that gateway by specifying targets via "addresses" (URLs) and actions via HTTP methods. This article organizes the components of that promise in the order of: method, address, status code, and idempotency.

## What is an API?

An API (Application Programming Interface) is a set of rules that allows one program to invoke the functionality of another. In terms of a restaurant, it's akin to the menu and the ordering process. You may not know how the food is prepared in the kitchen, but if you order according to the menu, you receive the dish.

When referring to APIs on the web, we usually mean those exchanged over HTTP. A client (app, browser, or another server) sends a request, and the server returns a response. For details on how this path actually looks, see [Network Basics →](#/post/cs-network); for the process of how requests are handled inside the server, see [Request Processing Flow →](#/post/be-request-flow).

## REST is a Promise

REST is not a protocol or a library; it is a design style. It has several rules: targets (resources) are referenced by addresses (URLs), actions are specified using HTTP methods, and the server processes all necessary information for each request without maintaining state between requests. APIs that adhere well to these rules are called RESTful.

In practice, most APIs loosely follow these rules. If an API exchanges JSON and uses nouns in URLs, it is commonly referred to as a "REST API," regardless of whether it fully adheres to the original paper's constraints. This article also bases its criteria on common usage rather than strict adherence.

## Resources and Addresses

In REST, addresses are constructed around targets (resources) rather than actions. If there is a target like "user," you would access it like this:

| Address | Meaning |
|---|---|
| `/users` | Collection of all users |
| `/users/42` | The 42nd user |
| `/users/42/orders` | Orders belonging to the 42nd user |

Verbs like `/getUser` or `/deleteUser` are not included in the address. Whether to retrieve or delete is determined by the method, not the address. It is customary to use plural nouns and lowercase letters with hyphens where appropriate.

## HTTP Methods

Even for the same address, the action performed depends on the method used.

| Method | Action | Example |
|---|---|---|
| GET | Read | `GET /users/42` |
| POST | Create new | `POST /users` |
| PUT | Replace entirely (also creates if not exists) | `PUT /users/42` |
| PATCH | Partial update | `PATCH /users/42` |
| DELETE | Remove | `DELETE /users/42` |

The difference between PUT and PATCH becomes apparent when you only want to change certain fields. PUT overwrites the entire user with new content, so missing fields may disappear; PATCH updates only the fields sent. However, since this distinction is based on convention, implementations may vary across APIs.

## Status Codes

Responses include numeric codes. The first digit indicates the major category: 2xx for success, 3xx for redirection, 4xx for client errors, and 5xx for server errors. Based on the MDN status code documentation, here are the most common ones encountered in APIs:

| Code | Meaning |
|---|---|
| 200 OK | Success |
| 201 Created | Success with a new resource created (usually after POST) |
| 204 No Content | Success but no content returned (common after deletion) |
| 400 Bad Request | Invalid request format |
| 401 Unauthorized | Not authorized (despite the name, closer to "unauthenticated") |
| 403 Forbidden | Identified but lacks permission |
| 404 Not Found | Resource not found |
| 409 Conflict | Conflict with current server state |
| 422 Unprocessable Content | Format is valid but content is semantically incorrect |
| 429 Too Many Requests | Excessive requests in a short time |
| 500 Internal Server Error | General error the server could not handle |
| 503 Service Unavailable | Server temporarily unavailable (maintenance or overload) |

401 and 403 are often confused. If you haven't logged in, you'll get 401; if you've logged in but are trying to access someone else's data, you'll get 403. The background for these codes is covered in [Authentication and Authorization →](#/post/be-auth). 429 continues into [Rate Limiting and Traffic Control →](#/post/infra-rate-limit).

## Idempotency

This is the concept I've held onto the longest in this article. Idempotent (멱등) means that sending the same request once or multiple times results in the same effect on the server. MDN explains that this allows clients to safely resend requests if they don't receive a response.

By method, GET, PUT, and DELETE are idempotent, while POST and PATCH are not guaranteed to be. GET is read-only (safe), so it is naturally idempotent.

- **PUT**: Sending "set the name of item 42 to lee" twice results in the same state: the name is lee.
- **DELETE**: Sending it twice leaves the resource deleted. Although response codes may differ (e.g., 204 on the first request and 404 on the second), the final effect on the server is identical. This example also appears in MDN documentation.
- **POST**: Creates a new resource each time it is sent. Sending it twice results in two resources being created.

Therefore, if the network drops and a POST response is not received, automatically retrying the POST can result in duplicate orders. Some payment or order APIs attach a unique key (such as an `Idempotency-Key` header) to each request so the server can filter out duplicates. Since this header is not standardized and may vary by service, only its name is mentioned here.

Idempotency concerns the "intended effect on the server." It does not matter if logs are created for every request. Furthermore, HTTP specifications do not enforce this behavior; a GET endpoint that modifies data with each call can be implemented, leaving the client to suffer the consequences.

## Example Demonstrated Directly

A small server was run using only Python's standard library, and the same requests were sent twice (verified on Python 3.13.15).

<details>
<summary>Expand to see code and execution results</summary>

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

Execution results:

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

Three observations from the results: sending POST twice created two users with IDs 1 and 2; sending PUT twice yielded identical responses and left the state unchanged; for DELETE, the first request returned 204 and the second returned 404, but the final state confirmed by the last GET showed that item 1 no longer exists. The rule returning 422 for requests with an empty body was arbitrarily defined by me. Whether to use 400 or 422 depends on team conventions.

A raw view of a request-response pair looks like this:

```
POST /users HTTP/1.1
Content-Type: application/json

{"name": "kim"}

HTTP/1.1 201 Created
Content-Type: application/json

{"id": 1, "name": "kim"}
```

## Common Misconceptions

- It is easy to assume REST APIs must use JSON, but JSON is merely a common choice, not a requirement for REST.
- While "POST creates" and "PUT updates" are often memorized, PUT can also create new resources. When the client determines the address, PUT is typically used; when the server assigns an ID, POST is used.
- Some APIs return a 200 status code with `"success": false` in the body. While this works, clients, caches, and monitoring tools often rely on status codes for judgment, so conveying meaning via the response body is preferable. How to structure error response bodies continues in [Error Handling and Logging](#/post/be-error-logging).
- Using 401 and 403 interchangeably prevents clients from distinguishing between "need to log in again" and "need to request authorization."

LLM tool calls that invoke external functions often ultimately result in such API calls. For more details, see [Function Calling](#/post/ai-tool-use).

## Reference Links

- MDN, Idempotent: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- Code executed locally (Python 3.13.15)

Related articles: [Authentication and Authorization](#/post/be-auth) · [Request Processing Flow](#/post/be-request-flow) · [Error Handling and Logging](#/post/be-error-logging)