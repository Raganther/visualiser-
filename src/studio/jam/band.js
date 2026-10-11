// The band: it plays the parts that aren't yours, listening to the ones that are. What you play or edit by hand is yours
// (its role "Mine": the band leaves it be and plays round it); every other part has a role:
//  - follow: plays with your accents (the bass on your rhythm's strong steps, the chords with the bass's notes);
//  - complement: plays in your gaps (the hats where your rhythm is quiet, the chords where the bass rests);
//  - contrast: does the opposite (sparse and long when you're busy, busy when you're sparse; another register);
//  - answer: call and response (your phrase comes back changed, in the bars after: echoed up the scale, turned upside
//    down, played backwards, shifted, repeated a step higher);
//  - free: its own idea, in the key.
// The conductor listens all the time (hear.js: the key, the chords bar by bar, each part's accents, what you play live)
// and decides a bar before each phrase line, so a change lands on it: something of yours changed, or you played something
// new on the keys, and the parts that depend on it are fitted again; nothing changed, and now and then (Lead) it takes
// the initiative itself: a variation, a new idea, a part stepping out for a phrase and coming back. It says what it did.
import { rng, makeDrums, makeBass, makeChords, makeHook, euclid, vary as varyClip, grooveOf } from '../improv.js';
import { profile, liveProfile, hearAll, degNote, chordPcs, scaleOf, NAMES } from './hear.js';
import { VOICES } from './song.js';

export const ROLES = {
  mine: {label: 'Mine', words: 'yours: the band leaves it and plays round it'},
  follow: {label: 'Follow', words: 'plays with your accents'},
  complement: {label: 'Fill', words: 'plays in your gaps'},
  contrast: {label: 'Contrast', words: 'the opposite: sparse when you are busy, busy when sparse'},
  answer: {label: 'Answer', words: 'call and response: your phrase comes back changed'},
  free: {label: 'Free', words: 'its own idea, in the key'}};
