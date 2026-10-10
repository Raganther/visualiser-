# The Studio's song format

A song is one plain object (JSON, or a JS module exporting it as `default`). Everything about how it sounds is in it: the instruments and their settings, the clips, the scenes and arrangement, the mixer, automation and modulation. The Studio plays it live and renders it offline from the same data, and every tweak made in the page is written back into it, so the song as heard can always be copied out and read. This page is written for whoever composes in it, a person or a model.

`check(song)` in `src/studio/song.js` lists what's wrong in plain words (an unknown preset, a scene naming a clip that doesn't exist, a sidechain listening to a missing track). `tools/studio-render.mjs song.js --stems --png` renders it to WAV and measures it.

## The whole shape

```js
export default {
  title: 'Night Shift', bpm: 127, swing: .12, seed: 3,     // swing: how late the off sixteenths are, as a share of a sixteenth (0–.5)
  tracks: [ … ],                                           // each: an instrument, its clips, its mixer strip
  groups: [{id: 'drums', chain: [ … ], vol: 0}],           // busses tracks can go to ({to: 'drums'})
  returns: [{id: 'verb', chain: [{type: 'reverb', p: {mix: 1}}]}],   // fed by sends
  master: {chain: [ … ], vol: 0},
  scenes: [{id: 'intro', clips: {kick: 'four', hats: 'a'}}, …],      // which clip each track plays (missing: silent)
  arrange: [['intro', 8], ['groove', 16], …],              // scenes in order, for so many bars
  auto: [{target: 'bass.inst.cut', points: [[0, 200], [16, 900]]}],  // lanes in bars over the arrangement
  mods: [{target: 'chord.pan', shape: 'Sine', rate: '2 bars', depth: .4}],  // LFOs on any parameter
};
```

## Tracks

```js
{id: 'bass', name: 'Bass', inst: {type: 'analog', preset: 'Rolling bass', p: {cut: 300, res: .3}},
 clips: {a: { … }, b: { … }}, swing: .1,
 mix: {vol: -6, pan: 0, to: 'master', chain: [ … ], sends: {verb: -24, echo: -18}, mute: false, solo: false}}
```

