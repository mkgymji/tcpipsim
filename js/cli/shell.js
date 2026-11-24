// Terminál nad pohledem simulace: vybere dialekt podle typu uzlu (PC = Windows, switch = IOS).
// Výstup odpovídá stavu v aktuálním kroku (tabulky z pohledu), nic se nevymýšlí. Bez DOM.
import { winExec, winPrompt } from './wincmd.js';
import { iosExec, iosPrompt } from './ios.js';
import { isHost } from '../devices/types.js';

export function dialectOf(node) {
  if (isHost(node.type)) return 'windows';
  if (node.type === 'switch') return 'ios';
  return null;   // hub nemá konzoli
}

export function promptOf(node) {
  return dialectOf(node) === 'ios' ? iosPrompt(node) : winPrompt(node);
}

export function execute(node, line) {
  const d = dialectOf(node);
  if (d === 'windows') return winExec(node, line);
  if (d === 'ios') return iosExec(node, line);
  return { lines: [], note: 'Hub nemá konzoli: nic si nepamatuje a nic nenastavuje.' };
}

// Text výstupu bez značek (pro testy a kopírování).
export function plain(result) {
  return result.lines.map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
}
