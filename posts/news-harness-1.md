# Claude Code 2.1.314, 쓰기도 작업 폴더 밖으로 못 나가게 막을 수 있게 됐다

확인한 시점은 2026-11-02. 공식 문서의 변경 기록(changelog) 맨 위가 2.1.316(10월 31일)이었고, 그 아래로 며칠 치를 훑었다. 대부분 작은 수정인데 2.1.314(10월 30일) 항목 하나가 걸렸다. 파일을 쓰는 도구가 작업 폴더 밖 경로를 거부하게 만드는 설정이 새로 생겼다.

## 변경 기록에 적힌 것

2.1.314 항목은 이렇게 적혀 있다.

> Added `permissions.blockWritesOutsideWorkingDirectories`: Write, Edit and NotebookEdit refuse paths outside the working directories in every permission mode

풀어 쓰면 Write, Edit, NotebookEdit 세 도구가 작업 폴더 바깥 경로를 거절한다. 그리고 권한 모드가 뭐든 상관없이 적용된다. 같은 날 항목에는 조직 관리자가 모델의 effort 상한을 걸어 둔 경우 "Invalid effort level"로 턴마다 실패하던 문제를 고쳤다는 내용도 있다.

주변 버전에서 눈에 띈 것도 적어 둔다.

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 2.1.316 | 10월 31일 | `CLAUDE_CODE_DISABLE_ULTRATHINK` 추가. Opus 4.8의 fast mode는 10월 30일부로 deprecated, 11월 30일 제거 예정 |
| 2.1.314 | 10월 30일 | `permissions.blockWritesOutsideWorkingDirectories` 추가 |
| 2.1.312 | 10월 27일 | 하위 폴더의 아주 큰 CLAUDE.md를 앞부분만 보고 덮어쓰던 문제 수정. Write가 전부 읽거나 제자리 편집을 하라고 요청한다 |
| 2.1.309 | 10월 22일 | `sed -i`가 파일 편집 미리보기 대신 일반 Bash 확인창을 거쳐 그대로 실행된다. 샌드박스 Bash가 셸 시작 파일을 샌드박스 밖에서 실행하던 문제 수정 |

