# Slovník tcpipsim

Stav: návrh učitele, **zkontroloval a schválil projektant 2026-11-24** (sloupec „Potvrdit“ vyplněn,
doplněna sekce „Termíny ze specifikace“). Změny proti návrhu jsou ve sloupci „Potvrdit“ jako
„upraveno: …“.

Pravidla: zařazeny jen termíny, které se opravdu používají. Slang a anglicismy jsou v pořádku.
Když český překlad nikdo neříká, je to napsáno. V simulátoru se používá termín ve sloupci
„V simulátoru“; při sporu vyhrává termín z praxe. Terminologie vrstev a PDU podle Michalových prezentací.

| Anglický termín | Český pokus | Jak se říká v praxi | V simulátoru | Poznámka | Potvrdit |
|---|---|---|---|---|---|
| layer | vrstva | vrstva, „L3“, „třetí vrstva“ | vrstva (L1–L7) | Číslování podle ISO/OSI i při řeči o TCP/IP („L4 = transport“). | ne |
| protocol stack | zásobník protokolů | stack, síťový stack, „zásobník TCP/IP“ | zásobník vrstev | „Stack“ říkají hlavně IT lidi. | ne |
| encapsulation | zapouzdření | zapouzdření (škola), „enkapsulace“ (slang) | zapouzdření | Opak: rozbalení / „decapsulation“, v CCNA „de-encapsulation“ (česky se spíše říká rozbalení). | ne |
| PDU | protokolová datová jednotka | PDU, v praxi se říká podle vrstvy: rámec, paket, segment | PDU | Zkratka se používá ve škole a u CCNA. | ne |
| header | hlavička | hlavička, „header“ | hlavička (obálka) | „Obálka“ je jen metafora simulátoru, ne odborný termín. | ne |
| trailer | patička | patička, „trailer“ | patička (FCS); na úrovni 1 štítek „konec rámce“ | V TCP/IP sadě má patičku jen ethernetový rámec (pole FCS). Na úrovni 1 je vidět jako proužek (rozhodnutí 2), obsah v rentgenu. | schváleno; doplněno, jak se patička jmenuje v UI |
| payload | užitečná data, náklad | payload, „data“, „obsah“ | data (obsah) | Česky „užitečný náklad“ nikdo neříká; uvnitř vrstvy je to „data“ vyšší vrstvy. Wireshark i CCNA říkají „payload“/„data“. | schváleno |
| frame | rámec | rámec (škola) | rámec | PDU linkové vrstvy (L2). | ne |
| packet | paket | paket, „packet“ | paket | PDU síťové vrstvy (L3). V CCNA se „packet“ používá i volně pro cokoli. | ne |
| segment | segment | segment | segment | PDU transportní vrstvy u TCP. CCNA (ITN) používá „segment“ i jako obecný název PDU L4, proto je ve sloupci vrstev všech úrovní obecně „segment“ (rozhodnutí 49); v detailu a rentgenu „UDP datagram (RFC 768), TCP segment“, Michalův název „transportní paket“. | upraveno (rozh. 49) |
| datagram | datagram | datagram, „UDP datagram“ | datagram (u UDP); na L3 „paket“, v rentgenu podtitul „IP datagram“ | RFC 768 „User Datagram“, RFC 791 „Internet datagram“. Samotné „datagram“ je dvojznačné, proto na L3 vždy „paket“ (shoda s `docs/spec/model.md` kap. 1). | schváleno; upraveno: doplněno použití na L3 |
| bit | bit | bit, „bity na drátě“ | bity | PDU fyzické vrstvy. Signál na drátě je jejich fyzikální podoba. | ne |
| MAC address | MAC adresa, fyzická adresa | MAC adresa, „mac“, ve Windows „fyzická adresa“ | MAC adresa | `ipconfig /all` ve Windows česky zobrazuje „Fyzická adresa“, anglicky „Physical Address“. | ne |
| IP address | IP adresa | IP adresa | IP adresa | Adresa rozhraní, ne celého počítače. | ne |
| port | port | port | port | Číslo 0–65535 v hlavičce L4; ne fyzický konektor (ten je „port“ i na přepínači, v simulátoru „rozhraní“ nebo „port přepínače“). | ne |
| socket | soket (psáno), „socket“ | socket, v Pythonu `socket` | socket = IP:port | Podle prezentací. Česky „soket“ se píše málo. | ne |
| switch | přepínač | switch | přepínač (switch) | Škola: přepínač; v praxi „switch“. | ne |
| hub | rozbočovač, opakovač | hub | hub | Dnes zastaralé; v simulátoru jen pro porovnání se switchem. „Rozbočovač“ se v české literatuře používá. „Opakovač“ (repeater) je **jiné** zařízení (zesílí signál mezi dvěma segmenty); hub je víceportový opakovač, ale „opakovač“ pro hub nepoužívat. | upraveno: „opakovač“ jako název hubu vyřazen (repeater ≠ hub) |
| router | směrovač | router | router (směrovač) | V praxi „router“; CCNA anglicky. Domácí „router“ je typicky i switch, AP a NAT v jednom. | ne |
| gateway / default gateway | brána, výchozí brána | brána, „gateway“, „výchozí brána“ | výchozí brána (default gateway) | Windows zobrazuje „Výchozí brána“. | ne |
| subnet mask | maska podsítě | maska, „maska sítě“ | maska (podsítě) | Zápis /24 = prefix („slash“, „prefix“). | ne |
| prefix / CIDR | prefix, délka prefixu | „lomítko 24“, „slash 24“, „prefix /24“; „CIDR zápis“ | prefix (/24) | CIDR (RFC 4632) je v CCNA běžný název („CIDR notation“), v řeči se ale říká „lomítko 24“. | schváleno; upraveno: doplněn „CIDR zápis“ (v CCNA se používá) |
| subnet | podsíť | podsíť, „subnet“ | podsíť | Pozor na záměnu s „subnet mask“. | ne |
| routing table | směrovací tabulka | routovací tabulka, „routing table“ | směrovací tabulka | Škola i praxe: směrovací/routovací. V IOS `show ip route`. | ne |
| next hop | další krok, další směrovač | next hop, „další skok“ | next hop (další skok) | „Další skok“ se používá (i ve specifikaci), „další krok“ ne. Next hop je IP adresa sousedního routeru, ne celá cesta. | schváleno; upraveno: „další krok“ vyřazen |
| route (statická trasa) | trasa | trasa, cesta, route, „statická routa“ | trasa | „Routa“ je slang. Příkaz `ip route`. Specifikace používá i „cesta“ (synonymum). | ne |
| ARP | protokol pro zjištění MAC | ARP, „arp“ | ARP | `arp -a` ukáže ARP tabulku. | ne |
| ARP table / cache | ARP tabulka | arp tabulka, arp cache | ARP tabulka | | ne |
| MAC table (CAM) | tabulka MAC adres | MAC tabulka | tabulka MAC adres | „CAM tabulka“ se říká v CCNA i mezi síťaři; Cisco příkaz `show mac address-table`. | ne |
| broadcast | všesměrové vysílání | broadcast | broadcast | Škola: všesměrové vysílání. Praxe: broadcast. | ne |
| unicast | jednosměrové vysílání | unicast | unicast | V praxi i v CCNA se říká „unicast“ běžně; český překlad („jednosměrové“, „individuální“) se nepoužívá. | upraveno: opravena poznámka (málo se používá překlad, ne „unicast“) |
| TTL | doba života | TTL | TTL | Zkratka z „Time To Live“; v praxi se nepřekládá. RFC 791 ho definuje v sekundách, prakticky každý router odečte 1, takže počítá skoky. | ne |
| ICMP | | ICMP | ICMP | Česky nikdo nepřekládá. Nosič pingu a „Time exceeded“. | ne |
| ping | | ping, „pingnout“ | ping | Sloveso „pingnout“ je běžné. | ne |
| traceroute (Windows tracert) | trasování | traceroute, `tracert` | tracert | Česky „trasování“ je nezvyklé. | ne |
| handshake (three-way) | třícestné navázání spojení | handshake, „třícestný handshake“ | handshake | Česky „potřesení rukou“ nikdo neříká. SYN, SYN-ACK, ACK. | ne |
| ACK | potvrzení | ACK | potvrzení (ACK) | Dvě věci: příznak ACK a potvrzovací číslo (Acknowledgment Number) v hlavičce TCP. | ne |
| retransmission | opakované odeslání | retransmise, „retransmit“ | retransmise (opakované odeslání) | „Retransmise“ je ustálené (i v české literatuře); „znovuvyslání“ nikdo neříká. Podle pravidla „vyhrává praxe“ je hlavní termín retransmise, český opis jako vysvětlení. | upraveno: v simulátoru „retransmise“ |
| timeout | vypršení času | timeout, „timeoutnout“ | timeout | Slovo se běžně používá i česky. | ne |
| client / server | klient / server | klient, server | klient, server | „Naslouchá“ (LISTENING), „spojení“ (ESTABLISHED) vychází z `netstat`. | ne |
| NAT | překlad adres | NAT, „natování“ | NAT | Česky překlad adres jen ve škole. | ne |
| DHCP | | DHCP | DHCP | Nepřekládá se. | ne |
| DNS | systém doménových jmen | DNS, „dns server“ | DNS | `nslookup`. | ne |
| firewall | | firewall | firewall | Překlad „požární zeď“ nepoužívat. | ne |
| host | hostitel, koncové zařízení | host, PC, „stanice“; „koncové zařízení“ (české CCNA, end device) | počítač / koncové zařízení; odborně host | V CCNA je „host“ každé koncové zařízení s IP adresou. „Hostitel“ se v češtině drží hlavně ve spojení „hostitelská část adresy“; specifikace ho používá pro uzel typu PC/server. | schváleno; upraveno: doplněno „koncové zařízení“ a „hostitelská část“ |
| NIC | síťová karta, síťové rozhraní | síťovka, síťová karta, „NIC“ | síťové rozhraní (síťová karta) | „Síťovka“ je ustálený hovorový termín. | ne |
| LAN / WAN | místní síť / rozlehlá síť | LAN, WAN | LAN, WAN | České rozvinutí jen ve škole. | ne |
| FCS (Frame Check Sequence) | kontrolní posloupnost rámce | FCS, „CRC“ | FCS (v patičce rámce) | CRC-32 na konci ethernetového rámce, kontrola celého rámce (IEEE 802.3). Není to „součet“, ale CRC; v rentgenu „FCS (nepočítá se)“. | upraveno: rozděleno na FCS a checksum (různé mechanismy, různé vrstvy) |
| checksum | kontrolní součet | checksum, kontrolní součet | kontrolní součet | Pole v hlavičce IPv4 (jen hlavička), ICMP, UDP a TCP; jednotkový doplněk součtu 16bit. slov (RFC 1071). | upraveno: viz řádek FCS |
| MTU | | MTU | MTU | Pouze zmínka v rentgenu. | ne |

