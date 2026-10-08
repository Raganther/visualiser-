# The instrument plan: synths, drums, effects and a sequencer the visuals sync to

The user asked to grow Afterglow from a visualiser into an instrument:
- a feature-rich electronic drum kit that sounds full and rich;
- a polysynth that can play basses and leads;
- standard effects (delay, reverb and the rest);
- a feature-rich sequencer;
- Journey syncing to the sequencer's notes.

All of this must happen without breaking the three ways it's used today: a track dropped into Journey, DJ mode, and the groovebox. It should be built from first principles, so new instruments, effects and ideas can be plugged in, taken out and experimented with.

This is the staged plan, with a log at the end.

## What must keep working

- **Journey with a track** dropped in or added to the playlist, exactly as today.
- **DJ mode:** the decks, the mixer, sync, tap and the master clock.
- **The groovebox**, until the new instruments replace it, and then its patterns carry over.
- **The proof:** `tests/golden.mjs` must match its recording exactly at every stage that isn't meant to change the visuals, and `tests/dj.mjs` and `tests/smoke.mjs` must pass.

## First principles: five kinds of thing

The visuals are already built this way: a registry of modules, each describing itself, and the engine builds the sliders, shaders and Journey's choices from those descriptions. The audio side should mirror that.

1. **The clock** (one transport). Exactly one master sets the tempo and where the beats and bars are.
   - **The sources:** a deck (its beat map), the internal clock (the tempo slider and taps, merged into one), and later external MIDI clock.
   - **Everyone schedules against it:** the sequencer, synced decks and the visuals' beat grid.
   - This already exists in `audio/dj.js` (`djMaster`, `TAP`). It moves into its own module.

2. **Events** (the common language: notes). Each is `{t, src, ch, note, vel, len, ...}`, in the shape of MIDI.
   - **Producers:** sequencer tracks, pads and the computer keyboard played live, and later MIDI in.
   - **Consumers:** instruments (which make the sound), the visuals, the recorder, and later MIDI out.
   - Every event is known before it sounds, because the sequencer schedules ahead. So the visuals can fire exactly when it's heard.

3. **Instruments.** One module each, describing itself:
   - `{key, label, params: [{key, label, min, max, def, unit}], presets, voices}`;
   - methods `play(ev, when)`, `stop(when)` and `connect(out)`.
   - The panel builds its controls from `params`, as the visual registry builds sliders.
   - **The first two:** the drum kit and the polysynth. Others (FM, a sampler, a granular pad) can be added later with one module and one registry line.

4. **Effects and the mixer.**
   - **Effects:** one module each, `{key, params, input, output}`.
   - **The mixer becomes general:** channels (each deck, each instrument), each with inserts (effects in its path), sends to shared effect busses (delay, reverb), EQ, pan, volume, mute and solo, all into the master (limiter), then the analyser.
   - The decks become two of its channels, sounding exactly as now.

5. **The visual bridge.** Note events reach the visuals through the signal bus (`scene/signals.js`), fired at the moment they're heard.
   - **A mapping table** (editable later): kick → the pulse and shockwave; snare or clap → a stab hit; hats → sparkles and fireflies; a synth note's pitch → hue or height; velocity → brightness; a chord → the mandala.
   - **Timing and content are separate.** Timing (beats and bars) comes from the one master. Content (what the visuals react to) comes from everything at once: note events, the mixed audio's analysis, and a track's read-ahead.

**Composable** means each of these plugs into the next through a small interface. A new instrument doesn't touch the sequencer, a new effect doesn't touch an instrument, and the visuals don't care whether a kick came from the drum kit, a deck or MIDI.

## Where the code goes

```
src/audio/engine/clock.js       the transport: master (deck, internal: tempo and taps, external), beat and bar at any time
src/audio/engine/events.js      the note-event bus: schedule, listen, the recent past (for the visuals and the recorder)
src/audio/engine/mixer.js       channels, inserts, sends, master and limiter (the decks and instruments plug in)
src/audio/engine/registry.js    every instrument and effect, listed once
src/audio/instruments/drums.js  the drum kit
src/audio/instruments/poly.js   the polysynth
src/audio/fx/*.js               one module per effect
src/audio/seq/*.js              the sequencer: patterns, tracks, the song, the scheduler
src/ui/inst/*.js                panels built from the modules' params (knobs from ui/widgets.js)
```

