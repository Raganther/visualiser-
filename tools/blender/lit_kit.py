# The kit the lit assets share (tools/blender/tentacle.py, hand.py, heart.py; the goblin, goblin_hd.py, came first and
# keeps its own copy): sculpting with distance fields (shapes blended and carved like clay, meshed by marching cubes, with
# local features such as suckers or knuckles evaluated only in their own box), detail pushed along the normals, organic
# materials, a studio, and the pipeline every asset runs through:
#   python tools/blender/<asset>.py still out.png [--res 1080] [--samples 256] [--morph 0] [--look real|marble]
#   python tools/blender/<asset>.py bake outdir [--tex 2048] [--tris 40000]      then tools/blender/lit_export.py
#   python tools/blender/<asset>.py blend out.blend
# Run with Blender's Python (the `bpy` package, with numpy, scikit-image and Pillow in its venv; see the blender-object skill).
# Axes while sculpting: the visualiser's (x right, y up, z towards the viewer); E() turns them into Blender's.
import sys, os, math, time
import numpy as np
import bpy, mathutils
from skimage.measure import marching_cubes

f32 = np.float32
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
def opt(k, d): return type(d)(ARGS[ARGS.index(k) + 1]) if k in ARGS else d

# ---------------------------------------------------------------- distance fields (numpy, vectorised) ----
def length(*c): return np.sqrt(sum(a*a for a in c))
def smin(a, b, k):
    h = np.clip(.5 + .5*(b - a)/k, 0, 1); return b*(1 - h) + a*h - k*h*(1 - h)
def smax(a, b, k): return -smin(-a, -b, k)
def sph(x, y, z, c, r): return length(x - c[0], y - c[1], z - c[2]) - r
def ell(x, y, z, c, r):   # an ellipsoid (a good approximation of its distance)
    px, py, pz = (x - c[0])/r[0], (y - c[1])/r[1], (z - c[2])/r[2]
    k0 = length(px, py, pz); k1 = length(px/r[0], py/r[1], pz/r[2]) + 1e-6
    return k0*(k0 - 1)/k1
def cap(x, y, z, a, b, ra, rb=None):   # a capsule from a to b, its radius tapering ra to rb
    rb = ra if rb is None else rb
    ba = np.subtract(b, a); pax, pay, paz = x - a[0], y - a[1], z - a[2]
    h = np.clip((pax*ba[0] + pay*ba[1] + paz*ba[2])/ba.dot(ba), 0, 1)
    return length(pax - ba[0]*h, pay - ba[1]*h, paz - ba[2]*h) - (ra + (rb - ra)*h)
def seg_t(x, y, z, a, b):   # where along a segment the nearest point is (0..1), and how far
    ba = np.subtract(b, a); pax, pay, paz = x - a[0], y - a[1], z - a[2]
    h = np.clip((pax*ba[0] + pay*ba[1] + paz*ba[2])/ba.dot(ba), 0, 1)
    return h, length(pax - ba[0]*h, pay - ba[1]*h, paz - ba[2]*h)
def chain(x, y, z, pts, rads, k=0):   # capsules through a list of points: a limb, a vessel, a tentacle
    d = None
    for i in range(len(pts) - 1):
        e = cap(x, y, z, pts[i], pts[i + 1], rads[i], rads[i + 1]); d = e if d is None else (np.minimum(d, e) if not k else smin(d, e, k))
    return d
def torus(x, y, z, c, n, R, r):   # a torus round centre c, its axis n
    n = np.asarray(n, float); n /= np.linalg.norm(n); px, py, pz = x - c[0], y - c[1], z - c[2]
    h = px*n[0] + py*n[1] + pz*n[2]; q = length(px - n[0]*h, py - n[1]*h, pz - n[2]*h) - R
    return length(q, h) - r
