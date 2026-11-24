// Přehrání testovacího vektoru (docs/spec/vektory.md) jádrem a porovnání s očekáváním.
// runVector: topologie + initial_state + actions -> přenosy, události, koncový stav, výsledek aplikací.
// compareVector: pravidla vektory.md kap. 5–7 (pořadí na (linka, směr) přesně, step, částečná
// shoda polí, MAC bez ohledu na velikost písmen, tabulky jako množiny bez `age`).
// Bez DOM.
import { runNetwork, DEFAULT_DELAY } from './netsim.js';
import { buildWorld } from './netsim.js';
import { normMac } from './addr.js';

// Příkazy, které jádro zatím neumí (ARP a ICMP přijdou v úrovni 3).
const UNSUPPORTED = { ping: 'ping (ICMP a ARP) přijde s úrovní 3' };

export const EVENT_KINDS = ['nic_drop', 'arp_learn', 'arp_ignore', 'arp_queue', 'mac_learn', 'flood', 'forward',
  'filter', 'repeat', 'ip_forward', 'ip_deliver', 'ip_drop', 'udp_send', 'udp_deliver', 'udp_no_listener'];

// Důvod, proč vektor zatím nejde přehrát (null = jde).
export function vectorSkipReason(vector) {
  for (const a of vector.actions) if (UNSUPPORTED[a.command]) return UNSUPPORTED[a.command];
  return null;
}

const hex4 = (n) => `0x${n.toString(16).padStart(4, '0')}`;

// PDU jádra -> tvar `pdu` z vektorů (eth, ip, udp, data, frame_len).
export function vectorPdu(frame, bytes) {
  const out = {};
  let p = frame;
  for (; p && typeof p === 'object'; p = p.payload) {
    if (p.proto === 'ethernet') out.eth = { dst: p.h.dst, src: p.h.src, ethertype: hex4(p.h.ethertype) };
    else if (p.proto === 'ipv4') {
      out.ip = { src: p.h.src, dst: p.h.dst, ttl: p.h.ttl, protocol: p.h.protocol, id: p.h.id };
    } else if (p.proto === 'udp') out.udp = { sport: p.h.sport, dport: p.h.dport };
    else if (p.proto === 'data') {
      const len = new TextEncoder().encode(p.payload).length;
      out.data = { text: p.payload, len };
    }
  }
  // délky z bajtů (vektor tak testuje i kódování, VYVOJ.md kap. 8)
  if (out.ip) out.ip.total_length = (bytes[16] << 8) | bytes[17];
  if (out.udp) out.udp.length = (bytes[38] << 8) | bytes[39];
  out.frame_len = bytes.length;
  return out;
}

export function runVector(vector) {
  const { records, world } = runNetwork({
    topology: vector.topology, initialState: vector.initial_state ?? {}, actions: vector.actions,
  });
  const transmissions = records.filter((r) => r.kind === 'link.tx').map((r) => ({
    step: (r.t + (r.delay ?? DEFAULT_DELAY)) / 1000, link: r.link, from: r.from, to: r.to, pdu: vectorPdu(r.pdu, r.bytes),
  }));
  const events = records.filter((r) => EVENT_KINDS.includes(r.kind))
    .map((r) => ({ step: r.t / 1000, node: r.node, event: r.kind, detail: r.detail }));
  const final = {};
  for (const n of Object.values(world.nodes)) {
    for (const t of ['arp_cache', 'mac_table', 'udp_sockets', 'routing_table']) {
      if (n.state?.[t]) (final[t] ??= {})[n.id] = n.state[t];
    }
  }
  const received = records.filter((r) => r.kind === 'app.recv')
    .map((r) => ({ node: r.node, app: r.app, port: r.port, from: r.from, text: r.text }));
  const initialRoutes = {};
  for (const n of Object.values(buildWorld(vector.topology).nodes)) {
    if (n.state.routing_table) initialRoutes[n.id] = n.state.routing_table;
  }
  return { records, transmissions, events, finalState: final, initialRoutes, appResult: { received } };
}

