// Úroveň 3 „Směrování“: testovací kritéria ze scenarios/uroven3-smerovani.md (kap. Testovací kritéria)
// a terminál (cmd.md kap. 7–12). Stav ze scénáře v daném kroku.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven3-smerovani.js';
import { buildLevel3, whatIf } from '../../js/scenario/level3.js';
import { stepIndex } from '../../js/core/timeline.js';
import { execute, plain, promptOf } from '../../js/cli/shell.js';
import { formatPing } from '../../js/cli/wincmd.js';
import { checksum, encode } from '../../js/wire/encode.js';
import { lookupRoute, deriveRoutes } from '../../js/proto/ipv4.js';
import { runVector, compareVector } from '../../js/core/harness.js';
import { readFileSync } from 'node:fs';

const { run, timeline } = buildLevel3(scenario);
const R = run.records;
const idx = (label) => stepIndex(timeline.steps, label);
const at = (label) => timeline.view(idx(label));
const inStep = (label) => at(label).changes;
const txs = (label) => inStep(label).filter((r) => r.kind === 'link.tx');
const vec = (f) => JSON.parse(readFileSync(new URL(`../vectors/${f}`, import.meta.url), 'utf8'));

test('scénář je čistá data, kroky 0–25 (22 a 24 dvě části), části A–D', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(Math.max(...timeline.steps.map((s) => s.num)), 25);
  assert.equal(timeline.length, 28);
  assert.deepEqual(timeline.steps.filter((s) => s.part3).map((s) => [s.part3, s.num]), [['A', 0], ['B', 16], ['C', 18], ['D', 21]]);
});

test('výchozí stav: ARP tabulky a MAC tabulka prázdné, směrovací tabulky podle ping-router', () => {
  const v = at('0');
  for (const id of ['PC1', 'PC2', 'PC3', 'R1']) assert.deepEqual(v.nodes[id].arp_cache, []);
  assert.deepEqual(v.nodes.SW1.mac_table, []);
  assert.deepEqual(v.nodes.R1.routing_table.map((r) => `${r.type} ${r.prefix} ${r.if}`),
    ['connected 192.168.1.0/24 Gi0/0', 'local 192.168.1.1/32 Gi0/0', 'connected 192.168.2.0/24 Gi0/1', 'local 192.168.2.1/32 Gi0/1']);
  assert.deepEqual(v.nodes.PC1.routing_table.map((r) => r.prefix), ['192.168.1.0/24', '0.0.0.0/0']);
});

test('krok 3 (tip): paket existuje, rámec ani ARP ne; 4: cesta přes bránu a fronta', () => {
  const v = at('3');
  assert.equal(v.pkt.h.dst, '192.168.2.20');
  assert.equal(v.pkt.h.protocol, 1);
  assert.equal(v.frame, null);
  assert.ok(!inStep('3').some((r) => ['ip_route', 'arp_queue', 'link.tx'].includes(r.kind)));
  const route = inStep('4').find((r) => r.kind === 'ip_route');
  assert.equal(route.nextHop, '192.168.1.1');
  assert.equal(at('3').nodes.PC1.layers[4], 'skip', 'L4 přeskočená (rozhodnutí 47)');
});

test('ARP dotaz: broadcast, 0x0806, TPA brána; SW1 rozešle na Fa0/3 a Fa0/4; Cyril ignoruje, R1 se učí a odpoví unicastem', () => {
  const req = txs('5')[0].pdu;
  assert.equal(req.h.dst, 'ff:ff:ff:ff:ff:ff');
  assert.equal(req.h.ethertype, 0x0806);
  assert.equal(req.payload.h.tpa, '192.168.1.1');
  assert.ok(!inStep('5').some((r) => r.kind === 'flood'), 'tip nic neprozradí');
  assert.deepEqual(inStep('6').find((r) => r.kind === 'flood').outPorts, ['Fa0/3', 'Fa0/4']);
  assert.ok(inStep('6').some((r) => r.kind === 'arp_ignore' && r.node === 'PC3'));
  assert.deepEqual(at('6').nodes.PC3.arp_cache, []);
  assert.ok(!R.slice(0, at('7').step.first).some((r) => r.node === 'PC2'), 'Bob nic');
  assert.deepEqual(at('6').nodes.R1.arp_cache.map((e) => e.ip), ['192.168.1.10']);
  const rep = txs('7')[0].pdu;
  assert.equal(rep.h.dst, '02:00:00:00:00:01');
  assert.equal(rep.payload.h.op, 2);
  assert.deepEqual(at('7').nodes.PC1.arp_cache.map((e) => [e.ip, e.mac]), [['192.168.1.1', '02:00:00:00:01:01']]);
});

