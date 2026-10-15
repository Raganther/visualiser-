// The morphing objects' and the Prism's inside's own settings (the Adjust panel's "Morphing objects"): sliders straight
// over their TUNE numbers, live, kept on this device (afterglow.morph) and copied out for Claude to make them the defaults.
import { S } from '../state.js';
import { TUNE } from '../tuning.js';
import { $ } from '../util.js';
import { toast } from './toast.js';

const LOOKS = ['each section its own', 'own', 'chrome', 'glass', 'neon', 'iridescent', 'toon'];
// [path, label, min, max, step] (a list instead of a step: a select)
const GROUPS = [
  ['All of them', [['sdf.res', 'Sharpness (share of pixels marched; lower is faster)', .3, 1, .05], ['sdf.steps', 'March steps (lower is faster, rougher)', .4, 1.5, .05],
    ['sdf.ao', 'Shading in the creases (ambient occlusion)', 0, 1, .05], ['sdf.res2d', 'Simple mode: rays across', 24, 80, 4],
    ['sdf.look', 'Look', LOOKS, -1], ['sdf.size', 'Size', .3, .9, .02], ['sdf.spin', 'Turning', 0, .6, .02], ['sdf.exSecs', 'A drop\'s splash: how long', .8, 6, .1],
    ['sdf.wander.amount', 'Under a kaleidoscope: how far it wanders', 0, 1, .05], ['sdf.wander.speed', 'Under a kaleidoscope: how fast it wanders', 0, 1.5, .05]]],
  ['Ferrofluid', [['ferro.spike', 'Spikes: height', 0, .7, .01], ['ferro.sharp', 'Spikes: sharpness', .4, 2.5, .05], ['ferro.jolt', 'The kick\'s jolt', 0, .25, .01],
    ['ferro.flow', 'The spikes crawling', 0, 1, .02], ['ferro.magnet', 'A stab\'s pull to one side', 0, 2, .05], ['ferro.drops', 'Orbiting drops', 0, 3, 1],
    ['ferro.fling', 'A drop\'s fling', 0, 1.5, .05], ['ferro.ripple', 'The bass\'s ripple', 0, .05, .002], ['ferro.look', 'Its own look', LOOKS, -1]]],
  ['Liquid metal', [['mercury.pull', 'The kick\'s pull', 0, 15, .5], ['mercury.splash', 'A drop\'s splash', 0, 1.6, .05], ['mercury.wobble', 'The bass\'s wobble', 0, .12, .005],
    ['mercury.stretch', 'Stretching upright', 0, .4, .01], ['mercury.moons', 'Moons', 0, 2, 1], ['mercury.look', 'Its own look', LOOKS, -1]]],
  ['Soap bubble', [['bubble.wobble', 'The bass\'s wobble', 0, .15, .005], ['bubble.swirl', 'The hats\' swirl', 0, 4, .1], ['bubble.film', 'Rainbow bands', .5, 4, .1],
    ['bubble.foam', 'Foam bubbles', 0, 4, 1], ['bubble.clear', 'Clear middle (lower is clearer)', 0, .4, .01]]],
  ['Living cell', [['cell.organelles', 'Organelles', 0, 8, 1], ['cell.glow', 'The nucleus\'s glow', 0, 2.5, .05], ['cell.wobble', 'The membrane\'s wobble', 0, .15, .005],
    ['cell.drift', 'How fast they stir', 0, 4, .1], ['cell.divideBars', 'Divide every n bars (0: on a drop)', 0, 32, 4]]],
  ['Brain coral', [['coral.pattern', 'Pattern', ['maze', 'holes', 'diamond', 'bands'], 0], ['coral.freq', 'Fineness', 6, 32, .5], ['coral.ridge', 'Ridges\' depth', 0, .08, .002],
    ['coral.ring', 'The kick\'s rings: speed', 0, 3, .1], ['coral.drift', 'The pattern drifting', 0, 4, .1], ['coral.heave', 'A drop\'s heave', 0, .3, .01], ['coral.look', 'Its own look', LOOKS, -1]]],
  ['Growing crystals', [['growth.count', 'How many', 1, 16, 1], ['growth.grow', 'How long they grow', .3, 1.6, .05], ['growth.spread', 'How different their lengths', 0, .5, .02],
    ['growth.regrow', 'Regrowing each phrase', 0, 1, .05], ['growth.tip', 'The tips\' glow', 0, 2, .05], ['growth.fling', 'A drop\'s fling', 0, 1.5, .05], ['growth.look', 'Its own look', LOOKS, -1]]],
  ['Inside the Prism', [['inner', 'Kind (K then P)', ['each section its own', 'off', 'skin', 'mirrors', 'tunnel'], -1], ['jewel.inner.bounces', 'Mirrors: bounces', 1, 8, 1],
    ['jewel.inner.dim', 'Mirrors: each bounce\'s light', .5, .95, .01], ['jewel.inner.shards', 'Mirrors: shards', 0, 6, 1], ['jewel.inner.index', 'The glass\'s bending', 1, 2.4, .05],
    ['jewel.inner.seam', 'Tunnel: the seams\' light', 0, 2.5, .05], ['jewel.inner.beads', 'Skin: beads', 1, 5, 1]]],
];
const get = p => p.split('.').reduce((o, k) => o == null ? o : o[k], TUNE);
const set = (p, v) => { const ks = p.split('.'), last = ks.pop(), o = ks.reduce((a, k) => a[k], TUNE); o[last] = v; };
const DEF = {};   // the defaults, to know what's changed
for (const [, rows] of GROUPS) for (const [p] of rows) if (p !== 'inner') DEF[p] = get(p) ?? -1;
let saved = {};
try { saved = JSON.parse(localStorage.getItem('afterglow.morph') || '{}') || {}; } catch (e) {}
for (const [p, v] of Object.entries(saved)) if (p in DEF && typeof v === 'number') set(p, v);
const keep = () => { try { localStorage.setItem('afterglow.morph', JSON.stringify(saved)); } catch (e) {} };
const changed = () => Object.fromEntries(Object.entries(saved).filter(([p, v]) => v !== DEF[p]));
const fmt = (v, st) => st >= 1 ? String(Math.round(v)) : (+v).toFixed(st < .01 ? 3 : 2);

