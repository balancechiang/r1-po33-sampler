/* Behavioral approximation; PO-33 transient thresholds/voice arbitration are not public. */
(function(root){'use strict';
 // Calibration defaults, not verified PO-33 firmware constants.
 const AUTO_SLICE_DEFAULTS=Object.freeze({maxSlices:16,minDistanceMs:55,snapBackMs:2,fastMs:3,slowMs:45,relativeThreshold:.015});
 function transientSlices(data,rate,options){
  const settings=Object.assign({},AUTO_SLICE_DEFAULTS,options),empty=()=>Array(16).fill(null);
  if(!(rate>0)||!data.length)return empty();
  const hop=Math.max(1,Math.round(rate*.001)),fastAlpha=1-Math.exp(-1/(rate*settings.fastMs/1000)),slowAlpha=1-Math.exp(-1/(rate*settings.slowMs/1000));
  const features=[];let fast=0,slow=0,previous=0,amplitude=0,maximum=0;
  for(let start=0;start<data.length;start+=hop){
   const end=Math.min(data.length,start+hop);let framePeak=0;
   for(let i=start;i<end;i++){const value=Math.abs(data[i]);amplitude=Math.max(amplitude,value);fast+=(value-fast)*fastAlpha;slow+=(value-slow)*slowAlpha;framePeak=Math.max(framePeak,fast);}
   const rise=Math.max(0,framePeak-previous),score=framePeak>Math.max(.0001,slow*1.3) && rise>framePeak*.15?Math.max(0,framePeak-slow)*rise:0;
   features.push({sample:start,score});maximum=Math.max(maximum,score);previous=framePeak;
  }
  if(amplitude<.0001)return empty();
  const distance=Math.max(1,Math.round(rate*Math.max(0,settings.minDistanceMs)/1000)),back=Math.max(0,Math.round(rate*Math.max(0,settings.snapBackMs)/1000));
  function snap(sample){
   const lo=Math.max(0,sample-back);let best=sample;
   for(let i=sample;i>=lo;i--){
    if(Math.abs(data[i])<Math.abs(data[best]))best=i;
    if(data[i]===0)return i;
    if(i>lo && (data[i-1]<0)!==(data[i]<0))return Math.abs(data[i-1])<Math.abs(data[i])?i-1:i;
   }
   return best;
  }
  const threshold=maximum*Math.max(0,settings.relativeThreshold),candidates=[];
  for(let i=0;i<features.length;i++){const item=features[i];if(item.score>0 && item.score>=threshold && item.score>=(features[i-1]?.score||0) && item.score>(features[i+1]?.score||0))candidates.push({sample:snap(item.sample),score:item.score});}
  // Select globally by strength, not the first sixteen chronological detections.
  candidates.sort((a,b)=>b.score-a.score||a.sample-b.sample);
  const points=[0],limit=Math.max(1,Math.min(16,Math.floor(settings.maxSlices)||16));
  for(const candidate of candidates){if(points.length>=limit)break;if(candidate.sample<data.length && points.every(p=>Math.abs(p-candidate.sample)>=distance))points.push(candidate.sample);}
  points.sort((a,b)=>a-b);
  const result=points.map((start,i)=>({start,end:i+1<points.length?points[i+1]:data.length}));
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
 var api={AUTO_SLICE_DEFAULTS:AUTO_SLICE_DEFAULTS,MELODIC_OFFSETS:MELODIC_OFFSETS,trimFrames:trimFrames,filterShape:filterShape,Latches:Latches,transientSlices:transientSlices,choke:choke,allocate:allocate};root.PO33Sampling=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
