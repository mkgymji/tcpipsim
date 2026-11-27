# Tahák příkazů terminálu

Příkazy, které umí terminál v simulátoru tcpipsim (https://mkgymji.github.io/tcpipsim/), po úrovních.
Tisk: A4 na výšku. Soubor se generuje z kódu (`node tools/tahak.mjs`), ručně ho neupravuj.

## Jak otevřít terminál

- Klikni na uzel (PC, switch, router, server) a stiskni **F2** nebo tlačítko **Terminál**.
- Nápověda: `help` nebo `?` (Windows), `?` (IOS), `help` (Linux) vypíše příkazy, které terminál v dané úrovni umí.
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
| `systemctl status nginx` | server (Linux), úlohy | běží webová služba? (active / inactive) | Proč ping na server projde, i když web neběží? |
| `sudo systemctl start nginx` | server (Linux), úlohy | spustí webovou službu (také stop, restart) | Co se po spuštění objeví ve výpisu ss -tuln? |

## Modelové situace (úlohy)

Student sám nastaví počítač nebo najde a opraví chybu v hotové síti úrovně 4; simulátor vyhodnotí
„funguje / nefunguje a proč“. Příkazy označené „úlohy“ mění stav jen v úlohách.
Pořadí pro hodinu: 4, 1, 5, 7, 10; doma 11, 3, 13. U úlohy 13 dá `&seed=N` každému stejnou (nebo jinou) chybu.

| Úloha | Odkaz | Co trénuje |
| --- | --- | --- |
| 4 Nastav Alici | https://mkgymji.github.io/tcpipsim/#uloha=4 | IP, maska, brána a DNS: každý údaj má svou roli (L3, L7) |
| 1 Odpojený kabel | https://mkgymji.github.io/tcpipsim/#uloha=1 | začni zdola: Media disconnected (L1) |
| 5 Chybějící brána | https://mkgymji.github.io/tcpipsim/#uloha=5 | „u nás“ × „jinam“: bez brány jen místní síť (L3) |
| 7 IP mimo síť (překlep) | https://mkgymji.github.io/tcpipsim/#uloha=7 | IP čti vždy s maskou: jedna číslice a brána je „cizí“ (L3) |
| 10 Web neodpovídá | https://mkgymji.github.io/tcpipsim/#uloha=10 | síť jde, služba ne: RST, connection refused (L4/L7) |
| 11 Nastav DNS server | https://mkgymji.github.io/tcpipsim/#uloha=11 | jméno × adresa: bez DNS funguje vše „pod ním“ (L7) |
| 3 Konflikt IP adres | https://mkgymji.github.io/tcpipsim/#uloha=3 | jedna IP, dvě MAC: stopa v arp -a (L2/L3) |
| 13 Síť nejde | https://mkgymji.github.io/tcpipsim/#uloha=13&seed=1 | souhrnná: jedna náhodná chyba, postup od L1 nahoru |

### Postup, když síť nejde (od L1 nahoru)

| Vrstva | Otázka | Příkaz | Dobrý výsledek |
| --- | --- | --- | --- |
| L1 | Je kabel zapojený? | `ipconfig` (Media disconnected?), v obrázku kabel | IPv4 řádky jsou vidět |
| L3 | Má Alice správnou IP, masku, bránu, DNS? | `ipconfig /all` | IP v síti brány, brána vyplněná, DNS Servers |
| L2/L3 | Dosáhnu na bránu? | `ping 192.168.1.1`, pak `arp -a` | odpovědi; v `arp -a` MAC brány |
| L3 | Dosáhnu na server přes router? | `ping 192.168.2.10` (`tracert -d`) | TTL=63 |
| L7 | Přeloží se jméno? | `nslookup www.skola.lan` | Address 192.168.2.10 |
| L4/L7 | Odpovídá služba? | `curl -v http://www.skola.lan`; na SRV1 `ss -tuln` | 200 OK / LISTEN na :80 |
| L2/L3 | Odpovídá ten, koho čekám? (konflikt) | `arp -a` × `show ip arp` na R1; TTL v pingu | MAC sedí |

## Dál

Navazující nástroj: Cisco Packet Tracer (zdarma, netacad.com) — volné stavění sítí a konfigurace pro CCNA.
