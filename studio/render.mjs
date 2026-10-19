// Renders a score (studio/tracks/<name>.js) offline in headless Chromium, on the visualiser's own audio engine, to
// studio/out/<name>/: a WAV, an MP3, a spectrogram, and a report of how it measures section by section (loudness, width,
// low end, brightness, pumping). Usage: node studio/render.mjs 01-slow-bloom [--from 48 --to 64] [--mp3 192]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), name = args.find(a => !a.startsWith('--')) || '01-slow-bloom';
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? +args[i + 1] : null; };
const SR = 44100, from = opt('from'), to = opt('to'), kbps = opt('mp3') || 192;
const {meta, SECTIONS} = await import(path.join(ROOT, 'studio/tracks', name + '.js'));
const out = path.join(ROOT, 'studio/out', name); fs.mkdirSync(out, {recursive: true});
const tag = `v${meta.version}${from != null ? `-bars${from}-${to}` : ''}`;

const {srv, url} = await serve();
const browser = await launch('2d'), page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
page.on('pageerror', e => console.log('page error:', e.message));
await page.goto(url + 'studio/');
const t0 = Date.now();
const info = await page.evaluate(async ({name, SR, from, to}) => {
  // a seeded Math.random, so the kit's own variation is the same every render
  let s = 99991; Math.random = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
  const {desk} = await import('/studio/lib/desk.js'), T = await import(`/studio/tracks/${name}.js`), m = T.meta;
  const beat = 60/m.bpm, bars = to != null ? Math.min(m.bars, to) : m.bars, tail = 6, secs = bars*4*beat + tail;
  const a = from != null ? from*4*beat : 0, b = to != null ? Math.min(secs, to*4*beat + 2) : secs;
  const ctx = new OfflineAudioContext(2, Math.ceil(secs*SR), SR);
  const d = desk(ctx, {bpm: m.bpm, swing: m.swing || 0, seed: m.seed || 1}); T.score(d); d.finish();
  const buf = await d.render();
  const i0 = Math.floor(a*SR), i1 = Math.min(buf.length, Math.ceil(b*SR));
  window.__L = buf.getChannelData(0).slice(i0, i1); window.__R = buf.getChannelData(1).slice(i0, i1);
  return {frames: i1 - i0, secs, start: a, notes: d.notes.length, kicks: d.kicks.length, reads: d.reads};
}, {name, SR, from, to});
console.log(`rendered ${info.frames/SR | 0} s (${info.notes} notes) in ${((Date.now() - t0)/1000).toFixed(1)} s`);
// the channels back, in pieces
const take = async ch => { const parts = [], N = 1 << 20;
  for (let i = 0; i < info.frames; i += N) parts.push(Buffer.from(await page.evaluate(([ch, i, N]) => { const a = window[ch].subarray(i, i + N), u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let s = ''; for (let j = 0; j < u.length; j += 32768) s += String.fromCharCode.apply(null, u.subarray(j, j + 32768)); return btoa(s); }, [ch, i, N]), 'base64'));
  const b = Buffer.concat(parts); return new Float32Array(b.buffer, b.byteOffset, b.byteLength/4); };
const L = await take('__L'), R = await take('__R');
await browser.close(); srv.close();

