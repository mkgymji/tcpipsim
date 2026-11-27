// Terminál nad pohledem simulace: vybere dialekt podle typu uzlu (PC = Windows, switch a router =
// Cisco IOS). Výstup odpovídá stavu v aktuálním kroku (tabulky z pohledu), nic se nevymýšlí. Bez DOM.
// opts (úroveň 3): { level, mode, sim, arpDelete, highlight } – viz wincmd.js a iosrouter.js.
import { winExec, winPrompt } from './wincmd.js';
import { iosExec, iosPrompt } from './ios.js';
import { routerExec, routerPrompt } from './iosrouter.js';
import { linuxExec, linuxPrompt } from './linux.js';
import { isHost } from '../devices/types.js';

export function dialectOf(node) {
  if (node.type === 'server') return 'linux';   // SRV1 (úroveň 4)
  if (isHost(node.type)) return 'windows';
  if (node.type === 'switch' || node.type === 'router') return 'ios';
  return null;   // hub nemá konzoli
}

export function promptOf(node, mode) {
  if (node.type === 'router') return routerPrompt(node, mode);
  if (node.type === 'server') return linuxPrompt(node);
  return dialectOf(node) === 'ios' ? iosPrompt(node) : winPrompt(node);
}

export function execute(node, line, opts = {}) {
  const d = dialectOf(node);
  if (d === 'linux') return linuxExec(node, line, opts);
  if (d === 'windows') return winExec(node, line, opts);
  if (node.type === 'router') return routerExec(node, line, opts);
  if (d === 'ios') return iosExec(node, line, opts);
  return { lines: [], note: 'Hub nemá konzoli: nic si nepamatuje a nic nenastavuje.' };
}

// Text výstupu bez značek (pro testy a kopírování).
export function plain(result) {
  return result.lines.map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
}
