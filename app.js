(function(){
  var app=document.getElementById('app'),posts=[],prog=document.getElementById('prog'),state={q:'',asc:false},MAIL='kid708502@gmail.com';
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  // 언어(한/영): 저장된 선택 > 브라우저 언어
  var LANG='ko';try{LANG=localStorage.getItem('blog-lang')||(/^ja/i.test(navigator.language)?'ja':/^zh/i.test(navigator.language)?'zh':/^ko/i.test(navigator.language)?'ko':'en')}catch(e){}
  var D={"en": {"프로젝트에서 나온 개념": "Concepts from Projects", "프로젝트 노트": "Project Notes", "글": "Posts", "소개": "About", "포트폴리오": "Portfolio", "메일": "Mail", "최근 글": "Recent", "태그": "Tags", "시리즈": "Series", "전체": "All", "전체 글": "All posts", "고정": "Pinned", "검색": "Search", "맞는 글이 없어요.": "Nothing found.", "불러오는 중…": "Loading…", "링크 복사": "Copy link", "복사됨 ✓": "Copied ✓", "주소창에서 복사해 주세요": "Copy from the address bar", "← 목록": "← List", "← 이전 글": "← Previous", "다음 글 →": "Next →", "목차": "Contents", "분 읽기": " min read", "이 글 어떠셨나요?": "What did you think?", "댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.": "No comments here, just email. Opinions, questions, small talk are all welcome.", "메일 보내기": "Send mail", "Gmail로 쓰기": "Write in Gmail", "복사": "Copy", "글을 찾을 수 없어요.": "Post not found.", "강도현": "Dohyun Kang", "나의 방향": "My Direction", "AI 시대 고찰": "Thoughts on the AI Era", "일상": "Daily", "운동": "Workout", "생각": "Thoughts", "일기": "Diary", "오늘 있었던 일을 적어요.": "Writing down what happened today.", "최신순": "Newest", "오래된순": "Oldest", "연락처": "Contact", "재밌게 살자.": "Enjoy your life.", "연락": "Contact", "글 보기": "Browse posts", "글 수": " posts", "시리즈 수": " series", "태그 수": " tags"}, "ja": {"프로젝트에서 나온 개념": "プロジェクトで出た概念", "프로젝트 노트": "プロジェクトノート", "글": "記事", "소개": "紹介", "포트폴리오": "ポートフォリオ", "메일": "メール", "최근 글": "最近の記事", "태그": "タグ", "시리즈": "シリーズ", "전체": "すべて", "전체 글": "すべての記事", "고정": "固定", "검색": "検索", "맞는 글이 없어요.": "見つかりませんでした。", "불러오는 중…": "読み込み中…", "링크 복사": "リンクをコピー", "복사됨 ✓": "コピーしました ✓", "주소창에서 복사해 주세요": "アドレスバーからコピーしてください", "← 목록": "← 一覧", "← 이전 글": "← 前の記事", "다음 글 →": "次の記事 →", "목차": "目次", "분 읽기": "分で読めます", "이 글 어떠셨나요?": "どうでしたか？", "댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.": "コメントの代わりにメールで受け付けています。意見・質問・雑談、何でも歓迎です。", "메일 보내기": "メールを送る", "Gmail로 쓰기": "Gmailで書く", "복사": "コピー", "글을 찾을 수 없어요.": "記事が見つかりません。", "강도현": "カン・ドヒョン", "나의 방향": "私の方向", "AI 시대 고찰": "AI時代を考える", "일상": "日常", "운동": "運動", "생각": "思ったこと", "일기": "日記", "오늘 있었던 일을 적어요.": "今日あったことを書きます。", "최신순": "新しい順", "오래된순": "古い順", "연락처": "連絡先", "재밌게 살자.": "人生、楽しもう。", "연락": "連絡先", "글 보기": "記事を見る", "글 수": "記事", "시리즈 수": "シリーズ", "태그 수": "タグ"}, "zh": {"프로젝트에서 나온 개념": "项目中遇到的概念", "프로젝트 노트": "项目笔记", "글": "文章", "소개": "关于", "포트폴리오": "作品集", "메일": "邮件", "최근 글": "最近文章", "태그": "标签", "시리즈": "系列", "전체": "全部", "전체 글": "全部文章", "고정": "置顶", "검색": "搜索", "맞는 글이 없어요.": "没有找到。", "불러오는 중…": "加载中…", "링크 복사": "复制链接", "복사됨 ✓": "已复制 ✓", "주소창에서 복사해 주세요": "请从地址栏复制", "← 목록": "← 列表", "← 이전 글": "← 上一篇", "다음 글 →": "下一篇 →", "목차": "目录", "분 읽기": "分钟阅读", "이 글 어떠셨나요?": "你觉得怎么样？", "댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.": "这里不设评论，欢迎发邮件。意见、问题、闲聊都可以。", "메일 보내기": "发邮件", "Gmail로 쓰기": "用 Gmail 写", "복사": "复制", "글을 찾을 수 없어요.": "找不到这篇文章。", "강도현": "姜道贤", "나의 방향": "我的方向", "AI 시대 고찰": "AI 时代的思考", "일상": "日常", "운동": "运动", "생각": "想法", "일기": "日记", "오늘 있었던 일을 적어요.": "写下今天发生的事。", "최신순": "最新", "오래된순": "最早", "연락처": "联系方式", "재밌게 살자.": "好好享受生活。", "연락": "联系方式", "글 보기": "查看文章", "글 수": "篇", "시리즈 수": "个系列", "태그 수": "个标签"}};
  D.ko={'글 수':'글','시리즈 수':'시리즈','태그 수':'태그'};
  function t(k){return (D[LANG]&&D[LANG][k])||k}
  function pt(p){return LANG!=='ko'&&p['title_'+LANG]?p['title_'+LANG]:p.title}
  function ps(p){return LANG!=='ko'&&p['summary_'+LANG]?p['summary_'+LANG]:p.summary}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
  // 썸네일: 같은 야경 사진을 글마다 다른 부분으로 잘라 색을 입힘 — 이모지·무지개 그라데이션 없이 사이트와 한 톤
  function thumb(p,extra){
    if(!p.thumb&&p.auto)p={thumb:p.auto,pos:'center',slug:p.slug};
    if(p.thumb)return'<div class="th'+(extra||'')+' real" style="background-image:url('+p.thumb+');background-size:'+(p.size||'cover')+';background-position:'+(p.pos||'center')+'"></div>';
    var h=hash(p.slug),hue=(h%80)+215,x=(h%90)+5,y=(h>>3)%70+15;
    return'<div class="th'+(extra||'')+'" style="background-image:linear-gradient(135deg,hsla('+hue+',75%,52%,.5),hsla('+(hue+40)+',70%,22%,.62)),url(img/night.jpg);background-size:cover,auto 380%;background-position:center,'+x+'% '+y+'%"></div>';
  }
  function mins(t){return Math.max(1,Math.round(t.replace(/\s+/g,'').length/500))}
  function counts(key){var m={};posts.forEach(function(p){(key==='tags'?p.tags:(p.series?[p.series]:[])).forEach(function(x){m[x]=(m[x]||0)+1})});return m}
  function link(p){return'#/post/'+encodeURIComponent(p.slug)}
  function bdate(s){
    var m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m)return esc(s);
    var mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return mon[+m[2]-1]+' '+(+m[3])+'. '+m[1];
  }

  // 테마
  var root=document.documentElement,tb=document.getElementById('theme');
  try{var sv=localStorage.getItem('blog-theme');if(sv)root.dataset.theme=sv}catch(e){}
  tb.onclick=function(){var l=root.dataset.theme==='light';root.dataset.theme=l?'dark':'light';try{localStorage.setItem('blog-theme',root.dataset.theme)}catch(e){}};

  function chrome(){
    var n=document.querySelectorAll('.hd nav a');n[0].textContent=t('글');n[1].textContent=t('소개');
    document.querySelectorAll('.tl2')[0].textContent=t('포트폴리오');
    document.documentElement.lang=LANG;
    document.getElementById('lang').value=LANG;
  }
  document.getElementById('lang').onchange=function(){LANG=this.value;try{localStorage.setItem('blog-lang',LANG)}catch(e){}chrome();route()};
  function errMsg(){return {ko:'불러오지 못했어요. 새로고침해 주세요.',en:"Couldn't load. Please refresh.",ja:'読み込めませんでした。再読み込みしてください。',zh:'加载失败，请刷新页面。'}[LANG]}
  var TREE=[["AI",["AI 원리","AI 용어사전","AI 소식·분석","AI 모델","하네스·에이전트","LLM 앱 만들기","Claude 활용"]],["GitHub",["GitHub 레포"]],["CS",["컴퓨터 구조","운영체제","네트워크","데이터베이스","소프트웨어 공학","자료구조·알고리즘","정보보안","백엔드","프론트엔드","클라우드·배포","서비스 인프라","CS·설계 기초"]],["자격증",["정보처리기사","SQLD","ADsP","빅데이터분석기사"]],["자동화",["마케팅 자동화","업무 자동화"]],["프로젝트 노트",["프로젝트에서 나온 개념"]],["일기장",["나의 방향","AI 시대 고찰"]]];
  function side(cur){
    var tg=counts('tags'),sr=counts('series'),rec=posts.slice(0,4);
    return'<aside class="side"><div class="glass prof"><button class="av" type="button" id="av" aria-label="profile photo"><span class="ph one"><img src="img/me.jpg" alt="강도현"></span></button><div><h2><a href="#/about" style="color:inherit">'+t('강도현')+'</a></h2><p>'+t('재밌게 살자.')+'</p></div></div>'+
      '<div class="glass box ctc"><h3>'+t('연락처')+'</h3><div class="lk"><a href="https://dohyunkang.github.io/" target="_blank" rel="noopener">'+t('포트폴리오')+'</a><a href="https://www.instagram.com/00.dhk" target="_blank" rel="noopener">Instagram</a><a href="mailto:'+MAIL+'">'+t('메일')+'</a></div></div>'+
      '<div class="glass box rank"><h3>'+t('최근 글')+'</h3>'+rec.map(function(p,i){return'<a href="'+link(p)+'"><b>'+(i+1)+'</b><span>'+esc(pt(p))+'</span></a>'}).join('')+'</div>'+
      '<div class="glass box tagbox"><h3>'+t('태그')+'</h3><div class="chips"><a class="chip'+(!cur?' on':'')+'" href="#/">'+t('전체')+'<b>'+posts.length+'</b></a>'+
      (function(){var ks=Object.keys(tg).sort(function(a,b){return tg[b]-tg[a]}),N=12,chip=function(tx){return'<a class="chip'+(cur==='t:'+tx?' on':'')+'" href="#/tag/'+encodeURIComponent(tx)+'">#'+esc(t(tx))+'<b>'+tg[tx]+'</b></a>'},head=ks.slice(0,N),rest=ks.slice(N);if(cur&&cur.indexOf('t:')===0){var c=cur.slice(2),i=rest.indexOf(c);if(i>-1){rest.splice(i,1);head.push(c)}}return head.map(chip).join('')+(rest.length?'<details class="moretag"><summary class="chip">'+t('더보기')+' +'+rest.length+'</summary><div class="chips">'+rest.map(chip).join('')+'</div></details>':'')})()+'</div></div>'+
      (Object.keys(sr).length?'<div class="glass box ser"><h3>'+t('시리즈')+'</h3>'+TREE.map(function(g){var n=0;g[1].forEach(function(x){n+=sr[x]||0});var open=cur&&(cur==='c:'+g[0]||(cur.indexOf('s:')===0&&g[1].indexOf(cur.slice(2))>-1));return'<details class="fold"'+(open?' open':'')+'><summary><span>'+esc(t(g[0]))+'</span><b>'+n+'</b></summary><a class="all" href="#/cat/'+encodeURIComponent(g[0])+'"><span>'+t('전체 보기')+'</span></a>'+g[1].map(function(x){return'<a class="leaf'+(cur==='s:'+x?' on':'')+'" href="#/series/'+encodeURIComponent(x)+'"><span>'+esc(t(x))+'</span><b>'+(sr[x]||0)+'</b></a>'}).join('')+'</details>'}).join('')+'</div>':'')+'</aside>';
  }
  function row(p){
    return'<a class="row" href="'+link(p)+'"><div><div class="cat">'+(p.series?'<em class="sr" style="font-style:normal">'+esc(t(p.series))+'</em>':'')+p.tags.map(function(x){return'<span>#'+esc(t(x))+'</span>'}).join('')+'</div>'+
      '<h2>'+(p.pinned?'<span class="pin">'+t('고정')+'</span>':'')+esc(pt(p))+'</h2><p>'+esc(ps(p))+'</p><span class="meta">'+esc(p.date)+'</span></div>'+thumb(p)+'</a>';
  }
  var rollTimer=0;
  function rollStop(){clearInterval(rollTimer);rollTimer=0}
  function rollInit(){
    rollStop();
    var box=document.getElementById('roll');if(!box)return;
    var track=box.querySelector('.roll-track'),dots=[].slice.call(box.querySelectorAll('.roll-dots button')),n=dots.length,i=0;
    function go(k){i=(k+n)%n;track.style.transform='translate3d('+(-i*100)+'%,0,0)';dots.forEach(function(b,j){b.classList.toggle('on',j===i)})}
    function arm(){rollStop();if(!n||n<2||RM.matches)return;rollTimer=setInterval(function(){if(!box.isConnected){rollStop();return}if(document.hidden)return;go(i+1)},5000)}
    dots.forEach(function(b,j){b.onclick=function(){go(j);arm()}});
    box.onmouseenter=rollStop;box.onmouseleave=arm;box.onfocusin=rollStop;box.onfocusout=arm;
    arm();
  }
  function home(filter,title,cur){
    document.title='dohyun.log';
    rollStop();
    var q=state.q.toLowerCase();
    var shown=posts.filter(function(p){return(!filter||filter(p))&&(!q||(p.title+p.summary+(p.title_en||'')+(p.summary_en||'')+p.tags.join(' ')).toLowerCase().indexOf(q)>=0)});
    shown.sort(function(a,b){return state.asc?(a.date<b.date?-1:a.date>b.date?1:0):((b.pinned?1:0)-(a.pinned?1:0)||(a.date<b.date?1:a.date>b.date?-1:0))});
    var mains=[];if(!filter&&!q){shown.forEach(function(p){if(p.featured&&mains.length<5)mains.push(p)});shown.forEach(function(p){if(mains.length<5&&mains.indexOf(p)<0)mains.push(p)})}
    var rest=shown;
    var PER=10,key=(cur||'')+'|'+q+'|'+state.asc;if(state.pkey!==key){state.pkey=key;state.page=1}
    var pages=Math.max(1,Math.ceil(rest.length/PER));if(state.page>pages)state.page=pages;
    var pg={items:rest.slice((state.page-1)*PER,state.page*PER),html:''};
    if(pages>1){var nums=[];for(var i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-state.page)<=2)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…')}
      pg.html='<nav class="pager" aria-label="pages">'+(state.page>1?'<button type="button" data-p="'+(state.page-1)+'">←</button>':'')+nums.map(function(n){return n==='…'?'<span>…</span>':'<button type="button" data-p="'+n+'"'+(n===state.page?' class="on" aria-current="page"':'')+'>'+n+'</button>'}).join('')+(state.page<pages?'<button type="button" data-p="'+(state.page+1)+'">→</button>':'')+'</nav>'}
    var hero=(!filter&&!q)?'<section class="hero"><p class="eb">DOHYUN.LOG</p><h1 class="serif">Day by day.</h1><p>Enjoy your life, just do it.</p><div class="st"><b>'+posts.length+'</b>'+t('글 수')+' · <b>'+Object.keys(counts('series')).length+'</b>'+t('시리즈 수')+' · <b>'+Object.keys(counts('tags')).length+'</b>'+t('태그 수')+'</div><div class="dk-gow"><button class="btn pri dk-go" type="button">'+t('글 보기')+' ↓</button></div></section>':'<section class="hero" style="padding-bottom:20px"><h1 style="font-size:2rem">'+esc(t(title))+'</h1></section>';
    var feat=mains.length?'<div class="glass feat roll" id="roll"><div class="roll-track">'+mains.map(function(p,i){return'<a class="roll-slide" href="'+link(p)+'">'+thumb(p)+'<div class="fb"><div class="lb">'+(i+1)+' / '+mains.length+'</div><h2>'+esc(pt(p))+'</h2><p>'+esc(ps(p))+'</p><span class="meta">'+esc(p.date)+p.tags.map(function(x){return' · #'+esc(t(x))}).join('')+'</span></div></a>'}).join('')+'</div><div class="roll-dots">'+mains.map(function(_,i){return'<button type="button" aria-label="'+(i+1)+' / '+mains.length+'"'+(i?'':' class="on"')+'></button>'}).join('')+'</div></div>':'';
    app.innerHTML=((!filter&&!q)?'<div class="dk"><div class="dk-stage">'+hero+'</div></div>':hero)+'<div class="grid"><section class="main">'+feat+'<div class="glass list"><div class="lh"><h3>'+t(mains.length?'전체 글':'글')+' <span class="meta">'+shown.length+'</span></h3><details class="sdrop"><summary class="btn">'+t('시리즈')+' ▾</summary><div class="tdrop">'+TREE.map(function(g){var sr2=counts('series'),n=0;g[1].forEach(function(x){n+=sr2[x]||0});return'<div class="tg"><a class="tgh'+(cur==='c:'+g[0]?' on':'')+'" href="#/cat/'+encodeURIComponent(g[0])+'">'+esc(t(g[0]))+'<b>'+n+'</b></a><div class="chips">'+g[1].map(function(x){return'<a class="chip'+(cur==='s:'+x?' on':'')+'" href="#/series/'+encodeURIComponent(x)+'">'+esc(t(x))+'<b>'+(sr2[x]||0)+'</b></a>'}).join('')+'</div></div>'}).join('')+'</div></details><button class="btn srt" id="srt" type="button">'+(state.asc?'↑ '+t('오래된순'):'↓ '+t('최신순'))+'</button><input id="q" type="search" placeholder="'+t('검색')+'" value="'+esc(state.q)+'"></div>'+
      (rest.length?pg.items.map(row).join('')+pg.html:'<p class="empty">'+(shown.length?'':t('맞는 글이 없어요.'))+'</p>')+'</div></section>'+side(cur)+'</div>';
    [].forEach.call(document.querySelectorAll('.pager [data-p]'),function(b){b.onclick=function(){state.page=+b.getAttribute('data-p');home(filter,title,cur);var l=document.querySelector('.list');if(l)scrollTo(0,l.getBoundingClientRect().top+pageYOffset-80)}});
    document.getElementById('srt').onclick=function(){state.asc=!state.asc;home(filter,title,cur)};
    var qi=document.getElementById('q');
    qi.oninput=function(){state.q=qi.value.trim();var pos=qi.selectionStart;home(filter,title,cur);var n=document.getElementById('q');n.focus();n.setSelectionRange(pos,pos)};
    rollInit();
    progress(false);
    if(!filter&&!q)deckInit('home');else{deckOff();reveal()}
  }

  // 소개 = 회사 임직원 프로필 페이지처럼
  function about(){
    document.title=t('소개')+' · dohyun.log';
    var pics=['img/p1.jpg','img/p2.jpg'];
    var imgs=pics.map(function(u,i){return'<img src="'+u+'" alt="'+(i?'':'강도현')+'" style="animation-duration:'+(pics.length*7)+'s;animation-delay:-'+(i*7)+'s">'}).join('');
    function li(t,d,x){return'<li><small>'+d+'</small><b>'+t+'</b><span>'+x+'</span></li>'}
    app.innerHTML='<div class="adk" ><div class="adk-stage"><div class="glass mem"><div class="frame"><div class="ph">'+imgs+'</div></div><div class="mcol"><div class="sc">'+
      '<p class="role">JUNIOR PM · AI/AX</p><h1>강도현 <span class="meta">Dohyun Kang</span></h1><p class="tagl">직접 개발하고 경험하며 PM의 길을 걷고 있습니다.</p></div><div class="sc">'+
      '<dl class="kv"><dt>소속</dt><dd>Allie Research Inc.</dd><dt>하는 일</dt><dd>제품·마케팅 기획, 팀 간 조율, 개발</dd><dt>학력</dt><dd>인천대학교 정보통신공학과 (학점 3.93 / 4.5)</dd><dt>수상</dt><dd>ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상</dd><dt>연락</dt><dd>'+MAIL+'</dd></dl></div><div class="sc">'+
      '<h3>이력</h3><ul class="tl">'+
      li('Allie Research Inc. — Junior PM','2026.08 –','제품·마케팅 기획, 팀 간 조율 / 개발')+
      li('Telechips 아카데미','2026.02 – 2026.05','C/C++ · 리눅스 커널 · 디바이스 드라이버')+
      li('Techways — 현장실습','2024.08 – 2025.02','시험 자동화 도구 개발 (C#, LabVIEW)')+
      li('한국알프스 — R&D 센터 인턴','2024.01 – 2024.02','CAN/CAN FD 차량 스위치 검증')+
      li('고주파 안테나 설계 연구실 — 학부연구생','2022.09 – 2023.12','양봉 IoT, CST 안테나 설계')+
      '</ul><p style="margin:18px 0 0"><a class="btn pri" href="https://dohyunkang.github.io/'+({ko:'resume.html',en:'resume.en.html',ja:'resume.ja.html',zh:'resume.zh.html'}[LANG])+'" target="_blank" rel="noopener">이력서 보기</a> <a class="btn" href="https://dohyunkang.github.io/" target="_blank" rel="noopener">포트폴리오</a> <a class="btn" href="https://github.com/DohyunKang" target="_blank" rel="noopener">GitHub</a> <a class="btn" href="https://www.instagram.com/00.dhk" target="_blank" rel="noopener">Instagram</a></p></div></div></div></div><div class="adots" aria-hidden="true"><button type="button" tabindex="-1"></button><button type="button" tabindex="-1"></button><button type="button" tabindex="-1"></button></div></div>';

    if(LANG!=='ko'){
      var AB={"en": {"소속": "Company", "하는 일": "Role", "학력": "Education", "연락": "Contact", "이력서 보기": "Resume", "이력": "Timeline", "포트폴리오": "Portfolio", "직접 개발하고 경험하며 PM의 길을 걷고 있습니다.": "Building things myself and learning the PM path along the way.", "제품·마케팅 기획, 팀 간 조율, 개발": "Product and marketing planning, team coordination, development", "제품·마케팅 기획, 팀 간 조율 / 개발": "Product and marketing planning, team coordination / development", "인천대학교 정보통신공학과 (학점 3.93 / 4.5)": "Incheon National University, Information and Telecommunication Engineering (GPA 3.93 / 4.5)", "ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상": "ACK 2024 Excellent Paper Award · Hanium Contest Honorable Mention · Industry-Academia Capstone Silver · Field Practice Essay Contest Grand Prize", "C/C++ · 리눅스 커널 · 디바이스 드라이버": "C/C++ · Linux kernel · Device drivers", "Telechips 아카데미": "Telechips Academy", "Techways — 현장실습": "Techways — Field practice", "시험 자동화 도구 개발 (C#, LabVIEW)": "Test automation tool development (C#, LabVIEW)", "한국알프스 — R": "Alps Alpine Korea — R", "CAN/CAN FD 차량 스위치 검증": "CAN/CAN FD vehicle switch verification", "센터 인턴": "Center intern", "고주파 안테나 설계 연구실 — 학부연구생": "RF Antenna Design Lab — Undergraduate researcher", "양봉 IoT, CST 안테나 설계": "Beekeeping IoT, CST antenna design", "강도현 <span": "Dohyun Kang <span", "<span class=\"meta\">Dohyun Kang</span>": "", "수상": "Awards"}, "ja": {"소속": "所属", "하는 일": "担当", "학력": "学歴", "연락": "連絡先", "이력서 보기": "履歴書", "이력": "経歴", "포트폴리오": "ポートフォリオ", "직접 개발하고 경험하며 PM의 길을 걷고 있습니다.": "自分で開発し、経験しながらPMの道を歩いています。", "제품·마케팅 기획, 팀 간 조율, 개발": "製品・マーケティング企画、チーム間の調整、開発", "제품·마케팅 기획, 팀 간 조율 / 개발": "製品・マーケティング企画、チーム間の調整 / 開発", "인천대학교 정보통신공학과 (학점 3.93 / 4.5)": "仁川大学 情報通信工学科（GPA 3.93 / 4.5）", "ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상": "ACK 2024 論文優秀賞 · ハニウム公募展 入選 · 産学キャップストーン 銀賞 · 現場実習手記コンテスト 最優秀賞", "C/C++ · 리눅스 커널 · 디바이스 드라이버": "C/C++ · Linuxカーネル · デバイスドライバ", "Telechips 아카데미": "Telechips アカデミー", "Techways — 현장실습": "Techways — 現場実習", "시험 자동화 도구 개발 (C#, LabVIEW)": "試験自動化ツール開発（C#, LabVIEW）", "한국알프스 — R": "韓国アルプス — R", "CAN/CAN FD 차량 스위치 검증": "CAN/CAN FD 車載スイッチ検証", "센터 인턴": "センター インターン", "고주파 안테나 설계 연구실 — 학부연구생": "高周波アンテナ設計研究室 — 学部研究生", "양봉 IoT, CST 안테나 설계": "養蜂IoT、CSTアンテナ設計", "강도현 <span": "カン・ドヒョン <span", "<span class=\"meta\">Dohyun Kang</span>": "", "수상": "受賞"}, "zh": {"소속": "公司", "하는 일": "工作内容", "학력": "学历", "연락": "联系", "이력서 보기": "简历", "이력": "经历", "포트폴리오": "作品集", "직접 개발하고 경험하며 PM의 길을 걷고 있습니다.": "一边亲手开发、积累经验，一边走PM的路。", "제품·마케팅 기획, 팀 간 조율, 개발": "产品与营销策划、跨团队协调、开发", "제품·마케팅 기획, 팀 간 조율 / 개발": "产品与营销策划、跨团队协调 / 开发", "인천대학교 정보통신공학과 (학점 3.93 / 4.5)": "仁川大学 信息通信工程系（GPA 3.93 / 4.5）", "ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상": "ACK 2024 论文优秀奖 · Hanium 竞赛入选 · 产学 Capstone 银奖 · 现场实习征文大赛 最优秀奖", "C/C++ · 리눅스 커널 · 디바이스 드라이버": "C/C++ · Linux 内核 · 设备驱动", "Telechips 아카데미": "Telechips 学院", "Techways — 현장실습": "Techways — 现场实习", "시험 자동화 도구 개발 (C#, LabVIEW)": "测试自动化工具开发（C#, LabVIEW）", "한국알프스 — R": "韩国阿尔卑斯 — R", "CAN/CAN FD 차량 스위치 검증": "CAN/CAN FD 车载开关验证", "센터 인턴": "中心实习生", "고주파 안테나 설계 연구실 — 학부연구생": "高频天线设计实验室 — 本科研究生", "양봉 IoT, CST 안테나 설계": "养蜂IoT、CST天线设计", "강도현 <span": "姜道贤 <span", "<span class=\"meta\">Dohyun Kang</span>": "", "수상": "获奖"}}[LANG];
      var s=app.innerHTML;Object.keys(AB).forEach(function(k){s=s.split(k).join(AB[k])});app.innerHTML=s;
      document.title=t('소개')+' · dohyun.log';
    }
    progress(false);deckInit('about');
  }


  // 스크롤 등장(홈·소개만, 글 본문 제외): JS가 클래스를 붙인 요소만 숨겼다가 한 번만 보여 줌
  var hdr=document.querySelector('header.top');
  function hs(){hdr.classList.toggle('sc',scrollY>8)}addEventListener('scroll',hs,{passive:true});hs();
  function reveal(){
    var els=[].slice.call(app.querySelectorAll('.feat,.row,.list>.lh,.side>*,.mem,.pager'));
    if(!els.length||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    document.documentElement.classList.add('rvj');
    var io=new IntersectionObserver(function(es){var n=0;es.forEach(function(e){if(e.isIntersecting){e.target.style.setProperty('--d',(n++*0.07)+'s');e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.05});
    els.forEach(function(el){el.classList.add('rv');io.observe(el)});
  }

  // 고정+스크롤 전환(홈 히어로·소개만). rAF 1개, passive scroll, transform/opacity만.
  // 폰은 카드 수는 그대로 두고, 스크롤마다 높이를 다시 재지 않는다(그게 끊김의 원인).
  var deck={kind:null,on:false,raf:0,els:null,idx:-1,fi:null,R:0,base:0,pk:-1},RM=matchMedia('(prefers-reduced-motion:reduce)');
  function clamp(x,a,b){return x<a?a:x>b?b:x}
  // 스크롤 길이(vh 단위) - 이 한 곳만 고치면 CSS 높이·버튼 이동·점·전환 임계값이 모두 따라감
  var DK_HOME=50,DK_HOME_M=45,DK_STEP=70,DK_N=3,DK_TAIL=35;
  function deckMode(){if(RM.matches)return '';if(innerWidth>=900)return innerHeight>=640?'full':'';return deck.kind==='home'?'m':''}
  function deckAllowed(){return !!deckMode()}
  function dvh(){return innerHeight/100}
  function homeR(d){return d.dk.offsetHeight-d.stage.offsetHeight}
  function deckQ(){
    var d=deck.els={};
    if(deck.kind==='home'){d.dk=app.querySelector('.dk');d.stage=app.querySelector('.dk-stage');d.hero=app.querySelector('.dk-stage .hero');d.grid=app.querySelector('.grid');
      d.items=[].slice.call(app.querySelectorAll('.grid .feat,.grid .list,.grid .side>*'));d.go=app.querySelector('.dk-go');if(!d.dk||!d.grid||!d.hero)return false}
    else{d.dk=app.querySelector('.adk');d.stage=app.querySelector('.adk-stage');d.sc=[].slice.call(app.querySelectorAll('.adk .sc'));d.dots=[].slice.call(app.querySelectorAll('.adots button'));d.wrap=app.querySelector('.adots');if(!d.dk||!d.sc.length)return false}
    return true;
  }
  function deckEnd(d){var r=d.dk.getBoundingClientRect(),R=homeR(d);scrollTo({top:scrollY+r.top-(60-R),behavior:'smooth'})}
  function d0(){return deck.els}
  function deckStart(){
    if(!deckQ())return;
    var m=deckMode()==='m';
    if(m&&d0().hero.offsetHeight+60+24>innerHeight){deck.els=null;reveal();return}
    deck.on=true;deck.idx=-1;deck.m=m;root.classList.add('dkon','dk-nt');if(m)root.classList.add('dkm');
    root.style.setProperty('--dkR',m?DK_HOME_M:DK_HOME);root.style.setProperty('--adkR',(DK_N-1)*DK_STEP+DK_TAIL);
    [].forEach.call(app.querySelectorAll('.rv'),function(el){el.classList.add('in')});
    var d=deck.els;
    if(deck.kind==='home'){
      d.go.onclick=function(){deckEnd(d)};
      deck.fi=function(){if(deck.on&&d.grid.style.transform){var r=d.dk.getBoundingClientRect(),R=homeR(d);scrollTo({top:scrollY+r.top-(60-R),behavior:'instant'})}};
      d.grid.addEventListener('focusin',deck.fi);
    }else d.dots.forEach(function(b,i){b.onclick=function(){scrollTo({top:scrollY+d.dk.getBoundingClientRect().top-60+i*DK_STEP*dvh()+2,behavior:'instant'})}});
    addEventListener('scroll',deckReq,{passive:true});
    deck.pk=-1;deckPin();deckUpdate();
    requestAnimationFrame(function(){requestAnimationFrame(function(){root.classList.remove('dk-nt')})});
  }
  function deckClear(){
    var d=deck.els;if(!d)return;
    if(deck.kind==='home'){[d.hero,d.grid].concat(d.items||[]).forEach(function(el){if(el){el.style.removeProperty('opacity');el.style.removeProperty('transform');el.style.removeProperty('pointer-events')}});if(d.grid){d.grid.classList.remove('dk-live');if(deck.fi)d.grid.removeEventListener('focusin',deck.fi)}}
    else{(d.sc||[]).forEach(function(el){el.classList.remove('on','past')});if(d.wrap)d.wrap.classList.remove('live')}
  }
  function deckStop(){
    if(deck.raf){cancelAnimationFrame(deck.raf);deck.raf=0}
    removeEventListener('scroll',deckReq);
    deckClear();deck.on=false;root.classList.remove('dkon','dk-nt','dkm');root.style.removeProperty('--dkR');root.style.removeProperty('--adkR');
  }
  function deckOff(){deckStop();deck.kind=null;deck.els=null}
  function deckInit(kind){deckOff();deck.kind=kind;if(deckAllowed())deckStart();else reveal()}
  function deckReq(){if(!deck.raf)deck.raf=requestAnimationFrame(function(){deck.raf=0;deckUpdate()})}
  function deckSync(){
    if(!deck.kind)return;
    var ok=deckAllowed();
    if(ok&&deck.on&&(deckMode()==='m')!==deck.m){deckStop();deckStart();return}
    if(ok&&deck.on&&deck.m&&deck.els&&deck.els.hero.offsetHeight+84>innerHeight){deckStop();reveal();return}
    if(ok&&!deck.on)deckStart();else if(!ok&&deck.on)deckStop();else if(ok){if(deck.on)deckPin();deckReq()}
  }
  function deckPin(){
    var d=deck.els;if(!d||!d.dk||!d.dk.isConnected)return;
    deck.R=Math.max(1,homeR(d));
    deck.base=scrollY+d.dk.getBoundingClientRect().top;
    deck.pk=-1;
  }
  addEventListener('resize',deckSync,{passive:true});
  if(RM.addEventListener)RM.addEventListener('change',deckSync);
  function deckUpdate(){
    var d=deck.els;if(!deck.on||!d||!d.dk.isConnected)return;
    var r=deck.m?null:d.dk.getBoundingClientRect();
    if(deck.kind==='home'){
      var R,top;
      if(deck.m){if(!deck.R)deckPin();R=deck.R;top=deck.base-scrollY}
      else{R=Math.max(1,homeR(d));top=r.top}
      var p=clamp((60-top)/R,0,1),hp=clamp(p/.5,0,1);
      if(deck.m){var pk=p*1000|0;if(pk===deck.pk)return;deck.pk=pk}
      d.hero.style.opacity=1-hp;d.hero.style.transform='translate3d(0,'+(-20*hp)+'px,0) scale('+(1-.04*hp)+')';d.hero.style.pointerEvents=hp>.5?'none':'auto';
      if(p>=1){d.grid.classList.remove('dk-live');d.grid.style.removeProperty('transform');d.grid.style.removeProperty('pointer-events');d.items.forEach(function(el){el.style.removeProperty('opacity');el.style.removeProperty('transform')})}
      else{
        d.grid.classList.add('dk-live');d.grid.style.transform='translate3d(0,'+(-(1-p)*R)+'px,0)';d.grid.style.pointerEvents=p<.6?'none':'auto';
        d.items.forEach(function(el,i){var l=clamp((p-.36-i*.035)/.4,0,1),e=1-Math.pow(1-l,3);el.style.opacity=e;el.style.transform='translate3d(0,'+(40*(1-e))+'px,0)'});
      }
    }else{
      var n=d.sc.length,rr=clamp(60-r.top,0,1e9),i=clamp(Math.floor(rr/(innerHeight*DK_STEP/100)),0,n-1);
      if(i!==deck.idx){deck.idx=i;d.sc.forEach(function(el,k){el.classList.toggle('on',k===i);el.classList.toggle('past',k<i)});d.dots.forEach(function(b,k){b.classList.toggle('on',k===i)})}
      d.wrap.classList.toggle('live',r.top<=70&&r.bottom>=innerHeight*.7);
    }
  }
  var onScroll=null;
  function progress(on){
    if(onScroll)removeEventListener('scroll',onScroll);onScroll=null;prog.style.width='0';
    if(!on)return;
    onScroll=function(){var h=document.documentElement.scrollHeight-innerHeight;prog.style.width=(h>0?Math.min(100,scrollY/h*100):0)+'%'};
    addEventListener('scroll',onScroll,{passive:true});onScroll();
  }

  function post(slug){
    var i=posts.map(function(x){return x.slug}).indexOf(slug),p=posts[i];
    if(!p){app.innerHTML='<p class="empty">'+t('글을 찾을 수 없어요.')+'</p>';return}
    document.title=pt(p)+' · dohyun.log';
    var older=posts[i+1],newer=posts[i-1];
    app.innerHTML='<article class="bpost"><h1>'+esc(pt(p))+'</h1>'+(ps(p)?'<p class="bsub">'+esc(ps(p))+'</p>':'')+'<p class="bby"><a class="bav" href="#/about"><img src="img/me.jpg" alt=""></a>by <a href="#/about">'+t('강도현')+'</a><span>'+bdate(p.date)+'</span><span id="rt"></span></p>'+
      '<div class="pbody" id="body">'+t('불러오는 중…')+'</div><div class="bkeys"><strong>keyword</strong>'+(p.series?'<a href="#/series/'+encodeURIComponent(p.series)+'">'+esc(t(p.series))+'</a>':'')+p.tags.map(function(x){return'<a href="#/tag/'+encodeURIComponent(x)+'">'+esc(t(x))+'</a>'}).join('')+'</div>'+
      '<div class="bnav">'+(older?'<a href="'+link(older)+'"><span>'+t('← 이전 글')+'</span>'+esc(pt(older))+'</a>':'<span></span>')+(newer?'<a class="bnext" href="'+link(newer)+'"><span>'+t('다음 글 →')+'</span>'+esc(pt(newer))+'</a>':'<span></span>')+'</div>'+
      '<p class="blinks"><button type="button" id="cplink">'+t('링크 복사')+'</button><a href="#/">'+t('← 목록')+'</a></p><section class="bmail" id="cmt"></section></article>';
    document.getElementById('cplink').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(location.href):Promise.reject()).then(function(){b.textContent=t('복사됨 ✓')},function(){b.textContent=t('주소창에서 복사해 주세요')})};
    fetch('posts/'+encodeURIComponent(p.slug)+(LANG!=='ko'?'.'+LANG:'')+'.md').then(function(r){if(!r.ok)throw 0;return r.text()}).catch(function(){return fetch('posts/'+encodeURIComponent(p.slug)+'.md').then(function(r){return r.text()})}).then(function(md){
      var b=document.getElementById('body');b.innerHTML=marked.parse(md);[].forEach.call(b.querySelectorAll('img'),function(im){im.loading='lazy';im.decoding='async'});[].forEach.call(b.querySelectorAll('details'),function(d){d.open=true});
      document.getElementById('rt').textContent=mins(b.textContent)+t('분 읽기');
      [].forEach.call(b.querySelectorAll('h2,h3'),function(h,k){h.id='h'+k});
      [].forEach.call(b.querySelectorAll('pre'),function(pre){var c=document.createElement('button');c.className='cp';c.textContent=t('복사');c.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(pre.querySelector('code').textContent);c.textContent='✓';setTimeout(function(){c.textContent=t('복사')},1200)};pre.appendChild(c)});
      scrollTo(0,0);
    }).catch(function(){var bb=document.getElementById('body');if(bb)bb.textContent=errMsg()});
    progress(true);
    contact(pt(p));
  }

  // 댓글 대신 메일
  function contact(title){
    var el=document.getElementById('cmt'),sub=encodeURIComponent('[블로그] '+title);
    el.innerHTML='<h2>'+t('이 글 어떠셨나요?')+'</h2><p class="note">'+t('댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.')+'</p>'+
      '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:0"><a class="btn pri" href="mailto:'+MAIL+'?subject='+sub+'">'+t('메일 보내기')+'</a>'+
      '<a class="btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&to='+MAIL+'&su='+sub+'">'+t('Gmail로 쓰기')+'</a>'+
      '<button class="btn" id="cpm" type="button">'+MAIL+' 복사</button></p>';
    document.getElementById('cpm').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(MAIL):Promise.reject()).then(function(){b.textContent='복사됨 ✓'},function(){b.textContent=MAIL})};
  }

  function lightbox(){
    var b=document.getElementById('av');if(!b)return;
    b.onclick=function(){
      var o=document.createElement('div');o.className='lb-ov';o.innerHTML='<img src="img/me.jpg" alt="강도현">';
      function close(){o.remove();removeEventListener('keydown',k)}
      function k(e){if(e.key==='Escape')close()}
      o.onclick=close;addEventListener('keydown',k);document.body.appendChild(o);
    };
  }
  function route(){
    deckOff();chrome();setTimeout(lightbox,0);var h=location.hash,m;
    if(m=h.match(/^#\/post\/(.+)$/))post(decodeURIComponent(m[1]));
    else if(m=h.match(/^#\/tag\/(.+)$/)){var t=decodeURIComponent(m[1]);home(function(p){return p.tags.indexOf(t)>=0},'#'+t,'t:'+t)}
    else if(m=h.match(/^#\/series\/(.+)$/)){var s=decodeURIComponent(m[1]);var pg0=TREE.filter(function(x){return x[1].indexOf(s)>-1})[0];home(function(p){return p.series===s},(pg0?pg0[0]+' › ':'')+s,'s:'+s)}
    else if(m=h.match(/^#\/cat\/(.+)$/)){var c=decodeURIComponent(m[1]),g=TREE.filter(function(x){return x[0]===c})[0];home(function(p){return g&&g[1].indexOf(p.series)>-1},c,'c:'+c)}
    else if(h==='#/about')about();
    else home(null,'전체 글','');
    document.querySelectorAll('.hd nav a').forEach(function(a){a.classList.toggle('on',a.getAttribute('href')===(h==='#/about'?'#/about':(h.indexOf('#/post')===0?'':'#/')))});
    if(h.indexOf('#/post')!==0)scrollTo(0,0);
  }
  fetch('posts/index.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){posts=d.sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0});
    // 사진 없는 글은 오래된 글부터 순서대로 사진 13장을 돌려 붙임 → 이웃한 글끼리 안 겹치고, 새 글이 생겨도 기존 글 사진은 그대로
    var k=0;var ORD=[2,8,9,4,10,11,3,12,13,5,6,7,1];posts.slice().reverse().forEach(function(p){if(!p.thumb)p.auto='img/th/t'+ORD[k++%ORD.length]+'.jpg'});route()}).catch(function(){app.innerHTML='<p class="empty">'+errMsg()+'</p>'});
  addEventListener('hashchange',route);
})();
