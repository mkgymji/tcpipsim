// Příkazový řádek Windows (úroveň 2): ipconfig, ipconfig /all, arp -a (docs/spec/cmd.md).
// Výstupy anglicky (rozhodnutí 10), hodnoty ze stavu simulace v daném kroku. Bez DOM.
// Vstup: node = uzel z pohledu (label, ip, prefix, mac, gateway, arp_cache).
import { macWindows, maskString, broadcastOf, multicastMac } from '../core/addr.js';

// Popisky s tečkovým vodítkem přesně jako Windows 10/11 (cmd.md kap. 2 a 3).
const LABELS = {
  host: 'Host Name . . . . . . . . . . . .', dnsSuffix: 'Primary Dns Suffix  . . . . . . .',
  node: 'Node Type . . . . . . . . . . . .', routing: 'IP Routing Enabled. . . . . . . .',
  wins: 'WINS Proxy Enabled. . . . . . . .', conn: 'Connection-specific DNS Suffix  .',
  desc: 'Description . . . . . . . . . . .', phys: 'Physical Address. . . . . . . . .',
  dhcp: 'DHCP Enabled. . . . . . . . . . .', auto: 'Autoconfiguration Enabled . . . .',
  ipv4: 'IPv4 Address. . . . . . . . . . .', mask: 'Subnet Mask . . . . . . . . . . .',
  gw: 'Default Gateway . . . . . . . . .', netbios: 'NetBIOS over Tcpip. . . . . . . .',
};
const dots = (key) => `   ${LABELS[key]} : `;

export function hostName(node) {
  return String(node.label ?? node.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function winPrompt(node) {
  const user = String(node.label ?? 'student').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `C:\\Users\\${user}>`;
}

function ipconfig(node, all) {
  const out = ['', 'Windows IP Configuration', ''];
  if (all) {
    out.push(`${dots('host')}${hostName(node)}`, `${dots('dnsSuffix')}`, `${dots('node')}Hybrid`,
      `${dots('routing')}No`, `${dots('wins')}No`);
  } else {
    out.push('');
  }
  out.push('', 'Ethernet adapter Ethernet:', '', `${dots('conn')}`);
  if (all) {
    out.push(`${dots('desc')}Simulated Ethernet Adapter`,
      { text: `${dots('phys')}${macWindows(node.mac, true)}`, mark: 'l2' },
      `${dots('dhcp')}No`, `${dots('auto')}Yes`);
  }
  out.push({ text: `${dots('ipv4')}${node.ip}${all ? '(Preferred)' : ''}`, mark: 'l3' },
    `${dots('mask')}${maskString(node.prefix)}`,
    `${dots('gw')}${node.gateway ?? ''}`);
  if (all) out.push(`${dots('netbios')}Enabled`);
  out.push('');
  const note = ['Na školním PC uvidíš navíc řádek s adresou IPv6, tu simulátor nemá.'];
  if (!node.gateway) note.push('Výchozí brána (Default Gateway) je prázdná: síť je jen jedna, bez routeru (úroveň 3).');
  return { lines: out, note: note.join(' ') };
}

const col = (s, w) => String(s).padEnd(w);

function arpA(node) {
  const rows = node.arp_cache.map((e) => ({ ip: e.ip, mac: e.mac, type: e.type ?? 'dynamic' }));
  // statické řádky, které Windows ukazuje vždy (rozhodnutí 26): broadcast sítě, multicast, omezený broadcast
  const statics = [broadcastOf(node.ip, node.prefix), '224.0.0.22', '224.0.0.251', '224.0.0.252', '239.255.255.250']
    .map((ip, i) => ({ ip, mac: i === 0 ? 'ff:ff:ff:ff:ff:ff' : multicastMac(ip), type: 'static' }));
  statics.push({ ip: '255.255.255.255', mac: 'ff:ff:ff:ff:ff:ff', type: 'static' });
  const lines = ['', `Interface: ${node.ip} --- 0x4`, '  Internet Address      Physical Address      Type'];
  for (const r of [...rows, ...statics]) {
    const line = `  ${col(r.ip, 22)}${col(macWindows(r.mac), 22)}${r.type}`;
    lines.push(r.type === 'dynamic' ? { text: line, mark: 'l2' } : line);
  }
  lines.push('');
  const note = [rows.length
    ? 'Simulátor zjednodušuje: MAC adresu už PC zná (předvyplněná ARP tabulka); jak ji zjistí, uvidíš v úrovni 3.'
    : 'Žádný záznam typu dynamic: tento počítač si žádnou MAC adresu nezapamatoval.',
  'Řádky static jsou adresy pro broadcast a multicast, které Windows zná vždy (vysvětlíme v úrovni 3). Na školním PC jich může být víc.'];
  return { lines, note: note.join(' ') };
}

// Vrací { lines: (string | {text, mark})[], note?: string, clear?: true }.
export function winExec(node, line) {
  const cmd = line.trim().replace(/\s+/g, ' ');
  const lc = cmd.toLowerCase();
  if (lc === '') return { lines: [] };
  if (lc === 'ipconfig') return ipconfig(node, false);
  if (lc === 'ipconfig /all' || lc === 'ipconfig -all') return ipconfig(node, true);
  if (lc === 'arp -a' || lc === 'arp -g' || lc === 'arp /a') return arpA(node);
  if (lc === 'cls') return { lines: [], clear: true };
  if (lc.startsWith('arp')) {
    return { lines: [''], note: 'Tento příkaz zpřístupní úroveň 3. Na úrovni 2 zkus „arp -a“.' };
  }
  if (lc === 'help' || lc === '?' || lc === '/?') {
    return { lines: ['', 'ipconfig        IP adresa, maska a brána', 'ipconfig /all   navíc MAC adresa (Physical Address)',
      'arp -a          ARP tabulka (IP -> MAC)', 'cls             vymazat okno', ''],
    note: 'Nápověda simulátoru (skutečný Windows má příkaz help jinak).' };
  }
  const word = cmd.split(' ')[0];
  if (['ping', 'tracert', 'nslookup', 'netstat', 'route', 'getmac'].includes(word.toLowerCase())) {
    return { lines: [''], note: `Příkaz ${word} v úrovni 2 není; přijde v dalších úrovních.` };
  }
  return { lines: [`'${word}' is not recognized as an internal or external command,`, 'operable program or batch file.', ''] };
}
