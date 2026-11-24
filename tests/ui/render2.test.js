// Vykreslení úrovně 2 bez prohlížeče: všechny kroky × modely, štítky adres, MAC tabulka,
// rentgen (pole, hexdump, propojení čísly polí), vysvětlivka s předpovědí, terminál.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven2-adresy.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { stepIndex } from '../../js/core/timeline.js';
import { topologyHtml, nestHtml, explainHtml2, xrayHtml, presentTabs, summaryHtml, macHtml, termLinesHtml } from '../../js/ui/render2.js';
import { MODEL_IDS } from '../../js/ui/urlstate.js';

const { timeline } = buildLevel2(scenario);
const idx = (l) => stepIndex(timeline.steps, l);
const at = (l) => timeline.view(idx(l));
const pair = (v) => ({ sender: v.flow?.sender ?? 'PC1', receiver: v.flow?.receiver ?? 'PC2' });
const ui = (v, extra = {}) => ({ pair: pair(v), selected: null, predict: null, tips: new Set(), changed: new Set(), ...extra });

test('každý krok a model se vykreslí (topologie, obálky, vysvětlivka, rentgen všech záložek)', () => {
  for (let k = 0; k < timeline.length; k++) {
    const v = timeline.view(k);
    for (const m of MODEL_IDS) {
      assert.ok(topologyHtml(v, ui(v)).includes('TOPOLOGIE'));
      nestHtml(v, m, { pair: pair(v) });
      assert.match(explainHtml2(v, m, 17), /Krok \d+[abc]? z 17/);
    }
    for (const tab of presentTabs(v)) xrayHtml(v, { tab, sel: null, tabs: presentTabs(v) });
  }
});

test('štítky obálek: zdroj/cíl (nikdy odesílatel/příjemce), poslední bajt MAC tučně, čísla polí jako v rentgenu', () => {
  const h = nestHtml(at('4'), 'osi', { pair: pair(at('4')) });
  assert.match(h, /zdroj MAC \(Alice\)/);
  assert.match(h, /cíl MAC \(Bob\)/);
  assert.doesNotMatch(h, /odesílatel|příjemce/);
  assert.equal(macHtml('02:00:00:00:00:02'), '<span class="dim">02:00:00:00:00:</span><b>02</b>');
  assert.match(h, /data-field="eth\.dst"[^>]*>[\s\S]*?<i class="fno">1<\/i>/);
  assert.match(h, /data-field="eth\.src"[^>]*>[\s\S]*?<i class="fno">2<\/i>/);
  assert.match(nestHtml(at('3'), 'osi', { pair: pair(at('3')), socket: true }), /socket: <b>192\.168\.1\.10:49152<\/b> → <b>192\.168\.1\.20:5000<\/b>/);
});

