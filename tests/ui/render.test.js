// Logika UI bez prohlížeče: texty panelu Detail a vysvětlivky pro všechny kombinace
// id × model, texty podle režimu, adresa stránky (#k=8b&m=tcpip). Render funkce vracejí
// HTML jako text, DOM se nahrazuje prostým objektem s innerHTML/textContent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import scenario from '../../scenarios/uroven1-zapouzdreni.js';
import { buildLevel1 } from '../../js/scenario/level1.js';
import { stepLabel, textFor } from '../../js/core/timeline.js';
import { MODELS, convertRowId } from '../../js/core/layers.js';
import { infoHtml, layerInfo, envInfo, explainHtml, stepTitle, renderNest, renderStack }
  from '../../js/ui/render.js';
import { parseHash, formatHash } from '../../js/ui/urlstate.js';

const { timeline } = buildLevel1(scenario);
const MODEL_IDS = ['osi', 'tcpip'];
const ALL_IDS = MODEL_IDS.flatMap((m) => MODELS[m].rows.map((r) => r.id));
const ENVS = ['data', 'udp', 'ipv4', 'ethernet', 'bits'];
const total = 10;
const fake = () => ({ innerHTML: '', textContent: '' });
const strip = (html) => html.replace(/<[^>]+>/g, ' ');

test('layerInfo: každé id × model; cizí id dá prázdný text, ne výjimku', () => {
  for (const m of MODEL_IDS) {
    for (const id of ALL_IDS) {
      const own = MODELS[m].rows.find((r) => r.id === id);
      const html = layerInfo(m, id);
      if (own) assert.match(html, new RegExp(`Co dělá ${own.badge}, `), `${m}:${id}`);
      else assert.equal(html, '', `${m}:${id} patří jinému modelu`);
    }
  }
  assert.equal(layerInfo('osi', 'neexistuje'), '');
});

test('přepnutí modelu se zobrazenou vrstvou (kritický nález 1): převedené id se vykreslí', () => {
  for (const from of MODEL_IDS) {
    const to = from === 'osi' ? 'tcpip' : 'osi';
    for (const r of MODELS[from].rows) {
      const id = convertRowId(from, to, r.id);
      for (let k = 0; k < timeline.length; k++) {
        const { html, empty } = infoHtml(to, { layer: id }, timeline.view(k));
        assert.ok(!empty && html.includes('Co dělá'), `${from}:${r.id} -> ${to}:${id}, krok ${k}`);
      }
    }
  }
});

test('infoHtml: každá obálka, kabel i prázdný stav v každém kroku a modelu', () => {
  for (const m of MODEL_IDS) {
    for (let k = 0; k < timeline.length; k++) {
      const view = timeline.view(k);
      for (const env of ENVS) assert.ok(!infoHtml(m, { env }, view).empty, `${m} ${env} krok ${k}`);
      assert.match(infoHtml(m, 'wire', view).html, /Kabel/);
      const none = infoHtml(m, null, view);
      assert.equal(none.empty, !view.step.showMapping, `krok ${k}`);
    }
  }
  assert.match(infoHtml('osi', null, timeline.view(12), { mapOpen: false }).html, /<details data-map>/);
});

