モデル名は 3 ヶ月ごとに変わるため暗記する意味はなく、会社・サイズ・オープンモデルかクローズドモデルかで分類しておけば、新しい名前が出ても場所を見つけることができました。以下の名称・価格・数値は、2026-11-02 に各社公式ページで確認したものを記載しました。

## モデルとは何か

ここでいう「モデル」とは、[LLM](#/post/ai-llm) のように文章を読み書きする大規模なニューラルネットワークを指します。同じ会社内でも複数の異なるサイズのモデルを提供しています。大きなモデルは難しいタスクに強みがありますが、遅く高価であり、小さなモデルは速く安価ですが、難しいタスクでは劣ります。そのため「どの会社が最も良いか」よりも「自分の仕事に適したサイズはどれか」が優先されるケースが多かったです。

## 各社で現在何が提供されているか

公式モデルページから読み取った情報を表にまとめました。価格は 100 万トークン (MTok) 当たりの入力/出力単価です。

| 会社 | モデル(API 名) | 価格（入力/出力） | コンテキスト | 備考 |
|---|---|---|---|---|
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`) | $10 / $50 | 1M | 最も難しい推論・長いエージェントタスク向け、相対的に遅い |
| Anthropic | Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | 1M | 多くの作業の起点としてドキュメントが推奨 |
| Anthropic | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | 1M | 速度と性能のバランス |
| Anthropic | Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10~ / $0.50~ | 1M | 最も速く安く、分類・抽出向け |
| OpenAI | GPT-6 Astra (`gpt-6-astra`) | $10 / $50 | 1.05M | 難しい推論・コーディング |
| OpenAI | GPT-6.1 Sol (`gpt-6.1-sol`) | $2 / $10 | 1.05M | Astra に近い性能で低価格 |
| OpenAI | GPT-6.1 Terra (`gpt-6.1-terra`) | $1 / $5 | 1.05M | 速く効率的、コンピューター操作・文章作成向け |
| OpenAI | GPT-6 Luna (`gpt-6-luna`) | $0.10 / $0.50 | 1.05M | 単純・大量処理向け |
| Google | Gemini 4 Argon (`gemini-4-argon`) | $2 / $10 (11/30 まで、12/1 から $4 / $20) | 1M | 代表的な推論モデル |
| Google | Gemini 3.8 Flash (`gemini-3.8-flash`) | $0.75 / $3.75 (12/31 まで、以降 $1.5 / $7.5) | - | 長いコーディング・エージェント向け Flash |
| Google | Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | $0.30 / $2.50 | - | 3.5 シリーズの中で最も安く速い |
| DeepSeek | deepseek-v4-pro | $0.66 / $1.98 (ピーク時基準、キャッシュミス) | 1M | 出力最大 384K |
| DeepSeek | deepseek-flash | $0.15 / $0.6 (ピーク時基準、キャッシュミス) | 1M | 出力最大 384K |

読み進めて気づいた点があります。

- 三社（Anthropic・OpenAI・Google）の主力モデルはすべてコンテキストが約 1M です。コンテキストの数字だけで判断することはできません。長いからといって必ずしも性能が良いわけではありません。これは [コンテキストウィンドウ](#/post/ai-context-window) の記事にも記載されています。
- 命名規則は会社ごとに異なります。Claude は名前がサイズ（Fable・Opus・Sonnet・Haiku）を意味し、OpenAI は名前（Astra・Sol・Terra・Luna）がグレードを示し、Google は Pro/Flash/Flash-Lite などの単語がサイズを表します。価格表も併せて見ることでどのラインか把握できます。
- DeepSeek の価格は時間帯によって 2 倍の差があります。文書上、平日 UTC 01〜04 時・06〜10 時がピークで、それ以外は半額です。

## オープンモデルとクローズドモデル

クローズドモデルは API でのみ利用可能です。重み（学習済みの数値の集合）を受け取ることはできません。オープンウェイト（open weights）モデルは重みを取得して、自社のコンピュータやサーバーにアップロードして実行できます。「ソースコードまで公開」という意味ではなく、ライセンス条件もモデルごとに異なるため、商用利用可否は別途確認する必要があります。

| 会社 | オープンソースで確認可能なもの | ライセンス | サイズ |
|---|---|---|---|
| Qwen(アリババ) | Qwen3.8-27B | Apache-2.0 | 27B 密度、画像・動画理解 |
| Qwen(アリババ) | Qwen3.8-Flash-Next, Qwen3.8-2.4T-A95B | - | 180B / 2.4T(Hugging Face リストのサイズ表示) |
| DeepSeek | V4.1-Flash, V4-Pro-0813 など | Mistral ドキュメントでは V4.1 Flash は MIT と記載 | Hugging Face リスト基準 763B / 1.7T |
| Mistral | Mistral Large 4 | Mistral Ecosystem Open Weight License | - |
| Mistral | Mistral Small 4, Ministral 3 (3B/8B/14B) | Apache 2.0 | 小さい方 |
| Meta | Llama 4 Scout/Maverick | - | Hugging Face 表示 109B / 402B (2025-05 以降更新なし) |

Meta の整理は不十分だ。公式 Hugging Face リストで確認した最新の Llama は Llama 4(2025 年 5 月更新) であった。検索結果には Meta が 2026 年に「Muse」という名前でオープンウェイトを公開するという記事があったが、出典は数箇所しかなかったため

OpenAI は今回閲覧したモデルページに gpt-oss などのオープンモデルは表示されていなかった。存在しないという意味ではなく、そのページでは扱われていないという意味だ。

[詳細 → LLM](#/post/ai-llm)

## サイズカテゴリー：大・中・小

企業がサイズを類似の区分に分けていることが表から確認できた。

| カテゴリー | 例 | 適した用途 | 単価感覚 |
|---|---|---|---|
| 大 | Fable 5.1, GPT-6 Astra, Gemini 4 Argon | 困難な推論、数時間かかるエージェント | 入力 $10 代 |
| 中 | Opus 5.5, Sonnet 5.5, GPT-6.1 Sol/Terra, Gemini 3.8 Flash | コーディング・ドキュメント・一般業務 | $0.75~$4 |
| 小 | Haiku 5.5, GPT-6 Luna, Gemini 3.5 Flash-Lite | 分類・抽出・ルーティング、大量処理 | $0.10~$0.30 |

Anthropic のドキュメントでは、最初は最も安価な Haiku から始め不足分だけ上げる方法と、最も高性能なモデルから始めて減らす方法の両方を紹介している。いずれの場合も自データで評価を回すよう促している。

## 推論モデル

推論モデルとは、回答を出す前に思考トークンを先に使用するモデルのことだ。現在は「推論モデル」を個別に選ぶよりも、一つのモデル内で思考量を調整する方向に向かっているようだ。

- Claude: 今回閲覧した 4 つのモデルすべてが適応型 (adaptive) な思考であり、Fable・Opus は常時オンになっている。`effort` 値で深さを調整する。ドキュメントではモデルを変更するよりも effort を調整する方がより良い手段であることが多いと記載されている。
- OpenAI: 表に「推論ステップ」がある。Astra・Sol は low から max、Terra・Luna は none から max。
- DeepSeek: 思考モードと非思考モードの両方をサポートしており、デフォルトは思考モードだ。
- Qwen3.8-27B: 思考モードがデフォルトでオンであり、各リクエストごとにオフにできる。

多くの思考を要求すると出力トークンが増え、それだけお金と時間がかかる。これは一般的な構造の話だ。

## マルチモーダル

マルチモーダルとは、テキストだけでなく画像・音声・動画も扱うことを意味する。Claude のドキュメントでは、現在のモデルがすべてテキスト・画像入力とテキスト出力をサポートしていると記載されている。OpenAI も最新モデルはテキスト・画像入力、テキスト出力となっている。画像・音声・動画を生成する側は別モデルだ。OpenAI は GPT-Image-2.5 とリアルタイム音声 (GPT-Live・GPT-Realtime) シリーズを、Google は Nano Banana(画像)・Gemini Omni Flash(動画)・Lyria(音楽)・TTS シリーズを別途公開している。オープンソース側では Qwen3.8-27B が画像・動画理解をサポートし、DeepSeek V4.1 Flash も画像 - テキスト入力として表示されている。

<details>
<summary>詳細解説：選ぶ基準 5 つ</summary>

1. 性能：ベンチマークの順位は今回改めて確認しませんでした。公式ドキュメントに準じて、自社の業務に適した評価セットを作成して回すのが最も信頼できます。
2. 価格：入力と出力で単価が異なり、通常は出力の方が高いです。キャッシュ読み取りの入料は一部（Claude のドキュメントでは 2.5〜10%）であり、Claude バッチ API は 50% オフです。推論モデルの思考トークンは出力として課金されます（Gemini の価格表には "incl. thinking" と表示）。
3. 速度：Claude のドキュメントによると、相対的な遅延は Fable が遅く、Opus が普通、Sonnet が速く、Haiku が最も速いとされています。
4. コンテキスト：今回確認した主要モデルの多くは 1M です。ただし品質は別問題です。
5. ローカル実行可否：ローカルではオープンウェイトモデルのみ可能です。モデルのサイズが必要なメモリ量に直結します。Qwen3.8-27B は 27B なので、量子化すれば個人用 GPU でも動作させる規模です。DeepSeek V4（数百 B〜1.7T）や Qwen 2.4T は個人設備では困難と推測されます。

</details>

## よくある誤解

- 高価なモデルが常に優れている：ドキュメントでも、分類・抽出などの大規模タスクは小さなモデルから始めるよう推奨されています。難しい課題のみに大きなモデルを使うべきです。
- オープンモデルは無料：ウェイトを受け取っても、実行する GPU や電力、運用コストがかかります。サービスとして利用する場合はこのコストを考慮する必要があります。AI 機能を作る際は、1 ユーザーあたりの月間トークン料から計算するのが適切です。
- コンテキストが 1M であればすべて同等：ウィンドウサイズが同じでも、同程度の性能を保証されるわけではありません。
- オープンソースとオープンウェイトは同じ：ウェイトのみ公開し、学習データやコードを提供しないケースが多いです。ライセンスも Apache 2.0 から企業専用ライセンスまで様々です。上記表の Mistral Large 4 がその例です。
- 名前につく数字が大きいほど最新：Claude Fable 5.1 と Opus 5.5 は同時に現行モデルです。数字はシリーズ内でのみ比較されます。

← 概念マップ (#/post/ai-map)

関連記事：[LLM](#/post/ai-llm) · [コンテキストウィンドウ](#/post/ai-context-window) · [ハルシネーション](#/post/ai-hallucination)

## 根拠となるリンク（2026-11-02 に確認）

- Anthropic, Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic, Choosing the right model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- OpenAI, Models: https://developers.openai.com/api/docs/models
- Google, Gemini API models: https://ai.google.dev/gemini-api/docs/models
- Google, Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek, Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Mistral, Models overview: https://docs.mistral.ai/getting-started/models/models_overview/
- Qwen3.8-27B モデルカード：https://huggingface.co/Qwen/Qwen3.8-27B
- Qwen Hugging Face オブジェクト：https://huggingface.co/Qwen
- DeepSeek Hugging Face オブジェクト：https://huggingface.co/deepseek-ai
- Meta Llama Hugging Face オブジェクト：https://huggingface.co/meta-llama