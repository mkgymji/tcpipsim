// Deterministický generátor pseudonáhodných čísel (mulberry32).
// Používá se pro ISN v TCP, efemérní porty, IP Identification apod.
// Stav je jedno 32bitové číslo, takže jde snadno uložit do snímku.

export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  // Celé číslo 0 .. 2^32-1
  nextU32() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  // Celé číslo v intervalu [min, max]
  int(min, max) {
    return min + (this.nextU32() % (max - min + 1));
  }

  snapshot() {
    return { state: this.state };
  }

  restore(s) {
    this.state = s.state >>> 0;
  }
}
