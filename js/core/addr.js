// Práce s adresami MAC a IPv4 (bez DOM). Data simulátoru mají MAC s dvojtečkami a malými
// písmeny (model.md kap. 3); jiné zápisy jen pro výpis (Windows, Cisco).

export const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff';

export function normMac(mac) {
  return String(mac).toLowerCase().replace(/-/g, ':');
}

// Windows: pomlčky (ipconfig /all velkými písmeny, arp -a malými; cmd.md kap. 3 a 4).
export function macWindows(mac, upper = false) {
  const s = normMac(mac).replace(/:/g, '-');
  return upper ? s.toUpperCase() : s;
}

// Cisco IOS: tři skupiny po 4 hex číslicích s tečkami (0200.0000.0001).
export function macCisco(mac) {
  const h = normMac(mac).replace(/:/g, '');
  return `${h.slice(0, 4)}.${h.slice(4, 8)}.${h.slice(8, 12)}`;
}

// Skupinová adresa (broadcast i multicast): nejnižší bit prvního bajtu (I/G) = 1.
export function isGroupMac(mac) {
  return (parseInt(normMac(mac).slice(0, 2), 16) & 1) === 1;
}

export function ipToInt(ip) {
  return String(ip).split('.').reduce((a, x) => ((a << 8) | Number(x)) >>> 0, 0);
}

export function intToIp(n) {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

export function prefixMask(prefix) {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskString(prefix) {
  return intToIp(prefixMask(prefix));
}

export function sameSubnet(a, b, prefix) {
  const m = prefixMask(prefix);
  return ((ipToInt(a) & m) >>> 0) === ((ipToInt(b) & m) >>> 0);
}

export function networkOf(ip, prefix) {
  return intToIp((ipToInt(ip) & prefixMask(prefix)) >>> 0);
}

export function broadcastOf(ip, prefix) {
  return intToIp((ipToInt(ip) | ~prefixMask(prefix)) >>> 0);
}

// Multicast IPv4 -> MAC 01:00:5e + dolních 23 bitů (RFC 1112 kap. 6.4).
export function multicastMac(ip) {
  const n = ipToInt(ip) & 0x7fffff;
  return `01:00:5e:${[16, 8, 0].map((s) => ((n >>> s) & 255).toString(16).padStart(2, '0')).join(':')}`;
}
