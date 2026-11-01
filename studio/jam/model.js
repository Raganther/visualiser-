// Studio Jam's model: clips that follow the harmony. A pitched clip doesn't store notes: it stores a rhythm and a contour
// through the chord (each step a rung of the chord's ladder: its tones in order up the octaves), so the same clip plays over
// any chord and any progression. A drum clip stores which voice hits on each step. A clip has its own length in 16ths
// (6, 12, 13 … so clips go round against each other) and a few variations. A harmony is a list of chord symbols, one a bar.
import { chord, voice } from '../lib/palette.js';
import { ROLE_NAMES } from '../lib/names.js';

// a chord's ladder: its tones as pitch classes in order (root first), repeating up the octaves; rung k from base
export const ladder = (c, base, k) => { const pcs = [...new Set(c.tones.map(t => t % 12))].sort((a, b) => a - b), n = pcs.length;
  return base + pcs[((k % n) + n) % n] + 12*Math.floor(k/n); };
// each role's register: where its rung 0 sits (the bass an octave over the chord's root, the lead two)
export const REGISTER = {bass: c => c.root + 12, lead: c => c.root + 24, chords: () => 57};
// the notes a clip plays at one of its steps over a chord: [[midi or voice, len16, vel], …]. With `o.vl` (a bar of the
// harmony's voice-leading chain, vlChain below) chords play its voicing and lines read their rungs from its anchors; o.walk
// lifts every rung (Walk), o.inv turns the chord (an inversion each)
export function notesAt(clip, step, c, o = {}){
  const out = [];
  for (const s of clip.steps) { if (s[0] !== step) continue;
    if (clip.role === 'kick' || clip.role === 'hats' || clip.role === 'perc') out.push([s[1], 1, s[2]]);
    else if (s[1] === 'chord') for (const n of invert(o.vl ? o.vl.voicing : voice(c, s[4] ?? 57), o.inv || 0)) out.push([n, s[2], s[3]]);
    else { const k = s[1] + (o.walk || 0), oc = 12*(s[4] || 0);
      if (!o.vl) { out.push([ladder(c, REGISTER[clip.role](c), k) + oc, s[2], s[3]]); continue; }
      const at = clip.role === 'bass' ? o.vl.bass : o.vl.lead; let n = rungFrom(c, at, k) + oc;
      // a lead a semitone against a chord voice moves on to the next tone up
      if (clip.role === 'lead' && o.vl.voicing.some(v => Math.abs(v - n) === 1)) n = rungFrom(c, at, k + 1) + oc;
      out.push([n, s[2], s[3]]); } }
  return out;
}
export const chordOf = (h, bar) => chord(h.bars[((bar % h.bars.length) + h.bars.length) % h.bars.length]);
export const ROLES = ['kick', 'hats', 'perc', 'bass', 'chords', 'lead'];
export { ROLE_NAMES };
// a small random change to a clip (Mutate): a step moved a 16th, a rung up or down, a step added or dropped, an accent moved
export function mutate(clip, rnd = Math.random){
  const steps = clip.steps.map(s => s.slice()), pitched = !['kick', 'hats', 'perc'].includes(clip.role), i = Math.floor(rnd()*steps.length), s = steps[i], r = rnd();
  if (!s) return {...clip, steps};
  if (r < .3 && pitched && s[1] !== 'chord') s[1] += rnd() < .5 ? 1 : -1;
  else if (r < .55) { const to = (s[0] + (rnd() < .5 ? 1 : -1) + clip.len) % clip.len; if (!steps.some(x => x[0] === to)) s[0] = to; }
  else if (r < .75 && steps.length > 2) steps.splice(i, 1);
  else if (r < .9) { const at = Math.floor(rnd()*clip.len); if (!steps.some(x => x[0] === at)) { const c = s.slice(); c[0] = at; steps.push(c); } }
  else { const vi = pitched ? 3 : 2; s[vi] = s[vi] > .85 ? .6 : 1; }
  return {...clip, steps: steps.sort((a, b) => a[0] - b[0])};
}

