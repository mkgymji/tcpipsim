// Pohled úrovně 2 po záznamu `upto` (sítě s více uzly: PC, hub, switch). Čistá data, bez DOM.
// Počítá se vždy znovu z předpony záznamu, takže krok vzad vrátí přesně předchozí stav
// včetně MAC tabulky (VYVOJ.md R6). Záznamy od `from` patří aktuálnímu kroku: podle nich se
// zvýrazní, co se v kroku stalo (rámce na kabelech, porty vstup/ven, nový řádek tabulky).
import { emptyNode, move, finish } from './timeline.js';
import { isHost } from '../devices/types.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export function netViewAt(records, upto, from = 0) {
  const v = {
    nodes: {}, links: {}, order: [], device: null, flow: null, packet: null, focus: null,
    removed: null, delivered: null, dropped: null, ended: false, decision: null, swapped: false,
    portState: {}, newEntries: {}, wires: {}, inbox: {}, pills: {}, mark: null, log: [], flowFrame: null,
  };
  for (let i = 0; i <= upto && i < records.length; i++) {
    const r = records[i];
    const cur = i >= from;            // záznam patří aktuálnímu kroku
    v.removed = null;
    const nv = r.node ? v.nodes[r.node] : null;
    switch (r.kind) {
      case 'sim.start':
        for (const n of r.topology.nodes) addNode(v, n, r.tables);
        for (const l of r.topology.links) v.links[l.id] = clone(l);
        v.packet = null;
        break;
      case 'topo.swap': {
        const idx = v.order.indexOf(r.from);
        delete v.nodes[r.from];
        v.order.splice(idx, 1);
        addNode(v, r.device, { mac_table: { [r.to]: [] } }, idx);
        v.links = clone(r.links);
        v.device = r.to;
        v.swapped = true;
        v.flow = null; v.flowFrame = null; v.packet = null; v.delivered = null; v.dropped = null; v.decision = null;
        for (const id of v.order) if (v.nodes[id].layers) Object.assign(v.nodes[id], emptyNode('idle'));
        v.pills = {};
        v.log = [];
        v.inbox = {};
        break;
      }
      case 'mark':
        v.mark = r.id;
        v.focus = null;
        break;
      case 'app.send': {
        // nová zpráva: nová dvojice ve výtahu, stav vrstev všech PC od začátku
        const recv = v.order.find((id) => v.nodes[id].ip === r.dst) ?? null;
        v.flow = { sender: r.node, receiver: recv, text: r.text, app: r.app, sport: r.sport, dport: r.dport, dst: r.dst };
        for (const id of v.order) if (v.nodes[id].layers) Object.assign(v.nodes[id], emptyNode(id === r.node ? 'sender' : 'idle'));
        v.pills = { [r.node]: 'sender' };
        v.log.push({ sender: r.node, receiver: recv, text: r.text, results: {} });
        // rámec této zprávy (pro rentgen i v krocích, kdy ještě nemá všechny obálky)
        v.flowFrame = records.find((x, j) => j > i && x.kind === 'encap' && x.layer === 2 && x.node === r.node)?.pdu ?? null;
        v.delivered = null; v.dropped = null; v.decision = null;
        move(nv, 7);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: 7 };
        break;
      }
      case 'encap':
        move(nv, r.layer);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: r.layer };
        break;
      case 'phy.tx':
        move(nv, 1);
        v.packet = { form: 'bits', pdu: r.pdu, bytes: r.bytes };
        v.focus = { node: r.node, layer: 1 };
        break;
      case 'link.tx':
        if (v.nodes[r.from]?.layers) finish(v.nodes[r.from]);
        if (cur) {
          v.wires[r.link] = { from: r.from, to: r.to, pdu: r.pdu };
          if (!isHost(v.nodes[r.from]?.type)) setPort(v, r.from, r.fromIf, 'out');
          if (isHost(v.nodes[r.to]?.type)) v.pills[r.to] = 'incoming';
        }
        v.packet = { form: 'wire', pdu: r.pdu, bytes: r.bytes };
        v.focus = { link: r.link, from: r.from, to: r.to };
        break;
      case 'phy.rx':
        if (nv.layers) {
          move(nv, 1); move(nv, 2);
          v.packet = { form: 'pdu', pdu: r.pdu };
          v.focus = { node: r.node, layer: 2 };
          v.pills[r.node] = 'incoming';
        } else {
          if (cur) {
            setPort(v, r.node, r.if, 'in');
            // rámec leží na vstupním portu: kabel, kterým přišel, ho v kroku ukazuje (rozhodnutí 31)
            const l = Object.values(v.links).find((x) => (x.a.node === r.node && x.a.if === r.if) || (x.b.node === r.node && x.b.if === r.if));
            if (l) v.wires[l.id] = { from: l.a.node === r.node ? l.b.node : l.a.node, to: r.node, pdu: r.pdu };
          }
          v.packet = { form: nv.type === 'hub' ? 'bits' : 'pdu', pdu: r.pdu, bytes: r.bytes, at: r.node };
          v.focus = { node: r.node, layer: nv.type === 'hub' ? 1 : 2 };
        }
        break;
      case 'nic_drop':
        nv.layers[2] = 'dropped';
        nv.pos = 2;
        v.pills[r.node] = 'dropped';
        v.dropped = { node: r.node, mac: r.mac, dst: r.pdu.h.dst };
        if (v.log.length) v.log.at(-1).results[r.node] = 'dropped';
        v.focus = { node: r.node, layer: 2 };
        break;
      case 'decap':
        move(nv, r.layer);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.removed = { proto: r.proto, layer: r.layer, node: r.node };
        v.focus = { node: r.node, layer: r.layer };
        break;
      case 'app.recv':
        move(nv, 7);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.delivered = { node: r.node, app: r.app, port: r.port, text: r.text, from: r.from };
        (v.inbox[r.node] ??= {});
        (v.inbox[r.node][r.app] ??= []).push({ text: r.text, from: r.from, port: r.port, fresh: cur });
        v.pills[r.node] = 'received';
        if (v.log.length) v.log.at(-1).results[r.node] = 'received';
        v.focus = { node: r.node, layer: 7 };
        break;
      case 'mac_learn': {
        const t = nv.mac_table;
        const e = t.find((x) => x.mac === r.entry.mac);
        if (e) Object.assign(e, r.entry); else t.push(clone(r.entry));
        if (cur && r.op !== 'refresh') (v.newEntries[r.node] ??= {})[r.entry.mac] = r.op;
        if (cur) v.decision = { ...(v.decision ?? {}), node: r.node, learn: r.entry, op: r.op };
        break;
      }
      case 'flood':
      case 'forward':
      case 'filter':
      case 'repeat':
        if (cur) v.decision = { ...(v.decision ?? {}), node: r.node, kind: r.kind, dst: r.dst, reason: r.reason,
          inPort: r.inPort, outPorts: r.outPorts ?? [] };
        break;
      case 'sim.end':
        for (const id of v.order) if (v.nodes[id].layers) finish(v.nodes[id]);
        v.ended = true;
        v.focus = null;
        break;
      default:
        // udp_send, udp_deliver, ip_deliver, …: jen pro vysvětlení a vektory
        break;
    }
  }
  return v;
}

function addNode(v, n, tables, at = v.order.length) {
  const node = { id: n.id, type: n.type, label: n.label ?? n.id, short: n.short };
  if (isHost(n.type)) {
    const i = n.interfaces[0];
    Object.assign(node, { mac: i.mac, ip: i.ip, prefix: i.prefix, ifName: i.name, gateway: n.gateway ?? null,
      apps: clone(n.apps ?? []), arp_cache: clone(tables?.arp_cache?.[n.id] ?? []), ...emptyNode('idle') });
  } else {
    node.ports = [...n.ports];
    if (n.portLabels) node.portLabels = { ...n.portLabels };
    if (n.type === 'switch') node.mac_table = clone(tables?.mac_table?.[n.id] ?? []);
    v.device ??= n.id;
  }
  v.nodes[n.id] = node;
  v.order.splice(at, 0, n.id);
}

function setPort(v, node, port, st) {
  (v.portState[node] ??= {})[port] = st;
}
