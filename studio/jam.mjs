// Renders the jam (studio/labs/jam.js): every clip in every row alone, in time with the same 16-bar loop, each set to its
// row's place in a mix (the kick loudest, then the bass, the drums, the pad, the lead and the bells), wrapped seamlessly,
// one shared gain; AAC in MP4, to studio/out/jam/. Usage: node studio/jam.mjs [--only bass-berlin,kick-round~four]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, ROOT } from '../tests/lib.mjs';

const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const SR = 44100, TAIL = 5, LEVEL = {kick: -17, drums: -23, bass: -20, pad: -25, lead: -26, bells: -26};   // (each row's loudness, dBFS RMS, before the shared gain)
const J = await import(path.join(ROOT, 'studio/labs/jam.js')), M = J.meta;
const bar = 240/M.bpm, loopN = Math.round(M.bars*bar*SR), startN = Math.round(M.warm*bar*SR);
const out = path.join(ROOT, 'studio/out/jam'); fs.mkdirSync(out, {recursive: true});
const ids = J.STEMS.filter(i => !only || only.includes(i));

const {srv, url} = await serve(), browser = await launch('2d');
const render = async id => { const page = await browser.newPage(); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && console.log(id, m.text()));
  await page.goto(url + 'studio/');
  const b64 = await page.evaluate(async ({id, SR, TAIL, M}) => {
    let s = 4242; Math.random = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
    const {desk} = await import('/studio/lib/desk.js'), J = await import('/studio/labs/jam.js'), bar = 240/M.bpm;
    const ctx = new OfflineAudioContext(2, Math.ceil(((M.warm + M.bars)*bar + TAIL)*SR), SR);
    const d = desk(ctx, {bpm: M.bpm, swing: M.swing, seed: M.seed, raw: true}); d.variant = id; J.score(d); d.finish();
    const buf = await d.render(), n = buf.length, x = new Float32Array(n*2); x.set(buf.getChannelData(0)); x.set(buf.getChannelData(1), n);
    const u = new Uint8Array(x.buffer); let str = ''; for (let j = 0; j < u.length; j += 32768) str += String.fromCharCode.apply(null, u.subarray(j, j + 32768)); return str;
  }, {id, SR, TAIL, M});
  await page.close(); const b = Buffer.from(b64, 'latin1'), f = new Float32Array(b.buffer, b.byteOffset, b.length/4), n = f.length/2;
  return [0, 1].map(c => { const y = new Float32Array(loopN), src = f.subarray(c*n, (c + 1)*n); for (let i = startN; i < n; i++) y[(i - startN) % loopN] += src[i]; return y; }); };
const t0 = Date.now(), res = {};
for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(async id => { res[id] = await render(id); }));
console.log(`${ids.length} stems in ${((Date.now() - t0)/1000).toFixed(0)} s`);
await browser.close(); srv.close();

// each stem at its row's level; then one gain, set so the loudest stem of every row summed, at their worst, peaks near
// -1 dBFS less the headroom a real combination never uses up (the page's limiter catches the rest)
const rowOf = id => id.split('-')[0], rms = ch => Math.sqrt(ch.reduce((s, y) => s + y.reduce((a, v) => a + v*v, 0), 0)/(ch[0].length*2));
for (const id of ids) { const g = Math.pow(10, LEVEL[rowOf(id)]/20)/(rms(res[id]) || 1); for (const y of res[id]) for (let i = 0; i < y.length; i++) y[i] *= g; }
const env = new Float32Array(loopN);
for (const row of Object.keys(LEVEL)) { const e = new Float32Array(loopN); for (const id of ids.filter(i => rowOf(i) === row)) for (const y of res[id]) for (let i = 0; i < loopN; i++) e[i] = Math.max(e[i], Math.abs(y[i])); for (let i = 0; i < loopN; i++) env[i] += e[i]; }
let pk = 0; for (const v of env) pk = Math.max(pk, v);
const G = Math.min(4, Math.pow(10, -1/20)/pk*Math.pow(10, 5/20));
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
const jam = {title: M.title, bpm: M.bpm, bars: M.bars, chords: M.chords, loopSecs: +(loopN/SR).toFixed(4), gainDb: +(20*Math.log10(G)).toFixed(1), kickPats: Object.keys(J.KICK_PATS),
  rows: J.ROWS.map(r => ({key: r.key, label: r.label, note: r.note, clips: r.clips.map(({id, name, words, maybe, kick}) => ({id, name, words, maybe, kick}))})), files};
fs.writeFileSync(path.join(out, 'jam.json'), JSON.stringify(jam, null, 1));
console.log(`shared gain ${jam.gainDb} dB → ${out}`);
