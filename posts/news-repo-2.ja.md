2026 年秋に登場する開発者向けツールレポートを探していたところ、OpenCode を選びました。コーディングエージェントは今回のシーズンリストで最も項目の多いカテゴリであり、その中でこのレポートは評価が高い方でした。公式ドキュメントと README を確認した内容を以下にまとめます。

## レポートの内容

GitHub リポジトリは `anomalyco/opencode` で、説明は"The open source coding agent."です。ライセンスは MIT です。確認時点（2026-11-02）でのスター数は約 22 万 3.9 千、フォーク数は約 3 万 100 と表示されていました。スター数は変動する値のため、この日付を基準としています。

ターミナル画面（TUI）での利用が基本であり、デスクトップアプリ（ベータ版）や IDE 拡張機能もあるとドキュメントに記載されています。デスクトップアプリは macOS（Apple Silicon・Intel）、Windows、Linux に対応しており、README に明記されています。

インストールにはスクリプトの一行（`curl -fsSL https://opencode.ai/install | bash`）に加え、npm・Bun・pnpm・Yarn、Homebrew、Arch の pacman、Windows 用の Chocolatey・Scoop などがドキュメントに挙げられています。Windows では WSL を推奨しているとあります。ドキュメントには奇妙な箇所が一つあり、V1 と V2 はどちらも `opencode` という同じコマンドを使用するため互いに衝突する可能性がある、と記載されています。Homebrew のデフォルトのフォーミュラは V2 を採用しています。

モデルは特定のベンダーに縛られません。どの LLM プロバイダーであっても API キーを設定して利用でき、接続は `/connect` で行います。ドキュメントでは独自に検証済みのリスト（OpenCode Models）をまず推奨しています。

## 起動時に表示される内容

デフォルトのエージェントは 2 つあります。Tab キーで切り替えます。

| エージェント | 役割 |
|---|---|
| build | デフォルト。すべてのツールが有効化され、ファイルを編集します |
| plan | 分析と計画のみ。編集は禁止されています |

`plan` は編集を拒否しますが、例外として `.opencode/plans/` 以下のマークダウン計画ファイルは利用可能です。`bash` は権限設定に従います。コードに触れる前に計画を確認したい場合に使用するモードであると解釈できます。

