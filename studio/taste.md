# The user's taste in music

What the user likes and doesn't, from their flags in the loop labs, the jam and their notes in the listening room. Read it
before writing or changing a piece; add to it when they react.

## Sounds
- **Likes:** the round kick (no drive, dark: "Roundest", saved in the jam); the glass sequence bass (saved); clean, round
  and plucked basses (Berlin and Detroit figures, octave funk, the dotted walk); bells, natural and metallic sounds
  (kalimba, vibes, music box, steel drum, woodblocks, marimba); polyrhythms (metal in fives, steel in threes, toms in
  threes); short, percussive leads; the Slow Bloom hats, open and closed phasing in and out.
- **Dislikes:** plain sub, Reese, rubber, triplet and gritty basses; squelchy (driven) or aggressive (909) kicks; long held
  lead lines; cowbell-like percussion.

## Principles (from the notes on Copper Wire v1)
1. **Sounds always evolve.** No part keeps one tone for long: filters opening and closing, resonance, decay, LFOs
   speeding up, delay washes and reverb throws, "evolving like flowers". Lots of automation, especially on melodies and
   the bass.
2. **Pads move.** Pumping, pulsing, an LFO; never a static held chord.
3. **Suspended, unresolved harmony.** Sus chords and voicings that hang in the air and push forward; when the harmony
   moves (a breakdown), a simple progression that doesn't resolve. No basic pop progressions.
4. **Grow parts gradually.** A bass line or riff gains notes a few at a time instead of jumping from simple to busy.
5. **Melodies develop.** A motif can stay, but it goes somewhere: from one note to a phrase, rising, answered.
6. **Simple grooves are good.** They loved the intro's two-note bass: simple and in the pocket.

## Principles (from the notes on Tidal Clock, Glasshouse and Lantern v1)
7. **No clap or snare on the backbeat.** The clap on 2 and 4 is "really annoying" (noted four times). Percussion goes
   round the beats instead: toms, rims, shakers, off the downbeats.
8. **No held pad by default.** The same pad in every song was the most repeated complaint. Carry the harmony with a
   rhythmic chord: the gated 16th chord in Glasshouse ("transcending into a higher dimension, the openness") or stabs,
   moving under filters and LFOs; or leave the space and fill it with delays and reverb.
9. **Polyrhythms, varied.** Loved, but each motif should vary a little over time (a note moved, an octave flip, a step
   added) as well as its sound evolving.
10. **Avoid sweet colours.** A vibraphone over an A13 sounded cheesy; prefer floating, suspended or Lydian chords.

## Log
- 2026-10-19: the jam: saved only the round kick and the glass sequence; the four-chord progression may have put them off.
- 2026-10-20: notes on Copper Wire v1 → v2 (principles 1–6).
- 2026-10-20: notes on Tidal Clock, Glasshouse and Lantern v1 → v2s (principles 7–10). Liked: Tidal Clock's polyrhythm,
  bass and melody; Glasshouse's bass and gated chord; Lantern's bass.
- 2026-10-20: the native lab (`native-1`): native preferred for marimba, music box, steel drum, woodblocks, tubular bells,
  vibraphone, metal plate (the ping), plucked string and toms; native-only church bell, bell cloud and rain liked; the
  kalimba, glass bass and shaker kept as they were (native glass bass and shaker: no). The palette now plays the native
  ones (`synth()` in `lib/palette.js`). Tidal Clock: the user missed its pad when v2 took it out; it's back, moving (v3).
- 2026-10-20: Studio Jam pack 2: liked overall, but not its basses: "all kind of low sub and kind of unusable" (they sat at
  41–62 Hz, mostly sines). Basses need harmonics above the fundamental, and sit where the glass bass does. They want to
  mix and match sounds from every pack: the jam's sound picker now holds the whole library, with an octave button per column.
