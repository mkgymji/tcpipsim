// Vykreslení pohledu úrovně 1 (výtah, topologie, vysvětlivka). Jen čte pohled z timeline,
// nic si nepamatuje (VYVOJ.md kap. 6). Animace = CSS třídy na nově vzniklých prvcích.
import { MODELS, osiLayer, rowOf } from '../core/layers.js';
import { stepLabel } from '../core/timeline.js';
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

const PROTO_INFO = {
  udp: 'hlavička transportní vrstvy',
  ipv4: 'hlavička síťové vrstvy',
  ethernet: 'hlavička a patička (konec rámce) linkové vrstvy',
};

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
  if (st.includes('active')) return 'active';
  if (st.includes('done')) return 'done';
  return 'wait';
}

// Sloupec vrstev uzlu. Mřížka má vždy 7 stop (L7 nahoře); sloučené vrstvy TCP/IP zaberou víc stop.
export function renderStack(el, nodeView, modelId) {
  const rows = MODELS[modelId].rows;
  el.innerHTML = rows.map((r) => {
    const top = 8 - Math.max(...r.members);
    const status = rowStatus(nodeView.layers, r.members);
    const merged = r.members.length > 1;
    const stripe = merged
      ? `<span class="stripe" aria-hidden="true">${r.members.map((n) => `<i style="--s:var(--L${n})"></i>`).join('')}</span>` : '';
    const stLabel = { wait: 'čeká', done: 'hotovo', active: 'právě tady' }[status];
    return `<button type="button" class="row ${status}${merged ? ' merged' : ''}" data-layer="${r.id}"
      style="${cssVars(r.color)};grid-row:${top} / span ${r.members.length}"
      aria-label="${esc(`${r.badge} ${r.name}, ${r.pdu}, ${stLabel}`)}">
      ${stripe}${badge(r.color, r.badge)}<span class="nm"><span class="l1"><span>${esc(r.name)}</span>
      <span class="pdu">${esc(r.pdu)}</span></span><small>${esc(r.whoShort)}</small></span></button>`;
  }).join('');
}

// Obálky zvenku dovnitř; `anim` = { outer: 'anim-grow' } pro nově přidanou vnější obálku.
function boxHtml(pdu, modelId, outerClass = '') {
  if (pdu.proto === 'data') {
    const lab = modelId === 'osi' ? 'L7 Aplikační' : 'L5-7 Aplikační';
    return `<button type="button" class="data ${outerClass}" data-env="data">
      <span class="lab"><span>${lab}</span><em>data</em></span>
      <span class="msg">${esc(pdu.payload)}<small>obsah zprávy</small></span></button>`;
  }
  const n = pdu.layer;
  const inner = boxHtml(pdu.payload, modelId);
  const trail = pdu.proto === 'ethernet' ? '<span class="trail">konec rámce</span>' : '';
  return `<div role="button" tabindex="0" class="box ${outerClass}" data-env="${pdu.proto}" style="${cssVars(n)}">
    <span class="lab"><span>${esc(rowLabel(modelId, n))}</span><em>${esc(osiLayer(n).pdu)}</em></span>
    ${inner}${trail}</div>`;
}

function bitsHtml(bytes, caption, modelId) {
  const bits = bitString(bytes, 24);
  const cells = [];
  for (let i = 0; i < bits.length; i += 8) {
    cells.push(`<span class="byte">${[...bits.slice(i, i + 8)].map((b) => `<b>${b}</b>`).join('')}</span>`);
  }
  return `<div class="bits" data-env="bits"><span class="lab"><span>${esc(rowLabel(modelId, 1))}</span><em>bity</em></span>
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
  if (p.form === 'wire') return 'Na drátě: jen bity';
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
    const cap = p.form === 'wire' ? 'Kabel nese jen 0 a 1, žádné obálky.' : 'Rámec přepsaný na bity (začátek).';
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

export function renderExplain(el, view, modelId, total) {
  const s = view.step;
  const parts = [`<div class="stepno">Krok ${stepLabel(s)} z ${total}${s.part ? ` (sundávání ${s.part[0]}/${s.part[1]})` : ''}</div>`,
    `<h3>${esc(s.title)}</h3>`, `<p>${esc(s.text)}</p>`];
  const note = s.note?.[modelId];
  if (note) parts.push(`<p class="note">${esc(note)}</p>`);
  if (s.hint) parts.push(`<p class="hint">${esc(s.hint)}</p>`);
  if (s.simplifies) parts.push(`<p class="simpl"><b>Simulátor zjednodušuje:</b> ${esc(s.simplifies)}</p>`);
  el.innerHTML = parts.join('');
}

// Tabulka TCP/IP | ISO/OSI pro krok 10.
export function mappingTable() {
  const rows = MODELS.tcpip.rows.map((r) => `<tr><td>${esc(r.name)}<br><small>${esc(r.pdu)}</small></td><td>${r.members
    .map((n) => `L${n} ${esc(osiLayer(n).name)}`).join('<br>')}</td></tr>`).join('');
  return `<table><thead><tr><th>TCP/IP (PDU)</th><th>ISO/OSI</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function layerInfo(modelId, layerId) {
  const r = MODELS[modelId].rows.find((x) => x.id === layerId);
  const members = r.members.length > 1 ? `<p class="who">Odpovídá vrstvám ISO/OSI: ${r.members.map((n) => `L${n}`).join(', ')}</p>` : '';
  return `<h3>Co dělá ${esc(r.badge)} ${esc(r.name.startsWith('Vrstva') ? r.name.toLowerCase() : `${r.name} vrstva`)}</h3>
    <p>${esc(r.role)}</p><p class="who">Kdo se stará: <b>${esc(r.who)}</b></p>
    <p class="who">PDU: <b>${esc(r.pdu)}</b></p>${members}`;
}

export function envInfo(modelId, proto) {
  if (proto === 'data') {
    return `<h3>Data</h3><p>Obsah zprávy od aplikace. Data obálku nemají; obálky přidávají až nižší vrstvy.</p>`;
  }
  if (proto === 'bits') {
    return `<h3>Bity</h3><p>Fyzická vrstva přepsala celý rámec na řadu 0 a 1. Ukazujeme jen začátek.</p>`;
  }
  const n = { udp: 4, ipv4: 3, ethernet: 2 }[proto];
  return `<h3>Obálka ${esc(rowLabel(modelId, n))}</h3>
    <p>${esc(PROTO_INFO[proto][0].toUpperCase() + PROTO_INFO[proto].slice(1))} (${esc(osiLayer(n).pdu)}).</p>
    <p class="who">Co v obálce je (adresy a další údaje), ukáže rentgen od úrovně 2.</p>`;
}
