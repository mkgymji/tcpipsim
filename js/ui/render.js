// Vykreslení pohledu úrovně 1 (výtah, topologie, vysvětlivka). Jen čte pohled z timeline,
// nic si nepamatuje (VYVOJ.md kap. 6). Animace = CSS třídy na nově vzniklých prvcích.
import { MODELS, osiLayer, rowOf } from '../core/layers.js';
import { stepLabel, textFor } from '../core/timeline.js';
import { bitString } from '../wire/encode.js';

const SHAPES = {
  7: '<polygon class="s" points="10,3 30,3 38,20 30,37 10,37 2,20"/>',
  6: '<polygon class="s" points="20,2 38,15 31,37 9,37 2,15"/>',
  5: '<polygon class="s" points="20,1 39,20 20,39 1,20"/>',
  4: '<polygon class="s" points="20,2 39,37 1,37"/>',
  3: '<circle class="s" cx="20" cy="20" r="18"/>',
  2: '<rect class="s" x="3" y="3" width="34" height="34" rx="2"/>',
  1: '<rect class="s" x="1" y="9" width="38" height="22" rx="2"/>',
};
const TEXT_Y = { 7: 25, 6: 27, 5: 25, 4: 34, 3: 25, 2: 25, 1: 25 };

// Co je obálka protokolu (vrstva ISO/OSI a věta, kterou ji panel Detail vysvětlí).
const PROTO_LAYER = { udp: 4, ipv4: 3, ethernet: 2 };
const PROTO_INNER = { udp: 'Data s ní tvoří segment.', ipv4: 'Segment s ní tvoří paket.',
  ethernet: 'Paket s nimi tvoří rámec.' };

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssVars = (n) => `--c:var(--L${n});--t:var(--L${n}t)`;

export function badge(n, text) {
  const sm = text.length > 2 ? ' class="sm"' : '';
  return `<svg class="b" viewBox="0 0 40 40" aria-hidden="true">${SHAPES[n]}<text x="20" y="${TEXT_Y[n]}"${sm}>${text}</text></svg>`;
}

// Řádek vrstvy pro daný model (jméno, PDU, odznak). OSI = jedna vrstva, TCP/IP = sloučené.
export function rowLabel(modelId, n) {
  const row = rowOf(modelId, n);
  return modelId === 'osi' ? `L${n} ${row.name}` : `${row.badge} ${row.name}`;
}

function rowStatus(layers, members) {
  const st = members.map((n) => layers[n]);
  if (st.includes('dropped')) return 'dropped';     // úroveň 2: karta rámec zahodila
  if (st.includes('active')) return 'active';
  if (st.includes('done')) return 'done';
  return 'wait';
}

// Sloupec vrstev uzlu. Mřížka má vždy 7 stop (L7 nahoře); sloučené vrstvy TCP/IP zaberou víc stop.
// `pass` = vrstvy ISO/OSI, kterými zpráva v tomto kroku jen prošla (L7 -> L6 -> L5): krátce
// se postupně zvýrazní (ui.md kap. 3). V TCP/IP jsou uvnitř jednoho řádku, tam se nekreslí.
// `pdu4` = jiný název PDU transportní vrstvy (úroveň 2: „segment / datagram“, rozhodnutí 32).
export function renderStack(el, nodeView, modelId, pass = [], { pdu4 = null } = {}) {
  const rows = MODELS[modelId].rows.map((r) => (pdu4 && r.members.length === 1 && r.members[0] === 4 ? { ...r, pdu: pdu4 } : r));
  el.innerHTML = rows.map((r) => {
    const order = r.members.length === 1 ? pass.indexOf(r.members[0]) : -1;
    const passEl = order >= 0
      ? `<span class="pass anim-pass" style="animation-delay:calc(${order * 300}ms * var(--k))" aria-hidden="true"></span>` : '';
    const top = 8 - Math.max(...r.members);
    const status = rowStatus(nodeView.layers, r.members);
    const merged = r.members.length > 1;
    const stripe = merged
      ? `<span class="stripe" aria-hidden="true">${r.members.map((n) => `<i style="--s:var(--L${n})"></i>`).join('')}</span>` : '';
    const stLabel = { wait: 'čeká', done: 'hotovo', active: 'právě tady', dropped: 'zahodil' }[status];
    const long = pdu4 && r.pdu === pdu4 ? ' pdu-long' : '';
    return `<button type="button" class="row ${status}${merged ? ' merged' : ''}${long}" data-layer="${r.id}"
      style="${cssVars(r.color)};grid-row:${top} / span ${r.members.length}"
      aria-label="${esc(`${r.badge} ${r.name}, ${r.pdu}, ${stLabel}`)}">
      ${passEl}${stripe}${status === 'dropped' ? '<span class="xmark" aria-hidden="true">⊗ zahodil</span>' : ''}${badge(r.color, r.badge)}<span class="nm"><span class="l1"><span>${esc(r.name)}</span>
      <span class="pdu">${esc(r.pdu)}</span></span><small>${esc(r.whoShort)}</small></span></button>`;
  }).join('');
}

