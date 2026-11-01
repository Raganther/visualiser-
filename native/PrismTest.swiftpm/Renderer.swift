// Drawing the Prism with Metal: its facets as glass far side first, then near side, each lit by the three lamps with the
// glint split into a rainbow (the fire) and its own glowing edges; into a half-float picture, then a glow (the bright parts
// blurred at half size) added back, the brightness rolled off softly, and a dither. The shaders are compiled from source at
// launch, so the package needs no Metal build step (Swift Playgrounds can't compile .metal files).
import Metal
import MetalKit
import MetalPerformanceShaders
import simd

struct Uni {
    var proj: simd_float4x4
    var cam: SIMD4<Float>       // the camera's place
    var l0d: SIMD4<Float>, l0c: SIMD4<Float>
    var l1d: SIMD4<Float>, l1c: SIMD4<Float>
    var l2d: SIMD4<Float>, l2c: SIMD4<Float>
    var p: SIMD4<Float>         // fire, edge glow, the glass's alpha, the far side's dimming
    var p2: SIMD4<Float>        // ambient, fresnel, -, which side (0 far, 1 near)
}

private let SHADERS = """
#include <metal_stdlib>
using namespace metal;
struct Vtx { float3 pos; float3 nrm; float3 bary; float3 edge; float4 col; };
struct Uni { float4x4 proj; float4 cam; float4 l0d, l0c, l1d, l1c, l2d, l2c; float4 p; float4 p2; };
struct VOut { float4 position [[position]]; float3 wpos; float3 nrm; float3 bary; float3 edge; float4 col; };

vertex VOut vmain(uint vid [[vertex_id]], const device Vtx* v [[buffer(0)]], constant Uni& u [[buffer(1)]]) {
  Vtx x = v[vid]; VOut o;
  o.position = u.proj * float4(x.pos - u.cam.xyz, 1.0);
  o.wpos = x.pos; o.nrm = x.nrm; o.bary = x.bary; o.edge = x.edge; o.col = x.col;
  return o;
}

float3 lamp(float3 n, float3 V, float3 tint, float4 ld, float4 lc, float fire) {
  float3 L = normalize(ld.xyz);
  float diff = max(dot(n, L), 0.0);
  float3 R = reflect(-L, n);
  float3 side = normalize(cross(n, float3(0.0, 1.0, 0.0)) + float3(1e-4, 0.0, 0.0));
  float sh = 70.0;
  float sr = pow(max(dot(R, normalize(V + side * fire * 0.07)), 0.0), sh);
  float sg = pow(max(dot(R, V), 0.0), sh);
  float sb = pow(max(dot(R, normalize(V - side * fire * 0.07)), 0.0), sh);
  float3 spec = fire > 0.0 ? float3(sr, sg, sb) : float3(sg);
  return lc.rgb * (tint * diff * 0.45 + spec * 1.7);
}

fragment float4 fmain(VOut i [[stage_in]], constant Uni& u [[buffer(1)]]) {
  float3 N = normalize(i.nrm);
  float3 V = normalize(u.cam.xyz - i.wpos);
  float facing = dot(N, V);
  bool isFar = facing < 0.0;
  if (isFar != (u.p2.w < 0.5)) discard_fragment();
  float3 n = isFar ? -N : N;
  float ndv = abs(facing), fres = pow(1.0 - ndv, 3.0);
  float3 tint = i.col.rgb; float lit = i.col.a;
  float3 c = tint * (u.p2.x * (0.55 + 0.45 * n.y) + lit * 1.3);
  c += lamp(n, V, tint, u.l0d, u.l0c, u.p.x);
  c += lamp(n, V, tint, u.l1d, u.l1c, u.p.x);
  c += lamp(n, V, tint, u.l2d, u.l2c, 0.0);
  c += (tint * 1.5 + 0.1) * fres * u.p2.y;
  // its edges: a fine core and a soft glow, each edge as strong as its level allows
  float3 d = i.bary / max(fwidth(i.bary), float3(1e-5));
  float3 line = (1.0 - smoothstep(float3(0.5), float3(1.6), d)) * i.edge;
  float3 glow = exp(-d / 5.0) * 0.3 * i.edge;
  float e = max(max(line.x + glow.x, line.y + glow.y), line.z + glow.z);
  float3 ec = mix(tint * 2.2, float3(1.0), float3(0.3)) * (0.7 + 2.2 * lit) * u.p.y;
  c += ec * e;
  float a = clamp(u.p.z + fres * 0.45 + lit * 0.25, 0.0, 1.0);
  if (isFar) { c *= u.p.w; a *= 0.6; }
  return float4(c, a);
}

struct FOut { float4 position [[position]]; float2 uv; };
vertex FOut vfull(uint vid [[vertex_id]]) {
  float2 p = float2(float((vid << 1) & 2u), float(vid & 2u));
  FOut o; o.position = float4(p * 2.0 - 1.0, 0.0, 1.0); o.uv = float2(p.x, 1.0 - p.y); return o;
}
fragment float4 fcomp(FOut i [[stage_in]], texture2d<float> sc [[texture(0)]], texture2d<float> bl [[texture(1)]], constant float4& cp [[buffer(0)]]) {
  constexpr sampler s(filter::linear, address::clamp_to_edge);
  float3 c = sc.sample(s, i.uv).rgb + bl.sample(s, i.uv).rgb * cp.x;
  c = 1.0 - exp(-c * cp.y);
  float n = fract(sin(dot(i.position.xy, float2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 255.0;
  return float4(c, 1.0);
}
"""

