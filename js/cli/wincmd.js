// Příkazový řádek Windows: úroveň 2 ipconfig, ipconfig /all, arp -a; úroveň 3 navíc ping, tracert,
// arp -d, route print, netstat -nr (docs/spec/cmd.md kap. 7–11). Výstupy anglicky (rozhodnutí 10),
// hodnoty ze stavu simulace v daném kroku. Bez DOM.
// Vstup: node = uzel z pohledu (label, ip, prefix, mac, gateway, arp_cache, routing_table);
// opts = { level, sim(command, args) -> { events, done } (ping/tracert z jádra), arpDelete(ip | null) }.
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

function ipconfig(node, all, level = 2) {
  const out = ['', 'Windows IP Configuration', ''];
  if (all) {
    out.push(`${dots('host')}${hostName(node)}`, `${dots('dnsSuffix')}`, `${dots('node')}Hybrid`,
      `${dots('routing')}No`, `${dots('wins')}No`);
  }
  // mezi „Windows IP Configuration“ a adaptérem jsou dva prázdné řádky (cmd.md kap. 2)
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
  if (!node.gateway && level < 3) note.push('Výchozí brána (Default Gateway) je prázdná: síť je jen jedna, bez routeru (úroveň 3).');
  // úroveň 3: bez diagnózy (rozhodnutí 51), student ji má najít sám
  return { lines: out, note: note.join(' ') };
}

const col = (s, w) => String(s).padEnd(w);

function arpA(node, level = 2) {
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
  const note = level >= 3 ? [rows.length
    ? `Záznamy dynamic vznikly z ARP zpráv: jsou to jen sousedé ve stejné síti (${node.label ?? 'počítač'} nikdy nezná MAC počítače za routerem).`
    : `Simulátor: ${node.label ?? 'počítač'} nemá žádný záznam typu dynamic, žádnou MAC si zatím nezapamatoval.`,
  'Řádky static patří broadcastu a multicastu: adresy „všem“ a „skupině“, ty Windows zná vždy.'] : [rows.length
    ? `Simulátor zjednodušuje: ${node.label ?? 'počítač'} MAC adresu už zná (předvyplněná ARP tabulka); jak ji zjistí, uvidíš v úrovni 3.`
    : `Simulátor: ${node.label ?? 'počítač'} nemá žádný záznam typu dynamic, žádnou MAC si nezapamatoval.`,
  'Řádky static (broadcast, multicast) má Windows vždy; vysvětlíme je v úrovni 3.'];
  return { lines, note: note.join(' ') };
}

// ---- úroveň 3: ping, tracert, route print (cmd.md kap. 8, 9, 11) ----

const isIp = (x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x) && x.split('.').every((o) => Number(o) <= 255);

/** Výpis Windows ping z událostí dotazů (events: [{ seq, result }]); `done` = statistika. */
export function formatPing(dst, events, done) {
  const lines = ['', `Pinging ${dst} with 32 bytes of data:`];
  let counted = 0, real = 0;
  for (const e of events) {
    const r = e.result;
    if (r.kind === 'reply') { lines.push({ text: `Reply from ${r.from}: bytes=${r.bytes ?? 32} time<1ms TTL=${r.ttl}`, mark: 'l3' }); counted++; real++; }
    else if (r.kind === 'no_route') lines.push('PING: transmit failed. General failure.');
    else if (r.kind === 'arp_failed') { lines.push(`Reply from ${r.from}: Destination host unreachable.`); counted++; }
    else if (r.kind === 'unreachable') { lines.push(`Reply from ${r.from}: Destination ${r.code === 0 ? 'net' : 'host'} unreachable.`); counted++; }
    else if (r.kind === 'ttl_exceeded') { lines.push(`Reply from ${r.from}: TTL expired in transit.`); counted++; }
    else lines.push('Request timed out.');
  }
  if (!done) return lines;
  const sent = events.length, lost = sent - counted;
  lines.push('', `Ping statistics for ${dst}:`,
    `    Packets: Sent = ${sent}, Received = ${counted}, Lost = ${lost} (${sent ? Math.round((lost / sent) * 100) : 0}% loss),`);
  if (real) lines.push('Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 0ms, Average = 0ms');
  lines.push('');
  return lines;
}

