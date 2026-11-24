// Záznam (trace) simulace: seznam záznamů, ze kterých UI kreslí bez jádra (VYVOJ.md kap. 3.3).
export class Trace {
  constructor() {
    this.records = [];
  }

  // Přidá záznam; `i` = pořadí, `t` = virtuální čas (µs).
  emit(t, kind, data = {}) {
    const rec = Object.freeze({ i: this.records.length, t, kind, ...data });
    this.records.push(rec);
    return rec;
  }
}
