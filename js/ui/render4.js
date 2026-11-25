// Vykreslení úrovně 4 „Transport a aplikace“ (docs/ui.md kap. 14): topologie se SW2 a SRV1, karta
// „Spojení“ (stavy obou stran), naslouchající služby, časová osa segmentů, srovnání UDP × TCP, L4 a) b),
// demultiplex na SRV1. Obálky a rentgen TCP/UDP/DNS/HTTP jsou v render3.js (box3, xrayHtml3).
// Funkce vracejí HTML jako text (testují se v Node), stav si nedrží.
import { esc, badge } from './render.js';
import { ipHtml } from './render2.js';
import { wire3, switchCard } from './render3.js';
import { STATE_WIN } from '../proto/tcp.js';

const label = (v, id) => v.nodes[id]?.label ?? id;
const byIp = (v, ip) => v.order.find((id) => (v.nodes[id].interfaces ?? []).some((i) => i.ip === ip));
const cssVars = (n) => `--c:var(--L${n});--t:var(--L${n}t)`;
const PILL = { sender: 'odesílatel', incoming: 'přichází', received: 'přijal', dropped: 'zahodil', fail: 'chyba' };

function host4(v, id, ui) {
  const n = v.nodes[id];
  const inPair = ui.pair && (ui.pair.sender === id || ui.pair.receiver === id);
  const pill = v.pills[id];
  const live = (n.tcp_connections ?? []).filter((c) => c.state !== 'LISTEN');
  const listen = (n.tcp_connections ?? []).filter((c) => c.state === 'LISTEN').map((c) => `TCP ${c.local.split(':')[1]}`);
  const udp = (n.apps ?? []).filter((a) => a.proto === 'udp' && a.port != null).map((a) => `UDP ${a.port}`);
  const svc = n.type === 'server' ? `<span class="svc4" title="DNS na UDP 53, web na TCP 80">${[...udp.filter((x) => x === 'UDP 53').map(() => 'DNS 53'), ...listen.filter((x) => x === 'TCP 80').map(() => 'web 80')].map(esc).join(' · ')}</span>` : '';
  const conns = live.length ? `<span class="cn4${v.newEntries[id] ? ' new' : ''}" data-target="${id}.conns">spojení: ${live.length}</span>` : '';
  const dim = id === 'PC3' ? ' dim4' : '';
  return `<div class="pc3 h4 a4-${id}${inPair ? ' pair' : ''}${ui.selected === id ? ' sel' : ''}${v.focus?.node === id ? ' act' : ''}${dim}">
    <button type="button" class="pcbtn" data-node="${id}" aria-label="${esc(`${n.label}, IP ${n.ip}. Klik: terminál`)}">
    <span class="pchead"><svg aria-hidden="true"><use href="#ico-pc"/></svg><span class="nm">${esc(n.label)}</span></span>
    <span class="ip">${ipHtml(n.ip)}</span>${svc}${conns}</button>
    ${pill ? `<span class="pill ${pill}">${PILL[pill] ?? ''}</span>` : ''}
    ${ui.selected === id ? `<button type="button" class="btn tiny-txt" data-term="${id}">Terminál <kbd>F2</kbd></button>` : ''}</div>`;
}

function router4(v, id, ui) {
  const n = v.nodes[id];
  const ifc = (i) => `<div class="if3"><b>${esc(i.name)}</b><span class="mono">${ipHtml(i.ip)}</span></div>`;
  return `<div class="r3 r4${v.focus?.node === id ? ' act' : ''}${ui.selected === id ? ' sel' : ''}">
    <div class="r3h">${ifc(n.interfaces[0])}<button type="button" class="devhead r3b" data-node="${id}" aria-label="${esc(`${n.label}, router (L3). Klik: konzole`)}">
      <svg aria-hidden="true"><use href="#ico-router"/></svg><b>${esc(n.label)}</b></button>${ifc(n.interfaces[1])}</div>
    <small class="r4note">o spojeních nic neví</small>
    ${ui.selected === id ? `<button type="button" class="btn tiny-txt" data-term="${id}">Konzole <kbd>F2</kbd></button>` : ''}</div>`;
}

