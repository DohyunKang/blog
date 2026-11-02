# simonw/llm 소스 읽기: 플러그인 몇 개와 for 루프 하나로 돌아가는 LLM CLI

한 줄 요약: 모델 호출은 `Model.execute()` 하나로 뭉뚱그리고, 나머지는 pluggy 플러그인과 `while` 루프로 붙여 둔 구조였다.

## 이 레포가 뭔지

simonw(Simon Willison)가 만든 LLM 호출용 CLI이자 파이썬 라이브러리다. 확인한 시점(2026-11-02)에 별이 약 1만 2천 개였고 라이선스는 Apache-2.0, 마지막 push는 10월 30일이었다. `llm "질문"`을 치면 모델이 답하고, 그 기록이 SQLite에 쌓인다. 모델 종류(OpenAI, 로컬 모델 등)는 플러그인으로 늘린다.

작은 코어라는 말에 끌려 골랐는데, 막상 열어 보니 `llm/models.py`가 3,700줄, `llm/cli.py`가 크기로 147KB였다. 줄 수로 작지는 않았다. 다만 파일 종류가 적고 역할이 갈려 있어서 읽을 만했다.

## 디렉터리 구조

`llm/` 아래만 봤다. (tests, docs는 열어 보지 않았다.)

- `__init__.py`: 모델 찾기(`get_model`), 키 찾기(`get_key`), 별칭, 기본 모델 같은 공용 함수
- `models.py`: 핵심. `Prompt`, `Response`, `Conversation`, `ChainResponse`, `Model`/`KeyModel`, `Tool`, `Toolbox`
- `cli.py`: click 기반 명령들
- `hookspecs.py`: 플러그인이 끼어들 수 있는 자리 6곳
- `plugins.py`: 플러그인을 불러오는 코드
- `default_plugins/`: 기본 탑재 플러그인. `openai_models.py`(3,100줄), `default_tools.py`
- `logs.py`, `migrations.py`: SQLite 로그 저장
- `embeddings.py`, `templates.py`, `parts.py`, `serialization.py`, `utils.py` 등

작은 파일은 정말 작다. `errors.py`는 예외 세 개(`ModelError`, `NeedsKeyException`, `ConversationNotSupported`)가 전부였다.

## 핵심 흐름

`llm "hi"`를 쳤을 때를 따라가 봤다. cli.py의 `prompt()` 함수가 출발점이고, 큰 흐름은 이랬다.

1. 플러그인 로드. `plugins.py`의 `load_plugins()`가 setuptools entry point(그룹 이름 "llm")로 설치된 플러그인을 `pm.load_setuptools_entrypoints("llm")`로 부른다. 그다음 `DEFAULT_PLUGINS`에 적힌 두 개(openai_models, default_tools)를 import해서 등록한다.
2. 모델 찾기. `get_model(name)`이 `get_model_aliases()`에서 이름을 찾는다. 이 목록은 `get_models_with_aliases()`가 `pm.hook.register_models`를 호출해서 플러그인들이 `register(model, aliases=...)`로 넣은 것들이다. 사용자 별칭은 `user_dir()/aliases.json`에서 읽어 얹는다. 이름을 안 주면 `get_default_model()`이 `default_model.txt`를 읽고, 없으면 `DEFAULT_MODEL`을 쓴다(지금 코드엔 `"gpt-6-luna"`라고 적혀 있었다).
3. 키 찾기. `get_key()`는 순서가 정해져 있다. 명령줄로 준 값(또는 `keys.json`의 별칭) → `keys.json`에 저장된 키 → 환경변수.
4. 프롬프트 객체 만들기. `Model.prompt()`가 인자들을 `Prompt`에 담아 `Response`를 돌려준다. 이 시점엔 아직 호출 전이다.
5. 실제 호출은 늦게. `Response.__iter__`를 돌리거나 `.text()`를 부를 때 `_force()`가 `list(self)`로 돌려서 그때서야 `_iter_events()`가 `model.execute()`를 부른다.
6. 도구 호출이 있으면 루프. `ChainResponse.responses()`가 응답마다 `execute_tool_calls()`를 해서 결과를 다음 `Prompt`에 실어 다시 모델을 부른다. 도구 호출이 더 없으면 끝.
7. 끝나면 `_on_done()`이 불려서 `log_to_db()`가 `LogStore(db).log(self)`로 SQLite에 저장한다.

