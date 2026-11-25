// ARP (RFC 826, arp.md): zpráva přímo v rámci (EtherType 0x0806), dotaz broadcastem, odpověď
// unicastem tazateli. Tady jen data a parametry; chování (fronta, opakování, příjem) je v
// core/netsim.js, protože potřebuje plánovač. Bez DOM.
export const ZERO_MAC = '00:00:00:00:00:00';

// Parametry simulace (arp.md kap. 5.1 a 6.2), nastavitelné v jádře.
export const ARP_PARAMS = {
  retries: 3,               // celkem pokusů
  retryInterval: 1_000_000, // µs mezi pokusy
  queueMax: 3,              // paketů ve frontě na jeden next hop
  timeout: { pc: 300e6, server: 300e6, router: 14_400e6 },   // µs platnosti záznamu
};

export default {
  id: 'arp',
  layer: 2,                 // „L2.5“: v rámci, pod IP; UI ho kreslí uvnitř obálky L2
  binds: { ethertype: 0x0806 },
  demuxField: null,
  tables: ['arp_cache'],
};

// Hlavička ARP zprávy: op 1 = request (kdo má tpa?), 2 = reply (spa je na sha).
export function arpRequest(iface, tpa) {
  return { htype: 1, ptype: 0x0800, op: 1, sha: iface.mac, spa: iface.ip, tha: ZERO_MAC, tpa };
}
export function arpReply(iface, req) {
  return { htype: 1, ptype: 0x0800, op: 2, sha: iface.mac, spa: iface.ip, tha: req.sha, tpa: req.spa };
}
