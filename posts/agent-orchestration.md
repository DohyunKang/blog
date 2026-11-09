멀티에이전트 오케스트레이션은 여러 LLM 호출(에이전트)이 각자 일을 맡고, 그 순서와 결과의 합치기를 누군가 조율하는 구조다. [서브에이전트](#/post/ai-subagent) 글이 "왜 나누나"였다면, 이 글은 나눈 뒤에 무엇을 정해야 하는지를 다섯 가지로 정리했다. 누가 나누나, 병렬이냐 순차냐, 상태는 어디에 두나, 실패하면 어떻게 하나, 비용은 어떻게 막나.

## 먼저 용어: 워크플로우와 에이전트

Anthropic의 "Building effective agents"는 둘을 이렇게 나눈다. 워크플로우는 LLM과 도구가 "미리 정해진 코드 경로"로 조율되는 시스템이고, 에이전트는 LLM이 "스스로 자기 과정과 도구 사용을 지휘하는" 시스템이다. 오케스트레이션은 이 두 가지 방식 어디에든 나온다. OpenAI Agents SDK 문서도 같은 구분을 한다. 오케스트레이션을 LLM이 계획하고 결정하게 하는 방식과, 코드로 흐름을 정하는 방식으로 나누고, 코드로 정하면 속도·비용·성능이 더 결정적이고 예측 가능해진다고 한다. 둘은 섞어 쓸 수 있다고 한다.

이 구분이 뒤의 모든 선택에 걸린다. 사람이 흐름을 미리 아는 일이면 코드로 짜고, 입력을 봐야 나눌 수 있는 일이면 모델에게 나누게 한다.

## 1. 누가 나누나: 세 가지 모양

| 패턴 | 나누는 주체 | 예 |
|---|---|---|
| 체이닝 | 코드(순서 고정) | 조사 → 개요 → 초안 → 비평 → 수정 |
| 병렬화 | 코드(조각 고정) | 섹션별로 동시에, 같은 일을 여러 번 돌려 투표 |
| 오케스트레이터-워커 | 중앙 LLM | 입력을 보고 하위 작업을 그때 결정, 결과를 종합 |

Anthropic 글의 정의로 오케스트레이터-워커는 "중앙 LLM이 작업을 동적으로 쪼개 워커 LLM에게 맡기고 결과를 종합"하는 것이고, 병렬화와 달리 하위 작업이 미리 정의되지 않고 입력에 따라 오케스트레이터가 정한다. 체이닝은 각 호출이 앞 호출의 출력을 처리하며, 지연을 내주고 정확도를 얻는 선택이다. OpenAI 문서의 체이닝 예(조사→개요→초안→비평→수정)도 같은 모양이다. 이 외에 평가자가 통과시킬 때까지 도는 피드백 루프도 코드 패턴으로 소개한다.

## 2. 병렬이냐 순차냐

독립적인 조각은 병렬이 빠르다. Claude Agent SDK 문서는 병렬 서브에이전트가 "모든 일의 합이 아니라 가장 느린 것의 시간"에 끝난다고 설명한다. Anthropic의 멀티에이전트 리서치 시스템 글은 리드 에이전트가 서브에이전트 3~5개를 병렬로 띄우고, 각 서브에이전트도 도구 3개 이상을 병렬로 써서 복잡한 질의의 조사 시간이 최대 90% 줄었다고 쓴다. 이 수치는 글에 쓰인 값이고 내가 재현한 것은 아니다.

반대로 앞 결과가 뒤 입력이 되는 일은 순차다. 병렬로 돌릴 수 있는지는 "한 조각이 다른 조각의 결과를 필요로 하는가"로 갈린다. 같은 글은 모든 에이전트가 같은 컨텍스트를 공유해야 하거나 에이전트끼리 의존이 많은 일은 지금 구조와 잘 안 맞는다고 하고, 대부분의 코딩 작업은 리서치보다 병렬로 쪼갤 부분이 적다고 한다.

OpenAI 문서는 코드 쪽 병렬로 `asyncio.gather` 같은 파이썬 기본 도구를 든다. 별도 프레임워크 없이도 독립 호출은 동시에 돌릴 수 있다는 얘기다.

## 3. 상태는 어디에 두나

여러 에이전트가 도는데 서로의 대화를 공유하지 않으면 정보가 오가는 통로가 필요하다. 방식은 크게 둘이다.

- 메시지만 전달: Claude Agent SDK 문서에 따르면 서브에이전트는 새 컨텍스트로 시작하고, 부모가 넘기는 건 Agent 도구의 프롬프트 문자열뿐이다. 서브에이전트 안에서 일어난 도구 호출과 결과는 안에 남고, 부모에게는 최종 메시지만 돌아간다. 그래서 필요한 파일 경로·오류 메시지·결정을 프롬프트에 직접 적어야 한다.
- 공유 상태 객체: LangGraph는 노드들이 읽고 쓰는 공유 데이터를 State로 두고, 키마다 reducer가 업데이트를 합친다. 기본 reducer는 값을 덮어쓰고, `Annotated[list[str], operator.add]`처럼 reducer를 지정하면 병렬 노드의 결과가 리스트에 이어 붙는다.

Anthropic의 리서치 시스템 글은 또 다른 이유로 외부 저장을 쓴다. 컨텍스트 윈도우가 200,000 토큰을 넘으면 잘리니까 리드 에이전트가 계획을 외부 메모리에 저장하고, 한계에 가까워지면 깨끗한 컨텍스트로 새 서브에이전트를 띄워 저장된 메모리와 핸드오프로 이어 간다. [컴팩션](#/post/ai-compaction)이나 [세션](#/post/ai-session) 글에서 본 문제를 에이전트 사이로 옮긴 모양이다.

LangGraph에서 병렬 팬아웃은 `Send`로 한다. 런타임에야 개수를 아는 항목마다 같은 노드를 따로 입력으로 호출하고, 결과는 reducer로 합친다.

```python
def fan_out(state):
    return [Send("worker", {"task": t}) for t in state["tasks"]]

graph.add_conditional_edges("planner", fan_out)
```

이 코드는 문서의 map-reduce 예를 줄여 쓴 것이고 LangGraph를 설치해 실행해 보지는 않았다.

## 4. 실패하면 어떻게 하나

에이전트가 많아지면 어느 하나는 반드시 실패한다. 문서들이 말하는 대응을 모으면 이렇다.

| 상황 | 대응 | 출처 |
|---|---|---|
| 일시적 오류 | 재시도, 정기 체크포인트, 중단된 지점에서 재개 | Anthropic 리서치 시스템 글 |
| 노드 재실행 | 노드가 체크포인트·재시도 경계라서 처음부터 다시 돈다. 부작용은 멱등하게 | LangGraph 문서 |
| 서브에이전트 중단 | maxTurns에 걸리면 결과를 "부분"으로 표시, 같은 에이전트를 resume해서 이어 가기 | Claude Agent SDK 문서 |
| 무한 루프 | recursion limit(super-step 수 상한), 초과하면 `GraphRecursionError` | LangGraph 문서 |

Claude Agent SDK 문서에는 API 오류로 서브에이전트가 일찍 끝나면 그 오류가 결과로 전달되지 않는다는 문장도 있다. 부모가 "성공한 빈 결과"로 오해하지 않도록 오류와 결과를 구분하는 설계라고 읽었다.

실패를 코드로 다루는 쪽은 이런 모양이 된다. 가짜 워커(LLM 호출 대신 무작위로 실패하는 함수)로 동시 실행 제한, 타임아웃, 재시도, 토큰 예산을 한 번에 넣어 봤다.

```python
import asyncio, random

random.seed(1)
MAX_TOKENS = 3000
state = {"results": {}, "failed": [], "tokens": 0}   # 오케스트레이터만 쓰는 공유 상태

async def worker(task):
    """LLM 호출 자리. 가짜: 가끔 실패하고 토큰을 쓴다."""
    await asyncio.sleep(0.01)
    if random.random() < 0.3:
        raise RuntimeError("rate limit")
    return f"{task}: summary", 500

async def run_worker(task, sem, retries=2):
    async with sem:                                   # 동시 실행 수 제한
        for attempt in range(retries + 1):
            if state["tokens"] >= MAX_TOKENS:          # 예산 초과면 새 호출 안 함
                state["failed"].append((task, "budget"))
                return
            try:
                text, used = await asyncio.wait_for(worker(task), timeout=5)
                state["tokens"] += used
                state["results"][task] = text
                return
            except Exception as e:
                if attempt == retries:
                    state["failed"].append((task, str(e)))

async def orchestrate(question):
    subtasks = [f"{question}/part{i}" for i in range(1, 7)]   # 실제로는 모델이 쪼갠다
    sem = asyncio.Semaphore(3)
    await asyncio.gather(*(run_worker(t, sem) for t in subtasks))
    return state

s = asyncio.run(orchestrate("q"))
print("done:", len(s["results"]), "failed:", s["failed"], "tokens:", s["tokens"])
```

이 코드를 파이썬으로 직접 실행했다. 실패 확률 0.3일 때는 `done: 6 failed: [] tokens: 3000`이 나왔다. 확률을 0.5로 올리니 `done: 5 failed: [('q/part5', 'rate limit')] tokens: 2500`처럼, 재시도를 다 써도 실패한 조각이 `failed`에 남고 나머지 결과는 유지됐다. 하나가 실패해도 전체를 버리지 않고 "된 것과 안 된 것"을 구분해서 돌려주는 모양이다. 실제 API 호출이 아니라서 비용이나 지연은 이 실행으로 알 수 없다. 동시 호출 중에는 예산 확인과 사용량 기록 사이에 틈이 있어서 상한을 조금 넘을 수 있다.

## 5. 비용: 가장 먼저 막아야 하는 것

Anthropic 글에 따르면 에이전트는 채팅보다 토큰을 약 4배, 멀티에이전트는 약 15배 쓴다. 같은 글에서 리드가 Claude Opus 4, 서브에이전트가 Claude Sonnet 4인 구성이 단일 Opus 4보다 내부 리서치 평가에서 90.2% 좋았다고 한다. 성능과 비용이 같이 늘어난다는 뜻이다. AI 기능에서 고객 한 명이 쓰는 호출이 곱절이 되면 [원가](#/post/app-cost)도 그렇게 된다.

문서들이 주는 비용 통제 수단은 이렇다.

- 규모를 프롬프트에 박기: Anthropic은 초기 에이전트가 단순 질문에도 서브에이전트를 과하게 띄워서, 단순 조사는 에이전트 1개에 도구 호출 3~10번, 직접 비교는 서브에이전트 2~4개, 복잡한 조사는 10개 이상이라는 규칙을 넣었다고 한다.
- 하드 상한: Claude Agent SDK 문서는 중첩 깊이(기본 3단계), 동시 서브에이전트 수(기본 20), 쿼리 지출 상한(`maxBudgetUsd` / `max_budget_usd`)을 정할 수 있다고 한다. 지출 상한에 닿으면 새 서브에이전트를 거부하고, 돌고 있는 백그라운드 서브에이전트를 멈추고, 쿼리를 `error_max_budget_usd`로 끝낸다. 서브에이전트가 자기 서브에이전트를 만들 수 있어서 프롬프트 하나가 에이전트 트리로 커질 수 있다는 설명이 이 옵션의 이유다.
- 서브에이전트마다 모델 지정: 같은 문서의 `model` 필드로 조사처럼 가벼운 일은 작은 모델에 맡길 수 있다.
- 일 자체를 줄이기: 이 한도는 안전장치이고, 가장 싼 건 에이전트를 안 쓰는 것이다. Anthropic은 "가능한 가장 단순한 해법을 찾고 필요할 때만 복잡도를 높이라"고 권한다. 프레임워크가 프롬프트를 가리는 추가 추상층을 만들 수 있다는 경고도 적는다. 설계 순서는 [에이전트 설계 패턴](#/post/app-agent-design)에 있다.

<details>
<summary>자세한 풀이: Handoff와 agents-as-tools</summary>

OpenAI Agents SDK 문서는 두 위임 방식을 구분한다. agents-as-tools는 매니저 에이전트가 대화의 통제권을 갖고, 전문 에이전트는 "한정된 하위 작업"을 돕되 사용자와의 대화를 넘겨받지 않는다. handoff는 선택된 전문 에이전트가 그 턴의 나머지를 "소유"한다. 둘을 섞어서, handoff로 넘어간 전문 에이전트가 좁은 하위 작업에는 다른 에이전트를 도구로 부르게 할 수도 있다고 한다. 이 구분은 "상태를 누가 쥐고 있나"의 다른 표현이다. 매니저가 쥐면 도구, 넘기면 handoff다.

</details>

<details>
<summary>자세한 풀이: 서브에이전트에 넘기는 프롬프트가 전부다</summary>

Claude Agent SDK 문서의 표에 따르면 서브에이전트는 자기 시스템 프롬프트, Agent 도구의 프롬프트, 프로젝트 CLAUDE.md, 도구 정의를 받는다. 부모의 대화 기록과 도구 결과, 부모의 시스템 프롬프트는 받지 않는다. 포크(fork)는 예외로 지금까지의 대화를 복사해서 시작한다. 결과도 최종 메시지 하나만 돌아오고, 부모가 이를 요약해서 사용자에게 말할 수 있어서 원문 그대로 전달하려면 지시를 넣어야 한다고 문서가 적는다. 그래서 위임 프롬프트에 목표·출력 형식·범위를 정확히 쓰는 일이 오케스트레이션 품질의 큰 부분이다.
</details>

<details>
<summary>자세한 풀이: 이 글에서 직접 확인한 것과 못 한 것</summary>

파이썬 코드는 위 가짜 워커 버전을 직접 실행했다(결과는 본문). LangGraph, OpenAI Agents SDK, Claude Agent SDK의 코드는 설치·실행하지 않았고 공식 문서의 설명과 예를 읽은 것이다. 수치(15배, 90.2%, 90% 단축, 기본 깊이 3·동시 20)는 모두 해당 공식 글·문서에 적힌 값이고, 내가 측정하지 않았다. 문서 버전에 따라 기본값이 달라질 수 있다고 Claude Agent SDK 문서도 적는다.

</details>

## 흔한 오해

- 에이전트를 많이 붙일수록 좋다: 비용이 약 15배 수준으로 늘 수 있고, 의존이 많은 일은 잘 안 맞는다고 Anthropic 글도 적는다.
- 오케스트레이터가 모든 걸 알고 있다: 서브에이전트는 부모의 대화를 못 보고 넘긴 프롬프트만 받는다.
- 실패는 재시도하면 된다: 재시도는 비용을 또 쓴다. 횟수와 예산 상한이 같이 있어야 한다.
- 프레임워크를 쓰면 오케스트레이션이 해결된다: 프레임워크는 상태·재시도 틀을 줄 뿐 무엇을 나눌지는 설계자가 정한다. Anthropic은 오히려 추상층이 프롬프트를 가릴 수 있다고 경고한다.

## 마무리

다섯 가지(누가 나누나, 병렬/순차, 상태, 실패, 비용)를 각 프레임워크가 어떻게 다루는지 대응시켜 보니 이름만 다르고 질문은 같았다. 모델을 하나 더 붙이기 전에 일을 코드로 고정 가능한지부터 따져 보는 순서가 맞아 보인다.

[자세히 → 에이전트 설계 패턴](#/post/app-agent-design) · [자세히 → 에이전트와 에이전트 루프](#/post/ai-agent-loop) · [자세히 → AI 서비스 원가 구조](#/post/app-cost)

← [LLM 앱 만들기 지도로](#/post/app-map)

관련 글: [서브에이전트와 멀티에이전트](#/post/ai-subagent) · [도구 호출](#/post/ai-tool-use) · [컨텍스트](#/post/ai-context)

## 근거 링크

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Agent SDK 문서, Subagents: https://code.claude.com/docs/en/agent-sdk/subagents
- OpenAI Agents SDK 문서, Agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/
- LangGraph 문서, Graph API: https://docs.langchain.com/oss/python/langgraph/graph-api
