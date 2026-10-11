// The automatic mix: it listens to the parts as they play, then sets each one's level, EQ, ducking under the kick and
// compression, and masters the whole to a loudness and a tonal balance, saying why for each change. It only turns knobs:
// every part has its slots ready (prepareMix: an EQ, a ducker, a compressor, all neutral; the master a tone EQ, the glue,
// the limiter and a trim), so nothing is rebuilt and the music never stops. The rules (plan, masterPlan) are pure, so
// they're tested on their own; listen() is the ears (analysers on each part's strip, after its devices, before its fader).
import { BANDS, masking } from './measure.js';
import { TUNE } from '../tuning.js';

const M = () => TUNE.studio.mix;
const AEQ = () => ({type: 'eq', id: 'aeq', bands: [{type: 'hp', f: 20, slope: 12}, {type: 'bell', f: 400, g: 0, q: 1.2}, {type: 'bell', f: 2500, g: 0, q: 1.2}, {type: 'hs', f: 9000, g: 0}]});
const COMP = () => ({type: 'comp', id: 'acomp', thr: -20, ratio: 1, knee: 6, att: .01, rel: .12, gain: 0});
// what each band is, for which part keeps it
const zone = band => ['sub', 'bass', 'low-mid'].includes(band) ? 'low' : ['mid', 'high-mid'].includes(band) ? 'mid' : 'high';

/* ---------- the slots ---------- */
// every part (roles: {track id: role}) gets an EQ first, a ducker on the kick (its own one if it had one) and a compressor;
// the master a tone EQ before its glue, and a trim after its limiter (for comparing at the same loudness)
export function prepareMix(song, roles){
  for (const [id, role] of Object.entries(roles)) {
    const t = song.tracks.find(x => x.id === id); if (!t) continue;
    const mix = t.mix = t.mix || {}, ch = mix.chain = mix.chain || [];
    if (!ch.some(d => d.id === 'aeq')) ch.unshift(AEQ());
    if (role !== 'drums') { const sc = ch.find(d => d.type === 'sc' && /kick/.test(d.src || 'kick'));
      if (sc) sc.id = 'duck'; else ch.push({type: 'sc', id: 'duck', src: 'drums:kick', depth: 0, att: .003, hold: .02, rel: .12}); }
    if (!ch.some(d => d.id === 'acomp')) ch.push(COMP());
  }
  const m = song.master = song.master || {}, ch = m.chain = m.chain || [];
  if (!ch.some(d => d.type === 'limiter')) ch.push({type: 'limiter', gain: 0, ceil: -1});
  if (!ch.some(d => d.id === 'glue')) ch.splice(ch.findIndex(d => d.type === 'limiter'), 0, {type: 'comp', id: 'glue', thr: -12, ratio: 1, knee: 6, att: .02, rel: .15});
  if (!ch.some(d => d.id === 'tone')) ch.splice(ch.findIndex(d => d.id === 'glue'), 0, {type: 'eq', id: 'tone', bands: [{type: 'ls', f: 110, g: 0}, {type: 'bell', f: 350, g: 0, q: 1}, {type: 'hs', f: 8000, g: 0}]});
  const lim = ch.find(d => d.type === 'limiter'); lim.id = lim.id || 'limit';
  if (!ch.some(d => d.id === 'trim')) ch.push({type: 'gain', id: 'trim', db: 0});
  return song;
}
// the settings the mix owns, at neutral (heard while it listens, so it hears the parts as they are)
export const NEUTRAL = (roles) => Object.entries(roles).flatMap(([id, role]) => [[`${id}.aeq.1.g`, 0], [`${id}.aeq.2.g`, 0], [`${id}.aeq.3.g`, 0],
  ...(role !== 'drums' ? [[`${id}.duck.depth`, 0]] : []), [`${id}.acomp.ratio`, 1], [`${id}.acomp.gain`, 0]]);

/* ---------- the ears ---------- */
// K-weighting (BS.1770's two stages): loudness as heard, not just level
// (every connection the ears make is kept, so taking them away touches nothing else: a strip's own wiring stays)
const wire = (E, a, b, o = 0) => { a.connect(b, o); E.push([a, b, o]); };
function kChain(ctx, E, from){ const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(); a.type = 'highshelf'; a.frequency.value = 1681; a.gain.value = 4; b.type = 'highpass'; b.frequency.value = 38; b.Q.value = .5;
  wire(E, from, a); wire(E, a, b); return b; }
