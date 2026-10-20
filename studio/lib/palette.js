// The user's palette: the sounds they liked in the loop labs (the round kick, the glass and clean basses, the warm and glass
// pads, the gated and dotted chords, kalimba, vibes, music box, steel drum, woodblocks, marimba, the one-note ping, the
// Detroit fifths), the grooves they liked (Slow Bloom's hats, broken beat, lo-fi, toms, metal and bells in polyrhythms), and
// helpers for writing whole pieces with them in any harmony: chords by symbol, voicings, progressions, spans of bars.
import { MIX } from '../tracks/mix.js';
import { MODAL, modal } from './native/modal.js';
import { grains, rain as rainBuf } from './native/body.js';
export const SAW = 0, SQUARE = 1, TRI = 2, SINE = 3, SUPER = 4;

/* ---------- harmony ---------- */
// chord qualities as intervals from the root (the root first)
export const Q = {m9: [0, 3, 7, 10, 14], m7: [0, 3, 7, 10], m11: [0, 3, 7, 10, 14, 17], madd9: [0, 3, 7, 14], m6: [0, 3, 7, 9, 14],
  maj9: [0, 4, 7, 11, 14], maj7: [0, 4, 7, 11], '69': [0, 4, 7, 9, 14], add9: [0, 4, 7, 14], lyd: [0, 4, 7, 11, 18],
  dom9: [0, 4, 7, 10, 14], '13': [0, 4, 10, 14, 21], sus2: [0, 2, 7, 14], sus4: [0, 5, 7, 10, 14], '7sus': [0, 5, 7, 10, 14],
  q: [0, 5, 10, 15, 19], five: [0, 7, 12, 14, 19], dim: [0, 3, 6, 10, 14]};
const NOTE = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
// 'A:m9' → {root: the bass's root (E1 to D#2), tones}
export const chord = sym => { const [n, q] = sym.split(':'); let r = 24 + NOTE[n]; if (r < 28) r += 12; return {sym, root: r, tones: Q[q]}; };
// a progression: [[symbol, bars], …] round and round from bar `from`
export const cycle = (list, from = 0) => { const cs = list.map(([s, n]) => [chord(s), n]), len = cs.reduce((a, [, n]) => a + n, 0);
  return bar => { let k = ((bar - from) % len + len) % len; for (const [c, n] of cs) { if (k < n) return c; k -= n; } return cs[0][0]; }; };
// a close voicing of a chord's upper tones (the bass has the root), each note the first of its name at or above `lo`
export const voice = (c, lo = 57) => { const at = t => { const pc = (c.root + t) % 12; let n = lo - ((lo - pc) % 12 + 12) % 12; if (n < lo) n += 12; return n; };
  const ns = [...new Set(c.tones.slice(1).map(at))]; if (ns.length < 3) ns.push(at(0));   // (a thin chord, a sus2, keeps its root too)
  return [...new Set(ns)].sort((a, b) => a - b); };
// a scale by degree from a tonic (modes as intervals)
export const MODES = {aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], penta: [0, 3, 5, 7, 10, 12, 15], majpenta: [0, 2, 4, 7, 9, 12, 14]};
export const scale = (tonic, mode) => k => { const m = MODES[mode], n = m.length === 7 ? 7 : 5; const o = Math.floor(k/n), i = ((k % n) + n) % n; return tonic + 12*o + m[i]; };

/* ---------- time ---------- */
// spans of bars [[a, b], …] (b not included); each(spans, fn) runs fn(bar, k) for every bar in them, k from the span's start
export const each = (spans, fn) => { for (const [a, b] of spans) for (let bar = a; bar < b; bar++) fn(bar, bar - a); };
export const inSpans = (spans, bar) => spans.some(([a, b]) => bar >= a && bar < b);
// the steps of a pattern string that hit ('x', 'X', 'o')
export const hits = str => [...str].map((c, i) => c === '.' ? -1 : i).filter(i => i >= 0);
// every n 16ths across a run of bars from offset o: a cycle against the bar; fn(bar, step, j)
export const every = (a, b, n, o, fn) => { for (let g = a*16 + o; g < b*16; g += n) fn(Math.floor(g/16), g % 16, (g - a*16 - o)/n); };

