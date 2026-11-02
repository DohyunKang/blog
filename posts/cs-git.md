Git은 파일의 변경 내역을 쌓는 도구라기보다 커밋이라는 스냅샷을 이어 붙이고 브랜치는 그중 하나를 가리키는 이름표일 뿐이라는 걸 알고 나면, 머지·리베이스·충돌이 한 그림으로 정리된다.

## 커밋과 브랜치가 뭔지

커밋은 그 시점 프로젝트 전체의 스냅샷이고, 바로 앞 커밋(부모)을 가리키는 링크를 가진다. 커밋마다 해시(긴 16진수 문자열)가 붙는다. 브랜치는 이 커밋 중 하나를 가리키는 포인터다. 새 브랜치를 만든다는 건 파일을 복사하는 게 아니라 이름표 하나를 더 붙이는 일이라 순식간에 끝난다. `HEAD`는 지금 내가 어느 브랜치(커밋)에 있는지 가리키는 포인터다.

작업 흐름에는 영역이 셋 있다.

| 영역 | 뜻 | 옮기는 명령 |
|---|---|---|
| 작업 디렉터리 | 지금 파일을 고치는 곳 | |
| 스테이징(인덱스) | 다음 커밋에 넣을 것을 모아 둔 곳 | `git add` |
| 저장소 | 커밋으로 확정된 기록 | `git commit` |

`git add`를 따로 두는 이유는 고친 것 중 일부만 골라 커밋할 수 있게 하려는 것이다.

