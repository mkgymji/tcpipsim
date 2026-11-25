// Příkazový řádek Windows, úroveň 4 (cmd.md kap. 14–17): nslookup, netstat -an, curl (-v).
// Výstupy anglicky (rozhodnutí 10), hodnoty ze stavu kroku; nslookup a curl spouští opts.sim
// (živý běh scénáře, nebo samostatná simulace ze stavu kroku). Bez DOM.
import { STATE_WIN } from '../proto/tcp.js';

const isIp = (s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Řádky `netstat -an` (cmd.md kap. 16): TCP podle místní adresy, pak UDP. */
export function netstatLines(node) {
  const row = (p, l, r, s = '') => `  ${p.padEnd(7)}${l.padEnd(23)}${r.padEnd(23)}${s}`.trimEnd();
  const tcp = [...(node.tcp_connections ?? [])].sort((a, b) => (a.local < b.local ? -1 : a.local > b.local ? 1 : 0));
  const udp = (node.apps ?? []).filter((a) => a.proto === 'udp' && a.port != null);
  return ['', 'Active Connections', '', row('Proto', 'Local Address', 'Foreign Address', 'State'),
    ...tcp.map((c) => ({ text: row('TCP', c.local, c.remote, STATE_WIN[c.state] ?? c.state), mark: c.state === 'LISTEN' ? undefined : 'l3' })),
    ...udp.map((a) => row('UDP', `0.0.0.0:${a.port}`, '*:*')), ''];
}

/** Výpis nslookup (cmd.md kap. 15). r = { timeouts, result } (result = výsledek dns_resolve, nebo null = běží). */
export function formatNslookup(name, server, r) {
  const out = [];
  for (let i = 0; i < (r.timeouts ?? 0); i++) out.push('DNS request timed out.', '    timeout was 2 seconds.');
  out.push('Server:  UnKnown', `Address:  ${server}`, '');
  const res = r.result;
  if (!res) return out;
  if (res.kind === 'timeout') { out.push(`*** Request to UnKnown timed-out`, ''); return out; }
  if (res.rcode === 3) out.push(`*** UnKnown can't find ${name}: Non-existent domain`, '');
  else if (res.rcode === 5) out.push(`*** UnKnown can't find ${name}: Query refused`, '');
  else for (const a of res.answers) out.push({ text: `Name:    ${a.name}`, mark: 'l3' }, { text: `Address:  ${a.data}`, mark: 'l3' }, '');
  return out;
}

/** Výpis curl (cmd.md kap. 17). r = { result, dst, local } z běhu http_get. */
export function formatCurl(url, verbose, r) {
  const m = /^(?:http:\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url);
  const host = m[1], port = Number(m[2] ?? 80), path = m[3] ?? '/';
  const res = r.result;
  const out = [];
  if (!res) return { lines: [''], note: 'curl běží: výpis se doplní, jak budeš krokovat (Vpřed).' };
  if (res.kind === 'dns_failed') return { lines: [`curl: (6) Could not resolve host: ${host}`, ''] };
  const ip = r.dst;
  if (verbose) {
    if (!isIp(host)) out.push(`* Host ${host}:${port} was resolved.`, '* IPv6: (none)', `* IPv4: ${ip}`);
    out.push(`*   Trying ${ip}:${port}...`);
  }
  if (res.kind === 'refused') {
    const msg = `Failed to connect to ${host} port ${port} after 4 ms: Couldn't connect to server`;
    if (verbose) out.push(`* connect to ${ip} port ${port} from ${res.local?.split(':')[0]} port ${res.local?.split(':')[1]} failed: Connection refused`, `* ${msg}`, '* closing connection #0');
    out.push(`curl: (7) ${msg}`, '');
    return { lines: out, note: 'SRV1 odpověděl RST: na portu nikdo nenaslouchá. Přesné znění hlášky curl ověřujeme při pilotu.' };
  }
  if (res.kind !== 'response') return { lines: [`curl: (28) Connection timed out`, ''] };
  const text = res.text ?? '';
  const [head, body = ''] = text.split('\r\n\r\n');
  if (verbose) {
    out.push(`* Connected to ${host} (${ip}) port ${port}`,
      ...`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: curl/8.9.1\r\nAccept: */*`.split('\r\n').map((l) => ({ text: `> ${l}`, mark: 'l3' })), '>',
      '* Request completely sent off', ...head.split('\r\n').map((l) => ({ text: `< ${l}`, mark: 'l2' })), '<');
  }
  out.push(...body.replace(/\n$/, '').split('\n'));
  if (verbose) out.push(`* Connection #0 to host ${host} left intact`);
  out.push('');
  return { lines: out, note: `${verbose ? '> = co curl poslal, < = co přišlo. ' : ''}V PowerShellu piš curl.exe (curl je tam jiný příkaz). Simulátor zjednodušuje: verze curl je pevná 8.9.1.` };
}

// Vrací výsledek, nebo null (příkaz patří nižší úrovni).
export function winExec4(node, cmd, lc, opts) {
  const parts = cmd.split(' ');
  const word = parts[0].toLowerCase();
  if (lc === 'netstat -an' || lc === 'netstat -a -n' || lc === 'netstat -na') {
    return { lines: netstatLines(node), note: 'Simulátor zjednodušuje: jen sockety simulovaných aplikací; skutečný Windows jich ukáže desítky. Spojení DNS (UDP) je vidět jen během dotazu.' };
  }
  if (word === 'netstat' && !/^netstat -(nr|rn|r)$/.test(lc)) {
    return { lines: [''], note: 'Simulátor umí netstat -an (a netstat -nr). Přepínače -p tcp a -o (PID) vyzkoušej na školním PC.' };
  }
  if (word === 'nslookup') {
    const name = parts[1];
    if (!name) return { lines: ['Default Server:  UnKnown', `Address:  ${node.dns_servers?.[0] ?? ''}`, '', '> '], note: 'Interaktivní režim nslookup simulátor nemá; zadej nslookup jméno.' };
    const r = opts.sim?.('nslookup', { name });
    if (!r) return { lines: [''], note: 'Simulace pro tento příkaz tu není k dispozici.' };
    return { lines: formatNslookup(name, node.dns_servers?.[0] ?? '?', r),
      note: r.timeouts ? 'UDP dotaz nic nepotvrzuje: zopakoval ho až nslookup (aplikace) po 2 s.'
        : 'nslookup se ptá DNS serveru přímo (cache nepoužívá). Server UnKnown: SRV1 nemá reverzní záznam pro svou adresu (ověřit při pilotu).' };
  }
  if (word === 'curl' || word === 'curl.exe') {
    const verbose = parts.includes('-v');
    const url = parts.slice(1).find((x) => !x.startsWith('-'));
    if (!url) return { lines: ["curl: try 'curl --help' for more information", ''] };
    const m = /^(?:http:\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url);
    if (!m || /^https:/i.test(url)) return { lines: [''], note: 'Simulátor umí jen http:// (HTTPS a TLS jsou mimo rozsah).' };
    const r = opts.sim?.('curl', { host: m[1], port: Number(m[2] ?? 80), path: m[3] ?? '/' });
    if (!r) return { lines: [''], note: 'Simulace pro tento příkaz tu není k dispozici.' };
    return formatCurl(url, verbose, r);
  }
  if (lc === 'ipconfig /displaydns') {
    const c = node.dns_cache ?? [];
    if (!c.length) return { lines: ['', 'Windows IP Configuration', '', 'Could not display the DNS Resolver Cache.', ''] };
    return { lines: ['', 'Windows IP Configuration', '', ...c.flatMap((e) => [`    ${e.name}`, '    ----------------------------------------',
      `    Record Name . . . . . : ${e.name}`, '    Record Type . . . . . : 1', `    Time To Live  . . . . : ${e.ttl}`,
      '    Data Length . . . . . : 4', '    Section . . . . . . . : Answer', `    A (Host) Record . . . : ${e.data}`, ''])],
    note: 'DNS cache operačního systému: sem se uloží odpověď pro prohlížeč a curl (nslookup cache nepoužívá).' };
  }
  if (lc === 'help' || lc === '?' || lc === '/?') {
    return { lines: ['', 'ipconfig /all     adresy a DNS server', 'nslookup <jméno>  DNS dotaz (jméno -> IP)', 'netstat -an       sockety: LISTENING, ESTABLISHED, TIME_WAIT',
      'curl -v <URL>     HTTP požadavek a odpověď', 'ping <IP>         ICMP Echo', 'arp -a            ARP tabulka', 'ipconfig /displaydns  DNS cache', 'cls               vymazat okno', ''],
    note: 'Nápověda simulátoru (skutečný Windows má příkaz help jinak).' };
  }
  return null;
}