def bez(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n)[:, None]; p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1 - t)**3*p0 + 3*(1 - t)**2*t*p1 + 3*(1 - t)*t*t*p2 + t**3*p3
def sstep(a, b, x): t = np.clip((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t)
def rot(v, axis, ang):   # rotate points (n,3) about an axis through the origin
    a = np.asarray(axis, float); a /= np.linalg.norm(a); c, s = math.cos(ang), math.sin(ang)
    return v*c + np.cross(a, v)*s + np.outer(v @ a, a)*(1 - c)

rng = np.random.default_rng(11); LAT = rng.random((64, 64, 64)).astype(f32)
def vnoise(x, y, z):
    xi, yi, zi = np.floor(x).astype(int), np.floor(y).astype(int), np.floor(z).astype(int)
    fx, fy, fz = [(a - np.floor(a)) for a in (x, y, z)]; fx, fy, fz = [t*t*(3 - 2*t) for t in (fx, fy, fz)]
    c = 0
    for i in (0, 1):
        for j in (0, 1):
            for k in (0, 1):
                c = c + LAT[(xi + i) & 63, (yi + j) & 63, (zi + k) & 63]*(fx if i else 1 - fx)*(fy if j else 1 - fy)*(fz if k else 1 - fz)
    return c*2 - 1
def fbm(x, y, z, oct=3): return sum(vnoise(x*2**o, y*2**o, z*2**o)/2**o for o in range(oct))

class Grid:   # a sampled distance field: the whole shape at once, then local features only inside their own boxes
    def __init__(self, f, lo, hi, step, chunk=16):
        self.lo, self.step = np.array(lo, f32), step
        self.axes = [np.arange(lo[i], hi[i], step, dtype=f32) for i in range(3)]
        xs, ys, zs = self.axes; self.vol = np.empty((len(xs), len(ys), len(zs)), f32)
        Y, Z = np.meshgrid(ys, zs, indexing='ij')
        for i in range(0, len(xs), chunk):
            X = xs[i:i + chunk][:, None, None]
            self.vol[i:i + chunk] = f(np.broadcast_to(X, (len(X),) + Y.shape), Y[None], Z[None])
    def local(self, c, r, op):   # vol = op(vol, x, y, z) inside the box of radius r round c
        sl = [slice(max(0, int((c[i] - r - self.lo[i])/self.step)), min(len(self.axes[i]), int((c[i] + r - self.lo[i])/self.step) + 2)) for i in range(3)]
        if any(s.start >= s.stop for s in sl): return
        X, Y, Z = np.meshgrid(self.axes[0][sl[0]], self.axes[1][sl[1]], self.axes[2][sl[2]], indexing='ij')
        self.vol[tuple(sl)] = op(self.vol[tuple(sl)], X, Y, Z)
    def mesh(self):
        v, fc, _, _ = marching_cubes(self.vol, 0, spacing=(self.step,)*3)
        return v + self.lo, fc   # (skimage's winding faces out of a distance field)
    def at(self, p):   # the field at points (trilinear), for thickness
        g = (p - self.lo)/self.step; i = np.clip(np.floor(g).astype(int), 0, np.array(self.vol.shape) - 2); f = g - i
        out = 0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (f[:, 0] if dx else 1 - f[:, 0])*(f[:, 1] if dy else 1 - f[:, 1])*(f[:, 2] if dz else 1 - f[:, 2])
                    out = out + w*self.vol[i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz]
        return out

def vnormals(v, fc):
    fn = np.cross(v[fc[:, 1]] - v[fc[:, 0]], v[fc[:, 2]] - v[fc[:, 0]]); n = np.zeros_like(v)
    for k in range(3): np.add.at(n, fc[:, k], fn)
    return n/np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
def relax(v, fc, it=2, lam=.5):   # a little Laplacian smoothing, to take the marching cubes' stair steps out
    for _ in range(it):
        acc = np.zeros_like(v); cnt = np.zeros(len(v))
        for a, b in ((0, 1), (1, 2), (2, 0)):
            np.add.at(acc, fc[:, a], v[fc[:, b]]); np.add.at(cnt, fc[:, a], 1)
            np.add.at(acc, fc[:, b], v[fc[:, a]]); np.add.at(cnt, fc[:, b], 1)
        v = v + lam*(acc/np.maximum(cnt, 1)[:, None] - v)
    return v
def along_curve(v, pts):   # each point's nearest place on a polyline: (index along it 0..1, distance)
    best_d = np.full(len(v), 1e9); best_t = np.zeros(len(v)); n = len(pts) - 1
    for i in range(n):
        h, d = seg_t(v[:, 0], v[:, 1], v[:, 2], pts[i], pts[i + 1]); m = d < best_d
        best_d[m] = d[m]; best_t[m] = (i + h[m])/n
    return best_t, best_d

# ---------------------------------------------------------------- Blender: objects and materials ----
def E(x, y, z): return (x, -z, y)
def Ev(v): return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); return bpy.context.scene
def make(name, v, fc, mat, smooth=True):
    sc = bpy.context.scene; me = bpy.data.meshes.new(name); V = Ev(v)
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.astype(f32).ravel())
    me.loops.add(fc.size); me.loops.foreach_set('vertex_index', fc.astype(np.int32).ravel())
    me.polygons.add(len(fc)); me.polygons.foreach_set('loop_start', np.arange(0, fc.size, 3, dtype=np.int32))
    me.polygons.foreach_set('use_smooth', np.full(len(fc), smooth)); me.update(); me.validate()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); me.materials.append(mat)
    return ob
