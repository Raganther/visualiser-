// Made-up voices for singing a part in (studio/jam/sing.js): a hummed phrase (a buzz with falling harmonics, a little
// vibrato and breath, twice through) and a beatbox (a low "boom", a noisy "tss", a "ka" between), at a tempo, after a
// little silence; and a mono WAV of either, for loading as a voice memo or feeding Chromium's fake microphone.
import fs from 'node:fs';
export const MEL = [[0, 57, 2], [2, 60, 2], [4, 64, 1], [5, 62, 1], [6, 60, 4], [12, 55, 3], [15, 57, 1]];
export const BOX = [[0, 'k'], [2, 'h'], [4, 's'], [6, 'h'], [8, 'k'], [10, 'h'], [12, 's'], [14, 'h']];
export function voices(bpm, lead = .3, sr = 44100){ const six = 60/bpm/4; let r = 1; const rnd = () => (r = (r*16807) % 2147483647)/2147483647;
  const sung = new Float32Array(Math.ceil((lead + 32*six + .5)*sr));
  for (const [s, m, l] of MEL) for (const rep of [0, 16]) { const t0 = lead + (s + rep)*six, dur = l*six*.9, f = 440*2**((m - 69)/12); let ph = 0;
    for (let i = Math.floor(t0*sr); i < (t0 + dur)*sr; i++) { const t = i/sr - t0, env = Math.min(1, t/.02)*Math.min(1, (dur - t)/.03), fv = f*(1 + .006*Math.sin(2*Math.PI*5.5*t));
      ph += 2*Math.PI*fv/sr; let v = 0; for (let h = 1; h < 12; h++) v += Math.sin(h*ph)/(h*h**.3); sung[i] += .2*env*v + .01*env*(rnd() - .5); } }
  const box = new Float32Array(Math.ceil((lead + 16*six + .5)*sr));
  for (const [s, k] of BOX) { const t0 = lead + s*six; let lp = 0;
    for (let i = Math.floor(t0*sr), j = 0; j < .15*sr; i++, j++) { const t = j/sr;
      if (k === 'k') box[i] += .6*Math.sin(2*Math.PI*(60 + 80*Math.exp(-t/.02))*t)*Math.exp(-t/.06);
      if (k === 'h') { const nz = rnd()*2 - 1; lp = .3*nz + .7*lp; box[i] += .25*(nz - lp)*Math.exp(-t/.03); }
      if (k === 's') { const nz = rnd()*2 - 1; lp = .5*nz + .5*lp; box[i] += .35*(lp*.7 + .3*Math.sin(2*Math.PI*900*t))*Math.exp(-t/.05); } } }
  return {sr, six, sung, box}; }
export function wav(path, x, sr){ const b = Buffer.alloc(44 + x.length*2); b.write('RIFF', 0); b.writeUInt32LE(36 + x.length*2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr*2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length*2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i]*32767))), 44 + 2*i); fs.writeFileSync(path, b); }