/* ---------- the desk ---------- */
// the buses, as Slow Bloom's and the labs' (o: per-bus overrides), and the returns
export function buses(d, o = {}){
  d.returns({delay: {div: 4, fb: .42, tone: 2000, ...o.delay}, reverb: {size: .78, damp: .65, low: 240, ...o.reverb}, echoDb: -1, verbDb: 2,
    echoPump: {depth: .35, rel: .6}, verbPump: {depth: .45, rel: .7}, verbWidth: 1.3});
  const B = {
    kick: {level: -1.5, hp: 28},
    hats: {level: 12, width: 1.25, pump: {depth: .2, rel: .35}, a: -13, b: -20, hp: 300, filter: {cut: 20000}},
    drums: {level: 15, width: 1.1, pump: {depth: .2, rel: .35}, b: -18, filter: {cut: 20000}},
    perc: {level: 8, width: 1.35, pump: {depth: .25, rel: .4}, a: -16, b: -12, filter: {cut: 20000}},
    bass: {level: 6, pump: {depth: .45, rel: .4}, a: -12, filter: {cut: 2400, q: .5}},
    pad: {level: 0, width: 1.9, mono: 200, chorus: {rate: .23, depth: .7, mix: .45}, pump: {depth: .7, rel: .6}, b: -3, hp: 140, filter: {cut: 3000}},
    chords: {level: 4, width: 1.4, pump: {depth: .6, rel: .5}, a: -4, b: -5, hp: 160, filter: {cut: 2000, q: .8}},
    lead: {level: 4, width: 1.3, pump: {depth: .4, rel: .45}, a: -6, b: -5, hp: 180, filter: {cut: 8000, q: .5}},
    bells: {level: 7, width: 1.4, pump: {depth: .35, rel: .45}, a: -7, b: -6, hp: 200, filter: {cut: 9000, q: .5}},
    fx: {level: -3, width: 1.5, pump: {depth: .4, rel: .5}, b: -6, hp: 300},
  };
  for (const [k, v] of Object.entries(B)) d.bus(k, {...v, ...o[k]});
  // the piece's mix (tracks/mix.js, dB per bus, measured from its last render): on each bus's input, so level ramps keep it
  for (const [k, v] of Object.entries(MIX[d.meta?.title] || {})) if (d.buses[k]) d.buses[k].in.gain.value = Math.pow(10, v/20);
}

/* ---------- the sounds ---------- */
// the kick: the one the user saved ("Roundest": the liked kick, no drive, darker), and its liked neighbours
export const GOOD_KICK = {decay: .85, x: .5, drive: .12, tone: .42, tune: -1};
export const KICKS = {round: {drive: 0, tone: .3}, low: {tune: -3}, short: {decay: .55}, soft: {x: .28}, 808: {decay: 1.6, x: .3, drive: 0, tone: .38, tune: -2}};
export const kick = (d, k = 'round', over = {}) => { const kt = d.kit('kick', k === '808' ? '808' : 'Minimal', {kick: {...GOOD_KICK, ...KICKS[k], ...over}}); kt.side = true; return kt; };

