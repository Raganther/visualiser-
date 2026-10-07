# A lifelike goblin bust, sculpted and rendered in Blender (Cycles): a showcase of how far a Blender asset can go here,
# not (yet) a visualiser object. Run with Blender's Python (the `bpy` package, plus numpy and scikit-image in its venv):
#   python tools/blender/goblin_hd.py still out.png [--res 1080] [--samples 256]
#   python tools/blender/goblin_hd.py anim out.mp4 [--res 540] [--samples 24] [--frames 120]
#   python tools/blender/goblin_hd.py blend out.blend      (the scene, to open in Blender)
#   python tools/blender/goblin_hd.py bake outdir [--tex 2048] [--tris 40000]   (the real-time version: tools/lit-asset.mjs makes it a module)
# The sculpt is signed distance fields (shapes blended and carved with smooth unions, like clay), meshed by marching cubes;
# then the fine detail a sculptor adds by hand (forehead furrows, crow's feet, the nose's snarl lines, warts, a lumpy
# asymmetry) is pushed into the surface along its normals. The look is all Blender: skin with subsurface scattering (the
# ears glow red where the rim light passes through them), mottled and blotched, darker in the creases (pointiness), pores
# and fine wrinkles as bump; wet slit-pupilled eyes with a faint glow; yellowed teeth and tusks; a brass earring; three
# area lights. The animation shows what Blender can move: the head turns, it snarls (a shape key: the jaw drops, the lip
# curls, the nose wrinkles, the brow knots, the ears pin back), its eyes follow, and the key light swings round it.
# Axes while sculpting: the visualiser's (x right, y up, z towards the viewer); E() turns them into Blender's.
import sys, math, os, time
import numpy as np
import bpy, bmesh, mathutils
from skimage.measure import marching_cubes

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
MODE, OUT = args[0], os.path.abspath(args[1])
def opt(k, d): return type(d)(args[args.index(k) + 1]) if k in args else d
f32 = np.float32

# ---------------------------------------------------------------- distance-field kit (numpy, vectorised) ----
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
def chain(x, y, z, pts, rads):   # capsules through a list of points: a curved limb, a lip, a nose
    d = None
    for i in range(len(pts) - 1):
        e = cap(x, y, z, pts[i], pts[i + 1], rads[i], rads[i + 1]); d = e if d is None else np.minimum(d, e)
    return d
def bez(p0, p1, p2, p3, n):
    t = np.linspace(0, 1, n)[:, None]; p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1 - t)**3*p0 + 3*(1 - t)**2*t*p1 + 3*(1 - t)*t*t*p2 + t**3*p3