function build(){
  const box = $('#morphTune'); if (!box) return;
  box.innerHTML = '';
  for (const [name, rows] of GROUPS) {
    const d = document.createElement('details'), s = document.createElement('summary'); s.textContent = name; d.append(s);
    for (const [p, label, a, b, st] of rows) {
      const row = document.createElement('div'); row.className = 'row';
      const lb = document.createElement('label'), id = 'mt_' + p.replace(/\./g, '_'); lb.htmlFor = id; lb.textContent = label; row.append(lb);
      if (Array.isArray(a)) {   // a list: a select (its first entry is the "-1" one when there is one)
        const sel = document.createElement('select'); sel.id = id; const off = b;
        a.forEach((n, i) => { const o = document.createElement('option'); o.value = i + off; o.textContent = n; sel.append(o); });
        sel.value = p === 'inner' ? (S.jewelInner == null ? -1 : S.jewelInner) : Math.round(get(p) ?? -1);
        sel.addEventListener('change', () => { const v = +sel.value;
          if (p === 'inner') { S.jewelInner = v < 0 ? null : v; return; }
          set(p, v); saved[p] = v; keep(); });
        row.append(sel);
      } else {
        const out = document.createElement('output'), inp = document.createElement('input');
        Object.assign(inp, {type: 'range', id, min: a, max: b, step: st, value: get(p)}); out.textContent = fmt(get(p), st);
        inp.addEventListener('input', () => { const v = +inp.value; set(p, v); saved[p] = v; out.textContent = fmt(v, st); keep(); });
        row.append(out, inp);
      }
      d.append(row);
    }
    box.append(d);
  }
  const bar = document.createElement('div'); bar.className = 'row';
  const cp = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: 'Copy settings'});
  const rs = Object.assign(document.createElement('button'), {className: 'btn', type: 'button', textContent: 'Reset'});
  cp.addEventListener('click', () => { const t = JSON.stringify({morph: changed()}); navigator.clipboard?.writeText(t).then(() => toast('Copied: paste it to Claude to make these the defaults'), () => toast(t)); });
  rs.addEventListener('click', () => { for (const [p, v] of Object.entries(DEF)) set(p, v); saved = {}; keep(); S.jewelInner = null; build(); toast('Morphing objects: back to the defaults'); });
  bar.append(cp, rs); box.append(bar);
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', build); else build(); }
export const morphPanel = build;   // (the keys change the Prism's inside too: rebuilt when the panel opens)
