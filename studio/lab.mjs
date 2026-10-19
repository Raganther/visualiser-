// Renders a loop lab (studio/labs/<name>.js): the backing loop and every idea as its own stem, in time with it, each
// matched in loudness, wrapped seamlessly (what rings past the loop's end is folded back onto its start), all at one gain
// so any idea over the backing stays clear of clipping; AAC in MP4 (what the loop lab page's assets take), to
// studio/out/labs/<name>/. Usage: node studio/lab.mjs bass [--only roll16,acid]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), name = args.find(a => !a.startsWith('--')) || 'bass';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const SR = 44100, TAIL = 5, TARGET = -20;   // (each idea's loudness, dBFS RMS, before the shared gain)
const L = await import(path.join(ROOT, 'studio/labs', name + '.js')), M = L.meta;
const bar = 240/M.bpm, loopN = Math.round(M.bars*bar*SR), startN = Math.round(M.warm*bar*SR);
const out = path.join(ROOT, 'studio/out/labs', name); fs.mkdirSync(out, {recursive: true});
const ids = ['backing', ...L.IDEAS.map(i => i.id).filter(i => !only || only.includes(i))];

const {srv, url} = await serve(), browser = await launch('2d');
const render = async id => { const page = await browser.newPage(); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && console.log(id, m.text()));
  await page.goto(url + 'studio/');
  const b64 = await page.evaluate(async ({name, id, SR, TAIL, M}) => {
    let s = 4242; Math.random = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
    const {desk} = await import('/studio/lib/desk.js'), L = await import(`/studio/labs/${name}.js`), bar = 240/M.bpm;
    const ctx = new OfflineAudioContext(2, Math.ceil(((M.warm + M.bars)*bar + TAIL)*SR), SR);
    const d = desk(ctx, {bpm: M.bpm, swing: M.swing || 0, seed: M.seed || 1, raw: true}); d.variant = id === 'backing' ? null : id; L.score(d); d.finish();
    const buf = await d.render(), n = buf.length, x = new Float32Array(n*2); x.set(buf.getChannelData(0)); x.set(buf.getChannelData(1), n);
    const u = new Uint8Array(x.buffer); let str = ''; for (let j = 0; j < u.length; j += 32768) str += String.fromCharCode.apply(null, u.subarray(j, j + 32768)); return str;
  }, {name, id, SR, TAIL, M});
  await page.close(); const b = Buffer.from(b64, 'latin1'), f = new Float32Array(b.buffer, b.byteOffset, b.length/4), n = f.length/2;
  // the loop: bars warm..warm+bars, with everything after folded back onto its start
  const ch = [0, 1].map(c => { const y = new Float32Array(loopN), src = f.subarray(c*n, (c + 1)*n);
    for (let i = startN; i < n; i++) { const j = i - startN; y[j % loopN] += src[i]; } return y; });
  return ch; };
const t0 = Date.now(), res = {};
for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(async id => { res[id] = await render(id); console.log(`${id} ${((Date.now() - t0)/1000).toFixed(0)} s`); }));
await browser.close(); srv.close();

// matched loudness for the ideas, then one gain for everything: the loudest idea over the backing peaks at -1 dBFS
const rms = ch => Math.sqrt(ch.reduce((s, y) => s + y.reduce((a, v) => a + v*v, 0), 0)/(ch[0].length*2));
for (const id of ids.slice(1)) { const g = Math.pow(10, TARGET/20)/(rms(res[id]) || 1); for (const y of res[id]) for (let i = 0; i < y.length; i++) y[i] *= g; }
let pk = 0; const B = res.backing;
for (const id of ids.slice(1)) for (let c = 0; c < 2; c++) for (let i = 0; i < loopN; i++) pk = Math.max(pk, Math.abs(B[c][i] + res[id][c][i]));
for (let c = 0; c < 2; c++) for (let i = 0; i < loopN; i++) pk = Math.max(pk, Math.abs(B[c][i]));
const G = Math.pow(10, -1/20)/pk;
const files = {};
for (const id of ids) {
  const [l, r] = res[id], wav = Buffer.alloc(44 + loopN*4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + loopN*4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR*4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(loopN*4, 40);
  const q = v => Math.max(-32767, Math.min(32767, Math.round(v*G*32767)));
  for (let i = 0; i < loopN; i++) { wav.writeInt16LE(q(l[i]), 44 + i*4); wav.writeInt16LE(q(r[i]), 46 + i*4); }
  const W = path.join(out, id + '.wav'), P = path.join(out, id + '.mp4'); fs.writeFileSync(W, wav);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', W, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', P]);
  files[id] = P;
}
const lab = {title: M.title, part: M.part, over: M.over, bpm: M.bpm, bars: M.bars, loopSecs: +(loopN/SR).toFixed(4), gainDb: +(20*Math.log10(G)).toFixed(1),
  ideas: L.IDEAS.filter(i => ids.includes(i.id)).map(({id, name, words}) => ({id, name, words})), files};
fs.writeFileSync(path.join(out, 'lab.json'), JSON.stringify(lab, null, 1));
console.log(`${ids.length} loops of ${lab.loopSecs} s in ${((Date.now() - t0)/1000).toFixed(0)} s, shared gain ${lab.gainDb} dB → ${out}`);
