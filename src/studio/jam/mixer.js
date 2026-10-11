// The jam's mixing engineer: Mix listens to the parts as they play (each its loudness and where in the spectrum it sits)
// and sets their levels, EQ, ducking and compression, then masters the whole to the chosen preset's loudness and balance,
// listening again to check; Before / After compares the two at the same loudness; Auto keeps the levels and the loudness
// where they were put as parts come and go. It works through the knobs the parts already have (automix.js's slots), so
// the music never stops. makeMixer(core) → {mix, ab, setPreset, setAuto, state, on}
import { listen, plan, masterPlan, loudGain, NEUTRAL } from '../automix.js';
import { TUNE } from '../../tuning.js';

export const ROLES = {drums: 'drums', hats: 'hats', perc: 'perc', bass: 'bass', chords: 'chords', hook: 'hook'};
// every setting the mix may turn (so Before and After are each a full set of them)
const PATHS = [...Object.keys(ROLES).flatMap(id => [`${id}.vol`, `${id}.aeq.0.f`, `${id}.aeq.1.f`, `${id}.aeq.1.g`, `${id}.aeq.2.f`, `${id}.aeq.2.g`,
  `${id}.duck.depth`, `${id}.duck.rel`, `${id}.acomp.thr`, `${id}.acomp.ratio`, `${id}.acomp.att`, `${id}.acomp.rel`, `${id}.acomp.gain`]),
  'master.limit.ceil', 'master.limit.gain', 'master.glue.ratio', 'master.glue.att', 'master.glue.thr', 'master.tone.0.g', 'master.tone.1.g', 'master.tone.2.g'];

