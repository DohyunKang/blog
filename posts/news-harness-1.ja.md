# Claude Code 2.1.314: 쓰기 작업이 작업 폴더 외부로 나가지 않도록 막는 기능이 추가되었습니다

확인 시점은 2026-11-02 입니다. 공식 문서의 변경 기록 (changelog) 맨 위 항목은 2.1.316(10 월 31 일) 이었으며, 그 아래 며칠 치를 훑어보았습니다. 대부분 작은 수정 사항들이지만, 2.1.314(10 월 30 일) 항목이 눈에 띄었습니다. 파일을 쓰는 도구가 작업 폴더 외부의 경로를 거부하도록 하는 설정이 새로 추가되었습니다.

## 변경 기록에 적힌 내용

2.1.314 항목은 다음과 같이 기술되어 있습니다.

> Added `permissions.blockWritesOutsideWorkingDirectories`: Write, Edit and NotebookEdit refuse paths outside the working directories in every permission mode

풀어 설명하면 Write, Edit, NotebookEdit 세 도구가 작업 폴더 바깥 경로를 거절합니다. 또한 권한 모드가 무엇이든 상관없이 적용됩니다. 같은 날의 항목에는 조직 관리자가 모델의 effort 상한을 설정해 둔 경우 "Invalid effort level"로 매 턴 실패하던 문제가 수정되었다는 내용도 포함되어 있습니다.

주변 버전에서 눈에 띄는 사항도 기록해 둡니다.

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| 2.1.316 | 10 월 31 일 | `CLAUDE_CODE_DISABLE_ULTRATHINK` 추가. Opus 4.8 의 fast mode 는 10 월 30 일부로 deprecated, 11 월 30 일 제거 예정 |
| 2.1.314 | 10 월 30 일 | `permissions.blockWritesOutsideWorkingDirectories` 추가 |
| 2.1.312 | 10 월 27 일 | 하위 폴더의 매우 큰 CLAUDE.md 파일을 앞부분만 보고 덮어쓰던 문제 수정. Write 도구가 전체를 읽거나 제자리 편집을 요청함 |
| 2.1.309 | 10 월 22 일 | `sed -i` 가 파일 편집 미리보기 대신 일반 Bash 확인창을 거쳐 그대로 실행됨. 샌드박스 Bash 가 셸 시작 파일을 샌드박스 외부에서 실행하던 문제 수정 |

