// Every 3D object as Journey's centrepiece: the wire skull, the unicorn and the maths shapes. Open index.html?lab=objects.
// About half the sections get one, each object about equally often.
export default function({TUNE, registry}){
  const objs = registry.OBJECT_VISUALS;
  objs.forEach((v, i) => TUNE[v.key].chance = .5/(objs.length - i*.5));   // checked in order, so later ones need a higher chance to even out
}