export function makeMixer(core){
  const J = core.J, st = {busy: false, say: '', progress: 0, log: [], before: null, after: null, side: 'after', match: true, L0: null, L1: null, lufs: null, peak: null, auto: false};
  J.master = J.master || 'club'; J.locks = J.locks || {};
  const subs = new Set(), emit = () => { for (const f of subs) f(st); };
  const E = () => core.player && core.player.E;
  const bars = n => n*4*60/core.song.bpm;
  const get = p => { const q = E().target(p); const v = q && q.get(); return v == null ? null : v; };
  const snap = () => Object.fromEntries(PATHS.map(p => [p, get(p)]).filter(([, v]) => v != null && typeof v !== 'object'));
  const apply = vals => { for (const [p, v] of Object.entries(vals)) if (v != null) E().set(p, v); };
  const heard = () => Object.keys(ROLES).filter(k => core.lane(k).take && !core.lane(k).mute && !core.empty(k));
  const hear = (o, label) => { const e = E(); st.say = label; emit(); return listen(e, {...o, onProgress: x => { st.progress = x; emit(); }, stop: () => E() !== e || !core.playing()}); };
  const preset = () => TUNE.studio.masters[J.master] || TUNE.studio.masters.club;

  // the loudness: the master listened to and the limiter's gain moved, until it's near the preset's (or passes run out)
  async function loud(lines){
    const P = preset(), T = TUNE.studio.mix; let m = null;
    for (let i = 0; i < T.passes; i++) {
      m = (await hear({secs: bars(T.masterBars)}, `Listening to the master… (${i + 1})`)).master;
      st.lufs = m.lufs; st.peak = m.peak;
      if (P.lufs == null || !isFinite(m.lufs) || Math.abs(m.lufs - P.lufs) <= T.near) break;
      const g = loudGain(get('master.limit.gain') || 0, m.lufs, P.lufs); E().set('master.limit.gain', g);
      if (lines) lines.push(`Master: the limiter pushed to +${g} dB, for ${P.lufs} LUFS`);
    }
    return m;
  }
  // what the changes did, heard and corrected: the ducking and compression take off more than can be foreseen, and a
  // short listen catches a sparse part at a quiet moment, so the levels and the master's loudness are listened to again
  // together, and nudged, until both are near (or the passes run out)
  async function settle(ids, lines){
    const T = TUNE.studio.mix, P = preset(); let m = null;
    for (let i = 0; i < T.passes; i++) {
      const a = await hear({ids, secs: bars(T.masterBars)}, `Checking the balance… (${i + 1})`); m = a.master; st.lufs = m.lufs; st.peak = m.peak;
      const vols = Object.fromEntries(ids.map(k => [k, get(`${k}.vol`) || 0]));
      const fix = plan(a, {roles: Object.fromEntries(ids.map(k => [k, ROLES[k]])), vols, bpm: core.song.bpm, locks: J.locks}).filter(c => c.path.endsWith('.vol') && Math.abs(c.v - vols[c.part]) > T.near);
      for (const c of fix) E().set(c.path, c.v);
      const loudOk = P.lufs == null || !isFinite(m.lufs) || Math.abs(m.lufs - P.lufs) <= T.near;
      if (!loudOk) { const g = loudGain(get('master.limit.gain') || 0, m.lufs, P.lufs); E().set('master.limit.gain', g); }
      if (!fix.length && loudOk) break;
    }
    // (the levels moved after the master was last heard: its loudness checked once more, on its own)
    m = (await loud(null)) || m;
    if (P.lufs != null) lines.push(`Master: the limiter at ${(get('master.limit.gain') || 0) >= 0 ? '+' : ''}${get('master.limit.gain') || 0} dB, for ${P.lufs} LUFS`);
    return m;
  }
  // Mix: the parts as they are (the mix's own settings let go while it listens), then each part's place, then the master
  async function mix(){
    if (st.busy) return; if (!core.playing()) await core.start();
    st.busy = true; st.log = []; emit();
    try {
      const ids = heard(); if (!ids.length) { st.say = 'Nothing playing to mix yet.'; return; }
      st.before = snap(); st.side = 'after';
      st.L0 = (await hear({secs: bars(1)}, 'Listening to how it sounds now…')).master.lufs;
      apply(Object.fromEntries(NEUTRAL(ROLES)));
      const a = await hear({ids, secs: bars(TUNE.studio.mix.listenBars)}, `Listening to the ${ids.length} parts…`);
      const vols = Object.fromEntries(ids.map(k => [k, get(`${k}.vol`) || 0]));
      st.lastMaster = a.master;
      const ch = plan(a, {roles: Object.fromEntries(ids.map(k => [k, ROLES[k]])), vols, bpm: core.song.bpm, locks: J.locks});
      for (const c of ch) E().set(c.path, c.v);
      for (const c of masterPlan(a.master, preset())) { E().set(c.path, c.v); if (c.why) ch.push(c); }
      const lines = ch.filter(c => c.why && !c.path.endsWith('.vol')).map(c => c.why);
      const m = await settle(ids, lines);
      st.L1 = m && m.lufs; st.after = snap();
      // (the levels as they ended, after the checking passes: each part's whole move, first in the list)
      const NAME = {drums: 'Kick & snare', bass: 'Bass', chords: 'Chords', hook: 'Hook', hats: 'Hats', perc: 'Percussion'}, T = TUNE.studio.mix;
      const moved = ids.map(k => { const d = (st.after[`${k}.vol`] || 0) - (st.before[`${k}.vol`] || 0); return Math.abs(d) < .5 ? null :
        `${NAME[k]} ${d > 0 ? '+' : ''}${d.toFixed(1)} dB: to sit ${T.targets[ROLES[k]] ? -T.targets[ROLES[k]] + ' dB under' : 'level with'} the kick`; }).filter(Boolean);
      st.log = [...moved, ...lines];
      st.say = `Mixed: ${lines.length} changes. ${isFinite(st.L1) ? `The master at ${st.L1.toFixed(1)} LUFS.` : ''}`;
    } finally { st.busy = false; st.progress = 0; emit(); core.touched && core.touched(); }
  }
  // Before / After: each a full set of the settings; with `match`, the louder one turned down to the other's loudness
  function ab(side){
    if (!st.before || !st.after || st.busy) return; st.side = side;
    apply(side === 'after' ? st.after : st.before);
    const d = isFinite(st.L0) && isFinite(st.L1) ? st.L1 - st.L0 : 0;
    E().set('master.trim.db', !st.match ? 0 : side === 'after' ? Math.min(0, -d) : Math.min(0, d));
    emit();
  }
  function setMatch(on){ st.match = on; ab(st.side); }
  // a mastering preset: its tone, glue and ceiling at once; its loudness found by listening (while it plays)
  async function setPreset(key){
    J.master = key; if (!E()) return emit();
    for (const c of masterPlan(st.lastMaster || null, preset())) E().set(c.path, c.v);
    E().set('master.trim.db', 0); st.side = 'after'; emit();
    if (core.playing() && !st.busy) { st.busy = true; emit(); try { await loud([]); st.say = `${preset().label}: ${isFinite(st.lufs) ? st.lufs.toFixed(1) + ' LUFS' : ''}`; } finally { st.busy = false; emit(); } }
  }
  // Auto: every few bars, a short listen; the levels and the limiter nudged back towards where the mix put them
  let autoT = 0;
  function setAuto(on){ st.auto = on; clearInterval(autoT); if (on) autoT = setInterval(autoStep, 500); emit(); }
  let nextAuto = 0;
  async function autoStep(){
    if (!st.auto || st.busy || !core.playing()) return;
    const now = core.ctx.currentTime; if (now < nextAuto) return; nextAuto = now + bars(TUNE.studio.mix.autoBars);
    const ids = heard(); if (!ids.length) return;
    st.busy = true; emit();
    try {
      const a = await hear({ids, secs: bars(2)}, 'Auto: listening…'), T = TUNE.studio.mix;
      const vols = Object.fromEntries(ids.map(k => [k, get(`${k}.vol`) || 0]));
      // (only the levels, and only a step at a time: the music changing shouldn't make the mix jump)
      for (const c of plan(a, {roles: Object.fromEntries(ids.map(k => [k, ROLES[k]])), vols, bpm: core.song.bpm, locks: J.locks}).filter(c => c.path.endsWith('.vol'))) {
        const v0 = vols[c.part], v = v0 + Math.max(-T.autoStep, Math.min(T.autoStep, c.v - v0)); if (Math.abs(v - v0) >= .5) E().set(c.path, v); }
      const P = preset(); st.lufs = a.master.lufs; st.peak = a.master.peak;
      if (P.lufs != null && isFinite(a.master.lufs) && Math.abs(a.master.lufs - P.lufs) > T.near) { const g0 = get('master.limit.gain') || 0;
        E().set('master.limit.gain', g0 + Math.max(-T.autoStep, Math.min(T.autoStep, loudGain(g0, a.master.lufs, P.lufs) - g0))); }
      st.say = `Auto: ${isFinite(st.lufs) ? st.lufs.toFixed(1) + ' LUFS' : 'listening'}`;
    } finally { st.busy = false; emit(); }
  }
  return {state: st, core, mix, ab, setMatch, setPreset, setAuto, masterKey: () => J.master, on: f => (subs.add(f), () => subs.delete(f)), dispose: () => { clearInterval(autoT); st.auto = false; }};
}
