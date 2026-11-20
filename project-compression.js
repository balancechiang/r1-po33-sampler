/* Bounded gzip decoding for downloaded native projects; no visual data transport. */
(function(root){'use strict';
 root.PO33ProjectCompression={async unpackFrame(bytes){
  if(typeof DecompressionStream==='undefined')throw Error('Project gzip support unavailable. Use JSON or WAV.');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw Error('Project exceeds 8 MB');parts.push(value);}}finally{await reader.cancel();}
  const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
 }};
})(globalThis);
