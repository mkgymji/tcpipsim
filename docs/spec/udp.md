# UDP (User Datagram Protocol)

Stav: návrh, iterace 2 (úroveň 2 „Adresy“). Zdroje: RFC 768 (celý, je to jedna strana),
RFC 1122 4.1 (požadavky na hostitele: 4.1.3.1 porty, 4.1.3.4 kontrolní součet), RFC 6335 kap. 6
(rozsahy portů), RFC 1071 (výpočet kontrolního součtu), Microsoft KB 929851 (dynamické porty ve
Windows). Ověřeno na rfc-editor.org a learn.microsoft.com 2026-11-24.

## 1. Účel a místo v modelu

- UDP je protokol transportní vrstvy (L4). Přidává k IP jen dvě věci: **porty** (podle cílového
  portu operační systém předá data správné aplikaci) a volitelný **kontrolní součet**.
- Bez spojení, bez potvrzování, bez opakování, bez řízení toku. Datagram, který se ztratí, se
  ztratí; to řeší (nebo neřeší) aplikace.
- PDU se jmenuje **UDP datagram** (RFC 768 „user datagram“). CCNA (ITN) používá pro PDU L4 obecně
  „segment“, proto je na úrovni 1 obálka L4 „segment“ správně; od úrovně 2, kde je vidět protokol,
  říká štítek i rentgen „UDP datagram“ (slovník: datagram). Na L3 se dál říká „paket“.
- V IP paketu: Protocol = **17** (RFC 768; IANA Protocol Numbers).
- Rozhodnutí 13: úroveň 2 ukazuje porty na jednoduché aplikaci „zprávy“ nad UDP (Alice → Bob),
  ping (ICMP, bez portů) až od úrovně 3.

## 2. Hlavička — pole pro rentgen (RFC 768, „Format“)

Hlavička má vždy **8 bajtů**, žádné volby.

| Pole (RFC 768) | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|
| Source Port | 16 | port odesílající aplikace; kam má jít případná odpověď | klient: dynamický port od 49152 (kap. 4); server: jeho pevný port |
| Destination Port | 16 | port cílové aplikace; podle něj OS předá data aplikaci | port, na kterém cílová aplikace naslouchá (scénář; „zprávy“ = 5000) |
| Length | 16 | délka celého UDP datagramu v bajtech: hlavička (8) + data | `8 + délka dat v bajtech`; minimum 8 |
| Checksum | 16 | kontrolní součet pseudohlavičky, hlavičky a dat (kap. 3) | počítá se skutečně (RFC 1071) |
| Data | proměnná | data aplikace | text zprávy v UTF-8 |

- Source Port je podle RFC 768 volitelný („If not used, a value of zero is inserted“). Simulátor
  ho vždy vyplní (tak to dělají všechny běžné OS u socketů; nula by znemožnila odpověď).
- **Length je v bajtech, ne ve znacích.** Text v UTF-8: ASCII znak = 1 bajt, `á`, `š`, `ř` = 2 bajty.
  „Ahoj, Bobe!“ = 11 B, „Jak se máš?“ = 13 B. Simulátor počítá délky z UTF-8 kódování.
- Délka UDP datagramu je uvedená dvakrát: v UDP Length a nepřímo v IP Total Length
  (= 20 + UDP Length). Obě musí souhlasit.

## 3. Kontrolní součet a pseudohlavička

RFC 768: „Checksum is the 16-bit one's complement of the one's complement sum of a pseudo header
of information from the IP header, the UDP header, and the data, padded with zero octets at the
end (if necessary) to make a multiple of two octets.“

**Pseudohlavička** (12 bajtů, IPv4) se **neposílá**, jen se započítá do součtu:

| Pole | Délka (bity) | Hodnota |
|---|---|---|
| Source Address | 32 | zdrojová IP z IP hlavičky |
| Destination Address | 32 | cílová IP z IP hlavičky |
| Zero | 8 | `0` |
| Protocol | 8 | `17` |
| UDP Length | 16 | stejná hodnota jako pole Length |