/** Topologie úrovně 4: síť 1 (Alice, Cyril, SW1), R1, síť 2 (SW2, Bob, SRV1). */
export function topologyHtml4(v, ui) {
  const net = (n, lab) => `<div class="net3 ${n}"><span class="netlab">SÍŤ ${esc(lab)} <small>brána .1</small></span></div>`;
  const sw = (id) => switchCard(v, id, ui).replace('<div class="mact3"', '<div class="mact3" hidden');
  return `<div class="t3 t4">${net('n1', '192.168.1.0/24')}${net('n2', '192.168.2.0/24')}
    ${host4(v, 'PC1', ui)}${host4(v, 'PC3', ui)}
    ${wire3(v, 'L1', 'wa', 'PC1', ui.tip)}${wire3(v, 'L2', 'wc', 'PC3', ui.tip)}
    <div class="swslot">${sw('SW1')}</div>${wire3(v, 'L3', 'ws', 'SW1', ui.tip)}
    <div class="rslot">${router4(v, 'R1', ui)}</div>${wire3(v, 'L4', 'wb', 'R1', ui.tip)}
    <div class="swslot2">${sw('SW2')}</div>${wire3(v, 'L5', 'wd', 'SW2', ui.tip)}${wire3(v, 'L6', 'we', 'SW2', ui.tip)}
    ${host4(v, 'PC2', ui)}${host4(v, 'SRV1', ui)}</div>
    <span class="legend">dvojitý obrys = odesílatel a příjemce segmentu</span>`;
}

const st = (s) => STATE_WIN[s] ?? s;

/** Karta „Spojení“: tabulka spojení Alice a SRV1 (a Boba, má-li nějaké), stavy obou stran. */
export function connsCard(v) {
  const ids = ['PC1', 'SRV1', 'PC2'].filter((id) => id !== 'PC2' || (v.nodes[id].tcp_connections ?? []).some((c) => c.state !== 'LISTEN'));
  const ce = v.connEvent;
  const rows = (id) => {
    const t = (v.nodes[id].tcp_connections ?? []).filter((c) => c.state !== 'LISTEN');
    if (!t.length) return `<tr><td colspan="3" class="dim">žádné spojení</td></tr>`;
    return t.map((c) => {
      const fresh = ce && ce.node === id && ce.local === c.local && ce.remote === c.remote;
      return `<tr class="${fresh ? 'new' : ''}${c.state === 'LISTEN' ? ' lrow' : ''}"><td class="mono" title="${esc(c.local)}">:${esc(c.local.split(':')[1])}</td><td class="mono">${c.state === 'LISTEN' ? '<span class="dim">čeká na klienty</span>' : esc(c.remote)}</td><td><b>${esc(st(c.state))}</b></td></tr>`;
    }).join('');
  };
  const chg = ce ? `<p class="m3res key">${esc(label(v, ce.node))}: ${esc(st(ce.from))} → <b>${esc(st(ce.to))}</b></p>` : '';
  return `<div class="card3 conn4" data-target="conns"><h3>Spojení <small>(záznam v paměti obou stran, router o něm neví)</small></h3>${chg}
    ${ids.map((id) => {
    const lis = (v.nodes[id].tcp_connections ?? []).filter((c) => c.state === 'LISTEN').map((c) => c.local.split(':')[1]);
    return `<table class="ct4"><caption>${esc(label(v, id))} <span class="mono">${esc(v.nodes[id].ip)}</span>${lis.length ? ` <small>· naslouchá (LISTENING) na TCP ${esc(lis.join(', '))}</small>` : ''}</caption><colgroup><col class="cp"><col><col class="cs"></colgroup><thead><tr><th>Místní port</th><th>Vzdálený socket</th><th>Stav</th></tr></thead><tbody>${rows(id)}</tbody></table>`;
  }).join('')}</div>`;
}

/** Naslouchající služby SRV1 (krok 1, tip 23). */
export function listenCard(v) {
  const n = v.nodes.SRV1;
  const rows = [...(n.apps ?? []).filter((a) => a.proto === 'udp' && a.port != null).map((a) => ['UDP', a.port, a.name]),
    ...(n.tcp_connections ?? []).filter((c) => c.state === 'LISTEN').map((c) => ['TCP', Number(c.local.split(':')[1]), (n.apps ?? []).find((a) => a.proto === 'tcp' && a.port === Number(c.local.split(':')[1]))?.name ?? '?'])];
  return `<div class="card3" data-target="listen"><h3>Na čem SRV1 naslouchá</h3><table class="ct4"><thead><tr><th>Protokol</th><th>Port</th><th>Aplikace</th></tr></thead>
    <tbody>${rows.map(([p, port, app]) => `<tr><td>${p}</td><td class="mono"><b>${port}</b></td><td>${esc(app)}</td></tr>`).join('')}</tbody></table>
    <p class="xnote">Port, který tu není, nikdo neposlouchá. IP adresa je jedna, aplikace rozliší až port.</p></div>`;
}

