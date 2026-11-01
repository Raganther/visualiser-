// What things are called, the same everywhere in the Studio (the jam, the DAW, the labs): the drums' voices, the parts,
// the notes, and decibels as words. A leaf: it imports nothing, and every page reads its names from here.

// each drum voice by its key (a pad, a kit's voice, a drum part)
export const VNAME = {kick: 'Kick', chh: 'Closed hat', ohh: 'Open hat', ride: 'Ride', snare: 'Snare', clap: 'Clap', crash: 'Crash', cow: 'Cowbell', tomL: 'Low tom', tomH: 'High tom', log: 'Log', logH: 'High log', wood: 'Wood', rim: 'Rim', clave: 'Clave', shaker: 'Shaker', metal: 'Metal', bowl: 'Bowl', gong: 'Gong'};
// a voice's name, a numbered copy of one (kick2) by the voice it copies
export const voiceName = v => VNAME[v] || VNAME[String(v).replace(/\d+$/, '')] || v;
// each kind of part: in full (the jam's sound lists) and short (rows, columns, tracks)
export const ROLE_NAMES = {kick: 'Kick', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', lead: 'Bells and leads'};
export const PART_NAMES = {kick: 'Kick', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', lead: 'Lead'};
// a part named by itself, else by its kind
export const partName = p => p.name || PART_NAMES[p.role] || p.role;
// the jam's columns (kick, hats, percussion, bass, chords, lead, lead): the second lead is Lead 2
export const colName = (i, role) => role === 'lead' && i > 5 ? 'Lead 2' : PART_NAMES[role] || role;

// notes: a pitch class from its letter (sharps and flats), a MIDI note from its name (C4 = 60), a name from a MIDI note
export const PC = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
export const midiOf = s => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); return 12*(+m[2] + 1) + PC[m[1]]; };
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m, names = NOTE_NAMES) => names[((m % 12) + 12) % 12] + (Math.floor(m/12) - 1);
// a pitch named, a drum voice left as it is (a piano roll's rows, a step's label)
export const pitchName = p => typeof p === 'number' ? noteName(p) : p;

// decibels as words: the desk's (−60 and below off), or with its own floor, word for silence and unit
export const fmtDb = (v, {floor = -59.5, off = 'off', unit = ''} = {}) => v <= floor ? off : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(+v).toFixed(1) + unit;
export const fmtPan = v => Math.abs(v) < .01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v)*100);
