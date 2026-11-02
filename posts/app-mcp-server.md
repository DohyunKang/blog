MCP 서버는 함수 몇 개에 이름과 설명을 붙여서 바깥에 내놓는 프로그램이다. 공식 튜토리얼도 날씨 조회 도구 두 개짜리 서버를 만든다. 규격 자체는 [MCP](#/post/ai-mcp) 글에서 정리했으니, 여기서는 실제로 만들고 돌려 본 흐름만 적는다.

## 서버가 하는 일

서버가 내놓을 수 있는 건 세 가지다. 리소스(파일처럼 읽는 데이터), 도구(모델이 호출하는 함수), 프롬프트(미리 써 둔 템플릿). 공식 튜토리얼은 이 중 도구를 중심으로 다룬다. 이 글도 도구만 만든다.

도구가 호출되는 흐름은 튜토리얼 설명 기준으로 이렇다.

| 순서 | 일어나는 일 |
| --- | --- |
| 1 | 클라이언트가 사용자의 질문을 모델에 보낸다 |
| 2 | 모델이 쓸 수 있는 도구 목록을 보고 뭘 부를지 정한다 |
| 3 | 클라이언트가 MCP 서버에 도구 호출을 보낸다 |
| 4 | 서버가 함수를 실행하고 결과를 돌려준다 |
| 5 | 결과가 모델에 들어가고, 모델이 문장으로 답한다 |

서버가 모델과 직접 말하는 게 아니다. 모델 앞에는 항상 클라이언트가 있고, 서버는 `tools/list`(목록 주세요)와 `tools/call`(이거 실행해 주세요) 두 요청에 답하면 된다. 도구를 모델이 어떻게 고르는지는 [도구 호출](#/post/ai-tool-use) 글에 있다.

## 만들어 본 것

메모를 저장하고 검색하는 서버다. 도구는 두 개고, 저장소는 그냥 딕셔너리다. 일부러 외부 API 없이 만들었다. 네트워크 문제 없이 서버 구조만 보고 싶었다.

환경은 공식 튜토리얼대로 `uv`로 프로젝트를 만들고 `mcp[cli]`를 설치하는 방식이다. 문서는 Python 3.10 이상과 MCP Python SDK 2.0.0 이상을 요구한다. 나는 venv에 pip로 깔았고 2.3.0이 설치됐다.

```python
# notes_server.py
import logging
from mcp.server import MCPServer

logging.basicConfig(level=logging.INFO)  # 로그는 stderr로 나간다
log = logging.getLogger(__name__)

mcp = MCPServer("notes")
NOTES: dict[str, str] = {}


@mcp.tool()
def add_note(title: str, body: str) -> str:
    """메모를 저장한다. 같은 제목이 있으면 덮어쓴다."""
    NOTES[title] = body
    log.info("saved %s", title)
    return f"저장함: {title}"


@mcp.tool()
def search_notes(keyword: str) -> list[str]:
    """제목이나 본문에 keyword가 들어간 메모의 제목 목록을 돌려준다."""
    return [t for t, b in NOTES.items() if keyword in t or keyword in b]


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

코드는 이게 전부다. 튜토리얼 설명에 따르면 `MCPServer`는 파이썬 타입 힌트와 docstring으로 도구 정의를 자동으로 만든다. 그래서 함수의 인자 이름과 타입이 입력 스키마가 되고, docstring이 도구 설명이 된다. 따로 JSON 스키마를 쓰지 않는다.

모델이 도구를 고를 때 보는 건 결국 이름, 설명, 인자뿐이다. docstring을 대충 쓰면 도구도 대충 골라진다. 서버 코드에서 가장 중요한 줄이 여기라고 느꼈다.

## 실행하고 확인하기

`mcp.run(transport="stdio")`는 서버를 표준 입출력으로 연다. 직접 실행하면 아무 출력 없이 입력만 기다린다. 클라이언트가 이 프로세스를 띄워서 stdin/stdout으로 JSON-RPC 메시지를 주고받는 구조다.

그래서 stdout에 `print()`를 쓰면 안 된다. 튜토리얼 경고 그대로, stdout에 쓰면 JSON-RPC 메시지가 깨져서 서버가 망가진다. 로그는 표준 `logging`을 쓰고 stderr로 보낸다. 위 코드의 `logging.basicConfig`가 기본으로 stderr에 쓴다. HTTP 방식 서버는 stdout 로그를 써도 된다고 한다.

테스트는 두 가지다.

첫째는 SDK 클라이언트로 직접 호출하는 파이썬 스크립트다. 서버를 자식 프로세스로 띄우고 목록 조회와 도구 호출을 해 봤다.

```python
# client_test.py
import asyncio, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command=sys.executable, args=["notes_server.py"])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
            for t in tools.tools:
                print(t.name, "|", t.description)
            print(await s.call_tool("add_note", {"title": "mcp", "body": "서버 만들기 공부"}))
            print(await s.call_tool("search_notes", {"keyword": "공부"}))

asyncio.run(main())
```

실행하니 도구 두 개가 설명과 함께 나왔고, `add_note`는 "저장함: mcp"를, `search_notes("공부")`는 `['mcp']`를 돌려줬다. 입력 스키마도 인자 이름과 `required`가 그대로 들어가 있었다. 테스트 자동화는 이 방식이 편하다. 테스트 일반론은 [테스트](#/post/be-testing) 글에 있다.

둘째는 MCP Inspector다. 공식 개발 도구이고 `npx @modelcontextprotocol/inspector <서버 실행 명령>`으로 띄운다. 웹 화면에서 도구를 골라 인자를 넣고 호출하고, 오가는 JSON-RPC 메시지를 볼 수 있다. 문서에 따르면 Node 22.19.0 이상이 필요하고, 브라우저 없이 쓰는 `--cli`, `--tui` 모드도 있다. 디버깅 가이드는 서버가 안 붙을 때 Inspector로 단독 테스트하는 걸 첫 번째 수단으로 둔다.

## Claude Desktop에 연결하기

클라이언트에 서버를 알려 주는 건 설정 파일이다. Claude Desktop은 `claude_desktop_config.json`의 `mcpServers` 키에 서버를 적는다. Windows 기준 파일 위치는 `%AppData%\Claude\claude_desktop_config.json`이다. 튜토리얼 예시를 내 파일 이름에 맞춰 바꾸면 이런 모양이다.

```json
{
  "mcpServers": {
    "notes": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\ABSOLUTE\\PATH\\TO\\notes",
        "run",
        "notes_server.py"
      ]
    }
  }
}
```

경로는 반드시 절대 경로로 쓴다. 디버깅 문서에 따르면 클라이언트가 서버를 띄울 때 작업 디렉터리가 정해져 있지 않을 수 있어서 상대 경로가 깨진다. 저장하고 Claude Desktop을 완전히 종료했다가 다시 켜야 반영된다. 창만 닫아서는 안 된다. 켜면 입력창의 커넥터 메뉴에 서버가 보인다. 안 보이면 로그(`%AppData%\Claude\logs`의 `mcp*.log`)를 본다.

## 에러는 어떻게 돌려주나

도구가 실패했을 때 모델이 그 이유를 읽고 고쳐서 다시 시도하게 만드는 게 목표다. 명세는 에러를 두 가지로 나눈다. 없는 도구 이름이나 형식이 깨진 요청 같은 프로토콜 에러는 JSON-RPC 에러로 간다. API 실패, 입력값 오류, 로직 오류 같은 도구 실행 에러는 결과에 `isError: true`를 달아서 돌려주고, 클라이언트는 이걸 모델에 넘겨서 스스로 고치게 하라고 권한다.

SDK에서 실제로 어떻게 보이는지 확인해 봤다. 메모가 없을 때 일반 `ValueError`를 던지는 도구를 만들어 호출했더니 `is_error=True`로 오긴 했는데 메시지가 "Error executing tool get_note"뿐이었다. 내가 쓴 사유가 모델에 전달되지 않는다. SDK 소스의 docstring을 보니 예상한 실패는 `ToolError`를 던지라고 되어 있었다. 바꿔서 돌렸다.

```python
from mcp.server.mcpserver.exceptions import ToolError

