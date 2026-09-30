# The goblin's head, sculpted in Blender from Python (run with Blender's Python, e.g. the `bpy` package from PyPI:
#   python tools/blender/goblin.py out.glb   then   node tools/import-glb.mjs out.glb goblin --panes 2200 --morph Snarl
# Sculpted the way you'd block one out by hand: metaballs (blobs that melt into each other, and negative ones that carve)
# for the skull, brow, cheekbones, jaw, hooked nose and long pointed ears, with the eye sockets and mouth carved out;
# converted to a mesh, its skin wrinkled a little by a noise displacement; then jagged teeth, eyes and warts as their own
# pieces. Built in Blender's own orientation (Z up, facing the front view), like the manta: E() turns the visualiser's axes
# (x right, y up, z towards the viewer) into Blender's. It faces the viewer.
#
# The pieces, each a material whose name starts with its part number:
#   1 the skin of the head, 2 the ears, 3 the nose, 4 the brow and cheekbones, 5 the teeth, 6 the warts, 7 the eyes (dark,
#   glowing on the downbeat).
# One shape key, "Snarl": the jaw drops, the nose wrinkles up and the ears pin back; the visualiser plays it from -1 (a
# tight-lipped glower, ears pricked) to 1 (the full snarl).
import bpy, bmesh, math, sys, mathutils

def E(x, y, z): return (x, -z, y)
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- the head, sculpted from metaballs ----
mb = bpy.data.metaballs.new('head'); mb.resolution = .028; mb.render_resolution = .028; mb.threshold = .6
head = bpy.data.objects.new('head', mb); bpy.context.scene.collection.objects.link(head)
def ball(x, y, z, r, s=(1, 1, 1), neg=False, kind='ELLIPSOID', rot=None):
    e = mb.elements.new(); e.type = kind; e.co = E(x, y, z); e.radius = r; e.use_negative = neg
    e.size_x, e.size_y, e.size_z = s[0], s[2], s[1]   # (in Blender's axes: y is the visualiser's depth, z its height)
    if rot: e.rotation = rot
    return e
def q(axis, ang): return mathutils.Quaternion(E(*axis), ang)
ball(0, .12, -.05, .5, (1, 1.05, 1.08))                      # the cranium, long at the back
ball(0, -.12, .12, .36, (1.05, .9, 1))                       # the face's mass
for s in (-1, 1):
    ball(s*.2, .08, .26, .16, (1.1, .5, .6))                 # the brow ridge, heavy over the eyes
    ball(s*.26, -.1, .22, .15, (.9, .7, .8))                 # the cheekbones, sharp
    ball(s*.14, .06, .34, .11, (1, 1, 1), neg=True)          # the eye sockets, carved
    # the ears: long, flattened, pointed, sweeping up and back from the sides of the head
    for k in range(11):   # (many overlapping blobs, so the ear is one smooth leaf, widest near its root, curling to a point)
        t = k/10; w = math.sin(math.pi*min(1, t*1.25 + .08))**.8
        ball(s*(.38 + .42*t), .1 + .26*t + .1*t*t, -.04 - .16*t, .03 + .085*w, (1.5, 1.2, .3), rot=q((0, 0, 1), s*-.55))
ball(0, -.34, .2, .22, (1.2, .75, 1))                        # the jaw, long, the chin jutting
ball(0, -.44, .36, .08, (1.3, .8, 1))                        # the point of the chin
ball(0, -.2, .43, .13, (1.8, .45, .7), neg=True)             # the mouth, a wide slot carved in
for k in range(6):                                           # the nose: hooked, blobs along a curve down and out
    t = k/5; ball(0, .08 - .17*t, .38 + .17*math.sin(t*2.2), .07*(1 - .35*t) + .02, (1, 1, 1))
for s in (-1, 1): ball(s*.05, -.18, .5, .035, (1, 1, 1), neg=True)   # the nostrils
bpy.context.view_layer.objects.active = head; head.select_set(True)
bpy.ops.object.convert(target='MESH')
skin = bpy.context.view_layer.objects.active

# ---- its skin: wrinkled a little by noise ----
tex = bpy.data.textures.new('wrinkles', 'CLOUDS'); tex.noise_scale = .08; tex.noise_depth = 2
mod = skin.modifiers.new('wrinkles', 'DISPLACE'); mod.texture = tex; mod.strength = .02; mod.mid_level = .5
bpy.ops.object.modifier_apply(modifier='wrinkles')

bm = bmesh.new(); bm.from_mesh(skin.data)
def parts_of(c):   # each face's part, by where it is on the head (in the visualiser's axes)
    x, y, z = c.x, c.z, -c.y
    if abs(x) > .4: return 2                                              # the ears
    if abs(x) < .1 and z > .36 and -.28 < y < .1: return 3                 # the nose
    if z > .18 and ((abs(x) > .08 and .12 < y < .2) or (abs(x) > .18 and -.18 < y < -.02)): return 4   # the brow and cheekbones
    return 1
