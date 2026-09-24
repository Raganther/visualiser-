// Media for the mirror tunnel: a video, an image or the camera, whichever was added last. A leaf module (no engine
// imports), so visuals can read MEDIA directly; the engine decides what to do with it.
export const MEDIA = {on: false, kind: null, el: null, stream: null, url: null, audio: false,
  get w(){ return this.el ? this.el.videoWidth || this.el.naturalWidth || 0 : 0; },
  get h(){ return this.el ? this.el.videoHeight || this.el.naturalHeight || 0 : 0; },
  // true once there's a picture to show
  get ready(){ return !!this.el && (this.kind === 'image' ? this.el.complete && this.el.naturalWidth > 0 : this.el.readyState >= 2); },
  version: 0,                  // bumps when the source changes, so a still image is uploaded once
};

export function clearMedia(){
  if (MEDIA.stream) MEDIA.stream.getTracks().forEach(t => t.stop());
  if (MEDIA.el && MEDIA.kind !== 'image') { MEDIA.el.pause(); MEDIA.el.removeAttribute('src'); MEDIA.el.srcObject = null; }
  if (MEDIA.url) URL.revokeObjectURL(MEDIA.url);
  Object.assign(MEDIA, {on: false, kind: null, el: null, stream: null, url: null, audio: false}); MEDIA.version++;
}

function video(){
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.crossOrigin = 'anonymous';
  return v;
}

// a dropped video or image file
export function setMediaFile(file){
  clearMedia();
  const url = URL.createObjectURL(file), isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name);
  const el = isImage ? new Image() : video();
  el.src = url;
  if (!isImage) el.play().catch(() => {});
  Object.assign(MEDIA, {on: true, kind: isImage ? 'image' : 'video', el, url}); MEDIA.version++;
  return MEDIA.kind;
}

// any ready-made element or stream (tests use a canvas stream)
export function setMediaElement(el, kind = el instanceof HTMLImageElement ? 'image' : 'video'){
  clearMedia();
  Object.assign(MEDIA, {on: true, kind, el}); MEDIA.version++;
}

// the camera: the back camera on a phone if there is one. Resolves true if it started.
export async function startCamera(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment', width: {ideal: 1280}}, audio: false});
  clearMedia();
  const el = video(); el.srcObject = stream; el.play().catch(() => {});
  Object.assign(MEDIA, {on: true, kind: 'camera', el, stream}); MEDIA.version++;
  return true;
}

export const isMediaFile = f => /^(video|image)\//.test(f.type) || /\.(mp4|webm|mov|m4v|png|jpe?g|gif|webp|avif)$/i.test(f.name);
