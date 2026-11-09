编排是指自动完成将容器分发到多台服务器运行、在容器崩溃后重启以及让它们相互发现的任务。Kubernetes（简称 K8s）是执行此类任务的典型工具，因此本文将介绍它解决了什么问题，并梳理初次遇到的四个对象：Pod、Deployment、Service 和 ConfigMap/Secret。

## 容器增多时产生的问题

[Docker](#/post/cloud-docker) 单个容器只需使用 `docker run` 即可启动。问题在于此后的操作。例如，希望同时运行三个相同的应用实例；当其中一个崩溃时需要自动重启；升级新版本时必须保证服务不中断；前端需要将请求均匀分发到这三个实例；如果有多台服务器，还需决定将应用部署在哪一台上。若由人工手动处理，很快就会达到极限。

Kubernetes 文档将其介绍为“用于管理容器化工作负载和服务的、可移植且可扩展的开源平台”。它支持声明式配置和自动化。文档中列出的功能包括：

| 功能 | 文档描述摘要 |
|---|---|
| 服务发现与负载均衡 | 通过 DNS 名称或 IP 暴露容器并分配流量 |
| 自动滚动更新与回滚 | 指定期望状态后，以受控速度使实际状态与之匹配 |
| 自愈能力 | 重启或替换失败的容器，对健康检查无响应的容器进行终止 |
| 自动装箱（bin packing） | 根据容器的 CPU 和内存需求，将其部署到合适的节点上 |
| 配置与密钥管理 | 无需重新构建镜像即可更改配置和密钥 |

文档也明确说明了其“非”功能：它并非传统的全能型 PaaS；不提供源代码构建或部署服务（CI/CD 需自行搭建）；也不提供如数据库等应用服务。[CI/CD](#/post/cloud-cicd) 是在 Kubernetes 之外单独构建的。

## “声明式”的含义

理解该工具的核心在于“声明式”。如果说命令式是“启动三个容器”，那么声明式则是记录“必须始终维持三个容器运行的状态”。文档指出，Kubernetes 并非执行固定的流程，而是一组独立且可组合的控制进程集合，持续将当前状态引导至期望状态。因此，从 A 到 C 的具体路径并不重要。

实际上，其运作方式如下：我将期望状态以 YAML 文件形式提交给 API 服务器，控制器会比较当前状态与期望状态，若有差异则进行调整。例如，当一个容器崩溃时，状态会从“应有 3 个”变为“实际 2 个”，控制器便会创建一个新的容器。

## Pod：Kubernetes 处理的最小单元

Kubernetes 不直接管理容器，而是管理 Pod。文档将 Pod 描述为“可创建和管理的最小部署单元”，即一个或多个拥有共享存储和网络容器的集合。Pod 内的容器被共同调度到同一位置，并在相同上下文中运行。大多数情况下，一个 Pod 包含一个容器；文档指出，仅在容器间存在强耦合关系时，才考虑将多个容器放入同一个 Pod。

Pod 被设计为“相对短暂且可丢弃”的存在。如果节点崩溃或资源不足导致驱逐，Pod 便会消失。因此，文档建议不要直接创建 Pod，而应使用 Deployment 或 Job 等工作负载资源来创建。起初这部分内容令人困惑，但理解到"Pod 是消耗品，其数量和替换由上层管理”后便豁然开朗。

## Deployment：负责数量与替换的对象

Deployment 提供针对 Pod 和 ReplicaSet 的声明式更新。只需指定期望状态，Deployment 控制器便会以受控速度使实际状态与之匹配。以下是文档示例的几乎原样内容：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.27
        ports:
        - containerPort: 80
```

`replicas: 3` 是对"3 个 Pod"的声明；`selector` 是 Deployment 通过标签查找并管理哪些 Pod 的规则；`template` 则是描述如何构建 Pod 的设计图。Deployment 会创建 ReplicaSet，再由 ReplicaSet 创建 3 个 Pod。文档明确指出不应直接操作由 Deployment 拥有的 ReplicaSet。

升级新版本时，会创建新的 ReplicaSet，新实例逐渐增加，旧实例逐渐减少。这一过程将在下一篇文章中专门讨论。

[详情 → 部署、扩展与滚动更新](#/post/cloud-k8s-deploy)

## Service：Pod 变化前的固定地址

Pod 会死亡并重建，导致 IP 地址发生变化。因此，客户端无法直接知晓 Pod 的 IP。Service 位于其前方，成为一个稳定的接入点。文档将 Service 描述为“在集群中暴露一个或多个 Pod 的网络应用程序的方法”。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
```

`selector` 用于查找标签为 `app: web` 的 Pod，控制器会持续更新匹配的 Pod 列表（EndpointSlice）。`port` 是 Service 接收的端口，而 `targetPort` 是 Pod 侧的端口。如果省略则默认为相同值。

首先需要了解三种类型：

| 类型 | 文档说明摘要 |
|---|---|
| ClusterIP | 默认类型。仅在集群内部可访问 |
| NodePort | 通过每个节点 IP 上的固定端口暴露 |
| LoadBalancer | 通过外部负载均衡器暴露。由于 Kubernetes 不提供直接的负载均衡器，需要与云提供商集成或自行配置 |

同一集群内的其他应用程序通过名称进行引用。根据 DNS 文档，普通 Service 会附加类似 `my-svc.my-namespace.svc.cluster-domain.example` 的名称，并解析为 Service 的集群 IP。若要对外公开，文档建议使用 Ingress 或 Gateway。前端分布式概念详见 [负载均衡器](#/post/infra-load-balancer) 文章。

## ConfigMap 与 Secret：将配置置于镜像之外

若将配置值放入镜像中，则需针对每个环境重新构建镜像。ConfigMap 是一个从容器镜像中剥离出特定环境配置的独立对象。文档总结的使用方式包括：容器的 command/args、环境变量、只读卷中的文件以及应用程序通过 API 直接读取，共四种方式。其大小不能超过 1MiB，且必须与 Pod 处于同一命名空间。

Secret 是一个用于存储敏感数据（如密码、令牌、密钥）的对象。两者的区别文档中有明确说明：ConfigMap 不提供机密性保持或加密功能，因此敏感数据应使用 Secret。但也不必对 Secret 的安全性掉以轻心。文档的注意事项如下：

- Secret 默认以明文形式存储在 API 服务器的数据存储（etcd）中。
- 若拥有 API 访问权限，任何人都可以读取或修改 Secret。即使是在同一命名空间中创建 Pod 的用户，也可以通过 Deployment 等方式读取该命名空间中的 Secret。
- 最小化措施包括：存储时加密、最小权限 RBAC、限制特定容器访问以及审查外部 Secret 存储库。

示例 YAML 中使用的 base64 是编码而非加密，任何人都可以解码还原。关于密钥管理的一般原则，请参阅 [环境变量与 Secret 管理](#/post/cloud-secrets) 文章。

Deployment 通过环境变量接收 ConfigMap 和 Secret 的形态如下：

```yaml
        envFrom:
        - configMapRef:
            name: web-config
        - secretRef:
            name: web-secret
```

## 四者合而为一

| 对象 | 功能 | 比喻 |
|---|---|---|
| Pod | 实际承载容器的最小单元 | 消耗型工人 |
| Deployment | 声明并维护 Pod 的数量及替换 | 调整人数的班长 |
| Service | 提供变化中的 Pod 之前的固定地址与分发 | 总机电话号码 |
| ConfigMap/Secret | 从镜像外部注入配置与秘密 | 工作指示书 |

比喻仅用于理解，实际上它们都是存储于 API 服务器上的对象，由控制器将声明状态与当前状态进行同步。

## 常见误解

- Kubernetes 替代 Docker：并非如此。它处理的是如何运行容器这一层级，而容器镜像则原样使用。
- Pod 等同于容器：Pod 是一个或多个容器的集合，是共享存储和网络的基本单元。
- Secret 就是安全的：默认存储未加密。必须单独配置加密和访问限制。
- Kubernetes 负责所有应用部署：根据文档，源构建和部署流水线不在其范围内。

<details>
<summary>详细解析：如何验证本文的 YAML</summary>

这台 PC 仅安装了 `kubectl` 客户端（v1.36.1），并未连接集群。上述 YAML 仅通过 Python 的 `yaml.safe_load_all` 验证了语法和结构（ConfigMap、Secret、Deployment、Service 共四种对象）。尝试使用 `kubectl apply --dry-run=client` 获取集群 API 信息时因连接失败而未能成功，因此未采用该方法。也未在集群中实际执行过。

示例 Deployment 和 Service 是基于 Kubernetes 文档的示例改编而来，仅更改了名称和镜像标签。
</details>

</details>

<details>
<summary>详细解析：文档中的 Pod 定义</summary>

文档将 Pod 定义为“一个或多个共享存储和网络资源的容器组及其运行方式的规范”。Pod 不是进程，而是运行容器的环境，并会一直存在直到被删除。复制的 Pod 通常由工作负载资源及其控制器作为整体进行创建和管理。对于需要跟踪状态的 Pod，文档也建议考虑使用 StatefulSet。

</details>

## 总结

最初觉得 Kubernetes 难以理解是因为术语繁多，但抓住“只需声明期望状态，控制器会自动调整”这一核心概念后，便理清了 Pod、Deployment 和 Service 各自所声明的对象类型。下一篇文章将介绍如何利用这些对象进行实际部署。

[详细 → Kubernetes 部署·扩展·滚动更新](#/post/cloud-k8s-deploy) · [详细 → 监控·日志·告警](#/post/cloud-observability)

← [通过地图了解云与部署](#/post/cloud-map)

相关文章：[Docker 与容器](#/post/cloud-docker) · [CI/CD 与部署策略](#/post/cloud-cicd) · [环境变量与密钥管理](#/post/cloud-secrets)

## 参考链接

- Kubernetes 文档，概述：https://kubernetes.io/docs/concepts/overview/
- Kubernetes 文档，Pods：https://kubernetes.io/docs/concepts/workloads/pods/
- Kubernetes 文档，Deployments：https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes 文档，Service：https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes 文档，Services 和 Pods 的 DNS：https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Kubernetes 文档，ConfigMaps：https://kubernetes.io/docs/concepts/configuration/configmap/
- Kubernetes 文档，Secrets：https://kubernetes.io/docs/concepts/configuration/secret/