## Termíny ze specifikace (doplnil projektant)

Termíny, které používá `docs/spec/` a které ve slovníku chyběly. Všechny se používají v praxi i v CCNA.

| Anglický termín | Český pokus | Jak se říká v praxi | V simulátoru | Poznámka |
|---|---|---|---|---|
| interface | rozhraní | rozhraní, „interface“, „interfejs“ (slang) | rozhraní | Na routeru `Gi0/0` (GigabitEthernet0/0), na switchi „port“ (`Fa0/1`). Rozhraní má MAC a IP, port switche ne. |
| EtherType | typ (protokolu) | EtherType | EtherType | Pole rámce: co je uvnitř (`0x0800` IPv4, `0x0806` ARP). Nepřekládá se. |
| preamble / SFD | preambule | preambule | preambule (v simulaci se nepřenáší) | Synchronizace na L1; Wireshark ji neukazuje. |
| padding | výplň | výplň, „padding“ | výplň | Doplnění dat rámce na minimum 46 B. |
| MAC learning | učení MAC adres | „switch se učí“, learning | učení (ze zdrojové MAC) | Switch se učí jen ze zdrojové MAC. |
| flooding | zaplavení | flooding, „switch to floodne“ | flooding (rozeslání na všechny porty) | Česky „zaplavení“ se skoro neříká. Flooding ≠ broadcast: switch rozešle i unicast s neznámou cílovou MAC. |
| unknown unicast | neznámý unicast | unknown unicast | unknown unicast (neznámá cílová MAC) | Důvod floodingu u unicastu. |
| forwarding (L2) / filtering | přeposílání / filtrování | forwarding, filtering, „switch to zahodí“ | přeposlání / filtrování (zahození) | U switche: poslat jen na jeden port / zahodit, je-li cíl na portu, odkud rámec přišel. |
| aging time | doba stárnutí | aging time, „záznam vyprší“ | doba stárnutí | MAC tabulka 300 s (Cisco výchozí), ARP cache viz `arp.md`. |
| multicast | skupinové vysílání | multicast | multicast | Překlad se nepoužívá. |
| broadcast domain | všesměrová doména | broadcastová doména | broadcastová doména | Ohraničuje ji router. |
| collision domain | kolizní doména | kolizní doména | kolizní doména | V praxi „kolizní doména“, ne „doména kolizí“. Hub = jedna, switch = každý port vlastní. |
| half-duplex / full-duplex | poloviční / plný duplex | half-duplex, full-duplex, „duplex“ | half-duplex / full-duplex | Překlady se nepoužívají. |
| CSMA/CD | | CSMA/CD | CSMA/CD | Jen teorie (kolize se nemodelují). |
| OUI | identifikátor výrobce | OUI, „prefix výrobce“ | OUI | První 3 B globálně přidělené MAC. |
| ARP request / ARP reply | ARP dotaz / ARP odpověď | ARP request, ARP reply; „arp dotaz“ | ARP dotaz (request) / ARP odpověď (reply) | Request jde broadcastem, reply unicastem. Wireshark: „Who has …? Tell …“ / „… is at …“. |
| network address | adresa sítě | adresa sítě, „síť“ | adresa sítě | IP AND maska. |
| host part / network part | hostitelská / síťová část | „hostitelská část“, „síťová část“, „host part“ | síťová a hostitelská část adresy | Ustálené i v české literatuře. |
| connected route | přímo připojená síť | „connected“, „přímo připojená“ | přímo připojená síť (C) | Kód `C` v `show ip route`. |
| local route | lokální cesta | „local“ | lokální adresa rozhraní (L) | Kód `L`, /32, Cisco IOS 15+. |
| default route | výchozí cesta | default route, „defaultka“ (slang), výchozí trasa | výchozí cesta (0.0.0.0/0) | U hostitele = výchozí brána; v IOS kód `S*`. |
| longest prefix match | nejdelší shoda prefixu | longest prefix match, „nejdelší prefix vyhrává“ | longest prefix match (nejdelší shoda prefixu) | Pravidlo výběru cesty, RFC 1812 5.2.4.3. |
| forwarding (L3) | přeposílání, směrování | forwarding, „routování“, přeposílání | přeposílání (forwarding) | Přeposílání paketu routerem; „směrování“ (routing) je v užším smyslu rozhodování/tvorba tabulky. |
| direct / indirect delivery | přímé / nepřímé doručení | „cíl je v mé síti“ / „jde přes bránu“ | přímé doručení / přes bránu | „Přímé/nepřímé doručení“ je školní a učebnicový termín, praxe ho opisuje. |
| hop | skok | hop, skok | skok | Jeden router na cestě (`tracert` vypisuje skoky). |
| Echo Request / Echo Reply | | „echo request“, „echo reply“, ping a odpověď | ICMP Echo Request / Echo Reply | Typ 8 / 0. Nepřekládá se. |
| Destination Unreachable | cíl nedostupný | „destination unreachable“, „nedostupný“ | Destination Unreachable (cíl nedostupný) | ICMP typ 3; Windows česky „Cílový hostitel není dostupný“ (ověřit znění). |
| Time Exceeded | čas vypršel | „TTL expired“, „time exceeded“ | Time Exceeded (TTL vypršelo) | ICMP typ 11; Windows: „TTL expired in transit“. |
| identifier / sequence number (ICMP) | identifikátor / pořadové číslo | „seq“, „icmp_seq“ | identifikátor, pořadové číslo | Pole Echo zprávy. |

