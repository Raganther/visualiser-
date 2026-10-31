// A round of ideas for Studio Jam's idea loop: built from the user's snapshots (and, from round 2, the order they
// arranged them in), each a full combination in the snapshot format, with a line on why. Clips come from the packs and
// the user's own variants, changed with the model's transforms; sounds from the library, steered by their ratings.
// Usage: node studio/jam/ideas.mjs <dir of exported snaps> <round> <out.json> (round 1 from Snaps 4 and 5, round 2 from Snap 9,
// round 3 three whole songs from Snap 10: each a list of sections, every section a scene in the v2 format; round 4 the three again)
// (export: ArtifactData list snaps → out_dir; write: ArtifactData batch set into `ideas`)
import fs from 'node:fs';
import path from 'node:path';
import { XFORMS, mutate } from './model.js';
import { develop, sequence, thin } from './riff.js';
import { split, join, rhythmTool, notesTool, fresh } from './part.js';
import { LIB, inKey } from './chords.js';
import { rng } from '../lib/rng.js';
import { clone } from '../lib/dom.js';

const here = path.dirname(new URL(import.meta.url).pathname), [dir, roundArg, outFile] = process.argv.slice(2), ROUND = +roundArg || 1;
const PACKS = Object.fromEntries(fs.readdirSync(path.join(here, 'packs')).filter(f => /^pack-\d+\.json$/.test(f)).map(f => { const p = JSON.parse(fs.readFileSync(path.join(here, 'packs', f), 'utf8')); return [p.id, p]; }));
const SNAPS = Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), x = d.data || d; return [x.name, x]; }));
const R = rng(100 + ROUND);
const COL = {kick: 0, hats: 1, perc: 2, bass: 3, chords: 4, lead: 5, lead2: 6};

// an idea from a snapshot: a copy, then changes; `steps` and `vars` kept together so its strip matches
function idea(from, kind, name, why, f){ const x = clone(from); delete x.id; x.cols.forEach(c => { c.vars ??= []; c.made ??= []; c.play ??= 0; });
  f(x); return {...x, kind, name, why, from: [from.id], round: ROUND}; }
// a part onto one of a pack's clips (its own variations its strip)
function clipTo(x, col, clipId, pack = x.pack){ const c = x.cols[COL[col]], cl = PACKS[pack].clips.find(k => k.id === clipId);
  c.clip = {id: cl.id, var: 0, len: cl.len, steps: clone(cl.steps)}; c.vars = [cl.steps, ...cl.variations].map(clone); c.made = c.vars.map(() => null); delete c.lens; c.vi = 0; c.mute = false; return c; }
const stop = (x, col) => { const c = x.cols[COL[col]]; c.clip = null; return c; };
const sound = (x, col, id) => { const c = x.cols[COL[col]]; c.sound = id; c.locked = true; return c; };
// more variants on a part's strip, continuing the moves the user made (each from the last), left on their latest
function extend(x, col, moves){ const c = x.cols[COL[col]]; if (!c.clip) return c; let cur = {role: c.role === 'lead2' ? 'lead' : c.role, len: c.clip.len, steps: c.clip.steps};
  for (const m of moves) { const steps = m === 'mutate' ? mutate(cur, R).steps : XFORMS[m](cur); c.vars.push(steps); c.made.push('Claude: ' + m); cur = {...cur, steps}; }
  return c; }

