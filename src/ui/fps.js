// The frame-rate readout (on until hidden with P or "Show frame rate" in the panel): frames drawn a second, the time each takes, and what's on screen.
import { $ } from '../util.js';

const on0 = (() => { try { return localStorage.getItem('afterglow.fps') !== '0'; } catch (e) { return true; } })();
let on = on0, n = 0, cpu = 0, worst = 0, since = 0, lastT = 0, gap = 0;
export function showFps(v){
  on = v; $('#fps').hidden = !v; $('#fpsOn').checked = v; n = cpu = worst = gap = 0; since = 0;
  try { localStorage.setItem('afterglow.fps', v ? '1' : '0'); } catch (e) {}
}
// once a drawn frame: when it started, how long render() took, and what it drew (updated twice a second)
export function fpsTick(now, ms, info){
  if (lastT) gap = Math.max(gap, now - lastT);
  lastT = now;
  if (!on) return;
  if (!since) since = now;
  n++; cpu += ms; worst = Math.max(worst, ms);
  if (now - since < 500) return;
  const fps = n*1000/(now - since), el = $('#fps');
  el.className = fps >= 55 ? 'good' : fps >= 30 ? 'ok' : 'bad';
  el.textContent = `${fps.toFixed(0)} fps\nlongest gap ${gap.toFixed(0)} ms; script ${(cpu/n).toFixed(1)} ms a frame, worst ${worst.toFixed(0)}\n${info()}`;
  n = cpu = worst = gap = 0; since = now;
}
$('#fpsOn').addEventListener('change', e => showFps(e.target.checked));
showFps(on0);
