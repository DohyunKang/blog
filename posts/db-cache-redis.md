캐시는 원본에서 읽어 오는 비싼 일을 줄이려고 복사본을 빠른 곳에 잠깐 두는 것이고, Redis는 그 복사본을 키-값으로 들고 있는 서버다. 어려운 건 넣는 쪽이 아니라 복사본이 원본과 달라졌을 때 처리하는 쪽이다.

## 쉬운 말로 먼저

책상 옆에 자주 보는 책을 꽂아 두는 것과 같다. 도서관(DB)까지 갈 필요가 없어서 빠르다. 대신 책 몇 권만 꽂을 수 있고, 도서관에서 개정판이 나오면 내 책은 옛날 판이 된다. 그래서 "얼마나 오래 둘지", "언제 치울지", "자리가 꽉 차면 뭘 버릴지"가 캐시의 전부라고 봐도 된다.

백엔드에서는 [요청이 처리되는 흐름](#/post/be-request-flow) 중 핸들러가 DB를 부르기 전에 캐시를 먼저 보게 만드는 식으로 쓴다. DB 쪽 속도는 [인덱스](#/post/db-index)로도 줄일 수 있는데, 인덱스는 DB 안에서 찾는 비용을 줄이고 캐시는 아예 DB에 가지 않게 한다는 점이 다르다.

## 캐시 안에 뭐가 들어 있나

키로 값을 찾는다. 값은 DB 조회 결과를 문자열(JSON 등)로 바꾼 것이 흔하다. 키는 `user:1`처럼 무엇을 담았는지 알 수 있게 짓는다. Azure 문서 예제도 `MyEntity:{id}` 꼴 키를 쓴다.

읽을 때 일어나는 일은 둘 중 하나다. 캐시에 있으면 hit, 없으면 miss다. 효과는 hit 비율에 달려 있다. Redis는 `INFO`의 `keyspace_hits`와 `keyspace_misses`로 비율을 계산하라고 안내한다. 대부분 요청이 miss면 캐시를 확인하고 채우는 수고가 오히려 손해라는 말도 Azure 문서에 있다.

## cache-aside

가장 흔한 전략이다. 캐시가 알아서 DB를 읽어 주는 게 아니라, 애플리케이션 코드가 직접 캐시와 DB를 오간다. Azure Architecture Center 설명은 세 단계다.

1. 캐시에서 읽어 본다.
2. 없으면(miss) DB에서 읽는다.
3. 읽은 값을 캐시에 넣고 돌려준다.

쓸 때는 DB를 고치고 해당 캐시 항목을 지운다(invalidate). 다음 읽기가 miss가 되면서 새 값이 채워진다.

비슷한 이름으로 read-through, write-through, write-behind가 있다. 캐시 시스템이 DB 읽기·쓰기를 대신해 주는 방식이다. cache-aside는 캐시가 그 기능을 안 줄 때 애플리케이션이 흉내 내는 쪽이라고 문서가 설명한다.

### 직접 돌려 본 것

Redis를 설치하지 않고, 같은 동작을 파이썬 딕셔너리와 가짜 시계로 만들어 돌렸다. TTL 만료는 "읽을 때 시각을 확인해서 지나갔으면 버리는" 방식이다.

```python
class Clock:
    def __init__(self): self.t = 0
    def now(self): return self.t

class Cache:
    def __init__(self, clock): self.d, self.c = {}, clock
    def get(self, k):
        v = self.d.get(k)
        if v and v[1] > self.c.now(): return v[0]
        self.d.pop(k, None)
        return None
    def set(self, k, val, ttl): self.d[k] = (val, self.c.now() + ttl)
    def delete(self, k): self.d.pop(k, None)

clock = Clock(); db = {1: "kim"}; db_reads = 0; cache = Cache(clock)

def read_user(uid):
    global db_reads
    v = cache.get(f"user:{uid}")
    if v is not None: return v
    db_reads += 1
    v = db[uid]
    cache.set(f"user:{uid}", v, ttl=60)
    return v

def update_user(uid, name):
    db[uid] = name                 # DB 먼저
    cache.delete(f"user:{uid}")    # 그다음 캐시 삭제
```

실행 결과는 이랬다.

| 상황 | 결과 |
|---|---|
| 같은 사용자를 5번 읽기 | DB 읽기 1번 |
| `update_user`로 수정한 뒤 읽기 | 새 값(lee), DB 읽기 누적 2번 |
| 캐시를 거치지 않고 DB만 바꾼 뒤, TTL 안에 읽기 | 옛 값(lee)이 나옴 |
| 61초 뒤 읽기 | 새 값(park), DB 읽기 누적 3번 |

세 번째 줄이 캐시의 약점을 그대로 보여 준다. 누군가 DB를 직접 고치면 TTL이 끝날 때까지 낡은 값이 나간다. Azure 문서도 cache-aside는 일관성을 보장하지 않으며 외부에서 DB를 바꾸면 항목이 다시 로드될 때까지 반영되지 않는다고 적는다.

<details>
<summary>순서를 거꾸로 하면 생기는 일</summary>

Azure 문서는 "DB를 먼저 고치고 그다음 캐시를 지우라"고 하고, 순서가 중요하다고 따로 적어 둔다. 캐시를 먼저 지우면 이런 일이 가능하다.

1. 쓰는 쪽이 캐시 항목을 지운다.
2. 그 틈에 다른 요청이 읽으러 와서 miss가 나고, DB에서 아직 옛 값을 읽는다.
3. 쓰는 쪽이 DB를 새 값으로 고친다.
4. 읽던 쪽이 옛 값을 캐시에 넣는다.

같은 순서를 코드로 돌려 보면 캐시에는 `old`, DB에는 `new`가 남았다. 이후 TTL이 끝날 때까지 낡은 값이 계속 나간다. 동시에 일어나는 일을 한 줄로 늘어놓은 시뮬레이션이라 실제 서버에서 얼마나 자주 생기는지는 모른다. 순서가 중요하다는 것만 확인했다.

</details>

## TTL

TTL은 "이 키는 몇 초 뒤에 지워라"는 값이다. Redis에서는 `EXPIRE key seconds`로 걸고 `TTL key`로 남은 시간을 본다. 공식 문서 예제에서 `SET mykey "Hello"` 후 `EXPIRE mykey 10`을 하면 `TTL`이 10으로 나온다.

알아 둘 것 몇 가지가 문서에 있다.

- `SET`으로 같은 키를 다시 쓰면 TTL이 사라진다(`TTL`이 -1, 만료 없음). 값을 갱신하면서 TTL을 유지하고 싶으면 다시 걸어야 한다.
- `INCR`, `LPUSH`, `HSET`처럼 값을 바꾸되 통째로 교체하지 않는 명령은 TTL을 건드리지 않는다.
- 만료는 두 가지로 처리된다. 접근했을 때 시간이 지났으면 지우는 방식(passive)이 있고, 접근이 없는 키를 위해 가끔 무작위로 몇 개를 골라 지우는 방식(active)이 있다. 위 파이썬 코드는 앞의 것만 흉내 낸 셈이다.
- 만료 시각은 절대 시각(유닉스 타임스탬프)으로 저장되고, 컴퓨터 시계가 갑자기 바뀌면 그에 맞춰 만료가 당겨진다.

TTL 길이는 정답이 없다. Azure 문서는 너무 짧으면 계속 DB를 읽게 되고, 너무 길면 낡은 데이터가 남는다고 한다. 자주 바뀌는지, 낡아도 괜찮은지로 정한다. 예제 코드는 기본 5분을 쓴다.

## 자리가 꽉 차면 (eviction)

캐시는 메모리가 한정이다. Redis는 `maxmemory`로 한도를 정하고, 넘으면 `maxmemory-policy`에 따라 키를 지운다. 64비트에서 `maxmemory` 기본값은 0이고, 0은 제한 없음이다.

| 정책 | 하는 일 |
|---|---|
| `noeviction` | 안 지운다. 새 데이터를 넣는 명령에 오류를 낸다. 읽기는 된다 |
| `allkeys-lru` | 가장 오래 안 쓴 키부터 지운다 |
| `allkeys-lfu` | 가장 적게 쓴 키부터 지운다 |
| `allkeys-random` | 아무거나 지운다 |
| `volatile-*` | TTL이 걸린 키만 대상으로 위 방식을 적용한다. `volatile-ttl`은 남은 시간이 짧은 키부터 지운다 |

공식 문서는 일부 키가 훨씬 자주 읽히는 흔한 경우라면 `allkeys-lru`가 무난한 기본이라고 권한다. `volatile-*` 정책은 TTL 걸린 키가 하나도 없으면 `noeviction`처럼 움직인다. 캐시용 데이터와 지워지면 안 되는 데이터를 한 인스턴스에 같이 둘 때 쓰는 정책인데, 문서는 가능하면 인스턴스를 나누라고 한다.

LRU는 정확한 계산이 아니라 키 몇 개를 무작위로 뽑아 그중 가장 오래된 걸 지우는 근사 방식이다. 문서 기준으로 `maxmemory-samples` 기본 예시는 5이고, 10으로 올리면 실제 LRU에 가까워진다.

## Redis 자료구조

Redis는 값에 문자열만 넣는 저장소가 아니라 자료구조 서버(data structure server)로 소개된다. 공식 문서가 꼽는 일반 목적 타입은 이렇다.

| 타입 | 문서 설명 | 어디에 쓰나 |
|---|---|---|
| String | 바이트 열. 가장 기본 | 캐시 값, 카운터 |
| Hash | 필드-값 쌍의 묶음, 딕셔너리와 비슷 | 객체 하나를 필드별로 |
| List | 삽입 순서대로 정렬된 문자열 | 최근 목록, 큐 |
| Set | 중복 없는 문자열 모음, 추가·삭제·확인이 원소 수와 무관하게 O(1) | 중복 제거, 태그 |
| Sorted set | 점수 순으로 정렬되는 중복 없는 문자열 | 순위표 |
| Stream | 추가만 되는 로그처럼 동작 | 이벤트 기록 |

이 밖에 JSON, 지오, 비트맵, HyperLogLog 같은 것들도 있다. 캐시 용도로는 String 하나로 대부분 해결되고, 자료구조가 의미 있어지는 건 캐시 말고도 Redis를 다른 용도로 쓸 때다. 예를 들어 EXPIRE 문서에는 사용자 페이지 방문을 List에 `RPUSH`하고 `EXPIRE ... 60`을 거는 "탐색 세션" 패턴이 소개돼 있다. 60초 넘게 쉬면 키가 사라져 새 세션이 된다.

DB 종류 속에서 Redis가 어디쯤인지는 [NoSQL 종류와 선택](#/post/db-nosql)에서 이어서 본다.

## 흔한 오해

캐시를 쓰면 무조건 빨라진다고 생각하기 쉽다. hit 비율이 낮으면 이득이 없다. 한 번만 읽고 마는 데이터, 계속 바뀌는 데이터는 캐시와 안 맞는다.

TTL이 있으니 일관성 문제는 알아서 풀린다는 생각도 있다. TTL은 낡은 값이 영원히 남지 않게 하는 안전망이고, 그 시간 동안은 낡은 값이 나간다. 수정 직후 바로 최신 값이 필요한 화면이면 cache-aside 말고 write-through를 검토하라고 Azure 문서가 적는다.

민감한 데이터를 캐시에 둬도 된다는 오해도 있다. 여러 사용자나 앱이 캐시를 공유하면 부적절할 수 있어서, 보안 관련 데이터는 원본에서 직접 가져오라는 게 같은 문서의 권고다.

캐시가 죽으면 서비스도 죽는다고 단정할 수도 없다. 캐시를 먼저 보고 miss 때처럼 DB로 가게 짜 두면 느려질 뿐 동작은 한다고 문서가 말한다. 다만 그때 DB가 몰린 요청을 견디는지는 따로 봐야 한다. DB 자체를 여러 대로 늘리는 이야기는 [복제와 샤딩](#/post/db-scaling)에서 다루고, 웹 앞단의 캐시는 [CDN과 캐싱 계층](#/post/infra-cdn-cache)에서 다룬다.

---

← [데이터베이스 지도로](#/post/db-map)

관련 글: [인덱스](#/post/db-index) · [NoSQL 종류와 선택](#/post/db-nosql) · [CDN과 캐싱 계층](#/post/infra-cdn-cache)

## 근거 링크

- [Cache-Aside Pattern, Azure Architecture Center (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis data types (redis.io)](https://redis.io/docs/latest/develop/data-types/)
- [Key eviction (redis.io)](https://redis.io/docs/latest/develop/reference/eviction/)
- [EXPIRE (redis.io)](https://redis.io/docs/latest/commands/expire/)

