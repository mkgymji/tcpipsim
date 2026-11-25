// Prostřední sloupec jako „U“ (rozhodnutí 38): blok se zprávou svisle sleduje aktivní vrstvu
// (dolů u odesílatele, na médiu v řádku L1, nahoru u příjemce) a mezi řádky L1 vede pruh
// „médium (kabel)“, na úrovni 2 s hubem (jen L1) nebo switchem (L1–L2).
// Mřížka prostředního sloupce má stejných 7 stop jako sloupec vrstev (L7 nahoře, L1 dole), proto
// poloha sedí v ISO/OSI i v TCP/IP (sloučené řádky zaberou víc stop, číslo vrstvy ISO/OSI se nemění).
// Čisté funkce (liftAnchor, laneEnd, mediumHtml) jsou bez DOM a testují se v Node.
import { bitString } from '../wire/encode.js';
import { esc, rowLabel } from './render.js';

const DEVICE = new Set(['hub', 'switch']);

/**
 * Kde je zpráva v „U“: { at, layer, node?, from?, to? }.
 * at = 'sender' | 'receiver' | 'device' (hub/switch) | 'other' (PC mimo dvojici, např. Cyril)
 *    | 'wire' (na kabelu) | 'none' (bez aktivní vrstvy: úvod, konec).
 * layer = vrstva ISO/OSI (1–7), u které má blok spodní hranu.
 */
export function liftAnchor(v, pair) {
  const f = v.focus;
  if (!f) return { at: 'none', layer: 7 };
  if (f.link) return { at: 'wire', layer: 1, from: f.from, to: f.to };
  const layer = f.layer ?? 7;
  if (f.node === pair?.sender) return { at: 'sender', layer, node: f.node };
  if (f.node === pair?.receiver) return { at: 'receiver', layer, node: f.node };
  if (DEVICE.has(v.nodes?.[f.node]?.type)) return { at: 'device', layer, node: f.node };
  return { at: 'other', layer, node: f.node };
}

/** Zařízení v médiu mezi dvojicí (úroveň 2: hub nebo switch), jinak null. */
export function mediumDevice(v) {
  const id = v.order?.find((x) => DEVICE.has(v.nodes[x].type));
  return id ? { id, type: v.nodes[id].type, label: v.nodes[id].label } : null;
}

/**
 * Konec oblasti bloku v mřížce (grid-row: 1 / end). Spodní hrana bloku = spodní hrana stopy
 * vrstvy `layer` (stopa vrstvy n je 8 - n, konec tedy 9 - n). Bity nejsou blok: jedou v pruhu
 * média, nad ním zůstane jen poznámka (konec nad stopou L1, u switche nad jeho řádkem L2).
 */
export function laneEnd(anchor, packetForm, deviceType = null) {
  const bits = packetForm === 'bits' || packetForm === 'wire';
  // se zařízením v pruhu končí poznámka nad řádkem L2: nad věžičkou hubu je jeho jméno
  if (bits) return deviceType ? 6 : 7;
  // rámec ve switchi: blok sedí na věžičce switche (jeho řádek L2 svítí), nepřekrývá ji
  if (anchor.at === 'device') return 6;
  return Math.min(7, 9 - Math.max(2, anchor.layer));
}

/** Řádek mřížky (1 = L7 … 7 = L1), na kterém je spodní hrana bloku; test polohy v prohlížeči. */
export const laneRowOfLayer = (layer) => 8 - layer;

// Kde v pruhu leží bity: 'start' (u odesílatele), 'mid' (na kabelu), 'end' (u příjemce),
// s hubem/switchem 'seg-l' / 'seg-r' (úsek kabelu vlevo / vpravo od zařízení), 'seg-l-in' (vjíždí do hubu).
function ribbonPlace(anchor, pair, dev) {
  if (anchor.at === 'wire') {
    if (!dev) return 'mid';
    const touchesSender = anchor.from === pair.sender || anchor.to === pair.sender;
    return touchesSender ? 'seg-l' : 'seg-r';
  }
  if (anchor.at === 'device') return dev ? 'seg-l-in' : 'mid';
  if (anchor.at === 'receiver' || anchor.at === 'other') return dev ? 'seg-r' : 'end';
  return dev ? 'seg-l' : 'start';
}

