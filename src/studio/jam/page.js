// The jam's page: the transport and the jam's feel along the top, a face in the middle (what's playing: grid, strips or
// focus, switchable to compare), and the deck at the bottom (where you play: the chosen part's pads or keys and its
// macros, More for its whole sound). Everything is big enough for a finger. The jam is kept as you leave it (the
// Artifact's database, or this browser), and Open in Studio hands it to the Studio as a song to arrange and mix.
import { makeJam } from './core.js';
import { jamSong, part } from './song.js';
import { FACES } from './faces.js';
import { h, btn, bar, hue, macroRow, pads, keys, more } from './kit.js';
import { STYLES } from '../improv.js';
import * as SAVE from '../saved.js';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(r => ['minor', 'dorian', 'phrygian', 'major'].map(m => `${r} ${m}`));
const Q = [[1, '1/16'], [2, '1/8'], [4, '1/4'], [0, 'Off']];
const LS = 'afterglow.jam.face';
const seg = (list, cur, fn, cls = '') => { const s = h('div', 'jseg ' + cls); for (const [v, label, title] of list) { const b = btn(label, v === cur ? 'cur' : '', () => fn(v), title); b.dataset.v = v; s.appendChild(b); } return s; };
const setSeg = (s, v) => s.querySelectorAll('button').forEach(b => b.classList.toggle('cur', b.dataset.v === String(v)));

