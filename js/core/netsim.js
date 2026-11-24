// Simulace sítě s více uzly (úroveň 2): PC/server se zásobníkem Ethernet + IPv4 + UDP,
// hub (L1) a switch (L2, učení MAC). Plánovač diskrétních událostí s jednotkovým zpožděním
// linky (model.md kap. 7: krok = čas příchodu / 1000 µs). Výsledek je záznam (trace), ze kterého
// UI kreslí bez jádra, a koncový stav tabulek (pro vektory).
// Bez DOM; deterministické (žádná náhoda, porty od 49152, rozhodnutí 28).
import { Scheduler } from './scheduler.js';
import { Trace } from './trace.js';
import { dataPdu, encapsulate } from './pdu.js';
import { encode } from '../wire/encode.js';
import { PROTOCOLS } from '../proto/registry.js';
import { deriveRoutes } from '../proto/ipv4.js';
import { BROADCAST_MAC, isGroupMac, normMac, sameSubnet } from './addr.js';
import { hostTypes, isHost } from '../devices/types.js';
import { hubReceive } from '../devices/hub.js';
import { switchReceive } from '../devices/switch.js';

export const DEFAULT_DELAY = 1000;   // µs
export const EPHEMERAL_FIRST = 49152; // udp.md kap. 4.2
const ETH_IPV4 = PROTOCOLS.ipv4.binds.ethertype;
const IP_UDP = PROTOCOLS.udp.binds.protocol;

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Sestaví svět z topologie a výchozího stavu (formát vektorů, vektory.md kap. 2 a 3).
export function buildWorld(topology, initialState = {}) {
  const nodes = {};
  for (const n of topology.nodes) {
    const node = clone(n);
    node.state = {};
    if (isHost(n.type)) {
      node.state.arp_cache = clone(initialState.arp_cache?.[n.id] ?? []);
      const sockets = initialState.udp_sockets?.[n.id]
        ?? (n.apps ?? []).filter((a) => a.proto === 'udp' && a.port != null).map((a) => ({ app: a.name, port: a.port }));
      node.state.udp_sockets = clone(sockets);
      node.state.ipId = n.ip_id_start ?? 1;
      node.state.routing_table = deriveRoutes(n);
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
 * @returns {{ records: object[], world: object }}
 */
export function runNetwork({ topology, initialState = {}, actions = [], maxEvents = 10_000 }) {
  const sched = new Scheduler();
  const trace = new Trace();
  const world = buildWorld(topology, initialState);
  let pduSeq = 0;
  const emit = (kind, data) => trace.emit(sched.now, kind, data);
  const label = (id) => world.nodes[id]?.label ?? id;

  // Odeslání rámce z rozhraní: záznam link.tx a příchod za `delay`.
  function transmit(nodeId, ifName, frame, bytes) {
    const pl = peerOf(world, nodeId, ifName);
    if (!pl) { emit('tx_no_link', { node: nodeId, if: ifName }); return; }
    const delay = pl.link.delay ?? DEFAULT_DELAY;
    emit('link.tx', { link: pl.link.id, from: nodeId, fromIf: ifName, to: pl.peer.node, toIf: pl.peer.if,
      pdu: frame, bytes, delay });
    sched.schedule({ type: 'link.arrive', delay, payload: { node: pl.peer.node, if: pl.peer.if, frame, bytes, link: pl.link.id } });
  }

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
    const ipH = { src: iface.ip, dst, ttl: node.ttl_default ?? 128, protocol: IP_UDP, id: st.ipId };
    st.ipId = (st.ipId + 1) & 0xffff;
    pdu = encapsulate(++pduSeq, 'ipv4', 3, ipH, pdu);
    emit('encap', { node: nodeId, layer: 3, proto: 'ipv4', pdu });
    // další skok: stejná síť -> cíl, jinak brána (úroveň 2 má jen jednu síť)
    const nextHop = sameSubnet(dst, iface.ip, iface.prefix) ? dst : node.gateway;
    const arp = st.arp_cache.find((e) => e.ip === nextHop);
    if (!arp) {
      emit('arp_miss', { node: nodeId, ip: nextHop ?? dst, detail: `MAC adresa k ${nextHop ?? dst} není v ARP tabulce (ARP přijde v úrovni 3)` });
      return;
    }
    pdu = encapsulate(++pduSeq, 'ethernet', 2, { dst: normMac(arp.mac), src: normMac(iface.mac), ethertype: ETH_IPV4 }, pdu);
    emit('encap', { node: nodeId, layer: 2, proto: 'ethernet', pdu, arp: { ip: arp.ip, mac: arp.mac } });
    const bytes = encode(pdu);
    emit('phy.tx', { node: nodeId, if: iface.name, layer: 1, pdu, bytes });
    transmit(nodeId, iface.name, pdu, bytes);
  }

  // Příjem v uzlu (PC): síťová karta filtruje podle MAC hned, operační systém zpracuje
  // přijatý rámec až v další události se stejným časem (přerušení karty). Proto se v záznamu
  // nejdřív objeví všechny příchody a zahození na kartách, potom zpracování v OS.
  function hostArrive(node, ifName, frame, bytes) {
    const iface = node.interfaces.find((i) => i.name === ifName);
    emit('phy.rx', { node: node.id, if: ifName, layer: 1, pdu: frame, bytes });
    const dst = normMac(frame.h.dst);
    if (dst !== normMac(iface.mac) && dst !== BROADCAST_MAC && !isGroupMac(dst)) {
      emit('nic_drop', { node: node.id, layer: 2, pdu: frame, mac: iface.mac,
        detail: `cílová MAC ${dst} není moje ani broadcast` });
      return;
    }
    sched.schedule({ type: 'host.rx', delay: 0, payload: { node: node.id, if: ifName, frame } });
  }

  sched.on('host.rx', (ev) => {
    const { node: id, if: ifName, frame } = ev.payload;
    const node = world.nodes[id];
    const iface = node.interfaces.find((i) => i.name === ifName);
    const decap = (pdu, layer) => emit('decap', { node: id, layer, proto: pdu.proto, removed: pdu, pdu: pdu.payload });
    if (frame.h.ethertype !== ETH_IPV4 || frame.payload.proto !== 'ipv4') {
      emit('drop', { node: id, layer: 2, proto: 'ethernet', reason: 'protokol není v této úrovni', pdu: frame });
      return;
    }
    decap(frame, 2);
    const pkt = frame.payload;
    if (pkt.h.dst !== iface.ip) {
      emit('ip_drop', { node: id, layer: 3, pdu: pkt, detail: `cílová IP ${pkt.h.dst} není moje` });
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
  });

  const devCtx = { emit, transmit, label, world };
  sched.on('link.arrive', (ev) => {
    const { node: id, if: ifName, frame, bytes } = ev.payload;
    const node = world.nodes[id];
    if (!node) return;
    if (isHost(node.type)) hostArrive(node, ifName, frame, bytes);
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
      case 'mark':
        emit('mark', { id: a.args?.id ?? '' });
        break;
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
