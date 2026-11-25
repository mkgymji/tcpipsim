// Vykreslení úrovně 3 „Směrování“ (docs/ui.md kap. 12): topologie dvou sítí s routerem, pruh média
// s věží switche (L2) a routeru (L3, rozhodnutí 48), obálky s ARP a ICMP (L4 přeskočená, rozh. 47),
// karty „Rámec před a za R1“, tabulky, sondy tracertu, maska, rentgen ARP/IPv4/ICMP.
// Funkce vracejí HTML jako text (testují se v Node), stav si nedrží (VYVOJ.md kap. 6).
import { stepLabel, textFor } from '../core/timeline.js';
import { isHost } from '../devices/types.js';
import { pduFields } from '../wire/fields.js';
import { bitString } from '../wire/encode.js';
import { ipToInt, prefixMask, macWindows } from '../core/addr.js';
import { parsePrefix, routeMatches } from '../proto/ipv4.js';
import { esc, badge, rowLabel } from './render.js';
import { macHtml, ipHtml } from './render2.js';

const cssVars = (n) => `--c:var(--L${n});--t:var(--L${n}t)`;
const label = (v, id) => v.nodes[id]?.label ?? id;
const byMac = (v, mac) => v.order.find((id) => (v.nodes[id].interfaces ?? []).some((i) => i.mac === mac));
const byIp = (v, ip) => v.order.find((id) => (v.nodes[id].interfaces ?? []).some((i) => i.ip === ip));
const ifOfMac = (v, mac) => {
  const id = byMac(v, mac);
  const i = id && v.nodes[id].interfaces.find((x) => x.mac === mac);
  return id ? (v.nodes[id].type === 'router' ? `${label(v, id)} ${i.name}` : label(v, id)) : '';
};
const macShort = (mac) => {
  const i = mac.lastIndexOf(':');
  return `<span class="dim">${esc(mac.slice(0, 3))}…:</span><b>${esc(mac.slice(i + 1))}</b>`;
};
const macTail = (mac) => mac.split(':').slice(-2).join(':');

// ---------------------------------------------------------------- topologie

const PILL = {
  sender: 'odesílatel', incoming: 'rámec přichází', received: 'přijal', dropped: 'zahodil',
  arpq: 'ARP dotaz', arpr: 'ARP odpověď', arpign: 'ARP: není pro mě', fail: 'chyba',
};

function pcCard(v, id, ui) {
  const n = v.nodes[id];
  const pill = v.pills[id];
  const inPair = ui.pair && (ui.pair.sender === id || ui.pair.receiver === id);
  const gwChanged = v.newEntries[id]?.gateway;
  const gw = ui.hideGw && id === 'PC1' ? '' : n.gateway ? `brána ${ipHtml(n.gateway)}` : '<b class="nogw">bez brány</b>';
  const arp = n.arp_cache.length
    ? `<span class="arp3" title="${esc(`ARP tabulka: ${n.arp_cache.map((e) => `${e.ip} → ${e.mac}`).join(', ')}`)}">${n.arp_cache.map((e, i) => `<span class="${v.newEntries[id]?.[e.ip] ? 'new' : ''}">${i ? '' : '<b class="al">ARP</b>'}<span class="dim">…</span>${esc(e.ip.split('.').slice(2).join('.'))} → <span class="dim">…</span>${esc(macTail(e.mac))}</span>`).join('')}</span>`
    : '<span class="arp3 empty">ARP: prázdná</span>';
  return `<div class="pc3 a-${id}${inPair ? ' pair' : ''}${ui.selected === id ? ' sel' : ''}${v.focus?.node === id ? ' act' : ''}">
    <button type="button" class="pcbtn" data-node="${id}" aria-label="${esc(`${n.label}, IP ${n.ip}/${n.prefix}${gw ? `, brána ${n.gateway ?? 'žádná'}` : ''}, MAC ${n.mac}. Klik: terminál`)}">
    <span class="pchead"><svg aria-hidden="true"><use href="#ico-pc"/></svg><span class="nm">${esc(n.label)}</span></span>
    <span class="ip">${ipHtml(n.ip)}</span><span class="mac">MAC <span class="dim">…:</span><b>${esc(n.mac.split(':').at(-1))}</b></span>${gw ? `<span class="gw${gwChanged ? ' new' : ''}">${gw}</span>` : ''}${arp}</button>
    ${pill ? `<span class="pill ${pill}">${PILL[pill]}</span>` : ''}
    ${ui.selected === id ? `<button type="button" class="btn tiny-txt" data-term="${id}">Terminál <kbd>F2</kbd></button>` : ''}</div>`;
}

function switchCard(v, id, ui) {
  const n = v.nodes[id];
  const fresh = v.newEntries[id] ?? {};
  const rows = n.mac_table.map((e) => `<tr class="${fresh[e.mac] ? 'new' : ''}" title="${esc(`${e.mac} (${label(v, byMac(v, e.mac))}) na ${e.port}`)}"><td class="mono"><span class="dim">…</span>${esc(macTail(e.mac))}</td><td>${esc(e.port)}</td></tr>`).join('');
  const d = v.decision?.node === id ? v.decision : null;
  const dec = d ? (d.kind === 'flood' ? `${d.reason === 'broadcast' ? 'broadcast' : 'neznámý cíl'} → ${d.outPorts.join(', ')}` : d.kind === 'forward' ? `→ jen ${d.outPorts[0]}` : 'zahodit') : '';
  return `<div class="sw3${v.focus?.node === id ? ' act' : ''}${ui.selected === id ? ' sel' : ''}">
    <button type="button" class="devhead" data-node="${id}" aria-label="${esc(`${n.label}, switch (L2)`)}"><svg aria-hidden="true"><use href="#ico-switch"/></svg><span><b>${esc(n.label)}</b><small>L2</small></span></button>
    <div class="mact3"><table><caption>MAC tabulka</caption><tbody>${rows || '<tr class="empty"><td colspan="2">prázdná</td></tr>'}</tbody></table></div>
    ${dec ? `<div class="decision">${esc(dec)}</div>` : ''}
    ${ui.selected === id ? `<button type="button" class="btn tiny-txt" data-term="${id}">Konzole</button>` : ''}</div>`;
}

