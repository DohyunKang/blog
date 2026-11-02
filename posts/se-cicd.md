형상 관리는 소프트웨어의 어느 시점 상태를 기준선으로 잡아 두고, 그 기준선이 바뀌는 과정을 추적하는 일이다. 브랜치 전략과 CI/CD는 이 일을 팀 규모에서 돌아가게 하는 방식이다.

[개요](#/post/cs-sw-engineering)에서 형상 관리를 한 단락으로 지나갔고, Git 내부 구조는 [Git 제대로 알기](#/post/cs-git), 파이프라인과 배포 방식은 [CI/CD와 배포 전략](#/post/cloud-cicd)에 있다. 여기서는 그 사이, 도구 이전의 개념과 선택 기준을 다룬다.

## 형상이 뭐고 무엇을 관리하나

형상(configuration)은 소프트웨어를 이루는 산출물 전체다. 소스 코드만이 아니라 설정 파일, 빌드 스크립트, 의존 라이브러리 목록, 문서, 테스트 코드도 들어간다. 관리 대상으로 묶은 개별 항목을 형상 항목이라고 부른다.

"코드는 버전 관리하는데 설정은 서버에 직접 고쳤다"가 사고의 단골이다. 같은 코드인데 설정이 달라서 동작이 달라지면 재현이 안 된다. 그래서 형상 관리는 코드와 같이 움직이는 것을 전부 한 이력에 넣는 쪽으로 간다.

## 기준선

기준선(baseline)은 "이 상태가 공식이다"라고 합의해 고정한 시점이다. 릴리스가 대표적이다. 기준선이 있으면 두 가지가 가능해진다. 어느 시점으로든 정확히 되돌아갈 수 있고, 기준선 이후에 무엇이 바뀌었는지 목록으로 말할 수 있다.

기준선을 아주 단순하게 만들면 이렇다. 파일 내용을 해시로 줄이고, 그 목록을 다시 해시하면 상태 전체를 가리키는 짧은 ID가 나온다.

```python
import hashlib, json

def snapshot(files):
    items = {name: hashlib.sha256(data.encode()).hexdigest()[:8] for name, data in sorted(files.items())}
    bid = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()[:8]
    return bid, items

v1 = {"app.py": "print('hi')", "config.yml": "debug: false", "README": "v1"}
v2 = dict(v1, **{"config.yml": "debug: true"})

b1, i1 = snapshot(v1)
b1b, _ = snapshot(dict(reversed(list(v1.items()))))
b2, i2 = snapshot(v2)
print(b1, b1b, b1 == b1b)
print(b2, b1 != b2)
print([n for n in i1 if i1[n] != i2[n]])
```

```
443516a5 443516a5 True
7d2092ea True
['config.yml']
```

파일 순서를 뒤집어도 ID가 같고, 설정 한 줄만 바꿔도 ID가 달라지며, 무엇이 바뀌었는지 비교가 된다. Git의 커밋 해시가 같은 발상 위에 있다. 이 코드는 원리를 보려고 줄인 것이고, 실제 Git 방식과 같지는 않다.

## 변경 통제

기준선이 있으면 그걸 바꾸는 절차도 필요하다. 변경 요청이 들어오면 영향 범위를 보고, 누가 승인하고, 어떤 기준선에 반영할지 정한다. 전통적인 개발 조직에서는 이 승인을 위원회 형태로 두기도 한다. 요즘 팀에서는 풀 리퀘스트 리뷰와 필수 상태 검사가 그 자리를 대신하는 경우가 많다. 형태는 달라도 "누가 어떤 근거로 기준선을 바꿨는지 남는다"는 점은 같다.

## 버전 번호도 형상 관리의 일부다

기준선에 붙이는 이름이 버전이다. 시맨틱 버저닝(SemVer)은 `MAJOR.MINOR.PATCH` 세 숫자에 의미를 준다.

| 올리는 자리 | 언제 | 아래 자리 |
|---|---|---|
| MAJOR | 공개 API가 하위 호환이 안 되게 바뀔 때 | MINOR, PATCH를 0으로 |
| MINOR | 하위 호환되는 기능이 추가될 때 | PATCH를 0으로 |
| PATCH | 하위 호환되는 버그 수정 | - |

규칙이 몇 개 더 있다. 배포된 버전은 수정하지 않고 바뀌면 새 버전을 낸다. `-rc.1` 같은 사전 배포 표기는 정식 버전보다 낮은 우선순위다. `+build7` 같은 빌드 메타데이터는 우선순위 비교에서 무시된다. 메이저가 0인 동안은 언제든 바뀔 수 있는 초기 개발 단계로 본다.

<details>
<summary>정렬 규칙을 코드로 확인</summary>

문자열로 정렬하면 `1.10.0`이 `1.9.0`보다 앞에 온다. 숫자로 비교하고, 사전 배포 식별자는 규칙대로 비교해야 한다.

```python
import re

def parse(v):
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?", v)
    major, minor, patch, pre = m.group(1), m.group(2), m.group(3), m.group(4)
    return int(major), int(minor), int(patch), pre.split(".") if pre else None

def pre_key(ident):
    return (0, int(ident), "") if ident.isdigit() else (1, 0, ident)

def sort_key(v):
    major, minor, patch, pre = parse(v)
    if pre is None:
        return (major, minor, patch, 1, ())
    return (major, minor, patch, 0, tuple(pre_key(i) for i in pre))

def bump(v, kind):
    major, minor, patch, _ = parse(v)
    if kind == "major": return f"{major+1}.0.0"
    if kind == "minor": return f"{major}.{minor+1}.0"
    return f"{major}.{minor}.{patch+1}"

versions = ["3.0.0", "3.0.0-rc.1", "3.0.0-beta.11", "3.0.0-beta.2", "1.10.0", "1.9.0", "1.0.0+build7"]
print(sorted(versions, key=sort_key))
print(sort_key("1.0.0+build7") == sort_key("1.0.0+other"))
for k in ("patch", "minor", "major"):
    print(k, bump("1.4.7", k))
```

```
['1.0.0+build7', '1.9.0', '1.10.0', '3.0.0-beta.2', '3.0.0-beta.11', '3.0.0-rc.1', '3.0.0']
True
patch 1.4.8
minor 1.5.0
major 2.0.0
```

`beta.2`가 `beta.11`보다 앞에 오는 건 숫자 식별자를 숫자로 비교하기 때문이다.
</details>

## 브랜치 전략은 배포 방식에서 갈린다

브랜치 전략은 "기준선을 어떤 경로로 만들어 가나"의 선택이다. 가장 많이 언급되는 git-flow는 `master`(릴리스마다 태그가 붙는 운영 코드)와 `develop`(다음 릴리스를 위한 통합 브랜치)를 두고, 기능은 feature, 릴리스 준비는 release, 운영 긴급 수정은 hotfix 브랜치로 나눈다.

| 브랜치 | 어디서 따서 | 어디로 합치나 |
|---|---|---|
| feature | develop | develop |
| release | develop | master, develop |
| hotfix | master | master, develop |

git-flow를 제안한 글의 저자는 2020년에 덧붙인 글에서, 웹 앱처럼 계속 배포하는 소프트웨어는 여러 버전을 동시에 유지할 필요가 없으니 GitHub flow 같은 훨씬 단순한 흐름이 낫다고 썼다. 버전이 명시적으로 붙고 여러 버전을 현장에서 지원해야 하는 소프트웨어에는 git-flow가 여전히 맞는다고 한다. 어느 쪽이 좋은지는 배포 방식이 정한다.

[Git 제대로 알기](#/post/cs-git)의 머지·리베이스 이야기는 브랜치를 어떻게 합치느냐였고, 여기서는 브랜치를 몇 종류 어떤 수명으로 두느냐가 쟁점이다.

## CI는 도구가 아니라 습관이다

CI(지속적 통합)를 Martin Fowler의 글은 이렇게 정의한다. 팀원이 각자 바꾼 것을 적어도 하루에 한 번 공통 코드베이스에 합치고, 합칠 때마다 테스트가 포함된 자동 빌드가 돈다. 그 글이 꼽는 실천 항목 중 형상 관리와 맞닿은 것들은 이렇다.

- 모든 것을 버전 관리되는 메인라인에 둔다. 저장소를 받아서 바로 빌드하고 실행할 수 있어야 한다.
- 빌드는 명령 하나로 자동화하고, 빌드에 테스트를 넣어 초록불이면 큰 버그가 없다고 볼 수 있게 한다.
- 메인라인에 푸시할 때마다 CI 서버에서 빌드한다.
- 깨진 빌드는 바로 고친다. 보통은 문제 커밋을 되돌려 팀이 계속 일하게 한 뒤 원인은 따로 찾는다.
- 빌드는 빠르게 유지한다. 글은 XP의 "10분 빌드"를 대부분 프로젝트에 적당한 기준으로 든다.
- 만들다 만 기능은 기능 플래그 같은 방법으로 숨긴다.

마지막 항목이 브랜치 전략과 이어진다. 하루 한 번 합치려면 기능이 하루 안에 끝나지 않아도 합칠 수 있어야 하고, 그래서 브랜치를 오래 끌고 가는 대신 미완성 기능을 코드 안에서 꺼 둔다. 브랜치 수명이 길수록 CI의 "자주 합친다"는 전제와 멀어진다.

테스트가 빌드 안에 들어가므로 [테스트와 품질](#/post/se-testing)의 단위·통합 테스트 구성이 CI 시간을 좌우한다. 글은 빠른 커밋 빌드를 먼저 돌리고 느린 테스트는 뒤 단계에서 돌리는 배포 파이프라인 구성을 권한다.

## CI, 전달, 배포를 구분하기

| 이름 | 자동으로 하는 일 | 사람이 하는 일 |
|---|---|---|
| CI | 합치고 빌드, 테스트 | - |
| 지속적 전달 | 배포 가능한 상태까지 | 운영 배포 버튼 |
| 지속적 배포 | 운영 배포까지 | 없음(모니터링) |

단계별 YAML 예시와 블루-그린·카나리 같은 배포 방식은 [CI/CD와 배포 전략](#/post/cloud-cicd)에 있다. 배포 뒤 상태를 보는 쪽은 [모니터링·로그·알림](#/post/cloud-observability)이다.

## 흔한 오해

- CI 서버를 두면 CI를 한다: 합치는 빈도가 낮으면 서버가 있어도 통합 문제는 늦게 드러난다.
- 브랜치는 많을수록 안전하다: 브랜치가 오래 살수록 합칠 때 충돌과 통합 비용이 커진다.
- git-flow가 표준이다: 제안자가 직접 상황에 따라 다르다고 정리했다.
- 버전 번호는 마케팅 이름이다: SemVer에서는 공개 API 변경의 성격을 알려 주는 약속이다.

## 근거 링크

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Martin Fowler — Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html)
- [nvie — A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)

← [CS 지도로](#/post/cs-map)

관련 글: [소프트웨어 공학 기초](#/post/cs-sw-engineering) · [Git 제대로 알기](#/post/cs-git) · [CI/CD와 배포 전략](#/post/cloud-cicd)
