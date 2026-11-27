// Konfigurace IPv4 hostitele pro modelové situace (docs/spec/ulohy.md kap. 2 a 3): validace dialogu
// „Vlastnosti protokolu IPv4“ jako Windows, APIPA (RFC 3927), detekce konfliktu adres (RFC 5227,
// zjednodušeně bez kreslení ARP Probe) a odvození „efektivní“ topologie, kterou dostane simulace.
// Bez DOM.
import { ipToInt, intToIp, prefixMask, networkOf, broadcastOf, sameSubnet } from './addr.js';

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
export const isIpText = (s) => IP_RE.test(String(s ?? '').trim());

// Maska 255.255.255.0 -> 24; nespojitá maska -> null.
export function maskToPrefix(mask) {
  if (!isIpText(mask)) return null;
  const n = ipToInt(mask);
  for (let p = 0; p <= 32; p++) if ((prefixMask(p) >>> 0) === (n >>> 0)) return p;
  return null;
}

// Výchozí maska podle třídy (Windows ji předvyplní po opuštění pole IP).
export function classMask(ip) {
  const a = Number(String(ip).split('.')[0]);
  if (a >= 1 && a <= 126) return '255.0.0.0';
  if (a >= 128 && a <= 191) return '255.255.0.0';
  if (a >= 192 && a <= 223) return '255.255.255.0';
  return '';
}

// APIPA 169.254.x.y deterministicky z MAC (x i y v 1–254; RFC 3927 kap. 2.1 dovoluje odvození z MAC).
export function apipaOf(mac) {
  const b = String(mac).split(/[:-]/).map((h) => parseInt(h, 16));
  const x = 1 + ((b[4] * 7 + b[3]) % 254), y = 1 + ((b[5] * 13 + b[4] + 83) % 254);
  return `169.254.${x}.${y}`;
}

// Kontrola jedné adresy v poli dialogu. Vrací text chyby (česky, s originálem Windows) nebo null.
function octetError(value, { first = true } = {}) {
  const parts = String(value).trim().split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return { cs: 'Adresa musí mít 4 čísla 0 až 255 oddělená tečkou.', win: '' };
  const n = parts.map(Number);
  const bad = n.find((x) => x > 255);
  if (bad != null) return { cs: `${bad} není platná hodnota: zadej číslo od 0 do 255.`, win: `${bad} is not a valid entry. Please specify a value between 0 and 255.` };
  if (first && n[0] === 127) return { cs: 'Adresy 127.x.x.x jsou loopback (sám sebe), počítači je přidělit nejde.', win: 'IP addresses starting with 127 are not valid because they are reserved for loopback addresses.' };
  if (first && (n[0] === 0 || n[0] >= 224)) return { cs: `${n[0]} na začátku adresy nejde: zadej číslo od 1 do 223.`, win: `${n[0]} is not a valid entry. Please specify a value between 1 and 223.` };
  return null;
}

/**
 * Validace dialogu IPv4 (ulohy.md kap. 2.2). form = { mode: 'dhcp' | 'static', ip, mask, gateway,
 * dnsMode: 'auto' | 'static', dns1, dns2 }. Vrací { errors: [{field, cs, win}], warnings: [...], cfg }.
 * Tvrdé chyby Windows odmítne, varování (brána mimo síť) nechá potvrdit, zbytek přijme bez řečí.
 */
export function validateIpv4(form) {
  const errors = [], warnings = [];
  const t = (s) => String(s ?? '').trim();
  const cfg = { mode: form.mode === 'dhcp' ? 'dhcp' : 'static', ip: null, prefix: null, gateway: null, dns: [] };
  if (cfg.mode === 'static') {
    const ip = t(form.ip), mask = t(form.mask), gw = t(form.gateway);
    if (!ip) errors.push({ field: 'ip', cs: 'Vyplň IP adresu (nebo zvol „Získat adresu IP automaticky“).', win: 'You must enter an IP address.' });
    else { const e = octetError(ip); if (e) errors.push({ field: 'ip', ...e }); }
    if (!mask) errors.push({ field: 'mask', cs: 'Vyplň masku podsítě.', win: 'You must enter a subnet mask.' });
    else if (octetError(mask, { first: false }) || maskToPrefix(mask) == null || maskToPrefix(mask) === 0) {
      errors.push({ field: 'mask', cs: 'Maska není platná: jedničky musí jít zleva souvisle (např. 255.255.255.0).', win: 'The subnet mask you have entered is not valid. Enter a valid subnet mask.' });
    }
    if (gw) { const e = octetError(gw); if (e) errors.push({ field: 'gateway', ...e }); }
    if (!errors.length) {
      const prefix = maskToPrefix(mask);
      if (prefix < 31) {
        if (ip === networkOf(ip, prefix)) errors.push({ field: 'ip', cs: 'Tohle je adresa sítě (část pro zařízení samé nuly). Počítači ji přidělit nejde.', win: 'The combination of IP address and subnet mask is invalid. All of the bits in the host address portion of the IP address are set to 0.' });
        else if (ip === broadcastOf(ip, prefix)) errors.push({ field: 'ip', cs: 'Tohle je broadcast sítě (část pro zařízení samé jedničky). Počítači ji přidělit nejde.', win: 'The combination of IP address and subnet mask is invalid. All of the bits in the host address portion of the IP address are set to 1.' });
      }
      Object.assign(cfg, { ip, prefix, gateway: gw || null });
      if (gw && !sameSubnet(gw, ip, prefix)) {
        warnings.push({ field: 'gateway', cs: 'Výchozí brána není ve stejné síti (podsíti) jako IP adresa s maskou. Uložit i tak?', win: 'The default gateway is not on the same network segment (subnet) that is defined by the IP address and subnet mask. Do you want to save this configuration?' });
      }
    }
  }
  if (form.dnsMode !== 'auto' || cfg.mode === 'static') {
    for (const [field, v] of [['dns1', t(form.dns1)], ['dns2', t(form.dns2)]]) {
      if (!v) continue;
      const e = octetError(v);
      if (e) errors.push({ field, ...e }); else cfg.dns.push(v);
    }
  }
  return { errors, warnings, cfg };
}