// the macros, shared by the page and the render of a jam: tone → the channel's filter; length → the decay (LEN times)
export const cutOf = x => 260*Math.pow(2, x*6.2);
// where each role's tone starts: hats and percussion bright (their sound is all above the default's 3.7 kHz)
export const X0 = role => ({hats: .94, perc: .84}[role] ?? .62);
export const LEN = [.45, 1, 2.2];
// a native note's settings now: the mallet from tone, the ring from length
export function nativeSet(c, name, base = {}){ const o = {...base};
  if (['marimba', 'kalimba', 'steel', 'musicbox', 'vibes', 'wood', 'tubular', 'bell', 'plate', 'glass', 'gong', 'bowl', 'logdrum', 'bamboo', 'rim'].includes(name)) { o.hard = Math.round((.2 + .75*c.x)*4)/4; o.ring = LEN[c.length]; }
  else if (['kick', 'tom', 'hand'].includes(name)) { o.decay = (o.decay ?? (name === 'kick' ? .45 : .5))*LEN[c.length]; o.hard = Math.round((.2 + .7*c.x)*4)/4; }
  else if (name === 'hat') o.decay = (o.decay ?? .06)*LEN[c.length];
  // the cymbal pair: tone from the part's tone (round its bright default), Length opening it a little more or less
  else if (name === 'hihat') { o.tone = Math.round(Math.max(0, Math.min(1, (o.tone ?? .45) + (c.x - X0('hats'))*.7))*10)/10; o.open = Math.round(Math.min(1, (o.open ?? 0)*[.7, 1, 1.4][c.length])*50)/50; }
  else if (name.startsWith('fm')) { o.index = Math.round((.4 + 3.2*c.x)*4)/4; o.dec = .25*LEN[c.length]; }
  else if (['bowed', 'bowmetal', 'glassharm', 'rubbowl'].includes(name)) { const lo = name === 'bowed' ? .4 : 0, hi = name === 'bowed' ? 1 : .45; o.bright = Math.round((lo + (hi - lo)*c.x)*20)/20; o.r = [.4, .9, 2.2][c.length]; }
  else if (name === 'sub808') { o.drive = Math.round((.1 + .8*c.x)*10)/10; o.dec = [.35, 1.2, 3][c.length]; }
  else if (name.startsWith('va')) { o.tone = Math.round(c.x*10)/10; o.stretch = LEN[c.length]; }
  else if (['kround', 'kdub', 'ktight', 'kdeep'].includes(name)) { o.tone = Math.round((.15 + .75*c.x)*10)/10; o.decay = (o.decay ?? {kround: .32, kdub: .3, ktight: .18, kdeep: .5}[name])*LEN[c.length]; }
  else if (name === 'rumble') { o.grit = Math.round((.15 + .5*c.x)*20)/20; o.decay = .5*LEN[c.length]; }
  else if (name === 'formant') { o.q = Math.round(5 + 10*c.x); o.r = 1.6*LEN[c.length]; }
  else if (name === 'hat808') { o.tone = Math.round(c.x*10)/10; o.decay = (o.decay ?? .05)*LEN[c.length]; }
  else if (name === 'drop') { o.rise = Math.round((.3 + 1.2*c.x)*10)/10; o.decay = (o.decay ?? .035)*LEN[c.length]; }
  else if (['twig', 'stone', 'click', 'insect'].includes(name)) { if (name !== 'insect') o.decay = (o.decay ?? {twig: .02, stone: .018, click: .006}[name])*LEN[c.length]; }
  else if (name === 'leaf') { o.tone = Math.round(c.x*10)/10; o.secs = (o.secs ?? .25)*LEN[c.length]; }
  else if (name === 'bird') { o.warble = Math.round(c.x*.08*100)/100; o.max = .28*LEN[c.length]; }
  else if (name === 'pluck') { o.bright = Math.round((.15 + .8*c.x)*4)/4; o.damp = [.985, .993, .997][c.length]; }
  return o; }

