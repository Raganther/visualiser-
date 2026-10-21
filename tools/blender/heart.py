# A human heart, front view, sculpted in distance fields and rendered in Blender (lit_kit.py has the pipeline and modes):
#   python tools/blender/heart.py still out.png | bake outdir | blend out.blend
# The ventricles an egg drawn to a point, tilted so the apex points down and to our right, the right ventricle bulging in
# front; the grooves between them and round the base carved and filled with fat, the coronary arteries and veins raised
# along them and branching over the muscle; the right atrium and its lobe (auricle) on our left, the left auricle peeking
# out on our right; the aorta rising and arching back with its three branches, the pulmonary trunk in front of it
# splitting in two, the superior vena cava coming down on our left, their ends cut open. Wet, dark red muscle, yellow fat,
# pale vessel walls. The shape key squeezes it (the ventricles drawing in and up, the atria filling): it beats on the kick.
import numpy as np, math
from lit_kit import *

TILT = math.radians(-28)   # the ventricles' long axis, turned so the apex points down and right
def tilt(x, y, z):   # into the ventricles' own frame (their long axis vertical)
    c, s = math.cos(TILT), math.sin(TILT); return c*x - s*y, s*x + c*y, z
def untilt(p): c, s = math.cos(-TILT), math.sin(-TILT); return (c*p[0] - s*p[1], s*p[0] + c*p[1], p[2])

# the vessels: centre lines and radii, and which ends are cut open
AORTA = [(.02, .18, .0), (.0, .42, .0), (.04, .6, -.04), (.14, .7, -.12), (.26, .66, -.22), (.3, .5, -.3), (.3, .3, -.32)]
BRANCH = [[(.0, .64, -.06), (-.05, .8, -.05), (-.08, .97, -.04)], [(.1, .7, -.1), (.12, .84, -.1), (.13, .98, -.1)], [(.19, .7, -.15), (.23, .84, -.16), (.26, .97, -.17)]]
PULM = [(-.06, .22, .2), (-.02, .42, .2), (.06, .56, .13), (.12, .6, .06)]
LPA = [(.12, .6, .06), (.25, .6, .03), (.38, .57, -.02)]
RPA = [(.12, .6, .06), (-.02, .62, -.08), (-.16, .6, -.14)]
SVC = [(-.3, .28, -.02), (-.3, .6, -.03), (-.3, .9, -.04)]
IVC = [(-.28, .02, -.1), (-.3, -.25, -.14)]
LAD = bez((-.02, .26, .29), (.05, .05, .33), (.12, -.2, .3), (.2, -.52, .15), 30)                   # the front groove's artery
DIAG = [bez((.03, .12, .32), (.15, .05, .3), (.25, -.05, .24), (.32, -.12, .15), 16), bez((.08, -.08, .32), (.2, -.15, .28), (.28, -.25, .2), (.32, -.34, .1), 16)]
RCA = bez((-.1, .24, .25), (-.3, .18, .22), (-.42, .0, .12), (-.4, -.2, .0), 24)                  # round the base, on the right
MARG = [bez((-.3, .15, .22), (-.28, -.05, .26), (-.2, -.25, .26), (-.08, -.42, .22), 16)]
VEINS = [bez((-.04, .24, .3), (.0, .0, .34), (.08, -.22, .31), (.15, -.5, .18), 30), bez((.1, .05, .33), (.2, -.02, .3), (.3, -.1, .22), (.38, -.15, .1), 16)]

def body(x, y, z):   # the ventricles and atria, before the grooves and vessels
    tx, ty, tz = tilt(x, y, z)
    d = ell(tx, ty, tz, (0, -.1, 0), (.33, .44, .3))                                    # the ventricles
    d = smin(d, cap(tx, ty, tz, (0, -.12, .0), (.02, -.6, .03), .28, .045), .12)        # drawn to the apex
    d = smin(d, ell(tx, ty, tz, (-.1, -.02, .13), (.25, .33, .19)), .08)                # the right ventricle, in front
    d = smin(d, ell(x, y, z, (-.3, .2, .03), (.17, .19, .17)), .06)                     # the right atrium
    return smin(d, ell(x, y, z, (.08, .27, -.17), (.25, .15, .17)), .06)                # the left atrium, behind
