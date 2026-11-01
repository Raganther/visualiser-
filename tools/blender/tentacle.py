# An octopus's arm, sculpted in distance fields and rendered in Blender (lit_kit.py has the pipeline and the modes):
#   python tools/blender/tentacle.py still out.png | bake outdir | blend out.blend
# A tapering arm rising in a lazy S, its tip curled, two staggered rows of suckers down the side facing us (each a rolled
# rim round a cup with a pit at its heart, smaller towards the tip), rings of wrinkles and small papillae on the back, the
# skin reddish-brown with dark chromatophore flecks, paler and pinker underneath, wet, and translucent (the whole arm is
# thin enough for light to glow through it). In the visualiser it writhes by bending along its length (render/lit.js).
import numpy as np, math
from lit_kit import *

# the spine: from the base (rounded, below) up to the tip, curling over at the end
C = np.array([.33, .5, .05])   # the curl's centre
_u = np.linspace(0, 1.65*math.pi, 30)
S = np.concatenate([bez((-.05, -.95, 0), (-.25, -.35, .05), (.28, .05, -.05), (.126, .45, .05), 34),
                    np.stack([C[0] + .21*(1 - .5*_u/_u[-1])*np.cos(math.pi + .24 - _u), C[1] + .21*(1 - .5*_u/_u[-1])*np.sin(math.pi + .24 - _u),
                              C[2] + .03*np.sin(_u)], 1)[1:]])   # the tip curling over in a tightening spiral
S = S[np.r_[True, np.linalg.norm(np.diff(S, axis=0), axis=1) > 1e-4]]
seg = np.linalg.norm(np.diff(S, axis=0), axis=1); arc = np.r_[0, np.cumsum(seg)]; TL = arc[-1]; T01 = arc/TL
R = .17*(1 - T01)**1.1 + .012                        # the radius, tapering to a fine tip
TAN = np.gradient(S, axis=0); TAN /= np.linalg.norm(TAN, axis=1, keepdims=True)
NS = 34   # (where the curl starts)
def side(i, ang=0.):   # the side the suckers face (towards us and to the right; in the curl, its inside), turned by ang about the arm
    D = np.array([.72, .05, .69])
    if i >= NS: q = C - S[i]; q[2] = 0; q /= np.linalg.norm(q) + 1e-9; D = q*.9 + np.array([0, 0, .42])
    d = D - D.dot(TAN[i])*TAN[i]; d /= np.linalg.norm(d)
    return rot(d[None], TAN[i], ang)[0]

def suckers():
    out, s, k = [], .03*TL, 0
    while s < .9*TL:
        i = np.searchsorted(arc, s); r = R[i]; rs = min(.06, .6*r)
        n = side(i, (.45 if k % 2 else -.45)); c = S[i] + n*r*.8
        out.append((c, n, rs)); s += rs*1.02; k += 1
    return out
SUCK = suckers()

def sculpt():
    def arm(x, y, z):
        d = chain(x, y, z, S, R, k=.01)
        return d
    lo, hi = S.min(0) - .2, S.max(0) + .2
    G = Grid(arm, lo, hi, opt('--step', .004))
    for c, n, rs in SUCK:   # each sucker: a rolled rim round a cup, a pit in its middle, blended into the skin
        def op(vol, x, y, z, c=c, n=n, rs=rs):
            rim = torus(x, y, z, c + n*rs*.05, n, rs*.74, rs*.2)
            body = cap(x, y, z, c - n*rs*.5, c - n*rs*.05, rs*.82, rs*.9)           # a short stalk the cup sits on
            v = smin(vol, np.minimum(rim, body), rs*.25)
            v = smax(v, -sph(x, y, z, c + n*rs*.5, rs*.62), rs*.06)                  # the cup
            return smax(v, -cap(x, y, z, c + n*rs*.1, c - n*rs*.35, rs*.14), rs*.05)   # the pit
        G.local(c, rs*1.8, op)
    v, f = G.mesh(); v = relax(v, f)
    n = vnormals(v, f); t, dist = along_curve(v, S); i = np.clip((t*(len(S) - 1)).astype(int), 0, len(S) - 1)
    sd = np.array([side(k) for k in range(len(S))])[i]; back = sstep(.1, -.4, np.einsum('ij,ij->i', n, sd))   # 1 on the back, 0 facing the suckers
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    h = -.0035*(1 - np.abs(np.sin(t*TL*95 + 2*fbm(x*9, y*3, z*9))))**6*back*(.4 + .6*np.clip(fbm(x*4 + 3, y*4, z*4) + .5, 0, 1))   # rings of wrinkles
    h += .005*np.clip(fbm(x*38, y*38, z*38), 0, 1)**2*back                                        # papillae
    h += .003*fbm(x*8 + 5, y*8, z*8)
    v = v + n*h[:, None]; v = relax(v, f, 1, .3)
    return {'v': v, 'f': f, 'lo': lo, 'hi': hi, 'vol': G.vol, 'step': np.array(G.step)}

def build():
    M = cached('tentacle_mesh', sculpt); v, f = M['v'], M['f']
    G = Grid.__new__(Grid); G.vol, G.step, G.lo = M['vol'], float(M['step']), np.array(M['lo'], f32)
    G.axes = [np.arange(M['lo'][i], M['hi'][i], G.step, dtype=f32) for i in range(3)]
    n = vnormals(v, f); t, _ = along_curve(v, S); i = np.clip((t*(len(S) - 1)).astype(int), 0, len(S) - 1)
    sd = np.array([side(k) for k in range(len(S))])[i]; under = sstep(-.1, .6, np.einsum('ij,ij->i', n, sd))
    near = np.zeros(len(v)); rim = np.zeros(len(v))
    for c, nn, rs in SUCK:
        d = np.linalg.norm(v - c, axis=1)/rs; near = np.maximum(near, sstep(1.25, .95, d)); rim = np.maximum(rim, np.exp(-((d - .72)/.18)**2)*sstep(1.3, 1, d))
    mask = np.stack([rim, near, under*(1 - near), np.ones(len(v))], 1)
    skin = organic('tentacle', base=(.36, .07, .055), dark=(.12, .018, .025), spot=(.05, .006, .012), spots=45, spot_amt=1.3,
                   masks=[(2, (.4, .1, .085), .3), (1, (.52, .26, .21), .16), (0, (.68, .44, .37), .12)],
                   sss=(.35, (1, .3, .2), .04), rough=(.22, .42), coat=.2, pores=220, pore_amt=.12, wrinkle=45, wrinkle_amt=.1, mottle=5, sheen=.05)
    return [Piece('tentacle', v, f, skin, part=1, grid=G, tris=None, mask=mask)]

run('tentacle', build, cam=((.9, .0, 5.2), (.1, -.13, 0), (.1, 0, .15), 80, .85),
    lights={'key': (E(-1.8, 1.4, 2.0), 420, (1, .86, .7), 1.2)})
