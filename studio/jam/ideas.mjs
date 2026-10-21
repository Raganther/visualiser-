// A round of ideas for Studio Jam's idea loop: built from the user's snapshots (and, from round 2, the order they
// arranged them in), each a full combination in the snapshot format, with a line on why. Clips come from the packs and
// the user's own variants, changed with the model's transforms; sounds from the library, steered by their ratings.
// Usage: node studio/jam/ideas.mjs <dir of exported snaps> <round> <out.json> (round 1 from Snaps 4 and 5, round 2 from Snap 9)
// (export: ArtifactData list snaps → out_dir; write: ArtifactData batch set into `ideas`)
import fs from 'node:fs';
import path from 'node:path';
import { XFORMS, mutate } from './model.js';
import { develop, sequence, thin } from './riff.js';
import { rng } from '../lib/rng.js';

const here = path.dirname(new URL(import.meta.url).pathname), [dir, roundArg, outFile] = process.argv.slice(2), ROUND = +roundArg || 1;
const PACKS = Object.fromEntries(fs.readdirSync(path.join(here, 'packs')).filter(f => /^pack-\d+\.json$/.test(f)).map(f => { const p = JSON.parse(fs.readFileSync(path.join(here, 'packs', f), 'utf8')); return [p.id, p]; }));
const SNAPS = Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), x = d.data || d; return [x.name, x]; }));
const R = rng(100 + ROUND), clone = x => JSON.parse(JSON.stringify(x));
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
const ideas = {1: round1, 2: round2}[ROUND]();
ideas.forEach((x, i) => { x.order = i; x.id = `r${ROUND}-${i + 1}`; x.at = new Date().toISOString(); });
for (const x of ideas) for (const c of x.cols) { if (c.vars.length !== c.made.length || c.lens && c.lens.length !== c.vars.length) throw new Error(x.name + ': strip out of step'); if (c.lens) while (c.lens.length < c.vars.length) c.lens.push(null); }
fs.writeFileSync(outFile, JSON.stringify(ideas));
console.log(ideas.map(x => `${x.id} [${x.kind}] ${x.name}`).join('\n'), `\n${ideas.length} ideas, ${(fs.statSync(outFile).size/1024).toFixed(0)} KB`);
