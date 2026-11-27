// Zjednodušené Cisco IOS pro router (úroveň 3, cmd.md kap. 12, rozhodnutí 45): režimy R1> a R1#
// (enable, disable), show ip route, show ip interface brief, show ip arp (= show arp), ping;
// traceroute se v úrovni 3 odmítne, konfigurace až v úrovni 5. Zkratky slov jako IOS. Bez DOM.
// opts = { mode: 'user' | 'priv', sim(command, args) -> { events, done }, highlight: prefix, arpClear() }.
import { helpLines } from './commands.js';
import { macCisco, maskString } from '../core/addr.js';
import { parsePrefix } from '../proto/ipv4.js';

export function routerPrompt(node, mode = 'user') {
  return `${node.label ?? node.id}${mode === 'priv' ? '#' : '>'}`;
}

const TREE = {
  enable: {}, disable: {}, exit: {}, end: {}, logout: {},
  show: { ip: { route: { connected: {}, static: {} }, interface: { brief: {} }, arp: {} }, arp: {},
    'running-config': {}, version: {} },
  ping: { $arg: true }, traceroute: { $arg: true },
  configure: { terminal: {} }, clear: { 'arp-cache': {} },
};
const PRIV_ONLY = new Set(['configure', 'clear', 'disable']);

function parse(line) {
  const parts = [];
  for (const m of line.matchAll(/\S+/g)) parts.push({ w: m[0], at: m.index });
  let node = TREE;
  const words = [];
  let arg = null;
  for (let i = 0; i < parts.length; i++) {
    const { w, at } = parts[i];
    if (node.$arg) { arg = parts.slice(i).map((p) => p.w).join(' '); break; }
    const cands = Object.keys(node).filter((k) => k !== '$arg' && k.startsWith(w.toLowerCase()));
    if (cands.length !== 1) return cands.length > 1 ? { ambiguous: true } : { error: true, at };
    words.push(cands[0]);
    node = node[cands[0]];
  }
  return { words, arg, leaf: node };
}

const FULL = (n) => n.replace(/^Gi/, 'GigabitEthernet').replace(/^Fa/, 'FastEthernet');
const CODES = ['Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
  '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
  '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
  '       E1 - OSPF external type 1, E2 - OSPF external type 2',
  '       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2',
  '       ia - IS-IS inter area, * - candidate default, U - per-user static route',
  '       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP',
  '       + - replicated route, % - next hop override', ''];

/** show ip route (cmd.md kap. 12.3): řazení podle sítě, „variably subnetted“ pro C + L. */
export function showIpRoute(node, { filter = null, highlight = null } = {}) {
  const routes = node.routing_table.filter((r) => !filter || filter.includes(r.type));
  const def = node.routing_table.find((r) => r.prefix === '0.0.0.0/0');
  const lines = [...CODES, def ? `Gateway of last resort is ${def.next_hop} to network 0.0.0.0` : 'Gateway of last resort is not set', ''];
  const key = (p) => parsePrefix(p).net.split('.').map((x) => x.padStart(3, '0')).join('.');
  const code = { connected: 'C', local: 'L', static: 'S', default: 'S*' };
  // skupiny podle hlavní (classful) sítě; tady stačí síť /24 připojeného rozhraní
  const groups = new Map();
  for (const r of [...routes].sort((a, b) => key(a.prefix).localeCompare(key(b.prefix)) || parsePrefix(a.prefix).len - parsePrefix(b.prefix).len)) {
    const net = r.type === 'local' ? node.routing_table.find((c) => c.type === 'connected' && c.if === r.if)?.prefix ?? r.prefix : r.prefix;
    if (!groups.has(net)) groups.set(net, []);
    groups.get(net).push(r);
  }
  const line = (r, indent) => {
    const c = code[r.type].padEnd(indent ? 9 : 6);
    const text = r.next_hop ? `${c}${r.prefix} [1/0] via ${r.next_hop}` : `${c}${r.prefix} is directly connected, ${FULL(r.if)}`;
    return r.prefix === highlight ? { text, mark: 'l3' } : text;
  };
  for (const [net, rs] of groups) {
    const masks = new Set(rs.map((r) => parsePrefix(r.prefix).len));
    if (rs.length > 1) {
      lines.push(`      ${net} is variably subnetted, ${rs.length} subnets, ${masks.size} masks`);
      for (const r of rs) lines.push(line(r, true));
    } else lines.push(line(rs[0], false));
  }
  return lines;
}

function showIpIntBrief(node) {
  const lines = ['Interface              IP-Address      OK? Method Status                Protocol'];
  for (const i of node.interfaces) {
    lines.push(`${FULL(i.name).padEnd(23)}${(i.ip ?? 'unassigned').padEnd(16)}YES ${(i.ip ? 'manual' : 'unset').padEnd(7)}${(i.down ? 'down' : 'up').padEnd(22)}${i.down ? 'down' : 'up'}`);
  }
  return lines;
}

