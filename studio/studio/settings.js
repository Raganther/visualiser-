// The Studio's settings kept with your account: what the pages keep in this browser (the views, the panels, your mix
// changes, the jam's snapshots and library) copied into the database as one document (settings/local), so a new
// browser, or a new artifact the database was restored into, gets them back; and Export / Import of everything as a
// file, to carry it to another account without Claude
import { keepSettings, ownKeys, putKeys } from '../lib/settings.js';

const MINE = /^(studio\.|synthlab\.|drumlab\.|mixlab\.|racklab\.|ducklab\.)/, SONG = /^studio\.daw\.v1\./;   // (your song versions are in `versions`)
const COLS = ['feedback', 'snaps', 'likes', 'songs', 'ideas', 'versions', 'sounds', 'projects', 'takes', 'notes', 'jams', 'arrangements', 'library', 'settings'];
const keys = all => ownKeys(MINE, all ? null : SONG), put = putKeys;
const fresh = o => !Object.keys(o).some(k => k !== 'studio.view');

export async function startSettings({reload, flash}){ const db = await window.claude?.use?.('db').catch(() => null); if (!db) return null;
  await keepSettings(db, {match: MINE, skip: SONG, fresh, restored: () => { flash('Your settings, brought back from your account'); reload(); }});
  return db; }

// everything: the database's collections and this browser's settings (your song versions too), as one file
export async function exportAll(db){ const out = {studio: 1, at: new Date().toISOString(), local: keys(true), db: {}};
  if (db) for (const c of COLS) try { const q = await db.collection(c).get(); if (q.docs.length) out.db[c] = Object.fromEntries(q.docs.map(d => [d.id, d.data()])); } catch {}
  const data = JSON.stringify(out), name = `studio-backup-${out.at.slice(0, 10)}.json`;
  const dl = await window.claude?.use?.('downloads').catch(() => null);
  if (dl) { await dl.save({filename: name, data}); return name; }
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(new Blob([data], {type: 'application/json'})), download: name}); a.click(); return name; }
// a file made by Export: its settings into this browser, its documents into this artifact's database
export async function importAll(db, text){ const x = JSON.parse(text); if (!x.studio) throw new Error('not a Studio backup'); put(x.local || {}); let n = 0;
  if (db) for (const [c, docs] of Object.entries(x.db || {})) for (const [id, d] of Object.entries(docs)) { await db.collection(c).doc(id).set(d); n++; }
  return n; }