def onto(P, off=0.):   # a path laid onto the surface (so the coronary vessels lie on the heart, not beside it)
    p = np.array(P, float)
    for _ in range(8):
        d = body(p[:, 0], p[:, 1], p[:, 2]); e = 1e-3
        g = np.stack([(body(p[:, 0] + e, p[:, 1], p[:, 2]) - d)/e, (body(p[:, 0], p[:, 1] + e, p[:, 2]) - d)/e, (body(p[:, 0], p[:, 1], p[:, 2] + e) - d)/e], 1)
        g /= np.linalg.norm(g, axis=1, keepdims=True) + 1e-9; p -= g*d[:, None]
    return p + g*off
LAD, RCA = onto(LAD), onto(RCA); DIAG = [onto(q) for q in DIAG]; MARG = [onto(q) for q in MARG]; VEINS = [onto(q) for q in VEINS]

def heart_sdf(x, y, z):
    d = body(x, y, z)
    d = smax(d, -chain(x, y, z, LAD, np.full(len(LAD), .02)), .03)                     # the front groove
    d = smax(d, -chain(x, y, z, RCA, np.full(len(RCA), .02)), .03)                     # the groove round the base
    d = smin(d, ell(x, y, z, (-.2, .3, .19), (.13, .065, .09)) + .012*vnoise(x*40, y*40, z*40), .03)   # its auricle, crinkled
    d = smin(d, ell(x, y, z, (.29, .25, .1), (.1, .06, .075)) + .01*vnoise(x*40 + 7, y*40, z*40), .03)   # the left auricle
    ves = chain(x, y, z, AORTA, [.085, .085, .082, .08, .076, .072, .07])
    for b, r in zip(BRANCH, (.042, .032, .033)): ves = smin(ves, chain(x, y, z, b, [r*1.2, r, r]), .02)
    ves = smin(ves, chain(x, y, z, PULM, [.08, .078, .074, .07]), .03)
    ves = smin(ves, chain(x, y, z, LPA, [.06, .05, .046]), .02)
    ves = smin(ves, chain(x, y, z, RPA, [.06, .05, .045]), .02)
    ves = smin(ves, chain(x, y, z, SVC, [.058, .056, .055]), .02)
    ves = smin(ves, chain(x, y, z, IVC, [.06, .06]), .02)
    d = smin(d, ves, .045)
    for P, r in ((LAD, .013), (RCA, .014), *[(q, .009) for q in DIAG], *[(q, .009) for q in MARG]):   # the coronary arteries, raised
        d = smin(d, chain(x, y, z, P, np.linspace(r, r*.55, len(P))), .01)
    # the vessels' ends, cut and open
    for P, r in [(b, rr) for b, rr in zip(BRANCH, (.042, .032, .033))] + [(SVC, .055), (LPA, .046)]:
        a, e = np.array(P[-2]), np.array(P[-1]); ax = (e - a)/np.linalg.norm(e - a); cut = e - ax*.02
        d = np.maximum(d, (x - cut[0])*ax[0] + (y - cut[1])*ax[1] + (z - cut[2])*ax[2])
        d = smax(d, -cap(x, y, z, cut - ax*.06, cut + ax*.05, r - .011), .004)
    return d

