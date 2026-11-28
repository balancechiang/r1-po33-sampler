# Direct browser transfer

Web Sampler can send a project directly between two open browser pages without uploading it to GitHub, R2, or a signaling service.

1. Connect both devices to the same Wi-Fi and open Web Sampler over HTTPS.
2. On the sending page, choose **Write + Sound + Play**, then **Direct send · QR**. Keep the offer QR visible.
3. On the receiving page, choose **Write + Sound + Record**, then **Direct receive · QR**, and scan the offer.
4. The receiver displays a reply QR. Scan it on the sending device. Once connected, the project is exported as lossless JSON, transferred in chunks over WebRTC, and checked with SHA-256 before import.

The QR codes exchange only compressed WebRTC connection descriptions. No project audio or project file is put into either QR. The connection uses local ICE candidates and does not configure STUN or TURN servers. File bytes travel over an encrypted WebRTC data channel directly between browsers; the transfer cannot fall back to an online relay.

This requires `RTCPeerConnection`, `RTCDataChannel`, `CompressionStream`, `DecompressionStream`, camera access on the receiver, and a secure context. GitHub Pages supplies HTTPS for the app but does not participate in pairing or carry file data. If the network isolates Wi-Fi clients, the app's WebView blocks local WebRTC, or the browser blocks camera access, direct transfer will fail; use **Save JSON** and **Load File** instead. Pairing QR generation/compression and browser-to-browser transfer have automated coverage in local browser pages; physical phone-to-phone and Rabbit R1 WebView behavior still need device testing.
