# TCP (Transmission Control Protocol)

Stav: návrh, iterace 4 (úroveň 4 „Transport a aplikace“, rozhodnutí 59). Autor: projektant.
Zdroj: **RFC 9293** (TCP, 2022, nahrazuje RFC 793), RFC 6298 (RTO), RFC 6528 (ISN), RFC 9110/9112
(HTTP nad TCP). Wireshark 4.x pro názvy polí. Vektory: `dns-dotaz` (UDP), `tcp-handshake-http`,
`tcp-ztrata-retransmise`; generátor `tools/vectors/gen5.py`.

## 1. Co úroveň 4 ukazuje

TCP je **spojovaný** (nejdřív se domluví spojení, three-way handshake) a **spolehlivý** (každý bajt má
číslo, příjemce potvrzuje, co dostal, nepotvrzená data se pošlou znovu). UDP nic z toho nedělá
(`udp.md`). Spojení určuje čtveřice **zdrojová IP:port + cílová IP:port** (dva sockety, RFC 9293
kap. 3.3.1 „connection is fully specified by the pair of sockets“).

Simulátor modeluje jen to, co děj úrovně 4 potřebuje: navázání, přenos jednoho požadavku a odpovědi,
potvrzování, jednu retransmisi, ukončení. **Neřeší:** řízení zahlcení (slow start, cwnd), Nagle,
delayed ACK, selektivní potvrzování (SACK), škálování okna, časová razítka, urgentní data,
souběžné otevření, RST kromě kap. 7.3, keep-alive.

## 2. Hlavička — pole pro rentgen (RFC 9293 kap. 3.1)

Pořadí na drátě. Délka v bitech. „Z“ = zvýraznit na úrovni 4.

| # | Česky | Wireshark / filtr | Bity | Výchozí hodnota v simulaci | Vysvětlení pro studenta | Z |
|---|---|---|---|---|---|---|
| 1 | Zdrojový port | Source Port / `tcp.srcport` | 16 | klient: dynamický od 49152 (kap. 6) | Port aplikace, která segment posílá. | ● |
| 2 | Cílový port | Destination Port / `tcp.dstport` | 16 | 80 (web) | Podle něj OS předá data správné aplikaci. | ● |
| 3 | Číslo sekvence | Sequence Number / `tcp.seq` (relativní), `tcp.seq_raw` | 32 | ISN + počet už odeslaných bajtů (kap. 4) | Pořadové číslo prvního bajtu dat v segmentu. SYN a FIN zaberou každý 1 číslo. | ● |
| 4 | Číslo potvrzení | Acknowledgment Number / `tcp.ack` (relativní), `tcp.ack_raw` | 32 | číslo dalšího bajtu, který odesílatel čeká | „Všechno před tímto číslem mám.“ Platí jen s příznakem ACK (jinak 0). | ● |
| 5 | Délka hlavičky | Header Length / `tcp.hdr_len` | 4 | 6 (= 24 B) v SYN a SYN, ACK, jinak 5 (= 20 B) | Počet 32bitových slov hlavičky (RFC: Data Offset). Wireshark ukazuje v bajtech. | |
| 6 | Rezervováno | Reserved / `tcp.flags.res` | 4 | 0 | Pro budoucí použití. (Wireshark 4.x ukazuje 3 bity + AE — RFC 9768, Accurate ECN.) | |
| 7 | Příznaky | Flags / `tcp.flags` | 8 | podle kap. 3 | CWR, ECE, URG, **ACK**, **PSH**, RST, **SYN**, **FIN** (od nejvyššího bitu). Ve Wiresharku zkratkou `[SYN, ACK]`. | ● |
| 8 | Okno | Window / `tcp.window_size_value` | 16 | 64240 | Kolik bajtů je příjemce ještě ochoten přijmout. Úroveň 4 jen zobrazuje. | |
| 9 | Kontrolní součet | Checksum / `tcp.checksum` | 16 | počítá se (kap. 2.1) | Jako u UDP, včetně pseudohlavičky; u TCP povinný. | |
| 10 | Urgentní ukazatel | Urgent Pointer / `tcp.urgent_pointer` | 16 | 0 | Používá se jen s URG (dnes prakticky nikdy). | |
| 11 | Volby | Options / `tcp.options` | 0–320 | jen v SYN a SYN, ACK: MSS (32 bitů) | Volby domluvené při navázání spojení. | |
| 12 | Data | TCP payload / `tcp.payload` | 8 × N | HTTP požadavek nebo odpověď | Data aplikace; délku hlavička neobsahuje — dopočítá se z IP Total Length. | ● |

