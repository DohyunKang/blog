#!/usr/bin/env python3
"""용어집(glossary.json) 검사 + 역링크(backlinks.json) 만들기.

  python3 tools/glossary.py           # 검사만. 문제가 있으면 exit 1
  python3 tools/glossary.py --write   # 검사 + backlinks.json 다시 쓰기 (새 글 올린 뒤 push 전에)

매칭 규칙은 app.js의 linkTerms()와 같다(바꾸면 둘 다 바꿀 것):
  - 대소문자: 별칭에 소문자가 하나라도 있으면 대소문자 무시, 아니면(TCP, SQL) 정확히 일치
  - 경계: 별칭이 영문/숫자로 시작하면 앞 글자가 영문/숫자/_ 이면 안 됨, 영문/숫자로 끝나면 뒷 글자도 마찬가지
          한글로 시작하면 앞 글자가 한글이면 안 됨(멀티프로세스 속 '프로세스'는 안 잡음). 한글 뒤 조사는 허용
  - 같은 위치면 긴 별칭 우선, 겹치면 앞에 나온 것 우선
  - 코드 블록·인라인 코드·제목·기존 링크 안은 안 봄, 자기 글 용어는 안 봄, skip_series 시리즈 글은 그 용어 안 봄
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['ko', 'en', 'ja', 'zh']
EXPLAINER_SERIES = {"운영체제","네트워크","데이터베이스","클라우드·배포","서비스 인프라","CS·설계 기초","소프트웨어 공학","컴퓨터 구조","백엔드","프론트엔드","정보보안","자료구조·알고리즘","AI 용어사전","AI 원리"}
W = re.compile(r'[A-Za-z0-9_]')
H = re.compile(r'[\uac00-\ud7a3]')

def load():
    g = json.load(open(os.path.join(ROOT, 'glossary.json'), encoding='utf-8'))
    idx = json.load(open(os.path.join(ROOT, 'posts', 'index.json'), encoding='utf-8'))
    return g, idx

def aliases(term, lang):
    return list(term.get('all', [])) + list(term.get(lang, []))

class Matcher:
    def __init__(self, terms, lang):
        self.map = {}   # (key, sensitive) -> term
        cs, ci = [], []
        for t in terms:
            for a in aliases(t, lang):
                sens = not re.search(r'[a-z]', a)
                key = a if sens else a.lower()
                self.map[(key, sens)] = t
                (cs if sens else ci).append(a)
        def rx(lst, flags):
            lst = sorted(set(lst), key=len, reverse=True)
            return re.compile('|'.join(re.escape(x) for x in lst), flags) if lst else None
        self.rs = [(rx(cs, 0), True), (rx(ci, re.I), False)]

    def find(self, text):
        """(start, end, term) 후보를 경계 규칙까지 통과한 것만, 겹치지 않게."""
        cands = []
        for r, sens in self.rs:
            if not r: continue
            pos = 0
            while True:
                m = r.search(text, pos)
                if not m: break
                cands.append((m.start(), m.end(), m.group(0), sens))
                pos = m.start() + 1   # 겹치는 후보도 모은다(경계 탈락 시 다음 후보)
        cands.sort(key=lambda c: (c[0], -(c[1] - c[0])))
        out, last = [], -1
        for s, e, txt, sens in cands:
            if s < last: continue
            if not ok_boundary(text, s, e, txt): continue
            t = self.map.get((txt if sens else txt.lower(), sens))
            if not t: continue
            out.append((s, e, t)); last = e
        return out

def ok_boundary(text, s, e, a):
    p = text[s-1] if s > 0 else ''
    n = text[e] if e < len(text) else ''
    if W.match(a[0]) and p and W.match(p): return False
    if W.match(a[-1]) and n and W.match(n): return False
    if H.match(a[0]) and p and H.match(p): return False
    return True

def strip_md(md):
    md = re.sub(r'^(```|~~~).*?^\1[^\n]*$', ' ', md, flags=re.M | re.S)   # 코드 블록
    md = re.sub(r'`[^`\n]*`', ' ', md)                                     # 인라인 코드
    md = re.sub(r'^\s{0,3}#{1,6} .*$', ' ', md, flags=re.M)                 # 제목
    md = re.sub(r'!?\[[^\]]*\]\([^)]*\)', ' ', md)                          # 링크·이미지
    md = re.sub(r'<a\b.*?</a>', ' ', md, flags=re.S | re.I)
    md = re.sub(r'https?://\S+', ' ', md)
    return md

def mentions(md, matcher, self_slug, series):
    hit = []
    for s, e, t in matcher.find(strip_md(md)):
        if t['slug'] == self_slug or series in t.get('skip_series', []): continue
        if t['slug'] not in hit: hit.append(t['slug'])
    return hit

def main():
    write = '--write' in sys.argv
    g, idx = load()
    terms = g['terms']; slugs = {p['slug']: p for p in idx}
    errs, warns = [], []
    # 1) 깨진 slug
    for t in terms:
        if t['slug'] not in slugs: errs.append(f"깨진 slug: {t['slug']} (index.json에 없음)")
        elif not os.path.exists(os.path.join(ROOT, 'posts', t['slug'] + '.md')): errs.append(f"글 파일 없음: posts/{t['slug']}.md")
        else:
            for l in LANGS[1:]:
                if not os.path.exists(os.path.join(ROOT, 'posts', f"{t['slug']}.{l}.md")):
                    warns.append(f"{t['slug']}: {l}판 없음(링크는 한국어판으로 열림)")
        for l in LANGS:
            if not aliases(t, l): warns.append(f"{t['slug']}: {l} 별칭 없음(그 언어 글에선 링크 안 됨)")
    # 2) 같은 별칭이 두 글을 가리킴
    for l in LANGS:
        seen = {}
        for t in terms:
            for a in aliases(t, l):
                k = a if not re.search(r'[a-z]', a) else a.lower()
                if k in seen and seen[k] != t['slug']: errs.append(f"[{l}] 별칭 '{a}'가 {seen[k]}와 {t['slug']} 둘 다 가리킴")
                seen[k] = t['slug']
    # 3) 설명 글인데 용어집에 없음 (map 글 제외)
    have = {t['slug'] for t in terms}
    for p in idx:
        if p.get('series') in EXPLAINER_SERIES and p['slug'] not in have and not p['slug'].endswith('-map'):
            warns.append(f"용어 없음: {p['slug']} ({p.get('series')}) — 다른 글에서 이 글로 링크되지 않음")
    # 4) 역링크 계산 (한국어 본문 기준) + 한 번도 안 잡힌 용어
    m = Matcher([t for t in terms if t['slug'] in slugs], 'ko')
    back = {}
    used = set()
    for p in idx:
        f = os.path.join(ROOT, 'posts', p['slug'] + '.md')
        if not os.path.exists(f): continue
        for tgt in mentions(open(f, encoding='utf-8').read(), m, p['slug'], p.get('series')):
            back.setdefault(tgt, []).append(p['slug']); used.add(tgt)
    for t in terms:
        if t['slug'] in slugs and t['slug'] not in used: warns.append(f"아무 글에서도 안 잡힘: {t['slug']}")
    order = {p['slug']: p['date'] for p in idx}
    back = {k: sorted(v, key=lambda s: order.get(s, ''), reverse=True) for k, v in sorted(back.items())}
    bpath = os.path.join(ROOT, 'backlinks.json')
    old = json.load(open(bpath, encoding='utf-8')) if os.path.exists(bpath) else None
    if write:
        json.dump(back, open(bpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
        print(f"backlinks.json 씀: 대상 글 {len(back)}개, 링크 {sum(map(len, back.values()))}개")
    elif old != back:
        warns.append("backlinks.json이 최신이 아님 → python3 tools/glossary.py --write")
    print(f"용어집: 용어(대상 글) {len(terms)}개, 별칭 {sum(len(aliases(t,l)) for t in terms for l in LANGS)}개(언어별 합)")
    for w in warns: print('경고:', w)
    for e in errs: print('오류:', e)
    sys.exit(1 if errs else 0)

if __name__ == '__main__':
    main()
