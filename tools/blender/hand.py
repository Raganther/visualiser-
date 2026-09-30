# A right hand, back towards us, fingers up, sculpted in distance fields round a skeleton and rendered in Blender
# (lit_kit.py has the pipeline and the modes):   python tools/blender/hand.py still out.png | bake outdir | blend out.blend
# The bones are placed by forward kinematics (each finger fanned, then flexed at its three joints); the flesh is tapered
# capsules round them, the palm a rounded arched block, the thumb's pad and the heel of the hand, the knuckles' bumps, the
# tendons fanning over the back of the hand, the wrist's bone, the forearm cut clean. Fingernails are their own pieces
# (hard and glossy), each in a groove at its cuticle. Then the detail a sculptor adds: wrinkles over the knuckles, veins
# over the back, a lumpy skin. The shape key clenches it (every point of skin follows its bone, blended across the
# joints): 1 a claw, fingers drawn together; negative, straighter and spread. In the visualiser it grips on the kick.
import numpy as np, math
from lit_kit import *

def Rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def Rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def Ry(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
D = math.radians
# each digit: base joint, fan (about z: + leans left, towards the thumb), roll about its own length, the three segments'
# lengths, radii at each joint and the tip, rest flexion at each joint (degrees, towards the palm), and the clench's extra
DIGITS = {
  'index':  dict(base=(-.14, .19, .025), fan=8,  roll=0,   L=(.18, .105, .085),   r=(.046, .041, .037, .033), flex=(14, 22, 12),  grip=(38, 62, 42), close=-6),
  'middle': dict(base=(-.045, .205, .025), fan=2, roll=0,  L=(.2, .12, .09),   r=(.048, .043, .038, .034), flex=(12, 20, 11),  grip=(40, 64, 44), close=-1),
  'ring':   dict(base=(.05, .19, .025), fan=-5,  roll=0,   L=(.185, .115, .087), r=(.045, .04, .036, .032), flex=(15, 24, 13), grip=(42, 66, 44), close=4),
  'little': dict(base=(.138, .16, .02), fan=-13, roll=0,   L=(.145, .088, .076),   r=(.039, .035, .031, .028), flex=(19, 28, 15), grip=(45, 68, 46), close=9),
  'thumb':  dict(base=(-.1, -.14, -.01), fan=40, roll=-50, L=(.16, .12, .098), r=(.058, .047, .041, .034), flex=(6, 12, 18),  grip=(0, 30, 38), close=0),   # (its first bone, in the palm, stays still: moving it tears the palm)
}
def bones(pose=0.):   # each digit's joints, and each segment's frame (rotation: local y along it, z its back)
    out = {}
    for k, g in DIGITS.items():
        R = Rz(D(g['fan'] + pose*g['close']))@Ry(D(g['roll'])); J = [np.array(g['base'])]; F = []
        for i in range(3):
            R = R@Rx(-D(g['flex'][i] + pose*g['grip'][i])); F.append(R.copy()); J.append(J[-1] + R@np.array([0, g['L'][i], 0]))
        out[k] = (J, F)
    return out
REST = bones(0)

def rbox(x, y, z, c, b, r):   # a rounded box
    qx, qy, qz = np.abs(x - c[0]) - b[0], np.abs(y - c[1]) - b[1], np.abs(z - c[2]) - b[2]
    return length(np.maximum(qx, 0), np.maximum(qy, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, np.maximum(qy, qz)), 0) - r

def skin_sdf(x, y, z):
    # the palm: a rounded block, arched across its back, narrowing to the wrist
    xw = x*(1 + .22*np.clip(-(y + .02)/.2, 0, 1)); za = z - .022*(1 - np.clip((x/.21)**2, 0, 1))
    d = rbox(xw, y, za, (0, -.005, .0), (.15, .15, .018), .045)
    d = smin(d, ell(x, y, z, (-.13, -.07, -.025), (.085, .11, .07)), .05)       # the thumb's pad
    d = smin(d, ell(x, y, z, (.14, -.06, -.02), (.055, .12, .05)), .04)         # the heel by the little finger
    # the wrist and forearm, a little flattened, cut clean
    d = smin(d, cap(x*.86, y, z, (0, -.16, -.005), (0, -.8, -.03), .115, .125), .06)
    d = smin(d, sph(x, y, z, (.115, -.27, .035), .03), .03)                      # the wrist's bone
    d = np.maximum(d, -(y + .46))
    for k, (J, F) in REST.items():
        g = DIGITS[k]; rs = g['r']
        f = chain(x, y, z, J, list(rs), k=.012)
        if k != 'thumb':
            f = smin(f, sph(x, y, z, J[0] + F[0]@np.array([0, -.005, .03]), .036), .02)   # the knuckle
            d = smin(d, cap(x, y, z, (J[0][0]*.35, -.2, .05), J[0] + np.array([0, -.03, .035]), .011, .012), .02)   # its tendon over the back
        else:
            f = smin(f, sph(x, y, z, J[1] + F[1]@np.array([0, 0, .015]), .04), .02)
        for i in (1, 2):   # the joints, a little fuller
            f = smin(f, sph(x, y, z, J[i], rs[i]*1.06), .015)
        d = smin(d, f, .035 if k != 'thumb' else .05)
    return d

def nail_frames():   # each nail: centre, across, along, back (its normal), half width and half length, and the tip's radius
    out = []
    for k, (J, F) in REST.items():
        g = DIGITS[k]; R = F[2]; along, back, across = R@np.array([0, 1., 0]), R@np.array([0, 0, 1.]), R@np.array([1., 0, 0])
        c = J[2] + along*g['L'][2]*.64 + back*(g['r'][2]*.45 + g['r'][3]*.47)   # (out to the fingertip, as a real nail: none of the finger past it)
        out.append((k, c, across, along, back, g['r'][3]*.97, g['L'][2]*.4))
    return out
NAILS = nail_frames()
def nail_sdf(x, y, z, c, ac, al, bk, w, l):
    px, py, pz = x - c[0], y - c[1], z - c[2]
    u, v, n = px*ac[0] + py*ac[1] + pz*ac[2], px*al[0] + py*al[1] + pz*al[2], px*bk[0] + py*bk[1] + pz*bk[2]
    return ell(u, v, n + 2.4*u*u/w*.5, (0, 0, 0), (w, l, .0055))   # a thin plate, curved across

def sculpt():
    G = Grid(skin_sdf, (-.55, -.48, -.26), (.42, .8, .22), opt('--step', .0035))
    for k, c, ac, al, bk, w, l in NAILS:   # the cuticle's groove round each nail
        G.local(c, l*2.2, lambda vol, x, y, z, c=c, ac=ac, al=al, bk=bk, w=w, l=l: smax(vol, -(nail_sdf(x, y, z, c, ac, al, bk, w*1.05, l*1.05) - .0015), .004))
    v, f = G.mesh(); v = relax(v, f); n = vnormals(v, f); x, y, z = v[:, 0], v[:, 1], v[:, 2]
    h = .0025*fbm(x*14, y*14, z*14)
    for k, (J, F) in REST.items():   # wrinkles across the back of each knuckle
        for i in (1, 2) if k != 'thumb' else (1, 2):
            al, bk = F[i - 1]@np.array([0, 1., 0]), F[i - 1]@np.array([0, 0, 1.])
            s = (v - J[i])@al; back = sstep(.1, .5, n@bk); near = np.exp(-(np.linalg.norm(v - J[i], axis=1)/(DIGITS[k]['r'][i]*1.5))**2)
            h -= .0035*(1 - np.abs(np.sin(s*260 + 1.5*np.sin((v - J[i])@(F[i - 1]@np.array([1., 0, 0]))*60))))**6*near*back
        J0 = J[0]; near = np.exp(-(np.linalg.norm(v - J0, axis=1)/.05)**2)*sstep(.3, .6, n[:, 2])   # and the big knuckles' folds
        h -= .0025*(1 - np.abs(np.sin(np.linalg.norm((v - J0)[:, :2], axis=1)*300)))**6*near
    for pts in ([(-.02, -.45, .09), (-.05, -.25, .08), (-.09, -.05, .08), (-.1, .1, .075)],   # veins over the back of the hand and wrist
                [(.05, -.5, .09), (.04, -.2, .085), (.02, .0, .085), (-.005, .12, .08)],
                [(.04, -.2, .085), (.09, -.05, .08), (.1, .1, .07)], [(-.05, -.25, .08), (.0, -.1, .085), (.02, .0, .085)]):
        P = bez(*[np.array(p) for p in pts], 24) if len(pts) == 4 else np.array(pts)
        _, dist = along_curve(v, P); h += .0045*np.exp(-(dist/.0065)**2)*sstep(.2, .5, n[:, 2])
    v = v + n*h[:, None]; v = relax(v, f, 1, .3)
    NG = Grid(lambda x, y, z: np.ones(x.shape, f32), (-.55, .2, -.2), (.3, .86, .2), .0015)
    for k, c, ac, al, bk, w, l in NAILS:
        NG.local(c, l*1.8 + w, lambda vol, x, y, z, c=c, ac=ac, al=al, bk=bk, w=w, l=l: np.minimum(vol, nail_sdf(x, y, z, c, ac, al, bk, w, l)))
    nv, nf = NG.mesh(); nv = relax(nv, nf)
    return {'v': v, 'f': f, 'nv': nv, 'nf': nf, 'lo': G.lo, 'step': np.array(G.step), 'vol': G.vol, 'hi': np.array([.42, .86, .22])}

POSE = bones(1)
def clench(v):   # each point follows its bone (the nearest segment of the nearest digit), blended across the joints
    best = np.full(len(v), 1e9); dig = np.full(len(v), -1); seg = np.zeros(len(v), int); sal = np.zeros(len(v))
    keys = list(REST)
    for di, k in enumerate(keys):
        J = REST[k][0]; rr = DIGITS[k]['r']
        for i in range(3):
            h, d = seg_t(v[:, 0], v[:, 1], v[:, 2], J[i], J[i + 1]); d = d/rr[i]
            m = d < best; best[m] = d[m]; dig[m] = di; seg[m] = i; sal[m] = h[m]*DIGITS[k]['L'][i]
    out = v.copy()
    def xf(k, i, p):   # a point moved by segment i's bone (i -1: the palm, still)
        if i < 0: return p
        J0, F0 = REST[k]; J1, F1 = POSE[k]
        return J1[i] + (p - J0[i])@(F1[i]@F0[i].T).T
    for di, k in enumerate(keys):
        for i in range(3):
            m = (dig == di) & (seg == i) & (best < 1.9)
            if not m.any(): continue
            p = v[m]; r = DIGITS[k]['r'][i]; w = sstep(-.35*r, .6*r, sal[m])*sstep(1.9, 1.25, best[m])   # into the parent over the joint, and at the edge of the bone's reach
            if k != 'thumb' and i == 0: w = w*sstep(-.02, .03, (p - REST[k][0][0])@(REST[k][1][0]@np.array([0, 1., 0])))
            a, b = xf(k, i - 1, p), xf(k, i, p); out[m] = a + (b - a)*w[:, None]
    return out - v

def build():
    M = cached('hand_mesh', sculpt); v, f = M['v'], M['f']
    G = Grid.__new__(Grid); G.vol, G.step, G.lo = M['vol'], float(M['step']), np.array(M['lo'], f32)
    G.axes = [np.arange(G.lo[i], M['hi'][i], G.step, dtype=f32)[:G.vol.shape[i]] for i in range(3)]
    n = vnormals(v, f)
    warm = np.zeros(len(v))
    for k, (J, F) in REST.items():
        for i in (0, 1, 2, 3): warm = np.maximum(warm, np.exp(-(np.linalg.norm(v - J[i], axis=1)/(.05 if i < 3 else .045))**2)*(.7 if i < 3 else 1))
    palm = sstep(-.1, -.5, n[:, 2])
    mask = np.stack([warm*(1 - palm), palm, np.zeros(len(v)), np.ones(len(v))], 1)
    skin = organic('hand', base=(.42, .24, .16), dark=(.3, .16, .1), spot=(.24, .12, .08), spots=30, spot_amt=.35,
                   masks=[(0, (.48, .19, .14), None), (1, (.55, .33, .25), .5)], sss=(.35, (1, .4, .26), .04), rough=(.38, .55),
                   pores=300, pore_amt=.12, wrinkle=90, wrinkle_amt=.12, mottle=5, cavity=(.5, .4, .35), stretch=(4, 4, 1), sheen=.2)
    nails = glossy('nails', (.62, .45, .4), rough=.22, sss=.4, coat=.8)
    return [Piece('hand', v, f, skin, part=1, morph=clench, grid=G, tris=None, mask=mask),
            Piece('nails', M['nv'], M['nf'], nails, part=2, morph=clench, tris=1500)]

run('hand', build, cam=((.85, .3, 3.9), (-.03, .05, 0), (0, .2, .1), 80, .82))
