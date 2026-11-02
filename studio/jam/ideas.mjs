// A round of ideas for Studio Jam's idea loop: built from the user's snapshots (and, from round 2, the order they
// arranged them in), each a full combination in the snapshot format, with a line on why. Clips come from the packs and
// the user's own variants, changed with the model's transforms; sounds from the library, steered by their ratings.
// Usage: node studio/jam/ideas.mjs <dir of exported snaps> <round> <out.json> (round 1 from Snaps 4 and 5, round 2 from Snap 9,
// round 3 three whole songs from Snap 10: each a list of sections, every section a scene in the v2 format; round 4 the three again;
// round 5 a new song: node studio/jam/ideas.mjs <snaps> 5 studio/arrange/songs/round5.json; round 6 three songs from the
// user's scenes, all analog: node studio/jam/ideas.mjs <snaps> 6 studio/arrange/songs/round6.json)
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
    // (a v2 scene already holds its rhythm and notes, a line of notes longer than its rhythm included: kept as they are)
    if (c.clip && !c.rhythm?.hits) { const nm = PK.clips.find(k => k.id === c.clip.id)?.name || 'Saved part', sp = split(c.role, c.clip, nm); c.rhythm = {...sp.rhythm, feel: c.feel || 0}; c.notes = sp.notes; c.preset = PK.clips.some(k => k.id === c.clip.id) ? c.clip.id : null; } });
  if (hats) Object.assign(base.cols[COL.hats], hats);
  const line = base.cols[COL.bass]; line.rhythm = fresh(line.rhythm, 'Your off-beat line'); line.notes = fresh(line.notes, 'Your off-beat line'); line.preset = null;
  const LINE = {R: line.rhythm, N: line.notes}, R3 = rng(seed);
  // a pack clip as a part; tools on parts
  const pack = (role, id) => { const cl = PK.clips.find(k => k.id === id), sp = split(role, cl, cl.name), col = base.cols.find(c => c.role === role);
    return {R: {...sp.rhythm, feel: col?.feel || 0}, N: sp.notes, preset: id}; };
  const rt = (role, k, m) => { const o = rhythmTool(k, role, m.R, m.N, R3); return {R: o.rhythm, N: o.notes || m.N}; };
  const nt = (role, k, m) => ({R: m.R, N: notesTool(k, role, m.N, R3)});
  const BAR1 = LINE.R.len > 16 ? rt('bass', 'shorter', rt('bass', 'shorter', LINE)) : LINE; // one bar of your line (a line a bar or shorter as it is)
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
  return {PK, base, GROUND, LINE, BAR1, pack, rt, nt, of, song, n0: () => (n = 0), bassLong, strings};
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
// the drummer's notation and the round 4 grooves, shared by round 4 and round 5: drums bar by bar (each bar 16 steps,
// '.' a rest, a letter a voice at its own loudness, or a digit's tenths), a line bar by bar ([step, rung, 16ths, loudness, octave])
function grooves(){
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
  return {beat, tune, HK, PK4, KK, E16, K4, K13, G1, G2, G3, FILL, HGROOVE, hatsTo, offTo, HSPARSE, HRISE, P1, P2, P3, PDEV}; }
