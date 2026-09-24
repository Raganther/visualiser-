// Every "feel" number in one place. Change a value here to change how Journey behaves; each is used exactly as written.
// Ranges are [base, span]: the value runs from base (at 0) to base + span (at 1).
// Try a change without editing: add ?tune=name=value to the page URL (e.g. ?tune=hitNone=.4&tune=pace.divBar=.2).
export const TUNE = {
  // transitions: does a section's change cut in on the bar, or fade?
  cutThreshold: .9,            // character + intensity + strength of change must exceed this to cut (lower = more cuts)
  cutAfterDropMs: 8000,        // a section change this soon after a drop always cuts

  // hits
  hitNone: .25,                // base score for "no hit" in a section (higher = fewer hits)
  hitNoneNoRecipe: .2,         // extra "no hit" score when the section's recipe has no hit

  // progression through steady music
  progressBeats: 64,           // beats without a musical change before Journey takes a step (divided by Evolution speed)
  progressNoKickSecs: 30,      // the same, in seconds, when there's no kick to count
  noKickMs: 4000,              // this long without a kick counts as "no kick"
  stillFrom: 20, stillTo: 120, // seconds of sameness over which section detection grows more sensitive

  // sections
  novelty: .06,                // how different the music must be (at least) to start a new section
  noveltyVsAvg: 2,             // ...and how many times its usual variation
  noveltyHold: 1.5,            // seconds the difference must last
  sectionMinAge: 10,           // seconds before a section can end
  sameType: .085,              // how close a section must be to one heard before to count as its return

  // worlds (backgrounds)
  worldSecs: 50, worldRestSecs: 30,  // how long a world lasts, and how long black lasts between worlds
  worldFatigueWeight: 1,       // how much a world (or the black) that's been on lately counts against choosing it again
  worldWaitSecs: 12,           // how long to wait for a phrase line before changing anyway

  // lens (kaleidoscope, mirror): comes in above lensOn intensity, leaves below lensOff
  lensOn: .35, lensOff: .2,

  // fatigue: layers tire while on screen and recover while off
  fatigueBuildSecs: 60, fatigueRecoverSecs: 90,
  fatigueWeight: 1.2,          // how much tiredness counts against a layer
  fatigueRecipeWeight: .8,     // ...and against a recipe whose lead is tired

  // pace, from floating (0) to frantic (1)
  pace: {
    speed: [.3, .7],           // motion speed
    punch: [.2, .8],           // how hard the kick lands
    follow: [.08, .92],        // how closely shapes follow the audio
    divBar: .3, divHalf: .6,   // below divBar the visuals pulse once a bar, below divHalf every other beat, else every beat
  },

  // the mirror tunnel (a video, image or camera through a three-mirror kaleidoscope)
  tunnel: {
    level: .85,                // how bright it is as the lead while media is loaded
    orb: .85,                  // 0 = flat endless pattern, 1 = bent onto a lit sphere
    spin: .12,                 // how fast the image turns inside the mirrors
    zoom: 1,                   // how far down the tube you look (bigger = more, smaller reflections)
    drift: .015,               // how fast the view wanders across the source
  },

  // the wire skull (a 3D centrepiece); Journey leaves it out while chance is 0
  skull: {
    chance: 0,                 // how often a section gets it as its centrepiece (try ?lab=skull)
    level: .9,                 // how strongly it shows as the centrepiece
    size: .42,                 // how big it is (about 1.1 × this, as a fraction of the screen's height)
    spin: .25,                 // how fast it turns (motion time, so it slows with the pace)
    jaw: .3,                   // how far the jaw drops on the pulse, in radians
    explode: 1,                // how far the panes fly when it shatters
    explodeSecs: 1.2,          // how long it takes to pull itself back together
    line: 2.2,                 // edge width in pixels, on a 720-line screen
    fill: .12,                 // how much light the glass panes hold
    dark: .75,                 // how much the glass darkens what's behind it (so it reads as a solid)
    xray: .22,                 // how brightly the far side's edges show through
    trail: .15,                // how bright the ghosts it leaves in the trails are
  },

  // sync with real audio: beats are drawn ahead by the analyser's own delay and the screen's, and held back by the speakers'
  sync: {
    displayMs: 30,             // how long a drawn frame takes to reach the screen
  },

  // beat grid
  grid: {
    onGrid: .12,               // a kick within this fraction of a beat counts as on the grid
    lockFit: .08,              // how tightly three kicks must fit the tempo to lock
    holdSecs: 30,              // how long the clock keeps time with no kicks
    downMinBeats: 16,          // beats heard before judging where the 1 is
    downMargin: .12,           // how much clearer a new downbeat must be to move the 1
    downHoldBeats: 8,          // ...for this many beats in a row
    clapWeight: .7,            // weight of claps on 2 and 4 against crashes and changes on the 1
  },
};