def sstep(a, b, x): t = np.clip((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t)

# value noise, for the lumps and the asymmetry
rng = np.random.default_rng(11); LAT = rng.random((64, 64, 64)).astype(f32)
def vnoise(x, y, z):
    xi, yi, zi = np.floor(x).astype(int), np.floor(y).astype(int), np.floor(z).astype(int)
    fx, fy, fz = [(a - np.floor(a)) for a in (x, y, z)]; fx, fy, fz = [t*t*(3 - 2*t) for t in (fx, fy, fz)]
    def L(i, j, k): return LAT[i & 63, j & 63, k & 63]
    c = 0
    for i in (0, 1):
        for j in (0, 1):
            for k in (0, 1):
                c = c + L(xi + i, yi + j, zi + k)*(fx if i else 1 - fx)*(fy if j else 1 - fy)*(fz if k else 1 - fz)
    return c*2 - 1
def fbm(x, y, z, oct=3):
    return sum(vnoise(x*2**o, y*2**o, z*2**o)/2**o for o in range(oct))

# ---------------------------------------------------------------- the head ----
EYE = [(s*.142, .1, .335) for s in (-1, 1)]; EYER = .058
def ear_frame(s):
    o = np.array([s*.35, .12, -.04])
    u = np.array([s*1., .34 + (.06 if s < 0 else 0), -.36]); u /= np.linalg.norm(u)   # out, up and back (the left one a little higher)
    v = np.array([0, 1., 0]); v -= u*u.dot(v); v /= np.linalg.norm(v)
    w = np.cross(u, v)*s; a = -.55   # turn the ear's face forwards, so its bowl looks at us
    v, w = v*math.cos(a) + w*math.sin(a)*s, w*math.cos(a) - v*math.sin(a)*s
    return o, u, v/np.linalg.norm(v), w/np.linalg.norm(w)
EARL = .6
def ear_hw(t): return .165*np.sin(np.pi*np.clip(t*1.02 + .06, 0, 1))**.55*(1 - .35*t)
def ear(x, y, z, s):
    o, u, v, w = ear_frame(s); px, py, pz = x - o[0], y - o[1], z - o[2]
    t = (px*u[0] + py*u[1] + pz*u[2]); vv = px*v[0] + py*v[1] + pz*v[2]; ww = px*w[0] + py*w[1] + pz*w[2]
    tn = np.clip(t/EARL, 0, 1); c = .07*tn*tn - .02*tn; hw = ear_hw(tn)
    rel = (vv - c)/np.maximum(hw, 1e-3)
    d2 = np.maximum(np.abs(vv - c) - hw, np.maximum(-t, t - EARL))
    cup = ww + .05*(1 - np.clip(rel*rel, 0, 1))*(1 - .7*tn)            # the bowl: the middle sits back
    mem = np.maximum(d2, np.abs(cup) - .01)                              # the thin membrane
    rim = np.maximum(length(np.maximum(d2 + .016, -.05), cup - .008) - .017, t - (EARL - .03))   # the rolled rim (helix)
    e = smin(mem, rim, .012)
    ridge = length(vv - c + .02*np.sin(tn*6), cup - .004) - .009         # an inner fold (antihelix)
    e = smin(e, np.maximum(ridge, np.maximum(-t + .05, t - EARL*.55)), .01)
    # battle nicks in the edge
    for (tt, side, r) in ([(.42, 1, .028), (.7, -1, .02)] if s > 0 else [(.55, 1, .024)]):
        p = o + u*tt*EARL + v*(side*ear_hw(tt) + .07*tt*tt - .02*tt)
        e = smax(e, -sph(x, y, z, p, r), .006)
    return e

def head(x, y, z):
    d = ell(x, y, z, (0, .2, -.1), (.39, .43, .47))                     # the cranium, long at the back
    d = smin(d, ell(x, y, z, (0, .03, .1), (.33, .35, .35)), .12)       # the face's mass
    for s in (-1, 1):
        d = smax(d, -ell(x, y, z, (s*.43, .22, .12), (.09, .12, .14)), .08)             # the temples, pinched in
        d = smin(d, cap(x, y, z, (s*.31, .27, .2), (s*.05, .165, .405), .06, .05), .07)  # the brow ridge, knotted down to the nose
        d = smin(d, ell(x, y, z, (s*.235, -.015, .27), (.11, .07, .09)), .06)             # the cheekbones
        d = smax(d, -sph(x, y, z, (s*.143, .1, .375), .08), .03)                          # the eye sockets
        d = smax(d, -cap(x, y, z, (s*.21, .005, .33), (s*.29, -.07, .26), .02), .03)      # the hollow under the cheekbone
        d = smin(d, ell(x, y, z, (s*.14, .025, .395), (.05, .02, .03)), .025)             # bags under the eyes
    d = smin(d, sph(x, y, z, (0, .215, .39), .05), .06)                                   # the knot between the brows
    # the nose: long and hooked, a bulb at its tip
    pts = bez((0, .17, .41), (0, .08, .49), (0, -.02, .6), (0, -.075, .6), 7)
    d = smin(d, chain(x, y, z, pts, np.linspace(.05, .05, 7)), .05)
    d = smin(d, ell(x, y, z, (0, .07, .44), (.07, .09, .05)), .05)                        # a broad bridge
    d = smin(d, ell(x, y, z, (0, -.085, .59), (.055, .06, .05)), .035)
    d = smin(d, ell(x, y, z, (0, -.12, .575), (.035, .03, .035)), .04)                   # the tip hooks down
    for s in (-1, 1):
        d = smin(d, sph(x, y, z, (s*.052, -.118, .545), .034), .025)                      # the nostril wings
        d = smax(d, -ell(x, y, z, (s*.032, -.14, .56), (.016, .012, .024)), .01)          # the nostrils
        d = smax(d, -cap(x, y, z, (s*.08, -.1, .52), (s*.22, -.225, .405), .01), .018)    # the folds from nose to mouth
    # the jaw and chin
    d = smin(d, ell(x, y, z, (0, -.27, .16), (.29, .17, .27)), .1)
    d = smin(d, sph(x, y, z, (0, -.405, .33), .07), .08)
    # the lips: a wide mouth, its corners turned up in a leer
    xs = np.linspace(-.215, .215, 11)
    def lip(y0, bend, r0, z0): return chain(x, y, z, [(a, y0 + bend*(a/.2)**2, z0 - 1.55*a*a) for a in xs], r0*(1 - .55*(xs/.215)**2))
    d = smin(d, lip(-.205, .045, .028, .445), .045)
    d = smin(d, lip(-.258, .03, .032, .438), .045)
    slit = ell(x, y + .234 - .04*(x/.2)**2, z, (0, 0, .38), (.19, .009, .12))
    d = smax(d, -slit, .008)
    d = smax(d, -ell(x, y, z, (0, -.236, .28), (.18, .045, .14)), .02)                   # the mouth's cavity
    # the neck, cut flat for a bust
    d = smin(d, cap(x, y, z, (0, -.2, -.1), (0, -.9, -.16), .2, .23), .12)
    for s in (-1, 1):   # the tendons down the neck
        d = smin(d, cap(x, y, z, (s*.18, -.33, -.02), (s*.07, -.8, .07), .035, .045), .05)
    d = np.maximum(d, -(y + .72))
    # the eyelids: shells round the eyes, the upper heavy and slanting down to the nose (a glare)
    for s, c in zip((-1, 1), EYE):
        rx, ry, rz = x - c[0], y - c[1], z - c[2]
        shell = np.abs(length(rx, ry, rz) - (EYER + .008)) - .011
        up = np.maximum(shell, np.maximum(-(ry - (.006 + .3*s*rx)), -rz + .005))
        lo = np.maximum(shell, np.maximum(ry + .032 - .1*s*rx, -rz + .012))
        d = smin(d, np.minimum(up, lo), .012)
    for s in (-1, 1): d = smin(d, ear(x, y, z, s), .05)
    return d

def teeth(x, y, z):
    r = np.random.default_rng(5); d = np.full(x.shape, 9, f32)
    for a in np.linspace(-.15, .15, 7):   # the upper teeth: crooked, uneven, hanging from behind the lip
        if abs(a) < .03 and r.random() < .6: continue   # a gap at the front
        zz = .44 - 1.55*a*a - .018; top = -.21 + .04*(a/.2)**2
        ln = .03 + r.random()*.022; tilt = (r.random() - .5)*.025
        d = np.minimum(d, cap(x, y, z, (a, top, zz - .005), (a + tilt, top - ln, zz + .004), .016, .006))
    for s in (-1, 1):   # the tusks: from the lower jaw, up past the lip
        a = s*.105; zz = .452 - 1.55*a*a
        d = np.minimum(d, chain(x, y, z, [(a, -.28, zz - .02), (a + s*.008, -.225, zz + .012), (a + s*.022, -.168, zz + .028)], [.026, .019, .005]))
    for a in (-.05, .012, .06):   # small lower teeth
        zz = .445 - 1.55*a*a - .02
        d = np.minimum(d, cap(x, y, z, (a, -.268, zz), (a + .004, -.24, zz + .006), .012, .006))
    return d

def mesh_sdf(f, lo, hi, step, chunk=24):
    xs, ys, zs = [np.arange(lo[i], hi[i], step, dtype=f32) for i in range(3)]
    vol = np.empty((len(xs), len(ys), len(zs)), f32)
    Y, Z = np.meshgrid(ys, zs, indexing='ij')
    for i in range(0, len(xs), chunk):
        X = xs[i:i + chunk][:, None, None]
        vol[i:i + chunk] = f(np.broadcast_to(X, (len(X),) + Y.shape), Y[None], Z[None])
    v, fc, n, _ = marching_cubes(vol, 0, spacing=(step,)*3)
    return v + np.array(lo, f32), fc   # (skimage's winding already faces out of a distance field: normals outward)

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

def detail(v, n):   # what a sculptor adds by hand, pushed along the normals
    x, y, z = v[:, 0], v[:, 1], v[:, 2]; h = np.zeros(len(v))
    # forehead furrows: wavy horizontal creases
    yy = y + .018*np.sin(x*9 + 1) + .01*fbm(x*6, y*6, z*6)
    h -= .006*(.4 + .6*np.clip(fbm(x*5 + 7, y*3, z*5) + .5, 0, 1))*(1 - np.abs(np.sin(yy*50 + 2*np.sin(x*7))))**7*sstep(.25, .3, y)*sstep(.52, .44, y)*sstep(.3, .22, np.abs(x))*(z > .1)
    # the knot between the brows: vertical frown lines
    h -= .005*(1 - np.abs(np.sin(x*110)))**8*sstep(.14, .17, y)*sstep(.3, .24, y)*sstep(.07, .04, np.abs(x))*(z > .3)
    # snarl lines across the bridge of the nose
    h -= .004*(1 - np.abs(np.sin(y*140)))**6*sstep(.03, .06, y)*sstep(.17, .13, y)*sstep(.05, .03, np.abs(x))*(z > .4)
    for s in (-1, 1):   # crow's feet, fanning from the outer corners of the eyes
        cx, cy = s*.215, .09; r = length(x - cx, y - cy); ang = np.arctan2(y - cy, (x - cx)*s)
        h -= .0045*(1 - np.abs(np.sin(ang*7 + r*20)))**10*sstep(.02, .04, r)*sstep(.11, .07, r)*(s*x > .17)*(z > .2)
        # lines under the eyes
        r2 = length(x - s*.14, (y - .06)*1.3, 0)
        h -= .003*(1 - np.abs(np.sin(r2*140)))**8*sstep(.05, .06, r2)*sstep(.1, .08, r2)*(y < .07)*(z > .3)
    # wrinkles round the neck and the corners of the mouth
    h -= .003*(.3 + .7*np.clip(fbm(x*6, y*2, z*6 + 4) + .5, 0, 1))*(1 - np.abs(np.sin(y*38 + 1.5*np.sin(x*9) + 3*fbm(x*3, 0*y, z*3))))**8*sstep(-.45, -.5, y)*sstep(-.7, -.65, y)
    # a lumpy, asymmetric skin
    h += .006*fbm(x*9 + 3, y*9, z*9)
    # warts, a cluster on the nose, the chin, a cheek and the scalp
    for (c, a, r) in [((.03, -.02, .6), .012, .011), ((-.02, .05, .55), .008, .008), ((.04, -.03, .59), .006, .006),
                      ((.23, .05, .3), .013, .012), ((-.08, -.41, .37), .01, .01), ((-.06, -.4, .38), .006, .006),
                      ((-.18, .44, .2), .014, .014), ((.12, .5, .05), .01, .01), ((-.26, -.1, .31), .007, .008),
                      ((.3, .25, .22), .008, .009)]:
        dd = length(x - c[0], y - c[1], z - c[2]); h += a*np.exp(-(dd/r)**2*2.2)
    return v + n*h[:, None]

def masks(v):   # per-vertex colour masks for the shader: R warm (nose, ears, lids), G the mouth's inside, B the lips
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    warm = np.clip(np.exp(-(length(x, y + .07, z - .6)/.09)**2) + sstep(.4, .65, np.abs(x))*.4
                   + sum(np.exp(-(length(x - c[0], y - c[1], z - c[2])/.07)**2) for c in EYE)*.6
                   + sum(np.exp(-(length(x - s*.2, y + .12, z - .35)/.08)**2) for s in (-1, 1))*.4, 0, 1)
    inside = ((np.abs(x) < .19) & (y > -.27) & (y < -.2) & (z < .44 - 1.55*x*x)).astype(float)
    lips = np.clip(np.exp(-((y + .234 - .04*(x/.2)**2)/.035)**2)*sstep(.24, .18, np.abs(x))*(z > .38), 0, 1)
    return np.stack([warm, inside, lips, np.ones_like(x)], 1)

CACHE = os.path.join(os.path.dirname(OUT), 'goblin_hd_mesh.npz')
t0 = time.time()
if os.path.exists(CACHE) and '--remesh' not in args:
    M = np.load(CACHE); hv, hf, tv, tf = M['hv'], M['hf'], M['tv'], M['tf']
else:
    step = opt('--step', .0045)
    hv, hf = mesh_sdf(head, (-.95, -.74, -.7), (.95, .78, .75), step)
    hv = relax(hv, hf); hv = detail(hv, vnormals(hv, hf)); hv = relax(hv, hf, 1, .3)
    tv, tf = mesh_sdf(teeth, (-.2, -.32, .3), (.2, -.14, .56), .0025); tv = relax(tv, tf)
    np.savez(CACHE, hv=hv, hf=hf, tv=tv, tf=tf)
print(f'sculpt: head {len(hf)} tris, teeth {len(tf)} tris, {time.time() - t0:.0f}s', flush=True)

# ---------------------------------------------------------------- the snarl: where each point goes ----
HINGE = np.array([0, -.16, .02])
def snarl(v, jaw_all=False):
    x, y, z = v[:, 0], v[:, 1], v[:, 2]; o = v.copy()
    # the jaw drops about its hinge (everything below the mouth's line, fading out up the cheeks and down the neck)
    wj = np.ones(len(v)) if jaw_all else sstep(-.215, -.26, y - .04*(x/.2)**2)*sstep(.34, .22, np.abs(x))*sstep(-.1, .1, z)
    a = .2*wj; dy, dz = y - HINGE[1], z - HINGE[2]
    o[:, 1] = HINGE[1] + dy*np.cos(a) - dz*np.sin(a); o[:, 2] = HINGE[2] + dy*np.sin(a) + dz*np.cos(a)
    # the upper lip curls up at the sides, baring the teeth
    wl = np.exp(-((y + .205)/.03)**2)*sstep(.02, .1, np.abs(x))*sstep(.24, .16, np.abs(x))*(z > .36)
    o[:, 1] += .02*wl; o[:, 2] -= .004*wl
    # the nose wrinkles up, the nostrils flare
    wn = np.exp(-(length(x, y + .09, z - .56)/.11)**2)
    o[:, 1] += .016*wn; o[:, 0] += .01*np.sign(x)*np.exp(-(length(np.abs(x) - .05, y + .12, z - .54)/.04)**2)
    # the brows knot down and in
    for s in (-1, 1):
        wb = np.exp(-(length(x - s*.1, y - .2, z - .38)/.09)**2)
        o[:, 1] -= .02*wb; o[:, 0] -= s*.008*wb
    # the ears pin back and down
    wa = sstep(.36, .7, np.abs(x)); o[:, 1] -= .09*wa*sstep(.3, .9, np.abs(x)); o[:, 2] -= .08*wa
    return o

# ---------------------------------------------------------------- Blender: the scene ----
def E(x, y, z): return (x, -z, y)
def Ev(v): return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def make(name, v, fc, mat, smooth=True):
    me = bpy.data.meshes.new(name); V = Ev(v)
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.astype(f32).ravel())
    me.loops.add(fc.size); me.loops.foreach_set('vertex_index', fc.astype(np.int32).ravel())
    me.polygons.add(len(fc)); me.polygons.foreach_set('loop_start', np.arange(0, fc.size, 3, dtype=np.int32))
    me.polygons.foreach_set('use_smooth', np.full(len(fc), smooth))
    me.update(); me.validate()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); me.materials.append(mat)
    return ob

