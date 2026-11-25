// Terminál úrovně 2 (docs/spec/cmd.md): Windows ipconfig, ipconfig /all, arp -a; IOS show mac address-table.
// Vstup -> očekávaný text, stav ze scénáře v daném kroku.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven2-adresy.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { stepIndex } from '../../js/core/timeline.js';
import { execute, plain, promptOf, dialectOf } from '../../js/cli/shell.js';

const { timeline } = buildLevel2(scenario);
const at = (label) => timeline.view(stepIndex(timeline.steps, label));
const out = (label, node, cmd) => plain(execute(at(label).nodes[node], cmd));

test('ipconfig /all na Alici: MAC s pomlčkami, IPv4, maska, prázdná brána (rozhodnutí 27)', () => {
  const t = out('1', 'PC1', 'ipconfig /all');
  assert.match(t, /^ {3}Physical Address\. \. \. \. \. \. \. \. \. : 02-00-00-00-00-01$/m);
  assert.match(t, /^ {3}IPv4 Address\. \. \. \. \. \. \. \. \. \. \. : 192\.168\.1\.10\(Preferred\)$/m);
  assert.match(t, /^ {3}Subnet Mask \. \. \. \. \. \. \. \. \. \. \. : 255\.255\.255\.0$/m);
  assert.match(t, /^ {3}Default Gateway \. \. \. \. \. \. \. \. \. : $/m);
  assert.match(t, /Host Name .*: ALICE$/m);
  // všechny dvojtečky ve stejném sloupci
  const cols = new Set(t.split('\n').filter((l) => / : /.test(l)).map((l) => l.indexOf(' : ')));
  assert.equal(cols.size, 1);
  const short = out('1', 'PC1', 'ipconfig');
  assert.doesNotMatch(short, /Physical Address/);
  assert.match(short, /IPv4 Address.*: 192\.168\.1\.10$/m);
});

test('arp -a: Alice zná Boba (dynamic), Cyril jen statické řádky (rozhodnutí 26)', () => {
  const a = out('4', 'PC1', 'arp -a');
  assert.match(a, /^Interface: 192\.168\.1\.10 --- 0x4$/m);
  assert.match(a, /^ {2}192\.168\.1\.20 +02-00-00-00-00-02 +dynamic$/m);
  assert.match(a, /^ {2}192\.168\.1\.255 +ff-ff-ff-ff-ff-ff +static$/m);
  const c = out('7', 'PC3', 'arp -a');
  assert.doesNotMatch(c, /dynamic/);
  assert.match(c, /255\.255\.255\.255 +ff-ff-ff-ff-ff-ff +static/);
  assert.match(execute(at('7').nodes.PC3, 'arp -a').note, /^Simulátor: Cyril nemá žádný záznam typu dynamic, žádnou MAC si nezapamatoval\. Řádky static \(broadcast, multicast\) má Windows vždy/);
  assert.match(execute(at('4').nodes.PC1, 'arp -d').note, /úroveň 3/);
});

test('ipconfig: dva prázdné řádky před adaptérem; ipconfig/all bez mezery; chybný přepínač (recenzent 4)', () => {
  const short = out('1', 'PC1', 'ipconfig').split('\n');
  assert.deepEqual(short.slice(0, 5), ['', 'Windows IP Configuration', '', '', 'Ethernet adapter Ethernet:']);
  assert.equal(out('1', 'PC1', 'ipconfig/all'), out('1', 'PC1', 'ipconfig /all'));
  assert.equal(out('1', 'PC1', 'IPCONFIG -ALL'), out('1', 'PC1', 'ipconfig /all'));
  for (const bad of ['ipconfig /foo', 'ipconfig /al', 'ipconfig all', 'ipconfig/x']) {
    const r = execute(at('1').nodes.PC1, bad);
    assert.equal(plain(r), '\nError: unrecognized or incomplete command line.\n', bad);
    assert.match(r.note, /ipconfig \/all/);
  }
  assert.equal(out('1', 'PC1', 'arp/a'), out('1', 'PC1', 'arp -a'));
});

test('show mac address-table: krok 10 prázdná, krok 15 dva záznamy Cisco zápisem, Cyril chybí', () => {
  const e = out('10', 'SW1', 'show mac address-table');
  assert.match(e, /Total Mac Addresses for this criterion: 0/);
  const t = out('15', 'SW1', 'show mac address-table');
  assert.match(t, /^ {3}1 {4}0200\.0000\.0001 {4}DYNAMIC {5}Fa0\/1$/m);
  assert.match(t, /^ {3}1 {4}0200\.0000\.0002 {4}DYNAMIC {5}Fa0\/2$/m);
  assert.doesNotMatch(t, /0003/);
  assert.match(t, /Total Mac Addresses for this criterion: 2/);
  assert.equal(out('15', 'SW1', 'sh mac add'), t, 'zkratky jako IOS');
  assert.match(out('15', 'SW1', 'show mac address-table interface fa0/2'), /Total Mac Addresses for this criterion: 1/);
  assert.match(out('15', 'SW1', 'show mac address-table interface FastEthernet0/3'), /criterion: 0/);
});

test('IOS: neplatný port se stříškou, clear mac address-table je platný příkaz (recenzent 9)', () => {
  const sw = at('15').nodes.SW1;
  const r = execute(sw, 'show mac address-table interface fa0/9');
  assert.equal(r.lines[1], "% Invalid input detected at '^' marker.");
  assert.equal(r.lines[0].indexOf('^'), 'SW1#show mac address-table interface '.length);
  for (const c of ['clear mac address-table', 'clear mac address-table dynamic', 'cl mac add']) {
    const x = execute(sw, c);
    assert.deepEqual(x.lines, [], c);
    assert.match(x.note, /^Simulátor zjednodušuje: v úrovni 2 tabulku jen čteš/, c);
  }
  assert.equal(plain(execute(sw, 'clear mac')).split('\n')[0], '% Incomplete command.');
});

test('chybné příkazy: IOS stříška, neúplný příkaz; Windows not recognized; prompty a dialekty', () => {
  const sw = at('15').nodes.SW1;
  const bad = execute(sw, 'show mac adress-table').lines;
  assert.equal(bad[1], "% Invalid input detected at '^' marker.");
  assert.equal(bad[0].indexOf('^'), 'SW1#show mac '.length);
  assert.equal(plain(execute(sw, 'show')).split('\n')[0], '% Incomplete command.');
  assert.match(out('1', 'PC1', 'ipconfig2'), /'ipconfig2' is not recognized as an internal or external command/);
  assert.equal(promptOf(at('1').nodes.PC1), 'C:\\Users\\Alice>');
  assert.equal(promptOf(sw), 'SW1#');
  assert.equal(dialectOf(at('3').nodes.HUB1), null);
  assert.match(execute(at('3').nodes.HUB1, 'show mac address-table').note, /Hub nemá konzoli/);
});
