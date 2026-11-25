// Pole hlaviček pro rentgen (docs/spec/rentgen.md): pořadí na drátě, posun a délka v bajtech
// rámce, hodnota z bajtů (nic se nevymýšlí), názvy česky a z Wiresharku, vysvětlení.
// Bez DOM. `key` = pole důležité na úrovni 2 (sloupec Z v rentgen.md).
import { encode } from './encode.js';

const hex = (b, i, n) => [...b.subarray(i, i + n)];
const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const macAt = (b, i) => hex(b, i, 6).map((x) => x.toString(16).padStart(2, '0')).join(':');
const ipAt = (b, i) => hex(b, i, 4).join('.');
const bin = (v, n) => v.toString(2).padStart(n, '0');
const h4 = (v) => `0x${v.toString(16).padStart(4, '0')}`;

const ETHERTYPES = { 0x0800: 'IPv4', 0x0806: 'ARP' };
const IPPROTO = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' };

export function portRange(p) {
  if (p < 1024) return 'dobře známý port';
  if (p < 49152) return 'registrovaný port';
  return 'dynamický port';
}

const DECODE = new TextDecoder();

/**
 * Rozloží rámec na pole. Vrací { bytes, frameLen, dataLen, blocks: { ethernet, ipv4, udp, data } },
 * kde každý blok je { title, sub, layer, start, end, fields: [{ id, n, name, ws, bits, off, len, value, key, explain }] }.
 * `off`/`len` jsou bajty v rámci (bitová pole sdílí bajt, rentgen.md kap. 6).
 */
