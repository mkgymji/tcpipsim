// Vrstvové modely ISO/OSI a TCP/IP. Čistá data, bez DOM.
// Terminologie podle docs/spec/model.md kap. 1 a CLAUDE.md.

const NIC = 'síťová karta (hardware a firmware)';   // rozhodnuti.md bod 18

// Vrstvy ISO/OSI, klíč = číslo vrstvy (1..7); `gen` = název ve 2. pádě („obálka linkové vrstvy“).

export const OSI_LAYERS = [
  { n: 7, name: 'Aplikační', gen: 'aplikační vrstvy', pdu: 'data', who: 'aplikace', shape: 'hexagon',
    role: 'Tady pracuje aplikace (prohlížeč, e-mail). Vytvoří zprávu a posílá ji svým protokolem (třeba HTTP pro web, SMTP pro e-mail).' },
  { n: 6, name: 'Prezentační', gen: 'prezentační vrstvy', pdu: 'data', who: 'aplikace', shape: 'pentagon',
    role: 'Podoba dat: kódování znaků, komprese, šifrování. V TCP/IP to řeší sama aplikace.' },
  { n: 5, name: 'Relační', gen: 'relační vrstvy', pdu: 'data', who: 'aplikace', shape: 'diamond',
    role: 'Řídí dialog aplikací: navázání, udržení a ukončení relace. V TCP/IP to řeší sama aplikace.' },
  { n: 4, name: 'Transportní', gen: 'transportní vrstvy', pdu: 'segment', who: 'operační systém', shape: 'triangle',
    role: 'Doručí data správné aplikaci v počítači (podle portu).' },
  { n: 3, name: 'Síťová', gen: 'síťové vrstvy', pdu: 'paket', who: 'operační systém', shape: 'circle',
    role: 'Dopraví paket přes sítě až k cílovému počítači (podle IP adresy).' },
  { n: 2, name: 'Linková', gen: 'linkové vrstvy', pdu: 'rámec', who: NIC, shape: 'square',
    role: 'Přenese rámec k dalšímu zařízení v téže místní síti (LAN), podle MAC adresy.' },
  { n: 1, name: 'Fyzická', gen: 'fyzické vrstvy', pdu: 'bity', who: NIC, shape: 'rect',
    role: 'Převede bity na signál na médiu (kabel, vzduch, optika) a zpět.' },
];

// Vrstvy TCP/IP; `members` = které vrstvy ISO/OSI pokrývá, barva a tvar podle nejvyššího členu.
export const TCPIP_LAYERS = [
  { id: 'app', name: 'Aplikační', gen: 'aplikační vrstvy', members: [7, 6, 5], pdu: 'data', who: 'aplikace',
    role: 'Aplikace vytvoří zprávu a posílá ji svým protokolem (třeba HTTP). Kódování, šifrování i řízení relace řeší sama.' },
  { id: 'transport', name: 'Transportní', gen: 'transportní vrstvy', members: [4], pdu: 'segment', who: 'operační systém',
    role: 'Doručí data správné aplikaci v počítači (podle portu).' },
  { id: 'internet', name: 'Síťová', gen: 'síťové vrstvy', members: [3], pdu: 'paket', who: 'operační systém',
    role: 'Dopraví paket přes sítě až k cílovému počítači (podle IP adresy).' },
  { id: 'netif', name: 'Vrstva síťového rozhraní', gen: 'vrstvy síťového rozhraní', members: [2, 1], pdu: 'rámec, bity',
    who: NIC,
    role: 'Je to název TCP/IP pro linkovou a fyzickou vrstvu (L2 a L1). Přenese rámec k dalšímu zařízení v téže místní síti; po médiu jako bity.' },
];

// Krátký popisek „kdo se stará“ do řádku sloupce vrstev (celý text je v panelu informací).
function shortWho(who) {
  return who === NIC ? 'síťová karta' : who;
}

export const MODELS = {
  osi: { id: 'osi', label: 'ISO/OSI (7)', rows: OSI_LAYERS.map((l) => ({
    id: `L${l.n}`, name: l.name, gen: l.gen, members: [l.n], badge: `L${l.n}`, color: l.n, pdu: l.pdu,
    who: l.who, whoShort: shortWho(l.who), role: l.role })) },
  tcpip: { id: 'tcpip', label: 'TCP/IP (4)', rows: TCPIP_LAYERS.map((l) => {
    const hi = Math.max(...l.members), lo = Math.min(...l.members);
    return { id: l.id, name: l.name, gen: l.gen, members: l.members,
      badge: hi === lo ? `L${hi}` : `L${lo}-${hi}`, color: hi, pdu: l.pdu, who: l.who,
      whoShort: shortWho(l.who), role: l.role };
  }) },
};

// Převod id řádku mezi modely (např. 'L6' -> 'app', 'netif' -> 'L2'). Při přepnutí modelu
// se zobrazená informace o vrstvě převede, ne zahodí. Neznámé id -> null.
export function convertRowId(fromModel, toModel, id) {
  const row = MODELS[fromModel]?.rows.find((r) => r.id === id);
  if (!row || !MODELS[toModel]) return null;
  if (fromModel === toModel) return id;
  return rowOf(toModel, Math.max(...row.members)).id;
}

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
