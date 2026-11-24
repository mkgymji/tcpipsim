// Vstupní bod stránky: úroveň 1 „Barvičky“. Jádro vyrobí záznam (trace), timeline z něj
// poskládá kroky scénáře a UI se po krocích jen pohybuje (VYVOJ.md R6, kap. 6).
// Jediný zdroj pravdy o aktuálním kroku je timeline.cursor.
import scenario from '../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from './scenario/level1.js';
import { stepLabel } from './core/timeline.js';
import { convertRowId } from './core/layers.js';
import { renderStack, renderNest, renderTopology, renderExplain, infoHtml, stepTitle, esc }
  from './ui/render.js';
import { parseHash, formatHash } from './ui/urlstate.js';

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const DWELL_MS = 4200;        // doba jednoho kroku při přehrávání (1x): animace + čtení
const $ = (id) => document.getElementById(id);

function loadPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* soukromé okno: nevadí */ }
}

const { timeline, level } = buildLevel1(scenario);
const total = Math.max(...timeline.steps.map((s) => s.num));
const last = timeline.length - 1;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  model: loadPref('tcpipsim.model', 'osi') === 'tcpip' ? 'tcpip' : 'osi',
  speedIdx: 2,
  playing: false,
  timer: null,
  info: null,           // co ukazuje panel Detail: null | {layer} | {env} | 'wire'
  mapOpen: true,        // rozbalená tabulka TCP/IP a ISO/OSI v kroku 10
  reduceMotion: loadPref('tcpipsim.reduceMotion', '0') === '1',
  shown: null,          // naposledy vykreslený krok a model ('k|model')
};

const els = {
  sender: $('dev-sender'), receiver: $('dev-receiver'), wire: $('wire'), wireBits: $('wire-bits'),
  stackS: $('stack-sender'), stackR: $('stack-receiver'), nest: $('nest'), cap: $('env-caption'),
  explain: $('explain'), info: $('info'), slider: $('slider'), progLabel: $('prog-label'),
  back: $('btn-back'), play: $('btn-play'), fwd: $('btn-fwd'), fwdLabel: $('fwd-label'),
  speed: $('speed-val'), motion: $('btn-motion'),
};

const cur = () => timeline.cursor;
function speed() { return SPEEDS[state.speedIdx]; }

function renderInfo(view) {
  const { html, empty } = infoHtml(state.model, state.info, view, { mapOpen: state.mapOpen });
  els.info.classList.toggle('placeholder', empty);
  els.info.innerHTML = empty
    ? `<h3>${level.xray ? 'Rentgen' : 'Detail'}</h3><div class="ph">Klikni na vrstvu, obálku nebo kabel a tady uvidíš, k čemu jsou.</div>`
    : html;
}

// Vrstvy, kterými zpráva v tomto kroku jen prošla (např. L7 -> L4 projde L6 a L5).
function passedLayers(prev, view) {
  const a = prev?.focus, b = view.focus;
  if (!a?.layer || !b?.layer || a.node !== b.node) return [];
  const out = [];
  const dir = b.layer < a.layer ? -1 : 1;
  for (let n = a.layer + dir; n !== b.layer; n += dir) out.push(n);
  return out;
}

// Ovládání (tlačítka, posuvník, rychlost): levné, smí se volat kdykoli.
function renderControls() {
  const s = timeline.steps[cur()];
  const label = `Krok ${stepLabel(s)} z ${total}: ${stepTitle(s, state.model)}`;
  els.slider.value = String(cur());
  els.slider.setAttribute('aria-valuetext', label);
  els.progLabel.textContent = label;
  els.progLabel.title = label;
  els.back.setAttribute('aria-disabled', String(cur() === 0));
  els.fwd.setAttribute('aria-disabled', String(cur() === last));
  els.fwdLabel.textContent = cur() === 0 ? 'Začít' : 'Vpřed';
  els.play.innerHTML = state.playing
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h4v14H5zM11 3h4v14h-4z"/></svg>Pauza <kbd>mezerník</kbd>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3v14l11-7z"/></svg>Přehrát <kbd>mezerník</kbd>';
  els.speed.textContent = `${String(speed()).replace('.', ',')}×`;
  document.documentElement.style.setProperty('--k', String(1 / speed()));
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.model === state.model)));
  els.motion.setAttribute('aria-pressed', String(state.reduceMotion));
}