# --- node helpers
def nodes(mat): mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear(); return nt
def N(nt, kind, loc=(0, 0), **kw):
    n = nt.nodes.new(kind); n.location = loc
    for k, val in kw.items():
        if k in n.inputs.keys() if hasattr(n.inputs, 'keys') else False: n.inputs[k].default_value = val
        else: setattr(n, k, val)
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

def skin_mat():
    m = bpy.data.materials.new('skin'); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (1400, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (1100, 0))
    L(nt, b.outputs[0], out.inputs[0])
    tc = N(nt, 'ShaderNodeTexCoord', (-1400, 0)); co = tc.outputs['Object']
    at = N(nt, 'ShaderNodeAttribute', (-1400, -400)); at.attribute_name = 'mask'
    sep = N(nt, 'ShaderNodeSeparateColor', (-1200, -400)); L(nt, at.outputs['Color'], sep.inputs[0])
    # mottling: a large, soft blotchiness, and a finer one
    n1 = N(nt, 'ShaderNodeTexNoise', (-1100, 300)); n1.inputs['Scale'].default_value = 4; n1.inputs['Detail'].default_value = 6; n1.inputs['Roughness'].default_value = .6
    L(nt, co, n1.inputs['Vector'])
    r1 = ramp(nt, [(.35, (.030, .046, .012)), (.55, (.070, .098, .026)), (.72, (.11, .12, .035))], (-850, 300)); L(nt, n1.outputs['Fac'], r1.inputs[0])
    n2 = N(nt, 'ShaderNodeTexNoise', (-1100, 0)); n2.inputs['Scale'].default_value = 28; n2.inputs['Detail'].default_value = 3
    L(nt, co, n2.inputs['Vector'])
    c = mix(nt, r1.outputs[0], (.05, .055, .018), n2.outputs['Fac'], 'MULTIPLY', (-600, 250))
    c = mix(nt, c, r1.outputs[0], .45, 'MIX', (-450, 250))
    # liver spots
    vo = N(nt, 'ShaderNodeTexVoronoi', (-1100, -150)); vo.inputs['Scale'].default_value = 22; vo.inputs['Randomness'].default_value = 1
    L(nt, co, vo.inputs['Vector'])
    rs = ramp(nt, [(.0, (1, 1, 1)), (.09, (1, 1, 1)), (.16, (0, 0, 0))], (-850, -150)); L(nt, vo.outputs['Distance'], rs.inputs[0])
    n3 = N(nt, 'ShaderNodeTexNoise', (-1100, -300)); n3.inputs['Scale'].default_value = 9; L(nt, co, n3.inputs['Vector'])
    gs = N(nt, 'ShaderNodeMath', (-700, -200)); gs.operation = 'MULTIPLY'; L(nt, rs.outputs[0], gs.inputs[0]); L(nt, n3.outputs['Fac'], gs.inputs[1])
    gs2 = N(nt, 'ShaderNodeMath', (-560, -200)); gs2.operation = 'MULTIPLY'; gs2.inputs[1].default_value = 1.1; L(nt, gs.outputs[0], gs2.inputs[0])
    c = mix(nt, c, (.045, .032, .01), gs2.outputs[0], 'MIX', (-300, 200))
    # warm where the blood is near the surface: the nose, the ears, round the eyes
    c = mix(nt, c, (.13, .07, .035), sep.outputs[0], 'MIX', (-150, 150))
    c = mix(nt, c, (.10, .035, .025), sep.outputs[2], 'MIX', (0, 150))          # the lips
    c = mix(nt, c, (.06, .006, .006), sep.outputs[1], 'MIX', (150, 150))       # the mouth's inside
    # dirt in the creases (pointiness: concave is low)
    geo = N(nt, 'ShaderNodeNewGeometry', (-600, -500))
    rp = ramp(nt, [(.44, (.25, .22, .15)), (.5, (1, 1, 1))], (-350, -500)); L(nt, geo.outputs['Pointiness'], rp.inputs[0])
    c = mix(nt, c, rp.outputs[0], 1, 'MULTIPLY', (350, 150))
    L(nt, c, b.inputs['Base Color'])
    # skin: subsurface, blood-red under the green; roughness oilier on the nose and brow
    b.inputs['Subsurface Weight'].default_value = .35; b.inputs['Subsurface Radius'].default_value = (1, .42, .25)
    b.inputs['Subsurface Scale'].default_value = .045
    sw = N(nt, 'ShaderNodeMapRange', (900, -350)); sw.inputs['To Min'].default_value = .3; sw.inputs['To Max'].default_value = .9
    L(nt, sep.outputs[0], sw.inputs['Value']); L(nt, sw.outputs[0], b.inputs['Subsurface Weight'])
    rr = ramp(nt, [(.3, (.34, .34, .34)), (.7, (.62, .62, .62))], (600, -150)); L(nt, n2.outputs['Fac'], rr.inputs[0])
    rrf = mix(nt, rr.outputs[0], (.3, .3, .3), sep.outputs[0], 'MIX', (800, -150))
    rrf = mix(nt, rrf, (.2, .2, .2), sep.outputs[1], 'MIX', (900, -150))
    L(nt, rrf, b.inputs['Roughness'])
    b.inputs['Specular IOR Level'].default_value = .55; b.inputs['Sheen Weight'].default_value = .15
    # pores and fine wrinkles, as bump
    vp = N(nt, 'ShaderNodeTexVoronoi', (-200, -700)); vp.inputs['Scale'].default_value = 260; L(nt, co, vp.inputs['Vector'])
    bp = N(nt, 'ShaderNodeBump', (300, -700)); bp.inputs['Strength'].default_value = .22; bp.inputs['Distance'].default_value = .001
    L(nt, vp.outputs['Distance'], bp.inputs['Height'])
    mp = N(nt, 'ShaderNodeMapping', (-400, -900)); mp.inputs['Scale'].default_value = (1, 1, 4); L(nt, co, mp.inputs['Vector'])
    nw = N(nt, 'ShaderNodeTexNoise', (-200, -900)); nw.inputs['Scale'].default_value = 60; nw.inputs['Detail'].default_value = 8; nw.inputs['Distortion'].default_value = .6
    L(nt, mp.outputs[0], nw.inputs['Vector'])
    bw = N(nt, 'ShaderNodeBump', (500, -800)); bw.inputs['Strength'].default_value = .18; bw.inputs['Distance'].default_value = .002
    L(nt, nw.outputs['Fac'], bw.inputs['Height']); L(nt, bp.outputs[0], bw.inputs['Normal'])
    L(nt, bw.outputs[0], b.inputs['Normal'])
    return m