### 코드 발췌 1: 호출은 `execute()` 하나로

```python
class KeyModel(_Model):
    @abstractmethod
    def execute(self, prompt, stream, response, conversation, key):
        ...
```

모델 플러그인이 구현할 건 이 메서드다. 문자열(또는 `StreamEvent`)을 하나씩 `yield`하면 된다. OpenAI 쪽 `Chat.execute`(openai_models.py)를 보니 `client.chat.completions.create(..., stream=True)`를 돌면서 델타 텍스트와 tool call 조각을 `yield`했다. tool call 인자는 스트리밍으로 조각조각 오기 때문에 `tool_calls[idx].function.arguments += ...`로 이어 붙이고 있었다.

### 코드 발췌 2: 에이전트 루프의 정체

```python
current_response = initial_response
while current_response:
    count += 1
    yield current_response
    if self.chain_limit and count >= self.chain_limit and current_response.tool_calls():
        raise ValueError(f"Chain limit of {self.chain_limit} exceeded.")
    tool_results = current_response.execute_tool_calls(...)
    if tool_results:
        current_response = Response(Prompt("", self.model, tools=..., tool_results=tool_results, messages=next_chain, ...), ...)
    else:
        current_response = None
        break
```

(models.py `ChainResponse.responses()`, 중간을 줄여서 옮겼다.) 에이전트라고 부르는 게 이 `while` 하나였다. 응답에 tool call이 있으면 실행해서 결과를 붙여 다시 부르고, 없으면 멈춘다. 무한 루프를 막는 건 `chain_limit` 하나뿐이다.

### 코드 발췌 3: 도구 실행의 예외 처리

```python
try:
    result = tool.implementation(**implementation_arguments)
    ...
except PauseChain as ex:
    raise
except Exception as ex:
    result = f"Error: {ex}"
    exception = ex
```

도구가 터져도 프로그램이 죽지 않고 `"Error: ..."` 문자열이 결과로 모델에게 간다. 모델이 에러를 보고 다시 시도할 수 있게 하려는 것 같았다(의도는 코드에 주석이 없어서 내 추측). 없는 도구 이름을 부르면 `'tool "x" does not exist'` 에러 결과를 만들어 준다. 반대로 `PauseChain`은 에러로 바꾸지 않고 밖으로 올려서, 사람 확인 같은 걸 받고 나중에 이어 가게 한다.

## 플러그인 구조

`hookspecs.py`는 30줄 정도인데 확장 지점이 다 여기 있다.

- `register_commands(cli)`
- `register_models(register, model_aliases)`
- `register_embedding_models(register)`
- `register_template_loaders(register)`
- `register_fragment_loaders(register)`
- `register_tools(register)`

내장 기능도 같은 방식이다. `default_tools.py`는 `@llm.hookimpl`을 붙인 `register_tools`에서 `register(llm_version)`, `register(llm_time)`을 부르는 게 전부다. 함수 하나를 도구로 만드는 건 `Tool.function()`이었다. 함수 이름이 도구 이름, docstring이 설명, 시그니처로 JSON 스키마를 만든다. 그래서 `llm_time()`에 docstring 한 줄만 있으면 모델이 쓸 수 있는 도구가 된다.

## 읽고 든 생각

