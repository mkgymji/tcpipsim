# Slovník tcpipsim

Stav: návrh učitele, čeká na schválení projektantem. Sloupec „Potvrdit“: ANO = musí potvrdit
projektant (nejistota o praxi nebo o technické přesnosti), ne = bez výhrad.

Pravidla: zařazeny jen termíny, které se opravdu používají. Slang a anglicismy jsou v pořádku.
Když český překlad nikdo neříká, je to napsáno. V simulátoru se používá termín ve sloupci
„V simulátoru“; při sporu vyhrává termín z praxe. Terminologie vrstev a PDU podle Michalových prezentací.

| Anglický termín | Český pokus | Jak se říká v praxi | V simulátoru | Poznámka | Potvrdit |
|---|---|---|---|---|---|
| layer | vrstva | vrstva, „L3“, „třetí vrstva“ | vrstva (L1–L7) | Číslování podle ISO/OSI i při řeči o TCP/IP („L4 = transport“). | ne |
| protocol stack | zásobník protokolů | stack, síťový stack, „zásobník TCP/IP“ | zásobník vrstev | „Stack“ říkají hlavně IT lidi. | ne |
| encapsulation | zapouzdření | zapouzdření (škola), „enkapsulace“ (slang) | zapouzdření | Opak: rozbalení / „decapsulation“ (česky se spíše říká rozbalení). | ne |
| PDU | protokolová datová jednotka | PDU, v praxi se říká podle vrstvy: rámec, paket, segment | PDU | Zkratka se používá ve škole a u CCNA. | ne |
| header | hlavička | hlavička, „header“ | hlavička (obálka) | „Obálka“ je jen metafora simulátoru, ne odborný termín. | ne |
| trailer | patička | patička, „trailer“ | patička | Skutečně jen u rámce (FCS); málo se používá. | ANO |
| payload | užitečná data, náklad | payload, „data“, „obsah“ | data (obsah) | Česky „užitečný náklad“ nikdo neříká; uvnitř vrstvy je to „data“ vyšší vrstvy. | ANO |
| frame | rámec | rámec (škola) | rámec | PDU linkové vrstvy (L2). | ne |
| packet | paket | paket, „packet“ | paket | PDU síťové vrstvy (L3). V CCNA se „packet“ používá i volně pro cokoli. | ne |
| segment | segment | segment | segment | PDU transportní vrstvy u TCP. | ne |
| datagram | datagram | datagram, „UDP datagram“ | datagram (u UDP) | V prezentacích: paket = IP datagram; datagram pro UDP. | ANO |
| bit | bit | bit, „bity na drátě“ | bity | PDU fyzické vrstvy. Signál na drátě je jejich fyzikální podoba. | ne |
| MAC address | MAC adresa, fyzická adresa | MAC adresa, „mac“, ve Windows „fyzická adresa“ | MAC adresa | `ipconfig /all` ve Windows česky zobrazuje „Fyzická adresa“. | ne |
| IP address | IP adresa | IP adresa | IP adresa | Adresa rozhraní, ne celého počítače. | ne |
| port | port | port | port | Číslo 0–65535 v hlavičce L4; ne fyzický konektor (ten je „port“ i na přepínači, v simulátoru „rozhraní“ nebo „port přepínače“). | ne |
| socket | soket (psáno), „socket“ | socket, v Pythonu `socket` | socket = IP:port | Podle prezentací. Česky „soket“ se píše málo. | ne |
| switch | přepínač | switch | přepínač (switch) | Škola: přepínač; v praxi „switch“. | ne |
| hub | rozbočovač, opakovač | hub | hub | Dnes zastaralé; v simulátoru jen pro porovnání se switchem. Česky „opakovač“ nebo „rozbočovač“ se používá téměř jen ve škole. | ANO |
| router | směrovač | router | router (směrovač) | V praxi „router“; CCNA anglicky. Domácí „router“ je typicky i switch, AP a NAT v jednom. | ne |
| gateway / default gateway | brána, výchozí brána | brána, „gateway“, „výchozí brána“ | výchozí brána (default gateway) | Windows zobrazuje „Výchozí brána“. | ne |
| subnet mask | maska podsítě | maska, „maska sítě“ | maska (podsítě) | Zápis /24 = prefix („slash“, „prefix“). | ne |
| prefix / CIDR | prefix, délka prefixu | „slash 24“, „lomítko 24“ | prefix (/24) | Česky „CIDR“ se říká málo; používá se zápis /24. | ANO |
| subnet | podsíť | podsíť, „subnet“ | podsíť | Pozor na záměnu s „subnet mask“. | ne |
| routing table | směrovací tabulka | routovací tabulka, „routing table“ | směrovací tabulka | Škola i praxe: směrovací/routovací. V IOS `show ip route`. | ne |
| next hop | další krok, další směrovač | next hop | next hop (další skok) | Český překlad nemá ustálenou podobu. | ANO |
| route (statická trasa) | trasa | trasa, route, „statická routa“ | trasa | „Routa“ je slang. Příkaz `ip route`. | ne |
| ARP | protokol pro zjištění MAC | ARP, „arp“ | ARP | `arp -a` ukáže ARP tabulku. | ne |
| ARP table / cache | ARP tabulka | arp tabulka, arp cache | ARP tabulka | | ne |
| MAC table (CAM) | tabulka MAC adres | MAC tabulka | tabulka MAC adres | CAM tabulka je jen u CCNA. | ne |
| broadcast | všesměrové vysílání | broadcast | broadcast | Škola: všesměrové vysílání. Praxe: broadcast. | ne |
| unicast | jednosměrové vysílání | unicast | unicast | Mimo škola se používá málo. | ANO |
| TTL | doba života | TTL | TTL | Zkratka z „Time To Live“; v praxi se nepřekládá. Počítá skoky, ne čas. | ne |
| ICMP | | ICMP | ICMP | Česky nikdo nepřekládá. Nosič pingu a „Time exceeded“. | ne |
| ping | | ping, „pingnout“ | ping | Sloveso „pingnout“ je běžné. | ne |
| traceroute (Windows tracert) | trasování | traceroute, `tracert` | tracert | Česky „trasování“ je nezvyklé. | ne |
| handshake (three-way) | třícestné navázání spojení | handshake, „třícestný handshake“ | handshake | Česky „potřesení rukou“ nikdo neříká. SYN, SYN-ACK, ACK. | ne |
| ACK | potvrzení | ACK | potvrzení (ACK) | Potvrzovací číslo v hlavičce TCP. | ne |
| retransmission | opakované odeslání | retransmise, „retransmit“ | opakované odeslání | Česky „znovuvyslání“ nikdo neříká. | ANO |
| timeout | vypršení času | timeout, „timeoutnout“ | timeout | Slovo se běžně používá i česky. | ne |
| client / server | klient / server | klient, server | klient, server | „Naslouchá“ (LISTENING), „spojení“ (ESTABLISHED) vychází z `netstat`. | ne |
| NAT | překlad adres | NAT, „natování“ | NAT | Česky překlad adres jen ve škole. | ne |
| DHCP | | DHCP | DHCP | Nepřekládá se. | ne |
| DNS | systém doménových jmen | DNS, „dns server“ | DNS | `nslookup`. | ne |
| firewall | | firewall, „firewall“ (i česky „požární zeď“ se používá jen vtipně) | firewall | Překlad „požární zeď“ nepoužívat. | ne |
| host | koncové zařízení | host, PC, „stanice“ | počítač, host | V CCNA je „host“ každé koncové zařízení. | ANO |
| NIC | síťová karta, síťové rozhraní | síťovka, síťová karta, „NIC“ | síťové rozhraní (síťová karta) | „Síťovka“ je ustálený hovorový termín. | ne |
| LAN / WAN | místní síť / rozlehlá síť | LAN, WAN | LAN, WAN | České rozvinutí jen ve škole. | ne |
| checksum / FCS | kontrolní součet | checksum, FCS | kontrolní součet (FCS) | V rentgenu. FCS je kontrola celého rámce, checksum IP/TCP/UDP jinde. | ANO |
| MTU | | MTU | MTU | Pouze zmínka v rentgenu. | ne |

## Poznámky

- Bezpečné zjednodušení: pokud student říká „paket“ pro všechna PDU, nejde o chybu, dokud nejde
  o zkoušku nebo o rozlišení vrstev. V simulátoru se používají přesné termíny podle vrstvy.
- Příkazy a výstupy odpovídají Windows (prezentace); české Windows používají české popisky
  („Fyzická adresa“, „Maska podsítě“, „Výchozí brána“). Verze simulátoru by se měla rozhodnout, zda
  výstup `ipconfig` bude česky, nebo anglicky; návrh: česky jako ve škole (potvrdit).