export function frameFields(frame) {
  const b = encode(frame);
  const total = u16(b, 16);
  const ihl = (b[14] & 0x0f) * 4;
  const l4 = 14 + ihl;
  const udpLen = u16(b, l4 + 4);
  const dataOff = l4 + 8, dataLen = udpLen - 8;
  const padOff = 14 + total, padLen = b.length - padOff;
  const text = DECODE.decode(b.subarray(dataOff, dataOff + dataLen));
  const chars = [...text].length;
  const et = u16(b, 12), proto = b[23];
  const sport = u16(b, l4), dport = u16(b, l4 + 2);
  const F = (id, n, name, ws, bits, off, len, value, key, explain) => ({ id, n, name, ws, bits, off, len, value, key, explain });

  const ethernet = { title: 'Rámec (Ethernet II)', tab: 'rámec', layer: 2, start: 0, end: 14, fields: [
    F('eth.dst', 1, 'Cílová MAC', 'Destination · eth.dst', 48, 0, 6, macAt(b, 0), true,
      'MAC adresa síťové karty, které je rámec určen; je první, aby se o rámci dalo rozhodnout co nejdřív.'),
    F('eth.src', 2, 'Zdrojová MAC', 'Source · eth.src', 48, 6, 6, macAt(b, 6), true,
      'MAC adresa síťové karty, která rámec odeslala.'),
    F('eth.type', 3, 'EtherType (typ obsahu)', 'Type · eth.type', 16, 12, 2, `${h4(et)} (${ETHERTYPES[et] ?? '?'})`, true,
      'Číslo, které říká, co je uvnitř rámce: 0x0800 znamená IPv4 paket, 0x0806 zprávu ARP.'),
    F('eth.data', 4, 'Data rámce', 'IPv4 paket níže', total * 8, 14, total, `IPv4 paket (${total} B)`, false,
      'Obsah rámce, tady celý IP paket.'),
    ...(padLen > 0 ? [F('eth.padding', 5, 'Výplň', 'Padding · eth.padding', padLen * 8, padOff, padLen,
      `${Array(padLen).fill('00').join(' ')} (${padLen} B)`, false,
      'Nuly, kterými se krátký rámec doplní na nejmenší povolenou délku 60 bajtů (bez kontrolního pole).')] : []),
    F('eth.fcs', padLen > 0 ? 6 : 5, 'Kontrola chyb (FCS)', 'Frame check sequence · eth.fcs', 32, b.length, 0, 'nepočítá se', false,
      'Kontrolní číslo (CRC-32) spočítané z celého rámce; příjemce ho přepočítá a poškozený rámec zahodí. Simulátor ho nepočítá.'),
  ] };

  const flags = b[20] >> 5, frag = u16(b, 20) & 0x1fff;
  const ipv4 = { title: 'Paket (IPv4, IP datagram)', tab: 'paket', layer: 3, start: 14, end: l4, fields: [
    F('ip.version', 1, 'Verze', 'Version · ip.version', 4, 14, 1, `${bin(b[14] >> 4, 4)} = ${b[14] >> 4}`, false, 'Verze protokolu IP; tady 4 (IPv4).'),
    F('ip.hdr_len', 2, 'Délka hlavičky', 'Header Length · ip.hdr_len', 4, 14, 1, `${bin(b[14] & 15, 4)} = ${b[14] & 15} → ${ihl} B`, false,
      'Délka IP hlavičky ve čtyřbajtových slovech; 5 slov = 20 bajtů.'),
    F('ip.dsfield.dscp', 3, 'DSCP (třída provozu)', 'Differentiated Services Codepoint · ip.dsfield.dscp', 6, 15, 1, `${bin(b[15] >> 2, 6)} = ${b[15] >> 2}`, false,
      'Číslo, podle kterého mohou routery dát přednost třeba hovorům před stahováním; 0 = běžný provoz.'),
    F('ip.dsfield.ecn', 4, 'ECN (hlášení zahlcení)', 'Explicit Congestion Notification · ip.dsfield.ecn', 2, 15, 1, `${bin(b[15] & 3, 2)} = ${b[15] & 3}`, false,
      'Dva bity, kterými router může upozornit, že je síť přetížená; 0 = nepoužívá se.'),
    F('ip.len', 5, 'Celková délka', 'Total Length · ip.len', 16, 16, 2, `${total} B`, false, 'Délka celého paketu v bajtech: IP hlavička a všechno, co nese.'),
    F('ip.id', 6, 'Identifikace', 'Identification · ip.id', 16, 18, 2, `${h4(u16(b, 18))} (${u16(b, 18)})`, false,
      'Číslo paketu od tohoto odesílatele; podle něj se skládají části paketu, pokud se cestou rozdělí.'),
    F('ip.flags', 7, 'Příznaky', 'Flags · ip.flags', 3, 20, 1, bin(flags, 3), false,
      'Rezervovaný bit, „nedělit“ (DF) a „budou další části“ (MF); tady nic nenastaveno.'),
    F('ip.frag_offset', 8, 'Posun části', 'Fragment Offset · ip.frag_offset', 13, 20, 2, String(frag), false,
      'Kde v původním paketu tahle část začíná, když se paket dělil; 0 = paket je celý.'),
    F('ip.ttl', 9, 'TTL (doba života)', 'Time to Live · ip.ttl', 8, 22, 1, String(b[22]), false,
      'Kolik routerů paket ještě smí projít; každý router ho sníží o 1 (víc v úrovni 3).'),
    F('ip.proto', 10, 'Protokol (typ obsahu)', 'Protocol · ip.proto', 8, 23, 1, `${proto} (${IPPROTO[proto] ?? '?'})`, true,
      'Číslo, které říká, co je uvnitř paketu: 17 = UDP, 6 = TCP, 1 = ICMP.'),
    F('ip.checksum', 11, 'Kontrolní součet hlavičky', 'Header Checksum · ip.checksum', 16, 24, 2, `${h4(u16(b, 24))} (správný)`, false,
      'Číslo spočítané jen z IP hlavičky; příjemce ho přepočítá a poškozený paket zahodí.'),
    F('ip.src', 12, 'Zdrojová IP', 'Source Address · ip.src', 32, 26, 4, ipAt(b, 26), true,
      'IP adresa rozhraní, ze kterého paket vyšel (původního odesílatele).'),
    F('ip.dst', 13, 'Cílová IP', 'Destination Address · ip.dst', 32, 30, 4, ipAt(b, 30), true,
      'IP adresa rozhraní, kterému je paket určen (konečného cíle).'),
    F('ip.data', 14, 'Data paketu', 'UDP datagram níže', udpLen * 8, l4, udpLen, `UDP datagram (${udpLen} B)`, false,
      'Obsah paketu, tady UDP datagram.'),
  ] };

  const udp = { title: 'UDP datagram', tab: 'segment', layer: 4, start: l4, end: dataOff, fields: [
    F('udp.sport', 1, 'Zdrojový port', 'Source Port · udp.srcport', 16, l4, 2, `${sport} (${portRange(sport)})`, true,
      'Číslo, pod kterým odesílající aplikace čeká na odpověď; operační systém ho přidělil z dynamického rozsahu.'),
    F('udp.dport', 2, 'Cílový port', 'Destination Port · udp.dstport', 16, l4 + 2, 2, `${dport} (${portRange(dport)})`, true,
      'Číslo aplikace v cílovém počítači; podle něj operační systém předá data té správné aplikaci.'),
    F('udp.length', 3, 'Délka', 'Length · udp.length', 16, l4 + 4, 2, `${udpLen} B`, false, 'Délka UDP datagramu v bajtech: 8 bajtů hlavičky a data.'),
    F('udp.checksum', 4, 'Kontrolní součet', 'Checksum · udp.checksum', 16, l4 + 6, 2, h4(u16(b, l4 + 6)), false,
      'Číslo spočítané z hlavičky, dat a obou IP adres (pseudohlavička); příjemce ho přepočítá a poškozený datagram zahodí.'),
    F('udp.payload', 5, 'Data', 'UDP payload · data.data', dataLen * 8, dataOff, dataLen,
      `"${text}" (${chars === dataLen ? `${dataLen} B` : `${chars} znaků, ${dataLen} B`})`, true,
      'Zpráva aplikace, kterou UDP doručí beze změny.'),
  ] };

  return { bytes: b, frameLen: b.length, dataOff, dataLen, padOff, padLen, text,
    summary: `Rámec: ${b.length} B · Ethernet II · IPv4 ${ipAt(b, 26)} → ${ipAt(b, 30)} · UDP ${sport} → ${dport} · data ${dataLen} B`,
    blocks: { ethernet, ipv4, udp } };
}