/** Výpis Windows tracert -d (events: [{ ttl, probe, result }]); řádek skoku až po všech sondách. */
export function formatTracert(dst, events, done, probes = 3) {
  const lines = ['', `Tracing route to ${dst} over a maximum of 30 hops`, ''];
  if (events[0]?.result.kind === 'no_route') return [...lines, 'General failure.', ''];   // cmd.md kap. 9: znění ověřit
  const hops = [];
  for (const e of events) {
    let h = hops.find((x) => x.ttl === e.ttl);
    if (!h) { h = { ttl: e.ttl, res: [] }; hops.push(h); }
    h.res.push(e.result);
  }
  for (const h of hops) {
    const err = h.res.find((r) => ['arp_failed', 'unreachable'].includes(r.kind));
    if (err) {
      lines.push(`${String(h.ttl).padStart(3)}  ${err.from}  reports: Destination ${err.code === 0 ? 'net' : 'host'} unreachable.`);
      continue;
    }
    if (h.res.length < probes && !done) break;
    const times = h.res.map((r) => (r.kind === 'timeout' ? '     *   ' : '    <1 ms')).join('');
    const from = h.res.find((r) => r.kind !== 'timeout')?.from;
    lines.push({ text: `${String(h.ttl).padStart(3)}${times}  ${from ?? 'Request timed out.'}`, mark: from ? 'l3' : undefined });
  }
  if (done) lines.push('', 'Trace complete.', '');
  return lines.map((l) => (typeof l === 'object' && !l.mark ? l.text : l));
}

function routePrint(node) {
  const rows = [];
  const def = node.routing_table.find((r) => r.prefix === '0.0.0.0/0');
  if (def) rows.push(['0.0.0.0', '0.0.0.0', def.next_hop, node.ip, '25']);
  for (const r of node.routing_table.filter((x) => x.type === 'connected')) {
    const [net, len] = r.prefix.split('/');
    rows.push([net, maskString(Number(len)), 'On-link', node.ip, '281']);
  }
  const bar = '===========================================================================';
  const lines = ['', 'IPv4 Route Table', bar, 'Active Routes:',
    'Network Destination        Netmask          Gateway       Interface  Metric'];
  for (const r of rows) {
    lines.push({ text: `${r[0].padStart(17)}${r[1].padStart(17)}${r[2].padStart(17)}${r[3].padStart(17)}${r[4].padStart(7)}`, mark: 'l3' });
  }
  lines.push(bar, 'Persistent Routes:');
  if (def) lines.push('  Network Address          Netmask  Gateway Address  Metric', `${'0.0.0.0'.padStart(17)}${'0.0.0.0'.padStart(17)}${def.next_hop.padStart(17)}  Default`);
  else lines.push('  None');
  lines.push(bar, '');
  const n = rows.length === 1 ? 'jeden skutečný řádek (síť)' : `${rows.length} skutečné řádky (síť a výchozí cesta)`;
  return { lines, note: `Simulátor zjednodušuje: jen sekce IPv4 a ${n}. Skutečný Windows vypíše navíc seznam rozhraní, řádky pro loopback, multicast a broadcast a tabulku IPv6; rozhodování je stejné.` };
}