[출처: Claude Code 변경 기록](https://code.claude.com/docs/en/changelog)

## 작업 폴더가 뭔지

울타리를 이해하려면 작업 폴더부터 알아야 한다. 권한 문서에는 이렇게 나온다. 기본적으로 Claude는 실행한 디렉터리의 파일에 접근할 수 있고, 그 디렉터리가 그 세션의 기본 작업 디렉터리다. `/cd`로 옮기기 전까지는 그렇다.

범위를 넓히는 방법은 세 가지다.

| 시점 | 방법 |
| --- | --- |
| 시작할 때 | `--add-dir <경로>` |
| 세션 중 | `/add-dir` |
| 계속 유지 | 설정 파일의 `additionalDirectories` |

추가한 폴더의 파일도 원래 작업 폴더와 같은 권한 규칙을 따른다. 읽기는 확인 없이 되고, 편집은 현재 권한 모드를 따른다. 윈도우에서 `\\server\share` 같은 네트워크 경로는 대부분 작업 폴더로 못 넣고, 드라이브 문자에 연결해서 `--add-dir`로 넘기라고 되어 있다.

[출처: 권한 설정 문서](https://code.claude.com/docs/en/permissions)

## 읽기 쪽 설정은 먼저 있었다

쓰기 쪽 설정이 새로 생겼다는 건 읽기 쪽 짝이 이미 있었다는 얘기다. `permissions.blockReadsOutsideWorkingDirectories`가 그것이고, 설정 문서의 설명은 "파일 도구가 모든 권한 모드에서 작업 폴더 밖 읽기를 거부하게 한다"이다. 설정 문서의 예외 표에는 이 키가 v2.1.257 이상에서 어느 범위에서든 `true`면 그 값이 존중된다고 나온다. 관리자 설정이 `false`여도 마찬가지다.

권한 문서에는 auto 모드에서 Claude가 작업 폴더 밖을 처음 읽을 때 이 설정을 켜라고 제안한다는 내용도 있다.

이번에 쓰기 쪽이 같은 모양으로 추가돼서 읽기와 쓰기를 따로 잠글 수 있게 된 셈이다.

## 왜 이런 울타리가 필요한가

[하네스](#/post/ai-harness)가 하는 일 중 하나가 모델이 요청한 [도구 호출](#/post/ai-tool-use)을 실제로 실행할지 판단하는 것이다. 에이전트가 [루프](#/post/ai-agent-loop)를 돌다 보면 사람이 하나하나 보지 않는 구간이 생기고, 권한 모드를 느슨하게 둘수록 그 구간이 길어진다. 이때 "쓰기는 이 폴더 안에서만"이라는 선이 있으면 실수나 [프롬프트 인젝션](#/post/sec-prompt-injection) 때문에 엉뚱한 경로에 파일이 써지는 일은 적어도 파일 도구 쪽에서는 막힌다.

핵심은 권한 모드와 별개라는 점이다. 확인창을 줄이려고 모드를 풀어도 이 선은 그대로 남는다.

<details>
<summary>설정 파일 우선순위 메모</summary>

설정 문서에 따르면 같은 키가 여러 곳에 있을 때 높은 쪽이 이긴다. 순서는 관리자 설정, 명령줄 `--settings`, 프로젝트 로컬(`.claude/settings.local.json`), 공유 프로젝트(`.claude/settings.json`), 사용자(`~/.claude/settings.json`)다. `permissions.allow` 같은 목록은 덮어쓰지 않고 합쳐진다.

설정 파일은 엄격한 JSON이라 `//` 주석이나 끝 쉼표가 있으면 오류가 난다. 로드된 파일은 `/status`의 `Setting sources` 줄에서 확인한다. 이 설정을 쓰고 싶다면 개인 설정에 넣는 건 사용자 파일, 팀 전체에 걸고 싶으면 저장소의 `.claude/settings.json`이 후보가 된다.

```json
{
  "permissions": {
    "blockWritesOutsideWorkingDirectories": true
  }
}
```

</details>

## 같이 눈에 띈 것들

2.1.309의 `sed -i` 변경도 같은 맥락이다. 예전에는 `sed -i`가 파일 편집처럼 미리보기를 보여 줬는데, 이제는 보통의 Bash 확인창을 거쳐 쓴 그대로 실행된다. 변경 기록에 따르면 다른 Bash 편집처럼 `/rewind`로 되돌려지지도 않는다. 파일 도구에 울타리를 쳐도 Bash로 하는 편집은 다른 경로라는 뜻으로 읽힌다. 그래서 쓰기 울타리는 파일 도구용 안전장치이고, Bash는 별도의 권한 규칙과 샌드박스로 다뤄야 한다.

2.1.312의 수정도 재밌다. 아주 큰 CLAUDE.md나 규칙 파일을 앞부분만 보고 덮어쓰는 일이 있었고, 이제 Write는 전부 읽거나 제자리에서 편집하라고 Claude에게 요구한다. 작업 폴더 안에서도 쓰기가 위험할 수 있다는 걸 보여 주는 사례다.

fast mode 쪽은 Opus 4.8 사용자만 해당된다. 변경 기록에는 Opus 5.5로 옮기면 속도 이점을 유지할 수 있다고 적혀 있다.

## 정리

작업 폴더 밖 읽기와 쓰기를 각각 설정 한 줄로 막을 수 있게 됐다. 모드를 느슨하게 쓰는 사람일수록 이런 고정된 선이 하나쯤 있는 게 편할 것 같다. 에이전트에게 권한을 어디까지 줄지 정하는 일은 [가드레일](#/post/app-guardrails) 글에서 이어서 다룬다.

## 근거 링크

- [Claude Code 변경 기록](https://code.claude.com/docs/en/changelog)
- [권한 설정 문서](https://code.claude.com/docs/en/permissions)
- [설정 파일과 우선순위 문서](https://code.claude.com/docs/en/settings)
- [설정 레퍼런스](https://code.claude.com/docs/en/settings-reference)