def set_mask(ob, m4):   # per-corner colour masks the materials read (the attribute 'mask')
    ca = ob.data.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', m4.astype(f32).ravel())

def nodes(mat): mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear(); return nt
def N(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind); n.location = loc
    for k, val in inputs.items(): n.inputs[k.replace('_', ' ')].default_value = val
    return n
def L(nt, a, b): nt.links.new(a, b)
def ramp(nt, stops, loc=(0, 0)):
    r = N(nt, 'ShaderNodeValToRGB', loc); el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1); el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: e = el.new(p); e.color = (*c, 1)
    return r
def mix(nt, a, b, fac, blend='MIX', loc=(0, 0)):
    m = N(nt, 'ShaderNodeMix', loc); m.data_type = 'RGBA'; m.blend_type = blend
    for sock, val in ((6, a), (7, b), (0, fac)):
        if isinstance(val, (tuple, list)): m.inputs[sock].default_value = (*val, 1) if len(val) == 3 else val
        elif isinstance(val, (int, float)): m.inputs[sock].default_value = val
        else: L(nt, val, m.inputs[sock])
    return m.outputs[2]
def mathn(nt, op, a, b=0, loc=(0, 0)):
    n = N(nt, 'ShaderNodeMath', loc); n.operation = op
    for i, val in enumerate((a, b)):
        if isinstance(val, (int, float)): n.inputs[i].default_value = val
        else: L(nt, val, n.inputs[i])
    return n.outputs[0]

