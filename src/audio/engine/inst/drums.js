// The drum kit: thirteen voices made from oscillators and noise (no samples), each with its own tune, decay, tone, drive, level, pan and character, in five kits.
// A voice is played at an audio-clock time with a velocity; each runs through its own drive, tone, level and pan into the kit's bus.

// each voice: its label, its General MIDI note, what its character knob does, and its choke group (a closed hat stops an open one)
export const VOICES = [
  {key: 'kick', label: 'Kick', note: 36, x: 'Punch'}, {key: 'snare', label: 'Snare', note: 38, x: 'Snappy'}, {key: 'clap', label: 'Clap', note: 39, x: 'Spread'},
  {key: 'rim', label: 'Rim', note: 37, x: 'Ring'}, {key: 'clave', label: 'Clave', note: 75, x: 'Ring'}, {key: 'chh', label: 'Closed hat', note: 42, x: 'Metal', choke: 'hat'},
  {key: 'ohh', label: 'Open hat', note: 46, x: 'Metal', choke: 'hat'}, {key: 'ride', label: 'Ride', note: 51, x: 'Bell'}, {key: 'crash', label: 'Crash', note: 49, x: 'Metal'},
  {key: 'tomL', label: 'Low tom', note: 45, x: 'Thump'}, {key: 'tomH', label: 'High tom', note: 50, x: 'Thump'}, {key: 'cow', label: 'Cowbell', note: 56, x: 'Ring'},
  {key: 'shaker', label: 'Shaker', note: 70, x: 'Swell'}];
