// Ethernet II (L2). Úroveň 1 potřebuje jen zapouzdření a příjem; ARP přijde v úrovni 2.
export default {
  id: 'ethernet',
  layer: 2,
  trailer: 'FCS',            // rámec má i patičku (konec rámce), rozhodnuti.md bod 2
  binds: null,               // nejnižší modul, nic pod ním nedemultiplexuje
  demuxField: 'ethertype',   // podle tohoto pole hlavičky se hledá modul nad ním
  header(ctx) {
    return { dst: ctx.remote.mac, src: ctx.local.mac, ethertype: ctx.upper?.binds?.ethertype };
  },
  // Přijme rámec jen s vlastní (nebo broadcast) cílovou MAC.
  accept(h, ctx) {
    return h.dst === ctx.local.mac || h.dst === 'ff:ff:ff:ff:ff:ff';
  },
};
