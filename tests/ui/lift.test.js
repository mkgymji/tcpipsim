// „U“ (rozhodnutí 38): poloha bloku podle aktivní vrstvy, pruh média, hub/switch v pruhu.
// Čisté funkce z ui/lift.js; skutečnou polohu v prohlížeči hlídá tests/browser/interact.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scn1 from '../../scenarios/uroven1-zapouzdreni.js';
import scn2 from '../../scenarios/uroven2-adresy.js';
import { buildLevel1 } from '../../js/scenario/level1.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { stepIndex } from '../../js/core/timeline.js';
import { liftAnchor, laneEnd, laneRowOfLayer, mediumHtml, mediumDevice } from '../../js/ui/lift.js';

const t1 = buildLevel1(scn1).timeline;
const t2 = buildLevel2(scn2).timeline;
const at1 = (l) => t1.view(stepIndex(t1.steps, l));
const at2 = (l) => t2.view(stepIndex(t2.steps, l));
const pair1 = (v) => ({ sender: v.sender, receiver: v.receiver });
const pair2 = (v) => ({ sender: v.flow?.sender ?? 'PC1', receiver: v.flow?.receiver ?? 'PC2' });
// řádek mřížky se spodní hranou bloku (grid-row: 1 / end -> poslední řádek je end - 1)
const bottomRow = (v, pair, dev) => laneEnd(liftAnchor(v, pair), v.packet?.form, dev) - 1;

test('úroveň 1: blok má spodní hranu u aktivní vrstvy, bity jsou v pruhu média (L1)', () => {
  const exp = { 1: ['sender', 7], 3: ['sender', 3], 4: ['sender', 2], 7: ['receiver', 2], '8b': ['receiver', 3], 9: ['receiver', 7] };
  for (const [k, [who, layer]] of Object.entries(exp)) {
    const v = at1(k);
    const a = liftAnchor(v, pair1(v));
    assert.deepEqual([a.at, a.layer], [who, layer], `krok ${k}`);
    assert.equal(bottomRow(v, pair1(v)), laneRowOfLayer(layer), `krok ${k}: řádek bloku = řádek L${layer}`);
  }
  // krok 6: na drátě; blok (poznámka) končí nad L1, bity jedou v pruhu mezi řádky L1
  const v6 = at1('6');
  assert.equal(liftAnchor(v6, pair1(v6)).at, 'wire');
  assert.equal(bottomRow(v6, pair1(v6)), laneRowOfLayer(2));
  const m6 = mediumHtml(v6, pair1(v6), { capInfo: true });
  assert.match(m6, /class="mrow on"/);
  assert.match(m6, /class="ribbon at-mid/);
  assert.match(m6, /médium \(kabel\)/);
  // bez bitů pruh nesvítí
  assert.doesNotMatch(mediumHtml(at1('4'), pair1(at1('4'))), /ribbon|mrow on/);
  // úvod: zpráva u Alice nahoře (L7); konec: bez aktivní vrstvy, blok nahoře
  assert.deepEqual(liftAnchor(at1('0'), pair1(at1('0'))), { at: 'sender', layer: 7, node: 'PC1' });
  assert.equal(liftAnchor(at1('10'), pair1(at1('10'))).at, 'none');
});

test('úroveň 2: blok u aktivní vrstvy, hub jen L1, switch L1–L2 (rámec sedí na věžičce switche)', () => {
  const dev = mediumDevice(at2('4'));
  assert.equal(dev.type, 'hub');
  const v4 = at2('4');
  assert.equal(bottomRow(v4, pair2(v4), 'hub'), laneRowOfLayer(2), 'krok 4: rámec u L2 Alice');
  const v8b = at2('8b');
  assert.equal(bottomRow(v8b, pair2(v8b), 'hub'), laneRowOfLayer(3), 'krok 8b: paket u L3 Boba');
  // switch: rámec nad věžičkou (nepřekryje její řádek L2), věžička má aktivní L2
  const v11 = at2('11');
  const a11 = liftAnchor(v11, pair2(v11));
  assert.deepEqual([a11.at, a11.layer], ['device', 2]);
  assert.equal(bottomRow(v11, pair2(v11), 'switch'), laneRowOfLayer(3));
  const m11 = mediumHtml(v11, pair2(v11), { dev: mediumDevice(v11) });
  assert.match(m11, /class="tower switch act"/);
  assert.match(m11, /tcell active[^>]*><b>L2<\/b>/);
  // hub má v pruhu jen L1, switch L1 i L2
  assert.doesNotMatch(mediumHtml(v4, pair2(v4), { dev }), /<b>L2<\/b>/);
  assert.match(mediumHtml(v4, pair2(v4), { dev }), /class="tower hub"/);
});

test('úroveň 2: pásek bitů je krátký (8 bitů) a krok tipu v pruhu nic neprozradí (rozhodnutí 31)', () => {
  // krok 5 = tip u hubu: bity jen na vstupním úseku, žádné výstupy
  const v5 = at2('5');
  const m5 = mediumHtml(v5, pair2(v5), { dev: mediumDevice(v5) });
  assert.match(m5, /ribbon at-seg-l-in/);
  assert.equal((m5.match(/class="ribbon/g) ?? []).length, 1);
  assert.match(m5, /<span class="bv">[01]{8}…<\/span>/);
  assert.match(m5, /tcell active[^>]*><b>L1<\/b>/, 'hub čte jen L1');
  // tipy u switche (11, 13, 16): v pruhu žádné bity
  for (const k of ['11', '13', '16']) {
    const v = at2(k);
    assert.doesNotMatch(mediumHtml(v, pair2(v), { dev: mediumDevice(v) }), /ribbon/, `krok ${k}`);
  }
  // krok 6: hub opakuje, bity na výstupním úseku
  const v6 = at2('6');
  assert.match(mediumHtml(v6, pair2(v6), { dev: mediumDevice(v6) }), /ribbon at-seg-r/);
});
