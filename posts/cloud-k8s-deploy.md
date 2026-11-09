쿠버네티스에서 배포는 Deployment의 Pod 템플릿을 바꾸는 일이고, 그러면 롤링 업데이트가 돌면서 Pod가 하나씩 교체된다. 이때 새 Pod가 트래픽을 받아도 되는지는 probe가 판단하고, 부하에 따라 Pod 수를 바꾸는 건 HPA가 맡는다. 이 글은 그 세 가지가 어떻게 맞물리는지를 정리한 것이다. Pod·Deployment·Service가 무엇인지는 [앞 글](#/post/cloud-k8s-intro)에 있다.

## 새 버전을 올리면 일어나는 일

Deployment의 Pod 템플릿(`.spec.template`)이 바뀌면 롤아웃이 시작된다. 문서에 따르면 새 ReplicaSet이 만들어지고, Deployment가 새 쪽은 서서히 늘리고 옛 쪽은 서서히 줄여서 Pod를 통제된 속도로 교체한다. 이미지 태그를 바꾸든 환경변수를 바꾸든, 템플릿이 바뀌면 같은 과정이다. 반대로 문서는 스케일 조정 같은 다른 변경은 롤아웃을 일으키지 않는다고 적는다.

진행 상황은 이렇게 본다.

```bash
kubectl apply -f deploy.yaml
kubectl rollout status deployment/web
```

문서 예제 기준으로 끝나면 `successfully rolled out`이라는 메시지가 나온다. 배포 전략 전반은 [CI/CD 글](#/post/cloud-cicd)에 있다.

## 롤링 업데이트의 숫자 두 개

한꺼번에 바꾸지 않고 조금씩 바꾸는 속도를 두 값이 정한다.

| 필드 | 뜻 | 기본값 | 퍼센트일 때 |
|---|---|---|---|
| `maxUnavailable` | 업데이트 중 못 쓰는 Pod를 최대 몇 개까지 허용하나 | 25% | 내림 |
| `maxSurge` | 원하는 개수보다 몇 개까지 더 띄울 수 있나 | 25% | 올림 |

문서는 둘 다 절대 숫자나 퍼센트로 쓸 수 있고, 한쪽이 0이면 다른 쪽은 0이 될 수 없다고 적는다. 기본값이면 "원하는 Pod의 최소 75%는 떠 있고, 최대 125%까지 떠 있다"는 뜻이다.

replicas가 3일 때 기본값을 계산해 봤다. 문서의 반올림 규칙을 적용한 내 계산이다.

- maxUnavailable: 3의 25% = 0.75, 내림해서 0
- maxSurge: 0.75, 올림해서 1

그러니 먼저 새 Pod를 하나 더 띄우고(총 4개), 그게 준비되면 옛 Pod를 하나 줄이는 식으로, 3개가 계속 쓸 수 있는 상태로 교체가 진행된다. 이 계산 결과는 문서의 규칙을 적용한 것이고 클러스터에서 직접 확인한 건 아니다. 이 설정을 명시적으로 쓰면 이렇다.

```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## "준비됐다"를 누가 정하나: probe

롤링 업데이트는 새 Pod가 준비됐다고 판단되어야 다음 Pod로 넘어간다. 컨테이너가 떴다고 앱이 요청을 받을 수 있는 건 아니라서, 쿠버네티스는 kubelet이 주기적으로 찔러 보는 probe를 둔다. 종류는 세 가지이고 실패했을 때 하는 일이 다르다.

| probe | 묻는 것 | 실패하면 |
|---|---|---|
| startup | 앱이 시작을 끝냈나 | kubelet이 컨테이너를 죽이고 재시작 정책을 따른다 |
| liveness | 아직 살아 있나(재시작이 필요한가) | 허용 횟수를 넘기면 kubelet이 컨테이너를 재시작한다 |
| readiness | 지금 트래픽을 받아도 되나 | EndpointSlice 컨트롤러가 그 Pod의 IP를 Service 대상에서 뺀다 |

readiness 실패는 재시작이 아니라 "손님 안 받기"라는 점이 liveness와 다르다. 문서에 따르면 startup probe가 설정되어 있으면 그게 성공할 때까지 liveness와 readiness는 실행되지 않는다. 시작이 오래 걸리는 앱은 liveness가 시작 도중에 실패해서 계속 재시작되는 걸 막으려고 startup probe를 쓴다. 문서는 컨테이너가 보통 `initialDelaySeconds + failureThreshold × periodSeconds`보다 오래 걸려 시작되면 liveness와 같은 엔드포인트를 보는 startup probe를 지정하라고 한다. 그 글에 명시된 `periodSeconds`의 기본값은 10초다.

HTTP probe는 응답 코드가 200 이상 400 미만이면 성공, 그 외는 실패다.

이런 구성을 만들어 봤다.

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

startup probe는 5초 간격으로 12번까지, 즉 60초 안에 성공해야 한다. 이 값은 nginx에 맞춘 임의의 예시이고, 실제 앱은 시작 시간을 재서 정해야 한다. 이 YAML은 문법만 확인했고 클러스터에서 실행해 보지는 않았다.

readiness가 롤링 업데이트와 만나는 지점이 중요하다. 새 Pod의 readiness가 통과해야 "준비됨"으로 세어지고 다음 교체가 진행된다. 앱에 헬스 체크용 경로가 없으면 이 판단을 쓸 수 없으니, 앱 쪽에도 `/healthz` 같은 경로를 만들어 두는 게 전제다. 로드밸런서의 [헬스 체크](#/post/infra-load-balancer)와 같은 발상이다.

## 롤아웃이 멈추거나 잘못됐을 때

새 이미지가 뜨지 않는 식으로 롤아웃이 진행되지 않으면 Deployment는 계속 재시도한다. 문서의 관련 필드는 이렇다.

| 필드 | 기본값 | 내용 |
|---|---|---|
| `minReadySeconds` | 0 | 준비된 뒤 이만큼 크래시 없이 버텨야 "사용 가능"으로 친다 |
| `progressDeadlineSeconds` | 600 | 이 시간 동안 진전이 없으면 실패로 보고한다 |
| `revisionHistoryLimit` | 10 | 롤백용으로 보관하는 옛 ReplicaSet 수 |

`progressDeadlineSeconds`를 넘기면 쿠버네티스는 상태 조건에 `ProgressDeadlineExceeded`를 기록할 뿐 그 외 조치는 하지 않는다고 문서가 적는다. 알아서 되돌려 주는 게 아니다. 되돌리는 건 사람이나 파이프라인이 한다.

```bash
kubectl rollout undo deployment/web
kubectl rollout undo deployment/web --to-revision=2
```

문서에 따르면 롤백은 Deployment의 Pod 템플릿 부분만 이전 리비전으로 되돌린다. 일시 정지된 Deployment는 다시 재개해야 롤백할 수 있다. `revisionHistoryLimit`을 0으로 두면 옛 ReplicaSet이 지워져서 롤백할 수 없다.

## 개수를 바꾸는 법: 수동과 HPA

수동은 `kubectl scale deployment/web --replicas=5`처럼 한다. 자동은 HorizontalPodAutoscaler(HPA)가 한다. HPA는 지속적으로 도는 프로세스가 아니라 제어 루프이고, 문서에 따르면 기본 15초 간격으로 대상 Pod들의 메트릭을 읽어서 Deployment 같은 대상의 replicas를 조정한다. 계산식은 비율이다.

```
desiredReplicas = ceil( currentReplicas × currentMetricValue / desiredMetricValue )
```

예를 들어 Pod 4개의 평균 CPU 사용률이 90%인데 목표가 60%라면 4 × 90/60 = 6, 6개로 늘린다. 이건 위 식에 숫자를 넣어 본 내 계산이다.

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

HPA를 쓸 때 걸리는 조건이 몇 가지 있다.

- 메트릭을 주는 `metrics.k8s.io` API는 보통 Metrics Server라는 애드온이 제공하고, 따로 설치해야 한다.
- 사용률(%) 목표를 쓰려면 컨테이너에 리소스 request가 있어야 한다. 없으면 그 Pod의 CPU 사용률이 정의되지 않고 HPA는 그 메트릭에 대해 아무것도 하지 않는다. 앞 YAML 예제의 Deployment에 `resources.requests.cpu: 100m`을 넣은 이유다.
- HPA가 개수를 관리하면 Deployment 매니페스트의 `spec.replicas`는 지우라고 문서가 권한다. 둘이 서로 덮어쓰지 않게 하려는 것으로 이해했다.
- 기본 동작이 비대칭이다. 문서의 기본 `behavior`는 스케일 다운에 300초 안정화 창을 두고, 스케일 업에는 0초를 둔다. 늘릴 때는 바로, 줄일 때는 5분 지켜본 뒤라는 뜻이다. 목표값 주변 10%(기본 tolerance)는 반응하지 않는다.

<details>
<summary>자세한 풀이: HPA 기본 behavior 블록</summary>

문서가 기본값으로 보여 주는 `behavior` 설정은 이렇다.

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

스케일 업은 15초마다 현재 개수의 100% 또는 Pod 4개 중 큰 쪽(`selectPolicy: Max`)까지 늘릴 수 있고, 스케일 다운은 15초마다 100%까지 줄일 수 있되 앞의 300초 창으로 급락을 막는다. tolerance 기본값 10%는 kube-controller-manager의 `--horizontal-pod-autoscaler-tolerance`로 바꾼다고 한다. 이 모든 값은 문서 기준이고 직접 부하를 걸어 보지는 않았다.

</details>

<details>
<summary>자세한 풀이: 이 글의 YAML을 어떻게 확인했나</summary>

Deployment(롤링 업데이트·probe·resources)와 HPA를 한 파일로 만들어 파이썬 `yaml.safe_load_all`로 읽어 Deployment, HorizontalPodAutoscaler 두 개가 구조대로 읽히는 것을 확인했다. 이 PC에는 `kubectl` 클라이언트(v1.36.1)만 있고 클러스터가 없어서 `kubectl apply --dry-run=client`가 API 접속 실패로 끝났다. 따라서 클러스터에서 실행해 보지는 않았다. 필드 이름과 기본값은 쿠버네티스 문서에서 읽은 것이다.

</details>

## 흔한 오해

- 롤링 업데이트면 무중단이다: 새 Pod의 readiness가 맞게 설정되어 있고 maxUnavailable 등이 알맞아야 한다. probe가 없으면 "떴다"와 "받을 수 있다"가 구분되지 않는다.
- liveness와 readiness는 같다: liveness는 재시작, readiness는 트래픽에서 제외한다.- 롤아웃이 실패하면 알아서 롤백된다: 문서상 `ProgressDeadlineExceeded` 조건만 기록한다. 롤백은 따로 한다.
- HPA는 즉시 늘린다: 15초 주기 루프이고, 줄일 때는 5분 안정화 창이 기본이다. [오토스케일링](#/post/infra-autoscaling) 일반 개념도 같이 보면 이해가 쉽다.

## 마무리

정리하면 배포는 템플릿을 바꾸는 일, 교체 속도는 maxSurge·maxUnavailable, 교체 가능 여부는 readiness, 개수는 HPA가 정한다. 이 네 개를 따로 보면 단순한데 같이 돌 때 서로 영향을 준다. 관측은 [모니터링·로그·알림](#/post/cloud-observability)과 이어진다.

[자세히 → 컨테이너 오케스트레이션과 핵심 오브젝트](#/post/cloud-k8s-intro) · [자세히 → CI/CD와 배포 전략](#/post/cloud-cicd) · [자세히 → 오토스케일링과 확장](#/post/infra-autoscaling)

← [클라우드·배포 map으로](#/post/cloud-map)

관련 글: [Docker와 컨테이너](#/post/cloud-docker) · [모니터링·로그·알림](#/post/cloud-observability)

## 근거 링크

- Kubernetes 문서, Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes 문서, Liveness, Readiness, and Startup Probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Kubernetes 문서, Configure Liveness, Readiness and Startup Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Kubernetes 문서, Horizontal Pod Autoscaling: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Kubernetes 문서, Service: https://kubernetes.io/docs/concepts/services-networking/service/
