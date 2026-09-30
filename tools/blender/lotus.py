# The lotus, modelled in Blender from Python (run with Blender's Python, e.g. the `bpy` package from PyPI:
#   python tools/blender/lotus.py out.glb   then   node tools/import-glb.mjs out.glb lotus --morph Open
# It's built in Blender's own orientation (Z up, facing the front view), like the manta: E() turns the visualiser's axes
# (x right, y up, z to the viewer) into Blender's. The flower opens upwards (the visualiser's +y).
#
# The pieces, each a material whose name starts with its part number:
#   1 the outer petals, 2 the middle petals, 3 the inner petals, 4 the seed pod, 5 the stamens, 6 the lily pad beneath,
#   7 the seeds in the pod (dark holes that glow on the downbeat).
# One shape key, "Open": the petals opened out; the visualiser plays it from -1 (closing to a bud) to 1 (fully open).
import bpy, bmesh, math, sys, mathutils

def E(x, y, z): return (x, -z, y)
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
mats = ['1_outer', '2_middle', '3_inner', '4_pod', '5_stamens', '6_pad', '7_seeds']
parts = []            # each face's part, in order of creation
opened = {}           # each vertex's position in the open pose (the shape key)

# ---- a petal: a thick, cupped spoon with a pointed tip, rising from the base at an angle, turned to its place ----
NU, NV = 5, 2
def petal(az, r0, L, W, tilt, tilt_open, cup, part):
    def pt(u, v, side, tl):
        w = W*math.sin(math.pi*min(1, u*1.15)**.7)*(1 - u**4) + .004             # widest a little past the middle, a point at the tip
        x, y = L*u, w*v
        z = cup*(v*v - .35)*w/W*.9 + .06*L*u*u + side*.008*(1 - u*.8)             # cupped across, curling up at the tip, thick
        # stand it up by its tilt (from lying flat to upright), out from the centre at r0, turned to its azimuth
        ca, sa = math.cos(tl), math.sin(tl)
        rx, rz = x*ca - z*sa, x*sa + z*ca
        rx += r0
        return (rx*math.cos(az) - y*math.sin(az), rz, rx*math.sin(az) + y*math.cos(az))
    grid = {}
    for side in (1, -1):
        for i in range(NU + 1):
            for j in range(NV + 1):
                u, v = i/NU, -1 + 2*j/NV
                p = pt(u, v, side, tilt)
                vert = bm.verts.new(E(*p))
                opened[vert] = E(*pt(u, v, side, tilt_open))
                grid[side, i, j] = vert
    def quad(a, b, c, d):
        bm.faces.new((a, b, c, d)); parts.append(part)
    for i in range(NU):
        for j in range(NV):
            quad(grid[1, i, j], grid[1, i + 1, j], grid[1, i + 1, j + 1], grid[1, i, j + 1])
            quad(grid[-1, i, j + 1], grid[-1, i + 1, j + 1], grid[-1, i + 1, j], grid[-1, i, j])
    for i in range(NU):   # the edges, closing the petal
        quad(grid[-1, i, 0], grid[-1, i + 1, 0], grid[1, i + 1, 0], grid[1, i, 0])
        quad(grid[1, i, NV], grid[1, i + 1, NV], grid[-1, i + 1, NV], grid[-1, i, NV])
    for j in range(NV):
        quad(grid[1, 0, j], grid[1, 0, j + 1], grid[-1, 0, j + 1], grid[-1, 0, j])
        quad(grid[-1, NU, j], grid[-1, NU, j + 1], grid[1, NU, j + 1], grid[1, NU, j])

rad = math.radians
for k in range(8):    # three rings, each turned half a petal from the one outside it
    petal(2*math.pi*k/8, .1, .62, .2, rad(38), rad(8), .1, 1)
for k in range(8):
    petal(2*math.pi*(k + .5)/8, .08, .52, .18, rad(56), rad(26), .09, 2)
for k in range(5):
    petal(2*math.pi*k/5 + .3, .06, .4, .15, rad(72), rad(48), .08, 3)

