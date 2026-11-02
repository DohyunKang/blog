Backend is "server-side code that receives requests and returns responses." As you study, topics like REST, authentication, queues, logging, and testing pop up separately. So, I've built this guide around the flow of a request, noting where each concept fits in just one line per section. If you want to learn more, follow the links.

## Overview of Relationships

```
클라이언트 ──요청──▶ [API·REST: 주소+메서드로 말한다]
                         │ 누구냐 / 해도 되냐 → [인증과 인가]
                         ▼
             [요청 흐름: 미들웨어 → 라우터 → 핸들러 → DB]
                         │ 코드는 이렇게 나눈다
                         ▼
             [레이어드 아키텍처] ← 좋은 모듈 기준: [응집도·결합도]
                         │ 오래 걸리는 일은 [비동기·큐]로
                         ▼
                 응답 (실패하면 [에러 처리·로깅])

이 전부를 믿을 수 있게 확인하는 방법 = [백엔드 테스트]
```

## 1. How It Communicates with the Outside World

**API and REST**: A convention that uses addresses (URIs) to point to resources and HTTP methods to specify actions. Idempotency—whether sending the same request twice yields the same result—is subtly critical in design.
[Learn more → API and REST](#/post/be-api-rest)

**Authentication and Authorization**: Login (who you are) and permissions (what you can do) are distinct concerns. Sessions, JWTs, OAuth, and RBAC each handle different parts of this distinction.
[Learn more → Authentication and Authorization](#/post/be-auth)

## 2. How It Flows Inside the Server

**Request Processing Flow**: A client's request passes through middleware lines, reaches a router, goes to a handler, interacts with the database, and returns via the same path.
[Learn more → Request Processing Flow](#/post/be-request-flow)

**Layered Architecture**: Code is organized into layers—controllers, services, and repositories—with dependencies flowing only from top to bottom. This may be overkill for small projects.
[Learn more → Layered Architecture](#/post/be-layered-architecture)

**Modular Cohesion and Coupling**: A good guideline is that each module should do one thing well and connect lightly with others.
[Learn more → Modular Cohesion and Coupling](#/post/be-coupling-cohesion)

## 3. When It Slows Down or Fails

**Asynchronous Processing and Message Queues**: Long-running tasks are queued for separate workers to handle. Be prepared that the same message might be delivered twice.
[Learn more → Asynchronous Processing and Message Queues](#/post/be-async-queue)

**Error Handling and Logging**: The job is deciding where to catch errors and what to log. This includes retries, timeouts, log formats, and error responses—all bundled together.
[Learn more → Error Handling and Logging](#/post/be-error-logging)

## 4. Making It Reliable

**Backend Testing**: Code that verifies whether previously working functionality still works after changes. The basic approach is to prioritize unit tests and integration tests for speed and cost, with E2E tests used selectively.
[Learn more → Backend Testing](#/post/be-testing)

## Where to Look Next

- Server environments: [Cloud & Deployment Map](#/post/cloud-map)
- Data-related topics: [Database Map](#/post/db-map)
- Frontend interface: [Frontend Map](#/post/fe-map)

← Concept Map ([#/post/ai-map])