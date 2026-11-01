// The Prism's brain, a native cut of src/visuals/objects/prism.js: one gem of facets that tours named shapes, gains and
// loses facets, lights them in patterns with the music (the kick's rings, the stabs' wedges, the hats' sparks, a drop's
// run-up filling it from the bottom), shatters on the drop, and calms down for music without a steady beat. And Jam: drag
// beside it to turn it, press on it and drag out to pull spikes (in, or hold, for dents), tap it to send a ring of light.
import CoreGraphics
import Foundation
import simd

// one corner of a facet as the shader reads it (the same layout as Vtx in Renderer.swift's Metal code)
struct Vtx {
    var pos: SIMD3<Float>
    var nrm: SIMD3<Float>
    var bary: SIMD3<Float>
    var edge: SIMD3<Float>
    var col: SIMD4<Float>     // its tint, and how lit it is
}

enum Kind { case ball, octa, cube, gem, star, flower, disc, pill, superf }

struct Look {
    let name: String
    let kind: Kind
    var sf: [Float] = [0, 1, 2, 2]          // the superformula: points, then its three exponents
    var sq: SIMD3<Float> = [1, 1, 1]        // squash and stretch
    var twist: Float = 0                    // about its upright
    var lathe: Float = 0, lf: Float = 4     // rings of bulges: how deep, how many
    var sharp = false
}

let LOOKS: [Look] = [
    Look(name: "ball", kind: .ball),
    Look(name: "cube", kind: .cube, sharp: true),
    Look(name: "octahedron", kind: .octa, sharp: true),
    Look(name: "diamond", kind: .gem, sharp: true),
    Look(name: "star", kind: .star, sharp: true),
    Look(name: "disc", kind: .disc),
    Look(name: "pill", kind: .pill),
    Look(name: "flower", kind: .flower),
    Look(name: "starfish", kind: .superf, sf: [5, 0.3, 0.3, 0.3], sharp: true),
    Look(name: "urchin", kind: .superf, sf: [10, 0.4, 0.6, 0.6], sharp: true),
    Look(name: "shell", kind: .superf, sf: [3, 4.5, 10, 10]),
    Look(name: "cushion", kind: .superf, sf: [4, 12, 15, 15]),
    Look(name: "jewel", kind: .superf, sf: [5, 2, 4, 4], sharp: true),
    Look(name: "lantern", kind: .ball, lathe: 0.22, lf: 4),
    Look(name: "spindle", kind: .pill, sq: [0.7, 1.5, 0.7]),
    Look(name: "twisted cube", kind: .cube, twist: 1.4, sharp: true),
]

// feel numbers, from TUNE.prism as the user tuned it in the lab
enum Tune {
    static let r: Float = 0.62               // the gem's radius
    static let spin: Float = 0.22            // its slow turn, radians a second
    static let morphSecs: Float = 3.9
    static let breath: Float = 0.14          // how much the bass swells it
    static let explode: Float = 1.25, explodeSecs: Float = 1.2
    static let ripSecs: Float = 1.6, ripSpeed: Float = 0.75, ripW: Float = 0.28
    static let kickCalm: Float = 0.5         // the kick's rings when calm
    static let fire: Float = 1.35            // the glint split into a rainbow
    static let hatShare: Float = 0.12
    static let actBase: Float = 0.22, actBrk: Float = 0.55, actFree: Float = 0.4
    // Jam
    static let width: Float = 0.05, pull: Float = 1.2, maxPull: Float = 0.35, holdRate: Float = 0.25
    static let bounce: Float = 1, damp: Float = 0.12, friction: Float = 2.2, maxSpin: Float = 5, turn: Float = 5, tilt: Float = 3
    static let tapBright: Float = 0.8
    // the camera
    static let cam: Float = 3.2, focal: Float = 2.6
}

