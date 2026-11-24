# Rentgen — co ukáže na úrovni 2

Stav: návrh, iterace 2. Autor: projektant. Platí pro panel rentgen (`docs/ui.md`, pravý sloupec)
na úrovni 2 „Adresy“ pro provoz aplikace „zprávy“ (Ethernet II → IPv4 → UDP → data). ARP a ICMP
se v rentgenu objeví až s úrovní 3 (pole jsou v `arp.md` kap. 2 a `icmp.md`).

Zdroje polí: `ethernet.md` kap. 2 (IEEE 802.3), `ipv4.md` kap. 2 (RFC 791 3.1), `udp.md` kap. 2
(RFC 768). Anglické názvy = popisky ve stromu paketu Wiresharku 4.x a názvy polí filtru
(display filter), které student použije ve Wiresharku. Popisky Wiresharku se mezi verzemi
mírně mění (např. „Source“ → „Source Address“ u IPv4 ve 4.x): **ověřit na verzi ve škole**.

## 1. Obecná pravidla zobrazení

1. **Pořadí polí = pořadí na drátě** (rozhodnutí 15). Ethernet: cílová MAC první. Štítek obálky
   ukazuje „zdrojová MAC → cílová MAC“ kvůli čitelnosti; rentgen to vysvětlí poznámkou
   (kap. 2, poznámka R1).
2. Každý řádek: **název česky** (tučně), pod ním menší šedý **název z Wiresharku** a název pole
   filtru; **délka v bitech**; **hodnota** ve formátu podle sloupce „Zobrazení“; **vysvětlení**
   jednou větou (po rozkliknutí řádku, nebo tooltip; na projektoru se vejde pod hodnotu).
3. **Formáty hodnot:**
   - MAC: `02:00:00:00:00:01` (malá písmena, dvojtečky — jako Wireshark). Při najetí ukázat i
     zápis Windows `02-00-00-00-00-01` (shoda s `ipconfig /all` a `arp -a`).
   - IP adresa: tečkový desítkový zápis `192.168.1.10`.
   - Porty, délky, TTL, Protocol: **desítkově**; u Protocol a EtherType i jméno: `17 (UDP)`,
     `0x0800 (IPv4)`.
   - EtherType a kontrolní součty: **hexadecimálně** s `0x` (tak je zná praxe i Wireshark).
   - Bitová pole menší než bajt (Version, IHL, DSCP, ECN, Flags, Fragment Offset): binárně s
     hodnotou, např. `0100 = 4`, `010 = 0x2` (styl Wiresharku `0100 .... = Version: 4`).
   - Data: text v uvozovkách + délka v bajtech: `"Ahoj, Bobe!" (11 B)`.
4. **Zvýraznění „to důležité na úrovni 2“** (sloupec Z): řádek má plnou barvu vrstvy, tučnou
   hodnotu a značku `●`. Ostatní pole jsou vidět (skutečná hlavička má všechna pole, nic
   nezamlčujeme), ale ztlumená (šedý text) a ve výchozím stavu sbalená pod řádek
   „další pole hlavičky (n)“, který jde rozbalit. Na úrovni 2 se zvýrazní: cílová a zdrojová
   MAC, EtherType, zdrojová a cílová IP, Protocol, zdrojový a cílový port, data.
   (Úroveň 3 přidá TTL a kontrolní součet IP; úroveň 4 délky a součet UDP.)
5. **Hodnoty jsou vždy ze simulace** (`docs/ui.md` kap. štítky), včetně počítaných kontrolních
   součtů a délek. Žádná pole s vymyšlenou hodnotou.
6. Nad tabulkou souhrnný řádek ve stylu Wiresharku (česky):
   `Rámec: 60 B · Ethernet II · IPv4 192.168.1.10 → 192.168.1.20 · UDP 49152 → 5000 · data 11 B`.
7. Podtituly bloků: „Rámec (Ethernet II)“, „Paket (IPv4, IP datagram)“, „UDP datagram“,
   „Data aplikace“. (Slovník: na L3 primárně „paket“, podtitul „IP datagram“.)

## 2. Ethernet II (L2, rámec)

