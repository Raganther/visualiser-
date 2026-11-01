// The live studio's worker: computes each native note off the main thread (the same engine the renders use), so turning a
// knob never stalls the beat. Asked {key, name, n, vel, o, sr}, it answers {key, L, R}.
import { NATIVE } from '../lib/native/index.js';
self.onmessage = e => { const {key, name, n, vel, o, sr} = e.data;
  try { const b = NATIVE[name].make(sr, n, vel, o); self.postMessage({key, L: b.L, R: b.R}, [b.L.buffer, b.R.buffer]); }
  catch (err) { self.postMessage({key, error: String(err)}); } };
