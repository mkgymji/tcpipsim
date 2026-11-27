// Rozh. 63: tahák prirucka/tahak.md je aktuální vůči registru příkazů a terminál každý příkaz z registru přijme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMMANDS, helpLines } from '../../js/cli/commands.js';
import { tahakMarkdown } from '../../tools/tahak.mjs';
import { execute, plain } from '../../js/cli/shell.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { buildLevel3 } from '../../js/scenario/level3.js';
import { buildLevel4 } from '../../js/scenario/level4.js';
import s2 from '../../scenarios/uroven2-adresy.js';
import s3 from '../../scenarios/uroven3-smerovani.js';
import s4 from '../../scenarios/uroven4-transport.js';

const TIMELINES = { 2: buildLevel2(s2).timeline, 3: buildLevel3(s3).timeline, 4: buildLevel4(s4).timeline };
const TYPE = { PC: 'pc', switch: 'switch', router: 'router', server: 'server' };
// první uzel daného typu v některém kroku úrovně (typ PC = cokoli, co má dialekt Windows)
function nodeAt(level, where) {
  const tl = TIMELINES[level];
  for (let i = 0; i < tl.length; i++) {
    const n = Object.values(tl.view(i).nodes).find((x) => (where === 'PC' ? !['switch', 'router', 'server', 'hub'].includes(x.type) : x.type === TYPE[where]));
    if (n) return n;
  }
  return null;
}
const REJECT = /is not recognized|unrecognized or incomplete|Invalid input|Incomplete command|Ambiguous|command not found|Usage:|v úrovni \d+ není|zpřístupní úroveň|přijde v úrovni/;

test('prirucka/tahak.md odpovídá registru (jinak spusť node tools/tahak.mjs)', () => {
  assert.equal(readFileSync(new URL('../../prirucka/tahak.md', import.meta.url), 'utf8'), tahakMarkdown());
});

test('terminál přijme každý příkaz z registru od jeho úrovně; Windows ho o úroveň níž odmítne', () => {
  for (const c of COMMANDS) {
    const line = c.example ?? c.usage;
    assert.doesNotMatch(line, /</, `${c.usage}: chybí example`);
    for (let level = c.from; level <= 4; level++) {
      const node = nodeAt(level, c.where);
      if (!node) continue;   // uzel v úrovni není (např. switch jen v úrovni 2)
      const r = execute(node, line, { level, mode: c.priv ? 'priv' : 'user' });
      const text = `${plain(r)}\n${r.note ?? ''}`;
      assert.doesNotMatch(text, REJECT, `úroveň ${level}, ${c.where}: ${line}`);
    }
    if (c.platform === 'win' && c.from > 2) {
      const r = execute(nodeAt(c.from - 1, 'PC'), line, { level: c.from - 1 });
      assert.match(`${plain(r)}\n${r.note ?? ''}`, REJECT, `úroveň ${c.from - 1}: ${line} by neměl fungovat`);
    }
  }
});

test('nápověda terminálu je z registru', () => {
  assert.ok(nodeAt(2, 'switch'), 'switch v úrovni 2');
  assert.deepEqual(execute(nodeAt(2, 'PC'), 'help', { level: 2 }).lines, helpLines('PC', 2));
  const h4 = plain(execute(nodeAt(4, 'PC'), '?', { level: 4 }));
  for (const c of COMMANDS.filter((x) => x.where === 'PC')) assert.ok(h4.includes(c.usage), c.usage);
  assert.doesNotMatch(plain(execute(nodeAt(2, 'PC'), 'help', { level: 2 })), /tracert/);
  assert.match(plain(execute(nodeAt(3, 'router'), '?', { level: 3 })), /show ip route/);
  assert.match(plain(execute(nodeAt(4, 'server'), 'help', { level: 4 })), /ss -tuln/);
});