| # | Česky | Wireshark / filtr | Bity | Hodnota (rámec 1) | Zobrazení | Vysvětlení pro studenta | Z |
|---|---|---|---|---|---|---|---|
| — | Preambule a začátek rámce | — (Wireshark nezobrazuje) | 64 | `10101010 …` `10101011` | šedý řádek „nepřenáší se v simulaci“ | Synchronizační úvod, podle kterého se přijímač naladí na začátek rámce; nepatří k rámci a síťová karta ho nepředává dál. | |
| 1 | Cílová MAC | Destination / `eth.dst` | 48 | `02:00:00:00:00:02` | MAC | MAC adresa síťové karty, které je rámec určen; je první, aby se o rámci dalo rozhodnout co nejdřív. | ● |
| 2 | Zdrojová MAC | Source / `eth.src` | 48 | `02:00:00:00:00:01` | MAC | MAC adresa síťové karty, která rámec odeslala. | ● |
| 3 | EtherType (typ obsahu) | Type / `eth.type` | 16 | `0x0800 (IPv4)` | hex + jméno | Číslo, které říká, co je uvnitř rámce: `0x0800` znamená IPv4 paket, `0x0806` zprávu ARP. | ● |
| 4 | Data rámce | (strom IPv4 níže) | 39 B | IPv4 paket | odkaz na blok L3 | Obsah rámce, tady celý IP paket. | |
| 5 | Výplň | Padding / `eth.padding` (ověřit) | 56 | `00 00 00 00 00 00 00` (7 B) | hex bajty | Nuly, kterými se krátký rámec doplní na nejmenší povolenou délku 60 bajtů (bez kontrolního pole). | |
| 6 | Kontrola chyb (FCS) | Frame check sequence / `eth.fcs` | 32 | „nepočítá se“ | šedě | Kontrolní číslo (CRC-32) spočítané z celého rámce; příjemce ho přepočítá a poškozený rámec zahodí. | |

Poznámky pro UI:
- **R1** (u řádků 1–2): „V rámci je cílová MAC před zdrojovou. Na štítku obálky je pořadí odkud → kam,
  aby se dobře četlo.“
- Výplň se ukazuje jen tehdy, když ji rámec má (data kratší než 46 B). Na úrovni 2 ji má každá
  zpráva kratší než 18 znaků ASCII. Wireshark výplň u zachyceného odeslaného rámce často neukáže
  (zachytí rámec dřív, než ho karta doplní) — není to rozpor, jen jiné místo zachycení.
- Preambule a FCS: „Simulátor zjednodušuje: preambule se nepřenáší a kontrolní číslo FCS se
  nepočítá; linky v simulaci nedělají chyby.“ (`model.md` kap. 8.) Do hexdumpu nepatří (Wireshark
  je také neukazuje).
- „Zvýraznit“ u MAC adres: na hubu/switchi s úrovní 2 se u cílové MAC ukáže, komu patří
  („Bob, PC B“) a u PC, které rámec zahodilo, „není moje MAC → zahozeno“ (`nic_drop`).

## 3. IPv4 (L3, paket)

