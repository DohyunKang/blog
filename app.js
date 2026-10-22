(function(){
  var app=document.getElementById('app'),posts=[],cfg=window.BLOG_CFG||{},prog=document.getElementById('prog');
  var state={q:''};
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
  function cover(p){var h=hash(p.slug)%360;return'background:linear-gradient(135deg,hsl('+h+',55%,32%),hsl('+((h+60)%360)+',60%,22%))'}
  function mins(t){return Math.max(1,Math.round(t.replace(/\s+/g,'').length/500))}

  // 테마
  var root=document.documentElement,tb=document.getElementById('theme');
  try{var sv=localStorage.getItem('blog-theme');if(sv)root.dataset.theme=sv}catch(e){}
  tb.onclick=function(){var l=root.dataset.theme==='light';root.dataset.theme=l?'dark':'light';try{localStorage.setItem('blog-theme',root.dataset.theme)}catch(e){}};

  function counts(key){var m={};posts.forEach(function(p){(key==='tags'?p.tags:(p.series?[p.series]:[])).forEach(function(x){m[x]=(m[x]||0)+1})});return m}
  function side(cur){
    var tg=counts('tags'),sr=counts('series');
    return '<aside class="side"><div class="glass prof"><div class="ph one"><img src="img/me.jpg" alt="강도현"></div><div><h2>강도현</h2><p>직접 만들어 보며 배우고,<br>배운 걸 기록합니다.</p>'+
      '<div class="links"><a href="https://dohyunkang.github.io/">포트폴리오</a><a href="https://dohyunkang.github.io/resume.html">이력서</a><a href="https://github.com/DohyunKang">GitHub</a></div></div></div>'+
      '<div class="glass box"><h3>Tags</h3><div class="chips"><a class="chip'+(!cur?' on':'')+'" href="#/">전체<b>'+posts.length+'</b></a>'+
      Object.keys(tg).map(function(t){return'<a class="chip'+(cur==='t:'+t?' on':'')+'" href="#/tag/'+encodeURIComponent(t)+'">#'+esc(t)+'<b>'+tg[t]+'</b></a>'}).join('')+'</div></div>'+
      (Object.keys(sr).length?'<div class="glass box ser"><h3>Series</h3>'+Object.keys(sr).map(function(s){return'<a href="#/series/'+encodeURIComponent(s)+'"><span>'+esc(s)+'</span><b>'+sr[s]+'</b></a>'}).join('')+'</div>':'')+'</aside>';
  }
  function card(p){
    return'<a class="glass card" href="#/post/'+encodeURIComponent(p.slug)+'"><div class="cov" style="'+cover(p)+'">'+esc(p.emoji||'📝')+(p.series?'<small>'+esc(p.series)+'</small>':'')+'</div>'+
      '<div class="cb"><h2>'+(p.pinned?'<span class="pin">📌 </span>':'')+esc(p.title)+'</h2><p>'+esc(p.summary)+'</p><span class="meta">'+esc(p.date)+p.tags.map(function(x){return'<i>#'+esc(x)+'</i>'}).join('')+'</span></div></a>';
  }
  function home(filter,title,cur){
    document.title='도현의 블로그';
    var q=state.q.toLowerCase();
    var shown=posts.filter(function(p){return(!filter||filter(p))&&(!q||(p.title+p.summary+p.tags.join(' ')).toLowerCase().indexOf(q)>=0)});
    shown.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0)||(a.date<b.date?1:-1)});
    var sr=Object.keys(counts('series')).length,tgn=Object.keys(counts('tags')).length;
    var mast=(!filter&&!q)?'<section class="glass mast"><div><p class="eyebrow">dohyun&#39;s log</p><h1>만들면서 배운 것들을<br>기록합니다</h1><p class="lead">직접 해 보고, 막히고, 알게 된 것. 결과는 포트폴리오에, 과정은 여기에 적어 둡니다.</p><div class="stat"><div><b>'+posts.length+'</b>글</div><div><b>'+sr+'</b>시리즈</div><div><b>'+tgn+'</b>태그</div></div><div class="act"><a class="btn pri" href="#/about">소개 보기</a><a class="btn" href="https://dohyunkang.github.io/">포트폴리오</a></div></div></section>':'';
    app.innerHTML=mast+'<div class="grid">'+side(cur)+'<section><div class="sech"><h1>'+esc(title)+' <span class="meta">'+shown.length+'개</span></h1><input id="q" type="search" placeholder="글 검색" value="'+esc(state.q)+'"></div>'+
      (shown.length?'<div class="cards">'+shown.map(card).join('')+'</div>':'<p class="empty">맞는 글이 없어요.</p>')+'</section></div>';
    var qi=document.getElementById('q');
    qi.oninput=function(){state.q=qi.value.trim();var pos=qi.selectionStart;home(filter,title,cur);var n=document.getElementById('q');n.focus();n.setSelectionRange(pos,pos)};
    progress(false);
  }
  function about(){
    document.title='소개 · 도현의 블로그';
    // 프로필 소개 사진: 이 목록의 사진이 교차 전환됨
    var pics=['img/p1.jpg','img/p2.jpg'];
    var imgs=pics.map(function(u,i){return'<img src="'+u+'" alt="'+(i?'':'강도현')+'" style="animation-duration:'+(pics.length*7)+'s;animation-delay:-'+(i*7)+'s">'}).join('');
    function li(t,d,x){return'<li><small>'+d+'</small><b>'+t+'</b><span>'+x+'</span></li>'}
    app.innerHTML='<div class="glass mem"><div class="frame"><div class="ph">'+imgs+'</div></div><div>'+
      '<p class="role">Junior PM · AI/AX</p><h1>강도현 <span class="meta">Dohyun Kang</span></h1><p class="tagl">직접 개발하고 경험하며 PM의 길을 걷고 있습니다.</p>'+
      '<dl class="kv"><dt>소속</dt><dd>Allie Research Inc.</dd><dt>하는 일</dt><dd>제품·마케팅 기획, 팀 간 조율, 개발</dd><dt>학력</dt><dd>인천대학교 정보통신공학과 (학점 3.93 / 4.5)</dd><dt>수상</dt><dd>ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상</dd><dt>연락</dt><dd>kid708502@gmail.com</dd></dl>'+
      '<h3>이력</h3><ul class="tl">'+
      li('Allie Research Inc. — Junior PM','2026.08 –','제품·마케팅 기획, 팀 간 조율 / 개발')+
      li('Telechips 아카데미','2026.02 – 2026.05','C/C++ · 리눅스 커널 · 디바이스 드라이버')+
      li('Techways — 현장실습','2024.08 – 2025.02','시험 자동화 도구 개발 (C#, LabVIEW)')+
      li('한국알프스 — R&D 센터 인턴','2024.01 – 2024.02','CAN/CAN FD 차량 스위치 검증')+
      li('고주파 안테나 설계 연구실 — 학부연구생','2022.09 – 2023.12','양봉 IoT, CST 안테나 설계')+
      '</ul><p style="margin:18px 0 0"><a class="btn pri" href="https://dohyunkang.github.io/resume.html">이력서 보기</a> <a class="btn" href="https://dohyunkang.github.io/">포트폴리오</a> <a class="btn" href="https://github.com/DohyunKang">GitHub</a></p></div></div>';
    progress(false);
  }

  // 읽기 진행바
  var onScroll=null;
  function progress(on){
    if(onScroll)removeEventListener('scroll',onScroll);onScroll=null;prog.style.width='0';
    if(!on)return;
    onScroll=function(){var h=document.documentElement.scrollHeight-innerHeight;prog.style.width=(h>0?Math.min(100,scrollY/h*100):0)+'%'};
    addEventListener('scroll',onScroll,{passive:true});onScroll();
  }

  function post(slug){
    var i=posts.map(function(x){return x.slug}).indexOf(slug),p=posts[i];
    if(!p){app.innerHTML='<div class="wrap"><p class="empty">글을 찾을 수 없어요.</p></div>';return}
    document.title=p.title+' · 도현의 블로그';
    app.innerHTML='<div class="pgrid"><div><article class="glass post"><div class="phead" style="'+cover(p)+'"><div class="emoji">'+esc(p.emoji||'📝')+'</div><h1>'+esc(p.title)+'</h1><div class="meta" style="color:rgba(255,255,255,.75)" id="pm">'+esc(p.date)+p.tags.map(function(x){return' · #'+esc(x)}).join('')+'</div></div>'+
      '<div class="pbody" id="body">불러오는 중…</div><div class="share"><button class="btn" id="cplink">🔗 링크 복사</button><a class="btn" href="#/">← 목록</a></div></article>'+
      '<div class="pn">'+(posts[i+1]?'<a class="glass" href="#/post/'+encodeURIComponent(posts[i+1].slug)+'"><small>← 이전 글</small>'+esc(posts[i+1].title)+'</a>':'<span></span>')+(posts[i-1]?'<a class="glass" href="#/post/'+encodeURIComponent(posts[i-1].slug)+'"><small>다음 글 →</small>'+esc(posts[i-1].title)+'</a>':'<span></span>')+'</div>'+
      '<section class="glass cmt" id="cmt"></section></div><aside class="glass toc" id="toc"><h3>목차</h3></aside></div>';
    document.getElementById('cplink').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(location.href):Promise.reject()).then(function(){b.textContent='복사됨 ✓'},function(){b.textContent='주소창에서 복사해 주세요'})};
    fetch('posts/'+encodeURIComponent(p.slug)+'.md').then(function(r){return r.text()}).then(function(md){
      var b=document.getElementById('body');b.innerHTML=marked.parse(md);
      document.getElementById('pm').textContent+=' · '+mins(b.textContent)+'분 읽기';
      var toc=document.getElementById('toc'),hs=b.querySelectorAll('h2,h3'),links=[];
      [].forEach.call(hs,function(h,k){h.id='h'+k;var a=document.createElement('a');a.href='javascript:void 0';a.textContent=h.textContent;a.className=h.tagName==='H3'?'l3':'';a.onclick=function(){h.scrollIntoView({behavior:'smooth'})};toc.appendChild(a);links.push(a)});
      if(!hs.length)toc.style.display='none';
      [].forEach.call(b.querySelectorAll('pre'),function(pre){var c=document.createElement('button');c.className='cp';c.textContent='복사';c.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(pre.querySelector('code').textContent);c.textContent='✓';setTimeout(function(){c.textContent='복사'},1200)};pre.appendChild(c)});
      function spy(){var k=0;[].forEach.call(hs,function(h,n){if(h.getBoundingClientRect().top<120)k=n});links.forEach(function(a,n){a.classList.toggle('on',n===k)})}
      addEventListener('scroll',spy,{passive:true});spy();
      scrollTo(0,0);
    });
    progress(true);
    contact(p.title);
  }

  // ───── 댓글 대신 연락: 글을 읽고 하고 싶은 말은 메일로 ─────
  var MAIL='kid708502@gmail.com';
  function contact(title){
    var el=document.getElementById('cmt'),sub=encodeURIComponent('[블로그] '+title);
    el.innerHTML='<h2>✉️ 이 글 어떠셨나요?</h2><p class="note">댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.</p>'+
      '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:0"><a class="btn pri" href="mailto:'+MAIL+'?subject='+sub+'">메일 보내기</a>'+
      '<a class="btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&to='+MAIL+'&su='+sub+'">Gmail로 쓰기</a>'+
      '<button class="btn" id="cpm" type="button">'+MAIL+' 복사</button></p>';
    document.getElementById('cpm').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(MAIL):Promise.reject()).then(function(){b.textContent='복사됨 ✓'},function(){b.textContent=MAIL})};
  }

  function route(){
    var h=location.hash,m;state.q=state.q;
    if(m=h.match(/^#\/post\/(.+)$/))post(decodeURIComponent(m[1]));
    else if(m=h.match(/^#\/tag\/(.+)$/)){var t=decodeURIComponent(m[1]);home(function(p){return p.tags.indexOf(t)>=0},'#'+t,'t:'+t)}
    else if(m=h.match(/^#\/series\/(.+)$/)){var s=decodeURIComponent(m[1]);home(function(p){return p.series===s},'📚 '+s,'s:'+s)}
    else if(h==='#/about')about();
    else home(null,'전체 글','');
    document.querySelectorAll('.hd nav a').forEach(function(a){a.classList.toggle('on',a.getAttribute('href')===(h==='#/about'?'#/about':(h.indexOf('#/post')===0||h.indexOf('#/tag')===0||h.indexOf('#/series')===0?'':'#/')))});
    if(h.indexOf('#/post')!==0)scrollTo(0,0);
  }
  fetch('posts/index.json').then(function(r){return r.json()}).then(function(d){posts=d.sort(function(a,b){return a.date<b.date?1:-1});route()});
  addEventListener('hashchange',route);
})();
