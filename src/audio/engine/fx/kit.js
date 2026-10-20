// Shared pieces for the effects: the dry/wet shell, a smooth parameter change, an LFO, and the tempo-synced divisions.

// musical lengths, in beats: a delay's time or an LFO's cycle follows the master's tempo (· is dotted)
export const DIVS = [['1/32', .125], ['1/16', .25], ['1/16·', .375], ['1/8', .5], ['1/8·', .75], ['1/4', 1], ['1/4·', 1.5], ['1/2', 2], ['1 bar', 4], ['2 bars', 8], ['4 bars', 16]];
export const beatsOf = i => DIVS[Math.max(0, Math.min(DIVS.length - 1, Math.round(i)))][1];
// a short glide to a new value (no zipper noise as a knob turns)
export const ease = (ctx, p, v, tc = .015) => p.setTargetAtTime(v, ctx.currentTime, tc);
// input and output, with the effect's own sound (wet) mixed against the untouched (dry) at equal power
export function shell(ctx){
  const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
  input.connect(dry); dry.connect(output); wet.connect(output);
  return {input, output, dry, wet, mix(v){ ease(ctx, dry.gain, Math.cos(v*Math.PI/2)); ease(ctx, wet.gain, Math.sin(v*Math.PI/2)); }};
}
// a sine LFO into a gain (its depth): connect .out to the parameter it moves
export function lfo(ctx, hz = 1){
  const osc = ctx.createOscillator(), out = ctx.createGain(); osc.frequency.value = hz; out.gain.value = 0; osc.connect(out); osc.start();
  return {osc, out};
}
export const bq = (ctx, type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
// two channels, whatever comes in (a mono source, the drums, is copied to both: a splitter alone would leave the right silent)
export function two(ctx){ const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers'; return g; }
// a stereo pair: the input split into left and right, each through its own chain, then merged
export function stereo(ctx, input, make){
  const st = two(ctx), sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2); input.connect(st); st.connect(sp);
  [0, 1].forEach(c => { const [a, b] = make(c); sp.connect(a, c); b.connect(mg, 0, c); });
  return mg;
}
