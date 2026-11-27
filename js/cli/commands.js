// Registr příkazů terminálu (rozh. 63): jediný zdroj pro nápovědu (help, ?) a pro tahák
// prirucka/tahak.md (tools/tahak.mjs). Test hlídá, že terminál každý příkaz opravdu přijme.
// Pole: usage = jak se píše, example = konkrétní řádek pro test, platform = win | ios | linux,
// where = PC | switch | router | server, from = od které úrovně funguje, short = co ukáže,
// ask = na co se zeptat studentů (didaktik doladí), priv = jen v R1# (privilegovaný režim).

export const COMMANDS = [
  // Windows (PC)
  { usage: 'ipconfig', platform: 'win', where: 'PC', from: 2, short: 'IP adresa, maska a brána',
    ask: 'Jakou IP adresu a masku má tohle PC? Má nastavenou bránu?' },
  { usage: 'ipconfig /all', platform: 'win', where: 'PC', from: 2, short: 'navíc MAC adresa (Physical Address)',
    ask: 'Jakou MAC adresu má síťová karta? Ve kterém rámci ji uvidíš?' },
  { usage: 'arp -a', platform: 'win', where: 'PC', from: 2, short: 'ARP tabulka (IP -> MAC)',
    ask: 'Proč tu MAC souseda je (nebo není)? Je tu MAC brány, nebo cílového serveru?' },
  { usage: 'cls', platform: 'win', where: 'PC', from: 2, short: 'vymazat okno', ask: '' },
  { usage: 'arp -d', platform: 'win', where: 'PC', from: 3, short: 'smaže dynamické záznamy ARP',
    ask: 'Co PC udělá při dalším pingu, když je ARP tabulka prázdná?' },
  { usage: 'ping <IP>', example: 'ping 192.168.2.20', platform: 'win', where: 'PC', from: 3, short: 'ICMP Echo, 4 dotazy (-n N)',
    ask: 'Kdo odpověděl? Co znamená Reply from a co Request timed out?' },
  { usage: 'tracert <IP>', example: 'tracert 192.168.2.20', platform: 'win', where: 'PC', from: 3, short: 'cesta skok po skoku',
    ask: 'Kolik routerů je po cestě? Proč je na prvním řádku brána?' },
  { usage: 'route print', platform: 'win', where: 'PC', from: 3, short: 'směrovací tabulka (= netstat -nr)',
    ask: 'Který řádek PC použije pro cíl mimo svou síť?' },
  { usage: 'nslookup <jméno>', example: 'nslookup www.skola.lan', platform: 'win', where: 'PC', from: 4, short: 'DNS dotaz (jméno -> IP)',
    ask: 'Který server odpověděl? Jaký transportní protokol a port dotaz použil?' },
  { usage: 'ipconfig /displaydns', platform: 'win', where: 'PC', from: 4, short: 'DNS cache',
    ask: 'Odkud se záznam vzal a jak dlouho v cache zůstane (TTL)?' },
  { usage: 'netstat -an', platform: 'win', where: 'PC', from: 4, short: 'sockety: LISTENING, ESTABLISHED, TIME_WAIT',
    ask: 'Který socket patří klientovi a který serveru? Proč má klient vysoký port?' },
  { usage: 'curl -v <URL>', example: 'curl -v http://www.skola.lan/', platform: 'win', where: 'PC', from: 4, short: 'HTTP požadavek a odpověď',
    ask: 'Co poslal klient (>) a co vrátil server (<)? Jaký je stavový kód?' },

  // Cisco IOS (switch)
  { usage: 'show mac address-table', platform: 'ios', where: 'switch', from: 2, short: 'MAC tabulka switche (MAC -> port)',
    ask: 'Na kterém portu je Alice? Proč tu chybí MAC počítače, který ještě nic neposlal?' },
  { usage: 'show mac address-table dynamic', platform: 'ios', where: 'switch', from: 2, short: 'jen naučené záznamy',
    ask: 'Z čeho se switch záznam naučil: ze zdrojové, nebo cílové MAC?' },
  { usage: 'show mac address-table interface Fa0/1', platform: 'ios', where: 'switch', from: 2, short: 'záznamy jednoho portu',
    ask: 'Kolik MAC adres může být na jednom portu? Kdy jich je víc?' },
  { usage: 'show mac address-table aging-time', platform: 'ios', where: 'switch', from: 2, short: 'doba stárnutí záznamů',
    ask: 'Proč switch záznamy po čase zapomíná?' },

  // Cisco IOS (router)
  { usage: 'enable', platform: 'ios', where: 'router', from: 3, short: 'privilegovaný režim (R1#)',
    ask: 'Čím se liší výzva R1> a R1#?' },
  { usage: 'show ip route', platform: 'ios', where: 'router', from: 3, short: 'směrovací tabulka',
    ask: 'Které sítě jsou C (přímo připojené)? Kudy půjde paket do sítě 192.168.2.0/24?' },
  { usage: 'show ip interface brief', platform: 'ios', where: 'router', from: 3, short: 'rozhraní a jejich adresy',
    ask: 'Kterou adresu má router v síti PC? Je to brána, kterou má PC v ipconfig?' },
  { usage: 'show ip arp', platform: 'ios', where: 'router', from: 3, short: 'ARP tabulka routeru',
    ask: 'Čí MAC adresy router zná a proč?' },
  { usage: 'ping <IP>', example: 'ping 192.168.1.10', platform: 'ios', where: 'router', from: 3, short: 'ping z routeru (5 dotazů)',
    ask: 'Co znamená ! a co . ve výpisu?' },
  { usage: 'clear arp-cache', platform: 'ios', where: 'router', from: 3, priv: true, short: 'smaže ARP tabulku routeru',
    ask: 'Co router udělá, než pošle další paket do LAN?' },
  { usage: 'disable', platform: 'ios', where: 'router', from: 3, priv: true, short: 'zpět do R1>', ask: '' },

  // Linux (server)
  { usage: 'ss -tuln', platform: 'linux', where: 'server', from: 4, short: 'naslouchající sockety TCP a UDP',
    ask: 'Na kterých portech server čeká? Proč u UDP není LISTEN?' },
  { usage: 'ss -tan', platform: 'linux', where: 'server', from: 4, short: 'všechna spojení TCP',
    ask: 'Kolik spojení je ESTAB a z jakého socketu klienta?' },
  { usage: 'ip a', platform: 'linux', where: 'server', from: 4, short: 'IP adresa a MAC rozhraní eth0 (Linuxové „ipconfig“)',
    ask: 'Kde ve výpisu je MAC a kde IP adresa? Která vrstva je která?' },
  { usage: 'ip r', platform: 'linux', where: 'server', from: 4, short: 'směrovací tabulka: výchozí brána a místní síť',
    ask: 'Kam server pošle odpověď Alici z jiné sítě?' },
  { usage: 'ip n', platform: 'linux', where: 'server', from: 4, short: 'ARP tabulka Linuxu (místo staršího arp)',
    ask: 'Proč server zná MAC routeru, ale ne MAC Alice?' },
  { usage: 'clear', platform: 'linux', where: 'server', from: 4, short: 'vymazat okno', ask: '' },
  // modelové situace (Úlohy, rozh. 66–69): zásah do služby jen v úlohách, v úrovni 4 jen výpis
  { usage: 'systemctl status nginx', platform: 'linux', where: 'server', from: 4, tasks: true, short: 'běží webová služba? (active / inactive)',
    ask: 'Proč ping na server projde, i když web neběží?' },
  { usage: 'sudo systemctl start nginx', platform: 'linux', where: 'server', from: 4, tasks: true, short: 'spustí webovou službu (také stop, restart)',
    ask: 'Co se po spuštění objeví ve výpisu ss -tuln?' },
];

// Příkazy pro uzel `where` dostupné na úrovni `level`.
export function commandsFor(where, level = Infinity) {
  return COMMANDS.filter((c) => c.where === where && c.from <= level);
}

// Řádky nápovědy terminálu ve stylu dialektu (Windows a Linux bez odsazení, IOS se dvěma mezerami).
export function helpLines(where, level = Infinity) {
  const list = commandsFor(where, level);
  const w = Math.max(...list.map((c) => c.usage.length)) + 2;
  const row = (c) => `${c.usage.padEnd(w)}${c.short}${c.priv ? ' (R1#)' : ''}`;
  if (where === 'PC') return ['', ...list.map(row), ''];
  if (where === 'server') return list.map(row);
  return list.map((c) => `  ${row(c)}`);
}
