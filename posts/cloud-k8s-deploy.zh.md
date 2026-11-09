在 Kubernetes 中，部署（Deployment）是通过修改 Pod 模板来实现的，随后滚动更新会逐个替换 Pod。此时，新 Pod 是否可以接收流量由 probe 判断，而根据负载调整 Pod 数量则由 HPA 负责。本文整理了这三者如何协同工作。Pod、Deployment 和 Service 的概念请参考 [前文](#/post/cloud-k8s-intro)。

## 升级新版本时会发生什么

当 Deployment 的 Pod 模板（`.spec.template`）发生变化时，滚动回滚（rollout）便会开始。根据文档描述，新的 ReplicaSet 会被创建，Deployment 会逐步增加新版本的副本数并减少旧版本的副本数，从而以受控的速度替换 Pod。无论是更改镜像标签还是环境变量，只要模板发生变化，流程便相同。相反，文档指出像调整规模等其他变更不会触发滚动回滚。

进展状态如下所示：

```bash
kubectl apply -f deploy.yaml
kubectl rollout status deployment/web
```

当文档示例中的操作完成时，会显示 `successfully rolled out` 的消息。关于部署策略的更多内容请参见 [CI/CD 文章](#/post/cloud-cicd)。

## 滚动更新的两个数值

更新速度由两个值决定，它们控制着不是一次性全部替换，而是逐步进行的速度。

| 字段 | 含义 | 默认值 | 百分比表示时 |
|---|---|---|---|
| `maxUnavailable` | 允许在更新过程中不可用的 Pod 最大数量 | 25% | 向下取整 |
| `maxSurge` | 可以额外启动的 Pod 数量（超过目标数量） | 25% | 向上取整 |

文档指出两者都可以使用绝对数字或百分比，并说明如果其中一方为 0，另一方不能也为 0。使用默认值意味着“至少有 75% 的期望 Pod 处于运行状态，最多可达 125%"。

当 replicas 为 3 时，我根据文档的舍入规则进行了计算：

- maxUnavailable: 3 的 25% = 0.75，向下取整为 0
- maxSurge: 0.75，向上取整为 1

因此，流程是先额外启动一个新 Pod（总数变为 4 个），待其准备就绪后，再减少一个旧 Pod，从而在保持 3 个可用 Pod 的状态下完成替换。此计算结果是基于文档规则得出的，并未直接在集群中验证。如果显式设置这些配置，则如下所示：

```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## 谁来判断“已准备好”：probe

滚动更新只有在判断新 Pod 已准备就绪后，才会继续处理下一个 Pod。仅仅容器启动并不意味着应用程序可以接收请求，因此 Kubernetes 让 kubelet 定期执行 probe 进行检查。共有三种类型，且失败时的处理方式各不相同。

| probe | 检查内容 | 失败时行为 |
|---|---|---|
| startup | 应用程序是否已完成启动 | kubelet 终止容器并遵循重启策略 |
| liveness | 是否仍然存活（是否需要重启） | 超过允许次数后，kubelet 会重启容器 |
| readiness | 当前是否可以接收流量 | EndpointSlice 控制器会从 Service 的目标中移除该 Pod 的 IP |

readiness 失败并非导致重启，而是“拒绝服务”，这与 liveness 不同。根据文档，如果配置了 startup probe，则在它成功之前不会执行 liveness 和 readiness probe。对于启动时间较长的应用程序，使用 startup probe 是为了防止 liveness probe 在启动过程中失败并导致不断重启。文档建议，如果容器通常需要超过 `initialDelaySeconds + failureThreshold × periodSeconds` 的时间才能启动，则应指定检查同一端点的 startup probe。该文章中明确指出的 `periodSeconds` 默认值为 10 秒。

HTTP probe 在响应码介于 200（含）至 400（不含）之间时视为成功，否则视为失败。

我构建了如下配置：

```yaml
        startupProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
          failureThreshold: 12
        readinessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /
            port: 80
          periodSeconds: 10
```

startup probe 需要在 60 秒内（间隔 5 秒，最多尝试 12 次）成功。此值是针对 nginx 的任意示例，实际应用程序需要根据其启动时间进行调整。该 YAML 仅用于验证语法，并未在集群中实际运行。

readiness 与滚动更新的交互点至关重要。只有当新 Pod 通过 readiness 检查后，才会被视为“已就绪”，从而继续下一轮替换。如果应用程序没有健康检查路径，则无法进行此判断，因此必须在应用程序侧创建类似 `/healthz` 的路径，这与负载均衡器的 [健康检查](#/post/infra-load-balancer) 思路相同。

## 滚动回滚失败或停止时

如果部署（Deployment）的发布过程没有按照预期显示新图像，它会持续重试。文档中相关的字段如下：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `minReadySeconds` | 0 | 进入“可用”状态后，需在此时间内无崩溃地运行 |
| `progressDeadlineSeconds` | 600 | 若在此期间未观察到进展，则报告失败 |
| `revisionHistoryLimit` | 10 | 用于回滚的旧 ReplicaSet 保留数量 |

文档指出，超过 `progressDeadlineSeconds` 后，Kubernetes 仅会在状态条件中记录 `ProgressDeadlineExceeded`，而不会采取其他措施。它不会自动回退，回退操作需由人工或流水线完成。

```bash
kubectl rollout undo deployment/web
kubectl rollout undo deployment/web --to-revision=2
```

根据文档，Deployment 的回滚仅将 Pod 模板部分恢复到之前的修订版本。若 Deployment 处于暂停状态，必须先取消暂停才能执行回滚。若将 `revisionHistoryLimit` 设置为 0，旧的 ReplicaSet 将被删除，从而无法进行回滚。

## 修改副本数的方法：手动与 HPA

手动方式类似于 `kubectl scale deployment/web --replicas=5`。自动方式则由 HorizontalPodAutoscaler（HPA）处理。HPA 并非持续运行的进程，而是一个控制循环；根据文档，它每 15 秒读取一次目标 Pod 的指标，并据此调整 Deployment 等目标的副本数。计算公式为比例关系。

```
desiredReplicas = ceil( currentReplicas × currentMetricValue / desiredMetricValue )
```

例如，若 4 个 Pod 的平均 CPU 使用率为 90%，而目标值为 60%，则计算结果为 4 × 90/60 = 6，因此将副本数增至 6。这是我代入数值后得出的结果。

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

使用 HPA 时需满足若干条件：

- 提供指标的 `metrics.k8s.io` API 通常由名为 Metrics Server 的附加组件（addon）提供，需要单独安装。
- 若要以百分比（%）设定使用率目标，则容器必须配置资源请求（resources request）。否则，该 Pod 的 CPU 使用率将未定义，HPA 也不会针对该指标采取任何行动。前述 YAML 示例中的 Deployment 添加 `resources.requests.cpu: 100m` 即为此原因。
- 若由 HPA 管理副本数，文档建议删除 Deployment 清单中的 `spec.replicas`，以避免两者相互覆盖。
- 默认行为具有不对称性：文档默认的 `behavior` 配置中，缩容时设置 300 秒的稳定窗口，而扩容时则为 0 秒。这意味着扩容立即生效，缩容则需观察 5 分钟。在目标值附近 ±10%（默认容差）范围内不会触发调整。

<details>
<summary>详细解析：HPA 默认 behavior 块</summary>

文档展示的默认 `behavior` 配置如下：

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300
    policies:
    - type: Percent
      value: 100
      periodSeconds: 15
  scaleUp:
    stabilizationWindowSeconds: 0
    policies:
    - type: Percent
      value: 100
      periodSeconds: 15
    - type: Pods
      value: 4
      periodSeconds: 15
    selectPolicy: Max
```

扩容时，每 15 秒可将副本数增加至当前数量的 100%，或最多增至 4 个 Pod（取决于 `selectPolicy: Max`）；缩容时，每 15 秒可减少至 100%，但受前述 300 秒窗口限制以防止急剧下降。默认容差 10% 可通过 kube-controller-manager 的 `--horizontal-pod-autoscaler-tolerance` 参数调整。以上所有值均基于文档说明，我尚未亲自施加负载进行验证。

</details>

<details>
<summary>详细解析：如何验证本文中的 YAML</summary>

我将 Deployment（含滚动更新、probe、resources）与 HPA 合并为一个文件，并使用 Python 的 `yaml.safe_load_all` 读取，确认 Deployment 和 HorizontalPodAutoscaler 两个资源能按结构正确解析。本机仅安装了 `kubectl` 客户端（v1.36.1），无可用集群，因此 `kubectl apply --dry-run=client` 因 API 访问失败而终止。故未在真实集群中执行测试。字段名称和默认值均来自 Kubernetes 官方文档。

</details>

## 常见误解

- 滚动更新即无中断：新 Pod 的 readiness 需正确配置，且 maxUnavailable 等参数设置得当。若无 probe，则无法区分“已启动”与“可接收流量”。
- liveness 与 readiness 作用相同：liveness 用于触发重启，readiness 用于从流量中剔除。
- 若 rollout 失败会自动回滚：文档中仅记录 `ProgressDeadlineExceeded` 条件，回滚需单独执行。
- HPA 会立即扩容：扩容周期为 15 秒，缩容时默认有 5 分钟稳定窗口。结合 [自动伸缩](#/post/infra-autoscaling) 的一般概念一并理解会更清晰。

## 总结

简言之，部署是替换模板的过程；替换速度由 maxSurge 和 maxUnavailable 决定；是否可替换取决于 readiness；数量则由 HPA 决定。单独看这四个要素看似简单，但运行时彼此相互影响。观测则与 [监控、日志、告警](#/post/cloud-observability) 紧密相连。

[详情 → 容器编排与核心对象](#/post/cloud-k8s-intro) · [详情 → CI/CD 与部署策略](#/post/cloud-cicd) · [详情 → 自动伸缩与扩展](#/post/infra-autoscaling)

← [通过云·部署地图](#/post/cloud-map)

相关文章：[Docker 与容器](#/post/cloud-docker) · [监控、日志、告警](#/post/cloud-observability)

## 参考链接

- Kubernetes 文档，Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes 文档，Liveness, Readiness, and Startup Probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Kubernetes 文档，Configure Liveness, Readiness and Startup Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Kubernetes 文档，Horizontal Pod Autoscaling: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Kubernetes 文档，Service: https://kubernetes.io/docs/concepts/services-networking/service/