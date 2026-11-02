vLLM は、LLM をサーバー上に起動して複数のリクエストを一度に処理するための推論エンジンであり、その核心は GPU メモリを細かく分割して利用する KV キャッシュの管理と、各ステップでトークンを割り当てるスケジューラーにあります。

## 何をするものか

モデルファイルをダウンロードして OpenAI 互換 API サーバーとして起動するオープンソースソフトウェアです。単独での実行よりも、複数の人が同時にリクエストを送信する状況に合わせて設計されています。[詳細 → AI サービング](#/post/infra-ai-serving)

この記事は、2026-11-02 時点の main ブランチ（コミット 16d6673）を浅くクローンして読み取った内容です。コードは頻繁に更新されるため、ファイルの場所や行番号はすぐに変わります。読み取った箇所は `vllm/v1/` 以下のスケジューラー、KV キャッシュ管理、エンジンループ部分です。モデルの実装や CUDA カーネルについては読みませんでした。

## 問題：KV キャッシュがメモリをすべて消費する

LLM はトークンを一つずつ生成します。この際、前のトークンのキー/バリュー値を毎回再計算しないよう GPU に保存しておきます。これが KV キャッシュです。リクエストごとに長さが異なり、回答がいつ終わるかわからないため、従来の方式では最大長さ分連続した領域を事前に確保していました。vLLM ブログによると、この既存システムは断片化と過剰予約によりメモリの 60〜80% を浪費するとあります。浪費された分だけ一度にアップロードできるリクエスト数（バッチ）が減り、処理能力も低下します。

## 原理 1: PagedAttention、ブロックへの分割

オペレーティングシステムの仮想メモリと同じ発想です。一つのリクエストの KV キャッシュを固定サイズのブロックに切り分け、ブロックは GPU メモリから離れていても構いません。各リクエストごとに「論理ブロック → 物理ブロック」のマッピング表（ブロックテーブル）を持ち、トークンが生成される際にのみ新しいブロックを取得します。

| | 従来の方式 | PagedAttention |
|---|---|---|
| 領域の確保 | 最大長さ分連続して事前に | 必要な時にブロック一つずつ |
| 浪費 | 断片化・過剰予約 | リクエストの最後のブロック内側程度 |
| 共有 | 困難 | 同じ物理ブロックを複数のリクエストが指し示す |

ブログの数値では、浪費は最後のブロックのみで発生し 4% 未満であるとあります。論文の要約では、同じレイテンシにおいて FasterTransformer や Orca に比べて処理能力が 2〜4 倍であると主張しています。ブログには HF Transformers に比べて最大 24 倍、TGI に比べて最大 3.5 倍とありますが、これは LLaMA-7B(A10G)・13B(A100 40GB) を ShareGPT の長さ分布で測定した値です。比較は 2023 年時点のものであるため、現在のバージョン同士を比較すれば異なる結果になるでしょう。

一つのブロックあたりのトークン数は設定値 `block_size` であり、コード (`config/cache.py`) ではデフォルト値が 16 に固定されていました。ブロックプールは `v1/core/block_pool.py` の `BlockPool` が担当します。事前に用意されたブロックオブジェクトがあり、空きブロックはキューで管理し、ハッシュテーブルを使ってブロックを検出する表を別途持っています。

## 原理 2: 先頭部分の再利用（prefix caching）

同じシステムプロンプトで始まるリクエストが多い場合、その先頭の KV は同じになります。それを再計算せず、すでに用意されたブロックをそのまま使います。コードの `hash_block_tokens` が行うことは一言で言えば「ハッシュ値の計算」です。ブロックのハッシュ = hash(前のブロックのハッシュ、このブロックのトークン、追加キー)。前のブロックのハッシュが混ざっているため、「このブロックのトークンが同じ」という意味ではなく、「ここまでの先頭部分すべてが同じ」という場合にのみ一致します。

この構造を模倣した玩具コードを実行してみました（ブロックサイズ 4、sha256、実際のコードとは異なります）。

```python
import hashlib
B = 4
def chain(tokens):
    h = b"root"; out = []
    for i in range(0, len(tokens)//B*B, B):
        h = hashlib.sha256(h + bytes(tokens[i:i+B])).digest()
        out.append(h.hex()[:6])
    return out

a = list(range(10))                    # 0..9
b = list(range(4)) + [50,51,52,53,54,55]  # 첫 블록만 같음
c = [7] + list(range(1,10))            # 첫 토큰만 다름
```

結果は以下の通りでした。実行して確認しました。

```
a: ['dec0e9', 'cabceb']
b: ['dec0e9', '5785bf']   # 첫 블록 재사용, 둘째부터 다름
c: ['423961', 'd3738b']   # 첫 블록이 다르니 뒤도 전부 다름
```

c は二つ目のブロックのトークン（4〜7）が a と同じでもハッシュ値が異なります。先頭部分が違うためです。したがって、再利用は「最初から続く同じ区間」のみ可能です。公式設計ドキュメントも、完全に埋まったブロックのみをキャッシュし、最も長い一致区間のみを再利用すると記しています。

また、プロンプト全体がキャッシュされていても最後のトークンは再計算します。次のトークンを決定するための logit が必要だからです。`kv_cache_manager.py` の `get_computed_blocks` に「`prompt_length - 1` で制限する」というコメントがあります。この制限のため、最後のブロック一つが丸ごと再計算される可能性があるともコメントされています。

ハッシュのデフォルトは sha256 です (`config/cache.py` の `prefix_caching_hash_algo`)。ドキュメントではより高速な xxhash 系もありますが、衝突のリスクがあるため、複数のユーザーが利用する環境では注意が必要だとあります。リクエストごとに cache salt を与えると、同じ salt の間のみキャッシュを共有します。

追い出す方式は LRU です。使われないブロックはハッシュ値が付いたまま空きブロックキューに入っており、新しいブロックが必要でキューの先頭から引き出される際にハッシュ値が削除され、再利用対象から外れます。リクエストが完了するとブロックはキューの後ろに戻ります。後ろのブロックほど再度利用される可能性が低いので、先に追い出すようにしているのです（公式ドキュメント）。

## 原理 3: スケジューラー、トークン予算を割り当てる

`v1/core/sched/scheduler.py` 의 `Scheduler.schedule()` 는 각 스텝마다 어떤 요청에 몇 개의 토큰을 할당할지 결정합니다. 3,700 줄이 넘는 파일이지만, 맨 위의 주석이 구조를 잘 설명하고 있습니다. 요약하면 다음과 같습니다.

- "decoding 단계"와 "prefill 단계"를 따로 나누지 않습니다.
- 요청마다 `num_computed_tokens`(이미 계산한 수) 와 `num_tokens_with_spec`(프롬프트 + 출력 + 추측 토큰) 만 존재합니다.
- 매 스텝 앞의 수가 뒤의 수를 따라잡도록 토큰을 배정합니다.
- 이 하나의 규칙으로 chunked prefill, prefix caching, speculative decoding 을 모두 다룹니다.

스텝의 총 예산은 `max_num_scheduled_tokens`이며, 설정의 `max_num_batched_tokens` 기본값은 2048, `max_num_seqs` 기본값은 128 입니다(`config/scheduler.py`). 흐름은 다음과 같이 읽힙니다.

1. 이미 실행 중인 요청 (`running`) 부터 순서대로 확인합니다. 필요한 토큰 수를 예산 내에서 정하고 `allocate_slots` 로 KV 블록을 할당받습니다.
2. 예산이 남으면 대기 중인 요청 (`waiting`) 을 꺼내 앞부분 캐시를 조회한 뒤 이를 이어 prefill 을 시작합니다.
3. 긴 프롬프트는 한 번에 다 넣지 않고 예산만큼 잘라서 넣습니다(chunked prefill). `enable_chunked_prefill` 이 꺼져 있고 남은 예산보다 길면 그 자리에서 멈춥니다. `long_prefill_token_threshold` 를 통해 한 요청이 한 스텝에 쓰는 prefill 양에도 상한을 둘 수 있습니다.

덕분에 긴 프롬프트 하나가 들어와도 이미 실행 중인 요청들의 다음 토큰이 같은 배치에 실립니다. 새 요청이 끝날 때까지 다른 요청이 서 있지 않습니다. 이를 연속 배칭(continuous batching)이라고 부르는 것으로 알고 있습니다. [자세히 → 모델 추론](#/post/ml-inference)

### 블록이 모자르면

`allocate_slots` 가 `None` 을 반환하면 KV 블록이 없다는 뜻입니다. 그러면 우선순위가 가장 낮은 요청을 하나 쫓아냅니다(`_preempt_request`). 정책이 FCFS 라면 `running[-1]`(가장 늦게 들어온 것), PRIORITY 라면 우선순위 값이 가장 큰 것입니다. 쫓겨난 요청은 블록을 반납하고 `num_computed_tokens = 0` 이 된 채 `waiting` 맨 앞으로 돌아갑니다. 즉 나중에 처음부터 다시 계산합니다. 메모리를 아끼는 대신 연산을 한 번 더 쓰는 선택입니다. 쫓겨난 횟수는 `num_preemptions` 에 누적됩니다. 이 부분은 해당 함수를 읽은 내용이며, 쫓겨난 요청이 이어 prefix cache 를 얼마나 되살리는지는 실행해 보지 않았습니다.

### 엔진 루프

`v1/engine/core.py` 의 `step()` 이 전체 뼈대입니다. 읽은 대로 줄이면 다음과 같습니다.

```
scheduler_output = scheduler.schedule()
future = model_executor.execute_model(scheduler_output, non_block=True)
...
model_output = future.result()   # 없으면 sample_tokens 호출
outputs = scheduler.update_from_output(scheduler_output, model_output)
```

스케줄 → GPU 실행 → 결과 반영 순서이며, 이 루프가 계속 돌아갑니다. `update_from_output` 에서 요청이 끝났는지 판단하고 블록을 반납한다는 것은 함수 이름과 흐름에서 읽었고, 세부 구현은 모두 읽지는 않았습니다.

## 흔한 오해

- vLLM 이 모델을 빠르게 만드는 것입니다: 모델 계산 자체를 바꾸는 것이 아니라 메모리를 덜 낭비해서 더 많은 요청을 한 배치에 올리는 쪽입니다. 한 요청만 보내면 이득이 작습니다.
- 앞부분 캐시는 단어가 같으면 쓰입니다: 위 장난감 예시처럼 처음부터 이어져 같아야 합니다. 문장 중간에 같은 구간이 있어도 쓸 수 없습니다.
- 캐시를 켜면 답이 달라집니다: 공식 문서에서는 출력을 바꾸지 않고 재계산만 줄인다고 합니다.
- 메모리가 모자르면 요청이 실패합니다: 이 코드에서는 먼저 다른 요청을 쫓아낸 뒤 나중에 다시 계산합니다. 대기열 사정에 따라 지연은 늘어날 수 있습니다.

<details>
<summary>자세한 풀이: 파일별로 본 것</summary>

| 파일 | 내용 |
|---|---|
| `v1/core/sched/scheduler.py` | `schedule()`, `_preempt_request()`, `update_from_output()` の位置、トークン予算変数 |
| `v1/core/kv_cache_manager.py` | `get_computed_blocks`(キャッシュ照会)、`allocate_slots`(ブロック割り当て)、`free` |
| `v1/core/block_pool.py` | `BlockPool`、ハッシュ→ブロックマッピング表、空きブロックキュー、`free_blocks` の除却順序の説明 |
| `v1/core/kv_cache_utils.py` | `hash_block_tokens`: (前のハッシュ、トークン、extra_keys) をハッシュ化 |
| `v1/core/sched/request_queue.py` | FCFS キューと優先度キュー |
| `v1/engine/core.py` | `step()` ループ |
| `config/cache.py`, `config/scheduler.py` | デフォルト値 (block_size 16, ハッシュ sha256, プレフィックスキャッシング ON, バッチトークン 2048, シーケンス 128) |

最新の main ブランチには、ハイブリッドモデル (Mamba、スライディングウィンドウ)、複数の KV キャッシュグループ、外部コネクタ (KV を他へ渡す機能)、推論デコーディングなどのブランチがスケジューラーの至る所に混在している。そのため、論文の単純な図とコードはかなり異なる。上記の説明は最も基本的な経路のみを追ったものである。

</details>

<details>
<summary>詳細解説：学習順序の推奨</summary>

最初に見るのは `core.py` の `step()`、次に `schedule()` の最上級のコメント、次に `block_pool.py` のクラス説明の順が負担が少ない。ファイルが大きいため、関数名で検索しながら見る方がよい。

</details>

← 概念マップへ [(AI 概念マップ)](#/post/ai-map)

関連記事：[Ollama 分析](#/post/repo-ollama) · [llama.cpp 分析](#/post/repo-llama-cpp) · [AI サービング](#/post/infra-ai-serving)

## 根拠リンク

- Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention: https://arxiv.org/abs/2309.06180
- vLLM ブログ、vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention: https://vllm.ai/blog/2023-06-20-vllm
- vLLM ドキュメント、Automatic Prefix Caching の設計: https://docs.vllm.ai/en/latest/design/prefix_caching/
- vLLM ソース (2026-11-02, コミット 16d6673): https://github.com/vllm-project/vllm