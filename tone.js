/* Optional audition coloring, not the native backup codec or a verified analog model. */
(function(root){'use strict';
 function quantize(value){if(!value)return 0;const x=Math.max(-1,Math.min(1,Math.tanh(value*.8)/Math.tanh(.8))),sign=Math.sign(x),compressed=Math.log1p(255*Math.abs(x))/Math.log(256),code=Math.round(compressed*127)/127;const expanded=sign*Math.expm1(code*Math.log(256))/255;return Math.tanh(expanded*.8)/Math.tanh(.8);}
 class Tone {
  constructor(rate){this.step=Math.min(1,23437.5/rate);this.phase=1;this.held=0;}
  process(input,output){for(let i=0;i<output.length;i++){if(this.phase>=1){this.phase-=1;this.held=quantize(input[i] || 0);}output[i]=this.held;this.phase+=this.step;}}
 }
 const api={Tone,quantize};root.PO33Tone=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
