// Vykreslení modelových situací (úlohy, docs/ui.md kap. 15): topologie s klikacími kabely, karta
// zadání a vyhodnocení, nápovědy, zachycené rámce pro rentgen, dialog „Vlastnosti protokolu IPv4“
// a nastavení tiskárny. Funkce vracejí HTML jako text (testují se v Node), stav si nedrží.
import { esc } from './render.js';
import { maskString } from '../core/addr.js';

// **tučně** a `kód` v textech úloh (rozh. 67); vše ostatní se escapuje.
export function md(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

// Rozmístění uzlů (procenta šířky a výšky plochy 1000 × 440).
export const POS = {
  PC1: [9, 22], PC3: [9, 76], PRT1: [31, 80], SW1: [31, 36], R1: [50, 36], SW2: [69, 36], PC2: [91, 22], SRV1: [91, 76],
};
const ICON = { pc: 'ico-pc', server: 'ico-pc', switch: 'ico-switch', router: 'ico-router', printer: 'ico-printer' };
// Adresy, které plán sítě ukazuje (Alice a tiskárnu student zkoumá sám: ipconfig, nastavení).
const HIDE_IP = new Set(['PC1', 'PRT1']);

/**
 * Topologie úlohy. m = { nodes: [{ id, type, device, label, ip }], links: [{ id, a, b, connected }],
 * selected, actions: { [nodeId]: [{ act, text }] } }.
 */
export function taskTopologyHtml(m) {
  const at = (id) => POS[id] ?? [50, 50];
  const lines = m.links.map((l) => {
    const [x1, y1] = at(l.a.node), [x2, y2] = at(l.b.node);
    if (l.connected) return `<line class="tw" x1="${x1 * 10}" y1="${y1 * 4.4}" x2="${x2 * 10}" y2="${y2 * 4.4}"/>`;
    // vytažený konec a: kabel vede od b jen do půlky, konec visí
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return `<line class="tw off" x1="${x2 * 10}" y1="${y2 * 4.4}" x2="${mx * 10}" y2="${my * 4.4}"/>`;
  }).join('');
  const cables = m.links.map((l) => {
    const [x1, y1] = at(l.a.node), [x2, y2] = at(l.b.node);
    const a = m.nodes.find((n) => n.id === l.a.node)?.label ?? l.a.node, b = m.nodes.find((n) => n.id === l.b.node)?.label ?? l.b.node;
    const what = `Kabel ${a} – ${b} (${l.b.if})`;
    return `<button type="button" class="tcable${l.connected ? '' : ' off'}" data-cable="${l.id}" style="left:${(x1 + x2) / 2}%;top:${(y1 + y2) / 2}%"
      aria-label="${esc(`${what}: ${l.connected ? 'zapojený. Klik: odpojit' : 'vytažený. Klik: zapojit'}`)}" title="${esc(`${what}. Klik: ${l.connected ? 'odpojit' : 'zapojit'}`)}">${l.connected ? '' : 'vytažený'}</button>`;
  }).join('');
  const nodes = m.nodes.map((n) => {
    const [x, y] = at(n.id);
    const icon = ICON[n.device] ?? ICON[n.type] ?? 'ico-pc';
    const sel = m.selected === n.id;
    const ip = n.type === 'switch' ? '' : HIDE_IP.has(n.id) ? '<small class="tip-q">IP: zjisti</small>' : `<small class="mono">${esc(n.ip ?? '')}</small>`;
    return `<div class="tnode t-${n.type}${sel ? ' sel' : ''}" style="left:${x}%;top:${y}%">
      <button type="button" class="tdev" data-pick="${n.id}" aria-pressed="${sel}" aria-label="${esc(`${n.label}${n.ip && !HIDE_IP.has(n.id) ? `, ${n.ip}` : ''}. Klik: možnosti`)}">
      <svg aria-hidden="true"><use href="#${icon}"/></svg><b>${esc(n.label)}</b>${ip}</button></div>`;
  }).join('');
  const sel = m.nodes.find((n) => n.id === m.selected);
  const acts = sel ? `<div class="tacts"><b>${esc(sel.label)}:</b>${(m.actions?.[sel.id] ?? []).map((a) => `<button type="button" class="btn small" data-act="${a.act}" data-node="${sel.id}">${esc(a.text)}</button>`).join('')}</div>`
    : '<div class="tacts muted">Vyber zařízení (klik): terminál, nastavení.</div>';
  return `<span class="tag">TOPOLOGIE <small>klik na zařízení = možnosti, klik na kabel = zapojit / odpojit</small></span>
<div class="tstage"><div class="tnet n1"><span>SÍŤ 1 · 192.168.1.0/24</span></div><div class="tnet n2"><span>SÍŤ 2 · 192.168.2.0/24</span></div>
    <svg class="tlines" viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${cables}${nodes}</div>${acts}`;
}

const KIND = { a: 'nastavení', b: 'síť nejde' };

/** Karta zadání: příběh, cíl, (úloha 13: seed a výběr vrstvy), Zkontrolovat, Obnovit, výsledek. */
export function taskCardHtml(def, { seed = null, result = null, layerGuess = '' } = {}) {
  const layers = def.layers ? `<label class="tlayer">Chyba byla na vrstvě:
    <select id="t-layer"><option value="">vyber…</option>${def.layers.map(([v, t]) => `<option value="${esc(v)}"${v === layerGuess ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : '';
  return `<div class="thead"><span class="tno">Úloha ${def.id}</span><h2>${esc(def.title)}</h2><span class="tkind">${KIND[def.kind]}</span></div>
    <ul class="tstory">${def.story.map((s) => `<li>${md(s)}</li>`).join('')}</ul>
    <p class="tgoal"><b>Cíl:</b> ${md(def.goal)}</p>
    ${def.seeded ? `<p class="tseed small">Zadání číslo <b>${esc(seed)}</b> (seed v adrese: stejné číslo = stejná chyba).</p>` : ''}
    ${layers}
    <div class="tbtns"><button type="button" class="btn main" id="t-check">Zkontrolovat</button>
    <button type="button" class="btn small" id="t-reset" title="Vrátí síť do stavu ze zadání">Obnovit úlohu</button></div>
    <div id="t-result" aria-live="polite">${result ? resultHtml(def, result) : ''}</div>`;
}

const STATUS = { ok: 'Funguje', partial: 'Funguje, ale…', fail: 'Nefunguje' };

/** Výsledek vyhodnocení „funguje / nefunguje a proč“. */
export function resultHtml(def, r) {
  const layer = r.status !== 'ok' && r.layer && r.layer !== '?' ? `<span class="tl-chip">vrstva ${esc(r.layer)}</span>` : '';
  const checks = r.checks?.length ? `<ul class="tchecks">${r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? 'splněno' : 'nesplněno'}: <code>${esc(c.label)}</code></li>`).join('')}</ul>` : '';
  const hints = r.hints ? `<p class="small muted">Použil jsi ${r.hints} ${r.hints === 1 ? 'nápovědu' : 'nápovědy'}.</p>` : '';
  const list = r.status === 'ok' && def.checklist ? checklistHtml(def.checklist) : '';
  const q = r.status === 'ok' && def.question ? `<details class="tq"><summary>Kontrolní otázka: ${esc(def.question)}</summary><p>${esc(def.answer)}</p></details>` : '';
  return `<div class="tres ${r.status}"><h3>${STATUS[r.status]} ${layer}</h3>
    ${r.lines.map((l) => `<p>${md(l)}</p>`).join('')}${checks}${hints}${list}${q}
    <p class="simpl small">Simulátor zjednodušuje: skutečný počítač „vrstvu, která selhala“ neřekne. Zjistíš ji příkazy v terminálu.</p></div>`;
}

/** Kontrolní seznam od L1 nahoru (úloha 13, ulohy.md kap. 4.2). */
export function checklistHtml(rows) {
  return `<table class="tcheck"><caption>Postup, když síť nejde: od L1 nahoru</caption><thead><tr><th>Vrstva</th><th>Otázka</th><th>Jak</th></tr></thead>
    <tbody>${rows.map(([l, q, how, okv]) => `<tr><td><b>${esc(l)}</b></td><td>${esc(q)}<small>${esc(okv)}</small></td><td>${md(how)}</td></tr>`).join('')}</tbody></table>`;
}

/** Nápovědy 1–3: každou si student otevře sám, další je zamčená, dokud neotevře předchozí. */
export function hintsHtml(hints, opened) {
  const names = ['obecná', 'směr', 'skoro řešení'];
  return `<h3>Nápovědy <small>(otevírej postupně, jen když nevíš kudy dál)</small></h3>${hints.map((h, i) => {
    if (i < opened) return `<div class="thint open"><b>Nápověda ${i + 1} (${names[i]}):</b> ${md(h)}</div>`;
    return `<button type="button" class="btn small thint-btn" data-hint="${i}"${i > opened ? ' disabled aria-disabled="true"' : ''}>Nápověda ${i + 1} (${names[i]})${i > opened ? ' · zamčeno' : ''}</button>`;
  }).join('')}`;
}

// Krátký popis rámce pro seznam zachycených rámců.
export function frameSummary(pdu) {
  const parts = [];
  for (let p = pdu; p && typeof p === 'object'; p = p.payload) {
    if (p.proto === 'arp') parts.push(p.h.op === 1 ? `ARP: kdo má ${p.h.tpa}?` : `ARP: ${p.h.spa} je na ${p.h.sha.replace(/:/g, '-')}`);
    else if (p.proto === 'icmp') parts.push({ 0: 'ICMP Echo Reply', 8: 'ICMP Echo Request', 3: 'ICMP Unreachable', 11: 'ICMP Time Exceeded' }[p.h.type] ?? `ICMP ${p.h.type}`);
    else if (p.proto === 'ipv4') parts.push(`${p.h.src} → ${p.h.dst}`);
    else if (p.proto === 'udp') parts.push(`UDP ${p.h.sport} → ${p.h.dport}`);
    else if (p.proto === 'tcp') parts.push(`TCP ${p.h.sport} → ${p.h.dport} [${p.h.flagsText}]`);
    else if (p.proto === 'dns') parts.push(p.h.qr ? 'DNS odpověď' : 'DNS dotaz');
    else if (p.proto === 'data' && /^(GET|HTTP)/.test(String(p.payload))) parts.push(String(p.payload).split('\r\n')[0]);
    if (p.proto === 'icmp' || p.proto === 'arp') break;
  }
  return parts.join(' · ');
}

/** Seznam zachycených rámců posledního příkazu (rozhraní uzlu, u kterého příkaz běžel). */
export function framesHtml(cap, sel) {
  if (!cap) return '<p class="ph">Spusť příkaz v terminálu (třeba <code>ping 192.168.1.1</code>): tady se objeví rámce, které prošly kabelem u zařízení, a rentgen jejich hlaviček.</p>';
  if (!cap.frames.length) return `<p class="ph">Příkaz <code>${esc(cap.cmd)}</code> neposlal na kabel u ${esc(cap.label)} <b>žádný rámec</b>.</p>`;
  return `<p class="small">Kabel u ${esc(cap.label)}, příkaz <code>${esc(cap.cmd)}</code>: ${cap.frames.length} rámců${cap.more ? ` (prvních ${cap.frames.length})` : ''}. Klik = rentgen.</p>
    <ol class="tframes">${cap.frames.map((f, i) => `<li><button type="button" data-frame="${i}" class="${i === sel ? 'on' : ''}" aria-pressed="${i === sel}"><span class="dir">${f.out ? 'ven' : 'dovnitř'}</span> ${esc(f.text)}</button></li>`).join('')}</ol>`;
}

const field = (id, label, en, value, extra = '') => `<label class="dlg-f" for="${id}"><span>${esc(label)} <small>${esc(en)}</small></span><input id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(value ?? '')}"${extra}></label>`;

