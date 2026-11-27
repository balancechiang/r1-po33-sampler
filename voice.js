/* Analytic playback-rate trajectory for live sources; PCM and source anchors stay immutable. */
(function(root){'use strict';
 class Speed {
  constructor(start,rate){this.base=start;this.position=0;this.rate=rate;this.events=[{time:start,target:rate,tau:0}];}
  state(time){if(time<this.base)return {position:this.position,rate:this.rate,target:this.events[0].target,tau:this.events[0].tau};
   let pos=this.position,r=this.rate,target=this.events[0].target,tau=this.events[0].tau,last=this.base;
   const advance=dt=>{if(tau>0){const e=Math.exp(-dt/tau);pos+=target*dt+(r-target)*tau*(1-e);r=target+(r-target)*e;}else{r=target;pos+=target*dt;}};
   for(let i=1;i<this.events.length && this.events[i].time<=time;i++){const e=this.events[i];advance(e.time-last);last=e.time;target=e.target;tau=e.tau;}
   advance(time-last);return {position:pos,rate:r,target,tau};
  }
  prune(now){if(now<this.base)return;const s=this.state(now),future=this.events.filter(e=>e.time>now);this.base=now;this.position=s.position;this.rate=s.rate;this.events=[{time:now,target:s.target,tau:s.tau},...future];}
  target(time,rate,tau,now){this.prune(now);time=Math.max(this.base,time);this.events=this.events.filter(e=>e.time!==time);this.events.push({time,target:Math.max(.001,rate),tau});this.events.sort((a,b)=>a.time-b.time);}
  end(span,now){let lo=Math.max(this.base,now);if(this.state(lo).position>=span)return lo;const min=Math.min(this.rate,...this.events.map(e=>e.target));let hi=lo+(span-this.state(lo).position)/Math.max(.001,min)+.1;for(let i=0;i<42;i++){const mid=(lo+hi)/2;if(this.state(mid).position<span)lo=mid;else hi=mid;}return hi;}
  apply(param,now){const t=Math.max(now,this.base),s=this.state(t);if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else param.cancelScheduledValues(t);param.setValueAtTime(s.rate,t);if(s.tau>0)param.setTargetAtTime(s.target,t,s.tau);for(const e of this.events)if(e.time>t){if(e.tau>0)param.setTargetAtTime(e.target,e.time,e.tau);else param.setValueAtTime(e.target,e.time);}}
 }
 function protect(voices,voice,end,now,cut){
  voice.end=end;const times=[now,...voices.filter(v=>v!==voice && v.start>now && v.start<end).map(v=>v.start)].sort((a,b)=>a-b);
  for(const t of times){if(t>=voice.end)break;
   for(const v of voices)if(v!==voice && v.slot===voice.slot && !(voice.group!==undefined && v.group===voice.group) && v.start<=t && v.end>t){const victim=v.start>voice.start?voice:v;victim.end=t;cut(victim,t);}
   const active=voices.filter(v=>v.start<=t && v.end>t).sort((a,b)=>a.start-b.start);
   while(active.length>4){const victim=active.shift();victim.end=t;cut(victim,t);}
  }
  return voice.end;
 }
 // Measured Scratch source cursor: time continues; a ringing voice oscillates.
 function scratchCursor(phase,half,anchor,span,fresh,kind,negative){
  const cycle=half*2,u=((phase%cycle)+cycle)%cycle;
  let offset=u<=half?u:(fresh && kind===11?-(u-half):cycle-u);
  if(negative)offset=-(u<=half?u:cycle-u);
  const pos=anchor+offset;
  return ((pos%span)+span)%span;
 }
 function scratchLoop(context,source,start,span,anchor,half,fresh,kind,negative){
  const count=Math.max(2,Math.round(half*2*source.sampleRate)),buffer=context.createBuffer(source.numberOfChannels,count,source.sampleRate);
  half=count/source.sampleRate/2;
  for(let ch=0;ch<source.numberOfChannels;ch++){
   const input=source.getChannelData(ch),output=buffer.getChannelData(ch);
   for(let i=0;i<count;i++){
    const pos=(start+scratchCursor(i/source.sampleRate,half,anchor,span,fresh,kind,negative))*source.sampleRate;
    const a=Math.min(input.length-1,Math.max(0,Math.floor(pos))),b=Math.min(input.length-1,a+1);
    output[i]=input[a]+(input[b]-input[a])*(pos-a);
   }
  }
  return {buffer,half,anchor,span,fresh,kind,negative};
 }
 const api={Speed,protect,scratchCursor,scratchLoop};root.PO33LiveVoice=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
