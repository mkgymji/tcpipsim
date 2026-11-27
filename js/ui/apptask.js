// Režim modelových situací (úlohy, #uloha=N&seed=S; docs/ui.md kap. 15, rozh. 66–69): topologie úrovně 4
// s klikacími kabely, karta zadání se Zkontrolovat, nápovědy, terminál a rentgen rámců posledního
// příkazu. Stav sítě drží js/scenario/task.js (bez DOM); tady jen kreslení a události.
import { TASKS, TASK_ORDER } from '../../scenarios/ulohy.js';
import base from '../../scenarios/uroven4-transport.js';
import { createTask, applyFix, evaluate, runCommand, nodeView, effTopo, hint3Of, resolveName } from '../scenario/task.js';
import { validateIpv4, classMask } from '../core/hostcfg.js';
import { dialectOf, promptOf, execute } from '../cli/shell.js';
import { termLinesHtml, termTitle } from './render2.js';
import { xrayHtml3 } from './render3.js';
import { esc } from './render.js';
import { taskTopologyHtml, taskCardHtml, hintsHtml, framesHtml, frameSummary, ipv4DialogHtml, printerDialogHtml, dialogMsgHtml, md } from './rendertask.js';
import { formatTaskHash } from './urlstate.js';

const $ = (id) => document.getElementById(id);
const ACTIONS = {
  PC1: [{ act: 'term', text: 'Terminál' }, { act: 'ipv4', text: 'Vlastnosti IPv4' }],
  PC2: [{ act: 'term', text: 'Terminál' }], PC3: [{ act: 'term', text: 'Terminál' }], SRV1: [{ act: 'term', text: 'Terminál' }],
  R1: [{ act: 'term', text: 'Konzole' }], SW1: [{ act: 'term', text: 'Konzole' }], SW2: [{ act: 'term', text: 'Konzole' }],
  PRT1: [{ act: 'printer', text: 'Nastavení sítě' }],
};

/** Úvodní seznam úloh (neznámé číslo v adrese). */
function taskListHtml() {
  return `<div class="card tcard"><h2>Modelové situace</h2><p>Vyber úlohu (pořadí pro hodinu: 4, 1, 5, 7, 10; doma 11, 3, 13):</p>
    <ol class="tlist">${TASK_ORDER.map((id) => `<li><a href="${formatTaskHash(id)}">Úloha ${id}: ${esc(TASKS[id].title)}</a></li>`).join('')}</ol></div>`;
}

