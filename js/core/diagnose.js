// Vyhodnocovač modelových situací (docs/spec/ulohy.md kap. 1.2): z efektivní topologie a záznamu
// běhu cíle (curl, ping) určí první selhání na cestě k cíli, postupně zdola nahoru. Neprozrazuje
// opravu, jen místo a vrstvu. Simulátor zjednodušuje: skutečný počítač nic jako „první vrstvu,
// která selhala“ neřekne; je to pomůcka učitele. Bez DOM.
import { sameSubnet } from './addr.js';
import { l2Peers } from './hostcfg.js';
import { isHost } from '../devices/types.js';

export const REASON_LAYER = {
  link_down: 'L1', no_address: 'L3', mask_wrong: 'L3', no_route: 'L3', arp_failed: 'L2/L3', ip_conflict: 'L2/L3',
  arp_stale: 'L2/L3', wrong_next_hop: 'L3', no_dns_server: 'L7', dns_failed: 'L7', connection_refused: 'L4',
  timeout: '?', http_error: 'L7', ok: '',
};

const nodeOf = (topo, id) => topo.nodes.find((n) => n.id === id);
const ownerOfMac = (topo, mac) => topo.nodes.find((n) => (n.interfaces ?? []).some((i) => i.mac?.toLowerCase() === String(mac).toLowerCase()));
const ownersOfIp = (topo, ip) => topo.nodes.filter((n) => (n.interfaces ?? []).some((i) => i.ip === ip));

/**
 * @param {object} p
 * @param {object} p.topo     efektivní topologie (hostcfg.effectiveTopology)
 * @param {string} p.source   uzel, ze kterého cíl běží (Alice)
 * @param {object[]} p.records záznam běhu cíle
 * @param {object} p.result   výsledek aplikace (harness.appResults) cíle
 * @param {object} p.goal     { command: 'http_get' | 'ping', status?, replies_min? }
 * @returns {{ reason, layer, node?, detail }}
 */