test('rámec Alice -> R1 (8), R1 TTL 127 a nový rámec (12), IP beze změny, součet přepočítán', () => {
  const f = txs('8')[0].pdu;
  assert.deepEqual([f.h.dst, f.h.src, f.payload.h.src, f.payload.h.dst, f.payload.h.ttl],
    ['02:00:00:00:01:01', '02:00:00:00:00:01', '192.168.1.10', '192.168.2.20', 128]);
  assert.deepEqual(txs('8').map((r) => r.link), ['L1', 'L3'], 'SW1 jen na Fa0/4, Cyril nic');
  assert.ok(inStep('10').some((r) => r.kind === 'arp_request' && r.node === 'R1' && r.if === 'Gi0/1'));
  assert.ok(!inStep('11').some((r) => r.kind === 'encap'), 'tip: nový rámec ještě není');
  const n = txs('12')[0];
  assert.deepEqual([n.pdu.h.src, n.pdu.h.dst, n.pdu.payload.h.ttl, n.pdu.payload.h.src, n.pdu.payload.h.dst],
    ['02:00:00:00:01:02', '02:00:00:00:00:02', 127, '192.168.1.10', '192.168.2.20']);
  assert.equal(checksum(n.bytes.subarray(14, 34)), 0);
  assert.deepEqual([at('12').hop.in.h.dst, at('12').hop.out.h.dst], ['02:00:00:00:01:01', '02:00:00:00:00:02']);
});

test('Echo Reply: TTL 128 u Boba, 127 u Alice, bez ARP; ping 4/4 TTL=127', () => {
  assert.ok(!inStep('13').some((r) => r.kind === 'link.tx'), 'tip: odpověď ještě neodešla');
  const reply = R.find((r) => r.kind === 'link.tx' && r.from === 'PC2' && r.pdu.payload?.proto === 'ipv4');
  assert.equal(reply.pdu.payload.h.ttl, 128);
  assert.ok(!inStep('14').some((r) => r.kind === 'arp_request'));
  const app = Object.values(at('14').apps)[0];
  assert.ok(app.done);
  assert.deepEqual(app.events.map((e) => e.result.ttl), [127, 127, 127, 127]);
  const v = at('15');
  assert.deepEqual(v.nodes.PC1.arp_cache.map((e) => e.ip), ['192.168.1.1']);
  assert.deepEqual(v.nodes.PC2.arp_cache.map((e) => e.ip), ['192.168.2.1']);
  assert.equal(v.nodes.R1.arp_cache.length, 2);
});

test('část B: ping na Cyrila přímo (ARP na .30, R1 bez IP provozu), řádek connected', () => {
  assert.ok(!inStep('16').some((r) => r.kind === 'ip_route'));
  assert.equal(inStep('17').find((r) => r.kind === 'ip_route').route.prefix, '192.168.1.0/24');
  assert.ok(inStep('17').some((r) => r.kind === 'arp_request' && r.ip === '192.168.1.30'));
  assert.ok(!inStep('17').some((r) => r.node === 'R1' && r.kind === 'decap'));
  assert.ok(inStep('17').some((r) => r.kind === 'link.tx' && r.to === 'PC3' && r.pdu.h.dst === '02:00:00:00:00:03'));
});

test('část C: tracert, TTL 1 -> Time Exceeded od 192.168.1.1, TTL 2 -> Bob; tip 18 nic neprozradí', () => {
  assert.ok(!inStep('18').some((r) => ['ip_drop', 'icmp_error', 'decap'].includes(r.kind)));
  const te = inStep('19').find((r) => r.kind === 'icmp_error');
  assert.deepEqual([te.type, te.code], [11, 0]);
  const pkt = inStep('19').find((r) => r.kind === 'link.tx' && r.from === 'R1').pdu.payload;
  assert.equal(pkt.h.src, '192.168.1.1');
  const app = Object.values(at('20').apps).find((a) => a.app === 'tracert');
  assert.ok(app.done);
  assert.deepEqual([...new Set(app.events.map((e) => e.result.from))], ['192.168.1.1', '192.168.2.20']);
});