**Volba MSS** (RFC 9293 kap. 3.7.1; formát kap. 3.2): Kind = 2 (8 bitů), Length = 4 (8 bitů),
Maximum Segment Size (16 bitů) = **1460** (MTU 1500 − 20 IP − 20 TCP). Posílá se jen v segmentu se SYN.
Wireshark: „Maximum segment size: 1460 bytes“.

Simulátor zjednodušuje: SYN nese jen volbu MSS (hlavička 24 B). Windows posílá v SYN i Window Scale
a SACK Permitted s výplní NOP (hlavička 32 B), Linux i Timestamps (ověřit Wiresharkem při pilotu).
Okno 64240 (= 44 × 1460) se nemění a neškáluje; skutečné okno se během spojení mění a díky Window
Scale (RFC 7323) bývá větší než 65 535 B. Nic z toho se student nemusí odnaučit.

Rentgen nezobrazuje dopočtené řádky Wiresharku v hranatých závorkách (`[Stream index]`, `[TCP Segment
Len]`, `[Next Sequence Number]`) s jedinou výjimkou: **délka dat segmentu** se ukáže u pole Data
(„76 B“), protože bez ní nejde pochopit, o kolik se zvýší číslo potvrzení.

### 2.1 Kontrolní součet a pseudohlavička (RFC 9293 kap. 3.1, „Checksum“)

Jedničkový doplněk součtu 16bitových slov (RFC 1071) přes **pseudohlavičku + TCP hlavičku + data**
(lichá délka se doplní nulovým bajtem jen pro výpočet; pole Checksum se při výpočtu počítá jako 0).
Pseudohlavička (96 bitů, neposílá se): zdrojová IP (32), cílová IP (32), nuly (8), protokol = 6 (8),
délka TCP segmentu = hlavička + data v bajtech (16). Stejný algoritmus jako UDP (`udp.md` kap. 3),
rozdíl: u TCP **nesmí** být vynechán (u UDP/IPv4 smí být 0).

## 3. Příznaky použité v úrovni 4

| Příznak | Význam | Kdy |
|---|---|---|
| SYN | „Chci spojení, moje počáteční číslo sekvence je …“ | 1. a 2. segment handshaku |
| ACK | Pole Číslo potvrzení platí. | **Ve všech segmentech kromě úplně prvního SYN** (RFC 9293 kap. 3.10.7: po navázání se ACK posílá vždy) |
| PSH | „Předej data aplikaci hned.“ | Segment, který nese poslední část dat jednoho zápisu aplikace (kap. 3.9.1; tak to dělají Windows i Linux) |
| FIN | „Už nebudu nic posílat.“ | Ukončení, kap. 8 |
| RST | Zrušení spojení | Jen kap. 7.3 (zavřený port) |

## 4. Čísla sekvence a ISN

- Každý bajt dat má číslo. `seq` segmentu = číslo prvního bajtu dat; SYN a FIN zaberou každý jedno
  číslo, i když nenesou data (RFC 9293 kap. 3.4). Příjemce odpoví `ack` = číslo dalšího očekávaného
  bajtu (kumulativní potvrzení). Aritmetika je modulo 2^32.
- **ISN** (Initial Sequence Number) volí každá strana sama. RFC 9293 kap. 3.4.1 a RFC 6528:
  ISN = M + F(lokální IP, lokální port, vzdálená IP, vzdálený port, tajný klíč), M = hodiny s krokem 4 µs.
  Proto má každé spojení jiné, nepředvídatelné ISN (ochrana proti podvržení segmentů).
