// Modelové situace (rozh. 66–69, docs/spec/ulohy.md): každá úloha ve výchozím stavu nefunguje se
// správným důvodem, po správné opravě funguje a typický špatný pokus dá očekávaný text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import base from '../../scenarios/uroven4-transport.js';
import { TASKS, TASK_ORDER } from '../../scenarios/ulohy.js';
import { createTask, applyFix, evaluate, runCommand, nodeView, variantOf, hint3Of, resolveName } from '../../js/scenario/task.js';
import { validateIpv4, apipaOf, effectiveTopology } from '../../js/core/hostcfg.js';
import { execute, plain } from '../../js/cli/shell.js';

const GOOD = { mode: 'static', ip: '192.168.1.10', prefix: 24, gateway: '192.168.1.1', dns: ['192.168.2.10'] };
const cfg = (over) => ({ kind: 'ipv4', node: 'PC1', cfg: { ...GOOD, ...over } });
const mk = (id, seed) => createTask(TASKS[id], base, { seed });
const text = (e) => e.lines.join(' ');
function term(task, id, line) {
  const node = nodeView(task, id);
  const r = execute(node, line, { level: 4, sim: (command, args) => {
    const c = command === 'curl' ? 'http_get' : command;
    const run = runCommand(task, id, c, c === 'http_get' ? { ...args, client: 'curl' } : args);
    const events = run.records.filter((x) => x.kind === 'app.event').map((x) => ({ seq: x.seq, ttl: x.ttl, probe: x.probe, result: x.result }));
    return { events, done: true, result: run.apps.at(-1)?.result ?? null, records: run.records, timeouts: 0 };
  }, resolve: (name) => resolveName(task, id, name), service: (app, on) => applyFix(task, { kind: 'service', node: id, app, running: on }), arpDelete: (ip) => applyFix(task, { kind: 'arp_delete', node: id, ip }) });
  return `${plain(r)}\n${r.note ?? ''}`;
}

test('pořadí úloh podle didaktika a každá úloha má zadání, cíl a 3 nápovědy', () => {
  assert.deepEqual(TASK_ORDER, [4, 1, 5, 7, 10, 11, 3, 13]);
  for (const id of TASK_ORDER) {
    const t = TASKS[id];
    assert.ok(t.story.length && t.goal && t.hints.length === 3 && t.ok.length, `úloha ${id}`);
  }
});

const CASES = [
  [4, 'no_address', [cfg({})]],
  [1, 'link_down', [{ kind: 'link', link: 'L1', connected: true }]],
  [5, 'no_route', [cfg({})]],
  [7, 'arp_failed', [cfg({})]],
  [10, 'connection_refused', [{ kind: 'service', node: 'SRV1', app: 'web', running: true }]],
  [11, 'no_dns_server', [cfg({})]],
  [3, 'ip_conflict', [{ kind: 'printer', node: 'PRT1', ip: '192.168.1.50', prefix: 24, gateway: '192.168.1.1' }, { kind: 'arp_delete', node: 'PC1', ip: null }]],
];
for (const [id, reason, fixes] of CASES) {
  test(`úloha ${id}: výchozí stav ${reason}, po opravě funguje`, () => {
    const t = mk(id);
    const e0 = evaluate(t);
    assert.equal(e0.status, 'fail');
    assert.equal(e0.reason, reason);
    assert.ok(text(e0).length > 20);
    for (const f of fixes) applyFix(t, f);
    const e1 = evaluate(t);
    assert.equal(e1.status, 'ok', text(e1));
    assert.match(text(e1), new RegExp(TASKS[id].ok[0].slice(0, 12).replace(/[*()]/g, '.')));
  });
}

test('vyhodnocení nemění stav studentovy sítě (běží na kopii)', () => {
  const t = mk(3);
  evaluate(t);
  assert.deepEqual(t.tables.arp_cache, {});
});