// round 4: the three songs again, each grown its own way from the user's comments on round 3 (studio/taste.md,
// 2026-10-23): smoother, drier hats with a drummer's dynamics and fills; the parts played with small variations and
// syncopation; the kick held back while the motifs and percussion build; the bass a short grooving motif (Clearing's
// off-beat one from "Back, changed"); the pad pulsing on the beat, its filter opening into the drop
function round4(){ const S10 = SNAPS['Snap 10']; if (!S10) throw new Error('needs Snap 10 in ' + dir);
  const {LINE, pack, rt, nt, of, song, n0, bassLong, strings} = kit(S10, 404, {sound: 'h3-smooth', echo: false, verb: true, y: .25});
  const HANDS = of('perc'), DROPS = of('lead'), MARIMBA = of('lead2');
  const {beat, tune, HK, PK4, KK, E16, K4, K13, HGROOVE, hatsTo, offTo, HSPARSE, HRISE, P1, P2, P3, PDEV} = grooves();
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
// round 5: a new song from round 4's timbre and the user's taste (studio/taste.md): the sounds they liked (the FM pluck
// bass, the hands, the marimba, the smoothed hats) beside three of the analog instruments (the Deep kick, the warm pulse
// pad played as a gated chord, the ring bell), in F, on suspended chords that don't resolve. More dynamics than round 4:
// every part grows a few notes at a time, its loudness shaped bar by bar, the chord's filter opening and closing over
// sections, a real breakdown and a drop; and more variation: the bell's one note becomes a phrase that's answered, the
// marimba's seven-step loop drifts against the four and changes a note each time it comes back
function round5(){ const S10 = SNAPS['Snap 10']; if (!S10) throw new Error('needs Snap 10 in ' + dir);
  const {base, GROUND, pack, rt, song, n0} = kit(S10, 505, {sound: 'h3-smooth', echo: false, verb: true, y: .25});
  const {beat, tune, PK4, K4, K13, HGROOVE, hatsTo, HSPARSE, HRISE, P1, P2, P3, PDEV} = grooves();
  // the grounds, in F: the pedal's colour moving, eleven and six, and the suspended rise for the breakdown
  for (const id of ['lib-colour', 'lib-elevens', 'lib-susrise']) { const H = inKey(LIB.find(h => h.id === id), 'F'); GROUND[H.id] = H; }
  const OPEN = 'lib-colour@F', BODY = 'lib-elevens@F', LIFT = 'lib-susrise@F';
  // the sounds, one a part all the way through (each can go back to round 4's with ↩ by its name)
  const SND5 = {kick: 'k4-deep', hats: 'h3-smooth', perc: 'p3-forest', bass: 'b-fmpluck', chords: 'a5-mix-chords', lead: 'a5-bell', lead2: 'l-marimba'};
  const VOL5 = {kick: -1, hats: 5, perc: 0, bass: -2.5, chords: -9, lead: -3, lead2: 4};
  base.cols.forEach(c => { const k = Object.keys(COL).find(k => COL[k] === base.cols.indexOf(c)); c.sound = SND5[k]; c.locked = true; c.mix = {...c.mix, vol: VOL5[k]}; });
  const LIGHT = m => ({...m, play: 1}), LOOSE = m => ({...m, play: 2});
  // a loop of any length from its hits: [step, rung, 16ths, loudness, octave]
  const loop = (name, len, hits) => ({R: {len, hits: hits.map(([s, , l, v]) => [s, l, v]), feel: 0, name, base: name, ops: []}, N: {seq: hits.map(([, r, , , o = 0]) => [r, o]), name, base: name, ops: []}});

  // the bass grows a few notes at a time (principle 4), on the and like the motif you liked, its loudness shaped
  const B1 = tune('Two notes on the and', [[[2, 0, 3, .8]], [[2, 0, 2, .76], [10, 2, 2, .62]]]);
  const B2 = tune('Two notes, then answered', [[[2, 0, 2, .8], [10, 2, 2, .66], [14, 3, 1, .5]], [[2, 0, 2, .78], [7, 0, 1, .42], [10, 2, 2, .68], [14, 1, 1, .55]]]);
  const B3 = tune('The line, grown', [[[2, 0, 2, .82], [10, 2, 2, .66], [14, 3, 1, .52]], [[2, 0, 2, .78], [7, 0, 1, .44], [10, 2, 2, .7], [14, 1, 1, .56]],
    [[2, 0, 2, .8], [6, 1, 1, .5], [10, 2, 2, .68], [13, 4, 1, .58]], [[2, 0, 1, .84], [3, 0, 1, .5, 1], [6, 2, 1, .6], [10, 3, 2, .72], [14, 4, 1, .62], [15, 2, 1, .45]]]);
  const BLONG = tune('Long notes, fading', [[[2, 0, 12, .7]], [[2, 2, 8, .58]], [[2, 0, 12, .5]], [[2, 0, 10, .4]]]);
  // the bell: one note, then two rising, then a phrase answered (principle 5); up an octave, sparse, nothing held long
  const L1 = tune('One bell', [[[0, 4, 4, .55, 1]], [], [], []]);
  const L2 = tune('A bell, rising', [[[0, 4, 3, .58, 1]], [], [[8, 5, 2, .48, 1], [12, 6, 3, .54, 1]], []]);
  const L3 = tune('The bell’s phrase, answered', [[[0, 4, 2, .6, 1], [6, 5, 2, .48, 1]], [[0, 6, 4, .58, 1]], [[0, 4, 2, .6, 1], [6, 5, 2, .5, 1], [10, 7, 2, .55, 1]], [[0, 6, 3, .62, 1], [12, 4, 2, .42, 1]]]);
  // the marimba: seven steps against the four, drifting (principle 9); each time it comes back one note has moved
  const M7 = loop('Seven against four', 7, [[0, 2, 1, .6], [3, 3, 1, .45], [5, 4, 1, .52]]);
  const M7b = loop('Seven against four, a note moved', 7, [[0, 2, 1, .62], [3, 4, 1, .46], [5, 3, 1, .5, 1]]);
  const M7c = loop('Seven against four, a step added', 7, [[0, 2, 1, .64], [2, 3, 1, .38], [3, 4, 1, .5], [5, 3, 1, .52, 1]]);
  // the chord gated in 16ths (as you loved in Glasshouse), never held: its filter opening and closing across the song
  const GATE = pack('chords', 'c3-gated'), STABS = pack('chords', 'c3-fives');
  const CH = (m, x, ramp, more = {}) => ({...m, x, motion: 3, ...(ramp ? {ramp: {x: ramp}} : {}), ...more});
  // the hands with a rim in fives over them for the middle
  const FIVES = pack('perc', 'p3-five');
  // the kick waits through the opening, then one and three, then four; the hats a drummer's, fills into each change
  return [
    (n0(), song('r5-1', 'Moth light', 'A new song in round 4\'s colours, in F on suspended chords: the hands, the marimba in sevens and one bell open it; the kick waits; your FM pluck bass grows from two notes to a line; a gated analog chord opens like a lamp coming up; a breakdown climbs a suspended rise without resolving, and the drop brings it all back together before it fades to embers. New here: the analog Deep kick, the warm pulse chord and the ring bell (↩ by a track\'s sound puts round 4\'s back).', 122, [
      ['Moths', 8, OPEN, {perc: LIGHT(P1), lead: L1, lead2: LIGHT(M7)}, 'No kick: the hands thinned, one bell every four bars, the marimba\'s seven-step loop drifting against the bar.'],
      ['Lamplight', 8, OPEN, {hats: HSPARSE, perc: P2, lead: L2, lead2: LIGHT(M7)}, 'A few closed hats; twigs join the hands; the bell rises to a second and third note.'],
      ['Wingbeat', 16, BODY, {kick: K13, hats: LIGHT(hatsTo(16)), perc: P3, bass: B1, lead: L2, lead2: M7b}, 'Onto eleven and six: the kick on one and three, the drummer\'s hats, and the bass: just two notes on the and. The marimba has moved a note.'],
      ['Circling', 16, BODY, {kick: K4, hats: LIGHT(HGROOVE), perc: P3, bass: B2, chords: CH(GATE, .3, [.3, .55]), lead: L3}, 'Four on the floor; the bass answers itself; the gated chord comes in dark and opens a little; the bell finds its phrase. The marimba rests.'],
      ['Flutter', 16, BODY, {kick: K4, hats: LOOSE(hatsTo(16)), perc: PDEV, bass: rt('bass', 'develop', B2), chords: CH(GATE, .55, [.55, .7]), lead2: LIGHT(M7c)}, 'The bass developed over four bars, the hands answering with a bamboo fill, the marimba back with a step added; the bell rests; the chord brighter.'],
      ['Glass', 8, LIFT, {hats: HRISE, perc: pack('perc', 'p3-air'), chords: CH(GATE, .2, [.2, .92], {mix: {...base.cols[COL.chords].mix, vol: -7}}), lead: rt('lead', 'thin', L3)}, 'The breakdown: no kick, no bass; a suspended rise that never resolves, the chord\'s filter opening bar by bar, the hats rising into the drop.'],
      ['Swarm', 16, BODY, {kick: K4, hats: LOOSE(HGROOVE), perc: LIGHT(PDEV), bass: LIGHT(B3), chords: CH(STABS, .78, null, {mix: {...base.cols[COL.chords].mix, vol: -8, duck: 3}}), lead: LIGHT(L3), lead2: LIGHT(M7c)}, 'The drop: the bass\'s whole line, the chord as stabs in fives pumping on the kick, the bell and the marimba together for the first time.'],
      ['Embers', 8, OPEN, {kick: K13, perc: P1, bass: BLONG, chords: CH(GATE, .6, [.6, .15]), lead: L1, lead2: M7}, 'The kick thins, the bass in long notes fading, the chord closing, one bell, the marimba as it began.'],
    ])),
  ]; }
// round 6: three songs from the user's own jam scenes, every sound analog (the analog drum machine's kits, pack 4, and
// the analog synth, pack 5), as they asked to hear the analog sounds alone. Each song takes a run of scenes and plays
// their loops as they left them (the parts, the grounds, the tempo), grown the way studio/taste.md asks: the kick
// waiting, a bass gaining notes a few at a time, chords as stabs or a gated pulse whose filter opens and closes across
// the song (never a held pad), a breakdown that doesn't resolve, then the drop. None of the analog sounds they'd not
// like: no Reese, wobble, acid or hoover, no clap or snare on the backbeat, no long held lead
function round6(){ const need = n => { if (!SNAPS[n]) throw new Error(`needs ${n} in ${dir}`); return SNAPS[n]; };
  const S13 = need('Scene 13'), S14 = need('Scene 14'), S15 = need('Scene 15'), S16 = need('Scene 16'), S8 = need('Snap 8');
  const {beat, PK4, K4, K13, HGROOVE, hatsTo, offTo, HSPARSE, HRISE, P1, PDEV} = grooves();
  const LIGHT = m => ({...m, play: 1}), LOOSE = m => ({...m, play: 2});
  // a part straight from a scene: its rhythm and notes as the user left them
  const from = (S, col) => { const c = S.cols[COL[col]]; return {R: clone(c.rhythm), N: c.notes ? clone(c.notes) : null, preset: c.preset || null}; };
  // the same rhythm, its notes only the root (where a line starts, before it gains its notes)
  // (kit names the bass line it takes apart "Your off-beat line", after Snap 10's: these are the scenes' own)
  const mine = (m, name) => ({...m, R: fresh(m.R, name), N: m.N && fresh(m.N, name)});
  const rootOnly = (m, name) => ({...m, N: fresh({seq: [[0, 0]]}, name)});
  // every part on an analog sound, at its own level
  const analog = (base, SND, VOL) => base.cols.forEach((c, i) => { const k = Object.keys(COL).find(k => COL[k] === i); c.sound = SND[k]; c.locked = true; c.mix = {...c.mix, vol: VOL[k]}; });
  const VOL = {kick: -1, hats: -2, perc: -1, bass: -2.5, chords: -9, lead: -4, lead2: -3};
  const CH = (m, x, ramp, more = {}) => ({...m, x, ...(ramp ? {ramp: {x: ramp}} : {}), ...more});
  const HATS = {echo: false, verb: true, y: .25};
  const songs = [];

  // Drift: Scenes 11 to 13 (Sus2 drift, 122): the kick that skips every third bar, the 16th hats, the hand groove, the
  // tresillo bass with its twenty-note line, the stabs in fives, the blip in seven and the drops
  { const {base, GROUND, pack, rt, nt, of, song, n0} = kit(S13, 606, HATS);
    analog(base, {kick: 'k4-deep', hats: 'h4-warm', perc: 'p4-warm', bass: 'a5-mix-bass', chords: 'a5-mix-chords', lead: 'a5-mix-lead2', lead2: 'a5-mix-lead'}, VOL);
    for (const [id, key] of [['lib-susrise', 'C'], ['lib-susbreath', 'D']]) { const H = inKey(LIB.find(h => h.id === id), key); GROUND[H.id] = H; }
    const SKIP = of('kick'), H16 = of('hats'), HANDS = of('perc'), TRES = mine(of('bass'), 'Your tresillo line'), FIVES = of('chords'), BLIP = of('lead'), DROPS = of('lead2');
    const TRES1 = rootOnly(TRES, 'Tresillo on the root'), CHM = base.cols[COL.chords].mix;
    songs.push((n0(), song('r6-1', 'Drift', 'Scenes 11 to 13 as a song, every sound analog: the Warm kit\'s hands and the soft mallet\'s blip in seven open it; the kick waits, then comes in on one and three; your tresillo bass starts on its root and gains its twenty-note line; the stabs in fives come in dark and open up; a breakdown climbs suspended chords without landing, and the drop brings back your scene whole, with the kick that skips every third bar.', 122, [
      ['Mist', 8, 'sus-3', {perc: LIGHT(P1), lead: LIGHT(BLIP)}, 'The hands, thinned, and your blip in seven on the soft mallet, drifting against the bar.'],
      ['Drift', 8, 'sus-3', {hats: HSPARSE, perc: HANDS, lead: BLIP, lead2: LIGHT(rt('lead', 'thin', DROPS))}, 'A few closed hats; your hand groove; the drops come in, thinned, on the plucked pulse.'],
      ['Footfall', 16, 'sus-3', {kick: K13, hats: LIGHT(hatsTo(16)), perc: HANDS, bass: TRES1, lead: BLIP, lead2: LIGHT(DROPS)}, 'The kick on one and three; the drummer\'s hats; the bass on your tresillo, the root alone for now.'],
      ['The drift', 16, 'sus-3', {kick: SKIP, hats: LIGHT(H16), perc: HANDS, bass: TRES, chords: CH(FIVES, .3, [.3, .6]), lead: BLIP}, 'Your scene: the kick skipping every third bar, the 16th hats, the tresillo with its whole line, the stabs in fives coming in dark and opening a little.'],
      ['Lift', 8, 'lib-susrise@C', {hats: HRISE, perc: pack('perc', 'p3-air'), chords: CH(FIVES, .2, [.2, .92], {mix: {...CHM, vol: -7}}), lead2: nt('lead', 'answer', DROPS)}, 'The breakdown: no kick, no bass; sus2 chords stepping up from C without landing, the stabs opening bar by bar, the drops answered, the hats rising into the drop.'],
      ['Open water', 16, 'sus-3', {kick: K4, hats: LOOSE(HGROOVE), perc: LIGHT(PDEV), bass: LIGHT(TRES), chords: CH(FIVES, .75, null, {mix: {...CHM, vol: -8, duck: 3}}), lead: LIGHT(nt('lead', 'develop', BLIP)), lead2: LIGHT(DROPS)}, 'The drop: four on the floor, the stabs open and pumping on the kick, the blip developed, the drops back, the hands answering with a fill.'],
      ['Ebb', 8, 'lib-susbreath@D', {kick: K13, perc: P1, bass: TRES1, chords: CH(FIVES, .55, [.55, .12]), lead: BLIP}, 'On D, suspended: the kick thins, the bass back to its root, the stabs closing, the blip as it began.'],
    ]))); }

  // Broken light: Scenes 14 to 16 (126): the broken four, the open off-beat hats, the long bass on the and, the gated
  // 16th chord, the bamboo answer and the blip developed; then Scene 15's kickless F minor and Scene 16's open fifths
  { const {base, GROUND, song, n0} = kit(S14, 616, {...HATS, verb: false});
    analog(base, {kick: 'k4-warm', hats: 'h4-deep', perc: 'p4-deep', bass: 'a5-round', chords: 'a5-juno', lead: 'a5-bell', lead2: 'a5-mix-lead2'}, VOL);
    GROUND['lib-open'] = LIB.find(h => h.id === 'lib-open');
    const BROKEN = from(S14, 'kick'), OPENH = from(S14, 'hats'), HANDS = from(S14, 'perc'), LONG = from(S14, 'bass'), GATE = from(S14, 'chords'), ANSWER = from(S14, 'lead'), BLIP7 = from(S14, 'lead2');
    const ROLL = from(S15, 'bass'), ANSWER15 = from(S15, 'lead'), OFFS = from(S16, 'hats'), CHM = base.cols[COL.chords].mix;
    const G = (x, ramp, more = {}) => CH(GATE, x, ramp, {motion: 3, ...more});
    songs.push((n0(), song('r6-2', 'Broken light', 'Scenes 14 to 16 in the order you made them, every sound analog: the gated chord on the warm pad (its filter moving all the way through), your broken four on the Warm kick, the bamboo answer on the ring bell and the blip in seven on the soft mallet. Scene 15 becomes the breakdown, no kick and the bass rolling in threes on F minor; Scene 16\'s open fifths are the drop.', 126, [
      ['Glint', 8, 'sus-3', {perc: LIGHT(HANDS), chords: G(.15, [.15, .3], {mix: {...CHM, vol: -11}}), lead2: LIGHT(BLIP7)}, 'The hands, the blip in seven, and the gated chord far off, dark.'],
      ['Shards', 8, 'sus-3', {hats: offTo(8), perc: HANDS, chords: G(.3, [.3, .42]), lead: ANSWER, lead2: BLIP7}, 'Off-beat hats with a fill into the change; the bamboo answer on the ring bell; the chord a little brighter.'],
      ['Broken four', 16, 'sus-3', {kick: BROKEN, hats: LIGHT(OPENH), perc: HANDS, bass: LONG, chords: G(.42, [.42, .58]), lead: ANSWER, lead2: LIGHT(BLIP7)}, 'Scene 14: your broken four, the open off-beats with ticks between, the long bass on the and.'],
      ['Undertow', 8, 'f-madd9-3', {perc: HANDS, bass: rootOnly(ROLL, 'Rolling threes on the root'), chords: G(.35, [.35, .5]), lead: ANSWER15}, 'Scene 15: no kick and no hats, on F minor add 9; the bass rolling in threes, on its root at first.'],
      ['Rise', 8, 'f-madd9-3', {hats: HRISE, perc: LIGHT(HANDS), bass: ROLL, chords: G(.5, [.5, .95], {mix: {...CHM, vol: -8}}), lead: ANSWER15}, 'The bass gains its fifth; the chord opening bar by bar; the hats rising into the drop.'],
      ['Open fifths', 16, 'lib-open', {kick: K4, hats: LOOSE(OFFS), perc: LIGHT(PDEV), bass: LIGHT(ROLL), chords: G(.78, null, {mix: {...CHM, vol: -8, duck: 3}}), lead: LIGHT(ANSWER), lead2: LIGHT(BLIP7)}, 'Scene 16, the drop: open fifths to fourths on A, four on the floor, the off-beat hats played loose, the gated chord open and pumping on the kick, everything back.'],
      ['Afterglow', 8, 'sus-3', {kick: K13, perc: P1, bass: LONG, chords: G(.55, [.55, .1]), lead2: BLIP7}, 'The kick thins, the long bass on the and, the chord closing, the blip in seven to end.'],
    ]))); }

  // Seven: Snap 8 (the A pedal, 122) and its D minor turn: the seven-step bass, the stab on the and, the bird calls and
  // the marimba's answer, on the 808 kit
  { const {base, pack, nt, rt, of, song, n0, bassLong} = kit(S8, 626, HATS);
    analog(base, {kick: 'k4-808', hats: 'h4-808', perc: 'p4-808', bass: 'a5-round', chords: 'a5-pulse', lead: 'a5-bell', lead2: 'a5-mix-lead2'}, VOL);
    const FOUR = of('kick'), H16 = of('hats'), HANDS = of('perc'), SEVEN = mine(of('bass'), 'Your seven-step line'), AND = of('chords'), BIRDS = of('lead'), ANSWER = of('lead2');
    const SEVEN1 = rootOnly(SEVEN, 'Seven steps on the root'), SEVEND = nt('bass', 'develop', SEVEN), CHM = base.cols[COL.chords].mix;
    const LOGS = beat('Logs between the hands', PK4, [['...tT..l...T..wl', '...57..3...6..34'], ['...tT.l...tT.lwl', '...57.3...46.344']]);
    songs.push((n0(), song('r6-3', 'Seven', 'Snap 8, which you really liked, as a song on the 808 kit and the analog synth: your seven-step bass drifting against the four, starting on its root and growing into the whole line, developed when the harmony turns to D minor; the stab on the and as pulse brass, its filter opening into a kickless hollow; the bird calls on the ring bell and the marimba\'s answer on the soft mallet.', 122, [
      ['Seed', 8, 'a-pedal-3', {perc: LIGHT(P1), lead2: LIGHT(ANSWER)}, 'The hands, thinned, and the answer on the soft mallet.'],
      ['Seven', 8, 'a-pedal-3', {hats: HSPARSE, perc: HANDS, bass: SEVEN1, lead2: ANSWER}, 'A few hats; your hand groove; the bass on its seven steps, the root alone, drifting against the bar.'],
      ['Walk', 16, 'a-pedal-3', {kick: FOUR, hats: LIGHT(hatsTo(16)), perc: HANDS, bass: SEVEN, lead: BIRDS, lead2: LIGHT(ANSWER)}, 'The kick; the drummer\'s hats; the bass\'s whole line; the bird calls on the ring bell.'],
      ['The bass walks on', 16, 'd-m7m9', {kick: FOUR, hats: LIGHT(H16), perc: LOGS, bass: SEVEND, chords: CH(AND, .35, [.35, .6]), lead: BIRDS}, 'On D minor: the line developed (as it was, its tail moved, again, answered), your 16th hats, logs between the hands, the stab on the and coming in.'],
      ['Hollow', 8, 'd-m7m9', {hats: HRISE, perc: pack('perc', 'p3-air'), chords: CH(AND, .2, [.2, .9], {mix: {...CHM, vol: -7}}), lead: rt('lead', 'thin', BIRDS)}, 'No kick, no bass: the stab opening bar by bar, a bird or two, the hats rising into the drop.'],
      ['Full circle', 16, 'a-pedal-3', {kick: FOUR, hats: LOOSE(HGROOVE), perc: LIGHT(PDEV), bass: LIGHT(SEVEN), chords: CH(AND, .75, null, {mix: {...CHM, vol: -8, duck: 3}}), lead: LIGHT(BIRDS), lead2: LIGHT(ANSWER)}, 'The drop, home on the A pedal: everything together, the stab open and pumping on the kick, the hats played loose.'],
      ['Seed again', 8, 'a-pedal-3', {kick: K13, perc: P1, bass: bassLong, lead2: ANSWER}, 'The kick thins to one and three, the bass long on the and, the answer as it began.'],
    ]))); }
  return songs; }
// round 7: the first song from the sound lab's sounds (pack 7: the user's palette with their edits), minimal techno in A,
// built round an LFO pad that evolves: its cutoff breathing on a slow LFO of its own while the song moves its tone
// across the sections (closed in the haze, opening through the groove, blooming in the breakdown, gated at the drop,
// closing at the end). Dynamics bar by bar: the kick waiting, the bass from two notes to its line, the hats a drummer's,
// loudness shaped in every groove; the parts' levels moving section by section (`mix.vol`), the pad pumping on the kick
function round7(){ const S16 = SNAPS['Scene 16']; if (!S16) throw new Error('needs Scene 16 in ' + dir);
  const {base, GROUND, pack, song, n0} = kit(S16, 707, {echo: false, verb: true, y: .25});
  const {beat, tune, PK4, K4, K13, HGROOVE, hatsTo, HSPARSE, HRISE, P1, P2, P3, PDEV} = grooves();
  for (const id of ['lib-deep', 'lib-colour', 'lib-dorswing', 'lib-susrise']) GROUND[id] ??= inKey(LIB.find(h => h.id === id), 'A');
  const SND7 = {kick: 'l7-kick', hats: 'l7-hats', perc: 'l7-perc', bass: 'l7-bass', chords: 'l7-pad', lead: 'l7-marimba', lead2: 'l7-glass'};
  const VOL7 = {kick: 0, hats: -3, perc: -2, bass: -1, chords: -6, lead: -5, lead2: -8};
  base.cols.forEach((c, i) => { const k = Object.keys(COL).find(k => COL[k] === i); c.sound = SND7[k]; c.locked = true; c.mix = {...c.mix, vol: VOL7[k], duck: 0}; });
  const LIGHT = m => ({...m, play: 1}), LOOSE = m => ({...m, play: 2});
  const MX = (col, more) => ({...base.cols[COL[col]].mix, ...more});
  const loop = (name, len, hits) => ({R: {len, hits: hits.map(([s, , l, v]) => [s, l, v]), feel: 0, name, base: name, ops: []}, N: {seq: hits.map(([, r, , , o = 0]) => [r, o]), name, base: name, ops: []}});
  // the pad: one chord a phrase (it moves by itself: the LFO on its cutoff), its tone set and moved by each section
  const PHRASE = pack('chords', 'c3-phrase'), GATED = pack('chords', 'c3-gated');
  const PAD = (x, ramp, more = {}) => ({...PHRASE, x, ...(ramp ? {ramp: {x: ramp}} : {}), ...more});
  // the bass: two notes on the and, then answered, then its whole line (louder notes on the 1 of each bar)
  const B1 = tune('Two notes on the and', [[[2, 0, 3, .82]], [[2, 0, 2, .76], [10, 2, 2, .6]]]);
  const B2 = tune('Answered', [[[2, 0, 2, .84], [10, 2, 2, .64], [14, 3, 1, .5]], [[2, 0, 2, .78], [7, 0, 1, .42], [10, 2, 2, .66], [14, 1, 1, .52]]]);
  const B3 = tune('The line', [[[2, 0, 2, .86], [10, 2, 2, .66], [14, 3, 1, .52]], [[2, 0, 2, .8], [7, 0, 1, .46], [10, 2, 2, .7], [14, 1, 1, .56]],
    [[2, 0, 2, .82], [6, 1, 1, .5], [10, 2, 2, .68], [13, 4, 1, .56]], [[2, 0, 1, .86], [3, 0, 1, .5, 1], [6, 2, 1, .6], [10, 3, 2, .72], [14, 4, 1, .6], [15, 2, 1, .44]]]);
  const BLONG = tune('Long, fading', [[[2, 0, 12, .7]], [[2, 2, 8, .58]], [[2, 0, 12, .48]], [[2, 0, 10, .38]]]);
  // the marimba: seven steps against the four, a note moved each time it comes back
  const M7 = loop('Seven against four', 7, [[0, 2, 1, .6], [3, 4, 1, .45], [5, 3, 1, .5]]), M7b = loop('Seven, a note moved', 7, [[0, 2, 1, .62], [3, 3, 1, .46], [5, 4, 1, .52, 1]]);
  // the glass: stabs in fives, high and sparse, a rung moving
  const GL = loop('Glass in fives', 80, [[2, 4, 1, .55, 1], [22, 4, 1, .4, 1], [42, 5, 1, .5, 1], [62, 3, 1, .42, 1]]);
  // the hats: a drummer's, with more ghosts in the groove and a fill into each change
  const H = n => hatsTo(n);
  return [
    (n0(), song('r7-1', 'Low Tide', 'The first song from the sound lab: your palette (your 808 kick, the real hats, the dry hands and wood, FM round, the glass stab, the FM marimba) round an evolving LFO pad. The pad breathes by itself (its cutoff on a slow LFO), and the song moves its tone across the sections: closed in the haze, opening through the groove, blooming in the breakdown, gated at the drop, closing at the end. The kick waits, the bass grows from two notes to its line, the hats play like a drummer, every part\'s loudness shaped.', 122, [
      ['Haze', 16, 'lib-deep', {perc: LIGHT(P1), chords: PAD(.18, [.18, .38], {mix: MX('chords', {vol: -5})})}, 'The pad alone with the hands: its filter nearly closed, breathing on its own LFO, opening a little over sixteen bars.'],
      ['Pulse', 16, 'lib-colour', {kick: K13, hats: HSPARSE, perc: P2, chords: PAD(.38, [.38, .48], {mix: MX('chords', {vol: -6, duck: 2})}), lead: LIGHT(M7)}, 'The kick on one and three, a few hats, twigs in the hands, the marimba\'s seven steps drifting against the bar; the pad starts to pump.'],
      ['Groove', 32, 'lib-colour', {kick: K4, hats: LIGHT(H(32)), perc: P3, bass: B1, chords: PAD(.46, [.46, .62], {mix: MX('chords', {vol: -7, duck: 3})}), lead: LIGHT(M7)}, 'Four on the floor, the drummer\'s hats, and the bass: two notes on the and. The pad opening slowly over thirty-two bars.'],
      ['Deeper', 16, 'lib-dorswing', {kick: K4, hats: LIGHT(H(16)), perc: PDEV, bass: B2, chords: PAD(.62, [.62, .7], {mix: MX('chords', {vol: -7, duck: 3})}), lead: M7b, lead2: LIGHT(GL)}, 'The dorian lift (A minor 9 to D 9): the bass answers itself, the hands answer each other, the glass stab comes in high and sparse.'],
      ['Bloom', 8, 'lib-susrise', {perc: pack('perc', 'p3-air'), chords: PAD(.3, [.3, .95], {mix: MX('chords', {vol: -4})}), lead2: GL}, 'The breakdown: no kick, no bass; sus2 chords stepping up, the pad blooming open bar by bar.'],
      ['Rise', 8, 'lib-susrise', {hats: HRISE, perc: LIGHT(P1), chords: {...GATED, sound: 'l7-padgate', x: .5, ramp: {x: [.5, .85]}, mix: MX('chords', {vol: -6})}, lead: LIGHT(M7b)}, 'The pad becomes the gated unison pad, cut into 16ths and opening; the hats rising into the drop.'],
      ['Drop', 32, 'lib-colour', {kick: K4, hats: LOOSE(HGROOVE), perc: LIGHT(PDEV), bass: LIGHT(B3), chords: {...GATED, sound: 'l7-padgate', x: .8, mix: MX('chords', {vol: -7, duck: 4})}, lead: LIGHT(M7b), lead2: LIGHT(GL)}, 'The drop: the bass\'s whole line, the gated pad open and pumping on the kick, the marimba and the glass together, the hats played loose.'],
      ['Ebb', 16, 'lib-deep', {kick: K13, perc: P1, bass: BLONG, chords: PAD(.6, [.6, .14], {mix: MX('chords', {vol: -6})}), lead: M7}, 'The kick thins, the bass in long notes fading, the evolving pad back and closing, the marimba as it began.'],
    ])),
  ]; }

// round 8: the sketchbook, sixteen ideas as scenes for the Session and Scene views (the user asked to mix and match
// ideas and change their sounds there, after the sound lab's music round 2): darker and minimal, every scene eight bars
// on its own ground, the parts on the moving sounds (pack 8) and the user's palette (pack 7). Nine tracks: the drums (a
// rack), Bass and Bass 2, Chords and Pad, Lead and Arp, so an idea can be heard on two sounds side by side.
function round8(){ const S16 = SNAPS['Scene 16']; if (!S16) throw new Error('needs Scene 16 in ' + dir);
  const {base, GROUND, song, n0} = kit(S16, 808, {echo: false, verb: true, y: .25});
  const {beat, tune, HK, KK} = grooves();
  // two more columns: a second bass and a pad (each a copy of its kind's column), named; the second lead is the arp
  COL.bass2 = 7; COL.pad = 8;
  base.cols.push({...clone(base.cols[COL.bass]), name: 'Bass 2'}, {...clone(base.cols[COL.chords]), name: 'Pad'}); base.cols[COL.lead2].name = 'Arp';
  const SND = {kick: 'l7-kick', hats: 'l7-hats', perc: 'l7-perc', bass: 'l8-pulse', bass2: 'l8-echo', chords: 'l8-keys', pad: 'l8-drone', lead: 'l7-marimba', lead2: 'l8-arp'};
  const VOL = {kick: 0, hats: -3, perc: -3, bass: -1, bass2: -2, chords: -6, pad: -8, lead: -5, lead2: -8};
  for (const [k, i] of Object.entries(COL)) { const c = base.cols[i]; c.sound = SND[k]; c.locked = true; c.mix = {...c.mix, vol: VOL[k], duck: 0}; delete c.x; delete c.ramp; }
  // the grounds: the library's darker ones, and a few written here
  const G8 = (id, name, list) => (GROUND[id] = {id, name, words: '', mode: 'minor', key: 'A', bars: list.flatMap(([s, n]) => Array(n).fill(s))}, id);
  const still = G8('g8-still', 'A minor 7, still', [['A:m7', 8]]), fall = G8('g8-fall', 'Falling: A minor, G, F', [['A:m7', 2], ['G:add9', 2], ['F:maj7', 4]]),
    two = G8('g8-two', 'A minor and E minor', [['A:m7', 4], ['E:m7', 4]]), dub = G8('g8-dub', 'Dub: i and iv', [['A:m7', 2], ['D:m7', 2]]),
    minv = G8('g8-minv', 'Minor four, minor five', [['D:m7', 2], ['E:m7', 2], ['A:m7', 4]]);
  for (const id of ['lib-phryg', 'lib-halfdim', 'lib-elevens', 'lib-open']) GROUND[id] ??= inKey(LIB.find(h => h.id === id), 'A');
  // drums bar by bar (the percussion's own letters here: n the snare)
  const PK = {T: 'tomL', t: 'tomH', L: 'log', l: 'logH', w: 'wood', d: 'rim', s: 'shaker', c: 'clave', b: 'bowl', G: 'gong', n: 'snare'};
  const KD = beat('Deep four', KK, ['K...k...k...k...']), KB = beat('Broken kick', KK, ['K.....k...k.....', 'K.......k..k....']), KH = beat('Half time', KK, ['K.........k.....', 'K.......k.k.....']),
    KS = beat('Stutter', KK, ['K..k....k.k.....', 'K...k..k..k.....']), KSP = beat('Kick and space', KK, ['K.....k.........', 'K.....k.........', 'K.....k.........', 'K.....k.....g...']);
  const HD = beat('Dark 16ths', HK, [['g.gog.gog.gog.go', '2.242.242.242.24']]), HS = beat('Off-beat, short', HK, [['..o...o...o...o.', '..4...3...4...3.']]),
    HG = beat('Ghosts on the e', HK, [['goggg.gggoggg.gg', '3522.2223522.22.'.replace(/\./g, '2')]]), HST = beat('Stutter hats', HK, ['x..g.x..g..x.g..', '.x..g.x...g.x..g']),
    HO = beat('One open hat', HK, ['..g...g...g...g.', '..g...g...q...g.']);
  const PR = beat('Rim, far apart', PK, [['..........d.....', '..........5.....'], ['..........d..d..', '..........5..3..']]), PDUB = beat('Rim off the backbeat', PK, [['.......d.......d', '.......6.......3'], ['.......d......d.', '.......6......4.']]),
    PSN = beat('Half-time snare', PK, [['........n.......', '........5.......'], ['........n....T..', '........5....3..']]), PSH = beat('Shaker', PK, [['s.ss'.repeat(4), '3.23'.repeat(4)]]),
    PT3 = beat('Toms in threes, low', PK, [['T..T..T..T..T..T', '4..3..3..4..3..3'], ['..T..T..T..T..T.', '..3..4..3..3..4.'], ['.T..T..T..T..T..', '.3..3..4..3..3..']]),
    PW = beat('Wood and logs', PK, [['...L..w....l..w.', '...5..3....4..3.'], ['...L.....w.l....', '...5.....3.4....']]);
  // lines: [step, rung of the chord, length, loudness, octave]; the chords' rhythm alone (they play the ground)
  const BP = tune('Root held', [[[0, 0, 14, .8]], [[0, 0, 10, .75], [12, 1, 3, .6]]]), BE = tune('Three notes, echoed', [[[2, 0, 2, .85]], [[2, 0, 2, .8], [11, -1, 2, .6]]]),
    BSW = tune('Slow glide', [[[0, 0, 24, .8]], [[8, 1, 8, .7]]]),
    BA = tune('Arpeggiated', [[[0, 0, 1, .85], [2, 2, 1, .55], [3, 0, 1, .6], [5, 1, 1, .6], [7, 2, 1, .5], [8, 0, 1, .75], [10, 3, 1, .5], [11, 0, 1, .55], [13, 1, 1, .6], [14, 2, 1, .5]]]),
    BD = tune('Dub, falling', [[[0, 0, 6, .85], [12, 0, 2, .6]], [[0, 0, 6, .8], [10, -2, 3, .7]]]),
    BW = tune('Walking down', [[[0, 0, 3, .85], [4, 0, 3, .6], [8, -1, 3, .72], [12, -1, 3, .6]], [[0, -2, 3, .75], [4, -2, 3, .6], [8, -3, 3, .72], [12, -1, 3, .6]]]),
    BPK = tune('In the pocket', [[[3, 0, 2, .8], [10, 0, 1, .55]], [[3, 0, 2, .78], [9, 1, 2, .6], [14, 0, 1, .5]]]);
  const crd = (name, bars) => { const t = tune(name, bars.map(b => b.map(([s, l, v]) => [s, 0, l, v]))); return {R: t.R, N: {seq: [], name, base: name, ops: []}}; };
  const CH = crd('Held', [[[0, 31, .7]], []]), CK = crd('Struck off the beat', [[[0, 3, .62], [6, 3, .5], [10, 3, .58]]]), CDUB = crd('Dub stabs', [[[2, 1, .6], [11, 1, .45]]]),
    CSY = crd('Syncopated', [[[0, 2, .6], [3, 2, .45], [8, 2, .55], [14, 2, .45]]]), CBAR = crd('One a bar', [[[0, 15, .6]]]);
  // a loop of any length (a riff in sevens, threes, fives)
  const loop = (name, len, hits) => ({R: {len, hits: hits.map(([s, , l, v]) => [s, l, v]), feel: 0, name, base: name, ops: []}, N: {seq: hits.map(([, r, , , o = 0]) => [r, o]), name, base: name, ops: []}});
  const L7 = loop('Seven against four', 7, [[0, 2, 1, .6], [3, 4, 1, .45], [5, 3, 1, .5]]), LBELL = loop('Few notes, falling', 32, [[0, 4, 2, .6], [11, 3, 2, .5], [22, 2, 3, .55]]),
    LBL = loop('Off the grid', 32, [[3, 4, 1, .5], [6, 2, 1, .4], [13, 3, 1, .45], [19, 4, 1, .5], [25, 5, 1, .4], [30, 2, 1, .35]]),
    LM = loop('Low, five a bar', 16, [[0, 0, 1, .7, -1], [3, 1, 1, .5, -1], [6, -1, 1, .55, -1], [10, 0, 1, .6, -1], [14, 2, 1, .5, -1]]);
  const A3 = loop('Threes against four', 3, [[0, 0, 1, .7], [1, 1, 1, .45], [2, 2, 1, .5]]), A16 = loop('Up and down in 8ths', 16, [0, 1, 2, 3, 4, 3, 2, 1].map((r, i) => [i*2, r, 1, i ? .5 : .7])),
    A5 = loop('Fives', 5, [[0, 0, 1, .6], [2, 2, 1, .45]]), AOFF = loop('Off the 16ths', 16, [[1, 2, 1, .45], [3, 0, 1, .5], [6, 3, 1, .4], [9, 1, 1, .5], [11, 2, 1, .42], [14, 4, 1, .45]]);
  return [
    (n0(), song('r8-1', 'Sketchbook', 'Sixteen ideas to mix and match in the Session and Scene views: launch the drums from one, the bass from another, the chords from a third; change a track\'s sound (Y) to hear an idea on another; keep what works as a new scene. Darker and minimal, every part on a sound that moves by itself (pack 8) or one from your palette (pack 7). Two basses (the pulsing bass and the delayed FM round), two chord tracks (muted keys struck, a low drone held), a lead (your FM marimba) and an arp.', 120, [
      ['Pulse', 8, still, {kick: KD, hats: HD, bass: BP, pad: CH}, 'The pulsing bass on one held note, the drone under it, the deep four and dark 16ths: everything moving by itself.'],
      ['Shadow', 8, 'lib-phryg', {kick: KD, hats: HD, perc: PR, bass: BP, pad: CH, lead2: A3}, 'Three bars of A minor and one of B flat a semitone above; the arp in threes against the four.'],
      ['Eraser', 8, 'lib-phryg', {kick: KS, hats: HST, perc: PR, bass2: BE, lead: LBL}, 'A stuttering kick and hats, the delayed bass\'s three notes, the marimba off the grid.'],
      ['Deep dub', 8, dub, {kick: KB, hats: HO, perc: PDUB, bass2: BD, chords: CDUB, lead: LBELL}, 'The broken kick with space, the rim off the backbeat, the echoing bass falling, dub stabs on the keys, a few notes on the marimba.'],
      ['Half light', 8, fall, {kick: KH, hats: HS, perc: PSN, bass: BSW, chords: CK, lead2: AOFF}, 'Half time with a soft snare on the 3, the bass gliding under keys falling A minor, G, F, the arp on the off 16ths.'],
      ['Night drive', 8, two, {kick: KD, hats: HG, bass2: BA, pad: CH, lead2: A16}, 'An arpeggiated bass under A minor then E minor, the arp up and down above it, the drone holding.'],
      ['Kick and space', 8, still, {kick: KSP, perc: PR, bass: BP, lead: L7}, 'Hardly anything: the kick on the 1 and the and of 2, a rim, the pulsing bass, the marimba\'s seven steps.'],
      ['Slow toms', 8, 'lib-elevens', {kick: KD, hats: HS, perc: PT3, bass2: BW, pad: CH}, 'Low toms in threes under A minor 11 and F major 7, the bass walking down.'],
      ['Falling keys', 8, fall, {kick: KD, hats: HD, perc: PSH, bass2: BPK, chords: CK, lead: LM}, 'The keys struck off the beat falling, a bass in the pocket, the marimba low.'],
      ['Sigh', 8, 'lib-halfdim', {kick: KH, hats: HO, bass: BSW, pad: CH, lead: LBELL}, 'Half time, A minor and the half-diminished II: a sigh and home, the bell-like marimba falling.'],
      ['Minor four, five', 8, minv, {kick: KD, hats: HG, perc: PW, bass: BP, chords: CSY, lead2: A5}, 'D minor, E minor, home to A minor; wood and logs, the keys syncopated, the arp in fives.'],
      ['Open fifths', 8, 'lib-open', {kick: KB, hats: HD, bass2: BE, pad: CH, lead2: A3}, 'Bare fifths then fourths on A: the broken kick, the echoed bass, the arp in threes.'],
      ['Stutter dub', 8, dub, {kick: KS, hats: HST, perc: PDUB, bass: BD, chords: CDUB}, 'The stutter groove under dub stabs, the pulsing bass playing the dub line.'],
      ['Drone', 8, still, {perc: PW, bass: BSW, pad: CH, lead: LBL}, 'No kick: wood and logs, the gliding bass, the drone, a few notes off the grid. A breakdown to launch between the others.'],
      ['Rolling, slow', 8, two, {kick: KD, hats: HD, perc: PT3, bass2: BA, chords: CBAR, lead: L7}, 'Toms in threes, the arpeggiated bass, the keys once a bar, the marimba in sevens: polyrhythms, slowly.'],
      ['Everything moving', 8, 'lib-phryg', {kick: KD, hats: HD, perc: PR, bass: BP, bass2: BE, pad: CH, lead2: A16, lead: LBL}, 'All of it at once: both basses, the drone, the arp and the marimba. Take parts away from here.'],
    ])),
  ]; }
const ideas = {1: round1, 2: round2, 3: round3, 4: round4, 5: round5, 6: round6, 7: round7, 8: round8}[ROUND]();
ideas.forEach((x, i) => { x.order = i; x.id = `r${ROUND}-${i + 1}`; x.at = new Date().toISOString(); });
for (const x of ideas) for (const y of x.sections || []) y.at = x.at;
for (const x of ideas) for (const c of x.cols || []) { if (c.vars.length !== c.made.length || c.lens && c.lens.length !== c.vars.length) throw new Error(x.name + ': strip out of step'); if (c.lens) while (c.lens.length < c.vars.length) c.lens.push(null); }
fs.writeFileSync(outFile, JSON.stringify(ideas));
console.log(ideas.map(x => `${x.id} [${x.kind}] ${x.name}` + (x.sections ? ': ' + x.sections.map(y => `${y.name.split(': ')[1]} ${y.bars}`).join(', ') : '')).join('\n'), `\n${ideas.length} ideas, ${(fs.statSync(outFile).size/1024).toFixed(0)} KB`);
