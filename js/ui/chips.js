// Odkazové čipy v textu kroku (rozhodnutí 56c). Bez DOM, testuje se v Node.
// Syntaxe ve scénáři: {{druh:cíl|popisek}} nebo {{druh|popisek}}, např.
//   {{rentgen:ip.ttl|TTL}}      pole rentgenu (id pole z wire/fields.js) nebo karta v pravém panelu
//                               s data-target (mask, arp, PC1.route); bez cíle = celý panel rentgenu
//   {{topo:SW1.mac|MAC tabulka}} prvek topologie s data-target (SW1.mac, R1.route, R1.arp, PC1.arp)
//                               nebo uzel (data-node)
//   {{term:PC1|terminál}}       terminál uzlu (bez cíle: terminál vybraného uzlu, jinak Alice)
// Vykreslí se jako tlačítko „→ popisek“ v barvě role cíle (ui.md kap. 13).
export const CHIP_RE = /\{\{(rentgen|topo|term)(?::([^|}]+))?\|([^}]+)\}\}/g;

const ARIA = {
  rentgen: (l) => `${l}: ukázat v rentgenu`,
  topo: (l) => `${l}: ukázat v topologii`,
  term: (l) => `${l}: otevřít terminál`,
};

/** Čipy v textu: [{ kind, target, label }]. */
export function parseChips(text) {
  return [...String(text ?? '').matchAll(CHIP_RE)].map((m) => ({ kind: m[1], target: m[2] ?? '', label: m[3] }));
}

/** Text bez značek čipů (jen popisky), např. pro title nebo porovnání. */
export function stripChips(text) {
  return String(text ?? '').replace(CHIP_RE, (_, k, t, l) => l);
}

/** HTML textu s čipy; `esc` escapuje obyčejný text. */
export function chipsHtml(text, esc) {
  const s = String(text ?? '');
  let out = '', at = 0;
  for (const m of s.matchAll(CHIP_RE)) {
    out += esc(s.slice(at, m.index));
    const [, kind, target = '', label] = m;
    out += `<button type="button" class="tchip c-${kind}" data-chip="${kind}" data-chip-target="${esc(target)}" aria-label="${esc(ARIA[kind](label))}"><span aria-hidden="true">→</span> ${esc(label)}</button>`;
    at = m.index + m[0].length;
  }
  return out + esc(s.slice(at));
}

const TAB_OF = { eth: 'ethernet', arp: 'arp', ip: 'ipv4', icmp: 'icmp', udp: 'udp' };
/** Záložka rentgenu pro id pole (ip.ttl -> ipv4); null = cíl není pole hlavičky. */
export function fieldTab(id) {
  const m = /^([a-z]+)\.[a-z_]+$/.exec(id ?? '');
  return m && TAB_OF[m[1]] ? TAB_OF[m[1]] : null;
}