const an = (ctx, E, from, n = 4096) => { const x = ctx.createAnalyser(); x.fftSize = n; x.smoothingTimeConstant = 0; wire(E, from, x); return x; };
// gated loudness from blocks of mean square (LUFS: absolute gate -70, then 10 under the ungated mean)
export function gated(ms, offset = -.691){
  const L = ms.map(m => offset + 10*Math.log10(m + 1e-12)).filter(l => l > -70); if (!L.length) return -Infinity;
  const mean = l => 10*Math.log10(l.reduce((s, x) => s + Math.pow(10, x/10), 0)/l.length), rel = mean(L) - 10, G = L.filter(l => l > rel);
  return mean(G.length ? G : L);
}
// listen for `secs` to these strips (each part's sound after its devices, before its fader) and the master (after
// everything): each part's loudness, band energies frame by frame and level, and the master's loudness, peak and balance.
// E: the playing engine. Stops early if `stop()` says so (the engine was rebuilt)
export function listen(E, {ids = [], secs = 8, master = true, onProgress, stop} = {}){
  const ctx = E.ctx, S = E.desk.strips, W = [], take = [];
  for (const id of ids) { const s = S.get(id); if (!s) continue;
    const kA = an(ctx, W, kChain(ctx, W, s.post), 2048), fA = an(ctx, W, s.post);
    take.push({id, kA, fA, kb: new Float32Array(2048), fb: new Float32Array(fA.frequencyBinCount), tb: new Float32Array(4096), ms: [], frames: [], rms: [], pk: -120}); }
  let mst = null;
  if (master) { const s = S.get('master'), sp = ctx.createChannelSplitter(2); wire(W, s.out, sp);
    const side = o => { const g = ctx.createGain(); wire(W, sp, g, o); return g; };
    const kL = an(ctx, W, kChain(ctx, W, side(0)), 2048), kR = an(ctx, W, kChain(ctx, W, side(1)), 2048), fA = an(ctx, W, s.out);
    mst = {kL, kR, fA, bl: new Float32Array(2048), br: new Float32Array(2048), fb: new Float32Array(fA.frequencyBinCount), tb: new Float32Array(4096), ms: [], frames: [], pk: -120}; }
  const df = ctx.sampleRate/4096, bandsOf = fb => BANDS.map(([, lo, hi]) => { let p = 0; for (let i = Math.ceil(lo/df); i <= Math.min(fb.length - 1, hi/df); i++) p += Math.pow(10, fb[i]/10); return p; });
  const msOf = b => { let s = 0; for (const x of b) s += x*x; return s/b.length; };
  return new Promise(res => {
    const t0 = ctx.currentTime;
    const tick = setInterval(() => {
      for (const p of take) { p.kA.getFloatTimeDomainData(p.kb); p.fA.getFloatTimeDomainData(p.tb); const m = msOf(p.kb), r = msOf(p.tb);
        let pk = 0; for (const x of p.tb) pk = Math.max(pk, Math.abs(x)); p.pk = Math.max(p.pk, 20*Math.log10(pk + 1e-9));
        p.ms.push(m); p.rms.push(r); p.fA.getFloatFrequencyData(p.fb); p.frames.push(bandsOf(p.fb)); }
      if (mst) { mst.kL.getFloatTimeDomainData(mst.bl); mst.kR.getFloatTimeDomainData(mst.br); mst.ms.push(msOf(mst.bl) + msOf(mst.br));
        mst.fA.getFloatTimeDomainData(mst.tb); let pk = 0; for (const x of mst.tb) pk = Math.max(pk, Math.abs(x)); mst.pk = Math.max(mst.pk, 20*Math.log10(pk + 1e-9));
        mst.fA.getFloatFrequencyData(mst.fb); mst.frames.push(bandsOf(mst.fb)); }
      const done = (ctx.currentTime - t0)/secs; if (onProgress) onProgress(Math.min(1, done));
      if (done >= 1 || (stop && stop())) { clearInterval(tick); for (const [a, b, o] of W) try { a.disconnect(b, o); } catch (e) {} res(summary()); }
    }, 50);
  });
  function summary(){
    const parts = {};
    for (const p of take) {
      // (only the moments the part sounds: a hat's gaps don't make it quieter)
      const lufs = gated(p.ms), rmsDb = gated(p.rms, 0), tot = BANDS.map((_, b) => p.frames.reduce((s, f) => s + f[b], 0)), all = tot.reduce((a, b) => a + b, 0) || 1e-20;
      parts[p.id] = {lufs, rms: rmsDb, peak: p.pk, share: tot.map(x => x/all), frames: p.frames, heard: isFinite(lufs) && lufs > -60};
    }
    let m = null;
    if (mst) { const tot = BANDS.map((_, b) => mst.frames.reduce((s, f) => s + f[b], 0)); m = {lufs: gated(mst.ms), peak: mst.pk, bands: tot}; }
    return {parts, master: m};
  }
}

