// The track read before it plays, as the web page's read-ahead does (src/audio/foresee.js), so the picture is in step from
// the first beat: the low end, the mids, the highs and the whole, every 512 samples; the tempo and where every beat falls
// (or no steady beat at all: a band playing freely); how hard the kick is on each beat; stabs and hats; the bass, the
// tension; and the breakdowns and the drops (the bass well under its loudest for a few seconds, then back).
import Accelerate
import Foundation

final class FFT {
    let n: Int, half: Int, log2n: vDSP_Length
    private let setup: FFTSetup
    private let re, im, win, buf, mag: UnsafeMutablePointer<Float>

    init(n: Int) {
        self.n = n
        half = n / 2
        log2n = vDSP_Length(log2(Double(n)).rounded())
        setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))!
        re = .allocate(capacity: n / 2); im = .allocate(capacity: n / 2)
        win = .allocate(capacity: n); buf = .allocate(capacity: n); mag = .allocate(capacity: n / 2)
        vDSP_hann_window(win, vDSP_Length(n), Int32(vDSP_HANN_NORM))
    }
    deinit {
        vDSP_destroy_fftsetup(setup)
        re.deallocate(); im.deallocate(); win.deallocate(); buf.deallocate(); mag.deallocate()
    }
    // the power in each bin of n samples from x
    func power(_ x: UnsafePointer<Float>) -> UnsafeMutablePointer<Float> {
        vDSP_vmul(x, 1, win, 1, buf, 1, vDSP_Length(n))
        var sc = DSPSplitComplex(realp: re, imagp: im)
        buf.withMemoryRebound(to: DSPComplex.self, capacity: half) { vDSP_ctoz($0, 2, &sc, 1, vDSP_Length(half)) }
        vDSP_fft_zrip(setup, &sc, 1, log2n, FFTDirection(FFT_FORWARD))
        vDSP_zvmags(&sc, 1, mag, 1, vDSP_Length(half))
        return mag
    }
}

final class Analysis {
    let sr: Double
    let hop = 512
    let dtH: Double                   // seconds a hop
    let duration: Double
    var n = 0
    var bass: [Float] = []            // 0..1, against the track's own range
    var tension: [Float] = []         // 0..1: loud and full
    var hatLv: [Float] = []
    var beats: [Double] = []          // seconds
    var kick: [Float] = []            // how hard the kick is on each beat, 0..1
    var period: Double = 0.5
    var bpm: Double = 120
    var conf: Float = 0
    var steady = false
    var stabs: [Double] = [], hats: [Double] = [], onsets: [Double] = []   // onsets: the low end's hits, for music without a steady beat
    var drops: [Double] = [], breaks: [Double] = []

    init(mono: [Float], sr: Double) {
        self.sr = sr
        dtH = Double(hop) / sr
        duration = Double(mono.count) / sr
        let N = 2048
        guard mono.count > N * 2 else { return }
        let fft = FFT(n: N), half = N / 2, binHz = sr / Double(N)
        n = (mono.count - N) / hop + 1
        func bins(_ lo: Double, _ hi: Double) -> Range<Int> {
            let a = max(1, Int(lo / binHz)), b = min(half, max(a + 2, Int(hi / binHz) + 1))
            return a..<b
        }
        let bl = bins(30, 150), bm = bins(300, 2500), bh = bins(6000, 16000), ba = bins(30, 16000)
        var low = [Float](repeating: 0, count: n), mid = low, high = low, all = low
        mono.withUnsafeBufferPointer { mp in
            guard let base = mp.baseAddress else { return }
            for i in 0..<n {
                let m = fft.power(base + i * hop)
                func db(_ r: Range<Int>) -> Float { var s: Float = 0; for k in r { s += m[k] }; return 10 * log10(s + 1e-9) }
                low[i] = db(bl); mid[i] = db(bm); high[i] = db(bh); all[i] = db(ba)
            }
        }
        // onsets: each band's rise over the last two hops
        func rise(_ x: [Float]) -> [Float] { var o = [Float](repeating: 0, count: x.count); for i in 2..<x.count { o[i] = max(0, x[i] - x[i - 2]) }; return o }
        let oLow = rise(low), oMid = rise(mid), oHigh = rise(high), oAll = rise(all)
        var o = [Float](repeating: 0, count: n)
        for i in 0..<n { o[i] = oLow[i] + 0.5 * oAll[i] }
        findBeats(o, oLow)
        stabs = peaks(oMid, q: 0.93, gap: 0.12)
        hats = peaks(oHigh, q: 0.9, gap: 0.08)
        onsets = peaks(oLow, q: 0.97, gap: 0.3)
        // the bass, the tension
        bass = norm(ema(low, 0.25), 0.05, 0.98)
        let allN = norm(ema(all, 3), 0.1, 0.95)
        hatLv = norm(ema(high, 1), 0.1, 0.95)
        tension = (0..<n).map { 0.65 * allN[$0] + 0.35 * hatLv[$0] }
        findDrops(ema(low, 0.5))
    }