// every voice's settings: tune (semitones), decay (× its own), tone (brightness), drive, level, pan, and its character
export const PARAMS = [{key: 'tune', label: 'Tune', min: -12, max: 12, def: 0, unit: 'st'}, {key: 'decay', label: 'Decay', min: .25, max: 4, def: 1, unit: '×', log: true},
  {key: 'tone', label: 'Tone', min: 0, max: 1, def: 1, unit: '%'}, {key: 'drive', label: 'Drive', min: 0, max: 1, def: 0, unit: '%'},
  {key: 'level', label: 'Level', min: 0, max: 1.5, def: 1, unit: '×'}, {key: 'pan', label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan'}, {key: 'x', label: 'Character', min: 0, max: 1, def: .5, unit: '%'}];
const D = Object.fromEntries(PARAMS.map(p => [p.key, p.def]));
// the kits: each voice's settings (over the defaults), and the bus's drive and tone
export const KITS = {
  '909': {bus: {drive: .1, tone: 1}, v: {kick: {x: .6, drive: .25, decay: 1}, snare: {x: .55}, chh: {x: .35}, ohh: {x: .35}, ride: {x: .5}, crash: {x: .4},
    rim: {pan: .15}, clave: {pan: -.2}, tomL: {pan: -.3}, tomH: {pan: .3}, cow: {pan: .2}, shaker: {pan: -.25, level: .7}}},
  '808': {bus: {drive: .05, tone: .9}, v: {kick: {tune: -3, decay: 2.6, x: .25, drive: .12, tone: .45}, snare: {x: .3, tune: 1, tone: .8}, clap: {x: .4},
    chh: {x: .95}, ohh: {x: .95, decay: 1.4}, ride: {x: .8}, cow: {level: 1.1, pan: .2}, clave: {pan: -.2, level: 1.1}, tomL: {decay: 1.8, pan: -.3}, tomH: {decay: 1.6, pan: .3},
    rim: {pan: .15}, shaker: {pan: -.25, level: .7}}},
  'Minimal': {bus: {drive: .15, tone: .9}, v: {kick: {decay: .75, x: .55, drive: .35, tone: .5}, snare: {decay: .7, x: .7, level: .8}, clap: {decay: .8, x: .7, level: .85},
    rim: {tune: 2, x: .7, pan: .2}, clave: {tune: -2, decay: .8, pan: -.25}, chh: {decay: .6, tone: .9, x: .3, level: .8}, ohh: {decay: .7, x: .3, level: .75},
    ride: {decay: .7, level: .7}, tomL: {decay: .6, pan: -.35}, tomH: {decay: .6, pan: .35}, cow: {tune: -5, decay: .6, level: .7}, shaker: {decay: .7, x: .3, pan: -.3, level: .6}}},
  'Industrial': {bus: {drive: .45, tone: .85}, v: {kick: {tune: -2, decay: 1.3, x: .8, drive: .85, tone: .65}, snare: {drive: .6, x: .8, tone: .85, level: .8}, clap: {drive: .5, x: .9},
    rim: {drive: .5, x: .9}, chh: {x: 1, drive: .6, level: .7}, ohh: {x: 1, drive: .5, decay: 1.2, level: .7}, crash: {decay: 1.5, drive: .4, level: .65}, tomL: {drive: .6, tune: -3}, tomH: {drive: .6}, cow: {drive: .7, tune: -7}}},
  'Lo-fi': {bus: {drive: .3, tone: .62}, v: {kick: {tune: -1, decay: 1.1, x: .35, tone: .35}, snare: {tune: -2, tone: .6, x: .45}, clap: {tone: .6}, chh: {tone: .85, x: .2, level: 1.2}, ohh: {tone: .85, x: .2, level: 1.2},
    ride: {tone: .8}, crash: {tone: .75}, rim: {tone: .6}, clave: {tone: .6}, shaker: {tone: .8, level: .9}}},
};
export const KIT_NAMES = Object.keys(KITS);
export const kitParams = name => { const K = KITS[name] || KITS['909']; return Object.fromEntries(VOICES.map(v => [v.key, {...D, ...(K.v[v.key] || {})}])); };

const st = n => Math.pow(2, n/12);
// a saturation curve: soft (tanh), normalised so a full-scale peak stays full scale
const sat = a => { const n = 1024, c = new Float32Array(n), K = 1 + a*12, m = Math.tanh(K); for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = Math.tanh(x*K)/m; } return c; };
const toneHz = t => 1000*Math.pow(22, t);   // (the tone knob: a low-pass from 1 kHz up to open, 22 kHz)

// the kit, made on an audio context (the page's, or an offline one for the tests): each voice's chain into the bus into `out`
export function makeDrums(ctx, out){
  const noise = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate), nd = noise.getChannelData(0); let s = 22222;
  for (let i = 0; i < nd.length; i++) { s = (s*1664525 + 1013904223) >>> 0; nd[i] = s/2147483648 - 1; }
  const bus = ctx.createGain(), bdrive = ctx.createWaveShaper(), btone = ctx.createBiquadFilter(), bout = ctx.createGain();
  // the tone before the drive, so nothing after the saturation can ring past full scale
  btone.type = 'lowpass'; btone.Q.value = .5; bus.connect(btone); btone.connect(bdrive); bdrive.connect(bout); bout.connect(out);
  const P = {}, ch = {}, chokes = {};
  for (const v of VOICES) {
    const c = ch[v.key] = {in: ctx.createGain(), sh: ctx.createWaveShaper(), lp: ctx.createBiquadFilter(), lv: ctx.createGain(), pan: ctx.createStereoPanner()};
    c.lp.type = 'lowpass'; c.lp.Q.value = .5;   // (no oversampling: on noise its filters overshoot past full scale, and a drum's aliasing is lost in it)
    c.in.connect(c.lp); c.lp.connect(c.sh); c.sh.connect(c.lv); c.lv.connect(c.pan); c.pan.connect(bus);
  }
  const applyVoice = k => { const p = P[k], c = ch[k], t = ctx.currentTime;
    c.sh.curve = p.drive > .01 ? sat(p.drive) : null; c.lp.frequency.setTargetAtTime(toneHz(p.tone), t, .01);
    c.lv.gain.setTargetAtTime(p.level*(1 - p.drive*.5), t, .01); c.pan.pan.setTargetAtTime(p.pan, t, .01); };
  const bset = b => { bdrive.curve = b.drive > .01 ? sat(b.drive*.6) : null; btone.frequency.value = toneHz(b.tone); bout.gain.value = 1 - b.drive*.25; };

  /* ---------- the pieces each voice is made of ---------- */
  // a gain shaped as a hit: up in `a` seconds, held, then falling to silence over `d` (exponentially, as a real drum dies)
  const amp = (t, peak, a, d, hold = 0) => { const g = ctx.createGain(), p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
    if (hold) p.setValueAtTime(peak, t + a + hold); p.exponentialRampToValueAtTime(peak*1e-4 + 1e-6, t + a + hold + d); p.linearRampToValueAtTime(0, t + a + hold + d + .005); return g; };
  const osc = (type, f, t, end) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end); return o; };
  const filt = (type, f, q = .7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const hiss = (t, end) => { const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; n.start(t, Math.random()*1.5); n.stop(end); return n; };
  const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };
  // the 808's metal: six square waves at clashing, unrelated pitches, a cymbal's inharmonic shimmer
  const metal = (t, end, mul, dest) => { const g = ctx.createGain(); g.gain.value = .16;
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) osc('square', f*mul, t, end).connect(g); g.connect(dest); return g; };

  /* ---------- the voices ---------- */
  const VOICE = {
    // a sine dropping fast from a click-like high to its note (the punch), held a moment, then booming away; a short
    // filtered noise for the beater's click on top
    kick(t, v, p, o){ const f = 49*st(p.tune), d = .42*p.decay, end = t + d + .12, b = osc('sine', f*(3 + p.x*7), t, end);
      b.frequency.exponentialRampToValueAtTime(f*1.5, t + .014); b.frequency.exponentialRampToValueAtTime(f, t + .1);
      chain(b, amp(t, v, .0015, d, .025), o);
      const k = chain(hiss(t, t + .03), filt('bandpass', 3800, .8)); chain(k, amp(t, v*(.15 + p.x*.45), .0005, .012), o); },
    // two tuned shells dropping slightly in pitch, and the wires: bright noise, longer, louder the snappier
    snare(t, v, p, o){ const d = .2*p.decay, end = t + d*1.5 + .1;
      for (const [f, l] of [[185, .5], [330, .3]]) { const s = osc('triangle', f*st(p.tune)*1.25, t, end); s.frequency.exponentialRampToValueAtTime(f*st(p.tune), t + .03); chain(s, amp(t, v*l*(1 - p.x*.45), .001, d*.6), o); }
      chain(hiss(t, end), filt('highpass', 1500), filt('peaking', 5200, 1), filt('lowpass', 9000), amp(t, v*(.3 + p.x*.6), .001, d*1.3), o); },
    // hands: four quick bursts of band-passed noise a few milliseconds apart (spread across the stereo), then the room's tail
    clap(t, v, p, o){ const f = 1150*st(p.tune), end = t + .4*p.decay + .2;
      [0, .0095, .019, .029].forEach((dt, i) => { const pn = ctx.createStereoPanner(); pn.pan.value = (i % 2 ? 1 : -1)*p.x*.5;
        chain(hiss(t + dt, t + dt + .04), filt('bandpass', f, 1.3), amp(t + dt, v*.95, .0008, .014), pn, o); });
      chain(hiss(t + .029, end), filt('bandpass', f, 1.1), amp(t + .029, v*.65, .002, .28*p.decay), o); },
    // a short wooden knock: a high triangle and a band of noise
    rim(t, v, p, o){ const end = t + .12; chain(osc('triangle', 1720*st(p.tune), t, end), amp(t, v*.5, .0005, .03 + p.x*.04), o);
      chain(hiss(t, end), filt('bandpass', 2600*st(p.tune), 3), amp(t, v*.35, .0005, .015), o);
      chain(osc('sine', 480*st(p.tune), t, end), amp(t, v*.25, .0005, .02), o); },
    // a resonant wood block: a pure high tone with a little of its overtone, ringing as long as the character says
    clave(t, v, p, o){ const f = 2450*st(p.tune), d = (.04 + p.x*.08)*p.decay, end = t + d + .05;
      chain(osc('sine', f, t, end), amp(t, v*.6, .0005, d), o); chain(osc('sine', f*2.76, t, end), amp(t, v*.12, .0005, d*.4), o); },
    // hats: the metal (or noise, the less metallic) through a high band; a closed hat chokes an open one
    chh(t, v, p, o){ hat(t, v, p, o, .055*p.decay, 'chh'); },
    ohh(t, v, p, o){ hat(t, v, p, o, .5*p.decay, 'ohh'); },
    // the ride: the metal higher and longer, with its bell (two clear partials) as much as the character says
    ride(t, v, p, o){ const d = 1.6*p.decay, end = t + d + .1, m = st(p.tune), g = amp(t, v*.6, .001, d);
      chain(metal(t, end, 1.48*m, filt('bandpass', 7200, .6)), filt('highpass', 3200), g, o);
      for (const [f, l] of [[2860, .25], [4150, .12]]) chain(osc('sine', f*m, t, end), amp(t, v*l*p.x, .001, d*.6), o); },
    // the crash: noise and metal, high-passed, a slight swell in, then a long wash
    crash(t, v, p, o){ const d = 2*p.decay, end = t + d + .1, m = st(p.tune), g = amp(t, v*.55, .006, d);
      const sum = ctx.createGain(); chain(hiss(t, end), filt('highpass', 5000), sum);
      const mg = ctx.createGain(); mg.gain.value = p.x*1.4; metal(t, end, 1.9*m, mg); mg.connect(sum);
      chain(sum, filt('highpass', 3800), filt('peaking', 8500, .8), g, o); },
    // toms: a sine sliding down to its note, a skin's ring, and a felt thump
    tomL(t, v, p, o){ tom(t, v, p, o, 92); },
    tomH(t, v, p, o){ tom(t, v, p, o, 148); },
    // the cowbell: two squares a clashing interval apart, through a band, a sharp hit then a ring
    cow(t, v, p, o){ const d = .3*p.decay, end = t + d + .1, m = st(p.tune), sum = ctx.createGain(); sum.gain.value = .5;
      osc('square', 587*m, t, end).connect(sum); osc('square', 845*m, t, end).connect(sum);
      const g = ctx.createGain(), q = g.gain; q.setValueAtTime(0, t); q.linearRampToValueAtTime(v*.55, t + .001); q.exponentialRampToValueAtTime(v*.2, t + .035);
      q.exponentialRampToValueAtTime(v*.2*(1e-3 + (1 - p.x)*.01) + 1e-6, t + d); q.linearRampToValueAtTime(0, t + d + .01);
      chain(sum, filt('bandpass', 2400*m, 1.2), g, o); },
    // the shaker: high noise swelling in (more with the character) and out
    shaker(t, v, p, o){ const a = .006 + p.x*.03, d = .08*p.decay, end = t + a + d + .05; chain(hiss(t, end), filt('highpass', 6200), filt('peaking', 9500, 1.5), amp(t, v*.45, a, d), o); },
  };
  const hat = (t, v, p, o, d, k) => {
    const end = t + d + .08, m = st(p.tune), sum = ctx.createGain(), mg = ctx.createGain(), ng = ctx.createGain();
    mg.gain.value = .25 + p.x*.9; ng.gain.value = (1 - p.x)*.7 + .08;
    metal(t, end, m*1.6, mg); mg.connect(sum); chain(hiss(t, end), filt('highpass', 8000*m), ng, sum);
    const g = amp(t, v*.55, .0008, d); chain(sum, filt('bandpass', 10500*m, .9), filt('highpass', 7200*m), g, o);
    if (k === 'ohh') chokes.hat = {g, end}; else choke('hat', t);
  };
  const choke = (grp, t) => { const c = chokes[grp]; if (!c || t >= c.end) return; const p = c.g.gain; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t); p.setTargetAtTime(0, t, .006); chokes[grp] = null; };
  const tom = (t, v, p, o, base) => { const f = base*st(p.tune), d = .38*p.decay, end = t + d + .1, s = osc('sine', f*1.7, t, end);
    s.frequency.exponentialRampToValueAtTime(f, t + .07); chain(s, amp(t, v*.8, .001, d, .01), o);
    chain(osc('triangle', f*1.52, t, end), amp(t, v*.12, .001, d*.5), o);
    chain(hiss(t, t + .06), filt('bandpass', 420*st(p.tune), 1), amp(t, v*(.1 + p.x*.4), .0008, .03), o); };

  const kit = {
    P, out: bout,
    // a hit: the voice at its settings (or a step's own: lock), a touch of variation in level each time (as a hand would)
    play(key, t, vel = 1, lock = null){ const f = VOICE[key]; if (!f) return; const p = lock ? {...P[key], ...lock} : P[key]; f(Math.max(t, ctx.currentTime), vel*(.97 + Math.random()*.06), p, ch[key].in); },
    set(key, k, v){ if (!P[key]) return; P[key][k] = v; applyVoice(key); },
    load(name, over = {}){ const K = KITS[name] || KITS['909'], kp = kitParams(name);
      for (const v of VOICES) { P[v.key] = {...kp[v.key], ...(over[v.key] || {})}; applyVoice(v.key); } bset(K.bus); },
  };
  kit.load('909');
  return kit;
}
