// Kurzor nad záznamem (trace): seskupení záznamů do didaktických kroků a pohled po kroku k.
// Pohled se počítá vždy znovu z předpony záznamu, takže krok vzad vrátí přesně předchozí
// stav (VYVOJ.md R6). Pro úroveň 1 jsou záznamy desítky, přepočet je zanedbatelný.

// Částečná shoda záznamu se vzorem (klíče vzoru musí mít stejnou hodnotu).
export function matches(rec, pattern) {
  return Object.entries(pattern).every(([k, v]) => rec[k] === v);
}

/**
 * Přiřadí krokům scénáře záznamy. Krok začíná prvním záznamem, který odpovídá jeho `match`
 * (hledá se od konce předchozího kroku), a končí před začátkem dalšího kroku.
 * Každý záznam patří právě jednomu kroku; jinak je to chyba scénáře.
 */
export function buildSteps(records, stepDefs) {
  const starts = [];
  let from = 0;
  for (const def of stepDefs) {
    const idx = records.findIndex((r, i) => i >= from && matches(r, def.match));
    if (idx < 0) throw new Error(`Krok "${def.title}" nenašel záznam ${JSON.stringify(def.match)}`);
    starts.push(idx);
    from = idx + 1;
  }
  if (starts[0] !== 0) throw new Error('První krok musí začínat prvním záznamem (sim.start)');
  return stepDefs.map((def, k) => ({
    ...def,
    index: k,
    first: starts[k],
    last: (k + 1 < starts.length ? starts[k + 1] : records.length) - 1,
  }));
}

const LAYERS = [1, 2, 3, 4, 5, 6, 7];

export function emptyNode(role) {
  return { role, pos: role === 'sender' ? 8 : 0, layers: Object.fromEntries(LAYERS.map((n) => [n, 'wait'])) };
}

// Posun zprávy v uzlu na vrstvu `layer`: předchozí aktivní a mezilehlé vrstvy jsou hotové.
export function move(node, layer) {
  const lo = Math.min(node.pos, layer), hi = Math.max(node.pos, layer);
  for (const n of LAYERS) {
    if (n >= lo && n <= hi && n !== layer) node.layers[n] = 'done';
    else if (node.layers[n] === 'active') node.layers[n] = 'done';
  }
  node.layers[layer] = 'active';
  node.pos = layer;
}

export function finish(node) {
  for (const n of LAYERS) if (node.layers[n] === 'active') node.layers[n] = 'done';
}

// Stav po záznamech records[0..upto] (včetně). Čistá data.
export function viewAt(records, upto) {
  const v = { nodes: {}, sender: null, receiver: null, message: null, packet: null,
    focus: null, removed: null, delivered: null, dropped: null, ended: false };
  for (let i = 0; i <= upto && i < records.length; i++) {
    const r = records[i];
    const node = r.node ? v.nodes[r.node] : null;
    v.removed = null;
    switch (r.kind) {
      case 'sim.start':
        v.sender = r.sender; v.receiver = r.receiver; v.message = r.text;
        v.nodes[r.sender] = emptyNode('sender');
        v.nodes[r.receiver] = emptyNode('receiver');
        v.packet = { form: 'message', text: r.text };
        v.focus = { node: r.sender, layer: null };
        break;
      case 'app.send':
      case 'encap':
        move(node, r.layer);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: r.layer };
        break;
      case 'phy.tx':
        move(node, 1);
        v.packet = { form: 'bits', pdu: r.pdu, bytes: r.bytes };
        v.focus = { node: r.node, layer: 1 };
        break;
      case 'link.tx':
        finish(v.nodes[r.from]);
        v.packet = { ...v.packet, form: 'wire' };
        v.focus = { link: r.link, from: r.from, to: r.to };
        break;
      case 'phy.rx':
        // fyzická vrstva přijala bity, linková z nich hned složí rámec (zobrazí se na L2)
        move(node, 1);
        move(node, 2);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.focus = { node: r.node, layer: 2 };
        break;
      case 'decap':
        move(node, r.layer);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.removed = { proto: r.proto, layer: r.layer };
        v.focus = { node: r.node, layer: r.layer };
        break;
      case 'app.recv':
        move(node, 7);
        v.packet = { form: 'pdu', pdu: r.pdu };
        v.delivered = r.text;
        v.focus = { node: r.node, layer: 7 };
        break;
      case 'drop':
        v.dropped = { node: r.node, layer: r.layer, proto: r.proto, reason: r.reason };
        break;
      case 'sim.end':
        for (const n of Object.values(v.nodes)) finish(n);
        v.ended = true;
        v.focus = null;
        break;
      default:
        throw new Error(`Neznámý druh záznamu "${r.kind}"`);
    }
  }
  return v;
}

export class Timeline {
  // viewFn(records, upto, from) = pohled po záznamu `upto`; `from` = první záznam kroku
  // (úroveň 2 podle něj zvýrazní, co se v kroku změnilo).
  constructor(records, stepDefs, viewFn = viewAt) {
    this.records = records;
    this.steps = buildSteps(records, stepDefs);
    this.viewFn = viewFn;
    this.cursor = 0;
  }

  get length() { return this.steps.length; }

  // Pohled po kroku k (stav + definice kroku + záznamy, které krok přidal).
  view(k = this.cursor) {
    const step = this.steps[k];
    if (!step) throw new RangeError(`Krok ${k} neexistuje`);
    return { ...this.viewFn(this.records, step.last, step.first), step,
      changes: this.records.slice(step.first, step.last + 1) };
  }

  goto(k) {
    this.cursor = Math.max(0, Math.min(this.length - 1, k));
    return this.view();
  }

  forward() { return this.goto(this.cursor + 1); }
  back() { return this.goto(this.cursor - 1); }
}

// Označení kroku pro UI: '4', u dílčích kroků '8a', '8b', '8c'.
export function stepLabel(step) {
  return step.part ? `${step.num}${'abcdefgh'[step.part[0] - 1]}` : String(step.num);
}

// Index kroku podle označení z UI ('8b'); samotné číslo dílčího kroku ('8') = jeho první část.
// Neznámé označení -> -1.
export function stepIndex(steps, label) {
  const s = String(label ?? '').trim().toLowerCase();
  const exact = steps.findIndex((st) => stepLabel(st) === s);
  if (exact >= 0) return exact;
  return /^\d+$/.test(s) ? steps.findIndex((st) => String(st.num) === s) : -1;
}

// Text kroku podle modelu: hodnota je řetězec, nebo { osi, tcpip } (texty závislé na režimu).
export function textFor(value, modelId) {
  if (value == null || typeof value === 'string') return value ?? '';
  return value[modelId] ?? '';
}