// Štítek obálky = jediné tlačítko obálky (vnořená tlačítka nejsou přístupná, recenzent bod 2).
function labButton(env, text, pdu, aria) {
  return `<button type="button" class="lab" data-env="${env}" aria-label="${esc(aria)}">
    <span>${esc(text)}</span><em>${esc(pdu)}</em></button>`;
}

// Obálky zvenku dovnitř; `outerClass` = animační třída nově přidané vnější obálky.
function boxHtml(pdu, modelId, outerClass = '') {
  if (pdu.proto === 'data') {
    const lab = modelId === 'osi' ? 'L7 Aplikační' : 'L5-7 Aplikační';
    return `<div class="data ${outerClass}" data-env="data">
      ${labButton('data', lab, 'data', `Data, ${lab}: co to je`)}
      <span class="msg">${esc(pdu.payload)}<small>obsah zprávy</small></span></div>`;
  }
  const n = pdu.layer;
  const inner = boxHtml(pdu.payload, modelId);
  const trail = pdu.proto === 'ethernet' ? '<span class="trail">konec rámce</span>' : '';
  const name = rowLabel(modelId, n), pduName = osiLayer(n).pdu;
  return `<div class="box ${outerClass}" data-env="${pdu.proto}" style="${cssVars(n)}">
    ${labButton(pdu.proto, name, pduName, `Obálka ${name}, ${pduName}: co to je`)}
    ${inner}${trail}</div>`;
}

function bitsHtml(bytes, caption, modelId) {
  const bits = bitString(bytes, 24);
  const cells = [];
  for (let i = 0; i < bits.length; i += 8) {
    cells.push(`<span class="byte">${[...bits.slice(i, i + 8)].map((b) => `<b>${b}</b>`).join('')}</span>`);
  }
  const name = rowLabel(modelId, 1);
  return `<div class="bits" data-env="bits">${labButton('bits', name, 'bity', `Bity, ${name}: co to je`)}
    <div class="bitrow" aria-label="prvních 24 bitů rámce: ${bits}">${cells.join('')}<span class="more">…</span></div>
    <div class="cap">${esc(caption)}</div></div>`;
}

function nodeName(scn, id) {
  return scn.topology.nodes.find((n) => n.id === id)?.label ?? id;
}

function caption(view, modelId, scn) {
  const p = view.packet;
  if (!p) return 'Zpráva';
  if (p.form === 'message') return `${nodeName(scn, view.sender)}: zatím jen text zprávy`;
  if (p.form === 'wire') return 'Na drátě: celý rámec jako bity';
  const f = view.focus;
  const who = f?.node ? nodeName(scn, f.node) : '';
  if (p.form === 'bits') return `${who}: bity (${rowLabel(modelId, 1)})`;
  const outer = p.pdu.layer;
  const pdu = osiLayer(outer).pdu;
  if (view.ended) return `${who || nodeName(scn, view.receiver)}: zpráva doručena`;
  return `${who}: ${pdu === 'data' ? 'data' : `zpráva v obálkách, nyní ${pdu}`} (${modelId === 'osi' ? `L${outer}` : rowOf(modelId, outer).badge})`;
}

