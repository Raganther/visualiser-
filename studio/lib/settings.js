// A page's settings kept with your account: the localStorage keys it owns copied into its database (settings/local,
// putBig) whenever they change, and given back to a browser that has none (a new one, or a new artifact the database
// was restored into: the backup skill). Shared by the Studio's shell and the visualiser
import { putBig, getBig } from './bigdoc.js';

export const ownKeys = (match, skip) => { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (match.test(k) && !(skip && skip.test(k))) o[k] = localStorage.getItem(k); } } catch {} return o; };
export const putKeys = o => { try { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } catch {} };

// match/skip: which keys are the page's; fresh(keys): whether this browser has none of them yet; restored(): reload
export async function keepSettings(db, {match, skip, fresh, restored, every = 15000}){ if (!db) return;
  const col = db.collection('settings');
  try { const g = await getBig(col, 'local'); if (g) { const mine = ownKeys(match, skip); if (fresh(mine)) { putKeys(JSON.parse(g.str)); restored(); } } } catch {}
  let last = JSON.stringify(ownKeys(match, skip));
  const save = async () => { const now = JSON.stringify(ownKeys(match, skip)); if (now === last) return; last = now; try { await putBig(col, 'local', {at: new Date().toISOString()}, now); } catch {} };
  setInterval(save, every); addEventListener('pagehide', save); save(); }