/* ---------- voice leading: the harmony voiced as a chain, every part reading from it ---------- */
// Each chord of a harmony is voiced to move as little as it can from the one before (common tones held, the rest by the
// nearest step, the whole loop solved round so its last chord leads back into its first). The chords column plays that
// voicing; a bass or lead line reads its rungs from the chord's tones starting at an anchor that moves to the nearest
// chord tone (the bass's anchor is always a root), so whatever a clip's rhythm or contour, each line glides from chord to
// chord instead of jumping with the root. STYLES shape the chord: close, open, spread, rootless.
export const STYLES = ['close', 'open', 'spread', 'rootless'];
const SPAN = {close: [0, 12], open: [10, 19], spread: [17, 27], rootless: [0, 12]}, RANGE = {close: [52, 76], open: [48, 79], spread: [43, 84], rootless: [52, 76]};
const pcsOf = (c, root = true) => [...new Set(c.tones.map(t => (c.root + t) % 12))].filter(p => root || p !== c.root % 12);
// every placement of a chord's tones in its style's range, each tone once
// the tones each style voices: close the upper tones over the bass's root (as voice() does), rootless without the root
// or the fifth, open and spread every tone but the fifth when there are many
function placements(c, style){ const r = c.root % 12, f = (c.root + 7) % 12; let pcs = pcsOf(c);
  if (style === 'close') { pcs = [...new Set(c.tones.slice(1).map(t => (c.root + t) % 12))]; if (pcs.length < 3) pcs.push(r); }
  else if (style === 'rootless') { const w = pcs.filter(p => p !== r), x = w.length > 3 ? w.filter(p => p !== f) : w; pcs = x.length >= 3 ? x : w.length >= 3 ? w : pcs; }
  else if (pcs.length > 4) pcs = pcs.filter(p => p !== f);
  pcs = [...new Set(pcs)]; if (style === 'close' && pcs.length > 4) pcs = pcs.filter(p => p !== f); pcs = pcs.slice(0, style === 'close' ? 4 : 5);
  const [lo, hi] = RANGE[style], [s0, s1] = SPAN[style], out = [];
  const go = (i, acc) => { if (i === pcs.length) { const v = [...acc].sort((a, b) => a - b), sp = v.at(-1) - v[0]; if (sp >= s0 && sp <= s1) out.push(v); return; }
    for (let n = lo + ((pcs[i] - lo) % 12 + 12) % 12; n <= hi; n += 12) go(i + 1, [...acc, n]); };
  go(0, []); return out; }
// how far a voicing moves from another: each note to its nearest in the other, both ways
const moveCost = (a, b) => a.reduce((s, n) => s + Math.min(...b.map(m => Math.abs(n - m))), 0) + b.reduce((s, n) => s + Math.min(...a.map(m => Math.abs(n - m))), 0);
const centre = v => v.reduce((s, n) => s + n, 0)/v.length;
// a semitone between neighbouring voices grinds (a ninth against the root a step apart is fine)
const rub = v => v.reduce((s, n, i) => s + (i && n - v[i - 1] === 1 ? 1 : 0), 0);
// a line's anchor on the next chord: the chord tone (or root) nearest the last, pulled gently towards its home
function anchor(c, prev, lo, hi, home, roots){ let best = null, bc = 1e9; for (let n = lo; n <= hi; n++) { const pc = n % 12; if (roots ? pc !== c.root % 12 : !pcsOf(c).includes(pc)) continue;
  const k = Math.abs(n - prev) + .3*Math.abs(n - home); if (k < bc) { bc = k; best = n; } } return best; }
const VL = new Map();
export function vlChain(H, style = 'close'){ const key = H.id + '|' + H.bars.join(',') + '|' + style; if (VL.has(key)) return VL.get(key);
  const cs = H.bars.map(s => chord(s)), n = cs.length; let pv = null, pb = 40, pl = 57; const out = new Array(n);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const c = cs[i], opts = placements(c, style); if (!opts.length) opts.push(voice(c, 57));
    let v = opts[0], bc = 1e9; for (const o of opts) { const k = (pv ? moveCost(o, pv) : 0) + .6*Math.abs(centre(o) - 64) + 6*rub(o); if (k < bc) { bc = k; v = o; } }
    pv = v; pb = anchor(c, pb, 33, 52, 41, true); pl = anchor(c, pl, 50, 66, 57, false); out[i] = {voicing: v, bass: pb, lead: pl}; }
  VL.set(key, out); return out; }
// rung k of a line from its anchor: the chord's tones in order up (and down) from it
export function rungFrom(c, at, k){ const pcs = pcsOf(c).sort((a, b) => a - b), m = pcs.length, i0 = pcs.indexOf(at % 12), i = i0 + k, o = Math.floor(i/m);
  return at - at % 12 + pcs[((i % m) + m) % m] + 12*o; }
// a voicing turned: up moves its lowest note up an octave (an inversion), down its highest down
export const invert = (v, k) => { let w = [...v]; for (let i = 0; i < Math.abs(k); i++) w = k > 0 ? [...w.slice(1), w[0] + 12].sort((a, b) => a - b) : [w.at(-1) - 12, ...w.slice(0, -1)].sort((a, b) => a - b); return w; };