// the level: peaks to -1 dBFS (the limiter has done the loudness)
let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
const g = pk > 0 ? Math.pow(10, -1/20)/pk : 1;
const wav = Buffer.alloc(44 + L.length*4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + L.length*4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR*4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(L.length*4, 40);
const q = v => Math.max(-32767, Math.min(32767, Math.round(v*g*32767 + (Math.random() - Math.random()))));
for (let i = 0; i < L.length; i++) { wav.writeInt16LE(q(L[i]), 44 + i*4); wav.writeInt16LE(q(R[i]), 46 + i*4); }
const W = path.join(out, tag + '.wav'), M = path.join(out, tag + '.mp3'), P = path.join(out, tag + '-spectrogram.png');
fs.writeFileSync(W, wav);
const ff = a => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], {stdio: ['ignore', 'pipe', 'pipe']});
ff(['-i', W, '-c:a', 'libopus', '-b:a', '160k', '-vn', M.replace(/\.mp3$/, '.webm')]);   // (for the listening page: its assets take WebM, not MP3)
ff(['-i', W, '-codec:a', 'libmp3lame', '-b:a', kbps + 'k', '-metadata', `title=${meta.title} (${tag})`, M]);
execFileSync('python3', [path.join(ROOT, 'studio/spectrogram.py'), W, P]);
// the integrated loudness
let lufs = null;
{ const r = (() => { try { return execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${W}" -af ebur128 -f null - 2>&1 | grep -A1 'Integrated' | tail -1`]).toString(); } catch { return ''; } })();
  const mm = r.match(/(-?\d+\.\d) LUFS/); lufs = mm ? +mm[1] : null; }

/* ---------- the report: each section measured ---------- */
const beat = 60/meta.bpm, dbs = v => v > 0 ? 20*Math.log10(v) : -120;
const onepole = (x, hz, high) => { const a = Math.exp(-2*Math.PI*hz/SR), y = new Float32Array(x.length); let s = 0; for (let i = 0; i < x.length; i++) { s = (1 - a)*x[i] + a*s; y[i] = high ? x[i] - s : s; } return y; };
const Mid = new Float32Array(L.length), Side = new Float32Array(L.length); for (let i = 0; i < L.length; i++) { Mid[i] = (L[i] + R[i])*.5*g; Side[i] = (L[i] - R[i])*.5*g; }
const low = onepole(onepole(Mid, 150), 150), high = onepole(onepole(Mid, 5000, true), 5000, true);
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i]*x[i]; return Math.sqrt(s/Math.max(1, b - a)); };
const sections = (SECTIONS || [['All', 0, meta.bars]]).map(([nm, a, b]) => {
  const i0 = Math.max(0, Math.round((a*4*beat - info.start)*SR)), i1 = Math.min(L.length, Math.round((b*4*beat - info.start)*SR)); if (i1 - i0 < SR) return null;
  const all = rms(Mid, i0, i1), side = rms(Side, i0, i1);
  // pumping: within each beat the loudest 20 ms against the quietest, over the whole band
  let pump = 0, n = 0; const w = Math.round(.02*SR), per = Math.round(beat*SR);
  for (let s = i0; s + per <= i1; s += per) { let mx = 0, mn = 1e9; for (let k = s; k + w <= s + per; k += w) { const r = rms(Mid, k, k + w); mx = Math.max(mx, r); mn = Math.min(mn, r); } if (mn > 1e-5) { pump += dbs(mx/mn); n++; } }
  return {section: nm, bars: `${a}-${b}`, at: `${Math.floor(a*4*beat/60)}:${String(Math.round(a*4*beat % 60)).padStart(2, '0')}`, rmsDb: +dbs(all).toFixed(1),
    width: +(side/(all || 1)).toFixed(2), lowShare: +(rms(low, i0, i1)/(all || 1)).toFixed(2), bright: +(rms(high, i0, i1)/(all || 1)).toFixed(3), pumpDb: n ? +(pump/n).toFixed(1) : 0};
}).filter(Boolean);
const report = {title: meta.title, tag, bpm: meta.bpm, secs: +(L.length/SR).toFixed(1), peakGainDb: +dbs(g).toFixed(1), lufs, files: {wav: W, mp3: M, spectrogram: P}, sections};
fs.writeFileSync(path.join(out, tag + '-report.json'), JSON.stringify(report, null, 1));
console.log(`${meta.title} ${tag}: ${report.secs} s, ${lufs} LUFS`);
console.table(sections);
// the parts: each bus's level (dB, before the master) and width in each section, from the meters read at each pause
const parts = {}, secs2 = SECTIONS || [['All', 0, meta.bars]];
for (const k of Object.keys(info.reads[0] || {}).filter(k => k !== 't')) {
  parts[k] = {}; for (const [nm, a, b] of secs2) { const rs = info.reads.filter(r => r.t >= a*4*beat && r.t < b*4*beat); if (!rs.length) continue;
    const m = rs.reduce((s, r) => s + r[k][0], 0)/rs.length, sd = rs.reduce((s, r) => s + r[k][1], 0)/rs.length;
    parts[k][nm] = m + sd > 1e-10 ? `${dbs(Math.sqrt(m + sd)).toFixed(0)} ${(Math.sqrt(sd/(m || 1e-12))).toFixed(2)}` : '·'; } }
report.parts = parts; fs.writeFileSync(path.join(out, tag + '-report.json'), JSON.stringify(report, null, 1));
console.log('each part: level in dB, then width (side over mid)'); console.table(parts);
console.log(M);