private let ICO: [SIMD3<Float>] = {
    let t: Float = (1 + Float(5).squareRoot()) / 2
    let v: [SIMD3<Float>] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    return v.map { simd_normalize($0) }
}()
private func sm(_ x: Float) -> Float { x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x) }
private func hash(_ a: Int, _ b: Int) -> Float {
    var h = UInt32(truncatingIfNeeded: a &* 374761393 &+ b &* 668265263)
    h = (h ^ (h >> 13)) &* 1274126177
    return Float(h ^ (h >> 16)) / 4294967296
}
private func sfr(_ t: Float, _ p: [Float]) -> Float {
    let m = p[0] / 4
    return pow(pow(abs(cos(m * t)), p[2]) + pow(abs(sin(m * t)), p[3]), -1 / p[1])
}
private func hsv(_ h: Float, _ s: Float, _ v: Float) -> SIMD3<Float> {
    let hh = (h - floor(h)) * 6
    let c = SIMD3<Float>(abs(hh - 3) - 1, 2 - abs(hh - 2), 2 - abs(hh - 4))
    let k = simd_clamp(c, SIMD3<Float>(repeating: 0), SIMD3<Float>(repeating: 1))
    return v * ((1 - s) + s * k)
}

struct Ring { var dir: SIMD3<Float>; var t0: Float; var bright: Float }

final class Prism {
    let G: FacetGeo
    private var S3: [SIMD3<Float>]       // each vertex's shaped place
    private var P3: [SIMD3<Float>]       // and placed at its detail
    private var D: [Float]               // each vertex's detail (0..3)
    private var angFront: [Float]        // each vertex's angle from the front, 0..1 (new facets bloom out from the middle)
    private var sfMx: [String: Float] = [:]
    var verts: [Vtx]

    // what it is now
    private var lookA = LOOKS[0], lookB = LOOKS[0], morph: Float = 1
    private var recent: [String] = ["ball"]
    private var dPrev: Float = 1, dNext: Float = 1, wave: Float = 1
    var detailMode = -1                  // -1: the music chooses; 0...3 held
    private(set) var act: Float = 0.2
    private var ex: Float = 0, exHold: Float = 0
    private var rings: [Ring] = []
    private var wedge = 0, wedgeLit: Float = 0, hatSeed = 0, hatLit: Float = 0, kickFlash: Float = 0
    private var h0: Float = 0.62, palSpread: Float = 0.08
    private var clock: Float = 0
    private var rng: UInt32 = 99
    // the music
    private var lastT = -1.0, iBeat = 0, iStab = 0, iHat = 0, iOnset = 0, iDrop = 0
    private var phraseN = 0, kicksRun = 0, lastPhraseT = 0.0, idleBeat: Float = 0
    private var lastDropAt: Float = -100
    private var tension: Float = 0, bassLv: Float = 0, anticip: Float = 0
    private var inBreak = false, steady = true, period: Float = 0.5
    private(set) var info = ""
    // the turn
    var yaw: Float = 0, pitch: Float = 0.3
    private var yawV: Float = 0, pitchV: Float = 0
    var camZ: Float = Tune.cam
    // Jam
    private var touching = false, onObj = false
    private var tStart = CGPoint.zero, tLast = CGPoint.zero, tTime = 0.0, tLastTime = 0.0
    private var tDir = SIMD3<Float>(0, 0, 1), tOut = SIMD2<Float>(1, 0), tMoved: Float = 0, holdDent: Float = 0
    private var bumpDirs: [SIMD3<Float>] = []
    private var bumpA: Float = 0, bumpV: Float = 0, bumpTarget: Float? = nil
    var aspect: Float = 1

    init() {
        let g = FacetGeo(F: 3), nv = g.nv
        G = g
        S3 = [SIMD3<Float>](repeating: .zero, count: nv)
        P3 = [SIMD3<Float>](repeating: .zero, count: nv)
        D = [Float](repeating: 1, count: nv)
        angFront = g.dir.map { acos(max(-1, min(1, $0.z))) / .pi }
        verts = [Vtx](repeating: Vtx(pos: .zero, nrm: .zero, bary: .zero, edge: .zero, col: .zero), count: g.nf * 3)
        for L in LOOKS where L.kind == .superf {
            var mx: Float = 0
            for i in 0..<96 { mx = max(mx, sfr(Float(i) / 96 * 2 * .pi - .pi, L.sf)) }
            sfMx[L.name] = max(mx, 1e-3)
        }
    }

    private func rand() -> Float { rng = rng &* 1664525 &+ 1013904223; return Float(rng >> 8) / 16777216 }

