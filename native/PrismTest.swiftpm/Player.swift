// The music: a track from Files, read ahead before it plays (Analysis), or the demo beat; and where it is as heard.
import AVFoundation
import Foundation

final class Player {
    let engine = AVAudioEngine()
    let node = AVAudioPlayerNode()
    private(set) var analysis: Analysis?
    private(set) var playing = false
    private(set) var name = ""
    private var loaded = false
    private var loopLen = 0.0
    private var lastT = 0.0

    init() {
        engine.attach(node)
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default)
        try? s.setActive(true)
    }

    // a track: copied out of Files, read whole for the analysis, then played from the start
    func load(_ url: URL, done: @escaping (String?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let mono = try Player.readMono(url)
                let file = try AVAudioFile(forReading: url)
                let a = Analysis(mono: mono, sr: file.processingFormat.sampleRate)
                DispatchQueue.main.async {
                    self.stop()
                    self.analysis = a
                    self.name = url.deletingPathExtension().lastPathComponent
                    self.loopLen = 0
                    self.connect(file.processingFormat)
                    self.node.scheduleFile(file, at: nil, completionHandler: nil)
                    self.begin()
                    done(nil)
                }
            } catch {
                DispatchQueue.main.async { done(error.localizedDescription) }
            }
        }
    }

    // the demo beat: sixteen bars of minimal techno at 124 BPM with a breakdown and a drop, looped
    func demo(done: @escaping () -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let (buf, mono) = Demo.make()
            let a = Analysis(mono: mono, sr: Demo.sr)
            DispatchQueue.main.async {
                self.stop()
                self.analysis = a
                self.name = "Demo beat"
                self.loopLen = Double(buf.frameLength) / Demo.sr
                self.connect(buf.format)
                self.node.scheduleBuffer(buf, at: nil, options: .loops, completionHandler: nil)
                self.begin()
                done()
            }
        }
    }

    static func readMono(_ url: URL) throws -> [Float] {
        let f = try AVAudioFile(forReading: url)
        let fmt = f.processingFormat, ch = Int(fmt.channelCount), cap: AVAudioFrameCount = 65536
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: cap) else { return [] }
        var out = [Float]()
        out.reserveCapacity(Int(f.length))
        while f.framePosition < f.length {
            try f.read(into: buf, frameCount: cap)
            let n = Int(buf.frameLength)
            guard n > 0, let d = buf.floatChannelData else { break }
            let k = 1 / Float(ch)
            for i in 0..<n {
                var s: Float = 0
                for c in 0..<ch { s += d[c][i] }
                out.append(s * k)
            }
        }
        return out
    }

    private func connect(_ fmt: AVAudioFormat) {
        engine.stop()
        engine.disconnectNodeOutput(node)
        engine.connect(node, to: engine.mainMixerNode, format: fmt)
        engine.prepare()
    }
    private func begin() {
        do { try engine.start() } catch { return }
        node.play()
        playing = true
        loaded = true
        lastT = 0
    }
    func stop() {
        node.stop()
        playing = false
        lastT = 0
    }
    func toggle() {
        guard loaded else { return }
        if playing { node.pause(); playing = false }
        else {
            if !engine.isRunning { try? engine.start() }
            node.play(); playing = true
        }
    }

    // where the music is as heard: the player's own clock, carried on from its last render by the host clock, less the
    // speakers' delay (big on Bluetooth)
    var time: Double {
        guard playing, let nt = node.lastRenderTime, let pt = node.playerTime(forNodeTime: nt) else { return lastT }
        var t = Double(pt.sampleTime) / pt.sampleRate
        if nt.isHostTimeValid {
            let since = AVAudioTime.seconds(forHostTime: mach_absolute_time()) - AVAudioTime.seconds(forHostTime: nt.hostTime)
            t += max(0, min(0.1, since))
        }
        t -= AVAudioSession.sharedInstance().outputLatency
        if loopLen > 0 { t = t.truncatingRemainder(dividingBy: loopLen); if t < 0 { t += loopLen } }
        lastT = max(0, t)
        return lastT
    }
}