`audio/dj.js` keeps the decks; `audio/groove.js` stays until its features live in the new sequencer, then hands over its patterns.

## Stages

Each stage is its own pull request, with its own tests. The rule: existing tests pass unchanged unless the stage is meant to change something, and new modules get new tests.

### Stage 0: can the published page do MIDI and audio worklets? (an hour)

A tiny probe page, published as an artifact, which you open on your laptop in Chrome. It reports:
- whether Web MIDI is allowed, and lists your MIDI devices;
- whether AudioWorklet runs (custom sound code on the audio thread, for the best oscillators and filters);
- the audio output's latency;
- whether the page counts as a secure context.

**What the answer decides:**
- **Everything allowed:** stay on the claude.ai page.
- **MIDI blocked, worklets allowed:** nothing changes for the synths, drums, effects and sequencer, which don't need MIDI. MIDI gets a second home (below).
- **Worklets blocked too:** the instruments use the browser's built-in audio nodes only. They still sound rich (everything below works without worklets), just with fewer extras.

**A second home, if needed.** The same build hosted on **GitHub Pages**, from this repo: free, HTTPS, no sandbox, and Web MIDI works there. Or opened from a local file, or a small desktop app later (Electron or Tauri) if you ever want plug-in-level audio. No rewrite is needed in any case: it's the same single HTML file.

### Stage 1: the audio core, with no change you can hear or see

- Move the clock (master, tap) out of `dj.js` into `engine/clock.js`.
- Add the event bus and the instrument and effect registries.
- Turn the mixer into general channels, sends and a master, with the decks as two channels.
- Merge tap and the groovebox's tempo into one internal clock, as discussed.
- **Proof:** golden, dj and smoke pass unchanged.
- New `tests/audio-engine.mjs` checks the clock against all three sources, and that events reach their listeners on time.

### Stage 2: effects

Each one is a module, usable as an insert or on a send:
- **Delay:** tempo-synced (1/16 to 1 bar, dotted, triplet), ping-pong, a filter and drive in the feedback, freeze.
- **Reverb:** an algorithmic hall, room and plate. The impulse is generated, not loaded, so no files are needed. Size, decay, pre-delay, damping, width.
- **Chorus/ensemble, phaser, flanger:** modulated delays and all-pass stages, synced or free.
- **Drive:** a waveshaper with soft clip, tube and fold curves, oversampled, with tone and mix.
- **Compressor with sidechain:** the classic pumping, where the kick ducks the pads and bass.
- **Filter:** low-pass, high-pass and band-pass with resonance, an LFO or envelope follower, and DJ-style sweeps.
- **EQ:** three bands and a tilt.
- **Stereo width.**
- **Bitcrusher** (bits and sample rate), as a worklet where allowed.

**Tests:** each effect renders offline (an `OfflineAudioContext`, so the result is deterministic) and is measured: no clipping, no clicks, tails decaying, the delay echoes landing on the beat.

### Stage 3: the drum kit, made to sound full

The synthesis is designed carefully for each voice, not one oscillator and a noise burst:
- **Kick:**
  - a sine with a two-stage pitch envelope (a fast drop, then a slow glide to the note);
  - a click layer (a short high sine plus filtered noise);
  - a sub tail;
  - saturation, with its gain made up after.
  - **Controls:** tune, punch, decay, click, drive, and an 808 (long, boomy) or 909 (tight) character.
