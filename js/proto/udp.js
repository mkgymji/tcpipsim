// UDP (L4). Na úrovni 1 nese zprávu Alice -> Bob; porty se v UI neukazují.
export default {
  id: 'udp',
  layer: 4,
  header(ctx) {
    return { sport: ctx.sport, dport: ctx.dport };
  },
  accept(h, ctx) {
    return h.dport === ctx.listenPort;
  },
};