その下にサブエージェントがあります。`general` は複雑な検索や多段階のタスク用で、`todowrite` を除くすべてのツールを使用します。`explore` は読み取り専用です。`@general` のように `@` で直接呼ぶこともでき、デフォルトのエージェントが自動的に呼び出すこともあります。この概念が馴染みにくい場合は [詳細 → サブエージェント](#/post/ai-subagent) を参照してください。その他、compaction、title、summary という隠れたシステムエージェントが自動で動作しており、UI から選択できないとあります。

プロジェクト内で `/init` を実行するとコードをスキャンしてルートに `AGENTS.md` を作成します。ドキュメントではこのファイルを Git にコミットしておくことを推奨しています。エージェントが毎回読み込むプロジェクトの案内文となる 셈です。このような指示文が [コンテキスト](#/post/ai-context) にどのように反映されるかは別途まとまった記事があります。

## 権限設定は思っていたより緻密だった

このレポートで最も長く読んだ部分です。権限値は 3 つあります。

- allow: 承認なしで実行
- ask: 実行前に確認を求める
- deny: 禁止

権限を付与できる対象は read、edit、glob、grep、list、bash、task、todowrite、webfetch、websearch、lsp、skill、question、external_directory、doom_loop などです。`edit` 一つでファイル編集全体（edit・write・patch）を網羅します。`task` はどのサブエージェントを呼び出せるかを決定し、deny にするとそのサブエージェントはタスクツールリストから完全に消えます。

デフォルトはほとんど allow です。例外があります。`doom_loop`（同じツールの呼び出しが同じ入力に対して 3 回繰り返された場合）と `external_directory`（プロジェクト外へのパス）はデフォルトで ask です。`.env` と `.env.*` ファイルの読み込みもデフォルトで ask であり、`.env.example` のみ allow です。

bash はコマンドパターンで分類できます。ドキュメントの例は以下の通りです。

```json
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny"
    }
  }
}
```

ルールは上から下へ評価され、最後に一致したルールが優先されます。そのため `*` を最初におき、具体的なルールを後に書きます。この設定であれば `git status` は通過し、`rm -rf build` は遮断され、`npm test` は確認を求めます。

ここまで読んで思ったのは、エージェントが使用する [ツール呼び出し](#/post/ai-tool-use) を一重に包み込む承認層こそがレポートの核心部品であるということです。モデルが賢くなることとは別に、何をしてもよいかは設定ファイルが決めます。

## 設定が置かれる場所

設定ファイルは `opencode.json`(または `opencode.jsonc`) であり、TUI 設定は別ファイルの `tui.json` に分離されています。以前 `opencode.json` に存在していた `theme`, `keybinds`, `tui` キーは非推奨となり、`tui.json` に移動したとあります。

<details>
<summary>設定ファイルの場所と優先順位</summary>

文書に記載されている場所は以下の通りです。

- 遠隔: `.well-known/opencode`(組織デフォルト)
- グローバル: `~/.config/opencode/opencode.json`
- カスタム: 環境変数 `OPENCODE_CONFIG` が指すパス
- プロジェクト: プロジェクトルートにある `opencode.json`(現在のディレクトリから最も近い Git ディレクトリまで遡って検索)
- インライン: 環境変数 `OPENCODE_CONFIG_CONTENT`
- マネージド: macOS `/Library/Application Support/opencode/`, Linux `/etc/opencode/`, Windows `%ProgramData%\opencode`

優先順位は後から来るものが先を覆写します。順序は「遠隔 → グローバル → カスタム → プロジェクト → `.opencode` ディレクトリ → インライン → マネージドファイル → macOS マネージド環境設定」です。これは覆写ではなくマージであるため、衝突しないキーはすべてのソースから保持されます。

主要なキーには `model`, `small_model`, `provider`, `permission`, `mcp`, `instructions`, `agent`, `default_agent`, `plugin`, `compaction` などが含まれます。スキーマは `https://opencode.ai/config.json` にあります。

</details>

エージェント、コマンド、プラグインなどは `.opencode/`(プロジェクト) または `~/.config/opencode/`(グローバル) フォルダに置きます。組織がマネージド設定でデフォルト値を配信するパスがある点が目立ちました。個人ツールとして始まったものの、企業での利用まで視野に入れた構造に見えました。

## カスタムエージェントの作成

カスタムエージェントは 2 つの方法で定義できます。`opencode.json` の `agent` キーに JSON で記述するか、マークダウンファイルを `.opencode/agents/`(プロジェクト) または `~/.config/opencode/agents/`(グローバル) に配置します。マークダウンの場合、ファイル名がエージェント名になり、本文がプロンプトとなります。

<details>
<summary>エージェントオプション一覧</summary>

- `description`(必須)
- `mode`: `primary`, `subagent`, `all` のいずれか、デフォルトは `all`
- `model`: `provider/model-id` 形式
- `temperature`, `top_p`
- `steps`: 旧名 `maxSteps` は非推奨
- `prompt`: 設定ファイル基準の相対パス
- `permission`: このエージェントに適用される権限
- `hidden`: サブエージェントを `@` メニューから隠す
- `disable`, `color`
- `tools`: `permission` に置き換えられ、非推奨

CLI では `opencode agent create` で対話的に作成し、`opencode agent list` で一覧を表示します。エージェントごとの `permission` はグローバル権限よりも優先されます。

</details>

例えば読み取り専用のリビュアーエージェントを作成したい場合は、mode を `subagent` にし、edit 権限を `deny` にするといった具合です。同じ権限体系上で役割のみを分ける仕組みです。このようなエージェントがループを回る原理については [エージェントループ](#/post/ai-agent-loop) の記事で別途扱っています。

## 他の記事と続きを見る

設定の `mcp` キーに MCP サーバーを登録し、`skill` が権限キーリストにあることから、[MCP](#/post/ai-mcp) と [スキル](#/post/ai-skills) も同じ枠組みで扱われているようです。ただし、この 2 つの詳細な使い方は私が作成したドキュメントページではサイドバーのタイトルレベルであり、さらに詳しくは書かれていません。ローカルモデルを直接実行して接続する側については [オープンソース分析: Ollama](#/post/repo-ollama) と続きを見ると図が揃います。このようなツール全体を指す言葉は [ハネス](#/post/ai-harness) です。

星が 22 万という数字よりも、権限値の 3 つと最後のルールが勝つパターンマッチングの方が、このレポジトリを理解する上でより有用でした。設定ファイル 1 つで読み取り・書き込み・シェルを分けて許可する方法は、他のコーディングエージェントを見る際にも比較基準になるでしょう。

← [概念マップへ](#/post/ai-map)

関連記事：[サブエージェントとマルチエージェント](#/post/ai-subagent) · [ツール呼び出し (Function calling)](#/post/ai-tool-use) · [エージェントとエージェントループ](#/post/ai-agent-loop)

## 参照リンク

- [anomalyco/opencode（GitHub リポジトリ、2026-11-02 確認）](https://github.com/sst/opencode)
- [OpenCode ドキュメント：概要・インストール](https://opencode.ai/docs/)
- [OpenCode ドキュメント：Agents](https://opencode.ai/docs/agents/)
- [OpenCode ドキュメント：Config](https://opencode.ai/docs/config/)
- [OpenCode ドキュメント：Permissions](https://opencode.ai/docs/permissions/)