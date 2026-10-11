// The few knobs that matter most on each instrument, up front: each macro turns several settings at once along a curve
// (a log one for frequencies and times), so one finger does what a sound designer would reach for first. The full face
// is behind More. A macro's value is read back from its first setting, so it always shows where the sound really is.
// Each: {label, words, set: [[path within the track ('inst.cut', 'send.verb', 'pad:inst.<voice>.tone'), from, to, log?]]}
const space = {label: 'Space', words: 'into the hall and the echo', set: [['send.verb', -40, -6], ['send.echo', -40, -8]]};
export const MACROS = {
  moog: [
    {label: 'Tone', words: 'the filter opening', set: [['inst.cut', 90, 7000, true]]},
    {label: 'Bite', words: 'resonance and the contour', set: [['inst.res', 0, 1, false], ['inst.cenv', 1, 5.5]]},
    {label: 'Length', words: 'how long a note rings', set: [['inst.fd', .04, 1.5, true], ['inst.ad', .08, 2, true], ['inst.ar', .03, .9, true]]},
    space],
  analog: [
    {label: 'Tone', words: 'the filter opening', set: [['inst.cut', 150, 12000, true]]},
    {label: 'Bite', words: 'resonance and envelope', set: [['inst.res', 0, .9], ['inst.fenv', .05, .9]]},
    {label: 'Length', words: 'how long a note rings', set: [['inst.ad', .05, 2.5, true], ['inst.ar', .05, 2, true], ['inst.fd', .05, 1.5, true]]},
    space],
  fm: [
    {label: 'Tone', words: 'brightness', set: [['inst.cut', 500, 18000, true]]},
    {label: 'Metal', words: 'how deep the FM goes', set: [['inst.index', .1, 2]]},
    {label: 'Length', words: 'how long a note rings', set: [['inst.ad', .05, 2.5, true], ['inst.ar', .05, 1.5, true]]},
    space],
  poly: [
    {label: 'Tone', words: 'the filter opening', set: [['inst.cut', 150, 12000, true]]},
    {label: 'Bite', words: 'resonance and envelope', set: [['inst.res', 0, .9], ['inst.fenv', .05, .9]]},
    {label: 'Length', words: 'how long a note rings', set: [['inst.ad', .05, 2.5, true], ['inst.ar', .05, 2, true]]},
    space],
  // a drum lane's macros turn every voice it owns
  drums: [
    {label: 'Tone', words: 'darker to brighter', set: [['pads.tone', .15, 1]]},
    {label: 'Length', words: 'tight to long', set: [['pads.decay', .4, 2.2, true]]},
    {label: 'Drive', words: 'clean to crushed', set: [['pads.drive', 0, .8]]},
    space]};
export const macrosOf = type => MACROS[type] || MACROS.analog;
// a macro's value 0..1 → each setting's value
export const at = ([, a, b, log], x) => log ? a*Math.pow(b/a, x) : a + (b - a)*x;
export const back = ([, a, b, log], v) => Math.max(0, Math.min(1, log ? Math.log(v/a)/Math.log(b/a) : (v - a)/(b - a)));
