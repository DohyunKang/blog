Once you've built a service, three questions remain: where to host it, how to deploy it, and how to monitor it afterward. This series covers these six concepts in order. Each section begins with a key term on its own line; for more details, follow the links below. The sequence starts with setting up servers and moves toward operations.

## Overview of the Flow

```
클라우드(서버를 빌린다)
   ├─ 앱을 묶어 옮긴다 ........ Docker·컨테이너
   └─ 서버 관리를 맡긴다 ...... 서버리스
코드 → 테스트 → 배포 ........... CI/CD
설정과 비밀번호를 코드 밖에 둔다 .. 환경변수·시크릿
뜬 뒤에 상태를 지켜본다 ........ 모니터링·로그·알림
```

## 1. Where to Host It

**Cloud Basics**: Instead of buying servers, you rent them based on usage. Services are categorized into IaaS, PaaS, and SaaS depending on how much infrastructure you manage. Concepts like regions (리전) and availability zones (AZ) define location, while costs follow a pay-as-you-go model.
[Learn more → Cloud Basics](#/post/cloud-basics)

**Docker and Containers**: Tools that bundle applications and their dependencies into isolated processes. They help avoid issues where something works on your local PC but fails on a server.
[Learn more → Docker and Containers](#/post/cloud-docker)

**Serverless**: This doesn't mean there are no servers; instead, the cloud provider handles scaling up/down and starting/stopping instances, while you only upload your function code. Execution—and costs—occur only when requests come in.
[Learn more → Serverless](#/post/cloud-serverless)

## 2. How to Deploy It

**CI/CD and Deployment Strategies**: Automates the process of merging code, testing, and releasing. Also covers three deployment strategies designed to prevent breaking the final release step.
[Learn more → CI/CD and Deployment Strategies](#/post/cloud-cicd)

**Environment Variables and Secrets Management**: Passwords and keys should never be stored in code. The workflow starts with `.env` files and progresses to secret managers and key rotation.
[Learn more → Environment Variables and Secrets Management](#/post/cloud-secrets)

## 3. How to Monitor It After Launch

**Monitoring, Logging, and Alerts**: Preparation to detect service issues before users do. Covers metrics, logs, and traces separately, and outlines what events should trigger alerts.
[Learn more → Monitoring, Logging, and Alerts](#/post/cloud-observability)

## Helpful Reference Maps

Request paths and scaling logic are in the [Service Infrastructure Map](#/post/infra-map), internal server architecture is covered in the [Backend Map](#/post/be-map), and security topics like key leaks are in the [Information Security Map](#/post/sec-map).

← Concept Map ([AI Map](#/post/ai-map))