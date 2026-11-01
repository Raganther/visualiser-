// A seeded random: the same numbers every render (a leaf module, so the desk and the native engine can both use it).
export function rng(seed = 1){ let s = seed >>> 0 || 1; return () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; }; }
