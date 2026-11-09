Orchestration is the process of automatically distributing containers across multiple servers, restarting them when they crash, and ensuring they can find each other. Kubernetes (often shortened to K8s) is a representative tool that handles this. In this post, we will explore the problems it solves and review four core objects you'll encounter for the first time: Pod, Deployment, Service, and ConfigMap/Secret.

## What Happens When You Have Many Containers

Starting a single [Docker](#/post/cloud-docker) container is as simple as running `docker run`. The real challenge begins afterward. Suppose you want to run three instances of the same application; if one dies, it must restart automatically. When updating to a new version, there should be no downtime, and incoming requests from the frontend must be distributed among the three instances. If you have multiple servers, you also need to decide which server to deploy on. Doing this manually by hand quickly hits its limits.

The Kubernetes documentation introduces itself as "an open-source platform for managing containerized workloads and services that provides an extensible mechanism to automate deployment, scaling, and operations of application containers." It supports both declarative configuration and automation. The features documented include:

| Feature | Documentation Summary |
|---|---|
| Service Discovery & Load Balancing | Exposes containers via DNS names or IPs and distributes traffic. |
| Automatic Rollout & Rollback | By specifying a desired state, the system adjusts the actual state at a controlled pace. |
| Self-Healing | Restarts or replaces failed containers and terminates those that do not respond to health checks. |
| Automatic Bin Packing | Allocates containers to nodes based on their CPU and memory requirements. |
| Secret & Configuration Management | Updates configurations and secrets without rebuilding images. |

The documentation also clarifies what Kubernetes is *not*. It is not a traditional all-in-one PaaS, does not build or deploy source code for you (CI/CD pipelines must be configured separately), and does not provide application services like databases by default. [CI/CD](#/post/cloud-cicd) refers to tools built outside of Kubernetes.

## What "Declarative" Means

The core concept for understanding this tool is "declarative." While imperative commands say "start 3 containers," declarative configuration states "there must always be 3 running." The documentation explains that Kubernetes does not execute fixed procedures but rather acts as a set of independent, composable control processes that continuously drive the current state toward the desired state. Therefore, *how* you get from A to C is not important.

In practice, it works like this: You submit your desired state via a YAML file to the API server. Controllers compare this with the current state and make adjustments if there are differences. If one container dies, the system detects that there are now 2 instead of 3, so the controller creates another one.

## Pod: The Smallest Unit Kubernetes Manages

Kubernetes does not manage containers directly; it manages Pods. In documentation terms, a Pod is "the smallest deployable unit that can be created and managed," consisting of one or more containers that share storage and network resources. Containers within a single Pod are co-located on the same node and run in the same context. Most commonly, a Pod contains a single container; the documentation notes that multiple containers in one Pod should only be used when they are tightly coupled.

Pods are designed to be "relatively ephemeral and disposable." If a node dies or resources become scarce, the Pods disappear. Consequently, the documentation advises against creating Pods directly and instead recommends using workload resources like Deployments or Jobs. This might seem strange at first, but once you accept that "Pods are consumables whose count and replacement are managed from above," it becomes clear.

## Deployment: Managing Count and Replacement

Deployments provide declarative updates for Pods and ReplicaSets. By specifying a desired state, the Deployment controller adjusts the actual state at a controlled pace. Using almost the exact example from the documentation, it looks like this:

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

`replicas: 3` is a declaration for "3 Pods," while `selector` defines the label rules by which this Deployment finds the Pods it manages. The `template` is the blueprint specifying how to create the Pod. The Deployment creates a ReplicaSet, and the ReplicaSet creates the 3 Pods. The documentation explicitly states not to directly manipulate the ReplicaSets owned by a Deployment.

When upgrading to a new version, a new ReplicaSet is created; the new set gradually increases while the old one decreases. This process will be covered in detail in the next post.

[Learn more → Deployments, Scaling, and Rolling Updates](#/post/cloud-k8s-deploy)

## Service: A Fixed Address in Front of Changing Pods

Pods die and are recreated, causing their IP addresses to change. Consequently, clients cannot directly know Pod IPs. A Service stands in front of them to provide a stable endpoint. The documentation describes a Service as "a method for exposing network applications from one or more Pods in a cluster."

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

The `selector` finds Pods with the label `app: web`, and the controller continuously updates the list of matching Pods (EndpointSlice). The `port` is the port the Service receives on, while `targetPort` is the port on the Pod. If omitted, they default to the same value.

There are three types you should know about first.

| Type | Documentation Summary |
|---|---|
| ClusterIP | Default type; accessible only within the cluster |
| NodePort | Exposed via a fixed port on each node's IP |
| LoadBalancer | Exposed via an external load balancer. Since Kubernetes does not provide its own load balancer, you must integrate with your cloud provider or set one up separately |

Apps within the same cluster are referred to by name. According to the DNS documentation, a standard Service gets a name in the format `my-svc.my-namespace.svc.cluster-domain.example` and resolves to the Service's Cluster IP. To expose it externally, the documentation recommends using an Ingress or Gateway. The concept of front-end distribution is covered separately in the [Load Balancer](#/post/infra-load-balancer) article.

## ConfigMaps and Secrets: Configuration Outside the Image

If you embed configuration values inside the image, you must rebuild the image for every environment change. A ConfigMap is an object that separates environment-specific settings from the container image. The usage patterns summarized in the documentation include: passing data via container `command`/`args`, environment variables, files on read-only volumes, and having applications read directly via an API. ConfigMaps cannot exceed 1MiB in size and must reside in the same namespace as the Pod.

Secrets are objects used to hold sensitive data such as passwords, tokens, and keys. The documentation clearly distinguishes between the two: since ConfigMaps do not provide confidentiality or encryption, you should use Secrets for sensitive data. However, you cannot assume Secrets are completely safe. The documentation's cautions are as follows:

- By default, Secrets are stored in the API server's data store (etcd) without encryption.
- Anyone with API access permissions can read or modify Secrets. Even within the same namespace, anyone who can create Pods can read that namespace's Secrets, even through a Deployment.
- Recommended mitigation measures include encrypting at rest, implementing least-privilege RBAC, restricting access to specific containers, and reviewing external secret stores.

The base64 encoding used in example YAML files is not encryption but encoding, meaning anyone can decode it back. General principles of key management are covered in the [Environment Variables and Secret Management](#/post/cloud-secrets) article.

Here is how a Deployment receives ConfigMaps and Secrets as environment variables:

```yaml
        envFrom:
        - configMapRef:
            name: web-config
        - secretRef:
            name: web-secret
```

## Putting It All Together in Four Lines

| Object | Function | Analogy |
|---|---|---|
| Pod | The smallest unit that actually holds containers | Consumable worker |
| Deployment | Declares and maintains the number of Pods and their replacement | Team leader ensuring headcount matches |
| Service | Provides a fixed address and distribution in front of changing Pods | Representative phone number |
| ConfigMap/Secret | Injects configuration and secrets from outside the image | Work instruction sheet |

These analogies are for understanding; in reality, all are objects stored on the API server, with controllers reconciling the declared state with the current state.

## Common Misconceptions

- Kubernetes replaces Docker: No. It operates at a layer that manages how containers are run, while container images remain unchanged.
- Pods are the same as containers: A Pod is a collection of one or more containers and represents a unit for shared storage and networking.
- Secrets are safe: Storage by default is not encrypted; you must configure encryption and access restrictions separately.
- Kubernetes handles app deployment entirely: According to the documentation, source building and deployment pipelines are out of scope.

<details>
<summary>Detailed Explanation: How was this article's YAML verified?</summary>

This PC has only the `kubectl` client (v1.36.1) and no cluster. The YAML above was checked using Python's `yaml.safe_load_all` to verify syntax and structure (ConfigMap, Secret, Deployment, Service), but not execution. `kubectl apply --dry-run=client` failed because it attempted to fetch API information from a non-existent cluster. We did not run these examples on a real cluster.

The example Deployment and Service are based on Kubernetes documentation examples, with names and image tags modified.
</details>

</details>

<details>
<summary>Detailed explanation: Pod definition in the document</summary>

The document defines a Pod as "a specification for one or more containers that share storage and network, along with how they are run." It notes that a Pod is not a process but an environment where containers run, and it persists until deletion. Replicated Pods are typically created and managed as bundles of workload resources and their controllers. For Pods that require state tracking, it also suggests considering StatefulSets.

</details>

## Conclusion

Initially, Kubernetes felt difficult due to the abundance of terminology, but once I grasped the core concept—"specify the desired state, and the controller adjusts accordingly"—I was able to categorize what each object (Pod, Deployment, Service) declares. The next post will cover how to actually deploy using these concepts.

[Read more → Kubernetes deployment, scaling, rolling updates](#/post/cloud-k8s-deploy) · [Read more → monitoring, logging, alerts](#/post/cloud-observability)

← [Cloud & deployment map](#/post/cloud-map)

Related posts: [Docker and containers](#/post/cloud-docker) · [CI/CD and deployment strategies](#/post/cloud-cicd) · [Environment variables and secrets management](#/post/cloud-secrets)

## Reference links

- Kubernetes documentation, Overview: https://kubernetes.io/docs/concepts/overview/
- Kubernetes documentation, Pods: https://kubernetes.io/docs/concepts/workloads/pods/
- Kubernetes documentation, Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes documentation, Service: https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes documentation, DNS for Services and Pods: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Kubernetes documentation, ConfigMaps: https://kubernetes.io/docs/concepts/configuration/configmap/
- Kubernetes documentation, Secrets: https://kubernetes.io/docs/concepts/configuration/secret/