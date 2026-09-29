// Glitch: the whole picture slices into bands that jump sideways, its colours splitting, for a few frames: on a drop always,
// and now and then on a downbeat. It draws nothing itself; the finish moves the finished picture (render/gl.js, canvas2d.js).
const G = {age: 9, seed: 0, drop: -1};
export default {
  key: 'glitch', kind: 'hit', label: 'Glitch', trigger: 'downbeat', level: .8,
  words: 'The picture glitches on the drops',
  // hard, intense, digital
  suits: (rf, wOn, seed) => (rf.noise || 0)*.6 + rf.busy*.3 + (rf.T || 0)*.3 - rf.perc*.2 + seed - (wOn ? .1 : 0),
  fire(){ if (Math.random() < .3) { G.age = 0; G.seed = Math.random()*100; } },   // (now and then on a downbeat)
  step(dt){ G.age += dt; },
  params(P, x){
    if (x.J.lastDrop !== G.drop) { if (G.drop !== -1 && x.eff.glitch > .02) { G.age = 0; G.seed = Math.random()*100; } G.drop = x.J.lastDrop; }   // always on a drop
    const a = G.age, on = a < .35 ? (a < .12 ? 1 : .5 + .5*Math.sin(a*90)) : 0;
    P.glitch = [x.eff.glitch*x.dim*on, G.seed + Math.floor(a*30)];   // how much, and which slicing (it changes every couple of frames)
  },
  glsl: {uniforms: '', functions: '', draw: ''},
  draw2d(){},
};
