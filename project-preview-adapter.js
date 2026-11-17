/* Preview translation only. Native project/raw bytes stay in the decoder result. */
(function(root){
  "use strict";
  function adapt(project,context){
    if(!project || project.slots.length!==16 || project.patterns.length!==16 || project.validation.checksumErrors!==0)throw Error("A validated complete PO-33 project is required.");
    var pools=new Map();
    project.pools.forEach(function(pool){
      if(!pool.audioBuffer.length)return;
      var buffer=context.createBuffer(1,pool.audioBuffer.length,pool.sampleRate);
      buffer.copyToChannel(pool.audioBuffer,0);pools.set(pool.id,buffer);
    });
    function view(slice){
      if(!slice || slice.rangeStatus!=="complete" || !slice.audioBuffer || !slice.audioBuffer.length)return null;
      var buffer=pools.get(slice.sourcePoolId);if(!buffer)return null;
      return {buffer:buffer,offset:slice.sourceStartSample/buffer.sampleRate,duration:slice.audioBuffer.length/buffer.sampleRate,trim:0,pitch:0,length:100};
    }
    var samples=project.slots.map(function(slot){
      if(slot.id<=8)return view(slot.slices[0]);
      var views=slot.slices.map(view),base=views.find(Boolean);return base?Object.assign({},base,{sliceViews:views}):null;
    });
    var notes=0,extras=[];
    var patterns=project.patterns.map(function(pattern){
      var lanes=Array.from({length:16},function(){return Array(16).fill(-1);});
      var extra={effects:[],locks:{},steps:{}};extras.push(extra);
      pattern.steps.forEach(function(step){
        extra.effects[step.stepIndex]=step.fx || 0;
        step.triggers.forEach(function(note){
          var i=note.slotId-1,key=i+":"+step.stepIndex;
          lanes[i][step.stepIndex]=note.sliceOrNote;notes++;
          if(note.paramLocks && note.paramLocks.pitchCode)extra.locks[key]={pitch:note.paramLocks.pitchCode-13};
          extra.steps[key]={length:note.lengthSteps || 0,retrigs:note.retriggers || 1};
        });
      });
      return {lanes:lanes};
    });
    return {samples:samples,patterns:patterns,extras:extras,bpm:project.meta.bpm,chain:project.patternChain.slice(),
      tweaks:Array.from({length:16},function(){return {pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}};}),
      summary:{slots:samples.filter(Boolean).length,patterns:patterns.length,notes:notes,bpm:project.meta.bpm,
        unavailableSlices:project.slots.reduce(function(n,s){return n+s.slices.filter(function(v){return v.rangeStatus==="out-of-pool";}).length;},0)}};
  }
  root.PO33PreviewAdapter={adapt:adapt};
  if(typeof module!=="undefined")module.exports={adapt:adapt};
})(typeof window!=="undefined"?window:globalThis);