- 응답을 "나중에 실행되는 객체"로 둔 게 컸다. `prompt()`를 불러도 네트워크는 안 나가고, 글자를 꺼낼 때 나간다. 스트리밍, 한꺼번에 받기, 로그 저장이 전부 같은 `Response` 하나로 처리된다.
- 도구 루프가 생각보다 단순해서 놀랐다. 프레임워크 없이 `while` 하나. 내가 만드는 에이전트도 처음엔 이 정도로 시작해도 되겠다 싶었다.
- 반면 `models.py`가 3,700줄까지 커진 건 sync/async 쌍(`Response`/`AsyncResponse`, `ChainResponse`/`AsyncChainResponse`)을 거의 복붙으로 따로 둔 탓으로 보인다. 확인은 못 했지만 구조상 그렇게 읽혔다.
- 그리고 가장 못 믿을 부분: 기본 모델이 `gpt-6-luna`로 되어 있는 건 이 저장소를 읽은 날짜 기준 그대로 적은 거다. 이 이름이 실제로 쓸 수 있는 모델인지는 확인 못 함.
- 읽지 못한 것: `cli.py`는 크기가 커서 `prompt()` 출발점과 로그 저장 부분만 봤다. 템플릿, 프래그먼트, 임베딩, `logs.py`의 테이블 구조는 열어 보지 않았다.

<details>
<summary>자세한 풀이: Response가 늦게 실행되는 방식</summary>

`Response` 안에는 `_chunks`(받은 글자 조각), `_done`(끝났는지), `_tool_calls`가 있다. `__iter__`는 `_done`이면 `_chunks`를 그대로 다시 내보내고, 아니면 `_iter_events()`로 모델에서 받아 `_process_chunk()`를 거쳐 내보낸다. 다 돌면 `conversation._record_response(self)`로 대화에 기록하고, 시간을 재고, `_done = True`로 바꾼 뒤 `_on_done()`을 부른다. 그래서 같은 응답을 두 번 읽어도 호출은 한 번만 나간다.

`stream_events()`는 글자만이 아니라 `tool_call_name` 같은 이벤트까지 내보내는 쪽이다. 주석에 따르면 `__iter__`와 `stream_events` 중 먼저 돌린 쪽이 원본 제너레이터를 소비하고, 끝난 뒤엔 각자 버퍼로 재생한다.

`ChainResponse.__iter__`는 라운드가 바뀔 때 앞뒤에 공백이 없으면 공백 하나를 넣는다. 주석에 `"...have dragons.Now that I..."`처럼 붙어 버리는 걸 막으려는 거라고 적혀 있었다. 표시용이고 저장되는 이벤트에는 안 들어간다.

`responses()` 시작부에는 이어하기 처리도 있다. 이전 대화가 실행 안 된 tool call로 끝나 있으면(중단되었거나 일시정지된 경우) 그것부터 실행한 뒤 루프를 시작한다.
</details>

<details>
<summary>자세한 풀이: 키와 설정 파일 위치</summary>

`user_dir()`은 환경변수 `LLM_USER_PATH`가 있으면 그 폴더를, 없으면 `click.get_app_dir("io.datasette.llm")`를 쓰고 폴더가 없으면 만든다. 여기에 `keys.json`(키), `aliases.json`(별칭), `default_model.txt`(기본 모델)가 들어간다. `get_key()`의 우선순위는 코드 주석 그대로 "stored key over-rides environment variables"였다. 즉 저장한 키가 환경변수보다 먼저다.

플러그인 테스트용으로 `LLM_LOAD_PLUGINS` 환경변수가 있어서, 쉼표로 적은 패키지만 불러올 수 있다. 테스트 중(`sys._called_from_test`)에는 설치된 플러그인을 자동으로 불러오지 않는다.
</details>

## 근거 링크

- 레포: https://github.com/simonw/llm
- `llm/models.py`: https://github.com/simonw/llm/blob/main/llm/models.py (`ChainResponse.responses`, `Response.execute_tool_calls`, `KeyModel`)
- `llm/__init__.py`: https://github.com/simonw/llm/blob/main/llm/__init__.py (`get_model`, `get_key`, `user_dir`)
- `llm/plugins.py`: https://github.com/simonw/llm/blob/main/llm/plugins.py
- `llm/hookspecs.py`: https://github.com/simonw/llm/blob/main/llm/hookspecs.py
- `llm/default_plugins/openai_models.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/openai_models.py
- `llm/default_plugins/default_tools.py`: https://github.com/simonw/llm/blob/main/llm/default_plugins/default_tools.py
- `llm/cli.py`: https://github.com/simonw/llm/blob/main/llm/cli.py

(2026-11-02 기준 main 브랜치를 GitHub API로 읽었다. clone은 안 했다.)
