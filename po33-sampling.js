/* Behavioral approximation; PO-33 transient thresholds/voice arbitration are not public. */
(function(root){'use strict';
 function transientSlices(data,rate){
  if(!(rate>0)||!data.length)return Array(16).fill(null);
  var hop=Math.max(1,Math.round(rate*.002)),envelope=[],peak=0;
  for(var i=0;i<data.length;i+=hop){var energy=0,end=Math.min(data.length,i+hop);for(var j=i;j<end;j++)energy+=data[j]*data[j];var rms=Math.sqrt(energy/(end-i));envelope.push(rms);peak=Math.max(peak,rms);}
  if(peak<.0001)return Array(16).fill(null);
  var floor=Math.max(.0001,peak*.035),baseline=0,previous=0,last=-Infinity,points=[],gap=Math.ceil(.035*rate/hop);
  for(var k=0;k<envelope.length && points.length<16;k++){
   var value=envelope[k],rise=value-previous;
   if(value>floor && k-last>=gap && (points.length===0 || (value>baseline*1.8 && rise>peak*.025))){
    // Include one analysis window before the onset so the attack isn't trimmed away.
    points.push(Math.max(0,(k-1)*hop));last=k;
   }
   baseline+=.06*(value-baseline);previous=value;
  }
  var result=points.map(function(start,n){return {start:start,end:n+1<points.length?points[n+1]:data.length};});
  while(result.length<16)result.push(null);return result;
 }
 function choke(voices,slot,time,cut){
  voices.forEach(function(v){if(v.slot===slot && v.start<=time && v.end>time){v.end=time;cut(v,time);}});
 }
 function allocate(voices,incoming,cut,limit){
  limit=limit || 4;var t=incoming.start;
  choke(voices,incoming.slot,t,cut);
  var active=voices.filter(function(v){return v.start<=t && v.end>t;}).sort(function(a,b){return a.start-b.start;});
  while(active.length>=limit){var victim=active.shift();victim.end=t;cut(victim,t);}
  // A live hit can arrive before voices already scheduled by the lookahead sequencer.
  // Preserve those later hits; the new earlier voice must end at their boundary.
  var times=voices.filter(function(v){return v.start>t && v.start<incoming.end;}).map(function(v){return v.start;}).sort(function(a,b){return a-b;});
  for(var time of times){
   var future=voices.filter(function(v){return v.start<=time && v.end>time;});
   if(future.some(function(v){return v.slot===incoming.slot;}) || future.length>=limit){incoming.end=time;cut(incoming,time);break;}
  }
  voices.push(incoming);
 }
 const MELODIC_OFFSETS=Object.freeze([-5,-4,-2,-1,0,2,3,5,7,8,10,11,12,14,15,17]);
 function trimFrames(view,tweak,total,rate){
  if(!view)return null;tweak=tweak || {};var bounded=v=>Math.max(0,Math.min(total,Math.round(Number.isFinite(v)?v:0)));
  var start,end;
  if(tweak.frames){start=bounded(tweak.frames.start);end=bounded(tweak.frames.end);}
  else {var offset=view.offset || 0,span=view.duration || 0,fraction=Math.max(0,Math.min(100,tweak.start || 0))/100;
   start=bounded((offset+span*fraction)*rate);end=bounded((offset+span*(fraction+(1-fraction)*(tweak.length===undefined?100:tweak.length)/100))*rate);}
  return {start:start,end:Math.max(start,end)};
 }
 function filterShape(value,rate){
  value=Math.max(-100,Math.min(100,value || 0));var top=Math.min(20000,rate*.45);
  if(Math.abs(value)<=4)return {bypass:true,type:'lowpass',frequency:top};
  return value<0?{bypass:false,type:'lowpass',frequency:100*Math.pow(top/100,(value+100)/96)}:{bypass:false,type:'highpass',frequency:20*Math.pow(400,(value-4)/96)};
 }
 const LOCK_KEYS=['pitch','volume','filter','resonance'];
 class Latches {
  constructor(){this.reset();}
  reset(){this.held=Array.from({length:16},()=>({}));this.events=[];this.serial=0;}
  schedule(slot,patch,time){const clean={};for(const k of LOCK_KEYS)if(Number.isFinite(patch?.[k]))clean[k]=patch[k];if(Object.keys(clean).length){this.events.push({slot,patch:clean,time,serial:this.serial++});this.events.sort((a,b)=>a.time-b.time||a.serial-b.serial);}}
  flush(now){while(this.events.length && this.events[0].time<=now){const e=this.events.shift();Object.assign(this.held[e.slot-1],e.patch);}}
  at(slot,base,time){const out=Object.assign({},base,this.held[slot-1]);for(const e of this.events)if(e.slot===slot && e.time<=time)Object.assign(out,e.patch);return out;}
  manual(slot,key,value,now){this.flush(now);this.held[slot-1][key]=value;}
  stop(now){this.flush(now);this.events=[];}
 }
 var api={MELODIC_OFFSETS:MELODIC_OFFSETS,trimFrames:trimFrames,filterShape:filterShape,Latches:Latches,transientSlices:transientSlices,choke:choke,allocate:allocate};root.PO33Sampling=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
