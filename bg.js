// 야경 배경: 별·달·3겹 빌딩 숲(창문이 깜빡임)·가끔 별똥별. 그림 파일 없이 코드로 그려서 무료·가벼움.
(function(){
  var W=1600,H=900,seed=7;
  function r(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
  function layer(cls,fill,minH,maxH,minW,maxW,winP,base){
    var s='',x=-20;
    while(x<W+20){
      var w=minW+r()*(maxW-minW),h=minH+r()*(maxH-minH),y=base-h;
      s+='<rect x="'+x.toFixed(0)+'" y="'+y.toFixed(0)+'" width="'+w.toFixed(0)+'" height="'+(h+10).toFixed(0)+'" fill="'+fill+'"/>';
      if(r()<.25)s+='<rect x="'+(x+w/2-1.5).toFixed(0)+'" y="'+(y-18).toFixed(0)+'" width="3" height="18" fill="'+fill+'"/>';
      if(winP>0){
        for(var wy=y+8;wy<base-6;wy+=9)for(var wx=x+5;wx<x+w-6;wx+=8){
          if(r()<winP){s+='<rect class="wn" x="'+wx.toFixed(0)+'" y="'+wy.toFixed(0)+'" width="3" height="4" fill="var(--win)" opacity="'+(.55+r()*.45).toFixed(2)+'" style="animation-delay:'+(-r()*7).toFixed(1)+'s;animation-duration:'+(5+r()*9).toFixed(1)+'s"/>'}
        }
      }
      x+=w+1+r()*4;
    }
    return '<g class="'+cls+'">'+s+'</g>';
  }
  var stars='';
  for(var i=0;i<130;i++){
    var sz=r()<.12?1.8:1;
    stars+='<circle class="tw" cx="'+(r()*W).toFixed(0)+'" cy="'+(r()*H*.62).toFixed(0)+'" r="'+sz+'" fill="var(--star)" style="animation-delay:'+(-r()*3).toFixed(1)+'s;animation-duration:'+(2+r()*4).toFixed(1)+'s"/>';
  }
  var moon='<g style="color:var(--star)"><circle cx="1290" cy="170" r="70" fill="#FFF4D6" opacity=".08"/><circle cx="1290" cy="170" r="42" fill="#FFF4D6" opacity=".12"/><circle cx="1290" cy="170" r="26" fill="#FFF7E3" style="filter:drop-shadow(0 0 14px rgba(255,244,214,.8))"/><circle cx="1281" cy="164" r="26" fill="var(--sky2)" opacity=".0"/></g>';
  var svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">'+
    '<g id="L0">'+stars+moon+'</g>'+
    '<g id="L1">'+layer('b1','var(--b1)',150,300,34,70,.0,H+10)+'</g>'+
    '<g id="L2">'+layer('b2','var(--b2)',100,230,40,84,.16,H+10)+'</g>'+
    '<g id="L3">'+layer('b3','var(--b3)',60,170,50,100,.22,H+10)+'</g>'+
    '</svg>';
  var city=document.getElementById('city');
  city.innerHTML=svg;
  // 스크롤·마우스에 따라 층마다 다르게 움직이는 시차
  var l=[1,2,3].map(function(n){return document.getElementById('L'+n)}),mx=0,my=0,sy=0;
  function px(){
    l.forEach(function(g,i){var k=(i+1)*.35;g.style.transform='translate('+(mx*k*-8).toFixed(1)+'px,'+(sy*k*-.03+my*k*-4).toFixed(1)+'px)'});
  }
  addEventListener('mousemove',function(e){mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5;px()},{passive:true});
  addEventListener('scroll',function(){sy=Math.min(scrollY,600);px()},{passive:true});
  // 별똥별
  function shoot(){
    var s=document.createElement('div');s.className='shoot';
    s.style.left=(5+Math.random()*50)+'vw';s.style.top=(4+Math.random()*25)+'vh';
    document.body.appendChild(s);void s.offsetWidth;s.classList.add('go');
    setTimeout(function(){s.remove()},1500);
    setTimeout(shoot,9000+Math.random()*16000);
  }
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches)setTimeout(shoot,4000);
})();
