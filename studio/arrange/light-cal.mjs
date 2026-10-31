// How much louder each role's lighter start leaves it (LIGHT in studio/lib/parts/desk.js), against Claude's full chains,
// measured offline over round 4's songs as the Mix Lab plays them: the numbers for ROLE_CAL_LIGHT, so a track's level
// stays where it was with fewer processors. Usage: node studio/arrange/light-cal.mjs (a few minutes)
import { songOf } from '../mix/song.mjs';
import { mixOf, eventsOf } from '../mix/mix.js';
import { Host } from '../lib/parts/host.js';
import { LIGHT, ROLE_CAL } from '../lib/parts/desk.js';
const sr = 44100, D10 = (a, b) => 10*Math.log10(a/b);
function run(P, SND, D){ const H = new Host(sr), e = {}; H.build(D); for (const ev of eventsOf(P, SND, 0, D.set)) H.msg({...ev.m, t: ev.t});
  for (const s of H.st) if (s.input) { const go = s.chain.run.bind(s.chain), o = e[s.id] = {in: 0, out: 0, role: s.role};
    s.chain.run = (L, R, a, b, env) => { for (let j = a; j < b; j++) o.in += L[j]*L[j] + R[j]*R[j]; go(L, R, a, b, env); for (let j = a; j < b; j++) o.out += L[j]*L[j] + R[j]*R[j]; }; }
  const n = Math.ceil((P.bars*2 + 2)*sr), L = new Float64Array(128), R = new Float64Array(128); for (let a = 0; a < n; a += 128) { L.fill(0); R.fill(0); H.process(L, R, 128, a/sr); }
  return e; }
const diff = {};
for (const id of ['r4-1', 'r4-2', 'r4-3']) { const {P, SND} = songOf(id), full = mixOf(P, SND, 'song'), light = mixOf(P, SND, 'song');
  for (const s of light.strips) if (s.input) { const trim = s.chain.find(c => c.key === 'trim'), key = s.chain.find(c => c.key === 'sidechain')?.params.key ?? 'kick';
    s.chain = [trim, ...(LIGHT[s.role] || LIGHT.lead)(key).map(c => ({...c, id: s.id + '-' + c.key}))]; }
  const a = run(P, SND, full), b = run(P, SND, light);
  for (const [k, o] of Object.entries(a)) { const q = b[k]; if (!(o.in > 1e-6)) continue; (diff[o.role] ||= []).push(D10(o.out, o.in) - D10(q.out, q.in)); console.log(id, k, o.role, (D10(o.out, o.in) - D10(q.out, q.in)).toFixed(2)); } }
const out = {}; for (const [r, v] of Object.entries(diff)) out[r] = +(ROLE_CAL[r] - v.reduce((x, y) => x + y)/v.length).toFixed(1);
console.log('ROLE_CAL_LIGHT =', JSON.stringify(out));