- 2026-10-20: Studio Jam ratings: 👎 Dark stab (pack 2's low-filtered dub chord).
- 2026-10-21: Studio Jam snapshots (pack 2, both on F minor add 9): the dub kick, tight native hats on "16ths with gaps",
  pack 1's hand drums, Dark FM on "Rolling threes", chords on "Stabs in fives" (gated chord, then the dark stab with an
  open voicing and an arp), the glass harmonica and the log drum. Pack 3 (minimal techno, every sound native) starts there.
- 2026-10-21: Studio Jam ratings: 👍 Wood and stone (twice), Skins and wood, Bloom pad; 👎 Ticks (twice). Snapshots 4 and 5
  (pack 3, fourths on E): round kick on four, seed hats on 16ths, Forest floor on the hand groove, Dark FM 2 on the
  seven-step line (in Snap 5 reshaped eight times: flipped, widened, narrowed, reversed), the stab in threes; in Snap 5
  the chords muted and the leads metal and marimba. The idea loop starts from these (round 1 in the `ideas` collection).
- 2026-10-21: Studio Jam: 👍 Snap 8 ("really like this") and Snap 9 ("no bass; I like this minimalism, natural sounds: what
  bass might work with this?": pack 3 on the A pedal, round kick on four, minimal hats on 16ths, Forest floor on the hand
  groove, bamboo drops and the marimba answer, the bass and strings muted). 👍 round 1's "The bass walks on" and "More on
  the bass, hats and perc". Asked for a player's randomness (hats left out, triplets, dynamics; the two melodies too) and
  more room to write riffs and longer clips: Play, Keep that, the riff tools and editing by hand. Round 2 answers Snap 9.
- 2026-10-22: Asked for the studio rethought from first principles, "intuitive and simplicity", the musical aspects as
  modules to mix and match. Studio Jam v2: each part a rhythm, notes, a sound and a space, the same verbs on each (New,
  Vary, Develop, tools, Undo, the library, 👍); Feel and Play folded into a rhythm's feel and the part's Life; the clip grid,
  variants and Follow gone (the first jam is kept as `jam-v1.html`).
- 2026-10-22: Snap 10 (after round 2): Snap 9 with the FM pluck bass (`b-fmpluck`) on the off-beat line from "A woody thump",
  developed to four bars, on D minor 7 ↔ 9, glue and a wider master: "a bass sound I particularly like". Asked for round 3:
  three whole songs in Snap 9's sounds, the bass coming in and out, each a different structure. Clearing (an arc with a
  hush), Two rivers (a rondo: the bass and the wood take turns), Undertow (the bass leads and leaves for a bass-less peak).
