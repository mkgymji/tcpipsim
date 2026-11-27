// Vrstvové modely ISO/OSI a TCP/IP. Čistá data, bez DOM.
// Terminologie podle docs/spec/model.md kap. 1 a CLAUDE.md.

// Rozhodnutí 49 (schválil Michal 2026-11-25, ruší rozhodnutí 18): texty podle prezentace „3. TCP/IP - L4“.
const NIC = 'firmware síťového rozhraní';
// Rozhodnutí 67: texty strukturované. `does` = body „Co řeší“ ({key} tučně, {text} za ním, {items} odrážky),
// `note` = doplněk ke „Co řeší“, `pduNote` = upřesnění názvu dat, `whoNote` = doplněk ke „Kdo se stará“.
// Znění podle rozh. 49 (schválil Michal), mění se jen členění.
const L4_DOES = [
  { key: 'a) Spolehlivé doručení dat', text: '(TCP; UDP ne):',
    items: ['příjem se potvrzuje', 'ztracená data se pošlou znovu', 'velká data se rozdělí na části a u příjemce se složí ve správném pořadí'] },
  { key: 'b) Doručení dat správné aplikaci', text: 'na cílovém uzlu (podle portu): multiplex / demultiplex.' },
];
const L4_PDU = 'transportní paket; u UDP je to UDP datagram (RFC 768), u TCP segment.';
const L3_DOES = [
  { key: 'Přeprava dat mezi uzly', text: 'které mohou ležet i mimo vlastní síť (podle IP adresy).' },
  { key: 'Doručení', text: 'lokální nebo vzdálené:', items: ['lokální: cíl ve stejné síti, přímo', 'vzdálené: přes router'] },
];
const L3_PDU = 'síťový paket (IP datagram).';
const L2_DOES = [{ key: 'Přeprava dat mezi přímo spojenými uzly', text: '(ve stejné síti, i přes switch).' }];
const L1_DOES = [{ key: 'Data, signály', text: 'převod bitů na signál na médiu (kabel, vzduch, optika) a zpět.' }];
const L1_WHO = 'L1 je z velké části hardware síťové karty.';
const IN_APP = 'V TCP/IP to řeší sama aplikace.';

// Vrstvy ISO/OSI, klíč = číslo vrstvy (1..7); `gen` = název ve 2. pádě („obálka linkové vrstvy“).

export const OSI_LAYERS = [
  { n: 7, name: 'Aplikační', gen: 'aplikační vrstvy', pdu: 'data', who: 'aplikace', shape: 'hexagon',
    does: [{ key: 'Komunikace s aplikací', text: 'aplikace (prohlížeč, e-mail) tu předává a přijímá zprávy svým protokolem (třeba HTTP, SMTP).' }] },
  { n: 6, name: 'Prezentační', gen: 'prezentační vrstvy', pdu: 'data', who: 'aplikace', shape: 'pentagon',
    does: [{ key: 'Interpretace dat', text: 'kódování, šifrování, komprese.' }], note: IN_APP },
  { n: 5, name: 'Relační', gen: 'relační vrstvy', pdu: 'data', who: 'aplikace', shape: 'diamond',
    does: [{ key: 'Řízení a koordinace relace', text: '(dialogu mezi aplikacemi).' }], note: IN_APP },
  { n: 4, name: 'Transportní', gen: 'transportní vrstvy', pdu: 'segment', who: 'operační systém', shape: 'triangle',
    does: L4_DOES, pduNote: L4_PDU },
  { n: 3, name: 'Síťová', gen: 'síťové vrstvy', pdu: 'paket', who: 'operační systém', shape: 'circle',
    does: L3_DOES, pduNote: L3_PDU },
  { n: 2, name: 'Linková', gen: 'linkové vrstvy', pdu: 'rámec', who: NIC, shape: 'square',
    does: L2_DOES, pduNote: 'linkový rámec.' },
  { n: 1, name: 'Fyzická', gen: 'fyzické vrstvy', pdu: 'bity', who: NIC, shape: 'rect',
    does: L1_DOES, whoNote: L1_WHO },
];

// Vrstvy TCP/IP; `members` = které vrstvy ISO/OSI pokrývá, barva a tvar podle nejvyššího členu.
export const TCPIP_LAYERS = [
  { id: 'app', name: 'Aplikační', gen: 'aplikační vrstvy', members: [7, 6, 5], pdu: 'data', who: 'aplikace',
    does: [{ key: 'Komunikace s aplikací' }, { key: 'Interpretace dat', text: '(kódování, šifrování, komprese)' }, { key: 'Řízení relace' }],
    note: 'V TCP/IP to všechno řeší sama aplikace.' },
  { id: 'transport', name: 'Transportní', gen: 'transportní vrstvy', members: [4], pdu: 'segment', who: 'operační systém',
    does: L4_DOES, pduNote: L4_PDU },
  { id: 'internet', name: 'Síťová', gen: 'síťové vrstvy', members: [3], pdu: 'paket', who: 'operační systém',
    does: L3_DOES, pduNote: L3_PDU },
  { id: 'netif', name: 'Vrstva síťového rozhraní', gen: 'vrstvy síťového rozhraní', members: [2, 1], pdu: 'rámec, bity',
    who: NIC, whoNote: L1_WHO, pduNote: 'linkový rámec, na médiu bity.',
    intro: 'Je to název TCP/IP pro linkovou a fyzickou vrstvu (L2 a L1).',
    does: [...L2_DOES.map((d) => ({ ...d, key: `L2: ${d.key}` })), ...L1_DOES.map((d) => ({ ...d, key: `L1: ${d.key}` }))] },
];

// Krátký popisek „kdo se stará“ do řádku sloupce vrstev (celý text je v panelu informací).
// „firmware síťového rozhraní“ se do řádku vrstvy nevejde (šířka 170–262 px), proto zkratka.
function shortWho(who) {
  return who === NIC ? 'firmware síť. rozhraní' : who;
}

// Strukturované texty vrstvy pro panel Detail.
function texts(l) {
  return { does: l.does, note: l.note, intro: l.intro, pduNote: l.pduNote, whoNote: l.whoNote };
}

export const MODELS = {
  osi: { id: 'osi', label: 'ISO/OSI (7)', rows: OSI_LAYERS.map((l) => ({
    id: `L${l.n}`, name: l.name, gen: l.gen, members: [l.n], badge: `L${l.n}`, color: l.n, pdu: l.pdu,
    who: l.who, whoShort: shortWho(l.who), ...texts(l) })) },
  tcpip: { id: 'tcpip', label: 'TCP/IP (4)', rows: TCPIP_LAYERS.map((l) => {
    const hi = Math.max(...l.members), lo = Math.min(...l.members);
    return { id: l.id, name: l.name, gen: l.gen, members: l.members,
      badge: hi === lo ? `L${hi}` : `L${lo}-${hi}`, color: hi, pdu: l.pdu, who: l.who,
      whoShort: shortWho(l.who), ...texts(l) };
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
