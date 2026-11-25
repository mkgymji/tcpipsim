// Odkazové čipy v textu kroku (rozhodnutí 56c): syntaxe, HTML a to, že každý čip ve scénářích
// úrovní 2 a 3 míří na cíl, který v daném kroku existuje.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import s2 from '../../scenarios/uroven2-adresy.js';
import s3 from '../../scenarios/uroven3-smerovani.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { buildLevel3 } from '../../js/scenario/level3.js';
import { parseChips, stripChips, chipsHtml, fieldTab } from '../../js/ui/chips.js';
import { esc } from '../../js/ui/render.js';
import { explainHtml2, presentTabs } from '../../js/ui/render2.js';
import { explainHtml3, xrayTarget } from '../../js/ui/render3.js';
import { pduFields } from '../../js/wire/fields.js';
import { stepLabel } from '../../js/core/timeline.js';

test('syntaxe čipů: parse, strip, HTML s aria-label a escapováním', () => {
  const t = 'Sníží {{rentgen:ip.ttl|TTL}} o 1, viz {{topo:R1.route|směrovací tabulka}} a {{term|terminál}} <b>';
  assert.deepEqual(parseChips(t).map((c) => [c.kind, c.target, c.label]),
    [['rentgen', 'ip.ttl', 'TTL'], ['topo', 'R1.route', 'směrovací tabulka'], ['term', '', 'terminál']]);
  assert.equal(stripChips(t), 'Sníží TTL o 1, viz směrovací tabulka a terminál <b>');
  const h = chipsHtml(t, esc);
  assert.equal((h.match(/<button type="button" class="tchip/g) ?? []).length, 3);
  assert.match(h, /data-chip="rentgen" data-chip-target="ip.ttl" aria-label="TTL: ukázat v rentgenu"><span aria-hidden="true">→<\/span> TTL<\/button>/);
  assert.match(h, /&lt;b&gt;$/);
  assert.equal(fieldTab('ip.ttl'), 'ipv4');
  assert.equal(fieldTab('eth.src'), 'ethernet');
  assert.equal(fieldTab('PC1.route'), null);
});

const PANEL_OF = { mask: 'mask', arp: 'tables', 'PC1.route': 'tables' };
const TABLE_TYPE = { mac: ['switch'], route: ['router'], arp: ['router', 'pc'] };

function checkLevel(name, scn, tl, explain, tabsOf, required) {
  test(`${name}: čipy se vykreslí a míří na existující cíl`, () => {
    const withChips = new Set();
    tl.steps.forEach((s, k) => {
      const v = tl.view(k);
      const nodes = v.nodes;   // uzly v kroku (úroveň 2: hub se vymění za switch)
      const chips = [...parseChips(s.text), ...parseChips(s.note)];
      if (!chips.length) return;
      withChips.add(String(s.num));
      const html = explain(v, tl.steps.length);
      assert.equal((html.match(/class="tchip /g) ?? []).length, chips.length, `krok ${stepLabel(s)}: čipy v HTML`);
      assert.ok(!html.includes('{{'), `krok ${stepLabel(s)}: žádná nezpracovaná značka`);
      for (const c of chips) {
        const where = `krok ${stepLabel(s)}, čip ${c.kind}:${c.target}`;
        if (c.kind === 'rentgen' && fieldTab(c.target)) {
          const tabs = tabsOf(v);
          assert.ok(tabs.includes(fieldTab(c.target)), `${where}: záložka ${fieldTab(c.target)} v rentgenu (${tabs})`);
          const pdu = xrayTarget(v);
          if (pdu) assert.ok(pduFields(pdu).blocks.some((b) => b.fields.some((f) => f.id === c.target)), `${where}: pole v hlavičce`);
        } else if (c.kind === 'rentgen') {
          assert.equal(s.panel, PANEL_OF[c.target], `${where}: karta v pravém panelu`);
        } else if (c.kind === 'topo') {
          const [id, table] = c.target.split('.');
          assert.ok(nodes[id], `${where}: uzel existuje`);
          if (table) assert.ok(TABLE_TYPE[table]?.includes(nodes[id].type), `${where}: tabulka u uzlu typu ${nodes[id].type}`);
        } else {
          assert.ok(!c.target || ['pc', 'router', 'switch'].includes(nodes[c.target]?.type), `${where}: uzel s terminálem`);
        }
      }
    });
    for (const r of required) assert.ok(withChips.has(r), `${name}: krok ${r} má čip`);
  });
}

const tl2 = buildLevel2(s2).timeline;
checkLevel('úroveň 2', s2, tl2, (v, n) => explainHtml2(v, 'osi', n), presentTabs, ['4', '11', '15']);
const tl3 = buildLevel3(s3).timeline;
const tabs3 = (v) => { const p = xrayTarget(v); return p ? pduFields(p).blocks.map((b) => b.id) : []; };
checkLevel('úroveň 3', s3, tl3, (v, n) => explainHtml3(v, 'osi', n), tabs3, ['2', '9', '12', '13', '14', '15', '17', '19']);
