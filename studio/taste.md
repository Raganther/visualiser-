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
