// The Studio's library: loops, tracks and songs the user saves, to load again or to show Claude. On the published page they
// live in the Artifact's database (collection `loops`, which Claude can read and write back to); anywhere else, this browser's
// localStorage. An item: {name, kind: 'clip' | 'track' | 'song', song (the song it came from), bpm, key, data, at}.
const LS = 'afterglow.studio.loops';
let db = null, ready = null;
const subs = new Set();
let items = [];
const changed = () => subs.forEach(fn => fn(items));
const local = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(items)); } catch (e) {} };
const sortNew = a => a.sort((x, y) => String(y.at).localeCompare(String(x.at)));

// the store: the Artifact's database when the page is published with it, else this browser
export function start(){
  if (ready) return ready;
  return ready = (async () => {
    try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (db) {
      db.collection('loops').onSnapshot(s => { items = sortNew(s.docs.map(d => ({id: d.id, ...d.data()}))); changed(); }, () => { db = null; items = sortNew(local()); changed(); });
    } else { items = sortNew(local()); changed(); }
    return !!db;
  })();
}
export const where = () => db ? 'this page\'s library (Claude can read it)' : 'this browser';
export const onLibrary = fn => { subs.add(fn); fn(items); return () => subs.delete(fn); };
export const list = () => items;
export async function save(item){
  await start();
  const it = {...item, data: JSON.parse(JSON.stringify(item.data)), at: new Date().toISOString()};
  if (db) { const r = await db.collection('loops').add(it); return r.id; }
  it.id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); items = sortNew([it, ...items]); keep(); changed(); return it.id;
}
export async function remove(id){
  await start();
  if (db) return db.collection('loops').doc(id).delete();
  items = items.filter(x => x.id !== id); keep(); changed();
}
export async function rename(id, name){
  await start();
  if (db) return db.collection('loops').doc(id).update({name});
  const it = items.find(x => x.id === id); if (it) { it.name = name; keep(); changed(); }
}
