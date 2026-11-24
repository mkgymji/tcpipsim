// IPv4 (L3), jen přímé doručení ve stejné síti (směrování v úrovni 3).
export default {
  id: 'ipv4',
  layer: 3,
  header(ctx) {
    return { src: ctx.local.ip, dst: ctx.remote.ip, ttl: ctx.node.ttl_default ?? 128,
      protocol: 17, id: ctx.ipId };
  },
  accept(h, ctx) {
    return h.dst === ctx.local.ip;
  },
};
