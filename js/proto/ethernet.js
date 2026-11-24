// Ethernet II (L2). Úroveň 1 potřebuje jen zapouzdření a příjem; ARP přijde v úrovni 2.
export default {
  id: 'ethernet',
  layer: 2,
  trailer: 'FCS',            // rámec má i patičku (konec rámce), rozhodnuti.md bod 2
  header(ctx) {
    return { dst: ctx.remote.mac, src: ctx.local.mac, ethertype: 0x0800 };
  },
  // Přijme rámec jen s vlastní (nebo broadcast) cílovou MAC.
  accept(h, ctx) {
    return h.dst === ctx.local.mac || h.dst === 'ff:ff:ff:ff:ff:ff';
  },
};
