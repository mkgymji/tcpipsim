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
| `icmp.md` | Echo Request/Reply (ping), Destination Unreachable, Time Exceeded |
| `vektory.md` | formát testovacích vektorů a pravidla porovnání |

Vektory: `tests/vectors/ping-switch.json`, `ping-hub.json`, `ping-router.json`.

Další iterace: UDP, TCP, DNS, HTTP (zmíněno v `model.md` kap. 9), `tracert`, později DHCP, NAT, filtrace.

## Otevřené otázky

1. **Cisco zahazuje první paket čekající na ARP** (první ping z routeru `.!!!!`). Simulátor podle
   RFC 1122/1812 frontuje (bez ztráty). Chceme v úrovni 5 přepínač „věrnost Cisco“? Packet Tracer
   ztrátu prvního pingu přes router ukazuje, studenti CCNA ji znají.
2. **Chování hostitele při cizím ARP requestu:** simulátor se drží RFC 826 (záznam nevzniká).
   Ověřit na reálném Windows 10/11 ve škole (`arp -a` na třetím PC po pingu mezi dvěma jinými).
3. **Výchozí TTL a profily OS:** PC = Windows 128, server = Linux 64, router = Cisco 255. Souhlasí
   didaktik? (Ping z Windows na Windows v LAN ukáže TTL=128, na server přes router TTL=63.)
4. **Doba platnosti ARP záznamu u hostitele:** zvoleno pevných 300 s místo Windows 15–45 s + NUD.
   Pro scénáře „počkej, až záznam vyprší“ by kratší doba byla názornější — rozhodnout se scénáři.
5. **Přesné hlášky Windows v češtině** (`ping`: „Odpověď od …“, „Cílový hostitel není dostupný“,
   `arp -a`: „dynamický/statický“) — ověřit na školním PC, patří do `docs/ui.md`.
6. **Kolize na hubu:** nemodelují se. Má je úroveň 5 vizualizovat (CSMA/CD je v CCNA teorii)?
7. **Smyčky v topologii:** bez STP by smyčka switchů zahltila síť broadcastem. Zakázat smyčky
   v editoru topologie, nebo smyčku nechat jako výukový „broadcast storm“ s pojistkou?
8. **Dvě cesty se stejným prefixem** (administrativní vzdálenost, metrika): v této iteraci zakázáno;
   doplnit s úrovní 3 (statické směrování).
9. **Pořadí kontrol na routeru** (TTL před vyhledáním cesty): ověřit chování Cisco IOS.
10. Normy IEEE nejsou volně dostupné: čísla klauzulí 802.1D a 802 (struktura MAC) v `ethernet.md`
    jsou označena „ověřit“.
11. `docs/slovnik.md` zatím neexistuje; termíny v této specifikaci (rámec, paket, flooding, longest
    prefix match, next hop, výchozí brána, ARP cache, MAC tabulka) do něj navrhnout.