// Úroveň 3: příkazy, které potřebují simulaci nebo jsou až od úrovně 3.
function winExec3(node, cmd, lc, opts) {
  const parts = cmd.split(' ');
  const word = parts[0].toLowerCase();
  if (word === 'ping' || word === 'tracert') {
    const args = parts.slice(1);
    let count = 4;
    const target = args.filter((a, i) => !a.startsWith('-') && !(args[i - 1] && /^-[nhwi]$/i.test(args[i - 1])))[0];
    const n = args.findIndex((a) => a.toLowerCase() === '-n');
    if (word === 'ping' && n >= 0) count = Math.max(1, Math.min(10, Number(args[n + 1]) || 4));
    if (!target) {
      return { lines: ['', word === 'ping' ? 'Usage: ping [-n count] target_name' : 'Usage: tracert [-d] target_name', ''],
        note: `Simulátor zkracuje nápovědu. Zkus například „${word} 192.168.2.20“.` };
    }
    if (word === 'ping' && isIp(target) && (target.endsWith('.255') || /\.0$/.test(target))) {
      return { lines: [''], note: 'Ping na adresu sítě nebo broadcast simulátor zatím neumí.' };
    }
    if (!isIp(target)) {
      return { lines: [word === 'ping' ? `Ping request could not find host ${target}. Please check the name and try again.`
        : `Unable to resolve target system name ${target}.`, ''], note: 'Jména počítačů překládá DNS; to přijde v úrovni 4. Zadej IP adresu.' };
    }
    const run = opts.sim?.(word, word === 'ping' ? { dst: target, count } : { dst: target, max_hops: 30, probes: 3, resolve: false });
    if (!run) return { lines: [''], note: 'Simulace pro tento příkaz tu není k dispozici.' };
    if (word === 'ping') {
      const lines = formatPing(target, run.events, run.done);
      const notes = [];
      if (!run.done) notes.push('Ping běží: odpovědi se doplní, jak budeš krokovat (Vpřed).');
      if (run.done && run.events.some((e) => ['arp_failed', 'unreachable', 'ttl_exceeded'].includes(e.result.kind))) notes.push('Pozor: Windows tu počítá jako přijaté i chybové hlášení, ne odpověď cíle. Ping se nepovedl. (Znění ověřujeme při pilotu.)');
      if (run.events.some((e) => e.result.kind === 'no_route')) notes.push('Přesné znění hlášky bez brány ověřujeme při pilotu.');
      if (run.done && run.events.some((e) => e.result.kind === 'reply')) notes.push('Simulátor zjednodušuje: časy <1 ms jsou orientační.');
      return { lines, note: notes.join(' ') || undefined };
    }
    const lines = formatTracert(target, run.events, run.done);
    const notes = [];
    if (!run.done) notes.push('tracert běží: řádky přibývají, jak budeš krokovat (Vpřed).');
    if (!parts.some((p) => p.toLowerCase() === '-d')) notes.push('Bez DNS se jména nezjišťují (DNS v úrovni 4), výpis je stejný jako s -d.');
    if (run.events[0]?.result.kind === 'no_route') notes.push('Přesné znění hlášky bez brány ověřujeme při pilotu.');
    notes.push('Simulátor animuje jednu sondu na skok, Windows posílá tři: výpis ukazuje všechny tři.');
    return { lines, note: notes.join(' ') };
  }
  if (lc.startsWith('arp -d') || lc.startsWith('arp /d')) {
    const ip = parts[2] && parts[2] !== '*' ? parts[2] : null;
    if (ip && !node.arp_cache.some((e) => e.ip === ip)) return { lines: ['The ARP entry deletion failed: The parameter is incorrect.', ''] };
    opts.arpDelete?.(ip);
    return { lines: [], note: 'Na školním PC potřebuješ příkazový řádek spuštěný jako správce. Simulátor: tabulka se vymaže jen pro tvé další příkazy v terminálu v tomto kroku; animace scénáře jde dál podle scénáře.' };
  }
  if (lc === 'route print' || lc === 'route print -4' || lc === 'netstat -nr' || lc === 'netstat -rn' || lc === 'netstat -r') return routePrint(node);
  if (lc === 'help' || lc === '?' || lc === '/?') {
    return { lines: ['', 'ipconfig          IP adresa, maska a brána', 'ipconfig /all     navíc MAC adresa (Physical Address)',
      'arp -a            ARP tabulka (IP -> MAC)', 'arp -d            smaže dynamické záznamy ARP', 'ping <IP>         ICMP Echo, 4 dotazy (-n N)',
      'tracert <IP>      cesta skok po skoku', 'route print       směrovací tabulka (= netstat -nr)', 'cls               vymazat okno', ''],
    note: 'Nápověda simulátoru (skutečný Windows má příkaz help jinak).' };
  }
  if (['nslookup', 'netstat', 'getmac', 'route'].includes(word)) {
    return { lines: [''], note: `Příkaz ${parts[0]} v této podobě v úrovni 3 není; zkus route print nebo netstat -nr.` };
  }
  return null;
}

// Vrací { lines: (string | {text, mark})[], note?: string, clear?: true }.
export function winExec(node, line, opts = {}) {
  const level = opts.level ?? 2;
  // přepínač smí být přilepený k příkazu jako ve Windows: ipconfig/all, arp/a
  const cmd = line.trim().replace(/\s+/g, ' ').replace(/^(ipconfig|arp)(?=[/-])/i, '$1 ');
  const lc = cmd.toLowerCase();
  if (lc === '') return { lines: [] };
  if (lc === 'ipconfig') return ipconfig(node, false, level);
  if (lc === 'ipconfig /all' || lc === 'ipconfig -all') return ipconfig(node, true, level);
  if (lc.startsWith('ipconfig ')) {
    // skutečný Windows pod chybou vypíše ještě dlouhou nápovědu (USAGE)
    return { lines: ['', 'Error: unrecognized or incomplete command line.', ''],
      note: 'Simulátor zkracuje: skutečný Windows pod chybou vypíše ještě nápovědu. Zkus „ipconfig“ nebo „ipconfig /all“.' };
  }
  if (lc === 'arp -a' || lc === 'arp -g' || lc === 'arp /a') return arpA(node, level);
  if (lc === 'cls') return { lines: [], clear: true };
  if (level >= 3) {
    const r = winExec3(node, cmd, lc, opts);
    if (r) return r;
  }
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
