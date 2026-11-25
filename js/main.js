// Vstupní bod stránky: výběr úrovně (#u=2, #u=3) a společné ovládání (krokování, přehrávání,
// rychlost, model vrstev, klávesy, adresa). Co a jak se kreslí, řeší adaptér úrovně
// (ui/app1.js, ui/app2.js). Jádro vyrobí záznam (trace), timeline z něj poskládá kroky
// scénáře a UI se po krocích jen pohybuje (VYVOJ.md R6, kap. 6).
// Jediný zdroj pravdy o aktuálním kroku je timeline.cursor.
import { stepLabel } from './core/timeline.js';
import { LEVELS } from './levels.js';
import { esc, stepTitle } from './ui/render.js';
import { parseHash, parseLevel, formatHash } from './ui/urlstate.js';
import { createLevel1 } from './ui/app1.js';
import { createLevel2 } from './ui/app2.js';
import { createLevel3 } from './ui/app3.js';
import { createLevel4 } from './ui/app4.js';
import { stepFocus } from './ui/focus.js';
import { fieldTab } from './ui/chips.js';

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const DWELL_MS = 4200;        // doba jednoho kroku při přehrávání (1x): animace + čtení
const $ = (id) => document.getElementById(id);

function loadPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* soukromé okno: nevadí */ }
}

const levelId = parseLevel(location.hash);
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  model: loadPref('tcpipsim.model', 'osi') === 'tcpip' ? 'tcpip' : 'osi',
  speedIdx: 2,
  playing: false,
  timer: null,
  reduceMotion: loadPref('tcpipsim.reduceMotion', '0') === '1',
  shown: null,          // naposledy vykreslený krok a model ('k|model')
};

const els = {
  slider: $('slider'), progLabel: $('prog-label'), progDir: $('prog-dir'),
  back: $('btn-back'), play: $('btn-play'), fwd: $('btn-fwd'), fwdLabel: $('fwd-label'),
  speed: $('speed-val'), motion: $('btn-motion'),
};

// Adaptér úrovně: { scenario, timeline, level, render(view, opts), renderPanels(view),
// onStepChange(prevK, nextK), onModelChange(from, to), onClick(e), onKey(e), forwardLabel(k),
// beforeForward(k), applyParams(params), dir(view), isTip(k) = na kroku k se přehrávání zastaví }
const host = { state, rerender: () => render(), go: (k, o) => go(k, o), cur: () => timeline.cursor,
  setPlaying: (on) => setPlaying(on), openQuestions: () => openQuestions() };
const app = levelId === 4 ? createLevel4(host) : levelId === 3 ? createLevel3(host) : levelId === 2 ? createLevel2(host) : createLevel1(host);
const { timeline, scenario } = app;
const total = Math.max(...timeline.steps.map((s) => s.num));
const last = timeline.length - 1;
const cur = () => timeline.cursor;
function speed() { return SPEEDS[state.speedIdx]; }

