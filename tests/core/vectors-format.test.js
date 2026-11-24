// Kontrola tvaru testovacích vektorů (docs/spec/vektory.md), dokud jádro neumí vektory přehrát.
// Hlídá sdílený formát mezi projektantem a jádrem: verze, odkazy linek na existující rozhraní.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'vectors');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

test('ve složce tests/vectors je aspoň jeden vektor', () => {
  assert.ok(files.length > 0);
});

for (const f of files) {
  test(`vektor ${f}: formát a topologie`, () => {
    const v = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.equal(v.format, 'tcpipsim-vector/1');
    assert.equal(`${v.id}.json`, f, 'id odpovídá názvu souboru');
    const ends = new Map(); // "uzel/rozhraní" -> existuje
    for (const n of v.topology.nodes) {
      for (const i of n.interfaces ?? []) ends.set(`${n.id}/${i.name}`, false);
      for (const p of n.ports ?? []) ends.set(`${n.id}/${p}`, false);
    }
    const linkIds = new Set();
    for (const l of v.topology.links) {
      linkIds.add(l.id);
      for (const e of [l.a, l.b]) {
        const k = `${e.node}/${e.if}`;
        assert.ok(ends.has(k), `linka ${l.id}: neznámé rozhraní ${k}`);
        assert.equal(ends.get(k), false, `rozhraní ${k} je ve dvou linkách`);
        ends.set(k, true);
      }
    }
    for (const t of v.expected.transmissions) {
      assert.ok(linkIds.has(t.link), `přenos ${t.n}: neznámá linka ${t.link}`);
      assert.ok(Number.isInteger(t.step) && t.step >= 1, `přenos ${t.n}: step`);
    }
  });
}
