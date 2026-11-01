// The facet geometry, ported from src/render/facet.js (facetGeo): an icosahedron subdivided F times (20, 80, 320, 1280
// facets). Every vertex knows, for each level, the coarse facet it lies in and its weights there, so its place at any
// detail is that facet's corners blended: at a whole level the fine panes lie flat on the coarse facets, between two
// they part along the new edges. Each fine edge knows the coarsest level it bounds, so it fades in as the detail reaches it.
import simd

struct FacetGeo {
    let F: Int
    let nv: Int
    let nf: Int
    let dir: [SIMD3<Float>]      // each vertex's direction (on the unit sphere)
    let tri: [Int]               // the fine faces' corners, nf*3
    let el: [Int]                // each fine face's edges (opposite each corner): the coarsest level whose facets it bounds
    let ai: [Int]                // each vertex at each level: its coarse facet's corners, nv*(F+1)*3
    let aw: [Float]              // and its weights there
    let fa: [[Int]]              // each fine face's ancestor at each level
    let cen: [[SIMD3<Float>]]    // each facet's centre (on the sphere), per level
    let nfAt: [Int]              // facets per level

    init(F: Int = 3) {
        self.F = F
        let t = (1 + 5.0.squareRoot()) / 2
        let base: [SIMD3<Double>] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
        var V: [SIMD3<Double>] = base.map { simd_normalize($0) }
        var faces: [[Int]] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
                              [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
        func ek(_ a: Int, _ b: Int) -> Int { a < b ? a * 65536 + b : b * 65536 + a }
        var elev: [Int: Int] = [:]
        for f in faces { for (p, q) in [(f[0], f[1]), (f[1], f[2]), (f[2], f[0])] { elev[ek(p, q)] = 0 } }
        var LV: [[[Int]]] = [faces]
        var PAR: [[Int]] = [[]]
        for L in 0..<F {
            var mid: [Int: Int] = [:]
            var nfs: [[Int]] = []
            var par: [Int] = []
            func m(_ a: Int, _ b: Int) -> Int {
                let k = ek(a, b)
                if let i = mid[k] { return i }
                let i = V.count
                V.append(simd_normalize((V[a] + V[b]) / 2))
                mid[k] = i
                let l = elev[k] ?? 0
                elev[ek(a, i)] = l
                elev[ek(i, b)] = l
                return i
            }
            for (fi, f) in faces.enumerated() {
                let a = f[0], b = f[1], c = f[2]
                let ab = m(a, b), bc = m(b, c), ca = m(c, a)
                for (p, q) in [(ab, bc), (bc, ca), (ca, ab)] { elev[ek(p, q)] = L + 1 }
                nfs.append(contentsOf: [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]])
                par.append(contentsOf: [fi, fi, fi, fi])
            }
            faces = nfs
            LV.append(nfs)
            PAR.append(par)
        }
        let nv = V.count, nf = faces.count
        self.nv = nv
        self.nf = nf
        // each fine face's ancestor at every level
        var FA = [[Int]](repeating: [Int](repeating: 0, count: nf), count: F + 1)
        for f in 0..<nf {
            var g = f
            for L in stride(from: F, through: 0, by: -1) {
                FA[L][f] = g
                if L > 0 { g = PAR[L][g] }
            }
        }
        // each vertex at every level: the coarse facet it lies in and its weights there
        var AI = [Int](repeating: 0, count: nv * (F + 1) * 3)
        var AW = [Float](repeating: 0, count: nv * (F + 1) * 3)
        for L in 0...F {
            var done = [Bool](repeating: false, count: nv)
            for f in 0..<nf {
                for v in faces[f] where !done[v] {
                    done[v] = true
                    let cf = LV[L][FA[L][f]], a = cf[0], b = cf[1], c = cf[2]
                    let d = V[v], n = simd_cross(V[b] - V[a], V[c] - V[a])
                    let k = simd_dot(n, V[a]) / simd_dot(n, d), X = d * k
                    func ar(_ x0: Int, _ x1: Int) -> Double { simd_dot(n, simd_cross(V[x1] - V[x0], X - V[x0])) }
                    let tot = simd_dot(n, n), wa = ar(b, c) / tot, wb = ar(c, a) / tot, wc = 1 - wa - wb
                    let o = (v * (F + 1) + L) * 3
                    AI[o] = a; AI[o + 1] = b; AI[o + 2] = c
                    AW[o] = Float(wa); AW[o + 1] = Float(wb); AW[o + 2] = Float(wc)
                }
            }
        }
        var EL = [Int](repeating: 0, count: nf * 3), TRI = [Int](repeating: 0, count: nf * 3)
        for (f, fc) in faces.enumerated() {
            let a = fc[0], b = fc[1], c = fc[2]
            TRI[f * 3] = a; TRI[f * 3 + 1] = b; TRI[f * 3 + 2] = c
            EL[f * 3] = elev[ek(b, c)] ?? 0
            EL[f * 3 + 1] = elev[ek(c, a)] ?? 0
            EL[f * 3 + 2] = elev[ek(a, b)] ?? 0
        }
        var CEN: [[SIMD3<Float>]] = []
        for L in 0...F {
            CEN.append(LV[L].map { fc in
                let s = V[fc[0]] + V[fc[1]] + V[fc[2]]
                let u = simd_normalize(s)
                return SIMD3<Float>(Float(u.x), Float(u.y), Float(u.z))
            })
        }
        self.dir = V.map { SIMD3<Float>(Float($0.x), Float($0.y), Float($0.z)) }
        self.tri = TRI
        self.el = EL
        self.ai = AI
        self.aw = AW
        self.fa = FA
        self.cen = CEN
        self.nfAt = LV.map { $0.count }
    }
}