// Do kterého bloku bajt patří (pro barvy hexdumpu): 'l2' | 'l3' | 'l4' | 'data' | 'pad'.
export function byteRegion(ff, i) {
  if (i < 14) return 'l2';
  if (i < ff.blocks.ipv4.end) return 'l3';
  if (i < ff.dataOff) return 'l4';
  if (i < ff.dataOff + ff.dataLen) return 'data';
  return 'pad';
}

// ---- úroveň 3: obecný rozklad rámce s ARP nebo IPv4 + ICMP (rentgen.md, arp.md, icmp.md) ----

const ICMP_TYPES = { 0: 'Echo Reply', 3: 'Destination Unreachable', 8: 'Echo Request', 11: 'Time Exceeded' };
const ICMP_CODES = { 3: { 0: 'network unreachable', 1: 'host unreachable', 3: 'port unreachable' }, 11: { 0: 'TTL vypršelo cestou' } };

/**
 * Rozloží PDU (ethernet rámec, nebo samotný IPv4 paket, dokud rámec nevznikl) na bloky polí.
 * Vrací { bytes, blocks: [{ id, title, tab, layer, start, end, fields }], summary, padOff, padLen }.
 * Pole mají stejný tvar jako frameFields (id, n, name, ws, bits, off, len, value, key, explain).
 */
