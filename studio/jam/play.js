// Studio Jam's Play: a part improvised on as a player would, on top of its clip (which never changes). Hats and percussion
// leave notes out, add ghost notes, open a hat, move the accent and roll into the next phrase; a melody skips a note, steps
// to the next chord tone, repeats one, jumps an octave, and the two leads take turns resting. It follows the phrase (the
// first beat of a bar always as written, changes growing to the phrase's last bar, the fills there), holds each idea for a
// couple of bars before the next, and lets the loudness drift over bars rather than note to note.

// how much it plays round the clip
export const PLAYS = [{name: 'Off', a: 0}, {name: 'Light', a: .35}, {name: 'Loose', a: .65}, {name: 'Wild', a: 1}];
const DRUMS = ['kick', 'hats', 'perc'];

// a number in [0, 1) from integers: the same idea plays the same way each time it comes round
const hash = (...xs) => { let h = 2166136261; for (const x of xs) { h ^= x | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; h = Math.imul(h, 2246822507); } h ^= h >>> 16; return (h >>> 0)/4294967296; };
const KEY = {drop: 1, open: 2, ghost: 3, t: 4, skip: 5, nb: 6, nbUp: 7, oct: 8, rep: 9, fill: 10, kind: 11, acc: 12, wave: 13, rest: 14, restBar: 15, hold: 16, seed: 17};

// the events a part plays on one 16th: [{s, dt, fv}] (s a step in the clip's format at `pos`, dt a timing offset in 16ths,
// fv a loudness factor). o: {role, clip, pos, step (the jam's 16th), bar (in the harmony), lane (0 or 1, the two leads),
// a (how much), mem (the part's own memory), seed (the jam's, shared by every part)}
export function improvise({role, clip, pos, step, bar, lane = 0, a, mem, seed = 1}){
  const here = clip.steps.filter(s => s[0] === pos), drum = DRUMS.includes(role);
  if (!a) return here.map(s => ({s, dt: 0, fv: 1}));
  const q = ((step % 16) + 16) % 16, ph = ((bar % 4) + 4) % 4, phrase = Math.floor(bar/4);
  // an idea lasts two or three bars, then another; the phrase's last bar has its own
  if (mem.until == null || bar >= mem.until || bar < mem.from) { mem.from = bar; mem.idea = Math.floor(hash(seed, KEY.seed, bar, lane, DRUMS.indexOf(role))*1e9); mem.until = bar + (hash(mem.idea, KEY.hold) < .5 ? 2 : 3); }
  const idea = ph === 3 ? Math.floor(hash(mem.idea, phrase, 99)*1e9) : mem.idea, r = k => hash(idea, KEY[k], q, lane);
  // how likely a change is here: none on the bar's first beat, growing through the phrase and towards the bar's end
  const shape = q === 0 ? 0 : (.35 + .65*ph/3)*(q >= 12 ? 1.4 : 1);
  // the loudness: a slow swell over bars, and an accent that moves with each idea
  const acc = Math.floor(hash(mem.idea, KEY.acc)*4), wave = 1 + a*.18*Math.sin(2*Math.PI*(step/64 + hash(seed, KEY.wave, lane)));
  const fvAt = qq => wave*(qq % 4 === acc ? 1 + .22*a : 1 - .07*a);
  const dtAt = k => (r(k) - .5)*.08*a;

  if (drum) {
    if (role === 'kick') return here.map(s => ({s, dt: 0, fv: 1 + (fvAt(q) - 1)*.4}));   // the anchor: only a little dynamics
    const vs = clip.steps.map(s => s[1]), common = vs.sort((x, y) => vs.filter(v => v === y).length - vs.filter(v => v === x).length)[0];
    const loud = Math.max(...clip.steps.map(s => s[2])), soft = Math.min(...clip.steps.map(s => s[2]));
    // the fill: the phrase's last beat rolled, as triplets, triplet 16ths or a 32nd roll, getting louder
    if (role === 'hats' && ph === 3 && q >= 12 && clip.steps.length && hash(idea, KEY.fill) < .7*a) {
      if (q !== 12) return [];
      const kind = Math.floor(hash(idea, KEY.kind)*(a > .8 ? 3 : 2)), n = [3, 6, 8][kind], gap = 4/n;
      return Array.from({length: n}, (_, i) => ({s: [pos, common, loud], dt: i*gap, fv: .45 + .55*i/(n - 1)})); }
    if (!here.length) {
      // a ghost note in a gap, soft
      if (clip.steps.length && r('ghost') < .22*a*shape) return [{s: [pos, common, soft], dt: dtAt('t'), fv: .4*wave}];
      return []; }
    const out = [];
    for (const s of here) {
      const off = q % 4 !== 0, p = (off ? .3 : .1)*a*shape;
      if (q && r('drop') < p) continue;
      let v = s[1]; if (role === 'hats' && v === 'chh' && q % 4 === 2 && r('open') < .12*a*shape) v = 'ohh';
      out.push({s: v === s[1] ? s : [s[0], v, s[2]], dt: q ? dtAt('t') : 0, fv: fvAt(q)}); }
    return out; }

  // a melody or bass line: the two leads take turns resting a bar in the phrase (never the first, never both at once)
  if (role === 'lead' && a >= .5 && ph) { const x = Math.floor(hash(seed, phrase, KEY.restBar)*3), mine = 1 + (x + lane) % 3;
    if (ph === mine && hash(seed, phrase, KEY.rest, lane) < .35*a) return []; }
  if (!here.length) {
    // an echo of the note just played, softer
    const prev = clip.steps.find(s => typeof s[1] === 'number' && (s[0] === (pos - 1 + clip.len) % clip.len || s[0] === (pos - 2 + clip.len) % clip.len));
    if (prev && role !== 'bass' && r('rep') < .15*a*shape) return [{s: [pos, ...prev.slice(1)], dt: dtAt('t'), fv: .55*wave}];
    return []; }
  const out = [];
  for (const s of here) {
    if (typeof s[1] !== 'number') { out.push({s, dt: 0, fv: fvAt(q)}); continue; }
    if (q && r('skip') < .22*a*shape) continue;
    const t = s.slice(); if (q && r('nb') < .25*a*shape) t[1] += r('nbUp') < .5 ? 1 : -1;
    if (role === 'lead' && q && r('oct') < .07*a*shape) t[4] = (t[4] || 0) + 1;
    out.push({s: t, dt: q ? dtAt('t') : 0, fv: fvAt(q)}); }
  return out;
}

