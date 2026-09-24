// An example experiment. Serve the folder and open index.html?lab=example to try it.
// A lab receives the engine's parts ({TUNE, J, PACE, registry}) and can change them before the first frame.
// This one asks for more cuts and more hits.
export default function({TUNE}){
  TUNE.cutThreshold = .7;
  TUNE.hitNone = .1;
}
