import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import {promises as fsp} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {hubCertificate} from './local-hub-cert.mjs';
import {manager,bridge} from './local-hub-pages.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startHub({port=33033,downloadPort=33034,host='0.0.0.0',directory=path.join(root,'my-po33-projects'),certDirectory=path.join(root,'.certs'),forceHTTP=false,log=console.log}={}){
 await fsp.mkdir(directory,{recursive:true});
 const ignore=path.join(root,'.gitignore');const text=await fsp.readFile(ignore,'utf8').catch(()=> '');
 const missing=['/my-po33-projects/','/.certs/'].filter(s=>!text.split(/\r?\n/).includes(s));if(missing.length)await fsp.appendFile(ignore,'\n'+missing.join('\n')+'\n');
 const addresses=[...new Set(Object.values(os.networkInterfaces()).flat().filter(a=>a && a.family==='IPv4'&&!a.internal).map(a=>a.address))];
 const max=128*1024*1024;
 function filename(url){const n=url.searchParams.get('name');if(!n || n!==path.basename(n) || n!==path.win32.basename(n) || /[\x00-\x1f<>:"|?*]/.test(n) || n.length>200 || !/\.(wav|m4a|json)$/i.test(n))throw Object.assign(Error('Invalid .wav/.m4a/.json filename'),{status:400});return n;}
 async function statFile(name){const p=path.join(directory,name),s=await fsp.lstat(p);if(!s.isFile() || s.isSymbolicLink())throw Object.assign(Error('Not a regular project file'),{status:400});return {p,s};}
 function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
 async function handler(req,res){
  let temp;
  try{
   const url=new URL(req.url,'http://hub.local');
   const hostname=new URL('http://'+req.headers.host).hostname;
   if(![...addresses,'localhost','127.0.0.1','[::1]'].includes(hostname))throw Object.assign(Error('Use the hub LAN IP or localhost'),{status:421});
   // No login; only same-origin browser pages may mutate local files. Reject
   // cross-origin browser writes without affecting the read-only bridge.
   if(['POST','DELETE'].includes(req.method) && req.headers.origin && req.headers.origin!==`${req.socket.encrypted?'https':'http'}://${req.headers.host}`)throw Object.assign(Error('Cross-origin writes are not allowed'),{status:403});
   if(req.method==='GET' && url.pathname==='/')return send(res,200,manager.replaceAll('__DOWNLOAD_PORT__',String(actualDownloadPort)),'text/html; charset=utf-8');
   if(req.method==='GET' && url.pathname==='/qrcode.min.js')return send(res,200,await fsp.readFile(path.join(root,'vendor/qrcodejs/qrcode.min.js'),'utf8'),'text/javascript; charset=utf-8');
   if(req.method==='GET' && url.pathname==='/bridge')return send(res,200,bridge,'text/html; charset=utf-8');
   if(req.method==='GET' && url.pathname==='/api/list'){
    const files=[];for(const entry of await fsp.readdir(directory)){if(!/\.(wav|m4a|json)$/i.test(entry))continue;try{const {s}=await statFile(entry);files.push({name:entry,type:path.extname(entry).slice(1).toLowerCase(),sizeBytes:s.size,updatedAt:s.mtime.toISOString()});}catch{}}
    return send(res,200,files.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.name.localeCompare(b.name)));
   }
   if(req.method==='GET' && url.pathname==='/api/file'){
    const {p,s}=await statFile(filename(url));if(s.size>max)throw Object.assign(Error('File exceeds 128 MB'),{status:413});res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':s.size,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(p)),'Cache-Control':'no-store'});
    const stream=fs.createReadStream(p);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return;
   }
   if(req.method==='POST' && url.pathname==='/api/upload'){
    const name=filename(url),target=path.join(directory,name);
    try{await fsp.lstat(target);throw Object.assign(Error('File already exists; rename the upload or delete the old file first'),{status:409});}catch(e){if(e.code!=='ENOENT')throw e;}
    if(Number(req.headers['content-length'])>max)throw Object.assign(Error('File exceeds 128 MB'),{status:413});
    temp=path.join(directory,'.upload-'+randomUUID());const file=await fsp.open(temp,'wx');let count=0;
    try{for await(const chunk of req){count+=chunk.length;if(count>max)throw Object.assign(Error('File exceeds 128 MB'),{status:413});let offset=0;while(offset<chunk.length){const r=await file.write(chunk,offset,chunk.length-offset,null);if(!r.bytesWritten)throw Error('Unable to write upload');offset+=r.bytesWritten;}}}finally{await file.close();}
    if(!count)throw Object.assign(Error('Empty upload'),{status:400});
    await fsp.link(temp,target);await fsp.unlink(temp);temp=null;return send(res,201,{name,sizeBytes:count});
   }
   if(req.method==='DELETE' && url.pathname==='/api/file'){const {p}=await statFile(filename(url));await fsp.unlink(p);return send(res,200,{deleted:true});}
   send(res,404,{error:'Not found'});
  }catch(error){if(temp)await fsp.unlink(temp).catch(()=>{});if(!res.headersSent)send(res,error.status|| (error.code==='ENOENT'?404:error.code==='EEXIST'?409:500),{error:error.message});else res.destroy();}
 }
 let certificate,protocol='http';
 if(!forceHTTP)try{certificate=await hubCertificate(certDirectory,addresses);protocol='https';log(`Self-signed certificate ${certificate.generated?'generated':'reused'} · expires in up to 3650 days\nSHA256 ${certificate.fingerprint}`);}catch(error){log(`HTTPS certificate failed: ${error.message}\nFalling back to HTTP. HTTPS Creations may block this iframe; use Load File.`);}
 const server=certificate?https.createServer({key:certificate.key,cert:certificate.cert},handler):http.createServer(handler);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const actual=server.address().port;
 let downloadServer=null,actualDownloadPort;
 if(downloadPort===actual){actualDownloadPort=actual;}
 else{
  downloadServer=http.createServer(async(req,res)=>{
   try{
    const url=new URL(req.url,'http://hub.local'),hostname=new URL('http://'+req.headers.host).hostname;
    if(![...addresses,'localhost','127.0.0.1','[::1]'].includes(hostname))throw Object.assign(Error('Use the hub LAN IP or localhost'),{status:421});
    if(req.method!=='GET'||url.pathname!=='/api/file')throw Object.assign(Error('This HTTP port only serves QR downloads'),{status:404});
    const {p,s}=await statFile(filename(url));if(s.size>max)throw Object.assign(Error('File exceeds 128 MB'),{status:413});
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':s.size,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(p)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    const stream=fs.createReadStream(p);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
   }catch(error){if(!res.headersSent)send(res,error.status|| (error.code==='ENOENT'?404:500),{error:error.message});else res.destroy();}
  });
  await new Promise((resolve,reject)=>{downloadServer.once('error',reject);downloadServer.listen(downloadPort,host,resolve);});
  actualDownloadPort=downloadServer.address().port;
 }
 log(`Web Sampler Local Hub · no login · ${directory}\nManager: ${[...addresses,'localhost'].map(ip=>`${protocol}://${ip}:${actual}`).join('\n')}\nQR downloads: ${[...addresses,'localhost'].map(ip=>`http://${ip}:${actualDownloadPort}`).join('\n')}`);
 if(certificate)log('This is a self-signed local test certificate. Open the hub directly on your device and accept the certificate exception yourself if supported. Creation WebView may still refuse it; Load File remains available.');
 return {server,downloadServer,protocol,port:actual,downloadPort:actualDownloadPort,addresses,directory};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startHub().catch(error=>{console.error(error.message);process.exitCode=1;});
