import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import {X509Certificate} from 'node:crypto';
import {startHub} from './scripts/local-hub.mjs';
const temp=await mkdtemp(path.join(os.tmpdir(),'po33-hub-test-'));
let hub,fallback;
function request(port,method,url,body,headers={}){return new Promise((resolve,reject)=>{
 const r=https.request({hostname:'127.0.0.1',port,method,path:url,rejectUnauthorized:false,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});r.on('error',reject);r.end(body);
});}
try{
 hub=await startHub({port:0,host:'127.0.0.1',directory:path.join(temp,'projects'),certDirectory:path.join(temp,'certs'),log:()=>{}});
 assert.equal(hub.protocol,'https');
 const cert=new X509Certificate(await readFile(path.join(temp,'certs/cert.pem')));assert(cert.checkIP('127.0.0.1'));assert(cert.checkHost('localhost'));assert(cert.verify(cert.publicKey));assert(Date.parse(cert.validTo)-Date.now()>3649*86400000);
 let r=await request(hub.port,'GET','/');assert.equal(r.status,200);assert(r.body.includes(Buffer.from('Drop .wav')));
 const bytes=Buffer.from([82,73,70,70,0,255,128,0]);
 r=await request(hub.port,'POST','/api/upload?name=test.wav',bytes);assert.equal(r.status,201);
 r=await request(hub.port,'POST','/api/upload?name=test.wav',bytes);assert.equal(r.status,409);
 r=await request(hub.port,'POST','/api/upload?name=copy.json',Buffer.from('{"test":true}'));assert.equal(r.status,201);
 r=await request(hub.port,'GET','/api/list');let list=JSON.parse(r.body);assert.equal(list.length,2);assert.equal(list[0].name,'copy.json');assert.equal(list[1].sizeBytes,bytes.length);
 r=await request(hub.port,'GET','/api/file?name=test.wav');assert.deepEqual(r.body,bytes);assert.equal(r.headers['content-type'],'application/octet-stream');
 for(const name of ['../secret.wav','..\\secret.wav','C:\\secret.wav','test.exe','a/b.wav']){r=await request(hub.port,'GET','/api/file?name='+encodeURIComponent(name));assert.equal(r.status,400,name);}
 r=await request(hub.port,'POST','/api/upload?name=evil.wav',bytes,{Origin:'https://evil.example'});assert.equal(r.status,403);
 r=await request(hub.port,'GET','/api/list',null,{Host:'evil.example'});assert.equal(r.status,421);
 r=await request(hub.port,'GET','/bridge');assert(r.body.includes(Buffer.from('[buffer]')));assert(r.body.includes(Buffer.from("type: 'READY'".replaceAll(' ','')))||r.body.includes(Buffer.from("type:'READY'")));
 r=await request(hub.port,'DELETE','/api/file?name=test.wav');assert.equal(r.status,200);
 r=await request(hub.port,'GET','/api/file?name=test.wav');assert.equal(r.status,404);
 await writeFile(path.join(temp,'not-a-directory'),'x');
 fallback=await startHub({port:0,host:'127.0.0.1',directory:path.join(temp,'fallback'),certDirectory:path.join(temp,'not-a-directory'),log:()=>{}});assert.equal(fallback.protocol,'http');
 const response=await fetch('http://127.0.0.1:'+fallback.port+'/api/list');assert.deepEqual(await response.json(),[]);
 console.log('PASS native self-signed HTTPS/SAN/signature/3650-day certificate, upload/list/download/delete, no overwrite, traversal/rebinding/cross-origin-write rejection, zero-copy bridge page, HTTP fallback.');
}finally{for(const h of [hub,fallback])if(h)await new Promise(r=>h.server.close(r));const target=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep+'po33-hub-test-';assert(target.startsWith(prefix));await rm(target,{recursive:true,force:true});}
