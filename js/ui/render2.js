// Vykreslení úrovně 2 „Adresy“ (docs/ui.md kap. 11): topologie s hubem/switchem a MAC tabulkou,
// obálky s adresami, rentgen (pole + hexdump), terminál, předpověď. Funkce vracejí HTML jako
// text (testují se v Node), stav si nedrží (VYVOJ.md kap. 6).
import { osiLayer, rowOf } from '../core/layers.js';
import { stepLabel, textFor } from '../core/timeline.js';
import { isHost } from '../devices/types.js';
import { frameFields, byteRegion } from '../wire/fields.js';
import { bitString } from '../wire/encode.js';
import { esc, badge, rowLabel } from './render.js';

const cssVars = (n) => `--c:var(--L${n});--t:var(--L${n}t)`;

// MAC s tučným posledním bajtem (ui.md 11.3), IP s tučným posledním oktetem.
export function macHtml(mac) {
  const i = mac.lastIndexOf(':');
  return `<span class="dim">${esc(mac.slice(0, i + 1))}</span><b>${esc(mac.slice(i + 1))}</b>`;
}
// Zkrácený zápis pro nízké okno (ui.md 11.3: „02:..:01“); plný je vždy v rentgenu.
function macCellHtml(mac) {
  const i = mac.lastIndexOf(':');
  return `<span class="full">${macHtml(mac)}</span><span class="short"><span class="dim">${esc(mac.slice(0, 3))}…:</span><b>${esc(mac.slice(i + 1))}</b></span>`;
}
export function ipHtml(ip) {
  const i = ip.lastIndexOf('.');
  return `<span class="dim">${esc(ip.slice(0, i + 1))}</span><b>${esc(ip.slice(i + 1))}</b>`;
}

// MAC s tučným posledním bajtem a zkrácenou střední částí („02:…:03“).
function macShort(mac) {
  const i = mac.lastIndexOf(':');
  return `<span class="dim">${esc(mac.slice(0, 3))}…:</span><b>${esc(mac.slice(i + 1))}</b>`;
}

const nodeLabel = (v, id) => v.nodes[id]?.label ?? id;
const byMac = (v, mac) => v.order.find((id) => v.nodes[id].mac === mac);
const byIp = (v, ip) => v.order.find((id) => v.nodes[id].ip === ip);

// Rozmístění do hvězdy: první PC vlevo, další vpravo pod sebou, zařízení uprostřed.
export function starLayout(v) {
  const hosts = v.order.filter((id) => isHost(v.nodes[id].type));
  const dev = v.order.find((id) => !isHost(v.nodes[id].type));
  const slots = { [hosts[0]]: 'left', [hosts[1]]: 'rtop', [hosts[2]]: 'rbot' };
  const portOf = {};   // PC -> port zařízení, linka
  for (const l of Object.values(v.links)) {
    const [pc, d] = l.a.node === dev ? [l.b, l.a] : [l.a, l.b];
    portOf[pc.node] = { port: d.if, link: l.id };
  }
  return { hosts, dev, slots, portOf };
}

const PILL = {
  sender: ['odesílatel', ''], incoming: ['rámec přichází', ''], received: ['přijal', '✓'], dropped: ['zahodil', '⊗'],
};

function pcCard(v, id, slot, ui) {
  const n = v.nodes[id];
  const pill = v.pills[id];
  const inPair = ui.pair && (ui.pair.sender === id || ui.pair.receiver === id);
  const drop = pill === 'dropped' && v.dropped?.node === id ? v.dropped : null;
  const p = pill ? `<span class="pill ${pill}">${PILL[pill][1] ? `<i aria-hidden="true">${PILL[pill][1]}</i> ` : ''}${PILL[pill][0]}</span>` : '';
  // rozhodnutí 35: MAC u uzlu; při zahození místo adres důvod („cílová …:02 ≠ moje …:03“)
  const addr = drop
    ? `<span class="dropwhy"><span>cílová ${macShort(drop.dst)}</span><span>≠ moje ${macShort(drop.mac)}</span></span>`
    : `<span class="ip">${ipHtml(n.ip)}</span><span class="mac">${macHtml(n.mac)}</span>`;
  const sel = ui.selected === id;
  return `<div class="pc slot-${slot}${inPair ? ' pair' : ''}${sel ? ' sel' : ''}${v.focus?.node === id ? ' act' : ''}">
    <button type="button" class="pcbtn" data-node="${id}" aria-label="${esc(`${n.label}, IP ${n.ip}, MAC ${n.mac}${pill ? `, ${PILL[pill][0]}` : ''}. Klik: jeho pohled na zprávu a terminál`)}">
    <span class="pchead"><svg aria-hidden="true"><use href="#ico-pc"/></svg><span class="nm">${esc(n.label)}</span></span>
    ${addr}</button>${p}
    ${sel ? `<button type="button" class="btn tiny-txt" data-term="${id}">Terminál <kbd>F2</kbd></button>` : ''}</div>`;
}

