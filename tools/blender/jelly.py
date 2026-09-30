# The jellyfish, modelled in Blender from Python (run with Blender's Python, e.g. the `bpy` package from PyPI:
#   python tools/blender/jelly.py out.glb   then   node tools/import-glb.mjs out.glb jelly --morph Pulse
# Built in Blender's own orientation (Z up, facing the front view), like the manta: E() turns the visualiser's axes (x right,
# y up, z to the viewer) into Blender's. The bell is on top, the arms and tentacles hang below.
#
# The pieces, each a material whose name starts with its part number:
#   1 the bell, 2 its inner shell and scalloped margin, 3 the oral arms, 4 the tentacles, 5 the four horseshoe gonads seen
#   through the bell, 7 the eight sense spots round the rim (dark, glowing on the downbeat).
# One shape key, "Pulse": the bell contracted (narrower and taller, the tentacles drawn in); the visualiser plays it on the
# beat, from -1 (relaxed wide) to 1 (contracted).
import bpy, bmesh, math, sys

def E(x, y, z): return (x, -z, y)
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
mats = ['1_bell', '2_margin', '3_arms', '4_tentacles', '5_gonads', '6_unused', '7_spots']
parts, pulsed = [], {}

def contract(p, amt=1.0):   # where a point goes when the bell contracts: drawn in towards the axis, the bell taller
    x, y, z = p
    k = 1 - .26*amt*max(0, min(1, (y + .15)/.5))**.5 if y > -.15 else 1 - .18*amt
    return (x*k, y*(1 + .16*amt) if y > 0 else y*.92 + .03*amt, z*k)
def vert(p, q=None):
    v = bm.verts.new(E(*p)); pulsed[v] = E(*(q if q is not None else contract(p))); return v
def face(vs, part): bm.faces.new(vs); parts.append(part)

# ---- the bell: an outer dome and an inner one, joined at a scalloped rim ----
NA, NR = 24, 6
def bell(s, a, inner):
    R, H = (.42, .34) if not inner else (.38, .26)
    r = R*math.sin(s*math.pi/2)**.75*(1 + .05*math.cos(8*a)*s**6)       # eight lobes to the margin
    return (r*math.cos(a), H*math.cos(s*math.pi/2), r*math.sin(a))
outer = [[vert(bell(i/NR, 2*math.pi*j/NA, False)) for j in range(NA)] for i in range(1, NR + 1)]
inner = [[vert(bell(i/NR, 2*math.pi*j/NA, True)) for j in range(NA)] for i in range(1, NR + 1)]
top_o, top_i = vert((0, .34, 0)), vert((0, .26, 0))
for rows, top, part, flip in ((outer, top_o, 1, False), (inner, top_i, 2, True)):
    for j in range(NA):
        a, b = rows[0][j], rows[0][(j + 1) % NA]
        face((top, b, a) if flip else (top, a, b), part)
    for i in range(NR - 1):
        for j in range(NA):
            a, b, c, d = rows[i][j], rows[i][(j + 1) % NA], rows[i + 1][(j + 1) % NA], rows[i + 1][j]
            face((a, d, c, b) if flip else (a, b, c, d), part)
for j in range(NA):   # the rim, joining the two
    a, b, c, d = outer[-1][j], outer[-1][(j + 1) % NA], inner[-1][(j + 1) % NA], inner[-1][j]
    face((a, d, c, b), 2)

# ---- a tube along a path: rings of n points of radius r(u), closed at the tip ----
def tube(path, r, n, segs, part):
    rings = []
    for s in range(segs + 1):
        u = s/segs; c = path(u); rad = r(u)
        rings.append([vert((c[0] + rad*math.cos(2*math.pi*k/n), c[1], c[2] + rad*math.sin(2*math.pi*k/n))) for k in range(n)])
    for s in range(segs):
        for k in range(n): face((rings[s][k], rings[s + 1][k], rings[s + 1][(k + 1) % n], rings[s][(k + 1) % n]), part)
    tip = vert(path(1.03))
    for k in range(n): face((rings[-1][k], tip, rings[-1][(k + 1) % n]), part)

# ---- the oral arms: four frilly ribbons, twisting down from under the bell ----
for k in range(4):
    a0 = 2*math.pi*(k + .5)/4
    tube(lambda u, a0=a0: (.07*(1 - u*.3)*math.cos(a0 + u*2.2) + .03*math.sin(u*14 + k), .02 - .72*u, .07*(1 - u*.3)*math.sin(a0 + u*2.2) + .03*math.cos(u*14 + k)),
         lambda u: .035*(1 - u*.7)*(1 + .35*math.sin(u*18)), 4, 8, 3)

# ---- the tentacles: twelve long thin ones from the rim, hanging in gentle curves ----
for k in range(12):
    a = 2*math.pi*k/12
    tube(lambda u, a=a: (.4*math.cos(a)*(1 - .25*u) + .05*math.sin(u*5 + k)*math.cos(a + 1.5), -.01 - 1.05*u, .4*math.sin(a)*(1 - .25*u) + .05*math.sin(u*5 + k)*math.sin(a + 1.5)),
         lambda u: .009*(1 - u*.8), 3, 7, 4)

# ---- the gonads: four horseshoes seen through the bell, and the sense spots round the rim ----
for k in range(4):
    a0 = 2*math.pi*k/4
    tube(lambda u, a0=a0: (.13*math.cos(a0 + (u - .5)*2.2), .2 - .02*math.cos((u - .5)*3), .13*math.sin(a0 + (u - .5)*2.2)), lambda u: .016, 3, 6, 5)
for k in range(8):
    a = 2*math.pi*(k + .5)/8
    c = (.41*math.cos(a), .01, .41*math.sin(a))
    vs = [vert((c[0] + .018*math.cos(a + d), c[1] - .012, c[2] + .018*math.sin(a + d))) for d in (0, 2.1, 4.2)]
    t = vert((c[0], c[1] + .025, c[2]))
    for m in range(3): face((vs[m], vs[(m + 1) % 3], t), 7)

# ---- the mesh, its parts, and the shape key ----
bm.verts.index_update()
pulsed_i = {v.index: p for v, p in pulsed.items()}
bm.faces.ensure_lookup_table()
for f, p in zip(bm.faces, parts): f.material_index = p - 1
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bmesh.ops.triangulate(bm, faces=bm.faces[:])
me = bpy.data.meshes.new('jelly')
ob = bpy.data.objects.new('jelly', me)
bpy.context.scene.collection.objects.link(ob)
for m in mats: me.materials.append(bpy.data.materials.new(m))
bm.to_mesh(me)
ob.shape_key_add(name='Basis')
key = ob.shape_key_add(name='Pulse')
for i, k in enumerate(key.data): k.co = pulsed_i[i]
out = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'jelly.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_morph=True, export_morph_normal=False, export_materials='EXPORT', export_apply=False)
print('jelly:', len(me.polygons), 'panes ->', out)
