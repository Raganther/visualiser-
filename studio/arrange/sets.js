// The sound sets a song can be heard on: the sounds Studio Jam wrote it with, or the analog set, the analog drum machine
// and the analog synth as the Mix Lab plays round 4 (`ANALOG` in studio/mix/mix.js, so the two stay one set). Round 4
// opens on the analog set. A leaf of the arrangement page; the tests run it in node.
import { ANALOG, KICK, chanOf } from '../mix/mix.js';
import { rackSound } from './rack.js';

export const SETS = {analog: 'Analog', song: 'The song’s'};
// the drum machine's sounds as the Mix Lab has them (its kick made round and undriven, its percussion's toms tuned
// and the forest's hits on its voices), each pad gain-staged as the pack 4 sound it's made from (`from`)
const PAD_OF = ANALOG.perc.map, PERC_OVER = ANALOG.perc.src.over;
const MADE = {
  'an-kick': {id: 'an-kick', role: 'kick', name: 'Analog Deep kick · Mix Lab', words: 'The analog drum machine’s Deep kick, made round, dark and undriven, as the Mix Lab plays it.',
    voices: {kick: {kit: KICK.kit, over: KICK.over, from: 'k4-deep'}}},
  'an-perc': {id: 'an-perc', role: 'perc', name: 'Analog Warm percussion · Mix Lab', words: ANALOG.perc.words + ' As the Mix Lab plays it.',
    voices: Object.fromEntries(['snare', 'clap', 'tomL', 'tomH', 'log', 'logH', 'wood', 'rim', 'clave', 'cow', 'metal', 'shaker', 'bowl', 'gong', 'crash', 'ride']
      .map(v => [v, {kit: ANALOG.perc.src.kit, ...(PAD_OF[v] && PAD_OF[v] !== v ? {voice: PAD_OF[v]} : {}), over: PERC_OVER, from: 'p4-warm'}]))}};
// each part's sound in the analog set (a second lead is lead2)
export const ANALOG_SOUND = {kick: 'an-kick', hats: 'h4-deep', perc: 'an-perc', bass: 'a5-mix-bass', chords: 'a5-mix-chords', lead: 'a5-mix-lead', lead2: 'a5-mix-lead2'};
export const addSets = SND => { for (const [id, s] of Object.entries(MADE)) SND[id] ??= s; };
export const setOf = P => P.set || 'song';
// the set a song opens on as Claude wrote it
export const defaultSet = s => s.round >= 4 ? 'analog' : 'song';

const noOwn = c => { if (!c.set?.sound) return c; const {sound, ...set} = c.set; return {...c, set}; };
// a song as written out (flatten.js, its drums not yet one rack) on a set: on the analog set each part one sound for
// the whole song (the analog synth plays its own patch, not the section's settings, as in the Mix Lab)
export function onSet(P, set){ if (set !== 'analog') return {...P, set: 'song'};
  return {...P, set, tracks: P.tracks.map((T, i) => { const id = ANALOG_SOUND[chanOf(P, i)]; return id ? {...T, sound: id, clips: T.clips.map(noOwn)} : T; })}; }

// your version moved onto a set: each track's sound, and its clips' own, as the set has that track of the song (ref:
// the song on that set, its drums one rack); a track you added takes its role's on the analog set and stays as it is
// on the song's. Your notes, levels, pads and processors stay.
export function moveTo(P, ref, set, SND){ const leads = P.tracks.filter(T => T.role === 'lead');
  for (const T of P.tracks) { const R = ref.tracks.find(x => x.id === T.id);
    if (R) { T.sound = R.sound; T.clips = T.clips.map(c => { const rc = R.clips.find(x => x.id === c.id); return rc?.set?.sound ? {...c, set: {...c.set, sound: rc.set.sound}} : noOwn(c); }); continue; }
    if (set !== 'analog') continue;
    const id = T.role === 'drums' ? rackSound(['an-kick', 'h4-deep', 'an-perc'], SND).id : ANALOG_SOUND[T.role === 'lead' && leads.indexOf(T) > 0 ? 'lead2' : T.role];
    if (id) { T.sound = id; T.clips = T.clips.map(noOwn); } }
  P.set = set; return P; }