/** Řádky směrovací tabulky; `pick` = { dst, prefix } zvýrazní vybraný řádek a ukáže sloupec Shoda. */
export function routeTableHtml(routes, { pick = null, title = '', compact = false, lrows = true } = {}) {
  const code = { connected: 'C', local: 'L', static: 'S', default: 'S*' };
  const rows = routes.filter((r) => lrows || r.type !== 'local').map((r) => {
    const { len } = parsePrefix(r.prefix);
    const hit = pick && r.prefix === pick.prefix;
    const m = pick ? (routeMatches(r, pick.dst) ? `${len} bitů` : 'ne') : '';
    const via = r.next_hop ? `přes ${r.next_hop}` : r.type === 'local' ? 'sám router' : `přímo ${r.if}`;
    return `<tr class="${hit ? 'hit' : ''}${r.type === 'local' ? ' lrow' : ''}"><td class="c">${code[r.type]}</td><td class="mono">${esc(r.prefix)}</td><td>${esc(compact ? (r.next_hop ? r.next_hop : r.if) : via)}</td>${pick ? `<td class="m">${hit ? `<span class="hittag">${esc(m)}</span>` : esc(m)}</td>` : ''}</tr>`;
  }).join('');
  return `<table class="rt3">${title ? `<caption>${title}</caption>` : ''}<thead><tr><th>Typ</th><th>Síť (cíl)</th><th>Kam</th>${pick ? '<th>Shoda</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
}

function routerCard(v, id, ui) {
  const n = v.nodes[id];
  const r = v.route?.node === id && v.route.cur && v.route.ttlAfter != null ? v.route : null;
  const hop = v.hop?.node === id ? v.hop : null;
  const ifc = (i) => {
    const st = hop?.inIf === i.name ? 'vstup' : r?.outIf === i.name ? 'výstup' : '';
    return `<div class="if3${st ? ` ${st === 'vstup' ? 'in' : 'out'}` : ''}"><b>${esc(i.name)}</b>${st ? `<span class="st">${st}</span>` : ''}<span class="mono">${ipHtml(i.ip)}</span></div>`;
  };
  const fresh = v.newEntries[id] ?? {};
  const arp = n.arp_cache.map((e) => `<tr class="${fresh[e.ip] ? 'new' : ''}"><td class="mono">${ipHtml(e.ip)}</td><td class="mono">${macShort(e.mac)}</td><td>${esc(e.if)}</td></tr>`).join('');
  return `<div class="r3${v.focus?.node === id ? ' act' : ''}${ui.selected === id ? ' sel' : ''}">
    ${v.ignored.includes(id) ? '<span class="pill arpign r3pill">ARP: není pro mě</span>' : ''}
    <div class="r3h">${ifc(n.interfaces[0])}<button type="button" class="devhead r3b" data-node="${id}" aria-label="${esc(`${n.label}, router (L3). Klik: konzole`)}">
      <svg aria-hidden="true"><use href="#ico-router"/></svg><b>${esc(n.label)}</b></button>${ifc(n.interfaces[1])}</div>
    ${routeTableHtml(n.routing_table, { pick: r ? { dst: r.dst, prefix: r.route.prefix } : null, title: `Směrovací tabulka ${esc(n.label)}`, compact: true })}
    <table class="arpt3"><caption>ARP tabulka ${esc(n.label)}${Object.keys(fresh).length ? ' <span class="newtag">nový řádek</span>' : ''}</caption><tbody>${arp || '<tr class="empty"><td>prázdná</td></tr>'}</tbody></table>
    ${ui.selected === id ? `<button type="button" class="btn tiny-txt" data-term="${id}">Konzole <kbd>F2</kbd></button>` : ''}</div>`;
}

const bitsOnL1 = (v) => Boolean(v.packet && (v.packet.form === 'bits' || v.packet.form === 'wire') && v.packet.bytes);

function wire3(v, link, area, leftNode, tip = false) {
  const w = v.wires[link];
  let tag = '';
  if (w) {
    const toRight = w.from === leftNode;
    const p = w.pdu.payload;
    const what = p?.proto === 'arp' ? 'ARP' : 'rámec';
    const ttl = p?.proto === 'ipv4' && !tip ? `<span class="ttl3">TTL ${p.h.ttl}</span>` : '';   // tip 13: TTL nic neprozradí
    tag = `<span class="ftag3 ${toRight ? 'r' : 'l'}${p?.proto === 'arp' ? ' arp' : ''}">${toRight ? '' : '◀ '}${what}${toRight ? ' ▶' : ''}</span>${ttl}`;
  }
  return `<div class="w3 ${area}${w && bitsOnL1(v) ? ' on' : ''}" data-link="${link}"><span class="cable"></span>${tag}</div>`;
}

/** Topologie úrovně 3: síť 1 (Alice, Cyril, SW1), R1 přes hranici sítí, síť 2 (Bob). */
export function topologyHtml3(v, ui) {
  const net = (n, lab, gw) => `<div class="net3 ${n}"><span class="netlab">SÍŤ ${esc(lab)}${gw ? ` <small>brána ${esc(gw)}</small>` : ''}</span></div>`;
  const l1 = Object.keys(v.wires).length && bitsOnL1(v)
    ? '<span class="l1note"><i class="lk" aria-hidden="true"></i>zvýrazněný kabel = pruh „médium“ dole (L1)</span>' : '';
  return `<div class="t3">${net('n1', '192.168.1.0/24', '.1')}${net('n2', '192.168.2.0/24', '.1')}
    ${pcCard(v, 'PC1', ui)}${pcCard(v, 'PC3', ui)}
    ${wire3(v, 'L1', 'wa', 'PC1', ui.tip)}${wire3(v, 'L2', 'wc', 'PC3', ui.tip)}
    <div class="swslot">${switchCard(v, 'SW1', ui)}</div>${wire3(v, 'L3', 'ws', 'SW1', ui.tip)}
    <div class="rslot">${routerCard(v, 'R1', ui)}</div>${wire3(v, 'L4', 'wb', 'R1', ui.tip)}
    ${pcCard(v, 'PC2', ui)}</div>
    <span class="legend">dvojitý obrys = odesílatel a příjemce zprávy</span>${l1}`;
}

// ---------------------------------------------------------------- „U“ s věžemi (rozhodnutí 38, 48)

const DEV = new Set(['hub', 'switch', 'router']);

/** Kde je zpráva: jako lift.js, router je navíc zařízení v pruhu média. */
export function liftAnchor3(v, pair) {
  const f = v.focus;
  if (!f) return { at: 'none', layer: 7 };
  if (f.link) return { at: 'wire', layer: 1, from: f.from, to: f.to };
  const layer = f.layer ?? 7;
  if (f.node === pair?.sender) return { at: 'sender', layer, node: f.node };
  if (f.node === pair?.receiver) return { at: 'receiver', layer, node: f.node };
  if (DEV.has(v.nodes?.[f.node]?.type)) return { at: 'device', layer, node: f.node };
  return { at: 'other', layer, node: f.node };
}

/** Uzly na cestě mezi dvojicí (BFS po linkách): [odesílatel, …zařízení, příjemce]. */
export function pathOf(v, a, b) {
  if (!a || !b) return [a, b].filter(Boolean);
  const nb = (x) => Object.values(v.links).flatMap((l) => (l.a.node === x ? [l.b.node] : l.b.node === x ? [l.a.node] : []));
  const prev = { [a]: null };
  const q = [a];
  while (q.length) {
    const x = q.shift();
    if (x === b) break;
    for (const y of nb(x)) if (!(y in prev) && (y === b || !isHost(v.nodes[y]?.type))) { prev[y] = x; q.push(y); }
  }
  if (!(b in prev)) return [a, b];
  const out = [];
  for (let x = b; x; x = prev[x]) out.unshift(x);
  return out;
}

export function mediumDevices3(v, pair) {
  if (v.step?.allDevices) return v.order.filter((id) => DEV.has(v.nodes[id].type));   // tip 16 (rozhodnutí 51)
  return pathOf(v, pair.sender, pair.receiver).filter((id) => DEV.has(v.nodes[id]?.type));
}

/** Konec oblasti bloku v mřížce (jako lift.laneEnd, router: blok sedí na věži do L3). */
export function laneEnd3(anchor, form, devs) {
  const bits = form === 'bits' || form === 'wire';
  const hasR = devs.includes('router'), hasDev = devs.length > 0;
  if (bits) return hasR ? 5 : hasDev ? 6 : 7;
  // rámec ve switchi stojí nad věží switche, a je-li na cestě router, i nad věží routeru (zůstane vidět L3)
  if (anchor.at === 'device') return anchor.type === 'router' || hasR ? 5 : 6;   // anchor.type doplní volající
  // rozhodnutí 52: u odesílatele a příjemce spodní hrana u aktivní vrstvy (jako rozh. 38)
  return Math.min(7, 9 - Math.max(2, anchor.layer));
}

// Úsek kabelu, kde jsou bity: úsek i vede mezi path[i] a path[i+1]. Kabel mimo cestu dvojice
// (SW1 -> Cyril při pingu Bobovi) se kreslí na úseku za zařízením, odkud vychází.
function segOf(path, anchor) {
  const last = path.length - 2;
  const clamp = (x) => Math.max(0, Math.min(last, x));
  if (anchor.at === 'wire') {
    const a = path.indexOf(anchor.from), b = path.indexOf(anchor.to);
    if (a >= 0 && b >= 0) return { seg: clamp(Math.min(a, b)), dir: b > a ? 'r' : 'l' };
    const p = a >= 0 ? a : b;
    return { seg: clamp(p), dir: a >= 0 ? 'r' : 'l' };
  }
  if (anchor.at === 'sender') return { seg: 0, dir: 'r' };
  if (anchor.at === 'receiver') return { seg: last, dir: 'l' };
  return { seg: clamp(path.indexOf(anchor.node) - 1), dir: 'r' };
}

/** Pruh média s věžemi zařízení na cestě (HTML). */
export function mediumHtml3(v, pair, { model = 'osi', animate = false } = {}) {
  const devs = mediumDevices3(v, pair);
  const path = [pair.sender, ...devs, pair.receiver];
  const anchor = liftAnchor3(v, pair);
  const p = v.packet;
  const bits = p && (p.form === 'bits' || p.form === 'wire') && p.bytes;
  const where = bits ? segOf(path, anchor) : null;
  const nSeg = devs.length + 1;
  const hop = v.hop && devs.includes(v.hop.node) ? v.hop : null;
  const cells = [];
  for (let s = 0; s < nSeg; s++) {
    let inner = '<span class="cable" aria-hidden="true"></span>';
    if (where?.seg === s) {
      const travel = animate && p.form === 'wire' ? ` anim-travel${where.dir === 'l' ? '-l' : ''}` : '';
      inner += `<span class="ribbon r3${travel}" data-dir="${where.dir}">${where.dir === 'l' ? '<i aria-hidden="true">◀</i>' : ''}<span class="lab">L1</span><span class="bv">${bitString(p.bytes, 6)}…</span>${where.dir === 'r' ? '<i aria-hidden="true">▶</i>' : ''}</span>`;
    } else if (!bits && s === 0 && nSeg === 1) inner += '<span class="mcap">médium (kabel)</span>';
    // u routeru: starý rámec (zahozen) vlevo, nový rámec vpravo (rozhodnutí 48)
    const left = devs[s], right = devs[s - 1];
    const atR = anchor.node === hop?.node;
    if (hop && left === hop.node && ((atR && anchor.layer === 3) || (hop.out && atR))) inner += '<span class="fr3 old">starý rámec<small>zahozen</small></span>';
    if (hop && right === hop.node && hop.out && (atR || (anchor.at === 'wire' && anchor.from === hop.node))) inner += '<span class="fr3 new">nový rámec</span>';
    cells.push(`<div class="mseg${where?.seg === s ? ' on' : ''}" style="grid-column:${2 * s + 1}">${inner}</div>`);
  }
  devs.forEach((id, k) => {
    const n = v.nodes[id];
    const top = n.type === 'router' ? 3 : n.type === 'switch' ? 2 : 1;
    const act = anchor.at === 'device' && anchor.node === id ? anchor.layer : null;
    const names = { 3: 'Síťová', 2: 'Linková', 1: 'Fyzická' };
    let t = '';
    for (let L = top; L >= 1; L--) t += `<span class="tcell${act === L ? ' active' : ''}" style="${cssVars(L)}"><b>L${L}</b> ${names[L]}</span>`;
    const arrows = n.type === 'router' ? `<i class="up" aria-hidden="true">▲</i><i class="down" aria-hidden="true">▼</i><span class="leg l">${esc(n.interfaces[0].name)}</span><span class="leg r">${esc(n.interfaces[1].name)}</span>` : '';
    // rozhodnutí 48: věž routeru sahá do L3 (L4–L7 router pro tranzitní paket nečte)
    cells.push(`<div class="tower3 ${n.type}${act ? ' act' : ''}" style="grid-column:${2 * k + 2}" aria-label="${esc(`${n.label}: vrstvy L1 až L${top}`)}"><span class="tname">${esc(n.label)}</span>${t}${arrows}</div>`);
  });
  const rows = devs.some((id) => v.nodes[id].type === 'router') ? 3 : devs.length ? 2 : 1;
  return `<div class="m3 rows${rows}${bits ? ' on' : ''}" style="--nseg:${nSeg}">${cells.join('')}</div>`;
}

// ---------------------------------------------------------------- obálky

function cell(kind, who, valueHtml, field, tab, sel) {
  return `<button type="button" class="acell${sel === field ? ' selected' : ''}" data-field="${field}" data-tab="${tab}"
    aria-label="${esc(`${kind}${who ? ` (${who})` : ''}`)}"><span class="cap"><span>${esc(kind)}${who ? ` (${esc(who)})` : ''}</span></span><span class="val">${valueHtml}</span></button>`;
}

function arpBlock(pdu, v) {
  const h = pdu.h;
  const txt = h.op === 1 ? `ARP dotaz: kdo má ${h.tpa}? Ptá se ${h.spa}` : `ARP odpověď: ${h.spa} je na ${h.sha}`;
  return `<button type="button" class="arpb" data-field="arp.op" data-tab="arp" aria-label="${esc(txt)}"><b>${esc(txt)}</b><small>bez IP paketu: ARP jede přímo v rámci (EtherType 0x0806)</small></button>`;
}

const ICMP_NAME = { 0: 'Echo Reply (typ 0)', 8: 'Echo Request (typ 8)', 11: 'Time Exceeded (typ 11)', 3: 'Destination Unreachable (typ 3)' };

function icmpBlock(pdu, compact = false) {
  const h = pdu.h;
  if (compact) return `<button type="button" class="icmpb" data-field="icmp.type" data-tab="icmp"><b>ICMP ${esc(ICMP_NAME[h.type] ?? h.type)}</b></button>`;
  const extra = h.orig ? `uvnitř kopie hlavičky původního paketu ${h.orig.h.src} → ${h.orig.h.dst}` : 'jede přímo v IP paketu (protokol 1)';
  return `<button type="button" class="icmpb" data-field="icmp.type" data-tab="icmp"><b>ICMP ${esc(ICMP_NAME[h.type] ?? h.type)}</b><small>${esc(extra)}</small></button>`;
}

function box3(pdu, model, v, sel, depth = 0, extra = '', compact = false) {
  if (!pdu) return '';
  if (pdu.proto === 'data') {
    const zero = pdu.payload.charCodeAt(0) === 0;
    return `<div class="data d2" data-env="data"><span class="lab"><span>${model === 'osi' ? 'L7' : 'L5-7'} data</span></span><span class="msg small">${zero ? 'sonda tracert: 64 B nul' : 'ping: 32 B dat'}</span></div>`;
  }
  if (pdu.proto === 'arp') return arpBlock(pdu, v);
  if (pdu.proto === 'icmp') return compact ? icmpBlock(pdu, true) : `<div class="noport"><i>${badge(4, 'L4')}</i>L4: žádný segment, ICMP nemá porty</div>${icmpBlock(pdu)}`;
  const n = pdu.layer;
  const name = rowLabel(model, n);
  const h = pdu.h;
  let addr, inner = '', chips = '';
  if (pdu.proto === 'ethernet') {
    const bc = h.dst === 'ff:ff:ff:ff:ff:ff';
    addr = cell('zdroj MAC', ifOfMac(v, h.src), macHtml(h.src), 'eth.src', 'ethernet', sel) + '<span class="arr">→</span>'
      + cell(bc ? 'cíl MAC (všem)' : 'cíl MAC', bc ? '' : ifOfMac(v, h.dst), macHtml(h.dst), 'eth.dst', 'ethernet', sel);
    inner = box3(pdu.payload, model, v, sel, depth + 1);
  } else {
    addr = cell('zdroj IP', label(v, byIp(v, h.src)), ipHtml(h.src), 'ip.src', 'ipv4', sel) + '<span class="arr">→</span>'
      + cell('cíl IP', label(v, byIp(v, h.dst)), ipHtml(h.dst), 'ip.dst', 'ipv4', sel);
    chips = `<div class="chips"><button type="button" class="chip" data-field="ip.ttl" data-tab="ipv4">${extra || `TTL ${h.ttl}`}</button><button type="button" class="chip" data-field="ip.proto" data-tab="ipv4">protokol ${h.protocol}</button></div>`;
    inner = box3(pdu.payload, model, v, sel, depth + 1, '', compact);
  }
  const what = pdu.proto === 'ethernet' ? 'rámec' : 'paket';
  const trail = pdu.proto === 'ethernet' ? '<span class="trail">konec rámce</span>' : '';
  return `<div class="box b2 b3${depth ? ' inner' : ''}" data-env="${pdu.proto}" style="${cssVars(n)}">
    <button type="button" class="lab" data-env="${pdu.proto}" data-tab="${pdu.proto}" aria-label="${esc(`Obálka ${name}: rentgen`)}"><span>${esc(name)}</span><em>${what}</em></button>
    <div class="addr">${addr}</div>${chips}${inner}${trail}</div>`;
}

const MSG_NAME = { 0: 'Echo Reply', 8: 'Echo Request', 11: 'Time Exceeded', 3: 'Destination Unreachable' };

/** Skutečná zpráva v aktuálním místě (rozhodnutí 50): { name, from, to } podle hlaviček, ne podle dvojice. */
export function currentMessage(v) {
  let x = v.packet?.pdu;
  if (!x) return null;
  if (x.proto === 'ethernet') x = x.payload;
  if (x?.proto === 'arp') {
    const h = x.h;
    return h.op === 1 ? { name: 'ARP dotaz', from: label(v, byIp(v, h.spa)), to: 'všem' }
      : { name: 'ARP odpověď', from: label(v, byIp(v, h.spa)), to: label(v, byIp(v, h.tpa)) };
  }
  const ip = x?.proto === 'ipv4' ? x : v.pkt;
  const icmp = x?.proto === 'icmp' ? x : ip?.payload?.proto === 'icmp' ? ip.payload : null;
  if (ip && icmp) return { name: MSG_NAME[icmp.h.type] ?? 'ICMP', from: label(v, byIp(v, ip.h.src)), to: label(v, byIp(v, ip.h.dst)) };
  if (v.flow) return { name: v.flow.app === 'tracert' ? 'Echo Request (sonda)' : 'Echo Request', from: label(v, v.flow.sender), to: label(v, byIp(v, v.flow.dst)) };
  return null;
}

/** Nadpis prostředního sloupce: skutečná zpráva a kde je. */
export function nestCaption3(v) {
  const p = v.packet;
  const m = currentMessage(v);
  if (!p || !m) return { left: v.flow ? `${v.flow.app} ${v.flow.dst}` : 'Zpráva', right: '' };
  const outer = p.pdu?.proto;
  const what = p.form === 'bits' || p.form === 'wire' ? 'bity na kabelu' : outer === 'ethernet' ? 'rámec' : outer === 'ipv4' ? 'paket' : '';
  const dev = v.nodes[v.focus?.node];
  const where = DEV.has(dev?.type) ? `${what} v ${dev.label}` : what;
  const right = dev?.type === 'switch' ? `${dev.label} čte MAC (L2)` : dev?.type === 'router' ? `${dev.label} čte L1–L3` : '';
  return { left: `${m.name} · ${m.from} → ${m.to}${where ? ` (${where})` : ''}`, right };
}

/** Prostřední blok: obálky u aktivní vrstvy, v routeru paket s TTL a starý / nový rámec. */
export function nestHtml3(v, model, { pair, sel, tip = false } = {}) {
  const p = v.packet;
  if (!p) {
    const f = v.flow;
    const txt = f ? `${label(v, f.sender)}: ${f.app} ${f.dst}` : v.config ? `${label(v, v.config.node)}: nová konfigurace` : 'Zatím se nic neposílá';
    return `<div class="float"><div class="plain small">${esc(txt)}<small>${v.arpFail ? `ARP dotaz na ${esc(v.arpFail.ip)}: nikdo neodpověděl` : v.dropped?.kind === 'no_route' ? 'z Alice nevyšel žádný rámec' : 'stav sítě'}</small></div></div>`;
  }
  const anchor = liftAnchor3(v, pair);
  let html;
  if (p.form === 'bits' || p.form === 'wire') {
    html = `<p class="bitnote">${p.form === 'wire' ? 'Po kabelu jede celý rámec jako bity' : 'Rámec přepsaný na bity'} <span aria-hidden="true">▼</span><small>bajt po bajtu: rentgen vpravo</small></p>`;
  } else if (anchor.at === 'device' && v.nodes[anchor.node].type === 'router' && p.pdu?.proto === 'ipv4') {
    const r = v.route?.node === anchor.node && v.route.ttlAfter != null ? v.route : null;
    const ttl = r && !tip ? `<s>TTL ${r.ttlBefore}</s> → TTL ${r.ttlAfter} <span class="m1">−1</span>` : `TTL ${p.pdu.h.ttl}`;
    // v routeru je nad věží jen místo nad L3 (rozhodnutí 48): kompaktní obálka, bez pruhu „bez portů“
    const dropTtl = v.dropped?.node === anchor.node && v.dropped.kind === 'ttl';
    html = box3(p.pdu, model, v, sel, 0, dropTtl ? `TTL ${v.dropped.ttl} → 0 <span class="m1">zahodit</span>` : ttl, true).replace('<div class="box', '<div class="inrouter box');
  } else if (anchor.at === 'device' && p.pdu?.proto === 'ethernet') {
    const dev = v.nodes[anchor.node];
    const inner = p.pdu.payload;
    const isNew = v.hop?.out === p.pdu;
    const pk = inner?.proto === 'ipv4' ? `paket ${inner.h.src} → ${inner.h.dst}, TTL ${inner.h.ttl}` : '';
    html = `<div class="box b2 b3 bdev" data-env="ethernet" style="${cssVars(2)}"><button type="button" class="lab" data-env="ethernet" data-tab="ethernet"><span>${esc(rowLabel(model, 2))}</span><em>${isNew ? 'nový rámec' : 'rámec'} v ${esc(dev.label)}</em></button>
      <div class="addr">${cell('zdroj MAC', ifOfMac(v, p.pdu.h.src), macHtml(p.pdu.h.src), 'eth.src', 'ethernet', sel)}<span class="arr">→</span>${cell('cíl MAC', ifOfMac(v, p.pdu.h.dst), macHtml(p.pdu.h.dst), 'eth.dst', 'ethernet', sel)}</div>
      <div class="stub">${inner?.proto === 'arp' ? `uvnitř ARP zpráva: ${dev.type === 'switch' ? `${esc(dev.label)} ji neotevírá` : 'router ji přečte'}`
    : dev.type === 'switch' ? `uvnitř paket (L3): ${esc(dev.label)} ho neotevírá`
      : isNew ? `uvnitř stejný ${esc(pk)}` : `uvnitř ${esc(pk)}: router rámec rozbalí`}</div></div>`;
  } else {
    html = box3(p.pdu, model, v, sel);
  }
  if (v.dropped?.kind === 'no_route' && v.dropped.node === pair.sender && anchor.at === 'sender') {
    html = `<p class="dropmsg">Z ${esc(label(v, pair.sender))} nevyšel na síť žádný rámec.</p>${html}`;
  }
  let note = '';
  if (v.dropped && (v.dropped.node === pair.receiver || v.dropped.node === pair.sender) && v.dropped.kind === 'nic') {
    note = `<p class="dropmsg">${esc(label(v, v.dropped.node))}: cílová MAC není moje, karta rámec zahodila.</p>`;
  }
  if (v.delivered && v.delivered.node === pair.sender && anchor.at === 'sender') {
    const d = v.delivered;
    note += `<p class="same">${esc(label(v, d.node))}: ${d.icmpType === 11 ? `Time Exceeded od ${esc(d.from)}` : `odpověď od ${esc(d.from)}, TTL ${d.ttl}`}</p>`;
  }
  return `<div class="float">${html}${note ? `<div class="hang">${note}</div>` : ''}</div>`;
}

// ---------------------------------------------------------------- vysvětlivka

/** Vysvětlivka s tipem (rozhodnutí 31), nápovědami, opravou brány a skokem na části A–D. */
export function explainHtml3(v, model, total, { predict, tips, evalLines = [], termHint, parts = [], curPart = null, tipLocked = false } = {}) {
  const s = v.step;
  const out = [];
  out.push(`<div class="stephead"><span class="stepno">Krok ${stepLabel(s)} z ${total}</span><span class="parts" role="group" aria-label="Skok na začátek části"><span class="plab" title="Úroveň má čtyři části: A ping do jiné sítě, B soused ve stejné síti, C TTL a tracert, D najdi chybu. Klik = skok na začátek části.">Části:</span>${parts.map((p) => `<button type="button" class="pbtn${p.id === curPart ? ' on' : ''}" data-part="${p.k}" aria-pressed="${p.id === curPart}" title="${esc(p.title)}">${p.id}</button>`).join('')}</span></div>`);
  out.push(`<h3>${esc(predict ? `Ptám se tebe: ${predict.q}` : textFor(s.title, model))}</h3>`);
  if (predict) out.push(`<p class="ptitle">${esc(textFor(s.title, model))}</p>`);
  out.push(`<p>${esc(textFor(s.text, model))}</p>`);
  if (predict) {
    out.push(`<div class="predict" role="group" aria-label="${esc(predict.q)}">${predict.choices.map((c) => `<button type="button" class="btn small${tips?.has(c) ? ' on' : ''}"
      data-pick="${esc(c)}" aria-pressed="${tips?.has(c) ? 'true' : 'false'}"${tipLocked ? ' disabled' : ''}>${esc(c)}</button>`).join('')}
      <small>${predict.multi ? 'Vyber (i víc) a dej Vpřed.' : 'Vyber a dej Vpřed.'}</small></div>`);
  }
  if (s.fix) out.push('<p class="fixline"><button type="button" class="btn small main" data-fix>Oprav bránu</button><small>nastaví výchozí bránu 192.168.1.1</small></p>');
  for (const line of evalLines) out.push(`<p class="evalline">${line}</p>`);
  if (termHint) {
    out.push(`<p class="termhint"><button type="button" class="btn small" data-run="${esc(termHint.node)}" data-cmd="${esc(termHint.cmd)}">Spustit za mě</button>
      <code>${esc(termHint.cmd)}</code> <small>(${esc(termHint.label)})</small></p>`);
  }
  if (s.simplifies) out.push(`<p class="simpl"><b>Simulátor zjednodušuje:</b> ${esc(textFor(s.simplifies, model))}</p>`);
  const note = textFor(s.note, model);
  if (note) out.push(`<p class="note">${esc(note)}</p>`);
  if (Array.isArray(s.hint)) {
    out.push(`<div class="hints">${s.hint.map((h, i) => `<details><summary>Nápověda ${i + 1}</summary><p class="hint">${esc(h)}</p></details>`).join('')}</div>`);
  } else if (s.hint) out.push(`<p class="hint">${esc(textFor(s.hint, model))}</p>`);
  return out.join('');
}

// ---------------------------------------------------------------- karty v pravém panelu

const bits32 = (ip) => ipToInt(ip).toString(2).padStart(32, '0');

/** Krok 2: porovnání síťové části podle masky (bity). */
export function maskCard(v) {
  const a = v.nodes.PC1, prefix = a.prefix;
  const row = (name, ip) => {
    const b = bits32(ip);
    const oct = [0, 8, 16, 24].map((o) => b.slice(o, o + 8));
    const html = oct.map((o, k) => `<span class="oct">${[...o].map((c, j) => `<i class="${k * 8 + j < prefix ? 'net' : 'host'}">${c}</i>`).join('')}</span>`).join('');
    const netA = (ipToInt(ip) & prefixMask(prefix)) >>> 0;
    const net = [24, 16, 8, 0].map((s) => (netA >>> s) & 255).join('.');
    return `<tr><th>${esc(name)}<small>${esc(ip)}</small>${name.startsWith('maska') ? '' : `<small>síť ${net}</small>`}</th><td class="bits">${html}</td></tr>`;
  };
  const same = (ip) => ((ipToInt(ip) ^ ipToInt(a.ip)) & prefixMask(prefix)) === 0;
  return `<div class="card3"><h3>Maska: je cíl v mé síti?</h3>
    <table class="mask3"><thead><tr><th></th><th>adresa v bitech</th></tr></thead><tbody>
    ${row('Alice', a.ip)}${row('maska /24', '255.255.255.0')}${row('Cyril', v.nodes.PC3.ip)}${row('Bob', v.nodes.PC2.ip)}</tbody></table>
    <p class="m3res">Podbarvené = síťová část (prvních 24 bitů). Cyril: síť ${same(v.nodes.PC3.ip) ? '<b>stejná</b> → přímo' : 'jiná'}. Bob: síť ${same(v.nodes.PC2.ip) ? 'stejná' : '<b>jiná</b> → přes bránu'}.</p></div>`;
}

/** Rámec před a za routerem (krok 12, rozhodnutí 48): MAC jiné, IP stejné, TTL −1. */
export function compareCard(v) {
  const hop = v.hop;
  if (!hop?.in) return '';
  const a = hop.in, b = hop.out;
  if (!b) {
    return `<div class="card3"><h3>Rámec, který dorazil k ${esc(label(v, hop.node))}</h3>
      <p class="mono">${macHtml(a.h.src)} → ${macHtml(a.h.dst)}</p><p class="mono">IP ${esc(a.payload.h.src)} → ${esc(a.payload.h.dst)}, TTL ${a.payload.h.ttl}</p></div>`;
  }
  // rozhodnutí 52: karta se vejde celá i při 720 px; hlavní věta nahoře, jedno pole = jeden řádek
  const row = (name, x, y, mac = false) => {
    const same = x === y;
    const val = (z) => (mac ? macShort(String(z)) : esc(String(z)));
    const tag = `<span class="${same ? 'same3' : 'diff3'}">${same ? '✓ stejná' : name === 'TTL' ? '−1' : 'jiná'}</span>`;
    return `<div class="cr ${same ? 'same' : 'chg'}"><span class="cl">${esc(name)}</span><span class="mono">${val(x)}</span><span class="mono${same ? '' : ' chgv'}">${val(y)}</span>${tag}</div>`;
  };
  return `<div class="card3 cmp3"><h3>Rámec před a za ${esc(label(v, hop.node))} <small>(vlevo před, vpravo za)</small></h3>
    <p class="m3res key"><b>MAC se změnila, IP zůstala.</b> V IP hlavičce se mění jen TTL (a s ním kontrolní součet).</p>
    <div class="cgrid">
    <div class="cg" style="${cssVars(2)}"><div class="gh">${badge(2, 'L2')} rámec: platí jen na jednom kabelu</div>
    ${row('cíl MAC', a.h.dst, b.h.dst, true)}${row('zdroj MAC', a.h.src, b.h.src, true)}</div>
    <div class="cg" style="${cssVars(3)}"><div class="gh">${badge(3, 'L3')} paket: platí na celé cestě</div>
    ${row('zdroj IP', a.payload.h.src, b.payload.h.src)}${row('cíl IP', a.payload.h.dst, b.payload.h.dst)}
    ${row('TTL', a.payload.h.ttl, b.payload.h.ttl)}</div></div></div>`;
}

/** Tabulky: směrovací tabulka Alice (vybraný řádek, shoda) a ARP tabulky všech. */
export function tablesCard(v) {
  const a = v.nodes.PC1;
  const r = v.routeOf?.PC1 ?? null;
  const arp = (id) => {
    const n = v.nodes[id];
    return `<tr><th>${esc(n.label)}</th><td class="mono">${n.arp_cache.length ? n.arp_cache.map((e) => `<span class="nw">${esc(e.ip)} → ${esc(macWindows(e.mac))}</span>`).join('<br>') : '<span class="dim">prázdná</span>'}</td></tr>`;
  };
  return `<div class="card3"><h3>Tabulky po kroku</h3>
    ${routeTableHtml(a.routing_table, { pick: r ? { dst: r.dst, prefix: r.route.prefix } : null, title: `Směrovací tabulka Alice${r ? ` (cíl ${esc(r.dst)})` : ''}` })}
    ${r ? `<p class="m3res">Pasuje-li víc řádků, vyhraje delší prefix: ${esc(r.route.prefix)}.</p>` : ''}
    <table class="arps3"><caption>ARP tabulky (IP → MAC)</caption><tbody>${['PC1', 'PC3', 'R1', 'PC2'].map(arp).join('')}</tbody></table></div>`;
}

/** Sondy tracertu: jeden řádek = jedna sonda (kreslí se postupně). */
export function probesCard(v) {
  const run = Object.values(v.apps).filter((a) => a.app === 'tracert').at(-1);
  if (!run) return '';
  // student 5: jeden řádek = jeden skok (TTL), sondy jako 3 značky, zpráva krátce
  const hops = [];
  for (const e of run.events) {
    let h = hops.find((x) => x.ttl === e.ttl);
    if (!h) { h = { ttl: e.ttl, res: [] }; hops.push(h); }
    h.res.push(e.result);
  }
  if (!run.done && v.probe && !hops.some((h) => h.ttl === v.probe.ttl)) hops.push({ ttl: v.probe.ttl, res: [] });
  const rows = hops.map((h, i) => {
    const r = h.res.find((x) => x.kind !== 'timeout');
    const who = r?.from ? `${r.from} <small>${esc(label(v, byIp(v, r.from)))}</small>` : '<span class="dim">zatím nic</span>';
    const msg = !r ? '' : r.kind === 'time_exceeded' ? 'Time Exceeded' : r.kind === 'echo_reply' ? 'Echo Reply' : esc(r.kind);
    const probes = [0, 1, 2].map((k) => (h.res[k] ? (h.res[k].kind === 'timeout' ? '*' : '✓') : '·')).join(' ');
    return `<tr class="${i === hops.length - 1 ? 'cur' : ''}"><td><span class="ttlb">${h.ttl}</span></td><td class="mono">${who}</td><td>${msg}</td><td class="pr">${probes}</td></tr>`;
  }).join('');
  return `<div class="card3"><h3>Sondy tracert ${esc(run.dst)}</h3><table class="probes3"><thead><tr><th>TTL</th><th>Odpověděl</th><th>Zpráva</th><th title="3 sondy na skok">sondy</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="xnote">Jeden řádek = jeden skok. Windows posílá na každý skok 3 sondy (✓ = odpověď).</p></div>`;
}

/** Shrnutí úrovně (krok 25). */
export function summaryCard3() {
  return `<div class="card3"><h3>Co se mění a co ne</h3><table class="sumt"><thead><tr><th>Mění se na každém skoku</th><th>Zůstává</th></tr></thead><tbody>
    <tr><td>zdrojová a cílová MAC (nový rámec L2)</td><td>zdrojová a cílová IP adresa</td></tr>
    <tr><td>TTL −1 a kontrolní součet IP hlavičky</td><td>data (ICMP zpráva)</td></tr></tbody></table>
    <table class="sumt"><thead><tr><th>Kdo</th><th>Rozhoduje podle</th></tr></thead><tbody>
    <tr><td>hostitel (Alice)</td><td>maska: stejná síť → přímo, jinak → brána</td></tr>
    <tr><td>router</td><td>směrovací tabulka → rozhraní a next hop → ARP → nový rámec</td></tr></tbody></table></div>`;
}

// ---------------------------------------------------------------- rentgen

export const XRAY3_TABS = ['ethernet', 'arp', 'ipv4', 'icmp'];
const TAB_LAYER = { ethernet: 2, arp: 2, ipv4: 3, icmp: 3 };

/** PDU, které rentgen ukazuje: obálka v aktuálním místě, jinak poslední rámec. */
export function xrayTarget(v) {
  const p = v.packet?.pdu;
  if (p && (p.proto === 'ethernet' || p.proto === 'ipv4')) return p;
  return v.frame ?? v.pkt ?? null;
}

export function xrayHtml3(v, xs) {
  const pdu = xrayTarget(v);
  if (!pdu) return '<h3>Rentgen</h3><div class="ph">Zatím tu není žádný rámec ani paket. Rentgen ukáže pole hlaviček, až zpráva vznikne.</div>';
  const ff = pduFields(pdu);
  const tabs = ff.blocks.map((b) => b.id);
  const tab = tabs.includes(xs.tab) ? xs.tab : tabs.includes('ipv4') && xs.tab === 'icmp' ? 'ipv4' : tabs[0];
  const blk = ff.blocks.find((b) => b.id === tab);
  const sel = blk.fields.find((f) => f.id === xs.sel) ?? null;
  const tabsHtml = ff.blocks.map((b) => `<button type="button" class="xtab${b.id === tab ? ' on' : ''}" data-xtab="${b.id}" style="${cssVars(TAB_LAYER[b.id])}" aria-pressed="${b.id === tab}">${badge(TAB_LAYER[b.id], `L${TAB_LAYER[b.id]}`)}${esc(b.tab)}</button>`).join('');
  const row = (f) => `<tr class="${f.key ? 'key' : 'dimrow'}${sel?.id === f.id ? ' selected' : ''}${f.id === 'icmp.noport' ? ' xnoport' : ''}" data-field="${f.id}" data-tab="${tab}" tabindex="0" aria-selected="${sel?.id === f.id}">
    <td><i class="fno">${f.n || '–'}</i></td><td><b>${esc(f.name)}</b>${sel?.id === f.id ? `<small>${esc(f.ws)}</small>` : ''}</td><td class="num">${f.bits || ''}</td><td class="mono">${esc(f.value)}</td></tr>`;
  const many = blk.fields.length > 6;
  const main = many ? blk.fields.filter((f) => f.key || f.id === sel?.id || f.id === 'icmp.noport') : blk.fields;
  const rest = many ? blk.fields.filter((f) => !main.includes(f)) : [];
  const cols = '<colgroup><col class="c-n"><col class="c-name"><col class="c-b"><col class="c-v"></colgroup>';
  const table = `<table class="xt">${cols}<thead><tr><th></th><th>Pole</th><th title="délka pole v bitech">bity</th><th>Hodnota</th></tr></thead><tbody>${main.map(row).join('')}</tbody></table>
    ${rest.length ? `<details class="xrest"><summary>další pole hlavičky (${rest.length})</summary><table class="xt">${cols}<tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}`;
  // hexdump: řádky po 8 bajtech, jen ty, které zasahují do zvolené obálky
  const b = ff.bytes;
  const region = (i) => {
    const bl = ff.blocks.find((x) => i >= x.start && i < x.end);
    if (i >= ff.padOff) return 'pad';
    return bl ? (TAB_LAYER[bl.id] === 2 ? 'l2' : 'l3') : 'l3';
  };
  const rows = [];
  let gap = false;
  for (let lo = 0; lo < b.length; lo += 8) {
    const hi = lo + 8;
    const show = (lo < blk.end && hi > blk.start) || (sel && sel.len && lo < sel.off + sel.len && hi > sel.off);
    if (!show) { if (!gap) rows.push('<div class="hgap">…</div>'); gap = true; continue; }
    gap = false;
    const cells = [];
    for (let i = lo; i < Math.min(b.length, hi); i++) {
      const f = blk.fields.find((x) => x.len > 0 && i >= x.off && i < x.off + x.len);
      const own = i >= blk.start && i < blk.end;
      cells.push(`<span class="r-${region(i)}${sel && i >= sel.off && i < sel.off + sel.len ? ' sel' : ''}${own ? ' own' : ''}"${f ? ` data-field="${f.id}" data-tab="${tab}"` : ''}>${b[i].toString(16).padStart(2, '0')}</span>`);
    }
    rows.push(`<div class="hrow"><span class="off">${lo.toString(16).padStart(4, '0')}</span>${cells.join('')}</div>`);
  }
  const expl = sel ? `<p class="fexp"><b>${esc(sel.name)}:</b> ${esc(sel.explain)}</p>`
    : '<p class="fexp muted">Klikni na pole v tabulce, na bajty nebo na buňku adresy v obálce (Esc zruší výběr, R další záložka).</p>';
  const ctx = tab === 'ethernet' ? '<p class="xnote">Cílová MAC je v rámci před zdrojovou; štítek obálky píše odkud → kam.</p>'
    : tab === 'arp' ? '<p class="xnote">ARP je přímo v rámci (EtherType 0x0806): žádný IP paket, žádné TTL, přes router neprojde.</p>'
      : tab === 'icmp' ? '<p class="xnote">ICMP nemá porty: jede přímo v IP paketu (Protocol 1).</p>' : '';
  const titles = { ethernet: 'rámec L2 (Ethernet II)', arp: 'ARP zpráva v rámci', ipv4: 'paket L3 (IPv4)', icmp: 'ICMP v paketu' };
  return `<h3>Rentgen: ${titles[tab]}</h3><div class="xtabs" role="group" aria-label="Obálky">${tabsHtml}</div>
    <p class="xsum">${esc(pduFields(pdu).summary)}${pdu.proto === 'ipv4' ? ' (rámec ještě nevznikl nebo už je rozbalený)' : ''}</p>${table}<div class="hex" aria-label="Bajty">${rows.join('')}</div>${expl}${ctx}`;
}