export function diagnose({ topo, source, records, result, goal }) {
  const out = (reason, node, detail = {}) => ({ reason, layer: REASON_LAYER[reason], node, detail });
  const src = nodeOf(topo, source);
  const sif = src.interfaces[0];
  // 1. L1: kabel u zdroje
  const myLink = topo.links.find((l) => [l.a, l.b].some((e) => e.node === source && e.if === sif.name));
  if (!myLink || myLink.connected === false) return out('link_down', source, { link: myLink?.id ?? null, end: 'source' });
  // 2. L3 konfigurace: APIPA (bez DHCP) nebo adresa v konfliktu (Duplicate)
  const st = src.addr_state ?? {};
  if (st.apipa) return out('no_address', source, { ip: sif.ip, dhcp: Boolean(st.dhcp), duplicate: st.duplicate ?? null, conflictWith: st.conflictWith ?? null });
  // 3. maska neodpovídá síti brány (proxy ARP se nemodeluje, rozh. 41 a 69): bez simulace
  const routerIf = l2Peers(topo, source, sif.name).map((p) => ({ n: nodeOf(topo, p.node), if: p.if }))
    .filter((x) => x.n?.type === 'router').map((x) => x.n.interfaces.find((i) => i.name === x.if))[0];
  if (routerIf && sameSubnet(sif.ip, routerIf.ip, routerIf.prefix) && sif.prefix !== routerIf.prefix) {
    return out('mask_wrong', source, { prefix: sif.prefix, expected: routerIf.prefix });
  }
  // vrstvy pod aplikační mají přednost: vytažený kabel u routeru, serveru nebo cílového uzlu (L1)
  function downOnPath(serverIp) {
    const key = new Set(['R1', 'SRV1', ...ownersOfIp(topo, serverIp ?? '').map((n) => n.id)]);
    const l = topo.links.find((x) => x.connected === false && [x.a, x.b].some((e) => key.has(e.node)));
    if (!l) return null;
    const end = [l.a, l.b].find((e) => key.has(e.node));
    return out('link_down', end.node, { link: l.id, end: 'path' });
  }
  const gwOutside = Boolean(src.gateway) && !sameSubnet(src.gateway, sif.ip, sif.prefix);
  // 4. záznam v čase: první selhání, které se týká zdroje
  for (const r of records) {
    if (r.kind === 'ip_drop' && r.node === source && (r.reason === 'no_route' || r.reason === 'link_down')) {
      return out(r.reason === 'link_down' ? 'link_down' : 'no_route', source, { dst: r.pdu?.h?.dst, gateway: src.gateway ?? null });
    }
    if (r.kind === 'arp_fail' && r.node === source) {
      const owners = ownersOfIp(topo, r.ip);
      const ownerDown = owners.find((o) => topo.links.some((l) => l.connected === false && [l.a, l.b].some((e) => e.node === o.id)));
      const res = out('arp_failed', source, { ip: r.ip, gatewayOutside: gwOutside, ipOutside: routerIf ? !sameSubnet(sif.ip, routerIf.ip, routerIf.prefix) : false,
        nobody: owners.length === 0, ownerDown: ownerDown?.id ?? null, isGateway: r.ip === src.gateway });
      // příčina pod ARP: adresa mimo síť (L3), kabel k next hopu (L1)
      if (res.detail.gatewayOutside || res.detail.ipOutside) res.layer = 'L3';
      else if (res.detail.ownerDown) res.layer = 'L1';
      return res;
    }
    if (r.kind === 'arp_learn' && r.node === source && r.op === 'update' && r.before && r.before.mac !== r.entry.mac) {
      return out('ip_conflict', source, { ip: r.entry.ip, macs: [r.before.mac, r.entry.mac],
        nodes: [ownerOfMac(topo, r.before.mac)?.id, ownerOfMac(topo, r.entry.mac)?.id] });
    }
    if (r.kind === 'encap' && r.node === source && r.layer === 2 && r.arp) {
      // next hop, kterého IP má v síti víc zařízení (konflikt, i když ARP cache už je „ustálená“)
      const peers = new Set(l2Peers(topo, source, sif.name).map((p) => p.node));
      const same = ownersOfIp(topo, r.arp.ip).filter((n) => peers.has(n.id));
      if (same.length > 1) {
        return out('ip_conflict', source, { ip: r.arp.ip, macs: [r.arp.mac], nodes: same.map((n) => n.id), used: ownerOfMac(topo, r.arp.mac)?.id ?? null });
      }
      const owner = ownerOfMac(topo, r.arp.mac);
      // zastaralý záznam: MAC patří někomu, kdo tu IP nemá, nebo kdo už není v síti (odpojený kabel)
      const gone = owner && !peers.has(owner.id);
      if (owner && (gone || !(owner.interfaces ?? []).some((i) => i.ip === r.arp.ip))) {
        return out('arp_stale', source, { ip: r.arp.ip, mac: r.arp.mac, owner: owner.id, unreachable: gone, real: ownersOfIp(topo, r.arp.ip).map((n) => n.id) });
      }
    }
    if (r.kind === 'ip_drop' && r.node !== source && isHost(nodeOf(topo, r.node)?.type) && r.pdu?.h?.src === sif.ip && !r.reason) {
      return out('wrong_next_hop', r.node, { dst: r.pdu.h.dst });
    }
    if (r.kind === 'app.result' && r.node === source && r.command === 'dns_resolve') {
      const d = r.result;
      if (d.kind === 'no_server') return out('no_dns_server', source, {});
      if (d.kind === 'timeout' && downOnPath(d.server)) return downOnPath(d.server);
      if (d.kind === 'timeout') return out('dns_failed', source, { server: d.server, owner: ownersOfIp(topo, d.server)[0]?.id ?? null });
      if (d.rcode) return out('dns_failed', source, { server: d.server, rcode: d.rcode });
    }
  }
  // 5. výsledek aplikace
  if (goal.command === 'ping') {
    const n = result?.received ?? 0;
    if (n >= (goal.replies_min ?? 1)) return out('ok', source, { received: n });
    return downOnPath(null) ?? out('timeout', source, { received: n });
  }
  if (result?.kind === 'response') {
    if (result.status === (goal.status ?? 200)) return out('ok', source, { status: result.status });
    return out('http_error', source, { status: result.status });
  }
  if (result?.kind === 'refused') return out('connection_refused', source, { remote: result.remote });
  return downOnPath(null) ?? out('timeout', source, { kind: result?.kind ?? null });
}
