// Minimal self-signed X.509 v3 certificate using only Node crypto (RSA/SHA256).
import {generateKeyPairSync,randomBytes,sign,X509Certificate,createPrivateKey} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const join=(...b)=>Buffer.concat(b);
const tlv=(tag,bytes)=>{const n=bytes.length,len=n<128?Buffer.from([n]):(()=>{let x=n,b=[];while(x){b.unshift(x&255);x>>>=8;}return Buffer.from([128|b.length,...b]);})();return join(Buffer.from([tag]),len,bytes);};
const seq=(...b)=>tlv(0x30,join(...b));
const oid=s=>{const a=s.split('.').map(Number),out=[40*a[0]+a[1]];for(const x of a.slice(2)){let n=x,b=[n&127];while(n>>>=7)b.unshift((n&127)|128);out.push(...b);}return tlv(6,Buffer.from(out));};
const integer=b=>tlv(2,b[0]&128?join(Buffer.from([0]),b):b);
const algorithm=()=>seq(oid('1.2.840.113549.1.1.11'),tlv(5,Buffer.alloc(0)));
const time=d=>tlv(0x17,Buffer.from(d.toISOString().replace(/\D/g,'').slice(2,14)+'Z'));
export async function hubCertificate(folder,addresses){
 await mkdir(folder,{recursive:true,mode:0o700});
 const certPath=path.join(folder,'cert.pem'),keyPath=path.join(folder,'key.pem');
 const ips=[...new Set(['127.0.0.1',...addresses])];
 try{
  const cert=await readFile(certPath),key=await readFile(keyPath),x=new X509Certificate(cert);
  if(x.checkPrivateKey(createPrivateKey(key)) && x.verify(x.publicKey) && Date.parse(x.validTo)>Date.now()+86400000 && x.checkHost('localhost') && ips.every(ip=>x.checkIP(ip)))return {cert,key,fingerprint:x.fingerprint256,generated:false};
 }catch{}
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const name=seq(tlv(0x31,seq(oid('2.5.4.3'),tlv(0x0c,Buffer.from('PO33 Local Hub')))));
 const now=new Date(Date.now()-300000),until=new Date(Date.now()+3650*86400000);
 const names=ips.map(ip=>tlv(0x87,Buffer.from(ip.split('.').map(Number))));names.push(tlv(0x82,Buffer.from('localhost')));
 const extensions=tlv(0xa3,seq(
  seq(oid('2.5.29.17'),tlv(4,seq(...names))),
  seq(oid('2.5.29.19'),tlv(1,Buffer.from([255])),tlv(4,seq()))
 ));
 const tbs=seq(tlv(0xa0,integer(Buffer.from([2]))),integer(randomBytes(16)),algorithm(),name,seq(time(now),time(until)),name,publicKey.export({type:'spki',format:'der'}),extensions);
 const der=seq(tbs,algorithm(),tlv(3,join(Buffer.from([0]),sign('sha256',tbs,privateKey))));
 const cert=Buffer.from('-----BEGIN CERTIFICATE-----\n'+der.toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END CERTIFICATE-----\n');
 const key=privateKey.export({type:'pkcs8',format:'pem'}),x=new X509Certificate(cert);
 if(!x.verify(x.publicKey) || !ips.every(ip=>x.checkIP(ip)))throw Error('Generated certificate failed verification');
 await writeFile(keyPath,key,{mode:0o600});await writeFile(certPath,cert,{mode:0o644});
 return {cert,key,fingerprint:x.fingerprint256,generated:true};
}
