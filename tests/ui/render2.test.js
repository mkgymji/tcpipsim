// Vykreslení úrovně 2 bez prohlížeče: všechny kroky × modely, štítky adres, MAC tabulka,
// rentgen (pole, hexdump, propojení čísly polí), vysvětlivka s tipem a jeho vyhodnocením, terminál.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven2-adresy.js';
import { buildLevel2 } from '../../js/scenario/level2.js';
import { stepIndex, stepLabel } from '../../js/core/timeline.js';
import { topologyHtml, nestHtml, nestCaption, explainHtml2, xrayHtml, presentTabs, summaryHtml, macHtml, termLinesHtml, tipOptions } from '../../js/ui/render2.js';
import { tipEvaluator, evalTip } from '../../js/ui/tips.js';
import { MODEL_IDS } from '../../js/ui/urlstate.js';

const { timeline } = buildLevel2(scenario);
const idx = (l) => stepIndex(timeline.steps, l);
const stepLabelOf = (k) => stepLabel(timeline.steps[k]);
const at = (l) => timeline.view(idx(l));
const pair = (v) => ({ sender: v.flow?.sender ?? 'PC1', receiver: v.flow?.receiver ?? 'PC2' });
const ui = (v, extra = {}) => ({ pair: pair(v), selected: null, predict: null, tips: new Set(), changed: new Set(), ...extra });