// Ovládání (tlačítka, posuvník, rychlost): levné, smí se volat kdykoli.
function renderControls() {
  const s = timeline.steps[cur()];
  const label = `Krok ${stepLabel(s)} z ${total}: ${stepTitle(s, state.model)}`;
  els.slider.value = String(cur());
  els.slider.setAttribute('aria-valuetext', label);
  els.progLabel.textContent = label;
  els.progLabel.title = label;
  if (app.dir) els.progDir.textContent = app.dir(timeline.view(cur()));
  els.back.setAttribute('aria-disabled', String(cur() === 0));
  els.fwd.setAttribute('aria-disabled', String(cur() === last));
  els.fwdLabel.textContent = app.forwardLabel?.(cur()) ?? (cur() === 0 ? 'Začít' : 'Vpřed');
  els.play.innerHTML = state.playing
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h4v14H5zM11 3h4v14h-4z"/></svg>Pauza <kbd>mezerník</kbd>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3v14l11-7z"/></svg>Přehrát <kbd>mezerník</kbd>';
  els.speed.textContent = `${String(speed()).replace('.', ',')}×`;
  document.documentElement.style.setProperty('--k', String(1 / speed()));
  document.querySelectorAll('.seg button[data-model]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.model === state.model)));
  els.motion.setAttribute('aria-pressed', String(state.reduceMotion));
}

// Pohled kroku. Vysvětlivka (aria-live) a pravý panel se přepíší jen při změně kroku nebo
// modelu, ne při změně rychlosti nebo pauze (recenzent bod 8).
function render({ animate = false, prev = null } = {}) {
  const k = cur();
  const view = timeline.view(k);
  app.render(view, { animate, prev, model: state.model });
  const key = `${k}|${state.model}`;
  if (state.shown !== key) {
    const stepChanged = state.shownK !== k;
    app.renderPanels(view, state.model, total);
    state.shown = key;
    state.shownK = k;
    applyFocus(view, { pop: animate && stepChanged });
    const hash = formatHash(view.step, state.model, levelId);
    if (!location.hash.startsWith(hash)) history.replaceState(null, '', hash);
  }
  renderControls();
  document.documentElement.dataset.step = String(k);
  document.documentElement.dataset.model = state.model;
}

// Ohnisko kroku a role panelů (rozhodnutí 56): rámeček + štítek „Sleduj tady“, ostatní ztlumit.
const FOCUS_EL = { tip: '#explain', rentgen: '#info', topologie: '.left .topo', vrstvy: '.left .lift', terminal: '#termwin' };
function applyFocus(view = timeline.view(cur()), { pop = false } = {}) {
  const termOpen = !$('termwin').hidden;
  const f = stepFocus(view.step, view, { termOpen });
  const tip = Boolean(view.step.predict);
  const ex = $('explain');
  ex.classList.toggle('tip', tip);
  $('info').dataset.role = levelId === 1 ? 'detail' : 'rentgen';
  document.querySelectorAll('[data-focus]').forEach((x) => x.removeAttribute('data-focus'));
  document.querySelector(FOCUS_EL[f])?.setAttribute('data-focus', '');
  $('app').dataset.stepFocus = f;
  document.documentElement.dataset.stepFocus = f;
  // tip na sebe jednou krátce upozorní (při „Omezit animace“ CSS animaci vypne)
  ex.classList.remove('anim-pop');
  if (pop && tip) { void ex.offsetWidth; ex.classList.add('anim-pop'); }
}
// terminál se otevírá a zavírá mimo render(): ohnisko přepočítat podle viditelnosti okna
new MutationObserver(() => applyFocus()).observe($('termwin'), { attributes: true, attributeFilter: ['hidden'] });

function setFrozen(on) { document.body.classList.toggle('frozen', on); }

function go(k, { animate = false } = {}) {
  const next = Math.max(0, Math.min(last, k));
  const prevK = cur();
  const forwardOne = next === prevK + 1;
  if (forwardOne) app.beforeForward?.(prevK);
  if (next !== prevK) app.onStepChange?.(prevK, next);
  const prev = timeline.view(prevK);
  timeline.goto(next);
  setFrozen(false);
  render({ animate: animate && forwardOne, prev });
  if (!state.playing) return;
  // na kroku s tipem se přehrávání zastaví (rozhodnutí 31); animace doběhne, nezmrazí se
  if (app.isTip?.(cur())) {
    state.playing = false;
    clearTimeout(state.timer);
    renderControls();
  } else schedule();
}

function schedule() {
  clearTimeout(state.timer);
  if (!state.playing) return;
  if (cur() >= last) { setPlaying(false); return; }
  state.timer = setTimeout(() => go(cur() + 1, { animate: true }), DWELL_MS / speed());
}

// Pauza zmrazí rozběhnutou animaci (ui.md kap. 4); Přehrát ji rozmrazí a pokračuje.
function setPlaying(on) {
  if (on === state.playing) return;
  state.playing = on;
  clearTimeout(state.timer);
  if (!on) {
    setFrozen(true);
    renderControls();
    return;
  }
  if (cur() >= last) {             // na konci: přehrát znovu od začátku
    timeline.goto(0);
    go(1, { animate: true });
  } else if (document.body.classList.contains('frozen')) {
    setFrozen(false);
    renderControls();
    schedule();
  } else {
    go(cur() + 1, { animate: true });
  }
}

function setModel(m) {
  if (m === state.model || !['osi', 'tcpip'].includes(m)) return;
  app.onModelChange?.(state.model, m);
  state.model = m;
  savePref('tcpipsim.model', m);
  render();   // stejný krok, jiné popisky
}

function setSpeed(delta) {
  state.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, state.speedIdx + delta));
  renderControls();
  if (state.playing) schedule();
}