/** Dialog „Vlastnosti protokolu IPv4“ (ulohy.md kap. 2.1). cfg = ipv4_config uzlu. */
export function ipv4DialogHtml(label, cfg) {
  const st = cfg.mode !== 'dhcp';
  const dnsStatic = st || (cfg.dns ?? []).length > 0;
  return `<form method="dialog" class="dlg-ipv4" id="ipv4-form" novalidate>
    <h2 id="dlg-title">Vlastnosti protokolu IPv4 <small>(${esc(label)})</small></h2>
    <p class="small muted">Jako ve Windows: Ethernet → Vlastnosti → Protokol IP verze 4 (TCP/IPv4) → Vlastnosti.</p>
    <fieldset><legend>Adresa</legend>
      <label class="dlg-r"><input type="radio" name="mode" value="dhcp"${st ? '' : ' checked'}> Získat adresu IP ze serveru DHCP automaticky <small>Obtain an IP address automatically</small></label>
      <label class="dlg-r"><input type="radio" name="mode" value="static"${st ? ' checked' : ''}> Použít následující adresu IP <small>Use the following IP address</small></label>
      ${field('f-ip', 'Adresa IP', 'IP address', st ? cfg.ip : '')}
      ${field('f-mask', 'Maska podsítě', 'Subnet mask', st && cfg.prefix != null ? maskString(cfg.prefix) : '')}
      ${field('f-gw', 'Výchozí brána', 'Default gateway', st ? cfg.gateway : '')}
    </fieldset>
    <fieldset><legend>DNS</legend>
      <label class="dlg-r"><input type="radio" name="dnsMode" value="auto"${dnsStatic ? '' : ' checked'}${st ? ' disabled' : ''}> Získat adresu serveru DNS automaticky <small>Obtain DNS server address automatically</small></label>
      <label class="dlg-r"><input type="radio" name="dnsMode" value="static"${dnsStatic ? ' checked' : ''}> Použít následující adresy serverů DNS <small>Use the following DNS server addresses</small></label>
      ${field('f-dns1', 'Upřednostňovaný server DNS', 'Preferred DNS server', cfg.dns?.[0])}
      ${field('f-dns2', 'Náhradní server DNS', 'Alternate DNS server', cfg.dns?.[1])}
    </fieldset>
    <div id="dlg-msg" class="dlg-msg" aria-live="assertive"></div>
    <div class="dlg-btns"><button type="submit" class="btn main" value="ok" id="dlg-ok">OK</button><button type="button" class="btn small" id="dlg-cancel">Zrušit</button></div>
    <p class="simpl small">Simulátor zjednodušuje: „Ověřit nastavení při ukončení“ ani Upřesnit tu nejsou. Po OK platí nastavení hned (jako ve Windows).</p>
  </form>`;
}