Pravidla:
- Při výpočtu je pole Checksum nulové; data s lichou délkou se pro výpočet doplní jedním nulovým
  bajtem (ten se neposílá).
- Vyjde-li součet `0x0000`, posílá se `0xFFFF` (RFC 768). Hodnota `0x0000` v paketu znamená
  „odesílatel součet nepočítal“.
- RFC 1122 4.1.3.4: hostitel MUSÍ umět součet počítat i kontrolovat a výchozí stav je „počítat“.
  Datagram s nenulovým chybným součtem MUSÍ tiše zahodit. Simulátor počítá vždy; chybný součet
  v simulaci nenastává (linky nedělají chyby).
- Proč pseudohlavička: součet tak chrání i to, že datagram došel na **správnou IP adresu** se
  správným protokolem. Je to porušení čistého rozvrstvení (L4 čte údaje L3) a je to tak záměrně;
  pro rentgen dobrý doplňující bod (úroveň 4), na úrovni 2 se jen zmíní.
- Pozor: v zachyceném provozu na odesílajícím PC Wireshark často ukáže chybný nebo nulový UDP
  součet, protože ho počítá až síťová karta (checksum offload). Simulátor offload nemá.

Ověřený příklad (rámec 1 vektoru `udp-switch`, hexdump v `rentgen.md` kap. 6): 192.168.1.10:49152 →
192.168.1.20:5000, data „Ahoj, Bobe!“, Length 19 → Checksum `0x0609`; přepočet přes pseudohlavičku,
hlavičku a data dává `0xFFFF` (tj. správně).

## 4. Porty

### 4.1 Rozsahy (IANA, RFC 6335 kap. 6)

| Rozsah | Název IANA (RFC 6335) | Jak se říká v praxi / CCNA | Příklady |
|---|---|---|---|
| 0–1023 | System Ports | well-known ports, „dobře známé porty“ | DNS 53 (UDP i TCP), DHCP 67/68 (UDP), HTTP 80 (TCP), HTTPS 443 |
| 1024–49151 | User Ports | registered ports, registrované porty | 3389 RDP, 5000 (aplikace „zprávy“ ve scénáři) |
| 49152–65535 | Dynamic Ports | dynamic / private / ephemeral ports, dynamické (dočasné) porty | zdrojový port klienta |

- Port 0 je rezervovaný; aplikace ho jako cílový port nepoužívá. (V API socketů `bind(port 0)`
  znamená „přiděl mi dynamický port“, do paketu se 0 nedostane.)
- Rozsahy jsou dohoda pro **přidělování** IANA, ne technické omezení: aplikace může naslouchat na
  libovolném portu; na Linuxu porty pod 1024 vyžadují oprávnění správce.
- UDP port a TCP port se stejným číslem jsou různé věci (různé „schránky“ v OS); IANA je obvykle
  přiděluje oběma protokolům stejně.

### 4.2 Dynamický (zdrojový) port klienta

- **Windows** (od Vista / Server 2008, tedy i 10/11): dynamický rozsah **49152–65535** zvlášť pro
  TCP a UDP, podle doporučení IANA (KB 929851). Zobrazí `netsh int ipv4 show dynamicport udp`.
  Starší Windows (XP, 2003) používala 1025–5000.
- Linux: `net.ipv4.ip_local_port_range`, výchozí 32768–60999 (ověřit pro aktuální jádra).
- **Simulátor zjednodušuje:** dynamický port přiděluje deterministicky: první volný port od 49152
  na daném uzlu (pro všechny profily OS, i `server`). Skutečné OS volí port náhodně
  (randomizace portů, RFC 6056), takže ve Wiresharku student uvidí jiná čísla, ale vždy ze
  správného rozsahu. Seed scénáře může počáteční hodnotu změnit.

### 4.3 Socket a demultiplexing

- Socket = IP adresa + port (+ protokol). UDP socket aplikace je svázaný (`bind`) s portem.
- Příjem: OS přijme datagram (IP adresa je jeho), podívá se na **cílový port** a předá data aplikaci,
  která má socket s tímto portem. Zdrojová IP a zdrojový port se aplikaci předají spolu s daty
  (Python `recvfrom` vrací `(data, (ip, port))`), aby mohla odpovědět.
