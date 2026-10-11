// The band's ears: what each part plays, read from its loop (and what's played live on the keys and pads): where its
// accents fall in the bar, how busy and how syncopated it is, which notes it leans on and how high it sits, and from all
// the parts together the key (with how sure it is) and the chord in each bar. Pure: loops in, numbers out.
import { readClip } from '../song.js';

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];   // Krumhansl and Kessler's key profiles
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11]};

// a loop as the band hears it: {len, bars, acc[16] (each 16th's weight in the bar, the loudest 1), hits a bar, sync (the
// share of weight off the 8ths), pcs[12] (each pitch class's weight: length × velocity), low (its lowest common note),
// mean (its middle), notes [{s, p, l, v}], perBar [[pcs]]}
export function profile(clip){
  const r = clip && readClip(clip); if (!r || !r.ev.length) return null;
  const acc = new Array(16).fill(0), pcs = new Array(12).fill(0), bars = Math.max(1, r.len/16), notes = [], perBar = Array.from({length: Math.ceil(bars)}, () => new Array(12).fill(0));
  for (const e of r.ev) {
    const w = e.v*(e.p ?? 1); acc[Math.floor(e.s) % 16] += w;
    if (typeof e.n === 'number') { const pw = w*Math.min(4, e.l || 1); pcs[e.n % 12] += pw; perBar[Math.floor(e.s/16) % perBar.length][e.n % 12] += pw; notes.push({s: e.s, p: e.n, l: e.l, v: e.v}); }
  }
  const top = Math.max(...acc) || 1, tot = acc.reduce((a, b) => a + b, 0) || 1;
  const ps = notes.map(n => n.p).sort((a, b) => a - b);
  return {len: r.len, bars, acc: acc.map(x => x/top), hits: r.ev.length/bars, sync: acc.reduce((s, x, i) => s + (i % 2 ? x : 0), 0)/tot, pcs, perBar, notes,
    low: ps.length ? ps[Math.floor(ps.length*.2)] : null, mean: ps.length ? ps.reduce((a, b) => a + b, 0)/ps.length : null};
}
// what was played live (no Rec): [{s (in sixteenths of the song), p, v}] → a profile over the last `bars` bars
export function liveProfile(live, now, bars = 2){
  const from = now - bars*16, ns = live.filter(x => x.s >= from && x.s <= now); if (ns.length < 2) return null;
  const s0 = Math.floor(from/16)*16, clip = {steps: bars*16, notes: ns.map(x => [Math.max(0, Math.round(x.s - s0)) % (bars*16), x.p, x.l || 1, x.v || .8])};
  return profile(clip);
}

// the key from pitch-class weights: the best of the 24 major and minor keys by correlation (a minor one read as dorian or
// phrygian when its sixth or second says so), and how sure: how far the best stands from the next key's
// prefer: the jam's own key; when the best is its relative (A minor and C major share every note) or nearly as good,
// the jam's key is taken, since the notes alone can't tell them apart
export function keyFrom(pcs, prefer = null){
  const tot = pcs.reduce((a, b) => a + b, 0); if (tot <= 0) return null;
  const corr = (prof, r) => { const xs = pcs.map((_, i) => pcs[(i + r) % 12]), mx = xs.reduce((a, b) => a + b, 0)/12, my = prof.reduce((a, b) => a + b, 0)/12;
    let n = 0, dx = 0, dy = 0; for (let i = 0; i < 12; i++) { n += (xs[i] - mx)*(prof[i] - my); dx += (xs[i] - mx)**2; dy += (prof[i] - my)**2; } return n/Math.sqrt(dx*dy || 1); };
  const all = []; for (let r = 0; r < 12; r++) { all.push({root: r, mode: 'major', c: corr(MAJOR, r)}, {root: r, mode: 'minor', c: corr(MINOR, r)}); }
  all.sort((a, b) => b.c - a.c); let best = all[0];
  if (prefer) { const p = all.find(x => x.root === prefer.root && (x.mode === 'major') === (prefer.mode === 'major'));
    const rel = (x, y) => (x.mode === 'major') !== (y.mode === 'major') && ((x.mode === 'major' ? x.root : y.root) - (x.mode === 'major' ? y.root : x.root) + 12) % 12 === 3;
    if (p && p !== best && (rel(p, best) || best.c - p.c < .05)) best = {...p, mode: prefer.mode === 'major' ? 'major' : 'minor'}; }
  if (best.mode === 'minor' && !(prefer && prefer.root === best.root && prefer.mode !== 'major' && prefer.mode !== 'minor')) { const w = i => pcs[(best.root + i) % 12]; if (w(9) > w(8)*1.5 && w(9) > tot*.04) best.mode = 'dorian'; else if (w(1) > w(2)*1.5 && w(1) > tot*.04) best.mode = 'phrygian'; }
  if (prefer && prefer.root === best.root && !['major', 'minor'].includes(prefer.mode) && best.mode === 'minor') best.mode = prefer.mode;   // (the jam's own dorian or phrygian kept)
  const next = all.find(x => !(x.root === best.root && (x.mode === 'major') === (best.mode === 'major')) && !((x.mode === 'major') !== (best.mode === 'major') && ((x.mode === 'major' ? x.root : best.root) - (x.mode === 'major' ? best.root : x.root) + 12) % 12 === 3)) || all[1];
  return {root: best.root, mode: best.mode, name: `${NAMES[best.root]} ${best.mode}`, sure: Math.max(0, Math.min(1, (best.c - next.c)*4 + (best.c - .5)))};
}
export const scaleOf = K => SCALES[K.mode] || SCALES.minor;
// the scale degree d (any integer) above `base`
export const degNote = (K, base, d) => { const sc = scaleOf(K); return base + sc[((d % 7) + 7) % 7] + 12*Math.floor(d/7); };
// a chord on degree d, stacked in thirds: its pitch classes
export const chordPcs = (K, d, n = 3) => [0, 2, 4, 6].slice(0, n).map(k => ((K.root + scaleOf(K)[((d + k) % 7 + 7) % 7]) % 12));

