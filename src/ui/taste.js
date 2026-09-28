// Likes and dislikes: 👍 / 👎 (or + and -) record the moment, with what was on screen, the music and a thumbnail. On the published
// page they go to the Artifact's database (collection "moments"), where Claude reads them to learn the user's taste
// (docs/taste.md, the taste-review skill); elsewhere they're kept in this browser.
// A like also keeps the whole look (every setting, its movers, its scene), so it can be brought back: the Adjust panel's
// "Liked" gallery shows them, restores one by hand, renames or removes it; and Journey reads them as favoured recipes
// (LIKED in presets.js, journey/recipes.js), so what the user likes comes back when the music suits it.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { LIKED, SPEC, curP, eff } from '../presets.js';
import { setJourney } from './controls.js';
import { setPreset } from './presets.js';
import { toast } from './toast.js';
import { $, clone } from '../util.js';
import { OBJECT_VISUALS, byKey } from '../visuals/registry.js';

const LOCAL = 'afterglow.moments', KEEP = 300, SHOWN = 80, PICTURE = ['Layers', 'Hits', 'Worlds', 'Media and objects', 'Kaleidoscope'];
let db = null, want = 0, count = 0, liked = [];   // liked: the liked moments that can be restored, newest first
// the Artifact's database, when this page is one and it's granted; never waited on
if (window.claude && window.claude.use) window.claude.use('db').then(d => { db = d; if (db) watch(); }).catch(() => {});
const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch (e) { return []; } };
const keepLocal = a => { try { localStorage.setItem(LOCAL, JSON.stringify(a.slice(-KEEP))); } catch (e) {} };
count = local().length;