test('část D: bez brány nic nevyjde (General failure), .254 = 3 ARP bez odpovědi a arp_failed; oprava projde', () => {
  assert.equal(txs('21').length, 0);
  const a21 = Object.values(at('21').apps).at(-1);
  assert.ok(a21.events.every((e) => e.result.kind === 'no_route'));
  assert.equal(at('21').nodes.PC1.gateway, null);
  assert.ok(Object.values(at('22b').apps).at(-1).events.every((e) => e.result.kind === 'reply'));
  const arps = inStep('23').filter((r) => r.kind === 'arp_request');
  assert.ok(arps.length >= 3 && arps.every((r) => r.ip === '192.168.1.254'));
  assert.ok(inStep('23').some((r) => r.kind === 'arp_fail'));
  assert.ok(!inStep('23').some((r) => r.kind === 'link.tx' && r.pdu.payload?.proto === 'ipv4'), 'paket nikdy neodešel');
  assert.ok(Object.values(at('23').apps).at(-1).events.every((e) => e.result.kind === 'arp_failed' && e.result.from === '192.168.1.10'));
  assert.ok(Object.values(at('24b').apps).at(-1).events.every((e) => e.result.kind === 'reply'));
});

test('krok vzad vrací přesně předchozí pohled (ARP, MAC, směrovací tabulky)', () => {
  for (let k = 1; k < timeline.length; k++) {
    timeline.goto(k);
    assert.deepEqual(timeline.back(), timeline.view(k - 1));
  }
});

test('tipy mají správnou odpověď podle záznamu (ARP dostanou Cyril a R1, TTL 127)', () => {
  const recv = txs('6').map((r) => r.to);
  assert.deepEqual(recv.sort(), ['PC3', 'R1']);
  const p5 = timeline.steps[idx('5')].predict;
  assert.deepEqual(p5.answer, ['Cyril', 'R1 (Gi0/0)']);
  for (const s of timeline.steps.filter((x) => x.predict)) {
    const ans = [].concat(s.predict.answer);
    assert.ok(ans.every((a) => s.predict.choices.includes(a)), s.predict.id);
  }
});

test('LPM: /32 před /24 před /0; pořadí řádků nerozhoduje; statická cesta jen přes připojenou síť', () => {
  const r = [{ prefix: '0.0.0.0/0', next_hop: '1.1.1.1' }, { prefix: '192.168.1.0/24' }, { prefix: '192.168.1.1/32' }];
  assert.equal(lookupRoute(r, '192.168.1.1').prefix, '192.168.1.1/32');
  assert.equal(lookupRoute([...r].reverse(), '192.168.1.7').prefix, '192.168.1.0/24');
  assert.equal(lookupRoute(r, '8.8.8.8').prefix, '0.0.0.0/0');
  assert.equal(lookupRoute(r.slice(1), '8.8.8.8'), null);
  const rt = deriveRoutes({ type: 'router', interfaces: [{ name: 'Gi0/0', ip: '10.0.0.1', prefix: 24 }],
    static_routes: [{ prefix: '10.9.0.0/16', next_hop: '10.0.0.2' }, { prefix: '10.8.0.0/16', next_hop: '172.16.0.1' }] });
  assert.deepEqual(rt.map((x) => x.type), ['connected', 'local', 'static']);
});

test('runner vektorů pozná špatný výsledek pingu a tracertu; ICMP součty platné', () => {
  const v = vec('ping-router.json');
  const run2 = runVector(v);
  const bad = structuredClone(v);
  bad.expected.app_result.replies[0].ttl = 128;
  assert.ok(compareVector(bad, run2).some((d) => d.includes('ttl')));
  const t = vec('tracert-alice-bob.json');
  const badT = structuredClone(t);
  badT.expected.app_result.hops[0].from = '192.168.2.1';
  assert.ok(compareVector(badT, runVector(t)).some((d) => d.includes('hops')));
  for (const r of runVector(t).records.filter((x) => x.kind === 'link.tx')) {
    assert.equal(checksum(r.bytes.subarray(14, 34)), 0);
    const len = (r.bytes[16] << 8) | r.bytes[17];
    assert.equal(checksum(r.bytes.subarray(34, 14 + len)), 0, 'ICMP');
  }
});

