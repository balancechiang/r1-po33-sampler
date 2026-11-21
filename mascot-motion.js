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
  const ear=active.ears===undefined?0:Math.sin(t('ears')*Math.PI*3)*Math.sin(t('ears')*Math.PI)*5;
  parts['ear-left'].setAttribute('transform','rotate('+ear+' 428 504)');parts['ear-right'].setAttribute('transform','rotate('+(-ear*.72)+' 598 552)');
  const sniff=active.sniff===undefined?0:Math.sin(t('sniff')*Math.PI*4)*Math.sin(t('sniff')*Math.PI);
  parts.nose.setAttribute('transform','translate('+(-sniff*4)+' '+(-Math.abs(sniff)*8)+')');
 }
 function stroke(){document.querySelectorAll('#tapeHead [data-part="mouth"]').forEach(p=>p.setAttribute('stroke-width',String(.388*(document.getElementById('instrument').dataset.layout==='compact'?1:1.4)*970/22)));}
 // Retain the static image on a failed fetch, with no impact on audio or input.
 fetch('./mascot-head.svg?v=20261121-ui12').then(r=>{if(!r.ok)throw Error('mascot');return r.text();}).then(text=>{
  const source=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
  for(const selector of ['#tapeHead image','#rabbit-head image']){const image=document.querySelector(selector);if(!image)continue;const svg=document.importNode(source,true);for(const attr of ['x','y','width','height'])svg.setAttribute(attr,image.getAttribute(attr));image.replaceWith(svg);}
  parts={};for(const part of ['eyes','ear-left','ear-right','nose','mouth'])parts[part]=document.querySelector('#tapeHead [data-part="'+part+'"]');
  stroke();window.addEventListener('resize',stroke);window.addEventListener('po33-layout-change',stroke);root.dispatchEvent(new Event('po33-mascot-ready'));
 }).catch(()=>{});
 root.PO33Mascot={frame,stop};
})(window);
