// Vrstvové modely ISO/OSI a TCP/IP. Čistá data, bez DOM.
// Terminologie podle docs/spec/model.md kap. 1 a CLAUDE.md.

// Rozhodnutí 49 (schválil Michal 2026-11-25, ruší rozhodnutí 18): texty podle prezentace „3. TCP/IP - L4“.
const NIC = 'firmware síťového rozhraní';
const L4_ROLE = 'a) Spolehlivé doručení dat (TCP; UDP ne): příjem se potvrzuje, ztracená data se pošlou znovu, velká data se rozdělí na části a u příjemce se složí ve správném pořadí. b) Doručení dat správné aplikaci na cílovém uzlu (podle portu): multiplex / demultiplex.';
const L4_DETAIL = 'Data se tu jmenují transportní paket; u UDP je to UDP datagram (RFC 768), u TCP segment. Bod a) platí jen pro TCP.';
const L3_ROLE = 'Přeprava dat mezi uzly, které mohou ležet i mimo vlastní síť (podle IP adresy). Doručení lokální (cíl ve stejné síti, přímo) nebo vzdálené (přes router).';
const L2_ROLE = 'Přeprava dat mezi přímo spojenými uzly (ve stejné síti, i přes switch).';
const L1_ROLE = 'Data, signály: převod bitů na signál na médiu (kabel, vzduch, optika) a zpět.';

// Vrstvy ISO/OSI, klíč = číslo vrstvy (1..7); `gen` = název ve 2. pádě („obálka linkové vrstvy“),
// `detail` = doplňující věta do panelu Detail (Michalovy názvy PDU).

export const OSI_LAYERS = [
  { n: 7, name: 'Aplikační', gen: 'aplikační vrstvy', pdu: 'data', who: 'aplikace', shape: 'hexagon',
    role: 'Komunikace s aplikací: aplikace (prohlížeč, e-mail) tu předává a přijímá zprávy svým protokolem (třeba HTTP, SMTP).' },
  { n: 6, name: 'Prezentační', gen: 'prezentační vrstvy', pdu: 'data', who: 'aplikace', shape: 'pentagon',
    role: 'Interpretace dat: kódování, šifrování, komprese. V TCP/IP to řeší sama aplikace.' },
  { n: 5, name: 'Relační', gen: 'relační vrstvy', pdu: 'data', who: 'aplikace', shape: 'diamond',
    role: 'Řízení a koordinace relace (dialogu mezi aplikacemi). V TCP/IP to řeší sama aplikace.' },
  { n: 4, name: 'Transportní', gen: 'transportní vrstvy', pdu: 'segment', who: 'operační systém', shape: 'triangle',
    role: L4_ROLE, detail: L4_DETAIL },
  { n: 3, name: 'Síťová', gen: 'síťové vrstvy', pdu: 'paket', who: 'operační systém', shape: 'circle',
    role: L3_ROLE, detail: 'Data se tu jmenují síťový paket (IP datagram).' },
  { n: 2, name: 'Linková', gen: 'linkové vrstvy', pdu: 'rámec', who: NIC, shape: 'square',
    role: L2_ROLE, detail: 'Data se tu jmenují linkový rámec.' },
  { n: 1, name: 'Fyzická', gen: 'fyzické vrstvy', pdu: 'bity', who: NIC, shape: 'rect',
    role: L1_ROLE, detail: 'L1 je z velké části hardware síťové karty.' },
];

// Vrstvy TCP/IP; `members` = které vrstvy ISO/OSI pokrývá, barva a tvar podle nejvyššího členu.
export const TCPIP_LAYERS = [
  { id: 'app', name: 'Aplikační', gen: 'aplikační vrstvy', members: [7, 6, 5], pdu: 'data', who: 'aplikace',
    role: 'Komunikace s aplikací, interpretace dat (kódování, šifrování, komprese) a řízení relace: v TCP/IP to všechno řeší sama aplikace.' },
  { id: 'transport', name: 'Transportní', gen: 'transportní vrstvy', members: [4], pdu: 'segment', who: 'operační systém',
    role: L4_ROLE, detail: L4_DETAIL },
  { id: 'internet', name: 'Síťová', gen: 'síťové vrstvy', members: [3], pdu: 'paket', who: 'operační systém',
    role: L3_ROLE, detail: 'Data se tu jmenují síťový paket (IP datagram).' },
  { id: 'netif', name: 'Vrstva síťového rozhraní', gen: 'vrstvy síťového rozhraní', members: [2, 1], pdu: 'rámec, bity',
    who: NIC, detail: 'Data se tu jmenují linkový rámec, na médiu bity. L1 je z velké části hardware síťové karty.',
    role: `Je to název TCP/IP pro linkovou a fyzickou vrstvu (L2 a L1). L2: ${L2_ROLE.toLowerCase()} L1: ${L1_ROLE.toLowerCase()}` },
];

// Krátký popisek „kdo se stará“ do řádku sloupce vrstev (celý text je v panelu informací).
// „firmware síťového rozhraní“ se do řádku vrstvy nevejde (šířka 170–262 px), proto zkratka.
function shortWho(who) {
  return who === NIC ? 'firmware síť. rozhraní' : who;
}

export const MODELS = {
  osi: { id: 'osi', label: 'ISO/OSI (7)', rows: OSI_LAYERS.map((l) => ({
    id: `L${l.n}`, name: l.name, gen: l.gen, members: [l.n], badge: `L${l.n}`, color: l.n, pdu: l.pdu,
    who: l.who, whoShort: shortWho(l.who), role: l.role, detail: l.detail })) },
  tcpip: { id: 'tcpip', label: 'TCP/IP (4)', rows: TCPIP_LAYERS.map((l) => {
    const hi = Math.max(...l.members), lo = Math.min(...l.members);
    return { id: l.id, name: l.name, gen: l.gen, members: l.members,
      badge: hi === lo ? `L${hi}` : `L${lo}-${hi}`, color: hi, pdu: l.pdu, who: l.who,
      whoShort: shortWho(l.who), role: l.role, detail: l.detail };
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
