네트워크에서 "주소"는 두 종류다. 사람이 치는 이름(`example.com`)과 기계가 쓰는 번호(IP 주소). DNS는 이름을 번호로 바꿔 주고, 라우팅은 그 번호를 보고 패킷을 다음 칸으로 넘긴다. [개요](#/post/cs-network)에서는 DNS를 "한 줄 번역"으로만 지나갔는데, 여기서는 그 안을 열어 본다.

## DNS는 나무다

DNS의 이름 공간은 나무 구조다. RFC 1034 기준으로 각 마디에 라벨이 붙고, 어느 마디의 이름은 그 마디에서 뿌리까지 라벨을 이어 붙인 것이다. `www.example.com`은 뿌리 아래 `com`, 그 아래 `example`, 그 아래 `www`다. 라벨 하나는 63바이트 이하, 이름 전체는 255바이트 이하로 정해져 있다.

이 나무를 한 서버가 다 들고 있지 않고 **존(zone)** 으로 잘라 나눠 맡는다. 어떤 조직이 자기 하위 이름을 직접 관리하겠다고 하면 그 가지가 한 존이 되고, 그 존의 이름 서버가 **권한(authoritative) 서버**다. 권한 서버는 자기 존의 데이터로만 답한다. 답, 오류, 아니면 "더 가까운 서버는 여기"라는 안내(referral) 중 하나를 돌려준다.

## 리졸버와 권한 서버

우리 PC가 직접 뿌리부터 묻는 건 아니다. 보통은 **재귀(recursive) 리졸버**에 한 번 묻는다. 리졸버는 대신 돌아다니며 묻고, 최종 답이나 오류만 돌려준다. 안내 같은 중간 결과는 클라이언트에게 주지 않는다.

리졸버가 하는 일은 대략 이렇다.

| 단계 | 하는 일 |
|---|---|
| 1 | 캐시를 본다. 있으면 그대로 답한다 |
| 2 | 없으면 아는 서버 중 가장 가까운 곳에 묻는다. 모르면 뿌리 서버부터 |
| 3 | 받은 안내를 따라 `com` → `example.com` 쪽 서버로 내려간다 |
| 4 | 권한 서버에서 답을 받아 캐시에 넣고 돌려준다 |
| 5 | 답이 CNAME(별명)이면 그 이름으로 처음부터 다시 묻는다 |

캐시 기간은 레코드마다 붙은 **TTL**(초 단위)이 정한다. TTL 0은 캐시하지 말라는 뜻이다. "없는 이름이다"라는 답도 캐시할 수 있다. 그래서 DNS 레코드를 바꿔도 곧바로 전 세계에 반영되지 않고, 이미 캐시한 리졸버가 TTL이 끝날 때까지 옛 값을 쥐고 있을 수 있다.

주요 레코드 종류는 이렇다(RFC 1035).

| 종류 | 담는 것 |
|---|---|
| A | 호스트의 IPv4 주소 |
| NS | 그 존의 권한 이름 서버 |
| CNAME | 별명이 가리키는 원래 이름 |
| MX | 메일 서버와 우선순위 |
| TXT | 문자열 |

## DNS 질문을 직접 만들어 보기

DNS 질문은 사실 작은 바이트 덩어리다. 12바이트 헤더(ID, 플래그, 질문·답·권한·추가 개수 각 2바이트)에 질문 하나를 붙이면 된다. 이름은 점 대신 "길이 + 글자" 묶음으로 쓰고 길이 0으로 끝낸다. 파이썬으로 질문을 만들어 공개 리졸버(8.8.8.8)의 53번 포트에 UDP로 보냈다.

```python
import struct, socket

def build(name, qtype=1, id=0x1234):
    hdr = struct.pack('!HHHHHH', id, 0x0100, 1, 0, 0, 0)  # 0x0100 = RD(재귀 요청) 비트
    q = b''.join(bytes([len(l)]) + l.encode() for l in name.split('.')) + b'\0'
    return hdr + q + struct.pack('!HH', qtype, 1)          # 타입 A, 클래스 IN

pkt = build('example.com')
print(pkt.hex())
# 123401000001000000000000076578616d706c6503636f6d0000010001
```

출력에서 `07 6578616d706c65`가 길이 7짜리 `example`, `03 636f6d`이 `com`, `00`이 끝이다. 이 패킷을 보내고 받은 응답을 해석하면 이렇게 나왔다.

```
('example.com', A, TTL 300, '104.20.23.154')
('example.com', A, TTL 300, '172.66.147.243')
```

주소가 두 개 돌아왔고 TTL은 300초였다. 실행 시점·위치에 따라 값은 달라질 수 있다. 응답 해석 코드는 아래에 접어 둔다.

<details>
<summary>응답 해석 코드 (압축 포인터 처리 포함)</summary>

응답 안에서 같은 이름이 반복되면 이름을 다시 쓰지 않고 앞쪽 위치를 가리키는 2바이트 **포인터**를 쓴다(RFC 1035의 압축). 첫 두 비트가 `11`이면 포인터이고, 나머지 14비트가 메시지 시작부터의 오프셋이다.

```python
def name_at(d, o):
    parts, end = [], None
    while True:
        l = d[o]
        if l == 0:
            o += 1; break
        if l & 0xC0 == 0xC0:                    # 압축 포인터
            ptr = ((l & 0x3F) << 8) | d[o+1]
            if end is None: end = o + 2
            o = ptr; continue
        parts.append(d[o+1:o+1+l].decode()); o += 1 + l
    return '.'.join(parts), (end if end is not None else o)

def parse(d):
    id, fl, qd, an, ns, ar = struct.unpack('!HHHHHH', d[:12]); o = 12
    for _ in range(qd):
        n, o = name_at(d, o); o += 4
    out = []
    for _ in range(an):
        n, o = name_at(d, o)
        t, c, ttl, rl = struct.unpack('!HHIH', d[o:o+10]); o += 10
        v = socket.inet_ntoa(d[o:o+4]) if t == 1 else (name_at(d, o)[0] if t == 5 else d[o:o+rl].hex())
        out.append((n, t, ttl, v)); o += rl
    return fl & 0xF, out        # (RCODE, 답 목록)

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(3)
s.sendto(pkt, ('8.8.8.8', 53))
print(parse(s.recvfrom(512)[0]))
```

UDP 메시지는 512바이트 이하로 정해져 있고, 넘으면 잘라 보내면서 TC(truncated) 비트를 세운다고 RFC 1035에 적혀 있다. [UDP와 TCP가 왜 갈리는지](#/post/net-tcp-udp)는 따로 정리했다.

</details>

DNS가 UDP 위에서 돈다는 게 코드에서 그대로 보였다. 연결을 맺는 단계 없이 `sendto` 한 번에 질문이 나가고 `recvfrom` 한 번에 답이 온다. 같은 소켓 API를 TCP에서 쓰는 모습은 [소켓 프로그래밍](#/post/net-socket)에서 이어진다.

## IP 주소와 서브넷

IPv4 주소는 32비트 숫자다. 사람이 읽기 편하게 8비트씩 끊어 `192.168.10.70`으로 쓴다. 이 주소는 앞부분(네트워크)과 뒷부분(그 네트워크 안의 호스트)으로 나뉜다. 어디까지가 앞부분인지는 **프리픽스 길이**로 쓴다. `192.168.10.0/26`은 앞 26비트가 네트워크라는 뜻이다. RFC 4632가 정리한 CIDR 표기이고, 예전의 A·B·C 클래스처럼 크기가 고정돼 있지 않고 2의 거듭제곱 크기의 블록이면 무엇이든 쓸 수 있다.

파이썬 표준 라이브러리 `ipaddress`로 확인했다.

```python
import ipaddress
n = ipaddress.ip_network('192.168.10.0/26')
print(n.netmask, n.network_address, n.broadcast_address, n.num_addresses)
# 255.255.255.192 192.168.10.0 192.168.10.63 64
print(list(n.hosts())[0], list(n.hosts())[-1])        # 192.168.10.1 192.168.10.62
print(ipaddress.ip_address('192.168.10.70') in n)     # False
print(list(ipaddress.ip_network('192.168.10.0/24').subnets(new_prefix=26)))
# [192.168.10.0/26, 192.168.10.64/26, 192.168.10.128/26, 192.168.10.192/26]
print(ipaddress.ip_address('10.1.2.3').is_private, ipaddress.ip_address('8.8.8.8').is_private)
# True False
```

- `/26`은 2의 6제곱인 64개 주소 블록이다. 맨 앞(.0)과 맨 뒤(.63)는 각각 네트워크 주소와 브로드캐스트 주소라서 호스트에 쓰는 건 .1~.62, 62개다.
- `192.168.10.70`은 이 블록 밖이다. 다음 블록인 `192.168.10.64/26`에 들어간다.
- `/24`를 `/26`으로 쪼개면 네 덩어리가 나온다. 서브넷은 이렇게 프리픽스를 늘려 큰 블록을 작게 나눈 것이다.
- `10.x.x.x` 같은 사설 대역은 `is_private`가 True로 나온다. 공인 주소인 8.8.8.8은 False.

<details>
<summary>"앞 26비트"를 비트로 보기</summary>

```python
print(bin(int(ipaddress.ip_address('192.168.10.70'))))
# 0b11000000101010000000101001000110
```

32비트로 맞추면 `11000000 10101000 00001010 01000110`이다. 앞 26비트는 `11000000 10101000 00001010 01`까지이고, 이 값이 `192.168.10.64`의 앞 26비트와 같다. 그래서 70은 `.64/26` 블록에 속한다. 서브넷 마스크 `255.255.255.192`는 앞 26비트를 1로 채운 값이다(마지막 바이트 `11000000` = 192).

</details>

## 라우팅: 가장 구체적인 길이 이긴다

패킷을 받은 라우터는 목적지 IP를 보고 **라우팅 테이블**을 본다. 테이블은 "이 프리픽스로 가는 패킷은 이쪽으로 보낸다"의 목록이다. 여러 항목이 동시에 맞을 수 있는데, 이때 규칙은 **가장 긴 프리픽스가 이긴다**(longest-match)다. RFC 4632도 겹칠 때 더 구체적인 경로가 우선이라고 적고 있다.

간단한 테이블을 만들어 직접 돌려 봤다.

```python
import ipaddress
table = [('0.0.0.0/0', 'A'), ('10.0.0.0/8', 'B'), ('10.1.0.0/16', 'C'), ('10.1.2.0/24', 'D')]
tbl = [(ipaddress.ip_network(p), h) for p, h in table]

def lookup(ip):
    ip = ipaddress.ip_address(ip)
    c = [(n, h) for n, h in tbl if ip in n]
    return max(c, key=lambda x: x[0].prefixlen)

for ip in ['10.1.2.9', '10.1.9.9', '10.9.9.9', '8.8.8.8']:
    n, h = lookup(ip); print(ip, '->', n, h)
```

```
10.1.2.9 -> 10.1.2.0/24 D
10.1.9.9 -> 10.1.0.0/16 C
10.9.9.9 -> 10.0.0.0/8 B
8.8.8.8 -> 0.0.0.0/0 A
```

`10.1.2.9`는 네 항목 중 세 개(/8, /16, /24)에 다 들어가지만 /24가 가장 구체적이라 D로 간다. `0.0.0.0/0`은 프리픽스 길이 0이라 어떤 주소든 맞는다. 다른 항목이 하나도 안 맞을 때 마지막으로 걸리는 **기본 경로(default route)** 가 이것이다.

위 코드는 개념을 보이려고 항목을 전부 훑는 방식이다.

## 왜 프리픽스로 묶는가

라우터가 전 세계 주소를 하나씩 들고 있을 수는 없다. 그래서 주소를 제공자(ISP) 구조에 맞게 나눠 주고, 제공자는 고객들 블록을 하나의 큰 프리픽스로 묶어 광고한다(aggregation). RFC 4632는 이렇게 하면 한 제공자의 고객이 늘어도 바깥의 라우터는 항목 하나만 알면 된다고 설명한다. 다중 연결 사이트나 제공자를 바꾸고도 번호를 안 바꾼 사이트는 별도로 광고해야 해서 묶임이 깨진다는 한계도 같이 적혀 있다.

longest-match에는 부작용도 있다. 더 긴 프리픽스가 이기니까, 누가 남의 블록의 더 구체적인 경로를 거짓으로 광고하면 트래픽이 그쪽으로 새어 나갈 수 있다. RFC는 경로 필터링과 프리픽스 개수 제한을 대응책으로 든다.

## 이름에서 패킷까지

둘을 이어 보면 주소창 한 줄이 이렇게 풀린다.

1. 브라우저가 OS 리졸버에 `example.com`을 묻는다.
2. 리졸버가 캐시를 보고, 없으면 뿌리부터 권한 서버까지 내려가 IP를 받는다.
3. 그 IP로 TCP 연결을 연다. 패킷의 목적지 필드에 IP가 들어간다.
4. 패킷이 내 PC에서 나갈 때 내 라우팅 테이블이 쓰인다. 같은 서브넷이면 바로, 아니면 기본 경로의 게이트웨이로.
5. 길 위의 라우터들이 저마다 longest-match로 다음 칸을 정한다.

층으로 보면 DNS는 애플리케이션 계층 일이고 IP와 라우팅은 인터넷 계층 일이다. 이 구분은 [OSI와 TCP/IP](#/post/net-osi-tcpip)에서 따로 다룬다. 그 위에서 HTTP가 어떻게 말을 거는지는 [HTTP](#/post/net-http)에 있다.

<details>
<summary>흔한 오해 몇 개</summary>

- "DNS는 전 세계에 서버 하나가 있다": 존으로 나뉜 분산 구조다. 이름마다 맡은 권한 서버가 따로 있다.
- "레코드를 바꾸면 바로 반영된다": 이미 캐시한 리졸버는 TTL이 끝날 때까지 옛 값을 쓸 수 있다.
- "IP 주소가 곧 위치다": 프리픽스는 제공자 구조에 맞춰 나눠 준 것이고, 라우터는 프리픽스만 보고 다음 칸을 정한다.
- "서브넷 호스트 수는 2의 n제곱이다": 네트워크 주소와 브로드캐스트 주소를 빼야 해서 /26은 64개가 아니라 62개다(위 코드).
- "라우터는 목적지까지 전체 길을 안다": 각 라우터는 다음 칸만 정한다.

</details>

← 개념 지도로 (#/post/cs-map)

같이 보면 좋은 글: [네트워크 기초](#/post/cs-network) · [TCP와 UDP](#/post/net-tcp-udp) · [소켓 프로그래밍](#/post/net-socket)

## 근거 링크

- RFC 1034, Domain Names - Concepts and Facilities: https://www.rfc-editor.org/rfc/rfc1034
- RFC 1035, Domain Names - Implementation and Specification: https://www.rfc-editor.org/rfc/rfc1035
- RFC 4632, Classless Inter-domain Routing (CIDR): https://www.rfc-editor.org/rfc/rfc4632
