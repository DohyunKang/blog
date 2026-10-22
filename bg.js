// 야경 배경: 실제 야경 사진(홍콩, CC BY-SA 4.0) 위에 마우스·스크롤 시차 + 가끔 별똥별.
(function(){
  var city=document.getElementById('city');
  city.innerHTML='<div class="photo" id="ph0"></div><div class="veil"></div>';
  var p=document.getElementById('ph0'),mx=0,my=0,sy=0,tx=0,ty=0,raf=0;
  function loop(){
    // 부드럽게 따라오는 움직임(관성)
    tx+=(mx-tx)*.06;ty+=(my-ty)*.06;
    p.style.transform='translate3d('+(tx*-34).toFixed(1)+'px,'+(ty*-22-sy*.04).toFixed(1)+'px,0) scale(1.1)';
    raf=requestAnimationFrame(loop);
  }
  addEventListener('mousemove',function(e){mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
  addEventListener('scroll',function(){sy=Math.min(scrollY,700)},{passive:true});
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches)loop();else p.style.transform='scale(1.05)';
  document.addEventListener('visibilitychange',function(){if(document.hidden)cancelAnimationFrame(raf);else if(!matchMedia('(prefers-reduced-motion:reduce)').matches)loop()});
  function shoot(){
    var s=document.createElement('div');s.className='shoot';
    s.style.left=(5+Math.random()*50)+'vw';s.style.top=(4+Math.random()*20)+'vh';
    document.body.appendChild(s);void s.offsetWidth;s.classList.add('go');
    setTimeout(function(){s.remove()},1500);
    setTimeout(shoot,9000+Math.random()*16000);
  }
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches)setTimeout(shoot,5000);
})();