test('typické špatné pokusy dají text didaktika', () => {
  let t = mk(4); applyFix(t, cfg({ ip: '192.168.1.30' }));
  assert.match(text(evaluate(t)), /stejnou IP jako Cyril/);
  t = mk(4); applyFix(t, cfg({ prefix: 16 }));
  let e = evaluate(t); assert.equal(e.reason, 'mask_wrong'); assert.match(text(e), /sousedy/);
  t = mk(4); applyFix(t, cfg({ dns: [] }));
  assert.match(text(evaluate(t)), /nezná DNS server/);
  t = mk(4); applyFix(t, cfg({ ip: '192.168.1.11' }));
  e = evaluate(t); assert.equal(e.status, 'ok'); assert.match(text(e), /přidělil/);
  t = mk(5); applyFix(t, cfg({ gateway: '192.168.2.1' }));
  assert.match(text(evaluate(t)), /v tvé síti/);
  t = mk(5); applyFix(t, cfg({ gateway: '192.168.1.30' }));
  e = evaluate(t); assert.equal(e.reason, 'wrong_next_hop'); assert.match(text(e), /počítač, ne router/);
  t = mk(7); applyFix(t, cfg({ ip: '192.168.11.10', gateway: '192.168.11.1' }));
  assert.match(text(evaluate(t)), /R1 má 192\.168\.1\.1/);
  t = mk(7); assert.match(text(evaluate(t)), /nejsou ve stejné síti/);
  t = mk(11); applyFix(t, cfg({ dns: ['192.168.1.1'] }));
  e = evaluate(t); assert.equal(e.reason, 'dns_failed'); assert.match(text(e), /R1 DNS nenabízí/);
  t = mk(11); applyFix(t, cfg({ dns: ['192.168.2.20'] }));
  assert.match(text(evaluate(t)), /Bob je počítač/);
  t = mk(1); applyFix(t, { kind: 'link', link: 'L2', connected: false });
  assert.match(text(evaluate(t)), /někomu jinému/);
  t = mk(1); applyFix(t, cfg({ dns: ['192.168.2.10'], gateway: '192.168.1.1' })); applyFix(t, { kind: 'ipv4', node: 'PC1', cfg: { ...GOOD } });
  applyFix(t, { kind: 'link', link: 'L1', connected: true });
  e = evaluate(t); assert.equal(e.status, 'ok');
  t = mk(3); applyFix(t, { kind: 'printer', node: 'PRT1', ip: '192.168.1.50', prefix: 24, gateway: '192.168.1.1' });
  runCommand(t, 'PC1', 'ping', { dst: '192.168.1.1', count: 1 });   // ARP před opravou už proběhl
  applyFix(t, { kind: 'arp_delete', node: 'PC1', ip: null });
  assert.equal(evaluate(t).status, 'ok');
  t = mk(3); runCommand(t, 'PC1', 'ping', { dst: '192.168.1.1', count: 2 });
  applyFix(t, { kind: 'printer', node: 'PRT1', ip: '192.168.1.50', prefix: 24, gateway: '192.168.1.1' });
  e = evaluate(t); assert.equal(e.reason, 'arp_stale'); assert.match(text(e), /arp -d/);
  t = mk(3); applyFix(t, { kind: 'printer', node: 'PRT1', ip: '192.168.1.30', prefix: 24, gateway: '192.168.1.1' });
  e = evaluate(t); assert.equal(e.reason, 'ip_conflict_config'); assert.match(text(e), /nikdo nemá/);
  t = mk(3); applyFix(t, { kind: 'link', link: 'L7', connected: false });
  e = evaluate(t); assert.equal(e.status, 'partial'); assert.match(text(e), /obejití/);
});

test('úloha 3 (rozh. 69): arp -a ukáže u brány MAC tiskárny, ping na server jen občas odpoví', () => {
  const t = mk(3);
  const out = term(t, 'PC1', 'ping 192.168.2.10');
  assert.match(out, /Reply from 192\.168\.2\.10: .*TTL=63/);
  assert.match(out, /Request timed out\./);
  assert.match(term(t, 'PC1', 'arp -a'), /192\.168\.1\.1\s+02-00-00-00-00-05/);
  assert.match(term(t, 'R1', 'show ip arp'), /192\.168\.1\.1\s+-\s+0200\.0000\.0101/);
});

test('úloha 1: ipconfig Media disconnected, ping General failure, po zapojení IPv4 řádky', () => {
  const t = mk(1);
  assert.match(term(t, 'PC1', 'ipconfig'), /Media State[ .]+: Media disconnected/);
  assert.doesNotMatch(term(t, 'PC1', 'ipconfig'), /IPv4 Address/);
  assert.match(term(t, 'PC1', 'ping 192.168.1.1'), /PING: transmit failed\. General failure\./);
  assert.match(term(t, 'PC1', 'arp -a'), /No ARP Entries Found/);
  applyFix(t, { kind: 'link', link: 'L1', connected: true });
  assert.match(term(t, 'PC1', 'ipconfig'), /IPv4 Address[ .]+: 192\.168\.1\.10/);
});

test('úloha 4: APIPA 169.254.x.y/16 z MAC, Duplicate při IP Cyrila', () => {
  const t = mk(4);
  const ip = apipaOf('02:00:00:00:00:01');
  assert.match(ip, /^169\.254\.\d+\.\d+$/);
  const out = term(t, 'PC1', 'ipconfig /all');
  assert.match(out, new RegExp(`Autoconfiguration IPv4 Address\\. \\. : ${ip.replace(/\./g, '\\.')}\\(Preferred\\)`));
  assert.match(out, /Subnet Mask[ .]+: 255\.255\.0\.0/);
  assert.match(out, /DHCP Enabled[ .]+: Yes/);
  applyFix(t, cfg({ ip: '192.168.1.30' }));
  assert.match(term(t, 'PC1', 'ipconfig /all'), /IPv4 Address[ .]+: 192\.168\.1\.30\(Duplicate\)/);
  // Cyril (nastavený dřív) adresu drží
  assert.match(term(t, 'PC3', 'ipconfig'), /IPv4 Address[ .]+: 192\.168\.1\.30/);
});

