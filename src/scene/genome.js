// The genome (a leaf module): one section's symmetry, motif, material and colour, which the pieces read while it's on, so they
// are conceived together rather than each choosing its own (the user's question, tested first in tools/genome/genome-lab.html;
// the phone page, src/lab/genome.js, drives it). geo: share the symmetry and motif; col: the material and one family of
// colours; line: each section's genome grown from the last. Read by the Prism (objects/jewel.js: its open forms' wedges, its
// surface), the Lattice (its sides), the Corridor (its frame), the rose window (its wedges) and main.js (the palette).
export const GEN = {on: false, geo: true, col: true, line: true, n: 6, motif: 0, mat: 1, hue: .72, id: 0};
export const MOTIFS = ['rose', 'pointed arch', 'hexagon', 'star'], MATS = ['stone', 'glass', 'neon', 'metal'];
let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
const pick = a => a[Math.floor(rnd()*a.length)];
export const randGenome = () => ({n: 4 + Math.floor(rnd()*7), motif: Math.floor(rnd()*4), mat: Math.floor(rnd()*4), hue: rnd()});
// a section's genome grown from the last: its symmetry a step or a doubling away, mostly the same motif and material, the
// colour moved on a little
export function child(g){
  const opts = [g.n - 1, g.n + 1, g.n*2, g.n % 2 ? g.n + 2 : g.n/2].filter(n => n >= 4 && n <= 12);
  return {n: pick(opts), motif: rnd() < .55 ? g.motif : (g.motif + 1) % 4, mat: rnd() < .6 ? g.mat : (g.mat + 1 + Math.floor(rnd()*3)) % 4, hue: (g.hue + .07 + rnd()*.1) % 1};
}
export function nextGenome(){ Object.assign(GEN, GEN.line ? child(GEN) : randGenome()); GEN.id++; }
// what each piece takes from it (null: the piece's own choice)
export const genN = (lo = 3, hi = 12) => GEN.on && GEN.geo ? Math.max(lo, Math.min(hi, GEN.n)) : null;
export const genMotif = () => GEN.on && GEN.geo ? GEN.motif : null;
export const genMat = () => GEN.on && GEN.col ? GEN.mat : null;