    // ---- the tempo and the beats: the onsets' autocorrelation for a rough period, then the period and phase where every
    // onset lines up best; how well they line up says whether there's a steady beat at all ----
    private func findBeats(_ o: [Float], _ oLow: [Float]) {
        let lagLo = Int(60.0 / 180.0 / dtH), lagHi = Int(60.0 / 70.0 / dtH) + 1
        guard n > lagHi * 8 else { return }
        var bestLag = lagLo, bestS: Float = -1
        for lag in lagLo...lagHi {
            var s: Float = 0
            for i in lag..<n { s += o[i] * o[i - lag] }
            let bpmL = 60 / (Double(lag) * dtH), w = Float(exp(-0.5 * pow(log2(bpmL / 125) / 0.6, 2)))   // (a gentle lean to dance tempos)
            s = s / Float(n - lag) * (0.6 + 0.4 * w)
            if s > bestS { bestS = s; bestLag = lag }
        }
        func at(_ x: Double) -> Float { let i = Int(x), f = Float(x - Double(i)); return i + 1 < n && i >= 0 ? o[i] * (1 - f) + o[i + 1] * f : 0 }
        var bestP = Double(bestLag), bestPh = 0.0, best: Float = -1, meanAtBest: Float = 1
        var P = Double(bestLag) - 1
        while P <= Double(bestLag) + 1 {
            var ph = 0.0, sum: Float = 0, cnt: Float = 0, top: Float = -1, topPh = 0.0
            while ph < P {
                var s: Float = 0, k = ph
                while k < Double(n - 1) { s += at(k); k += P }
                sum += s; cnt += 1
                if s > top { top = s; topPh = ph }
                ph += 0.5
            }
            if top > best { best = top; bestP = P; bestPh = topPh; meanAtBest = sum / max(cnt, 1) }
            P += 0.02
        }
        period = bestP * dtH
        bpm = 60 / period
        conf = (best - meanAtBest) / max(meanAtBest, 1e-6)
        steady = conf > 3.5   // (the demo and synthetic techno score 8 to 13, music played freely about 2)
        var k = bestPh
        while k < Double(n - 1) { beats.append(k * dtH); k += bestP }
        // the kick on each beat: the low end's rise there, against the track's strong ones
        var raw = beats.map { b -> Float in let i = Int(b / dtH); var m: Float = 0; for j in max(0, i - 2)...min(n - 1, i + 2) { m = max(m, oLow[j]) }; return m }
        let top = pct(raw, 0.9)
        raw = raw.map { min(1, $0 / max(top, 1e-3)) }
        kick = raw
    }

    // ---- breakdowns and drops: the bass well under its loudest lately for a few seconds is a breakdown, its return the drop ----
    private func findDrops(_ env: [Float]) {
        var rm: Float = -200, under = 0.0, inBreak = false, lastDrop = -100.0, brStart = 0.0
        for i in 0..<n {
            let t = Double(i) * dtH
            rm = max(env[i], rm - Float(0.3 * dtH))
            if env[i] < rm - 9 { if under == 0 { brStart = t }; under += dtH } else if !inBreak { under = 0 }
            if !inBreak && under >= 4 { inBreak = true; breaks.append(brStart) }
            if inBreak && env[i] > rm - 4 {
                inBreak = false; under = 0
                if t > 8 && t - lastDrop > 15 {
                    var d = t - 0.15
                    if steady, let b = beats.first(where: { $0 >= d - period * 0.5 }) { d = b }   // (onto the beat)
                    drops.append(d); lastDrop = d
                }
            }
        }
    }

    private func peaks(_ x: [Float], q: Float, gap: Double) -> [Double] {
        let thr = max(pct(x, q), 0.5)
        var out: [Double] = [], last = -1.0
        for i in 1..<(n - 1) where x[i] >= thr && x[i] >= x[i - 1] && x[i] >= x[i + 1] {
            let t = Double(i) * dtH
            if t - last >= gap { out.append(t); last = t }
        }
        return out
    }
    private func ema(_ x: [Float], _ tau: Double) -> [Float] {
        let a = Float(1 - exp(-dtH / tau)); var y = x; var v = x.first ?? 0
        for i in 0..<x.count { v += (x[i] - v) * a; y[i] = v }
        return y
    }
    private func pct(_ x: [Float], _ q: Float) -> Float {
        if x.isEmpty { return 0 }
        let s = x.sorted(); return s[min(s.count - 1, Int(Float(s.count - 1) * q))]
    }
    private func norm(_ x: [Float], _ lo: Float, _ hi: Float) -> [Float] {
        let a = pct(x, lo), b = pct(x, hi), d = max(b - a, 1e-3)
        return x.map { min(1, max(0, ($0 - a) / d)) }
    }

    // a value at time t
    func at(_ arr: [Float], _ t: Double) -> Float {
        if arr.isEmpty { return 0 }
        return arr[max(0, min(arr.count - 1, Int(t / dtH)))]
    }
}
