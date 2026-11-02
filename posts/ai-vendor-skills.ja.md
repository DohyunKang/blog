Claude、OpenAI Codex、Gemini CLI、Cursor の拡張機能は、名称こそ違えども構造は似ていました。常に読み込まれる指示ファイルが 1 つあり、必要な時だけ読み込むスキルがあり、それらをまとめて配布するパッケージ（プラグイン・拡張機能）が存在します。

## 拡張機能が解決してくれること

モデルは毎回空の状態から始まります。プロジェクトのビルドコマンド、コード規則、頻繁に行う作業手順などはどこかに記述して読み込まなければなりません。コーディングエージェントツールはこのファイルを解きほぐすことで対応します。ただし、すべてを常に読み込ませると [コンテキスト](#/post/ai-context) がすぐに満杯になります。そのため、大半は 2 つの層に分けています。

- 常に読み込まれる層：短い指示ファイル (CLAUDE.md, AGENTS.md, GEMINI.md, Cursor ルール)
- 必要な時だけ読み込まれる層：スキル。名前と説明のみを常駐させ、本編は使用時に読み込みます。原理については [スキル](#/post/ai-skills) の記事にまとめられています。

ここに外部ツールを取り付ける [MCP](#/post/ai-mcp) サーバーや、複数の部品を一度にインストールするパッケージが加わります。

## ツール別比較表

公式ドキュメントで確認した内容のみ記載しました。

| 工具 | 名称 | 方式 | ファイル位置 | 例 |
|---|---|---|---|---|
| Claude Code | CLAUDE.md | 常にロードされる指示 | プロジェクト `./CLAUDE.md` または `./.claude/CLAUDE.md`、個人 `~/.claude/CLAUDE.md`、規則の分割は `.claude/rules/` | ビルド・テストコマンド、コーディング規則 |
| Claude Code | スキル | 説明のみ常駐、本編は必要な時にロード | 個人 `~/.claude/skills/<名前>/SKILL.md`、プロジェクト `.claude/skills/<名前>/SKILL.md` | `/deploy`、変更サマリースキル |
| Claude Code | プラグイン | スキル・エージェント・フック・MCP サーバーを 1 つのセットとしてインストール | `.claude-plugin/plugin.json`、インストール先は `~/.claude/plugins/` | マーケットプレイスから `/plugin` でインストール |
| OpenAI Codex | AGENTS.md | 常にロードされる指示 | グローバル `~/.codex/AGENTS.md`、プロジェクトではルートから現在フォルダまでの各フォルダの `AGENTS.md` | リポジトリ作業規則 |
| OpenAI Codex | スキル | 説明のみ常駐、本編は選択時にロード | `$HOME/.agents/skills`、リポジトリ `.agents/skills` | `$changelog-writer` |
| Gemini CLI | GEMINI.md | 常にロードされる指示 | グローバル `~/.gemini/GEMINI.md`、作業フォルダと上位フォルダの `GEMINI.md` | 口調・スタイルガイド |
| Gemini CLI | 拡張機能 (extension) | プロンプト・MCP・コマンド・スキル・フック・サブエージェントのセット | `~/.gemini/extensions/<名前>/gemini-extension.json` | `gemini extensions install <リポジトリ URL>` |
| Cursor | ルール (Rules) | タイプ別に付与される指示 | `.cursor/rules/*.mdc`、ユーザールールは設定画面 | 特定のファイルパターンにのみ適用される規則 |
| Cursor | AGENTS.md | フロントマターのない指示 | プロジェクトルートまたは下位フォルダ | フォルダ別の指示 |
| ChatGPT | GPTs | 指示・知識ファイル・機能・アプリ・アクションをまとめたカスタムチャットボット | ファイルではなく ChatGPT 内で作成する | 特定の目的用のチャットボット |

## ツール別にさらに詳しく

### Claude

Claude Code は拡張層が最も多く分かれています。指示は CLAUDE.md、手順はスキル、セットはプラグインです。文書では CLAUDE.md に「常に持っておく事実」のみ置き、複数の段階の手順や一部のコードに該当する内容はスキルやパス別の規則に移すよう案内しています。

スキル側では `SKILL.md` のヘッダーで動作を制御します。`disable-model-invocation: true` なら人間が `/名前` でしか呼べず、`user-invocable: false` ならモデルのみが使用します。旧来の `.claude/commands/deploy.md` 形式もまだ有効ですが、スキルと同じ名前の場合はスキルが優先されます。同じ名前で重複した場合、エンタープライズ、個人、プロジェクトの順に優先度が高くなります。使い方のコツは [Claude スキル活用](#/post/claude-skills) と [人気スキル](#/post/claude-popular-skills) の記事にあります。

プラグインを有効化すると、スキル・エージェントの名前と説明が各ターンコンテキストに載ります。使っていないセッションでもトークンが少しずつ消費されることを意味するため、文書もこの点を事前に示唆し、公式マーケットプレイスのプラグインはインストール前にコンテキストコストの見積もりを表示します。また、Claude Code はリポジトリの `AGENTS.md` を CLAUDE.md の代わりに読み込めるという話もあります。

### OpenAI Codex

Codex の AGENTS.md は、開始時に一度指示チェーンを作成します。グローバルフォルダ (`~/.codex`) から 1 つ、プロジェクトルートから現在のフォルダまで降りていき、各フォルダで最大 1 つずつ読み込んで結合します。現在のフォルダに近いファイルが後に来るため、前の指示を上書きします。同じ場所に `AGENTS.override.md` があれば、それが通常のファイルの代わりに使われます。結合されたサイズはデフォルトで 32KiB までです。

スキルは Claude と形式が似ています。`SKILL.md` では `name` と `description` が必須であり、`scripts/`、`references/`、`assets/` フォルダを隣に置くことができます。呼び出しは `$スキル名` や `/skills` で直接行うか、タスクの説明と一致すれば Codex が選択します。最初にアップロードされるスキルリストは、コンテキストウィンドウの約 2% に制限されます。オフにしたい場合は `agents/openai.yaml` で `allow_implicit_invocation: false` を設定します。

### Gemini CLI

GEMINI.md はグローバル、作業フォルダ、および上位フォルダ、そしてツールがファイルにアクセスする際にその位置をスキャンする 3 つの場所から読み込んで結合します。`@ファイル.md` で他のファイルをインポートでき、`context.fileName` に `["AGENTS.md", "GEMINI.md"]` のように記述すれば読み込むファイル名を変更できます。`/memory show` で結合された結果を表示できます。

拡張機能はこれらの中のバンドル役割です。ルートに `gemini-extension.json` を置き、`commands/`(TOML コマンド)、`skills/`、`agents/`(サブエージェント、プレビュー)、`hooks/hooks.json`、`policies/` を入れることができます。マニフェストには `mcpServers`、`contextFileName`、`excludeTools`、`settings`(API キーなどのユーザー値) などを記述します。インストールはコピーを作成する方式なので、元が変更されたら `gemini extensions update` を実行する必要があります。

文書の上部には、2026 年 6 月 18 日付で無料プランと Google One の利用者に Gemini CLI が Antigravity CLI に置き換わったという案内がありました。文章を読む時点ではどちらを使うかは別途確認する必要があります。

### Cursor

Cursor ルールは `.cursor/rules` の `.mdc` ファイルであり、通常の `.md` は無視されます。冒頭の `description`、`globs`、`alwaysApply` で 4 つのタイプに分類されます。

| タイプ | 適用される時 |
|---|---|
| Always Apply | すべての会話 |
| Apply to Specific Files | glob に一致するファイルがコンテキストにある時 |
| Apply Intelligently | エージェントが description を見て適切だと判断した時 |
| Apply Manually | `@ルール名` で直接呼び出した時 |

前述の 3 つのツールは「常に読み込まれるファイル」と「必要な時に読み込むスキル」に分けたものを、Cursor は 1 つのルール内でタイプとして分類していると言えます。チーム・エンタープライズプランにはダッシュボードで管理するチームルールがあり、管理者が強制できます。

### ChatGPT

ChatGPT の GPTs はファイルをフォルダに置く方式とは異なります。指示、アップロードした知識ファイル、機能、アプリ、アクションを画面で束ねてカスタムチャットボットの 1 つを作成します。OpenAI ヘルプにはアプリとアクションは 1 つの GPT で同時に使えないと記載されています。

## 共通点に見えるもの

- 指示ファイルの名前が異なっても AGENTS.md は共通語のように使われます。Codex は元々使用し、Cursor はサポートしており、Claude Code は読み込め、Gemini CLI はファイル名設定で読み込ませることができます。
- スキルの形式は `SKILL.md` フォルダに収束する様子です。Claude、Codex、Gemini CLI 拡張機能はすべて同じファイル名を使用します。
- 常駐するのは名前と説明、本文は必要な時です。そのため説明文が呼び出し精度を左右します。
- バンドル単位はプラグイン (Claude) や拡張 (Gemini CLI) であり、外部ツール接続は MCP を通じます。

## よくある誤解

- 指示ファイルにすべて記述すればよいと思われがちですが、常に読み込まれる層であるため長いほどコンテキストとトークンを消費します。手順はスキルで外す方が文書の推奨です。
- 指示は強制ではありません。Claude のドキュメントでも CLAUDE.md は設定ではなくコンテキストとして扱われるとあり、必ず防ぐ必要があるのはフックで行うよう指示されています。
- 同じ名前のスキルフォルダがツール間でそのまま移動するわけではありません。位置 (`.claude/skills`、`.agents/skills`) と冒頭フィールドはツールごとに異なります。
- プラグインを多くインストールすればよいわけではありません。オンにしているものは使わなくても説明がコンテキストにアップロードされます。

<details>
<summary>ツール別の SKILL.md 冒頭比較</summary>

| 項目 | Claude Code | Codex |
|---|---|---|
| 必須フィールド | なし（description の推奨） | name, description |
| 人間のみ呼び出し | `disable-model-invocation: true` | - |
| モデルの自動呼び出しをオフにする | 上記と同じ | `agents/openai.yaml` の `allow_implicit_invocation: false` |
| 直接呼び出し | `/名前` | `$名前` |
| サブエージェントの実行 | `context: fork` | - |

</details>

← 概念マップへ (#/post/ai-map)

関連記事：[スキル](#/post/ai-skills), [MCP](#/post/ai-mcp), [ハネス](#/post/ai-harness)

## 根拠リンク

- Claude Code スキル: https://code.claude.com/docs/en/skills
- Claude Code プラグイン: https://code.claude.com/docs/en/plugins
- Claude Code メモリ (CLAUDE.md): https://code.claude.com/docs/en/memory
- Codex スキル: https://learn.chatgpt.com/docs/build-skills
- Codex AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Gemini CLI 拡張機能: https://geminicli.com/docs/extensions/
- Gemini CLI 拡張機能参照: https://geminicli.com/docs/extensions/reference/
- Gemini CLI GEMINI.md: https://geminicli.com/docs/cli/gemini-md/
- Cursor ルール: https://cursor.com/docs/context/rules
- OpenAI GPTs ヘルプ（検索結果の要約のみ確認）: https://help-lb.openai.com/en/articles/8554407