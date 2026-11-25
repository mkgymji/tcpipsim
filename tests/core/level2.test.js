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

test('scénář je čistá data (JSON beze ztráty) a má kroky 0–18', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(Math.max(...timeline.steps.map((s) => s.num)), 18);
  assert.equal(timeline.length, 21);   // 0–18 + 8a, 8b, 8c
});

test('obálky zprávy 1: porty, IP, Protocol 17, MAC, EtherType 0x0800 (zdrojový port 49152, rozhodnutí 28)', () => {
  const f = R.find((r) => r.kind === 'encap' && r.layer === 2).pdu;
  assert.deepEqual(f.h, { dst: '02:00:00:00:00:02', src: '02:00:00:00:00:01', ethertype: 0x0800 });
  assert.equal(f.payload.h.src, '192.168.1.10');
  assert.equal(f.payload.h.dst, '192.168.1.20');
  assert.equal(f.payload.h.protocol, 17);
  assert.deepEqual(f.payload.payload.h, { sport: 49152, dport: 5000 });
});

test('hub: z Fa0/1 na Fa0/2 a Fa0/3 (porty jako u switche, rozhodnutí 34); Cyril nic_drop; Bob doručí do „zprávy“', () => {
  assert.deepEqual(txs('6').map((r) => r.fromIf), ['Fa0/2', 'Fa0/3']);
  assert.deepEqual(at('0').nodes.HUB1.ports, at('10').nodes.SW1.ports);
  const k7 = inStep('7');
  assert.ok(k7.some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
  const hubPhase = R.slice(0, R.findIndex((r) => r.kind === 'topo.swap'));
  assert.ok(!hubPhase.some((r) => r.node === 'PC3' && ['decap', 'app.recv', 'udp_deliver', 'ip_deliver'].includes(r.kind)));
  const recv = hubPhase.find((r) => r.kind === 'app.recv' && r.node === 'PC2');
  assert.equal(recv.app, 'zpravy');
  assert.equal(recv.port, 5000);
});

test('odpověď přes hub je jeden krok (rozhodnutí 36): obálky prohozené, Cyril ji zahodí, shrnutí', () => {
  const reply = inStep('9').find((r) => r.kind === 'encap' && r.layer === 2).pdu;
  assert.deepEqual(reply.h, { dst: '02:00:00:00:00:01', src: '02:00:00:00:00:02', ethertype: 0x0800 });
  assert.equal(reply.payload.h.src, '192.168.1.20');
  assert.deepEqual(reply.payload.payload.h, { sport: 5000, dport: 49152 });
  assert.ok(inStep('9').some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
  assert.ok(inStep('9').some((r) => r.kind === 'mark' && r.id === 'hub-summary'));
  assert.equal(at('9').log.length, 2, 'shrnutí má obě zprávy');
});

test('switch: 11 učení (tip), 12 flooding, 13 učení Boba (tip), 14 jen Fa0/1, 16 tip, 17 jen Fa0/2 a „poznámky“', () => {
  const learn = inStep('11').find((r) => r.kind === 'mac_learn');
  assert.deepEqual([learn.entry.mac, learn.entry.port], ['02:00:00:00:00:01', 'Fa0/1']);
  const fl = inStep('12').find((r) => r.kind === 'flood');
  assert.deepEqual(fl.outPorts, ['Fa0/2', 'Fa0/3']);
  assert.ok(inStep('12').some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
  assert.ok(inStep('13').some((r) => r.kind === 'mac_learn' && r.entry.mac === '02:00:00:00:00:02' && r.entry.port === 'Fa0/2'));
  const k14 = inStep('14');
  assert.deepEqual(k14.find((r) => r.kind === 'forward').outPorts, ['Fa0/1']);
  assert.ok(!k14.some((r) => r.kind === 'link.tx' && r.link === 'L3'), 'na lince Cyrila nic');
  const k17 = inStep('17');
  assert.deepEqual(k17.find((r) => r.kind === 'forward').outPorts, ['Fa0/2']);
  assert.ok(!k17.some((r) => r.link === 'L3'));
  assert.deepEqual(k17.filter((r) => r.kind === 'app.recv').map((r) => [r.node, r.app, r.port, r.text]),
    [['PC2', 'poznamky', 6000, 'Sejdeme se v 16:00']]);
});

test('MAC tabulka po krocích a krok vzad (10: 0, 11: 1, 13: 2, 15: Alice a Bob, Cyril chybí)', () => {
  const n = (l) => at(l).nodes.SW1.mac_table.length;
  assert.equal(n('10'), 0);
  assert.equal(n('11'), 1);
  assert.equal(n('12'), 1);
  assert.equal(n('13'), 2);
  assert.deepEqual(at('15').nodes.SW1.mac_table.map((e) => [e.mac, e.port]),
    [['02:00:00:00:00:01', 'Fa0/1'], ['02:00:00:00:00:02', 'Fa0/2']]);
  // krok vzad = přesně předchozí pohled
  for (let k = 1; k < timeline.length; k++) {
    timeline.goto(k);
    const back = timeline.back();
    assert.deepEqual(back, timeline.view(k - 1));
  }
  assert.ok(at('11').newEntries.SW1['02:00:00:00:00:01'], 'nový záznam zvýrazněný');
  assert.equal(at('12').newEntries.SW1, undefined, 'v dalším kroku už ne');
});

test('výměna hub -> switch: hub zmizí, switch má prázdnou tabulku; Obnovit (krok 0) vrátí hub', () => {
  assert.equal(at('9').nodes.HUB1.type, 'hub');
  assert.equal(at('10').nodes.HUB1, undefined);
  assert.deepEqual(at('10').nodes.SW1.mac_table, []);
  assert.equal(at('0').nodes.HUB1.type, 'hub');
});

test('pohled: dvojice ve výtahu, štítky PC, rámec pro rentgen', () => {
  assert.deepEqual([at('9').flow.sender, at('9').flow.receiver], ['PC2', 'PC1']);
  assert.equal(at('7').pills.PC3, 'dropped');
  assert.equal(at('8c').pills.PC2, 'received');
  assert.equal(at('7').nodes.PC3.layers[2], 'dropped');
  assert.equal(at('2').flowFrame.proto, 'ethernet');
  assert.deepEqual(at('12').decision.outPorts, ['Fa0/2', 'Fa0/3']);
});

// rozhodnutí 31: krok tipu = stav PŘED rozhodnutím zařízení, nic neprozrazuje
const TIP_PORT_STEPS = ['5', '11', '13', '16'];
test('kroky tipu k portům: rámec leží na vstupním portu, žádné výstupy, přijal/zahodil ani rozhodnutí', () => {
  const tipSteps = timeline.steps.filter((s) => s.predict).map((s) => `${s.num}`);
  assert.deepEqual(tipSteps, ['5', '9', '11', '13', '16'], 'tipy podle rozhodnutí 31 (stávající 5, 10, 12, 13, 15)');
  for (const l of TIP_PORT_STEPS) {
    const v = at(l), node = v.step.predict.node;
    const ps = Object.entries(v.portState[node] ?? {});
    assert.equal(ps.length, 1, `krok ${l}: jen jeden port se stavem`);
    assert.equal(ps[0][1], 'in', `krok ${l}: rámec na vstupním portu`);
    assert.ok(!v.changes.some((r) => r.kind === 'link.tx' && r.from === node), `krok ${l}: žádný výstupní rámec`);
    assert.ok(!v.changes.some((r) => ['repeat', 'flood', 'forward', 'filter', 'nic_drop', 'app.recv'].includes(r.kind)), `krok ${l}: žádné rozhodnutí ani doručení`);
    assert.ok(!Object.values(v.pills).some((p) => p === 'received' || p === 'dropped'), `krok ${l}: žádné přijal/zahodil`);
    assert.equal(v.decision?.kind, undefined, `krok ${l}: rozhodnutí zatím není`);
    assert.equal(v.focus.node, node, `krok ${l}: rámec je u zařízení`);
    assert.doesNotMatch(v.step.text, /všem|flooding|jen na|rozešle|nečte/, `krok ${l}: text neprozrazuje`);
  }
});

test('krok vyhodnocení tipu ukáže výsledek (výstupní porty zařízení)', () => {
  const evalOf = { 5: '6', 11: '12', 13: '14', 16: '17' };
  const expect = { 5: ['Fa0/2', 'Fa0/3'], 11: ['Fa0/2', 'Fa0/3'], 13: ['Fa0/1'], 16: ['Fa0/2'] };
  for (const [tip, ev] of Object.entries(evalOf)) {
    const node = at(String(tip)).step.predict.node;
    const outs = Object.entries(at(ev).portState[node]).filter(([, s]) => s === 'out').map(([p]) => p);
    assert.deepEqual(outs, expect[tip], `vyhodnocení tipu z kroku ${tip} v kroku ${ev}`);
  }
});
