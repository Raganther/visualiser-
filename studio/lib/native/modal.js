// Struck objects computed from their physics (modal synthesis): a bar, a tine, a bell or a plate rings at a set of
// resonances (modes), each at its own ratio to the fundamental, with its own level and decay. A mallet excites them: the
// harder it is (and the harder it strikes) the more of the upper modes it reaches, and where it strikes weights them by
// the mode's shape there. Each mode is a decaying sinusoid computed sample by sample; a doublet beats (a real bell's modes
// come in slightly split pairs); every mode sits a little apart in the stereo.
import { rng } from '../rng.js';

const LN1000 = Math.log(1000);
// modes: [[ratio, level, T60 seconds, attack seconds?], …]; f0 in Hz; returns {L, R} Float32Arrays
export function modal(sr, f0, modes, {vel = .8, hard = .5, pos = .27, beat = 0, width = .35, glide = 0, glideT = .05, len, click = 0, seed = 1, trem = 0, tremHz = 5.5, ring = 1} = {}){
  modes = modes.map(([r, l, t, a]) => [r, l, t*ring, a]);   // (ring: every mode's decay lengthened or shortened)
  const R = rng(seed), b = Math.min(1, hard*(.55 + .45*vel));
  const top = sr*.45, T = len ?? Math.min(8, Math.max(...modes.map(m => m[2]))*1.05), n = Math.ceil(T*sr) + 1;
  const L = new Float32Array(n), Rr = new Float32Array(n);
  // the mallet's contact time: a soft mallet stays on longer, which smooths the strike (fewer high modes)
  const tc = .0004 + (1 - b)*.004;
  const list = [];
  modes.forEach(([ratio, lvl, t60, att = 0], k) => {
    const f = f0*ratio; if (f >= top || f < 15) return;
    // hardness reaches the upper modes; the strike point weights each by its shape there; a soft mallet's long contact
    // filters out what rings faster than it (above ~1/tc)
    const w = lvl*Math.pow(ratio, -1.6*(1 - b))*(.35 + .65*Math.abs(Math.sin(Math.PI*(k + 1)*pos)))/(1 + Math.pow(f*tc*.9, 2));
    const pan = (R() - .5)*width*(k ? 1 : .3);
    list.push({f, w, t60, att, pan, ph: R()*.2});
    if (beat > 0 && k > 0) list.push({f: f*(1 + beat*(.6 + .8*R())), w: w*.45, t60: t60*.9, att, pan: -pan, ph: R()});
  });
  for (const m of list) {
    const dec = Math.exp(-LN1000/(m.t60*sr)), gl = (1 - m.pan)*.5, gr = (1 + m.pan)*.5;
    let env = m.w, ph = m.ph*2*Math.PI, end = Math.min(n, Math.ceil(m.t60*1.2*sr));
    const at = Math.max(tc, m.att)*sr;
    for (let i = 0; i < end; i++) {
      const fi = glide ? m.f*(1 + glide*Math.exp(-i/(glideT*sr))) : m.f;
      ph += 2*Math.PI*fi/sr;
      const a = i < at ? .5 - .5*Math.cos(Math.PI*i/at) : 1, s = Math.sin(ph)*env*a;
      L[i] += s*gl; Rr[i] += s*gr; env *= dec; if (env < 1e-6) break; }
  }
  // a hard mallet's click: a few samples of noise at the strike, high-passed by differencing
  if (click > 0) { const cn = Math.round(.0015*sr); let p = 0; for (let i = 0; i < cn; i++) { const x = R()*2 - 1, y = (x - p)*click*b*(1 - i/cn); p = x; L[i] += y; Rr[i] += y*.9; } }
  if (trem) for (let i = 0; i < n; i++) { const g = 1 - trem*(.5 - .5*Math.cos(2*Math.PI*tremHz*i/sr)); L[i] *= g; Rr[i] *= g; }
  // the end: faded over 20 ms
  const fo = Math.min(n, Math.round(.02*sr)); for (let i = 0; i < fo; i++) { const g = i/fo; L[n - 1 - i] *= g; Rr[n - 1 - i] *= g; }
  return {L, R: Rr};
}

// the presets: each a set of modes (ratios from measurements of the real instruments, simplified) and mallet settings
export const MODAL = {
  // a thumb piano's tine: its first bending modes far apart, a soft buzz of the second
  kalimba: {modes: [[1, 1, 1.6], [5.95, .32, .3], [16.8, .1, .08], [2.0, .05, .5]], hard: .55, click: .08, width: .3},
  // a marimba bar (its overtones tuned to 4 and 10 times) with the tube under it lengthening the fundamental
  marimba: {modes: [[1, 1, .9], [3.99, .32, .28], [9.94, .1, .09], [1.002, .3, 1.4]], hard: .4, click: .05, width: .4},
  // a vibraphone's aluminium bar: long, its tremolo from the turning discs in the tubes
  vibes: {modes: [[1, 1, 3.6], [4.0, .22, 1.1], [10.2, .06, .3]], hard: .45, trem: .45, tremHz: 5.2, width: .4},
  // a glockenspiel or music box: a free bar's modes, 2.76 and 5.40 times
  musicbox: {modes: [[1, 1, 1.4], [2.756, .45, .7], [5.404, .2, .35], [8.933, .08, .18]], hard: .8, click: .1, width: .35},
  // a church bell's partials named by ringers: hum, prime, tierce (a minor third), quint, nominal, superquint, octave
  bell: {modes: [[.5, .45, 7], [1, .7, 4.5], [1.19, .55, 3.6], [1.5, .3, 2.6], [2, 1, 2.6], [2.66, .45, 1.6], [3.98, .25, 1.1], [5.2, .1, .6]], hard: .6, beat: .0018, width: .5},
  // tubular bells: the bell's upper partials without its hum, a bright strike
  tubular: {modes: [[1, .6, 4], [1.5, .35, 2.5], [2, 1, 3], [2.74, .5, 2], [3.48, .3, 1.4], [4.24, .2, 1]], hard: .7, beat: .0012, click: .06, width: .45},
  // a steel pan's note: tuned to its octave and twelfth, the octave blooming a moment after the strike
  steel: {modes: [[1, 1, .9], [2, .55, .7, .012], [3, .25, .4, .008], [4.02, .1, .2], [1.003, .25, .9]], hard: .5, click: .03, width: .4},
  // a woodblock: a few short modes and the hollow's ring
  wood: {modes: [[1, 1, .13], [2.57, .4, .06], [4.4, .2, .035], [1.46, .25, .08]], hard: .75, click: .25, width: .3},
  // a glass bar: high, clear, slow upper modes; for the glass bass, struck softly
  glass: {modes: [[1, 1, 1.2], [2.32, .3, .7], [4.25, .12, .35], [6.63, .05, .15]], hard: .35, width: .25},
  // a metal plate: crowded inharmonic modes, beating
  plate: {modes: [[1, 1, .9], [1.52, .7, .7], [2.0, .5, .55], [2.65, .45, .4], [3.4, .3, .3], [4.06, .2, .22], [5.2, .1, .15]], hard: .7, beat: .004, click: .12, width: .5},
  // a gong: dense, beating, its upper modes swelling in after the strike
  gong: {modes: [[1, .8, 6], [1.48, .6, 5, .3], [2.02, .5, 4, .6], [2.47, .5, 3.5, .9], [3.1, .4, 3, 1.2], [3.6, .3, 2.5, 1.5], [4.3, .2, 2, 1.8], [5.1, .15, 1.6, 2]], hard: .4, beat: .006, width: .6},
};