    // ---- the shapes: a radius for each direction, then squashed, turned on a lathe, twisted ----
    private func radius(_ L: Look, _ d: SIMD3<Float>) -> Float {
        switch L.kind {
        case .ball: return 1
        case .octa: return 1.25 / (abs(d.x) + abs(d.y) + abs(d.z))
        case .cube: return 0.8 / max(abs(d.x), max(abs(d.y), abs(d.z)))
        case .gem:
            let r = (d.x * d.x + d.z * d.z).squareRoot()
            return min(1.05 / (r * 0.8 + abs(d.y) * 0.95), d.y > 0 ? 0.55 / d.y : 9)
        case .star:
            var m: Float = 0
            for a in ICO { m = max(m, simd_dot(a, d)) }
            return 0.78 + 0.95 * pow(m, 28)
        case .flower: return 0.85 + 0.3 * cos(5 * atan2(d.z, d.x)) * (1 - abs(d.y)) + 0.12 * d.y
        case .disc: return 1 / (d.x * d.x * 0.9025 + d.z * d.z * 0.9025 + d.y * d.y * 4).squareRoot()
        case .pill: return 0.8 / (d.x * d.x + d.z * d.z + d.y * d.y * 0.3025).squareRoot()
        case .superf:
            let th = atan2(d.y, d.x), ph = asin(max(-1, min(1, d.z))), mx = sfMx[L.name] ?? 1
            return 0.6 + 0.55 * (sfr(th, L.sf) / mx) * (sfr(ph, L.sf) / mx)
        }
    }
    private func shaped(_ L: Look, _ d: SIMD3<Float>) -> SIMD3<Float> {
        var R = radius(L, d)
        if L.lathe > 0 { R *= 1 + L.lathe * sin(L.lf * asin(max(-1, min(1, d.y))) * 2) }
        var p = d * R * L.sq
        if L.twist != 0 {
            let a = L.twist * p.y, c = cos(a), s = sin(a)
            p = SIMD3<Float>(c * p.x - s * p.z, p.y, s * p.x + c * p.z)
        }
        return p
    }

    // ---- the music's moments ----
    private func nextLook(sharp: Bool) {
        let pool = LOOKS.filter { $0.name != lookB.name && !recent.contains($0.name) }
        let want = pool.filter { $0.sharp == sharp }
        let from = !want.isEmpty && rand() < 0.7 ? want : pool
        guard !from.isEmpty else { return }
        let L = from[min(from.count - 1, Int(rand() * Float(from.count)))]
        // morph from wherever it is now
        lookA = morph >= 1 ? lookB : (morph < 0.5 ? lookA : lookB)
        lookB = L
        morph = 0
        recent.append(L.name)
        if recent.count > 5 { recent.removeFirst() }
    }
    func nextShape() { nextLook(sharp: rand() < 0.5) }
    private func setDetail(_ d: Float) {
        if abs(d - dNext) < 0.01 { return }
        dPrev = curDetail; dNext = d; wave = 0
    }
    private var curDetail: Float { dPrev + (dNext - dPrev) * sm(wave) }
    private func front() -> SIMD3<Float> { simd_transpose(rot()) * SIMD3<Float>(0, 0, 1) }
    private func ring(_ dir: SIMD3<Float>, _ b: Float) {
        rings.append(Ring(dir: dir, t0: clock, bright: b))
        if rings.count > 6 { rings.removeFirst() }
    }
    private func onBeat(_ k: Int, kick: Float) {
        if kick > 0.3 { kicksRun += 1 } else if k % 8 == 0 { kicksRun = 0 }
        let calm = act < 0.35
        if kick > 0.3 && (!calm || k % 4 == 0) {
            let dir = k % 8 == 0 ? front() : ICO[min(11, Int(rand() * 12))]
            ring(dir, (0.45 + 0.55 * kick) * (calm ? Tune.kickCalm : 1))
            kickFlash = kick
        }
        if k % 16 == 0 { onPhrase() }
    }
    private func onPhrase() {
        phraseN += 1
        if act > 0.3 || phraseN % 2 == 0 { nextLook(sharp: act > 0.6) }
        if phraseN % 2 == 0 { h0 += 0.06 + rand() * 0.12 }
        palSpread = act > 0.5 ? 0.33 : 0.08
    }
    func drop(free: Bool = false) {
        if free {   // a swell, not a shatter
            act = max(act, 0.25)
            ring(front(), 0.6)
            return
        }
        ex = 1; exHold = 0.25
        nextLook(sharp: true)
        h0 += 0.33
        for d in ICO.prefix(6) { ring(d, 0.8) }
        act = 1
        lastDropAt = clock
    }