| # | Česky | Wireshark / filtr | Bity | Hodnota (rámec 1) | Zobrazení | Vysvětlení pro studenta | Z |
|---|---|---|---|---|---|---|---|
| 1 | Verze | Version / `ip.version` | 4 | `0100 = 4` | binárně + desítkově | Verze protokolu IP; tady 4 (IPv4). | |
| 2 | Délka hlavičky | Header Length / `ip.hdr_len` | 4 | `0101 = 5 → 20 B` | binárně, ×4 B | Délka IP hlavičky ve čtyřbajtových slovech; 5 slov = 20 bajtů. | |
| 3 | DSCP (třída provozu) | Differentiated Services Codepoint / `ip.dsfield.dscp` | 6 | `000000 = 0` | binárně + desítkově | Číslo, podle kterého mohou routery dát přednost třeba hovorům před stahováním; 0 = běžný provoz. | |
| 4 | ECN (hlášení zahlcení) | Explicit Congestion Notification / `ip.dsfield.ecn` | 2 | `00 = 0` | binárně | Dva bity, kterými router může upozornit, že je síť přetížená; 0 = nepoužívá se. | |
| 5 | Celková délka | Total Length / `ip.len` | 16 | `39` | desítkově (B) | Délka celého paketu v bajtech: IP hlavička a všechno, co nese. | |
| 6 | Identifikace | Identification / `ip.id` | 16 | `0x0001 (1)` | hex + desítkově | Číslo paketu od tohoto odesílatele; podle něj se skládají části paketu, pokud se cestou rozdělí. | |
| 7 | Příznaky | Flags / `ip.flags` (`ip.flags.df`, `ip.flags.mf`) | 3 | `000` | binárně, po bitech | Rezervovaný bit, „nedělit“ (DF) a „budou další části“ (MF); tady nic nenastaveno. | |
| 8 | Posun části | Fragment Offset / `ip.frag_offset` | 13 | `0` | desítkově | Kde v původním paketu tahle část začíná, když se paket dělil; 0 = paket je celý. | |
| 9 | TTL (doba života) | Time to Live / `ip.ttl` | 8 | `128` | desítkově | Kolik routerů paket ještě smí projít; každý router ho sníží o 1 (víc v úrovni 3). | |
| 10 | Protokol (typ obsahu) | Protocol / `ip.proto` | 8 | `17 (UDP)` | desítkově + jméno | Číslo, které říká, co je uvnitř paketu: 17 = UDP, 6 = TCP, 1 = ICMP. | ● |
| 11 | Kontrolní součet hlavičky | Header Checksum / `ip.checksum` | 16 | `0xb756` | hex | Číslo spočítané jen z IP hlavičky; příjemce ho přepočítá a poškozený paket zahodí. | |
| 12 | Zdrojová IP | Source Address / `ip.src` | 32 | `192.168.1.10` | tečkově | IP adresa rozhraní, ze kterého paket vyšel (původního odesílatele). | ● |
| 13 | Cílová IP | Destination Address / `ip.dst` | 32 | `192.168.1.20` | tečkově | IP adresa rozhraní, kterému je paket určen (konečného cíle). | ● |
| 14 | Volby | Options | 0 | žádné | text „žádné“ | Nepovinná rozšíření hlavičky; běžný provoz je nepoužívá. | |
| 15 | Data paketu | (strom UDP níže) | 19 B | UDP datagram | odkaz na blok L4 | Obsah paketu, tady UDP datagram. | |

Poznámky:
- Řádky 3–4 jsou v jednom bajtu, který Wireshark ukazuje jako „Differentiated Services Field:
  0x00“ se dvěma podřádky. Rentgen to může napodobit (rodičovský řádek „bajt DS: 0x00“).
- Řádek 7: Wireshark 4.x píše `000. .... = Flags: 0x0` a podřádky „Reserved bit: Not set“,
  „Don't fragment: Not set“, „More fragments: Not set“. Česky: „Rezervovaný bit: 0“, „Nedělit (DF): 0“,
  „Další části (MF): 0“. Hodnota DF = 0 je podle `ipv4.md` kap. 2 (zjednodušení, Windows u UDP
  DF běžně nenastavuje — ověřit na Wiresharku ve škole).
- Řádek 6: Identifikace = čítač na uzel od 1 (rozhodnutí 22). Wireshark ji ukazuje `0x0001 (1)`.
- Řádek 11: na úrovni 2 se nevysvětluje víc; Wireshark ve výchozím stavu píše
  „[validation disabled]“, rentgen může psát „správný“ (simulátor ho počítá i kontroluje).
- Pojmy „fragment“ a „QoS“ se ve vysvětleních nepoužívají bez opisu (pravidlo: žádné nevysvětlené
  zkratky). DF/MF jsou uvedeny jen jako zkratky v závorce za českým opisem.

## 4. UDP (L4, UDP datagram)

| # | Česky | Wireshark / filtr | Bity | Hodnota (rámec 1) | Zobrazení | Vysvětlení pro studenta | Z |
|---|---|---|---|---|---|---|---|
| 1 | Zdrojový port | Source Port / `udp.srcport` | 16 | `49152` | desítkově (+ rozsah) | Číslo, pod kterým odesílající aplikace čeká na odpověď; operační systém ho přidělil z dynamického rozsahu. | ● |
| 2 | Cílový port | Destination Port / `udp.dstport` | 16 | `5000` | desítkově (+ rozsah) | Číslo aplikace v cílovém počítači; podle něj operační systém předá data té správné aplikaci. | ● |
| 3 | Délka | Length / `udp.length` | 16 | `19` | desítkově (B) | Délka UDP datagramu v bajtech: 8 bajtů hlavičky a data. | |
| 4 | Kontrolní součet | Checksum / `udp.checksum` | 16 | `0x0609` | hex | Číslo spočítané z hlavičky, dat a obou IP adres; příjemce ho přepočítá a poškozený datagram zahodí. | |
| 5 | Data | UDP payload / `udp.payload`; strom „Data“ / `data.data` | 88 | `"Ahoj, Bobe!" (11 B)` | text + délka | Zpráva aplikace, kterou UDP doručí beze změny. | ● |

