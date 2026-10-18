// The genome page (?lab=genome, or the published dist/genome.html): the whole visualiser with the genome on (scene/genome.js:
// one symmetry, motif, material and colour a section that the pieces read), Journey casting only from the pieces it reaches
// and the Prism always the centrepiece, against Separate (each piece its own, the kaleidoscope its own count and kind). The
// controls are the phone's (ui/mobile.js): a song on the groovebox, the genome's switches, Next, the graphics.
import { mobilePage, FULL } from '../ui/mobile.js';

export default () => mobilePage({
  save: 'afterglow.genomelab', separate: true,
  pool: {worlds: ['lattice', 'corridor', 'kifs'], desk: ['hollow', 'cathedral'],   // (the worlds the genome reaches, light enough for a phone; on a computer two more)
    layers: ['fireflies', 'orbit', 'comets', 'rosette', 'stargate', 'mandala', 'ring']},
  note: `Together: the Prism, the world, the layers and the kaleidoscope share one symmetry, shape and material each section; the genome also picks what the kaleidoscope folds (mostly everything), and each section grows from the last. Separate: each picks its own. Next moves on to a new section. The full visualiser has the same switch, and a phone view of everything: <a href="${FULL}" target="_blank" rel="noopener">open it</a>.`,
});