def organic(name, base, dark, spot=None, masks=(), sss=(.35, (1, .4, .25), .045), rough=(.35, .6), pores=260, pore_amt=.2,
            wrinkle=60, wrinkle_amt=.15, mottle=4, spots=22, spot_amt=1.1, cavity=(.25, .22, .15), coat=0, sheen=.15, stretch=(1, 1, 4)):
    """An organic surface: mottled between base and dark, spotted, darker in its creases (pointiness), with extra colours
    where the 'mask' attribute's channels say (masks: [(channel 0..2, colour, roughness or None)]), subsurface scattering,
    and pores and fine wrinkles as bump."""
    m = bpy.data.materials.new(name); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (1500, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (1200, 0)); L(nt, b.outputs[0], out.inputs[0])
    co = N(nt, 'ShaderNodeTexCoord', (-1400, 0)).outputs['Object']
    at = N(nt, 'ShaderNodeAttribute', (-1400, -400)); at.attribute_name = 'mask'
    sep = N(nt, 'ShaderNodeSeparateColor', (-1200, -400)); L(nt, at.outputs['Color'], sep.inputs[0])
    n1 = N(nt, 'ShaderNodeTexNoise', (-1100, 300), Scale=mottle, Detail=6., Roughness=.6); L(nt, co, n1.inputs['Vector'])
    mid = tuple((a + c)/2 for a, c in zip(base, dark))
    r1 = ramp(nt, [(.35, dark), (.55, mid), (.72, base)], (-850, 300)); L(nt, n1.outputs['Fac'], r1.inputs[0])
    n2 = N(nt, 'ShaderNodeTexNoise', (-1100, 0), Scale=float(mottle*7), Detail=3.); L(nt, co, n2.inputs['Vector'])
    c = mix(nt, r1.outputs[0], tuple(x*.6 for x in dark), n2.outputs['Fac'], 'MULTIPLY', (-600, 250))
    c = mix(nt, c, r1.outputs[0], .5, 'MIX', (-450, 250))
    if spot:
        vo = N(nt, 'ShaderNodeTexVoronoi', (-1100, -150), Scale=float(spots)); L(nt, co, vo.inputs['Vector'])
        rs = ramp(nt, [(.0, (1, 1, 1)), (.09, (1, 1, 1)), (.16, (0, 0, 0))], (-850, -150)); L(nt, vo.outputs['Distance'], rs.inputs[0])
        n3 = N(nt, 'ShaderNodeTexNoise', (-1100, -300), Scale=9.); L(nt, co, n3.inputs['Vector'])
        c = mix(nt, c, spot, mathn(nt, 'MULTIPLY', mathn(nt, 'MULTIPLY', rs.outputs[0], n3.outputs['Fac']), spot_amt), 'MIX', (-300, 200))
    rr = ramp(nt, [(.3, (rough[0],)*3), (.7, (rough[1],)*3)], (600, -150)); L(nt, n2.outputs['Fac'], rr.inputs[0]); rgh = rr.outputs[0]
    for i, (ch, col, rg) in enumerate(masks):
        c = mix(nt, c, col, sep.outputs[ch], 'MIX', (-150 + i*150, 150))
        if rg is not None: rgh = mix(nt, rgh, (rg,)*3, sep.outputs[ch], 'MIX', (800 + i*100, -150))
    geo = N(nt, 'ShaderNodeNewGeometry', (-600, -500))
    rp = ramp(nt, [(.44, cavity), (.5, (1, 1, 1))], (-350, -500)); L(nt, geo.outputs['Pointiness'], rp.inputs[0])
    c = mix(nt, c, rp.outputs[0], 1, 'MULTIPLY', (500, 150))
    L(nt, c, b.inputs['Base Color']); L(nt, rgh, b.inputs['Roughness'])
    b.inputs['Subsurface Weight'].default_value = sss[0]; b.inputs['Subsurface Radius'].default_value = sss[1]; b.inputs['Subsurface Scale'].default_value = sss[2]
    b.inputs['Specular IOR Level'].default_value = .55; b.inputs['Sheen Weight'].default_value = sheen
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .08
    vp = N(nt, 'ShaderNodeTexVoronoi', (-200, -700), Scale=float(pores)); L(nt, co, vp.inputs['Vector'])
    bp = N(nt, 'ShaderNodeBump', (300, -700), Strength=pore_amt, Distance=.001); L(nt, vp.outputs['Distance'], bp.inputs['Height'])
    mp = N(nt, 'ShaderNodeMapping', (-400, -900)); mp.inputs['Scale'].default_value = stretch; L(nt, co, mp.inputs['Vector'])
    nw = N(nt, 'ShaderNodeTexNoise', (-200, -900), Scale=float(wrinkle), Detail=8., Distortion=.6); L(nt, mp.outputs[0], nw.inputs['Vector'])
    bw = N(nt, 'ShaderNodeBump', (500, -800), Strength=wrinkle_amt, Distance=.002); L(nt, nw.outputs['Fac'], bw.inputs['Height']); L(nt, bp.outputs[0], bw.inputs['Normal'])
    L(nt, bw.outputs[0], b.inputs['Normal'])
    return m
