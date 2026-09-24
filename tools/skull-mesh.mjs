// Builds the wire skull's mesh: a detailed skull shape (distance functions, far too slow to draw live, fine to run once),
// turned into a surface and simplified to a few hundred glass panes. Writes src/visuals/objects/meshes/skull.js.
// Run: node tools/skull-mesh.mjs [skull panes] [jaw panes]    (or npm run mesh for every mesh)
import { cap, ell, mesh, mx, piece, rbox, smax, smin, writeMesh } from './mesh-kit.mjs';

const [SKULL_TRIS, JAW_TRIS] = [+(process.argv[2] || 900), +(process.argv[3] || 260)];

// the dental arch: a parabola round the front of the jaws; teeth sit along it
const arch = (t, y, w = .2, d = .2, z0 = .3) => [t*w, y, z0 - d*t*t];

// ---- the skull (without the jaw); each part returns its own distance so panes can be tagged by part ----
function skullParts(p){
  const q = mx(p);
  let cran = ell(p, [0, .15, -.12], [.34, .35, .44]);                       // braincase
  cran = smin(cran, ell(p, [0, .06, -.42], [.26, .24, .16]), .08);          // the back of the head
  cran = smin(cran, ell(p, [0, .12, .16], [.3, .26, .2]), .1);              // the forehead, sloping down to the brow
  cran = smax(cran, -ell(q, [.44, 0, .06], [.1, .17, .2]), .06);            // temples
  cran = smax(cran, p[1] - .52, .05);                                       // a slightly flatter crown
  const brow = smin(cap(q, [.04, .04, .36], [.25, .06, .27], .045), ell(p, [0, .1, .3], [.2, .1, .1]), .05);   // brow ridge and forehead
  let face = ell(p, [0, -.17, .24], [.17, .15, .17]);                          // maxilla, standing forward of the braincase
  face = smin(face, ell(p, [0, -.02, .3], [.12, .09, .09]), .05);           // between the eyes
  face = smin(face, cap(p, [0, -.02, .36], [0, -.1, .38], .025), .03);      // nasal bones
  const cheek = smin(ell(q, [.23, -.11, .22], [.08, .065, .09]), cap(q, [.26, -.11, .18], [.31, -.1, -.1], .03), .04);   // cheekbone and its arch back to the ear
  const mast = ell(q, [.3, -.21, -.18], [.05, .08, .06]);                   // behind the ears
  let d = smin(smin(smin(cran, brow, .06), face, .07), cheek, .05); d = smin(d, mast, .05);
  // carved: eye sockets (rounded squares, deep), the nose opening, and the skull base behind the jaw
  const sock = smin(rbox(q, [.155, -.03, .42], [.065, .055, .22], .05), ell(q, [.155, -.03, .22], [.11, .1, .18]), .03);
  const nose = smin(ell(p, [0, -.13, .4], [.04, .07, .1]), ell(p, [0, -.17, .39], [.05, .035, .1]), .02);
  d = smax(d, -sock, .02); d = smax(d, -nose, .015);
  d = smax(d, -ell(p, [0, -.46, -.05], [.26, .2, .34]), .04);
  // upper teeth, one by one along the arch
  let teeth = 1e9;
  for (let i = 0; i < 8; i++) {
    const t = (i + .5)/8, c = arch(t, -.305, .16, .22, .335), w = i < 2 ? .02 : i < 3 ? .018 : .022;
    teeth = Math.min(teeth, rbox(q, c, [w, .038 - i*.002, .02 + i*.003], .008));
  }
  return {d: Math.min(d, teeth), parts: [cran, face, cheek, 1e9, teeth, brow, sock, nose]};
}
// ---- the jaw, separate so it can hinge (hinge near the ears) ----
function jawParts(p){
  const q = mx(p);
  let body = 1e9;
  for (let i = 0; i < 10; i++) {                               // the U of the jaw, built along the arch
    const t0 = i/10, t1 = (i + 1)/10, a = arch(t0, -.44 + t0*.04, .23, .36, .32), b = arch(t1, -.44 + t1*.04, .23, .36, .32);
    body = smin(body, cap(q, a, b, .045 - t0*.01), .03);
  }
  body = smin(body, ell(p, [0, -.47, .31], [.07, .04, .04]), .03);          // chin
  body = smin(body, cap(q, [.24, -.4, -.05], [.27, -.21, -.1], .033), .04); // rami up to the hinge
  body = smin(body, ell(q, [.27, -.19, -.1], [.03, .025, .035]), .02);        // condyles
  body = smax(body, -ell(p, [0, -.36, .02], [.17, .08, .26]), .02);          // hollow inside the U, above the floor
  let teeth = 1e9;
  for (let i = 0; i < 8; i++) {
    const t = (i + .5)/8, c = arch(t, -.365, .15, .21, .315);
    teeth = Math.min(teeth, rbox(q, c, [i < 3 ? .016 : .02, .03, .018 + i*.003], .007));
  }
  return {d: Math.min(body, teeth), parts: [1e9, 1e9, 1e9, body, teeth, 1e9, 1e9, 1e9]};
}

const skull = mesh(skullParts, SKULL_TRIS, [-.5, -.42, -.64], [.5, .62, .52], 110);
const jaw = mesh(jawParts, JAW_TRIS, [-.38, -.56, -.2], [.38, -.12, .4], 140);

const out = `// The wire skull's mesh, made by tools/skull-mesh.mjs (don't edit by hand: change the tool and run it again).
// Two pieces, the skull and the jaw (so the jaw can hinge), each with positions (x right, y up, z out of the face),
// triangles (the panes) and each pane's part: 1 cranium, 2 face, 3 cheekbones, 4 jaw, 5 teeth, 6 brow, 7 eye sockets, 8 nose.
export default {
  skull: ${piece(skull)},
  jaw: ${piece(jaw)},
  hinge: [0, -.2, -.1],
};
`;
console.log(`skull ${skull.I.length/3} panes (from ${skull.full}), jaw ${jaw.I.length/3} panes (from ${jaw.full}); ${writeMesh('skull.js', out)}`);
