// Sestavení úrovně 3 ze scénáře: síťová simulace s ARP, ICMP a routerem vyrobí záznam, timeline
// z něj poskládá kroky scénáře (match) a pohled netViewAt3. Bez DOM (testuje se v Node).
// whatIf: příkaz z terminálu (ping, tracert) v daném kroku = samostatná simulace ze stavu pohledu;
// scénář ani časová osa se nemění (pískoviště terminálu).
import { runNetwork } from '../core/netsim.js';
import { Timeline } from '../core/timeline.js';
import { netViewAt3 } from '../core/netview3.js';
import { appResults } from '../core/harness.js';
import { LEVELS } from '../levels.js';

export function buildLevel3(scenario) {
  const level = LEVELS[scenario.level];
  if (!level) throw new Error(`Neznámá úroveň ${scenario.level}`);
  const run = runNetwork({ topology: scenario.topology, initialState: scenario.initial_state ?? {},
    actions: scenario.actions, protocols: level.protocols });
  return { run, timeline: new Timeline(run.records, scenario.steps, netViewAt3), level };
}

/**
 * Spustí ping/tracert z uzlu `nodeId` ve stavu pohledu `view` (brány, ARP a MAC tabulky z kroku;
 * `overlay` = změny z terminálu, např. arp -d). Vrací { events, done, result, arp }: události
 * dotazů/sond (tvar jako v pohledu, pro výpis terminálu), výsledek (harness.appResults) a ARP
 * tabulky po běhu.
 */
export function whatIf(scenario, view, nodeId, command, args, overlay = {}) {
  const topology = JSON.parse(JSON.stringify(scenario.topology));
  for (const n of topology.nodes) {
    const vn = view.nodes[n.id];
    if (vn && 'gateway' in vn) { if (vn.gateway) n.gateway = vn.gateway; else delete n.gateway; }
  }
  const arp = {}, mac = {};
  for (const id of view.order) {
    const vn = view.nodes[id];
    if (vn.arp_cache) arp[id] = overlay.arp?.[id] ?? vn.arp_cache;
    if (vn.mac_table) mac[id] = vn.mac_table;
  }
  const { records, world } = runNetwork({ topology, initialState: { arp_cache: arp, mac_table: mac },
    actions: [{ time: 0, node: nodeId, command, args }], protocols: LEVELS[3].protocols });
  const tables = {};
  for (const n of Object.values(world.nodes)) if (n.state.arp_cache) tables[n.id] = n.state.arp_cache;
  const events = records.filter((r) => r.kind === 'app.event')
    .map((r) => ({ seq: r.seq, ttl: r.ttl, probe: r.probe, result: r.result }));
  return { events, done: true, result: appResults(records)[0], arp: tables, records };
}
