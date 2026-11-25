// Zpráva, kterou pohled kroku právě ukazuje (blok v prostředním sloupci), jako čistá data:
// { from, to, proto, flags?, seq?, ack?, data?, op?, type? }. `from`/`to` = id uzlů podle adres v hlavičkách
// (ne podle dvojice scénáře, rozhodnutí 50). Testy porovnávají s `expect` kroku (úrovně 2–4). Bez DOM.

const ipsOfNode = (n) => [n?.ip, ...(n?.interfaces ?? []).map((i) => i.ip)].filter(Boolean);
export const nodeByIp = (v, ip) => (v.order ?? Object.keys(v.nodes)).find((id) => ipsOfNode(v.nodes[id]).includes(ip)) ?? null;

export function shownMessage(v) {
  let p = v.packet?.pdu;
  if (!p) return null;
  if (p.proto === 'ethernet') p = p.payload;
  if (p?.proto === 'arp') return { proto: 'arp', op: p.h.op === 1 ? 'request' : 'reply', from: nodeByIp(v, p.h.spa), to: p.h.op === 1 ? null : nodeByIp(v, p.h.tpa) };
  let ip = null;
  if (p?.proto === 'ipv4') { ip = p; p = p.payload; } else if (p && v.pkt?.payload === p) ip = v.pkt;   // rozbalený paket
  const out = { from: ip ? nodeByIp(v, ip.h.src) : v.flow?.sender ?? null, to: ip ? nodeByIp(v, ip.h.dst) : v.flow?.receiver ?? null };
  // data v aplikaci příjemce (po rozbalení): od koho přišla podle doručení, ne podle toku
  const at = v.packet.at, d = v.delivered;
  if (!ip && at && d?.node === at && d.from) { out.from = nodeByIp(v, String(d.from).split(':')[0]); out.to = at; }
  if (!p) return out;
  if (p.proto === 'data' || p.proto === 'dns') {
    // L7 bez obálek (před zabalením / po rozbalení): kdo a komu podle toku
    out.proto = p.proto === 'dns' ? 'dns' : 'data';
    return out;
  }
  out.proto = p.proto;
  if (p.proto === 'tcp') Object.assign(out, { flags: p.h.flagsText, seq: p.h.rel?.seq, ack: p.h.rel?.ack, data: Boolean(p.payload) });
  else if (p.proto === 'udp') Object.assign(out, { dns: p.payload?.proto === 'dns' ? (p.payload.h.qr ? 'answer' : 'query') : undefined, data: Boolean(p.payload) });
  else if (p.proto === 'icmp') out.type = p.h.type;
  return out;
}

/** Rozdíly zobrazené zprávy od očekávání kroku (prázdné = sedí). */
export function expectDiff(v, expect) {
  const m = shownMessage(v) ?? {};
  return Object.entries(expect).filter(([k, val]) => !['right', 'left'].includes(k) && m[k] !== val)
    .map(([k, val]) => `${k}: čekáno ${JSON.stringify(val)}, zobrazeno ${JSON.stringify(m[k])}`);
}