## Doplnění pro úroveň 3 (návrh didaktika, čeká na schválení projektantem)

Termíny „brána / default gateway“, „maska“, „směrovací tabulka“, „next hop“, „hop“ (skok), „TTL“, „default route“, „connected route“,
„longest prefix match“, „Time Exceeded“, „tracert“ a „host part / network part“ už ve slovníku jsou a úroveň 3 je používá beze změny.
Nově navrhuji:

| Anglický termín | Český pokus | Jak se říká v praxi | V simulátoru | Poznámka |
|---|---|---|---|---|
| Request timed out | vypršel časový limit požadavku | „request timed out“, „ping neprošel“, „timeoutuje“ | Request timed out (výpis Windows) | Hláška `ping`: odpověď nepřišla. Česky ve Windows „Časový limit žádosti vypršel“ (ověřit). Neplést s „Destination host unreachable“: tu někdo odpověděl (často vlastní PC nebo router), že cíl nedosáhne. |
| Gateway of last resort | brána poslední záchrany | „gateway of last resort“, „výchozí cesta“ | Gateway of last resort (výpis `show ip route`) | Řádek IOS: kam router pošle, co nezná. Doslovný překlad se nepoužívá; student ho uvidí jen ve výpisu (`is not set`). |
| troubleshooting | řešení potíží, hledání chyb | „troubleshooting“, „troubleshootovat“, „ladění sítě“ | hledání chyby (postup zdola nahoru) | „Troubleshooting“ je ustálené v CCNA i v praxi; v simulátoru česky „hledání chyby“. |
| directly connected | přímo připojená síť | „connected“, „přímo připojená“ | přímo připojená síť (C) | Už je pod „connected route“; připomínám, že v `netstat -nr` Windows tomu odpovídá `On-link`. |
| On-link | přímo na lince | „on-link“ | On-link (výpis `netstat -nr`) | Windows píše do sloupce Gateway, když je cíl v téže síti: bez routeru. Česky se neříká. |
| broadcast domain (rozšíření) | všesměrová doména | broadcastová doména | broadcastová doména | Už ve slovníku; v úrovni 3 se poprvé ukáže, že jejím okrajem je router (ARP dotaz končí na routeru). |