def glossy(name, color, rough=.25, sss=.2, coat=.6, noise=(.8, 1.)):
    m = bpy.data.materials.new(name); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (700, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (400, 0)); L(nt, b.outputs[0], out.inputs[0])
    co = N(nt, 'ShaderNodeTexCoord', (-600, 0)).outputs['Object']
    ns = N(nt, 'ShaderNodeTexNoise', (-400, 0), Scale=70.); L(nt, co, ns.inputs['Vector'])
    r = ramp(nt, [(.3, tuple(x*noise[0] for x in color)), (.7, tuple(min(1, x*noise[1]) for x in color))], (0, 100)); L(nt, ns.outputs['Fac'], r.inputs[0])
    L(nt, r.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Subsurface Radius'].default_value = (1, .6, .4); b.inputs['Subsurface Scale'].default_value = .01
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .05
    return m
def marble(name):   # the statue look: white stone with grey veins, a little light passing into it
    m = bpy.data.materials.new(name); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (700, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (400, 0)); L(nt, b.outputs[0], out.inputs[0])
    co = N(nt, 'ShaderNodeTexCoord', (-600, 0)).outputs['Object']
    ns = N(nt, 'ShaderNodeTexNoise', (-400, 0), Scale=3., Detail=10., Distortion=4.); L(nt, co, ns.inputs['Vector'])
    r = ramp(nt, [(.46, (.82, .8, .76)), (.5, (.35, .35, .36)), (.54, (.85, .83, .8))], (0, 100)); L(nt, ns.outputs['Fac'], r.inputs[0])
    L(nt, r.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .22
    b.inputs['Subsurface Weight'].default_value = .5; b.inputs['Subsurface Radius'].default_value = (1, .9, .8); b.inputs['Subsurface Scale'].default_value = .05
    return m

def studio(sc, target, key=(E(-1.6, 1.5, 2.2), 380, (1, .86, .7), 1.2), rims=((E(1.3, .7, -2.0), 1500, (.55, .7, 1), 1.),
           (E(-1.6, .6, -1.9), 1000, (.75, .82, 1), .8)), fill=(E(1.8, -.4, 2.0), 60, (.9, .95, 1), 2.)):
    def area(name, loc, power, color, size, tgt=target):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.color = color; ld.size = size
        ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); ob.location = loc
        ob.rotation_euler = (mathutils.Vector(tgt) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob
    out = [area('key', *key)] + [area(f'rim{i}', *r) for i, r in enumerate(rims)] + [area('fill', *fill)]
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.004, .005, .007, 1)
    bpy.ops.mesh.primitive_plane_add(size=14, location=E(0, 0, -3)); bd = bpy.context.object; bd.rotation_euler = (math.pi/2, 0, 0)
    bm_ = bpy.data.materials.new('back'); nt = nodes(bm_); o_ = N(nt, 'ShaderNodeOutputMaterial', (600, 0)); em_ = N(nt, 'ShaderNodeEmission', (300, 0))
    L(nt, em_.outputs[0], o_.inputs[0]); tc = N(nt, 'ShaderNodeTexCoord', (-400, 0)); gr = N(nt, 'ShaderNodeTexGradient', (-200, 0)); gr.gradient_type = 'SPHERICAL'
    mp = N(nt, 'ShaderNodeMapping', (-300, 0)); mp.inputs['Location'].default_value = (-.08, -.22, 0); mp.inputs['Scale'].default_value = (.25, .25, .25)
    L(nt, tc.outputs['Object'], mp.inputs[0]); L(nt, mp.outputs[0], gr.inputs[0])
    rb = ramp(nt, [(0, (.004, .005, .006)), (.9, (.03, .04, .035))], (0, 0)); L(nt, gr.outputs['Fac'], rb.inputs[0]); L(nt, rb.outputs[0], em_.inputs[0])
    bd.data.materials.append(bm_); bd.visible_shadow = False
    return out
def camera(sc, loc, tgt, focus, lens=85, fstop=4.5):
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = lens; cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = fstop
    cam.location = loc; cam.rotation_euler = (mathutils.Vector(tgt) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.focus_distance = (cam.location - mathutils.Vector(focus)).length; return cam
def render_setup(sc, samples, res, aspect=1.4):
    r = sc.render; r.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.use_adaptive_sampling = True; sc.cycles.max_bounces = 8
    r.resolution_x = int(res*aspect)//2*2; r.resolution_y = res; r.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    r.threads_mode = 'FIXED'; r.threads = os.cpu_count()

# ---------------------------------------------------------------- the pipeline ----
def cached(key, fn):   # a sculpt's arrays, kept beside the output (--remesh to sculpt again)
    path = os.path.join(os.path.dirname(os.path.abspath(ARGS[1])), key + '.npz')
    if os.path.exists(path) and '--remesh' not in ARGS: return dict(np.load(path))
    out = fn(); np.savez(path, **out); return out

class Piece:   # one part of an asset: its mesh, its material, its part number in the visualiser (1 organic, 2 hard
    # and glossy, 3 wet eye, 4 metal), its shape key's move (morph(v) -> displacement, or None), a Grid to measure
    # thickness in (for light through thin parts), and how many triangles it keeps when baked
    def __init__(self, name, v, f, mat, part=1, morph=None, grid=None, tris=40000, mask=None, thin=None):
        self.name, self.v, self.f, self.mat, self.part, self.morph, self.grid, self.tris, self.mask, self.thin = name, v, f, mat, part, morph, grid, tris, mask, thin

def thickness(grid, v, n):   # how far in along the inward normal before leaving the shape again
    t = np.full(len(v), .12); was_in, done = np.zeros(len(v), bool), np.zeros(len(v), bool)
    for s in np.linspace(.002, .12, 60):
        d = grid.at(v - n*s); out = (d > 0) & was_in & ~done; t[out] = s; done |= out; was_in |= d < 0
    return t

def run(name, build, cam, look_mat=None, lights=None):
    """build() -> [Piece]; cam = (location, target, focus, lens) in the visualiser's axes. Runs the mode on the command line."""
    MODE, OUT = ARGS[0], os.path.abspath(ARGS[1])
    sc = reset(); t0 = time.time()
    pieces = build(); print(f'{name}: sculpted in {time.time() - t0:.0f}s,', ', '.join(f'{p.name} {len(p.f)} tris' for p in pieces), flush=True)
    look = opt('--look', 'real'); objs = []
    for p in pieces:
        mat = marble('marble') if look == 'marble' and p.part != 4 else p.mat
        ob = make(p.name, p.v, p.f, mat); objs.append(ob)
        if p.mask is not None: set_mask(ob, p.mask)
        if p.morph is not None:
            ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='Pose'); k.slider_min = -1
            k.data.foreach_set('co', Ev(p.v + p.morph(p.v)).astype(f32).ravel()); k.value = opt('--morph', 0.)
    tgt = E(*cam[1])
    studio(sc, tgt, **(lights or {})); camera(sc, E(*cam[0]), tgt, E(*cam[2]), cam[3] if len(cam) > 3 else 85)
    if MODE == 'still':
        render_setup(sc, opt('--samples', 256), opt('--res', 1080), cam[4] if len(cam) > 4 else 1.4); sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = OUT
        t0 = time.time(); bpy.ops.render.render(write_still=True); print(f'still: {OUT} in {time.time() - t0:.0f}s')
    elif MODE == 'blend': bpy.ops.wm.save_as_mainfile(filepath=OUT)
    elif MODE == 'bake': bake(sc, pieces, objs, OUT)

def world_vis(ob):
    ob.data.update(); M = ob.matrix_world; co = np.empty(len(ob.data.vertices)*3, f32); ob.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3) @ np.array(M.to_3x3()).T + np.array(M.translation); return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)