def eye_mat():
    m = bpy.data.materials.new('eye'); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (1200, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (900, 0)); L(nt, b.outputs[0], out.inputs[0])
    tc = N(nt, 'ShaderNodeTexCoord', (-1000, 0))
    sep = N(nt, 'ShaderNodeSeparateXYZ', (-800, 0)); L(nt, tc.outputs['Object'], sep.inputs[0])
    # the object's local -Y looks forward: how far from the gaze axis, and a slit pupil (narrow in x)
    def m_(op, a, b_, loc):
        n = N(nt, 'ShaderNodeMath', loc); n.operation = op
        for i, val in enumerate((a, b_)):
            if isinstance(val, (int, float)): n.inputs[i].default_value = val
            else: L(nt, val, n.inputs[i])
        return n.outputs[0]
    R = EYER
    rad = m_('SQRT', m_('ADD', m_('POWER', sep.outputs['X'], 2, (-600, 100)), m_('POWER', sep.outputs['Z'], 2, (-600, -50)), (-450, 50)), 0, (-300, 50))
    radn = m_('DIVIDE', rad, R, (-150, 50))
    slit = m_('SQRT', m_('ADD', m_('POWER', m_('MULTIPLY', sep.outputs['X'], 3.2, (-600, -200)), 2, (-450, -200)), m_('POWER', sep.outputs['Z'], 2, (-450, -300)), (-300, -250)), 0, (-150, -250))
    front = m_('LESS_THAN', sep.outputs['Y'], 0, (-150, 250))
    iris = m_('MULTIPLY', m_('LESS_THAN', radn, .5, (0, 50)), front, (150, 50))
    pupil = m_('MULTIPLY', m_('LESS_THAN', m_('DIVIDE', slit, R, (0, -250)), .42, (150, -250)), front, (300, -250))
    # iris: amber, darker at its rim, streaked
    ns = N(nt, 'ShaderNodeTexNoise', (-300, 400)); ns.inputs['Scale'].default_value = 90; ns.inputs['Detail'].default_value = 4
    L(nt, tc.outputs['Object'], ns.inputs['Vector'])
    ir = ramp(nt, [(0, (.9, .55, .02)), (.35, (.75, .32, .01)), (.46, (.25, .08, 0)), (.5, (.05, .02, 0))], (150, 350))
    rn = m_('ADD', radn, m_('MULTIPLY', ns.outputs['Fac'], .12, (0, 450)), (150, 480)); L(nt, rn, ir.inputs[0])
    # the white: yellowed, bloodshot towards the edges
    vn = N(nt, 'ShaderNodeTexNoise', (-300, 700)); vn.inputs['Scale'].default_value = 45; vn.inputs['Detail'].default_value = 8; vn.inputs['Distortion'].default_value = 1.5
    L(nt, tc.outputs['Object'], vn.inputs['Vector'])
    vr = ramp(nt, [(.47, (0, 0, 0)), (.5, (1, 1, 1)), (.53, (0, 0, 0))], (0, 700)); L(nt, vn.outputs['Fac'], vr.inputs[0])
    vm = m_('MULTIPLY', vr.outputs[0], m_('MULTIPLY', radn, .9, (150, 600)), (300, 650))
    white = mix(nt, (.55, .42, .2), (.35, .03, .02), vm, 'MIX', (450, 650))
    col = mix(nt, white, ir.outputs[0], iris, 'MIX', (600, 400))
    col = mix(nt, col, (0, 0, 0), pupil, 'MIX', (750, 300))
    L(nt, col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .3; b.inputs['Coat Weight'].default_value = 1; b.inputs['Coat Roughness'].default_value = .02
    b.inputs['Subsurface Weight'].default_value = .2; b.inputs['Subsurface Radius'].default_value = (1, .3, .2); b.inputs['Subsurface Scale'].default_value = .01
    # a faint glow in the iris
    em = m_('MULTIPLY', iris, m_('SUBTRACT', 1, pupil, (450, -150)), (600, -150))
    L(nt, ir.outputs[0], b.inputs['Emission Color']); L(nt, m_('MULTIPLY', em, .6, (750, -150)), b.inputs['Emission Strength'])
    return m

def teeth_mat():
    m = bpy.data.materials.new('teeth'); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (900, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (600, 0)); L(nt, b.outputs[0], out.inputs[0])
    tc = N(nt, 'ShaderNodeTexCoord', (-800, 0)); sep = N(nt, 'ShaderNodeSeparateXYZ', (-600, 0)); L(nt, tc.outputs['Object'], sep.inputs[0])
    ns = N(nt, 'ShaderNodeTexNoise', (-600, 300)); ns.inputs['Scale'].default_value = 60; L(nt, tc.outputs['Object'], ns.inputs['Vector'])
    r = ramp(nt, [(.3, (.42, .3, .12)), (.6, (.62, .52, .3)), (.8, (.7, .62, .42))], (-200, 200))
    ad = N(nt, 'ShaderNodeMath', (-400, 200)); ad.operation = 'ADD'; L(nt, ns.outputs['Fac'], ad.inputs[0]); ad.inputs[1].default_value = .0
    L(nt, ad.outputs[0], r.inputs[0]); L(nt, r.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .35; b.inputs['Subsurface Weight'].default_value = .3
    b.inputs['Subsurface Radius'].default_value = (1, .8, .5); b.inputs['Subsurface Scale'].default_value = .01
    b.inputs['Coat Weight'].default_value = .4; b.inputs['Coat Roughness'].default_value = .1
    return m

def brass_mat():
    m = bpy.data.materials.new('brass'); nt = nodes(m)
    out = N(nt, 'ShaderNodeOutputMaterial', (600, 0)); b = N(nt, 'ShaderNodeBsdfPrincipled', (300, 0)); L(nt, b.outputs[0], out.inputs[0])
    tc = N(nt, 'ShaderNodeTexCoord', (-500, 0)); ns = N(nt, 'ShaderNodeTexNoise', (-300, 0)); ns.inputs['Scale'].default_value = 80
    L(nt, tc.outputs['Object'], ns.inputs['Vector'])
    r = ramp(nt, [(.4, (.95, .66, .28)), (.62, (.28, .2, .08))], (0, 100)); L(nt, ns.outputs['Fac'], r.inputs[0])
    L(nt, r.outputs[0], b.inputs['Base Color'])
    rr = ramp(nt, [(.4, (.2, .2, .2)), (.62, (.55, .55, .55))], (0, -150)); L(nt, ns.outputs['Fac'], rr.inputs[0]); L(nt, rr.outputs[0], b.inputs['Roughness'])
    b.inputs['Metallic'].default_value = 1
    return m

# --- the objects
skin = make('goblin', hv, hf, skin_mat())
M4 = masks(hv); ca = skin.data.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', M4.astype(f32).ravel())
tth = make('teeth', tv, tf, teeth_mat())
# the snarl as shape keys on the head and teeth (the lower teeth and tusks go wholly with the jaw)
for ob, v, jaw in ((skin, hv, None), (tth, tv, tv[:, 1] < -.245)):
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='Snarl')
    s = snarl(v)
    if jaw is not None: s[jaw] = snarl(v[jaw], jaw_all=True)[:]
    k.data.foreach_set('co', Ev(s).astype(f32).ravel())
emat = eye_mat(); eyes = []
for c in EYE:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=EYER, location=E(*c))
    e = bpy.context.object; e.data.materials.append(emat); bpy.ops.object.shade_smooth(); eyes.append(e)
