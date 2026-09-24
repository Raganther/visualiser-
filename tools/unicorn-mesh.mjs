// Builds the wire unicorn's mesh: a prancing unicorn in distance functions (body, legs with one raised, flowing tail,
// mane, ears, eyes and a spiral horn), turned into a surface and simplified to glass panes. Two pieces: the body, and the
// head and neck (so the head can nod on the pulse). Writes src/visuals/objects/meshes/unicorn.js.
// Run: node tools/unicorn-mesh.mjs [body panes] [head panes]    (or npm run mesh for every mesh)
import { cap, ell, mesh, mx, piece, smin, writeMesh } from './mesh-kit.mjs';

const [BODY_TRIS, HEAD_TRIS] = [+(process.argv[2] || 760), +(process.argv[3] || 480)];

// a smooth chain of capsules through points, thinning from r0 to r1 (legs, tail, horn)
function chain(p, pts, r0, r1, k = .02){
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = smin(d, cap(p, pts[i], pts[i + 1], r0 + (r1 - r0)*i/(pts.length - 2 || 1)), k);
  return d;
}
// facing +z, y up; the hooves stand at y = -.5
function bodyParts(p){
  const q = mx(p);
  let body = ell(p, [0, 0, -.04], [.14, .15, .3]);                            // barrel
  body = smin(body, ell(p, [0, .03, .19], [.13, .15, .13]), .06);            // chest
  body = smin(body, ell(p, [0, .03, -.28], [.14, .14, .13]), .06);           // rump
  // legs: shoulder/hip, knee, fetlock, hoof; the right foreleg is raised mid-prance
  const leg = (top, knee, fet, hoof) => chain(p, [top, knee, fet, hoof], .05, .025, .03);
  let legs = leg([.07, -.04, .2], [.075, -.26, .22], [.075, -.42, .21], [.075, -.47, .215]);            // left fore
  legs = smin(legs, leg([-.07, -.04, .2], [-.075, -.14, .34], [-.075, -.27, .33], [-.075, -.31, .3]), .03); // right fore, raised
  legs = smin(legs, leg([.075, -.02, -.3], [.08, -.24, -.36], [.078, -.42, -.32], [.078, -.47, -.31]), .03);   // hind legs
  legs = smin(legs, leg([-.075, -.02, -.3], [-.08, -.24, -.36], [-.078, -.42, -.32], [-.078, -.47, -.31]), .03);
  let hooves = Math.min(ell(p, [.075, -.49, .215], [.032, .022, .036]), ell(q, [.078, -.49, -.305], [.032, .022, .036]));   // left fore, hinds
  hooves = Math.min(hooves, ell(p, [-.075, -.325, .295], [.032, .022, .036]));  // the raised hoof
  // a flowing tail, three strands swept back and down
  let tail = chain(p, [[0, .07, -.4], [0, .05, -.5], [0, -.04, -.58], [0, -.16, -.6], [0, -.28, -.56]], .04, .018, .03);
  tail = smin(tail, chain(p, [[0, .06, -.46], [.04, -.02, -.56], [.05, -.14, -.62], [.04, -.25, -.63]], .03, .014, .03), .02);
  tail = smin(tail, chain(p, [[0, .06, -.46], [-.04, -.03, -.55], [-.05, -.15, -.6], [-.03, -.24, -.6]], .03, .014, .03), .02);
  const d = smin(smin(smin(body, legs, .05), hooves, .02), tail, .04);
  return {d, parts: [body, 1e9, legs, tail, 1e9, hooves, 1e9, 1e9]};
}
function headParts(p){
  const q = mx(p);
  let neck = chain(p, [[0, .06, .22], [0, .2, .3], [0, .33, .38]], .085, .06, .05);   // neck, rising and leaning forward
  let head = ell(p, [0, .4, .43], [.065, .075, .08]);                          // the head's top
  head = smin(head, chain(p, [[0, .39, .45], [0, .34, .55], [0, .31, .6]], .06, .045, .04), .05);   // face down to the muzzle
  head = smin(head, ell(p, [0, .305, .6], [.05, .04, .045]), .03);             // muzzle
  const ears = cap(q, [.035, .45, .41], [.05, .53, .39], .016);
  head = smin(head, ears, .015);
  // the horn: a thin cone from the forehead with a ridge spiralling round it
  let horn = chain(p, [[0, .46, .47], [0, .53, .5], [0, .6, .53], [0, .67, .56]], .024, .004, .005);
  for (let i = 0; i < 18; i++) {
    const t = i/18, a = t*Math.PI*6, r = .022*(1 - t), c = [0 + Math.cos(a)*r, .46 + t*.21 + Math.sin(a)*r*.3, .47 + t*.09 - Math.sin(a)*r];
    horn = smin(horn, ell(p, c, [.01*(1 - t) + .003, .01*(1 - t) + .003, .01*(1 - t) + .003]), .008);
  }
  // the mane: a wavy crest along the back of the neck, a forelock between the ears
  let mane = 1e9;
  for (let i = 0; i < 9; i++) {
    const t = i/8, c = [Math.sin(i*1.7)*.02, .44 - t*.36, .38 - t*.22 - .06];
    mane = smin(mane, ell(p, c, [.03, .05, .035]), .03);
  }
  mane = smin(mane, ell(p, [0, .45, .47], [.025, .02, .04]), .02);
  const eyes = ell(q, [.055, .4, .47], [.016, .016, .014]);
  const d = smin(smin(smin(smin(neck, head, .05), horn, .015), mane, .03), eyes, .01);
  return {d, parts: [1e9, Math.min(neck, head), 1e9, mane, horn, 1e9, eyes, 1e9]};
}

const body = mesh(bodyParts, BODY_TRIS, [-.2, -.53, -.7], [.2, .22, .38], 150);
const head = mesh(headParts, HEAD_TRIS, [-.14, .02, .12], [.14, .7, .68], 170);
const out = `// The wire unicorn's mesh, made by tools/unicorn-mesh.mjs (don't edit by hand: change the tool and run it again).
// Two pieces, the body and the head with its neck (so the head can nod), each with positions (x across, y up, z the way it
// faces), triangles (the panes) and each pane's part: 1 body, 2 head and neck, 3 legs, 4 mane and tail, 5 horn, 6 hooves, 7 eyes.
export default {
  body: ${piece(body)},
  head: ${piece(head)},
  hinge: [0, .08, .22],
};
`;
console.log(`body ${body.I.length/3} panes (from ${body.full}), head ${head.I.length/3} panes (from ${head.full}); ${writeMesh('unicorn.js', out)}`);