// synth sounds: [preset, settings]
export const SOUNDS = {
  // basses
  glass: ['Glass bell', {mix2: .3, ad: .25, ar: .15, chorus: .2, width: .2, oct: -1, level: .8}],          // the saved one: the glass sequence
  glassLong: ['Glass bell', {mix2: .3, ad: .5, ar: .3, chorus: .2, width: .2, oct: -1, level: .8}],
  clean: ['Sub bass', {w1: SINE, w2: TRI, mix2: .4, sub: 0, cut: 1200, ad: .15, as: .2, ar: .05, oct: 0, mode: 1, glide: .02}],
  cleanHeld: ['Sub bass', {w1: SINE, w2: TRI, mix2: .4, sub: 0, cut: 1200, ad: .3, as: .5, ar: .08, oct: 0, mode: 1, glide: .02}],
  pluck: ['Pluck', {w1: SQUARE, w2: SAW, semi: 0, mix2: .4, cut: 420, res: .4, fenv: .7, fd: .1, as: 0, ar: .06, chorus: 0, width: .1, oct: 0}],
  dubSub: ['Sub bass', {w1: SINE, sub: 0, ad: .6, as: .3, ar: .2, oct: 0, drive: .25}],
  // pads and chords
  warm: ['Warm pad', {aa: 1.2, ad: 2, as: .85, ar: 2.6, cut: 1300, res: .06, fenv: .15, lamt: .12, chorus: .2, width: 1, level: .55}],
  glassPad: ['Glass bell', {aa: 1.4, ad: 3, as: .7, ar: 3, oct: 0, chorus: .6, width: 1, level: .5}],
  sweep: ['Warm pad', {aa: 1, ad: 2, as: .85, ar: 2.6, cut: 900, res: .25, fenv: 0, ldest: 1, lsync: 9, lamt: .7, chorus: .3, width: 1, level: .6}],
  gated: ['Warm pad', {aa: .005, ad: .12, as: 0, ar: .06, cut: 1800, fenv: .2, fd: .1, lamt: 0, chorus: .3, width: 1, level: .5}],
  dotted: ['Stab chord', {chord: 0, aa: .004, ad: .25, as: .05, ar: .2, cut: 1100, res: .25, fenv: .4, fd: .15, chorus: .4, width: .9, level: .5}],
  dub: ['Dub chord', {chord: 0, aa: .08, ad: .6, as: .2, ar: .5, cut: 900, res: .3, chorus: .3, width: .8, level: .55}],
  dubStab: ['Dub chord', {chord: 0, cut: 900, res: .4, fenv: .4, fd: .12, ad: .2, as: 0, ar: .15, chorus: .3, width: .8, level: .55}],
  fifths: ['Stab chord', {chord: 0, cut: 1600, res: .2, fenv: .4, fd: .2, ad: .3, as: .1, ar: .3, chorus: .6, width: .9, level: .5}],
  // leads: short and percussive
  arp: ['Pluck', {semi: 12, mix2: .3, cut: 700, res: .3, fenv: .6, fd: .14, as: 0, ar: .2, chorus: .4, width: .8, level: .5}],
  ping: ['Pluck', {w1: SQUARE, semi: 0, mix2: 0, cut: 400, res: .55, fenv: .6, fd: .08, as: 0, ar: .08, chorus: .2, width: .6, level: .6}],
  marimba: ['Pluck', {w1: TRI, w2: SINE, semi: 12, mix2: .3, cut: 3000, fenv: .2, fd: .08, as: 0, ad: .18, ar: .12, chorus: .2, width: .6, level: .6}],
  // bells, metal, wood
  kalimba: ['Pluck', {w1: SINE, w2: TRI, semi: 12, mix2: .3, noise: .04, cut: 5000, res: 0, fenv: .2, fd: .05, aa: .001, ad: .35, as: 0, ar: .3, chorus: .2, width: .5, level: .7}],
  vibes: ['Glass bell', {w1: SINE, w2: SINE, semi: 24, mix2: .15, oct: 0, aa: .002, ad: 1.4, as: 0, ar: 1.2, ldest: 2, lsync: 0, lrate: 5.5, lamt: .3, chorus: .3, width: .7, level: .65}],
  musicbox: ['Glass bell', {w1: SINE, w2: TRI, semi: 24, mix2: .2, oct: 1, aa: .001, ad: .6, as: 0, ar: .6, chorus: .2, width: .6, level: .55}],
  tubular: ['Glass bell', {w1: SINE, w2: SINE, semi: 19, fine: 22, mix2: .55, oct: 0, aa: .001, ad: 2.5, as: 0, ar: 2.5, chorus: .3, width: .7, level: .55}],
  steel: ['Pluck', {w1: SINE, w2: TRI, semi: 12, fine: 30, mix2: .45, cut: 2600, res: .3, fenv: .3, fd: .2, aa: .001, ad: .45, as: 0, ar: .35, chorus: .3, width: .6, level: .65}],
  metal: ['Pluck', {w1: SQUARE, w2: SQUARE, semi: 6, fine: 12, mix2: .5, ft: 2, cut: 2400, res: .5, fenv: .3, fd: .08, aa: .001, ad: .25, as: 0, ar: .2, chorus: .2, width: .6, level: .55}],
  wood: ['Pluck', {w1: TRI, w2: SINE, semi: 19, mix2: .2, noise: .08, cut: 3500, res: .1, fenv: .2, fd: .03, aa: .001, ad: .09, as: 0, ar: .06, chorus: 0, width: .4, level: .75}],
};
// the sounds the user preferred native in the lab (native-1): bars, bells, the steel pan and the metal plate computed from
// their physics; the kalimba, the glass bass, the pluck and the shaker they preferred as they were
const NATIVE_OF = {marimba: 'marimba', musicbox: 'musicbox', steel: 'steel', wood: 'wood', tubular: 'tubular', vibes: 'vibes', metal: 'plate'};
export const synth = (d, bus, name, over = {}) => { const [p, s] = SOUNDS[name];
  if (NATIVE_OF[name] && d.native && !over.poly) return native(d, bus, name, s, over);
  const syn = d.synth(bus, p, {chord: 0, ...s, ...over}); syn.label = name; return syn; };
