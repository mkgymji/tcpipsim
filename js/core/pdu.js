// PDU jako neměnná vnořená struktura (docs/VYVOJ.md kap. 3.1). Bez DOM.
// Nejvnitřnější je blok `data` (obsah zprávy, L7); každá vrstva přidá obálku kolem.

export function dataPdu(id, text) {
  return Object.freeze({ id, parent: null, proto: 'data', layer: 7, h: Object.freeze({}), payload: text });
}

// Obalí `inner` hlavičkou protokolu `proto` na vrstvě `layer`.
export function encapsulate(id, proto, layer, h, inner) {
  return Object.freeze({ id, parent: inner.id, proto, layer, h: Object.freeze({ ...h }), payload: inner });
}

// Sundá vnější obálku; vrací vnitřní PDU.
export function decapsulate(pdu) {
  if (pdu.proto === 'data') throw new Error('Data už nemají obálku');
  return pdu.payload;
}

// Seznam vrstev obálek zvenku dovnitř, např. ['ethernet', 'ipv4', 'udp', 'data'].
export function layersOf(pdu) {
  const out = [];
  for (let p = pdu; p && typeof p === 'object'; p = p.payload) out.push({ proto: p.proto, layer: p.layer });
  return out;
}

// Obsah zprávy (text v nejvnitřnějším bloku data).
export function messageOf(pdu) {
  let p = pdu;
  while (p.proto !== 'data') p = p.payload;
  return p.payload;
}
