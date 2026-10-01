// Comments: 💬 (or M) then a click on the part of the picture the comment is about, then what's to refine. Each keeps the
// point (a share of the screen across and down), the picture at that moment with the point marked, and the whole visual
// state (ui/taste.js momentOf: what's on screen, the music, every setting and the look, so it can be brought back). The user
// asked for this to show Claude what needs refining: on the published page they go to the Artifact's database (collection
// "comments"), where Claude reads them; elsewhere they're kept in this browser. The Adjust panel lists them.
import { restore, snapNext, tasteDb } from './taste.js';
import { keyMode } from './keys.js';
import { toast } from './toast.js';
import { $ } from '../util.js';

const LOCAL = 'afterglow.comments', KEEP = 100, SHOWN = 60, TW = 480, TH = 270;
let picking = false, pending = null, list = [], watching = false;
const local = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch (e) { return []; } };
const keepLocal = a => { try { localStorage.setItem(LOCAL, JSON.stringify(a.slice(-KEEP))); } catch (e) {} };
const db = () => tasteDb();

// step one: pick the point (the picture keeps moving; what's kept is the frame drawn as you click)
export function commentMode(on = !picking){
  if (pending) cancel();
  picking = on; $('#cmtPick').hidden = !on;
  if (on) toast('Click the part of the picture the comment is about (Esc cancels)');
}
$('#cmtPick').addEventListener('click', e => {
  const x = e.clientX/innerWidth, y = e.clientY/innerHeight;
  commentMode(false);
  snapNext(TW, TH, (c, state) => { pending = {x, y, c, state}; openBox(x, y); });
});
// step two: the comment, written beside a marker on the point
function openBox(x, y){
  const mk = $('#cmtMark'), box = $('#cmtBox'), ta = $('#cmtText');
  mk.style.left = x*100 + '%'; mk.style.top = y*100 + '%'; mk.hidden = false;
  box.hidden = false; ta.value = '';
  const bw = box.offsetWidth, bh = box.offsetHeight, px = x*innerWidth, py = y*innerHeight;   // beside the point, on screen
  box.style.left = Math.max(8, Math.min(innerWidth - bw - 8, px + (px + 24 + bw < innerWidth ? 24 : -24 - bw))) + 'px';
  box.style.top = Math.max(8, Math.min(innerHeight - bh - 8, py - bh/2)) + 'px';
  ta.focus();
}
function cancel(){ pending = null; $('#cmtBox').hidden = true; $('#cmtMark').hidden = true; }
async function send(){
  const text = $('#cmtText').value.trim(), p = pending;
  if (!p || !text) { if (!text) $('#cmtText').focus(); return; }
  cancel();
  let thumb = '';
  try {   // the picture with the point marked (a ring with a dark edge, readable on any picture)
    const g = p.c.getContext('2d'), X = p.x*TW, Y = p.y*TH;
    g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.arc(X, Y, 12, 0, 7); g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = '#ff3d6e'; g.beginPath(); g.arc(X, Y, 12, 0, 7); g.stroke();
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(X, Y, 2.5, 0, 7); g.fill();
    thumb = p.c.toDataURL('image/jpeg', .75);
  } catch (e) {}
  const rec = {at: new Date().toISOString(), text, x: +p.x.toFixed(4), y: +p.y.toFixed(4), screen: [innerWidth, innerHeight], thumb, state: p.state};
  const d = db();
  if (d) { try { await d.collection('comments').add(rec); toast('Comment saved: Claude can read it (Adjust lists them)'); watch(); return; } catch (e) {} }
  rec.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); rec.local = true;
  const a = local(); a.push(rec); keepLocal(a); show(a.slice().reverse());
  toast('Comment saved (in this browser; Adjust lists them)');
}
$('#cmtSave').onclick = send;
$('#cmtCancel').onclick = cancel;
$('#cmtText').addEventListener('keydown', e => {
  e.stopPropagation();   // (typing isn't a shortcut)
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  else if (e.key === 'Escape') cancel();
});
$('#cmtBtn').onclick = () => commentMode();
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && (picking || pending)) { commentMode(false); cancel(); return; }
  if (e.key.toLowerCase() === 'm' && !keyMode()) commentMode();   // (in a group M is that group's own)
});
// the list in the Adjust panel: newest first, live from the database (or this browser's)
function watch(){
  const d = db(); if (!d || watching) return;
  try {
    d.collection('comments').orderBy('at', 'desc').limit(SHOWN).onSnapshot(s => { watching = true; show(s.docs.map(x => ({id: x.id, ...x.data()}))); },
      () => show(local().reverse()));
  } catch (e) { show(local().reverse()); }
}
async function remove(c){
  const d = db();
  if (d && !c.local) { try { await d.collection('comments').doc(c.id).delete(); } catch (e) { toast('Couldn’t remove it'); return; } }
  else keepLocal(local().filter(y => y.id !== c.id));
  show(list.filter(x => x !== c)); toast('Comment removed');
}
function show(a){
  list = a.slice(0, SHOWN);
  const el = $('#cmtList'); if (!el) return;
  $('#cmtNote').textContent = list.length ? `${list.length} comment${list.length > 1 ? 's' : ''}. Tap a picture to bring that look back.` : 'No comments yet: 💬 (or M), click a part of the picture, and write what needs refining.';
  el.replaceChildren(...list.map(c => {
    const li = document.createElement('li'), b = document.createElement('button'), tx = document.createElement('span'), del = document.createElement('button');
    b.className = 'lthumb'; b.title = 'Bring this look back'; b.setAttribute('aria-label', 'Bring back the look this comment is about');
    if (c.thumb) { const img = document.createElement('img'); img.src = c.thumb; img.alt = ''; b.append(img); }
    b.onclick = () => { if (c.state && c.state.look) { restore(c.state); toast('Back to the look of that comment'); } };
    tx.className = 'ctext'; tx.textContent = c.text; tx.title = new Date(c.at).toLocaleString();
    del.textContent = '✕'; del.setAttribute('aria-label', 'Remove this comment'); del.onclick = () => remove(c);
    const acts = document.createElement('span'); acts.className = 'acts'; acts.append(del);
    li.append(b, tx, acts); return li;
  }));
}
show(local().reverse());
setTimeout(watch, 1500); setTimeout(watch, 5000);   // (the database arrives when the page is granted it)
