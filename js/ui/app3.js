// Adaptér úrovně 3 „Směrování“ (docs/ui.md kap. 12): dvě sítě a router, „U“ s věží routeru do L3,
// tipy (rozhodnutí 31), karty v pravém panelu, rentgen ARP/IPv4/ICMP, terminál Windows a IOS (R1>,
// enable). Stav UI nemění simulaci; pohled je vždy z timeline. Příkazy ping/tracert v terminálu:
// běží-li stejný příkaz ve scénáři, výpis se doplňuje podle kroku („živý“), jinak se spustí
// samostatná simulace ze stavu kroku (level3.whatIf, pískoviště terminálu).
import scn from '../../scenarios/uroven3-smerovani.js';
import { buildLevel3, whatIf } from '../scenario/level3.js';
import { renderStack, esc } from './render.js';
import { termLinesHtml, termTitle } from './render2.js';
import { topologyHtml3, nestHtml3, nestCaption3, mediumHtml3, liftAnchor3, laneEnd3, mediumDevices3, explainHtml3,
  maskCard, compareCard, tablesCard, probesCard, summaryCard3, xrayHtml3, xrayTarget, currentMessage } from './render3.js';
import { tipEvaluator, evalTip } from './tips.js';
import { placeLane, slideFloat, columnPair, dropNote, columnSwitchLabel } from './lift.js';
import { pduFields } from '../wire/fields.js';
import { execute, promptOf, dialectOf } from '../cli/shell.js';
import { stepLabel } from '../core/timeline.js';

// role sloupce; při úzkém sloupci nebo se štítkem „Teď Bob“ CSS ukáže jen šipku (720p)
const ROLE_S = 'odesílatel<span class="dir">, shora dolů</span><span class="dira" aria-hidden="true"> ↓</span>';
const ROLE_R = 'příjemce<span class="dir">, zdola nahoru</span><span class="dira" aria-hidden="true"> ↑</span>';

const $ = (id) => document.getElementById(id);

