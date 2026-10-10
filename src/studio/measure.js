// Measuring a mix (pure functions on sample arrays, for the page, the tests and the render tool): loudness to ITU BS.1770
// (integrated, short-term and momentary LUFS, loudness range), true peak (4× oversampled), the spectrum's balance in bands
// and its tilt, the stereo image (correlation, and the low end's width), and how far one stem ducks under another's hits.

// a biquad from the RBJ cookbook, run over x
function biquad(x, b0, b1, b2, a0, a1, a2){
  const y = new Float32Array(x.length); b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0*x[i] + b1*x1 + b2*x2 - a1*y1 - a2*y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
// K-weighting: the head's high shelf (+4 dB above ~1.7 kHz) and a high-pass at 38 Hz (BS.1770's, at any sample rate)
function kweight(x, sr){
  let w = 2*Math.PI*1681.974450955533/sr, A = Math.pow(10, 3.999843853973347/40), al = Math.sin(w)/(2*.7071752369554196), c = Math.cos(w), sA = 2*Math.sqrt(A)*al;
  const y = biquad(x, A*((A + 1) + (A - 1)*c + sA), -2*A*((A - 1) + (A + 1)*c), A*((A + 1) + (A - 1)*c - sA), (A + 1) - (A - 1)*c + sA, 2*((A - 1) - (A + 1)*c), (A + 1) - (A - 1)*c - sA);
  w = 2*Math.PI*38.13547087602444/sr; al = Math.sin(w)/(2*.5003270373238773); c = Math.cos(w);
  return biquad(y, (1 + c)/2, -(1 + c), (1 + c)/2, 1 + al, -2*c, 1 - al);
}
// loudness: integrated (gated), the loudest 3 s and 400 ms, and the loudness range (LRA)
export function loudness(L, R, sr){
  const kl = kweight(L, sr), kr = kweight(R || L, sr), blk = (len, hop) => { const z = []; for (let a = 0; a + len <= kl.length; a += hop) { let s = 0; for (let i = a; i < a + len; i++) s += kl[i]*kl[i] + kr[i]*kr[i]; z.push(s/len); } return z; };
  const lu = z => -.691 + 10*Math.log10(z + 1e-20), M = blk(Math.round(.4*sr), Math.round(.1*sr)), S3 = blk(3*sr, Math.round(.1*sr));
  const g1 = M.filter(z => lu(z) > -70), rel = lu(g1.reduce((a, b) => a + b, 0)/Math.max(1, g1.length)) - 10, g2 = g1.filter(z => lu(z) > rel);
  const I = lu(g2.reduce((a, b) => a + b, 0)/Math.max(1, g2.length));
  // the loudness range: the spread (10th to 95th percentile) of the short-term loudness, gated 20 LU under its mean
  const st = S3.map(lu).filter(v => v > -70), sm = lu(S3.filter(z => lu(z) > -70).reduce((a, b) => a + b, 0)/Math.max(1, st.length)), sg = st.filter(v => v > sm - 20).sort((a, b) => a - b);
  const pc = q => sg.length ? sg[Math.min(sg.length - 1, Math.floor(q*sg.length))] : -70;
  return {I, S: Math.max(-70, ...S3.map(lu)), M: Math.max(-70, ...M.map(lu)), LRA: pc(.95) - pc(.1), short: S3.map(lu)};
}
// the true peak: the waveform between the samples, found by 4× oversampling (a windowed sinc), in dBTP
export function truePeak(chs){
  const K = 8, taps = [];
  for (let ph = 1; ph < 4; ph++) { const t = []; for (let k = -K + 1; k <= K; k++) { const x = k - ph/4, w = .5 + .5*Math.cos(Math.PI*x/K); t.push(x === 0 ? 1 : Math.sin(Math.PI*x)/(Math.PI*x)*w); } taps.push(t); }
  let pk = 0;
  for (const x of chs) for (let i = K; i < x.length - K; i++) {
    const a = Math.abs(x[i]); if (a > pk) pk = a;
    if (Math.abs(x[i]) + Math.abs(x[i + 1]) < pk*1.2) continue;   // (only where it could top the peak so far)
    for (const t of taps) { let s = 0; for (let k = 0; k < 2*K; k++) s += t[k]*x[i - K + 1 + k]; if (Math.abs(s) > pk) pk = Math.abs(s); }
  }
  return 20*Math.log10(pk + 1e-12);
}
export function samplePeak(chs){ let pk = 0, clip = 0; for (const x of chs) for (const v of x) { const a = Math.abs(v); if (a > pk) pk = a; if (a >= .9999) clip++; } return {peak: 20*Math.log10(pk + 1e-12), clip}; }

/* ---------- the spectrum ---------- */
function fft(re, im){
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2*Math.PI/len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len/2; k++) { const p = i + k, q = p + len/2, tr = re[q]*cr - im[q]*ci, ti = re[q]*ci + im[q]*cr;
      re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = nr; } } }
}
// the average power spectrum (Hann, 8192 points, half overlapping), as power per bin
export function spectrum(x, N = 8192){
  const P = new Float64Array(N/2), w = Float32Array.from({length: N}, (_, i) => .5 - .5*Math.cos(2*Math.PI*i/N)); let frames = 0;
  for (let a = 0; a + N <= x.length; a += N/2) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[a + i]*w[i]; fft(re, im);
    for (let k = 0; k < N/2; k++) P[k] += re[k]*re[k] + im[k]*im[k]; frames++; }
  for (let k = 0; k < N/2; k++) P[k] /= Math.max(1, frames);
  return P;
}
export const BANDS = [['sub', 20, 60], ['bass', 60, 120], ['low-mid', 120, 300], ['mid', 300, 1000], ['high-mid', 1000, 3000], ['presence', 3000, 6000], ['high', 6000, 12000], ['air', 12000, 20000]];
// each band's share of the power (dB against the whole), and the tilt: dB an octave, fitted to third-octave levels 100 Hz–10 kHz
export function balance(P, sr, N = 8192){
  const df = sr/N, tot = P.reduce((a, b) => a + b, 0) || 1e-20, band = (a, b) => { let s = 0; for (let k = Math.ceil(a/df); k <= Math.min(P.length - 1, b/df); k++) s += P[k]; return s; };
  const bands = Object.fromEntries(BANDS.map(([n, a, b]) => [n, 10*Math.log10(band(a, b)/tot + 1e-20)]));
  const xs = [], ys = []; for (let f = 100; f <= 10000; f *= Math.pow(2, 1/3)) { const e = band(f/Math.pow(2, 1/6), f*Math.pow(2, 1/6)); if (e > 0) { xs.push(Math.log2(f)); ys.push(10*Math.log10(e)); } }
  const mx = xs.reduce((a, b) => a + b, 0)/xs.length, my = ys.reduce((a, b) => a + b, 0)/ys.length;
  const tilt = xs.reduce((a, x, i) => a + (x - mx)*(ys[i] - my), 0)/xs.reduce((a, x) => a + (x - mx)**2, 0);
  // third-octave levels 25 Hz–16 kHz (for drawing), dB against the whole
  const thirds = []; for (let f = 25; f <= 16000; f *= Math.pow(2, 1/3)) thirds.push([Math.round(f), 10*Math.log10(band(f/Math.pow(2, 1/6), f*Math.pow(2, 1/6))/tot + 1e-20)]);
  return {bands, tilt, thirds};
}
// the stereo image: correlation (1 mono, 0 unrelated, below 0 out of phase), the sides against the middle overall and below 150 Hz
export function stereo(L, R, sr){
  let lr = 0, ll = 0, rr = 0; for (let i = 0; i < L.length; i++) { lr += L[i]*R[i]; ll += L[i]*L[i]; rr += R[i]*R[i]; }
  const M = new Float32Array(L.length), S = new Float32Array(L.length); for (let i = 0; i < L.length; i++) { M[i] = (L[i] + R[i])/2; S[i] = (L[i] - R[i])/2; }
  const pm = spectrum(M), ps = spectrum(S), df = sr/8192, low = (p) => { let s = 0; for (let k = 1; k < 150/df; k++) s += p[k]; return s; };
  const sum = p => p.reduce((a, b) => a + b, 0);
  return {corr: lr/Math.sqrt(ll*rr + 1e-20), side: 10*Math.log10(sum(ps)/(sum(pm) + 1e-20) + 1e-20), lowSide: 10*Math.log10(low(ps)/(low(pm) + 1e-20) + 1e-20)};
}
// how far x ducks under hits at times ts: its level in the first `win` after each hit against its level just before the next (dB)
export function ducking(x, sr, ts, win = .04){
  const lv = (a, b) => { let s = 0, n = 0; for (let i = Math.max(0, Math.round(a*sr)); i < Math.min(x.length, Math.round(b*sr)); i++) { s += x[i]*x[i]; n++; } return s/Math.max(1, n); };
  let d = 0, c = 0; for (let i = 0; i < ts.length - 1; i++) { const gap = ts[i + 1] - ts[i]; if (gap < .2) continue; const a = lv(ts[i] + .005, ts[i] + win), b = lv(ts[i + 1] - win - .01, ts[i + 1] - .01); if (a > 0 && b > 0) { d += 10*Math.log10(b/a); c++; } }
  return c ? d/c : 0;
}
// a short summary of the master: what the tools print and the page shows
export function report(L, R, sr){
  const lu = loudness(L, R, sr), tp = truePeak([L, R]), sp = samplePeak([L, R]), M = new Float32Array(L.length); for (let i = 0; i < L.length; i++) M[i] = (L[i] + R[i])/2;
  const bal = balance(spectrum(M), sr), st = stereo(L, R, sr);
  return {lufs: lu.I, short: lu.S, momentary: lu.M, lra: lu.LRA, truePeak: tp, peak: sp.peak, clipped: sp.clip, plr: tp - lu.I, bands: bal.bands, tilt: bal.tilt, thirds: bal.thirds, ...st, shortTerm: lu.short};
}

