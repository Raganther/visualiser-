// Likes and dislikes: 👍 / 👎 (or + and -) record the moment, with what was on screen, the music and a thumbnail. On the published
// page they go to the Artifact's database (collection "moments"), where Claude reads them to learn the user's taste
// (docs/taste.md, the taste-review skill); elsewhere they're kept in this browser.
import { S } from '../state.js';
import { J } from '../journey/core.js';
import { eff } from '../presets.js';
import { toast } from './toast.js';
import { $ } from '../util.js';

const LOCAL = 'afterglow.moments', KEEP = 300;
let db = null, want = 0, count = 0;
// the Artifact's database, when this page is one and it's granted; never waited on
if (window.claude && window.claude.use) window.claude.use('db').then(d => { db = d; }).catch(() => {});
try { count = JSON.parse(localStorage.getItem(LOCAL) || '[]').length; } catch (e) {}

export function rate(v){ want = v; }   // taken at the end of the next drawn frame, when the canvas still holds it
// called by main.js after each frame is drawn
export function tasteFrame(){
  if (!want) return;
  const v = want; want = 0;
  let thumb = '';
  try { const c = document.createElement('canvas'); c.width = 160; c.height = 90; c.getContext('2d').drawImage($('#gl'), 0, 0, 160, 90); thumb = c.toDataURL('image/jpeg', .6); } catch (e) {}
  const d = window.__jdbg ? window.__jdbg() : {}, r3 = x => typeof x === 'number' ? +x.toFixed(3) : x;
  const m = {v, at: new Date().toISOString(), track: $('#track').textContent, pos: $('#tNow').textContent, onScreen: $('#onNow').textContent,
    journey: J.on, preset: J.on ? null : S.active.name, recipe: d.recipe || null, lead: d.lead || null, accent: d.accent || null, hit: d.hit || null,
    world: d.world || null, scene: d.scene || null, centre: d.centre || null, lens: d.lensOn && d.lens ? d.lens.n : 0,
    section: d.sec || null, pace: d.pace ? d.pace.name : null, tension: r3(d.T), bpm: d.grid && d.grid.bpm ? r3(d.grid.bpm) : null,
    settings: Object.fromEntries(Object.entries(eff).filter(([, x]) => typeof x === 'number' && x !== 0).map(([k, x]) => [k, r3(x)])), thumb};
  save(m);
  count++;
  toast(v > 0 ? `Liked (${count})` : `Not for me (${count})`);
}
async function save(m){
  if (db) { try { await db.collection('moments').add(m); return; } catch (e) {} }   // a refused write falls back to this browser
  try { const a = JSON.parse(localStorage.getItem(LOCAL) || '[]'); a.push(m); localStorage.setItem(LOCAL, JSON.stringify(a.slice(-KEEP))); } catch (e) {}
}
$('#likeBtn').onclick = () => rate(1);
$('#dislikeBtn').onclick = () => rate(-1);
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '+' || e.key === '=') rate(1);
  else if (e.key === '-' || e.key === '_') rate(-1);
});