// Volby tipu „kam zařízení pošle rámec“ (rozhodnutí 31): porty zařízení z topologie kromě
// vstupního (ten je v kroku tipu označený 'in'); u hubu popisek = počítač na portu.
export function tipOptions(v, pred) {
  const dev = v.nodes[pred?.node];
  if (!dev?.ports) return [];
  const inPort = Object.entries(v.portState[pred.node] ?? {}).find(([, s]) => s === 'in')?.[0];
  const hostAt = (port) => {
    const l = Object.values(v.links).find((x) => (x.a.node === pred.node && x.a.if === port) || (x.b.node === pred.node && x.b.if === port));
    const end = l && (l.a.node === pred.node ? l.b : l.a);
    return end ? nodeLabel(v, end.node) : port;
  };
  return dev.ports.filter((p) => p !== inPort).map((p) => ({ port: p, label: pred.pick === 'hosts' ? hostAt(p) : p }));
}

function portBadge(v, dev, port, side, ui) {
  const n = v.nodes[dev];
  const st = v.portState[dev]?.[port] ?? (v.decision?.node === dev && v.decision.inPort === port ? 'in' : null);
  const pred = ui.predict && ui.predict.node === dev ? ui.predict : null;
  const opt = pred ? tipOptions(v, pred).find((o) => o.port === port) : null;
  const tip = ui.tips?.has(port);
  const name = n.portLabels?.[port] ?? port;
  let state = st === 'in' ? 'vstup' : st === 'out' ? 'výstup' : '';
  const decided = v.decision?.node === dev && ['forward', 'flood', 'repeat'].includes(v.decision.kind);
  if (!st && decided) state = '–';
  if (opt && !st) state = 'klik';
  const cls = ['port', `p-${side}`, st ?? '', opt ? 'pick' : '', tip ? 'tip' : '', pred && !opt && st === 'in' ? 'nopick' : ''].filter(Boolean).join(' ');
  const inner = `${tip ? '<span class="tiptag">tip</span>' : ''}<b>${esc(name)}</b><small>${esc(state)}</small>`;
  return opt
    ? `<button type="button" class="${cls}" data-pick="${esc(port)}" aria-pressed="${tip ? 'true' : 'false'}" aria-label="${esc(`Tip: ${opt.label === port ? name : `${opt.label} (${name})`}`)}">${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}

function wireHtml(v, link, side, animate) {
  const w = v.wires[link];
  let tag = '';
  if (w) {
    const toRight = side === 'left' ? isHost(v.nodes[w.from]?.type) : !isHost(v.nodes[w.from]?.type);
    tag = `<span class="ftag ${toRight ? 'r' : 'l'}${animate ? ' anim-travel' : ''}" title="rámec">${toRight ? '' : '◀ '}<span class="fw">rámec</span>${toRight ? ' ▶' : ''}</span>`;
  }
  return `<div class="wire2 w-${side}${w ? ' on' : ''}" data-link="${link}"><span class="cable"></span>${tag}</div>`;
}

function macTable(v, dev) {
  const n = v.nodes[dev];
  const fresh = v.newEntries[dev] ?? {};
  // rozhodnutí 24: jen naučené záznamy, žádný řádek „?“; nalezený cíl dostane štítek
  const d = v.decision;
  const found = d?.node === dev && (d.kind === 'forward' || d.kind === 'filter') ? d.dst : null;
  const rows = n.mac_table.map((e) => {
    const op = fresh[e.mac];
    const tag = op ? `<span class="newtag">${op === 'add' ? 'nový' : 'změna'}</span>` : e.mac === found ? '<span class="looktag">nalezeno</span>' : '';
    return `<tr class="${op ? 'new' : ''}${e.mac === found ? ' found' : ''}"><td class="mono">${macHtml(e.mac)}</td><td>${esc(e.port)}</td><td class="tagc">${tag}</td></tr>`;
  }).join('');
  const empty = !n.mac_table.length ? '<tr class="empty"><td colspan="3">prázdná: switch zatím nic nezná</td></tr>' : '';
  return `<div class="mact"><div class="mact-h">MAC tabulka ${esc(n.label)}</div>
    <table><thead><tr><th>MAC adresa</th><th>Port</th><th class="tagc"></th></tr></thead><tbody>${rows}${empty}</tbody></table></div>`;
}

function deviceCard(v, dev, ui) {
  const n = v.nodes[dev];
  const isSw = n.type === 'switch';
  const act = v.focus?.node === dev;
  const layer = v.focus?.node === dev ? v.focus.layer : null;
  const mini = (num, name, pdu) => `<div class="mini${layer === num ? ' active' : ''}" style="${cssVars(num)}">${badge(num, `L${num}`)}<span>${name}</span><em>${pdu}</em></div>`;
  const sub = isSw ? 'switch, čte jen L1–L2' : 'hub, jen L1 (bity)';
  const sel = ui.selected === dev;
  return `<div class="devcard ${n.type}${act ? ' act' : ''}${sel ? ' sel' : ''}">
    <button type="button" class="devhead" data-node="${dev}" aria-label="${esc(`${n.label}, ${sub}`)}">
      <svg aria-hidden="true"><use href="#ico-${isSw ? 'switch' : 'hub'}"/></svg><span><b>${esc(n.label)}</b><small>${sub}</small></span></button>
    ${isSw && sel ? `<button type="button" class="btn tiny-txt" data-term="${dev}">Terminál <kbd>F2</kbd></button>` : ''}
    <div class="minis${isSw ? ' two' : ''}">${isSw ? mini(2, 'Linková', 'rámec') : ''}${mini(1, 'Fyzická', 'bity')}</div>
    ${isSw ? macTable(v, dev) : ui.tip ? '' : '<p class="hubnote">Hub nečte adresy a nemá žádnou tabulku.</p>'}
    ${ui.decision ? `<div class="decision">${esc(ui.decision)}</div>` : ''}</div>`;
}

function decisionText(v) {
  const d = v.decision;
  if (!d?.kind) return '';
  if (d.kind === 'repeat') return 'hub: na všechny ostatní porty';
  if (d.kind === 'flood') return d.reason === 'broadcast' ? 'broadcast → flooding' : 'neznámá cílová MAC → flooding';
  if (d.kind === 'forward') return `známá cílová MAC → jen ${d.outPorts[0]}`;
  return 'cíl je na příchozím portu → zahodit';
}

/** Topologie: hvězda se třemi PC a hubem/switchem (ui.md 11.1). ui = { pair, selected, predict, tips, changed:Set, canSwap, animate } */
export function topologyHtml(v, ui) {
  const { hosts, dev, slots, portOf } = starLayout(v);
  const side = (id) => (slots[id] === 'left' ? 'left' : 'right');
  const parts = [];
  for (const id of hosts) {
    const s = slots[id];
    parts.push(pcCard(v, id, s, ui));
    parts.push(`<div class="wslot ws-${s}">${wireHtml(v, portOf[id].link, side(id), ui.animate)}</div>`);
    parts.push(`<div class="pslot ps-${s}">${portBadge(v, dev, portOf[id].port, side(id), ui)}</div>`);
  }
  const dec = decisionText(v);
  const swap = v.nodes[dev].type === 'hub'
    ? `<button type="button" class="btn small swap" id="btn-swap"${ui.canSwap ? '' : ' aria-disabled="true"'}>Vyměnit hub za switch</button>` : '';
  // při tipu se schová vše, co by prozradilo výsledek (rozhodnutí 31)
  const tip = Boolean(ui.predict && ui.predict.node === dev);
  return `<span class="tag">TOPOLOGIE</span><span class="legend">dvojitý obrys = odesílatel a příjemce vybrané zprávy</span>${swap}
    <div class="star">${parts.join('')}<div class="dslot">${deviceCard(v, dev, { ...ui, decision: dec, tip })}</div></div>`;
}

// --- obálky s adresami (ui.md 11.3) ---

// Buňka adresy; `field` propojuje štítek s rentgenem (stejné číslo pole a obrys).
function cell(kind, who, valueHtml, field, num, tab, sel) {
  return `<button type="button" class="acell${sel === field ? ' selected' : ''}" data-field="${field}" data-tab="${tab}"
    aria-label="${esc(`${kind}${who ? ` (${who})` : ''}, pole ${num}`)}"><span class="cap"><span>${esc(kind)}${who ? ` (${esc(who)})` : ''}</span><i class="fno">${num}</i></span>
    <span class="val">${valueHtml}</span></button>`;
}

function addrRow(pdu, v, sel) {
  const h = pdu.h;
  if (pdu.proto === 'ethernet') {
    return cell('zdroj MAC', nodeLabel(v, byMac(v, h.src)), macCellHtml(h.src), 'eth.src', 2, 'ethernet', sel)
      + '<span class="arr" aria-hidden="true">→</span>'
      + cell('cíl MAC', byMac(v, h.dst) ? nodeLabel(v, byMac(v, h.dst)) : '', macCellHtml(h.dst), 'eth.dst', 1, 'ethernet', sel);
  }
  if (pdu.proto === 'ipv4') {
    return cell('zdroj IP', '', ipHtml(h.src), 'ip.src', 12, 'ipv4', sel) + '<span class="arr" aria-hidden="true">→</span>'
      + cell('cíl IP', '', ipHtml(h.dst), 'ip.dst', 13, 'ipv4', sel);
  }
  return cell('zdrojový port', '', `<b>${h.sport}</b>`, 'udp.sport', 1, 'udp', sel) + '<span class="arr" aria-hidden="true">→</span>'
    + cell('cílový port', '', `<b>${h.dport}</b>`, 'udp.dport', 2, 'udp', sel);
}

// rozhodnutí 32: PDU transportní vrstvy u UDP je „UDP datagram“, ne segment
const PDU_NAME = { ethernet: 'rámec', ipv4: 'paket', udp: 'UDP datagram' };

function box2(pdu, model, v, sel, outerClass = '') {
  if (pdu.proto === 'data') {
    return `<div class="data d2 ${outerClass}" data-env="data"><button type="button" class="lab" data-env="data" data-tab="udp" data-field="udp.payload"
      aria-label="Data aplikace"><span>${model === 'osi' ? 'L7' : 'L5-7'} data</span><em>obsah zprávy</em></button>
      <span class="msg">${esc(pdu.payload)}</span></div>`;
  }
  const n = pdu.layer;
  const name = rowLabel(model, n);
  const trail = pdu.proto === 'ethernet' ? '<span class="trail">konec rámce</span>' : '';
  return `<div class="box b2 ${outerClass}" data-env="${pdu.proto}" style="${cssVars(n)}">
    <button type="button" class="lab" data-env="${pdu.proto}" data-tab="${pdu.proto}" aria-label="${esc(`Obálka ${name}: rentgen`)}">
    <span>${esc(name)}</span><em>${PDU_NAME[pdu.proto]}</em></button>
    <div class="addr">${addrRow(pdu, v, sel)}</div>${box2(pdu.payload, model, v, sel)}${trail}</div>`;
}

// Nadpis výtahu; `tip` = krok tipu (u hubu se nepíše, že nic nečte: prozradilo by to výsledek).
export function nestCaption(v, pair, { tip = false } = {}) {
  const s = nodeLabel(v, pair?.sender);
  const p = v.packet;
  if (!p) return { left: 'Zpráva', right: '' };
  const outer = p.pdu?.proto;
  const what = p.form === 'bits' || p.form === 'wire' ? 'Bity' : outer === 'ethernet' ? 'Rámec' : outer === 'ipv4' ? 'Paket' : outer === 'udp' ? 'Datagram' : 'Data';
  // jiný příjemce než adresát zprávy (Cyril): rámec patří Bobovi, Cyril ho jen dostal
  const addressee = v.flow?.receiver;
  const r = addressee && pair?.receiver && pair.receiver !== addressee
    ? `${nodeLabel(v, addressee)} (dostal i ${nodeLabel(v, pair.receiver)})` : nodeLabel(v, pair?.receiver);
  const dev = v.nodes[v.focus?.node];
  const right = dev?.type === 'switch' ? `${dev.label} čte pole 1 a 2` : dev?.type === 'hub' && !tip ? `${dev.label} nečte žádné pole` : '';
  return { left: `${what} ${s} → ${r}`, right };
}

/** Středový panel: obálky s adresami, socket, zahození. */
export function nestHtml(v, model, { pair, sel, animate, socket, changed, arp } = {}) {
  const p = v.packet;
  if (!p) {
    const f = v.flow;
    return `<div class="plain">${esc(f?.text ?? 'Ahoj, Bobe!')}<small>zpráva u ${esc(nodeLabel(v, pair?.sender))}, zatím bez obálek</small></div>`;
  }
  let html;
  if (p.form === 'bits' || p.form === 'wire') {
    const bits = bitString(p.bytes, 24);
    html = `<div class="bits b2bits" data-env="bits"><button type="button" class="lab" data-env="bits" data-tab="ethernet"><span>${esc(rowLabel(model, 1))}</span><em>bity</em></button>
      <div class="bitrow">${[0, 8, 16].map((i) => `<span class="byte">${[...bits.slice(i, i + 8)].map((b) => `<b>${b}</b>`).join('')}</span>`).join('')}<span class="more">…</span></div>
      <div class="cap">${p.form === 'wire' ? 'Na drátě: celý rámec jako bity' : p.at && v.decision?.kind === 'repeat' ? 'Hub opakuje bity na ostatní porty'
    : p.at ? `Bity dorazily do ${esc(nodeLabel(v, p.at))}` : 'Rámec přepsaný na bity (začátek)'}</div></div>`;
  } else {
    const grow = animate && changed?.has('encap') ? 'anim-grow' : animate ? 'anim-fade' : '';
    html = box2(p.pdu, model, v, sel, grow);
  }
  // pruh pod obálkou: odkud linková vrstva vzala cílovou MAC (scénář krok 4, arpHint)
  if (arp && v.flow) {
    const e = v.nodes[v.flow.sender]?.arp_cache?.find((x) => x.ip === v.flow.dst);
    if (e) {
      html += `<p class="arpstrip"><b>ARP tabulka ${esc(nodeLabel(v, v.flow.sender))}:</b> <span class="mono">${ipHtml(e.ip)} → ${macShort(e.mac)}</span>
        <small>(IP → MAC, které si počítač pamatuje)</small></p>`;
    }
  }
  if (socket && v.flow) {
    html += `<p class="socket">socket: <b>${esc(v.flow ? `${ipOf(v, v.flow.sender)}:${v.flow.sport}` : '')}</b> → <b>${esc(`${v.flow.dst}:${v.flow.dport}`)}</b></p>`;
  }
  if (v.removed && pair && v.removed.node === pair.receiver) {
    const n = v.removed.layer;
    const what = v.removed.proto === 'ethernet' ? 'hlavičku i patičku' : 'hlavičku';
    html += `<div class="removed ${animate ? 'anim-leave' : ''}" style="${cssVars(n)}"><b>${esc(rowLabel(model, n))}</b>: ${what} přečetla tato vrstva a odstranila.</div>`;
  }
  if (v.dropped && pair?.receiver === v.dropped.node) {
    html = `<p class="dropmsg"><b>${esc(nodeLabel(v, v.dropped.node))}:</b> cílová MAC ${macHtml(v.dropped.dst)} není moje (${macHtml(v.dropped.mac)}). Síťová karta rámec zahodila.</p>${html}`;
  }
  if (v.delivered && pair?.receiver === v.delivered.node) {
    const app = v.nodes[v.delivered.node].apps.find((a) => a.name === v.delivered.app);
    html += `<p class="same">${esc(nodeLabel(v, v.delivered.node))}: cílový port ${v.delivered.port} → aplikace <b>„${esc(app?.title ?? v.delivered.app)}“</b> dostala <b>„${esc(v.delivered.text)}“</b></p>`;
  }
  return html;
}

const ipOf = (v, id) => v.nodes[id]?.ip ?? '';

// Aplikace PC příjemce (Bob: zprávy 5000, poznámky 6000) se zprávami, které dostaly.
export function appsHtml(v, id) {
  const n = v.nodes[id];
  if (!n?.apps?.length) return '';
  return `<div class="apps">${n.apps.map((a) => {
    const got = v.inbox[id]?.[a.name] ?? [];
    const last = got.at(-1);
    const port = a.port ?? last?.port ?? (v.flow?.sender === id ? v.flow.sport : null);
    return `<span class="app${got.length ? ' got' : ''}${last?.fresh ? ' fresh' : ''}"><b>${esc(a.title ?? a.name)}</b> <small>${port ? `port ${port}` : 'port od OS'}</small>${last ? `<i>„${esc(last.text)}“</i>` : ''}</span>`;
  }).join('')}</div>`;
}

// --- vysvětlivka s předpovědí ---

// Vysvětlivka. Krok tipu (rozhodnutí 31): nadpis „Tip: …“, volby hned pod textem, aby je
// nic neodsunulo; `evalLines` = vyhodnocení tipů z předchozího kroku (HTML, už escapované).
export function explainHtml2(view, model, total, { predict, tips, evalLines = [], termHint, summary } = {}) {
  const s = view.step;
  const out = [`<div class="stepno">Krok ${stepLabel(s)} z ${total}${s.part ? ` (rozbalování ${s.part[0]}/${s.part[1]})` : ''}</div>`];
  out.push(`<h3>${esc(predict ? `Tip: ${predict.q}` : textFor(s.title, model))}</h3>`);
  if (predict) out.push(`<p class="ptitle">${esc(textFor(s.title, model))}</p>`);
  out.push(`<p>${esc(textFor(s.text, model))}</p>`);
  if (predict) {
    const opts = predict.choices ? predict.choices.map((c) => ({ port: c, label: c })) : tipOptions(view, predict);
    out.push(`<div class="predict" role="group" aria-label="${esc(predict.q)}">${predict.help ? `<p class="phelp">${esc(predict.help)}</p>` : ''}${opts.map((o) => `<button type="button" class="btn small${tips?.has(o.port) ? ' on' : ''}"
      data-pick="${esc(o.port)}" aria-pressed="${tips?.has(o.port) ? 'true' : 'false'}">${esc(o.label)}</button>`).join('')}
      <small>${predict.choices ? 'Vyber a dej Vpřed.' : 'Vyber (i víc) a dej Vpřed.'}</small></div>`);
  }
  for (const line of evalLines) out.push(`<p class="evalline">${line}</p>`);
  const note = textFor(s.note, model);
  if (note) out.push(`<p class="note">${esc(note)}</p>`);
  if (termHint) {
    out.push(`<p class="termhint"><button type="button" class="btn small" data-run="${esc(termHint.node)}" data-cmd="${esc(termHint.cmd)}">Spustit za mě</button>
      <code>${esc(termHint.cmd)}</code> <small>v terminálu: ${esc(termHint.label)}</small></p>`);
  }
  if (s.hint) out.push(`<p class="hint">${esc(textFor(s.hint, model))}</p>`);
  if (s.simplifies) out.push(`<p class="simpl"><b>Simulátor zjednodušuje:</b> ${esc(textFor(s.simplifies, model))}</p>`);
  if (summary) out.push(summary);
  return out.join('');
}

// Tabulky shrnutí (krok 10: kdo rámec dostal; krok 17: kdo čte kterou adresu).
export function summaryHtml(kind, v) {
  if (kind === 'hub') {
    const hosts = v.order.filter((id) => isHost(v.nodes[id].type));
    const st = (r, id) => (r.sender === id ? 'zdroj' : r.results[id] === 'received' ? '✓ přijal' : r.results[id] === 'dropped' ? '⊗ zahodil' : '–');
    return `<table class="sumt"><caption>Kdo rámec dostal (hub)</caption><thead><tr><th>Zpráva</th>${hosts.map((h) => `<th>${esc(nodeLabel(v, h))}</th>`).join('')}</tr></thead>
      <tbody>${v.log.map((r) => `<tr><td>„${esc(r.text)}“</td>${hosts.map((h) => `<td>${st(r, h)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  if (kind === 'addresses') {
    return `<table class="sumt"><caption>Kdo čte kterou adresu</caption><thead><tr><th>Adresa</th><th>Příklad</th><th>Čte ji</th></tr></thead><tbody>
      <tr><td><b>MAC</b> (L2)</td><td class="mono">02:00:00:00:00:<b>02</b></td><td>síťová karta, switch</td></tr>
      <tr><td><b>IP</b> (L3)</td><td class="mono">192.168.1.<b>20</b></td><td>síťová vrstva v operačním systému</td></tr>
      <tr><td><b>port</b> (L4)</td><td class="mono"><b>5000</b>, <b>6000</b></td><td>transportní vrstva v OS předá aplikaci</td></tr></tbody></table>
      <table class="sumt"><thead><tr><th>Zařízení</th><th>Čte</th><th>Posílá</th></tr></thead><tbody>
      <tr><td>hub</td><td>nic (L1, bity)</td><td>vždy na všechny ostatní porty</td></tr>
      <tr><td>switch</td><td>MAC adresy (L2)</td><td>jen na port cíle; neznámý cíl a broadcast všem</td></tr></tbody></table>`;
  }
  return '';
}

// --- rentgen (ui.md 11.4, rentgen.md) ---

export const XRAY_TABS = ['ethernet', 'ipv4', 'udp'];
const TAB_LAYER = { ethernet: 2, ipv4: 3, udp: 4 };
const TAB_NAME = { ethernet: 'rámec', ipv4: 'paket', udp: 'datagram' };

// Obálky, které v aktuálním kroku existují (rentgen ukáže jen je).
export function presentTabs(v) {
  const p = v.packet?.pdu;
  if (!p || !v.flowFrame) return [];
  const order = ['ethernet', 'ipv4', 'udp'];
  const present = [];
  for (let x = p; x && typeof x === 'object'; x = x.payload) if (order.includes(x.proto)) present.push(x.proto);
  // na straně příjemce po rozbalení: ukaž celý rámec (rentgen = co přišlo po kabelu)
  if (present[0] !== 'ethernet' && (!v.focus?.node || v.focus.node !== v.flow?.sender)) return order;
  return order.filter((t) => present.includes(t));
}

function fieldNote(f, v, frameH) {
  const ranges = '<details class="more"><summary>Dobře známý, registrovaný, dynamický port?</summary><p>Porty 0–1023 jsou dobře známé (služby jako web), 1024–49151 registrované (aplikace), 49152–65535 dynamické: ty přiděluje operační systém aplikaci, která posílá jako první.</p></details>';
  if (f.id === 'udp.sport') return `<p class="simpl"><b>Simulátor zjednodušuje:</b> Windows volí číslo náhodně z rozsahu 49152–65535.</p>${ranges}`;
  if (f.id === 'udp.dport') {
    const dst = byIp(v, frameH.ipDst), app = v.nodes[dst]?.apps?.find((a) => a.port === frameH.dport);
    return (app ? `<p class="who">${frameH.dport} → aplikace „${esc(app.title ?? app.name)}“ u ${esc(nodeLabel(v, dst))}</p>` : '') + ranges;
  }
  if (f.id === 'eth.src') {
    return '<details class="more"><summary>Proč MAC 02:…?</summary><p>Adresy 02:… jsou vymyšlené pro simulátor (lokálně spravované). Skutečná karta má první tři bajty podle výrobce (OUI).</p></details>';
  }
  if (f.id === 'eth.dst') {
    const who = byMac(v, frameH.ethDst);
    return who ? `<p class="who">Patří: ${esc(nodeLabel(v, who))} (zápis Windows ${esc(frameH.ethDst.replace(/:/g, '-'))})</p>` : '';
  }
  return '';
}

/** Rentgen: záložky, tabulka polí, hexdump, vysvětlení. xs = { tab, sel, tabs } */
export function xrayHtml(v, xs) {
  const frame = v.flowFrame;
  if (!frame || !xs.tabs.length) {
    return '<h3>Rentgen</h3><div class="ph">Obálky zatím nejsou. Rentgen ukáže pole hlaviček, až zpráva dostane obálku (klikni na obálku nebo stiskni R).</div>';
  }
  const ff = frameFields(frame);
  const tab = xs.tabs.includes(xs.tab) ? xs.tab : xs.tabs[0];
  const blk = ff.blocks[tab];
  const sel = blk.fields.find((f) => f.id === xs.sel) ?? null;
  const devReads = v.nodes[v.focus?.node]?.type === 'switch' && tab === 'ethernet';
  const hasFrame = xs.tabs.includes('ethernet');
  const tabs = xs.tabs.map((t) => `<button type="button" class="xtab${t === tab ? ' on' : ''}" data-xtab="${t}" style="${cssVars(TAB_LAYER[t])}"
    aria-pressed="${t === tab}">${badge(TAB_LAYER[t], `L${TAB_LAYER[t]}`)}${TAB_NAME[t]}</button>`).join('');
  // rozhodnutí 33: délka pole v bitech (bitová pole sdílejí bajt, sloupec „B“ by lhal)
  const row = (f) => `<tr class="${f.key ? 'key' : 'dimrow'}${sel?.id === f.id ? ' selected' : ''}${devReads && f.n <= 2 ? ' reads' : ''}"
    data-field="${f.id}" data-tab="${tab}" tabindex="0" aria-selected="${sel?.id === f.id}"><td><i class="fno">${f.n}</i></td><td><b>${esc(f.name)}</b>${sel?.id === f.id ? `<small>${esc(f.ws)}</small>` : ''}</td>
    <td class="num">${f.bits}</td><td class="mono">${esc(f.value)}</td></tr>`;
  const many = blk.fields.length > 6;
  const main = many ? blk.fields.filter((f) => f.key || f.id === sel?.id) : blk.fields;
  const rest = many ? blk.fields.filter((f) => !main.includes(f)) : [];
  const cols = '<colgroup><col class="c-n"><col class="c-name"><col class="c-b"><col class="c-v"></colgroup>';
  const table = `<table class="xt">${cols}<thead><tr><th></th><th>Pole</th><th title="délka pole v bitech">bity</th><th>Hodnota</th></tr></thead><tbody>${main.map(row).join('')}</tbody></table>
    ${rest.length ? `<details class="xrest"><summary>další pole hlavičky (${rest.length})</summary><table class="xt">${cols}<tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}`;
  // hexdump po 8 bajtech; řádky mimo hlavičku zvolené obálky (a výplň u rámce) se sbalí.
  // Dokud rámec nevznikl, ukáže jen existující bajty, posun od začátku vnější obálky.
  const b = ff.bytes;
  const base = hasFrame ? 0 : ff.blocks[xs.tabs[0]].start;
  const endB = hasFrame ? b.length : ff.dataOff + ff.dataLen;
  const fieldAt = (i) => blk.fields.find((f) => f.len > 0 && i >= f.off && i < f.off + f.len && !/\.(data)$/.test(f.id))
    ?? blk.fields.find((f) => f.len > 0 && i >= f.off && i < f.off + f.len);
  const showRow = (lo) => {
    const hi = lo + 8;
    const inHead = lo < blk.end && hi > blk.start;
    const inSel = sel && sel.len && lo < sel.off + sel.len && hi > sel.off;
    const pad = tab === 'ethernet' && ff.padLen && hi > ff.padOff;
    const data = tab === 'udp' && lo < ff.dataOff + ff.dataLen && hi > ff.dataOff;
    return inHead || inSel || pad || data;
  };
  const rows = [];
  let gap = false;
  for (let lo = base; lo < endB; lo += 8) {
    if (!showRow(lo)) {
      if (!gap) rows.push(`<div class="hgap">… ${tab === 'ethernet' ? 'data rámce = paket L3' : 'další bajty'}</div>`);
      gap = true;
      continue;
    }
    gap = false;
    const cells = [];
    for (let i = lo; i < Math.min(endB, lo + 8); i++) {
      const f = fieldAt(i);
      const own = i >= blk.start && (i < blk.end || (tab === 'udp' && i < ff.dataOff + ff.dataLen) || (tab === 'ethernet' && i >= ff.padOff));
      const cls = [`r-${byteRegion(ff, i)}`, sel && i >= sel.off && i < sel.off + sel.len ? 'sel' : '', own ? 'own' : ''].join(' ');
      cells.push(`<span class="${cls}"${f ? ` data-field="${f.id}" data-tab="${tab}"` : ''}>${b[i].toString(16).padStart(2, '0')}</span>`);
    }
    if (hasFrame && tab === 'ethernet' && lo + 8 >= endB) cells.push('<span class="r-fcs" title="FCS: jen naznačené">-- -- -- --</span>');
    rows.push(`<div class="hrow"><span class="off">${(lo - base).toString(16).padStart(4, '0')}</span>${cells.join('')}</div>`);
  }
  const frameH = { ipDst: frame.payload.h.dst, dport: frame.payload.payload.h.dport, ethDst: frame.h.dst };
  const expl = sel
    ? `<p class="fexp"><i class="fno">${sel.n}</i> <b>${esc(sel.name)}:</b> ${esc(sel.explain)}</p>${fieldNote(sel, v, frameH)}`
    : '<p class="fexp muted">Klikni na pole v tabulce, na bajty nebo na buňku adresy v obálce (číslo pole na klávesnici, 12 = 1 a 2 rychle po sobě; Esc zruší výběr).</p>';
  let ctx = '';
  if (tab === 'udp') {
    ctx += '<p class="xnote">Obálka transportní vrstvy se u UDP jmenuje datagram (UDP datagram), u TCP segment.</p>';
  }
  if (tab === 'ethernet') {
    ctx += '<p class="xnote">V rámci je cílová MAC před zdrojovou. Na štítku obálky je pořadí odkud → kam, aby se dobře četlo.</p>';
    if (devReads) ctx += '<p class="xnote"><b>Silná čára vlevo</b> = pole, které čte switch.</p>';
    const d = v.decision;
    if (d?.node && v.nodes[d.node]?.type === 'switch' && (d.learn || d.kind)) {
      const learn = d.learn ? `zdrojová MAC → ${d.op === 'refresh' ? 'záznam obnoven' : 'naučit'} na port ${d.learn.port}` : '';
      const dst = d.kind === 'flood' ? `cílová MAC ${d.dst} v tabulce není → flooding` : d.kind === 'forward' ? `cílová MAC ${d.dst} je na ${d.outPorts[0]} → jen tam` : '';
      ctx += `<p class="xdec">Switch čte jen hlavičku L2: ${esc([learn, dst].filter(Boolean).join('; '))}</p>`;
    }
    if (v.dropped && xs.pairReceiver === v.dropped.node) {
      ctx += `<p class="xdec">Cílová MAC není moje (${esc(v.dropped.mac)}) ani broadcast: síťová karta ${esc(nodeLabel(v, v.dropped.node))} rámec zahodila, IP paket uvnitř nikdo nečte.</p>`;
    }
  }
  const title = { ethernet: 'rámec L2 (Ethernet II)', ipv4: 'paket L3 (IPv4)', udp: 'datagram L4 (UDP)' }[tab];
  const foot = hasFrame
    ? 'Bajty od cílové MAC po výplň jako ve Wiresharku. Preambule před rámcem tu není; FCS je jen naznačené, nepočítá se.'
    : 'Bajty obálek, které už existují; rámec (L2) ještě nevznikl.';
  return `<h3>Rentgen: ${title}</h3><div class="xtabs" role="group" aria-label="Obálky">${tabs}</div>
    ${hasFrame ? `<p class="xsum">${esc(ff.summary)}</p>` : '<p class="xsum">Rámec ještě nevznikl: vidíš jen obálky, které už zpráva má.</p>'}${table}<div class="hex" aria-label="Bajty">${rows.join('')}</div>${expl}${ctx}
    <p class="simpl small">${foot}</p>`;
}

// --- terminál (ui.md 11.5) ---

export function termLinesHtml(entries) {
  return entries.map((e) => {
    if (e.kind === 'cmd') return `<div class="tl"><span class="prompt">${esc(e.prompt)}</span>${esc(e.text)}</div>`;
    // poznámka simulátoru; text, který už začíná „Simulátor…“, se nezdvojuje
    if (e.kind === 'note') return `<div class="tl tnote">${/^Simulátor/.test(e.text) ? '' : 'Simulátor: '}${esc(e.text)}</div>`;
    const text = typeof e.line === 'string' ? e.line : e.line.text;
    const mark = typeof e.line === 'string' ? '' : ` mark-${e.line.mark}`;
    return `<div class="tl${mark}">${esc(text) || '&nbsp;'}</div>`;
  }).join('');
}

// Popisek zařízení v záhlaví terminálu.
export function termTitle(node) {
  return isHost(node.type) ? `Příkazový řádek: ${node.label}` : `Konzole: ${node.label}`;
}

export { osiLayer, rowOf };