function showIpArp(node) {
  const rows = [
    ...node.interfaces.filter((i) => i.ip).map((i) => ({ ip: i.ip, age: '-', mac: i.mac, if: i.name, own: true })),
    ...node.arp_cache.map((e) => ({ ip: e.ip, age: '0', mac: e.mac, if: e.if })),
  ].sort((a, b) => a.ip.split('.').map((x) => x.padStart(3, '0')).join('.').localeCompare(b.ip.split('.').map((x) => x.padStart(3, '0')).join('.')));
  const lines = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
  for (const r of rows) {
    const text = `Internet  ${r.ip.padEnd(17)}${r.age.padStart(8)}   ${macCisco(r.mac)}  ARPA   ${FULL(r.if)}`;
    lines.push(r.own ? text : { text, mark: 'l2' });
  }
  return lines;
}

function iosPing(target, run) {
  const ch = run.events.map((e) => ({ reply: '!', timeout: '.', unreachable: 'U', arp_failed: '.', ttl_exceeded: '&', no_route: '.' }[e.result.kind] ?? '?')).join('');
  const lines = ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`, ch];
  if (run.done) {
    const ok = run.events.filter((e) => e.result.kind === 'reply').length;
    lines.push(`Success rate is ${Math.round((ok / 5) * 100)} percent (${ok}/5)${ok ? ', round-trip min/avg/max = 1/1/1 ms' : ''}`);
  }
  return lines;
}

export function routerExec(node, line, opts = {}) {
  const mode = opts.mode ?? 'user';
  const prompt = routerPrompt(node, mode);
  const cmd = line.trim();
  if (cmd === '') return { lines: [] };
  if (cmd === '?') {
    return { lines: helpLines('router', opts.level), note: 'Nápověda simulátoru (zkrácená).' };
  }
  const p = parse(cmd);
  const caret = (at) => ({ lines: [`${' '.repeat(prompt.length + at)}^`, "% Invalid input detected at '^' marker.", ''] });
  if (p.ambiguous) return { lines: [`% Ambiguous command:  "${cmd}"`] };
  if (p.error) return caret(p.at);
  const w = p.words.join(' ');
  if (mode === 'user' && PRIV_ONLY.has(p.words[0])) return caret(0);
  if (w === 'enable') return { lines: [], mode: 'priv' };
  if (w === 'disable') return { lines: [], mode: 'user' };
  if (w === 'exit' || w === 'end' || w === 'logout') {
    return mode === 'priv' && w !== 'end' ? { lines: [], mode: 'user', note: 'Na skutečném routeru exit ukončí připojení; do R1> se vrátíš příkazem disable. Simulátor konzoli nechá otevřenou.' }
      : { lines: [], note: 'V simulátoru konzole zůstává otevřená; zavřeš ji tlačítkem Zavřít nebo Esc.' };
  }
  if (w === 'show ip route' || w === 'show ip route connected' || w === 'show ip route static') {
    const filter = p.words[3] === 'connected' ? ['connected', 'local'] : p.words[3] === 'static' ? ['static', 'default'] : null;
    return { lines: showIpRoute(node, { filter, highlight: opts.highlight }),
      note: opts.highlight ? `Podbarvený řádek ${opts.highlight} právě vybral router pro paket (nejdelší shoda prefixu).` : 'C = přímo připojená síť, L = adresa rozhraní routeru samotného (/32).' };
  }
  if (w === 'show ip interface brief') return { lines: showIpIntBrief(node), note: 'Simulátor zjednodušuje: skutečný router má víc rozhraní; tady jsou jen zapojená.' };
  if (w === 'show ip arp' || w === 'show arp') {
    return { lines: showIpArp(node), note: 'Řádky se stářím „-“ jsou adresy rozhraní routeru samotného. MAC Cisco píše s tečkami.' };
  }
  if (w === 'show running-config' || w === 'show version') return { lines: [], note: 'Tento výpis přijde v úrovni 5.' };
  if (w === 'show') return { lines: ['% Type "show ?" for a list of subcommands', ''] };
  if (w.startsWith('show')) return { lines: ['% Incomplete command.', ''] };
  if (w === 'traceroute') {
    return { lines: [], note: 'traceroute z routeru v této úrovni nejde, použij tracert na PC. (Cisco posílá UDP sondy, ne ICMP jako Windows; to přijde později.)' };
  }
  if (w === 'ping') {
    const target = p.arg?.split(' ')[0];
    if (!target) return { lines: ['% Incomplete command.', ''] };
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(target)) return { lines: ['% Unrecognized host or address, or protocol not running.', ''] };
    const run = opts.sim?.('ping', { dst: target, count: 5 });
    if (!run) return { lines: [''] };
    // poznámka o „.!!!!“ jen tehdy, když router opravdu čekal na ARP
    const arped = run.records?.some((r) => r.kind === 'arp_queue' && r.node === node.id);
    return { lines: iosPing(target, run), note: arped ? 'Skutečný Cisco router při čekání na ARP první paket zahodí (v Packet Traceru uvidíš „.!!!!“); simulátor ho drží ve frontě.' : undefined };
  }
  if (w.startsWith('configure')) return { lines: [], note: 'Konfigurace routeru přijde v úrovni 5. Teď si router jen prohlížíš (show).' };
  if (w === 'clear arp-cache') {
    opts.arpClear?.();
    return { lines: [], note: 'Simulátor: tabulka se vymaže jen pro tvé další příkazy v konzoli v tomto kroku; animace jde dál podle scénáře.' };
  }
  return { lines: ['% Incomplete command.', ''] };
}

export { maskString };
