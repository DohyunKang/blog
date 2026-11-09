In Kubernetes, a deployment involves changing the Pod template of a Deployment object, which triggers a rolling update to replace Pods one by one. During this process, Probes determine whether new Pods are ready to receive traffic, while the Horizontal Pod Autoscaler (HPA) adjusts the number of Pods based on load. This article summarizes how these three components interact. For an introduction to what Pods, Deployments, and Services are, see [the previous post](#/post/cloud-k8s-intro).

## What Happens When You Upgrade to a New Version

When the Pod template (`spec.template`) of a Deployment changes, a rollout begins. According to the documentation, a new ReplicaSet is created, and the Deployment gradually scales up the new set while scaling down the old one, replacing Pods at a controlled rate. Whether you change the image tag or environment variables, any change to the template follows this same process. Conversely, the documentation states that other changes, such as scaling adjustments, do not trigger a rollout.

The progress can be observed as follows:

```bash
kubectl apply -f deploy.yaml
kubectl rollout status deployment/web
```

Once the example in the documentation completes, a message indicating `successfully rolled out` appears. For an overview of deployment strategies, see the [CI/CD article](#/post/cloud-cicd).

## The Two Numbers Behind Rolling Updates

Two values determine the speed at which updates are applied incrementally rather than all at once:

| Field | Meaning | Default Value | When Using Percentage |
|---|---|---|---|
| `maxUnavailable` | Maximum number of Pods allowed to be unavailable during an update | 25% | Rounded down |
| `maxSurge` | Maximum number of additional Pods that can run beyond the desired count | 25% | Rounded up |

The documentation states that both fields can use either absolute numbers or percentages, and if one is set to 0, the other cannot be 0. With default values, this means "at least 75% of the desired Pods are running, and up to 125% may be running."

I calculated the defaults for a `replicas` count of 3 using the rounding rules from the documentation:

- maxUnavailable: 25% of 3 = 0.75, rounded down to 0
- maxSurge: 0.75, rounded up to 1

Consequently, the system first spins up an additional new Pod (totaling 4), and once it is ready, reduces the old Pod count by one, continuing the replacement while maintaining at least 3 usable Pods. This calculation result applies the documentation's rules and has not been directly verified in a cluster. Explicitly setting these configurations looks like this:

```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## Who Decides "Ready": The Probe

A rolling update proceeds to the next Pod only when the new Pod is deemed ready. Just because a container has started does not mean the application can handle requests; therefore, Kubernetes uses Probes that kubelet checks periodically. There are three types of probes, each with different actions upon failure:

| Probe | What It Checks | Action on Failure |
|---|---|---|
| startup | Has the application finished starting? | kubelet kills the container and follows the restart policy |
| liveness | Is it still alive (does it need a restart)? | If the failure threshold is exceeded, kubelet restarts the container |
| readiness | Is it ready to receive traffic now? | The EndpointSlice controller removes the Pod's IP from the Service endpoints |

The key difference with readiness failure is that it does not trigger a restart; instead, it means "do not accept requests," unlike liveness. According to the documentation, if a startup probe is configured, neither liveness nor readiness probes are executed until the startup probe succeeds. Applications that take a long time to start use a startup probe to prevent liveness from failing during startup and causing continuous restarts. The documentation recommends specifying a startup probe that checks the same endpoint as liveness if the container typically takes longer than `initialDelaySeconds + failureThreshold × periodSeconds` to start. The default value for `periodSeconds` specified in that article is 10 seconds.

For HTTP probes, success is defined as a response code between 200 and 400 (inclusive of 200, exclusive of 400); any other code results in failure.

I created the following configuration:

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

The startup probe must succeed within 60 seconds (12 attempts at 5-second intervals). This example is arbitrary and tuned for nginx; actual applications should measure their startup time to set appropriate values. This YAML was only checked for syntax validity and has not been executed in a cluster yet.

The point where readiness intersects with rolling updates is critical. A new Pod must pass its readiness check to be considered "ready," allowing the next replacement to proceed. If an application lacks a health-check endpoint, this judgment cannot be made; therefore, creating paths like `/healthz` on the application side is a prerequisite. This approach is similar to load balancer [health checks](#/post/infra-load-balancer).

## When Rollouts Stall or Fail

If the rollout does not proceed by showing new images, the Deployment continues to retry. The relevant fields in the documentation are as follows:

| Field | Default Value | Description |
|---|---|---|
| `minReadySeconds` | 0 | After becoming ready, it must survive this long without crashing to be marked "Available" |
| `progressDeadlineSeconds` | 600 | If no progress is made within this time, it is reported as failed |
| `revisionHistoryLimit` | 10 | Number of old ReplicaSets kept for rollback purposes |

The documentation states that exceeding `progressDeadlineSeconds` causes Kubernetes to record the status condition `ProgressDeadlineExceeded`, but no further action is taken. It does not automatically revert; reversion must be performed manually or via a pipeline.

```bash
kubectl rollout undo deployment/web
kubectl rollout undo deployment/web --to-revision=2
```

According to the documentation, rolling back a Deployment only reverts the Pod template section of the Deployment to the previous revision. A paused Deployment must be resumed before it can be rolled back. If `revisionHistoryLimit` is set to 0, old ReplicaSets are deleted, making rollback impossible.

## How to Change the Count: Manual and HPA

Manual scaling is done like `kubectl scale deployment/web --replicas=5`. Automatic scaling is handled by the HorizontalPodAutoscaler (HPA). The HPA is not a continuously running process but rather a control loop; according to the documentation, it reads metrics for target Pods every 15 seconds by default and adjusts the replicas of targets like Deployments. The calculation uses a ratio.

```
desiredReplicas = ceil( currentReplicas × currentMetricValue / desiredMetricValue )
```

For example, if the average CPU usage of 4 Pods is 90% and the target is 60%, then 4 × 90/60 = 6, so it scales up to 6 pods. This is my own calculation by plugging numbers into the formula above.

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

There are several conditions required when using HPA:

- The `metrics.k8s.io` API that provides metrics is typically provided by an addon called Metrics Server and must be installed separately.
- To use a utilization (%) target, containers must have resource requests defined. If not, the CPU usage for that Pod is undefined, and HPA does nothing regarding that metric. This is why `resources.requests.cpu: 100m` was added to the Deployment in the preceding YAML example.
- When HPA manages the count, the documentation recommends removing `spec.replicas` from the Deployment manifest to prevent them from overwriting each other.
- The default behavior is asymmetric. The default `behavior` in the documentation sets a 300-second stabilization window for scaling down and 0 seconds for scaling up. This means it reacts immediately when scaling up but waits 5 minutes before reacting when scaling down. It does not react to changes within ±10% of the target value (default tolerance).

<details>
<summary>Detailed explanation: HPA default behavior block</summary>

The `behavior` setting shown by default in the documentation is as follows:

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

Scaling up can increase the count by 100% of the current number or up to 4 Pods (whichever is larger, using `selectPolicy: Max`) every 15 seconds, while scaling down can decrease by up to 100% every 15 seconds but is prevented from a rapid drop by the preceding 300-second window. The default tolerance of 10% can be changed via kube-controller-manager's `--horizontal-pod-autoscaler-tolerance`. All these values are based on the documentation and have not been tested with actual load yet.

</details>

<details>
<summary>Detailed explanation: How the YAML in this article was verified</summary>

A Deployment (including rolling updates, probes, and resources) and an HPA were combined into a single file and read using Python's `yaml.safe_load_all` to confirm that both the Deployment and HorizontalPodAutoscaler objects were parsed according to their structure. This PC has only the `kubectl` client (v1.36.1) and no cluster, so `kubectl apply --dry-run=client` ended with an API connection failure. Therefore, it was not executed on a cluster. Field names and default values were obtained from the Kubernetes documentation.

</details>

## Common Misconceptions

- Rolling updates mean zero downtime: The new Pod's readiness must be properly configured, and `maxUnavailable` should be set appropriately. Without probes, there is no way to distinguish between "up" and "available".
- Liveness and readiness are similar but serve different purposes: liveness triggers a restart, while readiness excludes the Pod from traffic.- If a rollout fails, it automatically rolls back: The documentation only records the `ProgressDeadlineExceeded` condition. A separate rollback action is performed.- HPA scales up immediately: It operates on a 15-second polling loop, whereas scaling down typically includes a 5-minute stabilization window by default. Understanding the general concept of [autoscaling](#/post/infra-autoscaling) will make this easier to grasp.

## Conclusion

In summary, deployment involves changing templates; replacement speed is governed by `maxSurge` and `maxUnavailable`; whether replacement is possible depends on readiness; and the number of replicas is determined by HPA. When considered individually, these four aspects seem simple, but they interact when running together. Observability connects to [monitoring, logging, and alerting](#/post/cloud-observability).

[Learn more → Container orchestration and core objects](#/post/cloud-k8s-intro) · [Learn more → CI/CD and deployment strategies](#/post/cloud-cicd) · [Learn more → Autoscaling and scaling](#/post/infra-autoscaling)

← [Cloud & Deployment map](#/post/cloud-map)

Related articles: [Docker and Containers](#/post/cloud-docker) · [Monitoring, Logging, and Alerting](#/post/cloud-observability)

## Reference Links

- Kubernetes documentation, Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes documentation, Liveness, Readiness, and Startup Probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Kubernetes documentation, Configure Liveness, Readiness and Startup Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Kubernetes documentation, Horizontal Pod Autoscaling: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Kubernetes documentation, Service: https://kubernetes.io/docs/concepts/services-networking/service/