[출처: Claude Code 변경 기록](https://code.claude.com/docs/en/changelog)

## 작업 폴더란 무엇인가

울타리를 이해하려면 작업 폴더부터 알아야 합니다. 권한 문서에는 다음과 같이 나와 있습니다. 기본적으로 Claude 는 실행한 디렉터리의 파일에 접근할 수 있으며, 그 디렉터리가 해당 세션의 기본 작업 디렉터리입니다. `/cd` 로 이동하기 전까지는 그렇습니다.

범위를 넓히는 방법은 세 가지입니다.

| 시점 | 방법 |
| --- | --- |
| 시작할 때 | `--add-dir <경로>` |
| 세션 중 | `/add-dir` |
| 계속 유지 | 설정 파일의 `additionalDirectories` |

추가된 폴더의 파일도 원래 작업 폴더와 동일한 권한 규칙을 따릅니다. 읽기는 확인 없이 이루어지며, 편집은 현재 권한 모드를 따릅니다. 윈도우에서 `\\server\share` 같은 네트워크 경로는 대부분 작업 폴더로 추가할 수 없으며, 드라이브 문자에 연결하여 `--add-dir` 로 넘겨야 한다고 나와 있습니다.

[출처: 권한 설정 문서](https://code.claude.com/docs/en/permissions)

## 읽기 쪽 설정은 이미 존재했습니다

쓰기 쪽 설정이 새로 생겼다는 것은 읽기 쪽 짝이 이미 있었다는 뜻입니다. `permissions.blockReadsOutsideWorkingDirectories` 가 그것이며, 설정 문서의 설명은 "파일 도구가 모든 권한 모드에서 작업 폴더 외부의 읽기를 거부합니다"입니다. 설정 문서의 예외 표에는 이 키가 v2.1.257 이상에서 어느 범위든 `true`이면 해당 값이 존중된다고 나와 있습니다. 관리자 설정이 `false`여도 마찬가지입니다.

권한 문서에는 auto 모드에서 Claude 가 작업 폴더 바깥을 처음 읽을 때 이 설정을 켜도록 제안한다는 내용도 포함되어 있습니다.

이번에 쓰기 쪽이 동일한 형태로 추가되어 읽기와 쓰기를 각각 잠글 수 있게 된 셈입니다.

## 왜 이런 울타리가 필요한가

[하네스](#/post/ai-harness) 가 수행하는 작업 중 하나는 모델이 요청한 [도구 호출](#/post/ai-tool-use) 을 실제로 실행할지 판단하는 것입니다. 에이전트가 [루프](#/post/ai-agent-loop) 를 돌게 되면 사람이 하나하나 확인하지 않는 구간이 생기고, 권한 모드를 느슨하게 할수록 그 구간은 길어집니다. 이때 "쓰기는 이 폴더 안에서만"이라는 선이 있으면 실수나 [프롬프트 인젝션](#/post/sec-prompt-injection) 으로 인해 엉뚱한 경로에 파일이 쓰이는 일은 적어도 파일 도구 쪽에서는 막힙니다.

핵심은 권한 모드와 별개라는 점입니다. 확인창을 줄이기 위해 모드를 풀더라도 이 선은 그대로 남습니다.

<details>
<summary>설정 파일 우선순위 메모</summary>

設定ドキュメントによれば、同じキーが複数存在する場合、優先順位が高いものが適用されます。順序は、管理者設定、コマンドライン `--settings`、プロジェクトローカル (`.claude/settings.local.json`)、共有プロジェクト (`.claude/settings.json`)、ユーザー (`~/.claude/settings.json`) です。`permissions.allow` などのリストは上書きではなく統合されます。

設定ファイルは厳格な JSON であるため、`//` コメントや末尾のコンマがあるとエラーになります。ロードされたファイルは `/status` の `Setting sources` 行で確認できます。この設定を使用したい場合は、個人用設定に追加するのがユーザーファイル、チーム全体に適用したい場合はリポジトリ内の `.claude/settings.json` が候補となります。

```json
{
  "permissions": {
    "blockWritesOutsideWorkingDirectories": true
  }
}
```

</details>

## その他注目点

2.1.309 の `sed -i` 変更も同様の文脈です。以前は `sed -i` がファイル編集のようにプレビューを表示していましたが、現在は通常の Bash プロンプトを介してそのまま実行されます。変更記録によると、他の Bash 編集と同様に `/rewind` で元に戻すこともできません。ファイルツールに囲いを設けても、Bash による編集は別の経路であるためと解釈されます。したがって、書き込みの囲いはファイルツール用の安全装置であり、Bash は別途権限規則とサンドボックスで扱う必要があります。

2.1.312 の修正も興味深いです。以前は非常に大きな CLAUDE.md やルールファイルを先頭部分のみ読み込んで上書きすることがありましたが、現在は Write がすべてを読み取るか、その場で編集するように Claude に要求します。これは作業フォルダ内でも書き込みが危険であることを示す事例です。

fast mode については Opus 4.8 ユーザーにのみ適用されます。変更記録には Opus 5.5 に移行しても速度の利点を維持できると記載されています。

## まとめ

作業フォルダ外への読み取りと書き込みをそれぞれ設定の一行で制御できるようになりました。モードを緩く使用する人ほど、このような明確な境界線がある方が安心するでしょう。エージェントにどの程度の権限を与えるかは [ガードレール](#/post/app-guardrails) の記事で引き続き扱います。

## 参照リンク

- [Claude Code 変更記録](https://code.claude.com/docs/en/changelog)
- [権限設定ドキュメント](https://code.claude.com/docs/en/permissions)
- [設定ファイルと優先順位ドキュメント](https://code.claude.com/docs/en/settings)
- [設定リファレンス](https://code.claude.com/docs/en/settings-reference)