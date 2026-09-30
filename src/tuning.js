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
  liked: {recipe: .15, scene: .4, centre: .7},   // the user's likes as Journey's recipes: how much one is favoured, its scene template favoured, how often it brings its centrepiece
  keys: {layer: .8, idleSecs: 20},   // the keyboard (ui/keys.js): how strong a layer comes in; how long a group stays picked (and its strip shown) untouched
  handoffSecs: 12,             // turned back on from a look made by hand, Journey holds it at least this long (then moves on at a phrase line), unless the music changes first
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
  wander: [.01, .05],          // how far Journey lets the trails' centre wander (it was up to .38: things drifted round off centre)

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
  // the picture's finish (render/gl.js; bloom also in simple mode)
  render: {
    trailScale: .75,           // the trails' resolution against the screen's (they're soft anyway; a phone draws 44% fewer pixels)
    trailSoft: 1,              // how far (in pixels) the trails are softened each frame, so fast shapes smear instead of stepping
    trailFloor: .0015,         // what the trails lose each frame besides fading, so faint tails end (8-bit trails need .004)
    bloom: .6,                 // how strongly bright parts glow onto their surroundings (0: off)
    bloomThresh: .5,           // how bright a part must be to glow
    bloomRadius: 1.6,          // how wide the glow spreads (in blur steps)
    knee: .78,                 // brightness above which colours roll off softly instead of clipping to white
    fbLinger: 8000,            // ms a visual stays in the trails' shader after it last drew (so accents don't swap shaders each time)
    // the resolution follows the frame rate (render/quality.js): one step down when it's under low, one up after upMs at high
    auto: {on: 1, low: 48, slowN: 2, high: 57, min: .5, step: .8, worldMin: .5, windowMs: 1000, graceMs: 4000, settleMs: 2000, upMs: 10000,
      probeMs: 6000, ceilMs: 120000, stallMs: 1000},   // probe: a drop this soon after a step up keeps it under that step for ceilMs; stall: a gap this long (a hidden tab) restarts the count
    fbWait: 400,               // ms to leave a trails shader compiling before using it, where the browser can't say when it's done
    fbCache: 24,               // how many trail shaders (one per set of visuals drawing) are kept at most (0: always the full one)
  },
  // the cosmos (visuals/worlds/cosmos/): a camera exploring generated star systems, led by the track's shape
  cosmos: {
    shotBars: 8,               // bars per camera shot (a section change or a drop moves on sooner)
    buildFast: 2, buildSlow: 14,   // seconds: the tension's quick and slow averages; the quick one pulling ahead is a build
    buildSpan: .12,            // how far ahead the quick average must get for a full build
    buildFloor: .3,            // no build below this tension (a quiet wobble isn't one)
    buildStart: .5,            // how much build draws the camera in
    buildGrace: 16,            // seconds into a track before a build can draw the camera (its tension is still settling)
    pushMin: .015, pushRate: .045,   // how fast a build closes the distance (share of the way a second, plus more as it grows): 15-25 s
    pushNarrow: .25,           // how much a full build narrows the view
    fizzleSecs: 4,             // a build that fades for this long lets the camera go
    dropJump: .6,              // how often a drop jumps to another system (otherwise it pulls back to the whole system)
    dropWiden: 18,             // degrees a drop's pull back widens the view, easing off
    quietSecs: 3, quietSlow: .5,   // no kick for this long is the quiet: the camera drifts or circles, this much slower
    maxShotSecs: 40,           // a shot ends after this much motion time even with no bars to count
    newSystem: .35,            // how often a new section on the same arm (the same mood) still goes to another star system
    jumpGapSecs: 20,           // a drop jumps to hyperspace only this long after the last jump
    warpUp: 1.2, warpDown: 1.8,   // seconds into and out of a jump
    fov: 55,                   // the view's width in degrees (shots widen or narrow it a little)
    kick: 1.2,                 // degrees the kick nudges the view in
    lookK: 1.5,                // how much quicker the view turns than the camera moves
    k: {orbit: .7, approach: .5, flyby: 1.1, reveal: .45, eclipse: .6, drift: .5, push: .6, belt: .8, skim: .9, sunrise: .75},   // how quickly the camera follows each shot (per second)
    galaxyChance: .45,         // how often the biggest drops (after a full build) go out to the galaxy and back (else a black hole)
    handSecs: 30,              // seconds a shot picked by hand (the lab's keys) holds the camera before the music takes over again
    galFade: 1.8, galHoldSecs: 9,   // seconds to fade out to the galaxy (and back), and to look across it before diving
    // the view folded into a kaleidoscope: how often a drop does it, for how many bars, how many ways (by intensity), how often
    // only in a circle round the subject (this many of its radii), how fast it opens and closes, how fast its mirrors turn
    fold: {dropChance: .45, bars: 2, n: [3, 4, 6, 8], localChance: .4, localR: 2.4, ease: 4, turn: .04},
    // landing on a world: how often a section does, how near (in radii) the air begins, the whiteout's seconds, the climb
    // out's height; flying: low along the valley, high over the peaks, speed (units a second), the view; the sun's height
    // from calm (dusk, night) to intense (day), how slowly it follows, how far off the way ahead it stands
    land: {chance: .2, enterR: 1.9, fadeSecs: 2.4, exitAlt: 440, valley: 5, soar: 175, diveSecs: 14, speed: 26, fov: 62, sunLow: -.14, sunHigh: .6, sunSecs: 20, sunAz: .45},
    // how big to draw the cosmos against the screen, in space and landed (1: full size, traced in the segment itself).
    // It's the heaviest thing drawn, and a slow device draws it smaller first (render.auto.worldMin), before the whole
    // picture, so the glow, hits and objects over it stay sharp
    scale: 1, landScale: 1,
    showpiece: .35,            // how often a new section opens on a set piece: an eclipse, or a sunrise over a planet's edge
    dropShowpiece: .3,         // how often a drop goes straight to one (instead of pulling back)
    // a section's subject dressed in layers: how many sections are, how many of those get the cage, the motes (more when intense)
    dress: {chance: .4, cage: .7, motes: .45},
    // each kind of world's atmosphere: thickness (share of its radius), hue (turned from the world's), density; moons have none
    atmo: {rock: [.05, .55, .5, 0], gas: [.09, .04, .8, 0], ice: [.06, .5, .55, 0], lava: [.08, .02, .75, 0], ocean: [.09, .56, 1, 0]},
  },
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
    windObject: .08,           // how far an object sways in the wind (small: objects stay centred)
    light: .6,                 // how strongly a world's light falls on the objects
    flyWind: .8,               // how much a moving world's camera (the cosmos) blows the wind: the glow slides with the view
    flyZoom: .5,               // and how much flying in zooms the trails (streaming out from the middle as it closes in)
    focus: .85,                // how far the trails' centre moves to a world's subject on screen (the planet the cosmos films)
    focusEase: 3,              // how quickly it follows (per second), so a change of subject glides rather than jumps
  },
  // palettes: three hues (offsets from the running hue) that every layer, hit and object takes its colours from.
  // Each section picks one (weights below); manual mode uses the triad
  palettes: {triad: [0, .33, .67], analogous: [0, .08, .16], split: [0, .42, .58], contrast: [0, .5, .1]},
  paletteWeights: {triad: 1, analogous: 1.2, split: .8, contrast: .8},
  // Journey composing scenes (scene/templates.js): each template's base weight, and how much tiredness counts against it
  sceneTemplates: {plain: .3, between: .25, split: .4, among: .6, held: .45, reflect: .55, inside: .5, window: .5, glass: .45},
  sceneFatigueWeight: .8,
  scene: {
    fitSpan: .45, fitMax: 8,   // a group fitted into a world's subject: the glow's reach (screen heights) that's shrunk to its radius, and the most it's shrunk
    centreChance: .3,          // Journey: the share of sections with a 3D centrepiece (a per-object TUNE[key].chance above 0 overrides)
    fillAmt: .9,               // how brightly a fill shows through an object's glass
    fillZoom: 2.4,             // how many times smaller a fill's pattern is than the full-screen layer (so it tiles inside an object)
    fillGain: 10,              // a fill is one frame of its layers, with no trails to build it up: this brings it to trail brightness
    worldFillZoom: 2.6,        // how many times smaller a world is when it fills an object's glass (its horizon comes up into the glass)
    worldFillGain: 2.2,        // and how much brighter: worlds are mostly dark sky, which would vanish into the dark glass
    partFillAmt: 2,            // a fill in one part (the eyes) is small, so it shows this many times brighter
    maxGroups: 2,              // trail groups a scene may run, main included (each is a full-size feedback pass; 3 at most); layers of any beyond go to main
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
  manta: {chance: 0, size: .68, hinge: 0,         // the manta ray (a Blender model: tools/blender/manta.py), gliding:
    flap: 1,                   // how far its wings beat (the shape key's weight, both ways), more as the tension rises
    beatsPerFlap: 2,           // one wingbeat every this many beats, in step with the bar
    pitch: .42,                // how far it's tipped towards us, so its back shows
    turn: .12,                 // how far it turns from side to side as it glides, slowly (radians)
  },

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
    startShare: .2,            // the frames just before a kick passed the bar, rising at least this share as hard, count as its start
    startDb: 12,               // ...or rising this many dB across the low bins (its very first frame, while its loudness is still small)
    forgetMs: 1500,            // after this long with no kick, the floor learnt from past kicks is dropped (a quieter part can be heard)
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
    acPull: .8,                // how far the low end's own pulse (its autocorrelation) steers the tempo, when it's clear
    acWidth: .03,              // ...towards tempos within about this share of it
    acClear: .35,              // an autocorrelation this strong (of the most it can be) counts as a clear pulse
    acSure: .6, acNear: .04,   // a pulse this clear rules: the tempo is looked for only within this share of it
    acLock: .3,                // the grid locks only when the low end's pulse is at least this clear (once 4 s have been heard)
  },

  // the set arc (journey/director.js): Journey's lean over a whole set, 0 calm to 1 intense, from the start, rising to the
  // peak at this share of the way through, and winding down to the end
  arc: {start: .25, peak: .8, peakAt: .68, end: .3},

  // listening for texture (audio/listen.js): what tells compressed techno's parts apart when its loudness barely moves
  listen: {
    forget: .01,               // how fast the loudest hats heard fade (a share a second), so a quieter part is heard on its own terms
    hatFloor: .002,            // hats this faint or fainter count as none (the top end's rise in loudness per frame)
    hatFull: .6,               // hats at this share of the most heard lately count as fully in
    hatIn: .3, hatOut: .12,    // the hats count as come in above this, and gone under this (the margin keeps a flicker from counting)
    eventGap: 6,               // seconds the hats must have been steady before a change counts as an event
    eventNov: .08, eventSecs: 3,   // an event adds this to the novelty for this long: enough to start a section on its own
    flatFull: .8,              // flatness in the mids that counts as fully noisy (a chord's peaks are near 0; real mixes sit .5-.8)
    bassDb: 20, bassForget: .5,   // the bass this many dB under its loudest lately counts as gone; that loudest fades this many dB a second
    brkBelow: .35, brkSecs: 3, // the bass under this share of its loudest for this long is a breakdown
    dropAbove: .7, dropHold: .5,   // ...and its return past this share, for this long (not a flicker), is the drop
    noGridBarMs: 3000,         // with no beat grid, a "bar" every this long
    wBand: 4, wNotes: 1, wHat: 3, wNoise: 1.5,   // how much each part of a bar's summary counts when comparing bars
    novOver: 2.2, novFloor: .05,   // a bar pair counts as new when this many times more unlike the bars before than bars usually are
    loopSame: .6,              // a bar this close to the one four or eight before is the same loop
    // what Journey does with it (journey/director.js)
    fullWeight: .4,            // how much the texture's fullness counts in the tension, beside loudness
    novWeight: .6,             // how much a new bar counts towards a new section, beside the slower fingerprint
    loopBars: 24,              // after this many bars of the same loop, the progression moves on sooner
    unclearCalm: .5,           // with no clear pulse at all, the pace is this much calmer
  },
  // the painted worlds (docs/taste.md: stylised posters): the city's skyline and lights
  city: {
    breathe: .012,             // how far each building rises with its own part of the spectrum (it used to be .05: "bouncing")
    jump: .05,                 // how far the skyline leaps on a drop, falling back over a second or so
    riseSecs: 2.6,             // a new section's skyline: the old buildings sink and the new ones rise, in a wave, over this long
    lightEase: .5,             // how quickly the lit windows and neon follow the tension (per second)
    sweepBars: 1,              // the searchlights swing to a new angle every this many bars
  },
  dunes: {
    morphSecs: 4,              // a new section's dunes: the ridges re-form into its own shapes over this long (nearest first)
    sunHigh: .09, sink: .14,   // the sun's height when calm, and how far a build sinks it towards the dunes
    flareSecs: 1.5,            // the sun flaring on a drop, dying away over this long
  },
  forest: {
    morphSecs: 4,              // a new section's wood: it rises as the old one sinks, nearest first, over this long
    sway: .02,                 // how far the trees bend with the bass (the nearest most)
    gust: .12,                 // how far a drop's gust bends them
    gustSecs: 3,               // how long the gust takes to blow over
  },
  sea: {
    morphSecs: 5,              // a new section's sea: its colours and wave shapes morph into the new ones over this long
    bigWave: 1.2,              // how much the near waves grow as the tension rises (1 + this at full)
    greatSecs: 3.5,            // a drop's great wave: how long it takes to curl across the front
  },
  deep: {
    morphSecs: 4,              // a new section's reef: the old layers sink as the new ones rise, nearest first, over this long
    sway: .03,                 // how far the seaweed sways with the bass (the nearest most)
    ballSecs: 6,               // a drop's bait ball: how long the school circles before it swims on
  },
  // how Journey draws a centrepiece (render/mesh.js), weights for glass wire, solid, outline, hologram, points: calm to intense
  objStyles: {calm: [1, .3, .3, 1, .6], intense: [.6, 1, 1, .5, .9]},
  // the kaleidoscope's other kinds (kalMode): the mirror box's hall (how fast its copies recede toward the edges), and the
  // dive (how fast it zooms in, faster as the tension rises; each band's width in log radius: each band e^band smaller)
  kal: {hall: 1, dive: .25, band: .8},
  // Journey's extras, chosen per section with the cast (journey/extras.js), so it uses every setting, not only the roles
  extras: {
    kal: {chance: .2, intense: .25, recipe: .8, cosmos: .5,    // the kaleidoscope: a share of sections (more when intense; a recipe with one brings it most of the time; less in the cosmos, which folds itself)
      n: [3, 8], turn: .08,                                    // mirrors calm to intense, and how fast it may turn either way
      mode: [1, .6, .8],                                       // wedges, a mirror box, a dive
      where: {plain: [1, 0, 1.2, 0], world: [.6, 1.2, .5, 0], centre: [.4, .4, .3, 1.2]}},   // everything, the world, the glow, inside the object: with no world, over a world, round a centrepiece
    grain: {chance: .12, amt: [.2, .55]},                      // the film grain: a share of sections, and how much
    tw: {chance: .35, speed: [.55, 1.8], size: [.75, 1.4]},    // a layer's own speed and size: the share of sections the lead or accent gets its own, and the ranges
  },
  // the choreographer (scene/dance.js): every layer and object on screen dances, a new move every few bars to suit the music
  dance: {
    amount: 1,                 // how much everything dances (0: as before, still)
    remember: .7,              // how often a returning section's dancer brings back its own move
    barsPerMove: 4,            // a dancer may change its move every this many bars (the comets' shape every twice as many)
    stiff: 30,                 // the springs' stiffness: higher snaps to each pose, lower floats
    objStiff: .8,              // objects' springs against the layers'
    damp: .92,                 // the springs' damping (1: eases in with no overshoot; lower yo-yos past each pose)
    shapeIn: 1.5,              // seconds for the comets to fly into a new shape
    flowIn: 3,                 // seconds for the flow's particles to take up a new way of moving
    cometR: .3,                // how big the comets' shapes are (the picture's height is 1)
    cometTurns: .5,            // how much of their shape the comets travel each bar
    // layers, round the picture's centre (radians, scale): how far each move goes at middling energy
    layer: {rock: .25, breathe: .08, spin: .25, push: .18, pulse: .06, bloom: .12},
    // objects: a head bang's nod, a groove's bounce and squash, a glance, a pulse, a float, coming towards us (scale), tipping back (radians)
    obj: {bang: .25, bounce: .03, squash: .08, look: .4, pulse: .12, float: .04, approach: .3, rise: .5},
  },
};