/** Časová osa segmentů (krok 18, 30): jeden řádek = jeden segment z koncového uzlu. */
export function timelineCard(v) {
  const rows = v.segs.slice(-16).map((s) => {
    const who = `${esc(label(v, s.from))} → ${esc(label(v, byIp(v, s.dst)))}`;
    let what, cls;
    if (s.proto === 'udp') { what = s.dns ?? 'UDP'; cls = 'udp'; }
    else if (s.len) { what = `${s.flags} + ${s.http?.startsWith('GET') ? 'GET' : s.http?.startsWith('HTTP/') ? s.http.split(' ').slice(1).join(' ') : 'data'}`; cls = 'data'; }
    else { what = s.flags; cls = /RST/.test(s.flags) ? 'rst' : 'ctl'; }
    const nums = s.proto === 'tcp' ? `seq ${s.rel.seq} ack ${s.rel.ack}${s.len ? ` · ${s.len} B` : ''}` : `${s.sport} → ${s.dport}`;
    return `<tr class="sg-${cls}${s.retransmit ? ' retx' : ''}"><td>${who}</td><td><b>${esc(what)}</b>${s.retransmit ? ' <span class="chip retx">znovu</span>' : ''}</td><td class="mono">${esc(nums)}</td></tr>`;
  }).join('');
  return `<div class="card3" data-target="timeline"><h3>Segmenty na cestě <small>(poslední ${Math.min(16, v.segs.length)})</small></h3>
    <p class="xnote"><span class="sgk sg-udp">UDP (DNS)</span> <span class="sgk sg-ctl">TCP řízení spojení</span> <span class="sgk sg-data">TCP s daty (HTTP)</span></p>
    <table class="ct4 tl4"><colgroup><col style="width:34%"><col style="width:36%"><col></colgroup><thead><tr><th>Kdo → komu</th><th>Co</th><th>Čísla</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Srovnání UDP × TCP (krok 25). */
export function compareCard4() {
  const r = (a, b, c) => `<tr><th>${a}</th><td>${b}</td><td>${c}</td></tr>`;
  return `<div class="card3" data-target="compare"><h3>UDP × TCP</h3><table class="sumt ct4"><thead><tr><th></th><th>UDP</th><th>TCP</th></tr></thead><tbody>
    ${r('hlavička', '8 B: porty, délka, součet', '20 B a víc: porty, seq, ack, příznaky, okno, součet')}
    ${r('spojení', 'ne (nespojovaný)', 'ano: handshake, FIN')}
    ${r('potvrzení', 'ne', 'ano (ack)')}
    ${r('ztráta', 'nic, případně aplikace', 'pošle znovu po vypršení času')}
    ${r('pořadí', 'nehlídá', 'složí ve správném pořadí')}
    ${r('příklady', 'DNS dotaz, hlasový hovor, online hra', 'web, e-mail, stažení souboru')}</tbody></table>
    <p class="xnote">Porty a doručení správné aplikaci umí oba.</p></div>`;
}

/** Co dělá transportní vrstva: L4 a) a b) podle Michalovy prezentace (rozhodnutí 49). */
export function l4Card() {
  return `<div class="card3" data-target="l4" style="${cssVars(4)}"><h3>${badge(4, 'L4')} Transportní vrstva</h3>
    <p><b>a) spolehlivé doručení dat</b> (TCP; UDP ne): příjem se potvrzuje, ztracená data se pošlou znovu, velká data rozdělí na části a u příjemce je složí ve správném pořadí. <small>Kroky 7–17, 27–30.</small></p>
    <p><b>b) doručení dat správné aplikaci</b> na cílovém uzlu (podle portu): multiplex / demultiplex. <small>Kroky 3, 4, 20, 22.</small></p>
    <p class="xnote">Kdo se stará: operační systém.</p></div>`;
}

/** Demultiplex na SRV1 (krok 22): cílový port vybere aplikaci, zdrojový socket spojení. */
export function demuxCard(v) {
  const s = v.seg;
  const h = s?.proto === 'tcp' ? s.h : null;
  const t = (v.nodes.SRV1.tcp_connections ?? []).filter((c) => c.state !== 'LISTEN');
  const toSrv = h && h.dport === 80;
  const key = h ? (toSrv ? `${v.pkt?.h.src ?? ''}:${h.sport}` : null) : null;
  return `<div class="card3" data-target="demux"><h3>Demultiplex na SRV1</h3>
    <p class="m3res">${h ? (toSrv ? `Cílový port <b>${h.dport}</b> → aplikace <b>web</b>. Zdrojový socket <b>${esc(key)}</b> → spojení:` : `Odpověď jde po stejném spojení na port <b>${h.dport}</b> u Alice.`) : ''}</p>
    <table class="ct4"><thead><tr><th>Místní</th><th>Vzdálený</th><th>Stav</th></tr></thead><tbody>${t.map((c) => `<tr class="${key && c.remote === key ? 'hit' : ''}"><td class="mono">${esc(c.local)}</td><td class="mono">${esc(c.remote)}</td><td>${esc(st(c.state))}</td></tr>`).join('')}</tbody></table></div>`;
}

export const CARDS4 = { conns: connsCard, listen: listenCard, timeline: timelineCard, compare: compareCard4, l4: l4Card, demux: demuxCard };
