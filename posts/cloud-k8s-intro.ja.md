オーケストレーションとは、コンテナを複数のサーバーに分散して起動し、停止した場合は自動的に再起動させ、互いに通信できるようにする作業を自動化することです。Kubernetes（略して K8s）はそのための代表的なツールであり、今回はこのツールがどのような問題を解決するのか、そして初めて登場する 4 つのオブジェクト（Pod, Deployment, Service, ConfigMap/Secret）について整理しました。

## コンテナが増えると起きること

[Docker](#/post/cloud-docker) のコンテナは `docker run` で起動すれば終わりです。問題はそれ以降です。同じアプリを 3 つ同時に動かしたい場合、1 つが落ちたら再起動させたい場合、バージョンアップ時にダウン時間をゼロにしたい場合、あるいはフロントエンドから 3 つにリクエストを分散させたい場合にどうするか、またサーバーが複数ある場合はどのサーバーに配置すべきか決める必要があります。これを人手で行うとすぐに限界が来ます。

Kubernetes のドキュメントでは自身を「コンテナ化されたワークロードとサービスを管理するための、移植可能で拡張可能なオープンソースプラットフォーム」と紹介しています。宣言的な設定と自動化の両方をサポートするとのことです。ドキュメントに記載されている機能は以下の通りです。

| 機能 | ドキュメント説明の要約 |
|---|---|
| サービスディスカバリー・ロードバランシング | DNS 名や IP でコンテナを公開し、トラフィックを分散させます |
| オートロールアウト・ロールバック | 目標状態を記述することで、実際の状態を制御された速度で合わせます |
| セルフヒーリング | 失敗したコンテナを再起動・置換し、ヘルスチェックに応答しないコンテナは停止させます |
| オートスケジューリング（bin packing） | コンテナごとの CPU・メモリ要件を確認し、ノードに適切に配置します |
| シークレット・設定管理 | イメージを再ビルドせずに設定やシークレットを変更できます |

ドキュメントには「ないもの」も記載されています。従来のオールインワン PaaS ではなく、ソースコードのビルドやデプロイは行わず（CI/CD は各自で構成）、データベースなどのアプリサービスも標準では提供しません。[CI/CD](#/post/cloud-cicd) も Kubernetes の外側で別途構築する必要があるという意味です。

## 「宣言的」という言葉

このツールを理解するための核心は「宣言的」です。命令形が「コンテナ 3 つを起動せよ」なら、宣言形は「常に 3 つが稼働している状態であるべきだ」と記述しておくことです。ドキュメントでは Kubernetes が固定された手順を実行するのではなく、「現在の状態を目標状態へ継続的に導く、独立しており組み合わせ可能な制御プロセスの集合体」であると説明しています。そのため、A から C へどう行くかは重要ではないとのことでした。

実際には以下のように動作します。私が YAML ファイルで目標状態を API サーバーに提出すると、コントローラーが現在の状態と比較し、差異があれば修正します。コンテナが 1 つ落ちると「3 つあるべきだが 2 つ」の状態になるため、コントローラーがもう 1 つ作成します。

## Pod: Kubernetes が扱う最小単位

Kubernetes はコンテナを直接扱わず、Pod を扱います。ドキュメントの表現では Pod は「作成・管理可能な最小のデプロイ単位」であり、共有ストレージやネットワークを持つ 1 つ以上のコンテナの集合体です。1 つの Pod 内のコンテナは同じ場所に一緒に配置され、同じコンテキストで動作します。大半のケースでは Pod 1 つにコンテナ 1 つですが、ドキュメントでは複数のコンテナを 1 つの Pod にまとめるのは互いに強く結合されている場合のみと述べています。

Pod は「比較的一時的であり、捨ててもよい」という存在として設計されています。ノードが落ちたりリソース不足で追い出されたりすると消えてしまいます。そのためドキュメントでも Pod を直接作成せず、Deployment や Job などのワークロードリソースで作成するよう案内しています。この部分は最初は不思議に思いましたが、「Pod は消耗品であり、数や置換は上から管理される」と受け入れることで理解できました。

## Deployment: 数と置換を担当する側

Deployment は Pod と ReplicaSet に対する宣言的なアップデートを提供します。目標状態を記述すると、Deployment コントローラーが制御された速度で実際の状態を合わせます。ドキュメントの例をほぼそのまま引用すると以下のようになります。

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

`replicas: 3` は「Pod 3 つ」という宣言であり、`selector` はこの Deployment がどの Pod を管理するかラベルで探す規則です。`template` は Pod をどのように作成するか記述した設計図です。Deployment が ReplicaSet を作成し、ReplicaSet が Pod 3 つを作成します。ドキュメントでは Deployment が所有する ReplicaSet を直接触らないようにと記載しています。

新しいバージョンをアップロードすると新しい ReplicaSet が作成され、新しい方は徐々に増え、古い方は徐々に減っていきます。このプロセスは次の記事で詳しく扱います。

[詳細 → デプロイ・スケーリング・ローリングアップデート](#/post/cloud-k8s-deploy)

## Service: 変化する Pod の前にある固定アドレス

Pod は死んで再作成される際、IP アドレスが変更されます。そのため、クライアントは Pod の IP を直接知ることはできません。Service がその前に立ち、安定したエンドポイントとなります。ドキュメントでは Service を「クラスター内の 1 つ以上の Pod に戻るネットワークアプリケーションを公開する方法」と説明しています。

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

`selector` はラベルが `app: web` の Pod を探し、コントローラーは一致する Pod のリスト (EndpointSlice) を継続的に更新します。`port` は Service が受け取るポートであり、`targetPort` は Pod 側のポートです。省略された場合は同じ値になります。

種類についてはまず 3 つを知っておけば十分です。

| タイプ | ドキュメント説明の要約 |
|---|---|
| ClusterIP | デフォルト。クラスター内でのみアクセス可能 |
| NodePort | 各ノード IP の固定ポートとして公開 |
| LoadBalancer | 外部ロードバランサーとして公開。Kubernetes は直接ロードバランサーを提供しないため、クラウドプロバイダーとの連携や別途準備が必要です |

同じクラスター内の他のアプリケーションは名前を呼びます。DNS ドキュメントによると、通常の Service には `my-svc.my-namespace.svc.cluster-domain.example` という形式の名前が付けられ、Service のクラスター IP で解決されます。外部に公開するにはドキュメントでは Ingress や Gateway を使用することを推奨しています。フロントエンドの分散概念については [ロードバランサー](#/post/infra-load-balancer) の記事にあります。

## ConfigMap と Secret：設定をイメージの外へ

設定値をイメージ内に含めると、環境ごとにイメージを再作成する必要があります。ConfigMap は環境ごとの設定をコンテナイメージから分離したオブジェクトです。ドキュメントで整理された使用方法は、コンテナの command・args、環境変数、読み取り専用ボリュームのファイル、アプリケーションが API で直接読むことの 4 つです。サイズは 1MiB を超えることができず、Pod と同じネームスペースにある必要があります。

Secret はパスワードやトークン、キーなどの機密データを格納するオブジェクトです。両者の違いはドキュメントが明確に述べています。ConfigMap は機密保持や暗号化を提供しないため、機密データには Secret を使用すると指示されています。ただし、Secret も安全だと安心できるわけではありません。ドキュメントの注意事項は以下の通りです。

- Secret は基本的に API サーバーのデータストア (etcd) に暗号化されていない状態で保存されます。
- API アクセス権限があれば誰でも Secret を読み書きできます。同じネームスペースで Pod を作成できる人は、Deployment を通じてでもそのネームスペースの Secret を読むことができます。
- 最小限の対策として、保存時の暗号化、最小権限 RBAC、特定のコンテナへのアクセス制限、外部シークレットストレージの検討を挙げます。

例題 YAML で使われている base64 は暗号化ではなくエンコーディングであるため、誰でも復元可能です。鍵管理の一般論については [環境変数とシークレット管理](#/post/cloud-secrets) の記事にあります。

Deployment で ConfigMap と Secret を環境変数として受け取る様子は以下の通りです。

```yaml
        envFrom:
        - configMapRef:
            name: web-config
        - secretRef:
            name: web-secret
```

## 4 つを 1 行でまとめると

| オブジェクト | 役割 | 比喩すると |
|---|---|---|
| Pod | コンテナを実際に収容する最小単位 | 消耗品作業員 |
| Deployment | Pod の数と入れ替えを宣言し維持する | 人数を揃える班長 |
| Service | 変化する Pod 前の固定アドレスと分散 | 代表電話番号 |
| ConfigMap/Secret | イメージの外から設定と機密情報を注入する | 作業指示書 |

比喩は理解のためのものであり、実際にはすべて API サーバーに保存されるオブジェクトであり、コントローラーが宣言と現在の状態を一致させます。

## よくある誤解

- Kubernetes は Docker を代替する：いいえ。コンテナをどのように運用するかを扱う層であり、コンテナイメージはそのまま使います。
- Pod とコンテナは同じ意味：Pod は 1 つ以上のコンテナの集合体であり、共有ストレージやネットワーク単位です。
- Secret なら安全：デフォルト保存は暗号化されていません。暗号化設定とアクセス制限を別途行う必要があります。
- Kubernetes はアプリ展開まで全て代行する：ドキュメントによるとソースビルドとデプロイパイプラインは範囲外です。

<details>
<summary>詳細な解説：この YAML をどのように確認したか</summary>

この PC には `kubectl` クライアント (v1.36.1) しかなく、クラスターはありません。上記の YAML は Python の `yaml.safe_load_all` で文法と構造 (ConfigMap, Secret, Deployment, Service の 4 つ) が読み取れるかのみを確認しました。`kubectl apply --dry-run=client` はクラスターの API 情報を取得しようとして接続失敗で終わって使用できませんでした。クラスター上で実行する試みも行っていません。

例題の Deployment と Service は Kubernetes ドキュメントの例題を基に、名前とイメージタグを変更したものです。

</details>

<details>
<summary>詳細な解説：ドキュメントにある Pod の定義</summary>

ドキュメントは Pod を「ストレージとネットワークを共有する 1 つ以上のコンテナグループとその実行方法に関する仕様の定義」と定義している。Pod はプロセスではなく、コンテナが動作する環境であり、削除されるまで存続すると記されている。複製された Pod は通常、ワークロードリソースとそのコントローラーをセットとして作成し管理する。状態を追跡する必要がある Pod については StatefulSet を検討すべきであると述べられている。

</details>

## まとめ

当初 Kubernetes が難しかったのは用語が多かったことだが、「望ましい状態を記述すればコントローラーが調整してくれる」という一点を掴むと、Pod・Deployment・Service がそれぞれ何を宣言するオブジェクトなのか整理できた。次の記事では、これを使って実際にデプロイをどう動かすかについて解説する。

[詳細 → Kubernetes のデプロイ・スケーリング・ローリングアップデート](#/post/cloud-k8s-deploy) · [詳細 → モニタリング・ログ・アラート](#/post/cloud-observability)

← [クラウド・デプロイマップへ](#/post/cloud-map)

関連記事：[Docker とコンテナ](#/post/cloud-docker) · [CI/CD とデプロイ戦略](#/post/cloud-cicd) · [環境変数とシークレット管理](#/post/cloud-secrets)

## 参照リンク

- Kubernetes ドキュメント、Overview: https://kubernetes.io/docs/concepts/overview/
- Kubernetes ドキュメント、Pods: https://kubernetes.io/docs/concepts/workloads/pods/
- Kubernetes ドキュメント、Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes ドキュメント、Service: https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes ドキュメント、Services および Pods 用の DNS: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Kubernetes ドキュメント、ConfigMaps: https://kubernetes.io/docs/concepts/configuration/configmap/
- Kubernetes ドキュメント、Secrets: https://kubernetes.io/docs/concepts/configuration/secret/