성과 대시보드는 예쁜 차트를 만드는 일보다 "무슨 숫자를 어떻게 셀지" 정하는 일이 먼저였고, 구조는 수집 → 저장 → 보기 세 칸이면 처음엔 충분했다.

## 대시보드가 뭔지

콘텐츠를 올리고 나면 조회수, 좋아요, 댓글 같은 숫자가 플랫폼마다 따로 쌓인다. 대시보드는 그걸 한 화면에 모아서 "요즘 뭐가 잘 되고 있나"를 한눈에 보게 하는 화면이다. 자동화 쪽에서는 [콘텐츠 캘린더](#/post/mk-content-calendar)로 올리고, [숏폼 파이프라인](#/post/mk-shortform-pipeline)으로 만들고, 이 화면으로 결과를 확인하는 순서로 이어진다.

처음엔 도구 고르는 게 일일 줄 알았다. 그런데 정리해 보니 도구보다 앞에 세 가지가 있었다. 어떤 질문에 답할 건지, 그 질문에 맞는 지표가 뭔지, 그 숫자를 어디서 얼마나 자주 가져올 수 있는지.

## 지표부터 정한다

같은 이름이어도 플랫폼마다 뜻이 다르다. YouTube Analytics API 문서는 `views`가 "보고서 종류에 따라 다른 숫자를 뜻한다"고 적는다. 그 외 문서에 정의된 지표는 이렇다.

| 지표 | 문서의 정의(요지) |
|---|---|
| estimatedMinutesWatched | 채널·영상을 시청한 총 분 |
| averageViewDuration | 재생 한 번의 평균 길이(초) |
| subscribersGained | 구독한 횟수 |
| likes / shares | 좋아요 수 / 공유 버튼으로 공유된 횟수 |

Instagram 미디어 인사이트 쪽도 비슷하게 갈린다. `reach`는 미디어를 한 번 이상 본 고유 계정 수의 추정치이고, 같은 사람의 반복 노출까지 세는 `impressions`와 다르다. 그 `impressions`는 2024년 7월 2일 이후 만든 미디어에는 더 이상 제공되지 않는다고 문서에 나온다. `total_interactions`는 좋아요·저장·댓글·공유를 합치고 취소분을 뺀 값이다.

그래서 지표는 세 칸으로 나눠 두는 게 편했다.

- 규모: 조회, 도달. 얼마나 퍼졌나
- 반응: 좋아요, 댓글, 공유, 저장. 본 사람이 움직였나
- 결과: 구독 증가, 링크 클릭, 문의. 원래 목적에 닿았나

규모만 보면 숫자가 큰 글이 이긴다. 그래서 반응을 규모로 나눈 비율 하나를 같이 둔다.

```
참여율 = (좋아요 + 댓글 + 공유 + 저장) / 조회
```

정의는 쓰는 사람 마음이라, 분모를 조회로 할지 도달로 할지 정해서 적어 둬야 한다. 나중에 숫자가 바뀌었을 때 정의가 바뀐 건지 성과가 바뀐 건지 구분이 안 되기 때문이다. [A/B 테스트](#/post/mk-ab-test)에서도 비교 기준 지표를 먼저 하나 정하는 게 같은 이유다.

## 구조: 수집 → 저장 → 보기

```
[플랫폼 API] --(하루 1번 스케줄)--> [수집 스크립트] --> [DB 표] --> [쿼리] --> [차트/표]
   YouTube / Instagram              API 호출·정리       스냅샷 저장    집계       화면
```

칸을 나누는 이유는 각각 고장 나는 방식이 달라서다.

- 수집: 토큰 만료, 호출 한도, 응답 형식 변경 때문에 깨진다. 실패해도 저장된 과거 값은 멀쩡해야 한다.
- 저장: 원본 숫자를 그대로 쌓아 둔다. 계산한 값만 저장하면 정의를 바꿀 때 과거를 다시 못 만든다.
- 보기: 정의가 바뀌거나 보는 방식이 바뀌어도 수집은 건드리지 않는다.

수집할 때 알아 둘 것이 문서에 몇 가지 있었다. Instagram 인사이트는 데이터가 최대 48시간 늦을 수 있고, 값을 보관하는 기간도 최대 2년이다. 스토리 지표는 24시간만 조회되어서, 문서는 `story_insights` 웹훅으로 만료 전에 받아 두라고 안내한다. 조회 가능한 값이 없으면 0이 아니라 빈 결과가 온다는 점도 있다. 0과 없음을 같은 걸로 저장하면 평균이 틀어진다.

[트렌드 수집](#/post/mk-trend-collect)처럼 API로 가져오는 일은 한도와 약관이 먼저 걸리는 편이라, 호출은 하루 한두 번으로 줄이고 나머지는 저장된 값으로 본다.

## 최소 구현

저장소는 SQLite 하나로 시작해도 된다. 표는 "글 하나 × 날짜 하나"를 한 줄로 쌓는 모양이다. 플랫폼이 주는 값은 누적이라, 매일 스냅샷을 찍어 두면 증가분은 나중에 차이로 구한다.

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

위 코드는 가짜 데이터로 직접 돌려 확인했다. 출력의 앞부분은 글별 참여율이고, 뒷부분은 날짜별 새 조회수다. 가짜 데이터라 숫자 자체에는 뜻이 없고, 쿼리가 의도대로 "최신 스냅샷만 고르기"와 "누적에서 일별 증가분 만들기"를 한다는 것만 확인했다.

이 정도가 있으면 화면은 표 하나로도 시작된다. 차트가 필요해지면 그때 붙인다.

<details>
<summary>자세한 풀이: 쿼리가 하는 일</summary>

첫 쿼리의 `WHERE fetched_on = (SELECT MAX(...))`는 글마다 가장 늦은 날짜의 줄만 남긴다. 누적값이라 최신 줄이 지금까지의 합이다. 이걸 빼먹고 전체를 더하면 같은 조회가 날마다 중복으로 더해진다.

둘째 쿼리는 윈도우 함수 `LAG`로 같은 글의 전날 값을 옆에 붙이고, 오늘 값에서 빼서 그날 늘어난 양을 만든다. 첫날은 전날이 없어서 `COALESCE`로 0을 넣었다. 실제 수집에서는 "전날 수집이 실패해서 줄이 없는" 날이 생기는데, 그날의 증가분이 다음 날로 몰려서 합쳐 보이므로 빠진 날은 표시해 둬야 한다.

저장 표의 기본키가 (post_id, fetched_on)인 것도 이유가 있다. 같은 날 수집이 두 번 돌아도 한 줄만 남도록 하려는 장치다. 실제로는 INSERT를 `INSERT OR REPLACE`로 바꿔야 재실행이 오류 없이 지나간다.

</details>

<details>
<summary>자세한 풀이: 규모가 커지면 바뀌는 것</summary>

글이 몇십 개이고 플랫폼이 둘이면 SQLite와 cron(또는 예약 작업)으로 충분하다고 본다. 팀이 같이 보거나 데이터가 계속 늘면 Postgres 같은 서버형 DB, 그리고 Metabase·Looker Studio 같은 BI 도구를 얹는 선택지가 있다. 어느 쪽이든 위의 세 칸 구조는 그대로 두고 칸 하나만 교체하는 모양이라, 처음부터 칸을 나눠 두면 옮기기 쉽다. 이 부분은 도구별로 직접 비교해 보지 않았다.

</details>

## 흔한 오해

- 숫자가 많을수록 좋은 대시보드다: 보는 사람이 결정할 수 있는 숫자 대여섯 개가 낫다. 나머지는 접어 둔다.
- 조회수가 성과다: 조회는 규모일 뿐이고, 목적에 따라 결과 칸의 숫자가 성과다.
- 플랫폼 화면에서 이미 보여 주니 필요 없다: 플랫폼이 둘 이상이고 보관 기간이 정해져 있으면, 직접 쌓아 두는 쪽이 비교와 장기 추세에 맞다.
- 자동 수집이면 숫자가 정확하다: 지연, 추정치, 정의 변경이 있어서 "대략 이 정도"로 읽는 게 맞다.

## 근거 링크

- YouTube Analytics API 지표 목록: https://developers.google.com/youtube/analytics/metrics
- Instagram Platform, Media Insights 레퍼런스: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights

← 개념 지도로 (#/post/ai-map)

관련 글: [콘텐츠 캘린더 자동화](#/post/mk-content-calendar) · [A/B 테스트](#/post/mk-ab-test) · [트렌드 수집](#/post/mk-trend-collect)
