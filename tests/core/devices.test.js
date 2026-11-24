// Switch a hub (ethernet.md kap. 3 a 4) mimo scénář: přesun stanice, filtrování, broadcast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runNetwork } from '../../js/core/netsim.js';
import { macCisco, macWindows, isGroupMac, multicastMac, broadcastOf } from '../../js/core/addr.js';

const pc = (n, extra = {}) => ({ id: `PC${n}`, type: 'pc', label: `PC${n}`,
  interfaces: [{ name: 'eth0', mac: `02:00:00:00:00:0${n}`, ip: `192.168.1.${n}0`, prefix: 24 }],
  apps: [{ name: 'a', proto: 'udp', port: 5000 }], ...extra });
const topo = (dev) => ({
  nodes: [pc(1), pc(2), pc(3), dev],
  links: [1, 2, 3].map((n) => ({ id: `L${n}`, a: { node: `PC${n}`, if: 'eth0' }, b: { node: dev.id, if: dev.ports[n - 1] } })),
});
const arp = { PC1: [{ ip: '192.168.1.20', mac: '02:00:00:00:00:02', if: 'eth0', type: 'dynamic' }],
  PC3: [{ ip: '192.168.1.20', mac: '02:00:00:00:00:02', if: 'eth0', type: 'dynamic' }] };
const send = (node, time = 0) => ({ time, node, command: 'udp_send', args: { app: 'a', dst: '192.168.1.20', dport: 5000, text: 'x' } });

test('hub opakuje na všechny ostatní porty a nic se neučí', () => {
  const { records } = runNetwork({ topology: topo({ id: 'H', type: 'hub', ports: ['P1', 'P2', 'P3'] }), initialState: { arp_cache: arp }, actions: [send('PC1')] });
  const rep = records.find((r) => r.kind === 'repeat');
  assert.deepEqual(rep.outPorts, ['P2', 'P3']);
  assert.ok(!records.some((r) => r.kind === 'mac_learn'));
  assert.ok(records.some((r) => r.kind === 'nic_drop' && r.node === 'PC3'));
});

test('switch: známý cíl na příchozím portu = filter; přesun stanice = update', () => {
  const sw = { id: 'S', type: 'switch', ports: ['Fa0/1', 'Fa0/2', 'Fa0/3'] };
  // tabulka tvrdí, že PC2 je na Fa0/1 (stejný port jako PC1) -> rámec od PC1 se zahodí
  const { records, world } = runNetwork({ topology: topo(sw), initialState: { arp_cache: arp,
    mac_table: { S: [{ mac: '02:00:00:00:00:02', port: 'Fa0/1', vlan: 1, type: 'dynamic' }] } }, actions: [send('PC1')] });
  assert.ok(records.some((r) => r.kind === 'filter'));
  assert.equal(records.filter((r) => r.kind === 'link.tx').length, 1);
  // PC2 se ozve z Fa0/2 -> záznam se přepíše
  const r2 = runNetwork({ topology: topo(sw), initialState: { arp_cache: { PC2: [{ ip: '192.168.1.10', mac: '02:00:00:00:00:01', if: 'eth0', type: 'dynamic' }] },
    mac_table: { S: [{ mac: '02:00:00:00:00:02', port: 'Fa0/3', vlan: 1, type: 'dynamic' }] } },
  actions: [{ time: 0, node: 'PC2', command: 'udp_send', args: { app: 'a', dst: '192.168.1.10', dport: 5000, text: 'y' } }] });
  const upd = r2.records.find((r) => r.kind === 'mac_learn');
  assert.equal(upd.op, 'update');
  assert.equal(upd.before.port, 'Fa0/3');
  assert.deepEqual(r2.world.nodes.S.state.mac_table.find((e) => e.mac === '02:00:00:00:00:02').port, 'Fa0/2');
  assert.ok(world);
});

test('chybí MAC v ARP tabulce: nic se neodešle (ARP až v úrovni 3)', () => {
  const { records } = runNetwork({ topology: topo({ id: 'S', type: 'switch', ports: ['Fa0/1', 'Fa0/2', 'Fa0/3'] }), actions: [send('PC2')] });
  assert.ok(records.some((r) => r.kind === 'arp_miss'));
  assert.ok(!records.some((r) => r.kind === 'link.tx'));
});

test('UDP na zavřený port: udp_no_listener, aplikace nic nedostane', () => {
  const t = topo({ id: 'S', type: 'switch', ports: ['Fa0/1', 'Fa0/2', 'Fa0/3'] });
  const { records } = runNetwork({ topology: t, initialState: { arp_cache: arp },
    actions: [{ time: 0, node: 'PC1', command: 'udp_send', args: { app: 'a', dst: '192.168.1.20', dport: 7777, text: 'z' } }] });
  assert.ok(records.some((r) => r.kind === 'udp_no_listener' && r.node === 'PC2'));
  assert.ok(!records.some((r) => r.kind === 'app.recv'));
});

test('zápisy adres: Windows, Cisco, skupinové MAC, multicast a broadcast', () => {
  assert.equal(macWindows('02:00:00:00:00:0a'), '02-00-00-00-00-0a');
  assert.equal(macWindows('02:00:00:00:00:0a', true), '02-00-00-00-00-0A');
  assert.equal(macCisco('02:00:00:00:00:01'), '0200.0000.0001');
  assert.ok(isGroupMac('ff:ff:ff:ff:ff:ff') && isGroupMac('01:00:5e:00:00:16') && !isGroupMac('02:00:00:00:00:01'));
  assert.equal(multicastMac('239.255.255.250'), '01:00:5e:7f:ff:fa');
  assert.equal(broadcastOf('192.168.1.10', 24), '192.168.1.255');
});
