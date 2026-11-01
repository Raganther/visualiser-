// Applies an edit kept in the DAW (its `edits` row, saved as JSON) to a song's session: the user's mix, mutes and solos,
// and the tracks they changed, as the session's next version (studio/sessions/<song>.json, the source of truth from then
// on). Then: node studio/render.mjs <song> --session studio/sessions/<song>.json. Usage: node studio/apply-edit.mjs edit.json
import fs from 'node:fs';
import path from 'node:path';
const e = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), E = e.data || e, f = path.join(path.dirname(new URL(import.meta.url).pathname), 'sessions', E.song);
const s = JSON.parse(fs.readFileSync(f, 'utf8')), byId = new Map(s.tracks.map(t => [t.id, t]));
s.mix = {...(s.mix || {}), ...(E.mix || {})};
for (const t of E.tracks || []) { const old = byId.get(t.id); if (old) Object.assign(old, t, {edited: undefined}); else s.tracks.push(t); }
const solo = new Set(E.solo || []);
for (const t of s.tracks) { t.mute = (E.mute || []).includes(t.id) || (solo.size > 0 && !solo.has(t.id)) || undefined; delete t.solo; }
s.meta = {...s.meta, version: s.meta.version + 1, words: `v${s.meta.version + 1}: your edit in the DAW${E.note ? ` (“${E.note}”)` : ''}. ` + (s.meta.words || '')};
fs.writeFileSync(f, JSON.stringify(s)); console.log(`${E.song}: v${s.meta.version}, ${(E.tracks || []).length} tracks edited, mix ${JSON.stringify(s.mix)}`);
