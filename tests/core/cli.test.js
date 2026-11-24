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
  assert.match(execute(at('7').nodes.PC3, 'arp -a').note, /nezapamatoval/);
  assert.match(execute(at('4').nodes.PC1, 'arp -d').note, /úroveň 3/);
});

test('show mac address-table: krok 11 prázdná, krok 15 dva záznamy Cisco zápisem, Cyril chybí', () => {
  const e = out('11', 'SW1', 'show mac address-table');
  assert.match(e, /Total Mac Addresses for this criterion: 0/);
  const t = out('15', 'SW1', 'show mac address-table');
  assert.match(t, /^ {3}1 {4}0200\.0000\.0001 {4}DYNAMIC {5}Fa0\/1$/m);
  assert.match(t, /^ {3}1 {4}0200\.0000\.0002 {4}DYNAMIC {5}Fa0\/2$/m);
  assert.doesNotMatch(t, /0003/);
  assert.match(t, /Total Mac Addresses for this criterion: 2/);
  assert.equal(out('15', 'SW1', 'sh mac add'), t, 'zkratky jako IOS');
  assert.match(out('15', 'SW1', 'show mac address-table interface fa0/2'), /Total Mac Addresses for this criterion: 1/);
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