// ---- the demo beat, made here: kick, off-beat bass, claps on 2 and 4, hats, a stab every other bar, and a pad in the
// breakdown (bars 9 to 12, no kick or bass), so the drop comes back on bar 13 ----
enum Demo {
    static let sr = 44100.0
    static func make() -> (AVAudioPCMBuffer, [Float]) {
        let bpm = 124.0, beat = 60 / bpm, beats = 64, n = Int(Double(beats) * beat * sr)
        let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2)!
        let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n))!
        buf.frameLength = AVAudioFrameCount(n)
        let L = buf.floatChannelData![0], R = buf.floatChannelData![1]
        var mono = [Float](repeating: 0, count: n)
        var seed: UInt32 = 12345
        func noise() -> Float { seed = seed &* 1664525 &+ 1013904223; return Float(seed >> 8) / 8388608 - 1 }
        var kPh = 0.0, bPh = 0.0, bLp: Float = 0, hPrev: Float = 0, cLp: Float = 0, cHp: Float = 0
        for i in 0..<n {
            let t = Double(i) / sr, b = t / beat, bi = Int(b), bt = (b - Double(bi)) * beat, bar = bi / 4
            let brk = bar >= 8 && bar < 12
            var l: Float = 0, r: Float = 0
            // kick: a sine falling from high to its note, and a click
            if !brk && bt < 0.45 {
                let f = 48 + 120 * exp(-bt * 32)
                kPh += 2 * .pi * f / sr
                let k = Float(sin(kPh) * exp(-bt * 6.5)) * 0.9 + (bt < 0.004 ? noise() * 0.3 : 0)
                l += k; r += k
            } else if bt >= 0.45 { kPh = 0 }
            // bass on the off-beat
            let ob = bt - beat * 0.5
            if !brk && ob >= 0 && ob < 0.22 {
                bPh += 55 / sr
                let saw = Float(2 * (bPh - floor(bPh)) - 1)
                bLp += (saw - bLp) * 0.06
                let v = bLp * Float(exp(-ob * 9)) * 0.55
                l += v; r += v
            }
            // claps on 2 and 4
            if bi % 2 == 1 && bt < 0.18 {
                let x = noise(); cHp = x - cLp; cLp += (x - cLp) * 0.3
                let env = Float(exp(-bt * 22) * (bt < 0.02 ? 0.6 + 0.4 * sin(bt * 900) : 1))
                l += cHp * env * 0.35; r += cHp * env * 0.28
            }
            // hats every sixteenth from bar 3, the off-beats louder
            let s16 = beat / 4, st = t.truncatingRemainder(dividingBy: s16), si = Int(t / s16) % 4
            if bar >= 2 && st < 0.05 {
                let x = noise(), h = x - hPrev; hPrev = x
                let v = h * Float(exp(-st * 70)) * (si == 2 ? 0.16 : 0.07)
                l += v * 0.7; r += v
            }
            // a stab on the last sixteenth of every other bar
            let inBar = b - Double(bar * 4)
            if bar % 2 == 1 && inBar >= 3.5 && inBar < 3.5 + 0.15 / beat {
                let tt = (inBar - 3.5) * beat
                var v = 0.0
                for f in [220.0, 261.63, 329.63] { let p = t * f; v += 2 * (p - floor(p)) - 1 }
                let s = Float(v / 3 * exp(-tt * 18)) * 0.22
                l += s * 0.8; r += s
            }
            // a pad through the breakdown
            if brk {
                let into = t - Double(8 * 4) * beat, fade = Float(min(1, into / 2) * min(1, (Double(12 * 4) * beat - t) / 0.5))
                var v = 0.0
                for f in [110.0, 164.81, 220.0, 261.63] { v += sin(2 * .pi * f * t + sin(t * 0.7 + f)) }
                let s = Float(v / 4) * 0.18 * fade
                l += s; r += s * 0.9
            }
            l = tanh(l); r = tanh(r)
            L[i] = l; R[i] = r
            mono[i] = (l + r) * 0.5
        }
        return (buf, mono)
    }
}