// Středový panel se zprávou.
export function renderNest(el, capEl, view, modelId, scn, animate) {
  const p = view.packet;
  const kinds = animate ? view.changes.map((r) => r.kind) : [];
  capEl.textContent = caption(view, modelId, scn);
  let html = '';
  if (p.form === 'message') {
    html = `<div class="plain">${esc(p.text)}<small>text zprávy, zatím bez obálek</small></div>`;
  } else if (p.form === 'bits' || p.form === 'wire') {
    const ghost = p.form === 'bits' && kinds.includes('phy.tx')
      ? `<div class="ghost-frame anim-ghost" aria-hidden="true">${boxHtml(p.pdu, modelId)}</div>` : '';
    const cap = p.form === 'wire' ? 'Obálky i zpráva jedou jako 0 a 1.' : 'Rámec přepsaný na bity (začátek).';
    const cls = kinds.includes('phy.tx') ? 'anim-fade' : '';
    html = `<div class="bitwrap ${cls}">${bitsHtml(p.bytes, cap, modelId)}</div>${ghost}`;
  } else {
    let cls = '';
    if (kinds.includes('encap')) cls = 'anim-grow';
    else if (kinds.includes('app.send') || kinds.includes('phy.rx') || kinds.includes('app.recv')) cls = 'anim-fade';
    html = boxHtml(p.pdu, modelId, cls);
    if (view.delivered !== null) {
      const same = view.delivered === view.message;
      html += `<p class="same">${esc(nodeName(scn, view.sender))} poslala: <b>„${esc(view.message)}“</b> · ${esc(nodeName(scn, view.receiver))} dostal: <b>„${esc(view.delivered)}“</b>
        · ${same ? 'zpráva je stejná' : 'zprávy se liší'}</p>`;
    }
    if (view.removed) {
      const n = view.removed.layer;
      const what = view.removed.proto === 'ethernet' ? 'hlavičku i patičku' : 'hlavičku';
      html += `<div class="removed ${animate ? 'anim-leave' : ''}" style="${cssVars(n)}">
        <b>${esc(rowLabel(modelId, n))}</b>: ${what} přečetla tato vrstva a odstranila.</div>`;
    }
  }
  el.innerHTML = html;
}

export function renderTopology(els, view, scn, animate) {
  const dev = (el, id, role) => {
    const n = scn.topology.nodes.find((x) => x.id === id);
    const active = view.focus?.node === id;
    el.classList.toggle('act', active);
    el.innerHTML = `<svg aria-hidden="true"><use href="#ico-pc"/></svg>${esc(n.label)}<small>${esc(n.short)} · ${role}</small>`;
  };
  dev(els.sender, view.sender, 'odesílatel');
  dev(els.receiver, view.receiver, 'příjemce');
  const onWire = view.packet?.form === 'wire';
  els.wire.classList.toggle('act', onWire);
  els.wireBits.innerHTML = onWire
    ? `<span class="ribbon ${animate ? 'anim-travel' : ''}">${bitString(view.packet.bytes, 16)}…</span>` : '';
}

export function stepTitle(step, modelId) {
  return textFor(step.title, modelId);
}

export function explainHtml(view, modelId, total) {
  const s = view.step;
  const parts = [`<div class="stepno">Krok ${stepLabel(s)} z ${total}${s.part ? ` (sundávání ${s.part[0]}/${s.part[1]})` : ''}</div>`,
    `<h3>${esc(stepTitle(s, modelId))}</h3>`, `<p>${esc(textFor(s.text, modelId))}</p>`];
  const note = textFor(s.note, modelId);
  if (note) parts.push(`<p class="note">${esc(note)}</p>`);
  if (s.hint) parts.push(`<p class="hint">${esc(textFor(s.hint, modelId))}</p>`);
  if (s.simplifies) parts.push(`<p class="simpl"><b>Simulátor zjednodušuje:</b> ${esc(textFor(s.simplifies, modelId))}</p>`);
  return parts.join('');
}