Poznámky:
- U portů malým písmem rozsah podle `udp.md` kap. 4.1: `49152 (dynamický port)`, `5000 (registrovaný
  port)`, `53 (dobře známý port: DNS)`. Na úrovni 2 se u cílového portu ukáže i jméno aplikace
  v cílovém PC: `5000 → aplikace „zprávy“ u Boba`.
- Řádek 4: tooltip „Do součtu se započítají i zdrojová a cílová IP adresa (tzv. pseudohlavička),
  ty se ale v UDP hlavičce znovu neposílají.“ Na úrovni 2 sbalené.
- Wireshark ve verzi 4.x pod UDP ukazuje i dopočtené řádky v hranatých závorkách („[Stream index]“,
  „[Timestamps]“); rentgen je **neukazuje** (nejsou v paketu).
- Odpověď Boba (rámec 4/5 vektoru): porty prohozené `5000 → 49152`. Rentgen u druhé zprávy může
  ukázat poznámku „Bob odpověděl na zdrojový port Alice“.

## 5. Data (L7)

Jeden řádek: „Data aplikace — `"Ahoj, Bobe!"` — 11 B (UTF-8)“. Bez hlavičky (rozhodnutí 1).
Pokud text obsahuje diakritiku, ukázat počet znaků i bajtů: „11 znaků, 13 B“ („Jak se máš?“).

## 6. Hexdump

Formát jako Wireshark (panel „Packet Bytes“): posun (offset) 4 hex číslice, 16 bajtů na řádek,
mezera po 8 bajtech, vpravo ASCII (netisknutelné znaky jako `.`). Barva podkladu bajtu = barva
vrstvy (L2/L3/L4/data, paleta `docs/ui.md`), výplň šedě. Klik na pole v tabulce zvýrazní jeho
bajty v hexdumpu a naopak (klik na bajt vybere pole). Bitová pole sdílí bajt (Version + IHL;
DSCP + ECN; Flags + Fragment Offset): zvýrazní se celý bajt a v tabulce oba řádky.

Rámec 1 vektoru `udp-switch` (Alice 192.168.1.10:49152 → Bob 192.168.1.20:5000, „Ahoj, Bobe!“),
spočítáno a ověřeno (oba kontrolní součty přepočtem dávají `0xFFFF`):

```
0000  02 00 00 00 00 02 02 00  00 00 00 01 08 00 45 00   ..............E.
0010  00 27 00 01 00 00 80 11  b7 56 c0 a8 01 0a c0 a8   .'.......V......
0020  01 14 c0 00 13 88 00 13  06 09 41 68 6f 6a 2c 20   ..........Ahoj,
0030  42 6f 62 65 21 00 00 00  00 00 00 00               Bobe!.......
```

Mapování bajtů na pole (posun desítkově a hex, délka v bajtech):

