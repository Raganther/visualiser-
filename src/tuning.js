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
  // how loud Journey thinks it is (journey/sections.js energyLevel): against the loudest lately, and an absolute scale
  energy: {
    minSpan: .15,              // the song's range never counts as narrower than this, so a steady track doesn't read as quiet
    quiet: .4, loud: .75,      // the analyser's energy for quiet and full (a mastered techno track runs about .5 to .75)
    absMix: .35,               // how much the absolute scale counts, against the song's own range
  },
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
    divHyst: .05,              // how far past a line the pace must go before the pulse rate changes
  },

  // the mirror tunnel (a video, image or camera through a three-mirror kaleidoscope)
  tunnel: {
    level: .85,                // how bright it is as the lead while media is loaded
    orb: .85,                  // 0 = flat endless pattern, 1 = bent onto a lit sphere
    spin: .12,                 // how fast the image turns inside the mirrors
    zoom: 1,                   // how far down the tube you look (bigger = more, smaller reflections)
    drift: .015,               // how fast the view wanders across the source
  },

  // scenes (scene/graph.js): how their fills show
  // the shared context (scene/context.js): one palette, one wind, one light for every visual
  ctx: {
    palSecs: 4,                // how long a new section's palette takes to come in
    windTurn: .05,             // how fast the wind's direction turns (radians per second of motion time)
    windBase: .025,            // the wind's steady strength (screen heights per second)
    windBass: .05,             // plus this much on bass swells
    windGust: .15,             // plus this much in a gust (a new section or a drop)
    gustSecs: 3,               // how long a gust takes to die down
    windComets: 1,             // how much the wind carries the comets
    windFlow: 1.2,             // the flow's particles
    windTrails: .5,            // the trails (they stream downwind)
    windRibbons: 8,            // how much faster the ribbons wave in a strong wind
    windObject: .6,            // how far an object sways
    light: .6,                 // how strongly a world's light falls on the objects
  },
  // palettes: three hues (offsets from the running hue) that every layer, hit and object takes its colours from.
  // Each section picks one (weights below); manual mode uses the triad
  palettes: {triad: [0, .33, .67], analogous: [0, .08, .16], split: [0, .42, .58], contrast: [0, .5, .1]},
  paletteWeights: {triad: 1, analogous: 1.2, split: .8, contrast: .8},
  // Journey composing scenes (scene/templates.js): each template's base weight, and how much tiredness counts against it
  sceneTemplates: {plain: .3, between: .25, split: .4, among: .6, reflect: .55, inside: .5, window: .5, glass: .45},
  sceneFatigueWeight: .8,
  scene: {
    centreChance: .3,          // Journey: the share of sections with a 3D centrepiece (a per-object TUNE[key].chance above 0 overrides)
    fillAmt: .9,               // how brightly a fill shows through an object's glass
    fillZoom: 2.4,             // how many times smaller a fill's pattern is than the full-screen layer (so it tiles inside an object)
    fillGain: 10,              // a fill is one frame of its layers, with no trails to build it up: this brings it to trail brightness
    worldFillZoom: 2.6,        // how many times smaller a world is when it fills an object's glass (its horizon comes up into the glass)
    worldFillGain: 2.2,        // and how much brighter: worlds are mostly dark sky, which would vanish into the dark glass
    partFillAmt: 2,            // a fill in one part (the eyes) is small, so it shows this many times brighter
    maxGroups: 2,              // trail groups a scene may run (each is a full-size feedback pass); layers of any beyond this go to main
  },

  // 3D mesh objects (the wire skull, the unicorn, the maths shapes): how they all look and move
  mesh: {
    level: .9,                 // how strongly one shows as a section's centrepiece
    spin: .25,                 // how fast they turn (motion time, so they slow with the pace)
    explode: 1,                // how far the panes fly when one shatters
    explodeSecs: 1.2,          // how long it takes to pull itself back together
    line: 2.2,                 // edge width in pixels, on a 720-line screen
    fill: .12,                 // how much light the glass panes hold
    dark: .75,                 // how much the glass darkens what's behind it (so it reads as a solid)
    xray: .22,                 // how brightly the far side's edges show through
    trail: .15,                // how bright the ghosts they leave in the trails are
  },
  // each object: chance (how often Journey makes it a section's centrepiece; 0 = never, try ?lab=skull or ?lab=objects),
  // size (about 1.1 × this, as a fraction of the screen's height) and hinge (its hinged piece's swing on the pulse, radians)
  skull: {chance: 0, size: .42, hinge: .3},       // the jaw drops
  unicorn: {chance: 0, size: .42, hinge: .15},    // the head nods
  geosphere: {chance: 0, size: .4, hinge: 0},
  torus: {chance: 0, size: .48, hinge: 0},
  knot: {chance: 0, size: .52, hinge: 0},
  dodeca: {chance: 0, size: .4, hinge: 0},
  spikes: {chance: 0, size: .4, hinge: 0},

  // sync with real audio: beats are drawn ahead by the analyser's own delay and the screen's, and held back by the speakers'
  sync: {
    displayMs: 30,             // how long a drawn frame takes to reach the screen
  },

  // kick detection (audio/analysis.js)
  kick: {
    weights: [2.2, 1.6, 1, .6, .35, .25],   // how much each low bin (21 Hz up to 129 Hz) counts: the sub-bass is the kick's own
    subShare: .18,             // over its first moment, a kick puts at least this much of its (weighted) rise in the lowest bin;
                               // on a real track kicks put .15-.32, bass notes between them mostly under .1; an 808-style kick .22-.28
    windowMs: 30,              // that first moment: the hit's first three frames or so (the sub often lands a frame or two late)
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
