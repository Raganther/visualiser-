// The phone view of the whole visualiser: Journey with every world, layer and object, the genome on or off, a song on the
// groovebox, likes, the graphics and the 3D worlds, in the phone's controls (ui/mobile.js). It comes on by itself on a phone
// (src/lab.js: a coarse pointer and a small screen, until chosen otherwise), and from the Adjust panel's Phone view button
// anywhere; Full controls goes back (afterglow.phone, kept on the device).
import { mobilePage } from '../ui/mobile.js';

export const setPhone = on => { try { localStorage.setItem('afterglow.phone', on ? '1' : '0'); } catch (e) {}
  const u = new URL(location.href), labs = u.searchParams.getAll('lab').flatMap(v => v.split(',')).filter(l => l !== 'phone');   // (not back again from the address)
  u.searchParams.delete('lab'); if (labs.length) u.searchParams.set('lab', labs.join(',')); location.replace(u.href); };
export default () => mobilePage({
  save: 'afterglow.phoneview', likes: true, heavy: true,
  leave: () => setPhone(false),
  note: `Everything Journey has, with the built-in song. The genome gives each section one symmetry, shape, material and colour that the world, the layers, the object and the kaleidoscope share. 👍 and 👎 keep the moment. If it's slow, try Fastest or fewer 3D worlds. <a href="#" data-id="leave">Full controls</a>.`,
});