# ---- the seed pod: a flat-topped cone, its seeds dark holes in the top ----
def still(v): opened[v] = tuple(v.co)
N = 16
top = [bm.verts.new(E(.12*math.cos(2*math.pi*k/N), .12, .12*math.sin(2*math.pi*k/N))) for k in range(N)]
bot = [bm.verts.new(E(.06*math.cos(2*math.pi*k/N), .0, .06*math.sin(2*math.pi*k/N))) for k in range(N)]
for v in top + bot: still(v)
for k in range(N):
    bm.faces.new((bot[k], bot[(k + 1) % N], top[(k + 1) % N], top[k])); parts.append(4)
c = bm.verts.new(E(0, .125, 0)); still(c)
for k in range(N): bm.faces.new((top[k], top[(k + 1) % N], c)); parts.append(4)
cb = bm.verts.new(E(0, 0, 0)); still(cb)
for k in range(N): bm.faces.new((bot[(k + 1) % N], bot[k], cb)); parts.append(4)
for k in range(7):    # the seeds: one in the middle, six round it
    a, r = 2*math.pi*k/6, .065 if k < 6 else 0
    cx, cz = r*math.cos(a), r*math.sin(a)
    ring = [bm.verts.new(E(cx + .022*math.cos(2*math.pi*m/6), .128, cz + .022*math.sin(2*math.pi*m/6))) for m in range(6)]
    mid = bm.verts.new(E(cx, .132, cz))
    for v in ring + [mid]: still(v)
    for m in range(6): bm.faces.new((ring[m], ring[(m + 1) % 6], mid)); parts.append(7)

# ---- the stamens: a ring of thin spikes round the pod, leaning out as the flower opens ----
for k in range(20):
    a = 2*math.pi*k/20
    base = [(.13*math.cos(a) + .012*math.cos(a + d), .03, .13*math.sin(a) + .012*math.sin(a + d)) for d in (0, 2.1, 4.2)]
    tip = (.17*math.cos(a), .16, .17*math.sin(a)); tip_open = (.24*math.cos(a), .13, .24*math.sin(a))
    vs = [bm.verts.new(E(*b)) for b in base]; t = bm.verts.new(E(*tip))
    for v in vs: still(v)
    opened[t] = E(*tip_open)
    for m in range(3): bm.faces.new((vs[m], vs[(m + 1) % 3], t)); parts.append(5)

# ---- the lily pad beneath: a thin disc with its notch, a little below the flower ----
M = 20
def padpt(k, r, y): a = .25 + (2*math.pi - .5)*k/M; return (r*math.cos(a), y, r*math.sin(a))
up = [bm.verts.new(E(*padpt(k, .6, -.05 + .02*math.sin(k*1.7)))) for k in range(M + 1)]
dn = [bm.verts.new(E(*padpt(k, .6, -.07 + .02*math.sin(k*1.7)))) for k in range(M + 1)]
cu, cd = bm.verts.new(E(0, -.04, 0)), bm.verts.new(E(0, -.08, 0))
for v in up + dn + [cu, cd]: still(v)
for k in range(M):
    bm.faces.new((up[k + 1], up[k], cu)); parts.append(6)
    bm.faces.new((dn[k], dn[k + 1], cd)); parts.append(6)
    bm.faces.new((up[k], up[k + 1], dn[k + 1], dn[k])); parts.append(6)
bm.faces.new((cu, up[0], dn[0], cd)); parts.append(6)
bm.faces.new((up[M], cu, cd, dn[M])); parts.append(6)

# ---- the mesh, its parts, and the shape key ----
opened_by_index = {}
bm.verts.index_update()
for v, p in opened.items(): opened_by_index[v.index] = p
fparts = parts[:]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.faces.ensure_lookup_table()
for f, p in zip(bm.faces, fparts): f.material_index = p - 1
bmesh.ops.triangulate(bm, faces=bm.faces[:])
me = bpy.data.meshes.new('lotus')
ob = bpy.data.objects.new('lotus', me)
bpy.context.scene.collection.objects.link(ob)
for m in mats: me.materials.append(bpy.data.materials.new(m))
bm.to_mesh(me)
ob.shape_key_add(name='Basis')
key = ob.shape_key_add(name='Open')
for i, k in enumerate(key.data):
    if i in opened_by_index: k.co = opened_by_index[i]
out = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'lotus.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_morph=True, export_morph_normal=False, export_materials='EXPORT', export_apply=False)
print('lotus:', len(me.polygons), 'panes ->', out)
