/** Translate the existing web engine into hardware state, preserving untouched native fields. */
import { compileProject, emptyProject } from "../../decoder/vendor/so-sample/project.js";
import { cloneState } from "../../decoder/vendor/so-sample/state.js";
import { emptyPattern, writeCell, readCell, writeEffects } from "../../decoder/vendor/so-sample/pattern.js";
import { encodeMulaw, SAMPLE_RATE } from "../../decoder/vendor/so-sample/mulaw.js";
import { toNativeRate } from "../../decoder/vendor/so-sample/resample.js";
import { writeTempo, writeSwing, writeChain } from "../../decoder/vendor/so-sample/globals.js";
import { EMPTY_GLOBALS } from "./po33Template.js";
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Math.round(x)));
export function buildHardwareProject(snapshot, native, baseline) {
    if (snapshot.slots.length !== 16 || snapshot.patterns.length !== 16 || snapshot.tweaks.length !== 16)
        throw Error('Invalid web project shape');
    const warnings = [];
    const template = native ? cloneState(native.raw.state) : {
        globals: EMPTY_GLOBALS.map(g => Uint8Array.from(g)), patterns: Array.from({ length: 16 }, emptyPattern), sounds: Array(136).fill(null)
    };
    const model = emptyProject(snapshot.bpm), codes = new Map();
    model.chain = snapshot.chain.length ? snapshot.chain : [snapshot.pattern];
    model.swing = native && baseline && snapshot.swing === baseline.swing ? native.meta.swingRaw : clamp(snapshot.swing * 18, 0, 18);
    const sampleKey = (s) => ({ slots: s.slots, assets: s.assets.map(a => [a.id, a.rate, a.data.length]), trim: s.tweaks.map(t => [t.start, t.length, t.slices]) });
    const unchangedSamples = !!(native && baseline && equal(sampleKey(snapshot), sampleKey(baseline)));
    const resolve = (id) => {
        let c = codes.get(id);
        if (c)
            return c;
        const a = snapshot.assets.find(a => a.id === id);
        if (!a)
            throw Error('Missing sample asset ' + id);
        if (a.data.length / a.rate > 43 || !a.data.every(Number.isFinite))
            throw Error('Invalid sample asset');
        const pcm = a.rate === SAMPLE_RATE ? Float64Array.from(a.data) : toNativeRate(a.data, a.rate);
        for (let i = 0; i < pcm.length; i++)
            pcm[i] = Math.max(-1, Math.min(1, pcm[i]));
        c = encodeMulaw(pcm);
        codes.set(id, c);
        return c;
    };
    const clip = (v, start = 0, length = 100) => {
        if (!v)
            return null;
        const total = resolve(v.asset).length;
        const first = Math.round((v.offset + v.duration * start / 100) * SAMPLE_RATE);
        const end = Math.round((v.offset + v.duration * (start / 100 + (1 - start / 100) * length / 100)) * SAMPLE_RATE);
        if (first < 0 || first >= total || end <= first)
            return null;
        return { sampleId: v.asset, start: first, end: Math.min(total, end) };
    };
    if (!unchangedSamples)
        snapshot.slots.forEach((slot, i) => {
            if (!slot)
                return;
            const t = snapshot.tweaks[i];
            if (i < 8)
                model.melodic[i] = clip(slot, t.start, t.length);
            else
                model.drums[i - 8] = { slices: Array.from({ length: 16 }, (_, k) => {
                        const trim = t.slices[k] || { start: 0, length: 100 };
                        return clip(slot.slices ? slot.slices[k] : { asset: slot.asset, offset: slot.offset + slot.duration * k / 16, duration: slot.duration / 16 }, trim.start, trim.length);
                    }) };
        });
    const params = (t) => ({ pitch: clamp((t.pitch || 0) + 13, 1, 25), volume: clamp((t.volume ?? 100) * .36, 1, 63), filter: t.filter ? clamp(32 + t.filter * .31, 1, 63) : 63, resonance: clamp((t.resonance || 0) * .62 + 1, 1, 63) });
    model.patterns = snapshot.patterns.map((p, index) => {
        const raw = native ? native.patterns[index].raw.slice() : emptyPattern();
        const extra = snapshot.extras[index], prev = baseline?.extras[index];
        const clear = baseline && baseline.patterns[index].lanes.some(l => l.some(n => n >= 0)) && !p.lanes.some(l => l.some(n => n >= 0)) && !Object.keys(extra.locks).length;
        if (clear)
            raw.fill(0, 0, 1024);
        for (let step = 0; step < 16; step++)
            for (let i = 0; i < 16; i++) {
                const key = i + ':' + step, note = p.lanes[i][step], t = Object.assign({}, snapshot.tweaks[i], extra.locks[key]);
                if (native && baseline && !clear && note === baseline.patterns[index].lanes[i][step] && equal(extra.locks[key], prev?.locks[key]) && equal(extra.steps?.[key], prev?.steps?.[key]) && equal(snapshot.tweaks[i], baseline.tweaks[i]))
                    continue;
                if (note < 0) {
                    writeCell(raw, step + 1, i + 1, null);
                    continue;
                }
                const previous = readCell(raw, step + 1, i + 1);
                const lockChanged = !baseline || !equal(extra.locks[key], prev?.locks[key]) || !equal(snapshot.tweaks[i], baseline.tweaks[i]);
                const detail = extra.steps?.[key], retrigs = detail?.retrigs || 1;
                const timing = i < 8 ? (detail?.length || 15) : retrigs;
                writeCell(raw, step + 1, i + 1, { ...(previous && !lockChanged ? previous : params(t)), key: clamp(note + 1, 1, 16), timing: clamp(timing, 1, 15) });
            }
        if (!native || !baseline || !equal(extra.effects, prev?.effects))
            writeEffects(raw, Array.from({ length: 16 }, (_, k) => { const f = extra.effects[k]; return f > 0 && f < 16 ? f : null; }));
        return raw;
    });
    let state;
    if (unchangedSamples) {
        state = template;
        state.patterns = model.patterns;
        writeTempo(state.globals[1], snapshot.bpm);
        writeSwing(state.globals[1], model.swing);
        writeChain(state.globals[1], model.chain);
    }
    else {
        const total = snapshot.assets.filter(a => snapshot.slots.some(s => s && (s.asset === a.id || s.slices?.some(v => v?.asset === a.id)))).reduce((n, a) => n + a.data.length / a.rate, 0);
        if (total > 40.001 && !native)
            throw Error('Samples exceed the 40-second hardware recording budget');
        state = compileProject(model, resolve, template);
        if (native)
            warnings.push('Sample edits rebuilt pool layout. Unavailable source slices cannot be recreated. Original source frame remains available in the saved checkpoint.');
    }
    if (!native || !baseline || !equal(snapshot.tweaks, baseline.tweaks) || !equal(snapshot.extras.map(e => e.locks), baseline.extras.map(e => e.locks)))
        warnings.push('New web parameter locks use approximate hardware code mappings; filter/level/resonance are not hardware calibrated.');
    return { raw: { state }, warnings };
}