function syncMotion() {
  document.body.classList.toggle('reduce-motion', state.reduceMotion || reduceMQ.matches);
}

function openQuestions() {
  setPlaying(false);    // při otevřeném dialogu se nepřehrává
  app.beforeQuestions?.();
  const d = $('questions');
  if (!d.open) d.showModal();
}

// výběr úrovně: jiná úroveň = jiné jádro i DOM, proto se stránka načte znovu
function setLevel(u) {
  if (u === levelId) return;
  location.hash = u === 1 ? `#m=${state.model}` : `#u=${u}&m=${state.model}`;
  location.reload();
}

// --- ovládání ---
els.back.addEventListener('click', () => go(cur() - 1));
els.fwd.addEventListener('click', () => go(cur() + 1, { animate: true }));
els.play.addEventListener('click', () => setPlaying(!state.playing));
$('btn-reset').addEventListener('click', () => { setPlaying(false); app.onReset?.(); go(0); });
$('btn-slower').addEventListener('click', () => setSpeed(-1));
$('btn-faster').addEventListener('click', () => setSpeed(+1));
els.slider.max = String(last);
els.slider.addEventListener('input', () => go(Number(els.slider.value)));
document.querySelectorAll('.seg button[data-model]').forEach((b) => b.addEventListener('click', () => setModel(b.dataset.model)));
document.querySelectorAll('.seg button[data-level]').forEach((b) => {
  b.setAttribute('aria-pressed', String(Number(b.dataset.level) === levelId));
  b.addEventListener('click', () => setLevel(Number(b.dataset.level)));
});
$('btn-questions').addEventListener('click', openQuestions);
els.motion.addEventListener('click', () => {
  state.reduceMotion = !state.reduceMotion;
  savePref('tcpipsim.reduceMotion', state.reduceMotion ? '1' : '0');
  syncMotion();
  renderControls();
});
// Odkazové čipy v textu kroku (rozhodnutí 56c, js/ui/chips.js): najetí/fokus zvýrazní cíl, klik
// vybere pole rentgenu / otevře terminál / ukáže prvek topologie.
function chipTargets(chip) {
  const kind = chip.dataset.chip, t = chip.dataset.chipTarget;
  const q = (s) => [...document.querySelectorAll(s)];
  const sel = (v) => (window.CSS?.escape ? CSS.escape(v) : v);
  if (kind === 'rentgen') {
    const hit = t ? q(`#info [data-field="${sel(t)}"], #info [data-target="${sel(t)}"]`) : [];
    return hit.length ? hit : [$('info')];
  }
  if (kind === 'topo') {
    const hit = q(`.left .topo [data-target="${sel(t)}"]`);
    if (hit.length) return hit;
    const node = document.querySelector(`.left .topo [data-node="${sel(t)}"]`);
    return [node?.parentElement ?? document.querySelector('.left .topo')].filter(Boolean);
  }
  if (!$('termwin').hidden) return [$('termwin')];
  const node = t && document.querySelector(`.left .topo [data-node="${sel(t)}"]`);
  return [node ?? $('termwin')].filter(Boolean);
}
function chipHover(e, on) {
  const chip = e.target.closest?.('.tchip');
  if (!chip) return;
  document.querySelectorAll('.chip-hl').forEach((x) => x.classList.remove('chip-hl', 'c-rentgen', 'c-topo', 'c-term'));
  if (on) chipTargets(chip).forEach((x) => x.classList.add('chip-hl', `c-${chip.dataset.chip}`));
}
['mouseover', 'focusin'].forEach((ev) => document.addEventListener(ev, (e) => chipHover(e, true)));
['mouseout', 'focusout'].forEach((ev) => document.addEventListener(ev, (e) => chipHover(e, false)));
function chipClick(chip) {
  const kind = chip.dataset.chip, t = chip.dataset.chipTarget;
  if (kind === 'term') { app.openTerm?.(t); return; }
  if (kind === 'rentgen' && fieldTab(t)) app.selectField?.(t, fieldTab(t));
  const el = chipTargets(chip)[0];
  el?.scrollIntoView?.({ block: 'nearest' });
  chipHover({ target: chip }, true);
}

