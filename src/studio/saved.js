// Songs as the user left them: every edit to a song (the built-in ones and their own) is kept, so it opens as they left it.
// On the published page in the Artifact's database (collection `songs`, a doc a song, which Claude can read); anywhere else,
// this browser's localStorage. A doc: {id, title, json (the song as JSON text), mine (a song the user started), at}.
const LS = 'afterglow.studio.songs';
let db = null, ready = null, docs = {};
const local = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } };
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(docs)); } catch (e) {} };

// the store, read once (a later snapshot is our own writes coming back)
export function start(){
  if (ready) return ready;
  return ready = (async () => {
    try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (db) { try { const s = await db.collection('songs').get(); docs = Object.fromEntries(s.docs.map(d => [d.id, {id: d.id, ...d.data()}])); return true; } catch (e) { db = null; } }
    docs = local(); return false;
  })();
}
export const where = () => db ? 'this page' : 'this browser';
// what's saved: each a {id, title, song, mine, at}
export const all = () => Object.values(docs).map(d => { try { return {...d, song: JSON.parse(d.json)}; } catch (e) { return null; } }).filter(Boolean);

// writes go one at a time a doc; a write asked for while one runs waits and sends only the latest
const busy = {}, next = {};
export async function put(id, song, mine){
  await start();
  const d = {id, title: song.title, json: JSON.stringify(song), mine: !!mine, at: new Date().toISOString()};
  docs[id] = d;
  if (!db) { keep(); return; }
  if (busy[id]) { next[id] = d; return busy[id]; }
  busy[id] = (async () => {
    let w = d;
    while (w) { next[id] = null; try { await db.collection('songs').doc(id).set(w); } catch (e) { busy[id] = null; throw e; } w = next[id]; }
    busy[id] = null;
  })();
  return busy[id];
}
export async function drop(id){
  await start();
  delete docs[id];
  if (db) await db.collection('songs').doc(id).delete(); else keep();
}