export function rate(v){ want = v; }   // taken at the end of the next drawn frame, when the canvas still holds it
// called by main.js after each frame is drawn
export function tasteFrame(){
  if (!want) return;
  const v = want; want = 0;
  let c = null;   // the picture is copied now, while the canvas holds it; encoding and saving wait until after the frame
  try { c = document.createElement('canvas'); c.width = 160; c.height = 90; c.getContext('2d').drawImage($('#gl'), 0, 0, 160, 90); } catch (e) { c = null; }
  const d = window.__jdbg ? window.__jdbg() : {}, r3 = x => typeof x === 'number' ? +x.toFixed(3) : x;
  const centre = J.on ? J.centre : (OBJECT_VISUALS.filter(o => curP[o.key] > .3).sort((a, b) => curP[b.key] - curP[a.key])[0] || {}).key || null;
  const m = {v, at: new Date().toISOString(), track: $('#track').textContent, pos: $('#tNow').textContent, onScreen: $('#onNow').textContent,
    journey: J.on, preset: J.on ? null : S.active.name, recipe: d.recipe || null, lead: d.lead || null, accent: d.accent || null, hit: d.hit || null,
    world: d.world || null, scene: d.scene || null, centre: d.centre || null, lens: d.lensOn && d.lens ? d.lens.n : 0,
    section: d.sec || null, pace: d.pace ? d.pace.name : null, tension: r3(d.T), bpm: d.grid && d.grid.bpm ? r3(d.grid.bpm) : null,
    caption: $('#caption').classList.contains('show') ? $('#caption').textContent : null,
    place: eff.cosmos > .05 && byKey.cosmos ? (({system, star, subject, shot, belt}) => ({system, star, subject, shot, belt}))(byKey.cosmos.info()) : null,
    settings: Object.fromEntries(Object.entries(eff).filter(([, x]) => typeof x === 'number' && x !== 0).map(([k, x]) => [k, r3(x)])), thumb: '',
    // the look as drawn, to bring back: every setting (as drawn now, not a target still being eased to), movers, scene
    look: {settings: Object.fromEntries(SPEC.map(s => [s.k, r3(curP[s.k])])), mods: clone(S.active.mods || {}), tw: clone(S.active.tw || {}),
      scene: clone((J.on ? J.sceneLive : S.scene) || null), sceneKey: J.on && J.sceneLive ? J.sceneKey : null, centre},
    name: nameOf(d)};
  setTimeout(() => { try { if (c) m.thumb = c.toDataURL('image/jpeg', .6); } catch (e) {} save(m); }, 0);
  count++; if (v > 0) dispatchEvent(new Event('afterglow-like'));   // (the tutorial waits for one)
  toast(v > 0 ? `Liked (${count}): it's in Adjust, under Liked` : `Not for me (${count})`);
}
// a short name for a like: what's on screen (the world and the lead), or the preset's
function nameOf(d){
  if (!J.on) return S.active.name || 'Liked';
  const bits = [d.world && d.world !== 'none' ? (byKey[d.world] || {}).label : null, d.lead ? (byKey[d.lead] || {}).label : null, d.centre ? (byKey[d.centre] || {}).label : null];
  return bits.filter(Boolean).join(', ') || 'Liked';
}
async function save(m){
  if (db) { try { await db.collection('moments').add(m); return; } catch (e) {} }   // a refused write falls back to this browser
  m.id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); m.local = true;
  const a = local(); a.push(m); keepLocal(a); if (!db) show(a.filter(x => x.v > 0).reverse());
}
// the liked moments, live from the database (or this browser's): the gallery, and Journey's liked recipes
function watch(){
  try {
    db.collection('moments').where('v', '==', 1).orderBy('at', 'desc').limit(SHOWN).onSnapshot(snap => {
      show(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, () => show(local().filter(x => x.v > 0).reverse()));
  } catch (e) { show(local().filter(x => x.v > 0).reverse()); }
}
// a like from before looks were kept has its settings (as drawn, those not at 0) and its template's name, but not the
// whole stack or the movers: it comes back as those settings over the plain stack
const withLook = m => m.look ? m : m.settings ? {...m, name: m.name || [m.world && m.world !== 'none' ? (byKey[m.world] || {}).label : null, m.lead ? (byKey[m.lead] || {}).label : null].filter(Boolean).join(', ') || m.preset || 'Liked',
  look: {settings: m.settings, mods: {}, scene: null, sceneKey: m.scene && m.scene !== 'plain' ? m.scene : null, centre: m.centre || null}} : m;
function show(list){
  liked = list.map(withLook).filter(m => m.look).slice(0, SHOWN);
  LIKED.length = 0;
  for (const m of liked) LIKED.push({...lookOf(m), name: 'Liked: ' + (m.name || 'untitled'), liked: true, sceneKey: m.look.sceneKey || null, centre: m.look.centre || null});
  render();
}
// a like's look as a preset: its settings (a setting added since reads as off, or as it is now for the motion and colour)
function lookOf(m){
  const L = m.look, p = {name: m.name || 'Liked', mods: clone(L.mods || {}), tw: clone(L.tw || {})};
  for (const s of SPEC) p[s.k] = typeof L.settings[s.k] === 'number' ? L.settings[s.k] : PICTURE.includes(s.g) ? 0 : curP[s.k];
  if (L.scene) p.scene = clone(L.scene);
  return p;
}
// bring one back, by hand: Journey off, the look at once (not faded), ready to refine or to hand back to Journey
export function restore(m){
  if (J.on) setJourney(false);
  const p = lookOf(m); setPreset(p);
  for (const s of SPEC) curP[s.k] = p[s.k];
}
async function rename(m, name){
  name = name.trim().slice(0, 60); if (!name || name === m.name) return render();
  m.name = name;
  if (db && !m.local) { try { await db.collection('moments').doc(m.id).update({name}); } catch (e) { toast('Couldn’t rename it'); } }
  else { const a = local(), x = a.find(y => y.id === m.id); if (x) { x.name = name; keepLocal(a); } }
  show(liked);
}
async function remove(m){
  if (db && !m.local) { try { await db.collection('moments').doc(m.id).delete(); } catch (e) { toast('Couldn’t remove it'); return; } }
  else keepLocal(local().filter(y => y.id !== m.id));
  show(liked.filter(x => x !== m)); toast('Removed');
}
let confirmDel = null;
function render(){
  const el = $('#likedList'); if (!el) return;
  $('#likedNote').textContent = liked.length ? `${liked.length} liked. Tap one to bring it back; Journey favours them too.` : 'Nothing liked yet: 👍 (or +) keeps what’s on screen here.';
  el.replaceChildren(...liked.map(m => {
    const li = document.createElement('li'), b = document.createElement('button'), nm = document.createElement('span'), acts = document.createElement('span');
    b.className = 'lthumb'; b.title = 'Bring this back'; b.setAttribute('aria-label', `Bring back ${m.name || 'this'}`);
    if (m.thumb) { const img = document.createElement('img'); img.src = m.thumb; img.alt = ''; b.append(img); }
    b.onclick = () => { restore(m); toast(`Back to ${m.name || 'a liked look'}`); };
    nm.className = 'lname'; nm.textContent = m.name || 'untitled';
    const ren = document.createElement('button'), del = document.createElement('button');
    ren.textContent = '✎'; ren.setAttribute('aria-label', 'Rename'); del.textContent = confirmDel === m ? 'Remove?' : '✕'; del.setAttribute('aria-label', 'Remove');
    ren.onclick = () => {
      const inp = document.createElement('input'); inp.value = m.name || ''; inp.maxLength = 60; inp.setAttribute('aria-label', 'Name');
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = m.name || ''; inp.blur(); } };
      inp.onblur = () => rename(m, inp.value);
      nm.replaceWith(inp); inp.focus(); inp.select();
    };
    del.onclick = () => { if (confirmDel === m) { confirmDel = null; remove(m); } else { confirmDel = m; render(); setTimeout(() => { if (confirmDel === m) { confirmDel = null; render(); } }, 3000); } };   // twice to remove
    acts.className = 'acts'; acts.append(ren, del);
    li.append(b, nm, acts); return li;
  }));
}
if (!(window.claude && window.claude.use)) show(local().filter(x => x.v > 0).reverse());
else setTimeout(() => { if (!db) show(local().filter(x => x.v > 0).reverse()); }, 11000);   // (no database answered: this browser's)
render();
$('#likeBtn').onclick = () => rate(1);
$('#dislikeBtn').onclick = () => rate(-1);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '+' || e.key === '=') rate(1);
  else if (e.key === '-' || e.key === '_') rate(-1);
});
