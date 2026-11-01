// Claude's mix: what each part's channel gets ahead of your own EQ, found by measuring the songs part by part (studio/
// taste.md, 2026-10-22). Everything piled into 150–500 Hz (the kick's tail, the bass, both mallets, the strings, the
// reverb) while 600 Hz–2.5 kHz was nearly empty, and the bass sat 12 dB under the kick in its own range with nothing above
// it. So: a high-pass on every part, the kick and the bass each given their own range (the kick 50–70 Hz, the bass 80–160),
// the low-mid box taken out of the kick and the mallets, an exciter (the part rectified: even harmonics, warm, at a level
// that doesn't depend on how loud it plays) giving the bass something in the middle, the mallets lifted where they speak, the reverb and echo
// kept out of the low end, and the kick ducking the returns a little so the space breathes with it. Used by the jam's
// channels (app.js) and the desk (render-jam.mjs), so a take renders as it was heard.
export const ENG = {
  kick: {hp: 28, bells: [[140, 1.2, -3], [350, 1, -3]]},
  hats: {hp: 300, air: [12000, 2]},
  perc: {hp: 70, bells: [[2500, .8, 2]]},
  // (the exciter only on the bass, a single line, and lightly: on chords and ringing mallets it made intermodulation that
  // sounded like clipping, and at .5 it doubled the bass's peaks)
  bass: {hp: 35, ex: [400, 1800, .2], trim: 3},
  chords: {hp: 180, bells: [[350, 1, -2], [3000, .7, 2]]},
  lead: {hp: 150, bells: [[380, 1, -3], [2000, .7, 4]]},
  lead2: {hp: 120, bells: [[300, 1, -3], [1400, .7, 4]], trim: 1},
};
// the returns: kept out of the low end and the very top, and ducked a little by the kick
export const RET = {verb: {hp: 350, lp: 8000, duck: .25}, echo: {hp: 300, lp: 6000, duck: .25}};
// a part's profile: by its role, the second lead its own (so the two mallets sit in different places)
export const engOf = (role, lane = 0) => ENG[role === 'lead' && lane ? 'lead2' : role] || {};

// a parameter moved smoothly to a value, its automation ending there: an open-ended setTargetAtTime keeps a filter
// recomputing its coefficients every sample for ever, which tripled a channel's cost and crackled on slower devices
const hold = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } };
export const glide = (p, v, t, s = .03) => { hold(p, t); p.linearRampToValueAtTime(v, t + 3*s); };
// the kick's duck on a gain: down in 4 ms, held 30, back up much as a 0.1 s release would, and then still
export const duckAt = (p, d, t) => { hold(p, t); p.linearRampToValueAtTime(1 - d, t + .004); p.setValueAtTime(1 - d, t + .03);
  p.linearRampToValueAtTime(1 - .37*d, t + .13); p.linearRampToValueAtTime(1 - .05*d, t + .33); p.linearRampToValueAtTime(1, t + .45); };
const bq = (ctx, type, f, q = .707, g = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g; return b; };
let ABS = null;
// a part's chain: high-pass → bells → (an exciter mixed in) → air → trim, against the part untouched; on(false) fades to
// the untouched and then disconnects the chain, so it costs nothing while off. Only the filters a part uses are made.
export function engChain(ctx, p = {}){
  const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), sum = ctx.createGain();
  const hp = p.hp && bq(ctx, 'highpass', p.hp), bells = (p.bells || []).map(([f, q, g]) => bq(ctx, 'peaking', f, q, g)), air = p.air && bq(ctx, 'highshelf', p.air[0], .707, p.air[1]);
  const chain = [hp, ...bells].filter(Boolean), head = chain[0] || sum;
  for (let i = 0; i < chain.length; i++) chain[i].connect(chain[i + 1] || sum);
  if (p.ex) { if (!ABS) { ABS = new Float32Array(4097); for (let i = 0; i < ABS.length; i++) ABS[i] = Math.abs(i/2048 - 1); }
    const sh = ctx.createWaveShaper(); sh.curve = ABS; sh.oversample = '2x'; const lo = bq(ctx, 'highpass', p.ex[0]), lo2 = bq(ctx, 'highpass', p.ex[0]), hi = bq(ctx, 'lowpass', p.ex[1]), g = ctx.createGain(); g.gain.value = p.ex[2];
    (chain.at(-1) || input).connect(sh); sh.connect(lo); lo.connect(lo2); lo2.connect(hi); hi.connect(g); g.connect(sum); }
  if (air) { sum.connect(air); air.connect(wet); } else sum.connect(wet); wet.gain.value = p.trim ? Math.pow(10, p.trim/20) : 1;
  const trim = wet.gain.value; input.connect(dry); dry.connect(output); wet.connect(output); dry.gain.value = 1; wet.gain.value = 0;
  let live = false, tm = 0;
  const on = (v, t = ctx.currentTime, s = .03) => { clearTimeout(tm);
    if (v && !live) { input.connect(head); live = true; }
    glide(dry.gain, v ? 0 : 1, t, s); glide(wet.gain, v ? trim : 0, t, s);
    if (!v && live) { const off = () => { if (live) { input.disconnect(head); live = false; } }; if (ctx instanceof OfflineAudioContext) off(); else tm = setTimeout(off, 4*s*1000 + 100); } };
  return {input, output, on};
}
// a return's chain: high-pass → low-pass
export function retChain(ctx, r){ const hp = bq(ctx, 'highpass', 10), lp = bq(ctx, 'lowpass', 20000); hp.connect(lp);
  const on = (v, t = ctx.currentTime, s = .03) => { glide(hp.frequency, v ? r.hp : 10, t, s); glide(lp.frequency, v ? r.lp : 20000, t, s); };
  on(false, 0, .001); return {input: hp, output: lp, on}; }