// Směr jízdy bitů: doprava (od odesílatele ve výtahu k příjemci), nebo doleva (odpověď ke zdroji).
function ribbonDir(anchor, pair) {
  if (anchor.at !== 'wire') return 'r';
  return anchor.to === pair.sender ? 'l' : 'r';
}

/**
 * Pruh média mezi řádky L1 (HTML). opts = { model, animate, dev: mediumDevice(v), capInfo }.
 * Bity (pruh 0 a 1) jsou v něm jen tehdy, když je zpráva na L1 (bity, na drátě, v hubu).
 */
export function mediumHtml(v, pair, { model = 'osi', animate = false, dev = null, nBits, capInfo = false } = {}) {
  const anchor = liftAnchor(v, pair);
  const p = v.packet;
  const bits = p && (p.form === 'bits' || p.form === 'wire') && p.bytes;
  const place = bits ? ribbonPlace(anchor, pair, dev) : null;
  const on = Boolean(bits);
  // pásek jen schematicky (12 bitů, se zařízením je úsek kabelu krátký: 8), celý obsah ukáže rentgen
  const n = nBits ?? (dev ? 8 : 12);
  const lab = dev ? (model === 'osi' ? 'L1' : 'L1-2') : `${model === 'osi' ? 'L1' : 'L1-2'} bity`;
  let ribbon = '';
  if (bits) {
    const dir = ribbonDir(anchor, pair);
    const travel = animate && p.form === 'wire' ? ` anim-travel${dir === 'l' ? '-l' : ''}` : '';
    ribbon = `<span class="ribbon at-${place}${travel}" data-dir="${dir}">${dir === 'l' ? '<i aria-hidden="true">◀</i>' : ''}<button type="button" class="lab" data-env="bits" data-tab="ethernet"
      aria-label="${esc(`Bity, ${rowLabel(model, 1)}: co to je`)}">${esc(lab)}</button><span class="bv">${bitString(p.bytes, n)}…</span>${dir === 'r' ? '<i aria-hidden="true">▶</i>' : ''}</span>`;
  }
  // popisek pruhu tam, kde zrovna nejsou bity
  const capSide = !dev ? (place === 'start' ? 'end' : place === 'mid' || place === 'end' ? 'start' : 'mid')
    : place?.startsWith('seg-l') ? 'seg-r' : 'seg-l';
  // úroveň 1: popisek je tlačítko (panel Detail „Kabel“); úroveň 2 panel pro kabel nemá
  const cap = capInfo
    ? `<button type="button" class="mcap at-${capSide}" data-wire aria-label="Médium (kabel): co to je">médium (kabel)</button>`
    : `<span class="mcap at-${capSide}">médium (kabel)</span>`;
  let tower = '';
  if (dev) {
    const act = anchor.at === 'device' && anchor.node === dev.id ? anchor.layer : null;
    // buňky nesou jméno vrstvy, ne PDU: rámec je jen jeden, ten velký nad věžičkou (kontrola 38, M2)
    const cell = (num, name) => `<span class="tcell${act === num ? ' active' : ''}" style="--c:var(--L${num});--t:var(--L${num}t)"><b>L${num}</b> ${name}</span>`;
    tower = `<div class="tower ${dev.type}${act ? ' act' : ''}" aria-label="${esc(`${dev.label}: ${dev.type === 'switch' ? 'switch, vrstvy L1 a L2' : 'hub, jen vrstva L1'}`)}">
      <span class="tname">${esc(dev.label)}</span>${dev.type === 'switch' ? cell(2, 'Linková') : ''}${cell(1, 'Fyzická')}</div>`;
  }
  // úroveň 1: i samotný kabel v pruhu otevře panel Detail „Kabel“ (stejně jako kabel v topologii)
  const cable = capInfo ? '<span class="cable hit" data-wire aria-hidden="true"></span>' : '<span class="cable" aria-hidden="true"></span>';
  return `<div class="mrow${on ? ' on' : ''}${dev ? ` has-dev dev-${dev.type}` : ''}">${cable}${cap}${ribbon}</div>${tower}`;
}

