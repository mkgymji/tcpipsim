// Switch (L2, transparentní bridge podle IEEE 802.1D, ethernet.md kap. 4): učí se ze zdrojové
// MAC, cíl hledá v MAC tabulce; broadcast, multicast a neznámý cíl rozešle (flooding).
// Rámec nemění. Stárnutí záznamů (300 s) se na úrovni 2 nemodeluje (označené zjednodušení).
import { isGroupMac, normMac } from '../core/addr.js';

export function switchReceive(node, inPort, frame, bytes, ctx) {
  const table = node.state.mac_table;
  ctx.emit('phy.rx', { node: node.id, if: inPort, layer: 2, pdu: frame, bytes });
  const src = normMac(frame.h.src), dst = normMac(frame.h.dst);
  if (!isGroupMac(src)) {
    const old = table.find((e) => normMac(e.mac) === src);
    if (!old) {
      const entry = { mac: src, port: inPort, vlan: 1, type: 'dynamic' };
      table.push(entry);
      ctx.emit('mac_learn', { node: node.id, op: 'add', entry: { ...entry }, detail: `${src} na ${inPort}` });
    } else if (old.port !== inPort) {
      const before = { ...old };
      old.port = inPort;
      ctx.emit('mac_learn', { node: node.id, op: 'update', entry: { ...old }, before,
        detail: `${src} se přesunula z ${before.port} na ${inPort}` });
    } else {
      ctx.emit('mac_learn', { node: node.id, op: 'refresh', entry: { ...old },
        detail: `${src} na ${inPort} (záznam obnoven, stáří 0)` });
    }
  }
  // porty bez kabelu (úroveň 3: Fa0/2 volný) nejsou „up“, switch na ně nic neposílá
  const linked = (p) => !ctx.world?.links || Object.values(ctx.world.links).some((l) =>
    (l.a.node === node.id && l.a.if === p) || (l.b.node === node.id && l.b.if === p));
  const others = node.ports.filter((p) => p !== inPort && linked(p));
  const known = isGroupMac(dst) ? null : table.find((e) => normMac(e.mac) === dst);
  if (!known) {
    const reason = isGroupMac(dst) ? 'broadcast' : 'unknown';
    ctx.emit('flood', { node: node.id, inPort, outPorts: others, dst, reason, pdu: frame,
      detail: `${reason === 'broadcast' ? 'broadcast' : `unknown unicast: ${dst} není v tabulce`} -> ${others.join(', ')}` });
    for (const p of others) ctx.transmit(node.id, p, frame, bytes);
  } else if (known.port === inPort) {
    ctx.emit('filter', { node: node.id, inPort, dst, pdu: frame, detail: `${dst} je na příchozím portu ${inPort}: zahodit` });
  } else {
    ctx.emit('forward', { node: node.id, inPort, outPorts: [known.port], dst, pdu: frame,
      detail: `${dst} známá -> jen ${known.port}` });
    ctx.transmit(node.id, known.port, frame, bytes);
  }
}
