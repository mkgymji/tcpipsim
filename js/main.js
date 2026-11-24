// Vstupní bod stránky: úroveň 1 „Barvičky“. Jádro vyrobí záznam (trace), timeline z něj
// poskládá kroky scénáře a UI se po krocích jen pohybuje (VYVOJ.md R6, kap. 6).
import scenario from '../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from './scenario/level1.js';
import { stepLabel } from './core/timeline.js';
import { renderStack, renderNest, renderTopology, renderExplain, mappingTable, layerInfo, envInfo, esc }
  from './ui/render.js';

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const DWELL_MS = 4200;        // doba jednoho kroku při přehrávání (1x): animace + čtení
const $ = (id) => document.getElementById(id);

function loadPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* soukromé okno: nevadí */ }
}

const { timeline } = buildLevel1(scenario);
const total = Math.max(...timeline.steps.map((s) => s.num));
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  k: 0,
  model: loadPref('tcpipsim.model', 'osi') === 'tcpip' ? 'tcpip' : 'osi',
  speedIdx: 2,
  playing: false,
  timer: null,
  info: null,           // co ukazuje informační panel: null | {layer} | {env} | 'wire'
};

const els = {
  sender: $('dev-sender'), receiver: $('dev-receiver'), wire: $('wire'), wireBits: $('wire-bits'),
  stackS: $('stack-sender'), stackR: $('stack-receiver'), nest: $('nest'), cap: $('env-caption'),
  explain: $('explain'), info: $('info'), slider: $('slider'), progLabel: $('prog-label'),
  back: $('btn-back'), play: $('btn-play'), fwd: $('btn-fwd'), fwdLabel: $('fwd-label'),
  speed: $('speed-val'),
};

function speed() { return SPEEDS[state.speedIdx]; }

function renderInfo(view) {
  const el = els.info;
  let html = '';
  if (state.info?.layer) html = layerInfo(state.model, state.info.layer);
  else if (state.info?.env) html = envInfo(state.model, state.info.env);
  else if (state.info === 'wire') {
    html = view.packet?.form === 'wire'
      ? '<h3>Kabel</h3><p>Na drátě vidíš jen bity.</p>'
      : '<h3>Kabel</h3><p>Teď po kabelu nic nejede. Bity uvidíš v kroku 6.</p>';
  }
  if (view.step.showMapping) {
    html += `<details${state.info ? '' : ' open'}><summary>Tabulka: TCP/IP a ISO/OSI</summary>${mappingTable()}</details>
      <button type="button" class="btn small" data-open-questions>Kontrolní otázky</button>`;
  }
  if (!html) {
    el.classList.add('placeholder');
    el.innerHTML = '<h3>Rentgen</h3><div class="ph">Klikni na vrstvu nebo obálku a uvidíš, k čemu je.<br>(Obsah hlaviček ukáže rentgen od úrovně 2.)</div>';
  } else {
    el.classList.remove('placeholder');
    el.innerHTML = html;
  }
}

function render(animate) {
  const view = timeline.view(state.k);
  const anim = animate;
  renderTopology(els, view, scenario, anim);
  renderStack(els.stackS, view.nodes[view.sender], state.model);
  renderStack(els.stackR, view.nodes[view.receiver], state.model);
  renderNest(els.nest, els.cap, view, state.model, scenario, anim);
  renderExplain(els.explain, view, state.model, total);
  renderInfo(view);
  if (!animate) {
    // krok vzad / skok: bez pohybu, jen krátké zvýraznění (ui.md kap. 4)
    els.nest.firstElementChild?.classList.add('anim-flash');
  }

  const s = view.step;
  els.slider.value = String(s.num);
  els.slider.setAttribute('aria-valuetext', `Krok ${stepLabel(s)} z ${total}: ${s.title}`);
  els.progLabel.textContent = `Krok ${stepLabel(s)} z ${total}: ${s.title}`;
  const atStart = state.k === 0, atEnd = state.k === timeline.length - 1;
  els.back.setAttribute('aria-disabled', String(atStart));
  els.fwd.setAttribute('aria-disabled', String(atEnd));
  els.fwdLabel.textContent = atStart ? 'Začít' : 'Vpřed';
  els.play.innerHTML = state.playing
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h4v14H5zM11 3h4v14h-4z"/></svg>Pauza <kbd>mezerník</kbd>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3v14l11-7z"/></svg>Přehrát <kbd>mezerník</kbd>';
  els.speed.textContent = `${String(speed()).replace('.', ',')}×`;
  document.documentElement.style.setProperty('--k', String(1 / speed()));
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.model === state.model)));
  document.documentElement.dataset.step = String(state.k);
  document.documentElement.dataset.model = state.model;
}

