Claude Code には設定手段がいくつかあり、公式ドキュメントを読むと「常に提示するもの」「必要な時だけ読み込むもの」「必ず強制するもの」「外部と接続するもの」に分類すればほぼ整理できます。

## まず表で確認する

| 項目 | 何时使用 | ファイル位置 |
|---|---|---|
| CLAUDE.md | セッションごとにセットアップして行く指針（ビルドコマンド、ルール） | `./CLAUDE.md` または `./.claude/CLAUDE.md`(プロジェクト), `~/.claude/CLAUDE.md`(個人全体), `./CLAUDE.local.md`(個人・このプロジェクト) |
| スキル (Skill) | 特定の作業手順が必要な時だけ読み込む | `~/.claude/skills/<名前>/SKILL.md`(個人), `.claude/skills/<名前>/SKILL.md`(プロジェクト) |
| スラッシュコマンド | 直接 `/名前` で呼び出す。カスタムコマンドはスキルに統合される | 内蔵はファイルなし。カスタムは `.claude/commands/<名前>.md` またはスキル |
| フック (hooks) | 編集後のフォーマット、危険な作業の遮断など「常に必ず」 | `~/.claude/settings.json`, `.claude/settings.json` の `hooks` |
| サブエージェント | ログや検索のように出力が多い作業を別で回して要約だけもらう | `.claude/agents/`, `~/.claude/agents/` |
| 権限 (permissions) | 許可・確認・拒否ルール、モード設定 | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` |
| プランモード | 修正前に調査し、計画だけもらう | ファイルではない。Shift+Tab, `/plan`, `--permission-mode plan` |
| MCP | イシュートラッカーや DB などの外部ツールとの接続 | `.mcp.json`(プロジェクト), `~/.claude.json`(ローカル・ユーザー) |

以下は表の項目を一つずつ公式ドキュメント (code.claude.com) で確認した内容に基づいて解説したものです。

## CLAUDE.md: セッションごとにセットアップする指針

ドキュメントではセッションが常に新しいコンテキストウィンドウで始まると述べています。そのためセッションを超えて知識を引き継ぐ仕組みとして 2 つあります。私が使う CLAUDE.md と、Claude が自動的に記述する auto memory です。CLAUDE.md は各セッションで読み込まれます。[コンテキスト](#/post/ai-context) に常に含まれるため短いほど良いです。ドキュメントでは 1 ファイルを 200 行以内に収めるよう指示しています。長すぎるとコンテキストを消費しすぎて指針が守られにくくなるそうです。

`/init` を入力するとコードベースを確認して、ビルドコマンド・テスト方法・慣習などをまとめた CLAUDE.md を作成してくれます。既に存在する場合は上書きせず、改善案を提示します。他のファイルは `@path/to/import` 構文で読み込むことができますが、ドキュメントによるとこれは整理用でありコンテキストコストの削減にはなりません。一部のフォルダに適用されるルールは `.claude/rules/` にファイルを分割してパスを指定しておくと、そのファイルに触れる時のみロードされます。

重要な制限事項が一つあります。ドキュメントでは CLAUDE.md を「強制設定ではなくコンテキスト」として扱っていると記述しています。ある行動を必ず防ぐにはフックを使うよう指示されています。

## スキル: 必要な時だけ読み込む手順

スキルは `SKILL.md` ファイルを中心としたフォルダです。Claude が関連性があると判断すると読み込まれ、`/スキル名` で直接呼び出すこともできます。本文は使用時にのみロードされるため、長い参照資料を置いておいても普段のコストは小さいです。CLAUDE.md と最も違う点はここにあります。

構造は 2 つの部分からなります。最初の行が `---` の YAML フロントマターと、その下のマークダウン指針です。

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

フロントマターで注目すべきフィールドは以下の通りです。

| フィールド | 意味 |
|---|---|
| `name` | `/` メニューに表示される名前。省略するとフォルダ名になります |
| `description` | 何をするものか、いつ使うのか。Claude がこれを見て適用可否を決定します（ドキュメント推奨） |
| `when_to_use` | トリガーとなる発言・要求の例。description の後に追加されます |
| `disable-model-invocation` | `true` にすると Claude が自ら呼び出さない。私が `/` でしか呼び出せない |
| `user-invocable` | `false` にすると `/` メニューから非表示になる。Claude だけが呼び出せる |
| `allowed-tools` | スキルが実行するターンで許可なく使用できるツール |
| `context: fork` | スキルをサブエージェントで実行 |
| `paths` | 該当パスのファイルの場合のみ自動ロード |

フォルダには `SKILL.md` 以外に、`reference.md` や `examples.md`、`scripts/` などの補助ファイルを置くことができます。文書では、SKILL.md を 500 行以内に収め、詳細は他のファイルに移動させて SKILL.md から参照するよう指示されています。名前が重複した場合の優先順位は、エンタープライズ > 個人 > プロジェクトの順です。

### description（説明）の書き方

Claude は各セッションにおいて、すべてのスキルの description（説明）のみを確認します。この一行がスキルを呼び出すかどうかを決定づけます。文書で示されているコツは三つあります。まず、核心的な用途を最初にかくことです。何をし、いつ使うのかを併記し、トリガーとなる表現を含めます。無関係な事柄に呼び出されないよう具体的に記述します。文書の例は以下の通りです。

> Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.

description と when_to_use を合わせた文章は、リストで 1,536 文字で切られるため、重要な言葉は後ろに置かないようにしてください。

デプロイやコミットなど副作用のある作業については、文書が `disable-model-invocation: true` に設定するよう推奨しています。これはタイミングを自分で制御したい用途です。背景知識のように行動ではないものは、`user-invocable: false` とします。

## スラッシュコマンド：今やスキルと一体

文書基準ではカスタムコマンドはスキルに統合されました。`.claude/commands/deploy.md` と `.claude/skills/deploy/SKILL.md` はどちらも `/deploy` を作成し、同様に動作します。既存のコマンドファイルはそのまま残りますが、新規作成時はスキルを推奨します。名前が重複した場合、スキルが優先されます。内蔵コマンドとして文書で言及されているのは `/help`、`/compact`、`/skills`、`/add-dir`、`/status`、`/usage` などであり、全リストはコマンドリファレンスにあるとのことです。

## フック：必ず実行される仕組み

フックは Claude Code のライフサイクルの特定の時点で実行されるシェルコマンドです。文書の要点は、LLM に任せるのではなく「常に実行させる」ことにあります。設定ファイル（`~/.claude/settings.json`、プロジェクト内の `.claude/settings.json`）の `hooks` ブロックにイベント名をキーとして設定します。イベントには `PreToolUse`（ツール実行前、ブロック可能）、`PostToolUse`（成功後）、`PostToolUseFailure`、`Notification`（入力待ち時）、`SessionStart` などがあります。例として、`PostToolUse` に `Edit|Write` マッチャーを適用し、編集後に Prettier を実行する設定が示されています。登録後は `/hooks` で確認できます。

終了コードはルールです。0 は問題なし、2 は実行をブロックし、stderr に記述した理由は Claude へのフィードバックとして送られます。ただし `PreToolUse` で 0 で終了しても承認とはみなされず、通常の権限手順が適用されます。また、フックが allow を返しても deny・ask のルールはそのまま適用されるという記載もあります。

## サブエージェント：独立して実行し、要約のみを受け取る

サブエージェントは独自のコンテキストウィンドウ、システムプロンプト、ツール権限を持つ補助エージェントです。タスクが description に合致すれば Claude が引き渡し、メインの対話には要約のみが返されます。その利点は文書で挙げられている通り、コンテキストの保持、ツールの制限、設定の再利用、より安価なモデル（Haiku など）での実行です。同じ使用量制限に縛られるとも記載されています。

マークダウンファイルにはフロントマター（必須は `name`、`description`）を記述し、本文がシステムプロンプトとなります。配置場所は `.claude/agents/`（プロジェクト）、`~/.claude/agents/`（個人）です。標準提供されているものには Explore（読み取り専用探索）、Plan、general-purpose があります。文書のヒントでは、出力が多い独立したタスクでテスト回して失敗のみを受け取るような用途に使い、やり取りをしながら調整する作業はメインの対話に残すよう推奨されています。[ハネス](#/post/ai-harness) の話と見ると、コンテキストを節約する方法でもあります。

## 権限とプランモード

権限ルールは `permissions` 下で `allow`/`ask`/`deny` で記述し、評価順序は deny、ask、allow であり、最初に一致するものが決定します。配置場所は `.claude/settings.json`（共有）、`.claude/settings.local.json`（個人）、`~/.claude/settings.json`（全体）です。文書では Bash のルールは Claude が記述したコマンド文字列にマッチするため、同じプログラムを異なる形式で呼び出せば回避できてしまうため、deny・ask はセキュリティの境界線ではないと警告しています。

モードは六つに整理されています。

| 모드 | 요약 |
|---|---|
| `default` | 自動で読み取りのみ、残りは確認 |
| `acceptEdits` | ワークフォルダ内のファイル編集も自動承認 |
| `plan` | 調査と計画の提案のみ、承認前にはソースを変更しない |
| `auto` | 別のカテゴリモデルがレビューしながら実行 |
| `dontAsk` | 事前に許可されたもののみ実行、残りは拒否（CI用） |
| `bypassPermissions` | 検査なしで全て実行。隔離されたコンテナ・VM のみ |

プランモードへの移行は、Shift+Tab を押してステータスバーに plan mode が表示されるまで回すか、プロンプトの前に `/plan` を付けるか、`claude --permission-mode plan` で開始します。計画が表示되면 承認して他のモードに移るか、引き続き計画することもでき、Ctrl+G で編集器から計画を修正できます。

## MCP: 外部システムとの接続

[MCP](#/post/ai-mcp) は AI ツールを外部ツールやデータと繋ぐための公開標準です。接続すると、イシュートラッカーやデータベースをコピペなしで直接読み書きできます。コマンドは `claude mcp add --transport <種類> <名前> <アドレスまたはコマンド>` であり、`claude mcp list`、`claude mcp remove`、セッション内の `/mcp` で管理します。スコープ（範囲）は 3 つです。

| スコープ | どこからロード | チーム共有 | 保存場所 |
|---|---|---|---|
| local（デフォルト） | このプロジェクトのみ | いいえ | `~/.claude.json` |
| project | このプロジェクトのみ | はい | プロジェクトルート `.mcp.json` |
| user | 自分のすべてのプロジェクト | いいえ | `~/.claude.json` |

トランスポート方式は、リモートサーバーには HTTP を推奨し、SSE はもう使わない方式だと言われています。ローカルプロセスは stdio です。文書で指摘されている注意点は、外部コンテンツを取得するサーバーはプロンプトインジェクションのリスクがあるため、信頼できるサーバーのみを接続するというものです。

## どのように選ぶか

- 常に必要であれば CLAUDE.md。短く。
- 稀にしか必要な手順であればスキル。普段は description のみがアップされるので。
- 避けるべきものはフックや deny ルール。CLAUDE.md は依頼であり、フックは強制です。
- 出力が大きい独立したタスクはサブエージェント。
- 大きな変更はプランモードで計画から。
- 外部システムは MCP。

## よくある誤解

- CLAUDE.md に書けば必ず守られる：文書はコンテキストであり強制設定ではないと記述します。
- スキルとスラッシュコマンドは別物：現在は統合され、同じ `/名前` になります。
- フックで exit 0 なら承認された：`PreToolUse` における 0 は承認ではなく異議なしです。
- deny に追加すればセキュリティが完了する：文書がコマンド形式を変えれば迂回できる可能性があるため警告します。

<details>
<summary>詳細な解説：フック設定例（文書フローの要約）</summary>

文書の最初の例は、`~/.claude/settings.json` に `Notification` フックを追加して、Claude が入力待ちの際にデスクトップ通知を表示させるものです。既に `hooks` キーがある場合は全体を置き換えず、イベントキーを兄弟として追加します。編集後のフォーマットは `PostToolUse`+`Edit|Write` マッチャーで、保護ファイルのブロックは `PreToolUse` がファイルパスを検査して一致すれば stderr に理由を出力し、`exit 2` を行うスクリプトです。判断が必要な条件については、モデルが評価するプロンプトベース・エージェントベースのフックもあるとありますが、直接確認していません。

</details>

## 根拠リンク

- Claude Code ドキュメント、Skills: https://code.claude.com/docs/en/skills
- Claude Code ドキュメント、How Claude remembers your project(CLAUDE.md): https://code.claude.com/docs/en/memory
- Claude Code ドキュメント、Hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code ドキュメント、Subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code ドキュメント、Permissions: https://code.claude.com/docs/en/permissions
- Claude Code ドキュメント、Permission modes: https://code.claude.com/docs/en/permission-modes
- Claude Code ドキュメント、MCP: https://code.claude.com/docs/en/mcp
- Claude Code ドキュメント、Slash commands: https://code.claude.com/docs/en/slash-commands

← [概念マップへ](#/post/ai-map)

関連記事：[Claude トークンを節約する方法](#/post/claude-tokens) · [MCP](#/post/ai-mcp) · [コンテキストとコンテキストエンジニアリング](#/post/ai-context)