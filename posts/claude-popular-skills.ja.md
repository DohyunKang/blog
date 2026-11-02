スキルを自分で書く前に、他人们在何を使っているかを確認するために Anthropic 公式リポジトリ (github.com/anthropics/skills) を開いてみました。スキルとは何か、どこに置くかは [スキル・設定の整理](#/post/claude-skills) に記述しているので、ここではどのようなスキルがあるかのみ見ていきます。

## まず知っておくべきこと

公式リポジトリの `skills/` 以下には、この文章を書いている時点 (2026-11-02) ではフォルダが 19 つありました。スター数は約 18.6 万です。リポジトリの README は、このフォルダを「創作・デザイン」「開発・技術」「企業コミュニケーション」「ドキュメントスキル例」と説明しています。ドキュメントスキルの 4 つ (docx, pdf, pptx, xlsx) はオープンソースではなく source-available と記載されています。

インストール方法は 2 つに分かれます。リポジトリ自体がプラグインマーケットプレイスであるため、Claude Code で以下のように登録します。

```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

`marketplace.json` を開くと、`document-skills` プラグインには xlsx・docx・pptx・pdf が、`example-skills` には残りの 12 つ (algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing) が含まれています。`claude-api`, `academy-guide`, `discernment-nudge` はそれぞれ別々のプラグインです。フォルダを直接 `~/.claude/skills/<名前>/SKILL.md` にコピーして使う方法もあります。

Claude Code のドキュメントには、`/plugin install skill-creator@claude-plugins-official` のように公式マーケットプレイス (`claude-plugins-official`) から取得する例も出てきます。また、`pdf`, `xlsx` などの Anthropic 標準スキルは claude.ai アカウントで同期され、`~/.claude/skills/synced/` にダウンロードされるそうです。

## 公式スキルの種類別一覧

各スキルの `SKILL.md` の最上級の description を読み、整理しました。

### ドキュメント作成・修正

| 名前 | 役割 | 何时使用 |
|---|---|---|
| docx | Word(.docx)・テンプレート(.dotx) の作成、読み込み、編集 | 目次・ヘッダー・ページ番号付きドキュメントを出力する際 |
| pptx | スライド(.pptx) の作成、テキスト抽出、編集、結合・分割 | プレゼン資料を作成するか、既存のデッキを修正する際 |
| xlsx | スプレッドシート(.xlsx, .csv, .tsv) の作成、式・書式・グラフ、整理 | テーブルファイルが入力または出力となる際 |
| pdf | テキスト・表の抽出、結合・分割、回転、ウォーターマーク、フォーム入力、OCR | PDF で何かを行う必要がある際 |
| doc-coauthoring | ドキュメントを共同執筆する手順 (コンテキスト収集、推敲、読者テスト) | 提案書・技術仕様書・決定文書を最初から書く際 |

### デザイン・画面

| 名前 | 役割 | 何时使用 |
|---|---|---|
| frontend-design | 陳腐なテンプレートに似た UI を作らないよう、方向性やタイポグラフィの選択を案内 | 新しい画面を作成するか、既存画面を刷新する際 |
| theme-factory | スライド・ドキュメント・ランディングページにテーマを適用。事前に用意された 10 つのテーマから選択または即時生成も可能 | 出力物に一貫した色やフォントを施す際 |
| brand-guidelines | Anthropic 公式の色とフォントを適用 | Anthropic スタイルに合わせて調整する際。他社ブランド用ではありません |
| canvas-design | デザイン哲学を定め、.png・.pdf ポスターや視覚作品を作成 | ポスターや静的なデザイン作品を作成する際 |
| algorithmic-art | p5.js を用いたシードベースの生成アート、パラメータ調整ビューア | フローフィールド・パーティクルなどのコードアート |
| slack-gif-creator | Slack 規格に適合したアニメーション GIF を作成し検証 | Slack 用 GIF を作成する際 |
| web-artifacts-builder | React, Tailwind, shadcn/ui を用いて claude.ai 向けの複雑な HTML アーティファクトを作成 | ステートやルーティングが必要なアーティファクト。単一ファイルの簡単なものには使用しないよう記載されています |

### 開発・テスト

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| skill-creator | スキルの作成・修正、評価の実行、説明の最適化 | 自分のスキルを作成する際 |
| mcp-builder | MCP サーバーを適切に構築するためのガイド (Python FastMCP, Node/TypeScript SDK) | 外部サービスを [MCP](#/post/ai-mcp) に接続したい場合 |
| webapp-testing | Playwright を用いたローカル Web アプリのテスト、スクリーンショット撮影、ブラウザログの確認 | 画面動作を確認したりデバッグする際 |
| claude-api | Claude API・SDK のリファレンス（モデル ID、料金、ストリーミング、ツール呼び出し、キャッシングなど） | コード内で Claude を呼び出す作業を行う際 |

### 文章・業務

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| internal-comms | 状況報告、リーダーシップアップデート、ニュースレター、FAQ、障害報告などの社内文書形式 | 社内公告・報告を執筆する際 |
| academy-guide | Claude の使い方を尋ねると、Claude Academy の講義・チュートリアルを推奨 | 使用方法に関する質問に資料を添えたい場合 |
| discernment-nudge | 助言・計画・推定などの回答を出す前に、一度だけ慎重に検討させる | ユーザーがその答えを信じて行動できる状態にある際 |

academy-guide と discernment-nudge は、名前だけでは用途が分かりにくいため、SKILL.md の冒頭部分を読みました。

<details>
<summary>詳細な解説：4 つのドキュメントスキルは何が違うのか</summary>

docx, pptx, xlsx, pdf の説明はすべて「この拡張子が関連すれば無条件にこのスキル」といった形で書かれています。pptx は入力也罢出力也罢、.pptx が含まれる場合は使用し、結果をメールで送るための要約用にテキストのみを抽出するケースも含むと記載されています。xlsx はスプレッドシートが主な入力または出力となる作業全般です。このようにトリガーの範囲を広げて使うのは、[スキルドキュメント](#/post/claude-skills) が推奨している説明の書き方（何をするのか、いつ使うのか、トリガー表現）と合致します。

</details>

## コミュニティスキル

公式リポジトリ以外にも多くのリポジトリがあります。GitHub で検索して確認した大きなもののみ記載します。スター数は 2026-11-02 に GitHub API から取得した値です。

| 이름 | 스타 | 하는 일 | 설치 |
|---|---|---|---|
| obra/superpowers | 約 31 万 | コーディングエージェント用の開発手法。まず仕様を聞き、計画を立て、サブエージェントで実装・レビューを進める。TDD、YAGNI、DRY を強調 | `/plugin install superpowers@claude-plugins-official` |
| epoko77-ai/im-not-ai | 約 6,400 | AI が書いた韓国語を人間らしい文章に推敲。事実・主張・数値はそのままにし、文体・リズム・表現のみ修正 | `/plugin marketplace add epoko77-ai/im-not-ai` の後、`/plugin install humanize-korean@im-not-ai` |
| IsaacEryn/humanizer-ko | 6 | 韓国語 AI 文体（ChatGPT 風文体、二重受身、翻訳調など）33 パターンを検出 | リポジトリ README を参照 |
| dotoricode/korean-humanizer | 17 | 生成された文章の AI 感を消すための韓国語プロンプト・スキル | リポジトリ README を参照 |

superpowers スキルフォルダには、brainstorming, writing-plans, test-driven-development, systematic-debugging, requesting-code-review, verification-before-completion, using-git-worktrees といった名前のものがありました。名前そのままに計画・テスト・デバッグ・レビューの段階をそれぞれ担当する構成です。

im-not-ai は韓国語文章を推敲するスキルの中でスター数が最も多かったです。README によると、翻訳調、機械的な並列（「第一・第二・第三」）、「結論的に」、「示唆する点が多い」などの慣用句、受身の過剰使用などを 10 つのカテゴリ、85 つのサブパターンに分け、深刻度（S1〜S3）別に検出します。Claude Code では `/humanize-korean` と呼んだり、「この文章の AI 感を消して」と言ったりすれば OK です。Codex CLI、Gemini CLI、Copilot CLI 用のインストール方法も併記されています。ただし、Gemini の拡張は別ルールブック（47 パターン）を使用すると README に記載されています。ライセンスは MIT です。名前が似ているバリエーションリポジトリ（im-not-ai-codex 72, im-not-ai-kiro 28 など）はフォークのようです。

スター数が同じということは意味しません。31 万とあるからといって自分の作業に合う保証はなく、6 スターのものの方が自分の用途に合っていることもあります。

## どうやって選ぶか使うか

- 形式が指定されたタスク（Word、PPT、Excel、PDF）については、ドキュメントスキルネットが最も適しています。
- 画面を作成する場合は `frontend-design`、確認は `webapp-testing` です。
- 自分の業務フローは `skill-creator` で作成し、`~/.claude/skills` またはプロジェクト内の `.claude/skills` に配置します。
- 韓国語の文章を推敲するのはコミュニティスキルです。公式リポジトリにはありません。

## 注意点

- スキルでは各セッションのコンテキストに `description` のみが追加され、本編は使用時にロードされます。それでも多くインストールすると `description` が蓄積するため、必要なものだけを厳選してください。
- マーケットプレイスや外部リポジトリのスキルは、他者が作成した指示とスクリプトです。インストールする前に `SKILL.md` と `scripts/` を必ず一度確認することをお勧めします。
- ドキュメントスキル 4 つはライセンスがオープンソースではなくソース公開です。使用前に各フォルダの `LICENSE.txt` を確認してください。

## 参考リンク

- anthropics/skills リポジトリ: https://github.com/anthropics/skills
- anthropics/skills marketplace.json: https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json
- Claude Code ドキュメント、Skills: https://code.claude.com/docs/en/skills
- epoko77-ai/im-not-ai: https://github.com/epoko77-ai/im-not-ai
- obra/superpowers: https://github.com/obra/superpowers

← [概念マップへ](#/post/ai-map)

関連記事：[Claude スキル・設定、いつ何をすべきか](#/post/claude-skills) · [MCP](#/post/ai-mcp) · [Claude トークンを節約する方法](#/post/claude-tokens)