// the chord in each bar: the scale's triads scored by the weight on their notes (the bass's own note counted twice, as
// the root), less what lies outside them; the favourites of the style (i, iv, v, VI) a little ahead, and staying put
// a little ahead of moving. bars: [[pcs]] (the bass's and the chords' together); bass: [[pcs]] or null
export function chordsFrom(K, bars, bass = null){
  let prev = 0;
  return bars.map((w, b) => {
    const tot = w.reduce((a, x) => a + x, 0); if (tot <= 0) return prev;
    let best = prev, bs = -Infinity;
    for (let d = 0; d < 7; d++) {
      const pc = chordPcs(K, d), inside = pc.reduce((s, x) => s + w[x], 0), root = bass && bass[b] ? bass[b][pc[0]]*2 : 0;
      const sc = (inside - .5*(tot - inside) + root)/tot + ([0, 3, 4, 5].includes(d) ? .06 : 0) + (d === prev ? .05 : 0);
      if (sc > bs) { bs = sc; best = d; }
    }
    return prev = best;
  });
}

// every part heard at once: each one's profile, the key (from the notes of every part, and what's been played live),
// the chords bar by bar (from the bass and the chords), the accents of the parts the user made, summed
const songKey = core => { const m = /^([A-G][#b]?)\s*(\w+)?/.exec(core.song.key || 'A minor') || []; const n = (m[1] || 'A').replace(/(.)b/, (x, l) => NAMES[(NAMES.indexOf(l) + 11) % 12]); return {root: Math.max(0, NAMES.indexOf(n)), mode: (m[2] || 'minor').toLowerCase()}; };
export function hearAll(core, live = null){
  const P = {}, lanes = core.PARTS.map(p => p.key);
  for (const k of lanes) { const l = core.lane(k); P[k] = !l.mute && l.take ? profile(core.clip(k)) : null; }
  const pcs = new Array(12).fill(0);
  for (const k of lanes) if (P[k]) P[k].pcs.forEach((x, i) => pcs[i] += x*(k === 'bass' ? 1.5 : 1));
  if (live) live.pcs.forEach((x, i) => pcs[i] += x*2);
  const K = keyFrom(pcs, songKey(core));
  const nb = Math.max(1, ...['bass', 'chords'].map(k => P[k] ? P[k].perBar.length : 1));
  const bars = Array.from({length: nb}, (_, b) => { const w = new Array(12).fill(0); for (const k of ['bass', 'chords']) if (P[k]) P[k].perBar[b % P[k].perBar.length].forEach((x, i) => w[i] += x); return w; });
  const chords = K ? chordsFrom(K, bars, P.bass ? Array.from({length: nb}, (_, b) => P.bass.perBar[b % P.bass.perBar.length]) : null) : null;
  return {P, K, chords, live};
}
