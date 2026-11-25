# Odborná specifikace tcpipsim

Zdroj pravdy pro chování jádra simulace. Píše a schvaluje projektant; jádro (`vyvojar`) se testuje
proti vektorům v `tests/vectors/`. Zjednodušení jsou vždy označena „Simulátor zjednodušuje: …“.

## Rejstřík

| Soubor | Obsah |
|---|---|
| `model.md` | uzly, rozhraní, linky, PDU a zapouzdření, OSI ↔ TCP/IP, kdo zpracovává kterou vrstvu, hub/switch/router, čas, seznam zjednodušení |
| `ethernet.md` | MAC adresa, rámec Ethernet II (pole pro rentgen), hub, switch (MAC tabulka, flooding, filtrování) |
| `arp.md` | ARP zpráva (pole), algoritmus příjmu podle RFC 826, ARP cache, fronta a neúspěch |
| `ipv4.md` | adresa a maska, IP hlavička (pole), TTL a výchozí hodnoty, rozhodování hostitele, router, longest prefix match |
| `icmp.md` | Echo Request/Reply (ping, časování, chyby pro UI), Destination Unreachable, Time Exceeded (zdrojová adresa), tracert (Windows ICMP vs. IOS UDP) |
| `routing.md` | směrovací tabulka (C, L, S, S*), vznik cest z `ip address` + `no shutdown` a `ip route`, longest prefix match, AD/metrika jen zobrazit, typické chyby konfigurace, **topologie úrovně 3** |
| `udp.md` | UDP hlavička, pseudohlavička a kontrolní součet, rozsahy portů (IANA, Windows), socket a demultiplexing, aplikace „zprávy“ (úroveň 2) |
| `rentgen.md` | rentgen úrovně 2: pole Ethernet II, IPv4, UDP v pořadí na drátě, názvy česky i z Wiresharku, formáty, zvýraznění, hexdump s mapováním bajtů |
| `cmd.md` | příkazy terminálu: úroveň 2 (`ipconfig`, `ipconfig /all`, `arp -a`, switch `show mac address-table`), úroveň 3 (`ping`, `tracert`, `arp -d`, `route print`/`netstat -nr`, IOS `show ip interface brief`, `show ip route`, `show ip arp`, `ping`, `traceroute`, konfigurace); vzory výstupů |
| `vektory.md` | formát testovacích vektorů a pravidla porovnání |

Vektory: `tests/vectors/ping-switch.json`, `ping-hub.json`, `ping-router.json`; úroveň 2:
`udp-switch.json`, `udp-hub.json`, `udp-switch-naucene.json`, `udp-switch-port6000.json`; úroveň 3:
`ping-arp-prvni.json`, `ping-bez-brany.json`, `ping-spatna-brana.json`, `tracert-alice-bob.json`,
`tracert-dva-routery.json` (skip, pozdější rozšíření).

Další iterace: TCP, DNS, HTTP (zmíněno v `model.md` kap. 9), později DHCP, NAT, filtrace.

## Otevřené otázky

1. **Cisco zahazuje první paket čekající na ARP** (první ping z routeru `.!!!!`). Simulátor podle
   RFC 1122/1812 frontuje (bez ztráty). Chceme v úrovni 5 přepínač „věrnost Cisco“? Packet Tracer
   ztrátu prvního pingu přes router ukazuje, studenti CCNA ji znají.
2. **Chování hostitele při cizím ARP requestu:** simulátor se drží RFC 826 (záznam nevzniká).
   Ověřit na reálném Windows 10/11 ve škole (`arp -a` na třetím PC po pingu mezi dvěma jinými).
3. **Výchozí TTL a profily OS:** PC = Windows 128, server = Linux 64, router = Cisco 255. Souhlasí
   didaktik? (Ping z Windows na Windows v LAN ukáže TTL=128, na Boba přes router TTL=127; server Linux v úrovni 4 TTL=63.)
