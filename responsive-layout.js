/* One control surface and one LCD; R1 retains the 240 x 282 geometry. */
(function(){'use strict';
 const panel=document.getElementById('panel'),lcd=document.getElementById('lcd');
 const instrument=document.createElement('main');instrument.id='instrument';instrument.setAttribute('aria-label','PO-33 sampler');
 panel.before(instrument);
 const stage=document.createElement('div');stage.id='portraitStage';instrument.before(stage);stage.append(instrument);
 const screen=document.createElement('div');screen.id='samplerScreen';screen.append(lcd);
 const controls=document.createElement('div');controls.id='samplerControls';controls.append(panel);instrument.append(screen,controls);
 const wrappers={};
 for(const id of ['tapeHead','tapeLeft','tapeRight','factoryReset']){const el=document.getElementById(id),g=document.createElementNS('http://www.w3.org/2000/svg','g');el.before(g);g.append(el);wrappers[id]=g;}
 function layout(){
  const padding=getComputedStyle(document.body),horizontal=parseFloat(padding.paddingLeft)+parseFloat(padding.paddingRight),vertical=parseFloat(padding.paddingTop)+parseFloat(padding.paddingBottom);
  const rawWidth=document.documentElement.clientWidth-horizontal,rawHeight=(window.visualViewport?window.visualViewport.height:window.innerHeight)-vertical;
  const touch=matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  const rotated=touch && rawWidth>rawHeight;
  const vw=rotated?rawHeight:rawWidth,vh=rotated?rawWidth:rawHeight;
  stage.dataset.rotated=String(rotated);stage.style.width=vw+'px';stage.style.height=vh+'px';

  const compact=vw<320 || vh<480;
  const width=compact?Math.min(vw,vh*240/282):(touch || vw<=1100?vw:Math.min(vw,560));
  const unit=width/240,rows=compact?30:Math.max(42,(vh-8)/unit-252);
  instrument.style.width=width+'px';instrument.style.setProperty('--unit',unit+'px');
  instrument.style.setProperty('--screen-height',rows*unit+'px');instrument.dataset.layout=compact?'compact':'expanded';
  lcd.setAttribute('viewBox','0 0 240 '+rows);
  for(const id of ['lcdMode','lcdNumber'])document.getElementById(id).setAttribute('transform','translate(0 '+(compact?2:6)+')');
  document.getElementById('lcdRecord').setAttribute('transform','translate(-7 '+(compact?2:6)+')');
  document.getElementById('lcdPlay').setAttribute('transform','translate(-8 '+(compact?2:6)+')');
  for(const id of ['lcdIn','lcdOut','lcdMeter'])document.getElementById(id).setAttribute('transform','translate(0 '+(rows-(compact?30:42))+')');
  const scale=compact?1:Math.min(3.65,(rows-38)/22)*.69,cy=compact?13:(23+rows-25)/2;
  function place(id,s,x,y,ox,oy){wrappers[id].setAttribute('transform','matrix('+s+' 0 0 '+s+' '+(x-ox*s)+' '+(y-oy*s)+')');}
  place('tapeHead',scale,120.5,cy,120.5,11);place('factoryReset',scale,120.5,cy,120.5,11);
  const gs=compact?1:scale*1.4;
  place('tapeLeft',gs,compact?100.5:72,compact?15.5:cy+6,100.5,13.5);
  place('tapeRight',gs,compact?139.5:168,compact?15.5:cy+6,139.5,13.5);
  window.dispatchEvent(new Event('po33-layout-change'));
 }
 function lockPortrait(){try{const pending=window.screen.orientation?.lock?.('portrait');pending?.catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',lockPortrait,{once:true});
 window.addEventListener('orientationchange',()=>{lockPortrait();layout();});
 window.addEventListener('resize',layout);if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
 layout();
})();