- **Simulátor zjednodušuje:** ISN = **FNV-1a 32 bitů** z UTF-8 řetězce
  `"<seed>|<lokální IP>:<lokální port>|<vzdálená IP>:<vzdálený port>"` (seed scénáře, výchozí 1;
  FNV-1a: h = 0x811C9DC5; pro každý bajt h = (h XOR bajt) × 0x01000193 mod 2^32). Je to obdoba
  funkce F z RFC 6528 bez hodin: deterministické, ale „náhodně vypadající“ číslo. Pro seed 1:
  Alice `192.168.1.10:49152|192.168.2.10:80` → **4108129950**, SRV1 `192.168.2.10:80|192.168.1.10:49152`
  → **3681155042** (`gen5.py` je počítá stejně).
- **Relativní čísla v rentgenu:** jako Wireshark (výchozí volba „Relative sequence numbers“): relativní
  = absolutní − ISN té strany, takže SYN má relativní seq 0, první bajt dat 1. Rentgen ukazuje relativní
  číslo velkým písmem a pod ním absolutní („Wireshark: Sequence Number (raw)“). U `ack` se odečítá ISN
  protější strany. Poznámka v UI: „Relativní čísla počítá Wireshark (a simulátor) pro přehlednost;
  na drátě je jen absolutní číslo.“

## 5. Okno a MSS

Okno (Window) = kolik bajtů smí protější strana poslat bez potvrzení (řízení toku, RFC 9293 kap. 3.8.6).
Úroveň 4 ho **jen zobrazuje** (64240 ve všech segmentech, kap. 2). MSS omezuje velikost dat v jednom
segmentu; HTTP odpověď (249 B) se vejde do jednoho segmentu, takže dělení dat se v úrovni 4 neukazuje
(Simulátor zjednodušuje: data delší než MSS by se rozdělila do více segmentů — implementovat jen
pro případné budoucí scénáře, vektor to nevyžaduje).

## 6. Porty a sockety

- Server: aplikace „web“ naslouchá na TCP 80 (`LISTEN`), DNS server i na TCP 53 (DNS používá TCP pro
  velké odpovědi a přenos zóny, RFC 7766). Naslouchající socket se při spojení nemění; vzniká **nové
  spojení** se čtveřicí adres (proto `netstat` ukáže LISTEN i ESTABLISHED na stejném portu 80).
- Klient: dynamický port od 49152 jako u UDP (`udp.md` kap. 4.2, rozhodnutí 28), **čítač zvlášť
  pro TCP a pro UDP** (Windows má oba rozsahy oddělené, KB 929851). Proto DNS dotaz i TCP spojení
  Alice začínají na 49152. Port se po zavření spojení neuvolní hned: drží ho TIME-WAIT (kap. 9),
  další spojení dostane 49153.

## 7. Spolehlivost: potvrzení a retransmise

### 7.1 Potvrzení
- Každý přijatý segment s daty, SYN nebo FIN se potvrdí segmentem s ACK.
- **Simulátor zjednodušuje:** ACK se posílá **hned** a samostatně (pokud uzel nemá v tu chvíli co
  poslat, viz kap. 8). Skutečné systémy používají delayed ACK (RFC 9293 kap. 3.8.6.3, RFC 1122 4.2.3.2:
  až 500 ms, Windows a Linux typicky do 200 ms) a potvrzení často přibalí k datům. Student uvidí ve
  Wiresharku méně samostatných ACK; princip je stejný.

### 7.2 Retransmise (RFC 6298)
- Odesílatel si pamatuje nepotvrzená data a spustí časovač **RTO**. Když vyprší a data stále nejsou
  potvrzena, pošle **stejný segment znovu** (stejné seq, stejná data) a RTO zdvojnásobí (exponential
  backoff, RFC 6298 kap. 5.5). Po úspěšném potvrzení se časovač zastaví.
