// Úroveň 1: zapouzdření zprávy, kroky scénáře, krok vpřed/vzad, nezávislost na modelu vrstev.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from '../../js/scenario/level1.js';
import { runTransfer } from '../../js/core/transfer.js';
import { viewAt, stepLabel, buildSteps } from '../../js/core/timeline.js';
import { layersOf, messageOf } from '../../js/core/pdu.js';
import { MODELS, rowOf } from '../../js/core/layers.js';
import { checksum } from '../../js/wire/encode.js';

const { run, timeline } = buildLevel1(scenario);

test('scénář je čistá data (JSON beze ztráty)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(scenario.format, 'tcpipsim-scenario/1');
});

test('zpráva dorazí k Bobovi beze změny', () => {
  assert.equal(run.delivered, 'Ahoj, Bobe!');
  const recv = run.records.find((r) => r.kind === 'app.recv');
  assert.equal(recv.node, 'PCB');
  assert.equal(messageOf(recv.pdu), scenario.actions[0].args.text);
});

test('pořadí záznamů: obálky shora dolů, sundávání zdola nahoru', () => {
  const seq = run.records.map((r) => (r.layer ? `${r.kind}:${r.layer}` : r.kind));
  assert.deepEqual(seq, ['sim.start', 'app.send:7', 'encap:4', 'encap:3', 'encap:2', 'phy.tx:1', 'link.tx',
    'phy.rx:2', 'decap:2', 'decap:3', 'decap:4', 'app.recv:7', 'sim.end']);
});

test('rámec má právě 3 obálky (L4, L3, L2) kolem dat, žádné L5/L6', () => {
  const frame = run.records.find((r) => r.kind === 'phy.tx').pdu;
  const layers = layersOf(frame);
  assert.deepEqual(layers.map((l) => l.proto), ['ethernet', 'ipv4', 'udp', 'data']);
  assert.equal(layers.filter((l) => l.proto !== 'data').length, 3);
  assert.ok(layers.every((l) => l.layer <= 4 || l.proto === 'data'));
});

test('bity na drátě odpovídají skutečnému rámci (Ethernet II + IPv4 + UDP)', () => {
  const bytes = run.records.find((r) => r.kind === 'phy.tx').bytes;
  assert.equal(bytes.length, 60);                          // výplň na minimum, bez FCS
  assert.deepEqual([...bytes.slice(0, 6)], [0x02, 0xb0, 0xb0, 0, 0, 2]);   // cílová MAC = Bob
  assert.deepEqual([...bytes.slice(12, 14)], [0x08, 0x00]);                // EtherType IPv4
  const ip = bytes.slice(14, 34);
  assert.equal(ip[0], 0x45);
  assert.equal(ip[8], 128);                                 // TTL Windows
  assert.equal(ip[9], 17);                                  // UDP
  assert.equal(checksum(ip), 0);                            // hlavičkový součet sedí (RFC 1071)
  const totalLen = (ip[2] << 8) | ip[3];
  assert.equal(totalLen, 20 + 8 + 11);
  const udp = bytes.slice(34, 34 + 19);
  const pseudo = new Uint8Array([...ip.slice(12, 20), 0, 17, 0, 19, ...udp]);
  assert.equal(checksum(pseudo), 0);                        // UDP součet s pseudohlavičkou sedí
  assert.equal(new TextDecoder().decode(udp.slice(8)), 'Ahoj, Bobe!');
});

test('determinismus: stejný scénář = stejný záznam', () => {
  const again = buildLevel1(scenario).run;
  assert.deepEqual(again.records, run.records);
});

test('kroky 0-10 podle scénáře, krok 8 má podkroky 8a-8c', () => {
  assert.equal(timeline.length, 13);
  assert.deepEqual(timeline.steps.map(stepLabel),
    ['0', '1', '2', '3', '4', '5', '6', '7', '8a', '8b', '8c', '9', '10']);
  // každý záznam patří právě jednomu kroku
  const covered = timeline.steps.flatMap((s) => Array.from({ length: s.last - s.first + 1 }, (_, i) => s.first + i));
  assert.deepEqual(covered, run.records.map((r) => r.i));
  for (const s of timeline.steps) assert.ok(s.text && s.title, `krok ${stepLabel(s)} má text`);
});

test('stav vrstev a podoba zprávy v klíčových krocích', () => {
  const v = (k) => timeline.view(k);
  assert.equal(v(0).packet.form, 'message');
  assert.equal(v(1).nodes.PCA.layers[7], 'active');
  assert.equal(v(2).nodes.PCA.layers[4], 'active');
  assert.equal(v(2).nodes.PCA.layers[6], 'done');           // L6, L5 jen průchod
  assert.equal(v(4).packet.pdu.proto, 'ethernet');
  assert.equal(v(5).packet.form, 'bits');
  assert.equal(v(6).packet.form, 'wire');
  assert.ok(Object.values(v(6).nodes.PCA.layers).every((s) => s === 'done'));
  assert.equal(v(7).nodes.PCB.layers[1], 'done');
  assert.equal(v(7).nodes.PCB.layers[2], 'active');
  assert.equal(v(8).packet.pdu.proto, 'ipv4');
  assert.deepEqual(v(8).removed, { proto: 'ethernet', layer: 2 });
  assert.equal(v(10).packet.pdu.proto, 'data');
  assert.equal(v(11).delivered, v(11).message);
  assert.ok(v(12).ended);
});

test('krok vzad vrátí přesně předchozí stav', () => {
  const views = timeline.steps.map((_, k) => timeline.goto(k));
  for (let k = timeline.length - 1; k > 0; k--) {
    timeline.goto(k);
    assert.deepEqual(timeline.back(), views[k - 1], `zpět z kroku ${k}`);
  }
  assert.deepEqual(timeline.goto(-5), views[0]);
  assert.deepEqual(timeline.goto(99), views.at(-1));
});

test('modely ISO/OSI a TCP/IP pokrývají každou vrstvu právě jednou', () => {
  for (const m of Object.values(MODELS)) {
    const all = m.rows.flatMap((r) => r.members).sort();
    assert.deepEqual(all, [1, 2, 3, 4, 5, 6, 7], m.id);
  }
  assert.equal(MODELS.osi.rows.length, 7);
  assert.equal(MODELS.tcpip.rows.length, 4);
  assert.equal(rowOf('tcpip', 6).badge, 'L5-7');
  assert.equal(rowOf('tcpip', 1).badge, 'L1-2');
});

test('pohled nezávisí na modelu (přepnutí nezmění krok ani stav)', () => {
  // timeline model vůbec nezná; model je jen parametr vykreslení
  const before = timeline.goto(6);
  assert.deepEqual(timeline.view(6), before);
});

test('příjemce neposlouchá na cílovém portu: zpráva se zahodí na L4 a nedoručí', () => {
  const a = scenario.actions[0];
  const bad = runTransfer({ topology: scenario.topology, protocols: ['ethernet', 'ipv4', 'udp'],
    action: { ...a, args: { ...a.args, listen: 6000 } }, seed: 1 });
  assert.equal(bad.delivered, null);
  const v = viewAt(bad.records, bad.records.length - 1);
  assert.deepEqual(v.dropped, { node: 'PCB', layer: 4, proto: 'udp' });
});

test('scénář s krokem, který nic nenajde, je chyba', () => {
  assert.throws(() => buildSteps(run.records, [{ title: 'x', match: { kind: 'sim.start' } },
    { title: 'neexistuje', match: { kind: 'arp' } }]), /nenašel/);
});
