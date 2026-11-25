// Úroveň 4 „Transport a aplikace“: testovací kritéria ze scenarios/uroven4-transport.md, rozhodnutí 59–60,
// tcp.md, dns.md, http.md a terminál (cmd.md kap. 14–18). Scénář proti simulaci, tipy bez prozrazení.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven4-transport.js';
import { buildLevel4, whatIf4 } from '../../js/scenario/level4.js';
import { stepIndex } from '../../js/core/timeline.js';
import { execute, plain, promptOf } from '../../js/cli/shell.js';
import { formatNslookup, formatCurl } from '../../js/cli/wincmd4.js';
import { checksum } from '../../js/wire/encode.js';
import { pduFields } from '../../js/wire/fields.js';
import { stepFocus } from '../../js/ui/focus.js';
import { textFor } from '../../js/core/timeline.js';

const { run, timeline } = buildLevel4(scenario);
const R = run.records;
const idx = (label) => stepIndex(timeline.steps, label);
const at = (label) => timeline.view(idx(label));
const inStep = (label) => at(label).changes;
const tcpOf = (r) => r.pdu?.payload?.payload;
const firstHop = (label) => inStep(label).filter((r) => r.kind === 'link.tx' && ['PC1', 'PC2', 'SRV1'].includes(r.from));
const segs = (label) => firstHop(label).map((r) => tcpOf(r));

test('scénář je čistá data, kroky 0–31 (16 a 22 ve dvou částech), části A–F', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(scenario)), scenario);
  assert.equal(Math.max(...timeline.steps.map((s) => s.num)), 31);
  assert.equal(timeline.length, 34);
  assert.deepEqual(timeline.steps.filter((s) => s.part3).map((s) => [s.part3, s.num]),
    [['A', 0], ['B', 6], ['C', 11], ['D', 19], ['E', 25], ['F', 27]]);
});

test('každý krok má ohnisko a uzel vpravo; tipy 2, 6, 13, 19, 23, 28 jsou samostatné kroky', () => {
  for (const s of timeline.steps) {
    assert.ok(s.right, `krok ${s.num} nemá right`);
    assert.ok(['tip', 'rentgen', 'topologie', 'vrstvy', 'terminal'].includes(stepFocus(s, null, { termOpen: true })), s.num);
  }
  assert.deepEqual(timeline.steps.filter((s) => s.predict).map((s) => s.num), [2, 6, 13, 19, 23, 28]);
  for (const s of timeline.steps.filter((x) => x.predict)) assert.ok([].concat(s.predict.answer).every((a) => s.predict.choices.includes(a)), s.predict.id);
});

test('tipy nic neprozradí: krok tipu neobsahuje událost, na kterou se ptá, a text ani nadpis nemá odpověď', () => {
  // krok 19: handshake dvou tabů proběhl (zrychleně), data ne; krok 23: SYN Alice ano, odpověď SRV1 ne
  const forbid = { 2: ['udp_send'], 6: ['tcp_send'], 13: ['tcp_send'], 19: ['http_request'], 23: ['tcp_rst'], 28: ['tcp_retransmit'] };
  for (const [num, kinds] of Object.entries(forbid)) {
    const ch = inStep(num);
    for (const k of kinds) assert.equal(ch.filter((r) => r.kind === k).length, 0, `krok ${num}: ${k}`);
    const s = timeline.steps[idx(num)];
    const ans = String([].concat(s.predict.answer)[0]);
    assert.ok(!textFor(s.text, 'osi').includes(ans), `text tipu ${num} prozrazuje odpověď`);
  }
  assert.ok(!inStep('13').some((r) => r.kind === 'app.recv'), 'tip 13: data ještě nevystoupala');
  assert.ok(!inStep('23').some((r) => r.kind === 'tcp_send' && r.node === 'SRV1'), 'tip 23: SRV1 ještě nic neposlal');
});

