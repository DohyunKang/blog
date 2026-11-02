Docker는 앱과 그 앱이 돌아가는 데 필요한 파일을 묶어서 "컨테이너"라는 격리된 프로세스로 실행하게 해 주는 도구다. 내 PC에서 되던 게 서버에서 안 되는 문제를 줄이려고 쓴다.

## 먼저 쉬운 말로

앱을 서버에 올리면 자주 이런 일이 생긴다. 내 컴퓨터는 Python 3.12인데 서버는 3.8이거나, 라이브러리 버전이 달라서 안 돈다. Docker 문서는 이걸 이렇게 푼다. 앱을 "느슨하게 격리된 환경"인 컨테이너에 담아서, 앱이 호스트에 뭐가 깔려 있는지에 기대지 않게 한다.

비유하면 이삿짐 컨테이너 같다. 짐(앱)과 그 안의 가구(라이브러리, 런타임)를 통째로 상자에 넣고 옮기니까, 도착한 곳이 어떤 집이든 상자 안은 그대로다. 다만 이건 비유고, 실제로는 상자가 컴퓨터를 하나 더 흉내 내는 건 아니다. 그 얘기는 아래 가상머신 부분에서 한다.

[자세히 → 클라우드 기초](#/post/cloud-basics)

## 이미지와 컨테이너

용어가 둘 나와서 처음에 가장 헷갈렸다.

| | 이미지(image) | 컨테이너(container) |
|---|---|---|
| 정체 | 읽기 전용 템플릿 | 이미지를 실제로 실행한 것 |
| 비유 | 레시피, 설치 파일 | 그 레시피로 만든 요리, 실행 중인 프로그램 |
| 바뀌나 | 안 바뀐다 | 돌면서 파일이 바뀔 수 있다 |
| 개수 | 하나 | 한 이미지로 여러 개 |

Docker 문서 표현으로 이미지는 "컨테이너를 만드는 지침이 담긴 읽기 전용 템플릿"이고, 컨테이너는 "이미지의 실행 가능한 인스턴스"다. 클래스와 객체 관계로 보면 쉽다. 이미지가 클래스고 컨테이너가 인스턴스다.

컨테이너 안에서 바꾼 내용은 영구 저장소(볼륨 등)에 따로 저장하지 않으면 컨테이너를 지울 때 같이 사라진다. 그래서 DB 같은 걸 컨테이너에 넣을 땐 데이터를 어디에 둘지부터 정해야 한다.

## 이미지는 층(layer)으로 쌓인다

이미지는 한 덩어리가 아니라 여러 층이 겹친 구조다. 문서의 예시는 다섯 층이다. 기본 명령과 패키지 관리자, Python 런타임, 요구사항 파일, 설치한 라이브러리, 마지막으로 내 소스 코드.

- 한 번 만든 층은 바뀌지 않는다(immutable).
- 컨테이너가 돌면서 생기는 변경은 그 컨테이너만의 별도 디렉터리에 쌓여서, 원래 이미지 층은 그대로다. 그래서 한 이미지로 컨테이너를 여럿 띄울 수 있다.
- 층은 이미지끼리 공유된다. 같은 Python 베이스 층을 쓰는 앱 두 개는 그 층을 한 번만 받으면 된다. 문서는 이게 빌드 속도와 저장 공간, 전송량을 줄여 준다고 한다.

내려받은 각 층은 호스트에서 각자 디렉터리로 풀리고, union 파일시스템이 이걸 하나로 겹쳐 보여 준다. 컨테이너의 루트 디렉터리는 그 겹친 결과를 가리킨다.

## Dockerfile: 이미지를 만드는 설계도

이미지를 만드는 방법을 적은 텍스트 파일이 Dockerfile이다. 직접 만들어서 돌려 봤다.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
CMD ["python", "app.py"]
```

`app.py`는 한 줄짜리다.

```python
import platform
print("hello from container:", platform.system())
```

각 줄은 이렇게 읽는다.

- `FROM`: 어떤 이미지 위에서 시작할지. 여기선 공식 Python 이미지(slim)를 베이스로 쓴다.
- `WORKDIR`: 이후 명령이 실행될 작업 폴더.
- `COPY`: 내 PC의 파일을 이미지 안으로 복사.
- `CMD`: 컨테이너를 켰을 때 기본으로 실행할 명령.

빌드하고 실행하는 명령은 이렇다.

```bash
docker build -t blog-hello .
docker run --rm blog-hello
```

내 PC(Windows)에서 돌린 결과다.

```
hello from container: Linux
```

Windows PC에서 실행했는데 컨테이너 안은 Linux로 나왔다. 컨테이너가 자기만의 파일시스템과 환경을 갖고 있다는 걸 눈으로 본 셈이다. 이유는 아래에서 설명한다. (이 PC에서는 Docker Desktop으로 돌렸다.)

`docker image history blog-hello`로 층을 보면 내가 쓴 줄들이 위쪽에 보인다.

```
CMD ["python" "app.py"]
COPY app.py . # buildkit
WORKDIR /app
CMD ["python3"]
RUN /bin/sh -c set -eux; ...   (베이스 이미지의 층들)
ENV PYTHON_VERSION=3.12.16
```

내 Dockerfile 세 줄(`WORKDIR`, `COPY`, `CMD`) 아래에 Python 공식 이미지가 쌓아 둔 층들이 이어진다. 내 코드 층만 바뀌면 아래 베이스 층은 다시 받을 필요가 없다. 문서도 이미지를 다시 빌드하면 바뀐 층만 새로 만든다고 적는다.

## 가상머신과 뭐가 다른가

둘 다 "격리된 환경"이라서 같은 걸로 보기 쉽다. 차이는 커널이다.

| | 가상머신(VM) | 컨테이너 |
|---|---|---|
| 안에 든 것 | 운영체제 전체(커널·드라이버 포함) + 앱 | 앱에 필요한 파일 |
| 커널 | VM마다 따로 | 호스트 커널을 같이 씀 |
| 무게 | 무거움 | 가벼움(프로세스에 가깝다) |
| 같은 서버에 | 적게 | 더 많이 |

Docker 문서는 VM을 앱 하나 격리하려고 쓰면 "오버헤드가 크다"고 하고, 컨테이너는 호스트 커널을 공유해서 같은 인프라에 더 많은 앱을 돌릴 수 있다고 설명한다. 같은 페이지에서, 둘은 같이 쓰이기도 한다고 한다. 클라우드에서는 VM 위에 컨테이너 런타임을 올려서 컨테이너 여러 개를 돌리는 식이다.

그래서 위의 "Windows인데 Linux로 나온" 이유도 이쪽에 있다. 컨테이너는 호스트 커널을 쓰는데, Linux 컨테이너는 Linux 커널이 필요하다. Windows나 Mac에서 Docker Desktop을 쓰면 안쪽에서 Linux 환경(가상화)이 하나 돌고 그 위에서 컨테이너가 돈다고 알고 있다. 이 부분은 이번에 공식 문서로 확인하지 못했다(아래 '확인 못 함').

격리는 리눅스 커널 기능으로 한다. 문서에 따르면 Docker는 namespace 같은 기능으로 컨테이너마다 격리된 작업 공간을 만들고, 컨테이너의 각 측면은 별도 namespace에서 돌아 그 안으로만 접근이 제한된다.

## Docker의 구성

명령을 칠 때 실제로 누가 뭘 하는지도 정리해 둔다. 문서 기준이다.

| 구성 | 하는 일 |
|---|---|
| 클라이언트(`docker`) | 우리가 치는 명령줄 도구. 명령을 데몬에 보낸다 |
| 데몬(`dockerd`) | 백그라운드에서 이미지·컨테이너·네트워크·볼륨을 실제로 관리 |
| 레지스트리 | 이미지를 저장해 두는 곳. 기본 공개 레지스트리가 Docker Hub |

`docker run`을 치면 클라이언트가 데몬에 요청하고, 로컬에 이미지가 없으면 레지스트리에서 받아 온다. 클라이언트와 데몬은 REST API로 통신한다(UNIX 소켓이나 네트워크로).

## 흔한 오해

- 컨테이너는 작은 가상머신이다: 아니다. 자기 커널이 없고 호스트 커널을 쓴다. 프로세스를 격리한 것에 가깝다.
- 이미지와 컨테이너가 같은 말이다: 이미지는 템플릿, 컨테이너는 실행 중인 것이다. 한 이미지로 컨테이너 여러 개를 띄운다.
- 컨테이너 안에 저장한 파일은 남는다: 볼륨 같은 영구 저장소에 안 두면 컨테이너를 지울 때 사라진다.
- Docker면 보안은 알아서 된다: 격리가 되는 건 맞지만 설정과 이미지 출처에 따라 달라진다. 이번 글에서는 보안 쪽을 따로 확인하지 않았다.

<details>
<summary>자세한 풀이: 층이 쌓이는 걸 손으로 보면</summary>

Docker 문서의 층 튜토리얼은 `Dockerfile` 없이 손으로 층을 만든다. Ubuntu 컨테이너에 Node.js를 설치하고 `docker container commit`으로 저장하면 `node-base` 층이 되고, 거기에 `app.js`를 넣어 다시 commit하면 `app` 층이 된다. `docker image history`를 치면 층마다 commit 때 쓴 메모("Add node", "Add app")가 보인다.

Dockerfile은 이 과정을 자동으로 해 준다고 문서에 나온다. 줄마다 층이 하나씩 생긴다는 설명은 이번에 읽은 문서 페이지에 명시되어 있지 않았다. 다만 위에서 `docker image history`로 내 Dockerfile의 `WORKDIR`, `COPY`, `CMD`가 각각 한 줄씩 나타난 것은 직접 확인했다(`CMD`, `WORKDIR` 같은 설정성 줄은 크기가 0인 층으로 나오는 걸로 알고 있는데 크기는 보지 않았다).

</details>

<details>
<summary>자세한 풀이: 이 글에서 직접 돌려 본 것</summary>

환경은 Docker 29.8.2(Windows). 임시 폴더에 `app.py`와 `Dockerfile`을 만들고 `docker build`, `docker run --rm`을 실행했고, 출력은 본문의 결과와 같다. 베이스 이미지는 `python:3.12-slim`을 새로 받았고, 이미지 기록에서 Python 3.12.16이 보였다. 실행 뒤 만든 이미지는 지웠다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: 이미지·컨테이너 정의, 데몬·클라이언트·레지스트리 구조, namespace 사용(Docker 문서). 층의 불변성과 공유, union 파일시스템, chroot(Docker 문서). 컨테이너와 VM의 커널 차이(Docker 문서). 위 Dockerfile의 빌드와 실행(직접 실행).

확인 못 함: Docker Desktop이 Windows·Mac에서 내부적으로 Linux 가상화를 쓴다는 설명(공식 문서 확인 안 함, 알고 있던 내용). Dockerfile 줄마다 층이 생기는 규칙의 정확한 조건(이번에 `Dockerfile reference` 페이지를 읽지 않음). 캐시가 무효화되는 정확한 규칙. 보안과 리소스 제한(cgroups) 쪽.

</details>

## 마무리

내 컴퓨터에서 돌던 걸 이미지로 만들어 두면, 서버에서는 그 이미지를 받아서 켜기만 하면 된다. 다음에는 이걸 서버 없이 돌리는 방식이나 자동으로 배포하는 흐름이 궁금해진다.

[자세히 → 서버리스](#/post/cloud-serverless) · [자세히 → CI/CD와 배포 전략](#/post/cloud-cicd) · [자세히 → 환경변수와 시크릿 관리](#/post/cloud-secrets)

← 클라우드·배포 지도로

관련 글: [클라우드 기초](#/post/cloud-basics) · [서버리스](#/post/cloud-serverless) · [CI/CD와 배포 전략](#/post/cloud-cicd)

## 근거 링크

- Docker 문서, Docker overview: https://docs.docker.com/get-started/docker-overview/
- Docker 문서, Understanding image layers: https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/
- Docker 문서, What is a container?: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/