// every note the improviser may reach from a clip, for computing them ahead: the steps a chord tone up and down and an
// octave up, and on the hats the open hat
export function reach(role, clip){
  if (DRUMS.includes(role)) return role === 'hats' ? [{...clip, steps: clip.steps.filter(s => s[1] === 'chh').map(s => [s[0], 'ohh', s[2]])}] : [];
  const sh = f => ({...clip, steps: clip.steps.map(s => typeof s[1] === 'number' ? f(s.slice()) : s)});
  return [sh(s => (s[1] += 1, s)), sh(s => (s[1] -= 1, s)), ...(role === 'lead' ? [sh(s => (s[4] = (s[4] || 0) + 1, s))] : [])];
}

// what was played, as a clip: the events heard over a window of the jam's 16ths, each at its step (rounded to the 16th)
// and as loud as it was played, one note per step and voice
export function keep(heard, from, len){
  const out = new Map();
  for (const {step, s, dt, fv} of heard) { if (step < from || step >= from + len) continue;
    const p = ((step - from + Math.round(dt)) % len + len) % len, k = p + '|' + s[1] + '|' + (s[4] || 0);
    if (out.has(k)) continue; const t = s.slice(); t[0] = p; const vi = typeof s[1] === 'number' || s[1] === 'chord' ? 3 : 2;
    t[vi] = Math.round(Math.min(1, Math.max(.15, s[vi]*fv))*20)/20; out.set(k, t); }
  return [...out.values()].sort((x, y) => x[0] - y[0]);
}