// Částečná shoda: všechna pole z `exp` musí být v `act` se stejnou hodnotou (rekurzivně).
function partialDiff(exp, act, path, out) {
  if (exp !== null && typeof exp === 'object') {
    if (act === null || typeof act !== 'object') { out.push(`${path}: chybí (čekáno ${JSON.stringify(exp)})`); return; }
    for (const [k, v] of Object.entries(exp)) partialDiff(v, act[k], `${path}.${k}`, out);
    return;
  }
  const isMac = typeof exp === 'string' && /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(exp);
  const same = isMac ? typeof act === 'string' && normMac(exp) === normMac(act) : exp === act;
  if (!same) out.push(`${path}: čekáno ${JSON.stringify(exp)}, je ${JSON.stringify(act)}`);
}

// Záznam tabulky jako klíč pro porovnání množin (bez `age`, MAC malými písmeny, seřazené klíče).
function entryKey(e) {
  const o = {};
  for (const k of Object.keys(e).sort()) {
    if (k === 'age') continue;
    o[k] = typeof e[k] === 'string' && /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(e[k]) ? normMac(e[k]) : e[k];
  }
  return JSON.stringify(o);
}

function compareTables(name, exp, act, out) {
  for (const [node, entries] of Object.entries(exp ?? {})) {
    const a = (act?.[node] ?? []).map(entryKey).sort();
    const e = entries.map(entryKey).sort();
    if (JSON.stringify(a) !== JSON.stringify(e)) {
      out.push(`${name} ${node}: čekáno ${e.join(' ')} | je ${a.join(' ') || '(prázdná)'}`);
    }
  }
}

/** Vrací seznam rozdílů (prázdný = vektor sedí). */
export function compareVector(vector, run) {
  const out = [];
  const exp = vector.expected;
  // 1. přenosy: pro každou dvojici (linka, odkud) stejná posloupnost
  const groups = new Map();
  const add = (t, side) => {
    const k = `${t.link}|${t.from}`;
    if (!groups.has(k)) groups.set(k, { exp: [], act: [] });
    groups.get(k)[side].push(t);
  };
  exp.transmissions.forEach((t) => add(t, 'exp'));
  run.transmissions.forEach((t) => add(t, 'act'));
  for (const [k, g] of groups) {
    const [link, from] = k.split('|');
    if (g.exp.length !== g.act.length) {
      out.push(`linka ${link} z ${from}: čekáno ${g.exp.length} přenosů, je ${g.act.length}`);
      continue;
    }
    g.exp.forEach((e, i) => {
      const a = g.act[i];
      const where = `přenos ${e.n ?? i + 1} (${link} ${from}->${e.to})`;
      if (a.to !== e.to) out.push(`${where}: cíl ${a.to}`);
      if (a.step !== e.step) out.push(`${where}: step čekán ${e.step}, je ${a.step}`);
      partialDiff(e.pdu, a.pdu, `${where} pdu`, out);
    });
  }
  // 2. události jako podmnožina (stejný krok, uzel a druh)
  for (const e of exp.events ?? []) {
    if (!run.events.some((a) => a.step === e.step && a.node === e.node && a.event === e.event)) {
      out.push(`událost ${e.event} v ${e.node} v kroku ${e.step} nenastala`);
    }
  }
  // 3. odvozená směrovací tabulka = initial_state.routing_table
  compareTables('routing_table (odvozená)', vector.initial_state?.routing_table, run.initialRoutes, out);
  // 4. koncový stav: přesná shoda množin
  for (const [name, tables] of Object.entries(exp.final_state ?? {})) {
    compareTables(name, tables, run.finalState[name], out);
  }
  // 5. výsledek aplikací (UDP): received jako množina, not_received nic nedostaly
  const ar = exp.app_result;
  if (ar?.received) {
    const key = (r) => JSON.stringify([r.node, r.app, r.port, r.from, r.text]);
    const a = run.appResult.received.map(key).sort(), e = ar.received.map(key).sort();
    if (JSON.stringify(a) !== JSON.stringify(e)) out.push(`app_result.received: čekáno ${e.join(' ')} | je ${a.join(' ')}`);
  }
  for (const n of ar?.not_received ?? []) {
    if (run.appResult.received.some((r) => r.node === n.node && r.app === n.app && (n.port == null || r.port === n.port))) {
      out.push(`aplikace ${n.app} na ${n.node} nesměla nic dostat`);
    }
  }
  return out;
}