@mcp.tool()
def get_note(title: str) -> str:
    """제목으로 메모를 읽는다."""
    raise ToolError(f"'{title}' 메모가 없다. search_notes로 먼저 찾아 봐라.")
```

결과 content가 "Error executing tool get_note: '없는거' 메모가 없다. search_notes로 먼저 찾아 봐라."로 왔다. 에러 문구에 다음에 뭘 하면 되는지까지 적어 두면 모델이 그대로 따라 할 수 있다. 예상 못 한 예외는 크래시로 취급돼서 모델에는 이름만 가고 서버 로그에는 트레이스백이 남는다.

## 만들 때 신경 쓸 것

- 도구 이름은 명세에서 1~128자, 영문 대소문자·숫자·밑줄·하이픈·점만 쓰길 권한다. 공백이나 쉼표는 피한다.
- 서버에 상태를 두고 싶으면 명세는 핸들을 권한다. MCP에는 프로토콜 수준의 세션이 없으니, 장바구니 같은 상태는 만들기 도구가 ID를 돌려주고 이후 호출이 그 ID를 인자로 받는 식이다. 내 메모 서버는 전역 딕셔너리 하나라서 이 방식이 아니다. 연습용이라 그렇다.
- 입력은 서버가 검증한다. 명세의 서버 보안 항목에 입력 검증, 접근 제어, 호출 속도 제한, 출력 정리가 들어 있다.
- 사람이 거부할 수 있어야 한다. 명세는 도구 호출 앞에 사람이 승인하거나 거부하는 단계가 있어야 한다고 적는다. 이건 클라이언트가 지킬 몫이지만, 서버를 만드는 쪽도 지우기·보내기 같은 위험한 도구는 신중히 내놓아야 한다. 도구 결과에 섞인 지시문 문제는 프롬프트 인젝션 글에서 다룬다.
- 외부 서비스 키가 필요한 서버는 설정 파일의 `env`로 넘기게 되는데, 키 관리는 [시크릿 관리](#/post/cloud-secrets)와 같은 문제다.

## 흔한 오해

- 서버가 모델을 호출한다: 서버는 요청에 답할 뿐이다. 모델과 말하는 건 클라이언트다.
- 서버 코드에 print로 디버깅하면 된다: stdio 서버에서는 print가 프로토콜을 깨뜨린다. stderr 로그를 쓴다.
- 코드를 고치면 바로 반영된다: Claude Desktop은 완전히 종료 후 재시작해야 한다.
- 에러는 예외를 던지면 알아서 전달된다: 일반 예외는 이유가 가려진다. 예상한 실패는 `ToolError`로 사유를 적어 준다. 이 동작은 내가 쓴 SDK 2.3.0에서 확인한 것이다.

← 개념 지도로

관련 글: [MCP](#/post/ai-mcp) · [도구 호출](#/post/ai-tool-use) · [에이전트 설계](#/post/app-agent-design)

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

직접 실행해 확인함: 위 `notes_server.py`를 mcp 2.3.0(Python 3.13, venv)에서 stdio로 띄우고 SDK 클라이언트로 `list_tools`와 `call_tool` 두 개를 호출해 결과를 얻음. 입력 스키마가 타입 힌트에서 자동 생성되는 것, 일반 예외가 "Error executing tool"로 가려지는 것, `ToolError` 메시지가 전달되는 것도 같은 방식으로 확인함.

확인 못 함: MCP Inspector 실행, Claude Desktop 연결(설정 JSON은 공식 튜토리얼 내용), 공식 튜토리얼의 날씨 서버(외부 API 호출 부분)를 직접 돌려 보는 것, TypeScript SDK 방식, HTTP 전송 방식 서버 배포.

</details>

## 근거 링크

- Build an MCP server(공식 튜토리얼): https://modelcontextprotocol.io/docs/develop/build-server
- MCP Inspector: https://modelcontextprotocol.io/docs/tools/inspector
- Debugging: https://modelcontextprotocol.io/docs/tools/debugging
- 명세, 도구: https://modelcontextprotocol.io/specification/latest/server/tools
- 직접 실행한 SDK: PyPI의 mcp 2.3.0 (소스의 ToolError docstring 포함)