    // ---- each frame ----
    func step(dt: Float, player: Player?) {
        clock += dt
        let A = player?.analysis
        let playing = player?.playing ?? false
        if let A = A, playing {
            let t = player!.time
            steady = A.steady
            period = Float(A.period)
            if lastT < 0 || t < lastT - 0.05 || t - lastT > 1 { resync(A, t) }
            else if t > lastT {
                while iBeat < A.beats.count && A.beats[iBeat] <= t {
                    if steady { onBeat(iBeat, kick: A.kick[iBeat]) }
                    iBeat += 1
                }
                while iStab < A.stabs.count && A.stabs[iStab] <= t {
                    if act > 0.25 { wedge = (wedge + 1) % 5; wedgeLit = 1 }
                    iStab += 1
                }
                while iHat < A.hats.count && A.hats[iHat] <= t { hatSeed += 1; hatLit = 1; iHat += 1 }
                while iOnset < A.onsets.count && A.onsets[iOnset] <= t {
                    if !steady { ring(rand() < 0.5 ? front() : ICO[min(11, Int(rand() * 12))], 0.35) }
                    iOnset += 1
                }
                while iDrop < A.drops.count && A.drops[iDrop] <= t { drop(free: !steady); iDrop += 1 }
                if !steady && t - lastPhraseT > 16 { lastPhraseT = t; onPhrase() }
                lastT = t
            }
            tension += (A.at(A.tension, t) - tension) * min(1, dt * 0.8)
            bassLv = A.at(A.bass, t)
            // the run-up to the next drop, and whether it's in a breakdown
            anticip = 0
            if iDrop < A.drops.count {
                let ahead = A.drops[iDrop] - t, len = max(6, A.period * 16)
                if ahead > 0 && ahead < len { anticip = Float(1 - ahead / len) }
            }
            if let b = A.breaks.last(where: { $0 <= t }) { inBreak = !A.drops.contains(where: { $0 > b && $0 <= t }) } else { inBreak = false }
            info = String(format: "%@ · %@ · %@", player!.name, steady ? String(format: "%.1f BPM", A.bpm) : "free time", inBreak ? "breakdown" : anticip > 0 ? "the drop is coming" : "")
        } else {   // no music: a slow idle, a new shape now and then
            steady = true; tension *= 1 - min(1, dt * 0.3); bassLv = 0; anticip = 0; inBreak = false
            idleBeat += dt
            if idleBeat > 12 { idleBeat = 0; phraseN += 1; nextLook(sharp: rand() < 0.4) }
            info = A == nil ? "No music: ＋ Music or Demo beat" : "Paused"
            lastT = -1
        }

        // how much may move
        let sinceDrop = clock - lastDropAt, dropBoost = max(0, 1 - sinceDrop / max(8, period * 32)) * 0.6
        var target = Tune.actBase + 0.35 * tension + 0.5 * anticip + dropBoost
        if inBreak { target *= Tune.actBrk }
        if !steady { target *= Tune.actFree }
        target = min(1, max(0, target))
        act += (target - act) * min(1, dt * (target > act ? 0.6 : 0.25))

        // facets: the music's level, or held
        if detailMode >= 0 { setDetail(Float(detailMode)) }
        else {
            var d: Float = 1
            if steady && kicksRun >= 32 { d = 2 }
            if act > 0.65 || anticip > 0.5 { d = 3 }
            if dropBoost > 0.3 { d = 3 }
            if inBreak || !steady { d = 1 }
            setDetail(d)
        }
        wave = min(1, wave + dt / max(1.5, period * 4))
        morph = min(1, morph + dt / (Tune.morphSecs * (steady ? 1 : 1.5)))
        if exHold > 0 { exHold -= dt } else { ex = max(0, ex - dt / Tune.explodeSecs) }
        wedgeLit *= exp(-dt / 0.5); hatLit *= exp(-dt / 0.2); kickFlash *= exp(-dt / 0.12)
        h0 += dt * 0.004

        jamStep(dt)
        // the turn: its own slow spin, and what Jam gave it
        yaw += dt * (Tune.spin * (0.4 + act) * (steady ? 1 : 0.5) + yawV)
        pitch += dt * pitchV
        if !(touching && !onObj) {
            yawV *= exp(-Tune.friction * dt); pitchV *= exp(-Tune.friction * dt)
            pitch += (0.3 - pitch) * min(1, dt * Tune.tilt * 0.5)
        }
        build(dt)
    }