/* ---------- feel: how a column grooves (accents, swing, ahead or behind, a little human) ---------- */
// acc: loudness on each 16th of the beat; swing: the off 16ths late by this share of a 16th (instead of the jam's own);
// push: every note early (−) or late (+), in 16ths; wave: loudness swelling over that many 16ths by `depth`; human:
// random loudness (v) and timing (t, in 16ths)
export const FEELS = [
  {name: 'Straight'},
  {name: 'Off-beat lift', acc: [.72, .42, 1, .48]},
  {name: 'Rolling', acc: [1, .55, .8, .62]},
  {name: 'Ghost notes', acc: [1, .28, .5, .3], human: {v: .12}},
  {name: 'MPC swing', swing: .17},
  {name: 'Detroit shuffle', swing: .25, acc: [1, .6, .85, .68]},
  {name: 'Lazy (behind)', push: .09, swing: .1, acc: [.85, .6, .92, .6]},
  {name: 'Pushed (ahead)', push: -.06, acc: [1, .7, .9, .75]},
  {name: 'Breathing', wave: 32, depth: .5},
  {name: 'Human', human: {v: .22, t: .05}},
];
// the feel on the jam's 16th g: a loudness factor and a timing offset (16ths), with the swing for odd 16ths
export function feelAt(f, g, rnd = Math.random){ let v = 1, dt = f.push || 0;
  if (f.acc) v *= f.acc[((g % 4) + 4) % 4]; if (f.wave) v *= 1 - f.depth*(.5 + .5*Math.cos(2*Math.PI*g/f.wave));
  if (f.human) { v *= 1 + (rnd() - .5)*2*(f.human.v || 0); dt += (rnd() - .5)*2*(f.human.t || 0); }
  return {v, dt}; }

/* ---------- transforms: a clip's shape changed in one move (each makes a new variant) ---------- */
const pitchedSteps = cl => cl.steps.filter(s => typeof s[1] === 'number');
const rungs = cl => pitchedSteps(cl).map(s => s[1]);
const remap = (cl, f) => cl.steps.map(s => typeof s[1] === 'number' && !['kick', 'hats', 'perc'].includes(cl.role) ? [s[0], f(s[1]), ...s.slice(2)] : s.slice());
export const XFORMS = {
  up: cl => remap(cl, k => k + 1), down: cl => remap(cl, k => k - 1),
  flip: cl => { const r = rungs(cl), lo = Math.min(...r), hi = Math.max(...r); return remap(cl, k => lo + hi - k); },
  wide: cl => { const lo = Math.min(...rungs(cl)); return remap(cl, k => lo + (k - lo)*2); },
  narrow: cl => { const lo = Math.min(...rungs(cl)); return remap(cl, k => lo + Math.round((k - lo)/2)); },
  rotate: cl => cl.steps.map(s => [(s[0] + 1) % cl.len, ...s.slice(1)]),
  reverse: cl => cl.steps.map(s => { const l = typeof s[1] === 'number' || s[1] === 'chord' ? Math.max(1, Math.round(s[2] || 1)) : 1; return [((cl.len - s[0] - l) % cl.len + cl.len) % cl.len, ...s.slice(1)]; }),
};
export const XNAMES = {up: '▲ Up', down: '▼ Down', flip: 'Flip', wide: 'Wide', narrow: 'Narrow', rotate: 'Rotate →', reverse: 'Reverse'};
// a part's variants played in turn, one a bar (Follow)
export const FOLLOW = [null, 'AB', 'AAAB', 'ABAC', 'ABCD', 'random'];
export const ARPS = [null, 'up', 'down', 'up and down', 'random'];
export const ECHO = [['⅛·', .75, 4], ['⅛', .5, 3], ['¼', 1, 5], ['¼·', 1.5, 6]];

// a chords part arpeggiated, the same in the jam and the DAW: while a chord the part plays is held, its voices one a 16th
// in the arp's order (ARPS). st: the part's own state, kept between 16ths; notes: what it plays here as written; voices:
// the chord's voices now (chordVoices); rnd for the random order
export function arpStep(st, notes, step, voices, kind, rnd = Math.random){
  if (notes.length) st.cur = {until: step + Math.max(1, Math.round(notes[0][1])), vel: notes[0][2], i: st.cur?.i ?? 0};
  const a = st.cur; if (!a || step >= a.until || !voices.length) return []; const m = voices.length, k = a.i++;
  const j = {up: k % m, down: m - 1 - k % m, 'up and down': m < 2 ? 0 : [...Array(m).keys(), ...[...Array(m).keys()].slice(1, -1).reverse()][k % (2*m - 2)], random: Math.floor(rnd()*m)}[ARPS[kind]];
  return [[voices[j], .9, a.vel]]; }
// the chord's voices at a bar: the voice leading's (ch, the chain), else the chord as voiced alone; turned by inv
export const chordVoices = (H, bar, ch, inv = 0) => { const n = H.bars.length, bi = ((bar % n) + n) % n;
  return invert(ch ? ch[bi].voicing : notesAt({role: 'chords', steps: [[0, 'chord', 1, 1]]}, 0, chordOf(H, bar)).map(x => x[0]), inv); };