/* ---------- the rules ---------- */
// a.parts: {id: {lufs, rms, peak, share, frames, heard}}; roles {id: role}; vols {id: dB now}; locks {id: true: leave its level}
// → [{path, v, why, part}], each change with its reason in plain words
export function plan(a, {roles, vols = {}, bpm = 124, locks = {}} = {}){
  const T = M(), out = [], heard = Object.keys(roles).filter(id => a.parts[id] && a.parts[id].heard), P = id => a.parts[id], role = id => roles[id];
  const name = id => ({drums: 'Kick & snare', bass: 'Bass', chords: 'Chords', hook: 'Hook', hats: 'Hats', perc: 'Percussion'}[role(id)] || id);
  if (!heard.length) return out;
  // 1. levels: each part its place against the kick and snare (or, without them, against the loudest part's place)
  // (heard through the fader: the ears sit before it, so a part's loudness in the mix is what they heard plus its level)
  const kick = heard.find(id => role(id) === 'drums'), eff = id => P(id).lufs + (vols[id] || 0);
  const ref = kick ? eff(kick) - T.targets.drums : Math.max(...heard.map(id => eff(id) - T.targets[role(id)]));
  for (const id of heard) {
    if (locks[id]) continue;
    const want = ref + T.targets[role(id)], d = Math.max(-T.maxStep, Math.min(T.maxStep, want - eff(id))), v = Math.min(T.volMax, Math.round(((vols[id] || 0) + d)*2)/2);
    if (Math.abs(d) >= .5) out.push({part: id, path: `${id}.vol`, v, why: `${name(id)} ${d > 0 ? '+' : ''}${d.toFixed(1)} dB: to sit ${Math.abs(T.targets[role(id)]) < .1 ? 'level with' : Math.abs(T.targets[role(id)]) + ' dB under'} the kick`});
  }
  // 2. the high-pass: the low end left to the kick and bass
  for (const id of Object.keys(roles)) { const f = T.hp[role(id)]; if (f) out.push({part: id, path: `${id}.aeq.0.f`, v: f, why: f > 60 ? `${name(id)}: nothing under ${f} Hz (that's the kick's and bass's)` : null}); }
  // 3. the low end: the bass ducks under the kick whenever both play, deeper the more they fight
  const clashes = masking(Object.fromEntries(heard.map(id => [id, P(id).frames])));
  const low = id => (P(id).share[0] + P(id).share[1] + P(id).share[2]);
  const rel = Math.round(.5*60/bpm/2*1000)/1000;
  for (const id of heard.filter(x => role(x) !== 'drums')) {
    if (!kick) { out.push({part: id, path: `${id}.duck.depth`, v: 0, why: null}); continue; }
    const fight = Math.max(0, ...clashes.filter(c => [c.a, c.b].includes(kick) && [c.a, c.b].includes(id) && zone(c.band) === 'low').map(c => c.overlap));
    let depth = 0;
    if (role(id) === 'bass') depth = T.duckBass[0] + (T.duckBass[1] - T.duckBass[0])*fight;
    else if (low(id) > T.lowShare) depth = T.duckPad[0] + (T.duckPad[1] - T.duckPad[0])*fight;
    depth = Math.round(depth);
    out.push({part: id, path: `${id}.duck.depth`, v: depth, why: depth ? `${name(id)} ducks ${depth} dB under each kick${fight > .3 ? ' (they fight in the low end)' : ''}` : null});
    if (depth) out.push({part: id, path: `${id}.duck.rel`, v: rel, why: null});
  }
  // 4. the clashes elsewhere: the part the band matters less to gets a cut there (two at most a part; the kick and bass
  // in the low end are left to the ducking)
  const bells = {};
  for (const c of clashes) {
    if (zone(c.band) === 'low' && [c.a, c.b].every(id => ['drums', 'bass'].includes(role(id)))) continue;
    const order = T.keep[zone(c.band)], cut = order.indexOf(role(c.a)) > order.indexOf(role(c.b)) ? c.a : c.b, keep = cut === c.a ? c.b : c.a;
    if (role(cut) === 'drums') continue;
    const n = bells[cut] = (bells[cut] || 0) + 1; if (n > 2) continue;
    const f = Math.round(Math.sqrt(c.lo*c.hi)), g = -Math.round(Math.min(T.cutMax, 2 + 4*c.overlap)*2)/2;
    out.push({part: cut, path: `${cut}.aeq.${n}.f`, v: f, why: null}, {part: cut, path: `${cut}.aeq.${n}.g`, v: g,
      why: `${name(cut)} ${g} dB at ${f >= 1000 ? (f/1000).toFixed(1) + ' kHz' : f + ' Hz'}: it was fighting the ${name(keep).toLowerCase()} there`});
  }
  // 5. compression: the bass, chords and hook held steadier (just over where they sit)
  for (const id of heard) { const c = T.comp[role(id)]; if (!c) continue;
    out.push({part: id, path: `${id}.acomp.thr`, v: Math.round(P(id).rms + c.over), why: null}, {part: id, path: `${id}.acomp.ratio`, v: c.ratio, why: `${name(id)} compressed ${c.ratio}:1, to hold it steady`},
      {part: id, path: `${id}.acomp.att`, v: c.att, why: null}, {part: id, path: `${id}.acomp.rel`, v: c.rel, why: null}, {part: id, path: `${id}.acomp.gain`, v: 1, why: null}); }
  return out;
}