- 2026-10-22: On the songs: "now we're getting somewhere"; likes clicking into each part of a song and swapping sounds and
  riffs per layer. Asked to move to any part, like and comment each part, and see what they've changed from Claude's
  arrangement and revert it (their changes hadn't been kept: they only changed what was playing). Notes the same day:
  the 16th hats 👍 but "hi hat sound needs work, crisper richer tone", and to simulate a hat opening and closing, hit as
  it opens, like a real kit; Snap 8 👍 but "bus bass feels off".
- 2026-10-22: Asked to see the chords each part plays over (a 4-bar bass loop cycling over different chords): the card now
  shows the chords under the part, each time round its loop. The hats "fine, but thin, not rich and lush and dynamic":
  Soft hats rebuilt as a pair of cymbals (body under the sizzle, accents opening up, the open hat choked by the next);
  the first kept as "Soft hats (the first, thin)".
- 2026-10-22: Asked whether the songs could sound better: richer sounds or a better mix, "rich and full and spacious, full
  of body, while remaining clear". Measured Clearing as the jam plays it (each part's channel recorded): everything in
  150–500 Hz (the kick's tail, the bass, both mallets, the strings, the reverb and echo), 600 Hz–2.5 kHz 5–14 dB under a
  techno balance, the bass 12 dB under the kick in its own range with nothing above 1 kHz. Claude's mix
  (`studio/jam/mixeng.js`, on by default, A or the Mix button for the plain one): high-passes, the kick 50–70 Hz and the
  bass 80–160, the kick's and mallets' low-mid box cut, an exciter (even harmonics) on the bass, mallets and strings, the
  returns kept out of the low end and ducked a little by the kick. Same loudness, for a fair A/B.
- 2026-10-22: Claude's mix "clipping": the recordings had no overs (peaks .82), so it was the exciter: rectifying chords and
  ringing mallets makes intermodulation that sounds like distortion, and at .5 it doubled the bass's peaks. Now only on the
  bass, at .2; the mallets and strings get presence bells instead. The three songs exported as MP3s for listening.
- 2026-10-22: Still crackling, "like the buffer size": the exported MP3s were clean (no more clicks than the plain mix),
  so it was the page running out of time on the audio thread. Every eased setting (setTargetAtTime, never ending) kept its
  filter recomputing every sample for ever: the mix's chains tripled a part's cost, and the page's own EQ, tone filter and
  the master's width had it too. Now settings glide and stop, the duck is a ramp that ends, the tone filter's LFO is
  connected only while it moves, and Claude's mix is disconnected while off: the plain page renders ~40% faster than
  before, and with Claude's mix costs about what the plain page did.
- 2026-10-22: Asked to sing ideas into the jam, live, to jam with the parts. Sing it in (`studio/jam/sing.js`, 🎤 Sing on a
  part's card): the microphone on the next bar after a count-in while the jam plays (the part muted meanwhile), or a voice
  memo; a hummed or sung line becomes the part's rhythm and notes (snapped to the chord tones under each bar, moved by
  octaves into the part's register), a beatbox becomes a drum part's hits ("boom" low, "ka" between, "tss" high). Inside
  claude.ai the page isn't allowed the microphone, so there it's the voice memo.
- 2026-10-23: Comments on round 3's songs (each section): the hats harsh, "always open", wanting a smoother, traditional
  shimmer with dynamics and a drummer's variations (the hat fill into the next part in Two rivers 👍); a human player's
  syncopation and small variations in the riffs; no four-on-the-floor early, the motifs and percussion first, the
  percussion building subtly; the bass a short grooving motif (Clearing's off-beat one in "Back, changed" the favourite);
  the Hush's pad to pulse in quarter notes, its filter opening into the drop, a hat rhythm carrying the transition, the
  pad pumping on after it; Two rivers' bass, percussion and sparse melody 👍; Undertow's bass intro 👎, its Hands riff 👍,
  its alternating bass "might work but needs cohesion". Round 4 grows each song its own way: Smooth hats (dry: the echo
  and reverb sends were what made them sound open), a pulse motion and tone ramps across a section in the jam.
- 2026-10-23: Asked for a GarageBand-style DAW to comment on and edit the arrangements precisely: tracks down the left
  (level, pan, mute, solo), the arrangement to the right with the sections across the top, a chromatic piano roll with a
  velocity lane, looping any bars, moving, stretching, copying and splitting clips and notes, and a like or a note on any
  part of it. Version 1, the Studio DAW (`studio/arrange/`): each song written out once as notes as it plays (the chords
  resolved, Life and the feel fixed in place), your version kept, Claude's to hear, Revert; 👍 👎 💬 on the song, a
  section, a track, clips, a box of bars or notes, each saying exactly which (the `notes` collection; your edited songs
  in `versions`). On a phone: listening, looping a section and notes only.
- 2026-10-23: Asked to choose a track's sound from a side panel of every sound, by category, and to change the sounds
  with a front end for the synths while keeping Claude's native sound design. The DAW's sound panel: the library grouped
  by how each sound is made (struck, plucked, bowed, FM, analog circuits, pads, the poly synth, drum machines, modelled
  drums, nature), tried on the track's own notes before it's chosen; Edit puts the instrument's own settings on sliders
  (the physical models' physics, still computed note by note; each drum voice; the poly synth's panel), a change making
  your own copy, kept in the `sounds` collection for Claude to read and build on; "Ask Claude for a sound" in words.
- 2026-10-23: Asked for a front end for the synthesizers. The DAW's Instrument view (B, under the arrangement): the
  track's sound as a synth's panel, the same settings as the sound panel's Edit tab as rotary knobs in modules, one note
  of it drawn as it's actually made (the native model's computed note, or the poly synth rendered) as a waveform and a
  spectrum, the poly synth's filter curve and envelopes drawn as they turn, a keyboard to play it with the mouse or the
  computer's keys, pads for a kit. The poly synth and drum machines answer while a knob turns; a native model is
  computed again when it's let go.
- 2026-10-23: Asked what's truly native for Claude, and for synths computed from the ground up that respond to knobs in
  real time. The FM and the Resonator (marimba, bamboo, bells…) now run live in an AudioWorklet in the DAW: the same
  maths as before, sample by sample as they play, so knobs are heard in sounding notes and held keys hold notes. The FM
  gained Bend (held) and Bend fall (Bend alone only shapes the strike). Next, if it holds up: the other native engines,
  then the poly synth and the drum machine rebuilt as native.
- 2026-10-23: The poly synth rebuilt native first (the user's choice): the browser-built one's every setting and preset,
  computed sample by sample and played live, with an analog circuit's character: oscillators that start where they
  happen to be and drift (Drift), a ladder filter that saturates (Filter drive). Brightness matched setting for setting
  (the ladder's cutoff set higher, less as it resonates), level within ±2.5 dB on most library sounds; the sub basses
  2-4.5 dB quieter (the browser's filters had a bump at their fundamental). The songs use none of its sounds yet.
- 2026-10-23: "Complete all suggested work": every native engine now plays live in the DAW, and the drum machine is
  native. Each native instrument became a streaming voice, the computed-ahead note being the same voice run from start
  to end, so live and ahead are one piece of code (all 56 identical, the Resonator's own live voice within -40 dB).
  Knobs act on held notes for the analog voices, FM, pads, bowed bodies, sub and rumble. The drum machine (the 909, 808,
  Minimal, Industrial and Lo-fi kits) rebuilt sample by sample from the browser kit's own wiring: every voice within
  2 dB, 2 semitones of brightness and a fifth of the length. Changes to listen for: the bowed sounds' level is now set
  from their held power (long notes within 2 dB, short ones a little quieter, as the bow hasn't caught yet); the drum
  machine's hits no longer start with the browser's few milliseconds at 440 Hz.
- 2026-10-24: The user asked what full control of the engines makes possible, and for drums of our own, "richer,
  deeper, more of that big analog sound", not copies of the browser's. Built the analog drum machine (all thirteen
  voices, hats and toms included): pitch that sags with the ring, booming kick tails, wires driven by the shell, claps
  that breathe, six-square metal, a tape bus with glue and weight, every hit drifting a little, softer hits darker.
  Five kits (808, 909, Deep, Warm, Grit) in pack 4, live in the DAW. Measured: levels calibrated, the kicks' energy
  nearly all under 100 Hz, longer, fuller tails than the browser kits. To learn by listening: which kit, how much boom,
  tape and variation.
- 2026-10-24: The ducker that reads the score "doesn't really sound better": the user is wary of complexity that isn't
  needed. Mix the traditional way (channels, buses, sends, a master bus, the classic sidechain compressor keyed by the
  kick so the mix pumps and clears), but keep making the sounds and the processors natively. Not the score-reading
  ducker in a mix. Built the mix lab on round 4's Undertow to listen to that.
- 2026-10-25: Asked what of the new work was in the DAW (only the sounds were), the user chose to bring it all in: the
  DAW now mixes on the native desk (a strip a track, buses, returns, the kick's sidechain compressor, the master bus,
  a Mixer tab) and plays the analog synth (pack 5). They asked why native mixing helps: a real sidechain, the same
  sound on every browser and offline, processors the browser lacks, meters, one set of parts everywhere; the cost is
  CPU on a slow phone.