// round 1: from Snaps 4 and 5
function round1(){ const A = SNAPS['Snap 4'], B = SNAPS['Snap 5'];
if (!A || !B) throw new Error('needs Snap 4 and Snap 5 in ' + dir);
return [
  idea(B, 'Continue', 'The bass walks on', 'After Snap 5: the harmony moves to the A pedal (it keeps your E and A), your reshaped bass carries on, and the Bloom pad you liked comes in under it.', x => {
    x.harmony = 'a-pedal-3'; const ch = clipTo(x, 'chords', 'c3-phrase'); ch.sound = 'c-bloom'; ch.locked = true; ch.voicing = 1; ch.y = .45;
    extend(x, 'bass', ['flip', 'wide', 'reverse', 'narrow']); }),
  idea(B, 'Continue', 'Drops on wood and stone', 'Snap 5 again, its percussion on Wood and stone (your 👍), water drops answering the birds.', x => {
    sound(x, 'perc', 'p3-woodstone'); const l = clipTo(x, 'lead2', 'l3-drops'); l.sound = 'l3-drops'; l.locked = true; l.y = .5; }),
  idea(B, 'Continue', 'Seven becomes eleven', 'Your bass line stretched to an 11-step loop so it drifts further against the kick; hats in threes; D minor 7 to 9 overhead.', x => {
    const b = x.cols[COL.bass], st = b.clip.steps, ext = [...st, ...st.map(s => [s[0] + 7, s[1] + 1, ...s.slice(2)])].filter(s => s[0] < 11);
    b.clip = {...b.clip, len: 11, steps: ext}; b.vars.push(ext); b.made.push('Claude: eleven'); b.vi = b.vars.length - 1;
    clipTo(x, 'hats', 'h3-three'); x.harmony = 'd-m7m9'; }),
  idea(A, 'Bridge', 'Snap 4 into Snap 5', 'Snap 4’s drums under Snap 5’s bass and leads: a bar or two of this between them makes the change smooth.', x => {
    const b5 = B.cols[COL.bass]; x.cols[COL.bass] = clone(b5); x.cols[COL.lead] = clone(B.cols[COL.lead]); x.cols[COL.lead2] = clone(B.cols[COL.lead2]); }),
  idea(A, 'Strip back', 'Snap 4, stripped', 'No kick, the hats on off-beats only, the stab and the bass alone: a breather, or a way in.', x => {
    stop(x, 'kick'); clipTo(x, 'hats', 'h3-off'); stop(x, 'lead'); stop(x, 'lead2'); }),
  idea(B, 'Strip back', 'Snap 5, stripped', 'Only your reshaped bass, the hand groove and the Bloom pad holding one chord: the bass alone in the room.', x => {
    stop(x, 'kick'); stop(x, 'hats'); stop(x, 'lead'); stop(x, 'lead2'); const ch = clipTo(x, 'chords', 'c3-phrase'); ch.sound = 'c-bloom'; ch.locked = true; ch.y = .6; }),
  idea(B, 'Build up', 'Snap 5, full', 'The kick skips every third bar, rolling hats, the dub chord back in stabs of five with its echo, the blip in seven.', x => {
    clipTo(x, 'kick', 'k3-skip'); const h = x.cols[COL.hats]; h.feel = 2; const ch = clipTo(x, 'chords', 'c3-fives'); ch.sound = 'c3-dub'; ch.locked = true; ch.voicing = 1; ch.y = .55;
    const l = clipTo(x, 'lead', 'l3-seven'); l.sound = 'l3-blip'; l.locked = true; }),
  idea(A, 'Build up', 'Snap 4, full', 'Snap 4 with the kick’s ghost, 16ths with gaps on the hats, the stab answered by drops.', x => {
    clipTo(x, 'kick', 'k3-ghost'); clipTo(x, 'hats', 'h3-gaps'); const l = clipTo(x, 'lead', 'l3-drops'); l.sound = 'l3-drops'; l.locked = true; }),
  idea(A, 'New colour', 'Snap 4 on skins and wood', 'The same groove on Skins and wood (your 👍), the stab swapped for the native dub chord on the and.', x => {
    sound(x, 'perc', 'p-skins'); const ch = clipTo(x, 'chords', 'c3-and'); ch.sound = 'c3-dub'; ch.locked = true; ch.voicing = 1; }),
  idea(B, 'New colour', 'Snap 5 in bamboo and bloom', 'Snap 5 with bamboo leads instead of metal and marimba, the Bloom pad under it, wood and stone in the percussion.', x => {
    sound(x, 'perc', 'p3-woodstone'); sound(x, 'lead', 'l3-bamboo'); sound(x, 'lead2', 'l3-bamboo').oct = 1;
    const ch = clipTo(x, 'chords', 'c3-phrase'); ch.sound = 'c-bloom'; ch.locked = true; ch.y = .5; }),
  idea(B, 'More of your edits', 'More on the bass, hats and perc', 'Snap 5 exactly, with more variants on the strips you were working: the bass flipped, widened and turned (pads after K), the hats mutated, the perc rotated. Try Follow.', x => {
    extend(x, 'bass', ['flip', 'wide', 'narrow', 'reverse', 'rotate', 'up', 'mutate', 'mutate']); extend(x, 'hats', ['mutate', 'reverse', 'mutate']); extend(x, 'perc', ['rotate', 'rotate', 'mutate']); }),
]; }
// round 2: from Snap 9 (no bass, natural sounds: "what bass might work with this?"), the basses that suit wood, skin
// and drops, then the improviser and the riff tools on it
function round2(){ const S9 = SNAPS['Snap 9']; if (!S9) throw new Error('needs Snap 9 in ' + dir);
  const bass = (x, sound, clipId, set = {}) => { const c = clipTo(x, 'bass', clipId); c.sound = sound; c.locked = true; Object.assign(c, set); return c; };
  // a variant of the riff tools' onto a part's strip, chosen, with its own length
  const onto = (x, col, R, why) => { const c = x.cols[COL[col]]; c.lens ??= c.vars.map(() => null); c.vars.push(R.steps); c.made.push('Claude: ' + why); c.lens.push(R.len);
    c.vi = c.vars.length - 1; c.clip = {...c.clip, len: R.len, steps: R.steps, var: c.vi}; return c; };
  const loose = x => { x.cols[COL.hats].play = 2; x.cols[COL.perc].play = 1; x.cols[COL.lead].play = 2; x.cols[COL.lead2].play = 2; };
  return [
    idea(S9, 'Bass', 'Bamboo bass on the and', 'Snap 9 with a big bamboo tube for a bass: the same family as your bamboo drops, so it blends in rather than sitting on top. One long note on the and, leaving the beat to the hands.', x => {
      bass(x, 'b3-bamboo', 'b3-and', {length: 1}); }),
    idea(S9, 'Bass', 'A woody thump', 'The FM round bass (a soft, woody thump) on off-beat 8ths, short and dark: weight under the hands without changing the colour.', x => {
      bass(x, 'b-fmround', 'b3-off', {length: 0, x: .45}); }),
    idea(S9, 'Bass', 'Log drum in threes', 'A pitched log drum on the three-step stab: it goes round against the four-on-the-floor and talks with the hand drums.', x => {
      bass(x, 'b2-log', 'b3-three'); }),
    idea(S9, 'Bass', 'Your seven, thinned, on a string', 'Your reshaped seven-step line (the one you worked hardest on), thinned to its strongest notes and played on a plucked string, so you can hear it move without crowding the drops.', x => {
      const c = x.cols[COL.bass]; c.mute = false; c.sound = 'b-string'; c.locked = true; c.length = 0; onto(x, 'bass', thin(c.clip, R), 'thinned'); }),
    idea(S9, 'Played', 'Snap 9, played', 'No bass, as you had it, with the improviser on: the hats loose (notes left out, ghosts, a roll into each phrase), the hands lightly, the bamboo and the marimba loose, taking turns to rest.', x => {
      loose(x); }),
    idea(S9, 'Played', 'Bamboo bass, everyone loose', 'The bamboo bass on the and under Snap 9 played loose: the closest to a band jamming on it.', x => {
      bass(x, 'b3-bamboo', 'b3-and', {length: 1}); loose(x); }),
    idea(S9, 'Riff', 'The drops, developed', 'The bamboo drops over four bars: the riff, a variation, the riff again, then an answer coming home (Develop). The marimba as it was.', x => {
      onto(x, 'lead', develop(x.cols[COL.lead].clip, R), 'developed'); }),
    idea(S9, 'Riff', 'The marimba climbs', 'The marimba\'s answer twice round, a chord tone higher the second time (Sequence): a gentle lift every four bars.', x => {
      onto(x, 'lead2', sequence(x.cols[COL.lead2].clip), 'sequenced'); }),
    idea(S9, 'Strip back', 'Hands and bamboo', 'No kick, no hats: the hand groove, the bamboo bass and the drops. A breather to arrange between the full ones.', x => {
      stop(x, 'kick'); stop(x, 'hats'); bass(x, 'b3-bamboo', 'b3-and', {length: 1}); x.cols[COL.lead2].mute = true; }),
    idea(S9, 'Build up', 'Strings underneath', 'The bamboo bass, and your strings back in quietly and wet on their stabs in five, the hats loose: Snap 9 at its fullest without leaving its colour.', x => {
      bass(x, 'b3-bamboo', 'b3-and', {length: 1}); const ch = x.cols[COL.chords]; ch.mute = false; ch.mix = {...ch.mix, vol: -6}; ch.y = .7; x.cols[COL.hats].play = 2; }),
  ]; }
