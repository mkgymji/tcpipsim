// Statický registr protokolů (statické importy kvůli bundleru, VYVOJ.md R3).
import ethernet from './ethernet.js';
import ipv4 from './ipv4.js';
import udp from './udp.js';

export const PROTOCOLS = { ethernet, ipv4, udp };

// Vrátí moduly zadaných id seřazené shora dolů (L4, L3, L2), odmítne neznámé.
export function stackOf(ids) {
  return ids.map((id) => {
    const p = PROTOCOLS[id];
    if (!p) throw new Error(`Neznámý protokol "${id}"`);
    return p;
  }).sort((a, b) => b.layer - a.layer);
}