// Uzly ve stejné doméně L2 jako rozhraní (přes switch/hub a zapojené kabely); vrací [{node, if}].
export function l2Peers(topology, nodeId, ifName) {
  const byId = Object.fromEntries(topology.nodes.map((n) => [n.id, n]));
  const out = [], seen = new Set([nodeId]);
  const stack = [[nodeId, ifName]];
  while (stack.length) {
    const [id, port] = stack.pop();
    for (const l of topology.links) {
      if (l.connected === false) continue;
      for (const [me, other] of [[l.a, l.b], [l.b, l.a]]) {
        if (me.node !== id || (port && me.if !== port)) continue;
        if (seen.has(other.node)) continue;
        seen.add(other.node);
        const t = byId[other.node]?.type;
        if (t === 'switch' || t === 'hub') stack.push([other.node, null]);
        else out.push({ node: other.node, if: other.if });
      }
    }
  }
  return out;
}

/**
 * Efektivní topologie pro simulaci: hostitel s `ipv4_config` (dialog) dostane adresu podle režimu:
 * DHCP bez serveru -> APIPA 169.254.x.y/16; statická adresa, kterou už v síti někdo má, a uzel má
 * detekci konfliktu (`acd`, výchozí pro PC a server) a nastavil ji později -> Windows ji nepoužije
 * (Duplicate) a vezme APIPA. Vrací kopii topologie; uzly mají navíc `addr_state`
 * ({ apipa, duplicate, dhcp, conflictWith }) pro ipconfig a vyhodnocení.
 */
export function effectiveTopology(topology) {
  const topo = JSON.parse(JSON.stringify(topology));
  for (const n of topo.nodes) {
    const c = n.ipv4_config;
    if (!c) continue;
    const i = n.interfaces[0];
    if (c.mode === 'dhcp') {
      Object.assign(i, { ip: apipaOf(i.mac), prefix: 16 });
      delete n.gateway;
      n.dns_servers = [...(c.dns ?? [])];   // ručně zadaný DNS platí i bez DHCP
      n.addr_state = { dhcp: true, apipa: true };
    } else {
      Object.assign(i, { ip: c.ip, prefix: c.prefix });
      if (c.gateway) n.gateway = c.gateway; else delete n.gateway;
      n.dns_servers = [...(c.dns ?? [])];
      n.addr_state = {};
    }
  }
  // konflikt adres: uzel s detekcí, který adresu nastavil později než ten, kdo ji už má
  for (const n of topo.nodes) {
    const c = n.ipv4_config;
    if (!c || c.mode !== 'static' || (n.acd ?? true) === false) continue;
    const i = n.interfaces[0];
    const holder = l2Peers(topo, n.id, i.name).map((p) => topo.nodes.find((x) => x.id === p.node))
      .find((o) => (o.interfaces ?? []).some((x) => x.ip === i.ip) && (o.cfg_seq ?? 0) <= (n.cfg_seq ?? 0) && o.id !== n.id);
    if (!holder) continue;
    n.addr_state = { duplicate: i.ip, conflictWith: holder.id, apipa: true };
    Object.assign(i, { ip: apipaOf(i.mac), prefix: 16 });
    delete n.gateway;
  }
  return topo;
}

// Dvojice zařízení se stejnou IP ve stejné doméně L2 (po efektivní adrese). Vrací [{ ip, nodes: [id…] }].
export function addressConflicts(topo) {
  const out = [];
  const seen = new Set();
  for (const n of topo.nodes) {
    for (const i of n.interfaces ?? []) {
      if (!i.ip || seen.has(`${n.id}|${i.ip}`)) continue;
      const same = l2Peers(topo, n.id, i.name).filter((p) => {
        const o = topo.nodes.find((x) => x.id === p.node);
        return (o.interfaces ?? []).some((x) => x.name === p.if && x.ip === i.ip);
      }).map((p) => p.node);
      if (!same.length) continue;
      const nodes = [n.id, ...same];
      nodes.forEach((id) => seen.add(`${id}|${i.ip}`));
      out.push({ ip: i.ip, nodes });
    }
  }
  return out;
}

export { ipToInt, intToIp };
