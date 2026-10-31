// The Studio's shared modules (studio/lib/): each thing defined once and used everywhere. The library (lib/library.js)
// read in node, then a guard over the Studio's source: a name table or helper copied into a page's own file fails here,
// so a new page imports it instead. Usage: node tests/modular.mjs
import fs from 'node:fs';
import path from 'node:path';
import { libItems, rhythmsByRole, stepIn, EVEN } from '../studio/lib/library.js';
import { partNotes } from '../studio/arrange/flatten.js';
import { stepNotes } from '../studio/jam/play.js';
import { notesAt, chordOf } from '../studio/jam/model.js';
import { join } from '../studio/jam/part.js';
import { VNAME, voiceName, colName, midiOf, noteName, fmtDb } from '../studio/lib/names.js';

let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`); };
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../studio');
const pack = i => JSON.parse(fs.readFileSync(path.join(root, `listen/packs/pack-${i}.json`), 'utf8'));
const P = [1, 2, 3].map(pack);

/* ---------- the library ---------- */
{ const items = libItems(P, [{id: 'my-1', kind: 'rhythm', name: 'Mine', R: {len: 16, hits: [[0, 1, 1]]}}]), parts = items.filter(x => x.kind === 'part');
  check('the library: yours first, the even rhythms, every pack clip as a part', items[0].mine && items.filter(x => x.from === 'Even rhythms').length === EVEN.length && parts.length === P.reduce((n, p) => n + p.clips.length, 0), `${items.length} items`);
  check('each part read into a rhythm, a pitched one with its notes', parts.every(x => x.R?.hits) && parts.filter(x => x.role === 'bass').every(x => x.N?.seq), '');
  const by = rhythmsByRole(P), keys = Object.values(by).flat().map(x => x.id);
  check('each kind of part\'s rhythms, each once', new Set(keys).size === keys.length && Object.entries(by).every(([r, l]) => new Set(l.map(x => JSON.stringify(x.R.hits) + x.R.len)).size <= l.length) && by.kick?.length > 2, Object.entries(by).map(([r, l]) => `${r} ${l.length}`).join(', '));
  const L = by.hats, a = stepIn(L, null, 1), b = stepIn(L, L.at(-1).id, 1), c = stepIn(L, null, -1);
  check('‹ › step round the list (from outside it, the first or the last)', a.i === 0 && b.i === 0 && c.i === L.length - 1, ''); }

/* ---------- the names ---------- */
check('names: a voice, a numbered copy, the second lead, a note both ways, decibels', voiceName('kick2') === 'Kick' && VNAME.chh === 'Closed hat' && colName(6, 'lead') === 'Lead 2' && colName(5, 'lead') === 'Lead' && midiOf('C4') === 60 && midiOf('Bb2') === 46 && noteName(61) === 'C♯4' && fmtDb(-60) === 'off' && fmtDb(3) === '+3.0' && fmtDb(-41, {floor: -40, off: '−∞'}) === '−∞', '');

/* ---------- one way of playing a part: the jam and the DAW both through stepNotes (jam/play.js), arpStep (jam/model.js) ---------- */
{ const H = {id: 'x', bars: ['A:m9', 'F:maj7']}, R = {len: 16, hits: [[0, 8, .8], [8, 8, .8]], feel: 0}, c = {role: 'chords', rhythm: R, notes: {seq: []}};
  const arp = partNotes({...c, arp: 1}, H, 2, {}), held = partNotes(c, H, 2, {});
  check('a chords part arpeggiated is written out arpeggiated (one voice a 16th, rising), held chords as chords', arp.length === 32 && arp[1].p > arp[0].p && held.length < arp.length && held.filter(n => n.s === 0).length > 2, `${arp.length} notes arpeggiated, ${held.length} held`);
  const clip = join('bass', {len: 16, hits: [[0, 1, .8], [4, 1, .8]]}, {seq: [[0, 0], [2, 0]]}), chd = chordOf(H, 0);
  check('as written, a step\'s notes are the model\'s own', JSON.stringify(stepNotes({role: 'bass', clip, pos: 4, step: 4, bar: 0, chord: chd, opts: {}})) === JSON.stringify(notesAt(clip, 4, chd, {})), '');
  const play = a => { const mem = {}; return JSON.stringify(Array.from({length: 128}, (_, k) => stepNotes({role: 'bass', clip, pos: k % 16, step: k, bar: Math.floor(k/16), chord: chd, opts: {}, a, mem, seed: 7}))); };
  check('with Life it improvises (not only what\'s written), and the same way from the same seed', play(1) !== play(0) && play(1) === play(1), ''); }

/* ---------- the guard: nothing the shared modules hold is defined again in a page's own file ---------- */
const files = []; (function walk(d){ for (const f of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, f.name);
  if (f.isDirectory()) { if (!['node_modules', 'listen', 'out', 'sessions', 'tracks'].includes(f.name)) walk(p); } else if (/\.(js|mjs)$/.test(f.name)) files.push(p); } })(root);
const SHARED = [
  ['a drum voice name table (lib/names.js VNAME)', /\bchh:\s*'Closed hat'/, ['lib/names.js']],
  ['the note names (lib/names.js)', /'C♯', 'D', 'E♭'|'C#', 'D', 'D#', 'E'/, ['lib/names.js', 'jam/chords.js']],
  ['a pitch class table (lib/names.js PC)', /\{C: 0, 'C#': 1/, ['lib/names.js']],
  ['the part names (lib/names.js)', /hats: 'Hats', perc: 'Percussion'/, ['lib/names.js']],
  ['the element helper (lib/dom.js h)', /\bh = \((tag|t), (props|a) = \{\}, \.\.\.(kids|k)\) =>/, ['lib/dom.js']],
  ['a deep copy (lib/dom.js clone)', /\bclone = x => JSON\.parse\(JSON\.stringify\(x\)\)/, ['lib/dom.js']],
  ['the clamp (lib/dom.js)', /\bclamp = \(v, a, b\) => Math\.max\(a, Math\.min\(b, v\)\)/, ['lib/dom.js', 'lib/palette.js']],
  ['the FNV hash over a string (lib/dom.js fnv)', /2166136261[^]{0,80}charCodeAt/, ['lib/dom.js']],
  ['decibels as words (lib/names.js fmtDb)', /\bfmtDb = v =>/, ['lib/names.js']],
  ['the even rhythms (lib/library.js)', /'Four on the floor', 4, 16/, ['lib/library.js']],
];
for (const [what, re, allow] of SHARED) { const hits = files.filter(f => !allow.some(a => f.endsWith(path.sep + a.split('/').join(path.sep))) && re.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(root, f));
  check(`defined once: ${what}`, !hits.length, hits.join(', ')); }

console.log(failed ? '\nSome checks failed.' : '\nAll checks passed.'); process.exit(failed ? 1 : 0);
