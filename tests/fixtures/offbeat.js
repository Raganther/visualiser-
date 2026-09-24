// A minimal-techno groove: the case a real track showed the beat grid failing on. 128 bpm; a kick with sub-bass on every
// beat and a click in the mids; a bass note on every off-beat and a 16th before each kick, about half the kick's strength
// in the low band and with no sub; an off-beat hi-hat; claps on 2 and 4. window.__truth holds the true beat of the bar.
window.__synth = function(t, freq, wave){
  const s = t/1000, P = 60/128, off = .3, x = (s - off)/P, b = Math.floor(x), ph = (x - b)*P, bp = ((b % 4) + 4) % 4;
  const since = at => ((x - b - at + 2) % 1)*P;                 // seconds since this point in the beat last passed
  const kick = Math.exp(-ph*25), bass = Math.max(Math.exp(-since(.5)*14), Math.exp(-since(.75)*14));
  const hat = Math.exp(-since(.5)*60), clap = (bp === 1 || bp === 3) ? Math.exp(-ph*30) : 0;
  for (let i = 0; i < 2048; i++) wave[i] = 128 + Math.sin(i/2048*Math.PI*6 + s*2)*30*(.5 + kick*.6);
  for (let i = 0; i < 1024; i++) {
    let v = 60 + 15*Math.sin(i*.3 + s*3);
    if (i < 2) v += 190*kick;                                    // sub: the kick alone
    else if (i < 9) v += Math.max(190*kick, 168*bass);           // the low end: kick and bass (the bass about half the kick, linearly)
    if (i >= 12 && i < 120) v += 150*clap + 50*kick;             // claps, and the kick's click
    if (i >= 200 && i < 500) v += 120*hat;
    freq[i] = Math.max(0, Math.min(255, v));
  }
  const bn = Math.round(x); window.__truth = ((bn % 4) + 4) % 4; window.__truthErr = (x - bn)*P; window.__trueBpm = 128;
  return true;
};
