// A big piece of text kept in the artifact's database, for any page: the database refuses a document over 256 KiB, and a
// song with its Session grows past that. Over a limit it's gzipped (in base64), and if it's still too big, split across
// documents `<id>~1`, `<id>~2` … beside the first, which says how many. Read back whole, or null.
const LIMIT = 200000;   // characters a document holds, well under the cap
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const pipe = (data, T) => new Response(new Blob([data]).stream().pipeThrough(T)).arrayBuffer();
const gz = async str => typeof CompressionStream === 'undefined' ? null : b64(new Uint8Array(await pipe(str, new CompressionStream('gzip'))));
const gunzip = async s => new TextDecoder().decode(await pipe(unb64(s), new DecompressionStream('gzip')));
// col: a db collection; meta: small fields kept on the first document (a name, a time) for lists
export async function putBig(col, id, meta, str){ let key = 'json', s = str;
  if (str.length > LIMIT) { const z = await gz(str); if (z) { key = 'gz'; s = z; } }
  const n = Math.max(1, Math.ceil(s.length/LIMIT));
  // (the parts first, the first document last: it names them, so it's never ahead of them)
  for (let i = 1; i < n; i++) await col.doc(`${id}~${i}`).set({of: id, i, [key]: s.slice(i*LIMIT, (i + 1)*LIMIT)});
  await col.doc(id).set({...meta, [key]: s.slice(0, LIMIT), parts: n}); }
// {meta, str} or null (missing, or a part gone)
export async function getBig(col, id){ const d = await col.doc(id).get(); if (!d.exists) return null; const x = d.data(), key = x.gz != null ? 'gz' : 'json'; let s = x[key];
  if (s == null) return null;
  for (let i = 1; i < (x.parts || 1); i++) { const p = await col.doc(`${id}~${i}`).get(); if (!p.exists || p.data()[key] == null) return null; s += p.data()[key]; }
  return {meta: x, str: key === 'gz' ? await gunzip(s) : s}; }