- **Snare:** two tuned body modes, plus noise through band-pass and high-pass with its own envelope. Snappy, tone, tune, decay.
- **Clap:** three or four noise bursts with a little spread in time, a band-pass, and a short room tail.
- **Hats** (closed, open, pedal): six square oscillators at the 808's metallic frequency ratios, band-passed and high-passed. The closed hat chokes the open one. Tone, decay.
- **Ride and crash:** the same metallic bank with longer, brighter envelopes, plus shimmer.
- **Three toms and a conga:** a pitch envelope and a body resonance.
- **Rim, cowbell** (two detuned squares through a band-pass), **shaker and percussion noise**, **clave.**
- **Every voice has:** level, pan, tune, decay, drive, a filter, sends to delay and reverb, velocity sensitivity, a little humanising (tiny timing and level variation), and choke groups.
- **Kits** (presets of every voice's settings): 909, 808, Minimal (dry and tight), Industrial (driven, crushed), Lo-fi.
- **Tests:** each voice is rendered offline and checked for no clipping, energy in the right bands (the kick's in the sub, the hats' above 6 kHz), and decay times as set.

### Stage 4: the polysynth

A **virtual analogue polysynth** with a supersaw. It covers sub and Reese basses, acid lines, leads, plucks, stabs and lush pads.

- **Voices:** 8 (up to 16 on a strong machine), the oldest stolen. Mono and legato modes with glide, for basses and leads.
- **Oscillators** (per voice):
  - two oscillators: saw, square, triangle, sine, and pulse with pulse-width modulation (built from two saws);
  - **supersaw unison:** up to 7 voices per oscillator, with detune and stereo spread;
  - a sub oscillator, noise, and oscillator 2's semitone and fine tune.
- **Filter:** 24 dB low-pass (two stages), plus high-pass and band-pass, with resonance, key tracking, its own envelope and velocity. Optional drive into the filter.
- **Envelopes:** ADSR for the amp and the filter, plus a third assignable one.
- **Two LFOs:** tempo-synced or free, aimed at pitch, filter, amp, pan or pulse width.
- **Arpeggiator:** up, down, up-down, random, 1–4 octaves, rate synced to the clock.
- **Chords:** play a chord from one note, minor, major, sus or 7th.
- **Built in:** a chorus, plus sends to delay and reverb.
- **Presets:** Sub bass, Reese, Acid, Supersaw lead, Pluck, Stab chord, Warm pad, Glass pad, Arp sequence.
- **Tests:** offline renders of chords and of voice stealing, with no clicks when voices are stolen, unison spreading the stereo, and the filter envelope opening.
- **Later, where worklets are allowed:** band-limited oscillators and a ladder filter model, for an even richer sound.

### Stage 5: the sequencer

A pattern sequencer with tracks:
- **Tracks:** a drum lane per voice, and a piano roll for the polysynth (chords, note lengths, velocity).
- **Patterns:** 1–64 steps per pattern, and per-track lengths for polymeter (a 12-step hat over a 16-step kick). Eight patterns per track, and a **song mode** that chains them.
- **Expression:**
  - swing, per track too;
  - micro-timing nudges per step;
  - velocity and accent lanes;
  - probability per step, and conditions ("every 2nd bar", "fill only");
  - ratchets (2–4 hits in a step);
  - **parameter locks:** any knob set per step, in the style of an Elektron.
- **Generating:** Euclidean rhythms, randomise within a scale, copy, paste and shift, a scale and key setting, and undo.
- **Playing live:** pads and the computer keyboard play the instruments, and recording quantises what you play into the pattern. Mute, solo and a fill button.
- **Saving:** patterns and kits are kept in the browser, exported and imported as files, and the groovebox's patterns carry over.
- **Timing:** it follows the master clock exactly as the groovebox does now (scheduled ahead, locked to a deck, the taps or its own tempo).
- **Tests:** steps land on the clock's 16ths in every master mode; polymeter, ratchets, probability (seeded) and song chaining behave as written.

### Stage 6: Journey syncs to the sequencer

- **Note events reach the visuals,** fired as they're heard, through the mapping table. Kick → the pulse, snare → a stab hit, and so on.
- **The sequencer as master:** its internal clock gives the beat grid its beats (as the taps do now).
- **Structure from your actions:**
  - a pattern change, a mute or a fill starts a section;
  - muting the kick is a breakdown, and bringing it back is the drop;
  - the next bar is known ahead, so Journey can build into a fill.
- **Opt-in, like the opt-in visuals:** Journey changes nothing unless the sequencer is playing, so golden is untouched.
- **The test you asked for:** play only the sequencer and see how it feels and looks against a track. Then tune the mapping from what you like (👍 / 👎).

### Stage 7: MIDI (once stage 0 says where it works)

- **MIDI in:** notes play the instruments, clock becomes the external master, and controller knobs are mapped by learning (move a knob, click a control).
- **MIDI out:** the sequencer's notes and the clock go to external synths and drum machines.

## How it stays composable as it grows

- **One module per instrument or effect,** describing itself, and one registry line. The panel, saving and the sequencer's tracks are built from that.
- **Small interfaces between the five kinds of thing.** None knows the insides of another.
- **New ideas start behind a lab switch** (`?lab=`) or as opt-in, like the opt-in visuals, so the default page is unchanged until you've tried them.
- **Every module gets an offline test** (`OfflineAudioContext`): deterministic, measurable, and fast enough for `npm test`.
- **The three existing ways in are tested at every stage:** golden, dj, smoke.

## Risks

- **CPU on your laptop.** The visuals already push it. Audio runs on its own thread, so a stalled frame can't glitch it, but too many voices and effects can overload the audio thread itself.
  - **Mitigations:** a voice budget, shared effect sends instead of an effect per voice, and the frame-rate readout showing the audio load.
- **Synthesis only, no samples,** which keeps the page small (it's 9.4 MB of the 16 MB limit). The trade-off is that real recorded drums would need samples, which could be added later as a sampler instrument.
- **The built-in filters are 12 dB per stage.** Two stages make 24 dB; a true ladder needs a worklet.
- **I can't hear.** I can measure each sound offline (levels, spectra, decay, clicks), but your ears decide. Each stage ends with a preview and presets to try, and I tune from what you say.

## Log

- **Stage 0.** The user has no MIDI controller, so the published claude.ai page stays home; MIDI (stage 7) waits until there's a device to try. The probe page (https://claude.ai/artifact/5E5bJVuMGc1oLiKWZbRJKN) is there for then.
- **Stage 1 done.** `audio/engine/`: `clock.js` (one master; the taps and the groovebox's own tempo are one internal clock), `events.js` (the note bus; the groovebox announces every note), `mixer.js` (a channel each for the decks and the groovebox), `registry.js`. No change heard or seen: golden matches in both renderers, dj passes, `tests/audio-engine.mjs` added.
- **Stage 2 done.** Thirteen effects, one module each in `audio/engine/fx/` (delay, reverb, chorus, flanger, phaser, drive, bitcrush, filter, EQ, compressor, sidechain, width, auto-pan), sharing `fx/kit.js`. The mixer gives every strip insert slots, level and pan, and the channels two sends (A an echo, B a reverb, returned into the mix); the master has inserts before the limiter. Tempo-synced times follow the master clock (a 40 ms tick); the sidechain ducks on the note bus's kicks or on the master's beats (so a deck pumps too). The DJ panel's **Effects** section builds its cards from each effect's description. Kept in `localStorage` (`afterglow.mix`). The bitcrusher reduces bits only: lowering the sample rate needs a worklet, left for when one is needed. `tests/effects.mjs` renders each effect offline and measures it.
- **Stage 3 done.** The kit (`audio/engine/inst/drums.js`): thirteen voices with tune, decay, tone, drive, level, pan and a character knob each, five kits, the groovebox's grid grown to all of them (a voice's name picks it to shape; M mutes). Measured offline (`tests/drums.mjs`): levels, how long each rings, where it sits in the spectrum, tuning, choke. One find: a filter after a saturation rings past full scale (the Industrial kit peaked at 1.4), so tone comes before drive. Velocity is two levels (a hit, an accent) until the sequencer's own velocities in stage 5.
- **Stage 4 done.** The polysynth (`audio/engine/inst/poly.js`): two oscillators or a seven-saw supersaw, sub, noise, a 24 dB filter with its own envelope and key tracking, amp envelope, velocity, an LFO (free or in time) on pitch, cutoff, volume or pan, glide, poly, mono and legato, chords, drive and chorus, eleven presets. Played live (`audio/keys.js`): an on-screen keyboard, the computer's keys, latch, an arpeggiator on the master's clock; the groovebox's bass line can play on it. Its own mixer channel. Finds: a mono note scheduled ahead didn't cut the one before (its release was already scheduled later): a voice let go sooner now takes back the later release; and voice stealing now counts scheduled notes too. PWM wasn't built (a pulse width needs a custom wave or a worklet; the square is fixed at half).
