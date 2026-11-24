// Hub (L1, ethernet.md kap. 3): co přijde na port, zopakuje na všechny ostatní porty.
// Nečte adresy, nic se neučí, rámec nemění. Kolize se nemodelují (rozhodnutí 8).
export function hubReceive(node, inPort, frame, bytes, ctx) {
  ctx.emit('phy.rx', { node: node.id, if: inPort, layer: 1, pdu: frame, bytes });
  const out = node.ports.filter((p) => p !== inPort);
  ctx.emit('repeat', { node: node.id, inPort, outPorts: out, pdu: frame,
    detail: `${inPort} -> ${out.join(', ')} (hub nečte adresy)` });
  for (const p of out) ctx.transmit(node.id, p, frame, bytes);
}
