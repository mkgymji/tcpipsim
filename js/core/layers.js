// Vrstvové modely ISO/OSI a TCP/IP. Čistá data, bez DOM.
// Terminologie podle docs/spec/model.md kap. 1 a CLAUDE.md.

// Vrstvy ISO/OSI, klíč = číslo vrstvy (1..7).
export const OSI_LAYERS = [
  { n: 7, name: 'Aplikační', pdu: 'data', who: 'aplikace', shape: 'hexagon',
    role: 'Tady pracuje aplikace (prohlížeč, chat, e-mail). Vytvoří zprávu a předá ji níž.' },
  { n: 6, name: 'Prezentační', pdu: 'data', who: 'aplikace', shape: 'pentagon',
    role: 'Podoba dat: kódování znaků, komprese, šifrování. V TCP/IP to řeší sama aplikace (např. TLS).' },
  { n: 5, name: 'Relační', pdu: 'data', who: 'aplikace', shape: 'diamond',
    role: 'Řízení relace (spojení aplikací). V TCP/IP to řeší sama aplikace.' },
  { n: 4, name: 'Transportní', pdu: 'segment', who: 'operační systém', shape: 'triangle',
    role: 'Doručí data správné aplikaci v počítači (podle portu).' },
  { n: 3, name: 'Síťová', pdu: 'paket', who: 'operační systém', shape: 'circle',
    role: 'Dopraví paket přes sítě až k cílovému počítači (podle IP adresy).' },
  { n: 2, name: 'Linková', pdu: 'rámec', who: 'firmware síťového rozhraní', shape: 'square',
    role: 'Přenese rámec k dalšímu zařízení na stejném kabelu nebo v síti (podle MAC adresy).' },
  { n: 1, name: 'Fyzická', pdu: 'bity', who: 'firmware síťového rozhraní', shape: 'rect',
    role: 'Převede bity na signál v kabelu a zpět.' },
];

// Vrstvy TCP/IP; `members` = které vrstvy ISO/OSI pokrývá, barva a tvar podle nejvyššího členu.
export const TCPIP_LAYERS = [
  { id: 'app', name: 'Aplikační', members: [7, 6, 5], pdu: 'data', who: 'aplikace',
    role: 'Aplikace vytvoří zprávu. Kódování, šifrování i relace řeší sama.' },
  { id: 'transport', name: 'Transportní', members: [4], pdu: 'segment', who: 'operační systém',
    role: 'Doručí data správné aplikaci v počítači (podle portu).' },
  { id: 'internet', name: 'Síťová', members: [3], pdu: 'paket', who: 'operační systém',
    role: 'Dopraví paket přes sítě až k cílovému počítači (podle IP adresy).' },
  { id: 'netif', name: 'Vrstva síťového rozhraní', members: [2, 1], pdu: 'rámec, bity',
    who: 'firmware síťového rozhraní',
    role: 'Přenese rámec po kabelu k dalšímu zařízení; na drátě jako bity.' },
];

// Krátký popisek „kdo se stará“ do řádku sloupce vrstev (celý text je v panelu informací).
function shortWho(who) {
  return who === 'firmware síťového rozhraní' ? 'firmware rozhraní' : who;
}

export const MODELS = {
  osi: { id: 'osi', label: 'ISO/OSI (7)', rows: OSI_LAYERS.map((l) => ({
    id: `L${l.n}`, name: l.name, members: [l.n], badge: `L${l.n}`, color: l.n, pdu: l.pdu,
    who: l.who, whoShort: shortWho(l.who), role: l.role })) },
  tcpip: { id: 'tcpip', label: 'TCP/IP (4)', rows: TCPIP_LAYERS.map((l) => {
    const hi = Math.max(...l.members), lo = Math.min(...l.members);
    return { id: l.id, name: l.name, members: l.members,
      badge: hi === lo ? `L${hi}` : `L${lo}-${hi}`, color: hi, pdu: l.pdu, who: l.who,
      whoShort: shortWho(l.who), role: l.role };
  }) },
};

export function osiLayer(n) {
  const l = OSI_LAYERS.find((x) => x.n === n);
  if (!l) throw new RangeError(`Neznámá vrstva L${n}`);
  return l;
}

// Řádek modelu, do kterého patří vrstva ISO/OSI n.
export function rowOf(modelId, n) {
  const row = MODELS[modelId]?.rows.find((r) => r.members.includes(n));
  if (!row) throw new RangeError(`Vrstva L${n} v modelu ${modelId} neexistuje`);
  return row;
}

// Název PDU na vrstvě n (rámec/paket/segment/data/bity).
export function pduName(n) {
  return osiLayer(n).pdu;
}
