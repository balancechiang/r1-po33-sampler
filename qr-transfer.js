/* Offline animated QR transport. Complete SHA-256 validation before adoption. */
(function(root){'use strict';
 const MAX=8*1024*1024,CHUNK=360;
 const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
 const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function transform(bytes,kind){
  if(typeof CompressionStream==='undefined'||typeof DecompressionStream==='undefined')throw Error('Animated QR needs browser gzip support. Use Load File instead.');
  const stream=new Blob([bytes]).stream().pipeThrough(kind==='zip'?new CompressionStream('gzip'):new DecompressionStream('gzip'));
  const reader=stream.getReader(),parts=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX)throw Error('QR project exceeds 8 MB');parts.push(value);}}finally{await reader.cancel();}
  const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
 }
 async function encode(frame){if(!frame.length||frame.length>MAX)throw Error('Invalid project size');const bytes=await transform(frame,'zip'),id=await hash(bytes),total=Math.ceil(bytes.length/CHUNK);return Array.from({length:total},(_,i)=>JSON.stringify({q:'PO33QR1',id,n:total,i,size:bytes.length,d:b64(bytes.subarray(i*CHUNK,(i+1)*CHUNK))}));}
 function receiver(){let meta=null,parts=new Map(),done=false;
  return {async add(text){
   let m;try{m=JSON.parse(text);}catch{return null;}if(!m || m.q!=='PO33QR1')return null;
   if(done)return {received:parts.size,total:meta.n};
   if(!/^[a-f0-9]{64}$/.test(m.id)||!Number.isInteger(m.size)||m.size<1||m.size>MAX||m.n!==Math.ceil(m.size/CHUNK)||!Number.isInteger(m.i)||m.i<0||m.i>=m.n||typeof m.d!=='string'||m.d.length>480)throw Error('Invalid QR packet');
   if(meta && (m.id!==meta.id||m.n!==meta.n||m.size!==meta.size))throw Error('Different project detected. Cancel and restart scanner.');
   const part=un64(m.d),expected=m.i===m.n-1?m.size-m.i*CHUNK:CHUNK;if(part.length!==expected)throw Error('Invalid QR block length');
   meta=m;parts.set(m.i,part);const result={received:parts.size,total:m.n};
   if(parts.size===m.n){const bytes=new Uint8Array(m.size);for(const [i,p] of parts)bytes.set(p,i*CHUNK);if(await hash(bytes)!==m.id)throw Error('QR checksum failed. Cancel and retry.');result.buffer=(await transform(bytes,'unzip')).buffer;done=true;}
   return result;
  }};
 }
 root.PO33QRTransfer={encode,receiver};
})(globalThis);
