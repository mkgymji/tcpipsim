// Runner testovacích vektorů projektanta (tests/vectors/*.json, docs/spec/vektory.md):
// jádro přehraje topologii a akce a výsledek se porovná s očekáváním. Hlavní důkaz správnosti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runVector, compareVector, vectorSkipReason } from '../../js/core/harness.js';
import { checksum } from '../../js/wire/encode.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'vectors');
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

for (const f of files) {
  const v = load(f);
  const skip = vectorSkipReason(v);
  test(`vektor ${f}`, { skip: skip ? `úroveň 3: ${skip}` : false }, () => {
    const run = runVector(v);
    const diff = compareVector(v, run);
    assert.deepEqual(diff, [], diff.join('\n'));
  });
}

test('runner vektorů není bezzubý: změněné očekávání se pozná', () => {
  const v = load('udp-switch.json');
  const run = runVector(v);
  const bad = structuredClone(v);
  bad.expected.transmissions[1].pdu.eth.dst = '02:00:00:00:00:03';   // jiné pole
  bad.expected.transmissions.pop();                                    // chybějící přenos
  bad.expected.final_state.mac_table.SW1.pop();                        // jiná tabulka
  bad.expected.events.push({ step: 2, node: 'PC3', event: 'udp_deliver' });
  const diff = compareVector(bad, run);
  assert.ok(diff.some((d) => d.includes('eth.dst')), 'pole');
  assert.ok(diff.some((d) => d.includes('linka L1 z SW1')), 'počet přenosů');
  assert.ok(diff.some((d) => d.startsWith('mac_table SW1')), 'tabulka');
  assert.ok(diff.some((d) => d.includes('udp_deliver v PC3')), 'událost');
});

test('kontrolní součty IPv4 a UDP v rámcích vektoru jsou platné (RFC 1071)', () => {
  const run = runVector(load('udp-switch.json'));
  for (const r of run.records.filter((x) => x.kind === 'link.tx')) {
    const b = r.bytes;
    assert.equal(checksum(b.subarray(14, 34)), 0, 'IP hlavička');
    const udpLen = (b[38] << 8) | b[39];
    const pseudo = new Uint8Array(12 + udpLen);
    pseudo.set(b.subarray(26, 34));
    pseudo.set([0, 17, b[38], b[39]], 8);
    pseudo.set(b.subarray(34, 34 + udpLen), 12);
    assert.equal(checksum(pseudo), 0, 'UDP s pseudohlavičkou');
  }
});

test('hexdump rámce 1 a 4 vektoru udp-switch sedí s rentgen.md kap. 6', () => {
  const run = runVector(load('udp-switch.json'));
  const tx = run.records.filter((x) => x.kind === 'link.tx');
  const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
  assert.equal(hex(tx[0].bytes),
    '02 00 00 00 00 02 02 00 00 00 00 01 08 00 45 00 00 27 00 01 00 00 80 11 b7 56 c0 a8 01 0a c0 a8 '
    + '01 14 c0 00 13 88 00 13 06 09 41 68 6f 6a 2c 20 42 6f 62 65 21 00 00 00 00 00 00 00');
  const reply = tx.find((r) => r.from === 'PC2');
  assert.equal(hex(reply.bytes),
    '02 00 00 00 00 01 02 00 00 00 00 02 08 00 45 00 00 28 00 01 00 00 80 11 b7 55 c0 a8 01 14 c0 a8 '
    + '01 0a 13 88 c0 00 00 14 bb ea 41 68 6f 6a 2c 20 41 6c 69 63 65 21 00 00 00 00 00 00');
});