    private func resync(_ A: Analysis, _ t: Double) {
        func after(_ a: [Double]) -> Int { var lo = 0, hi = a.count; while lo < hi { let m = (lo + hi) / 2; if a[m] <= t { lo = m + 1 } else { hi = m } }; return lo }
        iBeat = after(A.beats); iStab = after(A.stabs); iHat = after(A.hats); iOnset = after(A.onsets); iDrop = after(A.drops)
        lastT = t; lastPhraseT = t
    }

    func rot() -> simd_float3x3 {
        let cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch)
        let ry = simd_float3x3(SIMD3<Float>(cy, 0, -sy), SIMD3<Float>(0, 1, 0), SIMD3<Float>(sy, 0, cy))
        let rx = simd_float3x3(SIMD3<Float>(1, 0, 0), SIMD3<Float>(0, cp, sp), SIMD3<Float>(0, -sp, cp))
        return rx * ry
    }

    // ---- every corner placed, every facet lit, written for the shader ----
    private func build(_ dt: Float) {
        let F = G.F, m = sm(morph), breath = 1 + Tune.breath * bassLv * act
        // the bumps Jam pulls out
        let bumping = abs(bumpA) > 0.002 && !bumpDirs.isEmpty
        for v in 0..<G.nv {
            let d = G.dir[v]
            var p = m >= 1 ? shaped(lookB, d) : simd_mix(shaped(lookA, d), shaped(lookB, d), SIMD3<Float>(repeating: m))
            var s = breath
            if bumping { var b: Float = 0; for c in bumpDirs { b += exp(-(1 - simd_dot(d, c)) / Tune.width) }; s *= 1 + bumpA * b }
            p *= s * Tune.r
            S3[v] = p
            D[v] = wave >= 1 ? dNext : dPrev + (dNext - dPrev) * sm((wave * 1.5 - angFront[v]) / 0.5)
        }
        // placed at its detail: the corners of the facet it lies in at the two levels round it, blended
        for v in 0..<G.nv {
            let dd = max(0, min(Float(F), D[v])), L0 = min(F - 1, Int(dd)), fr = dd - Float(L0)
            var q = SIMD3<Float>.zero
            for s in 0..<2 {
                let k = s == 1 ? fr : 1 - fr
                if k < 1e-4 { continue }
                let o = (v * (F + 1) + L0 + s) * 3
                q += (S3[G.ai[o]] * G.aw[o] + S3[G.ai[o + 1]] * G.aw[o + 1] + S3[G.ai[o + 2]] * G.aw[o + 2]) * k
            }
            P3[v] = q
        }
        let R = rot(), runLvl = -1.2 + 2.6 * anticip
        let palOff: [Float] = [0, palSpread, -palSpread * 0.8]
        for f in 0..<G.nf {
            let a = G.tri[f * 3], b = G.tri[f * 3 + 1], c = G.tri[f * 3 + 2]
            let pa = P3[a], pb = P3[b], pc = P3[c]
            var n = simd_cross(pb - pa, pc - pa)
            let ln = simd_length(n)
            n = ln > 1e-9 ? n / ln : SIMD3<Float>(0, 0, 1)
            let fd = (D[a] + D[b] + D[c]) / 3, fl = max(0, min(F, Int(fd + 0.5)))
            let anc = G.fa[fl][f], cd = G.cen[fl][anc]
            // how lit: the rings, the stabs' wedge, the hats' sparks, the run-up from the bottom
            var lit: Float = 0
            for r in rings {
                let age = clock - r.t0
                if age >= Tune.ripSecs { continue }
                let ang = acos(max(-1, min(1, simd_dot(cd, r.dir)))), fr = age * .pi * Tune.ripSpeed
                let x = (ang - fr) / Tune.ripW
                lit += r.bright * exp(-x * x) * (1 - age / Tune.ripSecs)
            }
            if wedgeLit > 0.01 {
                let az = atan2(cd.z, cd.x) / (2 * .pi) + 0.5
                if Int(az * 5) % 5 == wedge { lit += 0.55 * wedgeLit }
            }
            if hatLit > 0.01 && hash(anc + fl * 4096, hatSeed) < Tune.hatShare * (0.4 + tension) { lit += 0.7 * hatLit }
            if anticip > 0 { lit += 0.6 * anticip * sm((runLvl - cd.y) / 0.3) }
            lit = min(lit, 1.6)
            // its colour: one of the palette's three hues
            let hp = hash(anc + fl * 4096, 3), pidx = hp < 0.6 ? 0 : hp < 0.85 ? 1 : 2
            let tint = hsv(h0 + palOff[pidx] + 0.03 * (hash(anc, 9) - 0.5), 0.6, 0.32)
            // pushed out: shattered on a drop (each visible facet its own way), lifted a little where lit
            let off = Tune.explode * ex * ex * (0.4 + 0.6 * hash(anc + fl * 4096, 21)) * Tune.r + lit * 0.035 * Tune.r
            let shift = n * off
            // the edges: each shows once the detail reaches its level
            var e = SIMD3<Float>(repeating: 1)
            for j in 0..<3 { let lv = G.el[f * 3 + j]; e[j] = lv == 0 ? 1 : max(0, min(1, fd - Float(lv) + 1)) }
            let nw = R * n, col = SIMD4<Float>(tint, lit)
            let base = f * 3
            verts[base] = Vtx(pos: R * (pa + shift), nrm: nw, bary: [1, 0, 0], edge: e, col: col)
            verts[base + 1] = Vtx(pos: R * (pb + shift), nrm: nw, bary: [0, 1, 0], edge: e, col: col)
            verts[base + 2] = Vtx(pos: R * (pc + shift), nrm: nw, bary: [0, 0, 1], edge: e, col: col)
        }
    }

    // ---- the lights, for the renderer: a warm key light drifting in front, a cool rim behind, a low fill in the palette's colour ----
    func lights() -> [SIMD4<Float>] {
        let az = 0.55 + 0.6 * sin(clock * 0.07) + 0.25 * Float(phraseN % 4), el: Float = 0.45
        let key = SIMD3<Float>(sin(az) * cos(el), sin(el), cos(az) * cos(el))
        let fillC = hsv(h0 + palSpread, 0.7, 0.35 + 0.8 * kickFlash * act)
        return [SIMD4<Float>(key, 0), SIMD4<Float>(1.0, 0.93, 0.82, 0) * 1.5,
                SIMD4<Float>(simd_normalize(SIMD3<Float>(-0.4, 0.5, -0.8)), 0), SIMD4<Float>(0.55, 0.7, 1.0, 0) * 1.1,
                SIMD4<Float>(simd_normalize(SIMD3<Float>(0.2, -0.8, 0.5)), 0), SIMD4<Float>(fillC, 0)]
    }

    // ---- Jam ----
    // a ray from the camera through a point on the screen, against the gem's bounding sphere
    private func pick(_ p: CGPoint, _ size: CGSize) -> SIMD3<Float>? {
        let x = Float(2 * p.x / size.width - 1), y = Float(1 - 2 * p.y / size.height), th = 1 / Tune.focal
        let d = simd_normalize(SIMD3<Float>(x * aspect * th, y * th, -1)), o = SIMD3<Float>(0, 0, camZ)
        var rr: Float = 0
        for v in stride(from: 0, to: G.nv, by: 7) { rr = max(rr, simd_length(P3[v])) }
        rr *= 0.95
        let b = simd_dot(o, d), c = simd_dot(o, o) - rr * rr, disc = b * b - c
        if disc < 0 { return nil }
        let hit = o + d * (-b - disc.squareRoot())
        return simd_normalize(simd_transpose(rot()) * hit)
    }
    func touchBegan(_ p: CGPoint, _ size: CGSize) {
        touching = true; tStart = p; tLast = p; tTime = CACurrentMediaTimeShim(); tLastTime = tTime; tMoved = 0; holdDent = 0
        if let dir = pick(p, size) {
            onObj = true; tDir = dir
            // its symmetric copies: five round its upright
            let a0 = atan2(dir.z, dir.x), rxz = (dir.x * dir.x + dir.z * dir.z).squareRoot()
            bumpDirs = (0..<5).map { k -> SIMD3<Float> in let a = a0 + Float(k) * 2 * .pi / 5; return SIMD3<Float>(cos(a) * rxz, dir.y, sin(a) * rxz) }
            let o = SIMD2<Float>(Float(p.x - size.width / 2), Float(p.y - size.height / 2))
            tOut = simd_length(o) > 1 ? simd_normalize(o) : SIMD2<Float>(1, 0)
            bumpTarget = bumpA
        } else { onObj = false; yawV = 0; pitchV = 0 }
    }
    func touchMoved(_ p: CGPoint, _ size: CGSize) {
        guard touching else { return }
        let now = CACurrentMediaTimeShim(), edt = Float(max(1.0 / 240, now - tLastTime))
        let dx = Float(p.x - tLast.x), dy = Float(p.y - tLast.y), h = Float(size.height)
        tMoved = max(tMoved, Float(hypot(p.x - tStart.x, p.y - tStart.y)))
        if onObj {
            let tot = SIMD2<Float>(Float(p.x - tStart.x), Float(p.y - tStart.y)), along = simd_dot(tot, tOut) / (h * 0.5)
            bumpTarget = max(-Tune.maxPull, min(Tune.maxPull, along * Tune.pull - holdDent))
        } else {
            let k = Tune.turn / h * 0.6
            yaw += dx * k; pitch += dy * k
            yawV = max(-Tune.maxSpin, min(Tune.maxSpin, yawV * 0.5 + 0.5 * dx * k / edt))
            pitchV = max(-Tune.maxSpin, min(Tune.maxSpin, pitchV * 0.5 + 0.5 * dy * k / edt))
        }
        tLast = p; tLastTime = now
    }
    func touchEnded(_ p: CGPoint, _ size: CGSize) {
        guard touching else { return }
        touching = false
        if onObj {
            if tMoved < 12 && CACurrentMediaTimeShim() - tTime < 0.3 {   // a tap: a ring of light from there, brighter on the beat
                ring(tDir, Tune.tapBright * (steady ? 1 : 0.7))
            }
            bumpTarget = nil
        }
        onObj = false
    }
    private func jamStep(_ dt: Float) {
        if touching && onObj && tMoved < 12 && CACurrentMediaTimeShim() - tTime > 0.25 {   // held still: a dent deepens
            holdDent = min(Tune.maxPull, holdDent + Tune.holdRate * dt)
            bumpTarget = max(-Tune.maxPull, -holdDent)
        }
        if let target = bumpTarget { bumpA += (target - bumpA) * min(1, dt * 12); bumpV = 0 }
        else {   // let go: it springs back at the beat's own speed
            let w = 2 * Float.pi / max(0.25, period * Tune.bounce), k = w * w, c = 2 * Tune.damp * w
            let n = 4, h = dt / Float(n)
            for _ in 0..<n { bumpV += (-k * bumpA - c * bumpV) * h; bumpA += bumpV * h }
            if abs(bumpA) < 1e-4 && abs(bumpV) < 1e-3 { bumpA = 0; bumpV = 0 }
        }
    }
    func zoom(_ z: Float) { camZ = max(1.7, min(7, z)) }
    var shapeName: String { lookB.name }
    var facets: Int { G.nfAt[max(0, min(G.F, Int(curDetail + 0.5)))] }
    var activity: Float { act }
}

func CACurrentMediaTimeShim() -> Double { ProcessInfo.processInfo.systemUptime }