test('úloha 7: R1 neodpoví na ARP od 192.168.11.10 (wrong cable), ping Destination host unreachable', () => {
  const t = mk(7);
  const out = term(t, 'PC1', 'ping -n 1 192.168.1.1');
  assert.match(out, /Reply from 192\.168\.11\.10: Destination host unreachable\./);
  const run = runCommand(t, 'PC1', 'ping', { dst: '192.168.1.1', count: 1 });
  assert.ok(run.records.some((r) => r.kind === 'arp_ignore' && r.node === 'R1' && r.foreign));
});

test('úloha 10: ss -tuln bez :80, systemctl status inactive, sudo systemctl start nginx opraví', () => {
  const t = mk(10);
  assert.doesNotMatch(term(t, 'SRV1', 'ss -tuln'), /0\.0\.0\.0:80/);
  assert.match(term(t, 'SRV1', 'systemctl status nginx'), /inactive \(dead\)/);
  assert.match(term(t, 'SRV1', 'systemctl start nginx'), /Access denied/);
  assert.match(term(t, 'PC1', 'curl -v http://www.skola.lan'), /Connection refused/);
  term(t, 'SRV1', 'sudo systemctl start nginx');
  assert.match(term(t, 'SRV1', 'ss -tuln'), /0\.0\.0\.0:80/);
  assert.match(term(t, 'SRV1', 'systemctl status nginx'), /active \(running\)/);
  assert.match(term(t, 'PC1', 'curl http://www.skola.lan'), /<!DOCTYPE html>|<html/i);
  assert.equal(evaluate(t).status, 'ok');
  assert.match(term(t, 'SRV1', 'systemctl status apache2'), /could not be found/);
});

test('úloha 11: nslookup bez DNS serveru', () => {
  const t = mk(11);
  assert.match(term(t, 'PC1', 'nslookup www.skola.lan'), /Default servers are not available/);
  assert.match(term(t, 'PC1', 'curl http://www.skola.lan'), /Could not resolve host/);
});

test('úloha 13: varianta jen ze seedu (fnv1a), všech 8 chyb je dosažitelných a každá se dá opravit', () => {
  assert.equal(variantOf(TASKS[13], 7), variantOf(TASKS[13], 7));
  const seen = new Set();
  for (let s = 1; s <= 60; s++) seen.add(variantOf(TASKS[13], s));
  assert.equal(seen.size, 8);
  const FIX = [[{ kind: 'link', link: 'L1', connected: true }], [{ kind: 'link', link: 'L3', connected: true }],
    [{ kind: 'printer', node: 'PRT1', ip: '192.168.1.50', prefix: 24, gateway: '192.168.1.1' }],
    [cfg({})], [cfg({})], [cfg({})], [{ kind: 'service', node: 'SRV1', app: 'web', running: true }], [cfg({})]];
  for (let v = 0; v < 8; v++) {
    const seed = [...Array(60).keys()].map((x) => x + 1).find((s) => variantOf(TASKS[13], s) === v);
    const t = mk(13, seed);
    assert.equal(evaluate(t).status, 'fail', `varianta ${v}`);
    assert.ok(hint3Of(t).length > 10);
    for (const f of FIX[v]) applyFix(t, f);
    const e = evaluate(t, { layerGuess: TASKS[13].variants[v].layer });
    assert.equal(e.status, 'ok', `varianta ${v}: ${text(e)}`);
    assert.match(text(e), /správně/);
  }
  const t = mk(13, [...Array(60).keys()].find((s) => variantOf(TASKS[13], s + 1) === 3) + 1);
  applyFix(t, cfg({}));
  assert.match(text(evaluate(t, { layerGuess: 'L1' })), /vrstvu pojmenuj znovu/);
});