export const DEFAULT = {drums: 'free', hats: 'complement', perc: 'complement', bass: 'complement', chords: 'follow', hook: 'answer'};
const ORDER = ['drums', 'hats', 'perc', 'bass', 'chords', 'hook'];
const NAME = {drums: 'Kick & snare', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', hook: 'Hook'};
const HATM = [.55, .32, 1, .42];
const dig = v => String(Math.max(1, Math.min(9, Math.round(v*9))));
const row = (n, f) => Array.from({length: n}, (_, i) => f(i)).join('');

/* ---------- the parts, fitted to the rest ---------- */
// ctx: {H (hearAll), roles, energy, expr, style, seed, src: the parts it listens to}
// the accents of the parts it listens to, summed and scaled to 1 (what "your rhythm" is), and the kick's steps
const accOf = (H, ids) => { const a = new Array(16).fill(0); for (const k of ids) if (H.P[k]) H.P[k].acc.forEach((x, i) => a[i] += x); const t = Math.max(...a) || 1; return a.map(x => x/t); };
const kickSteps = core => { const c = core.clip('drums'); return c ? grooveOf(c).kick : new Set([0, 4, 8, 12]); };
const keyName = K => `${NAMES[K.root]} ${K.mode}`;
// a pitch to the nearest note of the scale
const snap = (K, p) => { const sc = scaleOf(K); for (let d = 0; d < 7; d++) for (const s of [1, -1]) { const q = p + s*d; if (sc.includes(((q - K.root) % 12 + 12) % 12)) return q; } return p; };
// a pitch's degree above a base (the scale's steps), for moving it along the scale
const degOf = (K, base, p) => { p = snap(K, p); for (let d = -21; d < 35; d++) if (degNote(K, base, d) === p) return d; return 0; };
const bassBase = K => 24 + K.root + (K.root < 2 ? 12 : 0), padBase = K => 48 + K.root, hookBase = K => 60 + K.root - (K.root > 4 ? 12 : 0);

function genBass(ctx){
  const {H, role, energy, expr, style, seed, core} = ctx, K = H.K, r = rng(seed*131 + 7), kick = kickSteps(core), A = accOf(H, ctx.src), chords = H.chords || [0], base = bassBase(K);
  if (role === 'free' || !ctx.src.length && role !== 'contrast') { const c = makeBass({style, energy, expr, seed, key: keyName(K), groove: core.clip('drums') ? grooveOf(core.clip('drums')) : null, bars: 4}); return refit(K, c, chords, base); }
  let steps;
  const free = i => !kick.has(i);
  const busy = A.filter(x => x > .3).length;
  if (role === 'follow') steps = [...Array(16).keys()].filter(free).sort((a, b) => A[b] - A[a]).slice(0, Math.round(3 + 5*energy)).sort((a, b) => a - b);
  else if (role === 'contrast') steps = busy > 7 ? [2, 10] : [...Array(16).keys()].filter(i => free(i) && (i % 2 || r.chance(.5 + .4*energy)));
  else steps = [...Array(16).keys()].filter(i => free(i) && A[i] < .35 && (i % 4 === 2 || r.chance(.35 + .45*energy)));
  if (steps.length < 2) steps = [2, 10].filter(free);
  const len = role === 'contrast' && busy > 7 ? 6 : steps.length > 8 ? .45 : .7, notes = [];
  for (let b = 0; b < 4; b++) {
    const c = chords[b % chords.length], next = chords[(b + 1) % chords.length];
    steps.forEach((s, i) => {
      // (the root on the strong steps, the fifth or octave between, and the bar's last note leading to the next chord now and then)
      let d = c + (A[s] > .6 || i === 0 ? 0 : r.weighted([[0, 4], [4, 1.5], [7, 1.2], [2, .5]]));
      if (i === steps.length - 1 && next !== c && r.chance(.4)) d = next + r.pick([1, -1]);
      notes.push([b*16 + s, degNote(K, base, d), len, Math.round(Math.max(.4, Math.min(1, .7 + .25*A[s] + expr*.15*(r() - .5)))*100)/100]);
    });
  }
  return {bars: 4, notes};
}
// a made line put on the chords heard: each note moved by the bar's chord's distance from the key's root
function refit(K, c, chords, base){ if (!c.notes || !chords) return c; const n = (c.steps || c.bars*16);
  c.notes = c.notes.map(x => { const b = Math.floor(x[0]/16) % chords.length, d = degOf(K, base, x[1]) + chords[b]; return [x[0], degNote(K, base, d), ...x.slice(2)]; }); void n; return c; }

function genChords(ctx){
  const {H, role, energy, expr, style, seed} = ctx, K = H.K, r = rng(seed*977 + 3), chords = H.chords || [0], base = padBase(K);
  if (role === 'free') return makeChords({style, energy, expr, seed, key: keyName(K), bass: H.P.bass ? H.P.bass.notes.map(n => [n.s, n.p, n.l, n.v]) : null, bars: 4});
  const bassAcc = H.P.bass ? H.P.bass.acc : accOf(H, ctx.src), busy = bassAcc.filter(x => x > .3).length, notes = [];
  let prev = null;
  for (let b = 0; b < 4; b++) {
    // (each chord voiced nearest the last: the inversion whose notes move least)
    const d = chords[b % chords.length], tones = [0, 2, 4, 6].map(k => degNote(K, base, d + k));
    let best = tones, bm = Infinity;
    for (let inv = 0; inv < 4; inv++) { const v = tones.map((p, i) => i < inv ? p + 12 : p).sort((x, y) => x - y), m = prev ? v.reduce((s, p, i) => s + Math.abs(p - prev[i]), 0) : Math.abs(v[0] - base - 3);
      if (m < bm) { bm = m; best = v; } }
    prev = best;
    let at;
    if (role === 'follow') at = [...Array(16).keys()].sort((x, y) => bassAcc[y] - bassAcc[x]).slice(0, 1 + Math.round(energy*2)).sort((x, y) => x - y).map(s => [s, .6]);
    else if (role === 'contrast') at = busy > 6 ? [[0, 15.5]] : [2, 6, 10, 14].slice(0, 2 + Math.round(energy*2)).map(s => [s, .5]);
    else if (role === 'answer') at = b % 2 ? [6, 10, 14].slice(0, 1 + Math.round(energy*2)).map(s => [s, .6]) : [];
    else at = [14, 6, 10, 3, 11, 7].filter(s => bassAcc[s] < .25).slice(0, 1 + Math.round(energy*1.5)).map(s => [s, .6]);
    for (const [s, l] of at) notes.push([b*16 + s, best, l, Math.round((l > 4 ? .45 : .55 + expr*.3*(r() - .3))*100)/100]);
  }
  return {bars: 4, notes: notes.sort((a, b) => a[0] - b[0])};
}

// the phrase to answer: what was just played live, else the first part of yours with notes (or the bass, whoever's)
function phraseOf(ctx){
  const {H} = ctx;
  if (H.live && H.live.notes.length >= 2) return {notes: H.live.notes, from: 'what you just played'};
  for (const k of [...ctx.src.filter(k => ['bass', 'chords', 'hook'].includes(k)), 'bass', 'chords']) if (H.P[k] && H.P[k].notes.length >= 2 && k !== 'hook') return {notes: k === 'chords' ? topLine(H.P[k].notes) : H.P[k].notes, from: ctx.src.includes(k) ? `your ${NAME[k].toLowerCase()}` : `the ${NAME[k].toLowerCase()}`};
  return null;
}
const topLine = ns => { const by = {}; for (const n of ns) { const s = Math.floor(n.s); if (!by[s] || n.p > by[s].p) by[s] = n; } return Object.values(by); };
// the ways a phrase comes back
const TRANSFORMS = {
  echo: (K, ph, base) => ph.map(n => ({...n, p: degNote(K, base, degOf(K, base, n.p) + 2)})),
  invert: (K, ph, base) => { const d0 = degOf(K, base, ph[0].p); return ph.map(n => ({...n, p: degNote(K, base, 2*d0 - degOf(K, base, n.p))})); },
  retro: (K, ph) => { const L = 16; return ph.map(n => ({...n, s: (L - 1 - Math.floor(n.s % 16) + 16) % 16})).sort((a, b) => a.s - b.s); },
  shift: (K, ph) => ph.map(n => ({...n, s: (Math.floor(n.s) + 2) % 16})),
  climb: (K, ph, base) => ph.map((n, i) => ({...n, p: degNote(K, base, degOf(K, base, n.p) + Math.floor(i/2))})),
  fragment: (K, ph) => { const f = ph.slice(0, 3), span = Math.max(...f.map(n => n.s % 16)) - Math.min(...f.map(n => n.s % 16)) + 2; return [...f, ...f.map(n => ({...n, s: n.s + span}))].filter(n => n.s < 16); }};
function genHook(ctx){
  const {H, role, energy, expr, style, seed} = ctx, K = H.K, r = rng(seed*211 + 5), chords = H.chords || [0], base = hookBase(K);
  const ph = phraseOf(ctx);
  if (role === 'free' || !ph) return makeHook({style, energy, expr, seed, key: keyName(K), bars: 2});
  // the phrase brought into the hook's register (octaves, so its shape stays), on the scale
  const mid = ph.notes.reduce((s, n) => s + n.p, 0)/ph.notes.length, shift = 12*Math.round((base + 7 - mid)/12);
  const call = ph.notes.filter(n => n.s < 16).map(n => ({s: Math.floor(n.s), p: snap(K, n.p + shift), l: Math.min(2, n.l || 1), v: n.v || .8}));
  const src = call.length >= 2 ? call : ph.notes.slice(0, 6).map((n, i) => ({s: i*2, p: snap(K, n.p + shift), l: 1, v: .8}));
  const notes = [];
  if (role === 'answer') {
    const keys = Object.keys(TRANSFORMS), a = r.pick(keys), b = r.pick(keys.filter(k => k !== a));
    TRANSFORMS[a](K, src, base).forEach(n => notes.push([16 + n.s, n.p, n.l, Math.round(n.v*.9*100)/100]));
    TRANSFORMS[b](K, src, base).forEach(n => notes.push([48 + n.s, n.p, n.l, Math.round(n.v*.9*100)/100]));
    return {bars: 4, notes: notes.sort((x, y) => x[0] - y[0]), how: `${a} then ${b}`};
  }
  const srcAcc = new Array(16).fill(0); for (const n of src) srcAcc[n.s % 16] += 1;
  for (let b = 0; b < 4; b++) {
    const c = chords[b % chords.length], ct = [0, 2, 4, 7].map(k => degNote(K, base, c + k));
    if (role === 'follow') src.forEach((n, i) => notes.push([b*16 + n.s, ct[i % 3], n.l, n.v]));
    else if (role === 'contrast') { if (src.length > 6) { notes.push([b*16 + 4, ct[1], 6, .6], [b*16 + 12, ct[2], 3, .5]); }
      else for (let s = 1; s < 16; s += 2) if (r.chance(.4 + .5*energy)) notes.push([b*16 + s, ct[(s >> 1) % 4], .5, .6 + .2*(s % 4 === 3)]); }
    else for (let s = 0; s < 16; s++) if (!srcAcc[s] && !srcAcc[(s + 15) % 16] && r.chance(.12 + .25*energy)) notes.push([b*16 + s, r.pick(ct), .8, .65]);
  }
  return {bars: 4, notes: notes.sort((x, y) => x[0] - y[0])};
}

// the hats: in the gaps of your rhythm (fill), on its accents (follow), or against its density (contrast)
function genHats(ctx){
  const {H, role, energy, expr, style, seed} = ctx, r = rng(seed*53 + 9), A = accOf(H, ctx.src);
  if (role === 'free' || !ctx.src.length) { const c = makeDrums({style, energy, expr, seed, part: 'hats', bars: 2}); return {bars: 2, hits: {chh: c.hits.chh, ...(c.hits.ohh ? {ohh: c.hits.ohh} : {})}}; }
  const busy = A.filter(x => x > .3).length;
  const on = i => role === 'follow' ? A[i] > .5 || i % 4 === 2 : role === 'contrast' ? (busy > 7 ? i % 4 === 2 : true) : (A[i] < .35 && (i % 4 === 2 || r.chance(.3 + .6*energy)));
  const chh = row(32, i => { const q = i % 16; if (!on(q)) return '.'; const v = .45 + expr*.5*(HATM[q % 4] - .5) + .1*(r() - .5); return v < .35 && expr > .4 && r.chance(.5) ? '?' : dig(v); });
  const ohh = energy > .6 && role !== 'contrast' ? row(32, i => i % 16 === 10 && r.chance(.7) ? dig(.6) : '.') : null;
  return {bars: 2, hits: {chh: ohh ? [...chh].map((c, i) => ohh[i] !== '.' ? '.' : c).join('') : chh, ...(ohh ? {ohh} : {})}};
}
// the percussion: a euclidean figure turned to sit where your rhythm isn't (fill) or is (follow), or odd lengths (contrast)
function genPerc(ctx){
  const {H, role, energy, expr, style, seed} = ctx, r = rng(seed*71 + 1), A = accOf(H, ctx.src);
  if (role === 'free' || !ctx.src.length) { const kick = (core => { const c = core.clip('drums'); return c && c.hits && c.hits.kick; })(ctx.core); const c = makeDrums({style, energy, expr, seed, part: 'perc', bars: 2, base: kick ? {kick} : null}); delete c.hits.kick; return {bars: 2, hits: c.hits}; }
  const fig = (n, k) => { let best = 0, bs = role === 'follow' ? -Infinity : Infinity;
    for (let rot = 0; rot < n; rot++) { const p = euclid(k, n, rot), ov = p.reduce((s, x, i) => s + x*A[i % 16], 0); if (role === 'follow' ? ov > bs : ov < bs) { bs = ov; best = rot; } }
    return euclid(k, n, best).map((x, i) => x ? dig(.45 + .35*(i === 0) + expr*.15*(r() - .5)) : '.').join(''); };
  const hits = role === 'contrast' ? {rim: fig(r.pick([5, 7]), 2), shaker: fig(7, r.pick([3, 4]))} : {rim: fig(16, r.pick([3, 5])), ...(energy > .45 ? {shaker: fig(16, energy > .7 ? 11 : 7)} : {}), ...(energy > .65 ? {clave: fig(16, 3)} : {})};
  return {bars: 2, hits};
}
// the kick and snare: the style's own (free), with ghost notes where your rhythm leans (follow) or where it leaves room (fill)
function genDrums(ctx){
  const {H, role, energy, expr, style, seed} = ctx, r = rng(seed*17 + 3), A = accOf(H, ctx.src);
  const c = makeDrums({style: role === 'contrast' ? 'dub' : style, energy, expr, seed, part: 'drums', bars: 2}), hits = {};
  for (const v of VOICES.drums) if (c.hits[v]) hits[v] = c.hits[v];
  if ((role === 'follow' || role === 'complement') && ctx.src.length) {
    const sn = [...(hits.snare || '.'.repeat(32)).padEnd(32, '.')];
    for (let i = 0; i < 32; i++) { const q = i % 16, k = hits.kick && hits.kick[i] !== '.'; if (sn[i] === '.' && !k && (role === 'follow' ? A[q] > .6 : A[q] < .1 && q % 2) && r.chance(.35)) sn[i] = dig(.3); }
    hits.snare = sn.join('');
  }
  return {bars: 2, hits};
}
const GEN = {drums: genDrums, hats: genHats, perc: genPerc, bass: genBass, chords: genChords, hook: genHook};

/* ---------- the conductor ---------- */
export function makeBand(core){
  const J = core.J, B = J.band = {on: false, lead: .35, roles: {...DEFAULT}, ...(J.band || {})};
  for (const k of ORDER) if (!B.roles[k]) B.roles[k] = DEFAULT[k];
  const st = {log: [], heard: null, next: '', live: [], last: {}, out: {}, bar: -1};
  const subs = new Set(), emit = () => { for (const f of subs) f(st); };
  const say = s => { st.log = [{bar: st.bar + 2, s}, ...st.log].slice(0, 12); emit(); };
  const mine = k => B.roles[k] === 'mine';
  const ofYours = () => ORDER.filter(mine);
  // what's played live (on the keys and pads, recording or not), in the song's sixteenths, for the band to hear
  const offLive = core.on(w => { if (!w || typeof w !== 'object') return;
    if (w.note && w.on) { st.live.push({k: w.note, s: core.pos(), p: w.n, v: .8, l: 1}); st.livePlayed = true; }
    if (w.note && !w.on) { const x = [...st.live].reverse().find(x => x.p === w.n && x.k === w.note); if (x) x.l = Math.max(.5, core.pos() - x.s); }
    if (st.live.length > 96) st.live.splice(0, st.live.length - 96); });
  // a part you play or edit by hand becomes yours
  const offMine = core.on(w => { if (w === 'notes' || w === 'takes') for (const k of ORDER) { const c = core.clip(k); if (c && c.by === 'you' && !mine(k)) { B.roles[k] = 'mine'; say(`${NAME[k]} is yours now: the band plays round it`); } } });
  const hear = () => { const now = core.pos(), lp = st.livePlayed ? liveProfile(st.live.filter(x => ['bass', 'chords', 'hook'].includes(x.k)), now, 2) : null;
    const H = hearAll(core, lp); if (!H.K) H.K = keyFromSong(core); st.heard = H; return H; };
  const keyFromSong = core => { const m = /^([A-G][#b]?)\s*(\w+)?/.exec(core.song.key || 'A minor') || []; return {root: Math.max(0, NAMES.indexOf((m[1] || 'A').replace('b', '#'))), mode: (m[2] || 'minor').toLowerCase(), sure: 0}; };
  // one part made again in its role, round what it hears (a new take, landing on the next bar line)
  function fit(k, why){
    const H = st.heard || hear(), src = ofYours().filter(x => x !== k), role = B.roles[k];
    const clip = GEN[k]({H, role, core, energy: J.energy, expr: J.expr, style: J.style, seed: J.seed++, src: src.length ? src : ORDER.filter(x => x !== k && H.P[x])});
    if (!clip) return;
    core.put(k, clip, 'band');
    if (why) say(`${NAME[k]}: ${why}${clip.how ? ` (${clip.how.replace('then', 'and')})` : ''}`);
  }
  // everything of the band's fitted at once (the band coming in, or Fit now)
  function fitAll(why = 'fitted to what you play'){ hear(); for (const k of ORDER) if (!mine(k)) fit(k, null); say(`The band ${why}`); snap(); }
  // how each part of yours sounded at the last decision, and whether anything's been played live since
  const sig = k => JSON.stringify(core.clip(k) || null);
  function snap(){ for (const k of ORDER) st.last[k] = sig(k); st.livePlayed = false; }
  function decide(){
    const H = hear(), changed = ofYours().filter(k => st.last[k] !== sig(k)), played = st.livePlayed && H.live;
    // (parts that stepped out come back first)
    for (const [k, back] of Object.entries(st.out)) if (st.bar + 1 >= back) { delete st.out[k]; core.mute(k, false); say(`${NAME[k]} comes back in`); }
    if (changed.length || played) {
      const what = played ? 'what you just played' : changed.map(k => `your ${NAME[k].toLowerCase()}`).join(' and ');
      const deps = ORDER.filter(k => !mine(k) && B.roles[k] !== 'free' && !core.lane(k).mute);
      for (const k of deps) fit(k, `${ROLES[B.roles[k]].label.toLowerCase()} — listening to ${what}`);
      snap(); return;
    }
    snap();
    const r = rng((J.seed++)*7 + 1);
    if (!r.chance(B.lead)) return;
    // the band's own move: mostly a variation, sometimes a new idea, now and then a part steps out for a phrase
    const band = ORDER.filter(k => !mine(k) && core.lane(k).take && !core.lane(k).mute && !st.out[k]), playing = ORDER.filter(k => core.lane(k).take && !core.lane(k).mute);
    if (!band.length) return;
    const k = r.pick(band.filter(x => x !== st.lastMove).length ? band.filter(x => x !== st.lastMove) : band); st.lastMove = k;
    const act = r.weighted([['vary', .55], ['new', .25], ['out', playing.length >= 4 && k !== 'drums' ? .2 : 0]]);
    if (act === 'vary') { const c = core.clip(k); if (!c) return; const v = varyClip(c, {seed: J.seed++, amount: .25 + .35*J.energy, key: core.song.key}); core.put(k, v, 'band'); say(`${NAME[k]}: a variation`); }
    else if (act === 'new') fit(k, `a new idea (${ROLES[B.roles[k]].label.toLowerCase()})`);
    else { core.mute(k, true); st.out[k] = st.bar + 1 + 4*(B.phrase || 4); say(`${NAME[k]} steps out for a phrase`); }
  }
  // the clock: a bar before each phrase line, decide (so what it makes lands on the line)
  const tick = setInterval(() => {
    if (!B.on || !core.playing()) return;
    const bar = Math.floor(core.pos()/16); if (bar === st.bar) return; st.bar = bar;
    const ph = B.phrase || 4; if ((bar + 1) % ph === 0) decide();
    // (a hint of what it heard, kept fresh)
    if (bar % 2 === 0) { hear(); emit(); }
  }, 60);
  // the band coming in plays all its parts round yours (what they played before stays in their takes, a tap away)
  function setOn(on){ B.on = on; if (on) { if (!core.playing()) core.start(); const its = ORDER.filter(k => !mine(k)); hear(); for (const k of its) fit(k, null);
    say(its.length ? `The band comes in on ${its.map(k => NAME[k].toLowerCase()).join(', ')}${ofYours().length ? `, round your ${ofYours().map(k => NAME[k].toLowerCase()).join(' and ')}` : ''}` : 'Every part is yours: the band is listening'); snap(); }
    else say('The band stops: your parts as they are'); emit(); }
  function setRole(k, role){ B.roles[k] = role; if (role !== 'mine' && core.clip(k)) { const c = core.clip(k); if (c.by === 'you') c.by = 'band'; } emit(); if (B.on && role !== 'mine') fit(k, `now ${ROLES[role].label.toLowerCase()}`); }
  return {state: st, B, ROLES, setOn, setRole, setLead: x => { B.lead = x; emit(); }, fitAll, decide, hear, on: f => (subs.add(f), () => subs.delete(f)), dispose(){ clearInterval(tick); offLive(); offMine(); }};
}
