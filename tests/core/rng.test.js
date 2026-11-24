// Testy deterministického generátoru (seed => stejná posloupnost).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../js/core/rng.js';

test('stejný seed dává stejnou posloupnost, jiný seed jinou', () => {
  const seq = (seed) => { const r = new Rng(seed); return Array.from({ length: 5 }, () => r.nextU32()); };
  assert.deepEqual(seq(42), seq(42));
  assert.notDeepEqual(seq(42), seq(43));
});

test('int(min,max) zůstává v mezích (efemérní porty 49152-65535)', () => {
  const r = new Rng(7);
  for (let i = 0; i < 1000; i++) {
    const p = r.int(49152, 65535);
    assert.ok(p >= 49152 && p <= 65535);
  }
});

test('snapshot/restore obnoví posloupnost', () => {
  const r = new Rng(1);
  r.nextU32();
  const snap = r.snapshot();
  const a = [r.nextU32(), r.nextU32()];
  r.restore(snap);
  assert.deepEqual([r.nextU32(), r.nextU32()], a);
});