| Posun | Hex | B | Vrstva | Pole | Bajty | Hodnota |
|---|---|---|---|---|---|---|
| 0 | 0x00 | 6 | L2 | Cílová MAC | `02 00 00 00 00 02` | 02:00:00:00:00:02 |
| 6 | 0x06 | 6 | L2 | Zdrojová MAC | `02 00 00 00 00 01` | 02:00:00:00:00:01 |
| 12 | 0x0c | 2 | L2 | EtherType | `08 00` | 0x0800 IPv4 |
| 14 | 0x0e | 1 | L3 | Verze (horní 4 bity) + délka hlavičky (dolní 4 bity) | `45` | 4; 5 × 4 = 20 B |
| 15 | 0x0f | 1 | L3 | DSCP (horních 6 bitů) + ECN (dolní 2 bity) | `00` | 0; 0 |
| 16 | 0x10 | 2 | L3 | Celková délka | `00 27` | 39 |
| 18 | 0x12 | 2 | L3 | Identifikace | `00 01` | 1 |
| 20 | 0x14 | 2 | L3 | Příznaky (horní 3 bity) + posun části (13 bitů) | `00 00` | 000; 0 |
| 22 | 0x16 | 1 | L3 | TTL | `80` | 128 |
| 23 | 0x17 | 1 | L3 | Protokol | `11` | 17 UDP |
| 24 | 0x18 | 2 | L3 | Kontrolní součet hlavičky | `b7 56` | 0xb756 |
| 26 | 0x1a | 4 | L3 | Zdrojová IP | `c0 a8 01 0a` | 192.168.1.10 |
| 30 | 0x1e | 4 | L3 | Cílová IP | `c0 a8 01 14` | 192.168.1.20 |
| 34 | 0x22 | 2 | L4 | Zdrojový port | `c0 00` | 49152 |
| 36 | 0x24 | 2 | L4 | Cílový port | `13 88` | 5000 |
| 38 | 0x26 | 2 | L4 | Délka | `00 13` | 19 |
| 40 | 0x28 | 2 | L4 | Kontrolní součet | `06 09` | 0x0609 |
| 42 | 0x2a | 11 | L7 | Data | `41 68 6f 6a 2c 20 42 6f 62 65 21` | „Ahoj, Bobe!“ |
| 53 | 0x35 | 7 | L2 | Výplň | `00 × 7` | — |
| (60) | — | 4 | L2 | FCS | (není v hexdumpu) | nepočítá se |

Odpověď Boba (rámec 4 vektoru `udp-switch`, „Ahoj, Alice!“, 12 B dat, výplň 6 B), pro kontrolu
implementace:

```
0000  02 00 00 00 00 01 02 00  00 00 00 02 08 00 45 00   ..............E.
0010  00 28 00 01 00 00 80 11  b7 55 c0 a8 01 14 c0 a8   .(.......U......
0020  01 0a 13 88 c0 00 00 14  bb ea 41 68 6f 6a 2c 20   ..........Ahoj,
0030  41 6c 69 63 65 21 00 00  00 00 00 00               Alice!......
```
(IP Identification Boba = 1, jeho první paket; IP součet `0xb755`, UDP součet `0xbbea`.)

Didaktické body, na které hexdump navádí (otázky pro scénář, ne povinný text):
- Kde v bajtech je vidět text zprávy? (ASCII sloupec vpravo.) Data cestou nikdo nešifruje.
- `08 00` a `11`: dvě čísla „typ obsahu“, podle kterých přijímač ví, komu předat obsah
  (EtherType → Protocol → port; `model.md` kap. 5).
- `c0 a8 01 0a` = 192.168.1.10: IP adresa v paketu je jen 4 bajty, tečkový zápis je pro lidi.
- Porty `c0 00` / `13 88`: 49152 a 5000 v šestnáctkové soustavě.

Simulátor zjednodušuje (text pro UI): „Bajty ukazujeme od cílové MAC po výplň, stejně jako
Wireshark. Úvod rámce (preambule) a kontrolní číslo na konci (FCS) tu nejsou; FCS simulátor
nepočítá.“ — a k pořadí bitů (navazuje na krok 5 úrovně 1): „Bajty se zapisují v pořadí, v jakém
jdou po drátě; bity uvnitř bajtu karta vysílá od nejnižšího.“ (IEEE 802.3 klauzule 3.3, ověřit číslo.)

## 7. Rentgen na hubu a switchi (úroveň 2)

- Rentgen ukazuje rámec **na zvolené lince** (pohled jako Wireshark na tom kabelu). Hub ani switch
  rámec nemění, proto je rentgen na všech linkách téže cesty stejný. To je samo o sobě učivo:
  „switch přečte cílovou MAC, ale nic v rámci nepřepíše“.
- U uzlu PC, které rámec zahodilo (`nic_drop`), rentgen ukáže jen blok Ethernet II se
  zvýrazněnou cílovou MAC a textem „Cílová MAC není moje ani broadcast: síťová karta rámec
  zahodila, IP paket uvnitř nikdo nečte.“ Bloky L3/L4 sbalené (šedě, „nečte se“).
- Na switchi rentgen nad tabulkou ukáže krátký „rozhodovací“ řádek: „Switch čte jen hlavičku L2:
  zdrojová MAC → naučit na port Fa0/1; cílová MAC 02:00:00:00:00:02 v tabulce není → flooding“.
  (Události `mac_learn`, `flood`, `forward` z vektoru.)
