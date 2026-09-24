// A synthetic techno groove with known structure, fed to the page in place of its built-in beat.
// 124 bpm, then 128 bpm from 70 s. Kick on every beat (about 1 in 10 dropped), clap on 2 and 4, crash on 1,
// and a breakdown with no kick from 40 to 48 s. window.__truth holds the true beat of the bar (0 = the 1).
window.__synth = function(t, freq, wave){
  const s = t/1000, T0 = 70, P1 = 60/124, P2 = 60/128, off = .3;
  const x = s < T0 ? (s - off)/P1 : (T0 - off)/P1 + (s - T0)/P2, P = s < T0 ? P1 : P2;
  const b = Math.floor(x), ph = (x - b)*P, bp = ((b % 4) + 4) % 4;
  const breakdown = s > 40 && s < 48, drop = ((b*7919) % 10) === 3;
  const kick = breakdown || drop ? 0 : Math.exp(-ph*25), clap = (bp === 1 || bp === 3) ? Math.exp(-ph*30) : 0, crash = bp === 0 ? Math.exp(-ph*6) : 0;
  for (let i = 0; i < 2048; i++) wave[i] = 128 + Math.sin(i/2048*Math.PI*6 + s*2)*30*(.5 + kick*.6);
  for (let i = 0; i < 1024; i++) freq[i] = Math.max(0, Math.min(255, 60 + (i < 9 ? 190*kick : 0) + (i >= 12 && i < 120 ? 150*clap : 0)
    + (i >= 200 && i < 500 ? 120*crash : 0) + 15*Math.sin(i*.3 + s*3)));
  const bn = Math.round(x); window.__truth = ((bn % 4) + 4) % 4; window.__truthErr = (x - bn)*P; window.__trueBpm = 60/P;
  return true;
};