test('každý krok a model se vykreslí (topologie, obálky, vysvětlivka, rentgen všech záložek)', () => {
  for (let k = 0; k < timeline.length; k++) {
    const v = timeline.view(k);
    for (const m of MODEL_IDS) {
      assert.ok(topologyHtml(v, ui(v)).includes('TOPOLOGIE'));
      nestHtml(v, m, { pair: pair(v) });
      assert.match(explainHtml2(v, m, 18), /Krok \d+[abc]? z 18/);
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
  assert.match(h, /UDP datagram/, 'rozhodnutí 32');
  assert.doesNotMatch(h, /segment/);
});

test('krok 4: ARP tabulka Alice u Alice v topologii, ne pod obálkou (recenzent 2, rozhodnutí 38)', () => {
  const v = at('4');
  assert.equal(v.step.arpHint, true);
  const t = topologyHtml(v, ui(v));
  assert.match(t, /class="arpstrip"[^>]*><b>ARP:<\/b> <span class="mono">.*192\.168\.1\.<\/span><b>20<\/b> → <span class="dim">02:…:<\/span><b>02<\/b>/s);
  assert.equal((t.match(/arpstrip/g) ?? []).length, 1, 'jen u odesílatele');
  assert.doesNotMatch(nestHtml(v, 'osi', { pair: pair(v) }), /arpstrip/, 'pod obálkou by překryl pruh média');
  assert.doesNotMatch(topologyHtml(at('3'), ui(at('3'))), /arpstrip/);
});

test('topologie: MAC u každého PC, Cyril při zahození „cílová …:02 ≠ moje …:03“ (rozhodnutí 35), legenda (37)', () => {
  const t = topologyHtml(at('7'), ui(at('7')));
  assert.match(topologyHtml(at('0'), ui(at('0'))), /class="mac"><span class="dim">02:00:00:00:00:<\/span><b>03<\/b>/);
  assert.match(t, /class="dropwhy"><span>cílová <span class="dim">02:…:<\/span><b>02<\/b><\/span><span>≠ moje <span class="dim">02:…:<\/span><b>03<\/b>/);
  assert.match(t, /dvojitý obrys = odesílatel a příjemce vybrané zprávy/);
  assert.doesNotMatch(t, /výtah/);
  assert.match(topologyHtml(at('0'), ui(at('0'))), /<b>Fa0\/1<\/b>/, 'hub má porty Fa0/1 (rozhodnutí 34)');
  assert.match(at('0').step.note, /Fa0\/1 = Cisco název portu \(FastEthernet 0\/1\)/);
});

test('výtah: Cyril jako příjemce = „Rámec Alice → Bob (dostal i Cyril)“ (projektant 11)', () => {
  const v = at('7');
  assert.equal(nestCaption(v, { sender: 'PC1', receiver: 'PC3' }).left, 'Rámec Alice → Bob (dostal i Cyril)');
  assert.equal(nestCaption(v, { sender: 'PC1', receiver: 'PC2' }).left, 'Rámec Alice → Bob');
});

test('MAC tabulka: jen naučené záznamy (rozhodnutí 24), nový řádek se štítkem, flooding vs. cílené', () => {
  const t10 = topologyHtml(at('10'), ui(at('10')));
  assert.match(t10, /prázdná: switch zatím nic nezná/);
  const t11 = topologyHtml(at('11'), ui(at('11')));
  assert.match(t11, /<tr class="new"><td class="mono">.*?01<\/b><\/td><td>Fa0\/1<\/td><td class="tagc"><span class="newtag">nový<\/span>/);
  const t12 = topologyHtml(at('12'), ui(at('12')));
  assert.doesNotMatch(t12, />\?</, 'žádný řádek „?“');
  assert.match(t12, /neznámá cílová MAC → flooding/);
  assert.match(t12, /data-link="L2"[^>]*>.*rámec<\/span> ▶/);
  assert.match(t12, /data-link="L3"[^>]*>.*rámec<\/span> ▶/);
  assert.match(t12, /<small>výstup<\/small>/);
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

test('rentgen: pořadí polí jako na drátě, délka v bitech, vybrané pole v hexdumpu, switch čte pole 1 a 2', () => {
  const v = at('11');
  const x = xrayHtml(v, { tab: 'ethernet', sel: 'eth.src', tabs: presentTabs(v) });
  assert.ok(x.indexOf('Cílová MAC') < x.indexOf('Zdrojová MAC'));
  assert.equal((x.match(/class="r-l2 sel own" data-field="eth\.src"/g) || []).length, 6);
  assert.match(x, /class="key selected reads"/);
  assert.match(x, /Silná čára vlevo/);
  assert.match(x, /zdrojová MAC → naučit na port Fa0\/1/);
  assert.match(x, /OUI/);
  assert.match(x, /<th title="délka pole v bitech">bity<\/th>/, 'rozhodnutí 33');
  assert.match(x, /Zdrojová MAC<\/b>.*?<td class="num">48<\/td>/s);
  assert.match(x, /FCS je jen naznačené, nepočítá se/);
  const ip = xrayHtml(at('3'), { tab: 'ipv4', sel: 'ip.version', tabs: presentTabs(at('3')) });
  assert.match(ip, /Verze<\/b>.*?<td class="num">4<\/td>/s, 'Verze = 4 bity, ne 1 bajt');
  assert.match(ip, /17 \(UDP\)/);
  assert.match(xrayHtml(at('3'), { tab: 'ipv4', sel: 'ip.proto', tabs: presentTabs(at('3')) }), /další pole hlavičky \(11\)/);
  const u = xrayHtml(at('2'), { tab: 'udp', sel: 'udp.sport', tabs: presentTabs(at('2')) });
  assert.deepEqual(presentTabs(at('2')), ['udp']);
  assert.match(u, /49152 \(dynamický port\)/);
  assert.match(u, /Windows volí číslo náhodně z rozsahu 49152–65535/);
  assert.match(u, /Rentgen: datagram L4 \(UDP\)/);
  assert.match(u, /u TCP segment/);
  assert.match(xrayHtml(at('1'), { tab: 'ethernet', sel: null, tabs: presentTabs(at('1')) }), /Obálky zatím nejsou/);
});

test('hexdump před vznikem rámce: jen existující bajty, posun od začátku obálky (projektant 4)', () => {
  const u = xrayHtml(at('2'), { tab: 'udp', sel: null, tabs: presentTabs(at('2')) });
  // UDP datagram „Ahoj, Bobe!“ = 8 + 11 B; první řádek začíná zdrojovým portem c0 00
  assert.match(u, /<span class="off">0000<\/span><span class="r-l4 [^"]*"[^>]*>c0<\/span><span class="r-l4 [^"]*"[^>]*>00<\/span>/);
  assert.doesNotMatch(u, /r-l2|r-l3|r-pad|r-fcs/);
  const ip = xrayHtml(at('3'), { tab: 'ipv4', sel: null, tabs: presentTabs(at('3')) });
  assert.match(ip, /<span class="off">0000<\/span><span class="r-l3 [^"]*"[^>]*>45<\/span>/);
  assert.doesNotMatch(ip, /r-l2|r-pad|r-fcs/);
  const eth = xrayHtml(at('4'), { tab: 'ethernet', sel: null, tabs: presentTabs(at('4')) });
  assert.match(eth, /r-fcs/);
});

// ---- tipy (rozhodnutí 31) ----
const ev = tipEvaluator(timeline.steps);
const TIPS = ['5', '9', '11', '13', '16'];

test('každý krok tipu: nadpis „Tip:“, volby z topologie (vstupní port zamčený), nic neprozrazuje', () => {
  for (const l of TIPS) {
    const v = at(l), pred = v.step.predict;
    const e = explainHtml2(v, 'osi', 18, { predict: pred, tips: new Set() });
    assert.match(e, new RegExp(`<h3>Tip: ${pred.q.replace('?', '\\?')}</h3>`), `krok ${l}`);
    assert.doesNotMatch(e, /Předpověz|evalline/, `krok ${l}`);
    if (!pred.node) continue;
    const opts = tipOptions(v, pred);
    const t = topologyHtml(v, ui(v, { predict: pred }));
    const inPort = Object.entries(v.portState[pred.node]).find(([, s]) => s === 'in')[0];
    assert.ok(!opts.some((o) => o.port === inPort), `krok ${l}: vstupní port není volba`);
    assert.equal(opts.length, 2, `krok ${l}: dvě volby`);
    for (const o of opts) assert.match(t, new RegExp(`data-pick="${o.port}"`), `krok ${l}: port ${o.port} je volba`);
    assert.match(t, new RegExp(`class="port [^"]*in[^"]*nopick"><b>${inPort}</b><small>vstup</small>`), `krok ${l}: vstupní port zamčený`);
    // nic neprozrazuje: výstupy, přijal/zahodil, rozhodnutí, poznámka hubu
    assert.doesNotMatch(t, /výstup|pill received|pill dropped|class="decision"|Hub nečte/, `krok ${l}`);
    assert.equal((t.match(/class="ftag/g) || []).length, 1, `krok ${l}: jediný rámec, ten na vstupu zařízení`);
    const n = nestHtml(v, 'osi', { pair: pair(v) });
    assert.doesNotMatch(n, /opakuje|přijal|zahodil|dropmsg|class="same"/, `krok ${l}: výtah`);
    assert.equal(nestCaption(v, pair(v), { tip: true }).right.includes('nečte'), false, `krok ${l}: výtah nepíše, co hub nečte`);
    const x = xrayHtml(v, { tab: 'ethernet', sel: null, tabs: presentTabs(v) });
    assert.doesNotMatch(x, /flooding|→ jen tam|zahodila/, `krok ${l}: rentgen`);
  }
  assert.deepEqual(tipOptions(at('5'), at('5').step.predict).map((o) => o.label), ['Bob', 'Cyril']);
  assert.match(explainHtml2(at('16'), 'osi', 18, { predict: at('16').step.predict }), /Podívej se do MAC tabulky a tipni\./);
});

test('vyhodnocení tipu v následujícím kroku: sedí / nesedí s důvodem; tip u portů', () => {
  assert.equal(stepLabelOf(ev.evaluatorOf(idx('5'))), '6');
  assert.equal(stepLabelOf(ev.evaluatorOf(idx('11'))), '12');
  assert.equal(stepLabelOf(ev.evaluatorOf(idx('13'))), '14');
  assert.equal(stepLabelOf(ev.evaluatorOf(idx('16'))), '17');
  assert.equal(stepLabelOf(ev.evaluatorOf(idx('9'))), '12', 'Ano/Ne se vyhodnotí u floodingu');
  assert.deepEqual(ev.tipsEvaluatedAt(idx('12')).map(stepLabelOf), ['9', '11']);
  const bad = evalTip(timeline, idx('11'), idx('12'), ['Fa0/2']);
  assert.equal(bad.same, false);
  assert.equal(bad.html, '<b>Tvůj tip:</b> Fa0/2. <b>Skutečnost:</b> Fa0/2 i Fa0/3. Nesedí: Bobovu MAC switch zatím nezná, a tak rámec rozešle jako hub.');
  const ok = evalTip(timeline, idx('5'), idx('6'), ['Fa0/2', 'Fa0/3']);
  assert.equal(ok.html, '<b>Tvůj tip:</b> Bob i Cyril. <b>Skutečnost:</b> Bob i Cyril. Sedí.');
  assert.match(evalTip(timeline, idx('5'), idx('6'), ['Fa0/2']).html, /Nesedí: hub nečte adresy/);
  assert.equal(evalTip(timeline, idx('13'), idx('14'), ['Fa0/1']).same, true);
  assert.match(evalTip(timeline, idx('13'), idx('14'), ['Fa0/1', 'Fa0/3']).html, /Nesedí: Alici switch zná/);
  assert.equal(evalTip(timeline, idx('16'), idx('17'), ['Fa0/2']).same, true);
  assert.equal(evalTip(timeline, idx('9'), idx('12'), ['Ne']).html, '<b>Tvůj tip:</b> Ne. Zatím ano: switch nic nezná.');
  // krok vyhodnocení: vysvětlivka s větou, porty se štítkem „tip“ a stavem výstup
  const v = at('12');
  const e = explainHtml2(v, 'osi', 18, { evalLines: [bad.html] });
  assert.match(e, /<p class="evalline"><b>Tvůj tip:<\/b> Fa0\/2\./);
  const t = topologyHtml(v, ui(v, { tips: new Set(['Fa0/2']) }));
  assert.match(t, /class="port p-right out tip"><span class="tiptag">tip<\/span><b>Fa0\/2<\/b><small>výstup<\/small>/);
  assert.doesNotMatch(t, /data-pick/);
});

test('počet sedících tipů pro kontrolní otázky (beforeQuestions)', () => {
  // stejný výpočet jako app2.beforeQuestions: jen tipy k portům, vyhodnocené ve svém kroku
  const answers = new Map([[idx('5'), ['Fa0/2', 'Fa0/3']], [idx('9'), ['Ano']], [idx('11'), ['Fa0/2']], [idx('13'), ['Fa0/1']], [idx('16'), ['Fa0/2']]]);
  let ok = 0, n = 0;
  for (const [k, ans] of answers) {
    if (!timeline.steps[k].predict.node) continue;
    n++;
    if (evalTip(timeline, k, ev.evaluatorOf(k), ans).same) ok++;
  }
  assert.deepEqual([ok, n], [3, 4]);
});

test('shrnutí a terminál (bez zdvojené předpony „Simulátor:“)', () => {
  const s = summaryHtml('hub', at('9'));
  assert.match(s, /„Ahoj, Bobe!“<\/td><td>zdroj<\/td><td>✓ přijal<\/td><td>⊗ zahodil/);
  assert.match(s, /„Ahoj, Alice!“<\/td><td>✓ přijal<\/td><td>zdroj<\/td><td>⊗ zahodil/);
  const a = summaryHtml('addresses', at('18'));
  assert.match(a, /síťová karta, switch/);
  assert.match(a, /transportní vrstva v OS předá aplikaci/);
  assert.equal(termLinesHtml([{ kind: 'cmd', prompt: 'SW1#', text: 'sh <x>' }]), '<div class="tl"><span class="prompt">SW1#</span>sh &lt;x&gt;</div>');
  assert.equal(termLinesHtml([{ kind: 'note', text: 'Simulátor zjednodušuje: x' }]), '<div class="tl tnote">Simulátor zjednodušuje: x</div>');
  assert.equal(termLinesHtml([{ kind: 'note', text: 'Hub nemá konzoli.' }]), '<div class="tl tnote">Simulátor: Hub nemá konzoli.</div>');
});

test('studentovi se neukazuje „výtah“ ani „prostředník“ (rozhodnutí 37), UDP není segment (32)', () => {
  const texts = JSON.stringify([scenario.steps, scenario.questions]);
  assert.doesNotMatch(texts, /výtah|prostředník|UDP segment|segment \(UDP\)/i);
  assert.doesNotMatch(texts, /PC A\b/);
});
