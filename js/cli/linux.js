// Terminál Linuxu na serveru SRV1 (úroveň 4, cmd.md kap. 14 a 18): ss -tuln, ss -tan, ss -uan.
// Hodnoty ze stavu kroku (tabulka spojení, aplikace). Bez DOM.
import { helpLines } from './commands.js';
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
    for (const a of (node.apps ?? []).filter((x) => x.proto === 'udp' && x.port != null && x.running !== false)) rows.push(['udp', 'UNCONN', 0, 0, `0.0.0.0:${a.port}`, '0.0.0.0:*']);
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

// systemd jednotky simulovaných aplikací (Debian 13): web = nginx, dns = named (balík bind9)
const UNITS = { nginx: { app: 'web', desc: 'A high performance web server and a reverse proxy server', path: '/usr/lib/systemd/system/nginx.service' },
  named: { app: 'dns', desc: 'BIND Domain Name Server', path: '/usr/lib/systemd/system/named.service' } };
const unitOf = (name) => { const u = String(name ?? '').replace(/\.service$/, ''); return u === 'bind9' ? 'named' : u; };

// systemctl status|start|stop|restart <jednotka> (ulohy.md kap. 3.6). opts.service(app, running)
// = zásah v modelové situaci; bez něj (úroveň 4) službu jen ukáže.
function systemctl(node, args, sudo, opts) {
  const [verb, name] = args;
  if (!verb) return { lines: [], note: 'Simulátor umí systemctl status | start | stop | restart <služba>, například systemctl status nginx.' };
  const unit = unitOf(name);
  const u = UNITS[unit];
  if (!name) return { lines: [`Too few arguments.`] };
  if (!u) return { lines: [`Unit ${name.replace(/\.service$/, '')}.service could not be found.`], note: 'Na SRV1 běží nginx (web) a named (DNS).' };
  const apps = (node.apps ?? []).filter((a) => a.name === u.app);
  const running = apps.length && apps.every((a) => a.running !== false);
  if (verb === 'status' || verb === 'is-active') {
    if (verb === 'is-active') return { lines: [running ? 'active' : 'inactive'] };
    return { lines: [{ text: `${running ? '●' : '○'} ${unit}.service - ${u.desc}`, mark: running ? 'l3' : undefined },
      `     Loaded: loaded (${u.path}; enabled; preset: enabled)`,
      { text: running ? '     Active: active (running) since Fri 2026-11-27 08:00:00 CET; 1min ago' : '     Active: inactive (dead) since Fri 2026-11-27 07:55:00 CET; 5min ago', mark: running ? 'l3' : 'l2' }],
    note: 'Simulátor zjednodušuje: skutečný výpis má ještě PID, paměť a poslední řádky logu; časy jsou pevné.' };
  }
  if (!['start', 'stop', 'restart'].includes(verb)) return { lines: [`Unknown command verb '${verb}'.`] };
  if (!sudo) return { lines: [`Failed to ${verb} ${unit}.service: Access denied`, `See system logs and 'systemctl status ${unit}.service' for details.`], note: 'Spouštět a zastavovat služby smí jen správce: napiš před příkaz sudo.' };
  if (!opts.service) return { lines: [], note: 'Simulátor: ve scénáři úrovně 4 služby běží podle scénáře. Spouštět a zastavovat je můžeš v modelových situacích (Úlohy).' };
  const on = verb !== 'stop';
  opts.service(u.app, on);
  const note = u.app === 'dns' && on && running ? 'DNS (named, UDP 53) už běžel. Webová služba je nginx (TCP 80).'
    : on ? `Služba ${unit} běží a otevřela naslouchající socket (ověř ss -tuln). Simulátor zjednodušuje: sudo se neptá na heslo.` : `Služba ${unit} je zastavená: její socket zmizel.`;
  return { lines: [], note };
}

export function linuxExec(node, line, opts = {}) {
  let cmd = line.trim().replace(/\s+/g, ' ');
  if (!cmd) return { lines: [] };
  let sudo = false;
  if (cmd.startsWith('sudo ')) { sudo = true; cmd = cmd.slice(5); }
  const [word, ...args] = cmd.split(' ');
  if (word === 'systemctl') return systemctl(node, args, sudo, opts);
  if (word === 'service' && args.length >= 2) return systemctl(node, [args[1], args[0]], sudo, opts);
  if (word === 'clear') return { lines: [], clear: true };
  if (word === 'ss') {
    const flags = args.filter((a) => a.startsWith('-')).map((a) => a.slice(1)).join('');
    return { lines: ss(node, flags), note: flags.includes('l') ? 'LISTEN = aplikace čeká na klienty; UDP nemá spojení, proto UNCONN. Send-Q u LISTEN = velikost fronty nových spojení (ověřit).'
      : 'ESTAB = spojení běží. Šířky sloupců počítá ss podle obsahu (simulátor je zarovnává pevně).' };
  }
  if (word === 'netstat') return { lines: [`Command 'netstat' not found, but can be installed with:`, 'sudo apt install net-tools'], note: 'Na nových Linuxech je netstat nahrazený příkazem ss (zkus ss -tuln).' };
  if (word === 'help') return { lines: helpLines('server'), note: 'Nápověda simulátoru.' };
  return { lines: [`${word}: command not found`] };
}