- Odpověď: aplikace pošle datagram na **zdrojovou IP a zdrojový port** přijatého datagramu; v
  odpovědi jsou porty prohozené (zdrojový 5000, cílový 49152).
- Na jednom počítači může běžet víc aplikací, každá na jiném portu (vektory i scénář: Bob má „zprávy“ na 5000
  a „poznámky“ na 6000, rozhodnutí 29); stejná IP, stejná MAC, rozhoduje port.
- **Žádná aplikace na cílovém portu** (zavřený port): RFC 1122 4.1.3.1 „UDP SHOULD send an ICMP
  Port Unreachable message“ (typ 3, kód 3). Na úrovni 2 se nevyskytuje (scénáře posílají jen na
  otevřené porty); přijde s úrovní 4 (viz `didaktika.md`, odpověď projektanta 3). Do té doby:
  datagram na zavřený port jádro zahodí s událostí `udp_no_listener` a ICMP neposílá
  (Simulátor zjednodušuje: …, označit v UI, pokud by to scénář umožnil).

## 5. Aplikace „zprávy“ (scénář úrovně 2)

Smyšlená jednoduchá aplikace, odpovídá Python ukázce se `socket.SOCK_DGRAM`:

- Server (Bob): socket UDP svázaný s portem 5000; po přijetí zprávy volitelně hned odpoví
  textem nastaveným ve scénáři (`auto_reply`) na adresu a port odesílatele.
- Klient (Alice): socket UDP bez explicitního portu; OS mu při prvním odeslání přidělí dynamický
  port (49152). Odpověď přijde na tento port.
- V datech vektoru: `topology.nodes[].apps[]` (`vektory.md` kap. 2), akce `udp_send`.
- Data aplikace nemají žádnou hlavičku L7, jen text v UTF-8 (rozhodnutí 1, `model.md`).

Proč port 5000: leží v registrovaném rozsahu (aplikace serveru nemá být v dynamickém rozsahu,
kolidovala by s klienty) a navazuje na úroveň 1 (`scenarios/uroven1-zapouzdreni.js`). Port 5000
není rezervovaný pro žádnou známou službu, kterou by student na úrovni 2 znal.

## 6. Odeslání a příjem (jádro)

Odeslání (`udp_send` z aplikace na uzlu U, cíl `D:dport`, data):
1. Je-li socket aplikace bez portu, přidělit dynamický port (kap. 4.2).
2. UDP: Length = 8 + délka dat, Checksum podle kap. 3 (potřebuje zdrojovou a cílovou IP).
3. Předat IP vrstvě: Protocol 17, cíl D (`ipv4.md` kap. 4; MAC dalšího skoku z ARP cache, na
   úrovni 2 předvyplněné, rozhodnutí 14).

Příjem (IP předá obsah s Protocol 17):
1. Kontrola: Length ≥ 8 a ≤ délka dat IP; nenulový chybný součet → tiše zahodit.
2. Najít socket podle cílového portu → předat data aplikaci (událost `udp_deliver`, detail
   „port 5000 → aplikace zprávy“). Žádný socket → `udp_no_listener` (kap. 4.3).

## 7. Velikosti v rámci (pro vektory a rentgen)

```
rámec = 14 (Ethernet II) + 20 (IPv4 bez voleb) + 8 (UDP) + data  [+ výplň do 60 B]
IP Total Length = 28 + data;  UDP Length = 8 + data
```
Data kratší než 18 B se v rámci doplní výplní (padding) na 60 B (bez FCS, `ethernet.md` kap. 2).
„Ahoj, Bobe!“ (11 B): UDP 19, IP 39, rámec 53 + 7 B výplň = 60 B.

## 8. Mimo rozsah úrovně 2

Fragmentace velkých datagramů, broadcast a multicast UDP (DHCP přijde později), UDP-Lite,
UDP nad IPv6 (tam je součet povinný, RFC 8200), `connect()` na UDP socketu, ICMP Port
Unreachable (úroveň 4), firewall (úroveň 5).
