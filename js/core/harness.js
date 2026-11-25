// Přehrání testovacího vektoru (docs/spec/vektory.md) jádrem a porovnání s očekáváním.
// runVector: topologie + initial_state + actions -> přenosy, události, koncový stav, výsledek aplikací.
// compareVector: pravidla vektory.md kap. 5–7 (pořadí na (linka, směr) přesně, step, částečná
// shoda polí, MAC bez ohledu na velikost písmen, tabulky jako množiny bez `age`).
// Bez DOM.
import { runNetwork, DEFAULT_DELAY, LEVEL3_PROTOCOLS } from './netsim.js';
import { buildWorld } from './netsim.js';
import { normMac } from './addr.js';

// Příkazy, které jádro zatím neumí (prázdné: ping a tracert umí od úrovně 3).
const UNSUPPORTED = {};

export const EVENT_KINDS = ['nic_drop', 'arp_learn', 'arp_ignore', 'arp_queue', 'mac_learn', 'flood', 'forward',
  'filter', 'repeat', 'ip_forward', 'ip_deliver', 'ip_drop', 'udp_send', 'udp_deliver', 'udp_no_listener',
  'arp_fail', 'arp_expire'];

// Protokoly pro přehrání vektoru: úroveň 3 a vektory s ping/tracert mají ARP a ICMP (ARP se
// opravdu posílá), starší vektory úrovně 2 jen předvyplněnou ARP tabulku (rozhodnutí 14).
export function vectorProtocols(vector) {
  const l3 = (vector.level ?? 0) >= 3 || vector.actions.some((a) => a.command === 'ping' || a.command === 'tracert');
  return l3 ? LEVEL3_PROTOCOLS : null;
}

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
    else if (p.proto === 'arp') {
      out.arp = { op: p.h.op === 1 ? 'request' : 'reply', sha: p.h.sha, spa: p.h.spa, tha: p.h.tha, tpa: p.h.tpa };
    } else if (p.proto === 'icmp') {
      out.icmp = { type: p.h.type, code: p.h.code };
      if (p.h.orig) out.icmp.orig = { src: p.h.orig.h.src, dst: p.h.orig.h.dst, protocol: p.h.orig.h.protocol };
      else Object.assign(out.icmp, { id: p.h.id, seq: p.h.seq, data_len: p.payload ? new TextEncoder().encode(p.payload.payload).length : 0 });
      break;   // data uvnitř ICMP nejsou data aplikace (vektor je u ICMP nekontroluje)
    } else if (p.proto === 'data') {
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
    protocols: vectorProtocols(vector),
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
  return { records, transmissions, events, finalState: final, initialRoutes, appResult: { received, apps: appResults(records) } };
}

// Výsledky aplikací ping a tracert ze záznamu (vektory.md kap. 7): ping = sent, received (jen
// Echo Reply), replies[], errors[]; tracert = reached, hops[] (sondy jednoho TTL = jeden skok).
export function appResults(records) {
  const out = [];
  for (const st of records.filter((r) => r.kind === 'app.start')) {
    const evs = records.filter((r) => r.kind === 'app.event' && r.run === st.run);
    if (st.app === 'ping') {
      const replies = evs.filter((e) => e.result.kind === 'reply')
        .map((e) => ({ from: e.result.from, bytes: e.result.bytes, ttl: e.result.ttl }));
      const errors = evs.filter((e) => e.result.kind !== 'reply').map((e) => {
        const x = { seq: e.seq, kind: e.result.kind };
        if (e.result.from) x.from = e.result.from;
        if (e.result.code != null) x.code = e.result.code;
        return x;
      });
      out.push({ node: st.node, command: 'ping', sent: evs.length, received: replies.length, replies, errors });
    } else {
      const hops = [];
      for (const e of evs) {
        let h = hops.find((x) => x.hop === e.ttl);
        if (!h) { h = { hop: e.ttl, from: null, replies: 0, kind: 'timeout' }; hops.push(h); }
        if (e.result.kind !== 'timeout') {
          h.replies++;
          h.from ??= e.result.from;
          h.kind = e.result.kind === 'echo_reply' ? 'echo_reply' : e.result.kind === 'time_exceeded' ? 'time_exceeded' : e.result.kind;
        }
      }
      out.push({ node: st.node, command: 'tracert', reached: hops.some((h) => h.kind === 'echo_reply'), hops });
    }
  }
  return out;
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
  if (Array.isArray(ar?.received)) {
    const key = (r) => JSON.stringify([r.node, r.app, r.port, r.from, r.text]);
    const a = run.appResult.received.map(key).sort(), e = ar.received.map(key).sort();
    if (JSON.stringify(a) !== JSON.stringify(e)) out.push(`app_result.received: čekáno ${e.join(' ')} | je ${a.join(' ')}`);
  }
  if (ar?.command === 'ping' || ar?.command === 'tracert') {
    const act = run.appResult.apps.find((a) => a.node === ar.node && a.command === ar.command);
    if (!act) out.push(`app_result: ${ar.command} na ${ar.node} neproběhl`);
    else {
      const exp = { ...ar };
      if (ar.command === 'ping') exp.errors ??= [];
      partialDiff(exp, act, 'app_result', out);
      for (const k of ['replies', 'errors', 'hops']) {
        if (exp[k] && act[k] && exp[k].length !== act[k].length) out.push(`app_result.${k}: čekáno ${exp[k].length}, je ${act[k].length}`);
      }
    }
  }
  for (const n of ar?.not_received ?? []) {
    if (run.appResult.received.some((r) => r.node === n.node && r.app === n.app && (n.port == null || r.port === n.port))) {
      out.push(`aplikace ${n.app} na ${n.node} nesměla nic dostat`);
    }
  }
  return out;
}