## Poznámky

- Bezpečné zjednodušení: pokud student říká „paket“ pro všechna PDU, nejde o chybu, dokud nejde
  o zkoušku nebo o rozlišení vrstev. V simulátoru se používají přesné termíny podle vrstvy.
- ARP zpráva **není paket** (nemá IP hlavičku, jede přímo v rámci, EtherType `0x0806`) a ICMP
  zpráva **není segment** (jede v IP paketu, nemá porty). V UI to říkat přesně: „ARP zpráva v rámci“,
  „ICMP zpráva v paketu“.
- Jazyk výstupů terminálu (Windows česky/anglicky): podle `docs/rozhodnuti.md` bod 10 se rozhodne
  v iteraci 2, předběžně anglicky s českou poznámkou simulátoru. České popisky Windows („Fyzická
  adresa“, „Maska podsítě“, „Výchozí brána“) uvádět ve slovníku jako ekvivalent.

## Doplnění po rozhodnutí 49 (schválil Michal 2026-11-25)

- **„Kdo se stará“ o L1 a L2:** „firmware síťového rozhraní“ (jako Michalova prezentace); rozhodnutí 18
  („síťová karta (hardware a firmware)“) je zrušené. V řádku vrstvy zkráceně „firmware síť. rozhraní“,
  u L1 v detailu věta „L1 je z velké části hardware síťové karty“.
- **Názvy PDU v detailu (Michal):** „linkový rámec“ (L2), „síťový paket (IP datagram)“ (L3), „transportní paket“
  (L4; UDP datagram podle RFC 768, TCP segment). Ve sloupci vrstev zůstávají krátké tvary rámec, paket, segment.