// the songs' kit (rounds 3 and 4), from Snap 10 (Snap 9's natural sounds with the FM pluck bass you found, on your
// four-bar off-beat line): every part taken apart into its rhythm and notes; a pack clip as a part; the rhythm and notes
// tools; a song (its sections in order, each a scene in the v2 format held for its bars)
function kit(S10, seed = 303, hats = null){
  const PK = PACKS[S10.pack], GROUND = Object.fromEntries(PK.harmonies.map(H => [H.id, H]));
  for (const H of LIB) GROUND[H.id] = inKey(H, 'A');
  // the base: Snap 10 with every part taken apart into its rhythm and notes (its own feel kept on the rhythm)
  const base = clone(S10); delete base.id;
  base.cols.forEach(c => { for (const k of ['vars', 'made', 'lens', 'vi', 'follow']) delete c[k]; c.play = 0; c.mute = false;
    if (c.clip) { const nm = PK.clips.find(k => k.id === c.clip.id)?.name || 'Saved part', sp = split(c.role, c.clip, nm); c.rhythm = {...sp.rhythm, feel: c.feel || 0}; c.notes = sp.notes; c.preset = PK.clips.some(k => k.id === c.clip.id) ? c.clip.id : null; } });
  if (hats) Object.assign(base.cols[COL.hats], hats);
  const line = base.cols[COL.bass]; line.rhythm = fresh(line.rhythm, 'Your off-beat line'); line.notes = fresh(line.notes, 'Your off-beat line'); line.preset = null;
  const LINE = {R: line.rhythm, N: line.notes}, R3 = rng(seed);
  // a pack clip as a part; tools on parts
  const pack = (role, id) => { const cl = PK.clips.find(k => k.id === id), sp = split(role, cl, cl.name), col = base.cols.find(c => c.role === role);
    return {R: {...sp.rhythm, feel: col?.feel || 0}, N: sp.notes, preset: id}; };
  const rt = (role, k, m) => { const o = rhythmTool(k, role, m.R, m.N, R3); return {R: o.rhythm, N: o.notes || m.N}; };
  const nt = (role, k, m) => ({R: m.R, N: notesTool(k, role, m.N, R3)});
  const BAR1 = rt('bass', 'shorter', rt('bass', 'shorter', LINE));                    // one bar of your line
  const of = col => ({R: base.cols[COL[col]].rhythm, N: base.cols[COL[col]].notes, preset: base.cols[COL[col]].preset});
  // a section: Snap 10 with its parts as given (null rests; a missing part rests too, so each section says what plays)
  let n = 0; const song = (id, name, why, bpm, list) => ({id, kind: 'song', name, why, bpm, round: ROUND, pack: S10.pack,
    sections: list.map(([sname, bars, ground, parts, swhy = '', set = {}]) => { const x = clone(base), H = GROUND[ground];
      Object.assign(x, {id: `${id}.${++n}`, name: `${name}: ${sname}`, bars, why: swhy, bpm, harmony: H.id, harmonyName: H.name, harmonyBars: H.bars, v: 2, ...set});
      x.cols.forEach((c, i) => { const key = Object.keys(COL).find(k => COL[k] === i), m = parts[key];
        if (!m) { c.rhythm = c.notes = c.clip = null; c.preset = null; return; }
        const {R, N, preset = null, ...more} = m; c.rhythm = clone(R); c.notes = N ? clone(N) : null; c.preset = preset; Object.assign(c, more);
        if (c.ramp) c.ramp = {...c.ramp, bars};
        const j = join(c.role, c.rhythm, c.notes); c.clip = {id: preset || 'part', var: 0, len: j.len, steps: j.steps}; });
      return x; })});
  const bassLong = {...pack('bass', 'b3-and'), length: 2, y: .45}, strings = {...pack('chords', 'c3-phrase'), mix: {...base.cols[COL.chords].mix, vol: -7}, y: .7};
  return {PK, base, LINE, BAR1, pack, rt, nt, of, song, n0: () => (n = 0), bassLong, strings};
}
// round 3: three whole songs from Snap 10, each a different shape, the bass coming and going
function round3(){ const S10 = SNAPS['Snap 10']; if (!S10) throw new Error('needs Snap 10 in ' + dir);
  const {LINE, BAR1, pack, rt, nt, of, song, n0, bassLong, strings} = kit(S10);
  const HATS = of('hats'), HANDS = of('perc'), DROPS = of('lead'), MARIMBA = of('lead2');
  return [
    (n0(), song('r3-1', 'Clearing', 'An arc in nine parts: the wood and the hands at first light, the kick walking in, your bass arriving and stepping out for the undergrowth, back changed on D minor, a hush with strings, everything at the clearing, then the light going. The bass is there for half of it.', 120, [
      ['First light', 8, 'a-pedal-3', {perc: rt('perc', 'thin', HANDS), lead: DROPS, lead2: MARIMBA}, 'No kick: the hands thinned, the drops and the marimba.'],
      ['Footsteps', 8, 'a-pedal-3', {kick: pack('kick', 'k3-sparse'), perc: HANDS, lead: DROPS, lead2: MARIMBA}, 'The kick on one and three.'],
      ['The path', 16, 'a-pedal-3', {kick: pack('kick', 'k3-four'), hats: HATS, perc: HANDS, lead: DROPS, lead2: MARIMBA}, 'Snap 9: four on the floor, your 16ths.'],
      ['The bass arrives', 16, 'a-pedal-3', {kick: pack('kick', 'k3-four'), hats: HATS, perc: HANDS, bass: LINE, lead: DROPS}, 'Your FM pluck line; the marimba steps back to give it room.'],
      ['Undergrowth', 8, 'a-pedal-3', {kick: pack('kick', 'k3-four'), hats: pack('hats', 'h3-open'), perc: HANDS, lead2: nt('lead', 'sequence', MARIMBA)}, 'The bass out; open hats; the marimba climbing.'],
      ['Back, changed', 16, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: {...HATS, play: 1}, perc: HANDS, bass: rt('bass', 'develop', BAR1), lead: DROPS}, 'Your line\'s first bar developed into a new four-bar phrase, on D minor (your Snap 10 ground); the hats played lightly.'],
      ['Hush', 8, 'd-m7m9', {perc: {...pack('perc', 'p3-air')}, chords: strings, lead: DROPS, lead2: MARIMBA}, 'A breakdown: no kick, no bass; the air swelling, strings low and wet.'],
      ['The clearing', 16, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: {...HATS, play: 2}, perc: HANDS, bass: {...LINE, play: 1}, lead: DROPS, lead2: MARIMBA}, 'Everything, the hats loose and the bass played lightly.'],
      ['Last light', 8, 'a-pedal-3', {kick: pack('kick', 'k3-sparse'), perc: rt('perc', 'thin', HANDS), bass: bassLong, lead: DROPS, lead2: MARIMBA}, 'The kick thins, the bass holds long notes on the and, back on the pedal.'],
    ])),
    (n0(), song('r3-2', 'Two rivers', 'A rondo (A B A C A B, then the sea): the bass and the wood take turns, never together until they meet. The bass\'s river on D minor, the wood\'s on the A pedal, and where they meet a darker turn, a semitone up and back.', 120, [
      ['Bass river', 8, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: HATS, perc: HANDS, bass: LINE}, 'The drums and your bass, no melody.'],
      ['Wood river', 8, 'a-pedal-3', {kick: pack('kick', 'k3-four'), hats: pack('hats', 'h3-off'), perc: pack('perc', 'p3-seven'), lead: DROPS, lead2: MARIMBA}, 'No bass: the drops and the marimba, a rim in sevens against the four.'],
      ['Bass river, rolling', 8, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: {...HATS, play: 1}, perc: HANDS, bass: {R: pack('bass', 'b3-roll').R, N: LINE.N}}, 'Your line\'s notes on the rolling-threes rhythm: the same notes, a new way of walking.'],
      ['Where they meet', 16, 'phryg-3', {kick: pack('kick', 'k3-broken'), hats: pack('hats', 'h3-gaps'), perc: HANDS, bass: LINE, lead2: nt('lead', 'sequence', MARIMBA)}, 'Bass and marimba together for the first time, on E minor 7 to F major 7; the kick broken.'],
      ['Bass river', 8, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: HATS, perc: HANDS, bass: LINE}, 'The theme again, as it was.'],
      ['Wood river, no kick', 8, 'a-pedal-3', {hats: pack('hats', 'h3-off'), perc: HANDS, lead: rt('lead', 'develop', DROPS), lead2: MARIMBA}, 'The kick drops out; the drops developed over four bars.'],
      ['The sea', 16, 'd-m7m9', {kick: pack('kick', 'k3-four'), hats: {...HATS, play: 2}, perc: HANDS, bass: {...LINE, play: 1}, chords: strings, lead: DROPS, lead2: MARIMBA}, 'Both rivers at once, strings under them.'],
    ])),
    (n0(), song('r3-3', 'Undertow', 'The bass leads from the start and leaves for the peak: the peak is Snap 9\'s groove, the minimal, bass-less one you liked, on its own pedal. Then the bass comes back in half time and is the last thing left.', 120, [
      ['Low water', 8, 'lib-twomin', {bass: bassLong}, 'The bass alone, long notes on the and, A minor 9 to E minor 9.'],
      ['Hands', 8, 'lib-twomin', {perc: HANDS, bass: bassLong}, 'The hand groove joins.'],
      ['Pulse', 8, 'lib-twomin', {kick: pack('kick', 'k3-sparse'), perc: HANDS, bass: LINE}, 'The kick on one and three; the bass starts walking your line.'],
      ['Current', 16, 'lib-twomin', {kick: pack('kick', 'k3-four'), hats: {...HATS, play: 1}, perc: HANDS, bass: LINE, lead: DROPS}, 'The groove, with the drops.'],
      ['Surface', 16, 'a-pedal-3', {kick: pack('kick', 'k3-four'), hats: HATS, perc: HANDS, lead: DROPS, lead2: MARIMBA}, 'Snap 9\'s groove: the bass gone, the wood and the marimba on top.'],
      ['Under again', 8, 'lib-twomin', {kick: pack('kick', 'k3-four'), hats: pack('hats', 'h3-ride'), perc: HANDS, bass: rt('bass', 'half', BAR1)}, 'The bass back in half time: your line\'s first bar, twice as slow.'],
      ['Ebb', 8, 'lib-twomin', {perc: HANDS, bass: {...BAR1, play: 2}, lead2: MARIMBA}, 'No kick: the bass played loose, the hands and the marimba.'],
      ['Still', 8, 'lib-twomin', {perc: pack('perc', 'p3-air'), bass: bassLong}, 'Long bass notes and the air.'],
    ])),
  ]; }
