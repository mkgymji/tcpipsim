// TCP (L4, tcp.md): příznaky, ISN (FNV-1a ze seedu), parametry spojení. Stavový automat je
// v jádře (core/netsim.js), tady jen konstanty a čisté funkce. Bez DOM.

export const FLAG = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20, ECE: 0x40, CWR: 0x80 };

// Příznaky jako text v pořadí Wiresharku: „SYN, ACK“, „PSH, ACK“, „FIN, ACK“, „RST, ACK“.
const ORDER = ['CWR', 'ECE', 'URG', 'PSH', 'RST', 'SYN', 'FIN', 'ACK'];
export function flagsString(f) {
  // Wireshark: [SYN, ACK], [PSH, ACK], [FIN, ACK], [RST, ACK] = ACK vždy poslední
  return ORDER.filter((n) => f & FLAG[n]).join(', ');
}
export const hasFlag = (f, name) => Boolean(f & FLAG[name]);

export const TCP_PARAMS = {
  window: 64240,          // tcp.md kap. 2, jen zobrazit
  mss: 1460,              // volba MSS v SYN
  rto: 1_000_000,         // µs, RTO 1 s (RFC 6298 kap. 2.4), pak zdvojnásobit
  maxRetries: 5,          // pak spojení zrušit (tcp.md kap. 7.2)
  timeWait: 120_000_000,  // µs, 2 MSL (tcp.md kap. 9); jádro ho samo neukončí, jen akce `tcp_expire`
};

// Stavy RFC 9293 -> Windows netstat / Linux ss (tcp.md kap. 9).
export const STATE_WIN = { 'LISTEN': 'LISTENING', 'SYN-SENT': 'SYN_SENT', 'SYN-RECEIVED': 'SYN_RECEIVED',
  'ESTABLISHED': 'ESTABLISHED', 'FIN-WAIT-1': 'FIN_WAIT_1', 'FIN-WAIT-2': 'FIN_WAIT_2', 'CLOSE-WAIT': 'CLOSE_WAIT',
  'LAST-ACK': 'LAST_ACK', 'TIME-WAIT': 'TIME_WAIT' };
export const STATE_SS = { 'LISTEN': 'LISTEN', 'SYN-SENT': 'SYN-SENT', 'SYN-RECEIVED': 'SYN-RECV', 'ESTABLISHED': 'ESTAB',
  'FIN-WAIT-1': 'FIN-WAIT-1', 'FIN-WAIT-2': 'FIN-WAIT-2', 'CLOSE-WAIT': 'CLOSE-WAIT', 'LAST-ACK': 'LAST-ACK',
  'TIME-WAIT': 'TIME-WAIT' };

// FNV-1a 32 bitů z UTF-8 řetězce (tcp.md kap. 4).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(str)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** ISN = FNV-1a("<seed>|<lokální IP>:<port>|<vzdálená IP>:<port>"). Simulátor zjednodušuje (RFC 6528 bez hodin). */
export function isnOf(seed, local, remote) {
  return fnv1a(`${seed}|${local}|${remote}`);
}

export const seqAdd = (a, n) => (a + n) >>> 0;

export default {
  id: 'tcp',
  layer: 4,
  binds: { protocol: 6 },
  demuxField: null,   // nad TCP je aplikace (podle cílového portu a čtveřice)
};
