// The knobs up front for each instrument: most of what a sound designer reaches for (filter, envelope, drive, glide, the
// LFO's rate and how far it moves things, the unison, the sends), each a macro turning one or more settings along a curve
// (a log one for frequencies and times). The whole face is behind More. A macro's value is read back from its first
// setting, so it always shows where the sound really is.
// Each: {label, words, set: [[path within the track ('inst.cut', 'send.verb', 'pads.tone': every voice of a drum lane),
// from, to, log?, step?]]}, or {label, words, route: [source, destination, most]}: an amount in the instrument's
// modulation matrix (an LFO to the cutoff or the pitch), made if it isn't there.
const sends = [{label: 'Reverb', words: 'into the hall', set: [['send.verb', -40, -4]]}, {label: 'Echo', words: 'into the echo', set: [['send.echo', -40, -4]]}];
// (an LFO's rate macro frees it from the bar too, or a rate in time would ignore it)
const lfoRate = (k, lo, hi, sync) => ({label: 'LFO rate', words: 'how fast the LFO moves', set: [[k, lo, hi, true], [sync, 0, 0]]});
export const MACROS = {
  moog: [
    {label: 'Cutoff', words: 'the ladder filter opening', set: [['inst.cut', 60, 9000, true]]},
    {label: 'Resonance', words: 'the filter singing', set: [['inst.res', 0, 1.05]]},
    {label: 'Contour', words: 'how far the envelope opens the filter', set: [['inst.cenv', 0, 6]]},
    {label: 'Drive', words: 'the mixer pushed', set: [['inst.drive', 0, 1]]},
    {label: 'Attack', words: 'how a note comes in', set: [['inst.aa', .001, 1, true], ['inst.fa', .001, 1, true]]},
    {label: 'Decay', words: 'how fast it falls to its sustain', set: [['inst.fd', .03, 2, true], ['inst.ad', .05, 3, true]]},
    {label: 'Release', words: 'how long it rings after', set: [['inst.ar', .01, 2, true], ['inst.fr', .01, 2, true]]},
    {label: 'Glide', words: 'sliding between notes', set: [['inst.glide', 0, .5]]},
    {label: 'Detune', words: 'oscillator 2 against 1', set: [['inst.d2', 0, 30]]},
    {label: 'Sub', words: 'oscillator 3, below', set: [['inst.l3', 0, 1]]},
    {label: 'Noise', words: 'hiss in the mixer', set: [['inst.noise', 0, .6]]},
    {label: 'LFO rate', words: 'how fast the LFO moves', set: [['inst.lrate', .1, 15, true], ['inst.lsync', 0, 0]]},
    {label: 'Vibrato', words: 'the LFO on the pitch', set: [['inst.vib', 0, 40]]},
    {label: 'LFO → filter', words: 'the LFO on the cutoff', set: [['inst.lcut', 0, 2]]},
    ...sends],
  analog: [
    {label: 'Cutoff', words: 'the filter opening', set: [['inst.cut', 60, 15000, true]]},
    {label: 'Resonance', words: 'the filter singing', set: [['inst.res', 0, .95]]},
    {label: 'Env amount', words: 'how far the envelope opens the filter', set: [['inst.fenv', -.2, 1]]},
    {label: 'Drive', words: 'the filter driven', set: [['inst.drive', 0, 1]]},
    {label: 'Attack', words: 'how a note comes in', set: [['inst.aa', .001, 2, true]]},
    {label: 'Decay', words: 'how fast it falls', set: [['inst.ad', .03, 3, true], ['inst.fd', .03, 3, true]]},
    {label: 'Release', words: 'how long it rings after', set: [['inst.ar', .02, 4, true]]},
    {label: 'Glide', words: 'sliding between notes', set: [['inst.glide', 0, .5]]},
    {label: 'Unison', words: 'voices stacked on oscillator 1', set: [['inst.uni', 1, 7, false, 1]]},
    {label: 'Detune', words: 'how far the unison spreads', set: [['inst.det', 0, 50]]},
    {label: 'Osc 2', words: 'the second oscillator', set: [['inst.mix2', 0, 1]]},
    {label: 'Sub', words: 'an octave below', set: [['inst.sub', 0, 1]]},
    lfoRate('inst.l1r', .05, 12, 'inst.l1t'),
    {label: 'LFO → filter', words: 'LFO 1 on the cutoff', route: ['lfo1', 'cut', .5]},
    {label: 'LFO → pitch', words: 'LFO 1 on the pitch', route: ['lfo1', 'pitch', .03]},
    ...sends],
  fm: [
    {label: 'Brightness', words: 'the filter after the operators', set: [['inst.cut', 300, 18000, true]]},
    {label: 'FM depth', words: 'all the modulation at once', set: [['inst.index', .05, 2]]},
    {label: 'Op 2 depth', words: 'operator 2 into the carrier', set: [['inst.i2', 0, 10]]},
    {label: 'Op 3 depth', words: 'operator 3', set: [['inst.i3', 0, 10]]},
    {label: 'Op 2 ratio', words: 'operator 2’s pitch: the timbre', set: [['inst.r2', .5, 8, false, .5]]},
    {label: 'Op 3 level', words: 'operator 3’s level', set: [['inst.fb', 0, 1]]},
    {label: 'Attack', words: 'how a note comes in', set: [['inst.aa', .001, 1, true]]},
    {label: 'Decay', words: 'how fast it falls', set: [['inst.ad', .05, 3, true]]},
    {label: 'Release', words: 'how long it rings after', set: [['inst.ar', .02, 3, true]]},
    {label: 'Op decay', words: 'how fast the brightness dies', set: [['inst.m2d', .02, 3, true], ['inst.m3d', .02, 2, true]]},
    {label: 'Glide', words: 'sliding between notes', set: [['inst.glide', 0, .4]]},
    {label: 'Drive', words: 'the filter driven', set: [['inst.drive', 0, 1]]},
    lfoRate('inst.l1r', .1, 15, 'inst.l1t'),
    {label: 'LFO → depth', words: 'the LFO on the FM depth', route: ['lfo1', 'index', .8]},
    ...sends],
  poly: [
    {label: 'Cutoff', words: 'the filter opening', set: [['inst.cut', 60, 15000, true]]},
    {label: 'Resonance', words: 'the filter singing', set: [['inst.res', 0, .9]]},
    {label: 'Env amount', words: 'the envelope on the filter', set: [['inst.fenv', -.2, 1]]},
    {label: 'Attack', words: 'how a note comes in', set: [['inst.aa', .001, 2, true]]},
    {label: 'Decay', words: 'how fast it falls', set: [['inst.ad', .03, 3, true]]},
    {label: 'Release', words: 'how long it rings after', set: [['inst.ar', .02, 4, true]]},
    {label: 'LFO rate', words: 'how fast the LFO moves', set: [['inst.lrate', .05, 15, true], ['inst.lsync', 0, 0]]},
    {label: 'LFO amount', words: 'how far the LFO moves', set: [['inst.lamt', 0, 1]]},
    {label: 'Drive', words: 'driven', set: [['inst.drive', 0, 1]]},
    {label: 'Chorus', words: 'widened', set: [['inst.chorus', 0, 1]]},
    ...sends],
  // a drum lane's macros turn every voice it owns
  drums: [
    {label: 'Tone', words: 'darker to brighter', set: [['pads.tone', .15, 1]]},
    {label: 'Length', words: 'tight to long', set: [['pads.decay', .4, 2.2, true]]},
    {label: 'Tune', words: 'down or up, in semitones', set: [['pads.tune', -12, 12, false, 1]]},
    {label: 'Drive', words: 'clean to crushed', set: [['pads.drive', 0, .8]]},
    {label: 'Character', words: 'punch, snap, metal: each voice its own', set: [['pads.x', 0, 1]]},
    {label: 'Level', words: 'quieter or louder', set: [['pads.level', .3, 1.5]]},
    ...sends]};
export const macrosOf = type => MACROS[type] || MACROS.analog;
// a macro's value 0..1 → each setting's value (to its step), and back
export const at = ([, a, b, log, step], x) => { const v = log ? a*Math.pow(b/a, x) : a + (b - a)*x; return step ? Math.round(v/step)*step : v; };
export const back = ([, a, b, log], v) => a === b ? 0 : Math.max(0, Math.min(1, log ? Math.log(v/a)/Math.log(b/a) : (v - a)/(b - a)));