export function startTaskMode({ id, seed }) {
  const def = TASKS[id];
  const main = $('app');
  document.body.classList.add('taskmode');
  if (!def) {
    document.title = 'Modelové situace · TCP/IP výukový simulátor';
    $('level-title').textContent = 'Modelové situace';
    main.innerHTML = taskListHtml();
    return;
  }
  if (def.seeded && seed == null) {
    // seed bez zadání: vylosuje UI (jen tady; jádro náhodu nepoužívá) a zapíše do adresy
    seed = 1 + Math.floor(Math.random() * 999);
    history.replaceState(null, '', formatTaskHash(id, seed));
  }
  document.title = `Úloha ${id} ${def.title} · TCP/IP výukový simulátor`;
  $('level-title').textContent = `Úloha ${id}: ${def.title}`;
  main.innerHTML = `<section class="tleft" aria-label="Síť">
      <div class="card ttopo" id="ttopo" aria-label="Topologie"></div>
      <section class="termwin" id="termwin" aria-label="Terminál"></section>
    </section>
    <aside class="taside">
      <div class="card tcard" id="tcard"></div>
      <div class="card thints" id="thints"></div>
      <div class="card info" id="info" data-role="rentgen"></div>
    </aside>`;
  const dlg = document.createElement('dialog');
  dlg.id = 'tdlg';
  dlg.setAttribute('aria-labelledby', 'dlg-title');
  document.body.append(dlg);

  let task = createTask(def, base, { seed: seed ?? 1 });
  const ui = { selected: 'PC1', layerGuess: '', result: null, cap: null, frame: null, xs: { tab: null, sel: null },
    term: { node: 'PC1', log: {}, hist: {}, pos: -1, mode: {} }, focus: 'tcard' };

  // --- ohnisko (rozh. 56): jeden panel s rámečkem „Sleduj tady“, ostatní mírně ztlumené ---
  function setFocus(f) {
    ui.focus = f;
    main.dataset.taskFocus = f;
    for (const el of main.querySelectorAll('[data-focus]')) el.removeAttribute('data-focus');
    $(f)?.setAttribute('data-focus', '');
  }

  function topoModel() {
    const topo = effTopo(task);
    return { nodes: topo.nodes.map((n) => ({ id: n.id, type: n.type, device: n.device, label: n.label ?? n.id, ip: n.interfaces?.[0]?.ip })),
      links: topo.links.map((l) => ({ ...l, connected: l.connected !== false })), selected: ui.selected, actions: ACTIONS };
  }
  const renderTopo = () => { $('ttopo').innerHTML = taskTopologyHtml(topoModel()); };
  function renderCard() {
    $('tcard').innerHTML = taskCardHtml(def, { seed: task.seed, result: ui.result, layerGuess: ui.layerGuess });
  }
  function renderHints() {
    const hints = def.hints.map((h, i) => (i === 2 && h == null ? hint3Of(task) : h));
    $('thints').innerHTML = hintsHtml(hints, task.hintsOpened);
  }
  function renderInfo() {
    const f = ui.cap?.frames[ui.frame];
    $('info').innerHTML = `<h3>Rentgen: zachycené rámce</h3>${framesHtml(ui.cap, ui.frame)}${f ? `<div class="txray">${xrayHtml3({ frame: f.pdu }, ui.xs)}</div>` : ''}`;
  }

  // --- terminál ---
  const termNode = () => nodeView(task, ui.term.node);
  const modeOf = (nid) => ui.term.mode[nid] ?? 'user';
  function capture(records, nid, cmd) {
    const near = new Set(effTopo(task).links.filter((l) => l.a.node === nid || l.b.node === nid).map((l) => l.id));
    const all = records.filter((r) => r.kind === 'link.tx' && near.has(r.link));
    ui.cap = { cmd, label: task.topology.nodes.find((n) => n.id === nid)?.label ?? nid, more: all.length > 40,
      frames: all.slice(0, 40).map((r) => ({ out: r.from === nid, text: frameSummary(r.pdu), pdu: r.pdu })) };
    ui.frame = null;
    ui.xs = { tab: null, sel: null };
  }
  function optsFor(node, line) {
    const nid = node.id;
    return {
      level: 4, mode: modeOf(nid),
      sim(command, args) {
        if (command === 'nslookup') {
          const r = runCommand(task, nid, 'nslookup', { name: args.name });
          capture(r.records, nid, line);
          return { timeouts: r.records.filter((x) => x.kind === 'dns_timeout').length, result: r.apps.at(-1)?.result ?? null };
        }
        if (command === 'curl') {
          const r = runCommand(task, nid, 'http_get', { host: args.host, port: args.port, path: args.path, client: 'curl' });
          capture(r.records, nid, line);
          const res = r.apps.find((x) => x.command === 'http_get')?.result ?? null;
          return { result: res, dst: res?.remote?.split(':')[0] ?? r.apps.find((x) => x.command === 'dns_resolve')?.result?.answers?.[0]?.data ?? null };
        }
        const r = runCommand(task, nid, command, args);
        capture(r.records, nid, line);
        const events = r.records.filter((x) => x.kind === 'app.event').map((x) => ({ seq: x.seq, ttl: x.ttl, probe: x.probe, result: x.result }));
        return { events, done: true, result: r.result, records: r.records };
      },
      resolve: (name) => resolveName(task, nid, name),
      arpDelete(ip) { applyFix(task, { kind: 'arp_delete', node: nid, ip }); },
      arpClear() { applyFix(task, { kind: 'arp_clear', node: nid }); },
      service(app, on) { applyFix(task, { kind: 'service', node: nid, app, running: on }); },
    };
  }
  function logLines(node) {
    const out = [];
    for (const e of ui.term.log[node.id] ?? []) {
      if (e.kind === 'cmd') out.push(e);
      else if (e.kind === 'note') out.push(e);
      else for (const l of e.lines) out.push({ kind: 'line', line: l });
    }
    return out;
  }
  function renderTerm({ focus = false } = {}) {
    const node = termNode();
    const d = dialectOf(node);
    const el = $('termwin');
    el.className = `termwin ${d}`;
    const prompt = promptOf(node, modeOf(node.id));
    el.innerHTML = `<div class="term-h"><b>${esc(termTitle(node))}</b><span class="kind">${{ ios: 'Cisco IOS', linux: 'Linux (bash)' }[d] ?? 'Windows'}</span>
      <small class="term-sw">jiné zařízení: klik v topologii → Terminál</small></div>
      <div class="term-b" id="term-body">${termLinesHtml(logLines(node))}<label class="tl inputline"><span class="prompt">${esc(prompt)}</span><input id="term-input" type="text" spellcheck="false" autocomplete="off" aria-label="Příkaz pro ${esc(node.label)}"></label></div>`;
    const body = $('term-body');
    body.scrollTop = body.scrollHeight;
    if (focus) $('term-input')?.focus();
  }
  function openTerm(nid) {
    if (!dialectOf(nodeView(task, nid))) return;
    ui.term.node = nid;
    ui.term.pos = -1;
    if (!ui.term.log[nid]) ui.term.log[nid] = [];
    renderTerm({ focus: true });
    setFocus('termwin');
  }
  function runLine(line) {
    const node = termNode();
    const log = (ui.term.log[node.id] ??= []);
    log.push({ kind: 'cmd', prompt: promptOf(node, modeOf(node.id)), text: line });
    const res = execute(node, line, optsFor(node, line.trim()));
    if (res.clear) { ui.term.log[node.id] = []; }
    else {
      log.push({ kind: 'out', lines: res.lines });
      if (res.note) log.push({ kind: 'note', text: res.note });
    }
    if (res.mode) ui.term.mode[node.id] = res.mode;
    if (line.trim()) (ui.term.hist[node.id] ??= []).push(line);
    ui.term.pos = -1;
    renderTerm({ focus: true });
    renderTopo();
    renderInfo();
    setFocus('termwin');
  }
  function termKey(e) {
    const input = e.target;
    const hist = ui.term.hist[ui.term.node] ?? [];
    if (e.key === 'Enter') { const v = input.value; input.value = ''; runLine(v); e.preventDefault(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!hist.length) return;
      if (e.key === 'ArrowUp') ui.term.pos = ui.term.pos < 0 ? hist.length - 1 : Math.max(0, ui.term.pos - 1);
      else ui.term.pos = ui.term.pos < 0 ? -1 : ui.term.pos + 1 >= hist.length ? -1 : ui.term.pos + 1;
      input.value = ui.term.pos < 0 ? '' : hist[ui.term.pos];
      e.preventDefault();
    }
  }

  // --- dialogy (IPv4 u Alice, tiskárna) ---
  function readForm() {
    const g = (x) => dlg.querySelector(x)?.value ?? '';
    return { mode: dlg.querySelector('input[name=mode]:checked')?.value ?? 'static', ip: g('#f-ip'), mask: g('#f-mask'), gateway: g('#f-gw'),
      dnsMode: dlg.querySelector('input[name=dnsMode]:checked')?.value ?? 'static', dns1: g('#f-dns1'), dns2: g('#f-dns2') };
  }
  function syncDialog() {
    const f = readForm();
    const st = f.mode === 'static';
    for (const x of ['#f-ip', '#f-mask', '#f-gw']) { const el = dlg.querySelector(x); if (el) el.disabled = !st; }
    const auto = dlg.querySelector('input[name=dnsMode][value=auto]');
    if (auto) { auto.disabled = st; if (st) dlg.querySelector('input[name=dnsMode][value=static]').checked = true; }
    const dnsOn = dlg.querySelector('input[name=dnsMode]:checked')?.value !== 'auto';
    for (const x of ['#f-dns1', '#f-dns2']) { const el = dlg.querySelector(x); if (el) el.disabled = !dnsOn; }
  }
  function openDialog(kind) {
    if (kind === 'ipv4') {
      dlg.innerHTML = ipv4DialogHtml('Alice', task.topology.nodes.find((n) => n.id === 'PC1').ipv4_config);
      syncDialog();
    } else dlg.innerHTML = printerDialogHtml(task.topology.nodes.find((n) => n.id === 'PRT1'));
    dlg.dataset.kind = kind;
    dlg.showModal();
    dlg.querySelector('input:not([disabled])')?.focus();
  }
  function submitDialog(confirmed = false) {
    const kind = dlg.dataset.kind;
    const f = readForm();
    const v = validateIpv4(kind === 'printer' ? { ...f, mode: 'static', dnsMode: 'auto' } : f);
    const msg = $('dlg-msg');
    if (v.errors.length) { msg.innerHTML = dialogMsgHtml(v); return; }
    if (kind === 'ipv4' && v.warnings.length && !confirmed) { msg.innerHTML = dialogMsgHtml(v, { confirm: true }); $('dlg-yes')?.focus(); return; }
    if (kind === 'ipv4') {
      const cfg = { ...v.cfg, dns: f.dnsMode === 'auto' && v.cfg.mode === 'dhcp' ? [] : v.cfg.dns };
      if (cfg.mode === 'dhcp') Object.assign(cfg, { ip: null, prefix: null, gateway: null });
      applyFix(task, { kind: 'ipv4', node: 'PC1', cfg });
    } else applyFix(task, { kind: 'printer', node: 'PRT1', ip: v.cfg.ip, prefix: v.cfg.prefix, gateway: v.cfg.gateway });
    dlg.close();
    renderTopo();
    note(kind === 'ipv4' ? 'Nastavení IPv4 Alice uloženo a platí hned. Ověř ho: ipconfig /all.' : 'Nastavení tiskárny uloženo.');
  }
  // poznámka simulátoru do otevřeného terminálu (co se změnilo mimo něj)
  function note(text) {
    (ui.term.log[ui.term.node] ??= []).push({ kind: 'note', text });
    renderTerm();
  }
  dlg.addEventListener('submit', (e) => { e.preventDefault(); submitDialog(); });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('#dlg-cancel') || e.target.closest('#dlg-no')) { if (e.target.closest('#dlg-no')) $('dlg-msg').innerHTML = ''; else dlg.close(); }
    else if (e.target.closest('#dlg-yes')) submitDialog(true);
  });
  dlg.addEventListener('change', (e) => { if (e.target.name === 'mode' || e.target.name === 'dnsMode') syncDialog(); });
  // Windows po opuštění pole IP předvyplní masku podle třídy (zbytek třídního adresování)
  dlg.addEventListener('focusout', (e) => {
    if (e.target.id !== 'f-ip') return;
    const m = dlg.querySelector('#f-mask');
    if (m && !m.value.trim() && /^\d{1,3}(\.\d{1,3}){3}$/.test(e.target.value.trim())) m.value = classMask(e.target.value.trim());
  });

  // --- události ---
  function toggleCable(lid) {
    const l = task.topology.links.find((x) => x.id === lid);
    const on = l.connected === false;
    applyFix(task, { kind: 'link', link: lid, connected: on });
    renderTopo();
    const ln = (nid) => task.topology.nodes.find((n) => n.id === nid)?.label ?? nid;
    note(`Kabel ${ln(l.a.node)} – ${ln(l.b.node)} ${on ? 'zapojen' : 'odpojen'}.${on ? ' Simulátor zjednodušuje: po zapojení Windows znovu ověří adresu (ARP Probe), simulátor to nekreslí.' : ''}`);
  }
  function check() {
    ui.layerGuess = $('t-layer')?.value ?? ui.layerGuess;
    ui.result = evaluate(task, { layerGuess: ui.layerGuess || null });
    renderCard();
    setFocus('tcard');
    $('t-result')?.scrollIntoView?.({ block: 'nearest' });
  }
  function reset() {
    task = createTask(def, base, { seed: task.seed });
    Object.assign(ui, { result: null, cap: null, frame: null, layerGuess: '', selected: 'PC1' });
    ui.term = { node: 'PC1', log: { PC1: [{ kind: 'note', text: 'Úloha obnovena: síť je zase ve stavu ze zadání.' }] }, hist: {}, pos: -1, mode: {} };
    renderAll();
    setFocus('tcard');
  }
  main.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pick], [data-act], [data-cable], [data-hint], [data-frame], [data-xtab], [data-field], #t-check, #t-reset');
    if (!t) return;
    if (t.id === 't-check') return check();
    if (t.id === 't-reset') return reset();
    if (t.dataset.cable) return toggleCable(t.dataset.cable);
    if (t.dataset.pick) { ui.selected = ui.selected === t.dataset.pick ? null : t.dataset.pick; renderTopo(); setFocus('ttopo'); return; }
    if (t.dataset.act) {
      if (t.dataset.act === 'term') openTerm(t.dataset.node);
      else openDialog(t.dataset.act);
      return;
    }
    if (t.dataset.hint != null) {
      if (Number(t.dataset.hint) === task.hintsOpened) task.hintsOpened++;
      renderHints();
      return;
    }
    if (t.dataset.frame != null) { ui.frame = Number(t.dataset.frame); ui.xs = { tab: null, sel: null }; renderInfo(); setFocus('info'); return; }
    if (t.dataset.xtab) { ui.xs = { tab: t.dataset.xtab, sel: null }; renderInfo(); return; }
    if (t.dataset.field) { ui.xs = { tab: t.dataset.tab, sel: ui.xs.sel === t.dataset.field ? null : t.dataset.field }; renderInfo(); }
  });
  main.addEventListener('change', (e) => { if (e.target.id === 't-layer') ui.layerGuess = e.target.value; });
  main.addEventListener('keydown', (e) => { if (e.target.id === 'term-input') termKey(e); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { $('term-input')?.focus(); e.preventDefault(); }
  });

  function renderAll() { renderTopo(); renderCard(); renderHints(); renderInfo(); renderTerm(); }
  ui.term.log.PC1 = [{ kind: 'note', text: 'Terminál Alice. Začni třeba ipconfig. Terminál jiného zařízení: klikni na něj v topologii a zvol Terminál (Konzole).' }];
  renderAll();
  setFocus('tcard');
  $('q-list').innerHTML = def.question ? `<li>${md(def.question)}<details><summary>Ukázat odpověď</summary><p>${esc(def.answer)}</p></details></li>` : '';
  return { task: () => task, ui };
}