// a native instrument standing in for a poly synth sound: its octave kept, and the synth settings a score moves mapped onto
// the physics (a longer decay rings every mode longer; more filter envelope or resonance strikes harder, brighter)
function native(d, bus, name, base, over){
  const nat = NATIVE_OF[name], ins = d.native(bus, nat), H = MODAL[nat].hard, tr = 12*(base.oct || 0), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const set = (k, v) => { if (k === 'ad') ins.set('ring', clamp(v/(base.ad ?? .3), .4, 3)); else if (k === 'fenv') ins.set('hard', clamp(H + (v - (base.fenv ?? .2))*.6, .15, 1)); else if (k === 'res') ins.set('hard', clamp(H + (v - (base.res ?? 0))*.5, .15, 1)); };
  for (const [k, v] of Object.entries(over)) set(k, v);
  const w = {bus, set, native: nat, label: name, play: (n, t, len, vel) => ins.play(n + tr, t, len, vel)};
  d.onInst?.(w, {engine: 'palette', bus, name, over}); return w;
}
// a whole computed buffer placed on a bus at a bar (a cloud, rain)
const place = (d, bus, o, bar, gain = 1) => d.later(d.t(bar) - .01, () => { const ab = d.ctx.createBuffer(2, o.L.length, d.ctx.sampleRate); ab.copyToChannel(o.L, 0); ab.copyToChannel(o.R, 1);
  const s = d.ctx.createBufferSource(), g = d.ctx.createGain(); s.buffer = ab; g.gain.value = gain; s.connect(g); g.connect(d.buses[bus].in); s.start(d.t(bar)); });
// the bell cloud (liked in the lab): grains of a struck music box bar, thin at first and thickening; pitches as ratios of f0
export const cloud = (d, bus, bar, bars, {f0 = 440, pitches = [1, 1.335, 1.5, 2, .667], gain = .9, seed = 5} = {}) => { const sr = d.ctx.sampleRate; d.onTexture?.({kind: 'cloud', bus, bar, bars, opts: {f0, pitches, gain, seed}});
  place(d, bus, grains(sr, modal(sr, f0, MODAL.musicbox.modes, {...MODAL.musicbox, vel: .7, len: 1.4}), bars*4*d.beat + 2, {density: [3, 45], len: [.05, .18], pitches, seed}), bar, gain); };
