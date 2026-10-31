// The master bus and the two returns, the same in the jam and the DAW (on the browser's mix; the DAW's native desk has its
// own, lib/parts/desk.js): the parts into the master (EQ: low and high shelves; width, the bass kept mono; the glue
// compressor; a high-pass for the jam's build if asked; a limiter; the volume), an echo and a reverb returned into it
// through Claude's mix (mixeng.js: out of the low end, ducked by the kick). With the settings' names and values.
import widthFx from '../../../src/audio/engine/fx/width.js';
import { retChain, RET, glide } from '../../jam/mixeng.js';

// how far the kick ducks a part; the glue compressor's settings; the stereo width: [name, value]
export const DUCKS = [['Off', 0], ['Light', .25], ['Medium', .4], ['Heavy', .65]];
export const GLUE = [['Off', null], ['Gentle', {thr: -14, ratio: 1.8, att: .03, rel: .25}], ['Glue', {thr: -20, ratio: 3, att: .01, rel: .2}], ['Punch', {thr: -24, ratio: 4, att: .03, rel: .12}]];
export const WIDTHS = [['Mono', 0], ['Narrow', .6], ['Normal', 1], ['Wide', 1.35], ['Wider', 1.7]];

// B: {master (the parts go in here), delay.in and verb (the sends), rets, mstr, hp, out (to the speakers)}
export function makeMaster(ctx, {hp: withHp = false} = {}){
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .12;
  const master = ctx.createGain(); master.gain.value = .85;
  const mstr = {lo: ctx.createBiquadFilter(), hi: ctx.createBiquadFilter(), width: widthFx.make(ctx), glue: ctx.createDynamicsCompressor(), vol: ctx.createGain(), lim};
  mstr.lo.type = 'lowshelf'; mstr.lo.frequency.value = 110; mstr.hi.type = 'highshelf'; mstr.hi.frequency.value = 7000; mstr.width.set('mono', 150);
  const hp = withHp ? ctx.createBiquadFilter() : null; if (hp) { hp.type = 'highpass'; hp.frequency.value = 18; }
  master.connect(mstr.lo); mstr.lo.connect(mstr.hi); mstr.hi.connect(mstr.width.input); mstr.width.output.connect(mstr.glue);
  if (hp) { mstr.glue.connect(hp); hp.connect(lim); } else mstr.glue.connect(lim);
  const out = ctx.createGain(); lim.connect(mstr.vol); mstr.vol.connect(out); out.connect(ctx.destination);
  const delay = {in: ctx.createGain(), d: ctx.createDelay(2), fb: ctx.createGain(), lp: ctx.createBiquadFilter()};
  delay.lp.frequency.value = 2400; delay.fb.gain.value = .45; delay.in.connect(delay.d); delay.d.connect(delay.lp); delay.lp.connect(delay.fb); delay.fb.connect(delay.d);
  const verb = ctx.createConvolver(), L = 2.8*ctx.sampleRate, ir = ctx.createBuffer(2, L, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < L; i++) { lp += (.3 - .25*i/L)*((Math.random()*2 - 1) - lp); x[i] = lp*Math.pow(1 - i/L, 2.2); } }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = .8; verb.connect(vg);
  const rets = Object.fromEntries([['echo', delay.lp], ['verb', vg]].map(([k, from]) => { const r = retChain(ctx, RET[k]), d = ctx.createGain(); from.connect(r.input); r.output.connect(d); d.connect(master); return [k, {...r, duck: d}]; }));
  return {master, mstr, delay, verb, rets, hp, out}; }
// the master's settings (M: {vol, lo, hi in dB, glue and width by index}) onto it
export function setMaster(B, M, ctx){ const {mstr} = B, now = ctx.currentTime, g = GLUE[M.glue]?.[1];
  glide(mstr.lo.gain, M.lo, now, .02); glide(mstr.hi.gain, M.hi, now, .02); mstr.width.set('w', WIDTHS[M.width]?.[1] ?? 1); glide(mstr.vol.gain, Math.pow(10, M.vol/20), now, .02);
  const C = mstr.glue; if (g) { C.threshold.value = g.thr; C.ratio.value = g.ratio; C.attack.value = g.att; C.release.value = g.rel; C.knee.value = 8; } else { C.threshold.value = 0; C.ratio.value = 1; } }