test('dialog IPv4: validace podle Windows (ulohy.md kap. 2.2)', () => {
  const v = (f) => validateIpv4({ mode: 'static', dnsMode: 'static', mask: '255.255.255.0', ...f });
  assert.equal(v({ ip: '192.168.1.10', gateway: '192.168.1.1', dns1: '192.168.2.10' }).errors.length, 0);
  assert.match(v({ ip: '192.168.1.300' }).errors[0].win, /300 is not a valid entry/);
  assert.match(v({ ip: '127.0.0.5' }).errors[0].win, /loopback/);
  assert.match(v({ ip: '230.1.1.1' }).errors[0].win, /between 1 and 223/);
  assert.match(v({ ip: '192.168.1.10', mask: '255.0.255.0' }).errors[0].win, /subnet mask you have entered is not valid/);
  assert.match(v({ ip: '192.168.1.0' }).errors[0].win, /set to 0/);
  assert.match(v({ ip: '192.168.1.255' }).errors[0].win, /set to 1/);
  const w = v({ ip: '192.168.11.10', gateway: '192.168.1.1' });
  assert.equal(w.errors.length, 0);
  assert.match(w.warnings[0].win, /not on the same network segment/);
  assert.match(v({ ip: '' }).errors[0].cs, /Vyplň IP/);
  assert.equal(validateIpv4({ mode: 'dhcp', dnsMode: 'auto' }).cfg.mode, 'dhcp');
  assert.equal(effectiveTopology(mk(4).topology).nodes.find((n) => n.id === 'PC1').interfaces[0].prefix, 16);
});

test('každá úloha: vytažený kabel Alice = důvod na L1 (vrstvy pod aplikační mají přednost)', () => {
  for (const id of TASK_ORDER) {
    const t = mk(id, 1);
    applyFix(t, { kind: 'link', link: 'L1', connected: false });
    const e = evaluate(t);
    assert.equal(e.reason, 'link_down', `úloha ${id}`);
    assert.equal(e.layer, 'L1', `úloha ${id}`);
  }
  // úloha 3: odpojená tiskárna nesmí tvrdit, že na serveru neběží DNS
  const t = mk(3);
  runCommand(t, 'PC1', 'ping', { dst: '192.168.1.1', count: 2 });
  applyFix(t, { kind: 'link', link: 'L7', connected: false });
  const e = evaluate(t);
  assert.notEqual(e.reason, 'dns_failed');
  assert.match(text(e), /odpojil/);
  // kabel serveru vytažený: L1, ne DNS
  const t2 = mk(4); applyFix(t2, cfg({})); applyFix(t2, { kind: 'link', link: 'L6', connected: false });
  const e2 = evaluate(t2);
  assert.equal(e2.layer, 'L1', text(e2));
});

test('titulky úloh neprozrazují příčinu (student review5)', () => {
  for (const id of [1, 3, 5, 7]) assert.doesNotMatch(TASKS[id].title, /kabel|konflikt|brán|IP mimo|DNS|služb/i, `úloha ${id}`);
});

const INTERNAL = /ověřujeme|ověřit|pilot/i;
test('do textů pro studenta neprosakují interní poznámky (ověřit, pilot)', () => {
  assert.doesNotMatch(JSON.stringify(TASKS), INTERNAL);
  const lines = ['ipconfig', 'ipconfig /all', 'arp -a', 'ping 192.168.1.1', 'ping 192.168.2.10', 'tracert 192.168.2.10', 'nslookup www.skola.lan',
    'curl -v http://www.skola.lan', 'curl http://192.168.2.10:8080', 'netstat -an', 'route print', 'ping www.skola.lan', 'ipconfig /displaydns'];
  for (const id of TASK_ORDER) {
    const t = mk(id, 2);
    for (const l of lines) assert.doesNotMatch(term(t, 'PC1', l), INTERNAL, `úloha ${id}: ${l}`);
    for (const l of ['ss -tuln', 'ss -tan', 'systemctl status nginx', 'sudo systemctl start nginx']) assert.doesNotMatch(term(t, 'SRV1', l), INTERNAL, `${id}: ${l}`);
    for (const l of ['show ip interface brief', 'show ip arp', 'show ip route', 'ping 192.168.1.10']) assert.doesNotMatch(term(t, 'R1', l), INTERNAL, `${id}: ${l}`);
    for (const r of ['ok', 'partial', 'fail']) void r;
    assert.doesNotMatch(text(evaluate(t)), INTERNAL);
  }
});

test('úloha 10: ping jménem projde přes DNS; špatný zásah do Alice má vlastní text', () => {
  const t = mk(10);
  assert.match(term(t, 'PC1', 'ping www.skola.lan'), /Pinging www\.skola\.lan \[192\.168\.2\.10\][\s\S]*TTL=63/);
  const e0 = text(evaluate(t));
  applyFix(t, cfg({ dns: ['192.168.2.10'], ip: '192.168.1.12' }));
  const e1 = text(evaluate(t));
  assert.notEqual(e1, e0);
  assert.match(e1, /stejný/);
  applyFix(t, cfg({ gateway: null }));
  assert.match(text(evaluate(t)), /rozbila/);
  const t11 = mk(11);
  assert.match(term(t11, 'PC1', 'ping www.skola.lan'), /could not find host/);
});