def sculpt():
    G = Grid(heart_sdf, (-.62, -.8, -.5), (.56, 1.0, .46), opt('--step', .004))
    v, f = G.mesh(); v = relax(v, f); n = vnormals(v, f); x, y, z = v[:, 0], v[:, 1], v[:, 2]
    tx, ty, _ = tilt(x, y, z)
    h = .004*fbm(x*9, y*9, z*9)
    h += .0006*np.sin(tx*90 + ty*40 + 3*fbm(x*5, y*5, z*5))*sstep(.2, -.1, ty)   # the muscle's grain, down the ventricles
    for P in VEINS: _, dd = along_curve(v, P); h += .005*np.exp(-(dd/.008)**2)   # the veins, raised a little
    v = v + n*h[:, None]; v = relax(v, f, 1, .3)
    return {'v': v, 'f': f, 'lo': G.lo, 'step': np.array(G.step), 'vol': G.vol, 'hi': np.array([.56, 1.0, .46])}

AXIS_TOP, AXIS_APEX = np.array(untilt((0, .15, .02))), np.array(untilt((0, -.6, .03)))
def squeeze(v):   # the beat: the ventricles drawing in towards their axis and up; the atria filling a little
    x, y, z = v[:, 0], v[:, 1], v[:, 2]; tx, ty, _ = tilt(x, y, z)
    vent = sstep(.2, .05, ty)*sstep(.62, .45, y)   # (below the base, and not the vessels)
    ax = AXIS_TOP - AXIS_APEX; ax /= np.linalg.norm(ax)
    rel = v - AXIS_APEX; along = rel@ax; radial = rel - np.outer(along, ax)
    out = -radial*.075*vent[:, None] + np.outer(vent*sstep(-.6, .1, ty)*.05, ax)
    atria = sstep(.1, .25, ty)*sstep(.6, .45, y)*(1 - vent)
    c = np.array([-.1, .25, 0]); out += (v - c)*.035*atria[:, None]
    return out

def build():
    M = cached('heart_mesh', sculpt); v, f = M['v'], M['f']
    G = Grid.__new__(Grid); G.vol, G.step, G.lo = M['vol'], float(M['step']), np.array(M['lo'], f32)
    G.axes = [np.arange(G.lo[i], M['hi'][i], G.step, dtype=f32)[:G.vol.shape[i]] for i in range(3)]
    ves = np.zeros(len(v))
    for P in [LAD, RCA, *DIAG, *MARG]: _, dd = along_curve(v, P); ves = np.maximum(ves, sstep(.022, .01, dd))
    vein = np.zeros(len(v))
    for P in VEINS: _, dd = along_curve(v, P); vein = np.maximum(vein, sstep(.016, .006, dd))
    fat = np.zeros(len(v))
    for P in [LAD, RCA]: _, dd = along_curve(v, P); fat = np.maximum(fat, sstep(.075, .03, dd))
    x, y, z = v[:, 0], v[:, 1], v[:, 2]
    fat = np.clip(fat*(.6 + .8*fbm(x*12, y*12, z*12)), 0, 1)*(1 - ves)
    great = np.zeros(len(v))
    for P in [AORTA, PULM, LPA, RPA, SVC, IVC, *BRANCH]: _, dd = along_curve(v, np.array(P)); great = np.maximum(great, sstep(.11, .08, dd))
    great *= sstep(.3, .45, y) + (1 - sstep(.3, .45, y))*0
    mask = np.stack([np.maximum(ves, vein*.8), fat, great*(1 - fat), np.ones(len(v))], 1)
    muscle = organic('heart', base=(.3, .035, .03), dark=(.13, .01, .015), spot=(.09, .01, .02), spots=15, spot_amt=.5,
                     masks=[(1, (.46, .3, .09), .42), (2, (.42, .19, .16), .35), (0, (.16, .015, .04), .2)],
                     sss=(.4, (1, .25, .18), .035), rough=(.18, .32), coat=.55, pores=150, pore_amt=.08, wrinkle=70,
                     wrinkle_amt=.12, mottle=4, cavity=(.35, .15, .12), stretch=(3, 1, 3), sheen=.05)
    return [Piece('heart', v, f, muscle, part=1, morph=squeeze, grid=G, tris=None, mask=mask, thin=lambda p: np.zeros(len(p), bool))]

run('heart', build, cam=((.9, .25, 4.5), (.0, .07, 0), (0, .1, .25), 80, .9))
