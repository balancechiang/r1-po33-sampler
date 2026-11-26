/* One control surface and one LCD; R1 retains the 240 x 282 geometry. */
(function(){'use strict';
 const panel=document.getElementById('panel'),lcd=document.getElementById('lcd');
 const instrument=document.createElement('main');instrument.id='instrument';instrument.setAttribute('aria-label','Web Sampler');
 panel.before(instrument);
 const stage=document.createElement('div');stage.id='portraitStage';instrument.before(stage);stage.append(instrument);
 const workbench=window.WebSamplerWorkbench.create(stage);
 const screen=document.createElement('div');screen.id='samplerScreen';screen.append(lcd);
 const controls=document.createElement('div');controls.id='samplerControls';controls.append(panel);instrument.append(screen,controls);
 const wrappers={};
 for(const id of ['tapeHead','tapeLeft','tapeRight','rabbitMascot']){const el=document.getElementById(id),g=document.createElementNS('http://www.w3.org/2000/svg','g');el.before(g);g.append(el);wrappers[id]=g;}
 let scanFrozen=false;
 window.addEventListener('po33-scan-state',e=>{scanFrozen=e.detail.active;if(!scanFrozen)layout();});
 function layout(){
  if(scanFrozen){stage.dataset.rotated=String(document.body.dataset.wide!=='true' && (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0) && document.documentElement.clientWidth>window.innerHeight);return;}
  const padding=getComputedStyle(document.body),horizontal=parseFloat(padding.paddingLeft)+parseFloat(padding.paddingRight),vertical=parseFloat(padding.paddingTop)+parseFloat(padding.paddingBottom);
  const rawWidth=document.documentElement.clientWidth-horizontal,rawHeight=window.innerHeight-vertical;
  const touch=matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  const wide=rawWidth>=900 && (!touch || (rawWidth>rawHeight && rawHeight>=600));
  workbench.setWide(wide);
  const rotated=!wide && touch && rawWidth>rawHeight;
  const frameHeight=Math.min(740,rawHeight*.72),frameWidth=Math.min(380,frameHeight*.60);
  const vw=wide?frameWidth-34:rotated?rawHeight:rawWidth,vh=wide?frameHeight-34:rotated?rawWidth:rawHeight;
  stage.dataset.rotated=String(rotated);stage.style.width=(wide?frameWidth:vw)+'px';stage.style.height=(wide?frameHeight:vh)+'px';

  const compact=!wide && (vw<320 || vh<480);
  const width=compact?Math.min(vw,vh*240/282):(touch || vw<=1100?vw:Math.min(vw,560));
  const unit=width/240,rows=compact?30:Math.max(42,(vh-8)/unit-252);
  instrument.style.width=width+'px';instrument.style.setProperty('--unit',unit+'px');
  instrument.style.setProperty('--screen-height',rows*unit+'px');instrument.dataset.layout=compact?'compact':'expanded';
  lcd.setAttribute('viewBox','0 0 240 '+rows);
  for(const id of ['lcdMode','lcdNumber'])document.getElementById(id).setAttribute('transform','translate(0 '+(compact?2:6)+')');
  document.getElementById('lcdRecord').setAttribute('transform','translate(-20 '+(compact?2:6)+')');
  document.getElementById('lcdPlay').setAttribute('transform','translate(-23 '+(compact?2:6)+')');
  for(const id of ['lcdIn','lcdOut','lcdMeter'])document.getElementById(id).setAttribute('transform','translate(0 '+(rows-(compact?30:42))+')');
  const scale=compact?1:Math.min(3.65,(rows-38)/22)*.69,cy=compact?13:(23+rows-25)/2;
  function place(id,s,x,y,ox,oy){wrappers[id].setAttribute('transform','matrix('+s+' 0 0 '+s+' '+(x-ox*s)+' '+(y-oy*s)+')');}
  place('tapeHead',scale,120.5,cy,120.5,11);place('rabbitMascot',scale,120.5,cy,120.5,11);
  const gs=compact?1:scale*1.4;
  place('tapeLeft',gs,compact?100.5:72,compact?15.5:cy+6,100.5,13.5);
  place('tapeRight',gs,compact?139.5:168,compact?15.5:cy+6,139.5,13.5);
  window.dispatchEvent(new Event('po33-layout-change'));
 }
 function lockPortrait(){if(Math.min(window.screen.width,window.screen.height)>=600 || matchMedia('(pointer:fine)').matches)return;try{const pending=window.screen.orientation?.lock?.('portrait');pending?.catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',lockPortrait,{once:true});
 window.addEventListener('orientationchange',()=>{lockPortrait();layout();});
 window.addEventListener('resize',layout);if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
 layout();
})();
