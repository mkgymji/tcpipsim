// Převod PDU na bajty (bez DOM). Úroveň 1: Ethernet II + IPv4 + UDP + data (UTF-8).
// Rámec bez preambule a bez FCS, s výplní na 60 B (docs/spec/model.md kap. 5, ethernet.md).

const utf8 = new TextEncoder();

// Internetový kontrolní součet podle RFC 1071 (16bitový jedničkový doplněk).
export function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += (bytes[i] << 8) | (bytes[i + 1] ?? 0);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return ~sum & 0xffff;
}

const mac = (s) => s.split(':').map((x) => parseInt(x, 16));
const ip = (s) => s.split('.').map(Number);
const u16 = (v) => [(v >>> 8) & 0xff, v & 0xff];

function encodeData(pdu) {
  return utf8.encode(pdu.payload);
}

function encodeUdp(pdu, ipH) {
  const body = encode(pdu.payload);
  const len = 8 + body.length;
  const seg = new Uint8Array(len);
  seg.set([...u16(pdu.h.sport), ...u16(pdu.h.dport), ...u16(len), 0, 0]);
  seg.set(body, 8);
  if (ipH) {
    // pseudohlavička IPv4 (RFC 768)
    const pseudo = new Uint8Array(12 + len);
    pseudo.set([...ip(ipH.src), ...ip(ipH.dst), 0, 17, ...u16(len)]);
    pseudo.set(seg, 12);
    const c = checksum(pseudo) || 0xffff;
    seg.set(u16(c), 6);
  }
  return seg;
}

function encodeIpv4(pdu) {
  const h = pdu.h;
  const body = pdu.payload.proto === 'udp' ? encodeUdp(pdu.payload, h) : encode(pdu.payload);
  const total = 20 + body.length;
  const pkt = new Uint8Array(total);
  pkt.set([0x45, 0, ...u16(total), ...u16(h.id ?? 0), 0, 0, h.ttl, h.protocol, 0, 0,
    ...ip(h.src), ...ip(h.dst)]);
  pkt.set(u16(checksum(pkt.subarray(0, 20))), 10);
  pkt.set(body, 20);
  return pkt;
}

function encodeEthernet(pdu) {
  const body = encode(pdu.payload);
  const frame = new Uint8Array(Math.max(60, 14 + body.length));
  frame.set([...mac(pdu.h.dst), ...mac(pdu.h.src), ...u16(pdu.h.ethertype)]);
  frame.set(body, 14);
  return frame;
}

const ENCODERS = { data: encodeData, udp: (p) => encodeUdp(p, null), ipv4: encodeIpv4, ethernet: encodeEthernet };

export function encode(pdu) {
  const fn = ENCODERS[pdu.proto];
  if (!fn) throw new Error(`Kódování pro "${pdu.proto}" chybí`);
  return fn(pdu);
}

// Prvních `n` bitů jako řetězec '0'/'1'.
export function bitString(bytes, n) {
  let s = '';
  for (let i = 0; s.length < n && i < bytes.length; i++) s += bytes[i].toString(2).padStart(8, '0');
  return s.slice(0, n);
}
