// Ohnisko kroku (rozhodnutí 56b): krok tipu -> tip, krok s polem rentgenu -> rentgen,
// změna tabulky -> topologie, jinak vrstvy; pole `focus` ve scénáři pravidlo přepíše.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import s1 from '../../scenarios/uroven1-zapouzdreni.js';
import s2 from '../../scenarios/uroven2-adresy.js';
import s3 from '../../scenarios/uroven3-smerovani.js';
import { buildLevel1 } from '../../js/scenario/level1.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { buildLevel3 } from '../../js/scenario/level3.js';
import { stepFocus, FOCI } from '../../js/ui/focus.js';

const levels = [['1', buildLevel1(s1).timeline], ['2', buildLevel2(s2).timeline], ['3', buildLevel3(s3).timeline]];

for (const [id, tl] of levels) {
  test(`úroveň ${id}: krok tipu má ohnisko „tip“, krok s polem rentgenu „rentgen“`, () => {
    tl.steps.forEach((s, k) => {
      const f = stepFocus(s, tl.view(k));
      assert.ok(FOCI.includes(f), `krok ${k}: ${f}`);
      if (s.focus) assert.equal(f, s.focus, `krok ${k}: přepsáno scénářem`);
      else if (s.predict) assert.equal(f, 'tip', `krok ${k}`);
      else if (s.xray?.fields?.length) assert.equal(f, 'rentgen', `krok ${k}`);
    });
  });
}

test('úroveň 2: krok s tipem má ohnisko tip, i když se mění MAC tabulka', () => {
  const tl = levels[1][1];
  const k = tl.steps.findIndex((s, j) => s.predict && tl.view(j).changes.some((r) => r.kind === 'mac_learn'));
  assert.ok(k >= 0);
  assert.equal(stepFocus(tl.steps[k], tl.view(k)), 'tip');
});

test('úroveň 3: změna ARP tabulky bez tipu a rentgenu -> topologie; scénář smí přepsat; terminál', () => {
  const tl = levels[2][1];
  const k = tl.steps.findIndex((s, j) => !s.predict && !s.xray && !s.focus && tl.view(j).changes.some((r) => r.kind === 'arp_learn'));
  assert.ok(k >= 0);
  assert.equal(stepFocus(tl.steps[k], tl.view(k)), 'topologie');
  const mask = tl.steps.findIndex((s) => s.panel === 'mask');
  assert.equal(stepFocus(tl.steps[mask], tl.view(mask)), 'rentgen');
  assert.equal(stepFocus({}, { changes: [] }), 'vrstvy');
  assert.equal(stepFocus({}, { changes: [] }, { termOpen: true }), 'terminal');
  assert.equal(stepFocus({ focus: 'terminal' }, { changes: [] }), 'vrstvy', 'zavřený terminál nemůže být ohnisko');
  assert.equal(stepFocus({ focus: 'nesmysl', predict: {} }, { changes: [] }), 'tip', 'neznámá hodnota -> výchozí pravidlo');
});