test('MAC tabulka: jen naučené záznamy (rozhodnutí 24), nový řádek se štítkem, flooding vs. cílené', () => {
  const t11 = topologyHtml(at('11'), ui(at('11')));
  assert.match(t11, /prázdná: switch zatím nic nezná/);
  const t12 = topologyHtml(at('12'), ui(at('12')));
  assert.match(t12, /<tr class="new"><td class="mono">.*?01<\/b><\/td><td>Fa0\/1 <span class="newtag">nový<\/span>/);
  const t13 = topologyHtml(at('13'), ui(at('13')));
  assert.doesNotMatch(t13, />\?</, 'žádný řádek „?“');
  assert.match(t13, /neznámá cíl\. MAC → flooding/);
  assert.match(t13, /data-link="L2"[^>]*>.*rámec ▶/);
  assert.match(t13, /data-link="L3"[^>]*>.*rámec ▶/);
  const t14 = topologyHtml(at('14'), ui(at('14')));
  assert.match(t14, /známá cílová MAC → jen Fa0\/1/);
  assert.doesNotMatch(t14, /data-link="L3"[^>]*><span class="cable"><\/span><span class="ftag/);
  assert.match(t14, /nalezeno/);
  assert.match(topologyHtml(at('6'), ui(at('6'))), /hub: na všechny ostatní porty/);
});

test('Cyril zahodil: štítek ve topologii, výtah dvojice Alice -> Cyril ukáže zprávu karty', () => {
  const v = at('7');
  assert.match(topologyHtml(v, ui(v)), /class="pill dropped"/);
  const h = nestHtml(v, 'osi', { pair: { sender: 'PC1', receiver: 'PC3' } });
  assert.match(h, /Cyril:<\/b> cílová MAC .*02<\/b> není moje .*03<\/b>.*zahodila/);
  const x = xrayHtml(v, { tab: 'ethernet', sel: 'eth.dst', tabs: presentTabs(v), pairReceiver: 'PC3' });
  assert.match(x, /síťová karta Cyril rámec zahodila/);
});

test('rentgen: pořadí polí jako na drátě, vybrané pole v hexdumpu, switch čte pole 1 a 2', () => {
  const v = at('12');
  const x = xrayHtml(v, { tab: 'ethernet', sel: 'eth.src', tabs: presentTabs(v) });
  assert.ok(x.indexOf('Cílová MAC') < x.indexOf('Zdrojová MAC'));
  assert.equal((x.match(/class="r-l2 sel own" data-field="eth\.src"/g) || []).length, 6);
  assert.match(x, /class="key selected reads"/);
  assert.match(x, /Silná čára vlevo/);
  assert.match(x, /zdrojová MAC → naučit na port Fa0\/1/);
  assert.match(x, /OUI/);
  const u = xrayHtml(at('2'), { tab: 'udp', sel: 'udp.sport', tabs: presentTabs(at('2')) });
  assert.deepEqual(presentTabs(at('2')), ['udp']);
  assert.match(u, /49152 \(dynamický port\)/);
  assert.match(u, /volí číslo náhodně z rozsahu 49152–65535/);
  const ip = xrayHtml(at('3'), { tab: 'ipv4', sel: 'ip.proto', tabs: presentTabs(at('3')) });
  assert.match(ip, /17 \(UDP\)/);
  assert.match(ip, /další pole hlavičky \(11\)/);
  assert.match(xrayHtml(at('1'), { tab: 'ethernet', sel: null, tabs: presentTabs(at('1')) }), /Obálky zatím nejsou/);
});

test('předpověď: porty switche jako volby, Fa0/1 (vstup) ne; vysvětlivka s tlačítky', () => {
  const k = idx('12');
  const pred = timeline.steps[k].predict;
  const v = at('12');
  const t = topologyHtml(v, ui(v, { predict: pred, tips: new Set(['Fa0/2']) }));
  assert.match(t, /data-pick="Fa0\/2" aria-pressed="true"/);
  assert.match(t, /data-pick="Fa0\/3" aria-pressed="false"/);
  assert.doesNotMatch(t, /data-pick="Fa0\/1"/);
  const e = explainHtml2(v, 'osi', 17, { predict: pred, tips: new Set(['Fa0/2']), evalLine: '' });
  assert.match(e, /Předpověz: Na které porty switch rámec pošle\?/);
  assert.match(e, /class="btn small on"\s+data-pick="Fa0\/2"/);
});

test('shrnutí a terminál', () => {
  const s = summaryHtml('hub', at('10'));
  assert.match(s, /„Ahoj, Bobe!“<\/td><td>zdroj<\/td><td>✓ přijal<\/td><td>⊗ zahodil/);
  assert.match(summaryHtml('addresses', at('17')), /síťová karta, switch/);
  assert.equal(termLinesHtml([{ kind: 'cmd', prompt: 'SW1#', text: 'sh <x>' }]), '<div class="tl"><span class="prompt">SW1#</span>sh &lt;x&gt;</div>');
});
