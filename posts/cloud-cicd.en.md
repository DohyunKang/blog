CI/CD is the process of automatically merging, testing, and shipping code, while deployment strategies define how to handle that final "shipping" step safely.

## First, some basics

CI stands for Continuous Integration. It involves frequently merging code from multiple contributors and automatically running builds and tests each time to immediately detect breakages.

CD can be read in two ways. **Continuous Delivery** prepares the output so it is always ready to be deployed at any time, but a human must press the final deploy button. **Continuous Deployment** removes that button entirely, deploying directly to production as soon as tests pass. Since "CD" refers to either of these depending on context, it's best to clarify which one is being discussed when reading.

Automation is necessary because manual processes are prone to skipping steps. Issues like "Did we run the tests?" or "Is the build environment different from my PC?" often surface during deployment. By scripting the process once, anyone can execute it in the same order reliably.

## A pipeline looks like this

A pipeline is a sequence of stages; if an earlier stage fails, subsequent stages do not run.

| Stage | Action | On Failure |
|---|---|---|
| Code Push | Push to branch or open a PR | (Start point) |
| Build | Install dependencies, compile, optionally create a [Docker image](#/post/cloud-docker) | Stops here |
| Test | Run unit/integration tests, linting ([details → backend testing](#/post/be-testing)) | Stops here |
| Artifact Storage | Tag and store images/bundles with version info | Stops here |
| Deploy | Ship sequentially from staging to production | Rollback |
| Verification | Health checks, view metrics ([details → observability](#/post/cloud-observability)) | Rollback |

The first half (build & test) constitutes CI, while the second half (artifacts & deploy) constitutes CD. The driving force behind the pipeline is a [Git](#/post/cs-git) event; actions like pushes or PRs act as triggers to start the process automatically.

One key point to note: artifacts built once are moved across environments without rebuilding. This ensures that the image tested in staging is identical to the one deployed to production, reducing issues like "it worked in staging but not here." Differences between environments should be handled via configuration and [secrets](#/post/cloud-secrets), not by rebuilding images.

## GitHub Actions looks like this

GitHub Actions is a service for running pipelines within a GitHub repository. The official documentation structures components as follows:

- **workflow**: An automation unit that executes one or more jobs, stored as YAML files in the `.github/workflows` folder of the repository.
- **event**: A repository activity that triggers a workflow, such as opening a PR or pushing code.
- **job**: A group of steps running together on the same runner.
- **step**: A single task executed sequentially within a job, either as a shell script or an action.
- **action**: A reusable task; you can use actions created by others.
- **runner**: The server where jobs are actually executed.

The following is a rough example file structure intended to illustrate the layout; it has not been tested for execution.

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:          # PR이 열리거나 갱신되면
  push:
    branches: [main]     # main에 합쳐지면
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4     # 코드 내려받기
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
  deploy:
    needs: test                        # test가 성공해야 시작
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "여기서 배포 명령"
```

The `needs: test` directive directly translates the concept that "if an earlier stage fails, later stages do not run." Keys required for deployment should not be hardcoded in YAML but instead retrieved from repository secret settings to prevent accidental leakage.

<details>
<summary>Detailed view: parallel job execution and common pitfalls</summary>

Jobs are independent by default and run concurrently. Use `needs` only when you need to enforce a specific order. Since each job starts on a new runner, files created in an earlier job do not automatically persist for subsequent jobs. To pass data between jobs, you must upload artifacts and download them explicitly. This often leads to confusion like "I definitely built it, but the file is missing."

You can also attach caches if dependency installations are consistently slow.
</details>

## Three Deployment Strategies

Even after passing tests, issues may arise in production. Therefore, instead of swapping versions all at once, we use specific shipping methods that minimize damage and enable quick rollback if problems occur.

| Method | Core Concept | Advantage | Drawback |
|---|---|---|---|
| Rolling | Gradually replace instances with the new version | Requires minimal additional resources | New and old versions coexist during rollout |
| Blue-Green | Maintain two identical environments; switch only the router | Rollback is fast | Requires double the resources for two environments |
| Canary | Expose the new version to a small subset of users first | Limits scope of potential damage | Requires traffic splitting mechanisms and monitoring |

### Rolling

Roll out updates one by one without taking down the entire instance at once. This is the default approach used by Kubernetes Deployments. As documented, new Pods are created and allowed to become ready before old Pods are terminated; traffic is routed only to Pods that can receive requests. Therefore, having multiple replicas is necessary for zero downtime.

Speed and safety are controlled via two parameters: `maxUnavailable`, which specifies the number of Pods that may be unavailable simultaneously during an update, and `maxSurge`, which indicates how many additional Pods beyond the desired count can be created. These values can be specified as numbers or percentages. Setting `maxUnavailable: 0` with `maxSurge: 1` results in a cautious strategy where capacity never drops below the original level. The tutorial body mentions default values of 1, but the Deployment API defaults to 25% for both parameters, so it's best to consult the documentation for your specific version.

```yaml
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1   # 동시에 최대 1개까지 내려감
      maxSurge: 1         # 최대 1개까지 더 띄움
```

Rollbacks are also handled within the same tooling. Updates are recorded by revision; running `kubectl rollout undo deployments/<이름>` reverts to the previous state. To revert to a specific revision, append `--to-revision=N`. The YAML and commands above were copied from the referenced documentation and have not been tested in my own cluster.

### Blue-Green Deployment

This approach involves creating two identical production environments: one active (Blue) handling live traffic, and one idle (Green). The new version is deployed to the Green environment for final testing. Once validated, the router is switched to direct all requests to Green. As Martin Fowler explains, if issues arise, the router can be quickly reverted to Blue. After the switch, Blue becomes the standby environment for the next release, and the two environments alternate roles. The "switching the router" step corresponds to what a [load balancer](#/post/infra-load-balancer) does.

A critical consideration is the database. If both environments share the same database, schema changes must be backward compatible so that both old and new applications can run simultaneously during the transition. Fowler recommends deploying backward-compatible schema changes first, followed by the new application. Additionally, handling transactions accumulated during the switch requires separate planning, which connects to [transactions](#/post/db-transaction).

### Canary Deployment

Named after canaries in coal mines, this method deploys the new version to a subset of infrastructure and initially sends no traffic to it. Gradually, a small portion of users is routed to the new version. Selection criteria for initial routing can be random, internal staff first, or based on user characteristics; at scale, segmentation may occur by region or brand. If no issues arise, traffic is incrementally increased until all users are on the new version, after which the old infrastructure is decommissioned. If problems occur, users are immediately routed back to the old version.

While Blue-Green represents an "all-at-once" switch, Canary is a "gradual" rollout. The key difference is that both versions run simultaneously during the transition. Canary deployments allow for capacity testing under increasing load. However, determining how much traffic to send and when to scale up requires metrics such as error rates; without such metrics, a canary deployment is essentially just a slow release.

## Plan Rollbacks in Advance

Since each strategy has distinct rollback mechanisms, it's crucial to define "what happens if things go wrong" before deploying:

- **Rolling**: Reverting to the previous revision triggers another rolling update, which takes time.
- **Blue-Green**: Simply switching the router back makes this the fastest rollback method.
- **Canary**: Users currently on the new version are routed back to the old version. The advantage is that only a small number of affected users experience disruption.

If irreversible changes are involved—such as a migration that deletes database columns—rollback becomes significantly more complex. While code can revert to an older version, data cannot be restored. Therefore, schema migrations should follow the principle of "add first, delete later," splitting operations into two steps. Ultimately, rollback decisions rely on monitoring metrics; whether to roll back is determined by analyzing error rates and response times.

## Common Misconceptions

- **CI/CD ensures safe deployments**: Automation merely repeats the same sequence; poor testing results in faulty code being automatically deployed to production.
- **Blue-Green eliminates DB concerns**: Even with two environments, sharing a database leaves schema compatibility issues unresolved.
- **Rolling guarantees zero downtime**: Downtime can occur if there's only one replica or if `maxUnavailable` is configured to reduce capacity.
- **Canary and Blue-Green are the same**: While both involve deploying a new version separately initially, they differ in whether the switch happens all at once or gradually via percentage-based scaling.
- **Deployment equals release**: Deploying code to servers and making it visible to users are separate processes; this article does not delve further into that distinction.

## Reference Links

- [Martin Fowler — BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Martin Fowler — CanaryRelease](https://martinfowler.com/bliki/CanaryRelease.html)
- [Kubernetes — Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
- [GitHub Docs — Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)

← [Concept Map](#/post/cloud-map)

Related posts: [Docker and Containers](#/post/cloud-docker) · [Environment Variables and Secrets Management](#/post/cloud-secrets) · [Monitoring, Logging, and Alerts](#/post/cloud-observability)