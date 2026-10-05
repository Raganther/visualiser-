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


## 14. Minimum viable experiment — prove the AI musician

Before building the full DJ system, test the smallest version of the central premise:

**Can an AI understand an existing track well enough to add a simple musical contribution in real time that feels intentional rather than random?**

### MVP scope

1. **One audio deck**
   - Load one techno track.
   - Reuse Afterglow's existing pre-analysis.
   - Expose BPM, beat grid, bars, energy and upcoming structural changes to the AI layer.

2. **One tiny built-in drum instrument**
   - Kick.
   - Closed hi-hat.
   - Open hi-hat.
   - Simple 16-step sequencer.
   - No attempt to build a full synthesizer yet.

3. **One constrained AI performer**
   - Start a pattern.
   - Change a pattern.
   - Stop a pattern.
   - Choose from a deliberately small rhythmic vocabulary.
   - Quantise all actions to musical boundaries.

4. **One controllable production effect**
   - Start with either a filter or delay.
   - Allow the AI to automate it over beats/bars.
   - This tests production decisions as well as note/rhythm decisions.

5. **Journey remains active**
   - Journey continues responding to the original track.
   - Journey also receives AI performance events so the experiment can test musical and visual coexistence.

### Example test

Load a techno track and press **AI Perform**.

The AI sees that the track is entering a sparse breakdown and that energy will rise toward an upcoming drop. It decides to introduce a restrained hi-hat pattern on the next bar, modifies that pattern as the build develops, gradually changes the selected effect, and deliberately stops before the drop.

### Success criterion

The first milestone is not feature count.

The experiment succeeds if listening to the result produces the impression:

> **"That felt like another musician understood what the track was doing."**

If the additions feel random, intrusive or mechanically reactive, improve the analysis/decision model before expanding the product.

### Explicitly outside MVP

Do not initially build:
- Deck B
- Crossfader
- Full DJ mixer
- Full synth engine
- VST hosting
- Ableton integration
- Stems
- Large sample library
- Complex live sampling
- Autonomous DJing

Those become later experiments once the AI-musician premise has been demonstrated.


## 15. DJ fundamentals to preserve

The DJ layer should support both traditional hands-on control and assisted control.

### Beat matching
- **Manual beat matching:** pitch/tempo adjustment, cue monitoring, waveform/beat-grid feedback and manual alignment.
- **Automatic Sync:** match BPM and align beat grids when the performer wants assistance.
- The goal is not to remove DJ technique; assistance should be optional.

### Phrase matching
Afterglow's pre-analysis creates the possibility of going beyond ordinary beat sync.

A future **phrase match** feature could help align the start of a 16- or 32-bar phrase in one deck with a musically appropriate phrase boundary in the other. This could use Afterglow's knowledge of sections, builds, breakdowns and drops.

This may become a distinctive Afterglow DJ feature: **beat match + phrase match + structural foresight**.

### Stems
Explore separating tracks into musical components such as:
- Drums
- Bass
- Vocals
- Other/melodic material

This could allow transitions such as retaining Track A's bass while introducing Track B's percussion, or removing A's drums before bringing B's drums in.

Stem information could also become useful input to Journey and the AI musician.

## 16. AI as producer, not only note generator

The AI performance layer should eventually be able to make **production decisions** as well as generate MIDI notes or rhythms.

Potential controls include:
- EQ
- Filters
- Compression
- Sidechain compression
- Reverb
- Delay
- Distortion
- Sends/returns
- Channel mutes
- Effect routing
- Parameter automation

Example: the AI adds its own bass synth and sidechains it to the kick detected in the source track. During a breakdown it reduces the pumping, increases reverb and changes filtering. As the drop approaches it builds delay/filter movement, then clears those effects and restores stronger sidechain at the drop.

This means the AI's playable instrument can eventually be the **whole production environment**, not merely a synthesizer.

## 17. AI-native principle — build the musician, not necessarily the instruments

The central AI-native idea does **not** require rebuilding every existing music tool.

Conceptually:

**Afterglow analysis = ears / musical perception**  
**AI performance layer = musician / producer / decision-maker**  
**Ableton, VSTs, DJ engines or Afterglow audio modules = instruments and production tools**  
**Journey = visual performer**

Existing software can remain conventional internally while becoming part of an AI-native system because the AI is operating it through a structured musical control layer.

The initial research question is therefore not:

> Can we rebuild Ableton or a complete DJ application?

It is:

> **Can we build an AI musician/producer that understands an unfolding track, looks ahead using Afterglow's analysis, and operates musical tools convincingly in real time?**

If that premise works, later versions can decide pragmatically which capabilities should remain external and which are worth implementing natively inside Afterglow.