/** Nastavení sítě tiskárny (napodobuje panel / webové rozhraní tiskárny). */
export function printerDialogHtml(node) {
  const i = node.interfaces[0];
  return `<form method="dialog" class="dlg-ipv4" id="prt-form" novalidate>
    <h2 id="dlg-title">Tiskárna: nastavení sítě</h2>
    <p class="small muted">Jako na panelu tiskárny: Síť → TCP/IP → ruční nastavení.</p>
    <fieldset><legend>TCP/IP (ruční)</legend>
      ${field('f-ip', 'IP adresa', 'IP address', i.ip)}${field('f-mask', 'Maska podsítě', 'Subnet mask', maskString(i.prefix))}${field('f-gw', 'Brána', 'Gateway', node.gateway)}
    </fieldset>
    <p class="small"><b>MAC adresa:</b> <span class="mono">${esc(i.mac.replace(/:/g, '-').toUpperCase())}</span></p>
    <div id="dlg-msg" class="dlg-msg" aria-live="assertive"></div>
    <div class="dlg-btns"><button type="submit" class="btn main" value="ok" id="dlg-ok">Uložit</button><button type="button" class="btn small" id="dlg-cancel">Zrušit</button></div>
    <p class="simpl small">Simulátor zjednodušuje: levná tiskárna nehlídá konflikt adres (RFC 5227), proto nic nehlásí.</p>
  </form>`;
}

/** Hlášky validace dialogu: chyby (odmítnuto) a varování (Uložit i tak? Ano / Ne). */
export function dialogMsgHtml(v, { confirm = false } = {}) {
  if (v.errors.length) {
    return v.errors.map((e) => `<p class="dlg-err"><b>${esc(e.cs)}</b>${e.win ? `<small>Windows: „${esc(e.win)}“</small>` : ''}</p>`).join('');
  }
  if (confirm && v.warnings.length) {
    return `${v.warnings.map((w) => `<p class="dlg-warn"><b>${esc(w.cs)}</b><small>Windows: „${esc(w.win)}“</small></p>`).join('')}
      <div class="dlg-btns"><button type="button" class="btn small" id="dlg-yes">Ano, uložit</button><button type="button" class="btn small" id="dlg-no">Ne</button></div>`;
  }
  return '';
}
