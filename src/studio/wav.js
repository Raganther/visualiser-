// WAV files: an AudioBuffer (or channels) as 16- or 24-bit PCM, dithered, ready to download.
export function wav(chs, sr, bits = 16){
  if (chs.getChannelData) { sr = chs.sampleRate; chs = Array.from({length: chs.numberOfChannels}, (_, c) => chs.getChannelData(c)); }
  const nc = chs.length, n = chs[0].length, B = bits/8, buf = new ArrayBuffer(44 + n*nc*B), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n*nc*B, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr*nc*B, true); v.setUint16(32, nc*B, true); v.setUint16(34, bits, true); str(36, 'data'); v.setUint32(40, n*nc*B, true);
  const M = Math.pow(2, bits - 1) - 1; let o = 44, s = 1;
  // triangular dither, a least step's worth (the quiet tails fade into hiss, not steps)
  const r = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
    const x = Math.max(-M - 1, Math.min(M, Math.round(chs[c][i]*M + r() - r())));
    if (B === 2) v.setInt16(o, x, true); else { v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); }
    o += B;
  }
  return new Blob([buf], {type: 'audio/wav'});
}
