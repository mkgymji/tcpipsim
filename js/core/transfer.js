// Přenos jedné zprávy aplikace mezi dvěma uzly na jedné lince, vrstvu po vrstvě.
// Výsledkem je trace s kroky: app.send, encap (L4, L3, L2), phy.tx, link.tx, phy.rx,
// decap (L2, L3, L4), app.recv. Z něj se skládají kroky úrovně 1 (výtah).
// Bez DOM; deterministické (náhoda jen z Rng se seedem).
import { Scheduler } from './scheduler.js';
import { Rng } from './rng.js';
import { Trace } from './trace.js';
import { dataPdu, encapsulate, decapsulate, messageOf } from './pdu.js';
import { stackOf } from '../proto/registry.js';
import { encode } from '../wire/encode.js';

const DEFAULT_DELAY = 1000; // µs, jednotkové zpoždění linky (model.md kap. 7)

function findNode(topology, id) {
  const n = topology.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`Uzel "${id}" v topologii není`);
  return n;
}

// Rozhraní uzlu `id` a protější konec linky.
function endpoints(topology, id) {
  const link = topology.links.find((l) => l.a.node === id || l.b.node === id);
  if (!link) throw new Error(`Uzel "${id}" není připojený`);
  const [me, peer] = link.a.node === id ? [link.a, link.b] : [link.b, link.a];
  const iface = (end) => findNode(topology, end.node).interfaces.find((i) => i.name === end.if);
  return { link, local: iface(me), remote: iface(peer), peerId: peer.node };
}

/**
 * @param {object} p
 * @param {object} p.topology  topologie (formát tcpipsim-topology/1)
 * @param {string[]} p.protocols  např. ['ethernet', 'ipv4', 'udp']
 * @param {object} p.action  { node, command: 'send', args: { to, text, port } }
 * @param {number} [p.seed]
 * @returns {{ records: object[], delivered: string|null }}
 */
export function runTransfer({ topology, protocols, action, seed = 1 }) {
  const sched = new Scheduler();
  const rng = new Rng(seed);
  const trace = new Trace();
  const stack = stackOf(protocols);       // shora dolů
  let pduSeq = 0;
  let delivered = null;

  const sender = findNode(topology, action.node);
  const ends = endpoints(topology, sender.id);
  if (ends.peerId !== action.args.to) throw new Error(`Cíl "${action.args.to}" není na druhém konci linky`);
  const receiver = findNode(topology, ends.peerId);
  const listenPort = action.args.listen ?? action.args.port;   // port, na kterém příjemce poslouchá

  sched.on('app.send', (ev) => {
    const t = sched.now;
    let pdu = dataPdu(++pduSeq, action.args.text);
    trace.emit(t, 'app.send', { node: sender.id, layer: 7, pdu });
    const ctx = {
      node: sender, local: ends.local, remote: ends.remote,
      sport: rng.int(49152, 65535),   // efemérní port (Windows 49152-65535)
      dport: action.args.port,
      ipId: rng.int(0, 65535),
    };
    for (const proto of stack) {
      pdu = encapsulate(++pduSeq, proto.id, proto.layer, proto.header(ctx), pdu);
      trace.emit(t, 'encap', { node: sender.id, layer: proto.layer, proto: proto.id, pdu });
    }
    const bytes = encode(pdu);
    trace.emit(t, 'phy.tx', { node: sender.id, layer: 1, pdu, bytes });
    const link = ends.link;
    trace.emit(t, 'link.tx', { link: link.id, from: sender.id, to: receiver.id, bytes });
    sched.schedule({ type: 'link.arrive', delay: link.delay ?? DEFAULT_DELAY,
      payload: { to: receiver.id, pdu, bytes } });
  });

  sched.on('link.arrive', (ev) => {
    const t = sched.now;
    const { pdu: frame, bytes } = ev.payload;
    const rx = endpoints(topology, receiver.id);
    trace.emit(t, 'phy.rx', { node: receiver.id, layer: 2, pdu: frame, bytes });
    const ctx = { node: receiver, local: rx.local, remote: rx.remote, listenPort };
    let pdu = frame;
    for (const proto of [...stack].reverse()) {
      if (pdu.proto !== proto.id || !proto.accept(pdu.h, ctx)) {
        trace.emit(t, 'drop', { node: receiver.id, layer: proto.layer, proto: proto.id, pdu });
        return;
      }
      const inner = decapsulate(pdu);
      trace.emit(t, 'decap', { node: receiver.id, layer: proto.layer, proto: proto.id, removed: pdu, pdu: inner });
      pdu = inner;
    }
    delivered = messageOf(pdu);
    trace.emit(t, 'app.recv', { node: receiver.id, layer: 7, pdu, text: delivered });
  });

  trace.emit(0, 'sim.start', { sender: sender.id, receiver: receiver.id, text: action.args.text });
  sched.schedule({ type: 'app.send', at: Math.round((action.time ?? 0) * 1e6) });
  sched.run({ maxEvents: 10_000 });
  trace.emit(sched.now, 'sim.end', { delivered });
  return { records: trace.records, delivered };
}
