// Pack 7, the sound lab's: the sounds the user chose there (their palette, and the ones they liked beside it), with
// their own edits, as library sounds the DAW and the jam play, plus the evolving pad written for the first song made
// from them. Drums as voices of the analog drum machine (each with its settings, `over`), synths as the analog synth's
// patches (`src.asynth`) or the native poly synth's (`src.palette` + `src.poly`). Usage: node studio/jam/make-pack-7.mjs
import fs from 'node:fs';
import { ALL } from '../sounds/sounds.js';
const here = new URL('packs/', import.meta.url).pathname, p4 = JSON.parse(fs.readFileSync(here + 'pack-4.json', 'utf8'));
const S = id => { const s = ALL.find(x => x.id === id); if (!s) throw new Error('no lab sound ' + id); return s; };
// a drum from a lab sound: its kit and that voice's settings (the lab's `over`), played as `voice` if it borrows one
const drum = (id, v, as = v, more = {}) => { const s = S(id), o = {...(s.over[as] || {}), ...more}; return {kit: s.kit, ...(as !== v ? {voice: as} : {}), over: {[as]: o}}; };
const syn = (id, palette) => { const s = S(id); return s.engine === 'npoly' ? {palette, poly: s.patch} : {asynth: s.patch, palette}; };

// the evolving pad: two saws and a pulse whose width the LFO sweeps, through the soft ladder, its cutoff breathing on a
// slow LFO in time (two bars), its mids cut and warm (the user's direction); the song moves its tone across sections
export const LFO_PAD = {w1: 1, pw1: .45, lpwm: .22, w2: 0, fine2: -7, l1: .7, l2: .6, lsub: .12, ftype: 1, cut: 700, res: .14, fenv: .12, fkey: .4, fa: .4, fd: 1.2, fs: .7, fr: 1.4,
  aa: .35, ad: 1.2, as: .9, ar: 1.6, lshape: 1, lsync: 1, lcut: 1.1, lamp: .12, lwide: .2, hpf: 150, chorus: 2, spread: .9, mode: 0, slop: .55, mids: -4, midf: 2200, tilt: -.25,
  emix: .12, etime: 3, efb: .35, etone: .35, level: .5};

const sounds = [
  {id: 'l7-kick', role: 'kick', name: 'Your 808 kick', words: 'The 808 kit\'s kick as you edited it in the sound lab: shorter, a little more punch, the mids cut.', voices: {kick: drum('kitmine', 'kick')}},
  {id: 'l7-hats', role: 'hats', name: 'Real hats', words: 'The analog drum machine\'s real hi-hat (the pair of cymbals you chose in the sound lab), and the ride from your edit.',
    voices: {chh: drum('realpair', 'chh'), ohh: drum('realpair', 'ohh'), ride: drum('ride2', 'ride')}},
  {id: 'l7-perc', role: 'perc', name: 'Dry hands and wood', words: 'The dry toms and shaker you liked, the rim as you edited it on the 808, the clave dry, logs and a wood block from the toms and clave tuned down, a soft bowl and gong.',
    voices: {tomH: drum('tomsdry', 'tomH'), tomL: drum('tomsdry', 'tomL'), shaker: drum('tomsdry', 'shaker', 'shaker', {mids: -3, vary: .5}), rim: drum('kitmine', 'rim'), clave: drum('rimdry', 'clave'),
      log: drum('tomsdry', 'log', 'tomL', {tune: -3, decay: .8}), logH: drum('tomsdry', 'logH', 'tomH', {tune: -2, decay: .8}), wood: drum('rimdry', 'wood', 'clave', {tune: -7}),
      bowl: drum('bowl', 'bowl', 'ride'), gong: drum('gong', 'gong', 'crash'), snare: drum('ghost2', 'snare')}},
  {id: 'l7-bass', role: 'bass', name: 'FM round', words: 'The analog synth\'s FM round from the sound lab: a sine shaken by one an octave up, evenly, falling away into a round, plain note.', src: syn('fmround', 'clean')},
  {id: 'l7-pad', role: 'chords', name: 'Evolving pad', words: 'Written for the first song from the sound lab: a pulse whose width the LFO sweeps beside a detuned saw, through the soft ladder, its cutoff breathing on a slow LFO over two bars, warm, the mids cut.', src: {asynth: LFO_PAD, palette: 'warm'}},
  {id: 'l7-padgate', role: 'chords', name: 'Unison pad, gated', words: 'The unison pad you liked, gated in 16ths.', src: syn('unigated', 'warm')},
  {id: 'l7-glass', role: 'chords', name: 'Glass stab, tamed', words: 'The glass stab from your palette: a narrow pulse and a saw an octave up, plucked shut, the mids cut, a dotted echo.', src: syn('glasstamed', 'dub')},
  {id: 'l7-marimba', role: 'lead', name: 'FM marimba', words: 'The FM marimba from your palette: a sine shaken two octaves up, falling away in an instant.', src: syn('fmmarimba', 'pluck')},
  {id: 'l7-bell', role: 'lead', name: 'Ring bell, softer', words: 'The ring bell you liked, tamed and softened.', src: syn('bellsoft', 'glass')},
  {id: 'l7-polybell', role: 'lead', name: 'Poly bell, shorter', words: 'The native poly synth\'s glass bell, shorter, as you liked it.', src: syn('npbell2', 'glass')},
];
const pack = {...p4, id: 'pack-7', name: 'Pack 7: your sound lab sounds', words: 'The sounds you chose in the sound lab, with your edits, on pack 4\'s grooves: your 808 kick, the real hats, dry hands and wood, FM round, an evolving pad, the glass stab, the FM marimba and bells.',
  sounds, columns: p4.columns.map(c => ({...c, sound: {kick: 'l7-kick', hats: 'l7-hats', perc: 'l7-perc', bass: 'l7-bass', chords: 'l7-pad', lead: 'l7-marimba'}[c.role] || c.sound}))};
fs.writeFileSync(here + 'pack-7.json', JSON.stringify(pack, null, 1));
console.log('pack-7:', sounds.length, 'sounds');