export function createLevel3(host) {
  const { timeline, level } = buildLevel3(scn);
  const cur = () => timeline.cursor;
  const view = () => timeline.view(cur());
  const ui = {
    selected: null,
    xray: { tab: 'ethernet', sel: null },
    tips: new Map(), answers: new Map(),
    term: { open: false, node: null, log: {}, hist: {}, pos: -1, mode: {}, overlay: null },
  };
  const els = {
    topo: document.querySelector('.topo'), stackS: $('stack-sender'), stackR: $('stack-receiver'),
    nest: $('nest'), cap: $('env-caption'), capR: $('env-reads'), explain: $('explain'), info: $('info'),
    sName: $('sender-name'), rName: $('receiver-name'), sRole: $('sender-role'), rRole: $('receiver-role'),
    rNow: $('receiver-now'), term: $('termwin'), lane: $('lane'), medium: $('medium'),
  };
  document.querySelector('aside').classList.add('no-term');
  $('term').hidden = true;

  const stepAt = (k) => timeline.steps[k];
  const predictAt = (k) => stepAt(k)?.predict ?? null;
  const tipsAt = (k) => ui.tips.get(k) ?? new Set();
  const ev = tipEvaluator(timeline.steps);
  const parts = timeline.steps.map((s, k) => (s.part3 ? { id: s.part3, k, title: s.title } : null)).filter(Boolean);
  const partOf = (k) => [...parts].reverse().find((p) => p.k <= k)?.id ?? null;

  function pairOf(v) {
    const f = v.flow;
    // rozhodnutí 57: v kroku zahození patří sloupec příjemce uzlu, který rámec zahodil (Cyril)
    return f ? columnPair(v, { sender: f.sender, receiver: f.receiver }) : { sender: 'PC1', receiver: 'PC2' };
  }

  function evalLines(k) {
    return ev.tipsEvaluatedAt(k).map((tk) => {
      const ans = ui.answers.get(tk);
      return ans?.length ? evalTip(timeline, tk, k, ans).html : '';
    }).filter(Boolean);
  }

  function renderXray(v = view()) {
    const s = v.step;
    const card = { mask: maskCard, compare: compareCard, tables: tablesCard, probes: probesCard }[s.panel]?.(v)
      ?? (s.summary === 'routing' ? summaryCard3() : '');
    // na kroku tipu karta nic neprozradí (rozhodnutí 31): sondy a tabulky jsou stav PŘED událostí
    els.info.innerHTML = (card ? `<div class="stepsum">${card}</div>` : '') + xrayHtml3(v, ui.xray);
    markSelected();
  }

  function markSelected() {
    document.querySelectorAll('.acell.selected').forEach((x) => x.classList.remove('selected'));
    if (ui.xray.sel) document.querySelectorAll(`.acell[data-field="${ui.xray.sel}"]`).forEach((x) => x.classList.add('selected'));
  }

  function renderPanels(v, model, total) {
    const k = cur();
    const s = v.step;
    const pred = predictAt(k);
    const termHint = s.terminal && v.nodes[s.terminal.node] ? { ...s.terminal, label: v.nodes[s.terminal.node].label } : null;
    els.explain.innerHTML = explainHtml3(v, model, total, { predict: pred, tips: tipsAt(k), evalLines: evalLines(k), termHint,
      parts, curPart: partOf(k) });
    renderXray(v);
  }

  function render(v, { animate, model }) {
    const pair = pairOf(v);
    const tip = Boolean(predictAt(cur()));
    els.topo.innerHTML = topologyHtml3(v, { pair, selected: ui.selected, hideGw: Boolean(v.step.hideGw), tip });
    const sN = v.nodes[pair.sender], rN = v.nodes[pair.receiver];
    els.sName.textContent = sN?.label ?? '';
    els.rName.textContent = rN?.label ?? '';
    els.sRole.innerHTML = ROLE_S;
    const dropHere = v.dropped?.node === pair.receiver && Boolean(pair.dropCol);
    els.rRole.innerHTML = dropHere ? '· není cíl' : ROLE_R;
    const prevV = cur() > 0 ? timeline.view(cur() - 1) : null;
    const now = prevV ? columnSwitchLabel(pairOf(prevV), pair, v, rN?.label ?? '') : '';
    els.rNow.textContent = now;
    els.rNow.hidden = !now;
    renderStack(els.stackS, sN, model);   // rozhodnutí 49: ve sloupci vrstev „segment“
    renderStack(els.stackR, rN, model, [], { dropNote: dropHere ? dropNote(v) : '' });
    const cap = nestCaption3(v);
    els.cap.textContent = cap.left;
    els.capR.textContent = cap.right;
    const devs = mediumDevices3(v, pair).map((id) => v.nodes[id].type);
    const anchor = liftAnchor3(v, pair);
    if (anchor.at === 'device') anchor.type = v.nodes[anchor.node].type;
    els.lane.classList.toggle('has-router', devs.includes('router'));
    const old = placeLane(els.lane, anchor, laneEnd3(anchor, v.packet?.form, devs));
    els.nest.innerHTML = nestHtml3(v, model, { pair, sel: ui.xray.sel, tip });
    els.medium.innerHTML = mediumHtml3(v, pair, { model, animate });
    slideFloat(els.lane, old, animate);
    if (!animate) els.nest.firstElementChild?.firstElementChild?.classList.add('anim-flash');
    markSelected();
    if (ui.term.open) renderTerm();
  }

  // --- terminál ---
  const termNode = () => view().nodes[ui.term.node] ?? null;
  const modeOf = (id) => ui.term.mode[id] ?? 'user';

  // Overlay terminálu (arp -d, clear arp-cache, výsledky vlastních pingů) platí jen v daném kroku.
  function overlay() {
    if (ui.term.overlay?.k !== cur()) ui.term.overlay = { k: cur(), arp: {} };
    return ui.term.overlay;
  }
  function nodeWithOverlay(node) {
    const o = overlay();
    return o.arp[node.id] ? { ...node, arp_cache: o.arp[node.id] } : node;
  }

  // Běh aplikace ve scénáři, který v tomto kroku běží nebo v něm začal (živý výpis).
  function liveRun(v, nodeId, command, args) {
    const runs = Object.values(v.apps).filter((a) => a.node === nodeId && a.app === command && a.dst === args.dst);
    const a = runs.at(-1);
    if (!a) return null;
    return !a.done || a.startIdx >= v.step.first ? a : null;
  }

  function optsFor(node, liveRunId = null) {
    const v = view();
    return {
      level: 3, mode: modeOf(node.id),
      highlight: v.route?.node === node.id ? v.route.route.prefix : null,
      sim(command, args) {
        if (liveRunId != null) {
          const a = v.apps[liveRunId];
          return a ? { events: a.events, done: a.done } : { events: [], done: false, notYet: true };
        }
        const live = liveRun(v, node.id, command, args);
        if (live && (command === 'tracert' || live.count === args.count)) return { events: live.events, done: live.done, run: live.run };
        const r = whatIf(scn, v, node.id, command, args, overlay());
        Object.assign(overlay().arp, r.arp);
        return r;
      },
      arpDelete(ip) {
        const o = overlay();
        const base = o.arp[node.id] ?? node.arp_cache;
        o.arp[node.id] = base.filter((e) => e.type === 'static' || (ip && e.ip !== ip));
      },
      arpClear() { overlay().arp[node.id] = []; },
    };
  }

  // Řádky logu; živé příkazy se přepočítají podle aktuálního kroku.
  function logLines(node) {
    const out = [];
    for (const e of ui.term.log[node.id] ?? []) {
      if (e.kind !== 'live') { out.push(e); continue; }
      out.push({ kind: 'cmd', prompt: e.prompt, text: e.text });
      if (!view().apps[e.run]) { out.push({ kind: 'note', text: 'V tomto kroku příkaz ještě neběží (spustí se později ve scénáři).' }); continue; }
      const res = execute(nodeWithOverlay(node), e.text, optsFor(node, e.run));
      for (const l of res.lines) out.push({ kind: 'out', line: l });
      if (res.note) out.push({ kind: 'note', text: res.note });
    }
    return out;
  }

  function renderTerm() {
    const node = termNode();
    if (!node) { closeTerm(); return; }
    const d = dialectOf(node) ?? 'none';
    els.term.className = `termwin ${d}`;
    els.term.hidden = false;
    const prompt = promptOf(node, modeOf(node.id));
    els.term.innerHTML = `<div class="term-h"><b>${esc(termTitle(node))}</b><span class="kind">${d === 'ios' ? 'Cisco IOS' : 'Windows'}</span>
      <small class="tstep">stav v kroku ${esc(stepLabel(view().step))}</small>
      <button type="button" class="btn small" data-term-close>Zavřít <kbd>Esc</kbd></button></div>
      <div class="term-b" id="term-body">${termLinesHtml(logLines(node))}<label class="tl inputline"><span class="prompt">${esc(prompt)}</span><input id="term-input" type="text" spellcheck="false" autocomplete="off" aria-label="Příkaz pro ${esc(node.label)}"></label></div>`;
    const body = $('term-body');
    body.scrollTop = body.scrollHeight;
  }

  function openTerm(id, { focus = true } = {}) {
    const node = view().nodes[id];
    if (!node || !dialectOf(node)) return;
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
    const prompt = promptOf(node, modeOf(node.id));
    const word = line.trim().split(/\s+/)[0]?.toLowerCase();
    // živý příkaz: stejný ping/tracert jako ve scénáři v tomto kroku
    if (node.type !== 'router' && (word === 'ping' || word === 'tracert')) {
      const dst = line.trim().split(/\s+/).find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
      const live = dst && liveRun(view(), node.id, word, { dst });
      const n = /-n\s+(\d+)/.exec(line);
      if (live && (word === 'tracert' || Number(n?.[1] ?? 4) === live.count)) {
        log.push({ kind: 'live', prompt, text: line.trim(), run: live.run });
        (ui.term.hist[node.id] ??= []).push(line);
        renderTerm(); $('term-input')?.focus();
        return;
      }
      // student 7: stejný příkaz scénář spustí až později – terminál nesmí ukázat budoucí odpovědi
      const v = view();
      const future = dst && timeline.records.findIndex((r, i) => i > v.step.last && r.kind === 'app.start' && r.node === node.id && r.app === word && r.dst === dst);
      const nextCfg = timeline.records.findIndex((r, i) => i > v.step.last && r.kind === 'config');
      if (future > 0 && (nextCfg < 0 || future < nextCfg)) {
        const k = timeline.steps.findIndex((st) => st.first <= future && future <= st.last);
        log.push({ kind: 'cmd', prompt, text: line });
        log.push({ kind: 'note', text: `Tento příkaz ${node.label} ve scénáři spustí v kroku ${stepLabel(timeline.steps[k])}. Krokuj Vpřed, výpis se pak bude doplňovat.` });
        (ui.term.hist[node.id] ??= []).push(line);
        renderTerm(); $('term-input')?.focus();
        return;
      }
    }
    const res = execute(nodeWithOverlay(node), line, optsFor(node));
    if (res.clear) { ui.term.log[node.id] = []; renderTerm(); $('term-input')?.focus(); return; }
    log.push({ kind: 'cmd', prompt, text: line });
    for (const l of res.lines) log.push({ kind: 'out', line: l });
    if (res.note) log.push({ kind: 'note', text: res.note });
    if (res.mode) ui.term.mode[node.id] = res.mode;
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
    if (tab) ui.xray.tab = tab;
    ui.xray.sel = field;
    renderXray();
  }
  function hover(e, on) {
    const t = e.target.closest?.('[data-field]');
    if (!t) return;
    document.querySelectorAll(`[data-field="${t.dataset.field}"]`).forEach((x) => x.classList.toggle('hl', on));
  }
  document.addEventListener('mouseover', (e) => hover(e, true));
  document.addEventListener('mouseout', (e) => hover(e, false));

  function toggleTip(value) {
    const k = cur();
    const pred = predictAt(k);
    if (!pred) return;
    const set = new Set(tipsAt(k));
    if (!pred.multi) { set.clear(); set.add(value); } else if (set.has(value)) set.delete(value); else set.add(value);
    ui.tips.set(k, set);
    host.state.shown = null;
    host.rerender();
  }

  return {
    scenario: scn, timeline, level,
    // odkazové čipy z textu kroku (rozhodnutí 56c, main.js)
    selectField, openTerm: (id) => openTerm(id || (ui.selected && dialectOf(view().nodes[ui.selected] ?? {}) ? ui.selected : 'PC1')),
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
      if (stepAt(k)?.fix) return 'Oprav bránu';
      return k === 0 ? 'Začít' : 'Vpřed';
    },
    isTip(k) { return Boolean(predictAt(k)); },
    beforeQuestions() {
      let ok = 0, n = 0;
      for (const [k, ans] of ui.answers) {
        if (!ans.length || !predictAt(k)) continue;
        n++;
        if (evalTip(timeline, k, ev.evaluatorOf(k), ans).same) ok++;
      }
      $('q-tips').textContent = n ? `Tipy: ${ok} z ${n} sedělo. Nic se neukládá.` : '';
    },
    onClick(e) {
      const t = e.target.closest?.('[data-pick], [data-fix], [data-part], [data-term], [data-run], [data-term-close], [data-node], [data-xtab], [data-field], [data-tab]');
      if (!t) {
        if (e.target.closest?.('#termwin')) $('term-input')?.focus();
        return;
      }
      if (t.dataset.pick !== undefined) { toggleTip(t.dataset.pick); return; }
      if (t.dataset.fix !== undefined) { host.go(cur() + 1, { animate: true }); return; }
      if (t.dataset.part !== undefined) { host.setPlaying(false); host.go(Number(t.dataset.part)); return; }
      if (t.dataset.term) { openTerm(t.dataset.term); return; }
      if (t.dataset.run) { openTerm(t.dataset.run); runCmd(t.dataset.cmd); return; }
      if (t.matches('[data-term-close]')) { closeTerm(); return; }
      if (t.dataset.node) {
        ui.selected = ui.selected === t.dataset.node ? null : t.dataset.node;
        host.state.shown = null; host.rerender();
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
      if (e.target.matches?.('input[type=text], textarea')) return false;
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('#info tr[data-field]')) {
        selectField(ui.xray.sel === e.target.dataset.field ? null : e.target.dataset.field, e.target.dataset.tab);
        e.preventDefault();
        return true;
      }
      if (e.key === 'r' || e.key === 'R') {
        const pdu = xrayTarget(view());
        if (pdu) {
          const tabs = pduFields(pdu).blocks.map((b) => b.id);
          const i = tabs.indexOf(ui.xray.tab);
          ui.xray = { tab: tabs[(i + 1) % tabs.length], sel: null };
          renderXray();
        }
        return true;
      }
      if (e.key === 'Enter' && predictAt(cur()) && tipsAt(cur()).size && !e.target.matches?.('button')) {
        host.go(cur() + 1, { animate: true });
        return true;
      }
      return false;
    },
    onReset() {
      ui.tips.clear(); ui.answers.clear(); ui.selected = null; ui.term.log = {}; ui.term.mode = {}; closeTerm();
    },
    // adresa: x=záložka rentgenu, f=pole, t=terminál, c=příkaz (víckrát), pick=tipy (čárkou),
    // ans=id:volby;id:volby (potvrzené tipy), sel=vybraný uzel
    applyParams(p) {
      const k = cur();
      if (stepAt(k).xray) ui.xray = { tab: stepAt(k).xray.tab, sel: stepAt(k).xray.fields[0] };
      if (p.get('x')) ui.xray = { tab: p.get('x'), sel: null };
      if (p.get('f')) ui.xray.sel = p.get('f');
      if (p.get('pick')) ui.tips.set(k, new Set(p.get('pick').split(',')));
      for (const part of (p.get('ans') ?? '').split(';').filter(Boolean)) {
        const [id, vals] = part.split(':');
        const tk = timeline.steps.findIndex((s) => s.predict?.id === id);
        if (tk >= 0 && vals) ui.answers.set(tk, vals.split(','));
      }
      if (p.get('sel')) ui.selected = p.get('sel');
    },
    afterStart(p) {
      if (p.get('t')) {
        openTerm(p.get('t'), { focus: false });
        for (const c of p.getAll('c')) runCmd(c);
      }
    },
    // rozhodnutí 50: skutečná zpráva, ne dvojice scénáře
    dir(v) {
      const m = currentMessage(v);
      return m ? `zpráva: ${m.name} ${m.from} → ${m.to}` : '';
    },
  };
}
