# The manta ray, modelled in Blender from Python (run with Blender's Python, e.g. the `bpy` package from PyPI:
#   python tools/blender/manta.py out.glb   then   node tools/import-glb.mjs out.glb manta
# or open Blender and run it from the Scripting tab). It builds the manta in Blender's own orientation (Z up, facing the
# front view, -Y), so a model made by hand in Blender comes through the same way: the importer turns glTF's Y-up into
# the visualiser's (x right, y up, z towards the viewer), and a model facing Blender's front view faces the camera.
#
# The pieces, each a material whose name starts with its part number (the importer reads it):
#   1 the back, 2 the wings, 3 the belly, 4 the cephalic fins (the horns either side of the mouth), 5 the tail, 6 the gill
#   slits, 7 the eyes (parts 7 and up are drawn as dark holes; 7 glows on the downbeat).
# One shape key, "Flap": the wings raised; the visualiser plays it from -1 (wings down) to 1 (wings up) with the beat.
import bpy, bmesh, math, sys

def E(x, y, z):   # the visualiser's axes (x right, y up, z to the viewer) to Blender's (x right, y back, z up)
    return (x, -z, y)

bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
mats = ['1_back', '2_wings', '3_belly', '4_fins', '5_tail', '6_gills', '7_eyes']

# ---- the body and wings: a flattened wing section swept across the span ----
NX, K = 25, 7                                  # columns across the span; points along the top (and bottom) of each section
SPAN = .98
def t_of(x): return min(1, max(0, (abs(x) - .12)/.86))            # 0 over the body .. 1 at the wing tip
def lead(x): return .42 - .44*t_of(x)**1.25                         # the leading edge sweeps back to the tip
def trail(x): return -.42 + .36*t_of(x)**.75                        # the trailing edge sweeps forward to it
def section(x):
    t, zl, zt = t_of(x), lead(x), trail(x)
    yc = -.06*t*t                                                   # the wings droop a little
    th = lambda v: (.1*(1 - t)**1.6 + .006)*math.sin(math.pi*v)**.8 + (.03*max(0, 1 - abs(x)/.16) if 0 < v < 1 else 0)*math.sin(math.pi*v)
    top = [(x, yc + .02*(1 - t)*math.sin(math.pi*k/K) + th(k/K)*.75, zl - (zl - zt)*k/K) for k in range(K + 1)]
    bot = [(x, yc - th(k/K)*.45, zl - (zl - zt)*k/K) for k in range(K - 1, 0, -1)]
    return top + bot
cols = [[bm.verts.new(E(*p)) for p in section(-SPAN + 2*SPAN*i/(NX - 1))] for i in range(NX)]
R = len(cols[0])
for i in range(NX - 1):
    a, b = cols[i], cols[i + 1]
    for j in range(R):
        bm.faces.new((a[j], a[(j + 1) % R], b[(j + 1) % R], b[j]))
for side, col in ((-1, cols[0]), (1, cols[-1])):                    # the pointed tips
    zt = (lead(side) + trail(side))/2
    tip = bm.verts.new(E(side*1.0, -.06, zt))
    for j in range(R): bm.faces.new((col[j], col[(j + 1) % R], tip))

# ---- a tube along a path (the cephalic fins, the tail): rings of n points, radius r(u), flattened by (sx, sy) ----
def tube(path, r, n, segs, sx=1, sy=1):
    rings = []
    for s in range(segs + 1):
        u = s/segs; c = path(u); rad = r(u)
        rings.append([bm.verts.new(E(c[0] + rad*sx*math.cos(2*math.pi*k/n), c[1] + rad*sy*math.sin(2*math.pi*k/n), c[2])) for k in range(n)])
    for s in range(segs):
        for k in range(n): bm.faces.new((rings[s][k], rings[s][(k + 1) % n], rings[s + 1][(k + 1) % n], rings[s + 1][k]))
    tip = bm.verts.new(E(*path(1.04)))
    for k in range(n): bm.faces.new((rings[-1][k], rings[-1][(k + 1) % n], tip))
    cap = bm.verts.new(E(*path(0)))
    for k in range(n): bm.faces.new((rings[0][(k + 1) % n], rings[0][k], cap))
for s in (-1, 1):                              # the cephalic fins, curling down and in at the front
    tube(lambda u, s=s: (s*(.13 + .035*u - .05*u*u), .01 - .09*u*u, .38 + .24*u), lambda u: .038*(1 - u) + .006, 6, 5, .55, 1)
# the tail, long and thin, lifting a little
tube(lambda u: (0, .005 + .05*u*u, -.40 - .75*u), lambda u: .022*(1 - u) + .003, 5, 6)
import mathutils
for s in (-1, 1):                              # the eyes, on the sides of the head
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=.03, matrix=mathutils.Matrix.Translation(E(s*.2, .04, .3)))

bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.faces.ensure_lookup_table()

me = bpy.data.meshes.new('manta')
ob = bpy.data.objects.new('manta', me)
bpy.context.scene.collection.objects.link(ob)
for m in mats: me.materials.append(bpy.data.materials.new(m))
# each face's part, found by where it is
def part_of(c, ny):
    x, y, z = c.x, c.z, -c.y                                        # back in the visualiser's axes
    if abs(x) < .06 and z < -.42: return 5                          # the tail
    if z > .4 and abs(x) < .2 and y < .02 and abs(x) > .09: return 4  # the cephalic fins
    if ((abs(x) - .2)**2 + (y - .04)**2 + (z - .3)**2) < .036**2: return 7   # the eyes
    if ny < 0:                                                      # underneath: the belly, with the gill slits
        if .1 < abs(x) < .3 and .02 < z < .26 and int((z - .02)/.048) % 2 == 0: return 6
        return 3
    return 1 if abs(x) < .17 else 2
bm.to_mesh(me)
for p in me.polygons: p.material_index = part_of(p.center, p.normal.z) - 1

# ---- the shape key: the wings raised (the visualiser plays it both ways, so -1 is the wings lowered) ----
ob.shape_key_add(name='Basis')
flap = ob.shape_key_add(name='Flap')
for v, k in zip(me.vertices, flap.data):
    x, y, z = v.co.x, v.co.z, -v.co.y
    t = t_of(x)
    k.co = E(x - math.copysign(.08*t**3, x), y + .38*t*t, z - .04*t*t)

out = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'manta.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_morph=True, export_morph_normal=False, export_materials='EXPORT', export_apply=False)
print('manta:', len(me.polygons), 'panes ->', out)
