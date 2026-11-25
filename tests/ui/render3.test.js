// Úroveň 3: vykreslení všech kroků v obou modelech (bez výjimky, bez slov „výtah“/„prostředník“),
// tipy nic neprozradí (rozhodnutí 31), věže zařízení v pruhu média (rozhodnutí 48), L4 přeskočená (47).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven3-smerovani.js';
import { buildLevel3 } from '../../js/scenario/level3.js';
import { stepIndex } from '../../js/core/timeline.js';
import { topologyHtml3, nestHtml3, mediumHtml3, explainHtml3, xrayHtml3, compareCard, tablesCard, probesCard, maskCard,
  laneEnd3, liftAnchor3, mediumDevices3, pathOf, nestCaption3 } from '../../js/ui/render3.js';
import { tipEvaluator, evalTip } from '../../js/ui/tips.js';

const { timeline } = buildLevel3(scenario);
const at = (l) => timeline.view(stepIndex(timeline.steps, l));
const pairOf = (v) => (v.flow ? { sender: v.flow.sender, receiver: v.flow.receiver } : { sender: 'PC1', receiver: 'PC2' });
const all = (v, model = 'osi', tip = false) => {
  const pair = pairOf(v);
  return [topologyHtml3(v, { pair }), nestHtml3(v, model, { pair, tip }), mediumHtml3(v, pair, { model }),
    explainHtml3(v, model, 25, { predict: v.step.predict, tips: new Set() }), xrayHtml3(v, { tab: 'ethernet' }),
    compareCard(v), tablesCard(v), probesCard(v), maskCard(v)].join('\n');
};

