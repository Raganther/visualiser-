// The jam's Band panel: Play along (the band plays every part that isn't yours, listening to the ones that are), how much
// it leads, what it hears (the key, the chords bar by bar), each part's role, and what it did, in plain words.
// mountBandPanel(parent, getBand) → {toggle, el}
import { h, btn, bar } from './kit.js';
import { scaleOf } from './hear.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const NAME = {drums: 'Kick & snare', hats: 'Hats', perc: 'Percussion', bass: 'Bass', chords: 'Chords', hook: 'Hook'};
// a chord on a degree as a numeral: capitals for major, small for minor, ° for diminished
const numeral = (K, d) => { const sc = scaleOf(K), t = (sc[(d + 2) % 7] - sc[d] + 12) % 12, f = (sc[(d + 4) % 7] - sc[d] + 12) % 12;
  return t === 4 ? ROMAN[d] : f === 6 ? ROMAN[d].toLowerCase() + '°' : ROMAN[d].toLowerCase(); };

export function mountBandPanel(parent, getBand){
  const el = h('div', 'jmix jband'); el.hidden = true; parent.appendChild(el);
  let unsub = null;
  function paint(){
    const b = getBand(), B = b.B, st = b.state, H = st.heard;
    el.innerHTML = '';
    const head = h('div', 'mxhead'); head.append(h('b', null, 'Band'), btn('✕', 'mxclose', () => toggle(false), 'Close')); el.appendChild(head);
    el.appendChild(h('p', 'mxwords', 'Plays the parts that aren’t yours, listening to the ones that are. Anything you play or edit by hand becomes yours. It decides a bar before each phrase, so its changes land on the line.'));
    el.appendChild(btn(B.on ? 'Playing along · tap to stop' : 'Play along', 'mxgo' + (B.on ? ' on' : ''), () => b.setOn(!B.on)));
    const lead = bar('Leads', () => B.lead, x => b.setLead(Math.round(x*100)/100), {fmt: x => x < .15 ? 'follows you' : x < .45 ? 'a bit' : x < .75 ? 'often' : 'a lot'}); lead.title = 'How often it changes things on its own, when you haven’t'; el.appendChild(lead);
    // what it hears
    const hr = h('div', 'bdhear');
    if (H && H.K) hr.innerHTML = `Hears <b>${H.K.name || ''}</b>${H.K.sure != null ? ` <small>(${Math.round(Math.min(1, H.K.sure)*100)}% sure)</small>` : ''}${H.chords ? ` · chords <b>${H.chords.map(d => numeral(H.K, d)).join(' ')}</b>` : ''}${H.live ? ' · <b>hearing you play</b>' : ''}`;
    else hr.textContent = 'Hears nothing yet: play something, or let it come in.';
    el.appendChild(hr);
    // the roles
    el.appendChild(h('div', 'jlab mxlab', 'Each part'));
    for (const k of Object.keys(NAME)) {
      const r = h('div', 'bdrow'), seg = h('div', 'jseg');
      r.appendChild(h('span', 'bdname', NAME[k]));
      for (const [v, R] of Object.entries(b.ROLES)) { const x = btn(R.label, B.roles[k] === v ? 'cur' : '', () => b.setRole(k, v), R.words); seg.appendChild(x); }
      r.appendChild(seg); el.appendChild(r);
    }
    el.appendChild(btn('Fit everything now', 'bdfit', () => b.fitAll('fitted everything to what you play'), 'Make every part of the band’s again, round yours'));
    if (st.log.length) { el.appendChild(h('div', 'jlab mxlab', 'What it did')); const ul = h('ul', 'mxlog'); for (const l of st.log) ul.appendChild(h('li', null, `<small>bar ${l.bar}</small> ${l.s}`)); el.appendChild(ul); }
  }
  function toggle(on = el.hidden){
    el.hidden = !on; if (unsub) { unsub(); unsub = null; }
    const top = parent.querySelector('.jtop'); if (top) el.style.top = (top.offsetHeight + 8) + 'px';
    if (on) { unsub = getBand().on(() => { if (!el.hidden) paint(); }); paint(); }
  }
  return {el, toggle, paint, rebind(){ if (!el.hidden) toggle(true); }};
}
