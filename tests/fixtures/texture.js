// A synthetic minimal-techno track whose parts differ in texture, not loudness (like the user's compressed techno):
// 126 bpm, kick and bass throughout except a breakdown. 0-32 s kick and bass with a tonal stab chord; 32-64 s the
// hi-hats come in; 64-80 s a breakdown (no kick or bass, the hats and chord go on); 80 s the drop, with a noisy wash
// in the mids from then on; at 96 s the chord moves (other notes); 112 s on, the same loop unchanged. Stereo width
// narrow until 100 s, wide after. window.__part names the part, for the test.
window.__synth = function(t, freq, wave){
  const s = t/1000, P = 60/126, x = s/P, b = Math.floor(x), ph = (x - b)*P;
  const brk = s >= 64 && s < 80, hats = s >= 32, wash = s >= 80;
  const kick = brk ? 0 : Math.exp(-ph*25), bass = brk ? 0 : .8;
  const h8 = ((x*2) % 1)*P/2, hat = hats ? Math.exp(-h8*60) : 0;   // eighth-note hats
  const rnd = i => { const v = Math.sin(i*127.1 + Math.floor(s*60)*311.7)*43758.5453; return v - Math.floor(v); };
  const chord = s < 96 ? [35, 44, 52] : [39, 49, 58];   // bins of the chord's notes (about 750 Hz up); it moves at 96 s
  for (let i = 0; i < 2048; i++) wave[i] = 128 + Math.sin(i/2048*Math.PI*6 + s*2)*30*(.5 + kick*.6);
  for (let i = 0; i < 1024; i++) {
    let v = 40 + 8*rnd(i);                                         // a quiet floor
    if (i < 9) v += 150*bass + 60*kick;                            // kick and bass
    if (chord.some(c => Math.abs(i - c) < 1.5) || chord.some(c => Math.abs(i - 2*c) < 1.5)) v += 150;   // the chord's notes and their octaves
    if (wash && i >= 12 && i < 140) v = Math.max(v, 150 + 12*rnd(i + 7));   // a noisy wash in the mids: level across them, a little ragged
    if (i >= 233 && i < 650) v += 150*hat*(.5 + .5*rnd(i + 3));   // hats: noise up top, ticking
    freq[i] = Math.max(0, Math.min(255, v));
  }
  window.__width = s < 100 ? .04 : .35;
  window.__part = brk ? 'breakdown' : s < 32 ? 'intro' : s < 64 ? 'hats' : s < 96 ? 'drop' : s < 112 ? 'moved' : 'loop';
  return true;
};