이런 도구가 하는 일을 형상관리라고 부른다. 누가 언제 무엇을 바꿨는지 남기고 되돌릴 수 있게 하는 일이다. [자세히 → 소프트웨어 공학 기초](#/post/cs-sw-engineering)

## 머지

두 브랜치를 합치는 게 머지다. 경우가 둘이다. Pro Git 설명 기준이다.

- fast-forward: 합칠 브랜치가 지금 브랜치의 바로 앞쪽 연장선에 있으면, 합칠 게 없어서 포인터만 앞으로 옮긴다. 새 커밋은 안 생긴다.
- 3-way 머지: 두 브랜치가 공통 조상에서 갈라져 각자 커밋이 있으면, 두 끝점과 공통 조상 세 개 스냅샷으로 새 스냅샷을 만들고 부모가 둘인 머지 커밋을 만든다.

## 충돌

둘이 같은 파일의 같은 부분을 서로 다르게 고쳤으면 Git이 판단하지 못하고 멈춘다. 머지 커밋은 아직 만들어지지 않고, `git status`에는 `both modified`로 뜬다. 파일 안에는 표시가 들어간다.

```
<<<<<<< HEAD
main line
=======
feature line
>>>>>>> feature
```

위쪽(`<<<<<<<`~`=======`)이 지금 브랜치, 아래쪽이 가져오는 브랜치다. 해결은 네 단계다.

1. 파일을 열어 한쪽을 고르거나 둘을 섞거나 새로 쓰고, 표시 세 줄을 지운다.
2. `git add <파일>`로 해결했다고 알린다.
3. `git status`로 확인한다.
4. `git commit`으로 머지를 끝낸다.

처음엔 표시를 안 지우고 커밋하는 실수를 하기 쉬워 보였다. 충돌이 무서운 건 어려워서보다는 어디를 봐야 할지 몰라서인 것 같고, 표시가 저 모양이라는 걸 알면 반은 끝난다.

## 리베이스

리베이스는 내 브랜치의 커밋들을 다른 브랜치 끝 위에 다시 얹는 것이다. Pro Git 설명으로는 공통 조상을 찾고, 내 커밋마다 변경분(diff)을 저장하고, 내 브랜치를 대상 브랜치 끝으로 옮긴 뒤 변경분을 차례로 다시 적용한다. 결과 파일 내용은 머지와 같고 기록 모양만 다르다. 머지 커밋 없이 한 줄이 된다.

작은 저장소에서 두 방식을 직접 돌려 봤다. main과 feature가 같은 줄을 고친 상황이다. 머지는 이렇게 가지가 갈라졌다 합쳐지는 모양이 됐다.

```
*   a53bebb merge
|\
| * d6ac9dc feat
* | ffb502f main change
|/
* f1a4288 init
```

같은 상황을 리베이스로 하고 충돌을 풀고 `git rebase --continue` 했더니 이렇게 한 줄이 됐다.

```
* 84091ca feat
* ffb502f main change
* f1a4288 init
```

`feat` 해시가 `d6ac9dc`에서 `84091ca`로 바뀐 게 눈에 띈다. 리베이스는 커밋을 옮기는 게 아니라 같은 내용의 새 커밋을 만들고 옛 커밋은 버린다. 이 사실이 아래 규칙으로 이어진다.

<details>
<summary>자세한 풀이: 위 실습 명령</summary>

임시 폴더에서 `git init`, a.txt에 한 줄 커밋, `feature` 브랜치에서 한 줄 추가, `main`에서 같은 파일에 다른 한 줄 추가 순으로 만들었다. `git merge feature`는 `CONFLICT (content): Merge conflict in a.txt`로 멈췄고, 파일을 고쳐 `git add` 후 커밋했다. 그다음 머지 커밋을 `git reset --hard HEAD~1`로 지우고, `feature`에서 `git rebase main`을 하니 `Could not apply ... feat`로 같은 충돌이 났다. 고치고 `git add` 후 `git rebase --continue`로 끝냈다. 환경은 git 2.55.0(Windows)이다. 즉 리베이스도 충돌이 나면 같은 식으로 풀고, 풀 때는 `merge --continue` 대신 `rebase --continue`를 쓴다.

</details>

## 머지 vs 리베이스

Pro Git은 두 철학으로 소개하고 승자를 가르지 않는다. 하나는 기록은 실제로 있었던 일이니 바꾸지 말자는 쪽(머지), 하나는 기록은 프로젝트가 만들어진 이야기니 공개 전에 정리하자는 쪽(리베이스)이다. 절충안은 "내 로컬 작업은 push 전에 리베이스로 정리하고, 이미 push한 건 절대 리베이스하지 않는다"이다.

| | 머지 | 리베이스 |
|---|---|---|
| 기록 모양 | 갈라졌다 합쳐짐 | 한 줄 |
| 커밋 해시 | 유지 | 새로 만들어짐 |
| 머지 커밋 | 생김 | 안 생김 |
| 이미 공유한 커밋 | 안전 | 위험 |

핵심 규칙은 Pro Git에 이렇게 적혀 있다. 저장소 밖에 있고 남이 그걸 기반으로 작업했을 수 있는 커밋은 리베이스하지 마라. 리베이스하고 force push하면 동료의 기록과 갈라지고, 동료가 pull할 때 같은 작성자·날짜·메시지의 중복 커밋이 생길 수 있다.

## 팀 워크플로우

팀에서 쓰는 흐름은 거의 정해져 있다. 널리 알려진 방식 둘이다.

- 브랜치 방식(feature branch): main에서 갈라 기능마다 브랜치를 만들고, 끝나면 pull request로 리뷰받고 main에 합친다. main은 항상 배포 가능한 상태로 둔다.
- Gitflow: main 외에 develop, feature, release, hotfix 브랜치를 역할별로 둔다. 릴리스 주기가 정해진 프로젝트에 맞고, 작은 팀에는 무겁다는 평이 있다.

커밋 메시지는 한 줄 요약에 무엇을 왜 바꿨는지가 보이게 쓰는 게 나중에 `git log`를 읽는 사람(대개 미래의 나)에게 낫다.

## 흔한 오해

- 브랜치는 폴더 복사다: 그냥 커밋을 가리키는 포인터다. 그래서 만들고 지우는 게 싸다.
- 커밋을 지우면 영영 사라진다: 리베이스나 `reset --hard`로 안 보이게 된 커밋도 `git reflog`에 한동안 남는다. 위 실습에서도 reflog에 `rebase (start)`, `rebase (finish)` 기록이 찍혔다. 다만 기본 정리 주기가 지나면 사라질 수 있어서 영구 보관은 아니다.
- 충돌은 뭔가 잘못했다는 뜻이다: 같은 곳을 둘이 고쳤다는 신호일 뿐이고, 팀 작업에선 흔하다.
- git은 GitHub다: Git은 버전 관리 도구고, GitHub는 Git 저장소를 올려 두고 pull request로 협업하게 하는 서비스다.

<details>
<summary>자세한 풀이: 자주 쓰는 명령 정리</summary>

| 하고 싶은 일 | 명령 |
|---|---|
| 상태 보기 | `git status` |
| 기록 보기(그래프) | `git log --oneline --graph --all` |
| 브랜치 만들고 이동 | `git switch -c <이름>` |
| 합치기 | `git merge <브랜치>` |
| 올리기 위에 얹기 | `git rebase <브랜치>` |
| 머지·리베이스 중단 | `git merge --abort`, `git rebase --abort` |
| 잃어버린 커밋 찾기 | `git reflog` |
| 푸시 전 로컬만 정리 | `git rebase -i <기준>` (interactive는 이번에 실행 안 함) |

`git pull`은 가져오기(fetch)와 합치기(merge)를 한 번에 하는 명령이고, `git pull --rebase`는 합치기 대신 리베이스를 쓴다. Pro Git은 force push 뒤 꼬임을 피하는 방법으로 `git pull --rebase`를 소개한다.

</details>

<details>
<summary>자세한 풀이: 확인 못 함</summary>

Atlassian 가이드 본문은 이번에 직접 열지 않았다(브랜치 방식·Gitflow 설명은 일반적으로 알려진 내용을 쓴 것이라 출처 확인 못 함). `rebase -i`, `cherry-pick`, `stash` 같은 명령은 실행해 보지 않았다. reflog 보관 기간의 정확한 기본값은 확인 못 했다. 커밋 메시지 작성 권장은 개인 판단이라 공식 근거가 없다. 위 3-way 머지 그래프의 해시는 실습 때마다 달라진다.

</details>

← [개념 지도로](#/post/cs-map)

관련 글: [소프트웨어 공학 기초](#/post/cs-sw-engineering), [SOLID 원칙](#/post/cs-solid), [키·시크릿 관리](#/post/sec-keys)

## 근거 링크

- Pro Git, Basic Branching and Merging: https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
- Pro Git, Rebasing: https://git-scm.com/book/en/v2/Git-Branching-Rebasing
- (직접 실행) git 2.55.0 로컬 실습: 임시 저장소에서 머지·충돌·리베이스·reflog 확인
- (읽지 못함) Atlassian Git Tutorial, Comparing Workflows: https://www.atlassian.com/git/tutorials/comparing-workflows
