// Shoda „o čem krok mluví = co pohled ukazuje“ pro úrovně 2–4 (kontrola úrovně 4, R1–R4; rozhodnutí 50, 57):
// krok s `expect` musí v prostředním bloku ukazovat přesně tu zprávu (odkud, kam, protokol, příznaky, čísla).
// Úroveň 4 navíc: sloupec příjemce = uzel `right` z kroku, kdykoli je nějaká zpráva vidět; každý krok
// s rentgenem má `expect`. Chyba této třídy (krok zahrne zprávu, kterou jádro vyšle těsně před dalším
// krokem) se tak už nezopakuje bez červeného testu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectDiff, shownMessage } from '../../js/core/message.js';
import { stepPair } from '../../js/ui/lift.js';
import { stepLabel } from '../../js/core/timeline.js';
import s2 from '../../scenarios/uroven2-adresy.js';
import s3 from '../../scenarios/uroven3-smerovani.js';
import s4 from '../../scenarios/uroven4-transport.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { buildLevel3 } from '../../js/scenario/level3.js';
import { buildLevel4 } from '../../js/scenario/level4.js';

const levels = [[2, s2, buildLevel2], [3, s3, buildLevel3], [4, s4, buildLevel4]];

for (const [lv, scn, build] of levels) {
  test(`úroveň ${lv}: zobrazená zpráva odpovídá očekávání kroku (expect)`, () => {
    const { timeline } = build(scn);
    const bad = [];
    let n = 0;
    for (let k = 0; k < timeline.length; k++) {
      const v = timeline.view(k);
      if (!v.step.expect) continue;
      n++;
      for (const d of expectDiff(v, v.step.expect)) bad.push(`krok ${stepLabel(v.step)}: ${d}`);
    }
    assert.ok(n >= 4, `úroveň ${lv} má aspoň 4 kroky s expect (${n})`);
    assert.deepEqual(bad, []);
  });
}

test('úroveň 4: sloupec příjemce = uzel kroku (right), kroky s rentgenem mají expect', () => {
  const { timeline } = buildLevel4(s4);
  const bad = [];
  for (let k = 0; k < timeline.length; k++) {
    const v = timeline.view(k);
    const s = v.step;
    if (s.xray && !s.expect) bad.push(`krok ${stepLabel(s)}: rentgen bez expect`);
    const m = shownMessage(v);
    const p = stepPair(v);
    if (m?.from && m.to && p.receiver !== s.right) bad.push(`krok ${stepLabel(s)}: vpravo ${p.receiver}, krok mluví o ${s.right}`);
    if (s.expect && (p.sender !== s.expect.from || p.receiver !== s.expect.to)) bad.push(`krok ${stepLabel(s)}: sloupce ${p.sender}->${p.receiver}`);
  }
  assert.deepEqual(bad, []);
});