document.addEventListener('click', (e) => {
  if (e.target.closest?.('[data-open-questions]')) { openQuestions(); return; }
  const chip = e.target.closest?.('.tchip');
  if (chip) { chipClick(chip); return; }
  app.onClick?.(e);
});

// klávesy (ui.md kap. 6); v otevřeném dialogu a v textových polích ne
const NATIVE_SPACE = 'button, summary, a[href], input[type=checkbox]';
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('questions').open) return;
  if (app.onKey?.(e)) return;
  if (e.target.matches?.('input[type=text], textarea')) return;
  const isRange = e.target === els.slider;
  switch (e.key) {
    case 'ArrowRight': if (!isRange) { go(cur() + 1, { animate: true }); e.preventDefault(); } break;
    case 'ArrowLeft': if (!isRange) { go(cur() - 1); e.preventDefault(); } break;
    case ' ':
      // na zaměřeném tlačítku mezerník tlačítko aktivuje (nativně), nepřehrává
      if (e.target.matches?.(NATIVE_SPACE)) break;
      setPlaying(!state.playing); e.preventDefault(); break;
    case 'Home': if (!isRange) { go(0); e.preventDefault(); } break;
    case 'End': if (!isRange) { go(last); e.preventDefault(); } break;
    case '+': case '=': setSpeed(+1); break;
    case '-': setSpeed(-1); break;
    case 't': case 'T': setModel(state.model === 'osi' ? 'tcpip' : 'osi'); break;
    default:
  }
});

// kontrolní otázky (rozbalovací odpovědi)
$('q-list').innerHTML = scenario.questions.map((q) => `<li>${esc(q.text)}
  <details><summary>Ukázat odpověď</summary><p>${esc(q.answer)}</p></details></li>`).join('');

reduceMQ.addEventListener?.('change', syncMotion);
syncMotion();

// stav z adresy: #u=2&k=8b&m=tcpip (rozhodnuti.md bod 21), adresa se při krokování aktualizuje
function applyHash({ animate = false } = {}) {
  const h = parseHash(location.hash, timeline.steps);
  if (h.level !== levelId) { location.reload(); return h; }
  if (h.model && h.model !== state.model) setModel(h.model);
  if (h.k !== null && h.k !== cur()) go(h.k, { animate });
  return h;
}
window.addEventListener('hashchange', () => applyHash());

const level = LEVELS[levelId];
document.title = `tcpipsim: Úroveň ${levelId} ${level.title}`;
document.body.classList.add(`lvl${levelId}`);
if (levelId === 4) document.body.classList.add('lvl3');   // úroveň 4 staví na rozvržení úrovně 3
$('level-title').textContent = scenario.title;
const start = parseHash(location.hash, timeline.steps);
if (start.model) state.model = start.model;
if (start.k !== null) timeline.goto(start.k);
app.applyParams?.(start.params);
render({ animate: start.anim, prev: start.k ? timeline.view(start.k - 1) : null });
app.afterStart?.(start.params);
if (start.questions) openQuestions();
document.body.classList.add('ready');
document.documentElement.dataset.core = 'ok';
document.documentElement.dataset.level = String(levelId);