# a brass ring through the right ear's lower edge
o, u, v, w = ear_frame(1); p = o + u*.2*EARL + v*(-ear_hw(.2) + .07*.04 - .004)
cand = hv[hv[:, 0] > .42]; p = cand[np.argmin(np.linalg.norm(cand - p, axis=1))] + v*.012
bpy.ops.mesh.primitive_torus_add(major_radius=.045, minor_radius=.0075, major_segments=64, minor_segments=16, location=E(*(p - v*.02)))
ring = bpy.context.object; ring.data.materials.append(brass_mat()); bpy.ops.object.shade_smooth()
ax = mathutils.Vector(E(*u)); ring.rotation_mode = 'QUATERNION'; ring.rotation_quaternion = mathutils.Vector((0, 0, 1)).rotation_difference(ax)
# the body the head turns with: everything parented to one empty at the neck
root = bpy.data.objects.new('root', None); sc.collection.objects.link(root); root.location = E(0, -.3, -.05)
bpy.context.view_layer.update()   # (so root's matrix is current: otherwise the parenting below shifts everything by its location)
for ob in (skin, tth, ring, *eyes):
    mw = ob.matrix_world.copy(); ob.parent = root; ob.matrix_parent_inverse = root.matrix_world.inverted(); ob.matrix_world = mw


