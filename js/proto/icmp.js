// ICMP (RFC 792, icmp.md): jede přímo v IP paketu (Protocol 1), nemá porty (rozhodnutí 13, 47).
// Echo Request/Reply (ping, tracert) a chybové zprávy 3 (nedoručitelné) a 11 (TTL vypršelo).
// Tady data a parametry; chování je v core/netsim.js. Bez DOM.
export const ICMP = { ECHO_REPLY: 0, UNREACH: 3, ECHO: 8, TIME_EXCEEDED: 11 };

// Data pingu z Windows: 32 B (icmp.md kap. 2), sondy tracertu: 64 B nul (kap. 4.1).
export const PING_DATA = 'abcdefghijklmnopqrstuvwabcdefghi';
export const TRACERT_DATA = '\u0000'.repeat(64);

export const PING_PARAMS = { count: 4, timeout: 4_000_000, interval: 1_000_000, id: 1 };
export const TRACERT_PARAMS = { maxHops: 30, probes: 3, timeout: 4_000_000, id: 1 };

export const isIcmpError = (type) => type === ICMP.UNREACH || type === ICMP.TIME_EXCEEDED;

export const ICMP_NAMES = {
  0: 'Echo Reply', 8: 'Echo Request', 3: 'Destination Unreachable', 11: 'Time Exceeded',
};
export const UNREACH_CODES = { 0: 'network unreachable', 1: 'host unreachable', 3: 'port unreachable' };

export default {
  id: 'icmp',
  layer: 3,                 // součást síťové vrstvy, v IP paketu (Protocol 1)
  binds: { protocol: 1 },
  demuxField: null,
};
