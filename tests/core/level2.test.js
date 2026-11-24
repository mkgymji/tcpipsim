// Úroveň 2 „Adresy“: testovací kritéria ze scenarios/uroven2-adresy.md (kap. Testovací kritéria).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven2-adresy.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { stepIndex } from '../../js/core/timeline.js';

const { run, timeline } = buildLevel2(scenario);
const R = run.records;
const at = (label) => timeline.view(stepIndex(timeline.steps, label));
const inStep = (label) => at(label).changes;
const txs = (label) => inStep(label).filter((r) => r.kind === 'link.tx');

test('scénář je čistá data (JSON beze ztráty) a má kroky 0–17', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(Math.max(...timeline.steps.map((s) => s.num)), 17);
  assert.equal(timeline.length, 20);   // 0–17 + 8a, 8b, 8c
});

test('obálky zprávy 1: porty, IP, Protocol 17, MAC, EtherType 0x0800 (zdrojový port 49152, rozhodnutí 28)', () => {
  const f = R.find((r) => r.kind === 'encap' && r.layer === 2).pdu;
  assert.deepEqual(f.h, { dst: '02:00:00:00:00:02', src: '02:00:00:00:00:01', ethertype: 0x0800 });
  assert.equal(f.payload.h.src, '192.168.1.10');
  assert.equal(f.payload.h.dst, '192.168.1.20');
  assert.equal(f.payload.h.protocol, 17);
  assert.deepEqual(f.payload.payload.h, { sport: 49152, dport: 5000 });
});

test('hub: z portu 1 na porty 2 a 3; Cyril nic_drop bez vyšších vrstev; Bob doručí do „zprávy“', () => {
  assert.deepEqual(txs('6').map((r) => r.fromIf), ['P2', 'P3']);
  const k7 = inStep('7');
  assert.ok(k7.some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
  const hubPhase = R.slice(0, R.findIndex((r) => r.kind === 'topo.swap'));
  assert.ok(!hubPhase.some((r) => r.node === 'PC3' && ['decap', 'app.recv', 'udp_deliver', 'ip_deliver'].includes(r.kind)));
  const recv = hubPhase.find((r) => r.kind === 'app.recv' && r.node === 'PC2');
  assert.equal(recv.app, 'zpravy');
  assert.equal(recv.port, 5000);
});

test('odpověď: obálky prohozené a Cyril ji zahodí', () => {
  const reply = inStep('9').find((r) => r.kind === 'encap' && r.layer === 2).pdu;
  assert.deepEqual(reply.h, { dst: '02:00:00:00:00:01', src: '02:00:00:00:00:02', ethertype: 0x0800 });
  assert.equal(reply.payload.h.src, '192.168.1.20');
  assert.deepEqual(reply.payload.payload.h, { sport: 5000, dport: 49152 });
  assert.ok(inStep('9').some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
});

test('switch: krok 12 učení, 13 flooding, 14 jen Fa0/1, 16 jen Fa0/2 a „poznámky“', () => {
  const learn = inStep('12').find((r) => r.kind === 'mac_learn');
  assert.deepEqual([learn.entry.mac, learn.entry.port], ['02:00:00:00:00:01', 'Fa0/1']);
  const fl = inStep('13').find((r) => r.kind === 'flood');
  assert.deepEqual(fl.outPorts, ['Fa0/2', 'Fa0/3']);
  assert.ok(inStep('13').some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
  const k14 = inStep('14');
  assert.ok(k14.some((r) => r.kind === 'mac_learn' && r.entry.mac === '02:00:00:00:00:02' && r.entry.port === 'Fa0/2'));
  assert.deepEqual(k14.find((r) => r.kind === 'forward').outPorts, ['Fa0/1']);
  assert.ok(!k14.some((r) => r.kind === 'link.tx' && r.link === 'L3'), 'na lince Cyrila nic');
  const k16 = inStep('16');
  assert.deepEqual(k16.find((r) => r.kind === 'forward').outPorts, ['Fa0/2']);
  assert.ok(!k16.some((r) => r.link === 'L3'));
  assert.deepEqual(k16.filter((r) => r.kind === 'app.recv').map((r) => [r.node, r.app, r.port, r.text]),
    [['PC2', 'poznamky', 6000, 'Sejdeme se v 16:00']]);
});

test('MAC tabulka po krocích a krok vzad (11: 0, 12: 1, 14: 2, 15: Alice a Bob, Cyril chybí)', () => {
  const n = (l) => at(l).nodes.SW1.mac_table.length;
  assert.equal(n('11'), 0);
  assert.equal(n('12'), 1);
  assert.equal(n('13'), 1);
  assert.equal(n('14'), 2);
  assert.deepEqual(at('15').nodes.SW1.mac_table.map((e) => [e.mac, e.port]),
    [['02:00:00:00:00:01', 'Fa0/1'], ['02:00:00:00:00:02', 'Fa0/2']]);
  // krok vzad = přesně předchozí pohled
  for (let k = 1; k < timeline.length; k++) {
    timeline.goto(k);
    const back = timeline.back();
    assert.deepEqual(back, timeline.view(k - 1));
  }
  assert.ok(at('12').newEntries.SW1['02:00:00:00:00:01'], 'nový záznam zvýrazněný');
  assert.equal(at('13').newEntries.SW1, undefined, 'v dalším kroku už ne');
});

test('výměna hub -> switch: hub zmizí, switch má prázdnou tabulku; Obnovit (krok 0) vrátí hub', () => {
  assert.equal(at('10').nodes.HUB1.type, 'hub');
  assert.equal(at('11').nodes.HUB1, undefined);
  assert.deepEqual(at('11').nodes.SW1.mac_table, []);
  assert.equal(at('0').nodes.HUB1.type, 'hub');
});

test('pohled: dvojice ve výtahu, štítky PC, rámec pro rentgen', () => {
  assert.deepEqual([at('9').flow.sender, at('9').flow.receiver], ['PC2', 'PC1']);
  assert.equal(at('7').pills.PC3, 'dropped');
  assert.equal(at('8c').pills.PC2, 'received');
  assert.equal(at('7').nodes.PC3.layers[2], 'dropped');
  assert.equal(at('2').flowFrame.proto, 'ethernet');
  assert.deepEqual(at('13').decision.outPorts, ['Fa0/2', 'Fa0/3']);
});
