// The small helpers every page of the Studio uses (the jam, the DAW, the labs, the shell): an element by id, an element
// made, a deep copy, a clamp, a hash, things kept on this device. A leaf.
export const $ = id => document.getElementById(id);
// an element: attributes (on… a handler, false or null left out, true an empty attribute; aria- and data- booleans as
// words) and children (null and false left out, arrays flattened)
export const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a || {})) { if (n.startsWith('on')) e[n] = v; else if (n === 'class') { if (v != null && v !== false) e.className = v; } else if (/^(aria|data)-/.test(n) && typeof v === 'boolean') e.setAttribute(n, v); else if (v != null && v !== false) e.setAttribute(n, v === true ? '' : v); } e.append(...k.flat().filter(x => x != null && x !== false)); return e; };
export const clone = x => JSON.parse(JSON.stringify(x));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// FNV-1a over a string's UTF-16 units: a number (seeds), or in base 36 (ids, fingerprints)
export const fnv = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
export const hash36 = s => fnv(typeof s === 'string' ? s : JSON.stringify(s)).toString(36);
// kept on this device under a prefix (a private window or blocked storage just forgets)
export const store = pre => ({ load: (k, d) => { try { const v = localStorage.getItem(pre + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  keep: (k, v) => { try { localStorage.setItem(pre + k, JSON.stringify(v)); } catch {} } });
