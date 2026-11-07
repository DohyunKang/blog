/* 블로그 배경 — 지식그래프처럼 노드와 선이 아주 옅게 천천히 떠다님 (포트폴리오의 로고 배경과 다른 배경) */
(function () {
  var cv = document.createElement('canvas');
  cv.id = 'bgg';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, nodes = [], raf = 0;
  var WORDS = ['LLM', 'RAG', 'SQL', 'TCP', 'OS', 'API', 'graph', 'agent', 'embed', 'MCP', 'CPU', 'DB', 'eval', 'cache', 'C++', 'trace', 'node', 'edge'];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var inkC = [20, 20, 20];
  function readInk() {
    var c = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#141414';
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (!m) { inkC = [20, 20, 20]; return; }
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    inkC = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function build() {
    var narrow = window.innerWidth < 900;
    dpr = narrow ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = W < 700 ? 16 : Math.round(Math.min(34, W * H / 38000));
    nodes = [];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 0.05 + Math.random() * 0.1;
      nodes.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 3,
        w: Math.random() < 0.38 ? WORDS[(Math.random() * WORDS.length) | 0] : ''
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var c = inkC, link = Math.min(190, Math.max(130, W / 7)), i, j, a, b, dx, dy, d;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (!reduce) {
        a.x += a.vx; a.y += a.vy;
        if (a.x < -20) a.x = W + 20; else if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20; else if (a.y > H + 20) a.y = -20;
      }
    }
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < link) {
          ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.13 * (1 - d / link)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    ctx.font = '500 11px Pretendard Variable, Pretendard, sans-serif';
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.15)';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      if (a.w) {
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.24)';
        ctx.fillText(a.w, a.x + a.r + 6, a.y + 4);
      }
    }
  }

  var last = 0, paused = false, scrollT = 0;
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (window.innerWidth < 900 && ts - last < 32) return;
    last = ts;
    draw();
  }
  function start() { cancelAnimationFrame(raf); paused = false; build(); readInk(); if (reduce) draw(); else loop(0); }

  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(start, 200); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelAnimationFrame(raf); else if (!reduce && !paused) loop(0);
  });
  window.addEventListener('scroll', function () {
    if (window.innerWidth >= 900 || reduce) return;
    if (!paused) { paused = true; cancelAnimationFrame(raf); }
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      paused = false;
      if (!document.hidden && !reduce) loop(0);
    }, 180);
  }, { passive: true });
  if (window.MutationObserver) {
    new MutationObserver(function () { readInk(); if (paused || reduce) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  start();
})();