function go(k, { animate = false } = {}) {
  const next = Math.max(0, Math.min(timeline.length - 1, k));
  const forwardOne = next === state.k + 1;
  if (next !== state.k) state.info = null;
  state.k = next;
  timeline.goto(next);
  render(animate && forwardOne);
  if (state.playing) schedule();
}

function schedule() {
  clearTimeout(state.timer);
  if (!state.playing) return;
  if (state.k >= timeline.length - 1) { setPlaying(false); return; }
  state.timer = setTimeout(() => go(state.k + 1, { animate: true }), DWELL_MS / speed());
}

function setPlaying(on) {
  state.playing = on;
  clearTimeout(state.timer);
  if (on) {
    if (state.k >= timeline.length - 1) state.k = -1;    // od začátku
    go(state.k + 1, { animate: true });
  } else {
    render(false);
  }
}

function setModel(m) {
  if (m === state.model) return;
  state.model = m;
  savePref('tcpipsim.model', m);
  render(false);   // stejný krok, jiné popisky
}

function setSpeed(delta) {
  state.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, state.speedIdx + delta));
  render(false);
  if (state.playing) schedule();
}

function openQuestions() {
  const d = $('questions');
  if (!d.open) d.showModal();
}

// --- ovládání ---
els.back.addEventListener('click', () => go(state.k - 1));
els.fwd.addEventListener('click', () => go(state.k + 1, { animate: true }));
els.play.addEventListener('click', () => setPlaying(!state.playing));
$('btn-reset').addEventListener('click', () => { state.playing = false; clearTimeout(state.timer); go(0); });
$('btn-slower').addEventListener('click', () => setSpeed(-1));
$('btn-faster').addEventListener('click', () => setSpeed(+1));
els.slider.addEventListener('input', () => {
  const num = Number(els.slider.value);
  const idx = timeline.steps.findIndex((s) => s.num === num);
  if (idx >= 0) go(idx);
});
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setModel(b.dataset.model)));
$('btn-questions').addEventListener('click', openQuestions);

// klik na vrstvu, obálku nebo kabel -> informační panel
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-layer], [data-env], #wire, [data-open-questions]');
  if (!t) return;
  if (t.matches('[data-open-questions]')) { openQuestions(); return; }
  e.stopPropagation();
  if (t.id === 'wire') state.info = 'wire';
  else if (t.dataset.layer) state.info = { layer: t.dataset.layer };
  else state.info = { env: t.dataset.env };
  renderInfo(timeline.view(state.k));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-env][role=button]')) { e.target.click(); e.preventDefault(); }
});

// klávesy (ui.md kap. 6); v otevřeném dialogu a v textových polích ne
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('questions').open) return;
  if (e.target.matches?.('input[type=text], textarea')) return;
  const isRange = e.target === els.slider;
  switch (e.key) {
    case 'ArrowRight': if (!isRange) { go(state.k + 1, { animate: true }); e.preventDefault(); } break;
    case 'ArrowLeft': if (!isRange) { go(state.k - 1); e.preventDefault(); } break;
    case ' ': setPlaying(!state.playing); e.preventDefault(); break;
    case 'Home': go(0); e.preventDefault(); break;
    case 'End': go(timeline.length - 1); e.preventDefault(); break;
    case '+': case '=': setSpeed(+1); break;
    case '-': setSpeed(-1); break;
    case 't': case 'T': setModel(state.model === 'osi' ? 'tcpip' : 'osi'); break;
    default:
  }
});
// mezerník na tlačítku by jinak tlačítko ještě „klikl“ (dvě akce)
document.addEventListener('keyup', (e) => { if (e.key === ' ' && e.target.matches?.('button')) e.preventDefault(); });

// kontrolní otázky (rozbalovací odpovědi)
$('q-list').innerHTML = scenario.questions.map((q) => `<li>${esc(q.text)}
  <details><summary>Ukázat odpověď</summary><p>${esc(q.answer)}</p></details></li>`).join('');

// omezení pohybu: CSS řeší @media; třída pro případný ruční přepínač
const syncMotion = () => document.body.classList.toggle('reduce-motion', reduceMQ.matches);
reduceMQ.addEventListener?.('change', syncMotion);
syncMotion();

// stav z URL: #k=4&m=tcpip (pro odkazy a snímky)
const params = new URLSearchParams(location.hash.slice(1));
if (params.get('m') === 'tcpip' || params.get('m') === 'osi') state.model = params.get('m');
const startK = Number(params.get('k'));
if (Number.isInteger(startK) && startK > 0) state.k = Math.min(startK, timeline.length - 1);

$('level-title').textContent = `Úroveň 1: Barvičky · ${scenario.title}`;
render(params.has('anim'));
if (params.get('q') === '1') openQuestions();
document.body.classList.add('ready');
document.documentElement.dataset.core = 'ok';
