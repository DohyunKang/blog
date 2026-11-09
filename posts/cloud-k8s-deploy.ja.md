Kubernetes におけるデプロイメントは、Deployment の Pod テンプレートを変更する作業であり、これによりロールリングアップデートが実行され、Pod が逐次置換されます。この際、新しい Pod がトラフィックを受け付けるべきかどうかは probe が判断し、負荷に応じて Pod の数を調整するのは HPA の役割です。本稿では、これらの 3 つの要素がどのように連携するかを整理します。Pod・Deployment・Service の概要については [前編](#/post/cloud-k8s-intro) を参照してください。

## 新しいバージョンをアップロードすると起こること

Deployment の Pod テンプレート (`.spec.template`) が変更されると、ロールアウトが開始されます。ドキュメントによれば、新しい ReplicaSet が作成され、Deployment は新しい方を徐々に増やしながら古い方を徐々に減らして、Pod を制御された速度で置換します。イメージタグを変更する也好環境変数を変更する也罢、テンプレートが変われば同じプロセスです。逆に、ドキュメントではスケーリング調整などの他の変更はロールアウトを引き起こさない旨が記載されています。

進行状況は以下のように確認します。

```bash
kubectl apply -f deploy.yaml
kubectl rollout status deployment/web
```

ドキュメントの例に基づくと完了すると `successfully rolled out` というメッセージが表示されます。デプロイ戦略全般については [CI/CD 記事](#/post/cloud-cicd) にあります。

## ロールリングアップデートの 2 つの数値

一度にすべてを変更せず、少しずつ変更する速度は 2 つの値によって決定されます。

| フィールド | 意味 | デフォルト値 | パーセントの場合 |
|---|---|---|---|
| `maxUnavailable` | アップデート中に利用できない Pod を最大何個まで許容するか | 25% | 切り捨て |
| `maxSurge` | 希望数より最大何個多く起動できるか | 25% | 切り上げ |

ドキュメントでは両方とも絶対値またはパーセントで指定でき、一方が 0 の場合他方も 0 にはならない旨が記載されています。デフォルト値の場合、「希望する Pod の最小 75% は稼働しており、最大 125% まで稼働している」という意味です。

replicas が 3 の場合のデフォルト値を計算してみました。ドキュメントの丸め規則を適用した私の計算結果です。

- maxUnavailable: 3 の 25% = 0.75、切り捨てして 0
- maxSurge: 0.75、切り上げて 1

したがって、まず新しい Pod を 1 つ追加起動し (合計 4 つ)、それが準備完了したら古い Pod を 1 つ減らすという手順で、常に 3 つ稼働可能な状態での置換が行われます。この計算結果はドキュメントの規則を適用したものであり、クラスターで直接確認したものではありません。この設定を明示的に指定すると以下になります。

```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## "準備完了" を誰が判定するか：probe

ロールリングアップデートでは、新しい Pod が準備完了であると判断された後に次の Pod への移行が行われます。コンテナが起動したからといってアプリケーションがリクエストを受け付けるわけではないため、Kubernetes は kubelet が定期的にチェックする probe を設定します。種類は 3 つあり、失敗した場合の挙動が異なります。

| probe | 確認内容 | 失敗した場合 |
|---|---|---|
| startup | アプリケーションが起動を完了したか | kubelet がコンテナを停止し、再起動ポリシーに従います |
| liveness | まだ生きているか (再起動が必要か) | 許容回数を超過すると kubelet がコンテナを再起動します |
| readiness | 現在トラフィックを受け付けるべきか | EndpointSlice コントローラーがその Pod の IP を Service のターゲットから除外します |

readiness の失敗は「再起動」ではなく「顧客への対応拒否」という点で liveness と異なります。ドキュメントによれば、startup probe が設定されている場合、それが成功するまで liveness と readiness は実行されません。起動に時間がかかるアプリケーションでは、liveness が起動途中で失敗して連続的に再起動されるのを防ぐために startup probe を使用します。ドキュメントでは、コンテナの起動が通常 `initialDelaySeconds + failureThreshold × periodSeconds` よりも長くなる場合、liveness と同じエンドポイントを確認する startup probe を指定するとあります。その記事に明記されている `periodSeconds` のデフォルト値は 10 秒です。

HTTP probe では、レスポンスコードが 200 以上 400 未満であれば成功、それ以外は失敗とします。

このような構成を試みました。

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

startup probe は 5 秒間隔で最大 12 回、つまり 60 秒以内に成功する必要があります。この値は nginx に合わせた任意の例であり、実際のアプリケーションでは起動時間を計測して設定する必要があります。この YAML は文法のみを確認し、クラスターで実行したわけではありません。

readiness がロールリングアップデートと交わる点が重要です。新しい Pod の readiness が通過しないと「準備完了」とみなされず、次の置換は進みません。アプリケーションにヘルスチェック用のパスがない場合、この判定を行うことができないため、アプリケーション側でも `/healthz` などのパスを事前に用意しておくことが前提となります。ロードバランサーの [ヘルスチェック](#/post/infra-load-balancer) と同じ考え方です。

## ロールアウトが停止したり失敗したりした場合

新しいイメージが表示されないようなロールアウトが進行しない場合、Deployment は引き続き再試行を続けます。関連するフィールドは以下の通りです。

| フィールド | デフォルト値 | 内容 |
|---|---|---|
| `minReadySeconds` | 0 | 準備完了後、この間クラッシュせずに耐えなければ「利用可能」とみなします |
| `progressDeadlineSeconds` | 600 | この時間内に進捗がない場合は失敗と報告します |
| `revisionHistoryLimit` | 10 | ロールバック用に保存する古い ReplicaSet の数です |

`progressDeadlineSeconds` を超えると、Kubernetes はステータス条件に `ProgressDeadlineExceeded` を記録するだけで、それ以外の措置は取らないと文書に記載されています。自動的に元に戻すわけではありません。戻すのは人間かパイプラインが行います。

```bash
kubectl rollout undo deployment/web
kubectl rollout undo deployment/web --to-revision=2
```

文書によれば、ロールバックは Deployment の Pod テンプレート部分のみを以前のレビジョンに戻します。一時停止された Deployment は再開しないとロールバックできません。`revisionHistoryLimit` を 0 にすると古い ReplicaSet が削除されてロールバックできなくなります。

## 個数を変更する方法：手動と HPA

手動は `kubectl scale deployment/web --replicas=5` のように行います。自動は HorizontalPodAutoscaler (HPA) が担当します。HPA は常時動作するプロセスではなく制御ループであり、文書によればデフォルト 15 秒間隔で対象 Pod のメトリクスを読み取り、Deployment などの対象の replicas を調整します。計算式は比率です。

```
desiredReplicas = ceil( currentReplicas × currentMetricValue / desiredMetricValue )
```

例えば Pod 4 つの平均 CPU 使用率が 90% で目標が 60% なら 4 × 90/60 = 6 なので、6 つに増やします。これは上記の式に数字を代入して計算した私の結果です。

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

HPA を使用する際に満たすべき条件はいくつかあります。

- メトリクスを提供する `metrics.k8s.io` API は通常 Metrics Server というアドオンが提供しており、別途インストールする必要があります。
- 使用率 (%) の目標を使用するには、コンテナにリソース request が設定されている必要があります。なければその Pod の CPU 使用率は定義されず、HPA はそのメトリクスについて何も行いません。前述の YAML サンプルの Deployment に `resources.requests.cpu: 100m` を追加した理由です。
- HPA が個数进行管理する場合、Deployment マニフェストの `spec.replicas` は削除すると文書が推奨しています。両者が互いに上書きし合わないようにするためだと理解しました。
- デフォルト動作は非対称です。文書のデフォルト `behavior` はスケールダウンに 300 秒の安定化ウィンドウを設け、スケールアップには 0 秒を設けています。増やすときは即座に、減らすときは 5 分観察してからという意味です。目標値周辺 10%（デフォルト tolerance）は反応しません。

<details>
<summary>詳細な解説：HPA デフォルト behavior ブロック</summary>

文書がデフォルトとして表示する `behavior` 設定は以下の通りです。

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

スケールアップでは、15 秒ごとに現在の個数の 100% または Pod 4 つのうち大きい方 (`selectPolicy: Max`) まで増やすことができ、スケールダウンでは 15 秒ごとに 100% まで減らすことができますが、前述の 300 秒ウィンドウで急落を防ぎます。tolerance のデフォルト値 10% は kube-controller-manager の `--horizontal-pod-autoscaler-tolerance` で変更可能とのことです。これらのすべての値は文書基準であり、実際に負荷をかけて試したわけではありません。

</details>

<details>
<summary>詳細な解説：この記事の YAML をどのように確認したか</summary>

Deployment（ロールリングアップデート・probe・resources）と HPA を 1 つのファイルにまとめて作成し、Python の `yaml.safe_load_all` で読み取り、Deployment と HorizontalPodAutoscaler の 2 つが構造通りに読み込まれることを確認しました。この PC には `kubectl` クライアント (v1.36.1) しかなくクラスタがないため、`kubectl apply --dry-run=client` は API 接続失敗で終わりました。したがって、クラスタ上で実行して見ることは行いませんでした。フィールド名とデフォルト値は Kubernetes 文書から読み取ったものです。

</details>

## よくある誤解

- Rolling update means zero downtime: The new Pod's readiness must be properly configured, and parameters like `maxUnavailable` must be set appropriately. If there is no probe, it becomes impossible to distinguish between "up" and "available".
- liveness and readiness are similar: liveness triggers a restart, while readiness excludes the Pod from traffic.- If rollout fails, rollback happens automatically: Only the `ProgressDeadlineExceeded` condition is recorded in the documentation; rollback is handled separately.
- HPA scales up immediately: It operates on a 15-second loop cycle, and scaling down typically includes a 5-minute stabilization window. Understanding the general concept of [autoscaling](#/post/infra-autoscaling) will make this easier to grasp.

## Conclusion

In summary, deployment involves changing templates; replacement speed is determined by `maxSurge` and `maxUnavailable`; whether replacement is possible depends on readiness; and the number of instances is decided by HPA. These four factors seem simple when viewed individually but influence each other when operating together. Observability connects to [monitoring, logging, and alerting](#/post/cloud-observability).

[Learn more → Container orchestration and core objects](#/post/cloud-k8s-intro) · [Learn more → CI/CD and deployment strategies](#/post/cloud-cicd) · [Learn more → Autoscaling and scaling](#/post/infra-autoscaling)

← [Cloud & Deployment map](#/post/cloud-map)

Related articles: [Docker and Containers](#/post/cloud-docker) · [Monitoring, Logging, and Alerting](#/post/cloud-observability)

## Reference Links

- Kubernetes documentation, Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes documentation, Liveness, Readiness, and Startup Probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Kubernetes documentation, Configure Liveness, Readiness and Startup Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Kubernetes documentation, Horizontal Pod Autoscaling: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Kubernetes documentation, Service: https://kubernetes.io/docs/concepts/services-networking/service/