// Adaptér úrovně 2 „Adresy“ (docs/ui.md kap. 11): topologie s hubem/switchem, výtah pro
// vybranou dvojici, obálky s adresami, rentgen, terminál (Windows / Cisco IOS) a předpověď.
// Stav UI (výběr pole, tipy, historie terminálu) nemění simulaci; pohled je vždy z timeline.
import scn from '../../scenarios/uroven2-adresy.js';
import { buildLevel2 } from '../scenario/level2.js';
import { renderStack, esc } from './render.js';
import { topologyHtml, nestHtml, nestCaption, appsHtml, explainHtml2, summaryHtml, xrayHtml, presentTabs,
  XRAY_TABS, termLinesHtml, termTitle } from './render2.js';
import { frameFields } from '../wire/fields.js';
import { execute, promptOf, dialectOf } from '../cli/shell.js';
import { isHost } from '../devices/types.js';

const $ = (id) => document.getElementById(id);

export function createLevel2(host) {
  const { timeline, level } = buildLevel2(scn);
  const cur = () => timeline.cursor;
  const view = () => timeline.view(cur());
  const ui = {
    pair: null,          // { flowKey, receiver } – ruční volba příjemce ve výtahu
    selected: null,      // vybraný uzel v topologii (tlačítko Terminál)
    xray: { tab: 'ethernet', sel: null },
    tips: new Map(),     // index kroku -> Set tipů (nic se neukládá, rozhodnutí scénáře)
    answers: new Map(),  // index kroku -> potvrzený tip
    term: { open: false, node: null, log: {}, hist: {}, pos: -1 },
  };
  const els = {
    topo: document.querySelector('.topo'), stackS: $('stack-sender'), stackR: $('stack-receiver'),
    nest: $('nest'), cap: $('env-caption'), capR: $('env-reads'), explain: $('explain'), info: $('info'),
    sName: $('sender-name'), rName: $('receiver-name'), sRole: $('sender-role'), rRole: $('receiver-role'),
    term: $('termwin'), apps: $('apps'),
  };
  document.querySelector('aside').classList.add('no-term');
  $('term').hidden = true;

  const flowKey = (v) => (v.flow ? `${v.flow.sender}|${v.flow.text}|${v.flow.dport}` : '');
  function pairOf(v) {
    const f = v.flow ?? { sender: 'PC1', receiver: 'PC2' };
    const override = ui.pair && ui.pair.flowKey === flowKey(v) ? ui.pair.receiver : null;
    return { sender: f.sender, receiver: override ?? f.receiver };
  }

  const stepAt = (k) => timeline.steps[k];
  const predictAt = (k) => stepAt(k)?.predict ?? null;
  const tipsAt = (k) => ui.tips.get(k) ?? new Set();

  // Skutečné porty, na které zařízení rámec poslalo v kroku k (vyhodnocení tipu).
  function actualPorts(k, pred) {
    const v = timeline.view(k);
    const ports = Object.entries(v.portState[pred.node] ?? {}).filter(([, s]) => s === 'out').map(([p]) => p);
    return ports.length ? ports : (v.decision?.node === pred.node ? v.decision.outPorts : []);
  }
  const labelOf = (pred, port) => pred.options.find((o) => o.port === port)?.label ?? port;
  const joinI = (arr) => (arr.length ? arr.join(' i ') : 'nikam');

  function evalLine(k) {
    const pk = k - 1, pred = predictAt(pk), ans = ui.answers.get(pk);
    if (!pred || !ans?.length) return '';
    if (pred.choices) return `<b>Tvůj tip:</b> ${esc(ans.join(', '))}. Ověř si ho v dalších krocích.`;
    const act = actualPorts(k, pred);
    const same = act.length === ans.length && act.every((p) => ans.includes(p));
    return `<b>Tvůj tip:</b> ${esc(joinI(ans.map((p) => labelOf(pred, p))))}. <b>Skutečnost:</b> ${esc(joinI(act.map((p) => labelOf(pred, p))))}.${same ? ' Sedí.' : ''}`;
  }

  function xrayState(v) {
    const tabs = presentTabs(v);
    return { ...ui.xray, tabs, pairReceiver: pairOf(v).receiver };
  }

  function renderXray(v = view()) {
    const xs = xrayState(v);
    els.info.classList.toggle('placeholder', !xs.tabs.length);
    // shrnutí kroku (10: kdo rámec dostal, 17: kdo čte kterou adresu) jde nad rentgen, aby bylo vidět
    const sum = v.step.summary ? `<div class="stepsum">${summaryHtml(v.step.summary, v)}</div>` : '';
    els.info.innerHTML = sum + xrayHtml(v, xs);
    markSelected();
  }

  // Vybrané pole: stejný obrys v rentgenu, hexdumpu i buňce štítku (ui.md 11.3).
  function markSelected() {
    document.querySelectorAll('.acell.selected').forEach((x) => x.classList.remove('selected'));
    if (ui.xray.sel) document.querySelectorAll(`.acell[data-field="${ui.xray.sel}"]`).forEach((x) => x.classList.add('selected'));
  }

  function renderPanels(v, model, total) {
    const k = cur();
    const s = v.step;
    const pred = predictAt(k);
    const termHint = s.terminal && v.nodes[s.terminal.node]
      ? { ...s.terminal, label: v.nodes[s.terminal.node].label } : null;
    els.explain.innerHTML = explainHtml2(v, model, total, {
      predict: pred, tips: tipsAt(k), evalLine: evalLine(k), termHint,
    });
    renderXray(v);
  }

  function renderTopo(v, animate) {
    const k = cur();
    const pred = predictAt(k);
    const changed = new Set(v.changes.map((r) => r.kind));
    const swapIdx = timeline.steps.findIndex((s) => s.match.kind === 'topo.swap');
    els.topo.innerHTML = topologyHtml(v, { pair: pairOf(v), selected: ui.selected, predict: pred?.options ? pred : null,
      tips: tipsAt(k), changed, canSwap: k === swapIdx - 1, animate });
  }

  function render(v, { animate, model }) {
    const pair = pairOf(v);
    renderTopo(v, animate);
    const sN = v.nodes[pair.sender], rN = v.nodes[pair.receiver];
    els.sName.textContent = sN?.label ?? '';
    els.rName.textContent = rN?.label ?? '';
    els.sRole.textContent = 'odesílatel, shora dolů';
    els.rRole.textContent = v.dropped?.node === pair.receiver ? 'zahodil rámec' : 'příjemce, zdola nahoru';
    renderStack(els.stackS, sN, model);
    renderStack(els.stackR, rN, model);
    const changed = new Set(v.changes.map((r) => r.kind));
    const cap = nestCaption(v, pair);
    els.cap.textContent = cap.left;
    els.capR.textContent = cap.right;
    els.nest.innerHTML = nestHtml(v, model, { pair, sel: ui.xray.sel, animate, socket: v.step.socket, changed });
    els.apps.innerHTML = appsHtml(v, pair.receiver);
    els.apps.classList.toggle('has', Boolean(v.inbox[pair.receiver]));
    if (!animate) els.nest.firstElementChild?.classList.add('anim-flash');
    markSelected();
    if (ui.term.open) renderTerm();
  }

  // --- terminál ---
  function termNode() {
    return view().nodes[ui.term.node] ?? null;
  }

  function renderTerm() {
    const node = termNode();
    if (!node) { closeTerm(); return; }
    const d = dialectOf(node) ?? 'none';
    els.term.className = `termwin ${d}`;
    els.term.hidden = false;
    const log = ui.term.log[node.id] ?? [];
    els.term.innerHTML = `<div class="term-h"><b>${esc(termTitle(node))}</b><span class="kind">${d === 'ios' ? 'Cisco IOS' : d === 'windows' ? 'Windows' : 'hub'}</span>
      <button type="button" class="btn small" data-term-close>Zavřít <kbd>Esc</kbd></button></div>
      <div class="term-b" id="term-body">${termLinesHtml(log)}${d === 'none' ? '<div class="tl tnote">Hub nemá konzoli: nic si nepamatuje a nic nenastavuje.</div>'
    : `<label class="tl inputline"><span class="prompt">${esc(promptOf(node))}</span><input id="term-input" type="text" spellcheck="false" autocomplete="off" aria-label="Příkaz pro ${esc(node.label)}"></label>`}</div>`;
    const body = $('term-body');
    body.scrollTop = body.scrollHeight;
  }

  function openTerm(id, { focus = true } = {}) {
    const node = view().nodes[id];
    if (!node) return;
    ui.term.open = true;
    ui.term.node = id;
    ui.term.pos = -1;
    renderTerm();
    if (focus) $('term-input')?.focus();
  }

  function closeTerm() {
    ui.term.open = false;
    els.term.hidden = true;
    els.term.innerHTML = '';
  }

  function runCmd(line) {
    const node = termNode();
    if (!node) return;
    const log = (ui.term.log[node.id] ??= []);
    const res = execute(node, line);
    if (res.clear) { ui.term.log[node.id] = []; renderTerm(); $('term-input')?.focus(); return; }
    log.push({ kind: 'cmd', prompt: promptOf(node), text: line });
    for (const l of res.lines) log.push({ kind: 'out', line: l });
    if (res.note) log.push({ kind: 'note', text: res.note });
    if (line.trim()) (ui.term.hist[node.id] ??= []).push(line);
    ui.term.pos = -1;
    renderTerm();
    $('term-input')?.focus();
  }

  function termKey(e) {
    const input = e.target;
    if (e.key === 'Enter') { runCmd(input.value); e.preventDefault(); return; }
    if (e.key === 'Escape') { closeTerm(); e.preventDefault(); return; }
    const hist = ui.term.hist[ui.term.node] ?? [];
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!hist.length) return;
      if (e.key === 'ArrowUp') ui.term.pos = ui.term.pos < 0 ? hist.length - 1 : Math.max(0, ui.term.pos - 1);
      else ui.term.pos = ui.term.pos < 0 ? -1 : ui.term.pos + 1 >= hist.length ? -1 : ui.term.pos + 1;
      input.value = ui.term.pos < 0 ? '' : hist[ui.term.pos];
      e.preventDefault();
    }
  }

  // --- rentgen ---
  function selectField(field, tab) {
    if (tab && XRAY_TABS.includes(tab)) ui.xray.tab = tab;
    ui.xray.sel = field;
    renderXray();
  }

  function fieldByNumber(n) {
    const v = view();
    const xs = xrayState(v);
    if (!v.flowFrame || !xs.tabs.length) return;
    const tab = xs.tabs.includes(ui.xray.tab) ? ui.xray.tab : xs.tabs[0];
    const f = frameFields(v.flowFrame).blocks[tab].fields.find((x) => x.n === n);
    if (f) selectField(f.id, tab);
  }

  function hover(e, on) {
    const t = e.target.closest?.('[data-field]');
    if (!t) return;
    document.querySelectorAll(`[data-field="${t.dataset.field}"]`).forEach((x) => x.classList.toggle('hl', on));
  }
  document.addEventListener('mouseover', (e) => hover(e, true));
  document.addEventListener('mouseout', (e) => hover(e, false));
  document.addEventListener('focusin', (e) => hover(e, true));
  document.addEventListener('focusout', (e) => hover(e, false));

  function toggleTip(value) {
    const k = cur();
    const pred = predictAt(k);
    if (!pred) return;
    const set = new Set(tipsAt(k));
    if (pred.choices) { set.clear(); set.add(value); } else if (set.has(value)) set.delete(value); else set.add(value);
    ui.tips.set(k, set);
    host.state.shown = null;
    host.rerender();
  }

  function rerenderAll() { host.state.shown = null; host.rerender(); }

  return {
    scenario: scn, timeline, level,
    render,
    renderPanels,
    onStepChange(prevK, nextK) {
      const s = stepAt(nextK);
      if (s.xray) ui.xray = { tab: s.xray.tab, sel: s.xray.fields[0] };
      else ui.xray = { tab: ui.xray.tab, sel: null };
    },
    beforeForward(k) {
      const t = tipsAt(k);
      if (predictAt(k) && t.size) ui.answers.set(k, [...t]);
    },
    forwardLabel(k) {
      if (predictAt(k) && tipsAt(k).size) return 'Potvrdit tip';
      const swapIdx = timeline.steps.findIndex((s) => s.match.kind === 'topo.swap');
      if (k === swapIdx - 1) return 'Vyměnit za switch';
      return k === 0 ? 'Začít' : 'Vpřed';
    },
    beforeQuestions() {
      let ok = 0, n = 0;
      for (const [k, ans] of ui.answers) {
        const pred = predictAt(k);
        if (!pred?.options) continue;
        n++;
        const act = actualPorts(k + 1, pred);
        if (act.length === ans.length && act.every((p) => ans.includes(p))) ok++;
      }
      $('q-tips').textContent = n ? `Tipy „kam switch nebo hub pošle rámec“: ${ok} z ${n} sedělo. Nic se neukládá.` : '';
    },
    onClick(e) {
      const t = e.target.closest?.('[data-pick], #btn-swap, [data-term], [data-run], [data-term-close], [data-node], [data-xtab], [data-field], [data-tab]');
      if (!t) {
        if (e.target.closest?.('#termwin')) $('term-input')?.focus();
        return;
      }
      if (t.dataset.pick !== undefined) { toggleTip(t.dataset.pick); return; }
      if (t.id === 'btn-swap') {
        if (t.getAttribute('aria-disabled') !== 'true') host.go(cur() + 1, { animate: true });
        return;
      }
      if (t.dataset.term) { openTerm(t.dataset.term); return; }
      if (t.dataset.run) { openTerm(t.dataset.run); runCmd(t.dataset.cmd); return; }
      if (t.matches('[data-term-close]')) { closeTerm(); return; }
      if (t.dataset.node) {
        const v = view();
        const id = t.dataset.node;
        ui.selected = id;
        if (isHost(v.nodes[id].type)) {
          const f = v.flow ?? { sender: 'PC1' };
          ui.pair = id === f.sender ? null : { flowKey: flowKey(v), receiver: id };
        }
        rerenderAll();
        return;
      }
      if (t.dataset.xtab) { ui.xray.tab = t.dataset.xtab; ui.xray.sel = null; renderXray(); return; }
      if (t.dataset.field) { selectField(ui.xray.sel === t.dataset.field && t.closest('#info') ? null : t.dataset.field, t.dataset.tab); return; }
      if (t.dataset.tab) { ui.xray.tab = t.dataset.tab; ui.xray.sel = null; renderXray(); }
    },
    onKey(e) {
      if (e.target.id === 'term-input') { termKey(e); return true; }
      if (e.key === 'Escape') {
        if (ui.term.open) closeTerm(); else { ui.xray.sel = null; renderXray(); }
        return true;
      }
      if (e.key === 'F2' || e.key === '`') {
        if (ui.term.open) closeTerm(); else openTerm(ui.selected && dialectOf(view().nodes[ui.selected] ?? {}) ? ui.selected : 'PC1');
        e.preventDefault();
        return true;
      }
      if (e.target.matches?.('input, textarea')) return false;
      if (e.key === 'r' || e.key === 'R') {
        const xs = xrayState(view());
        if (xs.tabs.length) {
          const i = xs.tabs.indexOf(ui.xray.tab);
          ui.xray = { tab: xs.tabs[(i + 1) % xs.tabs.length], sel: null };
          renderXray();
        }
        return true;
      }
      if (/^[1-9]$/.test(e.key)) { fieldByNumber(Number(e.key)); return true; }
      if (e.key === 'Enter' && predictAt(cur()) && tipsAt(cur()).size && !e.target.matches?.('button')) {
        host.go(cur() + 1, { animate: true });
        return true;
      }
      return false;
    },
    onReset() {
      ui.tips.clear(); ui.answers.clear(); ui.pair = null; ui.selected = null; closeTerm();
    },
    // parametry adresy pro odkazy a snímky: x=tab, f=pole, t=terminál, c=příkaz, pick=tipy, pair=příjemce
    applyParams(p) {
      const k = cur();
      if (stepAt(k).xray) ui.xray = { tab: stepAt(k).xray.tab, sel: stepAt(k).xray.fields[0] };
      if (p.get('x')) ui.xray = { tab: p.get('x'), sel: null };
      if (p.get('f')) ui.xray.sel = p.get('f');
      if (p.get('pick')) ui.tips.set(k, new Set(p.get('pick').split(',')));
      if (p.get('pair')) ui.pair = { flowKey: flowKey(view()), receiver: p.get('pair') };
      if (p.get('sel')) ui.selected = p.get('sel');
    },
    afterStart(p) {
      if (p.get('t')) {
        openTerm(p.get('t'), { focus: false });
        for (const c of p.getAll('c')) runCmd(c);
      }
    },
    dir(v) {
      const pair = pairOf(v);
      return `dvojice: ${v.nodes[pair.sender]?.label ?? ''} → ${v.nodes[pair.receiver]?.label ?? ''}`;
    },
  };
}