final class Renderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    let queue: MTLCommandQueue
    let prism = Prism()
    let player = Player()
    private var facetPipe: MTLRenderPipelineState?
    private var compPipe: MTLRenderPipelineState?
    private var bufs: [MTLBuffer] = []
    private var bi = 0
    private let sem = DispatchSemaphore(value: 3)
    private var sceneTex: MTLTexture?, halfTex: MTLTexture?, blurTex: MTLTexture?
    private var scaler: MPSImageBilinearScale?
    private var blur: MPSImageGaussianBlur?
    private var last = 0.0
    private(set) var fps: Double = 0
    var error: String?

    init?(_ d: MTLDevice? = MTLCreateSystemDefaultDevice()) {
        guard let d = d, let q = d.makeCommandQueue() else { return nil }
        device = d; queue = q
        super.init()
        do {
            let lib = try d.makeLibrary(source: SHADERS, options: nil)
            let pd = MTLRenderPipelineDescriptor()
            pd.vertexFunction = lib.makeFunction(name: "vmain")
            pd.fragmentFunction = lib.makeFunction(name: "fmain")
            let ca = pd.colorAttachments[0]!
            ca.pixelFormat = .rgba16Float
            ca.isBlendingEnabled = true
            ca.rgbBlendOperation = .add; ca.alphaBlendOperation = .add
            ca.sourceRGBBlendFactor = .one; ca.sourceAlphaBlendFactor = .one
            ca.destinationRGBBlendFactor = .oneMinusSourceAlpha; ca.destinationAlphaBlendFactor = .oneMinusSourceAlpha
            facetPipe = try d.makeRenderPipelineState(descriptor: pd)
            let cd = MTLRenderPipelineDescriptor()
            cd.vertexFunction = lib.makeFunction(name: "vfull")
            cd.fragmentFunction = lib.makeFunction(name: "fcomp")
            cd.colorAttachments[0].pixelFormat = .bgra8Unorm
            compPipe = try d.makeRenderPipelineState(descriptor: cd)
        } catch {
            self.error = "The shaders didn't build: \(error)"
        }
        let len = MemoryLayout<Vtx>.stride * prism.verts.count
        for _ in 0..<3 { if let b = d.makeBuffer(length: len, options: .storageModeShared) { bufs.append(b) } }
        if MPSSupportsMTLDevice(d) {
            scaler = MPSImageBilinearScale(device: d)
            blur = MPSImageGaussianBlur(device: d, sigma: 14)
            blur?.edgeMode = .clamp
        }
    }

    private func textures(_ size: CGSize) {
        let w = max(1, Int(size.width)), h = max(1, Int(size.height))
        if let t = sceneTex, t.width == w, t.height == h { return }
        func make(_ w: Int, _ h: Int) -> MTLTexture? {
            let td = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: w, height: h, mipmapped: false)
            td.usage = [.renderTarget, .shaderRead, .shaderWrite]
            td.storageMode = .private
            return device.makeTexture(descriptor: td)
        }
        sceneTex = make(w, h)
        halfTex = make(max(1, w / 2), max(1, h / 2))
        blurTex = make(max(1, w / 2), max(1, h / 2))
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) { textures(size) }

    func draw(in view: MTKView) {
        let now = ProcessInfo.processInfo.systemUptime
        let dt = last == 0 ? 1.0 / 60 : min(0.1, now - last)
        last = now
        fps += (1 / max(dt, 1e-3) - fps) * 0.05
        let size = view.drawableSize
        guard size.width > 0, size.height > 0, bufs.count == 3, let facetPipe = facetPipe, let compPipe = compPipe else { return }
        prism.aspect = Float(size.width / size.height)
        sem.wait()
        prism.step(dt: Float(dt), player: player)
        let buf = bufs[bi]; bi = (bi + 1) % 3
        prism.verts.withUnsafeBytes { src in buf.contents().copyMemory(from: src.baseAddress!, byteCount: src.count) }
        guard let cb = queue.makeCommandBuffer() else { sem.signal(); return }
        cb.addCompletedHandler { [sem] _ in sem.signal() }
        textures(size)
        guard let scene = sceneTex, let half = halfTex, let bl = blurTex else { cb.commit(); return }

        // the facets: the far side, then the near
        let L = prism.lights()
        let f = Tune.focal, a = Float(size.width / size.height), zn: Float = 0.05, zf: Float = 50
        let proj = simd_float4x4(SIMD4<Float>(f / a, 0, 0, 0), SIMD4<Float>(0, f, 0, 0), SIMD4<Float>(0, 0, zf / (zn - zf), -1), SIMD4<Float>(0, 0, zn * zf / (zn - zf), 0))
        var u = Uni(proj: proj, cam: SIMD4<Float>(0, 0, prism.camZ, 0), l0d: L[0], l0c: L[1], l1d: L[2], l1c: L[3], l2d: L[4], l2c: L[5],
                    p: SIMD4<Float>(Tune.fire, 1, 0.2, 0.45), p2: SIMD4<Float>(0.45, 0.6, 0, 0))
        let rp = MTLRenderPassDescriptor()
        rp.colorAttachments[0].texture = scene
        rp.colorAttachments[0].loadAction = .clear
        rp.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        rp.colorAttachments[0].storeAction = .store
        if let enc = cb.makeRenderCommandEncoder(descriptor: rp) {
            enc.setRenderPipelineState(facetPipe)
            enc.setVertexBuffer(buf, offset: 0, index: 0)
            for side in 0..<2 {
                u.p2.w = Float(side)
                enc.setVertexBytes(&u, length: MemoryLayout<Uni>.stride, index: 1)
                enc.setFragmentBytes(&u, length: MemoryLayout<Uni>.stride, index: 1)
                enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: prism.verts.count)
            }
            enc.endEncoding()
        }
        // the glow: the picture at half size, blurred
        var glow: Float = 0
        if let sc = scaler, let b = blur {
            sc.encode(commandBuffer: cb, sourceTexture: scene, destinationTexture: half)
            b.encode(commandBuffer: cb, sourceTexture: half, destinationTexture: bl)
            glow = 0.9
        }
        guard let pass = view.currentRenderPassDescriptor, let drawable = view.currentDrawable,
              let enc = cb.makeRenderCommandEncoder(descriptor: pass) else { cb.commit(); return }
        var cp = SIMD4<Float>(glow, 1.25, 0, 0)
        enc.setRenderPipelineState(compPipe)
        enc.setFragmentTexture(scene, index: 0)
        enc.setFragmentTexture(glow > 0 ? bl : scene, index: 1)
        enc.setFragmentBytes(&cp, length: MemoryLayout<SIMD4<Float>>.stride, index: 0)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
        cb.present(drawable)
        cb.commit()
    }
}
