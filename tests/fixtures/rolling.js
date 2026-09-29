// A loud minimal-techno groove with a rolling bassline, like the user's "Mutant Pulse": 128 bpm, a kick on every beat, and
// a bass note every three sixteenths (so its notes fall between the kicks, louder in the low end than the kick itself),
// mastered past the analyser's -30 dB ceiling in the sub-bass. It gives the unclipped spectrum (decibels) as well as the
// bytes, as the page reads both from a real track. window.__trueBpm is the tempo.
window.__synth = function(t, freq, wave, db){
  const s = t/1000, P = 60/128, x = s/P, b = Math.floor(x), ph = (x - b)*P;
  const kick = Math.exp(-ph*20);
  const sx = s/(P*3/4), bn = Math.floor(sx), bph = (sx - bn)*P*3/4, note = Math.exp(-bph*9);   // a note every three sixteenths
  const rnd = i => { const v = Math.sin(i*127.1 + Math.floor(s*60)*311.7)*43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 2048; i++) wave[i] = 128 + Math.sin(i/2048*Math.PI*6 + s*2)*30*(.5 + kick*.6);
  for (let i = 0; i < 1024; i++) {
    let d = -95 + 6*rnd(i);                                        // a quiet floor, in dB
    if (i >= 1 && i < 4) d = Math.max(d, -40 + 22*kick);           // the kick: sub-bass, up to -18 dB
    if (i >= 3 && i < 8) d = Math.max(d, -45 + 30*note);           // the bass notes: 65-150 Hz, up to -15 dB
    if (i >= 1 && i < 30) d = Math.max(d, -60 + 18*kick);          // the kick's body and click, a little up the spectrum
    if (i >= 30 && i < 400) d = Math.max(d, -70 + 6*rnd(i + 5));   // the rest of the mix
    db[i] = d; freq[i] = Math.max(0, Math.min(255, Math.floor((d + 100)/70*255)));
  }
  window.__trueBpm = 128; window.__truth = ((Math.round(x) % 4) + 4) % 4; window.__truthErr = (x - Math.round(x))*P;
  return 'db';
};
