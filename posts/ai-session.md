LLM은 지난 대화를 기억하지 못하고, 기억하는 것처럼 보이는 건 앱이 매 호출마다 지금까지의 기록을 통째로 다시 보내서다.

## 쉬운 말로

ChatGPT나 Claude 앱에서 이어서 말하면 앞에서 한 얘기를 알고 답한다. 그래서 모델 안에 대화가 저장돼 있다고 생각하기 쉬운데, API 문서를 보면 반대다. Anthropic의 Messages API 문서는 이 API를 "stateless multi-turn conversations", 즉 상태를 저장하지 않는 다회 대화에 쓸 수 있다고 적는다. OpenAI 문서도 텍스트 생성 요청은 각각 독립적이고 상태가 없다고 한다.

상태가 없다는 말은, 요청 하나가 끝나면 서버가 그 대화를 들고 있지 않는다는 뜻이다. 다음 요청에 앞부분을 같이 보내야 모델이 안다. 모델 입장에서는 매번 처음 보는 사람이고, 앞부분이 적힌 쪽지를 받아서 읽는 것에 가깝다.

## 용어부터

- 메시지: 한 번의 발화. 보통 role(user, assistant)과 내용으로 이루어진다.
- 대화 기록(history): 지금까지의 메시지 목록. API에서는 `messages` 배열로 보낸다.
- 턴: 사용자 한 번, 모델 한 번을 묶은 단위.
- 세션: 같은 대화로 묶이는 한 덩어리. 이 글에서는 앱이 같은 기록을 이어서 쓰는 범위로 쓴다. 공식 용어로 정해진 정의는 아니고 제품마다 뜻이 조금 다르다.
- 컨텍스트: 모델이 한 번에 보는 입력 전체. 기록은 그 일부다. [자세히 → 컨텍스트](#/post/ai-context)

## 원리: 매번 기록을 다시 보낸다

Anthropic 문서에 나온 예시는 이렇다. 새 메시지를 만들 때 이전 턴들을 `messages`에 넣어 보내면, 모델이 다음 메시지를 만든다.

```json
[
  {"role": "user", "content": "Hello there."},
  {"role": "assistant", "content": "Hi, I'm Claude. How can I help you?"},
  {"role": "user", "content": "Can you explain LLMs in plain English?"}
]
```

세 번째 요청을 보낼 때 앞의 두 줄도 같이 간다. 모델이 쓴 답(assistant)도 앱이 받아서 보관했다가 다시 보내야 한다. 앱이 하는 일을 순서로 쓰면 이렇다.

| 순서 | 하는 일 | 누가 |
|---|---|---|
| 1 | 사용자 입력을 기록 끝에 붙인다 | 앱 |
| 2 | 기록 전체를 API로 보낸다 | 앱 |
| 3 | 답을 생성한다 | 모델 |
| 4 | 받은 답을 기록 끝에 붙여 저장한다 | 앱 |

모델은 3번만 한다. 1, 2, 4번과 어디에 저장할지는 전부 앱 쪽 일이다. 그래서 같은 모델인데도 앱마다 기억하는 방식이 다르다.

## 직접 돌려 본 것

진짜 모델 대신, 받은 메시지만 보고 답하는 가짜 함수로 구조만 흉내 냈다. 이 코드는 python으로 직접 실행해서 아래 결과가 나오는 걸 확인했다.

```python
def fake_llm(messages):
    names = [m["content"].split("이름은 ")[1].split("야")[0]
             for m in messages if m["role"] == "user" and "이름은 " in m["content"]]
    last = messages[-1]["content"]
    if "뭐라고" in last:
        return names[-1] if names else "모르겠다"
    return "응"

history = []
def chat(text, keep=True):
    msgs = (history if keep else []) + [{"role": "user", "content": text}]
    reply = fake_llm(msgs)
    if keep:
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": reply})
    return reply, len(msgs)

print(chat("내 이름은 도현이야"))            # ('응', 1)
print(chat("내 이름 뭐라고 했지?"))          # ('도현이', 3)
print(chat("내 이름 뭐라고 했지?", keep=False))  # ('모르겠다', 1)
```

같은 질문인데 기록을 같이 보내면 "도현이", 안 보내면 "모르겠다"가 나온다. 모델이 똑똑해진 게 아니라 입력이 달라진 것이다. 이건 구조를 보여 주려고 만든 장난감이고, 실제 모델이 어떻게 답하는지와는 상관없다.

## 비용과 한계가 여기서 나온다

기록을 매번 다 보내니 생기는 일이 둘 있다.

첫째, 대화가 길수록 요청 하나의 입력 토큰이 늘어난다. OpenAI 문서에는 `previous_response_id`로 이전 응답을 이어 붙여도 비용이 줄지 않는다고 나온다. 체인에 있는 이전 입력 토큰이 전부 입력으로 청구된다는 설명이다. 앱이 기록을 직접 들든 서버가 대신 들어 주든, 모델이 읽는 양은 같다는 얘기다. 열 턴째 요청은 앞 아홉 턴을 또 읽는다.

둘째, 컨텍스트 윈도우에는 상한이 있다. OpenAI 문서는 컨텍스트 윈도우를 한 요청에서 쓸 수 있는 최대 토큰 수라고 하고, 입력·출력·추론 토큰을 다 합친다고 한다. 넘으면 잘릴 수 있다. 그래서 기록이 길어지면 앞부분을 요약하거나 버려야 한다. 이건 다음 글로 이어진다. [자세히 → 컴팩션과 메모리](#/post/ai-compaction)

비용을 줄이는 쪽으로는 반복되는 앞부분을 캐시하는 방법이 있다. 이건 따로 정리했다. [자세히 → 프롬프트 캐싱](#/post/ai-prompt-caching)

## 서버가 기록을 들어 주는 방식도 있다

기록 보관을 앱이 아니라 API 쪽에 맡기는 선택지가 생겼다. OpenAI 문서 기준으로 세 가지다.

| 방식 | 기록을 들고 있는 곳 | 메모 |
|---|---|---|
| 직접 보내기 | 내 앱 | 가장 기본. 뭘 보낼지 내가 고른다 |
| `previous_response_id` | OpenAI 서버 | 이전 응답 ID를 넘겨 이어 간다. 기본 30일 보관, `store`를 false로 끄면 보관 안 함 |
| Conversations API | OpenAI 서버 | 고유 ID를 가진 대화 객체로 오래 유지. 30일 제한을 받지 않는다고 문서에 있다 |

서버가 들어 주면 코드는 편해지지만, 무엇이 모델에 들어가는지 내가 직접 다루기 어려워진다. Anthropic 쪽에서 이 방식의 같은 기능이 있는지는 이번에 확인하지 못했다.

## 세션과 장기 기억은 다르다

기록은 한 대화 안에서만 이어진다. 새 대화를 열면 새 기록이라 앞 대화를 모른다. 그런데 앱은 가끔 지난 대화를 아는 듯이 군다. 이건 보통 기록과는 다른 저장소를 쓴 것이다.

Anthropic의 memory tool 문서가 한 예다. 이 도구는 대화와 대화 사이에 정보를 파일로 저장하고 다시 읽게 한다. 중요한 점은 저장이 클라이언트 쪽이라는 것이다. 문서 표현으로 Claude는 파일 작업을 요청만 하고, 실행은 내 애플리케이션이 하며, 데이터는 내가 정한 저장소(디렉터리, DB 등)에 있다. 모델 안에 쌓이는 게 아니다.

| | 대화 기록 | 장기 기억(memory tool 같은 것) |
|---|---|---|
| 범위 | 한 세션 | 여러 세션 |
| 어디에 | 매 요청의 입력 안 | 바깥 저장소, 필요할 때 읽어 입력에 올림 |
| 보내는 양 | 전부 | 필요한 것만 |
| 누가 관리 | 앱 | 앱(모델이 읽고 쓸 파일 작업을 요청) |

문서에서 눈에 띈 건 이 도구가 켜져 있으면 시스템 프롬프트에 "작업 전에 항상 memory 디렉터리를 먼저 보라"는 지시가 자동으로 붙는다는 점이다. 컨텍스트가 언제든 초기화될 수 있다고 가정하고, 진행 상황을 파일에 적어 두라는 내용이다. 세션이 끊겨도 이어 가게 하는 장치다. [자세히 → 컨텍스트 윈도우](#/post/ai-context-window)

## 흔한 오해

- 모델이 대화를 기억한다: 기억하는 건 앱이 보내 준 기록이다. 안 보내면 모른다.
- 새 대화에서도 나를 안다면 모델이 학습한 거다: 보통은 별도 저장소의 내용을 입력에 넣은 것이다. 제품마다 방식이 달라서, 특정 앱이 어떻게 하는지는 공개된 설명이 있어야 안다.
- 서버가 기록을 들어 주면 공짜다: 위에서 봤듯 이전 토큰도 입력으로 청구된다고 OpenAI 문서에 나온다.
- 기록이 길면 길수록 좋다: 윈도우 상한이 있고, 길다고 잘 쓰는 것도 아니다.
- 세션 ID가 있으니 모델에 상태가 있다: ID는 서버가 기록을 찾는 열쇠일 뿐이고, 요청마다 모델이 읽는 건 결국 입력 토큰이다.

<details>
<summary>자세한 풀이: 앱 쪽에서 세션을 만든다면</summary>

직접 구현할 때 고려할 것을 정리하면 이렇다.

- 세션 ID를 만들어 두고, ID별로 messages 배열을 저장한다(메모리, DB 등).
- 요청마다 배열 끝에 사용자 입력을 붙이고, 응답을 받으면 assistant 메시지도 붙인다. 도구를 쓰면 도구 요청과 결과도 같이 붙는다.
- 배열이 길어지면 오래된 부분을 요약하거나 자른다. 뭘 남길지가 설계다.
- 사용자별 데이터가 섞이지 않게 세션 ID와 사용자를 묶어 둔다. 기록에 개인정보가 들어가면 보관 기간도 정해야 한다.

OpenAI 문서는 추론 모델을 쓸 때 응답의 `output` 배열을 통째로 다시 넣으라고 권한다. 추론 항목 같은 것이 끊기지 않게 하려는 것이다. 즉 "assistant 문장만 저장"하면 안 되는 경우가 있다. Anthropic 쪽 비슷한 규칙은 이번에 확인하지 못했다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: Messages API가 stateless multi-turn에 쓰인다는 설명과 messages 예시(Anthropic API 문서). OpenAI의 stateless 설명, previous_response_id, Conversations API, 컨텍스트 윈도우 정의, 체인된 입력 토큰도 청구된다는 설명(OpenAI 문서). memory tool이 클라이언트 쪽 저장이라는 점과 자동으로 붙는 시스템 프롬프트(Anthropic 문서). 위 가짜 함수 코드의 실행 결과.

확인 못 함: Anthropic 쪽에 서버가 대화를 들어 주는 기능이 있는지. ChatGPT·Claude 앱이 "나를 기억한다"는 기능을 내부에서 어떻게 구현하는지. Anthropic Messages API 문서는 매우 길어서 앞부분만 읽었다. 실제 API 호출은 직접 해 보지 않았다(코드는 가짜 함수로만 실행).

</details>

## 근거 링크

- Anthropic, Messages API: https://platform.claude.com/docs/en/api/messages
- Anthropic, Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- OpenAI, Conversation state: https://developers.openai.com/api/docs/guides/conversation-state

← [개념 지도로](#/post/ai-map)

관련 글: [컴팩션과 메모리](#/post/ai-compaction) · [컨텍스트와 컨텍스트 엔지니어링](#/post/ai-context) · [프롬프트 캐싱](#/post/ai-prompt-caching)