4. **Doba platnosti ARP záznamu u hostitele:** zvoleno pevných 300 s místo Windows 15–45 s + NUD.
   Pro scénáře „počkej, až záznam vyprší“ by kratší doba byla názornější — rozhodnout se scénáři.
5. **Přesné hlášky Windows v češtině** (`ping`: „Odpověď od …“, „Cílový hostitel není dostupný“,
   `arp -a`: „dynamický/statický“) — ověřit na školním PC, patří do `docs/ui.md`.
6. **Kolize na hubu:** nemodelují se. Má je úroveň 5 vizualizovat (CSMA/CD je v CCNA teorii)?
7. **Smyčky v topologii:** bez STP by smyčka switchů zahltila síť broadcastem. Zakázat smyčky
   v editoru topologie, nebo smyčku nechat jako výukový „broadcast storm“ s pojistkou?
8. **Dvě cesty se stejným prefixem** (administrativní vzdálenost, metrika): v úrovni 3 se AD/metrika
   jen zobrazují a druhá cesta se odmítne (`routing.md` kap. 4); floating static v úrovni 5.
9. **Pořadí kontrol na routeru** (TTL před vyhledáním cesty): ověřit chování Cisco IOS.
10. Normy IEEE nejsou volně dostupné: čísla klauzulí 802.1D a 802 (struktura MAC) v `ethernet.md`
    jsou označena „ověřit“.
11. `docs/slovnik.md` zatím neexistuje; termíny v této specifikaci (rámec, paket, flooding, longest
    prefix match, next hop, výchozí brána, ARP cache, MAC tabulka) do něj navrhnout.
12. **Formáty výstupů terminálu** (`cmd.md`): místa označená „ověřit“ porovnat se školním PC
    (Windows EN i CZ) a s Packet Tracerem / switchem 2960.
13. **Zdrojový port klienta** je v simulaci deterministický (49152, 49153, …); skutečné OS ho
    volí náhodně (RFC 6056). Stačí to pro úroveň 4 (víc klientů, `netstat`)?
14. **Špatná maska jako chyba konfigurace (úroveň 3):** Cisco má proxy ARP ve výchozím stavu zapnuté,
    takže hostitel s příliš krátkou maskou (např. /16) se ARPem ptá přímo na cíl za routerem, router
    odpoví vlastní MAC a ping **projde**. Simulátor proxy ARP nemá, ping by selhal — to by se student
    musel odnaučit. Proto vektor chyby konfigurace je `ping-spatna-brana`, ne špatná maska. Pokud
    scénář masku chce: (a) implementovat proxy ARP (RFC 1027; Cisco `ip proxy-arp`, odpoví jen, když
    cíl leží za jiným rozhraním) a ukázat, že „ping funguje, ale ze špatného důvodu“, nebo (b) router
    s výslovně vypnutým `no ip proxy-arp` v konfiguraci a vysvětlivkou. Rozhodne orchestrátor.
15. **ICMP 3/1 z Cisco routeru po neúspěšném ARP:** RFC 1812 ho vyžaduje (simulátor ho posílá), reálné
    Cisco/Packet Tracer možná ne (`arp.md` kap. 6.2). Ověřit v Packet Traceru (ping na neexistující
    192.168.2.99 přes R1: `Destination host unreachable` od 192.168.1.1, nebo `Request timed out`?).
16. **Windows `ping` bez brány:** `PING: transmit failed. General failure.` je podle návodů, ne podle
    vlastního ověření (`cmd.md` kap. 8.2). Ověřit při pilotu; vektor `ping-bez-brany` na textu nezávisí
    (kontroluje jen „žádný přenos“ a `kind: no_route`).
17. **Data sondy Windows `tracert` 64 B nul** podle jediného záznamu provozu; ověřit Wiresharkem
    (vektor `tracert-dva-routery` délky kontroluje: IP 92 B, rámec 106 B).
