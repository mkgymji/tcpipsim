// Statický registr protokolů (statické importy kvůli bundleru, VYVOJ.md R3).
import ethernet from './ethernet.js';
import arp from './arp.js';
import ipv4 from './ipv4.js';
import icmp from './icmp.js';
import udp from './udp.js';

export const PROTOCOLS = { ethernet, arp, ipv4, icmp, udp };

// Vrátí moduly zadaných id seřazené shora dolů (L4, L3, L2), odmítne neznámé.
export function stackOf(ids) {
  return ids.map((id) => {
    const p = PROTOCOLS[id];
    if (!p) throw new Error(`Neznámý protokol "${id}"`);
    return p;
  }).sort((a, b) => b.layer - a.layer);
}

// Demultiplex: který zapnutý modul zpracuje obsah PDU s hlavičkou `h` modulu `mod`
// (EtherType -> Protocol -> port). Vrací modul, 'app' (nad ním je aplikace), nebo null
// (protokol v této úrovni není zapnutý).
export function demux(stack, mod, h) {
  if (!mod.demuxField) return 'app';
  const field = mod.demuxField, value = h[field];
  if (value === undefined) return null;
  return stack.find((p) => p.binds && Object.hasOwn(p.binds, field) && p.binds[field] === value) ?? null;
}