# --- lights: a warm key from above left, a cool rim behind right (it shines through the ears), a dim fill
def area(name, loc, target, power, color, size):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.color = color; ld.size = size
    ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (mathutils.Vector(target) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob
T = E(0, .02, .1)
key = area('key', E(-1.6, 1.5, 2.2), T, 380, (1, .86, .7), 1.2)
rim = area('rim', E(1.3, .7, -2.0), E(.5, .2, -.1), 2400, (.55, .7, 1), 1.0)
rim2 = area('rim2', E(-1.6, .6, -1.9), E(-.5, .2, -.1), 1800, (.75, .82, 1), .8)
fill = area('fill', E(1.8, -.4, 2.0), T, 60, (.9, .95, 1), 2.0)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.004, .005, .007, 1)
# a backdrop: a soft gradient card far behind
bpy.ops.mesh.primitive_plane_add(size=12, location=E(0, 0, -3)); bd = bpy.context.object; bd.rotation_euler = (math.pi/2, 0, 0)
bm_ = bpy.data.materials.new('back'); nt = nodes(bm_); o_ = N(nt, 'ShaderNodeOutputMaterial', (600, 0)); em_ = N(nt, 'ShaderNodeEmission', (300, 0))
L(nt, em_.outputs[0], o_.inputs[0]); tc = N(nt, 'ShaderNodeTexCoord', (-400, 0)); gr = N(nt, 'ShaderNodeTexGradient', (-200, 0)); gr.gradient_type = 'SPHERICAL'
mp = N(nt, 'ShaderNodeMapping', (-300, 0)); mp.inputs['Location'].default_value = (-.08, -.22, 0); mp.inputs['Scale'].default_value = (.25, .25, .25)
L(nt, tc.outputs['Object'], mp.inputs[0]); L(nt, mp.outputs[0], gr.inputs[0])
rb = ramp(nt, [(0, (.004, .005, .006)), (.9, (.03, .04, .035))], (0, 0)); L(nt, gr.outputs['Fac'], rb.inputs[0]); L(nt, rb.outputs[0], em_.inputs[0])
bd.data.materials.append(bm_); bd.visible_shadow = False

