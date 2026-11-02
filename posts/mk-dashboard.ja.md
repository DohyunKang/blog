パフォーマンスダッシュボードは、きれいなチャートを作るよりも「どの数字をどうカウントするか」を決めることが先であり、構造については収集→保存→表示の 3 つの領域があれば最初には十分だった。

## ダッシュボードとは何か

コンテンツを投稿すると、プラットフォームごとに閲覧数、いいね、コメントなどの数字が別々に蓄積される。ダッシュボードはそれらを一つの画面に集約し、「最近何がうまくいっているか」を一目で把握できる画面だ。自動化の文脈では [コンテンツカレンダー](#/post/mk-content-calendar) に投稿し、[ショートフォームパイプライン](#/post/mk-shortform-pipeline) で作成し、この画面で結果を確認するという流れになる。

最初はツールの選定が課題だとばかり思っていたが、整理してみるとツールよりも前に 3 つの要素があった。どの問いに答えるか、その問いに適した指標は何か、そしてその数字をどこからどれくらいの頻度で取得できるかだ。

## 指標を先に決める

同じ名称でもプラットフォームによって意味が異なる。YouTube Analytics API のドキュメントでは `views` が「レポートの種類によって異なる数字を指す」と記載されている。その他のドキュメントで定義された指標は以下の通りである。

| 指標 | ドキュメントの定義（要約） |
|---|---|
| estimatedMinutesWatched | チャンネル・動画を視聴した総分 |
| averageViewDuration | 再生一回あたりの平均長さ（秒） |
| subscribersGained | 新規購読者数 |
| likes / shares | いいね数 / シェアボタン経由で共有された回数 |

Instagram メディアインサイトも同様に細分化している。`reach` はメディアを一度以上見たユニークアカウント数の推定値であり、同じ人の繰り返し露出までカウントする `impressions` とは異なる。その `impressions` は 2024 年 7 月 2 日以降に作成されたメディアについてはもはや提供されないとドキュメントに記載されている。`total_interactions` はいいね・保存・コメント・シェアを合計し、取消分を引いた値である。

そのため指標は 3 つの領域に分けて扱うのが便利だった。

- **規模**: 閲覧数、リーチ。どれくらい広がったか
- **反応**: いいね、コメント、シェア、保存。視聴者が行動したか
- **結果**: 購読増加、リンククリック、問い合わせ。本来の目的に達したか

規模だけを見ると数字が大きい方が勝ちになるため、反応を規模で割った比率も併せて示す。

```
참여율 = (좋아요 + 댓글 + 공유 + 저장) / 조회
```

定義は記述者の自由だが、分母を閲覧数にするかリーチにするかを定め、明記しておく必要がある。後で数字が変わった際に、定義が変わったのか実績が変わったのかが区別できないためだ。[A/B テスト](#/post/mk-ab-test) でも比較基準となる指標を先に一つ決めるのは同じ理由である。

## 構造：収集 → 保存 → 表示

```
[플랫폼 API] --(하루 1번 스케줄)--> [수집 스크립트] --> [DB 표] --> [쿼리] --> [차트/표]
   YouTube / Instagram              API 호출·정리       스냅샷 저장    집계       화면
```

領域を分ける理由は、それぞれが故障する仕様が異なるからだ。

- **収集**: トークン切れ、呼び出し制限、レスポンス形式の変更などで破綻する。失敗しても保存された過去の値は正常である必要がある。
- **保存**: オリジナルの数字をそのまま蓄積する。計算した値だけを保存しておくと、定義を変更した際に過去を再構築できない。
- **表示**: 定義や表示方法が変わっても収集には影響を与えない。

収集時に注意すべき点はドキュメントにいくつか記載されている。Instagram インサイトではデータが最大 48 時間遅れる可能性があり、値を保存する期間も最大 2 年である。ストーリー指標は 24 時間しか有効でなく、ドキュメントでは `story_insights` ウェブフックを使って期限切れになる前に取得しておくよう案内している。閲覧可能な値がない場合は 0 ではなく空の結果が返ってくる点にも注意が必要だ。0 と「ない」を同じように保存すると平均が誤算される。

[トレンド収集](#/post/mk-trend-collect)のように API で取得する場合は制限や規約が優先されるため、呼び出しは一日に 1〜2 回程度に抑え、残りは保存された値を利用する。

## 最小実装

データベースは SQLite で一つから始めてもよい。テーブルは「記事一つ × 日付一つ」を一行として積み上げる形状だ。プラットフォームが提供する値は累積値なので、毎日スナップショットを取得しておけば、増加分は後で差分計算で求めることができる。

```python
import sqlite3, random, datetime as dt

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE post_metrics (
  post_id TEXT, platform TEXT, fetched_on TEXT,
  views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER,
  PRIMARY KEY (post_id, fetched_on)
);
""")

random.seed(1)
start = dt.date(2026, 10, 1)
rows = []
for i in range(6):
    pid = f"p{i+1}"
    plat = "reels" if i % 2 == 0 else "shorts"
    base = random.randint(800, 3000)
    for d in range(7):                      # 하루 한 번 스냅샷(누적값)
        v = int(base * (1 - 0.5 ** (d + 1)))
        rows.append((pid, plat, str(start + dt.timedelta(days=d)),
                     v, v // 20, v // 80, v // 100, v // 60))
db.executemany("INSERT INTO post_metrics VALUES (?,?,?,?,?,?,?,?)", rows)

# 각 글의 최신 스냅샷만 골라 참여율 계산
q = """
SELECT platform, post_id, views,
       ROUND(1.0 * (likes + comments + shares + saves) / views, 4) AS eng_rate
FROM post_metrics m
WHERE fetched_on = (SELECT MAX(fetched_on) FROM post_metrics WHERE post_id = m.post_id)
ORDER BY eng_rate DESC
"""
for r in db.execute(q): print(r)

# 일별 증가분(누적값 차이)
q2 = """
SELECT fetched_on, SUM(views - COALESCE(prev,0)) AS new_views FROM (
  SELECT post_id, fetched_on, views,
         LAG(views) OVER (PARTITION BY post_id ORDER BY fetched_on) AS prev
  FROM post_metrics)
GROUP BY fetched_on ORDER BY fetched_on
"""
print()
for r in db.execute(q2): print(r)
```

上記のコードは偽データを用いて実際に動作確認を行った。出力の前半部分は記事ごとの参加率であり、後半部分は日次の新規閲覧数である。偽データゆえに数字自体には意味はないが、クエリが意図通り「最新のスナップショットのみを選択する」ことと、「累積値から日次増加分を計算する」ことを確認できた。

これだけの機能があれば画面は一つのテーブルから開始できる。チャートが必要になった時点で追加すればよい。

<details>
<summary>詳細解説：クエリがやっていること</summary>

最初のクエリの `WHERE fetched_on = (SELECT MAX(...))` は、各記事に対して最も遅い日付の行のみを残す。累積値であるため、最新の行は現在までの合計を表す。これを漏らして全体を足し合わせると、同じ閲覧数が毎日重複して加算されてしまう。

2 つ目のクエリは、ウィンドウ関数 `LAG` を使用して同じ投稿の前の日の値を横に追加し、その日の値から引くことで増加量を計算します。初日は前日が存在しないため、`COALESCE` で 0 を代入しています。実際の収集では「前回の収集が失敗して行がない」日が発生することがあり、その日の増加分が翌日に集約されて表示されるため、欠落した日を明記する必要があります。

保存テーブルのプライマリキーが `(post_id, fetched_on)` であるのも理由があります。同じ日の収集が複数回実行されても 1 行だけ残るようにするための仕組みです。実際には `INSERT` を `INSERT OR REPLACE` に変更することで、再実行時にエラーなく処理を進められます。

</details>

<details>
<summary>詳細な解説：規模が大きくなると変わる点</summary>

投稿が数十件でプラットフォームが 2 つであれば、SQLite と cron（または予約タスク）で十分だと考えます。チームで共有する場合やデータが継続的に増加する場合は、Postgres などのサーバー型 DB、そして Metabase や Looker Studio などの BI ツールを導入する選択肢もあります。どちらの場合でも、上記の 3 カラム構造はそのままに、カラムを 1 つだけ入れ替える形となるため、最初からカラムを分けておけば移動しやすくなります。この部分はツールごとの直接比較を行っていません。

</details>

## よくある誤解

- データが多いほど良いダッシュボードである：見る人が意思決定できる数字が 5〜6 つあれば十分です。それ以外は折りたたみます。
- 閲覧数が成果である：閲覧数は規模に過ぎず、目的に応じて結果カラムの数字が成果となります。
- プラットフォーム画面で既に表示されているので不要である：プラットフォームが 2 つ以上あり、保存期間が決まっている場合、自分で蓄積しておく方が比較や長期的な傾向分析に適しています。
- 自動収集であれば数字が正確である：遅延、推定値、定義の変更があるため、「大まかにこの程度」と読み取るのが適切です。

## 根拠となるリンク

- YouTube Analytics API メトリクス一覧: https://developers.google.com/youtube/analytics/metrics
- Instagram Platform, Media Insights リファレンス: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights

← コンセプトマップへ (#/post/ai-map)

関連記事：[コンテンツカレンダーの自動化](#/post/mk-content-calendar) · [A/B テスト](#/post/mk-ab-test) · [トレンド収集](#/post/mk-trend-collect)