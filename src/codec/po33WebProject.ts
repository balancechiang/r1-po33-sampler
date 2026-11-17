/** Translate the existing web engine into hardware state, preserving untouched native fields. */
import { compileProject, emptyProject, type Clip } from '../../decoder/vendor/so-sample/project.ts';
import { cloneState, type DeviceState } from '../../decoder/vendor/so-sample/state.ts';
import { emptyPattern, writeCell, readCell, writeEffects } from '../../decoder/vendor/so-sample/pattern.ts';
import { encodeMulaw, SAMPLE_RATE } from '../../decoder/vendor/so-sample/mulaw.ts';
import { toNativeRate } from '../../decoder/vendor/so-sample/resample.ts';
import { writeTempo, writeSwing, writeChain } from '../../decoder/vendor/so-sample/globals.ts';
import { EMPTY_GLOBALS } from './po33Template.ts';
import type { PO33Project } from './po33Codec.ts';
type Tweak = { pitch: number; volume: number; filter: number; resonance: number; start: number; length: number; slices: Record<string, {start:number;length:number}> };
type View = { asset: string; offset: number; duration: number };
type Extra = { effects: number[]; locks: Record<string, Partial<Tweak>>; steps?: Record<string, {length:number;retrigs:number}> };
export interface WebSnapshot {
    bpm: number; swing: number; chain: number[]; pattern: number;
    assets: Array<{id:string;rate:number;data:Float32Array}>;
    slots: Array<(View & {slices?:Array<View|null>})|null>;
    patterns: Array<{lanes:number[][]}>; extras: Extra[]; tweaks: Tweak[];
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (x:number, lo:number, hi:number) => Math.min(hi,Math.max(lo,Math.round(x)));
export function buildHardwareProject(snapshot: WebSnapshot, native?: PO33Project, baseline?: WebSnapshot): {raw:{state:DeviceState};warnings:string[]} {
    if (snapshot.slots.length !== 16 || snapshot.patterns.length !== 16 || snapshot.tweaks.length !== 16) throw Error('Invalid web project shape');
    const warnings: string[] = [];
    const template: DeviceState = native ? cloneState(native.raw.state) : {
        globals: EMPTY_GLOBALS.map(g=>Uint8Array.from(g)), patterns:Array.from({length:16},emptyPattern),sounds:Array(136).fill(null)
    };
    const model=emptyProject(snapshot.bpm), codes=new Map<string,Uint8Array>();
    model.chain=snapshot.chain.length?snapshot.chain:[snapshot.pattern];
    model.swing=native && baseline && snapshot.swing===baseline.swing ? native.meta.swingRaw : clamp(snapshot.swing*18,0,18);
    const sampleKey=(s:WebSnapshot)=>({slots:s.slots,assets:s.assets.map(a=>[a.id,a.rate,a.data.length]),trim:s.tweaks.map(t=>[t.start,t.length,t.slices])});
    const unchangedSamples=!!(native && baseline && equal(sampleKey(snapshot),sampleKey(baseline)));
    const resolve=(id:string):Uint8Array=>{
        let c=codes.get(id);if(c)return c;
        const a=snapshot.assets.find(a=>a.id===id);if(!a)throw Error('Missing sample asset '+id);
        if(a.data.length/a.rate>43 || !a.data.every(Number.isFinite))throw Error('Invalid sample asset');
        const pcm=a.rate===SAMPLE_RATE?Float64Array.from(a.data):toNativeRate(a.data,a.rate);
        for(let i=0;i<pcm.length;i++)pcm[i]=Math.max(-1,Math.min(1,pcm[i]));
        c=encodeMulaw(pcm);codes.set(id,c);return c;
    };
    const clip=(v:View|null, start=0,length=100):Clip|null=>{
        if(!v)return null;
        const total=resolve(v.asset).length;
        const first=Math.round((v.offset+v.duration*start/100)*SAMPLE_RATE);
        const end=Math.round((v.offset+v.duration*(start/100+(1-start/100)*length/100))*SAMPLE_RATE);
        if(first<0 || first>=total || end<=first)return null;
        return {sampleId:v.asset,start:first,end:Math.min(total,end)};
    };
    if(!unchangedSamples)snapshot.slots.forEach((slot,i)=>{
        if(!slot)return;const t=snapshot.tweaks[i];
        if(i<8)model.melodic[i]=clip(slot,t.start,t.length);
        else model.drums[i-8]={slices:Array.from({length:16},(_,k)=>{
            const trim=t.slices[k] || {start:0,length:100};
            return clip(slot.slices?slot.slices[k]:{asset:slot.asset,offset:slot.offset+slot.duration*k/16,duration:slot.duration/16},trim.start,trim.length);
        })};
    });
    const params=(t:Partial<Tweak>)=>({pitch:clamp((t.pitch||0)+13,1,25),volume:clamp((t.volume??100)*.36,1,63),filter:t.filter?clamp(32+t.filter*.31,1,63):63,resonance:clamp((t.resonance||0)*.62+1,1,63)});
    model.patterns=snapshot.patterns.map((p,index)=>{
        const raw=native?native.patterns[index].raw.slice():emptyPattern();
        const extra=snapshot.extras[index],prev=baseline?.extras[index];
        const clear=baseline && baseline.patterns[index].lanes.some(l=>l.some(n=>n>=0)) && !p.lanes.some(l=>l.some(n=>n>=0)) && !Object.keys(extra.locks).length;
        if(clear)raw.fill(0,0,1024);
        for(let step=0;step<16;step++)for(let i=0;i<16;i++){
            const key=i+':'+step,note=p.lanes[i][step],t=Object.assign({},snapshot.tweaks[i],extra.locks[key]);
            if(native && baseline && !clear && note===baseline.patterns[index].lanes[i][step] && equal(extra.locks[key],prev?.locks[key]) && equal(extra.steps?.[key],prev?.steps?.[key]) && equal(snapshot.tweaks[i],baseline.tweaks[i]))continue;
            if(note<0){writeCell(raw,step+1,i+1,null);continue;}
            const previous=readCell(raw,step+1,i+1);
            const lockChanged=!baseline || !equal(extra.locks[key],prev?.locks[key]) || !equal(snapshot.tweaks[i],baseline.tweaks[i]);
            const detail=extra.steps?.[key],retrigs=detail?.retrigs||1;
            const timing=i<8?(detail?.length||15):retrigs;
            writeCell(raw,step+1,i+1,{...(previous && !lockChanged?previous:params(t)),key:clamp(note+1,1,16),timing:clamp(timing,1,15)});
        }
        if(!native || !baseline || !equal(extra.effects,prev?.effects))writeEffects(raw,Array.from({length:16},(_,k)=>{const f=extra.effects[k];return f>0&&f<16?f:null;}));
        return raw;
    });
    let state:DeviceState;
    if(unchangedSamples){state=template;state.patterns=model.patterns;writeTempo(state.globals[1],snapshot.bpm);writeSwing(state.globals[1],model.swing);writeChain(state.globals[1],model.chain);}
    else {
        const total=snapshot.assets.filter(a=>snapshot.slots.some(s=>s && (s.asset===a.id || s.slices?.some(v=>v?.asset===a.id)))).reduce((n,a)=>n+a.data.length/a.rate,0);
        if(total>40.001 && !native)throw Error('Samples exceed the 40-second hardware recording budget');
        state=compileProject(model,resolve,template);
        if(native)warnings.push('Sample edits rebuilt pool layout. Unavailable source slices cannot be recreated. Original source frame remains available in the saved checkpoint.');
    }
    if(!native || !baseline || !equal(snapshot.tweaks,baseline.tweaks) || !equal(snapshot.extras.map(e=>e.locks),baseline.extras.map(e=>e.locks)))warnings.push('New web parameter locks use approximate hardware code mappings; filter/level/resonance are not hardware calibrated.');
    return {raw:{state},warnings};
}