face_part = {f: parts_of(f.calc_center_median()) for f in bm.faces}

# ---- jagged teeth, eyes, warts: their own pieces, added to the same mesh ----
def add_tri(a, b, c, part): face_part[bm.faces.new((a, b, c))] = part
jawset, fixset = set(), set()   # each tooth moves whole: with the jaw (the lower ones) or not at all (the upper ones)
def cone(base, tip, r, n, part, jaw=False):
    b = mathutils.Vector(base); t = mathutils.Vector(tip); ax = (t - b).normalized()
    u = ax.orthogonal().normalized(); v = ax.cross(u)
    ring = [bm.verts.new(b + (u*math.cos(2*math.pi*k/n) + v*math.sin(2*math.pi*k/n))*r) for k in range(n)]
    tv = bm.verts.new(t)
    (jawset if jaw else fixset).update([*ring, tv])
    for k in range(n): add_tri(ring[k], ring[(k + 1) % n], tv, part)
    for k in range(1, n - 1): add_tri(ring[0], ring[k + 1], ring[k], part)
import random; random.seed(7)
for k in range(9):                                            # the teeth: crooked, uneven, top and bottom
    x = (k - 4)*.052 + (random.random() - .5)*.012
    cone(E(x, -.15, .47 - abs(x)*.25), E(x + (random.random() - .5)*.02, -.2 - random.random()*.035, .5 - abs(x)*.25), .02 + random.random()*.008, 4, 5)
    if k % 2 == 0: cone(E(x, -.27, .45 - abs(x)*.25), E(x + (random.random() - .5)*.02, -.15 + random.random()*.03 if k in (0, 8) else -.225, .49 - abs(x)*.25), .022, 4, 5, jaw=True)
for s in (-1, 1):                                             # the eyes: deep in their sockets
    e = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=.06, matrix=mathutils.Matrix.Translation(E(s*.14, .06, .3)))
    for f in {f for v in e['verts'] for f in v.link_faces}: face_part[f] = 7
for (x, y, z, r) in [(.2, .28, .3, .025), (-.12, .38, .22, .02), (.06, -.26, .42, .018), (-.3, -.04, .2, .022), (.04, -.08, .5, .015)]:   # warts
    e = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=mathutils.Matrix.Translation(E(x, y, z)))
    for f in {f for v in e['verts'] for f in v.link_faces}: face_part[f] = 6

# ---- the snarl: where each point goes (the jaw drops about its hinge, the nose wrinkles up, the ears pin back) ----
hinge = mathutils.Vector((0, -.05, 0))   # (visualiser axes: y up, z forward) behind the mouth
def snarl(p, fixed=False, jaw=False):
    x, y, z = p.x, p.z, -p.y
    if fixed: return E(x, y, z)
    if (jaw or y < -.16) and abs(x) < .4:                     # the jaw and lower teeth: turned down about the hinge
        a = .22*min(1, (-.16 - y)/.08 + .3); dy, dz = y - hinge.y, z - hinge.z
        y, z = hinge.y + dy*math.cos(a) - dz*math.sin(a), hinge.z + dy*math.sin(a) + dz*math.cos(a)
    elif abs(x) < .12 and z > .36 and -.2 < y < .12:                        # the nose wrinkles up
        y += .025
    if abs(x) > .38:                                                        # the ears pin back and down
        t = min(1, (abs(x) - .38)/.45); z -= .16*t; y -= .06*t
    return E(x, y, z)
bm.verts.ensure_lookup_table(); bm.verts.index_update()
snarled = {v.index: snarl(v.co, v in fixset, v in jawset) for v in bm.verts}
bm.faces.ensure_lookup_table()
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
parts = [face_part.get(f, 1) for f in bm.faces]
for f, p in zip(bm.faces, parts): f.material_index = p - 1
bmesh.ops.triangulate(bm, faces=bm.faces[:])

me = bpy.data.meshes.new('goblin'); ob = bpy.data.objects.new('goblin', me); bpy.context.scene.collection.objects.link(ob)
for m in ['1_skin', '2_ears', '3_nose', '4_brow', '5_teeth', '6_warts', '7_eyes']: me.materials.append(bpy.data.materials.new(m))
bm.to_mesh(me)
ob.shape_key_add(name='Basis'); key = ob.shape_key_add(name='Snarl')
for i, k in enumerate(key.data): k.co = snarled[i]
bpy.data.objects.remove(skin)
out = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'goblin.glb'
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_morph=True, export_morph_normal=False, export_materials='EXPORT', export_apply=False, use_selection=True)
print('goblin:', len(me.polygons), 'panes ->', out)