# --- camera: a three-quarter portrait
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 85; cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 4.5
def aim(loc, tgt): cam.location = loc; cam.rotation_euler = (mathutils.Vector(tgt) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
aim(E(1.95, .2, 4.9), E(.12, -.1, .05)); cam.data.dof.focus_distance = (cam.location - mathutils.Vector(E(.14, .1, .4))).length

# --- render settings
r = sc.render; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = opt('--samples', 256 if MODE != 'anim' else 24); sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.use_adaptive_sampling = True; sc.cycles.max_bounces = 8
res = opt('--res', 1080 if MODE != 'anim' else 540); r.resolution_x = int(res*1.4)//2*2; r.resolution_y = res; r.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
r.threads_mode = 'FIXED'; r.threads = os.cpu_count()
snarlkeys = [skin.data.shape_keys.key_blocks['Snarl'], tth.data.shape_keys.key_blocks['Snarl']]
for k in snarlkeys: k.slider_min = -.5; k.value = opt('--snarl', 0.)


# ---------------------------------------------------------------- bake: a real-time version for the visualiser ----
# The sculpt is ~650k triangles and Cycles takes minutes a frame. A game-style version: a low mesh (~40k triangles), its
# detail baked into textures from the sculpt (colour with the creases' shade multiplied in, and an object-space normal
# map carrying the wrinkles, warts and pores), how thin it is at each corner (so the ears can glow when lit from behind),
# and the snarl as each corner's move. Plus a much lower mesh with baked vertex colours for simple mode.
def world_vis(ob):   # an object's corners in the visualiser's axes (Blender's world, turned back)
    ob.data.update(); M = ob.matrix_world; out = np.empty((len(ob.data.vertices), 3))
    for i, vv in enumerate(ob.data.vertices): w_ = M @ vv.co; out[i] = (w_.x, w_.z, -w_.y)
    return out
def low_copy(ob, name, ratio):
    me = ob.data.copy(); lo = bpy.data.objects.new(name, me); sc.collection.objects.link(lo); lo.matrix_world = ob.matrix_world.copy()
    if me.shape_keys: lo.shape_key_clear()
    lo.modifiers.clear()
    if ratio < 1:
        m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio
        bpy.context.view_layer.objects.active = lo; bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True)
        bpy.ops.object.modifier_apply(modifier='dec')
    return lo
def thickness(v, n):   # how far in along the inward normal before leaving the head again (the ears are thin)
    t = np.full(len(v), .12)
    was_in, done = np.zeros(len(v), bool), np.zeros(len(v), bool)   # (smoothing leaves some corners a hair outside: only an exit after being inside counts)
    for s_ in np.linspace(.002, .12, 60):
        p_ = v - n*s_; d_ = head(p_[:, 0], p_[:, 1], p_[:, 2])
        out_ = (d_ > 0) & was_in & ~done; t[out_] = s_; done |= out_; was_in |= d_ < 0
    return t
def bake(outdir):
    os.makedirs(outdir, exist_ok=True); TEX = opt('--tex', 2048)
    for k in snarlkeys: k.value = 0
    # the low pieces: part 1 skin, 2 teeth, 3 eyes, 4 brass
    pieces = [(skin, opt('--tris', 40000)/len(skin.data.polygons), 1), (tth, 3000/len(tth.data.polygons), 2)] + [(e, 1, 3) for e in eyes] + [(ring, 1, 4)]
    lows, info = [], []
    for ob, ratio, part in pieces:
        lo = low_copy(ob, ob.name + '_low', min(1, ratio))
        if ob in eyes or ob is ring:   # fewer segments than the render's
            lo.modifiers.new('dec', 'DECIMATE').ratio = .35 if ob in eyes else .5
            bpy.context.view_layer.objects.active = lo; bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.ops.object.modifier_apply(modifier='dec')
        lows.append(lo); info.append(part)
    # each low piece's corners (visualiser axes), the snarl's moves, and thickness, before they're joined
    per = []
    for lo, part in zip(lows, info):
        v = world_vis(lo); nb = np.array([tuple(x.normal) for x in lo.data.vertices]); M3 = lo.matrix_world.to_3x3()
        nv = np.array([(lambda w_: (w_.x, w_.z, -w_.y))(M3 @ mathutils.Vector(x)) for x in nb]); nv /= np.linalg.norm(nv, axis=1, keepdims=True) + 1e-9
        if part == 1: mv = snarl(v) - v
        elif part == 2:
            sn = snarl(v); j = v[:, 1] < -.245; sn[j] = snarl(v[j], jaw_all=True); mv = sn - v
        else: mv = np.zeros_like(v)
        th = thickness(v, nv) if part == 1 else np.full(len(v), .12)
        a = lo.data.attributes.new('lmorph', 'FLOAT_VECTOR', 'POINT'); a.data.foreach_set('vector', mv.astype(f32).ravel())
        a = lo.data.attributes.new('lthick', 'FLOAT', 'POINT'); a.data.foreach_set('value', th.astype(f32))
        a = lo.data.attributes.new('lpart', 'FLOAT', 'POINT'); a.data.foreach_set('value', np.full(len(v), part, f32))
    # joined into one mesh, one texture atlas
    bpy.ops.object.select_all(action='DESELECT')
    for lo in lows: lo.select_set(True)
    bpy.context.view_layer.objects.active = lows[0]
    for lo in lows: mw = lo.matrix_world.copy(); lo.matrix_world = mw
    bpy.ops.object.join(); low = bpy.context.view_layer.objects.active; low.name = 'low'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    low.data.materials.clear()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=.003, area_weight=0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'low: {len(low.data.polygons)} tris, {len(low.data.vertices)} corners', flush=True)
    # the bake: from the sculpt (and its eyes, teeth and ring) onto the low mesh
    bm2 = bpy.data.materials.new('bake'); nt = nodes(bm2); img_node = N(nt, 'ShaderNodeTexImage', (0, 0)); nt.nodes.active = img_node
    N(nt, 'ShaderNodeOutputMaterial', (300, 0)); low.data.materials.append(bm2)
    sc.cycles.bake_type = 'COMBINED'; sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = .02; sc.render.bake.max_ray_distance = .06
    sc.render.bake.margin = 8; sc.world.light_settings.distance = .12
    for k in snarlkeys: k.value = 0
    def run(kind, name, samples, colorspace, **kw):
        img = bpy.data.images.new(name, TEX, TEX, float_buffer=False); img.colorspace_settings.name = colorspace; img_node.image = img
        sc.cycles.samples = samples
        bpy.ops.object.select_all(action='DESELECT')
        for ob in (skin, tth, ring, *eyes): ob.select_set(True)
        low.select_set(True); bpy.context.view_layer.objects.active = low
        t0 = time.time(); bpy.ops.object.bake(type=kind, **kw); print(f'bake {name}: {time.time() - t0:.0f}s', flush=True)
        img.filepath_raw = os.path.join(outdir, name + '.png'); img.file_format = 'PNG'; img.save(); return img
    run('DIFFUSE', 'color', 16, 'sRGB', pass_filter={'COLOR'})
    run('NORMAL', 'normal', 8, 'Non-Color', normal_space='OBJECT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
    run('AO', 'ao', 48, 'Non-Color')
    run('EMIT', 'emit', 4, 'sRGB')
    # the data: corners (visualiser axes), uv, snarl, thickness, part; triangles
    me = low.data; me.calc_loop_triangles()
    uvl = me.uv_layers.active.data; nl = len(me.loops)
    luv = np.empty(nl*2, f32); uvl.foreach_get('uv', luv); luv = luv.reshape(-1, 2)
    lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices)*3, f32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    get = lambda n, w_: (lambda a: (me.attributes[n].data.foreach_get('vector' if w_ == 3 else 'value', a), a)[1])(np.empty(len(me.vertices)*w_, f32))
    mo, th, pa = get('lmorph', 3).reshape(-1, 3), get('lthick', 1), get('lpart', 1)
    # one output corner per (vertex, uv) pair: seams split
    key = {}; outv = []; tris = []
    for t in me.loop_triangles:
        tri_ = []
        for l in t.loops:
            k_ = (lv[l], round(float(luv[l, 0]), 5), round(float(luv[l, 1]), 5))
            if k_ not in key: key[k_] = len(outv); outv.append((lv[l], luv[l, 0], luv[l, 1]))
            tri_.append(key[k_])
        tris.append(tri_)
    vi = np.array([o_[0] for o_ in outv]); uv = np.array([(o_[1], o_[2]) for o_ in outv], f32)
    pos = np.stack([co[vi, 0], co[vi, 2], -co[vi, 1]], 1)
    np.savez(os.path.join(outdir, 'lit.npz'), pos=pos, uv=uv, morph=mo[vi], thick=th[vi], part=pa[vi], tri=np.array(tris, np.int32))
    print(f'lit: {len(outv)} corners, {len(tris)} tris', flush=True)
    # simple mode's mesh: far fewer panes, each corner's colour baked from the sculpt
    lod = low_copy(skin, 'lod2d', 2400/len(skin.data.polygons)); tl = low_copy(tth, 'lodt', 240/len(tth.data.polygons))
    el = [low_copy(e, 'lode', 1) for e in eyes]
    for e in el:
        e.modifiers.new('dec', 'DECIMATE').ratio = .06
        bpy.context.view_layer.objects.active = e; bpy.ops.object.select_all(action='DESELECT'); e.select_set(True); bpy.ops.object.modifier_apply(modifier='dec')
    L2 = []
    for ob_, part in [(lod, 1), (tl, 2)] + [(e, 3) for e in el]:
        v = world_vis(ob_)
        if part == 1: mv = snarl(v) - v
        elif part == 2: sn = snarl(v); j = v[:, 1] < -.245; sn[j] = snarl(v[j], jaw_all=True); mv = sn - v
        else: mv = np.zeros_like(v)
        ob_.data.color_attributes.new('bk', 'BYTE_COLOR', 'POINT'); ob_.data.color_attributes.active_color = ob_.data.color_attributes['bk']
        sc.cycles.samples = 8
        bpy.ops.object.select_all(action='DESELECT')
        for o2 in (skin, tth, *eyes): o2.select_set(True)
        ob_.select_set(True); bpy.context.view_layer.objects.active = ob_
        sc.render.bake.target = 'VERTEX_COLORS'; bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}); sc.render.bake.target = 'IMAGE_TEXTURES'
        col = np.empty(len(ob_.data.vertices)*4, f32); ob_.data.color_attributes['bk'].data.foreach_get('color', col)
        ob_.data.calc_loop_triangles(); tr = np.array([tuple(t.vertices) for t in ob_.data.loop_triangles], np.int32)
        L2.append((v, tr, np.full(len(tr), part), mv, col.reshape(-1, 4)[:, :3]))
    np.savez(os.path.join(outdir, 'lod2d.npz'), *[a for piece in L2 for a in piece])
    print('lod2d:', sum(len(x[1]) for x in L2), 'tris', flush=True)

