// Sestavení úrovně 4 ze scénáře: simulace s TCP, DNS a HTTP (core/transport.js), timeline a pohled
// netViewAt3 (rozšířený o spojení, DNS a HTTP). Bez DOM (testuje se v Node).
// whatIf4: příkaz z terminálu (ping, nslookup, curl) ve stavu kroku = samostatná simulace (pískoviště).
import { runNetwork } from '../core/netsim.js';
import { Timeline } from '../core/timeline.js';
import { netViewAt3 } from '../core/netview3.js';
import { appResults } from '../core/harness.js';
import { LEVELS } from '../levels.js';

export function buildLevel4(scenario) {
  const level = LEVELS[scenario.level];
  if (!level) throw new Error(`Neznámá úroveň ${scenario.level}`);
  const run = runNetwork({ topology: scenario.topology, initialState: scenario.initial_state ?? {},
    actions: scenario.actions, protocols: level.protocols, seed: scenario.seed ?? 1 });
  return { run, timeline: new Timeline(run.records, scenario.steps, netViewAt3), level };
}

/**
 * Spustí příkaz `command` (ping, nslookup, http_get) z uzlu `nodeId` ve stavu pohledu `view`
 * (ARP a MAC tabulky, naslouchající sockety a DNS cache z kroku). Vrací { records, result, apps }.
 */
export function whatIf4(scenario, view, nodeId, command, args) {
  const arp = {}, mac = {}, tcp = {}, dns = {};
  for (const id of view.order) {
    const vn = view.nodes[id];
    if (vn.arp_cache) arp[id] = vn.arp_cache;
    if (vn.mac_table) mac[id] = vn.mac_table;
    // spojení z kroku: naslouchající sockety a obsazené porty (nová spojení dostanou další port)
    if (vn.tcp_connections) tcp[id] = vn.tcp_connections.filter((c) => c.state === 'LISTEN' || c.state === 'TIME-WAIT' || c.state === 'ESTABLISHED');
    if (vn.dns_cache) dns[id] = vn.dns_cache;
  }
  const { records } = runNetwork({ topology: scenario.topology,
    initialState: { arp_cache: arp, mac_table: mac, tcp_connections: tcp, dns_cache: dns },
    actions: [{ time: 0, node: nodeId, command, args }], protocols: LEVELS[4].protocols, seed: scenario.seed ?? 1 });
  return { records, result: appResults(records).find((a) => a.node === nodeId) ?? null,
    apps: records.filter((r) => r.kind === 'app.result') };
}

/** Jméno -> IP resolverem uzlu ve stavu kroku (ping/tracert jménem z terminálu). Vrací IP nebo null. */
export function resolve4(scenario, view, nodeId, name) {
  const r = whatIf4(scenario, view, nodeId, 'dns_resolve', { name });
  const res = r.apps.find((x) => x.command === 'dns_resolve')?.result;
  return res?.kind === 'answer' ? res.answers?.find((a) => a.type === 'A')?.data ?? null : null;
}
