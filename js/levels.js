// Profily úrovní: výchozí protokoly a co UI ukazuje (VYVOJ.md kap. 4.2).
// xray = panel vpravo je rentgen (jinak „Detail“ s popisem vrstvy), terminal = okno terminálu.
export const LEVELS = {
  1: { id: 1, title: 'Barvičky', protocols: ['ethernet', 'ipv4', 'udp'], showAddresses: false, xray: false, terminal: false },
  2: { id: 2, title: 'Adresy', protocols: ['ethernet', 'ipv4', 'udp'], showAddresses: true, xray: true, terminal: true },
  3: { id: 3, title: 'Směrování', protocols: ['ethernet', 'arp', 'ipv4', 'icmp', 'udp'], showAddresses: true, xray: true, terminal: true },
};
