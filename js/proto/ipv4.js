// IPv4 (L3): hlavička, směrovací tabulka a výběr cesty (routing.md, ipv4.md kap. 4–6).
import { networkOf, sameSubnet, ipToInt, prefixMask } from '../core/addr.js';
export default {
  id: 'ipv4',
  layer: 3,
  binds: { ethertype: 0x0800 },
  demuxField: 'protocol',
  header(ctx) {
    return { src: ctx.local.ip, dst: ctx.remote.ip, ttl: ctx.node.ttl_default ?? 128,
      protocol: ctx.upper?.binds?.protocol, id: ctx.ipId };
  },
  accept(h, ctx) {
    return h.dst === ctx.local.ip;
  },
};

// Výchozí TTL podle typu uzlu (ipv4.md kap. 3): PC (Windows) 128, server (Linux) 64, router (Cisco) 255.
export const DEFAULT_TTL = { pc: 128, server: 64, router: 255 };
export const ttlOf = (node) => node.ttl_default ?? DEFAULT_TTL[node.type] ?? 128;

// Směrovací tabulka odvozená z konfigurace (vektory.md kap. 3, routing.md kap. 2):
// hostitel = síť rozhraní (connected) + výchozí cesta přes bránu (default);
// router = connected + local (/32 adresa rozhraní, IOS 15) za každé rozhraní, statické cesty
// z `static_routes` (jen s next hopem v síti některého rozhraní, jinak cesta „čeká“ a v tabulce není).
export function deriveRoutes(node) {
  const routes = [];
  const ifs = (node.interfaces ?? []).filter((i) => i.ip);
  for (const i of ifs) {
    routes.push({ prefix: `${networkOf(i.ip, i.prefix)}/${i.prefix}`, next_hop: null, if: i.name, type: 'connected' });
    if (node.type === 'router') routes.push({ prefix: `${i.ip}/32`, next_hop: null, if: i.name, type: 'local' });
  }
  if (node.type === 'router') {
    for (const s of node.static_routes ?? []) {
      const via = ifs.find((i) => sameSubnet(s.next_hop, i.ip, i.prefix));
      if (!via) continue;
      routes.push({ prefix: s.prefix, next_hop: s.next_hop, if: via.name, type: s.prefix === '0.0.0.0/0' ? 'default' : 'static' });
    }
    return routes;
  }
  const first = (node.interfaces ?? [])[0];
  if (node.gateway && first) routes.push({ prefix: '0.0.0.0/0', next_hop: node.gateway, if: first.name, type: 'default' });
  return routes;
}

export function parsePrefix(prefix) {
  const [net, len] = String(prefix).split('/');
  return { net, len: Number(len) };
}

// Shoduje se cíl s cestou? (D AND maska == síť)
export function routeMatches(route, dst) {
  const { net, len } = parsePrefix(route.prefix);
  const m = prefixMask(len);
  return ((ipToInt(dst) & m) >>> 0) === ((ipToInt(net) & m) >>> 0);
}

// Longest prefix match (RFC 1812 5.2.4.3): z odpovídajících cest vyhraje nejdelší prefix.
// Pořadí řádků v tabulce o výsledku nerozhoduje. Vrací cestu nebo null.
export function lookupRoute(routes, dst) {
  let best = null;
  for (const r of routes ?? []) {
    if (!routeMatches(r, dst)) continue;
    if (!best || parsePrefix(r.prefix).len > parsePrefix(best.prefix).len) best = r;
  }
  return best;
}