// ---- DOM: poloha bloku a plynulý posun (jen transform; při omezení animací a kroku vzad bez pohybu) ----

/** Nastaví oblast bloku podle kotvy; vrací předchozí polohu bloku pro posun. */
export function placeLane(laneEl, anchor, end) {
  const old = laneEl.querySelector('#nest .float')?.getBoundingClientRect() ?? null;
  laneEl.style.setProperty('--lane-end', String(end));
  laneEl.dataset.liftAt = anchor.at;
  laneEl.dataset.liftLayer = String(anchor.layer);
  return old;
}

/** Po vykreslení: blok sjede / vyjede z předchozí polohy do nové (animace jen transform). */
export function slideFloat(laneEl, oldRect, animate) {
  const fl = laneEl.querySelector('#nest .float');
  if (!fl || !oldRect || !animate) return;
  if (document.body.classList.contains('reduce-motion')) return;
  const r = fl.getBoundingClientRect();
  const dy = Math.round(oldRect.bottom - r.bottom);
  if (Math.abs(dy) < 4) return;
  fl.style.setProperty('--dy', `${dy}px`);
  fl.classList.add('anim-slide');
}

// ---- Sloupec příjemce patří uzlu, o kterém krok mluví (rozhodnutí 57) ----

/**
 * Uzel, který v kroku zahodil rámec a je v ohnisku (např. Cyril), pokud není ve dvojici:
 * jeho sloupec se ukáže místo příjemce. Jinak null. Bez DOM, testuje se v Node.
 */
export function dropColumn(v, pair) {
  const id = v?.dropped?.node;
  if (!id || v.focus?.node !== id || v.nodes?.[id]?.type !== 'pc') return null;
  if (id === pair?.sender || id === pair?.receiver) return null;
  return id;
}

/** Dvojice pro sloupce: příjemce nahradí uzel, který rámec zahodil (dropColumn). */
export function columnPair(v, pair) {
  const drop = dropColumn(v, pair);
  return drop ? { ...pair, receiver: drop, dropCol: true } : pair;
}

/** Věta u L2 zahazujícího uzlu: „cílová …:02 ≠ moje …:03 → zahozeno“ (prostý text). */
export function dropNote(v) {
  const d = v?.dropped;
  if (!d) return '';
  const n = v.nodes?.[d.node];
  const short = (mac) => `…:${String(mac).slice(String(mac).lastIndexOf(':') + 1)}`;
  // ARP: jen poslední bajt IP (celé adresy jsou v poznámce u bloku), sloupec je úzký
  const oct = (ip) => `.${String(ip).split('.').pop()}`;
  if (d.kind === 'arp') return `hledá ${oct(d.ip)} ≠ moje ${oct(n?.ip ?? n?.interfaces?.[0]?.ip ?? '?')} → zahozeno`;
  if (d.dst && d.mac) return `cílová ${short(d.dst)} ≠ moje ${short(d.mac)} → zahozeno`;
  return 'zahozeno';
}

/**
 * Štítek přepnutí sloupce v kroku po zahození: „Teď Bob“ (příjemce je v ohnisku), jinak „Zpět: Bob“.
 * prev/cur = columnPair předchozího a tohoto kroku. Vrací text nebo ''.
 */
export function columnSwitchLabel(prev, cur, v, label) {
  if (!prev?.dropCol || cur?.dropCol || prev.receiver === cur?.receiver || !cur?.receiver) return '';
  // štítek jen když krok opravdu mluví o příjemci; jinak by rušil (úroveň 3 krok 7: ARP odpověď Alici)
  return v?.focus?.node === cur.receiver ? `Teď ${label}` : '';
}
