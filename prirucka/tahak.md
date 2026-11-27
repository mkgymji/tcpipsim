# Tahák příkazů terminálu

Příkazy, které umí terminál v simulátoru tcpipsim (https://mkgymji.github.io/tcpipsim/), po úrovních.
Tisk: A4 na výšku. Soubor se generuje z kódu (`node tools/tahak.mjs`), ručně ho neupravuj.

## Jak otevřít terminál

- Klikni na uzel (PC, switch, router, server) a stiskni **F2** nebo tlačítko **Terminál**.
- `help` nebo `?` vypíše příkazy, které terminál v dané úrovni umí.
- Odkaz rovnou na krok s otevřeným terminálem a zadaným příkazem:
  `#u=<úroveň>&k=<krok>&t=<uzel>&c=<příkaz>`, například
  https://mkgymji.github.io/tcpipsim/#u=3&k=9&t=R1&c=enable&c=show%20ip%20route
  (mezera v příkazu = `%20`, víc příkazů = víc parametrů `c`).
- Výstupy napodobují skutečný Windows (anglická verze) a Cisco IOS, zjednodušeně.
  Co simulátor zjednodušuje, vypíše pod výstupem.
- Příkazy z nižších úrovní fungují i ve vyšších.

## Úroveň 1: Obálky

Terminál v této úrovni není.

## Úroveň 2: Adresy

| Příkaz | Kde | Co ukáže | Na co se zeptat |
| --- | --- | --- | --- |
| `ipconfig` | PC (Windows) | IP adresa, maska a brána | Jakou IP adresu a masku má tohle PC? Má nastavenou bránu? |
| `ipconfig /all` | PC (Windows) | navíc MAC adresa (Physical Address) | Jakou MAC adresu má síťová karta? Ve kterém rámci ji uvidíš? |
| `arp -a` | PC (Windows) | ARP tabulka (IP -> MAC) | Proč tu MAC souseda je (nebo není)? Je tu MAC brány, nebo cílového serveru? |
| `cls` | PC (Windows) | vymazat okno |  |
| `show mac address-table` | switch (IOS) | MAC tabulka switche (MAC -> port) | Na kterém portu je Alice? Proč tu chybí MAC počítače, který ještě nic neposlal? |
| `show mac address-table dynamic` | switch (IOS) | jen naučené záznamy | Z čeho se switch záznam naučil: ze zdrojové, nebo cílové MAC? |
| `show mac address-table interface Fa0/1` | switch (IOS) | záznamy jednoho portu | Kolik MAC adres může být na jednom portu? Kdy jich je víc? |
| `show mac address-table aging-time` | switch (IOS) | doba stárnutí záznamů | Proč switch záznamy po čase zapomíná? |

## Úroveň 3: Směrování

| Příkaz | Kde | Co ukáže | Na co se zeptat |
| --- | --- | --- | --- |
| `arp -d` | PC (Windows) | smaže dynamické záznamy ARP | Co PC udělá při dalším pingu, když je ARP tabulka prázdná? |
| `ping <IP>` | PC (Windows) | ICMP Echo, 4 dotazy (-n N) | Kdo odpověděl? Co znamená Reply from a co Request timed out? |
| `tracert <IP>` | PC (Windows) | cesta skok po skoku | Kolik routerů je po cestě? Proč je na prvním řádku brána? |
| `route print` | PC (Windows) | směrovací tabulka (= netstat -nr) | Který řádek PC použije pro cíl mimo svou síť? |
| `enable` | router (IOS) | privilegovaný režim (R1#) | Čím se liší výzva R1> a R1#? |
| `show ip route` | router (IOS) | směrovací tabulka | Které sítě jsou C (přímo připojené)? Kudy půjde paket do sítě 192.168.2.0/24? |
| `show ip interface brief` | router (IOS) | rozhraní a jejich adresy | Kterou adresu má router v síti PC? Je to brána, kterou má PC v ipconfig? |
| `show ip arp` | router (IOS) | ARP tabulka routeru | Čí MAC adresy router zná a proč? |
| `ping <IP>` | router (IOS) | ping z routeru (5 dotazů) | Co znamená ! a co . ve výpisu? |
| `clear arp-cache` | router (IOS), R1# | smaže ARP tabulku routeru | Co router udělá, než pošle další paket do LAN? |
| `disable` | router (IOS), R1# | zpět do R1> |  |

## Úroveň 4: Transport a aplikace

| Příkaz | Kde | Co ukáže | Na co se zeptat |
| --- | --- | --- | --- |
| `nslookup <jméno>` | PC (Windows) | DNS dotaz (jméno -> IP) | Který server odpověděl? Jaký transportní protokol a port dotaz použil? |
| `ipconfig /displaydns` | PC (Windows) | DNS cache | Odkud se záznam vzal a jak dlouho v cache zůstane (TTL)? |
| `netstat -an` | PC (Windows) | sockety: LISTENING, ESTABLISHED, TIME_WAIT | Který socket patří klientovi a který serveru? Proč má klient vysoký port? |
| `curl -v <URL>` | PC (Windows) | HTTP požadavek a odpověď | Co poslal klient (>) a co vrátil server (<)? Jaký je stavový kód? |
| `ss -tuln` | server (Linux) | naslouchající sockety TCP a UDP | Na kterých portech server čeká? Proč u UDP není LISTEN? |
| `ss -tan` | server (Linux) | všechna spojení TCP | Kolik spojení je ESTAB a z jakého socketu klienta? |
| `clear` | server (Linux) | vymazat okno |  |

## Dál

Navazující nástroj: Cisco Packet Tracer (zdarma, netacad.com) — volné stavění sítí a konfigurace pro CCNA.