// root: the page's element; getCtx: the AudioContext; toStudio(song): open it in the Studio
export async function mountJam({root, getCtx, toStudio, latency = () => 'balanced', setLatency = () => {}}){
  root.innerHTML = '<div class="jload">Getting the jam ready…</div>';
  await SAVE.start();
  const kept = SAVE.all().find(d => d.id === 'jam');
  let core = makeJam({getCtx, song: kept ? kept.song : jamSong()});
  const ctl = {lane: 'drums', oct: 0, chord: false, face: (() => { try { return localStorage.getItem(LS) || 'grid'; } catch (e) { return 'grid'; } })(),
    select(k){ if (ctl.lane === k) return; ctl.lane = k; ctl.chord = k === 'chords'; ctl.oct = 0; face.refresh(); drawDeck(); }};
  root.innerHTML = '';
  // (the audio starts on the first touch: browsers won't make a sound before one)
  root.addEventListener('pointerdown', () => { const c = getCtx(); if (c.state !== 'running') c.resume(); core.ready().then(() => deckMacros && deckMacros.refresh()); }, {capture: true});

  /* ---------- the top: transport and feel ---------- */
  const top = h('div', 'jtop'); root.appendChild(top);
  const playB = btn('▶', 'jplay', () => core.toggle(), 'Play or stop (Space)');
  const recB = btn('● Rec', 'jrec', () => core.setRec(), 'Record what you play into the part on the deck, over its loop');
  const click = btn('Click', 'jclick', () => { core.setting('click', !core.J.click); }, 'A click on every beat, to play in time with');
  const groove = btn('New groove', 'jall', () => core.all(), 'A new idea in every part at once');
  const tempo = h('div', 'jtempo'), tv = h('b');
  tempo.append(btn('−', '', () => core.setTempo(core.song.bpm - 1)), tv, btn('+', '', () => core.setTempo(core.song.bpm + 1)));
  const keySel = h('select', 'jkey'); for (const k of KEYS) { const o = h('option', null, k); o.value = k; keySel.appendChild(o); } keySel.onchange = () => core.setKey(keySel.value);
  const styleSel = h('select', 'jstyle'); for (const [k, s] of Object.entries(STYLES)) { const o = h('option', null, s.label); o.value = k; o.title = s.words; styleSel.appendChild(o); } styleSel.onchange = () => core.setting('style', styleSel.value);
  const energy = bar('Energy', () => core.J.energy, x => core.setting('energy', Math.round(x*100)/100), {cls: 'small'});
  const qSeg = seg(Q.map(([v, l]) => [v, l, v ? `Recorded notes land on the nearest ${l}` : 'Recorded notes stay where you played them']), core.J.q, v => { core.setting('q', v); setSeg(qSeg, v); }, 'jq');
  const lSeg = seg([['bar', 'Bar', 'Changes start on the next bar'], ['now', 'Now', 'Mutes and changes heard at once, in step with the bar']], core.J.launch, v => { core.setting('launch', v); setSeg(lSeg, v); }, 'jl');
  const fSeg = seg(Object.entries(FACES).map(([k, f]) => [k, f.label, f.words]), ctl.face, v => { ctl.face = v; try { localStorage.setItem(LS, v); } catch (e) {} setSeg(fSeg, v); mountFace(); }, 'jf');
  // the sound's buffer: smaller answers sooner, larger never crackles; a new one needs a new audio context, so the page
  // keeps the jam and reloads (the delay it gives is shown, once the audio runs)
  const LATS = [['interactive', 'Quick', 'The least delay; may crackle on an iPad'], ['balanced', 'Smooth', 'A little more delay, no crackle'], ['playback', 'Safest', 'The most delay, for a busy device']];
  const latSel = h('select', 'jlat'); latSel.title = 'The sound’s buffer: a smaller one answers sooner, a larger one never crackles';
  for (const [v, l, w] of LATS) { const o = h('option', null, l); o.value = v; o.title = w; latSel.appendChild(o); } latSel.value = latency();
  latSel.onchange = async () => { setLatency(latSel.value); core.stop(); try { await SAVE.put('jam', core.song, false); } catch (e) {} location.reload(); };
  const latMs = h('span', 'jlab');
  const studio = btn('Open in Studio ▸', 'jstudio', () => { core.stop(); toStudio(structuredClone(core.song)); }, 'Arrange and mix this jam in the Studio');
  const fresh = btn('New jam', 'jnew', () => { if (!fresh.dataset.sure) { fresh.dataset.sure = 1; fresh.textContent = 'Sure?'; setTimeout(() => { delete fresh.dataset.sure; fresh.textContent = 'New jam'; }, 2500); return; }
    delete fresh.dataset.sure; fresh.textContent = 'New jam'; core.stop(); if (core.player) core.player.dispose(); core = makeJam({getCtx, song: jamSong({bpm: core.song.bpm, key: core.song.key})}); hook(); mountFace(); drawDeck(); paintTop(); }, 'Start again with nothing (the jam you had is replaced)');
  const lab = t => { const s = h('span', 'jlab', t); return s; };
  // (a label stays with its control when the bar wraps)
  const grp = (...els) => { const g = h('span', 'jgrp'); g.append(...els); return g; };
  top.append(playB, recB, click, groove, grp(lab('Tempo'), tempo), keySel, styleSel, energy, grp(lab('Quantise'), qSeg), grp(lab('Launch'), lSeg), h('span', 'jgap'), grp(lab('Layout'), fSeg), grp(lab('Sound'), latSel, latMs), fresh, studio);
  function paintTop(){
    const c = core.ctx; latMs.textContent = c && c.state === 'running' ? Math.round(((c.baseLatency || 0) + (c.outputLatency || 0))*1000) + ' ms' : '';
    playB.textContent = core.playing() ? '■' : '▶'; playB.classList.toggle('on', core.playing());
    recB.classList.toggle('on', core.rec.on); click.classList.toggle('on', !!core.J.click); tv.textContent = core.song.bpm; keySel.value = core.song.key; styleSel.value = core.J.style; energy.show();
    setSeg(qSeg, core.J.q); setSeg(lSeg, core.J.launch);
  }

  /* ---------- the middle: a face ---------- */
  const mid = h('div', 'jmid'); root.appendChild(mid);
  let face = null;
  function mountFace(){ mid.innerHTML = ''; mid.className = 'jmid ' + ctl.face; face = FACES[ctl.face].mount(mid, core, ctl); }

  /* ---------- the bottom: the deck, where you play ---------- */
  const deck = h('div', 'jdeck'); root.appendChild(deck);
  let deckMacros = null;
  function drawDeck(){
    const k = ctl.lane, p = part(k); deck.innerHTML = ''; deck.style.setProperty('--c', hue(k));
    const side = h('div', 'dside');
    side.appendChild(h('div', 'dname', `<b>${p.label}</b><small>${p.kind === 'drums' ? 'hit harder at the top of a pad' : 'in key: each row a fourth up; slide between notes'}</small>`));
    deckMacros = macroRow(core, k); side.appendChild(deckMacros);
    if (p.kind === 'notes') { const o = h('div', 'doct');
      o.append(btn('Oct −', '', () => { ctl.oct = Math.max(-2, ctl.oct - 1); drawDeck(); if (ctl.face === 'focus') face.refresh(); }), h('span', null, (ctl.oct > 0 ? '+' : '') + ctl.oct),
        btn('Oct +', '', () => { ctl.oct = Math.min(2, ctl.oct + 1); drawDeck(); if (ctl.face === 'focus') face.refresh(); }),
        btn('Chord', ctl.chord ? 'on' : '', () => { ctl.chord = !ctl.chord; drawDeck(); }, 'Each pad plays a chord of the scale'));
      side.appendChild(o); }
    side.appendChild(more(core, k));
    deck.append(side, p.kind === 'drums' ? pads(core, k, {big: true}) : keys(core, k, ctl));
  }

  /* ---------- keeping it, and the frame ---------- */
  let saveT = 0, raf = 0;
  const keep = () => { clearTimeout(saveT); saveT = setTimeout(() => SAVE.put('jam', core.song, false).catch(() => {}), 1200); };
  let unsub = null;
  function hook(){
    if (unsub) unsub();
    unsub = core.on(w => {
      if (w === 'transport' || w === 'rec' || w === 'settings') paintTop();
      if (w === 'takes' || w === 'mute' || w === 'notes' || w === 'loop') { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => face.refresh()); }
      if (w === 'sound' && deckMacros) deckMacros.refresh();
      if (typeof w === 'string' && w !== 'transport') keep();
    });
  }
  hook(); mountFace(); drawDeck(); paintTop();
  // (whether it's shown by `hidden`, not offsetParent: a fixed page has none, and the playheads never moved)
  const loop = () => { if (!root.hidden && face) face.frame(); requestAnimationFrame(loop); }; loop();
  document.addEventListener('keydown', e => { if (root.hidden || e.target.closest('input,select,textarea')) return; if (e.code === 'Space') { e.preventDefault(); core.toggle(); } });
  return {get core(){ return core; }, ctl, stop: () => core.stop(), face: () => face, select: k => ctl.select(k), setFace: v => fSeg.querySelector(`[data-v="${v}"]`).click()};
}
