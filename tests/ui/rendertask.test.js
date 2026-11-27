// Vykreslení modelových situací (js/ui/rendertask.js): kabely, nápovědy, výsledek, dialog IPv4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import base from '../../scenarios/uroven4-transport.js';
import { TASKS } from '../../scenarios/ulohy.js';
import { createTask, evaluate, effTopo } from '../../js/scenario/task.js';
import { md, taskTopologyHtml, hintsHtml, taskCardHtml, resultHtml, ipv4DialogHtml, framesHtml, frameSummary } from '../../js/ui/rendertask.js';
import { parseTaskHash, formatTaskHash } from '../../js/ui/urlstate.js';

test('md: tučně a kód, zbytek escapovaný', () => {
  assert.equal(md('**IP** a `ping` <b>'), '<b>IP</b> a <code>ping</code> &lt;b&gt;');
});

test('topologie úlohy 1: vytažený kabel L1 je tlačítko „vytažený“, Alice bez IP v plánu', () => {
  const topo = effTopo(createTask(TASKS[1], base));
  const html = taskTopologyHtml({ nodes: topo.nodes.map((n) => ({ ...n, ip: n.interfaces?.[0]?.ip })), links: topo.links.map((l) => ({ ...l, connected: l.connected !== false })), selected: 'PC1',
    actions: { PC1: [{ act: 'ipv4', text: 'Vlastnosti IPv4' }] } });
  assert.match(html, /data-cable="L1"[^>]*>|class="tcable off" data-cable="L1"/);
  assert.match(html, /tcable off" data-cable="L1"/);
  assert.match(html, /data-act="ipv4"/);
  assert.doesNotMatch(html, /192\.168\.1\.10/);
});

test('nápovědy: další je zamčená, dokud se neotevře předchozí', () => {
  const h = hintsHtml(['a', 'b', 'c'], 1);
  assert.match(h, /thint open/);
  assert.match(h, /data-hint="1"(?![^>]*disabled)/);
  assert.match(h, /data-hint="2" disabled/);
});

test('karta a výsledek: Zkontrolovat, Obnovit, vrstva a kontrolní seznam u úlohy 13', () => {
  const t = createTask(TASKS[13], base, { seed: 1 });
  const card = taskCardHtml(TASKS[13], { seed: 1, result: evaluate(t) });
  assert.match(card, /id="t-check"/);
  assert.match(card, /id="t-reset"/);
  assert.match(card, /id="t-layer"/);
  assert.match(card, /tres fail/);
  const ok = resultHtml(TASKS[13], { status: 'ok', lines: ['x'], checks: [], hints: 2 });
  assert.match(ok, /od L1 nahoru/);
  assert.match(ok, /2 nápovědy/);
});

test('dialog IPv4: pole Windows a stav DHCP', () => {
  const html = ipv4DialogHtml('Alice', { mode: 'dhcp', dns: [] });
  for (const id of ['f-ip', 'f-mask', 'f-gw', 'f-dns1', 'f-dns2']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /value="dhcp" checked/);
});

test('rámce: souhrn ARP a prázdný stav', () => {
  assert.match(framesHtml(null, null), /Spusť příkaz/);
  assert.equal(frameSummary({ proto: 'ethernet', h: {}, payload: { proto: 'arp', h: { op: 1, tpa: '192.168.1.1' } } }), 'ARP: kdo má 192.168.1.1?');
});

test('adresa úlohy #uloha=N&seed=S', () => {
  assert.deepEqual(parseTaskHash('#uloha=13&seed=7'), { id: 13, seed: 7 });
  assert.equal(parseTaskHash('#u=4&k=3'), null);
  assert.equal(formatTaskHash(4), '#uloha=4');
});