export function pduFields(top) {
  const b = encode(top);
  const F = (id, n, name, ws, bits, off, len, value, key, explain) => ({ id, n, name, ws, bits, off, len, value, key, explain });
  const blocks = [];
  let ip0 = 0, padOff = b.length, padLen = 0;
  let inner = top;
  if (top.proto === 'ethernet') {
    const et = u16(b, 12);
    const bodyLen = top.payload.proto === 'ipv4' ? u16(b, 16) : 28;
    padOff = 14 + bodyLen; padLen = b.length - padOff;
    blocks.push({ id: 'ethernet', title: 'Rámec (Ethernet II)', tab: 'rámec', layer: 2, start: 0, end: 14, fields: [
      F('eth.dst', 1, 'Cílová MAC', 'Destination · eth.dst', 48, 0, 6, macAt(b, 0), true,
        'MAC adresa síťové karty, které je rámec určen na tomto úseku (další skok, ne nutně konečný cíl). ff:ff:ff:ff:ff:ff = všem (broadcast).'),
      F('eth.src', 2, 'Zdrojová MAC', 'Source · eth.src', 48, 6, 6, macAt(b, 6), true, 'MAC adresa síťové karty, která rámec na tomto úseku odeslala.'),
      F('eth.type', 3, 'EtherType (typ obsahu)', 'Type · eth.type', 16, 12, 2, `${h4(et)} (${ETHERTYPES[et] ?? '?'})`, true,
        'Co je uvnitř rámce: 0x0800 IPv4 paket, 0x0806 zpráva ARP (bez IP paketu).'),
      ...(padLen > 0 ? [F('eth.padding', 4, 'Výplň', 'Padding · eth.padding', padLen * 8, padOff, padLen, `${padLen} B nul`, false,
        'Nuly, kterými se krátký rámec doplní na nejmenší povolenou délku 60 bajtů (bez kontrolního pole).')] : []),
      F('eth.fcs', padLen > 0 ? 5 : 4, 'Kontrola chyb (FCS)', 'Frame check sequence · eth.fcs', 32, b.length, 0, 'nepočítá se', false,
        'Kontrolní číslo (CRC-32) z celého rámce. Simulátor ho nepočítá.'),
    ] });
    ip0 = 14;
    inner = top.payload;
  }
  if (inner.proto === 'arp') {
    const o = ip0, op = u16(b, o + 6);
    blocks.push({ id: 'arp', title: 'ARP zpráva (přímo v rámci, bez IP)', tab: 'ARP', layer: 2, start: o, end: o + 28, fields: [
      F('arp.htype', 1, 'Typ hardwaru', 'Hardware type · arp.hw.type', 16, o, 2, `${u16(b, o)} (Ethernet)`, false, 'Druh linkové vrstvy: 1 = Ethernet.'),
      F('arp.ptype', 2, 'Typ protokolu', 'Protocol type · arp.proto.type', 16, o + 2, 2, `${h4(u16(b, o + 2))} (IPv4)`, false, 'Ke kterým adresám se hledá MAC: 0x0800 = IPv4.'),
      F('arp.hlen', 3, 'Délka MAC', 'Hardware size · arp.hw.size', 8, o + 4, 1, `${b[o + 4]} B`, false, 'Délka MAC adresy v bajtech.'),
      F('arp.plen', 4, 'Délka IP', 'Protocol size · arp.proto.size', 8, o + 5, 1, `${b[o + 5]} B`, false, 'Délka IP adresy v bajtech.'),
      F('arp.op', 5, 'Operace', 'Opcode · arp.opcode', 16, o + 6, 2, op === 1 ? '1 = dotaz (request)' : '2 = odpověď (reply)', true,
        'Dotaz: „kdo má tuto IP?“ (všem). Odpověď: „tuhle IP mám já, moje MAC je…“ (jen tazateli).'),
      F('arp.sha', 6, 'MAC odesílatele', 'Sender MAC address · arp.src.hw_mac', 48, o + 8, 6, macAt(b, o + 8), true, 'MAC toho, kdo zprávu poslal.'),
      F('arp.spa', 7, 'IP odesílatele', 'Sender IP address · arp.src.proto_ipv4', 32, o + 14, 4, ipAt(b, o + 14), true, 'IP toho, kdo zprávu poslal; příjemce dotazu si ji zapíše.'),
      F('arp.tha', 8, 'Hledaná MAC', 'Target MAC address · arp.dst.hw_mac', 48, o + 18, 6, `${macAt(b, o + 18)}${op === 1 ? ' (neznámá)' : ''}`, op !== 1,
        'U dotazu nuly: právě tuhle MAC tazatel nezná. U odpovědi MAC tazatele.'),
      F('arp.tpa', 9, 'Hledaná IP', 'Target IP address · arp.dst.proto_ipv4', 32, o + 24, 4, ipAt(b, o + 24), true,
        'U dotazu IP, ke které se hledá MAC (vždy ve stejné síti: další skok). U odpovědi IP tazatele.'),
    ] });
    return { bytes: b, blocks, padOff, padLen,
      summary: `Rámec: ${b.length} B · Ethernet II · ARP ${op === 1 ? `dotaz: kdo má ${ipAt(b, o + 24)}?` : `odpověď: ${ipAt(b, o + 14)} je na ${macAt(b, o + 8)}`}` };
  }
  // IPv4 + ICMP
  const o = ip0, ihl = (b[o] & 0x0f) * 4, total = u16(b, o + 2), proto = b[o + 9];
  blocks.push({ id: 'ipv4', title: 'Paket (IPv4)', tab: 'paket', layer: 3, start: o, end: o + ihl, fields: [
    F('ip.version', 1, 'Verze', 'Version · ip.version', 4, o, 1, String(b[o] >> 4), false, 'Verze protokolu IP; tady 4 (IPv4).'),
    F('ip.hdr_len', 2, 'Délka hlavičky', 'Header Length · ip.hdr_len', 4, o, 1, `${ihl} B`, false, 'Délka IP hlavičky; 5 slov po 4 B = 20 B.'),
    F('ip.dsfield', 3, 'DSCP a ECN', 'Differentiated Services · ip.dsfield', 8, o + 1, 1, String(b[o + 1]), false, 'Třída provozu a hlášení zahlcení; 0 = běžný provoz.'),
    F('ip.len', 4, 'Celková délka', 'Total Length · ip.len', 16, o + 2, 2, `${total} B`, false, 'Délka celého paketu: hlavička a všechno, co nese.'),
    F('ip.id', 5, 'Identifikace', 'Identification · ip.id', 16, o + 4, 2, String(u16(b, o + 4)), false, 'Číslo paketu od tohoto odesílatele (pro skládání částí).'),
    F('ip.flags', 6, 'Příznaky a posun části', 'Flags, Fragment Offset', 16, o + 6, 2, bin(u16(b, o + 6), 16), false, 'Dělení paketu na části; tady se nedělí.'),
    F('ip.ttl', 7, 'TTL (doba života)', 'Time to Live · ip.ttl', 8, o + 8, 1, String(b[o + 8]), true,
      'Kolik routerů paket ještě smí projít. Každý router TTL sníží o 1; kdyby kleslo na 0, paket zahodí a pošle zpět Time Exceeded.'),
    F('ip.proto', 8, 'Protokol (typ obsahu)', 'Protocol · ip.proto', 8, o + 9, 1, `${proto} (${IPPROTO[proto] ?? '?'})`, true,
      'Co je uvnitř paketu: 1 = ICMP, 6 = TCP, 17 = UDP. ICMP nemá porty, jede přímo v paketu.'),
    F('ip.checksum', 9, 'Kontrolní součet hlavičky', 'Header Checksum · ip.checksum', 16, o + 10, 2, `${h4(u16(b, o + 10))} (správný)`, false,
      'Číslo spočítané jen z IP hlavičky. Router po snížení TTL součet přepočítá, proto se na každém skoku mění.'),
    F('ip.src', 10, 'Zdrojová IP', 'Source Address · ip.src', 32, o + 12, 4, ipAt(b, o + 12), true, 'IP původního odesílatele; router ji nemění.'),
    F('ip.dst', 11, 'Cílová IP', 'Destination Address · ip.dst', 32, o + 16, 4, ipAt(b, o + 16), true, 'IP konečného cíle; router ji nemění, podle ní hledá ve směrovací tabulce.'),
  ] });
  if (inner.payload?.proto === 'icmp') {
    const c = o + ihl, t = b[c], code = b[c + 1];
    const err = t === 3 || t === 11;
    const fields = [
      F('icmp.type', 1, 'Typ', 'Type · icmp.type', 8, c, 1, `${t} = ${ICMP_TYPES[t] ?? '?'}`, true, 'Druh zprávy ICMP: 8 Echo Request (ping), 0 Echo Reply, 11 Time Exceeded, 3 Destination Unreachable.'),
      F('icmp.code', 2, 'Kód', 'Code · icmp.code', 8, c + 1, 1, `${code}${ICMP_CODES[t]?.[code] ? ` (${ICMP_CODES[t][code]})` : ''}`, err, 'Upřesnění typu.'),
      F('icmp.checksum', 3, 'Kontrolní součet', 'Checksum · icmp.checksum', 16, c + 2, 2, `${h4(u16(b, c + 2))} (správný)`, false, 'Kontrolní součet celé zprávy ICMP.'),
    ];
    if (err) {
      const q = c + 8;
      fields.push(F('icmp.unused', 4, 'Nevyužito', 'Unused', 32, c + 4, 4, '0', false, 'Čtyři bajty nul.'),
        F('icmp.orig', 5, 'Původní paket (kopie začátku)', 'Internet Protocol (vložený)', (total - ihl - 8) * 8, q, total - ihl - 8,
          `IP ${ipAt(b, q + 12)} → ${ipAt(b, q + 16)}, TTL ${b[q + 8]}, protokol ${b[q + 9]}`, true,
          'IP hlavička a prvních 8 B paketu, který router zahodil. Podle ní odesílatel pozná, kterou zprávu router zahodil (tracert tak spáruje sondu s odpovědí).'));
    } else {
      fields.push(F('icmp.id', 4, 'Identifikátor', 'Identifier · icmp.ident', 16, c + 4, 2, String(u16(b, c + 4)), false, 'Rozliší „relace“ pingu.'),
        F('icmp.seq', 5, 'Pořadové číslo', 'Sequence Number · icmp.seq', 16, c + 6, 2, String(u16(b, c + 6)), false, 'Číslo dotazu; odpověď ho zkopíruje.'),
        F('icmp.data', 6, 'Data', 'Data · data', (total - ihl - 8) * 8, c + 8, total - ihl - 8,
          b[c + 8] === 0 ? `${total - ihl - 8} B nul` : `"${DECODE.decode(b.subarray(c + 8, o + total))}" (${total - ihl - 8} B)`, false,
          'Data dotazu; odpověď je vrací beze změny.'));
    }
    fields.push(F('icmp.noport', 0, 'Zdrojový a cílový port', 'žádné', 0, c, 0, 'žádné: ICMP nemá porty', false,
      'ICMP jede přímo v IP paketu, nemá obálku transportní vrstvy, a tedy ani porty (rozhodnutí 47).'));
    blocks.push({ id: 'icmp', title: 'ICMP (uvnitř paketu)', tab: 'ICMP', layer: 3, start: c, end: o + total, fields });
  }
  const sum = `${top.proto === 'ethernet' ? `Rámec: ${b.length} B · Ethernet II · ` : ''}IPv4 ${ipAt(b, o + 12)} → ${ipAt(b, o + 16)} · TTL ${b[o + 8]}`
    + (proto === 1 ? ` · ICMP typ ${b[o + ihl]}` : '');
  return { bytes: b, blocks, padOff, padLen, summary: sum };
}
