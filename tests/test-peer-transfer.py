"""Browser-to-browser direct transfer using QR-exchanged WebRTC descriptions."""
import os as _os
from pathlib import Path as _Path
_os.chdir(_Path(__file__).resolve().parents[1])
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json
from playwright.sync_api import sync_playwright

root=_Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True,args=['--mute-audio'])
        a=browser.new_page();b=browser.new_page();errors=[]
        a.on('pageerror',lambda e:errors.append(str(e)));b.on('pageerror',lambda e:errors.append(str(e)))
        for page in (a,b):
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
            page.wait_for_function('!!window.PO33PeerTransfer && document.body.dataset.loading==="false"')
        a.evaluate("window.peerResult={ack:false};window.peerA=PO33PeerTransfer.create({onOpen:()=>peerResult.open=true,onAck:()=>peerResult.ack=true});")
        b.evaluate("window.peerResult={};window.peerB=PO33PeerTransfer.create({onOpen:()=>peerResult.open=true,onFile:(name,buffer,complete)=>{peerResult.name=name;peerResult.bytes=Array.from(new Uint8Array(buffer));complete(true);}});")
        offer=a.evaluate('peerA.offer()')
        assert offer.startswith('WS1:') and len(offer)<5000
        qr_decode="""async text=>{const box=document.createElement('div');document.body.append(box);new QRCode(box,{text,width:200,height:200,correctLevel:QRCode.CorrectLevel.L});await new Promise(r=>setTimeout(r,100));const c=box.querySelector('canvas');if(!c)throw Error('QR canvas missing');const image=c.getContext('2d').getImageData(0,0,c.width,c.height);const worker=new Worker('./qr-camera-worker.js');return await new Promise((resolve,reject)=>{worker.onmessage=e=>{worker.terminate();box.remove();e.data.error?reject(Error(e.data.error)):resolve(e.data.text)};worker.onerror=e=>{worker.terminate();reject(Error(e.message))};worker.postMessage({width:c.width,height:c.height,pixels:image.data.buffer},[image.data.buffer]);});}"""
        assert a.evaluate('('+qr_decode+')('+json.dumps(offer)+')')==offer
        answer=b.evaluate('(async value=>peerB.answer(value))',offer)
        assert answer.startswith('WS1:') and len(answer)<5000
        assert b.evaluate('('+qr_decode+')('+json.dumps(answer)+')')==answer
        a.evaluate('(async value=>peerA.acceptAnswer(value))',answer)
        a.wait_for_function('peerResult.open===true',timeout=20000)
        b.wait_for_function('peerResult.open===true',timeout=20000)
        payload=list(range(256))*37
        a.evaluate('value=>window.payload=Uint8Array.from(value).buffer',payload)
        a.evaluate("peerA.sendFile(payload,'project.json')")
        b.wait_for_function('length=>peerResult.bytes && peerResult.bytes.length===length',arg=len(payload),timeout=30000)
        received=b.evaluate('peerResult')
        assert received['name']=='project.json' and received['bytes']==payload
        a.wait_for_function('peerResult.ack===true',timeout=10000)
        assert not errors,errors
        a.evaluate('peerA.close()');b.evaluate('peerB.close()')
        a.evaluate('PO33Transfer.open("receive")')
        a.wait_for_function('document.body.classList.contains("transfer-open")')
        a.locator('#transferPeerReceive').wait_for(state='visible')
        a.evaluate('PO33Transfer.close()')
        a.evaluate('PO33Transfer.open("send")')
        a.wait_for_function('document.body.classList.contains("transfer-open")')
        a.locator('#transferPeerSend').wait_for(state='visible')
        assert not a.locator('#transferPeerSend').is_disabled()
        a.locator('#transferPeerSend').click()
        a.wait_for_function('document.querySelector("#transferPeer")?.open===true',timeout=20000)
        pair_box=a.locator('#peerQR').bounding_box()
        target_size=a.evaluate('Math.min(innerWidth*.94,innerHeight*.52,480)')
        assert pair_box['width']>=target_size-1 and pair_box['width']==pair_box['height'],pair_box
        offer=a.locator('#peerQR').get_attribute('title')
        assert offer and offer.startswith('WS1:')
        assert a.evaluate('('+qr_decode+')('+json.dumps(offer)+')')==offer
        a.locator('#peerCancel').click();a.evaluate('PO33Transfer.close()')
        browser.close()
    print('PASS compressed offer/reply QR signaling, local WebRTC data channel between browser pages, chunked transfer, SHA-256 validation and acknowledgment; no signaling or file server used.')
finally:
    server.shutdown();server.server_close()

