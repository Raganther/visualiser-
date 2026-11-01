// The shared symmetry (a leaf module): the kaleidoscope owns it, and while the pieces are connected (S.explore.link) the
// things that fold or branch read it, so the picture moves as one body rather than separate systems sharing a screen (the
// user asked for the object and the kaleidoscope to be one creature). main.js fills it each frame from the kaleidoscope:
// on, its mirrors (or, with no kaleidoscope, the music's own count, calm few to intense many), the angle of a mirror, how
// far it has dived and how much in the last frame, how broken its symmetry is (1 even; more after a drop, less as a drop
// read ahead nears), its kind, and the newest ring's mirrors in the nested dive. Read by objects/branches.js (its arms,
// turn, dive, lean), worlds/kifs.js (its halls' folds, twist, roll) and main.js (an object filling the screen takes the
// fold inside it).
export const SYM = {on: false, n: 6, turn: 0, z: 0, dz: 0, as: 1, kind: 0, inner: 0};