test('tipy: odpověď ze scénáře = skutečnost v simulaci', () => {
  // 2: DNS jde rovnou po UDP (žádný TCP ani ARP před dotazem)
  const first = firstHop('3')[0];
  assert.equal(first.pdu.payload.payload.proto, 'udp');
  assert.ok(!R.slice(0, at('3').step.last).some((r) => r.kind === 'arp_request'));
  // 6: tři segmenty bez dat před GET
  const hs = [...segs('7'), ...segs('8'), ...segs('9')];
  assert.deepEqual(hs.map((s) => s.h.flagsText), ['SYN', 'SYN, ACK', 'ACK']);
  assert.ok(hs.every((s) => !s.payload));
  // 13: ack 250
  assert.equal(segs('14')[0].h.rel.ack, 250);
  // 19: spojení se liší zdrojovým portem klienta
  const est = at('20').nodes.SRV1.tcp_connections.filter((c) => c.state === 'ESTABLISHED').map((c) => c.remote);
  assert.deepEqual(est, ['192.168.1.10:49153', '192.168.1.10:49154']);
  // 23: RST, ACK
  assert.equal(segs('24')[0].h.flagsText, 'RST, ACK');
  // 28: stejný segment znovu (stejné seq a data)
  const lost = inStep('27').find((r) => r.kind === 'link.tx' && r.lost);
  const re = firstHop('29').find((r) => tcpOf(r).h.retransmit);
  assert.equal(tcpOf(re).h.seq, tcpOf(lost).h.seq);
  assert.equal(tcpOf(re).payload.payload, tcpOf(lost).payload.payload);
});

test('DNS: UDP 49152 -> 53, odpověď 53 -> 49152 s A 192.168.2.10 (AA), záznam v cache Alice', () => {
  const q = segs('3')[0], a = segs('4')[0];
  assert.deepEqual([q.h.sport, q.h.dport, a.h.sport, a.h.dport], [49152, 53, 53, 49152]);
  assert.equal(q.payload.h.question.name, 'www.skola.lan');
  assert.deepEqual(a.payload.h.answers.map((x) => x.data), ['192.168.2.10']);
  assert.equal(a.payload.h.aa, 1);
  assert.deepEqual(at('5').nodes.PC1.dns_cache.map((e) => `${e.name} ${e.data}`), ['www.skola.lan 192.168.2.10']);
});

test('handshake: relativní čísla 0 / 0,1 / 1,1, ISN z jádra (seed 1), stavy obou stran', () => {
  const [syn] = segs('7'), [sa] = segs('8'), [ack] = segs('9');
  assert.deepEqual([syn.h.rel.seq, sa.h.rel.seq, sa.h.rel.ack, ack.h.rel.seq, ack.h.rel.ack], [0, 0, 1, 1, 1]);
  assert.equal(syn.h.seq, 4108129950);
  assert.equal(sa.h.seq, 3681155042);
  assert.deepEqual(syn.h.options, [{ kind: 2, name: 'MSS', value: 1460 }]);
  const st = (l, n) => at(l).nodes[n].tcp_connections.find((c) => c.remote === (n === 'PC1' ? '192.168.2.10:80' : '192.168.1.10:49152'))?.state;
  assert.equal(st('7', 'SRV1'), 'SYN-RECEIVED');
  assert.equal(st('8', 'PC1'), 'ESTABLISHED');
  assert.equal(st('10', 'SRV1'), 'ESTABLISHED');
});

test('HTTP: GET 76 B (seq 1), ACK serveru 77, 200 OK 249 B, ack Alice 250; ukončení 4 segmenty a TIME_WAIT', () => {
  const get = segs('11').find((s) => s.payload);
  assert.equal(new TextEncoder().encode(get.payload.payload).length, 76);
  assert.equal(get.h.rel.seq, 1);
  assert.ok(segs('11').some((s) => s.h.flagsText === 'ACK' && s.h.rel.ack === 77), 'ACK serveru hned');
  const resp = segs('12')[0];
  assert.equal(new TextEncoder().encode(resp.payload.payload).length, 249);
  assert.match(resp.payload.payload, /^HTTP\/1\.1 200 OK/);
  const fin = [segs('15')[0], segs('16a')[0], segs('16b')[0], segs('17')[0]];
  assert.deepEqual(fin.map((s) => s.h.flagsText), ['FIN, ACK', 'ACK', 'FIN, ACK', 'ACK']);
  assert.deepEqual(fin.map((s) => [s.h.rel.seq, s.h.rel.ack]), [[77, 250], [250, 78], [250, 78], [78, 251]]);
  assert.equal(at('17').nodes.PC1.tcp_connections.find((c) => c.local.endsWith(':49152')).state, 'TIME-WAIT');
  assert.deepEqual(at('17').nodes.SRV1.tcp_connections.map((c) => c.state), ['LISTEN', 'LISTEN']);
});

