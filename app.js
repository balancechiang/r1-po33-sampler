/* PO-33 K.O! style micro-sampler — steps 1-4
   step 1: 16 pads, 4x4 grid, synth voices
   step 2: mic sampling into 16 slots, 40.0 s shared pool, lo-fi output chain
   step 3: 16-step sequencer with swing, 16 patterns, wheel-driven BPM/TRIM/PITCH
   step 4: punch-in FX pads 1-8 and a 4-bar WAV export
   persistence: binary PCM in IndexedDB; small view indexes/pattern metadata
   in creationStorage, with legacy WAV/Base64 import.
   Everything not restored is synthesized with the Web Audio API. */
(function () {
  "use strict";
  // Hardware projects can be auditioned without reading or writing saved projects.
  var backupPreview = new URLSearchParams(window.location.search).get("backupPreview") === "1";
  var hardwareTransfer=null,startupReady=false;
  // Keep panel performance gestures out of the dedicated transfer audio path.
  ["pointerdown","keydown","wheel","sideClick","longPressStart","scrollUp","scrollDown"].forEach(function(type){
    window.addEventListener(type,function(e){
      if(!startupReady){if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();return;}
      if(!hardwareTransfer || !hardwareTransfer.view.active)return;
      if(type==="sideClick"){hardwareTransfer.activateFocus();if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();return;}
      if(type==="scrollUp" || type==="scrollDown" || type==="wheel"){
        var direction=type==="scrollUp"?-1:type==="scrollDown"?1:e.deltaY>0?1:e.deltaY<0?-1:e.deltaX>0?1:e.deltaX<0?-1:0;
        if(direction)hardwareTransfer.moveFocus(direction);
        if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();return;
      }
      var controls=e.target && e.target.closest && e.target.closest("#transferControls");
      if(controls){if(type==="keydown")e.stopPropagation();return;}
      if(e.key==="Escape")hardwareTransfer.close();
      if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();
    },true);
  });

  // ---------- constants & state ----------
  var MELODIC_SLOTS = 8; // slots 1-8 melodic, 9-16 drum
  var TOTAL_SLOTS = 16;
  var MEM_TOTAL = 40.0; // shared sample memory, seconds
  var MIN_TAKE = 0.12; // shorter takes are thrown away, seconds

  var STEPS = 16; // steps in one bar
  var PATTERNS = 16; // pattern slots
  var SWING = factorySwing(); // fraction of a 16th applied to every second step
  var RAMP = 0.005; // 5 ms gain ramps
  var EXPORT_BARS = 4; // 64 steps
  var WAV_NAME = "po33-r1-beat.wav";

  var MODES = { PLAY: "PLAY", SOUND: "SOUND", STEP: "STEP", PATTERN: "PATTERN", FX: "FX" };

  var state = {
    mode: "PLAY",
    slot: 1
  };

  // samples[slot-1] = { buffer: AudioBuffer, duration: seconds } or null
  var samples = [];
  for (var s0 = 0; s0 < TOTAL_SLOTS; s0++) samples.push(null);

  // ---------- persistence ----------
  // Small per-slot view indexes and metadata use Creation storage.
  // PCM assets are verified in IndexedDB before an index is published.
  var WAV_RATE = 16000; // legacy decoding fallback only
  var PK = {
    meta: "po33.meta",
    assetScope:"po33.asset-scope",
    reset: "po33.reset",
    slot: function (n) { return "po33.slot" + n; },
    pat: function (n) { return "po33.pat" + n; }
  };
  var store = null; // null = storage unavailable, everything stays in memory
  var savedSig = []; // signature of what is stored, per slot; null = not stored
  var patSig = []; // JSON of what is stored, per pattern
  var persistPaused = false; // a restore is in progress: do not write yet
  var saveRunning = false; // guards the store chain while it is blocked
  var saveQueue = []; // writes waiting for the store
  var saveQueued = {};
  var failedSaveKeys=new Set();
  var storeFail = null; // last storage failure, reported in the hint
  var unsaved = 0; // slots kept for this session only
  var restored = 0; // slots brought back from storage
  var storageWarn = ""; // what the restore had to report
  var storageReady = false;
  var resetBusy=false,resetFailure=false,resetUntil=0,resetHoldTimer=null,resetPointer=null,resetKey=null;
  var resetHoldStarted=0;

  for (var sg0 = 0; sg0 < TOTAL_SLOTS; sg0++) { savedSig.push(undefined); patSig.push(undefined); }

  function b64utf8(str) {
    var json = JSON.stringify(str);
    if (window.btoa && window.unescape && window.encodeURIComponent) {
      return window.btoa(window.unescape(window.encodeURIComponent(json)));
    }
    var out = "";
    for (var i = 0; i < json.length; i++) {
      var c = json.charCodeAt(i);
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0x800) out += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return window.btoa(out);
  }

  function unb64utf8(b64) {
    var raw = window.atob(b64);
    if (window.escape && window.decodeURIComponent) {
      try { return JSON.parse(window.decodeURIComponent(window.escape(raw))); } catch (e1) { /* not a JSON string */ }
    }
    var s = "";
    for (var i = 0; i < raw.length; i++) {
      var c = raw.charCodeAt(i);
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c < 0xe0) { s += String.fromCharCode(((c & 31) << 6) | (raw.charCodeAt(++i) & 63)); }
      else { s += String.fromCharCode(((c & 15) << 12) | ((raw.charCodeAt(++i) & 63) << 6) | (raw.charCodeAt(++i) & 63)); }
    }
    return JSON.parse(s);
  }

  function installationStore(api) {
    var id=d.documentElement.getAttribute("data-po33-install");
    if(!id || !/^[a-z0-9-]{1,64}$/.test(id))return api;
    var prefix="po33.install."+id+".";
    return {getItem:function(k){return api.getItem(prefix+k);},setItem:function(k,v){return api.setItem(prefix+k,v);},removeItem:function(k){return api.removeItem(prefix+k);}};
  }
  function storageCandidate() {
    if (backupPreview) return null;
    var cs = window.creationStorage;
    try {
      if (cs && cs.plain && typeof cs.plain.getItem === "function") return installationStore(cs.plain);
    } catch (e) { /* no bridge */ }
    try {
      if (window.localStorage) return installationStore(window.localStorage);
    } catch (e2) { /* localStorage blocked */ }
    return null;
  }

  function callStore(api, m, k, v) {
    return new Promise(function (resolve) {
      var done = false;
      function fin(ok, val) { if (!done) { done = true; resolve({ ok: ok, value: val }); } }
      setTimeout(function () { fin(false); }, 4000); // a hung bridge must not wedge the saves
      try {
        if(m==="set" && v===undefined){fin(false);return;}
        var r = m === "set" ? api.setItem(k, v) : (m === "get" ? api.getItem(k) : api.removeItem(k));
        if (r && typeof r.then === "function") {
          r.then(function (val) { fin(true, val); }, function () { fin(false); });
        } else {
          fin(true, r);
        }
      } catch (e) { fin(false); }
    });
  }

  function base64Bytes(b64) {
    try { return window.atob(b64).length; } catch (e) { return 0; }
  }

  function storePump() {
    if (saveRunning || (resetBusy && !resetCommitting) || resetFailure) return;
    if (!store) { saveQueue = []; saveQueued = {}; return; }
    var job = saveQueue.shift();
    if (!job) return;
    delete saveQueued[job.key];
    saveRunning = true;
    Promise.resolve().then(async function(){
      if(job.prepare){job.manifest=await job.prepare();job.value=b64utf8(job.manifest);}
      var result=await callStore(store,job.value?"set":"remove",job.key,job.value || undefined);
      if(result.ok && job.slot){try{await window.PO33SampleAssets.finish(job.slot,job.manifest || null);}catch(error){storageWarn="ASSET CLEANUP PENDING";}}
      return result;
    }).catch(function(){return {ok:false};}).then(function (res) {
      if (!res.ok) storeFailed(job);
      else {
        storeFail = null;failedSaveKeys.delete(job.key);
        // the slot did make it into storage after all
        if (job.sig !== undefined && savedSig[job.slot - 1] === null) {
          savedSig[job.slot - 1] = job.sig;
          settled(job.slot);
        }
        if(job.slot)settled(job.slot);
        if (job.pat !== undefined) {
          patSig[job.pat - 1] = job.value ? job.psig : null;
        }
      }
      saveRunning = false;
      storePump();
      paint();
    });
  }

  function enqueueSave(job) {
    if(hardwareTransfer && hardwareTransfer.hasSession)return;
    if (saveQueued[job.key]) {
      saveQueue = saveQueue.filter(function (j) { return j.key !== job.key; });
    }
    saveQueue.push(job);
    saveQueued[job.key] = true;
    storePump();
  }

  // a write failed: most likely the quota. Keep the take for this session and
  // say so once; the slot stays listed as not saved.
  function storeFailed(job) {
    storeFail = job.key;failedSaveKeys.add(job.key);
    if (job.sig !== undefined) {
      savedSig[job.slot - 1] = null;
      settled(job.slot);
    }
    flashHint("STORE FULL · SLOT " + job.slot + " IN MEMORY ONLY");
  }

  function settled(slot) {
    var n = 0;
    for (var i = 0; i < TOTAL_SLOTS; i++) if (samples[i] && savedSig[i] === null) n++;
    if (n > unsaved) flashHint("STORE FULL · " + n + " TAKE" + (n > 1 ? "S" : "") + " IN MEMORY ONLY");
    unsaved = n;
    paint();
  }

  // the short signature of a take: four evenly spread samples are enough to
  // tell one take from the next when the gesture is undone
  function slotSig(s) {
    var len = s.buffer.width || s.buffer.length || 0;
    var sum = 0;
    if (len && s.buffer.getChannelData) {
      var ch = s.buffer.getChannelData(0);
      for (var i = 0; i < 4; i++) sum += ch[Math.floor((len * (i + 1)) / 5)] || 0;
    }
    function viewSig(v){
      if(!v)return "empty";
      if(!v.buffer._po33id)v.buffer._po33id="a"+Date.now().toString(36)+"-"+(++audioSerial);
      return [v.buffer._po33id,v.offset || 0,v.duration].join(":");
    }
    return len + ":" + s.duration.toFixed(4) + ":" + sum.toFixed(4)+":"+viewSig(s)+":"+(s.sliceViews ? s.sliceViews.map(viewSig).join("|") : "");
  }

  function b64ToBytes(b64) {
    var raw = window.atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // decode one stored slot back into an AudioBuffer; a browser that cannot
  // decode (or hands back another rate) gets a plain pass-through resample
  function decodeTake(bytes, c) {
    function pcm() {
      if (bytes.length < 46 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "RIFF") return null;
      var rate = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16) | (bytes[27] << 24);
      var n = (bytes.length - 44) >> 1;
      var data = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var v = bytes[44 + i * 2] | (bytes[45 + i * 2] << 8);
        if (v > 32767) v -= 65536;
        data[i] = v / 32768;
      }
      return { rate: rate || WAV_RATE, data: data };
    }
    function frame(p) {
      if (!p) return null;
      if (Math.abs(p.rate - c.sampleRate) < 1e-9) return p;
      var n = Math.max(1, Math.round((p.data.length * c.sampleRate) / p.rate));
      var out = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = (i * p.rate) / c.sampleRate;
        var i0 = Math.floor(x);
        var i1 = Math.min(p.data.length - 1, i0 + 1);
        var f = x - i0;
        out[i] = (p.data[i0] || 0) * (1 - f) + (p.data[i1] || 0) * f;
      }
      return { rate: c.sampleRate, data: out };
    }
    function build(p) {
      if (!p || !p.data.length) return null;
      var buf = c.createBuffer(1, p.data.length, p.rate);
      if (buf.copyToChannel) buf.copyToChannel(p.data, 0);
      else buf.getChannelData(0).set(p.data);
      return { buffer: buf, duration: p.data.length / p.rate };
    }
    function plain() { return build(frame(pcm())); }
    var head = new Uint8Array(bytes).buffer;
    if (c.decodeAudioData) {
      try {
        var out = null;
        var toTake = function (buf) {
          if (!buf || !buf.duration) return null;
          return build(frame({ rate: buf.sampleRate || WAV_RATE, data: buf.getChannelData(0) }));
        };
        var p = c.decodeAudioData(head, function (buf) { out = buf; }, function () { out = null; });
        if (p && typeof p.then === "function") {
          return p.then(function (buf) { return toTake(buf || out); }, function () {
            return plain();
          });
        }
        if (out) return Promise.resolve(toTake(out));
        if (p && p.numberOfChannels && p.getChannelData) return Promise.resolve(toTake(p));
      } catch (e2) { /* fall through to the plain PCM path */ }
    }
    return Promise.resolve(plain());
  }

  // a take being recorded into a slot: the wheel can set its trim/pitch early
  var pendingTrim = [];
  var pendingPitch = [];
  for (var pt0 = 0; pt0 < TOTAL_SLOTS; pt0++) { pendingTrim.push(0); pendingPitch.push(0); }

  var metaTimer = null;
  var slotTimer = null;

  // remove a slot's stored take (deleted, or it had to be replaced)
  function removeSlotStored(slot) {
    savedSig[slot - 1] = null;
    enqueueSave({ key: PK.slot(slot), slot: slot, sig: null, value: "" });
    persistSoon();
  }

  // store a take that is not in storage yet. Writing waits for the restore to
  // end, so anything recorded during startup is encoded afterwards.
  function saveSlot(slot) {
    var s = samples[slot - 1];
    if (!s) { removeSlotStored(slot); return; }
    if (persistPaused || !ac) { savedSig[slot - 1] = null; return; }
    savedSig[slot-1]=slotSig(s);
    enqueueSave({key:PK.slot(slot),slot:slot,sig:savedSig[slot-1],prepare:function(){return window.PO33SampleAssets.pack(slot,s);}});
    persistSoon();
  }

  var audioSerial = 0;
  function decodeStoredTake(value, pool) {
    var packed=unb64utf8(value);
    if(packed && packed.format===4)return window.PO33SampleAssets.unpack(packed,ac,pool);
    if (!packed || packed.format!==3) return decodeTake(b64ToBytes(packed), ac);
    var ids=Object.keys(packed.assets);
    return Promise.all(ids.map(function(id){
      if (!pool[id]) pool[id]=decodeTake(b64ToBytes(packed.assets[id]),ac).then(function(s){
        if(!s)throw new Error("bad audio asset");s.buffer._po33id=id;return s.buffer;
      });
      return pool[id];
    })).then(function(buffers){
      function unpack(v){
        if(!v)return null;
        var b=buffers[ids.indexOf(v.asset)];
        if(!b || !(v.duration>0) || v.offset<0 || v.offset+v.duration>b.duration+.002)throw new Error("bad audio view");
        return {buffer:b,offset:v.offset || 0,duration:Math.min(v.duration,b.duration-(v.offset || 0)),trim:0,pitch:0};
      }
      var s=unpack(packed.base);if(packed.slices)s.sliceViews=packed.slices.map(unpack);return s;
    });
  }

  function writePattern(p) {
    var json = JSON.stringify(patterns[p - 1].lanes);
    patSig[p - 1] = json;
    enqueueSave({ key: PK.pat(p), pat: p, psig: json, sig: undefined, value: b64utf8(patterns[p - 1].lanes) });
    persistSoon();
  }

  // the sixteen slots' trim and pitch, so the wheel settings come back too
  function slotParams() {
    var out = [];
    for (var n = 1; n <= TOTAL_SLOTS; n++) {
      var t = samples[n - 1];
      out.push(t ? [slotTrim(n), slotPitch(n)] : null);
    }
    return out;
  }

  function writeMeta() {
    enqueueSave({
      key: PK.meta,
      sig: undefined,
      value: b64utf8({
        v: 3,
        slot: state.slot,
        pattern: seq.pattern,
        bpm: params.bpm,
        swing: SWING,
        trim: params.trim,
        pitch: params.pitch,
        hardwareTone:hardwareToneEnabled, slots: slotParams(), tweaks: tweaks, extras: patternExtras, chain: patternChain, masterVolume: masterVolume, factoryRevision: 1, factoryTempoRevision:factoryTempoRevision, factoryMuted: factoryMuted, lastNotes:lastNotes
      })
    });
  }

  var metaTimer = null;
  function persistSoon() {
    if(hardwareTransfer && hardwareTransfer.hasSession){hardwareTransfer.checkpoint();return;}
    if (persistPaused) return;
    if (metaTimer) clearTimeout(metaTimer);
    metaTimer = setTimeout(function () {
      metaTimer = null;
      if (!persistPaused) writeMeta();
    }, 250);
  }

  // anything still queued goes out now (the page may be closing)
  function flushPersist() {
    if(hardwareTransfer && hardwareTransfer.hasSession){hardwareTransfer.flush().catch(function(){});return;}
    if (persistPaused) return;
    savePendingTakes();
    for (var p = 1; p <= PATTERNS; p++) {
      var json = JSON.stringify(patterns[p - 1].lanes);
      if (patSig[p - 1] === json) continue;
      patSig[p - 1] = json;
      enqueueSave({ key: PK.pat(p), pat: p, psig: json, sig: undefined, value: b64utf8(patterns[p - 1].lanes) });
    }
    if (metaTimer) { clearTimeout(metaTimer); metaTimer = null; }
    writeMeta();
  }

  // writes that arrived while no audio context existed yet can now be encoded
  function savePendingTakes() {
    if (!ac) return;
    for (var n = 1; n <= TOTAL_SLOTS; n++) {
      var s = samples[n - 1];
      if (!s || savedSig[n - 1] !== undefined) continue;
      saveSlot(n);
    }
  }

  function seedFactory(meta) {
    var factory=window.PO33_FACTORY, seeded=[];if(!factory)return seeded;
    var c;try{c=ctx();}catch(err){return seeded;}
    factory.slots.forEach(function(asset){
      var index=asset.slot-1;if(samples[index] || factoryMuted[index])return;
      var bytes=b64ToBytes(asset.wav), view=new DataView(bytes.buffer), rate=view.getUint32(24,true);
      var count=(bytes.length-44)/2,duration=count/rate;
      var id="factory-"+(factory.revision || 1)+"-"+asset.slot,buffer=null;
      samples.forEach(function(s){
        if(!s)return;
        [s].concat(s.sliceViews || []).forEach(function(v){if(v && v.buffer._po33id===id)buffer=v.buffer;});
      });
      if(!buffer && usedSeconds()+duration>MEM_TOTAL)return;
      if(!buffer){
        buffer=c.createBuffer(1,count,rate);var channel=buffer.getChannelData(0);
        for(var i=0;i<count;i++)channel[i]=view.getInt16(44+i*2,true)/32768;
        buffer._po33id=id;
      }
      samples[index]={buffer:buffer,duration:duration,trim:0,pitch:0,factory:true,name:asset.name};
      savedSig[index]=slotSig(samples[index]);
    });
    if(!meta || !meta.factoryRevision)factory.patterns.forEach(function(p,i){
      if(!patternHasData(patterns[i])){
        patterns[i]={lanes:p.lanes.map(function(l){return l.slice();})};
        patternExtras[i]=p.extras?JSON.parse(JSON.stringify(p.extras)):{effects:[],locks:{}};
        seeded.push(i+1);
      }
    });
    if((!meta || (seeded.length && !meta.factoryRevision)) && Array.isArray(factory.chain)){
      patternChain=factory.chain.filter(function(n){return n>=1 && n<=16;}).slice(0,128);
      seq.pattern=patternChain[0] || 1;chainPosition=0;
    }
    if(seeded.length && !meta){params.bpm=factoryTempo();SWING=factorySwing();}
    return seeded;
  }

  // ---------- restore ----------
  var assetScopePromise=null;
  function ensureAssetScope(){
    if(assetScopePromise)return assetScopePromise;
    assetScopePromise=(async function(){
      var result=await callStore(store,'get',PK.assetScope),scope=result.value;
      if(!result.ok)return false;
      if(!/^[a-f0-9]{32}$/.test(scope || '')){
        scope=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(function(v){return v.toString(16).padStart(2,'0');}).join('');
        if(!(await callStore(store,'set',PK.assetScope,scope)).ok)return false;
        var verify=await callStore(store,'get',PK.assetScope);if(!verify.ok || verify.value!==scope)return false;
      }
      window.PO33SampleAssets.configure(scope);return true;
    })().catch(function(){return false;});return assetScopePromise;
  }
  function restoreAll() {
    persistPaused = true;
    var metaParams = null;
    store = storageCandidate();
    if (!store) {
      persistPaused = false;
      storageReady = true;
      return Promise.resolve(false);
    }
    var reads = [];
    reads.push(callStore(store, "get", PK.meta));
    for (var n = 1; n <= TOTAL_SLOTS; n++) reads.push(callStore(store, "get", PK.slot(n)));
    for (var p = 1; p <= PATTERNS; p++) reads.push(callStore(store, "get", PK.pat(p)));
    return Promise.all(reads).then(async function (res) {
      if(res.some(function(item){return !item.ok;}))throw Error("Project storage read failed");
      if(!await ensureAssetScope())storageWarn="ASSET STORAGE UNAVAILABLE";
      var meta = null;
      if (res[0].ok && typeof res[0].value === "string") {
        try { meta = unb64utf8(res[0].value); } catch (e) { meta = null; }
      }
      for (var q = 1; q <= PATTERNS; q++) {
        var rp = res[TOTAL_SLOTS + q];
        if (!rp.ok || typeof rp.value !== "string") continue;
        try {
          var lanes = unb64utf8(rp.value);
          if (!lanes || lanes.length !== TOTAL_SLOTS) continue;
          for (var a = 0; a < TOTAL_SLOTS; a++) {
            if (!lanes[a] || lanes[a].length !== STEPS) throw new Error("bad lanes");
            for (var b = 0; b < STEPS; b++) {
              var v = lanes[a][b];
              lanes[a][b] = (typeof v === "number" && v >= 0 && v < TOTAL_SLOTS) ? Math.floor(v) : -1;
            }
          }
          patterns[q - 1] = { lanes: lanes };
          patSig[q - 1] = JSON.stringify(lanes);
        } catch (e2) { /* a bad pattern is left empty */ }
      }
      if (meta) {
        factoryTempoRevision=meta.factoryTempoRevision || 0;
        if(typeof meta.hardwareTone==="boolean")setHardwareTone(meta.hardwareTone,false);
        if(Array.isArray(meta.lastNotes) && meta.lastNotes.length===16)lastNotes=meta.lastNotes.map(function(n){return Math.max(0,Math.min(15,n|0));});
        if(Array.isArray(meta.factoryMuted))factoryMuted=meta.factoryMuted;
        if (Array.isArray(meta.tweaks) && meta.tweaks.length === 16) tweaks = meta.tweaks;
        if (Array.isArray(meta.extras) && meta.extras.length === 16) patternExtras = meta.extras;
        if (Array.isArray(meta.chain)) patternChain = meta.chain.filter(function(n){return n>=1&&n<=16;}).slice(0,128);
        if (typeof meta.swing === "number") SWING = Math.max(0,Math.min(.5,meta.swing));
        if (typeof meta.masterVolume === "number") masterVolume = Math.max(1,Math.min(16,meta.masterVolume));
        if (typeof meta.bpm === "number") params.bpm = Math.max(60, Math.min(240, Math.round(meta.bpm)));
        if (typeof meta.trim === "number") params.trim = Math.max(0, Math.min(90, meta.trim));
        if (typeof meta.pitch === "number") params.pitch = Math.max(-12, Math.min(12, Math.round(meta.pitch)));
        if (typeof meta.pattern === "number" && meta.pattern >= 1 && meta.pattern <= PATTERNS) seq.pattern = Math.floor(meta.pattern);
        if (typeof meta.slot === "number" && meta.slot >= 1 && meta.slot <= TOTAL_SLOTS) state.slot = Math.floor(meta.slot);
        lastNote=lastNotes[state.slot-1];
        if (meta.slots && meta.slots.length === TOTAL_SLOTS) metaParams = meta.slots;
      }
      paint();

      var confirmedIndexes=[];
      for(var si=1;si<=16;si++)if(res[si].ok){var index=null;try{var value=unb64utf8(res[si].value);if(value?.format===4)index=value;}catch(error){}confirmedIndexes.push([si,index]);}
      try{await window.PO33SampleAssets.reconcile(confirmedIndexes);}catch(error){storageWarn="ASSET STORAGE UNAVAILABLE";}
      // the takes: decode every stored slot, then fill the 40 s pool in slot
      // order so a set that does not fit loses only its tail, visibly
      var stored = [];
      for (var n2 = 1; n2 <= TOTAL_SLOTS; n2++) {
        var r = res[n2];
        if (r.ok && typeof r.value === "string" && r.value) stored.push({ slot: n2, value: r.value, raw: r.value });
        else if (r.ok) savedSig[n2 - 1] = null; // read cleanly, nothing stored
      }
      if (!stored.length) {
        persistDone(meta);
        return false;
      }
      if (!ac) { try { ctx(); } catch (e3) { /* no audio yet: takes wait in storage */ } }
      if (!ac) {
        persistDone(meta);
        return false;
      }
      var restoredPool={},migrate=[];
      return stored.reduce(function (chain, item) {
        return chain.then(function (used) {
          return Promise.resolve().then(function(){return decodeStoredTake(item.value,restoredPool);}).then(function (s) {
            if (!s || !s.duration) { savedSig[item.slot - 1] = null; enqueueSave({ key: PK.slot(item.slot), slot: item.slot, sig: null, value: "" }); return used; }
            samples[item.slot-1]=s;
            if (usedSeconds() > MEM_TOTAL + 1e-6) {
              samples[item.slot-1]=null;
              // this take does not fit the 40 s pool: it stays out, and the
              // bar says so rather than dropping audio quietly
              savedSig[item.slot - 1] = null;
              storageWarn = "MEMORY FULL · SLOT " + item.slot + " NOT LOADED";
              enqueueSave({ key: PK.slot(item.slot), slot: item.slot, sig: null, value: "" });
              return used;
            }
            samples[item.slot - 1] = s;
            savedSig[item.slot - 1] = item.raw;
            var mp = metaParams && metaParams[item.slot - 1];
            s.trim = mp && typeof mp[0] === "number" ? Math.max(0, Math.min(90, mp[0])) : 0;
            s.pitch = mp && typeof mp[1] === "number" ? Math.max(-12, Math.min(12, Math.round(mp[1]))) : 0;
            restored++;
            try{if(unb64utf8(item.value)?.format!==4)migrate.push(item.slot);}catch(error){}
            return usedSeconds();
          }).catch(function(){storageWarn="UNREADABLE SLOT "+item.slot;return used;});
        });
      }, Promise.resolve(0)).then(function (used) {
        if (used > MEM_TOTAL + 1e-6 && storageWarn.indexOf("NOT LOADED") < 0) {
          storageWarn = "MEMORY FULL · RESTORED " + used.toFixed(1) + "s";
        }
        persistDone(meta);
        migrate.forEach(saveSlot);
        return true;
      });
    })["catch"](function (error) {
      persistPaused=true;storageReady=true;throw error;
    });
  }

  function repairFactoryTempo(){
    var f=window.PO33_FACTORY,id=d.documentElement.getAttribute("data-po33-install");
    if(id!=="flowers-20261120" || factoryTempoRevision>=1)return false;
    factoryTempoRevision=1;
    var untouched=f && !factoryMuted.some(Boolean) && f.patterns.every(function(p,i){return JSON.stringify(patterns[i].lanes)===JSON.stringify(p.lanes);}) && f.slots.every(function(a){var s=samples[a.slot-1];return s && s.buffer._po33id==="factory-"+f.revision+"-"+a.slot;});
    if(untouched && params.bpm===80){params.bpm=factoryTempo();SWING=factorySwing();}
    return true;
  }
  function persistDone(meta) {
    var seeded = seedFactory(meta),tempoRepaired=repairFactoryTempo();
    persistPaused = false;
    storageReady = true;
    seeded.forEach(function(n){writePattern(n);});
    if(tempoRepaired || seeded.length || !meta || !meta.factoryRevision)persistSoon();
    // what came back from storage is what is stored for each slot
    for (var n = 1; n <= TOTAL_SLOTS; n++) {
      if (samples[n - 1] && savedSig[n - 1] === undefined) savedSig[n - 1] = slotSig(samples[n - 1]);
    }
    paint();
    // pattern edits, re-recordings and deletions made mid-restore go out now
    for (var p = 1; p <= PATTERNS; p++) {
      var json = JSON.stringify(patterns[p - 1].lanes);
      if (patSig[p - 1] !== undefined && patSig[p - 1] !== json) {
        patSig[p - 1] = json;
        enqueueSave({ key: PK.pat(p), pat: p, psig: json, sig: undefined, value: b64utf8(patterns[p - 1].lanes) });
      }
    }
    for (var k = 1; k <= TOTAL_SLOTS; k++) {
      if (samples[k - 1] && savedSig[k - 1] === null) {
        saveSlot(k);
      }
    }
    savePendingTakes();
    storePump();
    // the set that did not fit, or a failed write: say it in the status bar
    if (storageWarn) flashHint(storageWarn);
  }

  // patterns[p].lanes[slot-1][step] = pad index 0..15, or -1 when the step is off
  function emptyPattern() {
    var lanes = [];
    for (var a = 0; a < TOTAL_SLOTS; a++) {
      var row = [];
      for (var b = 0; b < STEPS; b++) row.push(-1);
      lanes.push(row);
    }
    return { lanes: lanes };
  }
  function clonePattern(p) {
    var out = emptyPattern();
    for (var a = 0; a < TOTAL_SLOTS; a++) {
      for (var b = 0; b < STEPS; b++) out.lanes[a][b] = p.lanes[a][b];
    }
    return out;
  }
  var patterns = [];
  for (var pi = 0; pi < PATTERNS; pi++) patterns.push(emptyPattern());

  // ---------- parameters driven by the wheel ----------
  var PARAM_NAMES = ["BPM", "TRIM", "PITCH"];
  function factoryTempo(){var f=window.PO33_FACTORY,p=f && f.patterns && f.patterns[0],bpm=f && (f.bpm || p && p.bpm);return Number.isFinite(bpm)?Math.max(60,Math.min(240,Math.round(bpm))):120;}
  function factorySwing(){var f=window.PO33_FACTORY,p=f && f.patterns && f.patterns[0],swing=f && (f.swing===undefined?p && p.swing:f.swing);return Number.isFinite(swing)?Math.max(0,Math.min(.5,swing)):0;}
  var params = { bpm: factoryTempo(), trim: 0, pitch: 0 };
  var factoryTempoRevision=0;
  var paramIdx = 0;
  var KNOB_SWEEP = 270; // total mechanical travel, shared by both knobs

  var factoryMuted = [], knobAngles = [0,0],HOLD_DELAY=800,soundPreviewMeter=false;
  var parameterDisplay=false;
  var lcdIndicator=null,outputBallistics=new window.PO33Indicator.Meter(),inputBallistics=new window.PO33Indicator.Meter();
  var sideRecArmed=false, sideRecHeld=false, sideClickIgnoreUntil=0;
  var shakeFx=0, lastShakeFx=0, outputActiveUntil=0;
  var r1Focused=true;
  var shakeSensor=null, sensorGeneration=0, shakeTimer=null, shakeCount=0;
  var shakeLastPeak=-Infinity, shakeBaseline=null, shakeReady=true, shakeCancelled=false;
  var transportFrame=null, transportLastFrame=0;
  var tweakMode = 0, bpmHeld = false, fxHeld = false, writeHeld = false;
  var modifierPointers = {}, modifierUsed = {}, previousMode = "PLAY";
  var patternSelection = [], patternChain = [], chainPosition = 0;
  var patternInputTimer=null,PATTERN_INPUT_GAP=1200;
  var lastNote = 0, displayValue = null, displayUntil = 0;
  var lastNotes = Array(16).fill(0), lastWasSlice=false;
  var stepEdit=null, stepCopyTimer=null, pendingCopy=null, defaultStep=null;
  var masterVolume = 8, outputMeter = null, outputData = null, inputLevel = 0,inputPeak=0;
  var tweaks = [], patternExtras = [];
  for (var ti = 0; ti < 16; ti++) {
    tweaks.push({pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}});
    patternExtras.push({effects:[],locks:{}});
  }
  var parameterLatches=new window.PO33Sampling.Latches();
  function effectiveTweak(slot,when){var now=ac?ac.currentTime:0;parameterLatches.flush(now);return parameterLatches.at(slot,tweaks[slot-1],when===undefined?now:when);}
  function manualParameter(slot,key,value){
    var now=ctx().currentTime;parameterLatches.manual(slot,key,value,now);
    updateLiveSlot(slot,{[key]:value},now);
    rebuildUnheard(slot);
  }
  function selectedTweak(slot, note) {
    var t = tweaks[slot - 1];
    if (slot <= 8 || tweakMode !== 2) return t;
    if (!t.slices[note]) t.slices[note] = {start:0,length:100};
    return t.slices[note];
  }

  var seq = {
    playing: false,
    pattern: 1,
    queued: 0,
    step: 0, // step lit on the grid
    schedStep: 0, // next step to schedule
    nextTime: 0,
    timer: null,
    lastGrid: 0,
    totalSteps: 0
  };

  var FX_NAMES = window.PO33FX.names;
  var FX_LABELS = FX_NAMES;

  // ---------- audio graph ----------
  // every voice -> master -> [dry + fx] -> bus -> optional hardware tone -> volume -> out
  var ac = null;
  var master = null;
  var bus = null;
  var mixVolume = null;
  var dryGain = null;
  var hardwareToneEnabled=true,hardwareToneReady=false,hardwareToneError="",toneDry=null,toneWet=null,toneNode=null;
  var outTrim = null;
  var noiseBuf = null;
  var musicGraphStale=false;

  function ctx() {
    if (ac) {
      if (ac.state!=="running")window.PO33Runtime.resume(ac);
      return ac;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC({latencyHint:"interactive"});window.PO33Runtime.register(ac);window.PO33Runtime.resume(ac);
    var graphContext=ac,hasRun=ac.state==='running';
    ac.addEventListener('statechange',function(){if(ac!==graphContext)return;if(ac.state==='running')hasRun=true;else if(hasRun)musicGraphStale=true;});

    master = ac.createGain();
    master.gain.value = 1;

    dryGain = ac.createGain();
    dryGain.gain.value = 1;

    bus = ac.createGain();
    bus.gain.value = 1;
    mixVolume=ac.createGain();mixVolume.gain.value=masterVolume/16;

    outTrim = ac.createGain();
    outTrim.gain.value = 0.8;

    master.connect(dryGain);
    dryGain.connect(bus);

    toneDry=ac.createGain();toneWet=ac.createGain();toneDry.gain.value=1;toneWet.gain.value=0;
    bus.connect(toneDry);toneDry.connect(mixVolume);toneWet.connect(mixVolume);mixVolume.connect(outTrim);
    installHardwareTone(ac);
    outTrim.connect(ac.destination);
    outputMeter = ac.createAnalyser(); outputMeter.fftSize = 2048;
    outputData = new Float32Array(2048); outTrim.connect(outputMeter);
    fxInstall(); // continuously warm history, including manual notes before PLAY
    return ac;
  }

  function toneStatus(){return {enabled:hardwareToneEnabled,ready:hardwareToneReady,error:hardwareToneError};}
  function announceTone(){window.dispatchEvent(new Event('po33-tone-state'));}
  function applyHardwareTone(){if(toneDry){var now=ac.currentTime;rampGain(toneDry,hardwareToneEnabled&&hardwareToneReady?0:1,now);rampGain(toneWet,hardwareToneEnabled&&hardwareToneReady?1:0,now);}announceTone();}
  function setHardwareTone(enabled,save){hardwareToneEnabled=!!enabled;applyHardwareTone();if(save!==false)persistSoon();}
  async function installHardwareTone(c){
    try{if(!c.audioWorklet || !window.AudioWorkletNode)throw Error('AudioWorklet unavailable');
      await c.audioWorklet.addModule(window.PO33_RESOURCE?window.PO33_RESOURCE('./hardware-tone-worklet.js'):'./hardware-tone-worklet.js?v=flowers-20261120-ui25');
      if(c!==ac)return;
      toneNode=new AudioWorkletNode(c,'po33-hardware-tone',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
      toneNode.onprocessorerror=function(){if(c!==ac)return;hardwareToneReady=false;hardwareToneError='Tone unavailable';applyHardwareTone();};
      bus.connect(toneNode);toneNode.connect(toneWet);hardwareToneReady=true;applyHardwareTone();
    }catch(error){if(c!==ac)return;hardwareToneError='Tone unavailable';hardwareToneReady=false;applyHardwareTone();}
  }
  function noise() {
    var c = ctx();
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(c.sampleRate * 1.5);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function rampGain(g, value, now) {
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
    } catch (err) { /* param without cancel support */ }
    g.gain.linearRampToValueAtTime(value, now + RAMP);
  }

  function now0() {
    var c = ctx();
    return c.currentTime;
  }

  // ---------- punch-in FX ----------
  // Stream effects use the master ring; 13/14 affect transport and 15 each voice.
  var fx = {kind:0,proc:null,wet:null,engine:null,installed:false};
  var fxTimers=[], transportGeneration=0, scheduledEffect=0;
  var sampleVoices=[], reversedBuffers=new WeakMap();
  var voiceEffect=0,scratchHold=null,loopHold=null;

  function fxInstall() {
    if(fx.installed)return;
    var c=ctx();
    if(!fx.wet){fx.wet=c.createGain();fx.wet.gain.value=0;fx.wet.connect(bus);}
    if(!fx.proc){
      fx.engine=new window.PO33FX.Engine(c.sampleRate);
      fx.proc=c.createScriptProcessor(512,1,1);
      fx.proc.onaudioprocess=function(e){fx.engine.process(e.inputBuffer.getChannelData(0),e.outputBuffer.getChannelData(0));};
      fx.proc.connect(fx.wet);
    }
    master.connect(fx.proc);fx.installed=true;
  }
  function clearFxTimers(){
    fxTimers.forEach(function(id){clearTimeout(id);});fxTimers=[];
  }
  function queueFx(effect,at) {
    var generation=transportGeneration;
    var id=setTimeout(function(){
      var index=fxTimers.indexOf(id);if(index>=0)fxTimers.splice(index,1);
      if(generation!==transportGeneration || !seq.playing || fxHeld || shakeFx || !r1Focused || d.hidden)return;
      if(effect)fxEngage(effect,true);else fxRelease(true);paintStepLeds();updateLCD();
    },Math.max(0,(at-ctx().currentTime)*1000));
    fxTimers.push(id);
  }
  function fxEngage(kind,fromPattern) {
    if(kind===16){fxRelease();return;}
    if(kind<1||kind>15)return;
    var c=ctx(),now=c.currentTime;fxInstall();
    var previous=fx.kind;fx.kind=kind;
    var stream=[5,6,9,10].indexOf(kind)>=0;fx.engine.engage(stream?kind:0,stepDur());
    rampGain(dryGain,stream?0:1,now);rampGain(fx.wet,stream?1:0,now);
    if(previous===15 && kind!==15)refreshVoices(kind,true);
    if((previous===7 || previous===8) && kind!==7 && kind!==8)glideOctave(0,fromPattern);
    if(loopHold && !(kind>=1 && kind<=4))releaseLoop();
    if(scratchHold && kind!==11 && kind!==12)releaseScratch();
    if(!fromPattern && (kind===11 || kind===12) && seq.playing)holdScratch(kind);
    if(kind===7 || kind===8)glideOctave(kind,fromPattern);
    if(kind>=1 && kind<=4 && seq.playing)holdLoop(kind,!!fromPattern);
    if(!fromPattern && kind===14 && seq.playing)restartPatternFx();
    if(!fromPattern && kind===15)refreshVoices(15,true);

  }
  function fxRelease(fromPattern) {
    if(!fx.kind)return;
    var previous=fx.kind;fx.kind=0;if(fx.engine)fx.engine.release();
    var now=ctx().currentTime;rampGain(dryGain,1,now);if(fx.wet)rampGain(fx.wet,0,now);
    if(scratchHold)releaseScratch();
    if(previous===7 || previous===8)glideOctave(0,fromPattern);
    if(loopHold)releaseLoop();
    if(previous===15 && !fromPattern)refreshVoices(0,false);
  }
  function reverseBuffer(buffer) {
    var reversed=reversedBuffers.get(buffer);if(reversed)return reversed;
    reversed=ctx().createBuffer(1,buffer.length,buffer.sampleRate);
    var src=buffer.getChannelData(0),out=reversed.getChannelData(0);
    for(var i=0;i<src.length;i++)out[i]=src[src.length-1-i];
    reversedBuffers.set(buffer,reversed);return reversed;
  }
  function trackVoice(src,g,start,end,details) {
    var entry={src:src,gain:g,start:start,end:end,slot:slotNumForVoice,note:voiceNote,
      gate:voiceGate,tweak:JSON.parse(JSON.stringify(voiceTweak)),effect:voiceEffect,...details};
    window.PO33Sampling.allocate(sampleVoices,entry,cutSampleVoice,4);
    window.PO33Runtime.setActive("voices",true);
    src.onended=function(){setTimeout(function(){[src,g,...Object.values(entry.controls || {})].forEach(function(node){try{node.disconnect();}catch(error){}});},40);var i=sampleVoices.indexOf(entry);if(i>=0)sampleVoices.splice(i,1);window.PO33Runtime.setActive("voices",sampleVoices.some(function(v){return v.end>ac.currentTime;}));};
  }
  function cutSampleVoice(v,at) {
    // Tiny release avoids clicks. Keep scheduled future voices in the timeline.
    v.cutAt=Math.min(v.cutAt===undefined?Infinity:v.cutAt,at);
    var when=Math.max(ctx().currentTime,at),gain=v.gain.gain;
    try {
      if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(when);
      else {gain.cancelScheduledValues(when);gain.setValueAtTime(when<=v.start?0:.95,when);}
      gain.linearRampToValueAtTime(0,when+.002);v.src.stop(when+.002);
    } catch(err) {}
  }
  function cancelVoice(v,now) {
    v.cutAt=now;v.end=Math.min(v.end,now);
    try{
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.start>now?0:.95,now);
      v.gain.gain.linearRampToValueAtTime(0,now+RAMP);v.src.stop(now+RAMP);
    }catch(err){}
    var index=sampleVoices.indexOf(v);if(index>=0)sampleVoices.splice(index,1);
  }
  function refreshVoices(effect,includeActive) {
    var now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){
      if(v.effect===effect || v.end<=now || (!includeActive && v.start<=now))return;
      cancelVoice(v,now);
      voice(v.slot,v.note,Math.max(now+RAMP,v.start),v.gate,effect,Object.assign({},v.tweak,effectiveTweak(v.slot,Math.max(now,v.start))));
    });
  }
  function glideOctave(kind,fromPattern){
    var now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){if(v.end<=now || !v.speed || (fromPattern && v.start>now+.002 && v.effect!==kind))return;var at=Math.max(now,v.start),values=effectiveTweak(v.slot,at),base=Math.pow(2,(v.semitones+values.pitch)/12);v.effect=kind;v.speed.target(at,base*(kind===7?2:kind===8?.5:1),.035,now);v.speed.apply(v.src.playbackRate,now);replanVoice(v);});
  }
  function resetStepCursor(step,pattern,time){
    seq.pattern=pattern;seq.schedStep=step;seq.nextTime=time;seq.queued=0;
    if(patternChain.length && patternChain[chainPosition]!==pattern){var prior=(chainPosition+patternChain.length-1)%patternChain.length;chainPosition=patternChain[prior]===pattern?prior:Math.max(0,patternChain.indexOf(pattern));}
  }
  function audibleStepAt(now){
    var current={step:seq.step,pattern:seq.visualPattern || seq.pattern,start:seq.visualStepTime || now,chain:seq.visualChainPosition || 0};
    visQueue.forEach(function(e){if(e.t<=now)current={step:e.s,pattern:e.pattern,start:e.t,chain:e.chain};});return current;
  }
  function holdScratch(kind){
    var now=ctx().currentTime,old=scratchHold,audible=audibleStepAt(now),pattern=old?old.pattern:audible.pattern,step=old?old.step:audible.step;
    sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});visQueue=[];
    parameterLatches.stop(now);scratchHold={pattern:pattern,step:step,chain:old?old.chain:audible.chain,next:now+.004,hit:0,kind:kind};
    seq.step=step;seq.visualPattern=pattern;seq.visualChainPosition=scratchHold.chain;seq.visualStepTime=now;seq.visualStarted=true;paintChase();scheduledEffect=kind;clearFxTimers();transportGeneration++;
    scheduler();
  }
  function scheduleScratch(now){
    var hold=scratchHold,period=stepDur()/(hold.kind===11?2:4);
    if(hold.next<now)hold.next=now+.004;
    while(hold.next<now+.12){var pat=patterns[hold.pattern-1];for(var i=0;i<16;i++){var note=pat.lanes[i][hold.step];if(note>=0)voice(i+1,note,hold.next,period,hold.kind,undefined,{scratch:true,reverse:!!(hold.hit%2)});}hold.hit++;hold.next+=period;}
  }
  function releaseScratch(){
    if(!scratchHold)return;var hold=scratchHold,now=ctx().currentTime;scratchHold=null;
    sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});visQueue=[];
    // Finish the held step and resume its successor, including the pattern boundary.
    chainPosition=hold.chain;resetStepCursor(hold.step,hold.pattern,now+.008);seq.schedStep=hold.step+1;
    if(seq.schedStep>=16){seq.schedStep=0;if(patternChain.length>1){chainPosition=(chainPosition+1)%patternChain.length;seq.pattern=patternChain[chainPosition];}}
    scheduledEffect=-1;
  }
  function advanceLoopShadow(now){
    if(!loopHold)return;var h=loopHold.shadow;
    h.phase+=Math.max(0,now-h.last)/stepDur();h.last=now;
    while(h.phase>=1){h.phase-=1;h.step++;if(h.step>=16){h.step=0;if(h.order.length>1)h.chain=(h.chain+1)%h.order.length;if(h.order.length)h.pattern=h.order[h.chain];if(h.queued){h.pattern=h.queued;h.queued=0;}}if(exporting)exportSteps++;}
  }
  function holdLoop(kind,automatic){
    var now=ctx().currentTime,audible=audibleStepAt(now),old=loopHold;
    if(old)advanceLoopShadow(now);
    var shadow=old?old.shadow:{step:audible.step,pattern:audible.pattern,chain:audible.chain,phase:Math.max(0,(now-audible.start)/stepDur()+(audible.step%2?SWING:0)),last:now,order:patternChain.slice(),queued:seq.queued};
    if(exporting)exportSteps-=visQueue.filter(function(e){return e.t>now;}).length;
    sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});visQueue=[];clearFxTimers();transportGeneration++;parameterLatches.stop(now);
    loopHold={kind:kind,automatic:automatic,pattern:audible.pattern,chain:audible.chain,origin:audible.step,index:0,next:now+.004,shadow:shadow};
    advanceLoopShadow(now);scheduledEffect=kind;seq.queued=0;scheduler();
  }
  function scheduleLoop(now){
    var h=loopHold;advanceLoopShadow(now);
    if(h.automatic){var effect=patternExtras[h.shadow.pattern-1].effects[h.shadow.step] || 0;if(effect!==h.kind){fxRelease(true);return;}}
    if(h.next<now)h.next=now+.004;
    var period=stepDur()/(h.kind===3?2:h.kind===4?3:1),guard=0;
    while(h.next<now+.12 && guard++<128){
      if(exporting && exportSteps>=EXPORT_BARS*STEPS)break;
      var step=h.kind<=2?(h.origin+h.index%(h.kind===1?16:12))%16:h.origin;
      seq.pattern=h.pattern;fireStep(step,h.next,h.kind,{loop:true,kind:h.kind,step:step,period:period});
      visQueue.push({t:h.next,s:step,pattern:h.pattern,chain:h.chain});h.index++;h.next+=period;
    }
  }
  function releaseLoop(){
    if(!loopHold)return;var now=ctx().currentTime;advanceLoopShadow(now);var h=loopHold.shadow;loopHold=null;
    sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});visQueue=[];clearFxTimers();transportGeneration++;parameterLatches.stop(now);
    chainPosition=h.chain;seq.pattern=h.pattern;seq.queued=h.queued;seq.schedStep=h.step;scheduledEffect=-1;
    seq.step=h.step;seq.visualPattern=h.pattern;seq.visualChainPosition=h.chain;seq.visualStepTime=now-h.phase*stepDur();paintChase();
    if(!seq.playing){seq.nextTime=now+.012;return;}
    // Resume the actual background step now, then keep its original next grid boundary.
    var effect=effectAt(h.step);if(effect===16)effect=0;
    var boundary=now+(1-h.phase)*stepDur(),at=now+Math.max(.004,(h.step%2?SWING-h.phase:0)*stepDur());
    if(at<boundary-.004){fireStep(h.step,at,effect);visQueue.push({t:at,s:h.step,pattern:h.pattern,chain:h.chain});}
    seq.schedStep=h.step+1;seq.nextTime=boundary;
    if(seq.schedStep>=16){seq.schedStep=0;if(patternChain.length>1){chainPosition=(chainPosition+1)%patternChain.length;seq.pattern=patternChain[chainPosition];}if(seq.queued){seq.pattern=seq.queued;seq.queued=0;}}
  }
  function restartPatternFx() {
    var now=ctx().currentTime,audible=audibleStepAt(now);
    // Quantize the rising edge to the next nominal sixteenth, not a new clock.
    var grid=audible.start-(audible.step%2?SWING*stepDur():0);
    var boundary=grid+Math.max(1,Math.ceil((now-grid)/stepDur()))*stepDur();
    // Discard unheard lookahead only. Existing tails use normal slot/four-voice choke.
    sampleVoices.slice().forEach(function(v){if(v.start>=boundary-.000001)cancelVoice(v,now);});
    visQueue=visQueue.filter(function(e){return e.t<boundary-.000001;});
    clearFxTimers();transportGeneration++;
    seq.pattern=audible.pattern;chainPosition=audible.chain;
    seq.schedStep=0;seq.nextTime=boundary;scheduledEffect=14;
    scheduler();
  }

  // ---------- voices ----------
  var MEL_BASE = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63];

  function pitchMul() {
    return Math.pow(2, params.pitch / 12);
  }

  var slotNumForVoice = 1,voiceNote=0,voiceGate,voiceTweak;
  function smoothParameter(param,value,time,tau){param.setTargetAtTime(value,time,tau);}
  function setVoiceControls(controls,values,time,initial){
    var c=ctx(),shape=window.PO33Sampling.filterShape(values.filter,c.sampleRate);
    function set(param,value,tau){if(initial){param.value=value;param.setValueAtTime(value,time);}else smoothParameter(param,value,time,tau);}
    set(controls.volume.gain,values.volume/100,.01);
    set(controls.low.frequency,shape.type==='lowpass'?shape.frequency:Math.min(20000,c.sampleRate*.45),.015);
    set(controls.high.frequency,shape.type==='highpass'?shape.frequency:20,.015);
    set(controls.low.Q,.7+values.resonance/100*15,.015);set(controls.high.Q,.7+values.resonance/100*15,.015);
    set(controls.dry.gain,shape.bypass?1:0,.01);
    set(controls.lowGain.gain,!shape.bypass && shape.type==='lowpass'?1:0,.01);
    set(controls.highGain.gain,!shape.bypass && shape.type==='highpass'?1:0,.01);
  }
  function connectVoice(g,slot,when){
    var c=ctx(),controls={input:c.createGain(),volume:c.createGain(),low:c.createBiquadFilter(),high:c.createBiquadFilter(),dry:c.createGain(),lowGain:c.createGain(),highGain:c.createGain()};
    controls.low.type='lowpass';controls.high.type='highpass';
    controls.input.connect(controls.dry);controls.dry.connect(controls.volume);
    controls.input.connect(controls.low);controls.low.connect(controls.lowGain);controls.lowGain.connect(controls.volume);
    controls.input.connect(controls.high);controls.high.connect(controls.highGain);controls.highGain.connect(controls.volume);
    // The final envelope also mutes resonant filter tails when a voice is choked.
    controls.volume.connect(g);g.connect(master);
    setVoiceControls(controls,voiceTweak,when===undefined?c.currentTime:when,true);return controls;
  }
  function replanVoice(v){
    var now=ctx().currentTime,desired=Math.min(v.speed.end(v.span,now),v.gateEnd,v.cutAt===undefined?Infinity:v.cutAt);
    if(desired<=now){v.end=now;cutSampleVoice(v,now);return;}
    window.PO33LiveVoice.protect(sampleVoices,v,desired,Math.max(now,v.start),cutSampleVoice);
    var end=v.end,gain=v.gain.gain,time=Math.max(now,v.start),release=Math.min(.003,Math.max(0,end-time)*.3);
    if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(time);else{gain.cancelScheduledValues(time);gain.setValueAtTime(.95,time);}
    if(time<=v.start){gain.setValueAtTime(0,time);gain.linearRampToValueAtTime(.95,time+Math.min(.002,(end-time)*.3));}else gain.setTargetAtTime(.95,time,.001);
    if(v.cutAt!==undefined && v.cutAt<=end){gain.setValueAtTime(.95,end);gain.linearRampToValueAtTime(0,end+.002);v.src.stop(end+.002);}
    else {gain.setValueAtTime(.95,end-release);gain.linearRampToValueAtTime(0,end);v.src.stop(end+.03);}
  }
  function updateVoiceParameters(v,patch,time,now){
    var values=effectiveTweak(v.slot,time);v.tweak=JSON.parse(JSON.stringify(effectiveTweak(v.slot,now)));
    setVoiceControls(v.controls,values,time,false);
    if(Number.isFinite(patch.pitch)){
      v.speed.target(time,Math.pow(2,(v.semitones+values.pitch)/12)*(v.effect===7?2:v.effect===8?.5:1),.015,now);
      v.speed.apply(v.src.playbackRate,now);replanVoice(v);
    }
  }
  function updateLiveSlot(slot,patch,time){
    var now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){
      if(v.slot!==slot || v.start>time || v.end<=time || !v.controls)return;
      updateVoiceParameters(v,patch,time,now);
      // A slower manual rate can extend this tail across locks previously outside its old end.
      parameterLatches.events.filter(function(e){return e.slot===slot && e.time>time;}).forEach(function(e){if(e.time<v.end)updateVoiceParameters(v,e.patch,e.time,now);});
    });
  }
  function trimLengthChanged(slot,note){
    var sample=samples[slot-1],view=slot>8?rawSlice(sample,note):sample;if(!view)return;
    var trim=slot>8?selectedTweak(slot,note):tweaks[slot-1],r=window.PO33Sampling.trimFrames(view,trim,view.buffer.length,view.buffer.sampleRate),length=(r.end-r.start)/view.buffer.sampleRate,now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){if(v.slot===slot && (slot<=8 || v.note===note) && v.start<=now && v.end>now && v.speed.state(now).position>length){v.end=now;cutSampleVoice(v,now);}});
  }
  function rebuildUnheard(slot){var now=ctx().currentTime;sampleVoices.slice().forEach(function(v){if(v.slot===slot && v.start>now && v.end>v.start){cancelVoice(v,now);voice(v.slot,v.note,v.start,v.gate,v.effect);}});}
  function playMelodic(slot, noteIndex, when) {
    var c = ctx();
    var t = when === undefined ? c.currentTime : when;
    var f = MEL_BASE[(slot - 1) % MEL_BASE.length] * Math.pow(2, noteIndex / 12) * pitchMul();

    var out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);

    var filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(4200, t);
    filt.frequency.exponentialRampToValueAtTime(900, t + 0.6);
    filt.Q.value = 4;

    var o1 = c.createOscillator();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(f, t);

    var o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(f * 2, t);
    var g2 = c.createGain();
    g2.gain.value = 0.16;

    var o3 = c.createOscillator();
    o3.type = "sawtooth";
    o3.frequency.setValueAtTime(f * 1.005, t);
    var g3 = c.createGain();
    g3.gain.value = 0.1;

    o1.connect(filt);
    o2.connect(g2);
    g2.connect(filt);
    o3.connect(g3);
    g3.connect(filt);
    filt.connect(out);
    out.connect(master);

    var end = t + 0.85;
    o1.start(t); o2.start(t); o3.start(t);
    o1.stop(end); o2.stop(end); o3.stop(end);
  }

  function env(g, t, peak, decay, attack) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  function noiseHit(t, decay, type, freq, q, peak) {
    var c = ctx();
    var src = c.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    var f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    var g = c.createGain();
    env(g, t, peak, decay);
    src.connect(f);
    f.connect(g);
    connectVoice(g, slotNumForVoice, t);
    src.start(t);
    src.stop(t + decay + 0.02);
    return src;
  }

  function toneHit(t, type, f0, f1, decay, peak) {
    var c = ctx();
    var o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    var g = c.createGain();
    env(g, t, peak, decay, 0.003);
    o.connect(g);
    connectVoice(g, slotNumForVoice, when);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  function playDrum(slot, padIndex, when) {
    var c = ctx();
    var t = (when === undefined ? c.currentTime : when) + 0.001;
    var k = 0.86 + ((slot - 9) % 8) * 0.045;
    var v = padIndex % 8;
    var alt = padIndex >= 8 ? 1 : 0;
    var kk = k * (alt ? 1.18 : 1);

    if (v === 0) {
      toneHit(t, "sine", 165 * kk, 46 * kk, 0.24, 1.0);
      noiseHit(t, 0.02, "lowpass", 900, 1, 0.35);
    } else if (v === 1) {
      noiseHit(t, 0.19, "highpass", 1250 * kk, 0.7, 0.75);
      toneHit(t, "triangle", 190 * kk, 150 * kk, 0.09, 0.45);
    } else if (v === 2) {
      noiseHit(t, 0.045, "highpass", 7200, 0.8, 0.55);
    } else if (v === 3) {
      noiseHit(t, 0.02, "bandpass", 1500 * kk, 2.2, 0.8);
      noiseHit(t + 0.022, 0.02, "bandpass", 1600 * kk, 2.2, 0.7);
      noiseHit(t + 0.046, 0.1, "bandpass", 1450 * kk, 2.0, 0.6);
    } else if (v === 4) {
      toneHit(t, "square", 1750 * kk, 1500 * kk, 0.035, 0.5);
      noiseHit(t, 0.03, "bandpass", 2600 * kk, 1.5, 0.4);
    } else if (v === 5) {
      toneHit(t, "sine", 200 * kk, 95 * kk, 0.28, 0.9);
      noiseHit(t, 0.06, "lowpass", 1200, 1, 0.2);
    } else if (v === 6) {
      toneHit(t, "triangle", 950 * kk, 1400 * kk, 0.12, 0.55);
    } else {
      noiseHit(t, 0.55, "highpass", 5200 * kk, 0.6, 0.42);
      noiseHit(t, 0.3, "bandpass", 3600 * kk, 1.2, 0.3);
    }
  }

  // ---- user samples ----
  // Every slot carries its own trim start and pitch (percent / semitones), so
  // the wheel edits the slot you are on and each slot's settings survive a
  // restart. A take plays as it was recorded.
  function slotTrim(slotNum) {
    var t = samples[slotNum - 1];
    return t && typeof t.trim === "number" ? t.trim : (pendingTrim[slotNum - 1] || 0);
  }
  function slotPitch(slotNum) {
    var t = samples[slotNum - 1];
    return t && typeof t.pitch === "number" ? t.pitch : (pendingPitch[slotNum - 1] || 0);
  }

  // Melodic keys follow the requested PO-33 scale; pad 5 is the original pitch.
  function playPitched(s, semitones, when) {
    if(!recHeld && !rec.on)musicSession('ambient');
    var c = ctx();
    var t = when === undefined ? c.currentTime : when;
    var rate = Math.pow(2, (semitones+(s.pitch || 0))/12);
    var trimOff = (s.trim / 100) * s.duration;
    var off = (s.offset || 0) + trimOff;
    var avail = (s.duration - trimOff) * (s.length === undefined ? 1 : s.length / 100);
    if (avail<=0)return;
    var speed=new window.PO33LiveVoice.Speed(t,rate),performance=s.performance || {};
    if(voiceEffect===7 || voiceEffect===8)speed.target(t,rate*(voiceEffect===7?2:.5),.035,t);
    if(performance.scratch){speed=new window.PO33LiveVoice.Speed(t,rate*.8);speed.target(t,rate*1.4,.008,t);speed.target(t+(s.gateSeconds || .06)*.45,rate*.5,.012,t);}
    var dur = Math.min(speed.end(avail,t)-t,s.gateSeconds || Infinity),attack=Math.min(.002,dur*.3),release=Math.min(.003,dur*.3);
    var src = c.createBufferSource();
    var playbackBuffer = voiceEffect===15 || performance.reverse?reverseBuffer(s.buffer):s.buffer;
    if(voiceEffect===15 || performance.reverse)off=Math.max(0,s.buffer.duration-off-avail);
    src.playbackRate.value = speed.rate;
    src.buffer=playbackBuffer;speed.apply(src.playbackRate,t);
    var g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.95, t + attack);
    g.gain.setValueAtTime(0.95, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur);
    var controls=connectVoice(g,slotNumForVoice,when);
    src.connect(controls.input);
    src.start(t,off,avail);
    src.stop(t + dur + 0.03);
    trackVoice(src,g,t,t+dur,{controls:controls,speed:speed,performance:performance,span:avail,semitones:semitones,gateEnd:s.gateSeconds?t+s.gateSeconds:Infinity,anchor:s.offset,cutAt:undefined});
  }

  // Resolve independent per-pad metadata into a bounded view of the original asset.
  function voice(slotNum,padIndex,when,gateSeconds,effect,override,performance) {
    slotNumForVoice=slotNum;voiceNote=padIndex;voiceGate=gateSeconds;voiceEffect=effect===undefined?fx.kind:effect;
    var at=when===undefined?ctx().currentTime:when;
    window.PO33Sampling.choke(sampleVoices,slotNum,at,cutSampleVoice);
    var sample=samples[slotNum-1];if(!sample)return;
    var tw=override || effectiveTweak(slotNum,at);voiceTweak=tw;
    var view=slotNum>8?rawSlice(sample,padIndex):sample;if(!view)return;
    var trim=slotNum>8?(tw.slices[padIndex] || {start:0,length:100}):tw;
    var region=window.PO33Sampling.trimFrames(view,trim,view.buffer.length,view.buffer.sampleRate);
    var s={buffer:view.buffer,offset:region.start/view.buffer.sampleRate,duration:(region.end-region.start)/view.buffer.sampleRate,trim:0,length:100,pitch:tw.pitch,gateSeconds:gateSeconds,performance:performance};
    playPitched(s,slotNum<=8?window.PO33Sampling.MELODIC_OFFSETS[padIndex]:0,when);
  }

  function trigger(padIndex) {
    lastNote = padIndex;
    lastNotes[state.slot-1]=padIndex;lastWasSlice=state.slot>8;
    defaultStep=null;persistSoon();
    voice(state.slot, padIndex);
  }

  // ---------- memory pool ----------
  function usedSeconds() {
    var u = 0, seen=[];
    function count(s){if(s && seen.indexOf(s.buffer)<0){seen.push(s.buffer);u+=s.buffer.duration;}}
    for (var i = 0; i < TOTAL_SLOTS; i++) if (samples[i]) {
      count(samples[i]);if(samples[i].sliceViews)samples[i].sliceViews.forEach(count);
    }
    return u;
  }

  function recElapsed() {
    if (!rec.on) return 0;
    return Math.min(rec.limit,rec.frames/(rec.rate || ctx().sampleRate));
  }

  function memLeft() {
    var left = MEM_TOTAL - usedSeconds() - recElapsed();
    return left > 0 ? left : 0;
  }

  // ---------- sequencer ----------
  function stepDur() {
    return 60 / params.bpm / 4;
  }
  var visQueue = [];

  function effectAt(step) {
    if(!r1Focused || d.hidden)return 0;
    if(fxHeld)return fx.kind;
    if(shakeFx)return shakeFx;
    return patternExtras[seq.pattern-1].effects[step] || 0;
  }
  function fireStep(step, when,effect,loopEvent) {
    var pat = patterns[seq.pattern - 1];
    var extra = patternExtras[seq.pattern - 1];
    if(!fxHeld && !shakeFx && effect!==scheduledEffect)queueFx(effect,when);
    scheduledEffect=effect;
    if(effect!==14 && (fxHeld || shakeFx) && (state.mode==="STEP" || writeHeld)) {
      extra.effects[step]=effect || 16;persistSoon();
    }
    for (var i = 0; i < TOTAL_SLOTS; i++) {
      var lock=extra && extra.locks[i+":"+step];if(lock){parameterLatches.schedule(i+1,lock,when);updateLiveSlot(i+1,lock,when);}
      var v = pat.lanes[i][step];
      // A queued Loop takes ownership at its audible onset; do not double-trigger it.
      if (v >= 0 && !(!loopEvent && effect>=1 && effect<=4)) {

        var detail=extra && extra.steps && extra.steps[i+":"+step];
        var repeats=window.PO33FX.stepRepeats(effect);
        if(loopEvent)voice(i+1,v,when,loopEvent.kind>=3?loopEvent.period:(i<8 && detail && detail.length?detail.length*stepDur():undefined),effect,undefined,loopEvent);
        else if(repeats){for(var roll=0;roll<repeats;roll++)voice(i+1,v,when+roll*stepDur()/repeats,stepDur()/repeats,effect,undefined,{loop:true,kind:effect,step:step,period:stepDur()/repeats});}
        else if(effect===11 || effect===12){var count=effect===11?2:4;for(var sh=0;sh<count;sh++)voice(i+1,v,when+sh*stepDur()/count,stepDur()/count,effect,undefined,{scratch:true,reverse:!!(sh%2)});}
        else {var retrigs=i>=8 && detail ? (detail.retrigs || 1) : 1;
          for(var hit=0;hit<retrigs;hit++)voice(i + 1,v,when+hit*stepDur()/retrigs,i<8 && detail && detail.length ? detail.length*stepDur() : (hit<retrigs-1 ? stepDur()/retrigs : undefined),effect);}

      }
    }
    if(!loopEvent)seq.totalSteps++;
    seq.lastStepIdx = step;
    seq.lastStepTime = when;
    if (exporting && !loopEvent) exportSteps++;
  }

  function scheduler() {
    if (!ac || !seq.playing || ac.state!=="running") return;
    var now = ac.currentTime;
    if(loopHold){scheduleLoop(now);return;}
    if(scratchHold){scheduleScratch(now);return;}
    if (seq.nextTime < now-stepDur()) seq.nextTime = now + 0.02;
    var guard = 0;
    while (seq.nextTime < now + 0.12 && guard++ < 64) {
      // an export stops scheduling once its 64 steps are in; the recorder
      // then runs to the end of the last bar and closes the file
      if (exporting && exportSteps >= EXPORT_BARS * STEPS) break;
      var t = seq.nextTime;
      var s = seq.schedStep;
      var effect=effectAt(s);if(effect===16)effect=0;
      if(effect===14 && !fxHeld && !shakeFx){s=0;seq.schedStep=0;}
      var at = effect===13 ? t+(window.PO33FX.quantizeStep(s)-s)*stepDur() : ((s % 2 === 1) ? t + stepDur() * SWING : t);
      fireStep(s, at,effect);
      visQueue.push({ t: at, s: s, pattern: seq.pattern,chain:chainPosition });
      seq.schedStep++;
      seq.nextTime += stepDur();
      if (seq.schedStep >= STEPS) {
        seq.schedStep = 0;
        if (patternChain.length > 1 && !patternHeld) {
          chainPosition = (chainPosition + 1) % patternChain.length;
          seq.pattern = patternChain[chainPosition];paint();
        }
        if (seq.queued) {
          seq.pattern = seq.queued;
          seq.queued = 0;

          paint();
        }
      }
    }
  }

  function startSeq() {
    if(!recHeld && !rec.on)musicSession('ambient');
    if (seq.playing || !startupReady) return;
    if(rec.on){flashHint("FINISH SAMPLING FIRST");return;}
    pendingRecSlot=0;soundPreviewMeter=false;
    // Restart the saved order, including repeats, instead of the last audible pattern.
    chainPosition=0;
    if(patternChain.length)seq.pattern=patternChain[0];
    seq.queued=0;
    var c = ctx();
    window.PO33Runtime.resume(c,true);
    seq.playing = true;
    clearFxTimers();transportGeneration++;scheduledEffect=0;
    seq.visualPattern = seq.pattern;seq.visualChainPosition=chainPosition;
    seq.visualStarted = false;
    seq.schedStep = 0;
    seq.step = 0;
    seq.totalSteps = 0;
    visQueue = [];
    seq.nextTime = c.currentTime + 0.012;seq.visualBeatTime=Infinity;
    fxInstall(); // keep the FX history warm
    // Write mode stays active while the transport runs.
    scheduler();seq.timer = setInterval(scheduler, 20);
    startShakeSensors(); startTransportAnimation();
    persistSoon();
    paint();
  }

  function stopSeq() {
    if (!seq.playing) return;
    seq.playing = false;
    parameterLatches.stop(ctx().currentTime);
    stopShakeSensors(); cancelShakeFx(); stopTransportAnimation();
    if (seq.timer) { clearInterval(seq.timer); seq.timer = null; }
    visQueue = [];
    seq.step = 0;
    fxRelease();
    clearFxTimers();transportGeneration++;scheduledEffect=0;
    var now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){if(v.start>now)cancelVoice(v,now);});
    if (exporting) abortExport();
    paint();
  }

  function togglePlay() {
    if(patternSelection.length)finishPatternInput();
    var keepWrite=writeHeld || state.mode==="STEP";
    ["sound","pattern","bpm","fx"].forEach(function(key){if(latchedKeys.has(key))dropLatch(key);});
    soundHeld=patternHeld=bpmHeld=fxHeld=false;fxRelease();parameterDisplay=false;displayValue=null;displayUntil=0;
    clearWheelTrim();if(stepEdit)endStepEdit(true);
    if(!keepWrite)setMode("PLAY");

    if (seq.playing) {
      if(ac && ac.state!=="running"){window.PO33Runtime.resume(ac,true);return;}
      stopSeq(); return;
    }
    if (exportArmed) {
      startExport();
      startSeq();
      return;
    }
    startSeq();
  }

  // the chase light follows the audio clock
  setInterval(function () {
    if (!seq.playing || !ac) return;
    var now = ac.currentTime;
    var lit = -1;
    var audiblePattern = seq.visualPattern;
    while (visQueue.length && visQueue[0].t <= now) {
      var visual = visQueue.shift(); lit = visual.s; audiblePattern = visual.pattern;
      if(visual.s%4===0)seq.visualBeatTime=visual.t;
    }
    if (lit >= 0 && (!seq.visualStarted || lit !== seq.step || audiblePattern !== seq.visualPattern)) {
      seq.step = lit;
      seq.visualPattern = audiblePattern;seq.visualChainPosition=visual.chain;seq.visualStepTime=visual.t;
      seq.visualStarted = true;
      paintChase();
      mascotPunch(lit);
    }
    paintStepLeds();
  }, 30);

  // ---------- transport mascot ----------
  var elGloveL = d0("glove-left");
  var elGloveR = d0("glove-right");
  var elHead = d0("rabbit-head");
  var punchTimers = { l: null, r: null, h: null };

  function d0(id) {
    return document.getElementById(id);
  }

  function clearPunch(which) {
    if (punchTimers[which]) { clearTimeout(punchTimers[which]); punchTimers[which] = null; }
  }

  // odd steps punch left and bob the head, even steps punch right
  function mascotPunch(step) {
    if (!elGloveL || !elGloveR || !elHead) return;
    if (step % 2 === 0) {
      clearPunch("l");
      clearPunch("h");
      elGloveL.classList.add("punch-left");
      elHead.classList.add("head-bob");
      punchTimers.l = setTimeout(function () {
        elGloveL.classList.remove("punch-left");
        punchTimers.l = null;
      }, 100);
      punchTimers.h = setTimeout(function () {
        elHead.classList.remove("head-bob");
        punchTimers.h = null;
      }, 100);
    } else {
      clearPunch("r");
      elGloveR.classList.add("punch-right");
      punchTimers.r = setTimeout(function () {
        elGloveR.classList.remove("punch-right");
        punchTimers.r = null;
      }, 100);
    }
  }

  function mascotRec(on) {
    if (!elHead) return;
    elHead.classList.toggle("rec-pulse", !!on);
  }

  // ---------- patterns ----------
  function patternHasData(p) {
    for (var a = 0; a < TOTAL_SLOTS; a++) {
      for (var b = 0; b < STEPS; b++) if (p.lanes[a][b] >= 0) return true;
    }
    return false;
  }

  function selectPattern(n) {
    if (n < 1 || n > PATTERNS) return;
    if (seq.playing && n !== seq.pattern) {
      seq.queued = n;
      flashHint("QUEUED P" + n);
    } else {
      seq.pattern = n;
      seq.queued = 0;
      flashHint("PATTERN " + n);
    }
    persistSoon();
    paint();
  }

  function commitPatternSelection(){
    clearTimeout(patternInputTimer);patternInputTimer=null;
    if(!patternSelection.length)return;
    patternChain=patternSelection.slice();patternSelection=[];
    var first=patternChain[0];
    if(seq.playing){seq.queued=first;chainPosition=patternChain.length>1?-1:0;}
    else {seq.pattern=first;seq.queued=0;chainPosition=0;}
    persistSoon();
  }
  function finishPatternInput(){
    commitPatternSelection();if(latchedKeys.has('pattern'))dropLatch('pattern');paint();
  }
  function waitForPatternInput(){
    clearTimeout(patternInputTimer);patternInputTimer=null;
    if(latchedKeys.has('pattern') && patternSelection.length && !heldPad && !physicalKeys.has('pattern'))
      patternInputTimer=setTimeout(finishPatternInput,PATTERN_INPUT_GAP);
  }

  function copyPatternTo(n) {
    if (n < 1 || n > PATTERNS) return;
    patterns[n - 1] = clonePattern(patterns[seq.pattern - 1]);
    writePattern(n);
    flashHint("COPY P" + seq.pattern + ">P" + n);
    paint();
  }

  function clearPattern(n) {
    if (n < 1 || n > PATTERNS) return;
    patterns[n - 1] = emptyPattern();
    writePattern(n);
    flashHint("CLEAR P" + n);
    paint();
  }

  function toggleStep(n) {
    var lane = patterns[seq.pattern - 1].lanes[state.slot - 1];
    if (lane[n] >= 0) {
      lane[n] = -1;
    } else {
      lane[n] = lastNote;
      var previewOverride;
      if(defaultStep && defaultStep.slot===state.slot) {
        var ex=patternExtras[seq.pattern-1],key=(state.slot-1)+":"+n;
        if(!ex.steps)ex.steps={};
        ex.steps[key]=JSON.parse(JSON.stringify(defaultStep.detail));
        ex.locks[key]=JSON.parse(JSON.stringify(defaultStep.lock));
        previewOverride=Object.assign({},effectiveTweak(state.slot),defaultStep.lock);
      }
      voice(state.slot, lastNote,undefined,defaultStep && defaultStep.slot===state.slot && state.slot<=8 ? defaultStep.detail.length*stepDur() : undefined,undefined,previewOverride);
      flash(n);
    }
    writePattern(seq.pattern);
    paint();
  }

  function editDetail(edit) {
    var ex=patternExtras[edit.pattern-1];if(!ex.steps)ex.steps={};
    var key=(edit.slot-1)+":"+edit.step;
    if(!ex.steps[key])ex.steps[key]={length:1,retrigs:1};
    return ex.steps[key];
  }
  function beginStepEdit(n) {
    endStepEdit(true);
    defaultStep=null;
    stepEdit={step:n,slot:state.slot,pattern:seq.pattern,used:false,pointer:padPointer};
    stepCopyTimer=setTimeout(function(){
      if(!stepEdit)return;
      var e=stepEdit,key=(e.slot-1)+":"+e.step,ex=patternExtras[e.pattern-1];
      lastNote=patterns[e.pattern-1].lanes[e.slot-1][e.step];lastNotes[e.slot-1]=lastNote;
      defaultStep={slot:e.slot,detail:JSON.parse(JSON.stringify(editDetail(e))),lock:JSON.parse(JSON.stringify(ex.locks[key] || effectiveTweak(e.slot)))};
      lastWasSlice=e.slot>8;e.used=true;persistSoon();showNumber("CPy","STEP COPY");paint();
    },1000);
    paint();
  }
  function endStepEdit(cancel) {
    if(stepCopyTimer)clearTimeout(stepCopyTimer);stepCopyTimer=null;
    var e=stepEdit;stepEdit=null;
    if(e && !e.used && !cancel) {
      patterns[e.pattern-1].lanes[e.slot-1][e.step]=-1;
      var ex=patternExtras[e.pattern-1],key=(e.slot-1)+":"+e.step;
      delete ex.locks[key];if(ex.steps)delete ex.steps[key];writePattern(e.pattern);
    }
    paint();
  }

  // Immutable views share audio; trims and target tone settings stay independent.
  function rawSlice(s,n) {
    if(!s)return null;
    if(s.sliceViews)return s.sliceViews[n] ? Object.assign({},s.sliceViews[n]) : null;
    return {buffer:s.buffer,offset:(s.offset || 0)+n*s.duration/16,duration:s.duration/16};
  }
  function copySource() {
    var s=samples[state.slot-1];if(!s)return null;
    if(state.slot>8 && !lastWasSlice) {
      var views=[];for(var n=0;n<16;n++) {
        var v=rawSlice(s,n),tw=tweaks[state.slot-1].slices[n] || {start:0,length:100};
        views.push(trimView(v,tw));
      }
      return {kit:views};
    }
    var view=trimView(state.slot>8 ? rawSlice(s,lastNote) : s,state.slot>8 ? (tweaks[state.slot-1].slices[lastNote] || {start:0,length:100}) : tweaks[state.slot-1]);
    return view ? {view:view} : null;
  }
  function trimView(v,t) {
    if(!v)return null;
    var region=window.PO33Sampling.trimFrames(v,t,v.buffer.length,v.buffer.sampleRate);
    return {buffer:v.buffer,offset:region.start/v.buffer.sampleRate,duration:(region.end-region.start)/v.buffer.sampleRate,trim:0,pitch:0};
  }
  function commitSoundCopy(cancel) {
    var c=pendingCopy;pendingCopy=null;if(!c || cancel)return;
    var n=c.target,s;
    if(c.slice!==null) {
      s=samples[n-1];var views=[];
      for(var j=0;j<16;j++)views.push(rawSlice(s,j));
      views[c.slice]=c.source ? (c.source.view || c.source.kit[0]) : null;
      var base=views.filter(Boolean)[0];
      s=base ? Object.assign({},base,{sliceViews:views}) : null;
      delete tweaks[n-1].slices[c.slice];
    } else if(!c.source) s=null;
    else if(n<=8) {
      var v=c.source.view || c.source.kit[0];s=v ? Object.assign({},v) : null;
      tweaks[n-1].start=0;tweaks[n-1].length=100;
    } else {
      var kit=c.source.kit;
      if(!kit){kit=[];for(var k=0;k<16;k++)kit.push(rawSlice(c.source.view,k));}
      var first=kit.filter(Boolean)[0];s=first ? Object.assign({},first,{sliceViews:kit}) : null;
      tweaks[n-1].start=0;tweaks[n-1].length=100;tweaks[n-1].slices={};
    }
    samples[n-1]=s;factoryMuted[n-1]=true;
    if(s){savedSig[n-1]=undefined;saveSlot(n);}else removeSlotStored(n);
    persistSoon();showNumber("CPy","COPIED");paint();
  }

  // a new step starts at the slot's take; a step already there keeps its pitch
  function stepPitch(slotNum) {
    var l = patterns[seq.pattern - 1].lanes[slotNum - 1];
    for (var i = 0; i < STEPS; i++) if (l[i] > 0) return l[i];
    return 0;
  }

  // a hit played by hand while the loop runs, dropped on the nearest 16th
  function liveRecord(padIndex) {
    if (!ac) return;
    var sd = stepDur();
    var base = seq.lastStepTime === undefined ? ac.currentTime : seq.lastStepTime;
    var baseIdx = seq.lastStepIdx === undefined ? 0 : seq.lastStepIdx;
    var n = baseIdx + Math.round((ac.currentTime - base) / sd);
    n = ((n % STEPS) + STEPS) % STEPS;
    patterns[seq.pattern - 1].lanes[state.slot - 1][n] = padIndex;
    writePattern(seq.pattern);
    voice(state.slot, padIndex);
    flash(padIndex);
    flashHint("STEP " + (n + 1));
    paint();
  }

  // ---------- WAV export ----------
  var exporting = false;
  var exportArmed = false;
  var exportSteps = 0;
  var expDest = null;
  var expSrc = null;
  var expProc = null;
  var expSilent = null;
  var expChunks = [];
  var expFrames = 0;
  var expTarget = 0;
  var expPerBar = 1;
  var expRate = 44100;

  function startExport() {
    var c = ctx();
    exportArmed = false;
    exporting = true;
    exportSteps = 0;
    expChunks = [];
    expFrames = 0;
    expRate = c.sampleRate;
    expTarget = Math.round(EXPORT_BARS * STEPS * stepDur() * c.sampleRate);
    expPerBar = STEPS * stepDur() * c.sampleRate;

    if (!expDest) expDest = c.createMediaStreamDestination();
    try { outTrim.connect(expDest); } catch (err) { /* already connected */ }

    if (!expProc) {
      expProc = c.createScriptProcessor(4096, 1, 1);
      expProc.onaudioprocess = onExpAudio;
      expSilent = c.createGain();
      expSilent.gain.value = 0;
      expProc.connect(expSilent);
      expSilent.connect(c.destination);
    }
    if (!expSrc) expSrc = c.createMediaStreamSource(expDest.stream);
    expSrc.connect(expProc);
    document.body.classList.add("exporting");
    paint();
  }

  function onExpAudio(e) {
    if (!exporting) return;
    var data = e.inputBuffer.getChannelData(0);
    var want = Math.min(data.length, expTarget - expFrames);
    if (want > 0) {
      var copy = new Float32Array(want);
      for (var i = 0; i < want; i++) copy[i] = data[i];
      expChunks.push(copy);
      expFrames += want;
    }
    var bar = Math.min(EXPORT_BARS, 1 + Math.floor(expFrames / expPerBar));
    elHint.textContent = "REC BEAT: BAR " + bar + "/" + EXPORT_BARS;
    if (expFrames >= expTarget) finishExport();
  }

  function abortExport() {
    exporting = false;
    exportSteps = 0;
    expChunks = [];
    expFrames = 0;
    if (expProc && expSrc) { try { expSrc.disconnect(expProc); } catch (err) { /* ignore */ } }
    document.body.classList.remove("exporting");
    paint();
  }

  function finishExport() {
    if (!exporting) return;
    exporting = false;
    exportSteps = 0;
    if (expSrc) { try { expSrc.disconnect(expProc); } catch (err) { /* ignore */ } }
    document.body.classList.remove("exporting");

    var frames = expFrames;
    var data = new Float32Array(frames);
    var off = 0;
    for (var i = 0; i < expChunks.length && off < frames; i++) {
      var ch = expChunks[i];
      var n = Math.min(ch.length, frames - off);
      data.set(ch.subarray(0, n), off);
      off += n;
    }
    expChunks = [];
    expFrames = 0;

    stopSeq();
    var buffer = encodeWav(data, expRate);
    downloadWav(buffer);
    flashHint("SAVED " + (frames / expRate).toFixed(1) + "s");
    paint();
  }

  function encodeWav(samplesOut, rate) {
    var n = samplesOut.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function str(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
    str(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true); // PCM chunk size
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); // byte rate
    v.setUint16(32, 2, true); // block align
    v.setUint16(34, 16, true); // bits
    str(36, "data");
    v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var x = samplesOut[i];
      if (x > 1) x = 1;
      else if (x < -1) x = -1;
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return buf;
  }

  function downloadWav(buffer) {
    try {
      var blob = new Blob([buffer], { type: "audio/wav" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = WAV_NAME;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        try { URL.revokeObjectURL(url); } catch (err) { /* ignore */ }
      }, 4000);
    } catch (err) {
      flashHint("SAVE FAILED");
    }
  }

  // ---------- microphone ----------
  var mic = {
    stream: null,
    node: null,
    proc: null,
    silent: null,
    pending: null,
    error: null
  };
  var micGeneration=0,micModulePromise=null,micReleasePromise=null,clipUntil=0,sliceResultUntil=0,sliceResultSlot=0,sliceResultCount=0,sliceResultTimer=null;
  var sampleMicAuto=false,sampleMicGainDb=0,lastMicReport='No take yet / 尚无录音';
  try{sampleMicAuto=localStorage.getItem('po33.micAutoLevel')==='true';sampleMicGainDb=Math.max(0,Math.min(18,Number(localStorage.getItem('po33.micGainDb'))||0));}catch{}
  function musicSession(type){if(type==='ambient'){try{if(navigator.mediaSession){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';}}catch{}}try{if(navigator.audioSession && !(hardwareTransfer && hardwareTransfer.view.active))navigator.audioSession.type=type;}catch{}}
  function setSampleMicGain(value){sampleMicAuto=value==='auto';try{localStorage.setItem('po33.micAutoLevel',String(sampleMicAuto));}catch{}if(sampleMicAuto)return;sampleMicGainDb=[0,6,12,18].includes(Number(value))?Number(value):0;try{localStorage.setItem('po33.micGainDb',String(sampleMicGainDb));}catch{}}
  function disconnectMusicMic(){
    musicSession('ambient');micGeneration++;
    if(rec.on)abortRecording("INPUT DISCONNECTED");
    if(mic.proc){mic.proc.port.onmessage=null;mic.proc.port.close();}
    if(mic.stream)mic.stream.getTracks().forEach(function(t){t.stop();});
    [mic.node,mic.proc,mic.silent].forEach(function(n){if(n){try{n.disconnect();}catch(error){}}});
    mic.stream=mic.node=mic.proc=mic.silent=mic.pending=null;mic.error=null;mic.warning="";mic.settings=null;inputLevel=inputPeak=0;clipUntil=0;d.body.dataset.captureState="idle";
  }

  var rec = {
    on: false,
    id:0,rate:0,stopping:false,done:null,resolve:null,stopTimer:null,
    slot: 0,
    start: 0,
    limit: 0,
    chunks: [],
    frames: 0,
    maxFrames: 0,
    replacing: null,
    replacingStored: undefined,
    timer: null
  };

  var recHeld = false;
  var pendingRecSlot=0;
  var recPointer = undefined;
  var recUsedPad = false;
  var recPressedAt = 0;  var soundHeld = false;
  var soundPointer = undefined;
  var soundTap = false; // an armed SOUND touch: a bare drum pad starts a take
  var soundTap = false; // an armed SOUND touch: a bare drum pad starts a take
  var soundTap = false; // an armed SOUND touch: a bare drum pad starts a take
  var soundNoModifier = false; // SOUND touched while SOUND was already on
  var patternHeld = false;
  var patternPointer = undefined;
  var patternUsedPad = false;
  var patternPressedAt = 0;
  var padPointer = undefined;
  var fxPadPointer=undefined;
  var heldPad = 0;

  function micReady() {
    return !!(mic.proc && mic.stream);
  }

  function releaseMusicMic(){
    if(micReleasePromise)return;
    var finishing=rec.on?finishRec():null;
    micGeneration++;mic.pending=null;
    if(mic.stream)mic.stream.getTracks().forEach(function(track){track.onended=null;track.stop();});
    musicSession('ambient');
    if(finishing){micReleasePromise=finishing.finally(function(){disconnectMusicMic();micReleasePromise=null;});}
    else disconnectMusicMic();
  }
  function ensureMic() {
    if(!recHeld || seq.playing || d.hidden)return Promise.resolve(false);
    if(micReleasePromise)return micReleasePromise.then(function(){return ensureMic();});
    if(micReady())return Promise.resolve(true);
    if(mic.pending)return mic.pending;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){mic.error="NO MIC";return Promise.resolve(false);}
    musicSession('play-and-record');
    var c=ctx(),requestGeneration=micGeneration;
    d.body.dataset.captureState="requesting";
    mic.pending=(async function(){
      var stream;
      try{
        if(!c.audioWorklet || !window.AudioWorkletNode)throw Error("AUDIO WORKLET REQUIRED");
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        if(requestGeneration!==micGeneration || !recHeld || d.hidden){stream.getTracks().forEach(function(t){t.stop();});return false;}
        if(!micModulePromise)micModulePromise=c.audioWorklet.addModule(window.PO33_RESOURCE?window.PO33_RESOURCE('./recording-worklet.js'):'./recording-worklet.js?v=flowers-20261120-ui25').catch(function(error){micModulePromise=null;throw error;});
        await micModulePromise;
        if(requestGeneration!==micGeneration || !recHeld || d.hidden || resetBusy || resetFailure || (hardwareTransfer && hardwareTransfer.view.active)){stream.getTracks().forEach(function(t){t.stop();});return false;}
        mic.stream=stream;mic.node=c.createMediaStreamSource(stream);
        mic.proc=new AudioWorkletNode(c,'po33-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit',processorOptions:{inputGain:Math.pow(10,sampleMicGainDb/20),autoLevel:sampleMicAuto}});
        mic.proc.port.onmessage=onCapture;
        mic.proc.onprocessorerror=function(){abortRecording("RECORDER ERROR");disconnectMusicMic();mic.error="RECORDER ERROR";paint();};
        mic.silent=c.createGain();mic.silent.gain.value=0;
        mic.node.connect(mic.proc);mic.proc.connect(mic.silent);mic.silent.connect(c.destination);
        stream.getAudioTracks().forEach(function(track){track.onended=function(){abortRecording("INPUT DISCONNECTED");disconnectMusicMic();mic.error="INPUT DISCONNECTED";paint();};});
        mic.settings=stream.getAudioTracks()[0]?.getSettings() || {};
        mic.warning=['echoCancellation','noiseSuppression','autoGainControl'].some(function(key){return mic.settings[key]===true;})?"INPUT DSP ACTIVE":"";
        mic.error=null;d.body.dataset.captureState="monitoring";return true;
      }catch(error){
        if(stream)stream.getTracks().forEach(function(t){t.stop();});
        if(requestGeneration===micGeneration){if(mic.stream===stream)disconnectMusicMic();mic.error=error.message==="AUDIO WORKLET REQUIRED"?error.message:"MIC / WORKLET UNAVAILABLE";d.body.dataset.captureState="idle";}
        return false;
      }finally{if(requestGeneration===micGeneration)mic.pending=null;}
    })();
    return mic.pending;
  }
  function onCapture(event){
    var m=event.data;
    if(m.type==='meter'){inputLevel=m.rms;inputPeak=m.peak;if(m.clipped && (recHeld||rec.on))clipUntil=Date.now()+150;return;}
    if(!rec.on || m.id!==rec.id)return;
    if(m.type==='started'){d.body.dataset.captureState=rec.stopping?"stopping":"recording";return;}
    if(m.type==='chunk'){
      var data=new Float32Array(m.data);
      if(m.frames!==rec.frames+data.length || m.frames>rec.maxFrames){abortRecording("CAPTURE DATA ERROR");return;}
      rec.chunks.push(data);rec.frames=m.frames;
    }else if(m.type==='finished'){
      if(m.frames!==rec.frames){abortRecording("CAPTURE DATA ERROR");return;}
      commitRecording(m.reason);
    }
  }
  function abortRecording(message){
    if(!rec.on)return;
    if(mic.proc)mic.proc.port.postMessage({type:'stop',id:rec.id});
    clearTimeout(rec.stopTimer);clearInterval(rec.timer);rec.timer=rec.stopTimer=null;
    samples[rec.slot-1]=rec.replacing;savedSig[rec.slot-1]=rec.replacingStored;
    if(pads[rec.slot-1])pads[rec.slot-1].classList.remove('rec-target');
    rec.on=false;rec.stopping=false;rec.chunks=[];rec.replacing=null;rec.slot=0;
    d.body.classList.remove('recording');d.body.dataset.captureState=micReady()?'monitoring':'idle';
    var resolve=rec.resolve;rec.resolve=null;resolve?.(false);paint();if(message)flashHint(message);
  }

  function startRec(slotNum) {
    if(seq.playing){pendingRecSlot=0;flashHint("STOP TO SAMPLE");return;}
    if (rec.on) return;
    pendingRecSlot=slotNum;
    if (!micReady()) {
      elHint.textContent = "MIC...";
      ensureMic().then(function (ok) {
        if (!ok) { paint(); return; }
        beginRec(slotNum);
      });
      return;
    }
    beginRec(slotNum);
  }

  function beginRec(slotNum) {
    if(seq.playing){pendingRecSlot=0;return;}
    if (rec.on) return;
    if (!recHeld || pendingRecSlot !== slotNum) { paint(); return; }
    pendingRecSlot=0;
    var c = ctx();

    rec.replacing = samples[slotNum - 1];
    rec.replacingStored = savedSig[slotNum - 1];
    samples[slotNum - 1] = null;
    pendingTrim[slotNum - 1] = 0;
    pendingPitch[slotNum - 1] = 0;

    var avail = MEM_TOTAL - usedSeconds();
    if (avail < 0.06) {
      samples[slotNum - 1] = rec.replacing;
      savedSig[slotNum - 1] = rec.replacingStored;
      rec.replacing = null;
      paint();
      flashHint("MEMORY FULL");
      return;
    }

    sliceResultUntil=0;clearTimeout(sliceResultTimer);
    rec.on = true;rec.id++;rec.rate=c.sampleRate;rec.stopping=false;
    rec.done=new Promise(function(resolve){rec.resolve=resolve;});
    rec.slot = slotNum;
    rec.start = c.currentTime;
    rec.limit = avail;
    rec.chunks = [];
    rec.frames = 0;
    rec.maxFrames = Math.floor(avail * c.sampleRate);
    d.body.dataset.captureState="starting";
    mic.proc.port.postMessage({type:"start",id:rec.id,maxFrames:rec.maxFrames});
    document.body.classList.add("recording");
    pads[slotNum - 1].classList.add("rec-target");
    rec.timer = setInterval(tickRec, 50);
    paint();
  }

  function tickRec() {
    if (!rec.on) return;
    // The worklet, not the UI timer, owns the exact capacity boundary.
    elMem.textContent = memLeft().toFixed(1) + "s";
    elHint.textContent = "REC " + recElapsed().toFixed(1) + "s";
  }

  function finishRec() {
    if(!rec.on)return Promise.resolve(true);
    if(!rec.stopping){
      rec.stopping=true;d.body.dataset.captureState="stopping";
      mic.proc.port.postMessage({type:'stop',id:rec.id});
      rec.stopTimer=setTimeout(function(){abortRecording("RECORDER STOP TIMEOUT");},1500);
    }
    return rec.done;
  }
  function commitRecording(reason) {
    if(!rec.on)return;
    clearTimeout(rec.stopTimer);rec.stopTimer=null;rec.stopping=false;
    var resolve=rec.resolve;rec.resolve=null;
    // Resolve after synchronous commit code below finishes; promise continuations run later.
    if(resolve)resolve(true);
    d.body.dataset.captureState="monitoring";
    rec.on = false;
    if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
    document.body.classList.remove("recording");

    var slotNum = rec.slot;
    if (pads[slotNum - 1]) pads[slotNum - 1].classList.remove("rec-target");

    var c = ctx();
    var rate = rec.rate;
    var want = Math.max(0, Math.min(rec.frames, rec.maxFrames));

    var data = new Float32Array(want);
    var off = 0;
    for (var i = 0; i < rec.chunks.length && off < want; i++) {
      var ch = rec.chunks[i];
      var n = Math.min(ch.length, want - off);
      data.set(ch.subarray(0, n), off);
      off += n;
    }
    rec.chunks = [];
    rec.frames = 0;
    rec.maxFrames = 0;
    rec.slot = 0;

    if (want < rate * MIN_TAKE) {
      samples[slotNum - 1] = rec.replacing;
      savedSig[slotNum - 1] = rec.replacingStored;
      rec.replacing = null;
      paint();
      flashHint(want === 0 ? "NO MIC INPUT" : "TOO SHORT");
      return;
    }

    tweaks[slotNum-1]={pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}};
    ['pitch','volume','filter','resonance'].forEach(function(key){parameterLatches.manual(slotNum,key,tweaks[slotNum-1][key],c.currentTime);});
    var takePeak=0,takeEnergy=0;for(var k=0;k<data.length;k++){takePeak=Math.max(takePeak,Math.abs(data[k]));takeEnergy+=data[k]*data[k];}
    function dbfs(value){return value>0?(20*Math.log10(value)).toFixed(1):'-inf';}
    lastMicReport='Last take / 上次录音: peak '+dbfs(takePeak)+' dBFS · RMS '+dbfs(Math.sqrt(takeEnergy/data.length))+' dBFS · gain '+(sampleMicAuto?'AUTO':'+'+sampleMicGainDb+' dB');
    // No automatic normalization: apply only the explicitly selected input gain in the recorder.
    var buf = c.createBuffer(1, data.length, rate);
    if (buf.copyToChannel) buf.copyToChannel(data, 0);
    else buf.getChannelData(0).set(data);

    samples[slotNum - 1] = {
      buffer: buf,
      duration: data.length / rate,
      trim: pendingTrim[slotNum - 1] || 0,
      pitch: pendingPitch[slotNum - 1] || 0
    };
    if(slotNum>MELODIC_SLOTS) {
      samples[slotNum-1].sliceViews=window.PO33Sampling.transientSlices(data,rate).map(function(region){
        return region ? {buffer:buf,offset:region.start/rate,duration:(region.end-region.start)/rate,trim:0,pitch:0,length:100} : null;
      });
      // Fresh slice positions replace previous per-pad trims; slot tone/filter stay intact.
      tweaks[slotNum-1].start=0;tweaks[slotNum-1].length=100;tweaks[slotNum-1].slices={};
      sliceResultSlot=slotNum;sliceResultCount=samples[slotNum-1].sliceViews.filter(Boolean).length;sliceResultUntil=Date.now()+1200;
      sliceResultTimer=setTimeout(paintStepLeds,1210);
    }
    rec.replacing = null;
    state.slot = slotNum;
    paint();
    flash(slotNum - 1);
    if(reason==="memory-full")flashHint("MEMORY FULL");
    else if(slotNum>MELODIC_SLOTS)flashHint(String(sliceResultCount)+" SLICES");
    saveSlot(slotNum); // into the r1's storage, so it is here after a restart
  }

  function setRecHeld(v) {
    v=!!(v || sideRecArmed || sideRecHeld);
    if (recHeld === v) return;
    recHeld = v;
    if(!v)pendingRecSlot=0;
    if (v) { recUsedPad = false; recPressedAt = Date.now(); }
    if(v && !seq.playing)ensureMic();
    if(!v)releaseMusicMic();
    paint();
  }

  function deleteSlot(n) {
    if (!samples[n - 1]) {
      flashHint("EMPTY SLOT");
      return;
    }
    samples[n - 1] = null;
    factoryMuted[n-1]=true;
    removeSlotStored(n);
    paint();
    flashHint("DELETED");
  }

  function resizePanelText(){
    var panel=document.getElementById("panel");
    panel.style.setProperty("--unit",panel.getBoundingClientRect().width/240+"px");
  }
  resizePanelText();
  if(window.ResizeObserver)new ResizeObserver(resizePanelText).observe(document.getElementById("panel"));
  else window.addEventListener("resize",resizePanelText);

  // ---------- DOM ----------
  var d = document;
  // One short tactile pulse per press. Unsupported WebViews keep operating normally.
  function vibrateButton(e) {
    var button = e.target.closest ? e.target.closest("button, [role='button']") : null;
    var panel = d.getElementById("panel");
    // Only rendered virtual controls are haptic targets, never the page or hidden legacy controls.
    if (!button || button.disabled || !panel.contains(button) || !button.getClientRects().length) return;
    if (e.type === "pointerdown" && e.button !== 0) return;
    if (e.type === "keydown" && (e.repeat || (e.key !== "Enter" && e.key !== " "))) return;
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate(12);
    } catch (err) { /* device does not expose vibration */ }
  }
  d.addEventListener("pointerdown", vibrateButton, true);
  d.addEventListener("keydown", vibrateButton, true);
  var elMode = d.getElementById("mode");
  var elPat = d.getElementById("pat");
  var elSlot = d.getElementById("slot");
  var elMem = d.getElementById("mem");
  var elHint = d.getElementById("hint");
  var elGrid = d.getElementById("grid");
  var elParamBtn = d.getElementById("paramBtn");
  var elParamName = d.getElementById("paramName");
  var elParamVal = d.getElementById("paramVal");
  var elExpBtn = d.getElementById("expBtn");
  var pads = [];

  (function buildGrid() {
    for (var i = 0; i < 16; i++) {
      var b = d.createElement("button");
      b.type = "button";
      b.className = "pad";
      b.style.setProperty("--x", String(32.2 + (i % 4) * 43.8));
      b.style.setProperty("--y", String(102.6 + Math.floor(i / 4) * 49.8));
      b.setAttribute("data-pad", String(i + 1));
      b.setAttribute("aria-label", "Pad " + (i + 1));
      var num = d.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);
      var sub = d.createElement("span");
      sub.className = "sub";
      var led = d.createElement("span");
      led.className = "led";
      // 12 x 5 in the 240 x 282 art grid; bottom edge touches the 25px cap.
      led.style.left="34.21052631578947%";led.style.top="3.260869565217391%";
      led.style.width="31.57894736842105%";led.style.height="10.869565217391305%";
      b.appendChild(num);
      b.appendChild(sub);
      b.appendChild(led);
      b.addEventListener("pointerdown", onPadDown);
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      b.addEventListener("click", function (e) { e.preventDefault(); });
      elGrid.appendChild(b);
      pads.push(b);
    }
  })();

  // Modifier badges reflect effective latches; rotor focus remains momentary.
  var holdControls=Array.from(d.querySelectorAll('#ctl .cbtn,#bpmMode,.pad,.knob'));
  var holdTimers={},holdPointers={},physicalHolds=new Set(),holdFeedback=new Map();
  holdControls.forEach(function(button){var label=d.createElement('span');label.className='hold-indicator';var word=d.createElement('span');word.className='hold-word';word.textContent='HOLD';label.appendChild(word);label.setAttribute('aria-hidden','true');button.appendChild(label);});
  function paintHolds(){
    holdControls.forEach(function(button){
      var act=button.id==='bpmMode'?'bpm':button.getAttribute('data-act'),pad=button.getAttribute('data-pad');
      var sticky=act && touchChord && touchChord[act]!==undefined && modifierPointers[act]===touchChord[act];
      var shifted=shiftHolds && shiftHolds[act || 'pad'+pad];
      var side=act==='rec' && sideRecHeld;
      var active=!!(sticky||shifted||side||(button.classList.contains('knob')&&physicalHolds.has(button)));
      button.classList.toggle('hold-active',active);
      if(active && !holdFeedback.has(button)){
        var pulse=function(){if(!d.hidden && navigator.vibrate)navigator.vibrate(25);};
        pulse();holdFeedback.set(button,setInterval(pulse,800));
      }else if(!active && holdFeedback.has(button)){clearInterval(holdFeedback.get(button));holdFeedback.delete(button);}

    });
  }
  function releaseHoldVisual(e){
    var id=e.pointerId,entry=holdPointers[id];clearTimeout(holdTimers[id]);delete holdTimers[id];
    if(entry){physicalHolds.delete(entry.button);delete holdPointers[id];}paintHolds();
  }
  d.addEventListener('pointerdown',function(e){
    if(e.button!==0 || e.shiftKey)return;
    var button=e.target.closest && e.target.closest('#ctl .cbtn,#bpmMode,.pad,.knob');if(!button)return;
    if(!button.classList.contains('knob'))return;
    var id=e.pointerId;clearTimeout(holdTimers[id]);holdPointers[id]={button:button,x:e.clientX,y:e.clientY};
    holdTimers[id]=setTimeout(function(){if(holdPointers[id]){physicalHolds.add(button);paintHolds();}},HOLD_DELAY);
  },true);
  d.addEventListener('pointermove',function(e){var entry=holdPointers[e.pointerId];if(!entry || physicalHolds.has(entry.button))return;var unit=d.getElementById('panel').getBoundingClientRect().width/240;if(Math.hypot(e.clientX-entry.x,e.clientY-entry.y)>4*unit){clearTimeout(holdTimers[e.pointerId]);delete holdTimers[e.pointerId];}},true);
  window.addEventListener('pointerup',releaseHoldVisual);window.addEventListener('pointercancel',releaseHoldVisual);d.addEventListener('lostpointercapture',releaseHoldVisual,true);
  window.addEventListener('blur',function(){Object.keys(holdTimers).forEach(function(id){clearTimeout(holdTimers[id]);});holdTimers={};holdPointers={};physicalHolds.clear();paintHolds();});

  function hintText() {
    if(resetBusy)return "RESTORING FACTORY PRESETS";
    if(ac && (seq.playing||rec.on) && window.PO33Runtime.isBlocked(ac))return "TAP TO RESUME AUDIO";
    if(resetFailure)return "RESET FAILED - HOLD HEAD TO RETRY";
    if(unsaved)return "SAVE FAILED · "+unsaved+" TAKE IN MEMORY ONLY";
    if(failedSaveKeys.size)return "SAVE FAILED · METADATA IN MEMORY ONLY";
    if (exporting) {
      var bar = Math.min(EXPORT_BARS, 1 + Math.floor(expFrames / (expPerBar || 1)));
      return "REC BEAT: BAR " + bar + "/" + EXPORT_BARS;
    }
    if (fx.kind) return "FX: " + FX_NAMES[fx.kind];
    if (rec.on) return "REC " + recElapsed().toFixed(1) + "s";
    if (mic.error) return mic.error;
    if(recHeld && mic.warning)return mic.warning;
    if (patternHeld) return recHeld ? "TAP PAD = COPY" : (soundHeld ? "TAP PAD = CLEAR" : "TAP PAD = SWITCH");
    if (recHeld) {
      if (state.mode === "SOUND") return "TAP PAD = DELETE";
      if (seq.playing) return "TAP PAD = LIVE HIT";
      return "TAP PAD = SAMPLE";
    }
    if (state.mode === "SOUND") return "PAD=SLOT  REC+PAD=DEL";
    if (state.mode === "PATTERN") return "PAT P" + seq.pattern + "  HOLD PAT+PAD=SW";
    if (state.mode === "STEP") return "TAP PAD = TOGGLE STEP";
    if (state.mode === "FX") return seq.playing ? "HOLD PAD 1-8 = FX" : "PRESS PLAY THEN HOLD FX";
    if (exportArmed) return "ARMED - PRESS PLAY";
    if (seq.playing) return "PLAYING " + params.bpm + " BPM";
    if (state.mode !== "SOUND" && paramIdx === 1 && !samples[state.slot - 1] && !rec.on) return "REC+PAD = TAKE FIRST";
    return "WHEEL " + PARAM_NAMES[paramIdx];
  }

  // TRIM and PITCH read the take in the selected slot
  function paramValue() {
    if (paramIdx === 0) return String(params.bpm);
    if (paramIdx === 1) return slotTrim(state.slot) + "%";
    var p = slotPitch(state.slot);
    return (p > 0 ? "+" : "") + p;
  }

  function paintChase() {
    for (var p = 0; p < pads.length; p++) {
      pads[p].classList.toggle("cur", seq.playing && (p === seq.step) && state.mode !== "SOUND");
    }
    paintStepLeds();
  }

  // One resolved lamp state per pad: context indicators take priority over the chase.
  function paintStepLeds() {
    var patternNumber = seq.playing ? (seq.visualPattern || seq.pattern) : seq.pattern;
    var pat = patterns[patternNumber - 1], lane = pat.lanes[state.slot - 1];
    var editing = state.mode === "STEP" || writeHeld;
    var stepView = editing || seq.playing;
    d.getElementById("panel").style.setProperty("--led-pulse", Math.min(110,stepDur()*700)+"ms");
    var now=ac?ac.currentTime:0,sounding=Array(16).fill(null);
    if(seq.playing)sampleVoices.forEach(function(v){var end=Math.min(v.end,v.cutAt===undefined?Infinity:v.cutAt);if(v.start<=now && end>now && (!v.controls || v.controls.volume.gain.value>.0001)){var old=sounding[v.slot-1];if(!old || v.start>old.start)sounding[v.slot-1]={start:v.start,end:end};}});
    for(var p=0;p<pads.length;p++) {
      pads[p].removeAttribute("data-led-onset");pads[p].removeAttribute("data-led-end");
      if(hardwareTransfer && hardwareTransfer.view.active){
        var tv=hardwareTransfer.view, cursor=tv.record ? tv.record-1 : Math.min(15,Math.floor((tv.progress || 0)*16));
        var bright=tv.state==="success" || (["sending","decoding","encoding"].indexOf(tv.state)>=0 && p===cursor);
        pads[p].setAttribute("data-led-level",bright?"bright":"off");
        pads[p].setAttribute("data-led-reason","transfer-"+tv.state);continue;
      }
      pads[p].classList.toggle("step-edit",!!(stepEdit && stepEdit.used && stepEdit.slot===state.slot && stepEdit.step===p));
      var level="off", reason="empty";
      if(recHeld && !rec.on){level=samples[p] || p+1===state.slot?"bright":"off";reason=p+1===state.slot?"record-selected":"record-slots";}
      else if(bpmHeld) { if(p<masterVolume){level="dim";reason="volume";} }
      else if(state.mode==="SOUND") {
        if(samples[p]){level="dim";reason="sample";}
        if(p+1===state.slot){level="bright";reason="selected";}
      } else if(state.mode==="PATTERN") {
        if(patternHasData(patterns[p])){level="dim";reason="pattern";}
        if(p+1===(patternSelection.length?patternSelection[patternSelection.length-1]:patternNumber)){level="bright";reason="selected";}
        else if(p+1===seq.queued){level="dim";reason="queued";}
      } else if(fxHeld || shakeFx) {
        if(p+1===fx.kind){level="bright";reason="effect";}
      } else if(stepView) {
        if(editing && lane[p]>=0){level="dim";reason="own-step";}
        else if(editing) {
          for(var track=0;track<TOTAL_SLOTS;track++) {
            if(track!==state.slot-1 && pat.lanes[track][p]>=0){level="low";reason="other-step";break;}
          }
        }
        if(seq.playing && seq.visualStarted && p===seq.step){level="bright";reason=p===0?"downbeat":"cursor";}
        var hit=sounding[p];
        if(hit){var release=Math.min(.035,(hit.end-hit.start)*.2);level=now<hit.end-release?"bright":"off";reason="sound-trigger";pads[p].setAttribute("data-led-onset",String(hit.start));pads[p].setAttribute("data-led-end",String(hit.end));}
        else {pads[p].removeAttribute("data-led-onset");pads[p].removeAttribute("data-led-end");}
      }
      if(!recHeld && Date.now()<sliceResultUntil && state.slot===sliceResultSlot && !stepView && !bpmHeld && !soundHeld && !patternHeld && !fxHeld){level=p<sliceResultCount?"bright":"off";reason="slice-result";}
      if(rec.on && p+1===rec.slot){level="bright";reason="recording";}
      pads[p].setAttribute("data-led-level",level);
      pads[p].setAttribute("data-led-reason",reason);
      pads[p].setAttribute("data-led-pattern",String(patternNumber));
    }
  }

  function paint() {
    d.body.dataset.loading=startupReady?"false":"true";
    window.PO33Runtime.setActive("music",!!(seq.playing || rec.on || recHeld));
    d.body.setAttribute("data-mode", state.mode);
    elMode.textContent = exporting ? "EXP" : (rec.on ? "REC" : MODES[state.mode]);
    elPat.textContent = "P" + seq.pattern + (seq.queued ? ">" + seq.queued : "");
    elSlot.textContent = "SLOT " + (rec.on ? rec.slot : state.slot);
    elMem.textContent = memLeft().toFixed(1) + "s";
    elHint.textContent = hintText();

    elParamName.textContent = PARAM_NAMES[paramIdx];
    elParamVal.textContent = paramValue();
    updateKnobVisuals(); updateLCD();
    elParamBtn.className = "hbtn p" + (paramIdx + 1);
    elExpBtn.className = "hbtn" + ((exportArmed || exporting) ? " armed" : "");

    var btns = d.querySelectorAll(".cbtn");
    for (var i = 0; i < btns.length; i++) {
      var act = btns[i].getAttribute("data-act");
      var on = (act === "sound" && state.mode === "SOUND") ||
               (act === "pattern" && state.mode === "PATTERN") ||
               (act === "rec" && (recHeld || rec.on)) ||
               (act === "play" && seq.playing) ||
               (act === "fx" && state.mode === "FX") || (act === "write" && state.mode === "STEP");
      btns[i].classList.toggle("on", !!on);
      btns[i].classList.toggle("blink", act === "rec" && state.mode === "STEP");
    }

    var fxCyan = fx.kind && (fx.kind % 2 === 0);
    d.body.classList.toggle("fxhold-cyan", !!fxCyan);
    d.body.classList.toggle("fxhold-orange", !!fx.kind && !fxCyan);
    mascotRec(recHeld || rec.on);

    var lane = patterns[seq.pattern - 1].lanes[state.slot - 1];
    for (var p = 0; p < pads.length; p++) {
      pads[p].classList.toggle("sampled", !!samples[p]);
      pads[p].classList.toggle("cur", seq.playing && p === seq.step && state.mode !== "SOUND");
      pads[p].classList.toggle("cur-slot", state.mode === "SOUND" && (p + 1) === state.slot);
      pads[p].classList.toggle("step-on", state.mode === "STEP" && lane[p] >= 0);
      pads[p].classList.toggle("pat-on", state.mode === "PATTERN" && patternHasData(patterns[p]));
      pads[p].classList.toggle("pat-cur", state.mode === "PATTERN" && (p + 1) === seq.pattern);
      pads[p].classList.toggle("pat-queued", state.mode === "PATTERN" && (p + 1) === seq.queued);
      pads[p].classList.toggle("fx-live", (fxHeld || shakeFx) && p + 1 === fx.kind);
      pads[p].classList.toggle("volume-on", bpmHeld && p < masterVolume);
      var sub = pads[p].querySelector(".sub");
      if (sub) {
        if (state.mode === "FX") sub.textContent = FX_LABELS[p + 1] || "";
        else if (state.mode === "PATTERN") sub.textContent = (p + 1) === seq.pattern ? "CUR" : (patternHasData(patterns[p]) ? "ON" : "");
        else sub.textContent = "";
      }
    }
    paintStepLeds();paintHolds();
  }

  var flashTimers = [];
  function flash(padIndex) {
    var el = pads[padIndex];
    if (!el) return;
    el.classList.add("hit");
    clearTimeout(flashTimers[padIndex]);
    flashTimers[padIndex] = setTimeout(function () {
      el.classList.remove("hit");
    }, 130);
  }

  var hintTimer = null;
  function flashHint(text) {
    elHint.textContent = text;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      hintTimer = null;
      paint();
    }, 1100);
  }

  // ---------- interaction ----------
  function setMode(m) {
    if (state.mode === "FX" && m !== "FX") fxRelease();
    state.mode = m;
    paint();
  }

  function selectSlot(n) {
    var before = state.slot;
    state.slot = Math.max(1, Math.min(TOTAL_SLOTS, n));
    if (state.slot !== before) persistSoon();
    paint();
  }

  function pid(e) {
    if(e && e.po33PointerId!==undefined)return e.po33PointerId;
    return e && e.pointerId !== undefined ? e.pointerId : null;
  }

  function onPadDown(e) {
    sliceResultUntil=0;
    e.preventDefault();
    var n = parseInt(this.getAttribute("data-pad"), 10);
    padPointer = pid(e);
    heldPad = n;

    if (bpmHeld) {
      modifierUsed.bpm = true; masterVolume = n;
      ctx();mixVolume.gain.value=n/16;showNumber(n,"VOL");persistSoon();paint();return;
    }
    if (writeHeld && soundHeld) {
      modifierUsed.write = true;
      if(!pendingCopy)pendingCopy={source:copySource(),target:n,slice:null};
      else if(pendingCopy.target>8)pendingCopy.slice=n-1;
      paint(); return;
    }
    if (patternHeld) {
      patternUsedPad=true;
      if (writeHeld) { modifierUsed.write=true; copyPatternTo(n); patternExtras[n-1]=JSON.parse(JSON.stringify(patternExtras[seq.pattern-1])); persistSoon(); }
      else {
        clearTimeout(patternInputTimer);patternInputTimer=null;
        if (patternSelection.length<128) patternSelection.push(n);
        if(!latchedKeys.has('pattern') && patternSelection.length===1)selectPattern(n);
      }
      paint(); return;
    }
    if (fxHeld && seq.playing) {
      fxPadPointer=pid(e);
      modifierUsed.fx=true;
      if(n===16){fxRelease();showNumber("non","FX");}else fxEngage(n);
      if(state.mode==="STEP" || writeHeld) { if(n===16)patternExtras[seq.pattern-1].effects=[];else {var target=n===14?audibleStepAt(ctx().currentTime):{pattern:seq.pattern,step:seq.step};patternExtras[target.pattern-1].effects[target.step]=n;} persistSoon(); }
      paint(); return;
    }
    if (recHeld) {recUsedPad=true; startRec(n); return; }
    if (soundHeld || state.mode==="SOUND") { previewSound(n); return; }
    if (writeHeld && seq.playing) { modifierUsed.write=true; liveRecord(n-1); return; }
    if (state.mode === "STEP") {
      if(patterns[seq.pattern-1].lanes[state.slot-1][n-1]>=0)beginStepEdit(n-1);
      else toggleStep(n - 1);
      return;
    }
    soundPreviewMeter=false;trigger(n - 1);
    flash(n - 1);
  }

  function toggleMode(act) {
    if (act === "write") { setMode(state.mode === "STEP" ? "PLAY" : "STEP"); return; }
    if (act === "rec") {
      // Recording is a held modifier; WRITE owns step editing.
      return;
    }
    if (act === "fx") {
      tweakMode = (tweakMode + 1) % 3; paint();
      return;
    }
    if (act === "play") {
      togglePlay();
      return;
    }
    var target = act.toUpperCase();
    if (target === "SOUND" && state.mode === "SOUND") soundTap = false;
    if (state.mode === target) setMode("PLAY");
    else setMode(target);
  }

  var ctl = d.getElementById("ctl");
  var lastPointer = 0;
  var touchChord={},touchChordTimers={};
  var soundChoiceMade=false,soundBrowseSlot=0,soundBrowseNote=-1;
  var physicalKeys=new Set(),latchedKeys=new Set(),keyPointers=new Map(),pressedAt={},deleteHoldTimer=null,latchSerial=-10000;
  function activeKeys(){return new Set([...physicalKeys,...latchedKeys]);}
  function consumeChord(){
    Object.keys(touchChordTimers).forEach(function(k){clearTimeout(touchChordTimers[k]);});touchChordTimers={};
    physicalKeys.forEach(function(k){if(k.indexOf('pad')!==0)modifierUsed[k]=true;});
  }
  function dropLatch(act){
    var pointer=touchChord[act];latchedKeys.delete(act);delete touchChord[act];
    var button=act==='bpm'?d.getElementById('bpmMode'):ctl.querySelector('[data-act="'+act+'"]');if(button)button.classList.remove('transfer-latched');
    if(pointer!==undefined){
      var physical=Array.from(keyPointers.entries()).find(function(entry){return entry[1]===act;});
      if(physical){modifierPointers[act]=physical[0];modifierUsed[act]=true;}
      else releaseControls({pointerId:pointer,type:'pointercancel'});
    }
    paintHolds();
  }
  function checkPhysicalDelete(){clearTimeout(deleteHoldTimer);deleteHoldTimer=null;}
  d.addEventListener('pointerdown',function(e){
    var el=e.target.closest && e.target.closest('.cbtn,#bpmMode,.pad,.knob');if(!el)return;
    var act=el.id==='bpmMode'?'bpm':el.dataset.act || (el.dataset.pad?'pad'+el.dataset.pad:null);
    if(!act){consumeChord();return;}
    var prior=Array.from(physicalKeys);
    // WRITE/SOUND can be armed together only when neither has performed an action.
    var pair=(act==='write'||act==='sound') && prior.every(function(k){return k==='write'||k==='sound';});
    if(prior.length && !pair){consumeChord();e.po33ChordConsumed=true;}
    keyPointers.set(e.pointerId,act);physicalKeys.add(act);pressedAt[act]=Date.now();
    setTimeout(checkPhysicalDelete,0);
  },true);
  function releasePhysical(e){
    var act=keyPointers.get(e.pointerId);keyPointers.delete(e.pointerId);
    if(act && !Array.from(keyPointers.values()).includes(act))physicalKeys.delete(act);
    clearTimeout(deleteHoldTimer);deleteHoldTimer=null;
  }
  window.addEventListener('pointerup',releasePhysical);window.addEventListener('pointercancel',releasePhysical);
  d.addEventListener('lostpointercapture',function(e){if(keyPointers.has(e.pointerId)){releasePhysical(e);releaseControls({pointerId:e.pointerId,type:'pointercancel'});}},true);
  function armChord(e,act,btn){
    if(e.po33ChordConsumed || e.shiftKey || (e.pointerType!=="touch" && e.pointerType!=="mouse") || act==="play")return;
    // A normal held combination stays momentary; an unused 800 ms hold becomes sticky.
    var pointer=pid(e);
    touchChordTimers[pointer]=setTimeout(function(){
      if(modifierPointers[act]!==pointer || modifierUsed[act] || heldPad)return;
      Array.from(latchedKeys).forEach(function(k){if(!(['write','sound'].includes(k)&&['write','sound'].includes(act)))dropLatch(k);});
      var latchId=latchSerial--;latchedKeys.add(act);touchChord[act]=latchId;modifierPointers[act]=latchId;if(act==="rec")recPointer=latchId;modifierUsed[act]=true;btn.classList.add("transfer-latched");
      paintHolds();
    },HOLD_DELAY);
  }
  function resetSoundBrowse(){soundChoiceMade=false;soundBrowseSlot=0;soundBrowseNote=-1;}
  function previewSound(n){
    soundPreviewMeter=true;
    modifierUsed.sound=true;selectSlot(n);soundChoiceMade=true;defaultStep=null;
    var note=n<=8?4:(soundBrowseSlot===n?(soundBrowseNote+1)%16:0);
    soundBrowseSlot=n;soundBrowseNote=note;trigger(note);lastWasSlice=false;
    parameterDisplay=false;showNumber(n<=8?String(n):String(n).padStart(2,"0")+String(note+1).padStart(2,"0"),n<=8?"SOUND":"SOUND / SLICE");
    paint();
  }
  function clearTouchChord(){
    Object.keys(touchChordTimers).forEach(function(k){clearTimeout(touchChordTimers[k]);});touchChordTimers={};
    var held=touchChord;touchChord={};latchedKeys.clear();
    Object.keys(held).forEach(function(act){
      var key=act==="bpm"?d.getElementById("bpmMode"):ctl.querySelector('[data-act="'+act+'"]');if(key)key.classList.remove("transfer-latched");
      releaseControls({pointerId:held[act],type:"pointercancel"});
    });
  }

  var deleteDisplay=null;
  function onCtlDown(e) {
    var btn=e.target.closest ? e.target.closest(".cbtn") : null;
    if(!btn) return; e.preventDefault(); lastPointer=Date.now();
    if(hardwareTransfer && hardwareTransfer.view.active)return;
    var act=btn.getAttribute("data-act");
    if(touchChord[act]!==undefined){dropLatch(act);return;}

    if(act!=='pattern' && latchedKeys.has('pattern') && patternSelection.length)finishPatternInput();
    if(stepEdit && ["sound","pattern","write","fx","rec"].indexOf(act)>=0)endStepEdit(true);
    modifierPointers[act]=pid(e); modifierUsed[act]=!!e.po33ChordConsumed;
    armChord(e,act,btn);
    if(writeHeld && soundHeld && (act==="play" || act==="rec")){
      modifierUsed.write=modifierUsed.sound=true;
      consumeChord();hardwareTransfer.open(act==="play"?"send":"receive");clearTouchChord();return;
    }
    if(!writeHeld && (recHeld && (act==='sound' || act==='pattern'))){
      consumeChord();modifierUsed.rec=modifierUsed.sound=modifierUsed.pattern=true;recUsedPad=true;
      if(act==='pattern' || (act==='rec' && patternHeld)){var deletedPattern=seq.playing?(seq.visualPattern || seq.pattern):seq.pattern;clearPattern(deletedPattern);patternExtras[deletedPattern-1]={effects:[],locks:{}};persistSoon();}else deleteSlot(state.slot);clearTimeout(deleteHoldTimer);deleteDisplay={target:act,code:act==='pattern'?'clr':'del'};displayValue=null;displayUntil=0;paint();return;
    }
    if(act==="rec") { recPointer=pid(e); setRecHeld(true); return; }
    if(act==="play") { togglePlay(); return; }
    if(act==="write") { writeHeld=true; return; }
    if(act==="fx") { clearFxTimers();transportGeneration++;cancelShakeFx();fxHeld=true;return; }
    if(act==="sound") {
      if(physicalKeys.has("rec")) {recUsedPad=true;return;}
      soundChoiceMade=false;soundHeld=true; previousMode=state.mode; setMode("SOUND"); return;
    }
    if(act==="pattern") {
      if(physicalKeys.has("rec")) {recUsedPad=true;return;}
      clearTimeout(patternInputTimer);patternInputTimer=null;patternHeld=true; patternUsedPad=false; patternSelection=[];
      previousMode=state.mode; setMode("PATTERN"); return;
    }
    paint();
  }
  ctl.addEventListener("pointerdown",onCtlDown);
  function releaseControls(e) {
    if(deleteDisplay && modifierPointers[deleteDisplay.target]===pid(e) && latchedKeys.has("rec"))dropLatch("rec");
    clearTimeout(touchChordTimers[pid(e)]);delete touchChordTimers[pid(e)];
    if(stepEdit && stepEdit.pointer===pid(e))endStepEdit(e.type==="pointercancel");
    if(fxPadPointer!==undefined && pid(e)===fxPadPointer){fxPadPointer=undefined;if(fxHeld)fxRelease();}
    if(padPointer!==undefined && pid(e)===padPointer) {
      if(recHeld && recUsedPad && !shiftHolds.rec){if(rec.on)finishRec();pendingRecSlot=0;if(latchedKeys.has('rec'))dropLatch('rec');}
      padPointer=undefined; heldPad=0;
    }
    Object.keys(modifierPointers).forEach(function(act){
      if(modifierPointers[act]!==pid(e))return;
      if(touchChord[act]===pid(e) && e.type!=="pointercancel")return;
      if(e.type==="pointercancel" && touchChord[act]===pid(e)){latchedKeys.delete(act);delete touchChord[act];var key=act==="bpm"?d.getElementById("bpmMode"):ctl.querySelector('[data-act="'+act+'"]');if(key)key.classList.remove('transfer-latched');}
      delete modifierPointers[act];
      if((act==="sound" || act==="write") && pendingCopy)commitSoundCopy(e.type==="pointercancel");
      if(act==="bpm") {
        if(loopHold)advanceLoopShadow(ctx().currentTime);
        if(!modifierUsed.bpm && (Date.now()-pressedAt.bpm<300 || (pid(e)<0 && pid(e)>-10000)) && e.type!=="pointercancel") {var tempos=[80,120,140],idx=tempos.indexOf(params.bpm);params.bpm=tempos[(idx+1)%3];}
        bpmHeld=false;persistSoon();
      }
      if(act==="rec") { recPointer=undefined;setRecHeld(false); }
      if(act==="write") { writeHeld=false;if(!modifierUsed.write && (Date.now()-pressedAt.write<300 || (pid(e)<0 && pid(e)>-10000)) && e.type!=="pointercancel")setMode(state.mode==="STEP"?"PLAY":"STEP"); }
      if(act==="fx") {
        fxHeld=false;fxPadPointer=undefined;fxRelease();scheduledEffect=-1;
        if(!modifierUsed.fx && (Date.now()-pressedAt.fx<300 || (pid(e)<0 && pid(e)>-10000)) && e.type!=="pointercancel") {
          tweakMode=(tweakMode+1)%3; parameterDisplay=true;
          showNumber(["ton","FLt","tri"][tweakMode],["TONE","FILTER","TRIM"][tweakMode]);
        }
      }
      if(act==="sound") {soundHeld=false;if(state.mode==="SOUND")setMode(previousMode==="STEP"?"STEP":"PLAY");}
      if(act==="pattern") {
        patternHeld=false;
        commitPatternSelection();
        if(state.mode==="PATTERN")setMode(previousMode==="STEP"?"STEP":"PLAY");
      }
    });
    waitForPatternInput();paint();
  }
  window.addEventListener("pointerup",releaseControls);
  window.addEventListener("pointercancel",releaseControls);
  window.addEventListener("blur",function(){
    clearTouchChord();physicalKeys.clear();keyPointers.clear();clearTimeout(deleteHoldTimer);
    shiftHolds={};
    r1Focused=false;
    clearFxTimers();transportGeneration++;scheduledEffect=0;
    endStepEdit(true);commitSoundCopy(true);
    Object.keys(modifierPointers).forEach(function(act){releaseControls({pointerId:modifierPointers[act],type:"pointercancel"});});
    bpmHeld=fxHeld=writeHeld=soundHeld=patternHeld=false;
    sideRecArmed=sideRecHeld=false;stopShakeSensors();cancelShakeFx();stopTransportAnimation();
    if(rec.on)finishRec();setRecHeld(false);fxRelease();paint();
  });
  ctl.addEventListener("click",function(e){
    if(e.detail>0 || Date.now()-lastPointer<600 || !e.target.closest(".cbtn"))return;
    onCtlDown(e); releaseControls(e);
  });

  // Shift + mouse emulates distinct held fingers; native pointer IDs are never
  // reused for latched keys, so clicking the next control cannot release them.
  var shiftHolds={},shiftPointerSerial=-1;
  function releaseShiftHolds(cancel){
    var held=Object.keys(shiftHolds).map(function(key){return shiftHolds[key];});
    shiftHolds={};
    held.reverse().forEach(function(hold){releaseControls({pointerId:hold.id,type:cancel?"pointercancel":"pointerup"});});
  }
  window.addEventListener("pointerdown",function(e){
    if(resetBusy || resetFailure || e.pointerType!=="mouse" || e.button!==0 || !e.shiftKey)return;
    var target=e.target.closest ? e.target.closest(".cbtn,#bpmMode,.pad") : null;
    if(!target)return;
    var act=target.id==="bpmMode"?"bpm":target.getAttribute("data-act");
    var number=target.getAttribute("data-pad");
    var latch=act && act!=="play";
    if(number)latch=(fxHeld && seq.playing && !bpmHeld && !patternHeld && !soundHeld) ||
      (state.mode==="STEP" && !bpmHeld && !patternHeld && !soundHeld && !recHeld && !writeHeld);
    if(!latch)return;
    lastPointer=Date.now();
    var key=act || "pad"+number;
    if(shiftHolds[key]){
      var previous=shiftHolds[key];delete shiftHolds[key];
      vibrateButton(e);releaseControls({pointerId:previous.id,type:"pointerup"});
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    var id=shiftPointerSerial--;shiftHolds[key]={id:id};e.po33PointerId=id;
  },true);

  window.addEventListener("keyup",function(e){if(e.key==="Shift" && !e.shiftKey)releaseShiftHolds(false);});
  window.addEventListener("pointercancel",function(e){if(e.pointerType==="mouse")releaseShiftHolds(true);});
  d.addEventListener("visibilitychange",function(){if(d.hidden){releaseShiftHolds(true);clearTouchChord();physicalKeys.clear();keyPointers.clear();clearTimeout(deleteHoldTimer);}});

  // stop long-press selection / context menus anywhere in the app
  d.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  d.addEventListener("selectstart", function (e) { e.preventDefault(); });

  var lastPanelTouch=0;
  d.addEventListener('touchend',function(e){if(e.target.closest && e.target.closest('#instrument')){var now=performance.now();if(now-lastPanelTouch<350 && e.cancelable)e.preventDefault();lastPanelTouch=now;}},{passive:false});
  d.addEventListener('dblclick',function(e){e.preventDefault();});
  d.addEventListener('gesturestart',function(e){if(e.cancelable)e.preventDefault();},{passive:false});

  // ---------- hardware ----------
  function onSide() {
    if(sideRecHeld || Date.now()<sideClickIgnoreUntil)return;
    togglePlay();
    try{if(navigator.vibrate)navigator.vibrate(12);}catch(err){}
  }
  window.addEventListener("sideClick",onSide);
  window.addEventListener("longPressStart",function(){
    sideRecArmed=false;sideRecHeld=true;setRecHeld(true);
  });
  window.addEventListener("longPressEnd",function(){
    sideRecHeld=false;sideClickIgnoreUntil=Date.now()+300;
    setRecHeld(sideRecArmed || modifierPointers.rec!==undefined);
  });
  var wheelTrim=null,wheelTrimTimer=null;
  function clearWheelTrim(){wheelTrim=null;clearTimeout(wheelTrimTimer);d.querySelectorAll('.trim-wheel-focus').forEach(function(e){e.classList.remove('trim-wheel-focus');});}
  function focusTrimWheel(index){if(tweakMode!==2)return;clearWheelTrim();wheelTrim={index:index,last:0,burst:0,dir:0};d.getElementById(index?'knobB':'knobA').classList.add('trim-wheel-focus');wheelTrimTimer=setTimeout(clearWheelTrim,8000);}
  function fineTrimWheel(dir){
    if(!wheelTrim || tweakMode!==2 || bpmHeld)return false;
    var sample=samples[state.slot-1],view=state.slot>8?rawSlice(sample,lastNote):sample;if(!view)return true;
    var now=performance.now(),fast=now-wheelTrim.last<65 && dir===wheelTrim.dir;wheelTrim.burst=fast?wheelTrim.burst+1:0;wheelTrim.last=now;wheelTrim.dir=dir;
    var step=wheelTrim.burst>20?2048:wheelTrim.burst>12?512:wheelTrim.burst>5?64:wheelTrim.burst>2?8:1;
    var trim=selectedTweak(state.slot,lastNote),r=window.PO33Sampling.trimFrames(view,trim,view.buffer.length,view.buffer.sampleRate),lo=state.slot>8?0:Math.round((view.offset||0)*view.buffer.sampleRate),hi=state.slot>8?view.buffer.length:Math.round(((view.offset||0)+view.duration)*view.buffer.sampleRate);
    if(wheelTrim.index===0){var length=r.end-r.start;r.start=Math.max(lo,Math.min(hi,r.start+dir*step));r.end=Math.min(hi,r.start+length);}else r.end=Math.max(r.start,Math.min(hi,r.end+dir*step));
    trim.frames=r;
    if(wheelTrim.index===1)trimLengthChanged(state.slot,lastNote);rebuildUnheard(state.slot);
    if(state.slot<=8){trim.start=(r.start-lo)/(hi-lo)*100;trim.length=hi===r.start?0:(r.end-r.start)/(hi-r.start)*100;}
    parameterDisplay=true;clearTimeout(wheelTrimTimer);wheelTrimTimer=setTimeout(clearWheelTrim,8000);showNumber(String(Math.round((wheelTrim.index?r.end-r.start:r.start-lo)/(hi-lo)*999)).padStart(3,"0"),wheelTrim.index?'LENGTH':'START');persistSoon();paint();return true;
  }
  d.addEventListener('pointerdown',function(e){if(!e.target.closest('.knob,.pad'))clearWheelTrim();},true);
  function wheelAdjust(dir) {
    if(loopHold)advanceLoopShadow(ctx().currentTime);
    consumeChord();
    if(stepEdit){adjustKnob(0,dir);return;}
    if(fineTrimWheel(dir))return;
    parameterDisplay=false;
    params.bpm=Math.max(60,Math.min(240,params.bpm+dir));

    showNumber(params.bpm,"BPM");persistSoon();paint();
  }

  window.addEventListener("scrollUp", function () { wheelAdjust(1); });
  window.addEventListener("scrollDown", function () { wheelAdjust(-1); });

  // the r1 wheel arrives as scrollUp/scrollDown; a real wheel event does the same
  window.addEventListener("wheel", function (e) {
    e.preventDefault();
    var dir = e.deltaY < 0 ? 1 : (e.deltaY > 0 ? -1 : 0);
    if (!dir && e.deltaX) dir = e.deltaX < 0 ? 1 : -1;
    if (dir) wheelAdjust(dir);
  }, { passive: false });

  // status bar parameter button: BPM -> TRIM -> PITCH
  elParamBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    paramIdx = (paramIdx + 1) % PARAM_NAMES.length;
    paint();
  });
  elParamBtn.addEventListener("click", function (e) { e.preventDefault(); });

  elExpBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    if (exporting) return;
    exportArmed = !exportArmed;
    if (exportArmed) flashHint("ARMED - PRESS PLAY");
    paint();
  });
  elExpBtn.addEventListener("click", function (e) { e.preventDefault(); });

  function updateLCD() {
    var target=d.getElementById("lcdNumber"); if(!target)return;
    var label=params.bpm===80?"HIP-HOP":params.bpm===120?"DISCO":params.bpm===140?"TECHNO":"BPM";
    var number=String(params.bpm);
    if(parameterDisplay){label=["TONE","FILTER","TRIM"][tweakMode];number=["ton","FLt","tri"][tweakMode];}
    if(state.mode==="SOUND"){label=soundChoiceMade && state.slot>8?"SOUND / SLICE":"SOUND";number=soundChoiceMade && state.slot>8?String(state.slot).padStart(2,"0")+String(lastNote+1).padStart(2,"0"):String(state.slot);}
    if(state.mode==="PATTERN"){label=patternSelection.length>1?"CHAIN "+patternSelection.length:"PATTERN";number=String(patternSelection.length?patternSelection[patternSelection.length-1]:seq.pattern);}
    if(state.mode==="STEP")label="WRITE";
    if(displayValue && Date.now()<displayUntil && (state.mode!=="SOUND")){label=displayValue.label;number=String(displayValue.value);}
    if(seq.playing && state.mode!=="SOUND" && state.mode!=="PATTERN" && !bpmHeld && !(displayValue && Date.now()<displayUntil)){label="PATTERN";number="P"+String(seq.visualPattern || seq.pattern).padStart(2,"0");}
    if(!startupReady){label="LOADING";number="LoAd";}
    if(rec.on){label="REC";number=memLeft().toFixed(1);}
    else if(recHeld){label="REC READY";number="rec";}
    if(activeKeys().has("sound") && activeKeys().has("bpm")){label="FREE";number=memLeft().toFixed(1);}
    if(writeHeld && (soundHeld||patternHeld)){label="COPY";number="CPy";}
    if((fxHeld || shakeFx) && fx.kind){label="FX";number=window.PO33FX.codes[fx.kind];}
    if(recHeld && !rec.on){label='REC READY';number='rec';}
    if(deleteDisplay){if(activeKeys().has('rec') && activeKeys().has(deleteDisplay.target)){label=deleteDisplay.code==='clr'?'CLEAR':'DELETE';number=deleteDisplay.code;}else deleteDisplay=null;}
    if(resetBusy || resetFailure || Date.now()<resetUntil){label=resetFailure?"RESET ERROR":"RESET";number=resetFailure?"err":"RST";}
    var transferView=hardwareTransfer && hardwareTransfer.view.active?hardwareTransfer.view:null;
    if(transferView){label=transferView.state==="decoding"?"CHECK":transferView.mode==="receive"?"RECEIVE":"SEND";number=transferView.state==="error"?"err":transferView.state==="success"?"End":transferView.mode==="receive"?"rcv":"Snd";}
    target.classList.toggle("record-armed-blink",recHeld && !rec.on && !deleteDisplay && !transferView && !resetBusy);
    if(!transferView && Date.now()<clipUntil)label="CLP";
    d.getElementById("lcdMode").textContent=label;
    d.getElementById("lcdRecord").querySelector("rect").setAttribute("fill",(state.mode==="STEP" || writeHeld || ((soundHeld||patternHeld)&&previousMode==="STEP"))?"#fff":"#222");
    d.getElementById("lcdPlay").setAttribute("fill",seq.playing?"#fff":"#222");
    var playLamp=d.querySelector('.cbtn[data-act="play"]');
    var beatOn=seq.playing && ac && ac.currentTime>=seq.visualBeatTime && ac.currentTime-seq.visualBeatTime<Math.min(.12,stepDur()*1.1);
    playLamp.setAttribute("data-led-level",beatOn?"bright":"off");
    if(target.getAttribute("data-value")!==number){
      var cells=(number.match(/[^.]\.?/g) || []).slice(-4);
      while(cells.length<4)cells.unshift("");
      target.replaceChildren.apply(target,cells.map(function(text,i){var cell=d.createElementNS("http://www.w3.org/2000/svg","tspan");cell.setAttribute("x",String(190+i*12));cell.setAttribute("text-anchor","start");if(text){cell.setAttribute("textLength","10.5");cell.setAttribute("lengthAdjust","spacingAndGlyphs");}cell.setAttribute("data-digit",String(i));cell.textContent=text;return cell;}));
      target.setAttribute("data-columns","4");
      target.setAttribute("data-value",number);target.setAttribute("aria-label",number);
    }
    var level=0,rms=0;
    var inputActive=!!((recHeld||rec.on) && micReady());
    if(inputActive)level=inputLevel;
    else if(outputMeter && outputData && ac && ac.state==="running"){outputMeter.getFloatTimeDomainData(outputData);for(var ai=0;ai<outputData.length;ai++){level=Math.max(level,Math.abs(outputData[ai]));rms+=outputData[ai]*outputData[ai];}rms=Math.sqrt(rms/outputData.length);}
    if(!inputActive && level>.003)outputActiveUntil=Date.now()+110;
    if(!inputActive && (soundHeld || state.mode==="SOUND" || (!seq.playing && soundPreviewMeter))){level=0;outputActiveUntil=0;}
    if(transferView){level=transferView.level || 0;inputActive=["listening","receiving"].indexOf(transferView.state)>=0;}
    [["lcdIn",inputActive],["lcdOut",transferView?transferView.state==="sending":!inputActive && Date.now()<outputActiveUntil]].forEach(function(pair){
      var g=d.getElementById(pair[0]);g.setAttribute("data-active",pair[1]?"true":"false");
      g.querySelector("rect").setAttribute("fill",pair[1]?"#fff":"#222");
      g.querySelector("text").setAttribute("fill",pair[1]?"#000":"#888");
    });
    if(!lcdIndicator)lcdIndicator=window.PO33Indicator.create(d.getElementById("lcdMeter"),{mode:"level",value:0},{x:19,y:24.25});
    var props=transferView?{mode:"level",origin:"left",value:transferView.progress===null?Math.ceil(Math.min(1,level)*38):Math.floor(Math.min(1,transferView.progress)*38)}:indicatorProps(level,inputActive);
    if(!transferView && props.mode==="level" && props.origin==="center" && !soundHeld && state.mode!=="SOUND" && !(!seq.playing && soundPreviewMeter)){props=outputBallistics.update(rms,level,performance.now());}
    else outputBallistics.reset();
    if(!transferView && (recHeld||rec.on)){props=inputBallistics.update(inputActive?inputLevel:0,inputActive?inputPeak:0,performance.now(),'left');}else inputBallistics.reset();
    lcdIndicator.setProps(props);
  }
  function indicatorProps(level,inputActive) {
    var meter={mode:"level",origin:!inputActive?"center":"left",value:Math.ceil(Math.min(1,level*1.5)*38)};
    if(inputActive)return meter;
    if(soundHeld || state.mode==="SOUND" || (!seq.playing && soundPreviewMeter))return {mode:"level",origin:"center",value:0};
    if(fx.kind)return meter;
    if(bpmHeld)return {mode:"level",origin:"left",value:Math.round(masterVolume*38/16)};
    if(stepEdit && stepEdit.used)return {mode:"pitch",pitch:effectiveTweak(stepEdit.slot).pitch+(stepEdit.slot<=8?window.PO33Sampling.MELODIC_OFFSETS[patterns[stepEdit.pattern-1].lanes[stepEdit.slot-1][stepEdit.step]]:0)};
    if(!parameterDisplay)return meter;
    if(tweakMode===1)return {mode:"filter",cutoff:effectiveTweak(state.slot).filter};
    if(tweakMode===0)return {mode:"pitch",pitch:effectiveTweak(state.slot).pitch};
    if(tweakMode===2) {
      var t=selectedTweak(state.slot,lastNote),sample=samples[state.slot-1];
      if(!sample || (sample.sliceViews && !sample.sliceViews[lastNote]))return {mode:"trim",start:0,length:0};
      if(state.slot>8){var view=rawSlice(sample,lastNote),r=window.PO33Sampling.trimFrames(view,t,view.buffer.length,view.buffer.sampleRate);return {mode:'trim',start:r.start*100/view.buffer.length,length:(r.end-r.start)*100/view.buffer.length};}
      return {mode:"trim",start:t.start,length:(100-t.start)*t.length/100};
    }
    return meter;
  }
  setInterval(function(){if(!document.hidden)updateLCD();},60);
  function showNumber(value,label) { displayValue={value:value,label:label};displayUntil=Date.now()+1200; }
  function knobSpec(index) {
    if(stepEdit) {
      var e=stepEdit,detail=editDetail(e);
      return index===0 ? [patterns[e.pattern-1].lanes[e.slot-1][e.step]+1,1,16,e.slot<=8?"NOTE":"SLICE"] : [e.slot<=8?detail.length:detail.retrigs,1,e.slot<=8?16:8,e.slot<=8?"STEPS":"RETRIG"];
    }
    if(bpmHeld) return index===0 ? [SWING*100,0,50,"SWING"] : [params.bpm,60,240,"BPM"];
    var t=effectiveTweak(state.slot), sl=selectedTweak(state.slot,lastNote);
    if(tweakMode===0) return index===0 ? [t.pitch,-12,12,"PITCH"] : [t.volume,0,100,"VOL"];
    if(tweakMode===1) return index===0 ? [t.filter,-100,100,"FILTER"] : [t.resonance,0,100,"RES"];
    if(state.slot>8){var view=rawSlice(samples[state.slot-1],lastNote);if(!view)return [0,0,100,index===0?'START':'LENGTH'];var r=window.PO33Sampling.trimFrames(view,sl,view.buffer.length,view.buffer.sampleRate);return index===0?[r.start*100/view.buffer.length,0,100,'START']:[(r.end-r.start)*100/view.buffer.length,0,100,'LENGTH'];}
    return index===0 ? [sl.start,0,100,"START"] : [sl.length,0,100,"LENGTH"];
  }
  var knobPickup=[{key:null,target:0,caught:false},{key:null,target:0,caught:false}],knobVisualReady=false;
  function knobContext(index){
    if(stepEdit)return 'step:'+stepEdit.pattern+':'+stepEdit.slot+':'+stepEdit.step+':'+index;
    if(bpmHeld)return 'bpm:'+index;
    return 'sound:'+state.slot+':'+tweakMode+':'+(state.slot>8 && tweakMode===2?lastNote:'slot')+':'+index;
  }
  function syncKnobTarget(index){
    var spec=knobSpec(index),target=Math.max(0,Math.min(1,(spec[0]-spec[1])/(spec[2]-spec[1]))),key=knobContext(index),pickup=knobPickup[index];
    if(pickup.key!==key || Math.abs(target-pickup.target)>1e-7){pickup.key=key;pickup.target=target;pickup.caught=false;}
    return spec;
  }
  function updateKnobVisuals() {
    if(startupReady && !knobVisualReady){knobVisualReady=true;for(var i=0;i<2;i++){var spec=syncKnobTarget(i);knobAngles[i]=knobPickup[i].target*KNOB_SWEEP;knobPickup[i].caught=true;}}
    ['knobA','knobB'].forEach(function(id,i){
      syncKnobTarget(i);
      var node=d.getElementById(id);node.style.setProperty('--knob-angle',knobAngles[i]+'deg');node.setAttribute('data-picked-up',String(knobPickup[i].caught));
    });
  }
  function movePhysicalKnob(index,dir){
    var spec=syncKnobTarget(index),pickup=knobPickup[index],before=knobAngles[index]/KNOB_SWEEP;
    var after=Math.max(0,Math.min(1,before+dir/100));knobAngles[index]=after*KNOB_SWEEP;
    if(!pickup.caught){var tolerance=.5/KNOB_SWEEP;pickup.caught=Math.abs(after-pickup.target)<=tolerance || (before-pickup.target)*(after-pickup.target)<=0;}
    if(!pickup.caught){paint();return null;}
    var value=spec[1]+after*(spec[2]-spec[1]);
    if(stepEdit && index===1 && stepEdit.slot>8){var counts=[1,2,3,4,6,8];value=counts[Math.round(after*(counts.length-1))];}
    else value=(!bpmHeld && !stepEdit && tweakMode===0 && index===0)?Math.round(value*10)/10:Math.round(value);
    pickup.target=(value-spec[1])/(spec[2]-spec[1]);return {spec:spec,value:value};
  }
  function adjustKnob(index,dir) {
    if(loopHold)advanceLoopShadow(ctx().currentTime);
    consumeChord();
    var movement=movePhysicalKnob(index,dir);if(!movement)return;
    if(stepEdit) {
      var e=stepEdit,detail=editDetail(e),lane=patterns[e.pattern-1].lanes[e.slot-1],before=knobSpec(index);
      if(stepCopyTimer)clearTimeout(stepCopyTimer);stepCopyTimer=null;
      e.used=true;
      if(index===0)lane[e.step]=Math.max(0,Math.min(15,movement.value-1));
      else if(e.slot<=8)detail.length=Math.max(1,Math.min(16,movement.value));
      else {var counts=[1,2,3,4,6,8],at=counts.indexOf(detail.retrigs);detail.retrigs=movement.value;}
      var after=knobSpec(index);
      writePattern(e.pattern);showNumber(index===0?lane[e.step]+1:(e.slot<=8?detail.length:detail.retrigs),knobSpec(index)[3]);
      if(!seq.playing)voice(e.slot,lane[e.step],undefined,e.slot<=8?detail.length*stepDur():undefined);
      paint();return;
    }
    if(recHeld && tweakMode!==2) {
      var reset=tweaks[state.slot-1],key=tweakMode===0?(index===0?"pitch":"volume"):(index===0?"filter":"resonance");
      reset[key]=key==="volume"?100:0;manualParameter(state.slot,key,reset[key]);recUsedPad=true;persistSoon();showNumber(reset[key],"RESET");paint();return;
    }
    var spec=knobSpec(index), t=tweaks[state.slot-1], sl=selectedTweak(state.slot,lastNote);
    var value=movement.value;
    if(bpmHeld) {modifierUsed.bpm=true;if(index===0)SWING=value/100;else params.bpm=value;}
    else if(tweakMode===0) { if(index===0)t.pitch=value;else t.volume=value; }
    else if(tweakMode===1) {if(index===0)t.filter=value;else t.resonance=value;}
    else if(state.slot>8){
      var view=rawSlice(samples[state.slot-1],lastNote);if(!view)return;
      var r=window.PO33Sampling.trimFrames(view,sl,view.buffer.length,view.buffer.sampleRate),total=view.buffer.length;
      if(index===0){var length=r.end-r.start;r.start=Math.round(value*total/100);r.end=Math.min(total,r.start+length);}else r.end=Math.min(total,r.start+Math.round(value*total/100));
      sl.frames={start:r.start,end:r.end};
    }else {delete sl.frames;if(index===0)sl.start=value;else sl.length=value;}
    if(!bpmHeld && tweakMode===2){if(index===1)trimLengthChanged(state.slot,lastNote);rebuildUnheard(state.slot);}
    if(!bpmHeld && tweakMode!==2){var edited=tweakMode===0?(index===0?'pitch':'volume'):(index===0?'filter':'resonance');manualParameter(state.slot,edited,value);}
    if(!bpmHeld && writeHeld && seq.playing && tweakMode!==2) {
      modifierUsed.write=true;patternExtras[seq.pattern-1].locks[(state.slot-1)+":"+seq.step]=Object.assign({},patternExtras[seq.pattern-1].locks[(state.slot-1)+":"+seq.step],{[edited]:value});
    }
    if(!bpmHeld)parameterDisplay=true;
    var code=bpmHeld?Math.round(value):tweakMode===2?String(Math.round(value*999/100)).padStart(3,"0"):tweakMode===1?(index===1?"res":Math.abs(value)<=4?"nof":value<0?"lpf":"hpf"):(index===0?"ptc":"vol");
    showNumber(code,spec[3]);persistSoon();paint();
  }
  d.getElementById("bpmMode").addEventListener("pointerdown",function(e){
    if(soundHeld && !writeHeld){e.preventDefault();consumeChord();bpmHeld=true;modifierPointers.bpm=pid(e);modifierUsed.bpm=true;showNumber(memLeft().toFixed(1),"FREE");paint();return;}
    if(stepEdit && stepEdit.slot>8) {
      e.preventDefault();var counts=[1,2,3,4,6,8],detail=editDetail(stepEdit);
      if(stepCopyTimer)clearTimeout(stepCopyTimer);stepCopyTimer=null;
      stepEdit.used=true;detail.retrigs=counts[(counts.indexOf(detail.retrigs)+1)%counts.length];
      showNumber(detail.retrigs,"RETRIG");persistSoon();paint();return;
    }
    e.preventDefault();if(touchChord.bpm!==undefined){dropLatch("bpm");return;}
    parameterDisplay=false;bpmHeld=true;modifierPointers.bpm=pid(e);modifierUsed.bpm=!!e.po33ChordConsumed;armChord(e,"bpm",this);paint();
  });
  ["knobA","knobB"].forEach(function(id,index){
    var knob=d.getElementById(id), active=false,lastY=0;
    knob.addEventListener("pointerdown",function(e){e.preventDefault();focusTrimWheel(index);active=true;lastY=e.clientY;knob.setPointerCapture(e.pointerId);});
    knob.addEventListener("pointermove",function(e){
      if(!active)return;
      var scale=d.getElementById("panel").getBoundingClientRect().width/240,delta=(lastY-e.clientY)/scale;
      if(Math.abs(delta)>.05){adjustKnob(index,delta*.5);lastY=e.clientY;}
    });
    ["pointerup","pointercancel","lostpointercapture"].forEach(function(type){knob.addEventListener(type,function(){active=false;});});
    knob.addEventListener("wheel",function(e){e.preventDefault();e.stopPropagation();if(e.deltaY)adjustKnob(index,e.deltaY<0?1:-1);},{passive:false});
    knob.addEventListener("keydown",function(e){if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();e.stopPropagation();adjustKnob(index,e.key==="ArrowUp"?1:-1);}});
  });

  // R1 live punch-in FX is distinct from the on-screen FX key and pattern automation.
  function cancelShakeFx(){shakeFx=0;fxRelease();scheduledEffect=-1;}
  function resetShakeGroup(){
    if(shakeTimer)clearTimeout(shakeTimer);shakeTimer=null;
    shakeCount=0;shakeCancelled=false;shakeReady=true;shakeBaseline=null;shakeLastPeak=-Infinity;
  }
  function finishShakeGroup(){
    shakeTimer=null;
    if(seq.playing && !document.hidden && shakeCount===2 && !shakeCancelled){
      var choices=[];for(var i=1;i<=15;i++)if(i!==lastShakeFx)choices.push(i);
      shakeFx=choices[Math.floor(Math.random()*choices.length)];lastShakeFx=shakeFx;
      clearFxTimers();transportGeneration++;scheduledEffect=-1;
      fxEngage(shakeFx);
      if(state.mode==="STEP"){patternExtras[seq.pattern-1].effects[seq.step]=shakeFx;persistSoon();}
      showNumber(shakeFx,"SHAKE FX");paint();
    }
    shakeCount=0;shakeCancelled=false;
  }
  function onShakeSample(data){
    if(!seq.playing || document.hidden || !data)return;
    var v=[Number(data.x),Number(data.y),Number(data.z)];
    if(!v.every(Number.isFinite))return;
    var now=performance.now();
    if(!shakeBaseline){shakeBaseline=v;return;}
    var scale=Math.max.apply(null,v.map(Math.abs))>3?9.81:1;
    var energy=0;
    for(var i=0;i<3;i++){
      var delta=(v[i]-shakeBaseline[i])/scale;energy+=delta*delta;
      shakeBaseline[i]=shakeBaseline[i]*.82+v[i]*.18;
    }
    energy=Math.sqrt(energy);
    if(energy<.13)shakeReady=true;
    if(energy<.42 || !shakeReady || now-shakeLastPeak<210)return;
    shakeReady=false;shakeLastPeak=now;shakeCount++;
    if(shakeTimer)clearTimeout(shakeTimer);
    if(shakeCount>=3 && !shakeCancelled){
      shakeCancelled=true;cancelShakeFx();showNumber("00","FX OFF");paint();
    }
    // Wait for quiet before committing two; a third shake wins without a transient FX.
    shakeTimer=setTimeout(finishShakeGroup,550);
  }
  function startShakeSensors(){
    if(!seq.playing || document.hidden || !r1Focused || shakeSensor)return;
    var sensor=window.creationSensors && window.creationSensors.accelerometer;
    if(!sensor || typeof sensor.start!=="function")return;
    var generation=++sensorGeneration;shakeSensor=sensor;
    Promise.resolve(typeof sensor.isAvailable==="function"?sensor.isAvailable():true).then(function(available){
      if(generation!==sensorGeneration || !seq.playing || document.hidden)return;
      if(!available){shakeSensor=null;return;}
      return sensor.start(function(data){if(generation===sensorGeneration)onShakeSample(data);},{frequency:50});
    }).catch(function(){if(generation===sensorGeneration)shakeSensor=null;});
  }
  function stopShakeSensors(){
    sensorGeneration++;resetShakeGroup();
    if(shakeSensor){try{var result=shakeSensor.stop();if(result && result.catch)result.catch(function(){});}catch(err){}}
    shakeSensor=null;
  }
  // Some device builds inject the SDK after page startup.
  setInterval(function(){if(seq.playing && !document.hidden && !shakeSensor)startShakeSensors();},1000);
  document.addEventListener("visibilitychange",function(){
    if(document.hidden){clearFxTimers();transportGeneration++;scheduledEffect=0;sideRecArmed=sideRecHeld=false;setRecHeld(false);stopShakeSensors();cancelShakeFx();stopTransportAnimation();}
    else if(seq.playing){startShakeSensors();startTransportAnimation();}
  });
  window.addEventListener("focus",function(){r1Focused=true;if(seq.playing){startShakeSensors();startTransportAnimation();}});
  window.addEventListener("pagehide",function(){
    sideRecArmed=sideRecHeld=false;setRecHeld(false);
    stopShakeSensors();cancelShakeFx();stopTransportAnimation();
  });
  function stopTransportAnimation(){
    if(window.PO33Mascot)window.PO33Mascot.stop();
    if(transportFrame!==null)cancelAnimationFrame(transportFrame);transportFrame=null;
    ["tapeHead","tapeLeft","tapeRight"].forEach(function(id){var el=d.getElementById(id);if(el)el.removeAttribute("transform");});
  }
  function startTransportAnimation(){
    if(transportFrame!==null || !seq.playing || document.hidden)return;
    if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    function frame(now){
      if(!seq.playing || document.hidden){stopTransportAnimation();return;}
      transportFrame=requestAnimationFrame(frame);
      if(now-transportLastFrame<30)return;transportLastFrame=now;
      if(window.PO33Mascot)window.PO33Mascot.frame(now);
      var position=(seq.lastStepIdx||0)+(ctx().currentTime-(seq.lastStepTime||seq.nextTime))/stepDur();
      var phase=position/4*Math.PI*2, swing=Math.sin(phase), bob=Math.abs(Math.sin(phase));
      d.getElementById("tapeHead").setAttribute("transform","translate("+(swing*.55)+" "+(-bob*.65)+") rotate("+(swing*3)+" 120.5 11)");
      d.getElementById("tapeLeft").setAttribute("transform","translate("+(-Math.max(0,swing)*1.3)+" "+(-Math.max(0,swing)*.7)+")");
      d.getElementById("tapeRight").setAttribute("transform","translate("+(Math.max(0,-swing)*1.3)+" "+(-Math.max(0,-swing)*.7)+")");
    }
    transportFrame=requestAnimationFrame(frame);
  }

  function prepareMusicAfterInterruption(){
    if(!musicGraphStale || document.hidden || (hardwareTransfer && hardwareTransfer.view.active) || rec.on)return;
    stopSeq();disconnectMusicMic();micModulePromise=null;
    var old=ac;if(old){sampleVoices.slice().forEach(function(v){try{v.src.stop();}catch(e){}});window.PO33Runtime.unregister(old);if(fx.proc)fx.proc.onaudioprocess=null;old.close().catch(function(){});}
    sampleVoices=[];parameterLatches.reset();clearFxTimers();transportGeneration++;
    ac=null;master=bus=mixVolume=dryGain=outTrim=outputMeter=outputData=null;
    toneDry=toneWet=toneNode=null;hardwareToneReady=false;hardwareToneError='';noiseBuf=null;
    fx={kind:0,proc:null,wet:null,engine:null,installed:false};musicGraphStale=false;
    ctx();
  }
  ['pointerdown','keydown','sideClick','longPressStart','scrollUp','scrollDown'].forEach(function(type){window.addEventListener(type,prepareMusicAfterInterruption,true);});
  function retireBackgroundMusic(){if(ac){musicGraphStale=true;stopSeq();}}
  document.addEventListener('visibilitychange',function(){if(document.hidden)retireBackgroundMusic();});
  window.addEventListener('pagehide',retireBackgroundMusic);

  // desktop test helpers: arrows = wheel, space = side button, R = hold REC,
  // P = hold PATTERN, F = FX, E = export, Enter = PLAY
  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.code === "Space" || e.key === " ") { e.preventDefault(); sideRecHeld=true;setRecHeld(true); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); setRecHeld(true); }
    else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (!patternHeld) {clearTimeout(patternInputTimer);patternInputTimer=null;patternSelection=[]; patternHeld = true; patternUsedPad = false; patternPressedAt = Date.now() - 1000; paint(); }
    } else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleMode("fx"); }
    else if (e.key === "e" || e.key === "E") { e.preventDefault(); if (!exporting) { exportArmed = !exportArmed; paint(); } }
    else if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); wheelAdjust(1); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); wheelAdjust(-1); }
  });
  window.addEventListener("keyup", function (e) {
    if(e.code==="Space" || e.key===" "){e.preventDefault();sideRecHeld=false;setRecHeld(modifierPointers.rec!==undefined);}
    if (e.key === "r" || e.key === "R") { e.preventDefault(); setRecHeld(false); }
    if (e.key === "p" || e.key === "P") { e.preventDefault(); patternHeld = false;commitPatternSelection(); paint(); }
  });

  d.addEventListener("pointerdown", function () { if(hardwareTransfer && hardwareTransfer.view.active)return;try { ctx(); } catch (err) {} }, true);

  paint();

  // Factory reset is deliberately a continuous five-second gesture on the head.
  // A stored marker makes an interrupted/failed clear resume on the next load.
  var resetControl=d.getElementById("factoryReset"),startupRestore=null;
  function cancelResetHold(){
    if(resetHoldTimer)clearTimeout(resetHoldTimer);
    resetHoldTimer=null;resetPointer=null;resetKey=null;
  }
  function beginResetHold(pointer,key){
    if(resetBusy || resetHoldTimer)return;
    resetPointer=pointer;resetKey=key;resetHoldStarted=performance.now();
    resetHoldTimer=setTimeout(function check(){
      var remaining=5000-(performance.now()-resetHoldStarted);
      if(remaining>0){resetHoldTimer=setTimeout(check,remaining);return;}
      cancelResetHold();factoryReset(false);
    },5000);
  }
  resetControl.addEventListener("pointerdown",function(e){
    if(e.button!==0 || resetPointer!==null)return;
    e.preventDefault();beginResetHold(e.pointerId,null);
    try{resetControl.setPointerCapture(e.pointerId);}catch(err){}
  });
  window.addEventListener("pointermove",function(e){
    if(e.pointerId!==resetPointer)return;
    var r=resetControl.getBoundingClientRect();
    if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)cancelResetHold();
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(function(type){
    window.addEventListener(type,function(e){if(e.pointerId===resetPointer)cancelResetHold();});
  });
  resetControl.addEventListener("keydown",function(e){
    if(e.key!=="Enter" && e.key!==" ")return;
    e.preventDefault();e.stopPropagation();if(!e.repeat)beginResetHold(null,e.key);
  });
  resetControl.addEventListener("keyup",function(e){
    if(e.key!=="Enter" && e.key!==" ")return;
    e.preventDefault();e.stopPropagation();if(e.key===resetKey)cancelResetHold();
  });
  resetControl.addEventListener("blur",cancelResetHold);
  window.addEventListener("blur",cancelResetHold);
  d.addEventListener("visibilitychange",function(){if(d.hidden)cancelResetHold();});
  window.addEventListener("pointerdown",function(e){if(resetPointer!==null && e.pointerId!==resetPointer)cancelResetHold();},true);
  ["pointerdown","pointermove","pointerup","keydown","keyup","wheel","sideClick","longPressStart","longPressEnd","scrollUp","scrollDown"].forEach(function(type){
    window.addEventListener(type,function(e){
      var onHead=e.target && e.target.nodeType && resetControl.contains(e.target);
      var releasingHold=resetPointer!==null && e.pointerId===resetPointer && (type==="pointerup" || type==="pointermove");
      if(!resetBusy && (!resetFailure || onHead || releasingHold))return;
      if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();
    },{capture:true,passive:false});
  });
  async function clearSamplerStorage(){
    var keys=[PK.meta];
    for(var i=1;i<=16;i++){keys.push(PK.slot(i));keys.push(PK.pat(i));}
    await window.PO33SampleAssets.clear();
    for(var k=0;k<keys.length;k++){
      if(!(await callStore(store,"remove",keys[k])).ok)throw new Error("reset storage failed");
    }
    for(var key of keys){var cleared=await callStore(store,"get",key);if(!cleared.ok || (cleared.value!=null && cleared.value!==""))throw new Error("reset user data still present");}
    try{localStorage.removeItem('po33.localHub.ip');localStorage.removeItem('po33.micGainDb');localStorage.removeItem('po33.micAutoLevel');sampleMicGainDb=0;sampleMicAuto=false;}catch{}
  }
  var resetCommitting=false;
  async function factoryReset(recover){
    if(resetBusy)return;
    resetBusy=true;resetFailure=false;persistPaused=true;cancelResetHold();
    d.body.setAttribute("data-resetting","true");paint();
    try{
      if(!recover && startupRestore)await startupRestore;
      if(hardwareTransfer)await hardwareTransfer.reset();
      persistPaused=true;
      if(metaTimer){clearTimeout(metaTimer);metaTimer=null;}
      saveQueue=[];saveQueued={};
      parameterLatches.reset();resetSoundBrowse();clearTouchChord();releaseShiftHolds(true);clearWheelTrim();
      Object.keys(holdTimers).forEach(function(id){clearTimeout(holdTimers[id]);});holdTimers={};holdPointers={};physicalHolds.clear();
      bpmHeld=fxHeld=writeHeld=soundHeld=patternHeld=false;modifierPointers={};modifierUsed={};patternSelection=[];
      endStepEdit(true);pendingCopy=null;pendingRecSlot=0;
      sideRecArmed=sideRecHeld=recHeld=false;
      rec.on=false;rec.chunks=[];rec.replacing=null;
      clearTimeout(rec.stopTimer);rec.stopTimer=null;rec.stopping=false;if(rec.resolve)rec.resolve(false);rec.resolve=null;
      sliceResultUntil=0;clearTimeout(sliceResultTimer);
      if(rec.timer){clearInterval(rec.timer);rec.timer=null;}
      d.body.classList.remove("recording");
      disconnectMusicMic();
      stopSeq();stopShakeSensors();cancelShakeFx();stopTransportAnimation();clearFxTimers();transportGeneration++;
      var now=ctx().currentTime;sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});
      // Let an already dispatched storage write finish before removing its key.
      while(saveRunning)await new Promise(function(resolve){setTimeout(resolve,20);});
      store=store || storageCandidate();if(!store)throw new Error("storage unavailable");
      if(!recover && !(await callStore(store,"set",PK.reset,"1")).ok)throw new Error("reset marker failed");
      await clearSamplerStorage();failedSaveKeys.clear();storeFail=null;
      // A reset recovery may run in the same document after a hardware checkpoint.
      // Rebuild the baseline unconditionally, never seed around old in-memory lanes.
      samples=Array(16).fill(null);patterns=Array.from({length:16},emptyPattern);
      patternExtras=Array.from({length:16},function(){return {effects:[],locks:{}};});
      tweaks=Array.from({length:16},function(){return {pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}};});
      lastNotes=Array(16).fill(0);lastNote=0;state.slot=1;seq.pattern=1;seq.queued=0;masterVolume=8;state.mode="PLAY";
      physicalKeys.clear();keyPointers.clear();clearTimeout(deleteHoldTimer);
      factoryMuted=Array(16).fill(false);patternChain=[];patternSelection=[];chainPosition=0;
      savedSig=Array(16).fill(null);patSig=Array(16).fill(null);
      seedFactory(null);
      params.bpm=factoryTempo();SWING=factorySwing();factoryTempoRevision=0;paramIdx=0;parameterDisplay=false;displayValue=null;displayUntil=0;
      if(recover){
        await restoreAll();params.bpm=factoryTempo();SWING=factorySwing();
        resetCommitting=true;persistPaused=false;flushPersist();storePump();
        var resetSaveDeadline=Date.now()+15000;
        while(saveRunning || saveQueue.length){if(Date.now()>resetSaveDeadline)throw new Error("reset save timeout");await new Promise(function(resolve){setTimeout(resolve,20);});}
        if(failedSaveKeys.size)throw new Error("reset save failed");
        if(!(await callStore(store,"remove",PK.reset)).ok)throw new Error("reset marker failed");
        resetCommitting=false;resetBusy=false;resetUntil=Date.now()+1500;d.body.removeAttribute("data-resetting");paint();
      } else {
        // A fresh document also discards audio buffers, microphone state and FX history.
        await new Promise(function(resolve){setTimeout(resolve,700);});
        window.location.reload();
      }
    }catch(err){
      resetCommitting=false;resetBusy=false;resetFailure=true;persistPaused=true;
      d.body.removeAttribute("data-resetting");paint();
    }
  }

  // ---------- startup: restore what was stored, then keep writing ----------
  function flushOnHide() {
    if (rec.on) finishRec().then(flushPersist);
    flushPersist();
  }
  d.addEventListener("visibilitychange", function () {
    if (d.visibilityState === "hidden") flushOnHide();
  });
  window.addEventListener("pagehide", flushOnHide);
  window.addEventListener("beforeunload", flushOnHide);

  async function startRestore() {
    if (!storageCandidate()) { store = null; storageReady = true; return; }
    store=storageCandidate();
    if(!await ensureAssetScope())throw Error("Storage bridge unavailable");
    var marker=await callStore(store,"get",PK.reset);
    if(marker.ok && marker.value)await factoryReset(true);
    else await restoreAll();
  }
  if (store && !ac) {
    // nothing has needed audio yet: open the context without a sound, so the
    // takes come back by themselves
    try { ctx(); } catch (err) { /* the first tap opens it instead */ }
  }
  async function stopForTransfer(){
    clearWheelTrim();clearTouchChord();
    stopSeq();if(rec.on)await finishRec();setRecHeld(false);endStepEdit(true);
    var now=ctx().currentTime;sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});
    disconnectMusicMic();
    clearFxTimers();fxRelease();bpmHeld=fxHeld=writeHeld=soundHeld=patternHeld=false;
    modifierPointers={};shiftHolds={};state.mode="PLAY";
    if(ac && ac.state==="running")ac.suspend();
  }
  function snapshotProject(){
    var assets=[],ids={};
    function view(s){if(!s)return null;var b=s.buffer;if(!b._po33id)b._po33id="transfer-"+Date.now().toString(36)+"-"+(++audioSerial);
      if(!ids[b._po33id]){assets.push({id:b._po33id,rate:b.sampleRate,data:b.getChannelData(0).slice()});ids[b._po33id]=true;}
      return {asset:b._po33id,offset:s.offset || 0,duration:s.duration};}
    var slots=samples.map(function(s){if(!s)return null;var v=view(s);if(s.sliceViews)v.slices=s.sliceViews.map(view);return v;});
    return {assets:assets,slots:slots,patterns:JSON.parse(JSON.stringify(patterns)),extras:JSON.parse(JSON.stringify(patternExtras)),tweaks:JSON.parse(JSON.stringify(tweaks)),bpm:params.bpm,swing:SWING,chain:patternChain.slice(),pattern:seq.pattern,slot:state.slot,masterVolume:masterVolume,lastNotes:lastNotes.slice()};
  }
  function applySnapshot(snapshot){
    var c=ctx(),buffers={};snapshot.assets.forEach(function(a){var b=c.createBuffer(1,a.data.length,a.rate);b.copyToChannel(a.data,0);b._po33id=a.id;buffers[a.id]=b;});
    function view(v){if(!v)return null;return {buffer:buffers[v.asset],offset:v.offset,duration:v.duration,trim:0,pitch:0};}
    stopForTransfer();parameterLatches.reset();resetSoundBrowse();samples=snapshot.slots.map(function(s){if(!s)return null;var v=view(s);if(s.slices)v.sliceViews=s.slices.map(view);return v;});
    patterns=JSON.parse(JSON.stringify(snapshot.patterns));patternExtras=JSON.parse(JSON.stringify(snapshot.extras));tweaks=JSON.parse(JSON.stringify(snapshot.tweaks));
    params.bpm=snapshot.bpm;SWING=snapshot.swing;patternChain=snapshot.chain.slice();seq.pattern=snapshot.pattern || patternChain[0] || 1;seq.queued=0;chainPosition=0;
    state.slot=snapshot.slot || 1;lastNotes=snapshot.lastNotes || Array(16).fill(0);
    masterVolume=snapshot.masterVolume===undefined?8:snapshot.masterVolume;if(mixVolume)mixVolume.gain.value=masterVolume/16;paint();
  }
  function adoptHardware(project){
    var imported=window.PO33PreviewAdapter.adapt(project,ctx());
    stopForTransfer();parameterLatches.reset();resetSoundBrowse();samples=imported.samples;patterns=imported.patterns;patternExtras=imported.extras;tweaks=imported.tweaks;
    params.bpm=imported.bpm;SWING=imported.swing;patternChain=imported.chain;chainPosition=0;seq.pattern=patternChain[0] || 1;seq.queued=0;
    state.slot=1;state.mode="PLAY";masterVolume=8;if(mixVolume)mixVolume.gain.value=.5;paint();return imported;
  }
  async function forceUpdate(){
    await stopForTransfer();if(startupRestore)await startupRestore;
    if(hardwareTransfer && hardwareTransfer.hasSession)await hardwareTransfer.flush();
    else {flushPersist();var deadline=Date.now()+15000;while(saveRunning || saveQueue.length){if(Date.now()>deadline)throw Error('Save not complete; update cancelled');await new Promise(r=>setTimeout(r,20));}if(failedSaveKeys.size)throw Error('Save failed; update cancelled');}
    var check=await fetch('./app-release.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!check.ok)throw Error('Update server unavailable');var release=await check.json();
    if(!/^flowers-20261120-ui\d+\.html$/.test(release.entry))throw Error('Invalid release');
    var verify=await fetch('./'+release.entry+'?check='+Date.now(),{cache:'no-store'});if(!verify.ok)throw Error('Update download failed');await verify.text();
    location.assign('./creation.html?refresh='+Date.now());
  }
  if(window.PO33TransferFactory){
    hardwareTransfer=window.PO33TransferFactory.create({preview:backupPreview,micGain:()=>({db:sampleMicGainDb,mode:sampleMicAuto?'auto':String(sampleMicGainDb),report:lastMicReport}),setMicGain:setSampleMicGain,update:forceUpdate,factoryReset:()=>factoryReset(false),paint:paint,stop:stopForTransfer,snapshot:snapshotProject,adopt:adoptHardware,restoreSnapshot:applySnapshot,hint:flashHint,toneStatus:toneStatus,setTone:setHardwareTone});
    window.PO33Transfer=hardwareTransfer;
  }
  startupRestore=startRestore().then(async function(){if(hardwareTransfer)await hardwareTransfer.restore();}).then(function(){startupReady=true;window.PO33Startup?.ready();paint();},function(){persistPaused=true;startupReady=false;storageWarn="PROJECT LOAD FAILED";paint();window.PO33Startup?.fail("Project restore unavailable / 工程恢复未完成");});
  if (backupPreview && window.parent !== window) {
    window.addEventListener("message", async function(event) {
      if(event.source!==window.parent || event.origin!==window.location.origin || !event.data || event.data.type!=="po33-preview-project")return;
      try {
        await startupRestore;
        if(rec.on || resetBusy)throw Error("Stop recording or resetting before loading a project.");
        var imported=adoptHardware(event.data.project);
        window.parent.postMessage({type:"po33-preview-loaded",summary:imported.summary},window.location.origin);
      } catch(error) {
        window.parent.postMessage({type:"po33-preview-error",error:error.message},window.location.origin);
      }
    });
    window.parent.postMessage({type:"po33-preview-ready"},window.location.origin);
  }
})();
