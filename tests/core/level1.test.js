// Úroveň 1: zapouzdření zprávy, kroky scénáře, krok vpřed/vzad, nezávislost na modelu vrstev.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from '../../js/scenario/level1.js';
import { runTransfer } from '../../js/core/transfer.js';
import { viewAt, stepLabel, buildSteps } from '../../js/core/timeline.js';
import { layersOf, messageOf } from '../../js/core/pdu.js';
import { MODELS, rowOf, convertRowId } from '../../js/core/layers.js';
import { demux, stackOf } from '../../js/proto/registry.js';
import { checksum } from '../../js/wire/encode.js';

const { run, timeline } = buildLevel1(scenario);

test('scénář je čistá data (JSON beze ztráty)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(scenario.format, 'tcpipsim-scenario/1');
});

test('zpráva dorazí k Bobovi beze změny', () => {
  assert.equal(run.delivered, 'Ahoj, Bobe!');
  const recv = run.records.find((r) => r.kind === 'app.recv');
  assert.equal(recv.node, 'PC2');
  assert.equal(messageOf(recv.pdu), scenario.actions[0].args.text);
});

test('pořadí záznamů: obálky shora dolů, sundávání zdola nahoru', () => {
  const seq = run.records.map((r) => (r.layer ? `${r.kind}:${r.layer}` : r.kind));
  assert.deepEqual(seq, ['sim.start', 'app.send:7', 'encap:4', 'encap:3', 'encap:2', 'phy.tx:1', 'link.tx',
    'phy.rx:1', 'decap:2', 'decap:3', 'decap:4', 'app.recv:7', 'sim.end']);
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
  assert.deepEqual([...bytes.slice(0, 6)], [0x02, 0, 0, 0, 0, 2]);   // cílová MAC = Bob (rozhodnutí 25)
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
  assert.equal(v(1).nodes.PC1.layers[7], 'active');
  assert.equal(v(2).nodes.PC1.layers[4], 'active');
  assert.equal(v(2).nodes.PC1.layers[6], 'done');           // L6, L5 jen průchod
  assert.equal(v(4).packet.pdu.proto, 'ethernet');
  assert.equal(v(5).packet.form, 'bits');
  assert.equal(v(6).packet.form, 'wire');
  assert.ok(Object.values(v(6).nodes.PC1.layers).every((s) => s === 'done'));
  assert.equal(v(7).nodes.PC2.layers[1], 'done');
  assert.equal(v(7).nodes.PC2.layers[2], 'active');
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

test('převod id řádku mezi modely: každé id má protějšek a cesta tam a zpět sedí', () => {
  for (const from of ['osi', 'tcpip']) {
    for (const to of ['osi', 'tcpip']) {
      for (const r of MODELS[from].rows) {
        const id = convertRowId(from, to, r.id);
        const target = MODELS[to].rows.find((x) => x.id === id);
        assert.ok(target, `${from}:${r.id} -> ${to}`);
        assert.ok(target.members.some((n) => r.members.includes(n)), `${r.id} a ${id} se překrývají`);
      }
    }
  }
  assert.equal(convertRowId('osi', 'tcpip', 'L6'), 'app');
  assert.equal(convertRowId('tcpip', 'osi', 'netif'), 'L2');
  assert.equal(convertRowId('osi', 'tcpip', 'transport'), null);   // id z jiného modelu
});

test('IPv4 Identification je čítač na uzel od 1 (ipv4.md kap. 2, rozhodnutí 22)', () => {
  const bytes = run.records.find((r) => r.kind === 'phy.tx').bytes;
  assert.deepEqual([...bytes.slice(18, 20)], [0, 1]);
  const enc = run.records.find((r) => r.kind === 'encap' && r.proto === 'ipv4');
  assert.equal(enc.pdu.h.id, 1);
});

test('demultiplex podle hlaviček: EtherType -> Protocol -> port', () => {
  const stack = stackOf(['ethernet', 'ipv4', 'udp']);
  const [udp, ipv4, eth] = stack;
  assert.equal(demux(stack, eth, { ethertype: 0x0800 }), ipv4);
  assert.equal(demux(stack, ipv4, { protocol: 17 }), udp);
  assert.equal(demux(stack, udp, { dport: 5000 }), 'app');
  assert.equal(demux(stack, eth, { ethertype: 0x86dd }), null);   // IPv6 v úrovni 1 není
  assert.equal(demux(stack, ipv4, { protocol: 1 }), null);        // ICMP v úrovni 1 není
  // hlavičky odesílatele nesou hodnoty modulu nad sebou
  const encs = run.records.filter((r) => r.kind === 'encap');
  assert.equal(encs.find((r) => r.proto === 'ethernet').pdu.h.ethertype, 0x0800);
  assert.equal(encs.find((r) => r.proto === 'ipv4').pdu.h.protocol, 17);
});

test('bez zapnutého UDP se paket zahodí na L3 (protokol není v této úrovni)', () => {
  const r = runTransfer({ topology: scenario.topology, protocols: ['ethernet', 'ipv4'],
    action: scenario.actions[0], seed: 1 });
  assert.equal(r.delivered, null);
  const drop = r.records.find((x) => x.kind === 'drop');
  assert.equal(drop.layer, 3);
  assert.equal(drop.reason, 'protokol není v této úrovni');
});

test('příjemce neposlouchá na cílovém portu: zpráva se zahodí na L4 a nedoručí', () => {
  const a = scenario.actions[0];
  const bad = runTransfer({ topology: scenario.topology, protocols: ['ethernet', 'ipv4', 'udp'],
    action: { ...a, args: { ...a.args, listen: 6000 } }, seed: 1 });
  assert.equal(bad.delivered, null);
  const v = viewAt(bad.records, bad.records.length - 1);
  assert.deepEqual(v.dropped, { node: 'PC2', layer: 4, proto: 'udp', reason: 'není pro tento uzel' });
});

test('scénář s krokem, který nic nenajde, je chyba', () => {
  assert.throws(() => buildSteps(run.records, [{ title: 'x', match: { kind: 'sim.start' } },
    { title: 'neexistuje', match: { kind: 'arp' } }]), /nenašel/);
});
