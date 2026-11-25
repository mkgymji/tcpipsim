// Simulace sítě s více uzly: PC/server se zásobníkem Ethernet + ARP + IPv4 + ICMP + UDP,
// hub (L1), switch (L2, učení MAC) a router (L3, směrovací tabulka, TTL, nový rámec).
// Plánovač diskrétních událostí s jednotkovým zpožděním linky (model.md kap. 7: krok = čas
// příchodu / 1000 µs). Výsledek je záznam (trace), ze kterého UI kreslí bez jádra, a koncový
// stav tabulek (pro vektory). Bez DOM; deterministické (žádná náhoda, porty od 49152).
//
// `protocols` určuje, co je zapnuté (VYVOJ.md kap. 4.2). Bez 'arp' se chová jako úroveň 2:
// ARP tabulka se jen čte (předvyplněná), chybějící záznam = `arp_miss` a nic se neodešle.
// S 'arp' (úroveň 3): skutečný ARP s frontou podle next hopu, 3 pokusy a `arp_fail`
// (arp.md kap. 6); s 'icmp' ping, tracert a chybové zprávy (icmp.md).
import { Scheduler } from './scheduler.js';
import { Trace } from './trace.js';
import { dataPdu, encapsulate } from './pdu.js';
import { encode } from '../wire/encode.js';
import { PROTOCOLS } from '../proto/registry.js';
import { deriveRoutes, lookupRoute, ttlOf } from '../proto/ipv4.js';
import { ARP_PARAMS, arpRequest, arpReply } from '../proto/arp.js';
import { ICMP, PING_DATA, TRACERT_DATA, PING_PARAMS, TRACERT_PARAMS, isIcmpError } from '../proto/icmp.js';
import { BROADCAST_MAC, isGroupMac, normMac, sameSubnet, broadcastOf } from './addr.js';
import { hostTypes, isHost } from '../devices/types.js';
import { hubReceive } from '../devices/hub.js';
import { switchReceive } from '../devices/switch.js';

export const DEFAULT_DELAY = 1000;   // µs
export const EPHEMERAL_FIRST = 49152; // udp.md kap. 4.2
const ETH_IPV4 = PROTOCOLS.ipv4.binds.ethertype;
const ETH_ARP = PROTOCOLS.arp.binds.ethertype;
const IP_UDP = PROTOCOLS.udp.binds.protocol;
const IP_ICMP = PROTOCOLS.icmp.binds.protocol;
export const LEVEL3_PROTOCOLS = ['ethernet', 'arp', 'ipv4', 'icmp', 'udp'];

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const isL3 = (type) => isHost(type) || type === 'router';

// Sestaví svět z topologie a výchozího stavu (formát vektorů, vektory.md kap. 2 a 3).
export function buildWorld(topology, initialState = {}) {
  const nodes = {};
  for (const n of topology.nodes) {
    const node = clone(n);
    node.state = {};
    if (isL3(n.type)) {
      node.state.arp_cache = clone(initialState.arp_cache?.[n.id] ?? []);
      node.state.ipId = n.ip_id_start ?? 1;
      node.state.routing_table = deriveRoutes(n);
    }
    if (isHost(n.type)) {
      const sockets = initialState.udp_sockets?.[n.id]
        ?? (n.apps ?? []).filter((a) => a.proto === 'udp' && a.port != null).map((a) => ({ app: a.name, port: a.port }));
      node.state.udp_sockets = clone(sockets);
    }
    if (n.type === 'switch') node.state.mac_table = clone(initialState.mac_table?.[n.id] ?? []);
    nodes[n.id] = node;
  }
  const links = {};
  for (const l of topology.links) links[l.id] = clone(l);
  return { nodes, links };
}

// Protější konec linky připojené k uzlu `node` na rozhraní/portu `ifName`.
function peerOf(world, node, ifName) {
  for (const l of Object.values(world.links)) {
    if (l.a.node === node && l.a.if === ifName) return { link: l, peer: l.b };
    if (l.b.node === node && l.b.if === ifName) return { link: l, peer: l.a };
  }
  return null;
}

/**
 * @param {object} p
 * @param {object} p.topology      { nodes, links } (formát vektorů / scénáře)
 * @param {object} [p.initialState]  arp_cache, mac_table, udp_sockets
 * @param {object[]} p.actions     { time (s), node, command, args }
 * @param {string[]} [p.protocols] zapnuté protokoly (bez 'arp' = chování úrovně 2)
 * @returns {{ records: object[], world: object }}
 */
