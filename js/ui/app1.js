// Adaptér úrovně 1 „Barvičky“: výtah se dvěma PC na jednom kabelu, panel Detail.
// Chování beze změny proti iteraci 1 (jen přesunuto z main.js).
import scn from '../../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from '../scenario/level1.js';
import { convertRowId } from '../core/layers.js';
import { renderStack, renderNest, renderTopology, renderExplain, infoHtml } from './render.js';

const $ = (id) => document.getElementById(id);

export function createLevel1(host) {
  const { timeline, level } = buildLevel1(scn);
  const ui = { info: null, mapOpen: true };   // info: null | {layer} | {env} | 'wire'
  const els = {
    sender: $('dev-sender'), receiver: $('dev-receiver'), wire: $('wire'), wireBits: $('wire-bits'),
    stackS: $('stack-sender'), stackR: $('stack-receiver'), nest: $('nest'), cap: $('env-caption'),
    explain: $('explain'), info: $('info'),
  };

  function renderInfo(view) {
    const { html, empty } = infoHtml(host.state.model, ui.info, view, { mapOpen: ui.mapOpen });
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

  document.addEventListener('toggle', (e) => {
    if (e.target.matches?.('details[data-map]')) ui.mapOpen = e.target.open;
  }, true);

  // úroveň 1: panel „Detail“, bez terminálu (rozhodnuti.md bod 20)
  document.querySelector('aside').classList.toggle('no-term', !level.terminal);
  $('term').hidden = !level.terminal;

  return {
    scenario: scn, timeline, level,
    render(view, { animate, prev, model }) {
      renderTopology(els, view, scn, animate);
      const pass = (node) => (animate && view.focus?.node === node ? passedLayers(prev, view) : []);
      renderStack(els.stackS, view.nodes[view.sender], model, pass(view.sender));
      renderStack(els.stackR, view.nodes[view.receiver], model, pass(view.receiver));
      renderNest(els.nest, els.cap, view, model, scn, animate);
      if (!animate) els.nest.firstElementChild?.classList.add('anim-flash');   // skok: jen zvýraznění
    },
    renderPanels(view, model, total) {
      renderExplain(els.explain, view, model, total);
      renderInfo(view);
    },
    onStepChange() { ui.info = null; },
    onModelChange(from, to) {
      if (ui.info?.layer) {
        const id = convertRowId(from, to, ui.info.layer);
        ui.info = id ? { layer: id } : null;
      }
    },
    // klik na vrstvu, obálku nebo kabel -> panel Detail
    onClick(e) {
      const t = e.target.closest?.('[data-layer], [data-env], #wire');
      if (!t) return;
      if (t.id === 'wire') ui.info = 'wire';
      else if (t.dataset.layer) ui.info = { layer: t.dataset.layer };
      else ui.info = { env: t.dataset.env };
      renderInfo(timeline.view(timeline.cursor));
    },
    dir: () => 'Alice → Bob',
  };
}
