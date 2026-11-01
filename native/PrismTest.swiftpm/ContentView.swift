// The screen: the Prism full screen, Jam by touch (drag beside it to turn it, press on it and drag out for spikes, in or
// hold for dents, tap for a ring of light, pinch to come closer), and a bar: your music, the demo beat, play, a new shape,
// a drop now, the facets held or the music's, and the bar hidden.
import SwiftUI
import MetalKit
import UniformTypeIdentifiers

final class Model: ObservableObject {
    let renderer = Renderer()
    @Published var status = ""
    @Published var note = ""
    @Published var busy = false
    @Published var detail = -1
    private var timer: Timer?

    init() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.tick() }
    }
    private func tick() {
        guard let r = renderer else { status = "This device has no Metal"; return }
        if let e = r.error { status = e; return }
        let p = r.prism
        status = "\(p.info)\n\(p.shapeName) · \(p.facets) facets · activity \(Int(p.activity * 100))% · \(Int(r.fps.rounded())) fps"
    }
    func load(_ url: URL) {
        guard let r = renderer else { return }
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        let dst = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
        try? FileManager.default.removeItem(at: dst)
        do { try FileManager.default.copyItem(at: url, to: dst) } catch { note = "Couldn't open it: \(error.localizedDescription)"; return }
        busy = true; note = "Reading ahead…"
        r.player.load(dst) { [weak self] err in
            self?.busy = false
            self?.note = err.map { "Couldn't play it: \($0)" } ?? ""
        }
    }
    func demo() {
        guard let r = renderer else { return }
        busy = true; note = "Making the demo beat…"
        r.player.demo { [weak self] in self?.busy = false; self?.note = "" }
    }
    func cycleDetail() {
        let modes = [-1, 0, 1, 2, 3]
        detail = modes[((modes.firstIndex(of: detail) ?? 0) + 1) % modes.count]
        renderer?.prism.detailMode = detail
    }
    var detailLabel: String { detail < 0 ? "Facets: auto" : "Facets: \([20, 80, 320, 1280][detail])" }
}

struct MetalView: UIViewRepresentable {
    let renderer: Renderer
    func makeUIView(context: Context) -> MTKView {
        let v = MTKView(frame: .zero, device: renderer.device)
        v.colorPixelFormat = .bgra8Unorm
        v.clearColor = MTLClearColorMake(0, 0, 0, 1)
        v.preferredFramesPerSecond = 60
        v.enableSetNeedsDisplay = false
        v.isPaused = false
        v.isUserInteractionEnabled = false   // (touches go to SwiftUI's gestures)
        v.delegate = renderer
        return v
    }
    func updateUIView(_ v: MTKView, context: Context) {}
}

struct ContentView: View {
    @StateObject private var model = Model()
    @State private var importing = false
    @State private var down = false
    @State private var zoomBase: Float = Tune.cam
    @State private var showBar = true
    @State private var playing = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                Color.black
                if let r = model.renderer {
                    MetalView(renderer: r)
                        .contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0)
                            .onChanged { g in
                                if !down { down = true; r.prism.touchBegan(g.startLocation, geo.size) }
                                r.prism.touchMoved(g.location, geo.size)
                            }
                            .onEnded { g in down = false; r.prism.touchEnded(g.location, geo.size) })
                        .simultaneousGesture(MagnificationGesture()
                            .onChanged { s in r.prism.zoom(zoomBase / Float(max(0.2, s))) }
                            .onEnded { _ in zoomBase = r.prism.camZ })
                }
                if showBar { bar.padding(.bottom, 28).padding(.horizontal, 16) }
                else {
                    Button { showBar = true } label: { Image(systemName: "ellipsis.circle").font(.title2).foregroundStyle(.white.opacity(0.35)) }
                        .padding(28)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                }
            }
        }
        .ignoresSafeArea()
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.audio], allowsMultipleSelection: false) { res in
            switch res {
            case .success(let urls): if let u = urls.first { model.load(u) }
            case .failure(let e): model.note = e.localizedDescription
            }
        }
    }

    private var bar: some View {
        VStack(spacing: 10) {
            Text(model.note.isEmpty ? model.status : model.note)
                .font(.footnote.monospaced())
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("＋ Music") { importing = true }
                    chip("Demo beat") { model.demo() }
                    chip(playing ? "Pause" : "Play") { model.renderer?.player.toggle(); playing = model.renderer?.player.playing ?? false }
                    chip("New shape") { model.renderer?.prism.nextShape() }
                    chip("Drop") { model.renderer?.prism.drop() }
                    chip(model.detailLabel) { model.cycleDetail() }
                    chip("Hide") { showBar = false }
                }
                .padding(.horizontal, 4)
            }
            .fixedSize(horizontal: false, vertical: true)
            Text("Drag beside it to turn it · press on it and drag out for spikes, in or hold for dents · tap it for a ring of light · pinch to come closer")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.4))
                .multilineTextAlignment(.center)
        }
        .disabled(model.busy)
        .onReceive(model.$status) { _ in playing = model.renderer?.player.playing ?? false }
    }

    private func chip(_ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.subheadline.weight(.medium))
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(.ultraThinMaterial, in: Capsule())
        }
        .foregroundStyle(.white)
    }
}