export function runNetwork({ topology, initialState = {}, actions = [], maxEvents = 20_000, protocols = null }) {
  const arpOn = Boolean(protocols?.includes('arp'));
  const icmpOn = Boolean(protocols?.includes('icmp'));
  const sched = new Scheduler();
  const trace = new Trace();
  const world = buildWorld(topology, initialState);
  let pduSeq = 0;
  let runSeq = 0;
  const emit = (kind, data) => trace.emit(sched.now, kind, data);
  const label = (id) => world.nodes[id]?.label ?? id;
  const ifaceOf = (node, name) => node.interfaces.find((i) => i.name === name);
  const myIps = (node) => node.interfaces.filter((i) => i.ip).map((i) => i.ip);

  // Odeslání rámce z rozhraní: záznam link.tx a příchod za `delay`.
  function transmit(nodeId, ifName, frame, bytes) {
    const pl = peerOf(world, nodeId, ifName);
    if (!pl) { emit('tx_no_link', { node: nodeId, if: ifName }); return; }
    const delay = pl.link.delay ?? DEFAULT_DELAY;
    emit('link.tx', { link: pl.link.id, from: nodeId, fromIf: ifName, to: pl.peer.node, toIf: pl.peer.if,
      pdu: frame, bytes, delay });
    sched.schedule({ type: 'link.arrive', delay, payload: { node: pl.peer.node, if: pl.peer.if, frame, bytes, link: pl.link.id } });
  }

  // Rámec kolem PDU (paket nebo ARP) a odeslání: encap L2, phy.tx, link.tx.
  function frameAndSend(nodeId, iface, dstMac, pdu, ethertype, extra = {}) {
    const frame = encapsulate(++pduSeq, 'ethernet', 2, { dst: normMac(dstMac), src: normMac(iface.mac), ethertype }, pdu);
    emit('encap', { node: nodeId, layer: 2, proto: 'ethernet', pdu: frame, ...extra });
    const bytes = encode(frame);
    emit('phy.tx', { node: nodeId, if: iface.name, layer: 1, pdu: frame, bytes });
    transmit(nodeId, iface.name, frame, bytes);
  }

  // ---- ARP (arp.md) ----

  const arpTimes = {};   // uzel -> ip -> čas naučení (mimo tabulku, vektory porovnávají záznamy bez času)
  const arpTimeout = (node) => node.arp_timeout ?? ARP_PARAMS.timeout[node.type] ?? ARP_PARAMS.timeout.pc;

  // Záznam ARP tabulky pro IP na rozhraní; dynamický po době platnosti zmizí (arp_expire).
  function arpLookup(node, ip, ifName) {
    const t = node.state.arp_cache;
    const e = t.find((x) => x.ip === ip && (!x.if || x.if === ifName));
    if (!e) return null;
    const born = arpTimes[node.id]?.[ip] ?? 0;
    if ((e.type ?? 'dynamic') === 'dynamic' && sched.now - born >= arpTimeout(node)) {
      t.splice(t.indexOf(e), 1);
      emit('arp_expire', { node: node.id, entry: { ...e }, detail: `záznam ${ip} vypršel` });
      return null;
    }
    return e;
  }

  function arpStore(node, ip, mac, ifName, why) {
    const t = node.state.arp_cache;
    const old = t.find((x) => x.ip === ip);
    (arpTimes[node.id] ??= {})[ip] = sched.now;
    if (old) {
      if (old.type === 'static') return;
      const before = { ...old };
      old.mac = mac; old.if = ifName;
      emit('arp_learn', { node: node.id, op: before.mac === mac ? 'refresh' : 'update', entry: { ...old }, before,
        detail: `${ip} -> ${mac} na ${ifName} (${why}, záznam obnoven)` });
      return;
    }
    const entry = { ip, mac, if: ifName, type: 'dynamic' };
    t.push(entry);
    emit('arp_learn', { node: node.id, op: 'add', entry: { ...entry }, detail: `${ip} -> ${mac} na ${ifName} (${why})` });
  }

  function sendArp(nodeId, iface, h, dstMac, kind, detail) {
    const arp = Object.freeze({ id: ++pduSeq, parent: null, proto: 'arp', layer: 2, h: Object.freeze(h), payload: null });
    emit(kind, { node: nodeId, if: iface.name, ip: h.tpa, op: h.op, pdu: arp, detail });
    frameAndSend(nodeId, iface, dstMac, arp, ETH_ARP);
  }

  // Paket na next hop: MAC z ARP tabulky, jinak fronta a ARP dotaz (arp.md kap. 6.1).
  function resolveAndSend(nodeId, iface, nextHop, pkt, owner) {
    const node = world.nodes[nodeId];
    const e = arpLookup(node, nextHop, iface.name);
    if (e) {
      frameAndSend(nodeId, iface, e.mac, pkt, ETH_IPV4, { arp: { ip: e.ip, mac: e.mac } });
      return;
    }
    const st = (node.state.arpq ??= {});
    const key = `${iface.name}|${nextHop}`;
    const q = st[key];
    if (q) {
      q.items.push({ pkt, owner });
      if (q.items.length > ARP_PARAMS.queueMax) {
        const old = q.items.shift();
        emit('ip_drop', { node: nodeId, layer: 3, pdu: old.pkt, reason: 'queue', detail: 'fronta ARP plná: nejstarší paket zahozen' });
        if (old.owner) appFail(old.owner, { kind: 'arp_failed', from: iface.ip });
      }
      emit('arp_queue', { node: nodeId, ip: nextHop, if: iface.name, pdu: pkt, waiting: q.items.length,
        detail: `paket čeká ve frontě, ARP na ${nextHop} už běží` });
      return;
    }
    st[key] = { items: [{ pkt, owner }], tries: 1, ip: nextHop, if: iface.name };
    emit('arp_queue', { node: nodeId, ip: nextHop, if: iface.name, pdu: pkt, waiting: 1,
      detail: `MAC adresa next hopu ${nextHop} není v ARP tabulce: paket čeká ve frontě, ARP dotaz` });
    sendArp(nodeId, iface, arpRequest(iface, nextHop), BROADCAST_MAC, 'arp_request', `kdo má ${nextHop}? Ptá se ${iface.ip}`);
    sched.schedule({ type: 'arp.retry', delay: ARP_PARAMS.retryInterval, payload: { node: nodeId, key } });
  }

  sched.on('arp.retry', (ev) => {
    const { node: nodeId, key } = ev.payload;
    const node = world.nodes[nodeId];
    const q = node.state.arpq?.[key];
    if (!q) return;   // mezitím přišla odpověď
    const iface = ifaceOf(node, q.if);
    if (q.tries < ARP_PARAMS.retries) {
      q.tries++;
      sendArp(nodeId, iface, arpRequest(iface, q.ip), BROADCAST_MAC, 'arp_request', `kdo má ${q.ip}? (pokus ${q.tries})`);
      sched.schedule({ type: 'arp.retry', delay: ARP_PARAMS.retryInterval, payload: { node: nodeId, key } });
      return;
    }
    delete node.state.arpq[key];
    emit('arp_fail', { node: nodeId, ip: q.ip, if: q.if, count: q.items.length,
      detail: `${q.ip} neodpověděl na ${ARP_PARAMS.retries} ARP dotazy: ${q.items.length} paket(y) z fronty zahozeny` });
    if (node.type === 'router') {
      // RFC 1812 3.3.2: ICMP 3/1 jen pro jeden z přeposílaných paketů ve frontě, ostatní bez hlášení
      const fwd = q.items.find((it) => !it.owner);
      if (fwd) sendIcmpError(nodeId, fwd.pkt, ICMP.UNREACH, 1);
    }
    for (const it of q.items) if (it.owner) appFail(it.owner, { kind: 'arp_failed', from: iface.ip });
  });

  // Příjem ARP (RFC 826, arp.md kap. 4).
  function arpReceive(node, ifName, frame) {
    const h = frame.payload.h;
    const iface = ifaceOf(node, ifName);
    const known = node.state.arp_cache.find((x) => x.ip === h.spa);
    if (known && known.type !== 'static') arpStore(node, h.spa, h.sha, ifName, 'z ARP zprávy');
    if (h.tpa !== iface.ip) {
      // RFC 826: známého odesílatele jen obnoví (výše), nový záznam nevzniká; dotaz není pro mě
      emit('arp_ignore', { node: node.id, ip: h.tpa, op: h.op, pdu: frame.payload, refreshed: Boolean(known),
        detail: `hledaná adresa ${h.tpa} není moje (${iface.ip}): neodpovídá${known ? ', jen obnoví existující záznam' : ', nic si nezapisuje'}` });
      return;
    }
    if (!known) arpStore(node, h.spa, h.sha, ifName, h.op === 1 ? 'z dotazu' : 'z odpovědi');
    if (h.op === 1) {
      sendArp(node.id, iface, arpReply(iface, h), h.sha, 'arp_reply', `${iface.ip} je na ${iface.mac}; odpověď jen tazateli`);
    }
    flushQueue(node, ifName, h.spa);
  }

  function flushQueue(node, ifName, ip) {
    const key = `${ifName}|${ip}`;
    const q = node.state.arpq?.[key];
    if (!q) return;
    delete node.state.arpq[key];
    const iface = ifaceOf(node, ifName);
    const e = node.state.arp_cache.find((x) => x.ip === ip);
    emit('arp_flush', { node: node.id, ip, if: ifName, count: q.items.length, pdu: q.items[0].pkt,
      detail: `MAC ${ip} známá: ${q.items.length} paket(y) z fronty odchází` });
    for (const it of q.items) frameAndSend(node.id, iface, e.mac, it.pkt, ETH_IPV4, { arp: { ip: e.ip, mac: e.mac } });
  }

  // ---- IP (ipv4.md kap. 4–5, routing.md) ----

  // Odeslání paketu, který uzel sám vytvořil: výběr cesty (LPM), next hop, ARP, rámec.
  function ipOutput(nodeId, pkt, owner) {
    const node = world.nodes[nodeId];
    const route = lookupRoute(node.state.routing_table, pkt.h.dst);
    if (!route) {
      emit('ip_drop', { node: nodeId, layer: 3, pdu: pkt, reason: 'no_route',
        detail: `pro ${pkt.h.dst} není v tabulce žádná cesta (${node.gateway ? 'žádná nesedí' : 'chybí výchozí brána'}): nic se neodešle` });
      return { error: 'no_route' };
    }
    const nextHop = route.next_hop ?? pkt.h.dst;
    const iface = ifaceOf(node, route.if);
    emit('ip_route', { node: nodeId, dst: pkt.h.dst, route: { ...route }, nextHop, outIf: iface.name, pdu: pkt,
      detail: route.next_hop ? `${pkt.h.dst} -> cesta ${route.prefix} přes ${nextHop} (nepřímé doručení)`
        : `${pkt.h.dst} je v ${route.prefix}: přímo (on-link)` });
    resolveAndSend(nodeId, iface, nextHop, pkt, owner);
    return { route, nextHop };
  }

  function newIpPacket(node, h, inner) {
    const pkt = encapsulate(++pduSeq, 'ipv4', 3, { ...h, id: node.state.ipId }, inner);
    node.state.ipId = (node.state.ipId + 1) & 0xffff;
    return pkt;
  }

  // ICMP chyba z routeru (icmp.md kap. 3): zdroj = adresa rozhraní, kterým zpráva odchází.
  function sendIcmpError(nodeId, orig, type, code) {
    const node = world.nodes[nodeId];
    const o = orig.payload;
    if (orig.h.protocol === IP_ICMP && o?.proto === 'icmp' && isIcmpError(o.h.type)) return;   // ne na chybu
    if (orig.h.dst === '255.255.255.255') return;                                              // ne na broadcast
    const back = lookupRoute(node.state.routing_table, orig.h.src);
    if (!back) return;
    const src = ifaceOf(node, back.if).ip;
    const icmp = encapsulate(++pduSeq, 'icmp', 3, { type, code, orig }, null);
    emit('icmp_error', { node: nodeId, type, code, pdu: icmp, to: orig.h.src,
      detail: `${type === ICMP.TIME_EXCEEDED ? 'Time Exceeded' : 'Destination Unreachable'} (${type}/${code}) pro ${orig.h.src}, zdroj ${src}` });
    emit('encap', { node: nodeId, layer: 3, proto: 'icmp', pdu: icmp });
    const pkt = newIpPacket(node, { src, dst: orig.h.src, ttl: ttlOf(node), protocol: IP_ICMP }, icmp);
    emit('encap', { node: nodeId, layer: 3, proto: 'ipv4', pdu: pkt });
    ipOutput(nodeId, pkt, null);
  }

  // Odpověď na Echo Request: nový paket s výchozím TTL odpovídajícího (icmp.md kap. 2).
  function echoReply(node, pkt) {
    const req = pkt.payload;
    const icmp = encapsulate(++pduSeq, 'icmp', 3, { type: ICMP.ECHO_REPLY, code: 0, id: req.h.id, seq: req.h.seq }, req.payload);
    emit('icmp_reply', { node: node.id, pdu: icmp, to: pkt.h.src,
      detail: `Echo Reply pro ${pkt.h.src}: nový paket, TTL ${ttlOf(node)}` });
    emit('encap', { node: node.id, layer: 3, proto: 'icmp', pdu: icmp });
    const out = newIpPacket(node, { src: pkt.h.dst, dst: pkt.h.src, ttl: ttlOf(node), protocol: IP_ICMP }, icmp);
    emit('encap', { node: node.id, layer: 3, proto: 'ipv4', pdu: out });
    ipOutput(node.id, out, null);
  }

  // ---- aplikace ping a tracert (icmp.md kap. 2.1, 4.1) ----

  const runs = {};   // id běhu -> stav
  function appStart(nodeId, app, args) {
    const run = { id: ++runSeq, node: nodeId, app, dst: args.dst, seq: 0, pending: null, done: false,
      count: args.count ?? PING_PARAMS.count, ttl: 1, probe: 0, probes: args.probes ?? TRACERT_PARAMS.probes,
      maxHops: args.max_hops ?? TRACERT_PARAMS.maxHops, hopReplies: [], reached: false };
    runs[run.id] = run;
    emit('app.start', { node: nodeId, app, run: run.id, dst: args.dst, count: app === 'ping' ? run.count : undefined,
      maxHops: app === 'tracert' ? run.maxHops : undefined });
    appNext(run);
  }

  function appNext(run) {
    if (run.done) return;
    if (run.stop) { appDone(run); return; }
    if (run.app === 'ping') {
      if (run.seq >= run.count) { appDone(run); return; }
      run.seq++;
      sendEcho(run, PING_DATA, ttlOf(world.nodes[run.node]));
      return;
    }
    // tracert: 3 sondy na TTL, pak další TTL; konec odpovědí cíle nebo po max_hops
    if (run.probe >= run.probes) {
      if (run.reached || run.ttl >= run.maxHops) { appDone(run); return; }
      run.ttl++;
      run.probe = 0;
      run.hopReplies = [];
    }
    run.probe++;
    run.seq++;
    emit('tracert_probe', { node: run.node, run: run.id, ttl: run.ttl, probe: run.probe });
    sendEcho(run, TRACERT_DATA, run.ttl);
  }

  function sendEcho(run, data, ttl) {
    const node = world.nodes[run.node];
    // zdrojová IP = adresa výstupního rozhraní (u PC jediné rozhraní, u routeru podle cesty)
    const out = lookupRoute(node.state.routing_table, run.dst);
    const iface = (out && ifaceOf(node, out.if)) ?? node.interfaces[0];
    let pdu = dataPdu(++pduSeq, data);
    emit('app.send', { node: run.node, app: run.app, run: run.id, seq: run.seq, layer: 7, pdu, dst: run.dst, ttl });
    pdu = encapsulate(++pduSeq, 'icmp', 3, { type: ICMP.ECHO, code: 0, id: PING_PARAMS.id, seq: run.seq }, pdu);
    emit('encap', { node: run.node, layer: 3, proto: 'icmp', pdu });
    const pkt = newIpPacket(node, { src: iface.ip, dst: run.dst, ttl, protocol: IP_ICMP }, pdu);
    emit('encap', { node: run.node, layer: 3, proto: 'ipv4', pdu: pkt });
    const owner = { run: run.id, seq: run.seq };
    run.pending = run.seq;
    // vlastní adresa a loopback 127/8 se doručí uvnitř zásobníku, na kabel nic nejde (RFC 1122 3.2.1.3)
    if (run.dst.startsWith('127.') || myIps(node).includes(run.dst)) {
      emit('ip_local', { node: run.node, dst: run.dst, pdu: pkt, detail: `${run.dst} je vlastní adresa: doručeno uvnitř, nic se neodeslalo` });
      appResult(owner, { kind: 'reply', from: run.dst, ttl: ttlOf(node), bytes: encode(pdu.payload).length });
      return;
    }
    run.timer = sched.schedule({ type: 'app.timeout', delay: run.app === 'ping' ? PING_PARAMS.timeout : TRACERT_PARAMS.timeout,
      payload: owner });
    const res = ipOutput(run.node, pkt, owner);
    if (res.error) appFail(owner, { kind: res.error });
  }

  // Výsledek jednoho dotazu / sondy. `res` = { kind, from?, ttl?, bytes?, code? }.
  function appResult(owner, res) {
    const run = runs[owner.run];
    if (!run || run.done || run.pending !== owner.seq) return false;
    run.pending = null;
    if (run.timer != null) sched.cancel(run.timer);
    emit('app.event', { node: run.node, app: run.app, run: run.id, seq: owner.seq, ttl: run.app === 'tracert' ? run.ttl : undefined,
      probe: run.app === 'tracert' ? run.probe : undefined, result: res });
    if (run.app === 'tracert') {
      if (res.kind === 'echo_reply') run.reached = true;
      // chyba místo odpovědi (bez cesty, ARP, nedostupnost): tracert skončí (cmd.md kap. 9)
      if (['no_route', 'arp_failed', 'unreachable'].includes(res.kind)) run.stop = true;
    }
    // ping: další dotaz 1 s po odpovědi, po chybě hned; tracert: další sonda hned
    const delay = run.app === 'ping' && res.kind === 'reply' ? PING_PARAMS.interval : 0;
    sched.schedule({ type: 'app.next', delay, payload: { run: run.id } });
    return true;
  }
  function appFail(owner, res) { appResult(owner, res); }

  function appDone(run) {
    run.done = true;
    emit('app.done', { node: run.node, app: run.app, run: run.id, dst: run.dst });
  }

  sched.on('app.next', (ev) => appNext(runs[ev.payload.run]));
  sched.on('app.timeout', (ev) => appResult(ev.payload, { kind: 'timeout' }));

  // Najde čekající dotaz uzlu podle ICMP Identifier a Sequence.
  function ownerOf(nodeId, seq) {
    const run = Object.values(runs).find((r) => r.node === nodeId && !r.done && r.pending === seq);
    return run ? { run: run.id, seq } : null;
  }

  // ---- UDP (úroveň 2) ----

  // Aplikace `app` na uzlu pošle text na dst:dport přes UDP (udp.md kap. 6).
  function udpSend(nodeId, appName, dst, dport, text, cause) {
    const node = world.nodes[nodeId];
    const iface = node.interfaces[0];
    const st = node.state;
    let sock = st.udp_sockets.find((s) => s.app === appName);
    let allocated = false;
    if (!sock) {
      let port = EPHEMERAL_FIRST;
      while (st.udp_sockets.some((s) => s.port === port)) port++;
      sock = { app: appName, port };
      st.udp_sockets.push(sock);
      allocated = true;
    }
    const detail = [cause, allocated ? `OS přidělil aplikaci ${appName} dynamický port ${sock.port}`
      : `socket aplikace ${appName} má port ${sock.port}`].filter(Boolean).join('; ');
    let pdu = dataPdu(++pduSeq, text);
    emit('app.send', { node: nodeId, app: appName, layer: 7, pdu, text, dst, dport, sport: sock.port });
    emit('udp_send', { node: nodeId, app: appName, sport: sock.port, dst, dport, allocated, detail });
    pdu = encapsulate(++pduSeq, 'udp', 4, { sport: sock.port, dport }, pdu);
    emit('encap', { node: nodeId, layer: 4, proto: 'udp', pdu });
    const ipH = { src: iface.ip, dst, ttl: ttlOf(node), protocol: IP_UDP, id: st.ipId };
    st.ipId = (st.ipId + 1) & 0xffff;
    pdu = encapsulate(++pduSeq, 'ipv4', 3, ipH, pdu);
    emit('encap', { node: nodeId, layer: 3, proto: 'ipv4', pdu });
    if (arpOn) { ipOutput(nodeId, pdu, null); return; }
    // úroveň 2: ARP tabulka jen čtená (rozhodnutí 14); další skok: stejná síť -> cíl, jinak brána
    const nextHop = sameSubnet(dst, iface.ip, iface.prefix) ? dst : node.gateway;
    const arp = st.arp_cache.find((e) => e.ip === nextHop);
    if (!arp) {
      emit('arp_miss', { node: nodeId, ip: nextHop ?? dst, detail: `MAC adresa k ${nextHop ?? dst} není v ARP tabulce (ARP přijde v úrovni 3)` });
      return;
    }
    frameAndSend(nodeId, iface, arp.mac, pdu, ETH_IPV4, { arp: { ip: arp.ip, mac: arp.mac } });
  }

  // ---- příjem ----

  // Příjem v uzlu s IP (PC, router): síťová karta filtruje podle MAC hned, operační systém
  // zpracuje přijatý rámec až v další události se stejným časem (přerušení karty). Proto se
  // v záznamu nejdřív objeví všechny příchody a zahození na kartách, potom zpracování v OS.
  function l3Arrive(node, ifName, frame, bytes) {
    const iface = ifaceOf(node, ifName);
    emit('phy.rx', { node: node.id, if: ifName, layer: 1, pdu: frame, bytes });
    const dst = normMac(frame.h.dst);
    // dluh z úrovně 2 (VYVOJ.md kap. 9): s ARP karta přijme jen svou MAC a broadcast, ne cizí multicast
    const group = arpOn ? dst === BROADCAST_MAC : (dst === BROADCAST_MAC || isGroupMac(dst));
    if (dst !== normMac(iface.mac) && !group) {
      emit('nic_drop', { node: node.id, layer: 2, pdu: frame, mac: iface.mac,
        detail: `cílová MAC ${dst} není moje ani broadcast` });
      return;
    }
    sched.schedule({ type: 'host.rx', delay: 0, payload: { node: node.id, if: ifName, frame } });
  }

  sched.on('host.rx', (ev) => {
    const { node: id, if: ifName, frame } = ev.payload;
    const node = world.nodes[id];
    if (arpOn && frame.h.ethertype === ETH_ARP && frame.payload?.proto === 'arp') {
      arpReceive(node, ifName, frame);
      return;
    }
    if (frame.h.ethertype !== ETH_IPV4 || frame.payload.proto !== 'ipv4') {
      emit('drop', { node: id, layer: 2, proto: 'ethernet', reason: 'protokol není v této úrovni', pdu: frame });
      return;
    }
    emit('decap', { node: id, layer: 2, proto: 'ethernet', removed: frame, pdu: frame.payload, if: ifName });
    if (node.type === 'router') routerIp(node, ifName, frame.payload);
    else hostIp(node, ifName, frame.payload);
  });

  // Hostitel: paket pro mě (UDP, ICMP), jinak zahodit (hostitel nepřeposílá).
  function hostIp(node, ifName, pkt) {
    const id = node.id;
    const iface = ifaceOf(node, ifName);
    const decap = (pdu, layer) => emit('decap', { node: id, layer, proto: pdu.proto, removed: pdu, pdu: pdu.payload });
    if (pkt.h.dst !== iface.ip && !(arpOn && pkt.h.dst === broadcastOf(iface.ip, iface.prefix))) {
      emit('ip_drop', { node: id, layer: 3, pdu: pkt, detail: `cílová IP ${pkt.h.dst} není moje` });
      return;
    }
    if (pkt.h.protocol === IP_ICMP && icmpOn && pkt.payload?.proto === 'icmp') {
      hostIcmp(node, pkt);
      return;
    }
    if (pkt.h.protocol !== IP_UDP || pkt.payload.proto !== 'udp') {
      emit('ip_drop', { node: id, layer: 3, pdu: pkt, detail: 'protokol není v této úrovni' });
      return;
    }
    emit('ip_deliver', { node: id, detail: `cílová IP ${pkt.h.dst} je moje, Protocol ${pkt.h.protocol} -> UDP` });
    decap(pkt, 3);
    const dgram = pkt.payload;
    const sock = node.state.udp_sockets.find((s) => s.port === dgram.h.dport);
    if (!sock) {
      emit('udp_no_listener', { node: id, port: dgram.h.dport, detail: `na portu ${dgram.h.dport} nikdo nepřijímá` });
      return;
    }
    const others = node.state.udp_sockets.filter((s) => s !== sock).map((s) => `${s.app} na ${s.port}`);
    emit('udp_deliver', { node: id, app: sock.app, port: sock.port,
      detail: `cílový port ${sock.port} -> aplikace ${sock.app}${others.length ? ` (ne ${others.join(', ')})` : ''}` });
    decap(dgram, 4);
    const text = dgram.payload.payload;
    const from = `${pkt.h.src}:${dgram.h.sport}`;
    emit('app.recv', { node: id, app: sock.app, port: sock.port, layer: 7, pdu: dgram.payload, text, from });
    const app = (node.apps ?? []).find((a) => a.name === sock.app);
    if (app?.auto_reply != null) {
      udpSend(id, sock.app, pkt.h.src, dgram.h.sport, app.auto_reply,
        `automatická odpověď na ${from} (zdrojová adresa a port přijatého datagramu)`);
    }
  }

  // ICMP v hostiteli: Echo Request -> odpověď (operační systém, ne aplikace), Echo Reply a chyby
  // -> aplikace ping / tracert, která dotaz poslala.
  function hostIcmp(node, pkt) {
    const id = node.id;
    const icmp = pkt.payload;
    const t = icmp.h.type;
    if (t === ICMP.ECHO) {
      emit('ip_deliver', { node: id, pdu: pkt, detail: `cílová IP ${pkt.h.dst} je moje, Protocol 1 -> ICMP Echo Request: odpoví operační systém` });
      echoReply(node, pkt);
      return;
    }
    if (t === ICMP.ECHO_REPLY) {
      emit('ip_deliver', { node: id, pdu: pkt, detail: `Echo Reply id ${icmp.h.id} seq ${icmp.h.seq}, TTL ${pkt.h.ttl}` });
      const owner = ownerOf(id, icmp.h.seq);
      if (!owner) return;
      const run = runs[owner.run];
      emit('decap', { node: id, layer: 3, proto: 'ipv4', removed: pkt, pdu: icmp });
      emit('app.recv', { node: id, app: run.app, run: run.id, layer: 7, pdu: icmp.payload, from: pkt.h.src, ttl: pkt.h.ttl });
      appResult(owner, run.app === 'ping'
        ? { kind: 'reply', from: pkt.h.src, ttl: pkt.h.ttl, bytes: encode(icmp.payload).length }
        : { kind: 'echo_reply', from: pkt.h.src, ttl: pkt.h.ttl });
      return;
    }
    if (isIcmpError(t)) {
      emit('ip_deliver', { node: id, pdu: pkt, detail: `ICMP ${t}/${icmp.h.code} od ${pkt.h.src}` });
      const orig = icmp.h.orig;
      const oi = orig?.payload;
      if (!orig || !myIps(node).includes(orig.h.src) || oi?.proto !== 'icmp') return;
      const owner = ownerOf(id, oi.h.seq);
      if (!owner) return;
      const run = runs[owner.run];
      emit('decap', { node: id, layer: 3, proto: 'ipv4', removed: pkt, pdu: icmp });
      emit('app.recv', { node: id, app: run.app, run: run.id, layer: 7, pdu: icmp, from: pkt.h.src, ttl: pkt.h.ttl, icmpType: t });
      const kind = t === ICMP.TIME_EXCEEDED ? (run.app === 'tracert' ? 'time_exceeded' : 'ttl_exceeded') : 'unreachable';
      appResult(owner, { kind, from: pkt.h.src, code: icmp.h.code, type: t });
      return;
    }
    emit('ip_drop', { node: id, layer: 3, pdu: pkt, detail: `ICMP typ ${t} simulátor nezpracovává` });
  }

  // Router (RFC 1812, routing.md kap. 5): lokální doručení, TTL, LPM, next hop, ARP, nový rámec.
  function routerIp(node, ifName, pkt) {
    const id = node.id;
    if (myIps(node).includes(pkt.h.dst)) {
      if (pkt.h.protocol === IP_ICMP && pkt.payload?.proto === 'icmp' && pkt.payload.h.type === ICMP.ECHO && icmpOn) {
        emit('ip_deliver', { node: id, pdu: pkt, detail: `cílová IP ${pkt.h.dst} je adresa routeru: odpoví sám` });
        echoReply(node, pkt);
      } else if (pkt.h.protocol === IP_ICMP && pkt.payload?.proto === 'icmp' && icmpOn) {
        hostIcmp(node, pkt);   // odpověď na ping z routeru (terminál IOS)
      } else {
        emit('ip_deliver', { node: id, pdu: pkt, detail: `cílová IP ${pkt.h.dst} je adresa routeru` });
      }
      return;
    }
    if (pkt.h.ttl <= 1) {
      emit('ip_drop', { node: id, layer: 3, pdu: pkt, reason: 'ttl', inIf: ifName, ttlBefore: pkt.h.ttl,
        detail: `TTL ${pkt.h.ttl} -> 0: paket zahozen, Time Exceeded zdroji ${pkt.h.src}` });
      if (icmpOn) sendIcmpError(id, pkt, ICMP.TIME_EXCEEDED, 0);
      return;
    }
    const route = lookupRoute(node.state.routing_table, pkt.h.dst);
    if (!route) {
      emit('ip_drop', { node: id, layer: 3, pdu: pkt, reason: 'no_route', inIf: ifName,
        detail: `pro ${pkt.h.dst} router nemá cestu: zahodit, Destination net unreachable zdroji` });
      if (icmpOn) sendIcmpError(id, pkt, ICMP.UNREACH, 0);
      return;
    }
    const out = encapsulate(++pduSeq, 'ipv4', 3, { ...pkt.h, ttl: pkt.h.ttl - 1 }, pkt.payload);
    const nextHop = route.next_hop ?? pkt.h.dst;
    const outIf = ifaceOf(node, route.if);
    const known = arpLookup(node, nextHop, outIf.name);
    emit('ip_forward', { node: id, inIf: ifName, outIf: outIf.name, route: { ...route }, nextHop, ttlBefore: pkt.h.ttl,
      ttlAfter: out.h.ttl, pdu: out, before: pkt,
      detail: `TTL ${pkt.h.ttl} -> ${out.h.ttl}; longest match ${route.prefix} ${route.type} ${outIf.name}; next hop ${nextHop}${known ? '' : ', MAC neznámá'}` });
    resolveAndSend(id, outIf, nextHop, out, null);
  }

  const devCtx = { emit, transmit, label, world };
  sched.on('link.arrive', (ev) => {
    const { node: id, if: ifName, frame, bytes } = ev.payload;
    const node = world.nodes[id];
    if (!node) return;
    if (isHost(node.type) || (node.type === 'router' && arpOn)) l3Arrive(node, ifName, frame, bytes);
    else if (node.type === 'hub') hubReceive(node, ifName, frame, bytes, devCtx);
    else if (node.type === 'switch') switchReceive(node, ifName, frame, bytes, devCtx);
    else emit('drop', { node: id, reason: `typ uzlu ${node.type} není v této úrovni` });
  });

  sched.on('action', (ev) => {
    const a = ev.payload;
    switch (a.command) {
      case 'udp_send':
        udpSend(a.node, a.args.app, a.args.dst, a.args.dport, a.args.text);
        break;
      case 'ping':
      case 'tracert':
        if (!icmpOn) throw new Error(`Příkaz "${a.command}" simulace na této úrovni neumí`);
        appStart(a.node, a.command, a.args ?? {});
        break;
      case 'mark':
        emit('mark', { id: a.args?.id ?? '' });
        break;
      case 'set_gateway': {
        // konfigurace PC (úroveň 3, část D): brána, volitelně „restart“ = prázdná ARP tabulka
        const node = world.nodes[a.node];
        const before = node.gateway ?? null;
        if (a.args.gateway) node.gateway = a.args.gateway; else delete node.gateway;
        const cleared = a.args.restart ? node.state.arp_cache.splice(0) : [];
        node.state.routing_table = deriveRoutes(node);
        emit('config', { node: a.node, gateway: node.gateway ?? null, before, restart: Boolean(a.args.restart),
          cleared, routes: clone(node.state.routing_table),
          detail: `výchozí brána ${before ?? '(žádná)'} -> ${node.gateway ?? '(žádná)'}` });
        break;
      }
      case 'swap': {
        // Výměna zařízení se stejnými kabely (hub -> switch): nový uzel, porty podle mapy.
        const old = world.nodes[a.node];
        const nn = clone(a.args.with);
        nn.state = nn.type === 'switch' ? { mac_table: [] } : {};
        delete world.nodes[a.node];
        world.nodes[nn.id] = nn;
        for (const l of Object.values(world.links)) {
          for (const end of [l.a, l.b]) {
            if (end.node === a.node) { end.node = nn.id; end.if = a.args.ports?.[end.if] ?? end.if; }
          }
        }
        emit('topo.swap', { from: old.id, to: nn.id, device: clone({ ...nn, state: undefined }),
          links: clone(world.links) });
        break;
      }
      default:
        throw new Error(`Příkaz "${a.command}" simulace na této úrovni neumí`);
    }
  });

  emit('sim.start', { topology: clone(topology), tables: tablesOf(world) });
  actions.forEach((a) => sched.schedule({ type: 'action', at: Math.round((a.time ?? 0) * 1e6), payload: a }));
  const ran = sched.run({ maxEvents });
  emit('sim.end', { tables: tablesOf(world), ran });
  return { records: trace.records, world };
}

// Kopie tabulek všech uzlů (pro záznam a pro porovnání s vektory).
export function tablesOf(world) {
  const out = { arp_cache: {}, mac_table: {}, udp_sockets: {}, routing_table: {} };
  for (const n of Object.values(world.nodes)) {
    for (const t of Object.keys(out)) if (n.state?.[t]) out[t][n.id] = clone(n.state[t]);
  }
  return out;
}

export { hostTypes };