// a picture of the sound on a canvas: a spectrogram on a log frequency scale (20 Hz–20 kHz, brighter louder), the
// waveform's level below it, and bar lines (every `bar` seconds) so the arrangement can be read off it
export function paint(cv, L, R, sr, {bar = 0, from = 0, to = L.length/sr} = {}){
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, Hs = Math.round(H*.78), N = 4096, w = Float32Array.from({length: N}, (_, i) => .5 - .5*Math.cos(2*Math.PI*i/N));
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const img = g.createImageData(W, Hs), a0 = Math.round(from*sr), a1 = Math.round(to*sr), fy = y => 20*Math.pow(1000, 1 - y/Hs), col = [];
  let top = -200;
  for (let x = 0; x < W; x++) {
    const a = Math.round(a0 + (a1 - a0 - N)*x/W), re = new Float64Array(N), im = new Float64Array(N), c = new Float32Array(Hs);
    for (let i = 0; i < N; i++) re[i] = ((L[a + i] || 0) + (R[a + i] || 0))*.5*w[i];
    fft(re, im);
    for (let y = 0; y < Hs; y++) { const k = Math.min(N/2 - 1, Math.round(fy(y)*N/sr)), k2 = Math.min(N/2 - 1, Math.round(fy(y + 1)*N/sr)); let p = 0;
      for (let j = Math.min(k, k2); j <= Math.max(k, k2); j++) p = Math.max(p, re[j]*re[j] + im[j]*im[j]);
      c[y] = 10*Math.log10(p + 1e-20); if (c[y] > top) top = c[y]; }
    col.push(c);
  }
  // (80 dB under the loudest point, black to purple to orange to white)
  for (let x = 0; x < W; x++) for (let y = 0; y < Hs; y++) { const d = Math.max(0, Math.min(1, (col[x][y] - top + 80)/80)), o = (y*W + x)*4;
    img.data[o] = 255*Math.min(1, d*1.5); img.data[o + 1] = 255*Math.max(0, Math.min(1, (d - .45)*1.8)); img.data[o + 2] = 255*Math.max(0, Math.min(1, .55 - Math.abs(d - .35)*2) + Math.max(0, d - .85)*5); img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#888'; g.font = '10px sans-serif'; for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { const y = Hs*(1 - Math.log(f/20)/Math.log(1000)); g.fillRect(0, y, 4, 1); g.fillText(f >= 1000 ? f/1000 + 'k' : f, 6, y + 3); }
  for (let x = 0; x < W; x++) { const a = Math.round(a0 + (a1 - a0)*x/W), b = Math.round(a0 + (a1 - a0)*(x + 1)/W); let pk = 0, s = 0; for (let i = a; i < b; i++) { const v = Math.max(Math.abs(L[i] || 0), Math.abs(R[i] || 0)); pk = Math.max(pk, v); s += v*v; }
    const hp = (H - Hs - 2)*pk, hr = (H - Hs - 2)*Math.sqrt(s/Math.max(1, b - a)); g.fillStyle = pk > .99 ? '#f33' : '#3a6'; g.fillRect(x, H - hp, 1, hp); g.fillStyle = '#7e9'; g.fillRect(x, H - hr, 1, hr); }
  if (bar) { g.fillStyle = 'rgba(255,255,255,.25)'; for (let t = Math.ceil(from/bar)*bar, k = Math.ceil(from/bar); t < to; t += bar, k++) { const x = (t - from)/(to - from)*W; g.fillRect(x, 0, 1, k % 4 ? 6 : H); } }
}
