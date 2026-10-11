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

- `inst.type`: `drums`, `analog`, `moog`, `fm` or `poly` (the groovebox's synth). `preset` names one of the instrument's presets; `p` sets any knob over it (lists take their names: `{w1: 'Pulse', mode: 'Legato'}`).
- `drums` takes `kit` (`909`, `808`, `Minimal`, `Industrial`, `Lo-fi`) and `voices`: `{kick: {tune: -2, decay: .8, tone: .5, drive: .3, level: 1, pan: 0, x: .6}}` (`x` is each voice's character: the kick's punch, the snare's snap, the hats' metal).
- **A drum rack**: a drums track with `pads`, one a voice, each its own kit (`kit`, or the rack's), voice settings (`voice`), name, swing and mixer strip (`mix`: chain, sends, `to`). Each pad is a strip of its own, `drums:kick`, going into the rack's strip unless `to` says otherwise (a group: `to: 'bus'`). The rack's clips hold every pad's row; a sidechain listens to a pad with `src: 'drums:kick'`; a pad's path is `drums:kick.vol`, `drums:kick.eq.0.g`.

```js
{id: 'drums', inst: {type: 'drums', kit: '909'},
 pads: {kick: {voice: {tune: -2, decay: .8}, mix: {vol: -1, chain: [{type: 'eq', bands: [{type: 'hp', f: 28}]}]}},
        chh: {name: 'Closed hat', kit: 'Minimal', swing: .12, mix: {vol: -10, to: 'bus', sends: {verb: -24}}}},
 clips: {a: {bars: 2, hits: {kick: 'x...x...x...x...', chh: '..x...x...x...x.'}}}}
```

### Instruments and their knobs

- **analog** (`src/audio/engine/inst/analog.js`). Oscillators: `w1`, `w2` (Saw, Square, Pulse, Triangle, Sine), `semi`, `fine` (osc 2's pitch and detune), `mix2` (osc 2's level), `uni` (1–7 unison voices on osc 1), `det` (their detune, cents), `spread` (stereo), `pw` (pulse width), `sub`, `subw`, `subo`, `noise`, `drift`, `tune`. Filter: `ft` (Low, High, Band), `slope` (12 dB, 24 dB), `cut` (Hz), `res` (0–1), `drive`, `fenv` (envelope depth, −1–1 of six octaves), `track`, `fvel`, `fa fd fs fr`. Amp: `aa ad as ar`, `vel`. Mod envelope: `ma md ms mr`. LFOs: `l1`/`l2` (Sine, Triangle, Square, Saw up, Saw down, Random), `l1t`/`l2t` (Free, or a division: 1/16 … 4 bars), `l1r`/`l2r` (Hz, when free). Play: `mode` (Poly, Mono, Legato), `voices`, `glide`, `oct`. Output: `level`, `pan`.
  - `matrix: [[source, destination, amount], …]`: sources `lfo1`, `lfo2`, `menv`, `vel`, `key`; destinations `cut` (amount 1 = 4 octaves), `res`, `pitch` (1 = an octave), `p2`, `pw`, `amp`, `pan`, `mix2`, `fenv`.
  - Presets: Rolling bass, Sub bass, Reese, Acid, Pluck, Dub chord, Stab, Supersaw pad, Warm pad, Lead, Arp, Noise riser.
  - Automation and LFOs move `cut`, `res`, `fenv`, `pw`, `mix2`, `semi`, `fine`, `tune`, `level`, `pan` smoothly on held notes; other knobs apply from the next note.
- **moog** (`src/audio/engine/inst/moog.js`, an AudioWorklet voice at twice the sample rate). Oscillators: `w1 w2 w3` (Triangle, Saw, Square, Wide pulse, Narrow pulse), `o1 o2 o3` (range in semitones: −12 an octave down), `d2 d3` (detune, cents), `l1 l2 l3` (levels), `noise`, `drift`. Filter (a four-pole ladder): `cut`, `res` (emphasis; past 1 it rings), `drive` (the mixer pushed into it), `cenv` (contour amount, octaves), `kbd`, `vfilt`, `fa fd fs fr`. Loudness: `aa ad as ar`, `vamp`. Modulation: `glide`, `lshape` (Sine, Triangle), `lsync` (Free or a division), `lrate`, `vib` (cents), `lcut` (octaves). Output: `voices` (Mono, 2, 3, 4, 6), `ens` (ensemble chorus), `level`, `tune`. Mono is legato: a note held into the next (a slide) glides without striking the contours again. Every knob moves smoothly under automation. Presets: Fat bass, Taurus sub, Rubber bass, Lead, Brass, Velvet pad, Texture, Squelch.
- **fm** (`src/audio/engine/inst/fm.js`). `algo` (Stack 3→2→1, 2+3→1, 2→1 with 3 alone, 3→2 and 3→1), `r1 r2 r3` (ratios), `d2`, `i2 i3` (depths: modulation index), `fb` (op 3's level as a carrier), `ma`, `m2d m2s m3d m3s` (the depths' envelopes), `ivel`, `ikey`, `aa ad as ar`, `vel`, `cut`, `res`, `drive`, `l1 l1t l1r`, `mode`, `voices`, `glide`, `oct`, `tune`, `index` (all depths, smoothly automatable), `level`, `pan`. Matrix sources `lfo1`, `vel`, `key`; destinations `index`, `cut`, `pitch`, `amp`, `pan`. Presets: Bell, Metal pluck, Wood blip, E-piano, FM bass, Glass, Clang.
- **poly**: the groovebox's polysynth (`src/audio/engine/inst/poly.js`) and its presets.

## Clips

A clip loops for as long as its scene plays (from the scene's start). Its length is `bars` (×16 sixteenths) or `steps`, or the length of its longest drum row; clips of different lengths drift against each other (polymeter).

**Drum rows**, one character a sixteenth: `.` or `-` rest, `x` a hit, `X` an accent, `o` a soft hit, `1`–`9` a velocity in ninths, `?` a soft hit half the time, `r` a ratchet (two quick hits). Spaces and `|` are ignored, for reading. A row shorter than its clip goes round inside it, so rows of different lengths make polyrhythms (a 12-step hat, a 7-step shaker and a 5-step rim over a 16-step kick, in an 8-bar clip, meet again only at its top). The velocity digits are a row's dynamics: a hat's groove is `'x6x9|4x7x|3x8x'`.

```js
{hits: {kick: 'x...|x...|x...|x...', chh: 'x.x.|x.xx|x.x.|x.x?', ohh: '..x.|..x.|..x.|..x.'}}
{hits: {rim: {p: '..x..x....x..x..', prob: .8}}, steps: 12}     // a row with a chance; a 12-step clip
```

**Notes**: `[step, pitch, length, velocity, options]`; steps and lengths in sixteenths (fractions allowed: 2.5 is half a sixteenth late), pitch a MIDI number or a name (`'A1'`, `'F#3'`, C4 = 60), or a list of them (a chord); velocity 0–1; options `{p: .5}` (chance) and `{slide: true}` (held into the next note: a legato synth glides there, the 303's slide).

```js
{bars: 2, notes: [[0, 'A1', 1.5, .9], [3, 'A1', 1], [6, 'C2', 1, .7, {slide: true}], [8, ['A3', 'C4', 'E4'], 2, .6, {p: .5}]]}
```

**Clip envelopes**: `auto: {'<path inside the track>': [[step, value], …]}`, going round with the clip: `{auto: {'inst.cut': [[0, 300], [32, 1800]]}}`. A volume envelope is `{auto: {vol: [[0, -18], [64, -12]]}}` (dB; it moves the track's fader while the clip plays).

**In the page**, the step editor sets each drum row's length (polyrhythms), adds and clears rows, sets the clip's length, and draws the dynamics: a velocity lane under the steps (a drum row's, picked by its name; a groove shape from the menu: even, beats loud, offbeats loud, ghosts between, push and pull, rise, fall, breathing, human) and under the notes, and a clip's volume envelope.

Chance is rolled from the song's `seed`, the track, the clip and how many times round it is: the same song renders the same way every time.

## The mixer

Every track, group and return is a **strip**: its `chain` of devices in order, then `pan`, `vol` (dB), `mute`/`solo`, and post-fader `sends` (dB, to returns; `pre: true` on the strip sends before the fader). A strip goes `to` a group or the master.

Devices (`src/studio/devices.js`), each `{type, …settings}`, with an optional `id` to name it:
- `eq`: `bands: [{type, f, g, q, slope}]`. Types: `hp`/`lp` (cuts; `slope` 12, 24 or 48 dB), `ls`/`hs` (shelves, `g` dB), `bell` (`g`, `q`), `notch` (`q`).
- `comp`: `thr` (dB), `ratio`, `knee` (dB), `att`, `rel` (s), `gain` (make-up dB), `mix` (below 1: parallel compression). It adds a little make-up of its own as it compresses (as the browser's does: 0.6 of what it takes off a full-scale sound), and holds nothing back.
- `sc`, the sidechain: `src` (a track), `voice` (only its drum voice, say `kick`), `depth` (dB), `att`, `hold`, `rel` (s). It ducks on the source's notes, known ahead, so it lands on the kick's first sample. `mode: 'audio'` follows the source's sound instead, with `thr`, `ratio`, `range`.
- `limiter`: `gain` (dB in), `ceil` (dB, the most out; a soft clipper after a fast compressor), `rel`.
- `mseq`, the mid/side EQ: `bands` as the EQ's, each with `ch: 'mid'` or `'side'`, and `side` (dB, the sides' level). A side low cut keeps the bass mono; a side high shelf opens the air without touching the middle.
- `dyneq`, the dynamic EQ: `bands: [{type: 'bell' | 'ls' | 'hs', f, q, thr, range, ratio, g}]`. Each band listens to its own frequencies and moves only past its threshold (dB), by up to `range` dB (below 0 a cut, above a lift), by the ratio; `g` is a static gain; `speed` (s) for all. For low-mids that build up only when two parts play together.
- `multiband`: `lo`, `hi` (the crossovers, Hz), `bands: [{thr, ratio, gain, drive}]` low, mid, high (three of them; `drive` dB of saturation in that band before its compressor), `att`, `rel`, `knee`, `mix`. With every ratio 1 and no drive it sums back flat. Unlike `comp`, its compressors add no make-up of their own: `gain` is all there is.
- `transient`: `attack`, `sustain` (dB, ±12): the hit's front and its ring, whatever the level.
- `tape`: `drive` (dB), `bump` (dB at 70 Hz, the head bump), `hf` (Hz, the highs rolled off), `bias` (0–.5, the lopsided curve's warmth: even harmonics). `console`: `drive` (dB, an even curve: odd harmonics). Both keep quiet sounds at their level.
- `gain`: `db`. `mono`: `f` (sums the lows below f to mono).
- Every effect in the audio registry, its settings in `p`: `delay` (`div`: '1/16' … '4 bars', `fb`, `tone`, `ping`, `mix`), `reverb` (`kind`: Hall, Room, Plate; `size`, `damp`, `pre`, `low`, `mix`), `chorus`, `flanger`, `phaser`, `drive` (`kind`: Warm, Hard, Valve, Fold; `amt`, `tone`, `out`, `mix`), `crush`, `filter`, `width`, `autopan`, `pump`, and the groovebox's `eq` and `comp` (named `eq`/`comp` in the registry: inside a Studio chain those names mean the Studio's own, above).

A song can carry `ref`: a reference track's measurements (`name`, `lufs`, `truePeak`, `lra`, `tilt`, `side`, `lowSide`, `corr`, `bands`, `thirds`, `width`; the numbers only, not the audio), set by the page's Reference panel, so it comes back with the song and the mix can be compared with it.

On a return, set the effect's `mix` to 1 (the return is all effect; the dry sound is the track's own).

## Automation and modulation

A **path** names any parameter: `<track>.inst.<knob>` (a drum voice's: `<track>.inst.kick.tune`), or `<strip>.vol`, `<strip>.pan`, `<strip>.send.<return>`, `<strip>.<device>.<setting>` where the device is its `id`, its `type` (the first of it) or its place in the chain (`bass.eq.1.g` is the second band's gain of the bass's EQ).

- `auto: [{target, points: [[bar, value], …]}]`: straight lines between points, in bars from the start of the arrangement (fractions allowed), held before the first and after the last.
- `mods: [{target, shape, rate, depth, center}]`: an LFO (Sine, Triangle, Square, Saw up, Saw down, Random) at `rate` (Hz, or a division: '1/4', '1 bar', '4 bars') swinging `depth` either side of `center` (or of the lane's value, or the setting). In time with the song from its first bar.
- Smooth on the parameters that are audio parameters (volumes, pans, sends, EQ frequencies and gains, compressor threshold and make-up, the synths' shared knobs); stepped each sixteenth on the rest.

## Live

In the page a scene can be launched by hand (it starts on the next bar, and the session plays it round), or one track's clip; the arrangement plays the scenes in order. Notes go out on the audio core's note bus as they're scheduled (`src: 'studio'`), the bridge the visuals already listen to.

## The library: what the user makes

The page's **Library** (and the Play view) saves what the user makes: a clip (with its track's instrument and mixer, so it plays the same anywhere), a track, or a whole song. On the published page each is a document in the Artifact's database, collection `loops`: `{name, kind: 'clip' | 'track' | 'song', song, bpm, key, data, at}`, where `data` is `{track, clip}` (the clip's id inside `track.clips`), `{track}` or `{song}`, in this format. Claude reads them with ArtifactData (`list` on `loops`) to hear what the user made, and can write parts back the same way (a new document with `kind: 'clip'` or `'track'` appears in the user's library to add).

**Songs as the user left them.** Every edit to a song (notes, steps, knobs, the mixer, presets, a pasted song) is saved a second after it settles, in collection `songs`, a document a song: `{id, title, json, mine, at}`, where `json` is the song as JSON text in this format, `id` is a built-in song's title as a slug (`night-shift`) or `my-…` for one the user started (`mine: true`). The page opens a built-in song as saved, and the user's own as tabs; Revert to original deletes the document. Claude reads them with ArtifactData (`list` on `songs`) to see what the user changed; writing a document there changes the song the user opens next.

## The improviser

`src/studio/improv.js` makes parts in this format, for a model or the page's Jam panel to start from: `makeDrums({style, energy, expr, seed, part: 'drums' | 'hats' | 'perc', bars, base})` (a clip of drum rows; `base` keeps rows it doesn't make), `makeBass({style, energy, expr, seed, key, groove})` (a note clip off the kick; `groove` from `grooveOf(drumClip)`), `makeChords({…, bass})`, `makeHook({…})`, and `vary(clip, {seed, amount, key})` (the next variation). Styles: `minimal`, `driving`, `hypnotic`, `broken`, `dub`, `acid`; `energy` and `expr` 0–1; the same seed makes the same part.

## The jam's song

A jam (`src/studio/jam/song.js`) is a song in this format with six tracks (`drums`, `hats`, `perc`: drum racks; `bass`, `chords`, `hook`) whose clips are takes named `t1`, `t2`, … in the order they were made, one scene `jam` (what's playing), and its own state in `song.jam`: `{style, energy, expr, q (quantise in sixteenths, 0 as played), launch ('bar' | 'now'), recBars, click, seed, lanes: {<track>: {takes: [ids], take, mute}}, band: {on, lead, roles: {<track>: 'mine' | 'follow' | 'complement' | 'contrast' | 'answer' | 'free'}}, master: <mastering preset>, locks: {<track>: true (its level the user's)}}`. A take played or edited by hand carries `by: 'you'`; the band's carry `by: 'band'`. A clip may start part way in (`start`, sixteenths): its loop is `steps` long from there, the rest kept. A model can write a take into a lane by adding a clip and its id to `lanes.<track>.takes`.