export function renderExplain(el, view, modelId, total) {
  el.innerHTML = explainHtml(view, modelId, total);
}

// Tabulka TCP/IP | ISO/OSI pro krok 10.
export function mappingTable() {
  const rows = MODELS.tcpip.rows.map((r) => `<tr><td>${esc(r.name)} <small>(${esc(r.pdu)})</small></td><td>${r.members
    .map((n) => `L${n} ${esc(osiLayer(n).name)}`).join('<br>')}</td></tr>`).join('');
  return `<table><thead><tr><th>TCP/IP</th><th>ISO/OSI</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Panel Detail: co dělá vrstva. Id řádku z jiného modelu (nebo neznámé) -> prázdný text.
export function layerInfo(modelId, layerId) {
  const r = MODELS[modelId]?.rows.find((x) => x.id === layerId);
  if (!r) return '';
  const members = r.members.length > 1 ? `<p class="who">Odpovídá vrstvám ISO/OSI: ${r.members.map((n) => `L${n}`).join(', ')}</p>` : '';
  const title = r.name.startsWith('Vrstva') ? r.name.toLowerCase() : `${r.name.toLowerCase()} vrstva`;
  return `<h3>Co dělá ${esc(r.badge)}, ${esc(title)}</h3>
    <p>${esc(r.role)}</p><p class="who">Kdo se stará: <b>${esc(r.who)}</b></p>
    <p class="who">Jak se tu jmenují data: <b>${esc(r.pdu)}</b></p>${members}`;
}

// Panel Detail: co je obálka (nebo data, bity). Název vrstvy podle režimu přepínače.
export function envInfo(modelId, proto) {
  if (proto === 'data') {
    return '<h3>Data</h3><p>Obsah zprávy od aplikace. Tady data obálku nemají; obálky přidávají až nižší vrstvy.</p>';
  }
  if (proto === 'bits') {
    return `<h3>Bity</h3><p>Fyzická vrstva přepsala celý rámec, obálky i zprávu, na řadu 0 a 1. Ukazujeme jen začátek.</p>`;
  }
  const n = PROTO_LAYER[proto];
  if (!n) return '';
  const row = rowOf(modelId, n);
  const what = proto === 'ethernet' ? 'Hlavička a patička' : 'Hlavička';
  const trailer = proto === 'ethernet'
    ? '<p>Patička (konec rámce) nese kontrolní číslo: příjemce si ho přepočítá a pozná, jestli se rámec cestou nepoškodil.</p>' : '';
  return `<h3>Obálka ${esc(rowLabel(modelId, n))}</h3>
    <p>${what} ${esc(row.gen)}. ${esc(PROTO_INNER[proto])}</p>${trailer}
    <p class="who">Co v obálce je (adresy a další údaje), uvidíš v úrovni 2.</p>`;
}

export function wireInfo(view) {
  return view.packet?.form === 'wire'
    ? '<h3>Kabel</h3><p>Po kabelu jede celý rámec jako bity. Kabel nerozlišuje obálky ani zprávu.</p>'
    : '<h3>Kabel</h3><p>Teď po kabelu nic nejede. Bity uvidíš v kroku 6.</p>';
}

// Obsah panelu Detail (čistá funkce kvůli testům). `info` = null | {layer} | {env} | 'wire'.
// Vrací { html, empty }; při empty ukáže UI výzvu „klikni na…“.
export function infoHtml(modelId, info, view, { mapOpen = true } = {}) {
  let html = '';
  if (info?.layer) html = layerInfo(modelId, info.layer);
  else if (info?.env) html = envInfo(modelId, info.env);
  else if (info === 'wire') html = wireInfo(view);
  if (view.step.showMapping) {
    html += `<details${mapOpen ? ' open' : ''} data-map><summary>Tabulka: TCP/IP a ISO/OSI</summary>${mappingTable()}</details>
      <button type="button" class="btn small" data-open-questions>Kontrolní otázky</button>`;
  }
  return { html, empty: !html };
}