- `inst.type`: `drums`, `analog`, `fm` or `poly` (the groovebox's synth). `preset` names one of the instrument's presets; `p` sets any knob over it (lists take their names: `{w1: 'Pulse', mode: 'Legato'}`).
- `drums` takes `kit` (`909`, `808`, `Minimal`, `Industrial`, `Lo-fi`) and `voices`: `{kick: {tune: -2, decay: .8, tone: .5, drive: .3, level: 1, pan: 0, x: .6}}` (`x` is each voice's character: the kick's punch, the snare's snap, the hats' metal).
- Each drum track is its own kit, so a kick on its own track gets its own strip (and can be a sidechain's source).

### Instruments and their knobs

- **analog** (`src/audio/engine/inst/analog.js`). Oscillators: `w1`, `w2` (Saw, Square, Pulse, Triangle, Sine), `semi`, `fine` (osc 2's pitch and detune), `mix2` (osc 2's level), `uni` (1–7 unison voices on osc 1), `det` (their detune, cents), `spread` (stereo), `pw` (pulse width), `sub`, `subw`, `subo`, `noise`, `drift`, `tune`. Filter: `ft` (Low, High, Band), `slope` (12 dB, 24 dB), `cut` (Hz), `res` (0–1), `drive`, `fenv` (envelope depth, −1–1 of six octaves), `track`, `fvel`, `fa fd fs fr`. Amp: `aa ad as ar`, `vel`. Mod envelope: `ma md ms mr`. LFOs: `l1`/`l2` (Sine, Triangle, Square, Saw up, Saw down, Random), `l1t`/`l2t` (Free, or a division: 1/16 … 4 bars), `l1r`/`l2r` (Hz, when free). Play: `mode` (Poly, Mono, Legato), `voices`, `glide`, `oct`. Output: `level`, `pan`.
  - `matrix: [[source, destination, amount], …]`: sources `lfo1`, `lfo2`, `menv`, `vel`, `key`; destinations `cut` (amount 1 = 4 octaves), `res`, `pitch` (1 = an octave), `p2`, `pw`, `amp`, `pan`, `mix2`, `fenv`.
  - Presets: Rolling bass, Sub bass, Reese, Acid, Pluck, Dub chord, Stab, Supersaw pad, Warm pad, Lead, Arp, Noise riser.
  - Automation and LFOs move `cut`, `res`, `fenv`, `pw`, `mix2`, `semi`, `fine`, `tune`, `level`, `pan` smoothly on held notes; other knobs apply from the next note.
- **fm** (`src/audio/engine/inst/fm.js`). `algo` (Stack 3→2→1, 2+3→1, 2→1 with 3 alone, 3→2 and 3→1), `r1 r2 r3` (ratios), `d2`, `i2 i3` (depths: modulation index), `fb` (op 3's level as a carrier), `ma`, `m2d m2s m3d m3s` (the depths' envelopes), `ivel`, `ikey`, `aa ad as ar`, `vel`, `cut`, `res`, `drive`, `l1 l1t l1r`, `mode`, `voices`, `glide`, `oct`, `tune`, `index` (all depths, smoothly automatable), `level`, `pan`. Matrix sources `lfo1`, `vel`, `key`; destinations `index`, `cut`, `pitch`, `amp`, `pan`. Presets: Bell, Metal pluck, Wood blip, E-piano, FM bass, Glass, Clang.
- **poly**: the groovebox's polysynth (`src/audio/engine/inst/poly.js`) and its presets.

## Clips

A clip loops for as long as its scene plays (from the scene's start). Its length is `bars` (×16 sixteenths) or `steps`, or the length of its longest drum row; clips of different lengths drift against each other (polymeter).

**Drum rows**, one character a sixteenth: `.` or `-` rest, `x` a hit, `X` an accent, `o` a soft hit, `1`–`9` a velocity in ninths, `?` a soft hit half the time, `r` a ratchet (two quick hits). Spaces and `|` are ignored, for reading.

```js
{hits: {kick: 'x...|x...|x...|x...', chh: 'x.x.|x.xx|x.x.|x.x?', ohh: '..x.|..x.|..x.|..x.'}}
{hits: {rim: {p: '..x..x....x..x..', prob: .8}}, steps: 12}     // a row with a chance; a 12-step clip
```

**Notes**: `[step, pitch, length, velocity, options]`; steps and lengths in sixteenths (fractions allowed: 2.5 is half a sixteenth late), pitch a MIDI number or a name (`'A1'`, `'F#3'`, C4 = 60), or a list of them (a chord); velocity 0–1; options `{p: .5}` (chance) and `{slide: true}` (held into the next note: a legato synth glides there, the 303's slide).

```js
{bars: 2, notes: [[0, 'A1', 1.5, .9], [3, 'A1', 1], [6, 'C2', 1, .7, {slide: true}], [8, ['A3', 'C4', 'E4'], 2, .6, {p: .5}]]}
```

**Clip envelopes**: `auto: {'<path inside the track>': [[step, value], …]}`, going round with the clip: `{auto: {'inst.cut': [[0, 300], [32, 1800]]}}`.

Chance is rolled from the song's `seed`, the track, the clip and how many times round it is: the same song renders the same way every time.

## The mixer

Every track, group and return is a **strip**: its `chain` of devices in order, then `pan`, `vol` (dB), `mute`/`solo`, and post-fader `sends` (dB, to returns; `pre: true` on the strip sends before the fader). A strip goes `to` a group or the master.

Devices (`src/studio/devices.js`), each `{type, …settings}`, with an optional `id` to name it:
- `eq`: `bands: [{type, f, g, q, slope}]`. Types: `hp`/`lp` (cuts; `slope` 12, 24 or 48 dB), `ls`/`hs` (shelves, `g` dB), `bell` (`g`, `q`), `notch` (`q`).
- `comp`: `thr` (dB), `ratio`, `knee` (dB), `att`, `rel` (s), `gain` (make-up dB), `mix` (below 1: parallel compression). The browser's compressor also adds a little make-up of its own as it compresses.
- `sc`, the sidechain: `src` (a track), `voice` (only its drum voice, say `kick`), `depth` (dB), `att`, `hold`, `rel` (s). It ducks on the source's notes, known ahead, so it lands on the kick's first sample. `mode: 'audio'` follows the source's sound instead, with `thr`, `ratio`, `range`.
- `limiter`: `gain` (dB in), `ceil` (dB, the most out; a soft clipper after a fast compressor), `rel`.
- `gain`: `db`. `mono`: `f` (sums the lows below f to mono).
- Every effect in the audio registry, its settings in `p`: `delay` (`div`: '1/16' … '4 bars', `fb`, `tone`, `ping`, `mix`), `reverb` (`kind`: Hall, Room, Plate; `size`, `damp`, `pre`, `low`, `mix`), `chorus`, `flanger`, `phaser`, `drive` (`kind`: Warm, Hard, Valve, Fold; `amt`, `tone`, `out`, `mix`), `crush`, `filter`, `width`, `autopan`, `pump`, and the groovebox's `eq` and `comp` (named `eq`/`comp` in the registry: inside a Studio chain those names mean the Studio's own, above).

On a return, set the effect's `mix` to 1 (the return is all effect; the dry sound is the track's own).

## Automation and modulation

A **path** names any parameter: `<track>.inst.<knob>` (a drum voice's: `<track>.inst.kick.tune`), or `<strip>.vol`, `<strip>.pan`, `<strip>.send.<return>`, `<strip>.<device>.<setting>` where the device is its `id`, its `type` (the first of it) or its place in the chain (`bass.eq.1.g` is the second band's gain of the bass's EQ).

- `auto: [{target, points: [[bar, value], …]}]`: straight lines between points, in bars from the start of the arrangement (fractions allowed), held before the first and after the last.
- `mods: [{target, shape, rate, depth, center}]`: an LFO (Sine, Triangle, Square, Saw up, Saw down, Random) at `rate` (Hz, or a division: '1/4', '1 bar', '4 bars') swinging `depth` either side of `center` (or of the lane's value, or the setting). In time with the song from its first bar.
- Smooth on the parameters that are audio parameters (volumes, pans, sends, EQ frequencies and gains, compressor threshold and make-up, the synths' shared knobs); stepped each sixteenth on the rest.

## Live

In the page a scene can be launched by hand (it starts on the next bar, and the session plays it round), or one track's clip; the arrangement plays the scenes in order. Notes go out on the audio core's note bus as they're scheduled (`src: 'studio'`), the bridge the visuals already listen to.
