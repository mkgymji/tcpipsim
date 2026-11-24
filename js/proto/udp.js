// UDP (L4). Na úrovni 1 nese zprávu Alice -> Bob; porty se v UI neukazují.
export default {
  id: 'udp',
  layer: 4,
  binds: { protocol: 17 },
  demuxField: null,          // nad UDP je aplikace (rozhoduje cílový port v accept)
  header(ctx) {
    return { sport: ctx.sport, dport: ctx.dport };
  },
  accept(h, ctx) {
    return h.dport === ctx.listenPort;
  },
};
