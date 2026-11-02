CI/CD 是自动执行代码合并、测试和发布的过程，而部署策略则是控制最后“发布”这一阶段的方法。

## 先说个前提

CI 代表持续集成（Continuous Integration）。它将多人编写的代码频繁合并，并在每次合并时自动构建和测试，以便立即发现错误。

CD 有两种读法。持续交付（Continuous Delivery）是指将通过测试的产物保持在随时可发布的状态，最后的发布按钮由人工点击；持续部署（Continuous Deployment）则连这个按钮都去掉，一旦通过便直接上线服务。文中 CD 指代两者之一，阅读时需注意区分具体语境。

自动化之所以必要，是因为手动操作容易遗漏步骤。诸如“是否运行了测试？”、“构建环境与我的 PC 不同步？”等问题常在发布时爆发。只需编写一次脚本，任何人都能按相同顺序执行。

## 流水线长这样

流水线是由一系列阶段组成的路径，若前一阶段失败，后续阶段不会执行。

| 阶段 | 操作内容 | 失败后果 |
|---|---|---|
| 代码推送 | 推送到分支或创建 PR | （起始点） |
| 构建 | 安装依赖、编译，必要时 [构建 Docker 镜像](#/post/cloud-docker) | 在此停止 |
| 测试 | 运行单元测试和集成测试、代码检查（[详情 → 后端测试](#/post/be-testing)） | 在此停止 |
| 产物归档 | 为镜像或包添加版本号并存储 | 在此停止 |
| 部署 | 按顺序从预发环境发布到生产环境 | 回滚 |
| 验证 | 执行健康检查、查看指标（[详情 → 可观测性](#/post/cloud-observability)） | 回滚 |

前半部分（构建·测试）属于 CI，后半部分（产物·部署）属于 CD。驱动流水线运转的核心是 [Git](#/post/cs-git) 事件。发生推送或 PR 等操作时，会触发自动启动。

值得注意的一点是：已生成的产物在不同环境中无需重新构建，而是直接复用。只有当预发环境中的镜像通过测试且与生产环境使用的镜像一致时，“在预发通过了”这类问题才会减少。各环境之间的差异在于配置和 [密钥](#/post/cloud-secrets)，而非镜像本身。

## GitHub Actions 长这样

GitHub Actions 是在 GitHub 仓库内运行流水线的服务。官方文档将其组件划分为以下几类：

- workflow：执行一个或多个 job 的自动化单元，以 YAML 文件形式存放在仓库的 `.github/workflows` 文件夹中。
- event：触发 workflow 运行的仓库活动，如创建 PR 或推送代码。
- job：在同一 runner 上并行运行的一组 step。
- step：在 job 内按顺序执行的单个任务，可以是 shell 脚本或 action。
- action：可复用的任务，通常引用他人已构建好的内容。
- runner：实际执行 job 的服务器。

大致会生成如下文件结构（此处仅为展示结构的示例，并未实际运行）：

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

`needs: test` 直接体现了流水线中“前一阶段失败则后续不执行”的逻辑。部署所需的密钥不应写在 YAML 文件中，而应从仓库的密钥设置中提取使用。若将密钥硬编码在代码中，极易导致泄露。

<details>
<summary>详情：job 并行运行方式与常见阻塞问题</summary>

job 默认相互独立，因此会同时运行。仅在需要控制顺序时才使用 `needs`。由于每个 job 都会在新 runner 上启动，前一个 job 生成的文件不会自动传递给后一个 job。若要传递数据，需将产物（artifact）上传并下载。正因如此，常会遇到“明明构建了却找不到文件”的阻塞情况。

若依赖安装每次都很慢，也可以添加缓存优化。
</details>

## 三种部署策略

即使通过测试，在生产环境中仍可能出现问题。因此，不应一次性替换所有新版本，而应采用专门的发布方法，以便在出现问题时减少损失并快速回滚。

| 方式 | 核心逻辑 | 优点 | 缺点 |
|---|---|---|---|
| 滚动更新 | 逐步将实例替换为新版本 | 所需额外资源少 | 更新期间新旧版本混合运行 |
| 蓝绿部署 | 准备两套相同环境，仅切换路由 | 回滚迅速 | 需维护两套环境，资源翻倍 |
| 金丝雀发布 | 先向少数用户开放 | 影响范围小 | 需要流量分割机制和监控指标 |

### 滚动更新

旧实例不是一次性下线，而是逐个替换为新实例。这是 Kubernetes Deployment 默认采用的方式。根据文档描述，系统会等待新 Pod 启动后，再下线旧 Pod，而 Service 只会将流量转发到能够接收请求的 Pod 上。因此，必须拥有多个副本才能实现无中断更新。

速度与安全性由两个参数调节：`maxUnavailable` 表示在更新过程中允许同时下线的 Pod 数量；`maxSurge` 表示允许额外启动超过目标数量的 Pod 数。这两个参数可以使用数字或百分比表示。若设置 `maxUnavailable: 0` 且 `maxSurge: 1`，则容量不会减少，这是一种较为谨慎的方式。教程正文中默认值标注为 1，但 Deployment API 的默认值均为 25%，因此应以所用版本的文档为准。

```yaml
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1   # 동시에 최대 1개까지 내려감
      maxSurge: 1         # 최대 1개까지 더 띄움
```

回滚功能也包含在同一工具中。更新操作会记录版本信息，执行 `kubectl rollout undo deployments/<이름>` 即可恢复到之前的状态。若要回滚到特定修订版，需添加 `--to-revision=N` 参数。上述 YAML 文件和命令是从前文文档中摘录的，我尚未在集群中实际运行过。

### 蓝绿部署（Blue-Green）

创建两个尽可能完全相同的运行环境：一个当前正在接收用户请求（蓝色），另一个处于闲置状态（绿色）。新版本先部署到闲置的绿色环境中进行最终测试；若测试通过，则修改路由器将所有请求指向绿色环境。Martin Fowler 的文章指出，若出现问题，可将路由器切换回蓝色环境以快速恢复。切换完成后，蓝色环境将成为下一个版本的待发布环境，两者交替使用。其中“切换路由器”这一环节正是 [负载均衡器](#/post/infra-load-balancer) 所承担的工作。

较为棘手的是数据库问题。若两个环境共享同一数据库，则在修改 schema 时，旧应用和新应用必须同时运行。Fowler 的文章建议先部署向下兼容的 schema 变更，然后再上线新应用。此外，在切换过程中如何处理积压的交易也需要另行规划，这与 [事务](#/post/db-transaction) 密切相关。

### 金丝雀发布（Canary）

名称源自矿坑中的金丝雀。该方法先将新版本部署到部分基础设施上，初期不向任何用户发送流量；随后逐步向少数用户开放。选择策略可以是随机分配、优先内部员工、基于用户特征等；在大规模场景下，也可按地区或品牌进行划分。若运行正常，则逐步扩大范围直至全部用户切换到新版本，最后下线旧基础设施；若出现问题，则将用户重新导回旧版本。

如果说蓝绿部署是“一次性完全切换”，那么金丝雀发布则是“渐进式切换”。两者的主要区别在于中间阶段两个版本会同时运行，并且可以通过缓慢增加负载来在实际运营环境中测试容量。然而，要决定发送多少流量以及何时扩大范围，必须依赖错误率等指标。缺乏这些指标的金丝雀发布本质上只是慢速部署。

## 回滚需提前规划

上述三种方式的回滚机制各不相同，因此在部署前制定“若出问题如何应对”的计划至关重要。

- **滚动更新（Rolling）**：回滚到上一修订版后，系统会再次以滚动方式重新部署，此过程同样需要时间。
- **蓝绿部署**：只需切换路由器即可，因此速度最快。
- **金丝雀发布**：将正在接收流量的用户导回旧版本。其优势在于受影响的用户数量较少。

若涉及不可逆的变更（如删除数据库列的迁移），则上述策略将变得复杂。代码虽可回滚至旧版本，但数据却无法恢复。因此，schema 变更通常采用“先添加、后删除”的方式分两步完成更为稳妥。是否执行回滚的判断依据终究是监控指标，需结合错误率和响应时间来决定。

## 常见误区

- **拥有 CI/CD 就能保证部署安全**：自动化仅能重复相同流程；若测试不充分，有缺陷的代码仍会自动发布到生产环境。
- **蓝绿部署就不用担心数据库问题**：即使有两个运行环境，若共享同一数据库，schema 兼容性问题依然存在。
- **滚动更新一定保证无中断**：若副本数量不足或 `maxUnavailable` 设置导致可用容量减少，则可能出现中断。
- **金丝雀发布与蓝绿部署是同一概念**：两者在“先单独部署新版本”这一点上相似，但区别在于是一次性切换还是按比例逐步扩大范围。
- **部署（Deployment）与发布（Release）是一回事**：将代码上传至服务器与向用户展示服务是两个独立步骤；本文未对此做深入探讨。

## 参考资料链接

- [Martin Fowler — BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Martin Fowler — CanaryRelease](https://martinfowler.com/bliki/CanaryRelease.html)
- [Kubernetes — Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
- [GitHub Docs — Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)

← [概念映射](#/post/cloud-map)

相关文章：[Docker 与容器](#/post/cloud-docker) · [环境变量与密钥管理](#/post/cloud-secrets) · [监控·日志·告警](#/post/cloud-observability)