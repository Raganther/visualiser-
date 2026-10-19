# A spectrogram of a render for the listening page: time across, frequency up on a log scale (30 Hz to 16 kHz), loudness
# as colour (dark to warm to white), no labels (the page draws the sections over it). Usage: python3 spectrogram.py in.wav out.png
import sys, wave, zlib, struct
import numpy as np

W, H, F0, F1, FLOOR = 1600, 360, 30.0, 16000.0, -90.0
w = wave.open(sys.argv[1]); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, w.getnchannels()).astype(np.float32).mean(1)/32768
n = 8192; hop = max(1, (len(x) - n)//W); win = np.hanning(n)
freqs = np.fft.rfftfreq(n, 1/sr); edges = F0*(F1/F0)**(np.arange(H + 1)/H)
idx = [np.where((freqs >= edges[i]) & (freqs < max(edges[i + 1], edges[i] + sr/n)))[0] for i in range(H)]
img = np.zeros((H, W))
for c in range(W):
    seg = x[c*hop:c*hop + n]
    if len(seg) < n: seg = np.pad(seg, (0, n - len(seg)))
    p = np.abs(np.fft.rfft(seg*win))**2
    img[:, c] = [10*np.log10(p[i].mean() + 1e-20) if len(i) else -200 for i in idx]
img = np.clip((img - img.max() - FLOOR)/-FLOOR, 0, 1)[::-1]
# a palette: ink blue to magenta to amber to white
stops = np.array([[10, 13, 20], [52, 30, 90], [180, 50, 120], [245, 150, 60], [255, 245, 220]], float)
t = img*(len(stops) - 1); i = np.minimum(t.astype(int), len(stops) - 2); f = (t - i)[..., None]
rgb = (stops[i]*(1 - f) + stops[i + 1]*f).astype(np.uint8)
raw = b''.join(b'\x00' + rgb[r].tobytes() for r in range(H))
chunk = lambda k, d: struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
open(sys.argv[2], 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
