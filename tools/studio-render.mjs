// Renders Studio songs offline in headless Chromium (the same graph as the page plays) to WAV, and measures each mix:
// loudness, true peak, the spectrum's balance and tilt, stereo, and with --stems each track alone through the master
// (its loudness and peak), how far the sidechained tracks duck under the kick, and how much the kick and bass overlap.
// Usage: node tools/studio-render.mjs [song.js …] [--out dir] [--stems] [--from bar] [--bars N] [--png] [--no-wav] [--json]
// (no songs: every song in src/studio/songs/; WAVs go to out/studio/, which git ignores)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, launch, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; }, flag = k => { const i = args.indexOf(k); if (i >= 0) args.splice(i, 1); return i >= 0; };
const out = path.resolve(opt('--out') || path.join(ROOT, 'out/studio')), bars = +opt('--bars') || 0, from = +opt('--from') || 0, stems = flag('--stems'), json = flag('--json'), noWav = flag('--no-wav'), png = flag('--png');
const files = args.length ? args : fs.readdirSync(path.join(ROOT, 'src/studio/songs')).filter(f => f.endsWith('.js') && f !== 'index.js').map(f => path.join(ROOT, 'src/studio/songs', f));
fs.mkdirSync(out, {recursive: true});
const {srv, url} = await serve();
const browser = await launch('2d');
const page = await browser.newPage();
page.on('pageerror', e => console.log('page error:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(url + 'studio.html').catch(() => {});

const f1 = (v, d = 1) => (v >= 0 ? ' ' : '') + v.toFixed(d);
for (const f of files) {
  const song = (await import(pathToFileURL(path.resolve(f)).href + '?' + Date.now())).default, name = path.basename(f, '.js');
  const t0 = Date.now();
  const r = await page.evaluate(async ({song, bars, from, stems, noWav, png}) => {
    const {renderSong} = await import('/src/studio/engine.js'), M = await import('/src/studio/measure.js'), {wav} = await import('/src/studio/wav.js'), {check} = await import('/src/studio/song.js');
    const problems = check(song); if (problems.length) return {problems};
    const notes = [], t0 = performance.now(), buf = await renderSong(song, {bars, from, onNote: e => notes.push(e)}), secs = (performance.now() - t0)/1000;
    const L = buf.getChannelData(0), R = buf.getChannelData(1), sr = buf.sampleRate, rep = M.report(L, R, sr); delete rep.shortTerm;
    const o = {secs, dur: buf.duration, rep, notes: notes.length};
    if (png) { const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 520; M.paint(cv, L, R, sr, {bar: 240/song.bpm}); o.png = cv.toDataURL('image/png').split(',')[1];
      const z = document.createElement('canvas'); z.width = 1400; z.height = 520; const b0 = 240/song.bpm*Math.min(16, Math.max(0, Math.floor((buf.duration/(240/song.bpm))/2) - 1)); M.paint(z, L, R, sr, {bar: 60/song.bpm, from: b0, to: b0 + 480/song.bpm}); o.zoom = z.toDataURL('image/png').split(',')[1]; }
    if (!noWav) { const b = wav(buf), a = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); o.wav = btoa(s); }
    if (stems) {
      o.stems = {};
      const kicks = notes.filter(e => e.track === 'kick').map(e => e.t);
      const low = x => { const y = new Float32Array(x.length), a = Math.exp(-2*Math.PI*120/sr); let s1 = 0, s2 = 0; for (let i = 0; i < x.length; i++) { s1 = a*s1 + (1 - a)*x[i]; s2 = a*s2 + (1 - a)*s1; y[i] = s2; } return y; };
      const env = x => { const w = Math.round(sr*.01), e = []; for (let a = 0; a + w <= x.length; a += w) { let s = 0; for (let i = a; i < a + w; i++) s += x[i]*x[i]; e.push(s/w); } return e; };
      let kLow = null;
      for (const t of song.tracks) {
        const b = await renderSong(song, {bars, from, solo: [t.id]}), l = b.getChannelData(0), rr = b.getChannelData(1), lu = M.loudness(l, rr, sr), pk = M.samplePeak([l, rr]);
        const mono = new Float32Array(l.length); for (let i = 0; i < l.length; i++) mono[i] = (l[i] + rr[i])/2;
        const s = {lufs: lu.I, peak: pk.peak};
        const sc = ((t.mix || {}).chain || []).find(d => d.type === 'sc');
        if (sc && kicks.length) s.duck = M.ducking(mono, sr, kicks);
        if (t.id === 'kick') kLow = env(low(mono));
        else if (kLow && /bass/.test(t.id)) { const e = env(low(mono)); let mn = 0, sb = 0; for (let i = 0; i < Math.min(e.length, kLow.length); i++) { mn += Math.min(e[i], kLow[i]); sb += e[i]; } s.overlap = mn/(sb + 1e-20); }
        o.stems[t.id] = s;
      }
    }
    return o;
  }, {song, bars, from, stems, noWav, png});
  if (r.problems) { console.log(`${name}: the song has problems:\n  ${r.problems.join('\n  ')}`); continue; }
  if (r.wav) fs.writeFileSync(path.join(out, name + '.wav'), Buffer.from(r.wav, 'base64'));
  if (r.png) { fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.png, 'base64')); fs.writeFileSync(path.join(out, name + '-zoom.png'), Buffer.from(r.zoom, 'base64')); delete r.png; delete r.zoom; }
  delete r.wav;
  if (json) { console.log(JSON.stringify({name, ...r}, null, 1)); continue; }
  const p = r.rep;
  console.log(`\n${song.title || name} (${name}): ${r.dur.toFixed(1)} s, ${r.notes} notes, rendered in ${r.secs.toFixed(1)} s (${((Date.now() - t0)/1000).toFixed(0)} s in all)`);
  console.log(`  loudness ${f1(p.lufs)} LUFS (short-term max ${f1(p.short)}, momentary max ${f1(p.momentary)}), range ${p.lra.toFixed(1)} LU`);
  console.log(`  true peak ${f1(p.truePeak)} dBTP, sample peak ${f1(p.peak)} dBFS, ${p.clipped} samples at full scale, peak to loudness ${p.plr.toFixed(1)} dB`);
  console.log(`  bands (dB of the whole): ${Object.entries(p.bands).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
  console.log(`  tilt ${p.tilt.toFixed(2)} dB/oct (100 Hz–10 kHz); stereo: correlation ${p.corr.toFixed(2)}, sides ${f1(p.side)} dB, below 150 Hz ${f1(p.lowSide)} dB`);
  if (r.stems) for (const [k, s] of Object.entries(r.stems)) console.log(`    ${k.padEnd(8)} ${f1(s.lufs)} LUFS alone, peak ${f1(s.peak)} dBFS${s.duck != null ? `, ducks ${s.duck.toFixed(1)} dB under the kick` : ''}${s.overlap != null ? `, low-end overlap with the kick ${(s.overlap*100).toFixed(0)}%` : ''}`);
}
await browser.close(); srv.close();
