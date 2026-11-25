// DNS (L7, dns.md): zpráva dotazu a odpovědi, kódování na bajty (RFC 1035 kap. 4), zóna serveru.
// PDU: { proto: 'dns', layer: 7, h: { id, qr, opcode, aa, tc, rd, ra, rcode, question, answers } }. Bez DOM.

export const DNS_PORT = 53;
export const TYPES = { A: 1, NS: 2, CNAME: 5, PTR: 12, MX: 15, AAAA: 28 };
export const TYPE_NAMES = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));
export const RCODE = { 0: 'No error', 3: 'NXDOMAIN (jméno neexistuje)', 5: 'REFUSED (odmítnuto)' };
export const DNS_PARAMS = { timeout: 1_000_000, retries: 2 };   // resolver OS: 2 opakování po 1 s (dns.md kap. 5)

// 16bitové slovo Flags z jednotlivých bitů (dns.md kap. 2.1).
export function flagsWord(h) {
  return ((h.qr & 1) << 15) | ((h.opcode & 0xf) << 11) | ((h.aa & 1) << 10) | ((h.tc & 1) << 9)
    | ((h.rd & 1) << 8) | ((h.ra & 1) << 7) | (h.rcode & 0xf);
}

export function dnsQuery(id, name, type = 'A') {
  return { id, qr: 0, opcode: 0, aa: 0, tc: 0, rd: 1, ra: 0, rcode: 0,
    question: { name, type, class: 'IN' }, answers: [] };
}

const lc = (s) => s.toLowerCase();

/** Odpověď autoritativního serveru ze zóny (dns.md kap. 5): AA=1, RA=0; mimo zónu REFUSED, neexistující NXDOMAIN. */
export function dnsAnswer(zone, q) {
  const name = q.question.name;
  const inZone = zone && (lc(name) === lc(zone.zone) || lc(name).endsWith(`.${lc(zone.zone)}`));
  const answers = inZone ? zone.records.filter((r) => lc(r.name) === lc(name) && r.type === q.question.type)
    .map((r) => ({ name: r.name, type: r.type, class: 'IN', ttl: r.ttl, rdlength: 4, data: r.data })) : [];
  const exists = inZone && zone.records.some((r) => lc(r.name) === lc(name));
  const rcode = !inZone ? 5 : exists ? 0 : 3;
  return { id: q.id, qr: 1, opcode: 0, aa: inZone ? 1 : 0, tc: 0, rd: q.rd, ra: 0, rcode,
    question: { ...q.question }, answers };
}

const u16 = (v) => [(v >>> 8) & 0xff, v & 0xff];

export function encodeName(name) {
  const out = [];
  for (const label of name.split('.').filter(Boolean)) {
    const b = new TextEncoder().encode(label);
    out.push(b.length, ...b);
  }
  out.push(0);
  return out;
}

/** Zpráva DNS na bajty. Jméno v odpovědi = ukazatel 0xC00C na jméno v otázce (komprese, dns.md kap. 3). */
export function encodeDns(h) {
  const q = h.question;
  const bytes = [...u16(h.id), ...u16(flagsWord(h)), ...u16(1), ...u16(h.answers.length), 0, 0, 0, 0,
    ...encodeName(q.name), ...u16(TYPES[q.type]), ...u16(1)];
  for (const a of h.answers) {
    const name = lc(a.name) === lc(q.name) ? [0xc0, 0x0c] : encodeName(a.name);
    const t = a.ttl >>> 0;
    bytes.push(...name, ...u16(TYPES[a.type]), ...u16(1), (t >>> 24) & 0xff, (t >>> 16) & 0xff, (t >>> 8) & 0xff, t & 0xff,
      ...u16(4), ...a.data.split('.').map(Number));
  }
  return new Uint8Array(bytes);
}

/** Pole zprávy ve tvaru vektorů (vektory.md kap. 10, pdu.dns). */
export function dnsVectorFields(h) {
  const f = flagsWord(h);
  return { id: h.id, flags: `0x${f.toString(16).padStart(4, '0')}`, qr: h.qr, opcode: h.opcode, aa: h.aa, tc: h.tc,
    rd: h.rd, ra: h.ra, rcode: h.rcode, qdcount: 1, ancount: h.answers.length, nscount: 0, arcount: 0,
    question: { ...h.question }, answers: h.answers.map((a) => ({ ...a })) };
}
