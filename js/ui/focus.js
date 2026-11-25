// Ohnisko kroku (rozhodnutí 56b): kam se má divák v kroku dívat. Bez DOM, testuje se v Node.
// Hodnoty: 'tip' | 'rentgen' | 'topologie' | 'vrstvy' | 'terminal'.
export const FOCI = ['tip', 'rentgen', 'topologie', 'vrstvy', 'terminal'];

// Záznamy, které mění tabulku zařízení (MAC tabulka switche, ARP tabulka).
const TABLE_KINDS = new Set(['mac_learn', 'arp_learn']);

/**
 * Ohnisko kroku. Scénář může pravidlo přepsat polem `focus` u kroku.
 * Výchozí pravidlo: krok tipu -> tip; vybrané pole rentgenu -> rentgen;
 * mění se tabulka -> topologie; jinak vrstvy (blok).
 * opts.termOpen: otevřený terminál překryje sloupec vrstev, ohnisko „vrstvy“ pak patří terminálu.
 */
export function stepFocus(step, view, { termOpen = false } = {}) {
  let f;
  if (step?.focus && FOCI.includes(step.focus)) f = step.focus;
  else if (step?.predict) f = 'tip';
  else if (step?.xray?.fields?.length) f = 'rentgen';
  else if (view?.changes?.some((r) => TABLE_KINDS.has(r.kind))) f = 'topologie';
  else f = 'vrstvy';
  if (termOpen && f === 'vrstvy') f = 'terminal';
  if (!termOpen && f === 'terminal') f = 'vrstvy';
  return f;
}
