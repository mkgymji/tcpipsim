// Terminál Linuxu na serveru SRV1 (úroveň 4, cmd.md kap. 14 a 18): ss -tuln, ss -tan, ss -uan.
// Hodnoty ze stavu kroku (tabulka spojení, aplikace). Bez DOM.
import { STATE_SS } from '../proto/tcp.js';

export const linuxPrompt = (node) => `student@${String(node.label ?? node.id).toLowerCase()}:~$`;

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

function ss(node, flags) {
  const tcpOn = flags.includes('t') || !flags.match(/[tu]/);
  const udpOn = flags.includes('u');
  const listenOnly = flags.includes('l');
  const all = flags.includes('a');
  const rows = [];
  if (udpOn) {
    for (const a of (node.apps ?? []).filter((x) => x.proto === 'udp' && x.port != null)) rows.push(['udp', 'UNCONN', 0, 0, `0.0.0.0:${a.port}`, '0.0.0.0:*']);
  }
  if (tcpOn) {
    for (const c of node.tcp_connections ?? []) {
      const listen = c.state === 'LISTEN';
      if (listenOnly && !listen) continue;
      if (!listenOnly && !all && listen) continue;
      const port = Number(c.local.split(':')[1]);
      rows.push(['tcp', STATE_SS[c.state] ?? c.state, 0, listen ? (port === 53 ? 10 : 511) : 0, c.local, listen ? '0.0.0.0:*' : c.remote]);
    }
  }
  const showNet = udpOn || flags.includes('t') && udpOn;
  const head = `${showNet ? 'Netid ' : ''}State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process`;
  const lines = [head, ...rows.map((r) => ({ text: `${showNet ? pad(r[0], 6) : ''}${pad(r[1], 7)}${padL(r[2], 6)} ${padL(r[3], 6)} ${padL(r[4], 18)} ${padL(r[5], 17)}`, mark: r[1] === 'ESTAB' ? 'l3' : undefined }))];
  return lines;
}

export function linuxExec(node, line) {
  const cmd = line.trim().replace(/\s+/g, ' ');
  if (!cmd) return { lines: [] };
  const [word, ...args] = cmd.split(' ');
  if (word === 'clear') return { lines: [], clear: true };
  if (word === 'ss') {
    const flags = args.filter((a) => a.startsWith('-')).map((a) => a.slice(1)).join('');
    return { lines: ss(node, flags), note: flags.includes('l') ? 'LISTEN = aplikace čeká na klienty; UDP nemá spojení, proto UNCONN. Send-Q u LISTEN = velikost fronty nových spojení (ověřit).'
      : 'ESTAB = spojení běží. Šířky sloupců počítá ss podle obsahu (simulátor je zarovnává pevně).' };
  }
  if (word === 'netstat') return { lines: [`Command 'netstat' not found, but can be installed with:`, 'sudo apt install net-tools'], note: 'Na nových Linuxech je netstat nahrazený příkazem ss (zkus ss -tuln).' };
  if (word === 'help') return { lines: ['ss -tuln   naslouchající sockety TCP a UDP', 'ss -tan    všechna spojení TCP', 'clear      vymazat okno'], note: 'Nápověda simulátoru.' };
  return { lines: [`${word}: command not found`] };
}
