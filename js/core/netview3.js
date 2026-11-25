// Pohled úrovně 3 po záznamu `upto` (dvě sítě, router, ARP, ICMP). Čistá data, bez DOM.
// Stejný princip jako netview.js (úroveň 2): počítá se vždy znovu z předpony záznamu, takže
// krok vzad vrátí přesně předchozí stav včetně ARP, MAC a směrovacích tabulek (VYVOJ.md R6).
// Záznamy od `from` patří aktuálnímu kroku (rámce na kabelech, nové řádky tabulek, rozhodnutí).
import { emptyNode, move, finish } from './timeline.js';
import { isHost } from '../devices/types.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export function netViewAt3(records, upto, from = 0) {
  const v = {
    nodes: {}, links: {}, order: [], flow: null, packet: null, focus: null, removed: null,
    delivered: null, dropped: null, ended: false, decision: null, route: null, portState: {},
    newEntries: {}, wires: {}, pills: {}, mark: null, frame: null, pkt: null, hop: null,
    arpWait: null, arpFail: null, apps: {}, config: null, ignored: [], dropsInStep: [], routeOf: {},
  };
  const mark = (node, key, op) => { (v.newEntries[node] ??= {})[key] = op; };
  for (let i = 0; i <= upto && i < records.length; i++) {
    const r = records[i];
    const cur = i >= from;
    v.removed = null;
    const nv = r.node ? v.nodes[r.node] : null;
    switch (r.kind) {
      case 'sim.start':
        for (const n of r.topology.nodes) addNode(v, n, r.tables);
        for (const l of r.topology.links) v.links[l.id] = clone(l);
        break;
      case 'mark':
        v.mark = r.id;
        v.focus = null;
        break;
      case 'config':
        Object.assign(nv, { gateway: r.gateway, routing_table: clone(r.routes) });
        delete v.routeOf[r.node];
        if (r.restart) nv.arp_cache = [];
        v.config = { node: r.node, gateway: r.gateway, before: r.before, restart: r.restart };
        if (cur) mark(r.node, 'gateway', 'update');
        v.flow = null; v.packet = null; v.focus = { node: r.node, layer: 3 }; v.arpFail = null; v.arpWait = null;
        v.dropped = null; v.delivered = null; v.hop = null; v.frame = null; v.pkt = null;
        for (const id of v.order) if (v.nodes[id].layers) Object.assign(v.nodes[id], emptyNode('idle'));
        v.pills = {};
        break;
      case 'app.start': {
        const recv = v.order.find((id) => ipsOf(v.nodes[id]).includes(r.dst)) ?? null;
        v.flow = { sender: r.node, receiver: recv, app: r.app, dst: r.dst, run: r.run };
        v.apps[r.run] = { run: r.run, node: r.node, app: r.app, dst: r.dst, count: r.count, events: [], done: false, startIdx: i };
        for (const id of v.order) if (v.nodes[id].layers) Object.assign(v.nodes[id], emptyNode(id === r.node ? 'sender' : 'idle'));
        v.pills = { [r.node]: 'sender' };
        v.delivered = null; v.dropped = null; v.hop = null; v.arpFail = null; v.arpWait = null; v.frame = null; v.pkt = null;
        v.packet = null;
        v.focus = { node: r.node, layer: 7 };
        break;
      }
      case 'app.send':
        // další dotaz pingu / sonda tracertu: vrstvy znovu od L7 (L4 se u ICMP přeskočí)
        for (const id of v.order) if (v.nodes[id].layers) Object.assign(v.nodes[id], emptyNode(id === r.node ? 'sender' : 'idle'));
        move(nv, 7);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: 7 };
        v.delivered = null; v.dropped = null; v.hop = null; v.frame = null; v.pkt = null;
        v.pills = { [r.node]: 'sender' };
        break;
      case 'tracert_probe':
        v.probe = { ttl: r.ttl, probe: r.probe };
        break;
      case 'app.event': {
        const a = v.apps[r.run];
        if (a) a.events.push({ seq: r.seq, ttl: r.ttl, probe: r.probe, result: r.result, fresh: cur });
        break;
      }
      case 'app.done':
        if (v.apps[r.run]) v.apps[r.run].done = true;
        break;
      case 'encap':
        move(nv, r.layer);
        if (r.proto === 'icmp' && nv.layers?.[4] !== undefined) nv.layers[4] = 'skip';
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: r.layer };
        if (r.proto === 'ipv4') v.pkt = r.pdu;
        if (r.layer === 2) {
          v.frame = r.pdu;
          if (nv.type === 'router' && r.pdu.payload?.proto === 'ipv4' && v.hop) v.hop.out = r.pdu;
        }
        break;
      case 'arp_request':
      case 'arp_reply':
        move(nv, 2);
        v.focus = { node: r.node, layer: 2 };
        if (cur) v.pills[r.node] = r.kind === 'arp_request' ? 'arpq' : 'arpr';
        break;
      case 'phy.tx':
        move(nv, 1);
        v.packet = { form: 'bits', pdu: r.pdu, bytes: r.bytes };
        v.focus = { node: r.node, layer: 1 };
        v.frame = r.pdu;
        break;
      case 'link.tx':
        if (v.nodes[r.from]?.layers) finish(v.nodes[r.from]);
        if (cur) {
          v.wires[r.link] = { from: r.from, to: r.to, pdu: r.pdu };
          if (v.nodes[r.from]?.type === 'switch') setPort(v, r.from, r.fromIf, 'out');
        }
        v.packet = { form: 'wire', pdu: r.pdu, bytes: r.bytes };
        v.focus = { link: r.link, from: r.from, to: r.to };
        v.frame = r.pdu;
        break;
      case 'phy.rx':
        v.frame = r.pdu;
        if (nv.type === 'switch' || nv.type === 'hub') {
          if (cur) {
            setPort(v, r.node, r.if, 'in');
            const l = Object.values(v.links).find((x) => (x.a.node === r.node && x.a.if === r.if) || (x.b.node === r.node && x.b.if === r.if));
            if (l) v.wires[l.id] = { from: l.a.node === r.node ? l.b.node : l.a.node, to: r.node, pdu: r.pdu };
          }
          v.packet = { form: 'pdu', pdu: r.pdu, bytes: r.bytes, at: r.node };
          v.focus = { node: r.node, layer: 2 };
        } else {
          move(nv, 1); move(nv, 2);
          v.packet = { form: 'pdu', pdu: r.pdu, at: r.node };
          v.focus = { node: r.node, layer: 2 };
          if (nv.type === 'router' && r.pdu.payload?.proto === 'ipv4') v.hop = { node: r.node, inIf: r.if, in: r.pdu, out: null };
          if (cur && isHost(nv.type)) v.pills[r.node] = 'incoming';
        }
        break;
      case 'nic_drop':
        nv.layers[2] = 'dropped';
        nv.pos = 2;
        if (cur) v.pills[r.node] = 'dropped';
        v.dropped = { node: r.node, kind: 'nic', mac: r.mac, dst: r.pdu.h.dst };
        v.focus = { node: r.node, layer: 2 };
        break;
      case 'arp_ignore':
        nv.layers[2] = 'dropped';
        if (cur) { v.pills[r.node] = 'arpign'; v.ignored.push(r.node); }
        v.dropped = { node: r.node, kind: 'arp', ip: r.ip };
        v.focus = { node: r.node, layer: 2 };
        break;
      case 'arp_learn': {
        const t = nv.arp_cache;
        const e = t.find((x) => x.ip === r.entry.ip);
        if (e) Object.assign(e, r.entry); else t.push(clone(r.entry));
        if (cur && r.op !== 'refresh') mark(r.node, r.entry.ip, r.op);
        if (v.arpWait?.node === r.node && v.arpWait.ip === r.entry.ip) v.arpWait = null;
        break;
      }
      case 'arp_expire':
        nv.arp_cache = nv.arp_cache.filter((x) => x.ip !== r.entry.ip);
        break;
      case 'arp_queue':
        v.arpWait = { node: r.node, ip: r.ip, if: r.if };
        v.focus = { node: r.node, layer: 3 };
        if (nv.type === 'router') v.packet = { form: 'pdu', pdu: r.pdu, at: r.node };
        break;
      case 'arp_flush':
        v.arpWait = null;
        v.focus = { node: r.node, layer: 3 };
        if (r.pdu) v.packet = { form: 'pdu', pdu: r.pdu, at: r.node };
        break;
      case 'arp_fail':
        v.arpFail = { node: r.node, ip: r.ip, count: r.count };
        v.arpWait = null;
        if (isHost(nv.type)) { v.packet = null; v.focus = { node: r.node, layer: 3 }; nv.layers[3] = 'dropped'; }
        if (cur) v.pills[r.node] = 'fail';
        break;
      case 'ip_route':
        v.route = { node: r.node, route: r.route, dst: r.dst, nextHop: r.nextHop, outIf: r.outIf, cur };
        v.routeOf[r.node] = v.route;
        v.focus = { node: r.node, layer: 3 };
        break;
      case 'ip_forward':
        v.route = { node: r.node, route: r.route, dst: r.pdu.h.dst, nextHop: r.nextHop, outIf: r.outIf, inIf: r.inIf,
          ttlBefore: r.ttlBefore, ttlAfter: r.ttlAfter, cur };
        v.packet = { form: 'pdu', pdu: r.pdu, at: r.node, before: r.before };
        v.pkt = r.pdu;
        v.focus = { node: r.node, layer: 3 };
        if (v.hop) v.hop.ttl = [r.ttlBefore, r.ttlAfter];
        break;
      case 'ip_drop':
        v.dropped = { node: r.node, kind: r.reason ?? 'ip', detail: r.detail, ttl: r.ttlBefore };
        if (cur) { v.pills[r.node] = r.reason === 'no_route' && isHost(nv.type) ? 'fail' : 'dropped'; v.dropsInStep.push(r.node); }
        v.focus = { node: r.node, layer: 3 };
        if (nv.layers) nv.layers[3] = 'dropped';
        break;
      case 'icmp_error':
      case 'icmp_reply':
        v.focus = { node: r.node, layer: 3 };
        break;
      case 'decap':
        move(nv, r.layer + 1 > 3 ? 3 : r.layer + 1);
        v.packet = { form: 'pdu', pdu: r.pdu, at: r.node };
        v.removed = { proto: r.proto, layer: r.layer, node: r.node, pdu: r.removed };
        v.focus = { node: r.node, layer: Math.min(3, r.layer + 1) };
        if (r.pdu?.proto === 'ipv4') v.pkt = r.pdu;
        break;
      case 'ip_deliver':
        if (cur && isHost(nv.type)) v.pills[r.node] = 'received';
        break;
      case 'app.recv':
        move(nv, 7);
        if (nv.layers[4] !== undefined) nv.layers[4] = 'skip';
        v.packet = { form: 'pdu', pdu: r.pdu, at: r.node };
        v.delivered = { node: r.node, app: r.app, from: r.from, ttl: r.ttl, icmpType: r.icmpType };
        if (cur) v.pills[r.node] = 'received';
        v.focus = { node: r.node, layer: 7 };
        break;
      case 'mac_learn': {
        const t = nv.mac_table;
        const e = t.find((x) => x.mac === r.entry.mac);
        if (e) Object.assign(e, r.entry); else t.push(clone(r.entry));
        if (cur && r.op !== 'refresh') mark(r.node, r.entry.mac, r.op);
        break;
      }
      case 'flood':
      case 'forward':
      case 'filter':
        if (cur) v.decision = { node: r.node, kind: r.kind, dst: r.dst, reason: r.reason, inPort: r.inPort, outPorts: r.outPorts ?? [] };
        break;
      case 'sim.end':
        for (const id of v.order) if (v.nodes[id].layers) finish(v.nodes[id]);
        v.ended = true;
        v.focus = null;
        break;
      default:
        break;
    }
  }
  return v;
}

export const ipsOf = (n) => (n?.interfaces ?? []).map((i) => i.ip).filter(Boolean);

function addNode(v, n, tables) {
  const node = { id: n.id, type: n.type, label: n.label ?? n.id };
  if (isHost(n.type) || n.type === 'router') {
    Object.assign(node, { interfaces: clone(n.interfaces), arp_cache: clone(tables?.arp_cache?.[n.id] ?? []),
      routing_table: clone(tables?.routing_table?.[n.id] ?? []), ...emptyNode('idle') });
    if (isHost(n.type)) {
      const i = n.interfaces[0];
      Object.assign(node, { mac: i.mac, ip: i.ip, prefix: i.prefix, ifName: i.name, gateway: n.gateway ?? null });
    }
  } else {
    node.ports = [...n.ports];
    if (n.type === 'switch') node.mac_table = clone(tables?.mac_table?.[n.id] ?? []);
  }
  v.nodes[n.id] = node;
  v.order.push(n.id);
}

function setPort(v, node, port, st) {
  (v.portState[node] ??= {})[port] = st;
}