test('terminál Windows: ipconfig s bránou, arp -a, route print = netstat -nr (2 řádky), ping a tracert', () => {
  const v = at('15');
  const o = (n, c, opts = {}) => plain(execute(v.nodes[n], c, { level: 3, ...opts }));
  assert.match(o('PC1', 'ipconfig'), /Default Gateway .*: 192\.168\.1\.1$/m);
  assert.match(o('PC1', 'arp -a'), /^ {2}192\.168\.1\.1 +02-00-00-00-01-01 +dynamic$/m);
  assert.doesNotMatch(o('PC1', 'arp -a'), /192\.168\.2\.20/);
  const rp = o('PC1', 'route print');
  assert.equal(rp, o('PC1', 'netstat -nr'));
  assert.equal(rp.split('Active Routes:')[1].split('=====')[0].trim().split('\n').length, 3);
  assert.match(rp, /^ +0\.0\.0\.0 +0\.0\.0\.0 +192\.168\.1\.1 +192\.168\.1\.10 +25$/m);
  const sim = (c, a) => whatIf(scenario, v, 'PC1', c, a);
  const p = o('PC1', 'ping 192.168.2.20', { sim });
  assert.equal(p.match(/Reply from 192\.168\.2\.20: bytes=32 time<1ms TTL=127/g).length, 4);
  assert.match(p, /Sent = 4, Received = 4, Lost = 0 \(0% loss\)/);
  const t = o('PC1', 'tracert 192.168.2.20', { sim });
  assert.match(t, /^ {2}1 {4}<1 ms {4}<1 ms {4}<1 ms {2}192\.168\.1\.1$/m);
  assert.match(t, /^ {2}2 {4}<1 ms {4}<1 ms {4}<1 ms {2}192\.168\.2\.20$/m);
  assert.match(t, /Trace complete\./);
  // bez brány / špatná brána
  const v21 = at('21');
  const p21 = plain(execute(v21.nodes.PC1, 'ping 192.168.2.20', { level: 3, sim: (c, a) => whatIf(scenario, v21, 'PC1', c, a) }));
  assert.equal(p21.match(/PING: transmit failed\. General failure\./g).length, 4);
  assert.match(p21, /Received = 0, Lost = 4 \(100% loss\)/);
  assert.match(formatPing('192.168.2.20', [{ result: { kind: 'arp_failed', from: '192.168.1.10' } }], true).join('\n'),
    /Reply from 192\.168\.1\.10: Destination host unreachable\.[\s\S]*Received = 1, Lost = 0/);
  // arp -d volá smazání (pískoviště)
  let deleted = 'ne';
  execute(v.nodes.PC1, 'arp -d', { level: 3, arpDelete: (ip) => { deleted = ip; } });
  assert.equal(deleted, null);
});

test('terminál IOS na R1: R1> -> enable -> R1#, show ip route C a L, ip int brief, show ip arp, traceroute odmítnut', () => {
  const v = at('15');
  const r1 = v.nodes.R1;
  assert.equal(promptOf(r1, 'user'), 'R1>');
  assert.equal(promptOf(r1, 'priv'), 'R1#');
  assert.equal(execute(r1, 'enable').mode, 'priv');
  assert.match(plain(execute(r1, 'conf t', { mode: 'user' })), /Invalid input/);
  const rt = plain(execute(r1, 'sh ip ro'));
  assert.match(rt, /^C {8}192\.168\.2\.0\/24 is directly connected, GigabitEthernet0\/1$/m);
  assert.match(rt, /^L {8}192\.168\.1\.1\/32 is directly connected, GigabitEthernet0\/0$/m);
  assert.match(rt, /Gateway of last resort is not set/);
  assert.match(plain(execute(r1, 'show ip interface brief')), /^GigabitEthernet0\/0 {5}192\.168\.1\.1 {5}YES manual up {20}up$/m);
  const arp = plain(execute(r1, 'show ip arp'));
  assert.match(arp, /^Internet {2}192\.168\.1\.10 {12}0 {3}0200\.0000\.0001 {2}ARPA {3}GigabitEthernet0\/0$/m);
  assert.equal(arp.split('\n').length, 5);
  assert.match(execute(r1, 'traceroute 192.168.2.20').note, /tracert na PC/);
  const ping = plain(execute(r1, 'ping 192.168.2.20', { sim: (c, a) => whatIf(scenario, v, 'R1', c, a) }));
  assert.match(ping, /^!!!!!$/m);
  assert.match(ping, /Success rate is 100 percent \(5\/5\)/);
});

test('ICMP chyba obsahuje IP hlavičku a 8 B původního paketu (56 B paket)', () => {
  const te = R.find((r) => r.kind === 'link.tx' && r.pdu.payload?.payload?.h?.type === 11);
  assert.equal(encode(te.pdu.payload).length, 56);
});
