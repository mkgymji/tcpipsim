// Zjednodušené Cisco IOS pro switch (úroveň 2): show mac address-table (docs/spec/cmd.md kap. 6).
// Konzole je rovnou v privilegovaném režimu (Simulátor zjednodušuje). Přijímá jednoznačné
// zkratky slov jako IOS (sh mac add). Bez DOM.
import { macCisco } from '../core/addr.js';

export function iosPrompt(node) {
  return `${node.label ?? node.id}#`;
}

// Slovník příkazů: posloupnost klíčových slov (zkratka = jednoznačná předpona).
const TREE = {
  show: { mac: { 'address-table': { dynamic: {}, interface: { $arg: true }, 'aging-time': {} } } },
  clear: { mac: { 'address-table': { dynamic: {} } } },
  enable: {}, exit: {}, 'terminal': {},
};

// Rozpozná příkaz; vrací { words, arg } nebo { error, at } (pozice znaku pro stříšku).
function parse(line) {
  const parts = [];
  for (const m of line.matchAll(/\S+/g)) parts.push({ w: m[0], at: m.index });
  let node = TREE;
  const words = [];
  let arg = null;
  for (let i = 0; i < parts.length; i++) {
    const { w, at } = parts[i];
    if (node.$arg) { arg = parts.slice(i).map((p) => p.w).join(''); break; }
    const cands = Object.keys(node).filter((k) => k !== '$arg' && k.startsWith(w.toLowerCase()));
    if (cands.length !== 1) return cands.length > 1 ? { ambiguous: w } : { error: true, at };
    words.push(cands[0]);
    node = node[cands[0]];
  }
  if (node.$arg && arg === null) return { incomplete: true };
  return { words, arg, leaf: node };
}

function normPort(p) {
  const m = /^(?:f|fa|fastethernet)(\d+\/\d+)$/i.exec(p);
  return m ? `Fa${m[1]}` : p;
}

function table(node, filter) {
  const rows = [...node.mac_table].filter(filter)
    .sort((a, b) => (a.vlan - b.vlan) || a.mac.localeCompare(b.mac));
  const lines = ['          Mac Address Table', '-------------------------------------------', '',
    'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
  for (const e of rows) {
    lines.push({ text: `${String(e.vlan).padStart(4)}    ${macCisco(e.mac).padEnd(18)}${(e.type ?? 'dynamic').toUpperCase().padEnd(12)}${e.port}`, mark: 'l2' });
  }
  lines.push(`Total Mac Addresses for this criterion: ${rows.length}`);
  return lines;
}

export function iosExec(node, line) {
  const cmd = line.trim();
  if (cmd === '') return { lines: [] };
  if (node.type === 'hub') return { lines: [], note: 'Hub nemá konzoli: nic si nepamatuje a nic nenastavuje.' };
  if (cmd === '?') {
    return { lines: ['  show mac address-table        MAC tabulka switche', '  show mac address-table dynamic',
      '  show mac address-table interface Fa0/1'], note: 'Nápověda simulátoru (zkrácená).' };
  }
  const p = parse(cmd);
  if (p.ambiguous) return { lines: [`% Ambiguous command:  "${cmd}"`] };
  if (p.error) return { lines: [`${' '.repeat(iosPrompt(node).length + p.at)}^`, "% Invalid input detected at '^' marker.", ''], caretOnly: true };
  if (p.incomplete) return { lines: ['% Incomplete command.', ''] };
  const w = p.words.join(' ');
  if (w === 'enable' || w === 'terminal') return { lines: [] };
  if (w === 'exit') return { lines: [], note: 'V simulátoru konzole zůstává otevřená; zavřeš ji tlačítkem Zavřít nebo Esc.' };
  if (w === 'show' || w === 'show mac' || w === 'clear' || w === 'clear mac' || w === 'clear mac address-table') {
    return { lines: ['% Incomplete command.', ''] };
  }
  if (w.startsWith('clear mac address-table')) {
    return { lines: [], note: 'Simulátor zjednodušuje: v úrovni 2 tabulku jen čteš; mazání přijde s interaktivní simulací.' };
  }
  if (w === 'show mac address-table aging-time') {
    return { lines: ['Global Aging Time:  300', 'Vlan    Aging Time', '----    ----------', ''],
      note: 'Výchozí doba stárnutí je 300 s. Simulátor zjednodušuje: čas v simulátoru neběží jako ve skutečnosti.' };
  }
  let filter = () => true;
  if (p.words.includes('interface')) { const port = normPort(p.arg); filter = (e) => e.port === port; }
  const note = 'Skutečný switch vypíše navíc řádky s portem CPU, to jsou adresy, které patří switchi samotnému.';
  return { lines: table(node, filter), note };
}