// Pohled kroku. Vysvětlivka (aria-live) a panel Detail se přepíší jen při změně kroku nebo
// modelu, ne při změně rychlosti nebo pauze (recenzent bod 8).
function render({ animate = false, prev = null } = {}) {
  const k = cur();
  const view = timeline.view(k);
  renderTopology(els, view, scenario, animate);
  const pass = (node) => (animate && view.focus?.node === node ? passedLayers(prev, view) : []);
  renderStack(els.stackS, view.nodes[view.sender], state.model, pass(view.sender));
  renderStack(els.stackR, view.nodes[view.receiver], state.model, pass(view.receiver));
  renderNest(els.nest, els.cap, view, state.model, scenario, animate);
  if (!animate) els.nest.firstElementChild?.classList.add('anim-flash');   // skok: jen zvýraznění
  const key = `${k}|${state.model}`;
  if (state.shown !== key) {
    renderExplain(els.explain, view, state.model, total);
    renderInfo(view);
    state.shown = key;
    const hash = formatHash(view.step, state.model);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }
  renderControls();
  document.documentElement.dataset.step = String(k);
  document.documentElement.dataset.model = state.model;
}

function setFrozen(on) { document.body.classList.toggle('frozen', on); }

function go(k, { animate = false } = {}) {
  const next = Math.max(0, Math.min(last, k));
  const prevK = cur();
  const forwardOne = next === prevK + 1;
  if (next !== prevK) state.info = null;
  const prev = timeline.view(prevK);
  timeline.goto(next);
  setFrozen(false);
  render({ animate: animate && forwardOne, prev });
  if (state.playing) schedule();
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
  if (state.info?.layer) {
    const id = convertRowId(state.model, m, state.info.layer);
    state.info = id ? { layer: id } : null;
  }
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
  const d = $('questions');
  if (!d.open) d.showModal();
}

// --- ovládání ---
els.back.addEventListener('click', () => go(cur() - 1));
els.fwd.addEventListener('click', () => go(cur() + 1, { animate: true }));
els.play.addEventListener('click', () => setPlaying(!state.playing));
$('btn-reset').addEventListener('click', () => { setPlaying(false); go(0); });
$('btn-slower').addEventListener('click', () => setSpeed(-1));
$('btn-faster').addEventListener('click', () => setSpeed(+1));
els.slider.max = String(last);
els.slider.addEventListener('input', () => go(Number(els.slider.value)));
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setModel(b.dataset.model)));
$('btn-questions').addEventListener('click', openQuestions);
els.motion.addEventListener('click', () => {
  state.reduceMotion = !state.reduceMotion;
  savePref('tcpipsim.reduceMotion', state.reduceMotion ? '1' : '0');
  syncMotion();
  renderControls();
});

// klik na vrstvu, obálku nebo kabel -> panel Detail
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-layer], [data-env], #wire, [data-open-questions]');
  if (!t) return;
  if (t.matches('[data-open-questions]')) { openQuestions(); return; }
  if (t.id === 'wire') state.info = 'wire';
  else if (t.dataset.layer) state.info = { layer: t.dataset.layer };
  else state.info = { env: t.dataset.env };
  renderInfo(timeline.view(cur()));
});
document.addEventListener('toggle', (e) => {
  if (e.target.matches?.('details[data-map]')) state.mapOpen = e.target.open;
}, true);

// klávesy (ui.md kap. 6); v otevřeném dialogu a v textových polích ne
const NATIVE_SPACE = 'button, summary, a[href], input[type=checkbox]';
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('questions').open) return;
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

// úroveň 1: panel „Detail“, bez terminálu (rozhodnuti.md bod 20)
document.querySelector('aside').classList.toggle('no-term', !level.terminal);
$('term').hidden = !level.terminal;

// stav z adresy: #k=8b&m=tcpip (rozhodnuti.md bod 21), adresa se při krokování aktualizuje
function applyHash({ animate = false } = {}) {
  const h = parseHash(location.hash, timeline.steps);
  if (h.model && h.model !== state.model) setModel(h.model);
  if (h.k !== null && h.k !== cur()) go(h.k, { animate });
  return h;
}
window.addEventListener('hashchange', () => applyHash());

$('level-title').textContent = `Úroveň 1: ${level.title} · ${scenario.title}`;
const start = parseHash(location.hash, timeline.steps);
if (start.model) state.model = start.model;
if (start.k !== null) timeline.goto(start.k);
render({ animate: start.anim, prev: start.k ? timeline.view(start.k - 1) : null });
if (start.questions) openQuestions();
document.body.classList.add('ready');
document.documentElement.dataset.core = 'ok';