test('texty podle režimu: v TCP/IP ne „linková“, v ISO/OSI ne „síťového rozhraní“', () => {
  for (let k = 0; k < timeline.length; k++) {
    const view = timeline.view(k);
    // výjimka: věta, která termín „vrstva síťového rozhraní“ zavádí (TCP/IP název pro L2 + L1)
    const tcp = strip(explainHtml(view, 'tcpip', total)).replace(/[^.]*je název TCP\/IP pro[^.]*\./, '');
    const osi = strip(explainHtml(view, 'osi', total));
    assert.doesNotMatch(tcp, /linkov/i, `TCP/IP krok ${stepLabel(view.step)}`);
    assert.doesNotMatch(osi, /síťového rozhraní/i, `ISO/OSI krok ${stepLabel(view.step)}`);
    assert.doesNotMatch(tcp + osi, /undefined|\[object/);
  }
  assert.doesNotMatch(strip(envInfo('tcpip', 'ethernet')), /linkov/i);
  assert.match(strip(envInfo('osi', 'ethernet')), /linkové vrstvy/);
  assert.equal(stepTitle(timeline.steps[4], 'osi'), 'Obálka linkové vrstvy');
  assert.equal(stepTitle(timeline.steps[4], 'tcpip'), 'Obálka vrstvy síťového rozhraní');
});

test('studentské texty bez nevysvětlených zkratek a bez miskoncepce „obálky se neposílají“', () => {
  const texts = timeline.steps.flatMap((s) => MODEL_IDS.flatMap((m) =>
    [s.title, s.text, s.note, s.hint, s.simplifies].map((v) => textFor(v, m))));
  texts.push(...scenario.questions.flatMap((q) => [q.text, q.answer]));
  for (const m of MODEL_IDS) for (const e of ENVS) texts.push(strip(envInfo(m, e)));
  const all = texts.join('\n');
  for (const abbr of ['FCS', 'SFD', 'TLS', 'PDU']) assert.doesNotMatch(all, new RegExp(`\\b${abbr}\\b`), abbr);
  assert.doesNotMatch(all, /obálky se neposílají|neposílají obálky|žádné obálky/i);
  const step5 = textFor(timeline.steps[5].text, 'osi');
  assert.match(step5, /celý rámec/);
  // věta o čtení obálek jen jednou (v 8a), ne ve všech podkrocích
  const rule = /čte jen stejná vrstva/;
  assert.deepEqual(timeline.steps.filter((s) => rule.test(textFor(s.text, 'osi'))).map(stepLabel), ['8a']);
});

test('pohled nezávisí na modelu: stejné obálky a stejné aktivní vrstvy v obou režimech', () => {
  for (let k = 0; k < timeline.length; k++) {
    const view = timeline.view(k);
    const envs = {}, active = {};
    for (const m of MODEL_IDS) {
      const nest = fake();
      renderNest(nest, fake(), view, m, scenario, false);
      envs[m] = [...nest.innerHTML.matchAll(/class="(?:box|data|bits)[^"]*" data-env="(\w+)"/g)].map((x) => x[1]);
      const stack = fake();
      renderStack(stack, view.nodes[view.sender], m);
      // aktivní řádek převedený na vrstvy ISO/OSI
      active[m] = [...stack.innerHTML.matchAll(/class="row active[^"]*" data-layer="(\w+)"/g)]
        .flatMap((x) => MODELS[m].rows.find((r) => r.id === x[1]).members);
    }
    assert.deepEqual(envs.osi, envs.tcpip, `obálky v kroku ${k}`);
    assert.equal(active.osi.length > 0, active.tcpip.length > 0, `aktivní řádek v kroku ${k}`);
    assert.ok(active.osi.every((n) => active.tcpip.includes(n)), `aktivní vrstva v kroku ${k}`);
  }
});

test('obálky: jediné tlačítko je štítek, žádná vnořená tlačítka ani role=button', () => {
  const nest = fake();
  renderNest(nest, fake(), timeline.view(4), 'osi', scenario, false);
  assert.doesNotMatch(nest.innerHTML, /role="button"/);
  assert.equal((nest.innerHTML.match(/<button/g) || []).length, 4);   // L2, L3, L4, data
  assert.match(nest.innerHTML, /<button type="button" class="lab" data-env="ethernet" aria-label="Obálka L2 Linková, rámec/);
});

test('průchod L7 -> L6 -> L5 se v ISO/OSI zvýrazní, v TCP/IP ne', () => {
  const view = timeline.view(2);
  const osi = fake(), tcp = fake();
  renderStack(osi, view.nodes[view.sender], 'osi', [6, 5]);
  renderStack(tcp, view.nodes[view.sender], 'tcpip', [6, 5]);
  assert.equal((osi.innerHTML.match(/anim-pass/g) || []).length, 2);
  assert.doesNotMatch(tcp.innerHTML, /anim-pass/);
});

test('adresa stránky: #k=8b&m=tcpip tam i zpět pro všechny kroky a modely', () => {
  for (let k = 0; k < timeline.length; k++) {
    for (const m of MODEL_IDS) {
      const h = parseHash(formatHash(timeline.steps[k], m), timeline.steps);
      assert.deepEqual([h.k, h.model], [k, m]);
    }
  }
  assert.equal(formatHash(timeline.steps[9], 'tcpip'), '#k=8b&m=tcpip');
  assert.equal(parseHash('#k=8', timeline.steps).k, 8);            // 8 = 8a
  assert.equal(parseHash('#k=10&m=osi', timeline.steps).k, 12);
  const core = ({ level, k, model, anim, questions }) => ({ level, k, model, anim, questions });
  assert.deepEqual(core(parseHash('#k=99&m=xyz', timeline.steps)), { level: 1, k: null, model: null, anim: false, questions: false });
  assert.deepEqual(core(parseHash('', timeline.steps)), { level: 1, k: null, model: null, anim: false, questions: false });
  assert.equal(parseHash('#u=2&k=3', timeline.steps).level, 2);
  assert.equal(parseHash('#u=7', timeline.steps).level, 1);                 // neznámá úroveň -> 1
  assert.equal(formatHash(timeline.steps[9], 'osi', 2), '#u=2&k=8b&m=osi');
  assert.equal(parseHash('#k=4&anim&q=1', timeline.steps).questions, true);
});

test('rozhodnutí 49: texty vrstev podle prezentace, firmware síťového rozhraní, PDU v detailu', async () => {
  const { layerInfo } = await import('../../js/ui/render.js');
  const { MODELS } = await import('../../js/core/layers.js');
  const l1 = layerInfo('osi', 'L1');
  assert.match(l1, /firmware síťového rozhraní/);
  assert.match(l1, /L1 je z velké části hardware síťové karty/);
  assert.match(layerInfo('osi', 'L4'), /\(TCP; UDP ne\)[\s\S]*multiplex \/ demultiplex[\s\S]*UDP datagram \(RFC 768\), u TCP segment/);
  assert.match(layerInfo('tcpip', 'internet'), /síťový paket \(IP datagram\)/);
  assert.match(layerInfo('osi', 'L2'), /linkový rámec/);
  assert.equal(MODELS.osi.rows.find((r) => r.id === 'L4').pdu, 'segment');
  assert.equal(MODELS.osi.rows.find((r) => r.id === 'L2').whoShort, 'firmware síť. rozhraní');
  assert.doesNotMatch(JSON.stringify(MODELS), /hardware a firmware/);
});
