// Plánovač diskrétních událostí. Bez DOM, deterministický.
// Čas je virtuální, celé číslo v mikrosekundách (µs). Pořadí událostí je dané
// dvojicí (time, seq): seq je pořadí naplánování, takže události ve stejném čase
// proběhnou vždy ve stejném pořadí (FIFO). Událost je čistá data {type, payload},
// ne closure, aby šel stav uložit do snímku (snapshot) a obnovit.

export class Scheduler {
  constructor() {
    this.now = 0;          // aktuální virtuální čas (µs)
    this.seq = 0;          // čítač naplánovaných událostí, zároveň id
    this.executed = 0;     // počet provedených událostí
    this.queue = [];       // binární halda podle (time, seq)
    this.handlers = new Map();   // type -> handler(event, scheduler)
    this.observers = new Set();  // pozorovatelé provedených událostí (UI, záznam)
  }

  // Registrace obsluhy pro typ události. Jeden typ = jedna obsluha.
  on(type, handler) {
    if (this.handlers.has(type)) throw new Error(`Obsluha pro "${type}" už existuje`);
    this.handlers.set(type, handler);
    return this;
  }

  // Pozorovatel dostane každou provedenou událost; vrací funkci pro odhlášení.
  subscribe(fn) {
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }

  // Naplánuje událost. Buď `delay` (relativně k now), nebo `at` (absolutně).
  schedule({ type, payload = null, delay, at }) {
    if (typeof type !== 'string' || !type) throw new TypeError('Událost musí mít type');
    const time = at !== undefined ? at : this.now + (delay ?? 0);
    if (!Number.isInteger(time)) throw new TypeError(`Čas musí být celé číslo (µs), je ${time}`);
    if (time < this.now) throw new RangeError(`Nelze plánovat do minulosti (${time} < ${this.now})`);
    const ev = { id: ++this.seq, time, type, payload };
    this.queue.push(ev);
    this.#siftUp(this.queue.length - 1);
    return ev.id;
  }

  // Zruší naplánovanou událost (např. časovač retransmise). Vrací true, pokud existovala.
  cancel(id) {
    const i = this.queue.findIndex((e) => e.id === id);
    if (i < 0) return false;
    const last = this.queue.pop();
    if (i < this.queue.length) {
      this.queue[i] = last;
      this.#siftDown(i);
      this.#siftUp(i);
    }
    return true;
  }

  peek() {
    return this.queue[0] ?? null;
  }

  get pending() {
    return this.queue.length;
  }

  // Provede jednu událost. Vrací ji, nebo null, když fronta je prázdná.
  step() {
    const ev = this.#pop();
    if (!ev) return null;
    this.now = ev.time;
    this.executed++;
    const handler = this.handlers.get(ev.type);
    if (!handler) throw new Error(`Chybí obsluha pro událost "${ev.type}"`);
    handler(ev, this);
    for (const fn of this.observers) fn(ev, this);
    return ev;
  }

  // Provádí události do času `until` (včetně) nebo do `maxEvents`. Vrací počet provedených.
  run({ until = Infinity, maxEvents = 1_000_000 } = {}) {
    let n = 0;
    while (n < maxEvents) {
      const next = this.peek();
      if (!next || next.time > until) break;
      this.step();
      n++;
    }
    if (until !== Infinity && until > this.now && n < maxEvents) this.now = until;
    return n;
  }

  // Snímek stavu jako čistá data (kopie). Obsluhy a pozorovatelé se neukládají.
  snapshot() {
    return structuredClone({ now: this.now, seq: this.seq, executed: this.executed, queue: this.queue });
  }

  restore(snap) {
    const s = structuredClone(snap);
    this.now = s.now;
    this.seq = s.seq;
    this.executed = s.executed;
    this.queue = s.queue;
  }

  // --- binární halda ---
  static #less(a, b) {
    return a.time < b.time || (a.time === b.time && a.id < b.id);
  }

  #pop() {
    const q = this.queue;
    if (q.length === 0) return null;
    const top = q[0];
    const last = q.pop();
    if (q.length > 0) {
      q[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #siftUp(i) {
    const q = this.queue;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!Scheduler.#less(q[i], q[p])) break;
      [q[i], q[p]] = [q[p], q[i]];
      i = p;
    }
  }

  #siftDown(i) {
    const q = this.queue;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < q.length && Scheduler.#less(q[l], q[m])) m = l;
      if (r < q.length && Scheduler.#less(q[r], q[m])) m = r;
      if (m === i) break;
      [q[i], q[m]] = [q[m], q[i]];
      i = m;
    }
  }
}