test('všechny kroky se vykreslí v ISO/OSI i TCP/IP; bez slov výtah a prostředník', () => {
  for (let k = 0; k < timeline.length; k++) {
    for (const m of ['osi', 'tcpip']) {
      const html = all(timeline.view(k), m, Boolean(timeline.steps[k].predict));
      assert.doesNotMatch(html, /výtah|prostředník|undefined|NaN|\[object/i, `krok ${k} ${m}`);
    }
  }
});

test('tipy nic neprozradí: 3 bez rámce a MAC brány, 11 bez nového rámce, 13 bez TTL 127 u Alice, 18 bez Time Exceeded', () => {
  const v3 = at('3');
  assert.doesNotMatch(nestHtml3(v3, 'osi', { pair: pairOf(v3), tip: true }), /02:00:00:00:01:01|ff:ff:ff/);
  assert.doesNotMatch(xrayHtml3(v3, { tab: 'ethernet' }), /Ethernet II/);
  const v11 = at('11');
  assert.equal(v11.hop.out, null);
  assert.doesNotMatch(mediumHtml3(v11, pairOf(v11)), /nový rámec/);
  assert.equal(compareCard(v11).includes('jiná'), false);
  const v13 = at('13');
  assert.ok(!Object.values(v13.apps)[0].events.length, 'Alice zatím nemá odpověď');
  const v18 = at('18');
  assert.doesNotMatch(probesCard(v18), /Time Exceeded/);
  assert.doesNotMatch(nestHtml3(v18, 'osi', { pair: pairOf(v18), tip: true }), /zahodil/);
});

test('vyhodnocení tipů: věta Tvůj tip / Skutečnost / Sedí | Nesedí s důvodem', () => {
  const ev = tipEvaluator(timeline.steps);
  const k5 = stepIndex(timeline.steps, '5');
  assert.equal(ev.evaluatorOf(k5), stepIndex(timeline.steps, '6'));
  assert.match(evalTip(timeline, k5, k5 + 1, ['Cyril', 'R1 (Gi0/0)']).html, /Sedí\./);
  const bad = evalTip(timeline, k5, k5 + 1, ['Cyril', 'R1 (Gi0/0)', 'Bob']);
  assert.equal(bad.same, false);
  assert.match(bad.html, /Nesedí: Broadcast se nepřenáší přes router/);
  const k18 = stepIndex(timeline.steps, '18');
  assert.match(evalTip(timeline, k18, k18 + 1, ['zahodí ho']).html, /Time Exceeded/);
  const k22 = stepIndex(timeline.steps, '22a');
  assert.equal(ev.evaluatorOf(k22), stepIndex(timeline.steps, '22b'));
});

test('rozhodnutí 51: část D před tipem bez diagnózy, Oprav bránu až po vyhodnocení; tip 13 bez 127; tip 16 bez cesty', () => {
  const steps = timeline.steps;
  for (const l of ['21', '22a', '23', '24a']) {
    const v = at(l);
    const s = v.step;
    const html = topologyHtml3(v, { pair: pairOf(v), hideGw: s.hideGw }) + nestHtml3(v, 'osi', { pair: pairOf(v) })
      + explainHtml3(v, 'osi', 25, { predict: s.predict, tips: new Set() }).replace(/<div class="predict"[\s\S]*?<\/div>/, '');
    assert.doesNotMatch(`${s.title} ${s.text} ${s.note ?? ''}`, /brán|gateway/i, `krok ${l}: text`);
    assert.doesNotMatch(html.replace(/<details>[\s\S]*?<\/details>/g, ''), /bez brány|brána 192\.168\.1\.254|data-fix|Žádná cesta/i, `krok ${l}: HTML`);
  }
  assert.ok(steps[stepIndex(steps, '22b')].fix && steps[stepIndex(steps, '24b')].fix);
  const v13 = at('13');
  const h13 = topologyHtml3(v13, { pair: pairOf(v13), tip: true }) + nestHtml3(v13, 'osi', { pair: pairOf(v13), tip: true })
    + mediumHtml3(v13, pairOf(v13)) + xrayHtml3(v13, { tab: 'ipv4' }) + v13.step.text;
  assert.doesNotMatch(h13, /TTL 127|TTL=127|>127</, 'tip 13 bez výsledku');
  const v16 = at('16');
  assert.deepEqual(mediumDevices3(v16, pairOf(v16)), ['SW1', 'R1'], 'tip 16: všechna zařízení, ne cesta');
});

test('rozhodnutí 50: nadpis a popisek podle skutečné zprávy', () => {
  assert.match(nestCaption3(at('5')).left, /^ARP dotaz · Alice → všem/);
  assert.match(nestCaption3(at('7')).left, /^ARP odpověď · R1 → Alice/);
  assert.match(nestCaption3(at('19')).left, /^Time Exceeded · R1 → Alice/);
  assert.match(nestCaption3(at('14')).left, /^Echo Reply · Bob → Alice/);
});

test('pruh média: Alice -> Bob má věže SW1 (L2) a R1 (L3), Alice -> Cyril jen SW1; blok v routeru sedí na věži', () => {
  const v = at('9');
  assert.deepEqual(pathOf(v, 'PC1', 'PC2'), ['PC1', 'SW1', 'R1', 'PC2']);
  assert.deepEqual(mediumDevices3(v, pairOf(v)), ['SW1', 'R1']);
  const m = mediumHtml3(v, pairOf(v));
  assert.match(m, /tower3 router[\s\S]*L3<\/b> Síťová/);
  assert.match(m, /starý rámec/);
  const a = { ...liftAnchor3(v, pairOf(v)), type: 'router' };
  assert.equal(a.at, 'device');
  assert.equal(laneEnd3(a, 'pdu', ['switch', 'router']), 5);
  const v17 = at('17');
  assert.deepEqual(mediumDevices3(v17, pairOf(v17)), ['SW1']);
  assert.match(nestHtml3(v, 'osi', { pair: pairOf(v) }), /TTL 128<\/s> → TTL 127/);
});

test('ICMP bez L4 (rozhodnutí 47): řádek L4 přeskočený, v obálce pruh „ICMP nemá porty“; rentgen ARP a ICMP', () => {
  const v = at('3');
  assert.equal(v.nodes.PC1.layers[4], 'skip');
  assert.match(nestHtml3(v, 'osi', { pair: pairOf(v) }), /ICMP nemá porty/);
  assert.match(xrayHtml3(at('5'), { tab: 'arp' }), /IP cíle[\s\S]*192\.168\.1\.1 \(k ní se hledá MAC\)/);
  assert.doesNotMatch(xrayHtml3(at('19'), { tab: 'icmp' }), /class="[^"]*\bnoport\b/, 'R7: bez kolize třídy');
  assert.match(xrayHtml3(at('19'), { tab: 'icmp' }), /11 = Time Exceeded/);
  assert.match(xrayHtml3(at('19'), { tab: 'icmp' }), /Původní paket/);
});

test('karta před a za R1 (12): MAC jiná, IP stejná, TTL −1; tabulky (17) zvýrazní řádek Alice', () => {
  const c = compareCard(at('12'));
  assert.equal((c.match(/jiná/g) ?? []).length, 2);
  assert.equal((c.match(/✓ stejná/g) ?? []).length, 2);
  assert.match(c, /−1/);
  assert.match(tablesCard(at('17')), /class="hit"[^]*192\.168\.1\.0\/24/);
});
