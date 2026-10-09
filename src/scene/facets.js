// Facet light for the wire objects (render/mesh.js): their panes light up in patterns, each part of the music its own, as
// the prism's facets do (objects/prism.js, which has more: cascades and life on its facets). The user loved the way the
// symmetrical objects' facets light up and asked for them to light in different combinations with the music:
// - each kick sends a ring of light across the object from a new point;
// - stabs step a lit wedge round it, or a lit band up it (the section chooses which, and its axis and number);
// - the hi-hats light a new random handful of panes each 16th;
// - in a drop's run-up it fills with light from the bottom up as the drop nears;
// - they come in as a section runs: the kick's at once, the stabs' after 4 bars, the hats' after 8 (TUNE.mesh.fx).
// Each object keeps its own (makeFx), worked out on the CPU, handed to the shader as a few numbers (U.fx), and to simple
// mode, which lights each pane the same way (fxAt). No Math.random: Journey's draws are untouched.
import { SIG } from './signals.js';
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { L } from '../audio/listen.js';
export { fxAt } from '../render/mesh.js';   // (a pane's light, worked out the same in simple mode)

const hash = n => { const x = Math.sin(n*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0)/4294967296; };
const tids = new WeakMap(); let tidN = 0; const tid = t => t == null ? 0 : tids.get(t) || (tids.set(t, ++tidN), tidN);   // a section type's own number (types are objects)
const dirOf = (a, b) => { const z = a*2 - 1, t = b*Math.PI*2, r = Math.sqrt(1 - z*z); return [r*Math.cos(t), z, r*Math.sin(t)]; };

export function makeFx(salt){
  const st = {rip: [], n: 0, sec: 0, secT: -9, band: 0, bars: 0, secBars: 0, type: undefined, mode: 1, axis: [0, 1, 0], nSec: 4, t: 0, s16: -1, lastHit: 0, kickT: -9};
  // U.fx: rip (4 × origin xyz and ring angle, -1 when off), ripK (strengths), sec (axis xyz, count), secS (lit index, fade, mode, 0),
  // spk (step seed, share, amount, meter height or -2)
  const U = {rip: new Float32Array(16).fill(-1), ripK: new Float32Array(4), sec: new Float32Array(4), secS: new Float32Array(4), spk: new Float32Array(4)};
  return {
    U,
    beat(pos){ if (pos === 0) { st.bars++; st.secBars++; } },
    // each frame (while the object shows): x as a visual's params get it
    step(x){
      const T = TUNE.mesh.fx, J = x.J, dt = x.dt, ten = J ? J.tension || 0 : .5, bp = Math.max(.25, S.beatPeriod);
      st.t += dt;
      const type = J && J.on ? J.type : null;
      if (type !== st.type) { st.type = type; st.secBars = 0; const h = hashStr(tid(type) + ':' + salt);
        st.mode = 1 + Math.floor(hash(h*91) * 2); st.axis = dirOf(hash(h*13), hash(h*17)); st.nSec = [3, 4, 5, 6, 8][Math.floor(hash(h*29)*5)]; }
      // the kick: a ring from a new point
      if (SIG.kick > .99 && st.t - st.kickT > .12) { st.kickT = st.t; st.n++;
        st.rip.push({o: dirOf(hash(st.n*3.1 + salt), hash(st.n*7.7 + salt)), t: st.t, k: .55 + ten*.5}); if (st.rip.length > 4) st.rip.shift(); }
      if (x.hit > .8 && st.lastHit <= .8) { st.sec++; st.secT = st.t; }
      st.lastHit = x.hit;
      const s16 = SIG.barPhase > 0 ? Math.floor(SIG.barPhase*16) : Math.floor(st.t/(bp/4)) % 16;
      if (s16 !== st.s16) { st.s16 = s16; if (s16 % 4 === 0) st.band++; }
      for (let i = 0; i < 4; i++) { const q = st.rip[i];
        if (!q || st.t - q.t > T.ripSecs) { U.rip[i*4 + 3] = -1; U.ripK[i] = 0; continue; }
        U.rip.set(q.o, i*4); U.rip[i*4 + 3] = (st.t - q.t)*T.ripSpeed; U.ripK[i] = q.k*(1 - (st.t - q.t)/T.ripSecs)*T.amount; }
      const on = k => st.secBars >= T.layerBars[k];
      U.sec[0] = st.axis[0]; U.sec[1] = st.axis[1]; U.sec[2] = st.axis[2]; U.sec[3] = st.nSec;
      U.secS[0] = st.mode === 1 ? st.sec % st.nSec : st.band % 6; U.secS[1] = on('stab') ? (st.mode === 1 ? .35 + .65*Math.exp(-(st.t - st.secT)*2.5) : .6)*T.amount : 0; U.secS[2] = st.mode;
      const anticip = (J && J.anticip) || 0;
      U.spk[0] = (st.s16 + st.bars*16) % 256; U.spk[1] = on('hat') ? Math.min(1, SIG.hat*1.4)*T.hatShare : 0; U.spk[2] = T.amount*(L.brk ? .4 : 1); U.spk[3] = anticip > .02 ? anticip*2.2 - 1 : -2;
    },
  };
}
