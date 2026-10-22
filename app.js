(function(){
  var app=document.getElementById('app'),posts=[],prog=document.getElementById('prog'),state={q:''},MAIL='kid708502@gmail.com';
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)}
  // 썸네일: 같은 야경 사진을 글마다 다른 부분으로 잘라 색을 입힘 — 이모지·무지개 그라데이션 없이 사이트와 한 톤
  function thumb(p,extra){
    if(p.thumb)return'<div class="th'+(extra||'')+' real" style="background-image:url('+p.thumb+');background-size:'+(p.size||'cover')+';background-position:'+(p.pos||'center')+'"></div>';
    var h=hash(p.slug),hue=(h%80)+215,x=(h%90)+5,y=(h>>3)%70+15;
    return'<div class="th'+(extra||'')+'" style="background-image:linear-gradient(135deg,hsla('+hue+',75%,52%,.5),hsla('+(hue+40)+',70%,22%,.62)),url(img/night.jpg);background-size:cover,auto 380%;background-position:center,'+x+'% '+y+'%"></div>';
  }
  function mins(t){return Math.max(1,Math.round(t.replace(/\s+/g,'').length/500))}
  function counts(key){var m={};posts.forEach(function(p){(key==='tags'?p.tags:(p.series?[p.series]:[])).forEach(function(x){m[x]=(m[x]||0)+1})});return m}
  function link(p){return'#/post/'+encodeURIComponent(p.slug)}

  // 테마
  var root=document.documentElement,tb=document.getElementById('theme');
  try{var sv=localStorage.getItem('blog-theme');if(sv)root.dataset.theme=sv}catch(e){}
  tb.onclick=function(){var l=root.dataset.theme==='light';root.dataset.theme=l?'dark':'light';try{localStorage.setItem('blog-theme',root.dataset.theme)}catch(e){}};

  function side(cur){
    var tg=counts('tags'),sr=counts('series'),rec=posts.slice(0,4);
    return'<aside class="side"><div class="glass prof"><div class="ph one"><img src="img/me.jpg" alt="강도현"></div><div><h2>강도현</h2><p>직접 만들어 보며 배우고, 기록합니다.</p>'+
      '<div class="lk"><a href="#/about">소개</a><a href="https://dohyunkang.github.io/">포트폴리오</a><a href="mailto:'+MAIL+'">메일</a></div></div></div>'+
      '<div class="glass box rank"><h3>최근 글</h3>'+rec.map(function(p,i){return'<a href="'+link(p)+'"><b>'+(i+1)+'</b><span>'+esc(p.title)+'</span></a>'}).join('')+'</div>'+
      '<div class="glass box"><h3>태그</h3><div class="chips"><a class="chip'+(!cur?' on':'')+'" href="#/">전체<b>'+posts.length+'</b></a>'+
      Object.keys(tg).map(function(t){return'<a class="chip'+(cur==='t:'+t?' on':'')+'" href="#/tag/'+encodeURIComponent(t)+'">#'+esc(t)+'<b>'+tg[t]+'</b></a>'}).join('')+'</div></div>'+
      (Object.keys(sr).length?'<div class="glass box ser"><h3>시리즈</h3>'+Object.keys(sr).map(function(s){return'<a href="#/series/'+encodeURIComponent(s)+'"><span>'+esc(s)+'</span><b>'+sr[s]+'</b></a>'}).join('')+'</div>':'')+'</aside>';
  }
  function row(p){
    return'<a class="row" href="'+link(p)+'"><div><div class="cat">'+(p.series?'<em class="sr" style="font-style:normal">'+esc(p.series)+'</em>':'')+p.tags.map(function(x){return'<span>#'+esc(x)+'</span>'}).join('')+'</div>'+
      '<h2>'+(p.pinned?'<span class="pin">고정</span>':'')+esc(p.title)+'</h2><p>'+esc(p.summary)+'</p><span class="meta">'+esc(p.date)+'</span></div>'+thumb(p)+'</a>';
  }
  function home(filter,title,cur){
    document.title='dohyun.log';
    var q=state.q.toLowerCase();
    var shown=posts.filter(function(p){return(!filter||filter(p))&&(!q||(p.title+p.summary+p.tags.join(' ')).toLowerCase().indexOf(q)>=0)});
    shown.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0)||(a.date<b.date?1:-1)});
    var top=(!filter&&!q)?shown[0]:null,rest=top?shown.slice(1):shown;
    var hero=(!filter&&!q)?'<section class="hero"><p class="eb">DOHYUN.LOG</p><h1>만들면서 배운 것들을<br>기록합니다</h1><p>직접 해 보고, 막히고, 알게 된 것. 결과는 포트폴리오에, 과정은 여기에 적어 둡니다.</p><div class="st"><b>'+posts.length+'</b>글 · <b>'+Object.keys(counts('series')).length+'</b>시리즈 · <b>'+Object.keys(counts('tags')).length+'</b>태그</div></section>':'<section class="hero" style="padding-bottom:20px"><h1 style="font-size:2rem">'+esc(title)+'</h1></section>';
    var feat=top?'<a class="glass feat" href="'+link(top)+'">'+thumb(top)+'<div class="fb"><div class="lb">'+(top.pinned?'PINNED':'LATEST')+'</div><h2>'+esc(top.title)+'</h2><p>'+esc(top.summary)+'</p><span class="meta">'+esc(top.date)+top.tags.map(function(x){return' · #'+esc(x)}).join('')+'</span></div></a>':'';
    app.innerHTML=hero+'<div class="grid"><section>'+feat+'<div class="glass list"><div class="lh"><h3>'+(top?'전체 글':'글')+' <span class="meta">'+shown.length+'</span></h3><input id="q" type="search" placeholder="검색" value="'+esc(state.q)+'"></div>'+
      (rest.length?rest.map(row).join(''):'<p class="empty">'+(shown.length?'':'맞는 글이 없어요.')+'</p>')+'</div></section>'+side(cur)+'</div>';
    var qi=document.getElementById('q');
    qi.oninput=function(){state.q=qi.value.trim();var pos=qi.selectionStart;home(filter,title,cur);var n=document.getElementById('q');n.focus();n.setSelectionRange(pos,pos)};
    progress(false);
  }

  // 소개 = 회사 임직원 프로필 페이지처럼
  function about(){
    document.title='소개 · dohyun.log';
    var pics=['img/p1.jpg','img/p2.jpg'];
    var imgs=pics.map(function(u,i){return'<img src="'+u+'" alt="'+(i?'':'강도현')+'" style="animation-duration:'+(pics.length*7)+'s;animation-delay:-'+(i*7)+'s">'}).join('');
    function li(t,d,x){return'<li><small>'+d+'</small><b>'+t+'</b><span>'+x+'</span></li>'}
    app.innerHTML='<div class="glass mem"><div class="frame"><div class="ph">'+imgs+'</div></div><div>'+
      '<p class="role">JUNIOR PM · AI/AX</p><h1>강도현 <span class="meta">Dohyun Kang</span></h1><p class="tagl">직접 개발하고 경험하며 PM의 길을 걷고 있습니다.</p>'+
      '<dl class="kv"><dt>소속</dt><dd>Allie Research Inc.</dd><dt>하는 일</dt><dd>제품·마케팅 기획, 팀 간 조율, 개발</dd><dt>학력</dt><dd>인천대학교 정보통신공학과 (학점 3.93 / 4.5)</dd><dt>수상</dt><dd>ACK 2024 논문 우수상 · 한이음 공모전 입선 · 산학 캡스톤 은상 · 현장실습 수기공모전 최우수상</dd><dt>연락</dt><dd>'+MAIL+'</dd></dl>'+
      '<h3>이력</h3><ul class="tl">'+
      li('Allie Research Inc. — Junior PM','2026.08 –','제품·마케팅 기획, 팀 간 조율 / 개발')+
      li('Telechips 아카데미','2026.02 – 2026.05','C/C++ · 리눅스 커널 · 디바이스 드라이버')+
      li('Techways — 현장실습','2024.08 – 2025.02','시험 자동화 도구 개발 (C#, LabVIEW)')+
      li('한국알프스 — R&D 센터 인턴','2024.01 – 2024.02','CAN/CAN FD 차량 스위치 검증')+
      li('고주파 안테나 설계 연구실 — 학부연구생','2022.09 – 2023.12','양봉 IoT, CST 안테나 설계')+
      '</ul><p style="margin:18px 0 0"><a class="btn pri" href="https://dohyunkang.github.io/resume.html">이력서 보기</a> <a class="btn" href="https://dohyunkang.github.io/">포트폴리오</a> <a class="btn" href="https://github.com/DohyunKang">GitHub</a></p></div></div>';
    progress(false);
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
    if(!p){app.innerHTML='<p class="empty">글을 찾을 수 없어요.</p>';return}
    document.title=p.title+' · dohyun.log';
    app.innerHTML='<div class="pgrid"><div><article class="glass post"><div class="ph0 cat">'+(p.series?'<em class="sr" style="font-style:normal">'+esc(p.series)+'</em>':'')+p.tags.map(function(x){return'<span>#'+esc(x)+'</span>'}).join('')+'</div>'+
      '<h1>'+esc(p.title)+'</h1>'+thumb(p,' cover')+'<div class="by"><div class="ph one"><img src="img/me.jpg" alt=""></div><span><b>강도현</b> · '+esc(p.date)+' · <span id="rt"></span></span></div>'+
      '<div class="pbody" id="body">불러오는 중…</div><div class="share"><button class="btn" id="cplink" type="button">링크 복사</button><a class="btn" href="#/">← 목록</a></div></article>'+
      '<div class="pn">'+(posts[i+1]?'<a class="glass" href="'+link(posts[i+1])+'"><small>← 이전 글</small>'+esc(posts[i+1].title)+'</a>':'<span></span>')+(posts[i-1]?'<a class="glass" href="'+link(posts[i-1])+'"><small>다음 글 →</small>'+esc(posts[i-1].title)+'</a>':'<span></span>')+'</div>'+
      '<section class="glass cmt" id="cmt"></section></div><aside class="glass toc" id="toc"><h3>목차</h3></aside></div>';
    document.getElementById('cplink').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(location.href):Promise.reject()).then(function(){b.textContent='복사됨 ✓'},function(){b.textContent='주소창에서 복사해 주세요'})};
    fetch('posts/'+encodeURIComponent(p.slug)+'.md').then(function(r){return r.text()}).then(function(md){
      var b=document.getElementById('body');b.innerHTML=marked.parse(md);
      document.getElementById('rt').textContent=mins(b.textContent)+'분 읽기';
      var toc=document.getElementById('toc'),hs=b.querySelectorAll('h2,h3'),links=[];
      [].forEach.call(hs,function(h,k){h.id='h'+k;var a=document.createElement('a');a.textContent=h.textContent;a.className=h.tagName==='H3'?'l3':'';a.onclick=function(){h.scrollIntoView({behavior:'smooth'})};toc.appendChild(a);links.push(a)});
      if(!hs.length)toc.style.display='none';
      [].forEach.call(b.querySelectorAll('pre'),function(pre){var c=document.createElement('button');c.className='cp';c.textContent='복사';c.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(pre.querySelector('code').textContent);c.textContent='✓';setTimeout(function(){c.textContent='복사'},1200)};pre.appendChild(c)});
      function spy(){var k=0;[].forEach.call(hs,function(h,n){if(h.getBoundingClientRect().top<120)k=n});links.forEach(function(a,n){a.classList.toggle('on',n===k)})}
      addEventListener('scroll',spy,{passive:true});spy();
      scrollTo(0,0);
    });
    progress(true);
    contact(p.title);
  }

  // 댓글 대신 메일
  function contact(title){
    var el=document.getElementById('cmt'),sub=encodeURIComponent('[블로그] '+title);
    el.innerHTML='<h2>이 글 어떠셨나요?</h2><p class="note">댓글 대신 메일로 받고 있어요. 의견·질문·잡담 모두 환영합니다.</p>'+
      '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:0"><a class="btn pri" href="mailto:'+MAIL+'?subject='+sub+'">메일 보내기</a>'+
      '<a class="btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&to='+MAIL+'&su='+sub+'">Gmail로 쓰기</a>'+
      '<button class="btn" id="cpm" type="button">'+MAIL+' 복사</button></p>';
    document.getElementById('cpm').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(MAIL):Promise.reject()).then(function(){b.textContent='복사됨 ✓'},function(){b.textContent=MAIL})};
  }

  function route(){
    var h=location.hash,m;
    if(m=h.match(/^#\/post\/(.+)$/))post(decodeURIComponent(m[1]));
    else if(m=h.match(/^#\/tag\/(.+)$/)){var t=decodeURIComponent(m[1]);home(function(p){return p.tags.indexOf(t)>=0},'#'+t,'t:'+t)}
    else if(m=h.match(/^#\/series\/(.+)$/)){var s=decodeURIComponent(m[1]);home(function(p){return p.series===s},s,'s:'+s)}
    else if(h==='#/about')about();
    else home(null,'전체 글','');
    document.querySelectorAll('.hd nav a').forEach(function(a){a.classList.toggle('on',a.getAttribute('href')===(h==='#/about'?'#/about':(h.indexOf('#/post')===0?'':'#/')))});
    if(h.indexOf('#/post')!==0)scrollTo(0,0);
  }
  fetch('posts/index.json').then(function(r){return r.json()}).then(function(d){posts=d.sort(function(a,b){return a.date<b.date?1:-1});route()});
  addEventListener('hashchange',route);
})();