- Příjemce, který dostane segment se seq, který už má, ho zahodí a znovu pošle ACK (duplikát se
  aplikaci nepředá dvakrát).
- **Simulátor zjednodušuje:** RTO = **1 s** pro první opakování (minimum podle RFC 6298 kap. 2.4;
  1 s = 1000 kroků, `model.md` kap. 7), pak 2, 4, 8, 16 s; po **5 neúspěšných opakováních** se spojení
  zruší (aplikace dostane chybu „spojení přerušeno“). Skutečný RTO se počítá z naměřeného RTT
  (SRTT, RTTVAR), Linux má minimum 200 ms; Windows a Linux mají počet opakování nastavitelný
  (ověřit výchozí hodnoty: Windows TcpMaxDataRetransmissions 5, Linux `tcp_retries2` 15).
  Fast retransmit (3 duplicitní ACK) se neukazuje.
- Ztrátu vyvolá scénář akcí `link_loss` (`vektory.md` kap. 10); linky samy nic neztrácejí (`model.md` kap. 8).

### 7.3 Spojení na zavřený port
SYN na port, kde nikdo nenaslouchá → odpověď **RST, ACK** (seq 0, ack = seq SYN + 1; RFC 9293
kap. 3.10.7.1). Klient hlásí chybu (curl: `Failed to connect … Connection refused`, ověřit).
Simulátor zjednodušuje: Windows po RST zkouší SYN ještě dvakrát (ověřit), simulátor ne. Ve vektorech
úrovně 4 se nevyskytuje.

## 8. Průběh spojení v úrovni 4 (vektor `tcp-handshake-http`)

Alice 192.168.1.10:49152 → SRV1 192.168.2.10:80, ISN Alice = a, ISN SRV1 = s; LQ = 76 B požadavku,
LR = 249 B odpovědi (`http.md`). Relativní čísla (seq / ack):

| # | Kdo | Příznaky | seq | ack | Data | Stav po odeslání / přijetí |
|---|---|---|---|---|---|---|
| 1 | Alice | SYN (+MSS) | 0 | — (0) | — | Alice SYN-SENT; SRV1 SYN-RECEIVED |
| 2 | SRV1 | SYN, ACK (+MSS) | 0 | 1 | — | Alice ESTABLISHED |
| 3 | Alice | ACK | 1 | 1 | — | SRV1 ESTABLISHED |
| 4 | Alice | PSH, ACK | 1 | 1 | GET (76 B) | |
| 5 | SRV1 | ACK | 1 | 77 | — | |
| 6 | SRV1 | PSH, ACK | 1 | 77 | 200 OK (249 B) | |
| 7 | Alice | ACK | 77 | 250 | — | |
| 8 | Alice | FIN, ACK | 77 | 250 | — | Alice FIN-WAIT-1; SRV1 CLOSE-WAIT |
| 9 | SRV1 | ACK | 250 | 78 | — | Alice FIN-WAIT-2 |
| 10 | SRV1 | FIN, ACK | 250 | 78 | — | SRV1 LAST-ACK; Alice TIME-WAIT |
| 11 | Alice | ACK | 78 | 251 | — | SRV1 CLOSED (LISTEN na :80 trvá) |

- Kdo zavírá: **klient** (curl) hned, jak má celé tělo podle `Content-Length` (`http.md` kap. 4).
  Proto TIME-WAIT vidí student u Alice v `netstat -an`.
- Ukončení je ve **4 segmentech** (FIN, ACK, FIN, ACK — jak ho kreslí CCNA): server jádro potvrdí FIN
  hned, aplikace web pak zavře socket a jádro pošle vlastní FIN. Na skutečném provozu bývají ACK a FIN
  serveru často v jednom segmentu (3 segmenty); obojí je podle RFC 9293 kap. 3.6 správně.
- Segment 3 (ACK) a 4 (GET) posílá Alice po sobě; obdobně 5+6, 7+8, 9+10. Viz pravidlo fronty v kap. 10.