// rain (liked in the lab): droplets over a soft hiss
export const rainAt = (d, bus, bar, bars, {gain = .7, seed = 9} = {}) => (d.onTexture?.({kind: 'rain', bus, bar, bars, opts: {gain, seed}}), place(d, bus, rainBuf(d.ctx.sampleRate, bars*4*d.beat + 2, {seed}), bar, gain));

/* ---------- the drums: the liked grooves, as functions of a bar ---------- */
// the toms struck skins (the native membrane, liked in the lab) instead of the kit's: the same voices, low and high
export const nativeToms = (d, kit) => { if (!d.native) return kit; const tom = d.native('perc', 'tom'), play = kit.play.bind(kit); kit.skins = true;
  kit.play = (v, t, vel, lock) => v === 'tomL' ? tom.play(43, t, 1, vel) : v === 'tomH' ? tom.play(50, t, 1, vel) : play(v, t, vel, lock); return kit; };
export function kits(d, {kit = 'Minimal', hats = {}, drums = {}, perc = {}, skins = true} = {}){
  return {
    hats: d.kit('hats', kit, {chh: {tone: .62, level: 1.1, decay: .7, x: .3, pan: .2}, ohh: {tone: .58, level: .85, decay: .8, pan: -.2}, ride: {tone: .5, level: .4}, ...hats}),
    drums: d.kit('drums', kit, {clap: {level: .2, tone: .6, decay: 1.2}, snare: {level: .55, tone: .65}, crash: {tone: .45, level: .35, decay: 1.6}, ...drums}),
    perc: (skins ? nativeToms : (d, k) => k)(d, d.kit('perc', kit, {rim: {level: .45, tone: .55, pan: .35}, shaker: {level: .5, tone: .5, pan: -.2}, tomL: {level: .85, decay: 1.05}, tomH: {level: .72, decay: .95, pan: .3}, clave: {level: .35, tone: .6, pan: -.4}, ...perc})),
    bell: d.kit('perc', '909', {ride: {x: .92, level: .45, tone: .62, decay: .55, pan: .28}, chh: {x: 1, tone: .82, level: .6, decay: .45, pan: -.35}}),
  };
}
// a pattern string in one bar ('x' hit, 'X' accent, 'o' ghost), vel scaled, a little human
export const bar16 = (d, kit, voice, bar, str, vel = .8, lock) => { for (let s = 0; s < str.length; s++) { const c = str[s]; if (c === '.') continue;
  d.hit(kit, voice, bar + Math.floor(s/16), s % 16, (c === 'X' ? 1.2 : c === 'o' ? .4 : 1)*vel*(.92 + d.rand()*.16), lock); } };
// four to the floor (or a pattern), a ghost into each eighth bar
export const kickBar = (d, k, bar, str = 'X...x...x...x...', vel = 1) => { for (const s of hits(str)) d.hit(k, 'kick', bar, s, (str[s] === 'X' ? 1 : .92)*vel); };
// Slow Bloom's grooving hats: off-beats accented, the 16ths between ghosted and swelling over two bars
export const hatBar = (d, h, bar, amt = 1) => { for (let s = 0; s < 16; s++) {
  const off = s % 4 === 2, on = s % 4 === 0, sw = .5 + .5*Math.sin((bar % 2*16 + s)/32*Math.PI*2);
  if (!off && d.rand() < (on ? .25 : .18)) continue;
  d.hit(h, 'chh', bar, s + (s % 2 ? .1 : off ? -.04 : 0), (off ? .95 : on ? .42 : .26 + .22*sw)*amt*(.9 + d.rand()*.2), {decay: off ? .85 : .45 + .25*sw}); } };
// the open hat on the off-beats, opening a little more each bar of four
export const ohhBar = (d, h, bar, amt = 1) => { const open = [.55, .7, .9, 1.25][bar % 4]; for (const s of [2, 6, 10, 14]) d.hit(h, 'ohh', bar, s - .04, .72*amt*(.9 + d.rand()*.15), {decay: open}); };
