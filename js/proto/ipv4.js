// IPv4 (L3), jen přímé doručení ve stejné síti (směrování v úrovni 3).
import { networkOf } from '../core/addr.js';
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

// Směrovací tabulka hostitele odvozená z konfigurace (vektory.md kap. 3): síť každého
// rozhraní (connected) a výchozí cesta přes bránu (default).
export function deriveRoutes(node) {
  const routes = [];
  for (const i of node.interfaces ?? []) {
    if (!i.ip) continue;
    routes.push({ prefix: `${networkOf(i.ip, i.prefix)}/${i.prefix}`, next_hop: null, if: i.name, type: 'connected' });
  }
  const first = (node.interfaces ?? [])[0];
  if (node.gateway && first) routes.push({ prefix: '0.0.0.0/0', next_hop: node.gateway, if: first.name, type: 'default' });
  return routes;
}
