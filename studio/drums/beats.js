// The playground's beats: two bars of 16ths a row, each written as a string, one character a step: '.' rest, 'o' a ghost
// note, 'x' a hit, 'X' an accent, 'r' a roll (two hits in the step). Each beat says its tempo, its swing and the kit it
// was written for (any kit plays it).
export const VEL = {o: .42, x: .78, X: 1, r: .7};
export const BEATS = [
  {id: 'four', name: 'Four to the floor', style: 'Minimal techno', bpm: 126, swing: .06, kit: 'Analog Deep', rows: {
    kick:  'X...x...x...x...X...x...x...x...',
    clap:  '....x.......x.......x.......x...',
    chh:   '..x...x...x...x...x...x...x..ox.',
    ohh:   '................................',
    rim:   '.......o..........o.......o.....',
    shaker:'o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.'}},
  {id: 'rolling', name: 'Rolling minimal', style: 'Minimal techno', bpm: 128, swing: .1, kit: 'Analog Deep', rows: {
    kick:  'X...x...x...x...X...x...x...x..o',
    chh:   'oxoxoxoxoXoxoxoxoxoxoxoxoXoxoxox',
    ohh:   '..x...x...x...x...x...x...x...x.',
    rim:   '...x..x....x.x.....x..x...x..x..',
    clave: '.........o..............o.......',
    tomL:  '..............o...............o.'}},
  {id: 'house', name: 'Deep house', style: 'House', bpm: 122, swing: .16, kit: 'Analog Warm', rows: {
    kick:  'X...x...x...x...X...x...x...x...',
    snare: '....o.......o.......o.......o..o',
    clap:  '....x.......x.......x.......x...',
    ohh:   '..x...x...x...x...x...x...x...x.',
    shaker:'oxoxoxoxoxoxoxoxoxoxoxoxoxoxoxox',
    cow:   '...........o...............o....',
    tomH:  '.............o.o................'}},
  {id: 'electro', name: 'Electro', style: '808 electro', bpm: 112, swing: 0, kit: 'Analog 808', rows: {
    kick:  'X......x..x.....X.....x...x..x..',
    snare: '....X.......X.......X.......X...',
    chh:   'x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxx.',
    cow:   '..........x.........x.......x...',
    clave: '...x..x......x.....x..x......x..'}},
  {id: 'boom', name: 'Boom bap 808', style: '808 hip-hop', bpm: 90, swing: .22, kit: 'Analog 808', rows: {
    kick:  'X.....x...x.......X...x.....x...',
    snare: '....X.......X.......X.......X..o',
    chh:   'x.x.x.x.x.x.x.x.x.x.x.xxx.x.x.x.',
    ohh:   '..............x...............x.',
    rim:   '.......o...............o........'}},
  {id: 'trap', name: 'Half-time rolls', style: 'Trap', bpm: 140, swing: 0, kit: 'Analog 808', rows: {
    kick:  'X.......x.x.....X.....x...x.....',
    snare: '........X...............X.......',
    chh:   'x.x.x.x.rrrrx.x.x.x.x.x.x.rrxrrr',
    ohh:   '..............x.................',
    clap:  '........x...............x.......'}},
  {id: 'break', name: 'Breakbeat', style: 'Breaks', bpm: 136, swing: .04, kit: 'Analog 909', rows: {
    kick:  'X.x.......xx......X.......x.....',
    snare: '....X..o.o..X..o....X..o.o..X.oo',
    ride:  'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
    crash: 'X...............................',
    chh:   '................................'}},
  {id: 'acidhouse', name: '909 house', style: 'Chicago and acid house', bpm: 124, swing: .12, kit: 'Analog 909', rows: {
    kick:  'X...x...x...x...X...x...x...x...',
    clap:  '....x.......x.......x.......x...',
    chh:   'xxxXxxxXxxxXxxxXxxxXxxxXxxxXxxxX',
    ohh:   '..x...x...x...x...x...x...x...x.',
    ride:  'x...x...x...x...x...x...x...x...',
    tomL:  '...........................x.x.x'}},
  {id: 'dub', name: 'Dub techno', style: 'Dub techno', bpm: 118, swing: .08, kit: 'Analog Warm', rows: {
    kick:  'X...x...x...x...X...x...x...x...',
    rim:   '......x.......o.......x.....o...',
    ohh:   '..o...o...o...o...o...o...o...o.',
    chh:   'o...o...o...o...o...o...o...o...',
    shaker:'..ox..ox..ox..ox..ox..ox..ox..ox',
    clap:  '............x...............x...'}},
  {id: 'industrial', name: 'Industrial', style: 'Industrial techno', bpm: 132, swing: 0, kit: 'Analog Grit', rows: {
    kick:  'X...x...x...x.x.X...x...x..xx...',
    snare: '....X.......X.......X.......X.X.',
    clap:  '....x.......x.......x.......x...',
    chh:   'XxxxXxxxXxxxXxxxXxxxXxxxXxxxXxxx',
    tomL:  '..x.......x.......x.........x...',
    tomH:  '......x.......x.......x.....x.x.'}},
  {id: 'toms', name: 'Tom groove', style: 'Percussion', bpm: 124, swing: .14, kit: 'Analog 808', rows: {
    kick:  'X...x...x...x...X...x...x...x...',
    tomL:  'x..x..x...x..x..x..x..x...x..x..',
    tomH:  '..x...x.x...x.....x...x.x...x.x.',
    cow:   'x.......x.x.....x.......x.x.....',
    clave: '..x..x....x..x....x..x....x..x..',
    shaker:'oxooxooxoxooxooxoxooxooxoxooxoox'}},
  {id: 'build', name: 'Build and drop', style: 'A breakdown fill', bpm: 126, swing: .06, kit: 'Analog 909', rows: {
    kick:  '................X...x...x...x...',
    snare: 'x...x...x.x.x.x.xxxxxxxxrrrrrrrr',
    crash: '................................',
    chh:   '..x...x...x...x.................',
    clap:  '................................',
    tomL:  '............................x.x.',
    tomH:  '........................x.x.....'}},
];
// the rows the grid shows, low to high, and their names
export const ROWS = [['kick', 'Kick'], ['snare', 'Snare'], ['clap', 'Clap'], ['rim', 'Rim'], ['clave', 'Clave'], ['tomL', 'Low tom'], ['tomH', 'High tom'], ['cow', 'Cowbell'],
  ['shaker', 'Shaker'], ['chh', 'Closed hat'], ['ohh', 'Open hat'], ['ride', 'Ride'], ['crash', 'Crash']];
