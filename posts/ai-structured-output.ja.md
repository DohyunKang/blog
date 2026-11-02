構造化出力は、モデルの回答をあらかじめ決まった形式（スキーマ）に合わせて導き出す機能であり、依頼するのと強制するのでは信頼できる程度が異なります。

## なぜ必要なのか

LLM は基本的に文章を書くものです。人間が読む分には問題ありませんが、プログラムが受け取る場合は問題になります。メール 1 通から名前とデモの依頼有無を抽出するコードを書くとしましょう。モデルがこのような回答をしてしまうと困ってしまいます。

```
네, 분석해 봤습니다! 이름은 김OO이고 데모를 요청했네요.
```

コードが求めているのは `{"name": "김OO", "demo_requested": true}` のような決まった形式です。挨拶文が先についたり、キー名が `demo` に変わったり、`true` の場所に `"네"` が入るとパースが壊れてしまいます。構造化出力はこれを減らそうとする機能です。モデルの回答を機械がそのまま読めるようにする話なので、[LLM](#/post/ai-llm) が確率的に文章を繋げて書くという点を知っていれば理解しやすいでしょう。

## 3 つの段階に分けて見ると

下に行くほど強力です。

| 段階 | 方法 | 保証 |
|---|---|---|
| 1. 依頼 | プロンプトに「JSON でだけ答え、キーは name, demo_requested」と書きます | なし。ほとんど従いますがたまに無視します |
| 2. JSON モード | API オプションで「有効な JSON を出してください」と指定します | JSON の文法は合っていますが、キーとタイプは保証されません |
| 3. スキーマ強制 | JSON Schema を一緒に送ってその形式だけ出るようにします | 文法とスキーマも合います（例外は後述） |

OpenAI のドキュメントでは、JSON モードと構造化出力 (Structured Outputs) をこのように区別しています。どちらも有効な JSON を作成しますが、スキーマを守るのは構造化出力のみであり、可能であれば構造化出力を使うことを推奨しています。1 段階目は [プロンプト](#/post/ai-prompt) を上手に使う問題なので、API が行うことはありません。

## スキーマをどのように強制するか

スキーマは JSON Schema という標準形式で書きます。どのキーがあり、各値が文字列かブール値か、どのキーが必須かを記した設計図です。Anthropic のドキュメントの例は概ねこのような形です。

```json
{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "demo_requested": {"type": "boolean"}
  },
  "required": ["name", "demo_requested"],
  "additionalProperties": false
}
```

Anthropic のドキュメントによると、内部では制約付きデコーディング (constrained decoding) を使用しています。スキーマを文法としてコンパイルし、トークンを 1 つずつ選ぶ際にその文法で許可されるトークンだけを当てる方式です。モデルが "네," などのトークンを抽出しようとしても、その場所では候補から除外されます。そのため、回答が終わってから直すのではなく、生成の途中で間違える道筋を塞ぎます。この部分は [サンプリング](#/post/ai-sampling) が次のトークンを選ぶ段階であることが分かれば図が描けます。

コストの話もドキュメントにあります。最初に使用するスキーマはコンパイルのため少し遅延が発生し、コンパイルされた文法は最後の使用後 24 時間キャッシュされます (Anthropic のドキュメント基準)。OpenAI のドキュメントでも新しいスキーマの最初のリクエストに追加の遅延があると記載されています。また、Anthropic は形式を説明するシステムプロンプトが別途付加されるため入力トークンが増え、`output_config.format` を変更するとその対話のプロンプトキャッシュが無効になるとのことです。

## ツール呼び出しとの関係

混乱しやすい部分です。構造化された JSON が出力される経路は 2 つあります。

- レスポンス自体を構造化: ユーザーに返す最終的な回答がスキーマに従います。Anthropic は `output_config.format`、OpenAI は `text.format` に `json_schema` を指定します。
- ツール呼び出し引数を構造化: モデルが関数を呼び出す際に渡す引数がツールのスキーマに従います。Anthropic はツール定義に `strict: true` を付けます。

OpenAI のドキュメントの区別は分かりやすかったです。モデルから内蔵のツール・関数・データを呼び出させる場合は関数呼び出しを使い、ユーザーに向かうレスポンスの形式を定めたければ `text.format` を使います。ツール呼び出し自体については [ツール呼び出し](#/post/ai-tool-use) の記事で別に整理することにし、ここでは「ツール引数も結局 JSON なので同じスキーマ技術を使います」という程度に留めました。Anthropic のドキュメントでは両方を併用できることも述べています。するとツール呼び出しもスキーマに合致し、最終的なレスポンスもスキーマに合致します。

[MCP](#/post/ai-mcp) のツール定義にも入力スキーマが含まれていますが、同じ系統の話だと理解しました。

## コードではこう書きます

Anthropic のドキュメントによると、Python SDK は Pydantic モデルを渡すと `client.messages.parse(output_format=...)` でパースされたオブジェクトを返します。TypeScript では Zod スキーマを `zodOutputFormat` でラップします。手動で JSON Schema を書く代わりに、普段使っている型定義からスキーマを抽出する方式です。私はこの SDK の呼び出しを実際に実行して見ることはできませんでした。

<details>
<summary>詳細な解説: スキーマではできないこと (Anthropic ドキュメント基準)</summary>

スキーマ文法をすべて記述することはできません。本文書で読み取れた制限事項をまとめました。

- **対応**: 基本型、`enum`, `const`, `anyOf`, 内部 `$ref`, `required`, いくつかの文字列形式 (`date-time`, `email`, `uuid` など)。オブジェクトには `additionalProperties: false` が必須です。
- **非対応**: 再帰スキーマ、外部 `$ref`, 数値範囲 (`minimum`, `maximum`), 文字列長さ (`minLength`, `maxLength`), `minItems` は 0 または 1 のみ。
- 非対応機能を使用すると 400 エラーが発生します。SDK ヘルパーは一部の制約をドキュメントに記述し、レスポンスをローカルで再検証することで回避します。
- **複雑度制限**: 1 つのリクエストにおいて strict ツールは 20 個、選択パラメータは 24 個、ユニオン型パラメータは 16 個までです。これを超えると "Schema is too complex" エラーが発生する可能性があります。

OpenAI のドキュメントでは、すべての例が `additionalProperties: false` にしてすべてのプロパティを `required` に設定しています。

そのため、「年齢は 0〜120」のように値の範囲をスキーマで制限できないケースが生じます。外観は合っても値がおかしくなる可能性があるということです。値の意味は結局、コードで再度チェックする必要があります。

</details>

## それでも失敗するケース

強制だからといって常に成功するわけではありません。2 つのドキュメントが同じことを指摘しています。

- **拒否 (refusal)**: モデルが安全上の理由で回答を拒否すると、スキーマに適合しない出力が返されることがあります。Anthropic はこの場合 HTTP 200 で `stop_reason: "refusal"` を返し、トークンは課金されるとのことです。OpenAI はレスポンスに `refusal` という項目が別途含まれるため、パース前に確認するよう指示しています。
- **トークン制限**: 回答が `max_tokens` で切断されると JSON が途中で途切れます。Anthropic は `stop_reason: "max_tokens"`, OpenAI は `status: "incomplete"` と `max_output_tokens` の理由で通知します。制限を上げて再度リクエストするのが解決策です。
- **enum の大文字小文字**: Anthropic のドキュメントによると、enum 値は大文字小文字の違いだけで異なる場合があります。比較する際は大文字小文字を無視すべきだという意味です。
- **外観は合っても間違った場合**: 形式が合っても中身が正しいとは限りません。存在しない値を説得力のある内容で埋めることができ、これは [幻覚](#/post/ai-hallucination) と同様の問題です。

したがって、実際には「スキーマ強制 + コードでの検証 + 失敗したら再試行」の 3 つの層があるように理解しました。

## 失敗処理を自作してみる

スキーマ強制が使えない環境（旧モデル、ローカルモデルなど）では、検証と再試行を自分で実装する必要があります。以下のコードは標準ライブラリのみを使用した最小限の例で、モデル呼び出し部分は偽関数に置き換えて実行しました。最初の回答には挨拶が付き JSON が壊れ、2 番目の回答は型が間違っており、3 番目の回答で通りました。

```python
import json

SCHEMA = {"name": str, "demo_requested": bool}

def check(text):
    data = json.loads(text)              # 1) JSON 문법
    if not isinstance(data, dict):
        raise ValueError("객체가 아님")
    for key, typ in SCHEMA.items():      # 2) 키와 타입
        if key not in data:
            raise ValueError(f"없는 키: {key}")
        if not isinstance(data[key], typ):
            raise ValueError(f"타입 틀림: {key}")
    return data

def ask(prompt, call, retries=2):
    for _ in range(retries + 1):
        out = call(prompt)
        try:
            return check(out)
        except (json.JSONDecodeError, ValueError) as e:
            prompt += f"\n이전 답이 잘못됐다: {e}. JSON만 다시."
    raise RuntimeError("재시도 실패")

answers = iter(['네, 알겠습니다! {"name": "김"}',
                '{"name": "김", "demo_requested": "yes"}',
                '{"name": "김", "demo_requested": true}'])
print(ask("문의 메일 분석", lambda p: next(answers)))
```

実行結果は `{'name': '김', 'demo_requested': True}` でした（Python で直接実行確認、モデル呼び出しは偽）。実際のサービスでは再試行ごとに費用がかかるため、回数を 2〜3 回に制限するのが適切でしょう。コストについては [トークンを節約する方法](#/post/claude-tokens)とも関連します。

## よくある誤解

- **JSON モードならスキーマも守られる**: いいえ。OpenAI のドキュメントの区別では、JSON モードは文法のみを保証するものです。キーが欠けていても有効な JSON です。
- **スキーマ強制なら内容も信頼できる**: 外観のみを保証します。値の真偽は別途確認する必要があります。
- **強制すれば常に成功する**: 拒否とトークン制限超過は例外です。上記の 2 つのドキュメントともこれを記載しています。
- **スキーマが長く詳細なほど良い**: 複雑度制限があり、コンパイル遅延も発生します。Anthropic のドキュメントでは本当に必要なツールだけを strict にするよう指示しています。
- **すべてのモデルが対応している**: いいえ。OpenAI は古いモデルには JSON モードが必要かもしれないと述べており、Anthropic は対応モデルリストを別途持っています。モデルリストは頻繁に変更されるため、使用する際はドキュメントを再確認する必要があります。

## 根拠となるリンク

- Anthropic ドキュメント, Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI ドキュメント, Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs

← コンセプトマップへ (#/post/ai-map)

関連記事: [ツール呼び出し](#/post/ai-tool-use) · [プロンプト](#/post/ai-prompt) · [幻覚](#/post/ai-hallucination)