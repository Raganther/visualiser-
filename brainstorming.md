# Afterglow — Brainstorming

> Exploratory ideas only. This document is a living brainstorm, not a committed implementation plan.

## Direction

Expand Afterglow from a music visualiser into a live audiovisual performance environment where DJ controls, live sampling, software instruments, AI musical decisions, and Journey can share the same understanding of the music.

## 1. Two-deck DJ system

Start with two decks, A and B.

Possible controls:
- Load/analyse track
- Waveform and structural markers
- Play / pause / cue
- Tempo / pitch
- Beat sync
- Quantised launch
- 1/2/4/8/16-beat loops
- Low / mid / high EQ
- Filter
- Channel volume
- Crossfader

Afterglow already analyses music ahead of playback. The DJ system could use that analysis for beat grids, bars, phrases, sections, breakdowns, drops, energy and other structural information.

## 2. Journey + DJ performance

Journey should understand more than the final master audio.

It could receive:
- Deck A musical state
- Deck B musical state
- Crossfader position
- EQ changes
- Filter movement
- Loop activation/release
- Cue/launch events
- Upcoming structural events
- Which deck is becoming dominant

This gives Journey advance knowledge of an intentional transition rather than forcing it to infer everything after hearing the mixed output.

Example: B enters without bass, an 8-beat loop is engaged, A's bass falls while B's rises, the loop releases eight bars before B's drop, and Journey builds a visual handover toward that known event.

## 3. Shared musical clock

A central performance clock could provide:
- BPM
- Beat
- Bar
- Phrase
- Quantisation boundaries
- Transport state

DJ decks, samplers, sequencers, synths, external software and Journey should all refer to this common musical timing model.

## 4. Live sampling

Possible live sampler:
- Capture previous/current 1, 2, 4 or 8 bars
- Automatically trim to Afterglow's beat grid
- Assign capture to a pad
- Loop immediately in sync
- Slice
- Retrigger
- Reverse
- Pitch
- Filter
- Apply effects

This could allow a DJ to capture part of Deck A, remove the original track, continue performing with the captured material, and introduce Deck B underneath.

## 5. Sample pads

An initial bank of perhaps eight pads could contain:
- Live captures
- Kicks
- Hats/percussion
- Vocal fragments
- Impacts
- Risers
- Textures

Triggers could be quantised to beat/bar boundaries.

## 6. Step sequencer

A simple 16-step sequencer could sequence samples and percussion while remaining locked to the shared clock.

## 7. Synths and software instruments

Rather than generating audio files in real time, an AI layer could compose and perform through software instruments.

Initial possibilities:
- Bass synth
- Atmospheric/pad synth
- Lead
- Arpeggiator
- Drum instruments

The system could send notes, velocity, duration and parameter automation to these instruments.

## 8. VST integration

Longer-term, Afterglow could potentially host VST instruments/effects through a native audio component.

A simpler experimental route may be to use an existing DAW as the instrument host first.

## 9. Ableton experiment

Ableton Live could act as the sound/instrument environment while Afterglow provides musical analysis, foresight and visual intelligence.

Example routing:
- MIDI 1 → drums
- MIDI 2 → hats/percussion
- MIDI 3 → bass VST
- MIDI 4 → chords/pads
- MIDI 5 → lead/arpeggiator
- Additional control → filters, effects, sends, mutes and automation

Ableton handles sound generation and VST hosting. Afterglow/Journey handles analysis and visuals. An AI performance layer makes bounded musical decisions and sends MIDI/control information.

## 10. AI-native performance layer

The AI does not necessarily need to "hear" raw audio directly.

Afterglow can transform audio into structured musical state such as:
- BPM
- Current beat/bar/phrase
- Energy
- Frequency-band activity
- Percussive activity
- Estimated instrumentation/features
- Current section
- Upcoming section
- Drop/breakdown likelihood and timing
- Deck states
- DJ actions

The AI receives this compact state plus information about the already-analysed future of the loaded tracks.

It can then make decisions such as:
- Add a sparse offbeat hi-hat next bar
- Remove hats next phrase
- Introduce a bass pattern in eight bars
- Hold a pad through the breakdown
- Open a synth filter over four bars
- Stop playing before the drop

The sequencer/audio engine executes those decisions sample-accurately or beat-accurately.

## 11. Fast decision AI / JEV-like architecture

Explore whether a fast decision model is useful for moment-to-moment performance.

Important distinction:
- **Analysis layer:** understands the audio and future track structure.
- **Decision layer:** chooses what musical action to take.
- **Performance layer:** executes MIDI, samples, synth notes and automation at exact musical times.
- **Journey:** uses the same performance state to coordinate visuals.

Do not commit to JEV or any particular model yet. Investigate latency, reliability, local vs API execution, structured outputs and whether conventional algorithms can handle some decisions better than an AI model.

## 12. Bounded AI musicianship

Avoid giving the AI unrestricted control.

Define a performance vocabulary including:
- Available instruments
- Allowed notes/scales
- Rhythmic vocabulary
- Density limits
- Parameter ranges
- Musical roles
- Transition rules
- When silence is preferable
- Quantisation
- Maximum rate of change

Possible user control:

**AI Amount:** Off → Assist → Collaborate → Co-performer

The goal is not an autopilot DJ. The human remains the performer while the AI behaves more like a responsive musical collaborator.

## 13. Journey + AI together

Journey and the musical AI should consume the same event/state stream.

If the AI introduces percussion, removes bass, begins an arpeggio or builds toward a known drop, Journey knows both what happened and why it was scheduled.

This could allow sound and visuals to feel intentionally composed together rather than independently reactive.

## Open questions

- Should Afterglow eventually host audio/VSTs itself, or remain connected to Ableton/another host?
- What should run locally versus through an API?
- How much track analysis is reliable enough for musical decision-making?
- How should the system identify kicks, hats, bass and melodic content?
- How far ahead should the AI plan: beats, bars, phrases, or entire sections?
- Should there be separate fast and slow AI layers?
- How much autonomy should the AI have?
- How should human actions override AI decisions?
- Could the AI learn a performer's musical preferences over time?
- Can Journey and the musical AI share a higher-level concept of tension, release and narrative?
