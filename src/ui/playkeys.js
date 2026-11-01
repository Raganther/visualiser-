// The computer's keys as instruments (the synth's piano, the drum rack's pads): heard first, before the page's own
// single-letter keys (E, H, K, S, T … took notes from the synth), while an instrument has Keys on and its section shows.
// One instrument holds the keys at a time: switching one's Keys on lets the other's go.
const takers = [];
// fn(e, down) → true when the key is the instrument's (it's then kept from the page); release() when another takes the keys
export function takeKeys(name, fn, release){ takers.push({name, fn, release}); }
export function claimKeys(name){ for (const t of takers) if (t.name !== name) t.release?.(); }
addEventListener('keydown', e => { for (const t of takers) if (t.fn(e, true)) { e.preventDefault(); e.stopImmediatePropagation(); return; } }, true);
addEventListener('keyup', e => { for (const t of takers) if (t.fn(e, false)) { e.stopImmediatePropagation(); return; } }, true);