test('část D: porty 49153/49154, Bob 49152 přes SW2 bez routeru, GET po spojení 49153 a odpověď na 49153; RST na 8080', () => {
  const bob = inStep('21').filter((r) => r.kind === 'link.tx' && r.from === 'PC2');
  assert.ok(bob.length && !inStep('21').some((r) => r.kind === 'ip_forward' && tcpOf(r)?.h?.sport === 49152 && r.pdu.h.src === '192.168.2.20'));
  assert.equal(at('21').nodes.SRV1.tcp_connections.filter((c) => c.state === 'ESTABLISHED').length, 3);
  assert.equal(segs('22a').find((s) => s.payload).h.sport, 49153);
  assert.equal(segs('22b').find((s) => s.payload).h.dport, 49153);
  const syn = segs('23')[0];
  assert.deepEqual([syn.h.sport, syn.h.dport], [49155, 8080]);
  const rst = segs('24')[0];
  assert.deepEqual([rst.h.seq, rst.h.rel.ack], [0, 1]);
  assert.ok(!at('24').nodes.SRV1.tcp_connections.some((c) => c.local.endsWith(':8080')));
});

test('část F: GET ztracený na L4, retransmise po 1 s; DNS dotaz ztracený, nslookup zopakuje po 2 s', () => {
  const lost = inStep('27').find((r) => r.kind === 'link.tx' && r.lost);
  assert.equal(lost.link, 'L4');
  const re = firstHop('29').find((r) => tcpOf(r).h.retransmit);
  const orig = R.find((r) => r.kind === 'link.tx' && r.from === 'PC1' && tcpOf(r)?.payload && tcpOf(r).h.seq === tcpOf(lost).h.seq);
  assert.equal(re.t - orig.t, 1_000_000);
  assert.equal(R.filter((r) => r.kind === 'http_request' && r.t > 4e6 && r.t < 7e6).length, 1, 'aplikace web dostala GET jednou');
  const dnsTx = inStep('31').filter((r) => r.kind === 'link.tx' && r.from === 'PC1');
  assert.equal(dnsTx.length, 2);
  assert.equal(dnsTx[1].t - dnsTx[0].t, 2_000_000);
  assert.ok(inStep('31').some((r) => r.kind === 'dns_timeout'));
  assert.ok(inStep('31').some((r) => r.kind === 'link.tx' && r.lost && r.link === 'L4'));
});

test('kontrolní součty TCP (pseudohlavička) a IP v rámcích scénáře platí', () => {
  for (const r of R.filter((x) => x.kind === 'link.tx' && x.pdu.payload?.payload?.proto === 'tcp').slice(0, 12)) {
    const b = r.bytes;
    assert.equal(checksum(b.subarray(14, 34)), 0);
    const len = ((b[16] << 8) | b[17]) - 20;
    const pseudo = new Uint8Array(12 + len);
    pseudo.set(b.subarray(26, 34));
    pseudo.set([0, 6, len >> 8, len & 255], 8);
    pseudo.set(b.subarray(34, 34 + len), 12);
    assert.equal(checksum(pseudo), 0);
  }
});

test('rentgen: bloky TCP a HTTP, relativní i absolutní čísla, DNS odpověď', () => {
  const ff = pduFields(firstHop('11').find((r) => tcpOf(r).payload).pdu);
  assert.deepEqual(ff.blocks.map((b) => b.id), ['ethernet', 'ipv4', 'tcp', 'http']);
  assert.match(ff.blocks[2].fields.find((f) => f.id === 'tcp.seq').value, /^1 \(relativně; na drátě 4108129951\)/);
  assert.equal(ff.blocks[3].fields.find((f) => f.id === 'http.start').value, 'GET / HTTP/1.1');
  const fd = pduFields(firstHop('4')[0].pdu);
  assert.deepEqual(fd.blocks.map((b) => b.id), ['ethernet', 'ipv4', 'udp', 'dns']);
  assert.match(fd.blocks[3].fields.find((f) => f.id === 'dns.answer').value, /A 192\.168\.2\.10, TTL 3600/);
});

