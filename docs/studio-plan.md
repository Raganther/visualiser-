# Afterglow Studio: an AI-native DAW (proof of concept)

The user asked to expand the sequencer and the synths into something Ableton-like, to see whether full, rich electronic music can be composed and mixed here: drum machines and synthesizers, a mixer with sidechain compression, parametric EQ, sends, a master stage, and a sequencer of clips and scenes. **AI-native** first: a song is plain data a model can write and read, and the same data plays live and renders offline. The visualiser stays as it is; joining the two (a visual sequencer) is for later, and the bridge for it is the note bus and the one clock that already exist.

This is the staged plan, with a log at the end.

## Principles

- **A song is data.** One JSON-able object: tempo, tracks (an instrument and its preset, clips, a mixer strip), returns, groups, the master, scenes, an arrangement, automation and modulators. `docs/studio-format.md` documents it for a model to compose in. Nothing about a song lives anywhere but in that object: a tweak in the page writes back into it, so what's heard can be copied out and read.
- **One graph, live and offline.** Every instrument and device takes an `AudioContext` or an `OfflineAudioContext`. `buildSong(ctx, song)` builds the graph; the scheduler walks the arrangement in sixteenths, and the same walk runs on the page's clock (live) or between an offline context's suspends (render). So a WAV rendered in headless Chromium is the song as played.
- **Measured, not guessed.** I can't hear. Every render is measured (loudness in LUFS, true peak, the spectrum's balance, the kick against the bass, how far the sidechain ducks, each stem's headroom) and the mixes are tuned on those numbers, against what's typical of techno.
- **Built on the audio core.** The Studio's instruments and devices are registry modules like the effects, in `src/audio/engine/`; the effects (delay, reverb, chorus, drive …) are reused as they are. The DJ panel, the groovebox and the play lab are untouched.
- **Out of the visuals' way.** No change to worlds, layers, objects, the renderers or Journey. The Studio is its own page (`studio.html`) and its own bundle.

## Where the code goes

```
studio.html, studio.css           the Studio page
src/studio/song.js                the format: note names, hit strings, clips, scenes, defaults, checks
src/studio/devices.js             the mixer's own devices: parametric EQ, compressor (parallel too), sidechain (by note or by audio), limiter
src/studio/desk.js                the mixer on any context: strips (chain, pan, volume, mute, solo, sends), groups, returns, master, meters
src/studio/engine.js              a song into a graph; the scheduler (sixteenths, swing, chance, slides, automation, modulators); live player; offline render
src/studio/wav.js                 WAV encoding
src/studio/measure.js             loudness (BS.1770), true peak, spectrum bands, ducking, stems
src/studio/songs/*.js             the songs
src/studio/ui.js                  the page: transport, session grid, arrangement, mixer, track detail, song data
src/audio/engine/inst/vkit.js     pieces the new instruments share: envelopes, buses, LFO shapes
src/audio/engine/inst/analog.js   the analog synth: unison, pulse width, driven filter, three envelopes, two LFOs, a modulation matrix
src/audio/engine/inst/fm.js       the FM synth: three operators, four algorithms, index envelopes
tools/studio-render.mjs           render songs to WAV in headless Chromium, with a report
tools/build-studio.mjs            dist/studio.html, self-contained
tests/studio.mjs                  the format, instruments, devices, scheduler and renders, measured
```

## Stages

1. **Instruments.** The analog synth (subtractive, unison, pulse width, sub and noise, a driven 12/24 dB filter with its own envelope, a mod envelope, two LFOs in six shapes, free or in time, and a matrix routing LFOs, envelope, velocity and key to cutoff, resonance, pitch, osc 2, pulse width, volume and pan), the FM synth (bells, metallic plucks, FM bass, e-piano), and the drum kit and polysynth as registry instruments. Presets a song can name. Rendered offline and measured.
2. **The mixer.** Strips of devices: a parametric EQ (high and low cut at 12, 24 or 48 dB, shelves, bells, notches), a compressor (threshold, ratio, knee, attack, release, make-up, parallel mix), a sidechain (ducking on another track's notes, sample-accurate, or following its audio), a limiter (drive, ceiling, a safety clipper), and every registry effect; sends to returns, groups, master, mute and solo, meters with gain reduction.
3. **The sequencer.** Clips (drum rows as strings, note lists with velocity, length, chance, slides), polymeter, swing, scenes launched on the bar, an arrangement of scenes, automation lanes (song-wide in bars, and clip envelopes in steps), LFO modulators on any parameter. Offline render to WAV, and the measuring tool.
4. **Compose and mix.** At least three songs of 32 bars or more with an arrangement, mixed and measured until the numbers are right: a minimal techno groove, a melodic progressive piece, a dub techno piece.
5. **Present.** The Studio page: play, launch scenes, see the tracks, clips, arrangement and mixer (meters, ducking), mute and solo, tweak, download WAVs, copy the song's data. Published as its own Artifact.

## Log