def decimate(ob, ratio):
    if ratio >= 1: return
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.ops.object.modifier_apply(modifier='dec')
def low_copy(ob, name, ratio):
    me = ob.data.copy(); lo = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(lo); lo.matrix_world = ob.matrix_world.copy()
    if me.shape_keys: lo.shape_key_clear()
    lo.modifiers.clear(); decimate(lo, ratio); return lo
def bake(sc, pieces, objs, outdir):
    """The real-time version: a low mesh with one atlas, baked from the sculpt (colour, object-space normals, AO, emission),
    each corner's thickness, part and shape-key move; and a far smaller mesh with baked corner colours for simple mode."""
    os.makedirs(outdir, exist_ok=True); TEX = opt('--tex', 2048); total = opt('--tris', 40000)
    for ob in objs:
        if ob.data.shape_keys: ob.data.shape_keys.key_blocks['Pose'].value = 0
    share = sum(len(p.f) for p in pieces if p.tris is None) or 1
    render_setup(sc, 16, 64)
    lows = []
    for p, ob in zip(pieces, objs):
        want = p.tris if p.tris is not None else total*len(p.f)/share
        lo = low_copy(ob, p.name + '_low', want/len(p.f)); v = world_vis(lo)
        nb = np.empty(len(lo.data.vertices)*3, f32); lo.data.vertices.foreach_get('normal', nb); nb = nb.reshape(-1, 3)
        nv = np.stack([nb[:, 0], nb[:, 2], -nb[:, 1]], 1)
        mv = p.morph(v) if p.morph is not None else np.zeros_like(v)
        th = thickness(p.grid, v, nv) if p.grid is not None else np.full(len(v), .12)
        if p.thin is not None: th = np.where(p.thin(v), th, .12)
        for an, kind, arr in (('lmorph', 'FLOAT_VECTOR', mv), ('lthick', 'FLOAT', th), ('lpart', 'FLOAT', np.full(len(v), p.part))):
            a = lo.data.attributes.new(an, kind, 'POINT'); a.data.foreach_set('vector' if kind == 'FLOAT_VECTOR' else 'value', arr.astype(f32).ravel())
        lows.append(lo)
    bpy.ops.object.select_all(action='DESELECT')
    for lo in lows: lo.select_set(True)
    bpy.context.view_layer.objects.active = lows[0]; bpy.ops.object.join(); low = bpy.context.view_layer.objects.active; low.name = 'low'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); low.data.materials.clear()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.003, area_weight=0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=.002); bpy.ops.object.mode_set(mode='OBJECT')
    print(f'low: {len(low.data.polygons)} tris, {len(low.data.vertices)} corners', flush=True)
    bm2 = bpy.data.materials.new('bake'); nt = nodes(bm2); img_node = N(nt, 'ShaderNodeTexImage', (0, 0)); nt.nodes.active = img_node
    N(nt, 'ShaderNodeOutputMaterial', (300, 0)); low.data.materials.append(bm2)
    bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = .02; bk.max_ray_distance = .06; bk.margin = 8
    sc.world.light_settings.distance = .12
    def run_bake(kind, nm, samples, cs, **kw):
        img = bpy.data.images.new(nm, TEX, TEX); img.colorspace_settings.name = cs; img_node.image = img; sc.cycles.samples = samples
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objs: ob.select_set(True)
        low.select_set(True); bpy.context.view_layer.objects.active = low
        t0 = time.time(); bpy.ops.object.bake(type=kind, **kw); print(f'bake {nm}: {time.time() - t0:.0f}s', flush=True)
        img.filepath_raw = os.path.join(outdir, nm + '.png'); img.file_format = 'PNG'; img.save()
    run_bake('DIFFUSE', 'color', 16, 'sRGB', pass_filter={'COLOR'})
    run_bake('NORMAL', 'normal', 8, 'Non-Color', normal_space='OBJECT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
    run_bake('AO', 'ao', opt('--ao', 24), 'Non-Color')
    run_bake('EMIT', 'emit', 4, 'sRGB')
    me = low.data; me.calc_loop_triangles(); nl = len(me.loops)
    luv = np.empty(nl*2, f32); me.uv_layers.active.data.foreach_get('uv', luv); luv = luv.reshape(-1, 2)
    lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices)*3, f32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    def get(n, w):
        a = np.empty(len(me.vertices)*w, f32); me.attributes[n].data.foreach_get('vector' if w == 3 else 'value', a); return a.reshape(-1, 3) if w == 3 else a
    mo, th, pa = get('lmorph', 3), get('lthick', 1), get('lpart', 1)
    key = {}; outv = []; tris = []
    for t in me.loop_triangles:
        tri_ = []
        for l in t.loops:
            k_ = (lv[l], round(float(luv[l, 0]), 5), round(float(luv[l, 1]), 5))
            if k_ not in key: key[k_] = len(outv); outv.append((lv[l], luv[l, 0], luv[l, 1]))
            tri_.append(key[k_])
        tris.append(tri_)
    vi = np.array([o[0] for o in outv]); uv = np.array([(o[1], o[2]) for o in outv], f32)
    pos = np.stack([co[vi, 0], co[vi, 2], -co[vi, 1]], 1)
    np.savez(os.path.join(outdir, 'lit.npz'), pos=pos, uv=uv, morph=mo[vi], thick=th[vi], part=pa[vi], tri=np.array(tris, np.int32))
    print(f'lit: {len(outv)} corners, {len(tris)} tris', flush=True)
    # simple mode's mesh
    L2 = []; small = opt('--tris2d', 3000); share2 = sum(len(p.f) for p in pieces)
    for p, ob in zip(pieces, objs):
        want = max(40, small*len(p.f)/share2); lo = low_copy(ob, p.name + '_2d', want/len(p.f)); v = world_vis(lo)
        mv = p.morph(v) if p.morph is not None else np.zeros_like(v)
        lo.data.color_attributes.new('bk', 'BYTE_COLOR', 'POINT'); lo.data.color_attributes.active_color = lo.data.color_attributes['bk']
        sc.cycles.samples = 8; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
        bk.target = 'VERTEX_COLORS'; bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}); bk.target = 'IMAGE_TEXTURES'
        col = np.empty(len(lo.data.vertices)*4, f32); lo.data.color_attributes['bk'].data.foreach_get('color', col)
        lo.data.calc_loop_triangles(); tr = np.array([tuple(t.vertices) for t in lo.data.loop_triangles], np.int32)
        L2.append((v, tr, np.full(len(tr), p.part), mv, col.reshape(-1, 4)[:, :3]))
    np.savez(os.path.join(outdir, 'lod2d.npz'), *[a for piece in L2 for a in piece])
    print('lod2d:', sum(len(x[1]) for x in L2), 'tris', flush=True)