test('terminál: ipconfig /all má DNS server, netstat -an podle tabulky spojení, ss -tuln na SRV1', () => {
  const v = at('1');
  assert.match(plain(execute(v.nodes.PC1, 'ipconfig /all', { level: 4 })), /DNS Servers[ .]*: 192\.168\.2\.10/);
  assert.equal(promptOf(v.nodes.SRV1), 'student@srv1:~$');
  const ss = plain(execute(v.nodes.SRV1, 'ss -tuln', { level: 4 }));
  assert.match(ss, /udp\s+UNCONN.*0\.0\.0\.0:53/);
  assert.match(ss, /tcp\s+LISTEN.*0\.0\.0\.0:80/);
  const n10 = plain(execute(at('10').nodes.PC1, 'netstat -an', { level: 4 }));
  assert.match(n10, /  TCP    192\.168\.1\.10:49152     192\.168\.2\.10:80        ESTABLISHED/);
  assert.match(plain(execute(at('17').nodes.PC1, 'netstat -an', { level: 4 })), /49152 .*TIME_WAIT/);
  assert.match(plain(execute(at('20').nodes.SRV1, 'ss -tan', { level: 4 })), /ESTAB.*192\.168\.1\.10:49154/);
});

test('terminál: nslookup a curl -v z pískoviště (whatIf4) i ze ztráty ve scénáři', () => {
  const v = at('5');
  const r = whatIf4(scenario, v, 'PC1', 'nslookup', { name: 'www.skola.lan' });
  const res = r.apps.at(-1).result;
  const out = formatNslookup('www.skola.lan', '192.168.2.10', { timeouts: 0, result: res }).map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
  assert.equal(out, 'Server:  UnKnown\nAddress:  192.168.2.10\n\nName:    www.skola.lan\nAddress:  192.168.2.10\n');
  const c = whatIf4(scenario, at('10'), 'PC1', 'http_get', { host: 'www.skola.lan', port: 80, path: '/', client: 'curl' });
  const cr = c.apps.find((x) => x.command === 'http_get').result;
  assert.equal(cr.status, 200);
  assert.equal(cr.local, '192.168.1.10:49153', 'port 49152 je obsazený spojením ze scénáře');
  const txt = plain(formatCurl('http://www.skola.lan', true, { result: cr, dst: '192.168.2.10' }));
  assert.match(txt, /> GET \/ HTTP\/1\.1\n> Host: www\.skola\.lan/);
  assert.match(txt, /< HTTP\/1\.1 200 OK/);
  const ref = whatIf4(scenario, at('10'), 'PC1', 'http_get', { host: 'www.skola.lan', port: 8080, path: '/' }).apps.find((x) => x.command === 'http_get').result;
  assert.equal(ref.kind, 'refused');
  assert.match(plain(formatCurl('http://www.skola.lan:8080', false, { result: ref, dst: '192.168.2.10' })), /curl: \(7\) Failed to connect to www\.skola\.lan port 8080/);
  // krok 31: dotaz se ztratil, druhý pokus projde
  const n31 = formatNslookup('www.skola.lan', '192.168.2.10', { timeouts: R.filter((x) => x.kind === 'dns_timeout').length,
    result: R.filter((x) => x.kind === 'app.result' && x.app === 'nslookup').at(-1).result }).map((l) => (typeof l === 'string' ? l : l.text)).join('\n');
  assert.match(n31, /^DNS request timed out\.\n    timeout was 2 seconds\.\nServer:  UnKnown/);
  assert.match(n31, /Address:  192\.168\.2\.10\n$/);
});

test('úrovně 1–3 beze změny: ICMP ping na úrovni 4 dál funguje (whatIf na topologii 4)', () => {
  const r = whatIf4(scenario, at('5'), 'PC1', 'ping', { dst: '192.168.2.10', count: 1 });
  const rep = r.records.find((x) => x.kind === 'app.event' && x.result.kind === 'reply');
  assert.equal(rep.result.ttl, 63, 'Linux 64 - 1');
});