if MODE == 'anim':
    F = opt('--frames', 120); sc.frame_start, sc.frame_end = 1, F; r.fps = 24
    root.rotation_mode = 'XYZ'
    def kf(ob, path, frame, val, idx=None):
        if idx is None: setattr(ob, path, val); ob.keyframe_insert(path, frame=frame)
        else: getattr(ob, path)[idx] = val; ob.keyframe_insert(path, index=idx, frame=frame)
    # the head: turns from its left to its right, tips down to glare as it snarls, then back
    for f, yaw, tip in ((1, .35, 0), (F*.35, -.05, .04), (F*.5, -.12, .12), (F*.75, -.3, .06), (F, -.45, 0)):
        kf(root, 'rotation_euler', int(f), yaw, 2); kf(root, 'rotation_euler', int(f), tip, 0)
    for k in snarlkeys:
        for f, val in ((1, -.3), (F*.3, -.2), (F*.42, 1), (F*.62, 1), (F*.78, .1), (F, -.3)): k.value = val; k.keyframe_insert('value', frame=int(f))
    # the eyes: a glance round, then fixed on us for the snarl
    for e in eyes:
        e.rotation_mode = 'XYZ'
        for f, (ex, ez) in ((1, (0, .35)), (F*.2, (.1, -.3)), (F*.35, (0, .15)), (F*.6, (-.05, .2)), (F, (0, .3))):
            e.rotation_euler = (ex, 0, ez); e.keyframe_insert('rotation_euler', frame=int(f))
    # the key light swings round the head: shadows sweep across the face
    pivot = bpy.data.objects.new('pivot', None); sc.collection.objects.link(pivot); pivot.location = T
    mw = key.matrix_world.copy(); key.parent = pivot; key.matrix_parent_inverse = pivot.matrix_world.inverted(); key.matrix_world = mw
    for f, a in ((1, -.5), (F, 1.9)): pivot.rotation_euler = (0, 0, a); pivot.keyframe_insert('rotation_euler', frame=int(f))
    for fc in (a for ob in (root, pivot, *eyes) for a in ob.animation_data.action.fcurves):
        for p in fc.keyframe_points: p.interpolation = 'BEZIER'; p.easing = 'EASE_IN_OUT'
    r.image_settings.file_format = 'FFMPEG'; r.ffmpeg.format = 'MPEG4'; r.ffmpeg.codec = 'H264'; r.ffmpeg.constant_rate_factor = 'HIGH'
    r.filepath = OUT; t0 = time.time(); bpy.ops.render.render(animation=True); print(f'anim: {F} frames in {time.time() - t0:.0f}s')
elif MODE == 'bake':
    bake(OUT)
elif MODE == 'blend':
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
else:
    r.image_settings.file_format = 'PNG'; r.filepath = OUT; t0 = time.time()
    bpy.ops.render.render(write_still=True); print(f'still: {OUT} in {time.time() - t0:.0f}s')