## 9. Stavy (jen ty, které úroveň 4 ukáže; RFC 9293 kap. 3.3.2)

| Stav RFC | Windows `netstat` | Linux `ss` | Kde v úrovni 4 |
|---|---|---|---|
| LISTEN | LISTENING | LISTEN | SRV1 :80, :53 |
| SYN-SENT | SYN_SENT | SYN-SENT | Alice po SYN |
| SYN-RECEIVED | SYN_RECEIVED | SYN-RECV | SRV1 po SYN |
| ESTABLISHED | ESTABLISHED | ESTAB | obě strany po handshaku |
| FIN-WAIT-1 | FIN_WAIT_1 | FIN-WAIT-1 | Alice po FIN |
| FIN-WAIT-2 | FIN_WAIT_2 | FIN-WAIT-2 | Alice po ACK svého FIN |
| CLOSE-WAIT | CLOSE_WAIT | CLOSE-WAIT | SRV1 po FIN Alice |
| LAST-ACK | LAST_ACK | LAST-ACK | SRV1 po svém FIN |
| TIME-WAIT | TIME_WAIT | TIME-WAIT | Alice po FIN serveru |
| CLOSED | (řádek zmizí) | (řádek zmizí) | |

CLOSING (souběžné ukončení) se nevyskytuje. Ve vektorech (`tcp_connections`) se píšou názvy RFC.

**TIME-WAIT:** strana, která zavírala první, čeká **2 × MSL**, aby zachytila opakovaný FIN, kdyby se
její poslední ACK ztratil, a aby se staré segmenty nepletly do nového spojení se stejnou čtveřicí
(RFC 9293 kap. 3.6, MSL = 2 min podle kap. 3.4.2). Windows: 120 s (`TcpTimedWaitDelay`, ověřit),
Linux: 60 s pevně. **Simulátor zjednodušuje:** TIME-WAIT trvá 120 s simulovaného času na PC i serveru
a UI ho může přeskočit tlačítkem („počkej 2 minuty“); během TIME-WAIT na opakovaný FIN odpoví ACK.

## 10. Pravidla pro jádro a vektory

- Topologie a adresy úrovně 4: `routing.md` kap. 9. ARP cache a MAC tabulky ve vektorech úrovně 4 jsou
  předvyplněné (stav po předchozím provozu, uvedeno v `description` vektoru).
- **Fronta rozhraní:** uzel pošle po jedné lince nejvýš jeden rámec za krok; další rámec téhož uzlu
  na téže lince jde v následujícím kroku (ACK v kroku 9, GET v kroku 10).
- Pořadí, kdy uzel posílá dva segmenty po sobě: nejdřív potvrzení, pak nová data / FIN.
- Vektor kontroluje v `pdu.tcp`: `sport`, `dport`, `seq`, `ack`, `rel_seq`, `rel_ack`, `flags`
  (řetězec v pořadí Wiresharku: `"SYN"`, `"SYN, ACK"`, `"ACK"`, `"PSH, ACK"`, `"FIN, ACK"`, `"RST, ACK"`),
  `hdr_len` (B), `window`, `payload_len`, `options` (jen SYN). `ip.protocol` = 6.
- Délky: SYN 24 B TCP → IP 44 B → rámec 58 → **60 B s výplní**; samotný ACK/FIN 20 → 40 → 60 B
  s výplní; GET 20 + 76 → IP 116 → rámec 130 B; 200 OK 20 + 249 → IP 289 → rámec 303 B.
- Události (informativní): `tcp_state` (detail „starý → nový stav“), `tcp_retransmit`, `link_loss`,
  `http_request`, `http_response`.

## 11. Mimo rozsah úrovně 4

Řízení zahlcení, SACK, Window Scale a Timestamps (RFC 7323), Nagle, delayed ACK, keep-alive,
souběžné otevření a zavření, RST při chybě aplikace, half-close s dalšími daty, MSS clamping na routeru,
fragmentace. TCP s NAT: úroveň 5.
