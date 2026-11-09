오케스트레이션은 컨테이너를 여러 대 서버에 나눠 띄우고, 죽으면 다시 켜고, 서로 찾게 해 주는 일을 자동으로 하는 것이다. 쿠버네티스(Kubernetes, 줄여서 K8s)가 그걸 하는 대표적인 도구라서, 이번에는 이게 무슨 문제를 푸는지와 처음 만나는 오브젝트 네 개(Pod, Deployment, Service, ConfigMap/Secret)를 정리했다.

## 컨테이너가 많아지면 생기는 일

[Docker](#/post/cloud-docker) 컨테이너 하나는 `docker run`으로 켜면 끝이다. 문제는 그 다음이다. 같은 앱을 세 개 띄우고 싶고, 하나가 죽으면 다시 켜야 하고, 새 버전으로 바꿀 때 끊김이 없어야 하고, 앞단에서 세 개로 요청을 나눠 줘야 한다. 서버가 여러 대면 어느 서버에 띄울지도 정해야 한다. 이걸 사람이 손으로 하면 금방 한계가 온다.

쿠버네티스 문서는 자신을 "컨테이너화된 워크로드와 서비스를 관리하는, 이식 가능하고 확장 가능한 오픈소스 플랫폼"이라고 소개한다. 선언형 설정과 자동화를 둘 다 지원한다고 한다. 문서가 드는 기능은 이런 것들이다.

| 기능 | 문서 설명 요약 |
|---|---|
| 서비스 발견·로드밸런싱 | DNS 이름이나 IP로 컨테이너를 노출하고 트래픽을 나눈다 |
| 자동 롤아웃·롤백 | 원하는 상태를 적으면 통제된 속도로 실제 상태를 맞춘다 |
| 자가 치유 | 실패한 컨테이너를 재시작·교체하고, 헬스 체크에 응답 없는 컨테이너는 죽인다 |
| 자동 배치(bin packing) | 컨테이너별 CPU·메모리 요구량을 보고 노드에 알맞게 올린다 |
| 시크릿·설정 관리 | 이미지를 다시 빌드하지 않고 설정과 시크릿을 바꾼다 |

문서가 "아닌 것"도 적어 둔다. 전통적인 올인원 PaaS가 아니고, 소스 코드를 빌드하거나 배포해 주지 않고(CI/CD는 각자 구성), 데이터베이스 같은 앱 서비스를 기본으로 주지 않는다. [CI/CD](#/post/cloud-cicd)는 쿠버네티스 바깥에서 따로 만든다는 뜻이다.

## 선언형이라는 말

이 도구를 이해하는 핵심은 "선언형"이다. 명령형이 "컨테이너 3개를 켜라"라면, 선언형은 "항상 3개가 떠 있는 상태여야 한다"고 적어 두는 것이다. 문서는 쿠버네티스가 고정된 절차를 실행하는 게 아니라 "현재 상태를 원하는 상태로 계속 이끄는, 독립적이고 조합 가능한 제어 프로세스 집합"이라고 설명한다. 그래서 A에서 C로 어떻게 가느냐는 중요하지 않다고 한다.

실제로는 이렇게 돈다. 내가 YAML 파일로 원하는 상태를 API 서버에 제출하면, 컨트롤러들이 지금 상태와 비교해서 차이가 있으면 맞춘다. 컨테이너가 하나 죽으면 "3개여야 하는데 2개"가 되니까 컨트롤러가 하나를 더 만든다.

## Pod: 쿠버네티스가 다루는 가장 작은 단위

쿠버네티스는 컨테이너를 직접 다루지 않고 Pod를 다룬다. 문서 표현으로 Pod는 "만들고 관리할 수 있는 가장 작은 배포 단위"이고, 공유 스토리지·네트워크를 가진 컨테이너 한 개 이상의 묶음이다. 한 Pod 안의 컨테이너는 같은 곳에 함께 배치되고 같은 컨텍스트에서 돈다. 대부분은 Pod 하나에 컨테이너 하나이고, 문서는 여러 컨테이너를 한 Pod에 넣는 건 서로 강하게 묶여 있을 때만 쓰라고 한다.

Pod는 "비교적 일시적이고 버려도 되는" 존재로 설계됐다고 한다. 노드가 죽거나 자원이 부족해 쫓겨나면 사라진다. 그래서 문서도 Pod를 직접 만들지 말고 Deployment나 Job 같은 워크로드 리소스로 만들라고 안내한다. 이 부분이 처음에는 이상했는데, "Pod는 소모품이고 개수와 교체는 위에서 관리한다"로 받아들이니 정리가 됐다.

## Deployment: 개수와 교체를 맡는 쪽

Deployment는 Pod와 ReplicaSet에 대한 선언형 업데이트를 제공한다. 원하는 상태를 적으면 Deployment 컨트롤러가 통제된 속도로 실제 상태를 맞춘다. 문서의 예제를 거의 그대로 가져오면 이렇다.

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

`replicas: 3`이 "Pod 3개"라는 선언이고, `selector`는 이 Deployment가 어떤 Pod를 관리할지 라벨로 찾는 규칙이다. `template`은 Pod를 어떻게 만들지 적은 설계도다. Deployment가 ReplicaSet을 만들고 ReplicaSet이 Pod 3개를 만든다. 문서는 Deployment가 소유한 ReplicaSet을 직접 만지지 말라고 적는다.

새 버전을 올리면 새 ReplicaSet이 만들어지고, 새 쪽은 서서히 늘고 옛 쪽은 서서히 줄어든다. 이 과정은 다음 글에서 따로 다룬다.

[자세히 → 배포·확장·롤링 업데이트](#/post/cloud-k8s-deploy)

## Service: 바뀌는 Pod 앞의 고정 주소

Pod는 죽고 다시 만들어지면서 IP가 바뀐다. 그래서 클라이언트가 Pod IP를 직접 알고 있을 수 없다. Service가 그 앞에 서서 하나의 안정된 접점이 된다. 문서는 Service를 "클러스터에서 하나 이상의 Pod로 돌아가는 네트워크 앱을 노출하는 방법"이라고 설명한다.

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

`selector`가 라벨이 `app: web`인 Pod들을 찾고, 컨트롤러가 일치하는 Pod 목록(EndpointSlice)을 계속 갱신한다. `port`는 Service가 받는 포트이고 `targetPort`는 Pod 쪽 포트다. 생략하면 같은 값이 된다.

종류는 세 가지를 먼저 알면 된다.

| 타입 | 문서 설명 요약 |
|---|---|
| ClusterIP | 기본값. 클러스터 안에서만 접근 가능 |
| NodePort | 각 노드 IP의 고정 포트로 노출 |
| LoadBalancer | 외부 로드밸런서로 노출. 쿠버네티스가 직접 로드밸런서를 제공하지는 않아서 클라우드 제공자와 연동하거나 따로 준비해야 한다 |

같은 클러스터 안의 다른 앱은 이름으로 부른다. DNS 문서에 따르면 일반 Service에는 `my-svc.my-namespace.svc.cluster-domain.example` 형태의 이름이 붙고 Service의 cluster IP로 풀린다. 외부에 공개하려면 문서는 Ingress나 Gateway를 쓰라고 한다. 앞단 분산 개념은 [로드밸런서](#/post/infra-load-balancer) 글에 따로 있다.

## ConfigMap과 Secret: 설정을 이미지 밖에

설정값을 이미지 안에 넣으면 환경마다 이미지를 다시 만들어야 한다. ConfigMap은 환경별 설정을 컨테이너 이미지에서 떼어 놓는 오브젝트다. 문서가 정리한 사용 방식은 컨테이너의 command·args, 환경변수, 읽기 전용 볼륨의 파일, 애플리케이션이 API로 직접 읽기 네 가지다. 크기는 1MiB를 넘을 수 없고, Pod와 같은 네임스페이스에 있어야 한다.

Secret은 비밀번호·토큰·키처럼 민감한 데이터를 담는 오브젝트다. 둘의 차이는 문서가 분명히 적는다. ConfigMap은 비밀 유지나 암호화를 제공하지 않으니 민감한 데이터는 Secret을 쓰라고 한다. 다만 Secret도 안전하다고 안심할 수는 없다. 문서의 주의 사항은 이렇다.

- Secret은 기본적으로 API 서버의 데이터 저장소(etcd)에 암호화되지 않은 채 저장된다.
- API 접근 권한이 있으면 누구나 Secret을 읽거나 바꿀 수 있다. 같은 네임스페이스에서 Pod를 만들 수 있는 사람은 Deployment를 통해서라도 그 네임스페이스의 Secret을 읽을 수 있다.
- 최소 조치로 저장 시 암호화, 최소 권한 RBAC, 특정 컨테이너로 접근 제한, 외부 시크릿 저장소 검토를 든다.

예제 YAML에서 쓰는 base64는 암호화가 아니라 인코딩이라서 누구든 되돌릴 수 있다. 키 관리 일반론은 [환경변수와 시크릿 관리](#/post/cloud-secrets) 글에 있다.

Deployment에서 ConfigMap과 Secret을 환경변수로 받는 모양은 이렇다.

```yaml
        envFrom:
        - configMapRef:
            name: web-config
        - secretRef:
            name: web-secret
```

## 네 개를 한 줄로 이으면

| 오브젝트 | 하는 일 | 비유하자면 |
|---|---|---|
| Pod | 컨테이너를 실제로 담는 최소 단위 | 소모품 작업자 |
| Deployment | Pod 개수와 교체를 선언하고 유지 | 작업자 수를 맞추는 반장 |
| Service | 바뀌는 Pod 앞의 고정 주소와 분산 | 대표 전화번호 |
| ConfigMap/Secret | 설정과 비밀을 이미지 밖에서 주입 | 작업 지시서 |

비유는 이해용이고, 실제로는 모두 API 서버에 저장되는 오브젝트이며 컨트롤러가 선언과 현재 상태를 맞춘다.

## 흔한 오해

- 쿠버네티스는 Docker를 대체한다: 아니다. 컨테이너를 어떻게 운영하느냐를 다루는 층이고, 컨테이너 이미지는 그대로 쓴다.
- Pod는 컨테이너와 같은 말이다: Pod는 컨테이너 한 개 이상의 묶음이고 공유 스토리지·네트워크 단위다.
- Secret이면 안전하다: 기본 저장은 암호화되지 않는다. 암호화 설정과 접근 제한을 따로 해야 한다.
- 쿠버네티스는 앱 배포까지 다 해 준다: 문서에 따르면 소스 빌드와 배포 파이프라인은 범위 밖이다.

<details>
<summary>자세한 풀이: 이 글의 YAML을 어떻게 확인했나</summary>

이 PC에는 `kubectl` 클라이언트(v1.36.1)만 있고 클러스터는 없다. 위 YAML은 파이썬 `yaml.safe_load_all`로 문법과 구조(ConfigMap, Secret, Deployment, Service 네 개)가 읽히는 것까지만 확인했다. `kubectl apply --dry-run=client`는 클러스터의 API 정보를 가져오려다 접속 실패로 끝나서 쓰지 못했다. 클러스터에서 실행해 보지는 않았다.

예제 Deployment와 Service는 쿠버네티스 문서의 예제를 바탕으로 이름과 이미지 태그를 바꾼 것이다.

</details>

<details>
<summary>자세한 풀이: 문서에 있는 Pod 정의</summary>

문서는 Pod를 "스토리지와 네트워크를 공유하는 하나 이상의 컨테이너 그룹과 그 실행 방법에 대한 명세"로 정의한다. Pod는 프로세스가 아니라 컨테이너가 돌 환경이고, 삭제될 때까지 유지된다고 적는다. 복제된 Pod는 보통 워크로드 리소스와 그 컨트롤러가 묶음으로 만들고 관리한다. 상태를 추적해야 하는 Pod에는 StatefulSet을 고려하라고도 한다.

</details>

## 마무리

처음 쿠버네티스가 어려웠던 건 용어가 많아서였는데, "원하는 상태를 적으면 컨트롤러가 맞춘다"는 한 줄을 잡고 나니 Pod·Deployment·Service가 각자 무엇을 선언하는 오브젝트인지로 정리됐다. 다음 글은 이걸로 실제 배포를 어떻게 굴리는지다.

[자세히 → 쿠버네티스 배포·확장·롤링 업데이트](#/post/cloud-k8s-deploy) · [자세히 → 모니터링·로그·알림](#/post/cloud-observability)

← [클라우드·배포 map으로](#/post/cloud-map)

관련 글: [Docker와 컨테이너](#/post/cloud-docker) · [CI/CD와 배포 전략](#/post/cloud-cicd) · [환경변수와 시크릿 관리](#/post/cloud-secrets)

## 근거 링크

- Kubernetes 문서, Overview: https://kubernetes.io/docs/concepts/overview/
- Kubernetes 문서, Pods: https://kubernetes.io/docs/concepts/workloads/pods/
- Kubernetes 문서, Deployments: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Kubernetes 문서, Service: https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes 문서, DNS for Services and Pods: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Kubernetes 문서, ConfigMaps: https://kubernetes.io/docs/concepts/configuration/configmap/
- Kubernetes 문서, Secrets: https://kubernetes.io/docs/concepts/configuration/secret/
