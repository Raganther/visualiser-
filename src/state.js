// Shared buffers and the few variables that several modules reassign (as properties of S).

export const HIST = new Uint8Array(256);   // loudness over the last ~30 seconds, oldest first
export const dataArr = new Uint8Array(512), waveS = new Float32Array(512).fill(128);
export const freq = new Uint8Array(1024), wave = new Uint8Array(2048);
// the spectrum in decibels, not clipped: loud masters go past the bytes' -30 dB ceiling in the sub-bass (a third to half of
// the frames on the user's techno), which flattened every kick; the kick detector and the listening read this instead
export const freqDb = new Float32Array(1024);
// the left and right channels' waveforms, 64 samples each (interleaved), for the vectorscope
export const scopeLR = new Float32Array(128);

// variables that several modules reassign live here as properties
export const S = {
  active: null,                  // the preset in use (jState during Journey); set once presets load
  glGen: 0,                      // bumps when a lost WebGL context is restored, so visuals rebuild their own GL objects
  pIndex: 0,                     // which preset the arrows are on
  beatsInPreset: 0, presetSince: performance.now(),
  beatPeriod: .5,                // seconds per beat, from the beat grid once it locks
  MT: 0,                         // motion time: runs slower in calm sections
  beat: 0,                       // the visual pulse, 0..1, decaying each frame
  hueKick: 0,                    // colour nudges from pulses, drops and section changes
  shockN: 0,                     // next shockwave slot to reuse
  pausedAt: 0,                   // playback position while paused
  scene: null,                   // the manual preset's scene (scene/graph.js); none means the default
  syncMs: 0,                     // the Sync slider: + draws the beat later, - earlier (for this device's speakers and screen)
  view: null,                    // the Asset Viewer's hold on the object it shows (ui/assets.js): {key, yaw, pitch, zoom, morph (null: the music's)}
};
