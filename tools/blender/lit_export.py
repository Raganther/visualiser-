# Packs a baked asset (goblin_hd.py bake <dir>) into one module the page loads: the low mesh as base64 typed arrays,
# its textures as WebP data URLs, and simple mode's smaller mesh. Needs numpy and Pillow (the Blender venv has both).
#   python tools/blender/lit_export.py <bakedir> src/visuals/objects/meshes/<name>-lit.js [--size .6] [--q 88] [--thin-x .36 (the goblin)]
# Everything is centred and scaled to fit a sphere of --size, like tools/import-glb.mjs (the skull's is about .6).
import sys, os, io, base64
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]; D, OUT = args[0], args[1]
def opt(k, d): return type(d)(args[args.index(k) + 1]) if k in args else d
SIZE, Q = opt('--size', .6), opt('--q', 88)

L = np.load(os.path.join(D, 'lit.npz')); pos = L['pos']
lo, hi = pos.min(0), pos.max(0); mid = (lo + hi)/2; rad = np.linalg.norm(pos - mid, axis=1).max(); sc = SIZE/rad
pos = (pos - mid)*sc; morph = L['morph']*sc
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
def q16(a):   # signed 16-bit, with the scale to undo it
    s = float(np.abs(a).max()) or 1.; return b64(np.round(a/s*32767).astype('<i2')), s
P, ps = q16(pos); M, ms = q16(morph)
uv = b64(np.round(np.clip(L['uv'], 0, 1)*65535).astype('<u2'))
TX = opt('--thin-x', 0.)   # (the goblin: only its ears let light through, |x| past .36; its lips and lids are thin too, but not like that)
thick = np.where(np.abs(L['pos'][:, 0]) > TX, L['thick'], .12) if TX else L['thick']
th = b64(np.round(np.clip(thick/.12, 0, 1)*255).astype(np.uint8)); pa = b64(L['part'].astype(np.uint8))
tri = L['tri']; assert tri.max() < 65536, 'too many corners for 16-bit indices'
T = b64(tri.astype('<u2'))

def img(name, size=None, mul=None):
    im = Image.open(os.path.join(D, name + '.png')).convert('RGB')
    if mul is not None:   # the creases' shade, multiplied into the colour (a little softened)
        a = np.asarray(im, np.float32)/255; ao = np.asarray(Image.open(os.path.join(D, mul + '.png')).convert('L'), np.float32)/255
        # where the bake's rays missed the sculpt the colour is black: filled from the colour round it
        ok = (a.sum(2) > .03).astype(np.float32)[..., None]; blur = lambda x, r: np.asarray(Image.fromarray(np.uint8(np.clip(x, 0, 1)*255)).filter(ImageFilter.GaussianBlur(r)), np.float32)/255
        for r in (6, 24):
            fill = blur(a*ok, r)/np.maximum(blur(np.repeat(ok, 3, 2), r), 1e-3); a = a*ok + fill*(1 - ok); ok = np.maximum(ok, (a.sum(2) > .03)[..., None].astype(np.float32))
        im = Image.fromarray(np.uint8(np.clip(a*(.35 + .65*np.maximum(ao, .25)[..., None]**.8), 0, 1)*255))
    if size: im = im.resize((size, size), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=Q, method=6); return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
color, normal, emit = img('color', mul='ao'), img('normal'), img('emit', 512)

# simple mode's mesh: pieces of (corners, triangles, part per triangle, morph, colour per corner)
Z = np.load(os.path.join(D, 'lod2d.npz')); arrs = [Z[f'arr_{i}'] for i in range(len(Z.files))]
lp, lt, lpart, lm, lc, off = [], [], [], [], [], 0
for i in range(0, len(arrs), 5):
    v, t, p_, m_, c_ = arrs[i:i + 5]
    lp.append((v - mid)*sc); lt.append(t + off); lpart.append(p_); lm.append(m_*sc); lc.append(c_); off += len(v)
lp, lt, lpart, lm, lc = map(np.concatenate, (lp, lt, lpart, lm, lc))
r3 = lambda a: '[' + ','.join(f'{x:.3f}'.rstrip('0').rstrip('.') if x else '0' for x in a.ravel()) + ']'
col8 = np.round(np.clip(lc, 0, 1)**(1/2.2)*255).astype(int)   # (linear baked colour to sRGB bytes)

name = os.path.basename(OUT).replace('.js', '')
with open(OUT, 'w') as f:
    f.write(f"// {name}: a lit asset baked in Blender by tools/blender/goblin_hd.py (bake) and packed by tools/blender/lit_export.py\n"
            "// (don't edit by hand). The low mesh: corners (x right, y up, z towards the viewer, 16-bit, times ps), uv (16-bit),\n"
            "// the shape key's move (times ms), thickness (0..255 of .12), part (1 skin, 2 teeth, 3 eyes, 4 brass), triangles (16-bit);\n"
            "// its textures (colour with the creases' shade, an object-space normal map, the eyes' glow); and simple mode's mesh.\n")
    f.write(f"export default {{n: {len(pos)}, t: {len(tri)}, ps: {ps:.6f}, ms: {ms:.6f},\n")
    for k, v in (('pos', P), ('uv', uv), ('morph', M), ('thick', th), ('part', pa), ('tri', T)): f.write(f"  {k}: '{v}',\n")
    f.write(f"  color: '{color}',\n  normal: '{normal}',\n  emit: '{emit}',\n")
    f.write(f"  lod: {{pos: {r3(lp)}, tri: [{','.join(map(str, lt.ravel()))}], part: [{','.join(map(str, lpart.ravel()))}], morph: {r3(lm)}, col: [{','.join(map(str, col8.ravel()))}]}},\n}};\n")
print(f'{OUT}: {len(pos)} corners, {len(tri)} triangles, simple mode {len(lt)} triangles, {os.path.getsize(OUT)/1024:.0f} KB')
