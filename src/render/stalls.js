// The stall recorder: what happened in any frame that froze the picture. The user's laptop freezes at big transitions while
// the music plays on, and this machine can't reproduce its graphics driver, so the page keeps its own record: every frame
// over `TUNE.render.stallMs` from the one before, with what was going on in it (shaders started, finished and first drawn,
// surfaces made, Journey's changes, how long the script and the drawing took). Kept on the device (afterglow.stalls, the last
// 40) and copied from the panel ("Copy the stall log") to paste to Claude. A leaf module: anything can mark.
const KEY = 'afterglow.stalls';
export const STALL = {ev: [], log: (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } })(), visit: 0, worst: 0, last: 0, gpu: ''};
// something that happened now (kept a couple of seconds, so a stall can show what came just before it)
export function mark(what){ const t = performance.now(); STALL.ev.push([t, what]); while (STALL.ev.length && t - STALL.ev[0][0] > 2500) STALL.ev.shift(); }
// once a frame, at its start: was the gap since the last one a stall? (script: how long the last frame's own work took)
export function stallCheck(now, script, draw, info, limit){
  const gap = STALL.last ? now - STALL.last : 0; STALL.last = now;
  if (gap < limit || gap > 15000 || document.visibilityState !== 'visible') return;   // (a hidden tab draws nothing: not a freeze)
  STALL.visit++; STALL.worst = Math.max(STALL.worst, gap);
  const ev = STALL.ev.filter(e => e[0] > now - gap - 400).map(e => { const d = Math.round(e[0] - (now - gap)); return `${d < 0 ? -d + ' ms before' : d + ' ms in'}: ${e[1]}`; });
  STALL.log.push({when: new Date().toISOString().slice(11, 19), gap: Math.round(gap), script: +script.toFixed(1), draw: +draw.toFixed(1), what: info(), ev});
  if (STALL.log.length > 40) STALL.log.splice(0, STALL.log.length - 40);
  try { localStorage.setItem(KEY, JSON.stringify(STALL.log)); } catch (e) {}
}
// the log as text, for pasting
export const stallText = ua => `Afterglow stall log (${STALL.log.length} stalls kept; ${STALL.visit} this visit, worst ${Math.round(STALL.worst)} ms)\n${ua}\n${STALL.gpu}\n\n` +
  STALL.log.map(s => `${s.when}  froze ${s.gap} ms (script ${s.script} ms, drawing ${s.draw} ms)\n  on screen: ${s.what}\n` + s.ev.map(e => '  ' + e).join('\n')).join('\n\n');
export function stallClear(){ STALL.log = []; STALL.visit = 0; STALL.worst = 0; try { localStorage.removeItem(KEY); } catch (e) {} }