// round 4: the three songs again, each grown its own way from the user's comments on round 3 (studio/taste.md,
// 2026-10-23): smoother, drier hats with a drummer's dynamics and fills; the parts played with small variations and
// syncopation; the kick held back while the motifs and percussion build; the bass a short grooving motif (Clearing's
// off-beat one from "Back, changed"); the pad pulsing on the beat, its filter opening into the drop
function round4(){ const S10 = SNAPS['Snap 10']; if (!S10) throw new Error('needs Snap 10 in ' + dir);
  const {LINE, pack, rt, nt, of, song, n0, bassLong, strings} = kit(S10, 404, {sound: 'h3-smooth', echo: false, verb: true, y: .25});
  const HANDS = of('perc'), DROPS = of('lead'), MARIMBA = of('lead2');
  // drums bar by bar: each bar 16 steps, '.' a rest, a letter a voice (at its own loudness, or a digit's tenths below it)
  const HK = {X: ['chh', 1], x: ['chh', .72], o: ['chh', .45], g: ['chh', .26], O: ['ohh', .8], q: ['ohh', .5], r: ['ride', .6], R: ['ride', .85]},
    PK4 = {T: 'tomL', t: 'tomH', L: 'log', l: 'logH', w: 'wood', m: 'metal', d: 'rim', s: 'shaker', c: 'clave', b: 'bowl', G: 'gong'}, KK = {K: ['kick', 1], k: ['kick', .8], g: ['kick', .4]};
  const beat = (name, key, bars) => { const hits = [], seq = [];
    bars.forEach((b, i) => { const [v, d = ''] = Array.isArray(b) ? b : [b]; if (v.length !== 16 || d && d.length !== 16) throw new Error(`${name}: bar ${i + 1} isn't 16 steps`);
      for (let s = 0; s < 16; s++) { if (v[s] === '.') continue; const k = key[v[s]], vel = d[s] && d[s] !== '.' ? +d[s]/10 : Array.isArray(k) ? k[1] : .6; hits.push([i*16 + s, 1, vel]); seq.push(Array.isArray(k) ? k[0] : k); } });
    return {R: {len: bars.length*16, hits, feel: 0, name, base: name, ops: []}, N: {seq, name, base: name, ops: []}}; };
  // a line bar by bar: [step, rung of the chord, length in 16ths, loudness, octave]
  const tune = (name, bars) => { const hits = [], seq = []; bars.forEach((b, i) => b.forEach(([s, r, l, v, o = 0]) => { hits.push([i*16 + s, l, v]); seq.push([r, o]); }));
    return {R: {len: bars.length*16, hits, feel: 0, name, base: name, ops: []}, N: {seq, name, base: name, ops: []}}; };
  const E16 = '................';
  // the kick: four, the fourth bar's last 16th a ghost leading round; one and three
  const K4 = beat('Four, a ghost leading round', KK, ['K...k...k...k...', 'K...k...k...k...', 'K...k...k...k...', 'K...k...k...k..g']), K13 = beat('One and three', KK, ['K.......k.......']);
  // the hats as a drummer: accents on the off-beats, ghosts between, an open hat closed by the next, a fill in the fourth bar
  const G1 = 'g.Xog.X.goX.g.Xo', G2 = 'g.Xog.Xg.oX.goOg', G3 = 'g.Xo.gX.goXog.X.', FILL = 'g.Xog.X.goXoxoXx';
  const HGROOVE = beat('A drummer’s 16ths', HK, [G1, G2, G3, FILL]);
  // the same groove the length of a section, the fill in its last bar (so it lands on the change)
  const hatsTo = (bars, name = 'Groove, a fill into the change') => beat(name, HK, Array.from({length: bars}, (_, i) => i === bars - 1 ? FILL : [G1, G2, G3, G2][i % 4]));
  const offTo = bars => beat('Off-beats, a fill into the change', HK, Array.from({length: bars}, (_, i) => i === bars - 1 ? 'o.x.o.x.goXoxoXx' : i % 2 ? '..x...x...x.g.x.' : '..x...x...x...x.'));
  const HSPARSE = beat('A few closed hats', HK, ['..o...x...o...x.', '..o...x...o.g.x.']);
  // the hats rising through the hush: four bars of nothing, then off-beats, 8ths, 16ths getting louder into the drop
  const HRISE = beat('Rising into the drop', HK, [E16, E16, E16, E16, '..g...g...g...g.', '..o...o...o...o.', 'o.x.o.x.o.x.o.x.', ['xoxoxoxoxXxXXXXX', '3434454556677889']]);
  // the percussion, building: the hands thinned, then twigs and an insect, then leaves and a drop, then a bamboo fill
  const P1 = beat('The hands, thinned', PK4, [['...tT......T....', '...57......6....'], ['...tT.....tT....', '...57.....46....']]);
  const P2 = beat('Hands and twigs', PK4, [['...tT.w.t..T.wtl', '...57.3.4..6.354'], ['..wtT...t.cT.wtl', '..357...4.36.354']]);
  const P3 = beat('Hands, twigs and leaves', PK4, [['s..tTsw.t.sT.wtl', '2..5723.4.26.354'], ['s.wtT.s.t.cTswtl', '2.357.2.4.362354']]);
  const PDEV = beat('Hands answering, a bamboo fill', PK4, [['s..tTsw.t.sT.wtl', '2..5723.4.26.354'], ['s.wtT.s.t.cTswtl', '2.357.2.4.362354'], ['s..tTswdt.sT.wtl', '2..572344.26.354'], ['s..tTsw.tTtTtTtT', '2..5723.45677889']]);
  // the bass: the off-beat motif you liked ("Back, changed": root, third, seventh, fifth on the and), and its answers
  const M = [[2, 0, 2, .8], [6, 1, 1, .62], [10, 3, 2, .72], [14, 2, 2, .66]], M2 = [[2, 0, 2, .8], [6, 1, 1, .6], [7, 1, 1, .4], [10, 2, 2, .7], [13, 3, 1, .6], [15, 0, 1, .55]],
    M3 = [[2, 0, 2, .8], [6, 1, 1, .62], [10, 2, 2, .7], [14, 3, 2, .66]], M4 = [[2, 4, 2, .8], [6, 3, 1, .6], [9, 1, 1, .55], [10, 1, 1, .45], [14, 0, 1, .66], [15, 1, 1, .5]];
  const MOTIF = tune('The off-beat motif', [M, M2]), MOTIF4 = tune('The off-beat motif, developed', [M, M2, M3, M4]);
  // the pad: one chord a phrase, pulsing on every beat and pumping on the kick; in the hush its filter opens bar by bar
  const PAD = {...strings, motion: 3, x: .82, mix: {...strings.mix, vol: -6, duck: 3}}, PADRISE = {...PAD, x: .3, ramp: {x: [.3, .88]}, mix: {...strings.mix, vol: -5, duck: 3}};
  const LIGHT = m => ({...m, play: 1}), LOOSE = m => ({...m, play: 2});
  const DROPS4 = rt('lead', 'develop', DROPS);

  // Undertow's one idea: the bass on the beat one bar and off it the next, everything else locking to it
  const BC = tune('On the beat, then off it', [[[4, 0, 2, .8], [12, 2, 2, .7]], [[2, 0, 1, .72], [6, 1, 1, .6], [10, 2, 1, .66], [14, 3, 1, .6]]]);
  const HC = beat('Hats the other way from the bass', HK, [['g.x.g.x.g.x.g.xo', '2.7.2.8.2.7.2.84'], ['x.g.X.g.x.g.X.go', '7.2.9.2.7.2.9.25']]);
  const PC = beat('Hands in the bass’s gaps', PK4, [['..t.T.l...t.T.wl', '..5.6.4...5.6.34'], ['T..t...lT..t..wl', '6..5...46..5..34']]);
  const LC = tune('The bass’s figure, up high', [[[6, 5, 1, .55], [14, 6, 1, .5]], [[2, 4, 1, .6], [6, 5, 1, .5], [10, 7, 1, .55], [14, 6, 1, .5]]]);
  const MC = tune('The figure on the marimba', [[[4, 4, 2, .7], [12, 6, 2, .6]], [[2, 4, 1, .62], [6, 5, 1, .5], [10, 6, 1, .55], [14, 7, 1, .5], [15, 6, 1, .4]]]);
  const CC = {...pack('chords', 'c3-and'), y: .55, mix: {...strings.mix, vol: -9}};

  return [
    (n0(), song('r4-1', 'Clearing', 'Round 4 of Clearing: the slow build. The two instruments and the hands open it, played with small human variations; the kick waits while the percussion and a few hats grow; the bass is your off-beat motif from "Back, changed", a two-bar groove, developed in the middle and strong at the clearing; the hush\'s pad pulses on the beat, opening bar by bar, the hats rising into the drop.', 120, [
      ['First light', 8, 'a-pedal-3', {perc: P1, lead: LIGHT(DROPS4), lead2: LIGHT(MARIMBA)}, 'The two instruments and the hands, each played with small variations (Life: light); the drops developed over four bars.'],
      ['Footsteps', 8, 'a-pedal-3', {hats: HSPARSE, perc: P2, lead: LIGHT(DROPS4), lead2: LIGHT(MARIMBA)}, 'Still no kick: twigs and an insect join the hands, a few closed hats come in.'],
      ['The path', 16, 'a-pedal-3', {kick: K4, hats: LIGHT(HGROOVE), perc: P3, lead: LIGHT(DROPS), lead2: LIGHT(MARIMBA)}, 'The kick arrives; the hats play like a drummer (ghosts, accents, an open hat, a fill every fourth bar); leaves in the percussion.'],
      ['The bass arrives', 16, 'a-pedal-3', {kick: K4, hats: LIGHT(HGROOVE), perc: P3, bass: MOTIF, lead: LIGHT(DROPS)}, 'The bass: your off-beat motif as a two-bar groove, the second bar answering (a repeated note, one a 16th early, a pickup).'],
      ['Undergrowth', 8, 'a-pedal-3', {kick: K4, hats: LIGHT(pack('hats', 'h3-open')), perc: P3, lead2: nt('lead', 'sequence', MARIMBA)}, 'The bass steps out; open hats; the marimba climbing.'],
      ['Back, changed', 16, 'd-m7m9', {kick: K4, hats: LIGHT(HGROOVE), perc: PDEV, bass: MOTIF4, lead: DROPS}, 'On D minor: the motif developed over four bars (as it was, answered, turned, coming home), the hands answering each other with a bamboo fill.'],
      ['Hush', 8, 'd-m7m9', {perc: pack('perc', 'p3-air'), hats: HRISE, chords: PADRISE, lead: rt('lead', 'thin', DROPS)}, 'The pad pulsing on every beat, its filter opening bar by bar; the forest\'s crackle; the hats coming in after four bars and rising into the drop.'],
      ['The clearing', 16, 'd-m7m9', {kick: K4, hats: LOOSE(HGROOVE), perc: LIGHT(PDEV), bass: MOTIF, chords: PAD, lead: LIGHT(DROPS), lead2: LIGHT(MARIMBA)}, 'The drop: the pad open and pumping, the bass motif strong and steady under it, the hats jamming (Life: loose).'],
      ['Last light', 8, 'a-pedal-3', {kick: K13, perc: P1, bass: bassLong, lead: LIGHT(DROPS), lead2: LIGHT(MARIMBA)}, 'The kick thins, the bass holds long notes on the and.'],
    ])),
    (n0(), song('r4-2', 'Two rivers', 'Round 4 of Two rivers: the rondo you liked, its bass line and percussion kept, the melody sparse; now every section ends on a hat fill into the next, the wood river without percussion (as you set it), the pad swelling in the wood river with no kick and staying for the sea, and an estuary to close.', 120, [
      ['Bass river', 8, 'd-m7m9', {kick: K4, hats: LIGHT(hatsTo(8)), perc: HANDS, bass: LINE}, 'The drums and your bass, no melody; the hats\' fill lands on the change.'],
      ['Wood river', 8, 'a-pedal-3', {kick: K4, hats: offTo(8), lead: LIGHT(DROPS), lead2: LIGHT(MARIMBA)}, 'No bass, no percussion (your mute): the drops and the marimba over off-beat hats.'],
      ['Bass river, rolling', 8, 'd-m7m9', {kick: K4, hats: LOOSE(hatsTo(8)), perc: HANDS, bass: {R: pack('bass', 'b3-roll').R, N: LINE.N}}, 'Your line on the rolling threes; the hats looser.'],
      ['Where they meet', 16, 'phryg-3', {kick: pack('kick', 'k3-broken'), hats: LIGHT(hatsTo(16)), perc: HANDS, bass: LINE, lead2: nt('lead', 'sequence', MARIMBA)}, 'As you liked it: the bass entering and moving, the sparse marimba, on E minor 7 to F major 7.'],
      ['Bass river', 8, 'd-m7m9', {kick: K4, hats: LIGHT(hatsTo(8)), perc: LIGHT(HANDS), bass: LINE}, 'The theme again, the hands played lightly this time.'],
      ['Wood river, no kick', 8, 'a-pedal-3', {hats: offTo(8), perc: HANDS, chords: {...strings, motion: 1, x: .2, ramp: {x: [.2, .72]}, mix: {...strings.mix, vol: -6, duck: 3}}, lead: LIGHT(rt('lead', 'develop', DROPS)), lead2: MARIMBA}, 'No kick: the pad swells in under the wood, slowly opening, ready for the sea.'],
      ['The sea', 16, 'd-m7m9', {kick: K4, hats: LOOSE(hatsTo(16)), perc: HANDS, bass: LINE, chords: {...strings, x: .72, mix: {...strings.mix, vol: -6, duck: 3}}, lead: DROPS, lead2: MARIMBA}, 'Bass and pad together, the pad pumping on the kick, the hats varied.'],
      ['Estuary', 8, 'd-m7m9', {perc: rt('perc', 'thin', HANDS), bass: bassLong, chords: {...strings, x: .72, ramp: {x: [.72, .22]}, mix: {...strings.mix, vol: -6, duck: 1}}}, 'An ending: no kick, the bass in long notes, the pad closing slowly.'],
    ])),
    (n0(), song('r4-3', 'Undertow', 'Round 4 of Undertow: one idea throughout, on its two chords (A minor 9 to E minor 9) the whole way: the bass on the beat one bar and off it the next, and every other part locking to it. The hats play the other way from the bass, the hands fill its gaps, the drops echo its figure up high, and at the surface the marimba carries it while the bass rests. It opens on the hands and long bass notes you liked.', 120, [
      ['Hands', 8, 'lib-twomin', {perc: HANDS, bass: bassLong}, 'Your favourite opening: the hand groove and the long notes on the and.'],
      ['Pulse', 8, 'lib-twomin', {kick: K13, perc: HANDS, bass: BC}, 'The kick on one and three; the bass starts its figure: on the beat one bar, off it the next.'],
      ['Current', 16, 'lib-twomin', {kick: K4, hats: LIGHT(HC), perc: PC, bass: BC, lead: LC}, 'The groove, locked: hats the other way from the bass, the hands in its gaps, the drops echoing its figure up high.'],
      ['Surface', 16, 'lib-twomin', {kick: K4, hats: LIGHT(HC), perc: LIGHT(PC), chords: CC, lead2: MC}, 'The bass rests; the marimba carries its figure on top, a stab on the and between.'],
      ['Under again', 8, 'lib-twomin', {kick: K4, hats: pack('hats', 'h3-ride'), perc: HANDS, bass: rt('bass', 'half', BC)}, 'The bass back, its figure at half speed; the ride.'],
      ['Ebb', 8, 'lib-twomin', {perc: PC, bass: LOOSE(BC), lead2: LIGHT(MC)}, 'No kick: the bass played loose, the marimba answering it.'],
      ['Still', 8, 'lib-twomin', {perc: pack('perc', 'p3-air'), bass: bassLong}, 'Long bass notes and the air.'],
    ])),
  ]; }
const ideas = {1: round1, 2: round2, 3: round3, 4: round4}[ROUND]();
ideas.forEach((x, i) => { x.order = i; x.id = `r${ROUND}-${i + 1}`; x.at = new Date().toISOString(); });
for (const x of ideas) for (const y of x.sections || []) y.at = x.at;
for (const x of ideas) for (const c of x.cols || []) { if (c.vars.length !== c.made.length || c.lens && c.lens.length !== c.vars.length) throw new Error(x.name + ': strip out of step'); if (c.lens) while (c.lens.length < c.vars.length) c.lens.push(null); }
fs.writeFileSync(outFile, JSON.stringify(ideas));
console.log(ideas.map(x => `${x.id} [${x.kind}] ${x.name}` + (x.sections ? ': ' + x.sections.map(y => `${y.name.split(': ')[1]} ${y.bars}`).join(', ') : '')).join('\n'), `\n${ideas.length} ideas, ${(fs.statSync(outFile).size/1024).toFixed(0)} KB`);
