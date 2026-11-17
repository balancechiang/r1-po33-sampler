/* PO-33 K.O! style micro-sampler — steps 1-4
   step 1: 16 pads, 4x4 grid, synth voices
   step 2: mic sampling into 16 slots, 40.0 s shared pool, lo-fi output chain
   step 3: 16-step sequencer with swing, 16 patterns, wheel-driven BPM/TRIM/PITCH
   step 4: punch-in FX pads 1-8 and a 4-bar WAV export
   persistence: takes (16-bit mono WAV, base64) and patterns go into the r1's
   own creationStorage, so they survive a reload and a device restart.
   Everything not restored is synthesized with the Web Audio API. */
(function () {
  "use strict";

  // ---------- constants & state ----------
  var MELODIC_SLOTS = 8; // slots 1-8 melodic, 9-16 drum
  var TOTAL_SLOTS = 16;
  var MEM_TOTAL = 40.0; // shared sample memory, seconds
  var APP_REVISION = 3; // app storage/feature revision, not PO-33 firmware
  var MIN_TAKE = 0.12; // shorter takes are thrown away, seconds

  var STEPS = 16; // steps in one bar
  var PATTERNS = 16; // pattern slots
  var SWING = 0.22; // fraction of a 16th applied to every second step
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
  // takes and patterns live in the r1 creation's own storage (async, Base64
  // values, kept per creation across launches). One key per slot and per
  // pattern, so a take that does not fit is the only thing that is lost.
  var WAV_RATE = 16000; // what a take is stored at
  var PK = {
    meta: "po33.meta",
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

  function storageCandidate() {
    var cs = window.creationStorage;
    try {
      if (cs && cs.plain && typeof cs.plain.getItem === "function") return cs.plain;
    } catch (e) { /* no bridge */ }
    try {
      if (window.localStorage) return window.localStorage;
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
    if (saveRunning || resetBusy || resetFailure) return;
    if (!store) { saveQueue = []; saveQueued = {}; return; }
    var job = saveQueue.shift();
    if (!job) return;
    delete saveQueued[job.key];
    saveRunning = true;
    callStore(store, job.value ? "set" : "remove", job.key, job.value || undefined).then(function (res) {
      if (!res.ok) storeFailed(job);
      else {
        storeFail = null;
        // the slot did make it into storage after all
        if (job.sig !== undefined && savedSig[job.slot - 1] === null) {
          savedSig[job.slot - 1] = job.sig;
          settled(job.slot);
        }
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
    if (saveRunning && saveQueued[job.key]) return; // replace the one still waiting
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
    storeFail = job.key;
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

  function encodeTake(ch, rate) {
    var n = ch.length;
    var bytes = new Uint8Array(44 + n * 2);
    function str(off, s) { for (var i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i); }
    function u32(off, v) { bytes[off] = v & 255; bytes[off + 1] = (v >> 8) & 255; bytes[off + 2] = (v >> 16) & 255; bytes[off + 3] = (v >>> 24) & 255; }
    function u16(off, v) { bytes[off] = v & 255; bytes[off + 1] = (v >> 8) & 255; }
    str(0, "RIFF"); u32(4, 36 + n * 2); str(8, "WAVE");
    str(12, "fmt "); u32(16, 16); u16(20, 1); u16(22, 1);
    u32(24, rate); u32(28, rate * 2); u16(32, 2); u16(34, 16);
    str(36, "data"); u32(40, n * 2);
    for (var i = 0; i < n; i++) {
      var v = ch[i] < -1 ? -1 : (ch[i] > 1 ? 1 : ch[i]);
      var s16 = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
      if (s16 < -32768) s16 = -32768;
      if (s16 > 32767) s16 = 32767;
      u16(44 + i * 2, s16 & 0xffff);
    }
    return bytes;
  }

  function bytesToB64(bytes) {
    var out = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    }
    return window.btoa(out);
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
    var v = takeValue(slot);
    if (v === null) { savedSig[slot - 1] = null; return; }
    savedSig[slot - 1] = slotSig(s);
    enqueueSave({ key: PK.slot(slot), slot: slot, sig: savedSig[slot - 1], value: v });
    persistSoon();
  }

  function takeValue(slot) {
    var s = samples[slot - 1];
    if (!s || !s.buffer || !s.buffer.getChannelData) return null;
    try {
      var assets = {};
      function pack(view) {
        if (!view) return null;
        var b = view.buffer;
        if (!b._po33id) b._po33id = "a" + Date.now().toString(36) + "-" + (++audioSerial);
        if (!assets[b._po33id]) assets[b._po33id] = bytesToB64(encodeTake(b.getChannelData(0), b.sampleRate || WAV_RATE));
        return {asset:b._po33id,offset:view.offset || 0,duration:view.duration};
      }
      var base=pack(s), slices=s.sliceViews ? s.sliceViews.map(pack) : null;
      return b64utf8({format:3,base:base,slices:slices,assets:assets});
    } catch (e) {
      return null;
    }
  }

  var audioSerial = 0;
  function decodeStoredTake(value, pool) {
    var packed=unb64utf8(value);
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
        slots: slotParams(), tweaks: tweaks, extras: patternExtras, chain: patternChain, masterVolume: masterVolume, factoryRevision: 1, factoryMuted: factoryMuted, lastNotes:lastNotes, patternSettings:patternSettings
      })
    });
  }

  var metaTimer = null;
  function persistSoon() {
    if (persistPaused) return;
    if (metaTimer) clearTimeout(metaTimer);
    metaTimer = setTimeout(function () {
      metaTimer = null;
      if (!persistPaused) writeMeta();
    }, 250);
  }

  // anything still queued goes out now (the page may be closing)
  function flushPersist() {
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
      var v = takeValue(n);
      if (v === null) { savedSig[n - 1] = null; continue; }
      savedSig[n - 1] = slotSig(s);
      enqueueSave({ key: PK.slot(n), slot: n, sig: savedSig[n - 1], value: v });
    }
  }

  function seedFactory(meta) {
    var factory=window.PO33_FACTORY, seeded=[];if(!factory)return seeded;
    var c;try{c=ctx();}catch(err){return seeded;}
    factory.slots.forEach(function(asset){
      var index=asset.slot-1;if(samples[index] || factoryMuted[index])return;
      var bytes=b64ToBytes(asset.wav), view=new DataView(bytes.buffer), rate=view.getUint32(24,true);
      var count=(bytes.length-44)/2,duration=count/rate;
      var id="factory-1-"+asset.slot,buffer=null;
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
        patternSettings[i]={bpm:p.bpm,swing:p.swing};seeded.push(i+1);
      }
    });
    return seeded;
  }

  // ---------- restore ----------
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
    return Promise.all(reads).then(function (res) {
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
        if(Array.isArray(meta.patternSettings) && meta.patternSettings.length===16)patternSettings=meta.patternSettings.map(function(p){
          return p && Number.isFinite(p.bpm) ? {bpm:Math.max(60,Math.min(240,p.bpm)),swing:Math.max(0,Math.min(.5,p.swing || 0))} : null;
        });
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
      var restoredPool={};
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
            return usedSeconds();
          }).catch(function(){storageWarn="UNREADABLE SLOT "+item.slot;return used;});
        });
      }, Promise.resolve(0)).then(function (used) {
        if (used > MEM_TOTAL + 1e-6 && storageWarn.indexOf("NOT LOADED") < 0) {
          storageWarn = "MEMORY FULL · RESTORED " + used.toFixed(1) + "s";
        }
        persistDone(meta);
        return true;
      });
    })["catch"](function () {
      persistDone(null);
      return false;
    });
  }

  function persistDone(meta) {
    var seeded = seedFactory(meta);
    if(seeded.indexOf(seq.pattern)>=0)applyPatternTempo(seq.pattern);
    persistPaused = false;
    storageReady = true;
    seeded.forEach(function(n){writePattern(n);});
    if(seeded.length || !meta || !meta.factoryRevision)persistSoon();
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
        var v0 = takeValue(k);
        if (v0 !== null) { savedSig[k - 1] = slotSig(samples[k - 1]); enqueueSave({ key: PK.slot(k), slot: k, sig: savedSig[k - 1], value: v0 }); }
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
  var params = { bpm: 120, trim: 0, pitch: 0 };
  var paramIdx = 0;
  var KNOB_SWEEP = 280; // total mechanical travel, shared by both knobs

  var factoryMuted = [], knobAngles = [0,0];
  var parameterDisplay=false;
  var lcdIndicator=null;
  var systemInfoPage=0;
  var sideRecArmed=false, sideRecHeld=false, sideClickIgnoreUntil=0;
  var shakeFx=0, lastShakeFx=0, outputActiveUntil=0;
  var r1Focused=true;
  var shakeSensor=null, sensorGeneration=0, shakeTimer=null, shakeCount=0;
  var shakeLastPeak=-Infinity, shakeBaseline=null, shakeReady=true, shakeCancelled=false;
  var transportFrame=null, transportLastFrame=0;
  var tweakMode = 0, bpmHeld = false, fxHeld = false, writeHeld = false;
  var modifierPointers = {}, modifierUsed = {}, previousMode = "PLAY";
  var patternSelection = [], patternChain = [], chainPosition = 0;
  var patternSettings=Array(16).fill(null);
  var lastNote = 0, displayValue = null, displayUntil = 0;
  var lastNotes = Array(16).fill(0), lastWasSlice=false;
  var stepEdit=null, stepCopyTimer=null, pendingCopy=null, defaultStep=null;
  var masterVolume = 8, outputMeter = null, outputData = null, inputLevel = 0;
  var tweaks = [], patternExtras = [];
  for (var ti = 0; ti < 16; ti++) {
    tweaks.push({pitch:0,volume:100,filter:0,resonance:0,start:0,length:100,slices:{}});
    patternExtras.push({effects:[],locks:{}});
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
  // every voice -> master -> [dry + fx] -> bus -> volume -> lowpass -> saturator -> out
  var ac = null;
  var master = null;
  var bus = null;
  var mixVolume = null;
  var dryGain = null;
  var lp = null;
  var sat = null;
  var outTrim = null;
  var noiseBuf = null;

  function satCurve(k, n) {
    var curve = new Float32Array(n);
    var denom = Math.tanh(k);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / denom;
    }
    return curve;
  }

  function ctx() {
    if (ac) {
      if (ac.state === "suspended" && ac.resume) ac.resume();
      return ac;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();

    master = ac.createGain();
    master.gain.value = 1;

    dryGain = ac.createGain();
    dryGain.gain.value = 1;

    bus = ac.createGain();
    bus.gain.value = 1;
    mixVolume=ac.createGain();mixVolume.gain.value=masterVolume/16;

    lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 11000;
    lp.Q.value = 0.7;

    sat = ac.createWaveShaper();
    sat.curve = satCurve(1.7, 2048);
    sat.oversample = "2x";

    outTrim = ac.createGain();
    outTrim.gain.value = 0.8;

    master.connect(dryGain);
    dryGain.connect(bus);

    bus.connect(mixVolume);mixVolume.connect(lp);
    lp.connect(sat);
    sat.connect(outTrim);
    outTrim.connect(ac.destination);
    outputMeter = ac.createAnalyser(); outputMeter.fftSize = 256;
    outputData = new Float32Array(256); outTrim.connect(outputMeter);
    fxInstall(); // continuously warm history, including manual notes before PLAY
    return ac;
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
  var voiceEffect=0;

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
    var previous=fx.kind;fx.kind=kind;fx.engine.engage(kind,stepDur());
    var stream=kind<=12;
    rampGain(dryGain,stream?0:1,now);rampGain(fx.wet,stream?1:0,now);
    if(!fromPattern && kind===14 && seq.playing)restartPatternFx();
    if(!fromPattern && kind===15)refreshVoices(15,true);
    else if(!fromPattern && previous===15)refreshVoices(0,false);
  }
  function fxRelease(fromPattern) {
    if(!fx.kind)return;
    var previous=fx.kind;fx.kind=0;if(fx.engine)fx.engine.release();
    var now=ctx().currentTime;rampGain(dryGain,1,now);if(fx.wet)rampGain(fx.wet,0,now);
    if(previous===15 && !fromPattern)refreshVoices(0,false);
  }
  function reverseBuffer(buffer) {
    var reversed=reversedBuffers.get(buffer);if(reversed)return reversed;
    reversed=ctx().createBuffer(1,buffer.length,buffer.sampleRate);
    var src=buffer.getChannelData(0),out=reversed.getChannelData(0);
    for(var i=0;i<src.length;i++)out[i]=src[src.length-1-i];
    reversedBuffers.set(buffer,reversed);return reversed;
  }
  function trackVoice(src,g,start,end) {
    var entry={src:src,gain:g,start:start,end:end,slot:slotNumForVoice,note:voiceNote,
      gate:voiceGate,tweak:JSON.parse(JSON.stringify(tweaks[slotNumForVoice-1])),effect:voiceEffect};
    sampleVoices.push(entry);
    src.onended=function(){var i=sampleVoices.indexOf(entry);if(i>=0)sampleVoices.splice(i,1);};
  }
  function cancelVoice(v,now) {
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
      var original=tweaks[v.slot-1];tweaks[v.slot-1]=v.tweak;
      voice(v.slot,v.note,Math.max(now+RAMP,v.start),v.gate,effect);tweaks[v.slot-1]=original;
    });
  }
  function restartPatternFx() {
    var now=ctx().currentTime;
    sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});
    clearFxTimers();transportGeneration++;
    seq.pattern=seq.visualPattern || seq.pattern;
    if(patternChain.length && patternChain[chainPosition]!==seq.pattern){
      var prior=(chainPosition+patternChain.length-1)%patternChain.length;
      chainPosition=patternChain[prior]===seq.pattern?prior:Math.max(0,patternChain.indexOf(seq.pattern));
    }
    seq.schedStep=0;seq.step=0;seq.visualStarted=false;
    seq.nextTime=now+.02;visQueue=[];scheduledEffect=14;
    scheduler();paint();
  }

  // ---------- voices ----------
  var MEL_BASE = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63];

  function pitchMul() {
    return Math.pow(2, params.pitch / 12);
  }

  var slotNumForVoice = 1,voiceNote=0,voiceGate;
  function connectVoice(g, slot, when) {
    var c=ctx(), t=tweaks[slot-1], v=c.createGain(), f=c.createBiquadFilter();
    v.gain.value = t.volume / 100;
    f.type = t.filter < 0 ? "lowpass" : "highpass";
    f.frequency.value = t.filter < 0 ? 20000 * Math.pow(.01,-t.filter/100) : 20 * Math.pow(500,t.filter/100);
    f.Q.value = .7 + t.resonance / 100 * 15;
    g.connect(f); f.connect(v); v.connect(master);
  }
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

  // melodic bank: chromatic playbackRate across pads 1-16 (pad 1 = original)
  function playPitched(s, padIndex, when) {
    var c = ctx();
    var t = when === undefined ? c.currentTime : when;
    var rate = Math.pow(2, padIndex / 12 + (s.pitch || 0) / 12);
    var trimOff = (s.trim / 100) * s.duration;
    var off = (s.offset || 0) + trimOff;
    var avail = (s.duration - trimOff) * (s.length === undefined ? 1 : s.length / 100);
    if (avail < 0.01) return;
    var dur = Math.min(avail / rate,s.gateSeconds || Infinity);
    var src = c.createBufferSource();
    src.buffer = voiceEffect===15?reverseBuffer(s.buffer):s.buffer;
    if(voiceEffect===15)off=Math.max(0,s.buffer.duration-off-avail);
    src.playbackRate.value = rate;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95, t + RAMP);
    g.gain.setValueAtTime(0.95, t + Math.max(RAMP, dur - RAMP));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    connectVoice(g, slotNumForVoice, when);
    trackVoice(src,g,t,t+dur);
    src.start(t, off,dur*rate);
    src.stop(t + dur + 0.03);
  }

  // drum bank: the take is cut into 16 equal slices, one per pad
  function playSlice(s, padIndex, when) {
    var c = ctx();
    var t = when === undefined ? c.currentTime : when;
    var rate = Math.pow(2, s.pitch / 12);
    var sliceDur = s.duration / 16;
    var base = padIndex * sliceDur + (s.trim / 100) * s.duration;
    var off = (s.offset || 0) + Math.max(0, Math.min(s.duration - 0.01, base));
    var region=Math.min(sliceDur * (s.length === undefined ? 1 : s.length / 100),s.duration-(off-(s.offset || 0)));
    var dur = Math.max(0.001,Math.min(region,(s.gateSeconds || Infinity)*rate));
    var src = c.createBufferSource();
    src.buffer = voiceEffect===15?reverseBuffer(s.buffer):s.buffer;
    if(voiceEffect===15)off=Math.max(0,s.buffer.duration-off-region);
    src.playbackRate.value = rate;
    var g = c.createGain();
    var fade = Math.min(RAMP, dur/rate * 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95, t + fade);
    g.gain.setValueAtTime(0.95, t + Math.max(fade, dur/rate - fade));
    g.gain.linearRampToValueAtTime(0.0001, t + dur/rate);
    src.connect(g);
    connectVoice(g, slotNumForVoice, when);
    trackVoice(src,g,t,t+dur/rate);
    src.start(t, off, dur);
  }

  // slotNum 1..16, padIndex 0..15
  function voice(slotNum, padIndex, when, gateSeconds,effect) {
    slotNumForVoice = slotNum;
    voiceNote=padIndex;voiceGate=gateSeconds;voiceEffect=effect===undefined?fx.kind:effect;
    var s = samples[slotNum - 1], tw = tweaks[slotNum-1];
    if (s) {
      s = Object.assign({},s);
      var trim = slotNum > 8 && tw.slices[padIndex] ? tw.slices[padIndex] : tw;
      if(slotNum>8 && s.sliceViews) {
        s=s.sliceViews[padIndex];if(!s)return;
        s=Object.assign({},s,{pitch:tw.pitch,trim:trim.start,length:trim.length,gateSeconds:gateSeconds});
        playPitched(s,0,when);return;
      }
      s.pitch = tw.pitch; s.length = trim.length;
      s.trim = slotNum > 8 ? trim.start / 16 : trim.start;
      s.gateSeconds=gateSeconds;
      if (slotNum <= MELODIC_SLOTS) playPitched(s, padIndex, when);
      else playSlice(s, padIndex, when);
      return;
    }
    // Empty slots are silent until recorded or copied into.
    return;
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
      if(samples[i].sliceViews)samples[i].sliceViews.forEach(count);else count(samples[i]);
    }
    return u;
  }

  function recElapsed() {
    if (!rec.on) return 0;
    var c = ctx();
    var e = c.currentTime - rec.start;
    if (e < 0) e = 0;
    if (e > rec.limit) e = rec.limit;
    return e;
  }

  function memLeft() {
    var left = MEM_TOTAL - usedSeconds() - recElapsed();
    return left > 0 ? left : 0;
  }

  // ---------- sequencer ----------
  function stepDur() {
    return 60 / params.bpm / 4;
  }
  function savePatternTempo(){patternSettings[seq.pattern-1]={bpm:params.bpm,swing:SWING};}
  function applyPatternTempo(n){
    var settings=patternSettings[n-1];if(!settings)return;
    params.bpm=settings.bpm;SWING=settings.swing;
  }

  var visQueue = [];

  function effectAt(step) {
    if(!r1Focused || d.hidden)return 0;
    if(fxHeld)return fx.kind;
    if(shakeFx)return shakeFx;
    return patternExtras[seq.pattern-1].effects[step] || 0;
  }
  function fireStep(step, when,effect) {
    var pat = patterns[seq.pattern - 1];
    var extra = patternExtras[seq.pattern - 1];
    if(!fxHeld && !shakeFx && effect!==scheduledEffect)queueFx(effect,when);
    scheduledEffect=effect;
    if((fxHeld || shakeFx) && (state.mode==="STEP" || writeHeld)) {
      extra.effects[step]=effect || 16;persistSoon();
    }
    for (var i = 0; i < TOTAL_SLOTS; i++) {
      var v = pat.lanes[i][step];
      if (v >= 0) {
        var original = tweaks[i], lock = extra && extra.locks[i+":"+step];
        if (lock) tweaks[i] = Object.assign({},original,lock);
        var detail=extra && extra.steps && extra.steps[i+":"+step];
        var retrigs=i>=8 && detail ? (detail.retrigs || 1) : 1;
        for(var hit=0;hit<retrigs;hit++)voice(i + 1,v,when+hit*stepDur()/retrigs,i<8 && detail && detail.length ? detail.length*stepDur() : (hit<retrigs-1 ? stepDur()/retrigs : undefined),effect);
        tweaks[i] = original;
      }
    }
    seq.totalSteps++;
    seq.lastStepIdx = step;
    seq.lastStepTime = when;
    if (exporting) exportSteps++;
  }

  function scheduler() {
    if (!ac || !seq.playing) return;
    var now = ac.currentTime;
    if (seq.nextTime < now) seq.nextTime = now + 0.02;
    var guard = 0;
    while (seq.nextTime < now + 0.12 && guard++ < 64) {
      // an export stops scheduling once its 64 steps are in; the recorder
      // then runs to the end of the last bar and closes the file
      if (exporting && exportSteps >= EXPORT_BARS * STEPS) break;
      var t = seq.nextTime;
      var s = seq.schedStep;
      var effect=effectAt(s);if(effect===16)effect=0;
      if(effect===14 && scheduledEffect!==14){s=0;seq.schedStep=0;}
      var at = effect===13 ? t+(window.PO33FX.quantizeStep(s)-s)*stepDur() : ((s % 2 === 1) ? t + stepDur() * SWING : t);
      fireStep(s, at,effect);
      visQueue.push({ t: at, s: s, pattern: seq.pattern });
      seq.schedStep++;
      seq.nextTime += stepDur();
      if (seq.schedStep >= STEPS) {
        seq.schedStep = 0;
        if (patternChain.length > 1 && !patternHeld) {
          chainPosition = (chainPosition + 1) % patternChain.length;
          seq.pattern = patternChain[chainPosition];applyPatternTempo(seq.pattern);paint();
        }
        if (seq.queued) {
          seq.pattern = seq.queued;
          seq.queued = 0;
          applyPatternTempo(seq.pattern);
          paint();
        }
      }
    }
  }

  function startSeq() {
    if (seq.playing) return;
    var c = ctx();
    seq.playing = true;
    clearFxTimers();transportGeneration++;scheduledEffect=0;
    seq.visualPattern = seq.pattern;
    seq.visualStarted = false;
    seq.schedStep = 0;
    seq.step = 0;
    seq.totalSteps = 0;
    visQueue = [];
    seq.nextTime = c.currentTime + 0.06;
    fxInstall(); // keep the FX history warm
    // Write mode stays active while the transport runs.
    seq.timer = setInterval(scheduler, 20);
    startShakeSensors(); startTransportAnimation();
    persistSoon();
    paint();
  }

  function stopSeq() {
    if (!seq.playing) return;
    seq.playing = false;
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
    if (seq.playing) { stopSeq(); return; }
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
    }
    if (lit >= 0 && (!seq.visualStarted || lit !== seq.step || audiblePattern !== seq.visualPattern)) {
      seq.step = lit;
      seq.visualPattern = audiblePattern;
      seq.visualStarted = true;
      paintChase();
      mascotPunch(lit);
    }
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
      applyPatternTempo(n);
      flashHint("PATTERN " + n);
    }
    persistSoon();
    paint();
  }

  function copyPatternTo(n) {
    if (n < 1 || n > PATTERNS) return;
    patterns[n - 1] = clonePattern(patterns[seq.pattern - 1]);
    patternSettings[n-1]=patternSettings[seq.pattern-1] ? Object.assign({},patternSettings[seq.pattern-1]) : null;
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
      var original=tweaks[state.slot-1];
      if(defaultStep && defaultStep.slot===state.slot) {
        var ex=patternExtras[seq.pattern-1],key=(state.slot-1)+":"+n;
        if(!ex.steps)ex.steps={};
        ex.steps[key]=JSON.parse(JSON.stringify(defaultStep.detail));
        ex.locks[key]=JSON.parse(JSON.stringify(defaultStep.lock));
        tweaks[state.slot-1]=Object.assign({},original,defaultStep.lock);
      }
      voice(state.slot, lastNote,undefined,defaultStep && defaultStep.slot===state.slot && state.slot<=8 ? defaultStep.detail.length*stepDur() : undefined);
      tweaks[state.slot-1]=original;
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
      defaultStep={slot:e.slot,detail:JSON.parse(JSON.stringify(editDetail(e))),lock:JSON.parse(JSON.stringify(ex.locks[key] || tweaks[e.slot-1]))};
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
    var off=v.duration*t.start/100;
    return {buffer:v.buffer,offset:(v.offset || 0)+off,duration:Math.max(.00001,(v.duration-off)*t.length/100),trim:0,pitch:0};
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

  var rec = {
    on: false,
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

  function ensureMic() {
    if (micReady()) return Promise.resolve(true);
    if (mic.pending) return mic.pending;
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      mic.error = "NO MIC";
      return Promise.resolve(false);
    }
    var c = ctx();
    mic.pending = md
      .getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
      .then(function (stream) {
        if(resetBusy || resetFailure){stream.getTracks().forEach(function(track){track.stop();});return false;}
        mic.stream = stream;
        mic.node = c.createMediaStreamSource(stream);
        mic.proc = c.createScriptProcessor(4096, 1, 1);
        mic.proc.onaudioprocess = onAudio;
        mic.silent = c.createGain();
        mic.silent.gain.value = 0;
        mic.node.connect(mic.proc);
        mic.proc.connect(mic.silent);
        mic.silent.connect(c.destination);
        mic.error = null;
        mic.pending = null;
        return true;
      })
      ["catch"](function (err) {
        mic.pending = null;
        mic.error = "MIC DENIED";
        return false;
      });
    return mic.pending;
  }

  function onAudio(e) {
    var incoming = e.inputBuffer.getChannelData(0), peak = 0;
    for (var mi=0;mi<incoming.length;mi++) peak = Math.max(peak,Math.abs(incoming[mi]));
    inputLevel = peak;
    if (!rec.on) return;
    var data = e.inputBuffer.getChannelData(0);
    var room = rec.maxFrames - rec.frames;
    if (room <= 0) {
      finishRec();
      return;
    }
    var take = Math.min(room, data.length);
    var copy = new Float32Array(take);
    for (var i = 0; i < take; i++) copy[i] = data[i];
    rec.chunks.push(copy);
    rec.frames += take;
    if (rec.frames >= rec.maxFrames) finishRec();
  }

  function startRec(slotNum) {
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

    rec.on = true;
    rec.slot = slotNum;
    rec.start = c.currentTime;
    rec.limit = avail;
    rec.chunks = [];
    rec.frames = 0;
    rec.maxFrames = Math.floor(avail * c.sampleRate);
    document.body.classList.add("recording");
    pads[slotNum - 1].classList.add("rec-target");
    rec.timer = setInterval(tickRec, 50);
    paint();
  }

  function tickRec() {
    if (!rec.on) return;
    if (recElapsed() >= rec.limit) { finishRec(); return; }
    elMem.textContent = memLeft().toFixed(1) + "s";
    elHint.textContent = "REC " + recElapsed().toFixed(1) + "s";
  }

  function finishRec() {
    if (!rec.on) return;
    var elapsed = recElapsed();
    rec.on = false;
    if (rec.timer) { clearInterval(rec.timer); rec.timer = null; }
    document.body.classList.remove("recording");

    var slotNum = rec.slot;
    if (pads[slotNum - 1]) pads[slotNum - 1].classList.remove("rec-target");

    var c = ctx();
    var rate = c.sampleRate;
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

    var peak = 0;
    for (i = 0; i < data.length; i++) {
      var a = data[i] < 0 ? -data[i] : data[i];
      if (a > peak) peak = a;
    }
    if (peak > 0.0001) {
      var gain = Math.min(8, 0.9 / peak);
      for (i = 0; i < data.length; i++) data[i] *= gain;
    }

    var buf = c.createBuffer(1, data.length, rate);
    if (buf.copyToChannel) buf.copyToChannel(data, 0);
    else buf.getChannelData(0).set(data);

    samples[slotNum - 1] = {
      buffer: buf,
      duration: data.length / rate,
      trim: pendingTrim[slotNum - 1] || 0,
      pitch: pendingPitch[slotNum - 1] || 0
    };
    rec.replacing = null;
    state.slot = slotNum;
    paint();
    flash(slotNum - 1);
    saveSlot(slotNum); // into the r1's storage, so it is here after a restart
  }

  function setRecHeld(v) {
    v=!!(v || sideRecArmed || sideRecHeld);
    if (recHeld === v) return;
    recHeld = v;
    if(!v)pendingRecSlot=0;
    if (v) { recUsedPad = false; recPressedAt = Date.now(); }
    if (!v && rec.on) finishRec();
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
      var lampRect = [[26.0, 86.93499755859375, 38.0, 88.93499755859375], [69.81120300292969, 86.93499755859375, 81.81120300292969, 88.93499755859375], [113.5696029663086, 86.93499755859375, 125.5696029663086, 88.93499755859375], [157.3332061767578, 86.93499755859375, 169.3332061767578, 88.93499755859375], [26.0, 136.4696044921875, 38.0, 138.4696044921875], [69.81120300292969, 136.4696044921875, 81.81120300292969, 138.4696044921875], [113.5696029663086, 136.4696044921875, 125.5696029663086, 138.4696044921875], [157.3332061767578, 136.4696044921875, 169.3332061767578, 138.4696044921875], [26.0, 186.23049926757812, 38.0, 188.23049926757812], [69.81120300292969, 186.23049926757812, 81.81120300292969, 188.23049926757812], [113.5696029663086, 186.23049926757812, 125.5696029663086, 188.23049926757812], [157.3332061767578, 186.23049926757812, 169.3332061767578, 188.23049926757812], [26.0, 235.9929962158203, 38.0, 237.9929962158203], [69.81120300292969, 235.9929962158203, 81.81120300292969, 237.9929962158203], [113.5696029663086, 235.9929962158203, 125.5696029663086, 237.9929962158203], [157.3332061767578, 235.9929962158203, 169.3332061767578, 237.9929962158203]][i];
      var px=32.2+(i%4)*43.8, py=102.6+Math.floor(i/4)*49.8;
      led.style.left=((lampRect[0]-(px-19))/38*100)+"%";
      led.style.top=((lampRect[1]-(py-19))/46*100)+"%";
      led.style.width="31.578947%";led.style.height="4.347826%";
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

  function hintText() {
    if(resetBusy)return "RESTORING FACTORY PRESETS";
    if(resetFailure)return "RESET FAILED - HOLD HEAD TO RETRY";
    if (exporting) {
      var bar = Math.min(EXPORT_BARS, 1 + Math.floor(expFrames / (expPerBar || 1)));
      return "REC BEAT: BAR " + bar + "/" + EXPORT_BARS;
    }
    if (fx.kind) return "FX: " + FX_NAMES[fx.kind];
    if (rec.on) return "REC " + recElapsed().toFixed(1) + "s";
    if (mic.error) return mic.error;
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
    var stepView = state.mode === "STEP" || seq.playing;
    d.getElementById("panel").style.setProperty("--led-pulse", Math.min(110,stepDur()*700)+"ms");
    for(var p=0;p<pads.length;p++) {
      pads[p].classList.toggle("step-edit",!!(stepEdit && stepEdit.used && stepEdit.slot===state.slot && stepEdit.step===p));
      var level="off", reason="empty";
      if(bpmHeld) { if(p<masterVolume){level="dim";reason="volume";} }
      else if(state.mode==="SOUND") {
        if(samples[p]){level="dim";reason="sample";}
        if(p+1===state.slot){level="bright";reason="selected";}
      } else if(state.mode==="PATTERN") {
        if(patternHasData(patterns[p])){level="dim";reason="pattern";}
        if(p+1===patternNumber){level="bright";reason="selected";}
        else if(p+1===seq.queued){level="dim";reason="queued";}
      } else if(fxHeld || shakeFx) {
        if(p+1===fx.kind){level="bright";reason="effect";}
      } else if(stepView) {
        if(lane[p]>=0){level="dim";reason="own-step";}
        else {
          for(var track=0;track<TOTAL_SLOTS;track++) {
            if(track!==state.slot-1 && pat.lanes[track][p]>=0){level="low";reason="other-step";break;}
          }
        }
        if(seq.playing && seq.visualStarted && p===seq.step){level="bright";reason=p===0?"downbeat":"cursor";}
      } else if(samples[p]) {level="dim";reason="sample";}
      if(rec.on && p+1===rec.slot){level="bright";reason="recording";}
      pads[p].setAttribute("data-led-level",level);
      pads[p].setAttribute("data-led-reason",reason);
      pads[p].setAttribute("data-led-pattern",String(patternNumber));
    }
  }

  function paint() {
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
    paintStepLeds();
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
        if (patternSelection.length<128) patternSelection.push(n);
        if(patternSelection.length===1) selectPattern(n);
      }
      paint(); return;
    }
    if (fxHeld && seq.playing) {
      fxPadPointer=pid(e);
      modifierUsed.fx=true;
      if(n===16){fxRelease();showNumber("00","FX");}else fxEngage(n);
      if(state.mode==="STEP" || writeHeld) { if(n===16)patternExtras[seq.pattern-1].effects=[];else patternExtras[seq.pattern-1].effects[seq.step]=n; persistSoon(); }
      paint(); return;
    }
    if (recHeld) {recUsedPad=true; startRec(n); return; }
    if (soundHeld || state.mode==="SOUND") { selectSlot(n); lastNote=lastNotes[n-1]; lastWasSlice=false; defaultStep=null; paint(); return; }
    if (writeHeld && seq.playing) { modifierUsed.write=true; liveRecord(n-1); return; }
    if (state.mode === "STEP") {
      if(patterns[seq.pattern-1].lanes[state.slot-1][n-1]>=0)beginStepEdit(n-1);
      else toggleStep(n - 1);
      return;
    }
    trigger(n - 1);
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

  function onCtlDown(e) {
    var btn=e.target.closest ? e.target.closest(".cbtn") : null;
    if(!btn) return; e.preventDefault(); lastPointer=Date.now();
    var act=btn.getAttribute("data-act");
    if(stepEdit && ["sound","pattern","write","fx","rec"].indexOf(act)>=0)endStepEdit(true);
    modifierPointers[act]=pid(e); modifierUsed[act]=false;
    if(writeHeld && soundHeld && (act==="play" || act==="rec")){
      modifierUsed.write=true;stopSeq();
      var now=ctx().currentTime;sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});
      ctx().suspend();window.open("./backup.html#"+(act==="play"?"replay":"receive"),"po33-hardware-backup");return;
    }
    if(act==="rec") { recPointer=pid(e); setRecHeld(true); ensureMic(); return; }
    if(act==="play") { togglePlay(); return; }
    if(act==="write") { writeHeld=true; return; }
    if(act==="fx") { clearFxTimers();transportGeneration++;cancelShakeFx();fxHeld=true;return; }
    if(act==="sound") {
      if(recHeld) { recUsedPad=true; deleteSlot(state.slot); return; }
      soundHeld=true; previousMode=state.mode; setMode("SOUND"); return;
    }
    if(act==="pattern") {
      if(recHeld) {recUsedPad=true; clearPattern(seq.pattern); patternExtras[seq.pattern-1]={effects:[],locks:{}}; persistSoon();return;}
      patternHeld=true; patternUsedPad=false; patternSelection=[];
      previousMode=state.mode; setMode("PATTERN"); return;
    }
    paint();
  }
  ctl.addEventListener("pointerdown",onCtlDown);
  function releaseControls(e) {
    if(stepEdit && stepEdit.pointer===pid(e))endStepEdit(e.type==="pointercancel");
    if(fxPadPointer!==undefined && pid(e)===fxPadPointer){fxPadPointer=undefined;if(fxHeld)fxRelease();}
    if(padPointer!==undefined && pid(e)===padPointer) {
      padPointer=undefined; heldPad=0;
    }
    Object.keys(modifierPointers).forEach(function(act){
      if(modifierPointers[act]!==pid(e))return;
      delete modifierPointers[act];
      if((act==="sound" || act==="write") && pendingCopy)commitSoundCopy(e.type==="pointercancel");
      if(act==="bpm") {
        if(!modifierUsed.bpm && e.type!=="pointercancel") {var tempos=[80,120,140],idx=tempos.indexOf(params.bpm);params.bpm=tempos[(idx+1)%3];}
        bpmHeld=false;savePatternTempo();persistSoon();
      }
      if(act==="rec") { recPointer=undefined;setRecHeld(false); }
      if(act==="write") { writeHeld=false;if(!modifierUsed.write && e.type!=="pointercancel")setMode(state.mode==="STEP"?"PLAY":"STEP"); }
      if(act==="fx") {
        fxHeld=false;fxPadPointer=undefined;fxRelease();scheduledEffect=-1;
        if(!modifierUsed.fx && e.type!=="pointercancel") {
          tweakMode=(tweakMode+1)%3; parameterDisplay=true;
          showNumber(["ton","FLt","tri"][tweakMode],["TONE","FILTER","TRIM"][tweakMode]);
        }
      }
      if(act==="sound") {soundHeld=false;if(state.mode==="SOUND")setMode(previousMode==="STEP"?"STEP":"PLAY");}
      if(act==="pattern") {
        patternHeld=false;
        if(patternSelection.length) {patternChain=patternSelection.slice();chainPosition=0;persistSoon();}
        if(state.mode==="PATTERN")setMode(previousMode==="STEP"?"STEP":"PLAY");
      }
    });
    paint();
  }
  window.addEventListener("pointerup",releaseControls);
  window.addEventListener("pointercancel",releaseControls);
  window.addEventListener("blur",function(){
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
    if(Date.now()-lastPointer<600 || !e.target.closest(".cbtn"))return;
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
  d.addEventListener("visibilitychange",function(){if(d.hidden)releaseShiftHolds(true);});

  // stop long-press selection / context menus anywhere in the app
  d.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  d.addEventListener("selectstart", function (e) { e.preventDefault(); });

  // ---------- hardware ----------
  function onSide() {
    if(sideRecHeld || Date.now()<sideClickIgnoreUntil)return;
    togglePlay();
    try{if(navigator.vibrate)navigator.vibrate(12);}catch(err){}
  }
  window.addEventListener("sideClick",onSide);
  window.addEventListener("longPressStart",function(){
    sideRecArmed=false;sideRecHeld=true;setRecHeld(true);ensureMic();
  });
  window.addEventListener("longPressEnd",function(){
    sideRecHeld=false;sideClickIgnoreUntil=Date.now()+300;
    setRecHeld(sideRecArmed || modifierPointers.rec!==undefined);
  });
  function wheelAdjust(dir) {
    if(stepEdit){adjustKnob(0,dir);return;}
    parameterDisplay=false;
    params.bpm=Math.max(60,Math.min(240,params.bpm+dir));
    savePatternTempo();
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
    if(state.mode==="SOUND"){label="SOUND / NOTE";number=String(state.slot).padStart(2,"0")+String(lastNote+1).padStart(2,"0");}
    if(state.mode==="PATTERN"){label="PATTERN";number=String(seq.pattern);}
    if(state.mode==="STEP")label="WRITE";
    if(displayValue && Date.now()<displayUntil && (state.mode!=="SOUND" || displayValue.label==="FREE SEC" || displayValue.label==="APP REV")){label=displayValue.label;number=String(displayValue.value);}
    if(rec.on){label="REC";number=String(Math.max(0,Math.ceil(memLeft()))).padStart(2,"0");}
    else if(recHeld){label=mic.error || "REC READY";number=mic.error?"err":"rEC";}
    if(writeHeld && (soundHeld||patternHeld)){label="COPY";number="CPy";}
    if(recHeld && (modifierPointers.sound!==undefined||modifierPointers.pattern!==undefined)){label="DELETE";number="dEL";}
    if((fxHeld || shakeFx) && fx.kind){label="FX";number=String(fx.kind).padStart(2,"0");}
    if(resetBusy || resetFailure || Date.now()<resetUntil){label=resetFailure?"RESET ERROR":"RESET";number=resetFailure?"err":"RST";}
    d.getElementById("lcdMode").textContent=label;
    d.getElementById("lcdRecord").querySelector("rect").setAttribute("fill",(state.mode==="STEP" || writeHeld || ((soundHeld||patternHeld)&&previousMode==="STEP"))?"#fff":"#222");
    d.getElementById("lcdPlay").setAttribute("fill",seq.playing?"#fff":"#222");
    if(target.getAttribute("data-value")!==number){
      target.textContent=number;
      target.setAttribute("data-value",number);target.setAttribute("aria-label",number);
    }
    var level=0;
    var inputActive=!!((recHeld||rec.on) && micReady());
    if(inputActive)level=inputLevel;
    else if(outputMeter && outputData){outputMeter.getFloatTimeDomainData(outputData);for(var ai=0;ai<outputData.length;ai++)level=Math.max(level,Math.abs(outputData[ai]));}
    if(!inputActive && level>.003)outputActiveUntil=Date.now()+110;
    [["lcdIn",inputActive],["lcdOut",!inputActive && Date.now()<outputActiveUntil]].forEach(function(pair){
      var g=d.getElementById(pair[0]);g.setAttribute("data-active",pair[1]?"true":"false");
      g.querySelector("rect").setAttribute("fill",pair[1]?"#fff":"#222");
      g.querySelector("text").setAttribute("fill",pair[1]?"#000":"#888");
    });
    if(!lcdIndicator)lcdIndicator=window.PO33Indicator.create(d.getElementById("lcdMeter"),{mode:"level",value:0},{x:19,y:24.25});
    lcdIndicator.setProps(indicatorProps(level,inputActive));
  }
  function indicatorProps(level,inputActive) {
    var meter={mode:"level",origin:seq.playing && !inputActive?"center":"left",value:Math.ceil(Math.min(1,level*1.5)*32)};
    if(inputActive || fx.kind)return meter;
    if(bpmHeld)return {mode:"level",origin:"left",value:masterVolume*2};
    if(stepEdit && stepEdit.used)return {mode:"pitch",pitch:tweaks[stepEdit.slot-1].pitch+patterns[stepEdit.pattern-1].lanes[stepEdit.slot-1][stepEdit.step]};
    if(!parameterDisplay)return meter;
    if(tweakMode===0)return {mode:"pitch",pitch:tweaks[state.slot-1].pitch};
    if(tweakMode===2) {
      var t=selectedTweak(state.slot,lastNote),sample=samples[state.slot-1];
      if(!sample || (sample.sliceViews && !sample.sliceViews[lastNote]))return {mode:"trim",start:0,length:0};
      // Native drum trim refers to one slice in the entire take. Melodic/copied
      // slices use a local region and store length as a fraction of the remainder.
      if(state.slot>8 && !sample.sliceViews)return {mode:"trim",start:(lastNote+t.start/100)*100/16,length:t.length/16};
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
    var t=tweaks[state.slot-1], sl=selectedTweak(state.slot,lastNote);
    if(tweakMode===0) return index===0 ? [t.pitch,-12,12,"PITCH"] : [t.volume,0,100,"VOL"];
    if(tweakMode===1) return index===0 ? [t.filter,-100,100,"FILTER"] : [t.resonance,0,100,"RES"];
    return index===0 ? [sl.start,0,90,"START"] : [sl.length,1,100,"LENGTH"];
  }
  function updateKnobVisuals() {
    ["knobA","knobB"].forEach(function(id,i){
      d.getElementById(id).style.setProperty("--knob-angle",knobAngles[i]+"deg");
    });
  }
  function adjustKnob(index,dir) {
    if(stepEdit) {
      var e=stepEdit,detail=editDetail(e),lane=patterns[e.pattern-1].lanes[e.slot-1],before=knobSpec(index);
      if(stepCopyTimer)clearTimeout(stepCopyTimer);stepCopyTimer=null;
      e.used=true;
      if(index===0)lane[e.step]=Math.max(0,Math.min(15,lane[e.step]+dir));
      else if(e.slot<=8)detail.length=Math.max(1,Math.min(16,detail.length+dir));
      else {var counts=[1,2,3,4,6,8],at=counts.indexOf(detail.retrigs);detail.retrigs=counts[Math.max(0,Math.min(5,at+dir))];}
      var after=knobSpec(index);knobAngles[index]=Math.max(-140,Math.min(140,knobAngles[index]+(after[0]-before[0])/(after[2]-after[1])*KNOB_SWEEP));
      writePattern(e.pattern);showNumber(index===0?lane[e.step]+1:(e.slot<=8?detail.length:detail.retrigs),knobSpec(index)[3]);
      if(!seq.playing)voice(e.slot,lane[e.step],undefined,e.slot<=8?detail.length*stepDur():undefined);
      paint();return;
    }
    if(recHeld && tweakMode!==2) {
      var reset=tweaks[state.slot-1],key=tweakMode===0?(index===0?"pitch":"volume"):(index===0?"filter":"resonance");
      reset[key]=key==="volume"?100:0;recUsedPad=true;persistSoon();showNumber(reset[key],"RESET");paint();return;
    }
    var spec=knobSpec(index), t=tweaks[state.slot-1], sl=selectedTweak(state.slot,lastNote);
    var value=Math.max(spec[1],Math.min(spec[2],spec[0]+dir));
    knobAngles[index]=Math.max(-140,Math.min(140,knobAngles[index]+(value-spec[0])/(spec[2]-spec[1])*280));
    if(bpmHeld) {modifierUsed.bpm=true;if(index===0)SWING=value/100;else params.bpm=value;savePatternTempo();}
    else if(tweakMode===0) { if(index===0)t.pitch=value;else t.volume=value; }
    else if(tweakMode===1) {if(index===0)t.filter=value;else t.resonance=value;}
    else {if(index===0)sl.start=value;else sl.length=value;}
    if(!bpmHeld && writeHeld && seq.playing && tweakMode!==2) {
      modifierUsed.write=true;patternExtras[seq.pattern-1].locks[(state.slot-1)+":"+seq.step]=Object.assign({},t);
    }
    if(!bpmHeld)parameterDisplay=true;
    var code=(!bpmHeld && tweakMode===1 && index===0)?(value<0?"LPF":value>0?"HPF":"noF"):Math.round(value);
    showNumber(code,spec[3]);persistSoon();paint();
  }
  d.getElementById("bpmMode").addEventListener("pointerdown",function(e){
    if(soundHeld && !writeHeld) {
      e.preventDefault();systemInfoPage=(systemInfoPage+1)%2;
      showNumber(systemInfoPage===1?Math.floor(memLeft()):APP_REVISION,systemInfoPage===1?"FREE SEC":"APP REV");
      paint();return;
    }
    if(stepEdit && stepEdit.slot>8) {
      e.preventDefault();var counts=[1,2,3,4,6,8],detail=editDetail(stepEdit);
      if(stepCopyTimer)clearTimeout(stepCopyTimer);stepCopyTimer=null;
      stepEdit.used=true;detail.retrigs=counts[(counts.indexOf(detail.retrigs)+1)%counts.length];
      showNumber(detail.retrigs,"RETRIG");persistSoon();paint();return;
    }
    e.preventDefault();parameterDisplay=false;bpmHeld=true;modifierPointers.bpm=pid(e);modifierUsed.bpm=false;paint();
  });
  ["knobA","knobB"].forEach(function(id,index){
    var knob=d.getElementById(id), active=false,lastY=0;
    knob.addEventListener("pointerdown",function(e){e.preventDefault();active=true;lastY=e.clientY;knob.setPointerCapture(e.pointerId);});
    knob.addEventListener("pointermove",function(e){
      if(!active)return;
      var scale=d.getElementById("panel").getBoundingClientRect().width/240,delta=(lastY-e.clientY)/scale;
      var steps=Math.floor(Math.abs(delta)/2),dir=delta>0?1:-1;
      if(steps){for(var k=0;k<steps;k++)adjustKnob(index,dir);lastY-=dir*steps*2*scale;}
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
      var position=(seq.lastStepIdx||0)+(ctx().currentTime-(seq.lastStepTime||seq.nextTime))/stepDur();
      var phase=position/4*Math.PI*2, swing=Math.sin(phase), bob=Math.abs(Math.sin(phase));
      d.getElementById("tapeHead").setAttribute("transform","translate("+(swing*.55)+" "+(-bob*.65)+") rotate("+(swing*3)+" 120.5 11)");
      d.getElementById("tapeLeft").setAttribute("transform","translate("+(-Math.max(0,swing)*1.3)+" "+(-Math.max(0,swing)*.7)+")");
      d.getElementById("tapeRight").setAttribute("transform","translate("+(Math.max(0,-swing)*1.3)+" "+(-Math.max(0,-swing)*.7)+")");
    }
    transportFrame=requestAnimationFrame(frame);
  }

  // desktop test helpers: arrows = wheel, space = side button, R = hold REC,
  // P = hold PATTERN, F = FX, E = export, Enter = PLAY
  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.code === "Space" || e.key === " ") { e.preventDefault(); sideRecHeld=true;setRecHeld(true);ensureMic(); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); setRecHeld(true); ensureMic(); }
    else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (!patternHeld) { patternHeld = true; patternUsedPad = false; patternPressedAt = Date.now() - 1000; paint(); }
    } else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleMode("fx"); }
    else if (e.key === "e" || e.key === "E") { e.preventDefault(); if (!exporting) { exportArmed = !exportArmed; paint(); } }
    else if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); wheelAdjust(1); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); wheelAdjust(-1); }
  });
  window.addEventListener("keyup", function (e) {
    if(e.code==="Space" || e.key===" "){e.preventDefault();sideRecHeld=false;setRecHeld(modifierPointers.rec!==undefined);}
    if (e.key === "r" || e.key === "R") { e.preventDefault(); setRecHeld(false); }
    if (e.key === "p" || e.key === "P") { e.preventDefault(); patternHeld = false; paint(); }
  });

  d.addEventListener("pointerdown", function () { try { ctx(); } catch (err) {} }, true);

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
    for(var k=0;k<keys.length;k++){
      if(!(await callStore(store,"remove",keys[k])).ok)throw new Error("reset storage failed");
    }
  }
  async function factoryReset(recover){
    if(resetBusy)return;
    resetBusy=true;resetFailure=false;persistPaused=true;cancelResetHold();
    d.body.setAttribute("data-resetting","true");paint();
    try{
      if(!recover && startupRestore)await startupRestore;
      persistPaused=true;
      if(metaTimer){clearTimeout(metaTimer);metaTimer=null;}
      saveQueue=[];saveQueued={};
      endStepEdit(true);pendingCopy=null;pendingRecSlot=0;
      sideRecArmed=sideRecHeld=recHeld=false;
      rec.on=false;rec.chunks=[];rec.replacing=null;
      if(rec.timer){clearInterval(rec.timer);rec.timer=null;}
      d.body.classList.remove("recording");
      if(mic.stream)mic.stream.getTracks().forEach(function(t){t.stop();});
      [mic.node,mic.proc,mic.silent].forEach(function(node){if(node){try{node.disconnect();}catch(err){}}});
      stopSeq();stopShakeSensors();cancelShakeFx();stopTransportAnimation();clearFxTimers();transportGeneration++;
      var now=ctx().currentTime;sampleVoices.slice().forEach(function(v){cancelVoice(v,now);});
      // Let an already dispatched storage write finish before removing its key.
      while(saveRunning)await new Promise(function(resolve){setTimeout(resolve,20);});
      store=store || storageCandidate();if(!store)throw new Error("storage unavailable");
      if(!recover && !(await callStore(store,"set",PK.reset,"1")).ok)throw new Error("reset marker failed");
      await clearSamplerStorage();
      if(recover){
        if(!(await callStore(store,"remove",PK.reset)).ok)throw new Error("reset marker failed");
        resetBusy=false;persistPaused=false;
        resetUntil=Date.now()+1500;d.body.removeAttribute("data-resetting");
        await restoreAll();resetUntil=Date.now()+1500;paint();
      } else {
        // A fresh document also discards audio buffers, microphone state and FX history.
        await new Promise(function(resolve){setTimeout(resolve,700);});
        window.location.reload();
      }
    }catch(err){
      resetBusy=false;resetFailure=true;persistPaused=true;
      d.body.removeAttribute("data-resetting");paint();
    }
  }

  // ---------- startup: restore what was stored, then keep writing ----------
  function flushOnHide() {
    if (rec.on) finishRec();
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
    var marker=await callStore(store,"get",PK.reset);
    if(marker.ok && marker.value)await factoryReset(true);
    else await restoreAll();
  }
  if (store && !ac) {
    // nothing has needed audio yet: open the context without a sound, so the
    // takes come back by themselves
    try { ctx(); } catch (err) { /* the first tap opens it instead */ }
  }
  startupRestore=startRestore();
})();
