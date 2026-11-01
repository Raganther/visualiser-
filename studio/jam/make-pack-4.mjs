// Pack 4, the analog drum machine (studio/lib/native/analogkit.js): each of its five kits as a kick, hats and a full kit
// (every voice, the packs' percussion pads among them), over pack 3's grooves. Usage: node studio/jam/make-pack-4.mjs
import fs from 'node:fs';
const here = new URL('packs/', import.meta.url).pathname, p3 = JSON.parse(fs.readFileSync(here + 'pack-3.json', 'utf8'));
const KITS = [['808', 'Analog 808', 'the 808 as its circuits behave'], ['909', 'Analog 909', 'the 909 as its circuits behave'], ['deep', 'Analog Deep', 'deep and round'], ['warm', 'Analog Warm', 'through warm tape'], ['grit', 'Analog Grit', 'driven hard']];
const sounds = [];
for (const [k, kit, how] of KITS) { const v = (voice, over) => ({kit, ...(voice ? {voice} : {}), ...(over ? {over} : {})});
  sounds.push({id: `k4-${k}`, role: 'kick', name: `${kit} kick`, words: `The analog drum machine’s kick, ${how}: a sine falling into its note, its tail booming on, a click on top.`, voices: {kick: v()}});
  sounds.push({id: `h4-${k}`, role: 'hats', name: `${kit} hats`, words: `The analog drum machine’s metal, ${how}: six clashing squares through resonant bands, the open hat closed by the next.`, voices: {chh: v(), ohh: v(), ride: v(), crash: v()}});
  sounds.push({id: `p4-${k}`, role: 'perc', name: `${kit} full kit`, words: `Every drum of the analog machine, ${how}: snare, clap, toms (and logs, the toms tuned down), rim, clave, cowbell, shaker, ride and crash.`,
    voices: {snare: v(), clap: v(), tomL: v(), tomH: v(), log: v('tomL', {tomL: {tune: -5, decay: .8}}), logH: v('tomH', {tomH: {tune: -3, decay: .8}}), wood: v('clave', {clave: {tune: -7}}),
      rim: v(), clave: v(), cow: v(), metal: v('cow'), shaker: v(), bowl: v('ride'), gong: v('crash'), crash: v(), ride: v()}}); }
const pick = {kick: 'k4-deep', hats: 'h4-808', perc: 'p4-808'};
const pack = {...p3, id: 'pack-4', name: 'Pack 4: the analog drum machine', words: 'The analog drum machine’s five kits (808, 909, Deep, Warm, Grit) on pack 3’s minimal techno; in the DAW they play live, here the browser’s nearest kit stands in.',
  sounds, columns: p3.columns.map(c => pick[c.role] ? {...c, sound: pick[c.role]} : c)};
fs.writeFileSync(here + 'pack-4.json', JSON.stringify(pack, null, 1));
console.log('pack-4:', sounds.length, 'sounds');
