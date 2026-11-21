/* Shared articulated mascot. The transport owns the only animation loop. */
(function(root){'use strict';
 let parts=null,next={},active={},random=Math.random;
 const duration={blink:170,ears:620,sniff:480};
 function schedule(now){next={blink:now+1500+random()*2500,ears:now+2200+random()*3500,sniff:now+1800+random()*3000};}
 function stop(){active={};next={};if(parts)Object.values(parts).forEach(p=>p.removeAttribute('transform'));}
 function frame(now){if(!parts)return;if(!next.blink)schedule(now);
  for(const key of Object.keys(duration)){if(now>=next[key]&&!active[key]){active[key]=now;next[key]=now+(key==='blink'?2200:3200)+random()*4000;}
   if(active[key]!==undefined&&now-active[key]>duration[key])delete active[key];}
  const t=key=>active[key]===undefined?0:(now-active[key])/duration[key];
  const blink=active.blink===undefined?1:Math.max(.055,1-Math.sin(Math.PI*t('blink')));
  parts.eyes.setAttribute('transform','translate(0 '+(710*(1-blink))+') scale(1 '+blink+')');
  const ear=active.ears===undefined?0:Math.sin(t('ears')*Math.PI*3)*Math.sin(t('ears')*Math.PI)*13;
  parts['ear-left'].setAttribute('transform','rotate('+ear+' 428 504)');parts['ear-right'].setAttribute('transform','rotate('+(-ear*.72)+' 598 552)');
  const sniff=active.sniff===undefined?0:Math.sin(t('sniff')*Math.PI*4)*Math.sin(t('sniff')*Math.PI);
  parts.nose.setAttribute('transform','translate('+(-sniff*4)+' '+(-Math.abs(sniff)*8)+')');
 }
 function stroke(){
  const glove=document.getElementById('tapeLeft').parentElement,matrix=glove.getScreenCTM();if(!matrix)return;
  const width=.641*Math.hypot(matrix.a,matrix.b);
  document.querySelectorAll('#transportMascot [data-mascot-line]').forEach(p=>{p.setAttribute('stroke-width',width);p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');p.setAttribute('stroke','#000');});
 }
 // Transparent, cropped assets only; the old glove exports contained a whole black panel.
 Promise.all(['head','left','right'].map(async kind=>{const r=await fetch('./mascot-'+kind+'.svg?v=20261121-ui13');if(!r.ok)throw Error('mascot');return [kind,new DOMParser().parseFromString(await r.text(),'image/svg+xml').documentElement];})).then(assets=>{
  for(const [kind,source] of assets){const selectors=kind==='head'?['#tapeHead image','#rabbit-head image']:[kind==='left'?'#tapeLeft image':'#tapeRight image'];
   for(const selector of selectors){const image=document.querySelector(selector);if(!image)continue;const svg=document.importNode(source,true);svg.setAttribute('overflow','visible');for(const attr of ['x','y','width','height'])svg.setAttribute(attr,image.getAttribute(attr));image.replaceWith(svg);}}
  const head=document.getElementById('tapeHead').parentElement;head.parentElement.append(head);
  parts={};for(const part of ['eyes','ear-left','ear-right','nose','mouth'])parts[part]=document.querySelector('#tapeHead [data-part="'+part+'"]');
  stroke();window.addEventListener('resize',stroke);window.addEventListener('po33-layout-change',stroke);root.dispatchEvent(new Event('po33-mascot-ready'));
 }).catch(()=>{});
 root.PO33Mascot={frame,stop};
})(window);
