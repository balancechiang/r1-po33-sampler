/* Offline animated QR transport. Current edits are compiled to a validated native frame before gzip. */
(function(root){'use strict';
 const MAX=8*1024*1024,DEFAULT_CHUNK=600,MIN_CHUNK=200,MAX_CHUNK=1800,PREFIX='PO33Q3';
 const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');};
 const un64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
 async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function transform(bytes,kind){
  const Constructor=kind==='zip'?root.CompressionStream:root.DecompressionStream;
  if(typeof Constructor==='undefined')throw Error('Animated QR needs browser gzip support. Use Load File or HTTPS QR instead.');
  const reader=new Blob([bytes]).stream().pipeThrough(new Constructor('gzip')).getReader(),parts=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX)throw Error('QR project exceeds 8 MB');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
 }
 async function encode(frame,options={}){
  if(!(frame instanceof Uint8Array)||!frame.length||frame.length>MAX)throw Error('Invalid project frame size');
  const chunk=Number(options.chunkBytes)||DEFAULT_CHUNK;if(!Number.isInteger(chunk)||chunk<MIN_CHUNK||chunk>MAX_CHUNK)throw Error('Invalid QR fragment size');
  const bytes=await transform(frame,'zip'),hash=await digest(bytes),session=hash.slice(32,48),check=hash.slice(0,32),total=Math.ceil(bytes.length/chunk),frames=[];
  if(total>8192)throw Error('Project is too large for a practical animated QR transfer');
  for(let i=0;i<total;i++)frames.push(`${PREFIX}.${session}.${i.toString(36)}.${total.toString(36)}.${bytes.length.toString(36)}.${chunk.toString(36)}.${check}.${b64(bytes.subarray(i*chunk,Math.min((i+1)*chunk,bytes.length)))}`);
  return {frames,compressedBytes:bytes.length,rawBytes:frame.length,chunkBytes:chunk};
 }
 function receiver(){let meta=null,parts=new Map(),done=false;
  return {async add(text){
   if(typeof text!=='string'||!text.startsWith(PREFIX+'.'))return null;
   const fields=text.split('.');if(fields.length!==8)throw Error('Invalid animated QR packet');
   const [,session,indexText,totalText,sizeText,chunkText,check,data]=fields;
   if(!/^[a-f0-9]{16}$/.test(session)||!/^[a-z0-9]{1,5}$/.test(indexText)||!/^[a-z0-9]{1,5}$/.test(totalText)||!/^[a-z0-9]{1,6}$/.test(sizeText)||!/^[a-z0-9]{1,3}$/.test(chunkText)||!/^[a-f0-9]{32}$/.test(check)||!/^[A-Za-z0-9_-]+$/.test(data))throw Error('Invalid animated QR header');
   const index=parseInt(indexText,36),total=parseInt(totalText,36),size=parseInt(sizeText,36),chunk=parseInt(chunkText,36);
   if(!Number.isSafeInteger(index)||!Number.isSafeInteger(total)||!Number.isSafeInteger(size)||!Number.isSafeInteger(chunk)||chunk<MIN_CHUNK||chunk>MAX_CHUNK||data.length>Math.ceil(chunk*4/3)||size<1||size>MAX||total!==Math.ceil(size/chunk)||index<0||index>=total)throw Error('Animated QR size or index is invalid');
   if(done)return {received:parts.size,total,complete:true};
   if(meta&&(session!==meta.session||check!==meta.check||total!==meta.total||size!==meta.size||chunk!==meta.chunk))throw Error('A different QR project appeared. Cancel and restart the scan.');
   const part=un64(data),expected=index===total-1?size-index*chunk:chunk;
   if(part.length!==expected)throw Error('Animated QR fragment length is invalid');
   meta={session,check,total,size,chunk};parts.set(index,part);const result={received:parts.size,total,complete:false};
   if(parts.size===total){const bytes=new Uint8Array(size);for(const [i,p] of parts)bytes.set(p,i*chunk);const actual=await digest(bytes);if(actual.slice(0,32)!==check||actual.slice(32,48)!==session)throw Error('Animated QR checksum failed. Cancel and retry.');result.buffer=(await transform(bytes,'unzip')).buffer;result.filename='camera.po33frame';result.complete=true;done=true;}
   return result;
  }};
 }
 root.PO33QRTransfer={encode,receiver,chunkBytes:DEFAULT_CHUNK};
})(globalThis);