// the master: its tone towards the preset's balance, the glue, the limiter's ceiling (the loudness is found by listening:
// loudness()). m: listen()'s master; preset: TUNE.studio.masters[key]
export function masterPlan(m, preset){
  const out = [], T = TUNE.studio;
  out.push({path: 'master.limit.ceil', v: preset.ceil, why: `the ceiling ${preset.ceil} dB`});
  out.push({path: 'master.glue.ratio', v: preset.ratio, why: preset.ratio > 1 ? `the glue ${preset.ratio}:1 over the whole` : null});
  if (preset.att) out.push({path: 'master.glue.att', v: preset.att, why: null});
  // (the glue just under the loud moments: a couple of dB off the top)
  if (m && isFinite(m.lufs)) out.push({path: 'master.glue.thr', v: Math.round(m.lufs + 4), why: null});
  if (!preset.tone || !m) { for (const i of [0, 1, 2]) out.push({path: `master.tone.${i}.g`, v: 0, why: null}); return out; }
  // each band's level per octave against the mids, against the preset's
  const oct = BANDS.map(([, lo, hi]) => Math.log2(hi/lo)), lv = m.bands.map((p, i) => 10*Math.log10(p/oct[i] + 1e-20)), mid = lv[3], d = lv.map((x, i) => x - mid - preset.tone[i]);
  const g = x => Math.round(Math.max(-T.toneMax, Math.min(T.toneMax, -x*T.toneAmount))*2)/2, avg = (...i) => i.reduce((s, k) => s + d[k], 0)/i.length;
  const [lo, mud, hi] = [g(avg(0, 1)), g(avg(2)), g(avg(6, 7))];
  const say = (v, what) => v ? `${what} ${v > 0 ? '+' : ''}${v} dB` : null;
  out.push({path: 'master.tone.0.g', v: lo, why: say(lo, 'the low end')}, {path: 'master.tone.1.g', v: mud, why: say(mud, 'the low mids')}, {path: 'master.tone.2.g', v: hi, why: say(hi, 'the top')});
  return out;
}
// the limiter's next gain, from the loudness it gave and the one wanted (pushing a limiter adds less than its gain)
export const loudGain = (gain, lufs, want) => Math.max(-12, Math.min(14, Math.round((gain + (want - lufs)*(want > lufs ? 1.25 : 1))*2)/2));
