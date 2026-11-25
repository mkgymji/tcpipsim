# Scénář úrovně 4: Transport a aplikace

Text pro implementaci. Stav: návrh didaktika (iterace 4), čeká na sjednocení s projektantem. Platí `docs/rozhodnuti.md`
(hlavně 5, 31, 37, 38, 49–59) a `docs/spec/` (budoucí `tcp.md`, `udp.md`, `dns.md`, `http.md`). Texty v uvozovkách jsou
texty simulátoru (oslovení „ty“). Terminál vypisuje anglicky (rozh. 10). Číslování kroků je návrhové.

Každý krok má dva údaje navíc (rozh. 56 a 57):
- **Ohnisko:** `tip` | `rentgen` | `topologie` | `vrstvy` | `terminal` (kam se má student dívat).
- **Vpravo:** uzel, o kterém krok mluví (sloupec příjemce). Kde se uzel v kroku mění, je to v textu kroku výslovně
  („Mezitím u SRV1: …“).

## Cíl a nová myšlenka

**TCP je spojovaný a spolehlivý, UDP ne. Aplikace se najde podle socketu: IP adresa + port.**

Úroveň 3 skončila u „paket dojde ke správnému počítači“. Úroveň 4 odpovídá na otázku, která tam zůstala: **kterému
programu v počítači?** A druhá otázka: **co když se segment cestou ztratí?** Student sleduje, co se stane, když Alice
napíše do prohlížeče `http://www.skola.lan`: DNS (UDP) → handshake → HTTP GET a odpověď (TCP) → ukončení spojení.

Výukové cíle: viz `docs/didaktika.md`, úroveň 4. Student po úrovni:
1. vysvětlí, k čemu je port a že socket = IP:port (Michal);
2. rozliší UDP (nespojovaný, nespolehlivý) a TCP (spojovaný, spolehlivý) a ke každému uvede příklad;
3. rozepíše three-way handshake a řekne, proč jsou **tři** kroky a co se v nich domlouvá (sekvenční čísla);
4. ví, že HTTP je zpráva (data) uvnitř TCP segmentu, ne protokol „vedle“ TCP;
5. vysvětlí, jak server rozliší víc spojení od jednoho klienta (porty klienta);
6. přečte `netstat -an` (LISTENING, ESTABLISHED, TIME_WAIT);
7. (volitelně) vysvětlí, co TCP udělá při ztrátě segmentu, a proč UDP nic.

Úroveň zavádí **jednu** novou myšlenku (transportní vrstva rozlišuje aplikace a volitelně zajišťuje spolehlivost);
aplikační protokoly (DNS, HTTP) jsou jen „co se po tom spojení posílá“.

## Parametry scénáře (měnit na jednom místě)

Topologie úrovně 3 (Alice, Cyril, SW1, R1, Bob) plus SRV1 v síti 2 (rozh. 59). Hodnoty absolutních sekvenčních čísel
a portů potvrdí projektant (návrh níže).

| Uzel | MAC | IP / prefix | Služby, poznámka |
|---|---|---|---|
| Alice (PC) | `02:00:00:00:00:01` | 192.168.1.10/24, brána 192.168.1.1, **DNS server 192.168.2.10** | klient; TTL 128; prohlížeč |
| SRV1 (server) | `02:00:00:00:00:04` | 192.168.2.10/24, brána 192.168.2.1 | Linux, TTL 64; **DNS UDP 53**, **web TCP 80**; jméno `www.skola.lan` = 192.168.2.10 |
| Bob (PC) | `02:00:00:00:00:02` | 192.168.2.20/24, brána 192.168.2.1 | druhý klient (krok 21); aplikace z úrovně 2 |
| R1, SW1, Cyril | jako v úrovni 3 | | Cyril je ve scénáři statista (viz krok 0) |

- Síť 2 má teď dva uzly (Bob, SRV1); **spojení mezi R1 a oběma uzly zajišťuje SW2** (otevřená otázka O1).
- **ARP tabulky jsou předvyplněné** (Alice zná MAC brány, R1 zná MAC SRV1 a Boba, SRV1 zná MAC brány). ARP je téma
  úrovně 3; tady by jen odváděl pozornost. Simulátor zjednodušuje: „ARP už proběhl (úroveň 3), tabulky jsou plné.“
- **Cesta přes R1** (Alice → R1 → SRV1) se animuje jako v úrovni 3, ale bez zastavení u R1 (paket projde); rentgen u každého
  segmentu ukazuje, že IP adresy zůstávají a MAC se mění. Student ji má v živé paměti, tady není nová. Každý segment
  nese štítek „zdroj → cíl“ jako **socket** (`192.168.1.10:49731 → 192.168.2.10:80`).
- Porty (návrh): DNS dotaz Alice zdrojový UDP 52114 → 53. První spojení Alice zdrojový TCP 49731 → 80; po uzavření
  nová spojení 49732 a 49733; Bob 51200 → 80.
- Sekvenční čísla (návrh): Alice ISN `2 837 411 906`, SRV1 ISN `905 112 337`. **Rentgen ukazuje relativní hodnoty** (0, 1, 1 + délka),
  absolutní jsou za přepínačem „skutečná čísla“ (jako Wireshark). Student počítá s relativními.
- Data: požadavek `GET / HTTP/1.1` + `Host: www.skola.lan` (zhruba 80 bajtů, v rentgenu přesná délka); odpověď
  `HTTP/1.1 200 OK` + krátká stránka (jeden segment, délka v rentgenu). Simulátor zjednodušuje: „Stránka se vejde do jednoho segmentu; velké stránky se dělí na víc segmentů.“

## Kroky

Číslování `0–31`. **Tip (rozh. 31, 51, 58)** = samostatný krok se stavem před událostí, nadpis „Otázka: …“, přehrávání se zastaví,
další krok vyhodnotí jednou větou. Nadpisy kroků **před** tipem jsou neutrální (rozh. 51).

Doporučené dělení pro učitele (lze skončit po kterékoli části):

| Část | Kroky | Obsah | Hotovo, když student zná… |
|---|---|---|---|
| A | 0–5 | DNS dotaz přes UDP | jméno → IP; UDP bez spojení; porty 53 a náhodný zdrojový |
| B | 6–10 | TCP handshake | proč tři kroky, co jsou sekvenční čísla |
| C | 11–18 | HTTP GET, odpověď, ukončení | HTTP = data v TCP; potvrzování; FIN, TIME_WAIT |
| D | 19–24 | Socket, multiplex, zavřený port | jak server rozliší spojení; port není „díra“ |
| E | 25–26 | UDP × TCP, shrnutí | Michalovo L4 a) / b) |
| F | 27–31 | Ztráta segmentu (volitelná) | timeout a retransmise; UDP ztrátu neřeší |

**Jádro = A + B + C (kroky 0–18); D–E rozšiřují, F je volitelná.**

### Část A: DNS dotaz přes UDP

#### Krok 0: Úvod
- Ohnisko: topologie. Vpravo: Alice.
- Vidí: topologie úrovně 3, v síti 2 nově SRV1 (a Bob). U SRV1 štítky „DNS: UDP 53“, „web: TCP 80“. Cyril je ztlumený (v úrovni 4 se nepoužívá).
- Dělá: nic; „Začít“.
- Text: „Dosud jsme posílali zprávy mezi počítači. Teď Alice otevře webovou stránku. Který program na SRV1 ji obslouží? A co když se cestou něco ztratí?“
- Note: „SRV1 je školní server. Běží na něm dvě služby: DNS (překládá jména na IP adresy) a web. Obě služby jsou na jednom počítači s jednou IP adresou, rozliší je až port.“
- Simulátor zjednodušuje: „Server je v síti 2 a cesta vede jen přes R1. Internet (seznam.cz) a NAT přijdou v úrovni 5.“

#### Krok 1: Co Alice ví a co na SRV1 naslouchá
- Ohnisko: terminál. Vpravo: SRV1.
- Vidí: Alice zadá `http://www.skola.lan`. Jen jméno, žádná IP adresa. U SRV1 se tabulka „Naslouchající služby“ (zatím schovaná).
- Dělá (terminál): na Alici `ipconfig /all` (vidí DNS server 192.168.2.10); na SRV1 `netstat -an`: `UDP 0.0.0.0:53`, `TCP 0.0.0.0:80 LISTENING`.
- Text: „Alice zná jen jméno `www.skola.lan`. Pakety ale putují podle IP adres. Nejdřív se musí zeptat DNS serveru: ten je na SRV1. Mezitím u SRV1: web naslouchá na portu 80, DNS na portu 53.“
- Note: „`LISTENING` znamená: na tomhle portu čeká nějaký program na klienty. Port je číslo v hlavičce L4. Server a jeho aplikace na portu čekají, klient se připojí.“

#### Krok 2: Otázka: bude DNS dotaz potřebovat spojení? (tip)
- Ohnisko: tip. Vpravo: Alice.
- Vidí: stav před událostí: Alice má jméno a hlavičku UDP/TCP prázdnou, nic neodešla. Volby se odvodí z protokolů, které student zná z úvodu.
- Text: „Alice zná jméno a ptá se DNS serveru na SRV1. Dotaz je krátký: jedna otázka, jedna odpověď. Nejdřív se spojí, nebo hned pošle dotaz?“
- **Tip:** „Co Alice odešle jako první segment?“ Volby: **dotaz DNS rovnou (bez předchozí domluvy)** / **nejdřív žádost o spojení (SYN), pak dotaz** / **nejdřív ARP pro SRV1**.
  Správně: dotaz rovnou. Důvod při nesouladu: „DNS dotaz jede po UDP. UDP nenavazuje spojení: pošle zprávu a hotovo. ARP už proběhl (tabulky jsou plné).“ (Volba ARP: „ARP je pro rámec; ARP tabulka už je plná.“)

#### Krok 3: DNS dotaz letí po UDP (vyhodnotí tip z kroku 2)
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: jedna zpráva od Alice k SRV1: rámec → paket → **UDP datagram** (zdrojový port 52114, cílový 53) → DNS dotaz „kdo je `www.skola.lan`, typ A“. Štítek socketů `192.168.1.10:52114 → 192.168.2.10:53`. Cestou přes R1 (paket projde, MAC se mění).
- Dělá: v rentgenu najde porty a velikost UDP hlavičky (8 B).
- Text: „Tvůj tip: <volba>. Skutečnost: Alice poslala dotaz rovnou, UDP spojení nenavazuje. Zdrojový port 52114 si vybral operační systém, cílový je 53 (DNS). Mezitím u SRV1: aplikace DNS dotaz přečte.“
- Note: „Zdrojový port je náhodný, cílový port říká, kterému programu zprávu předat. Dvojice IP adresa + port je **socket**.“
- Aha 1 (viz níže).

#### Krok 4: SRV1 odpoví
- Ohnisko: vrstvy. Vpravo: SRV1 → Alice (nadpis sloupce se změní na „Teď Alice“, rozh. 57b).
- Vidí: SRV1 složí odpověď: UDP datagram 53 → 52114, v datech `www.skola.lan A 192.168.2.10`. Porty se prohodily. Blok dojede do Alice, v L4 se podle cílového portu 52114 najde, **který program** se ptal.
- Text: „SRV1 pošle odpověď zpátky: porty se prohodily. Mezitím u Alice: operační systém podle cílového portu 52114 ví, že odpověď patří prohlížeči (programu, který se ptal).“
- Note: „Tomu se říká demultiplexování: přijatá data jsou předána správné aplikaci podle portu (Michalovo L4 b).“

#### Krok 5: Alice zná IP adresu
- Ohnisko: terminál. Vpravo: Alice.
- Dělá (terminál): `nslookup www.skola.lan` na Alici: `Server: 192.168.2.10`, `Address: 192.168.2.10`, `Name: www.skola.lan`. Tentokrát je to jen výpis (děj už student viděl), ne nový dotaz.
- Text: „Teď Alice zná IP adresu SRV1. Příkaz `nslookup` dělá totéž, co jsi viděl: pošle DNS dotaz na server a zobrazí odpověď.“
- Note: „DNS je aplikace: má svůj program na serveru a vlastní formát dotazu. Na přenos používá UDP, port 53.“

### Část B: Three-way handshake

#### Krok 6: Otázka: kolik zpráv potřebuje TCP spojení? (tip)
- Ohnisko: tip. Vpravo: Alice.
- Vidí: stav před událostí: Alice ví, že `www.skola.lan` je 192.168.2.10 a že web běží na portu 80. Prohlížeč chce poslat HTTP požadavek. Žádný segment zatím neodešel. Tabulka „Spojení“ je prázdná.
- Text: „Web používá TCP. TCP si nejdřív s druhou stranou domluví spojení. Domluvit se musí dvě věci: že druhá strana slyší a že obě strany ví, od jakého čísla budou počítat bajty.“
- **Tip:** „Kolik segmentů bez dat se vymění, než Alice pošle první bajt stránky?“ Volby: **2** / **3** / **4**. Správně: 3.
  Důvod při nesouladu: „Každá strana musí poslat svoje číslo a dostat potvrzení. To jsou čtyři věci, ale SRV1 spojí potvrzení Aliciina čísla a své číslo do jednoho segmentu. Vyjdou 3 segmenty.“

#### Krok 7: SYN: Alice žádá o spojení (vyhodnotí tip až v kroku 10)
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: první segment: příznak **SYN**, zdrojový port 49731, cílový 80, sekvenční číslo (relativní 0, absolutní 2 837 411 906), bez dat. U SRV1 (v tabulce Spojení) stav LISTEN → **SYN_RECEIVED**.
- Text: „Alice posílá SYN: ‚chci se spojit, moje čísla začínají od …‘. Mezitím u SRV1: na portu 80 ji někdo čeká (LISTEN), vznikne rozdělané spojení.“
- Note: „SYN znamená ‚synchronizuj sekvenční čísla‘. Nese číslo, od kterého bude Alice počítat své bajty.“
- Simulátor zjednodušuje: „Další pole hlavičky TCP (velikost okna, volby) se tu nevysvětlují.“

#### Krok 8: SYN-ACK: SRV1 souhlasí
- Ohnisko: rentgen. Vpravo: SRV1 → Alice (nadpis „Teď Alice“).
- Vidí: SRV1 odpoví **SYN + ACK**: vlastní sekvenční číslo (relativní 0, absolutní 905 112 337) a potvrzovací číslo Alice + 1 (relativní 1). Porty prohozené.
- Text: „SRV1 souhlasí a posílá své číslo. Zároveň potvrzuje Aliciino: ‚čekám bajt číslo 1‘. Mezitím u Alice: stav SYN_SENT.“
- Note: „SYN spotřebuje jedno číslo, proto je potvrzovací číslo o 1 větší.“

#### Krok 9: ACK: Alice potvrdí
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: třetí segment: jen **ACK**, seq 1, ack 1. Stav na obou stranách **ESTABLISHED**.
- Text: „Alice potvrzuje SRV1 jeho číslo. Teď o sobě oba vědí a mají domluvená čísla, spojení existuje.“

#### Krok 10: Spojení existuje (vyhodnotí tip z kroku 6)
- Ohnisko: terminál. Vpravo: Alice (obě strany v terminálu).
- Dělá (terminál): na Alici `netstat -an`: `TCP 192.168.1.10:49731  192.168.2.10:80  ESTABLISHED`; na SRV1 `netstat -an`: `TCP 192.168.2.10:80  192.168.1.10:49731  ESTABLISHED` a stále `0.0.0.0:80 LISTENING`.
- Text: „Tvůj tip: <volba>. Skutečnost: tři segmenty. Bez nich by Alice neměla jistotu, že SRV1 slyší, ani domluvená čísla. Stav ESTABLISHED: spojení existuje.“
- Note: „Spojení nemá nic fyzického. Je to jen záznam v paměti obou počítačů: dvojice socketů a čísla. Cestou přes R1 o něm router nic neví.“
- Aha 2.

### Část C: HTTP GET, odpověď, ukončení

#### Krok 11: HTTP GET
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: segment **PSH, ACK**, seq 1, ack 1, **data** = text `GET / HTTP/1.1` + `Host: www.skola.lan`. V rentgenu je část „Data (HTTP)“ pod hlavičkou TCP; délka dat se vypíše.
- Text: „Teď Alice posílá webový požadavek. HTTP zpráva je jen text, který TCP veze jako data. Mezitím u SRV1: web přečte požadavek.“
- Note: „HTTP není vedle TCP. Je to obsah TCP segmentu. TCP nezná, co v něm je (dostane data a doručí je).“

#### Krok 12: HTTP odpověď
- Ohnisko: vrstvy. Vpravo: SRV1 → Alice („Teď Alice“).
- Vidí: SRV1 odpoví segmentem **PSH, ACK**: seq 1, ack 1 + délka požadavku (potvrzuje požadavek), data `HTTP/1.1 200 OK` + stránka. Blok vystoupá u Alice až do L7 (prohlížeč).
- Text: „SRV1 posílá stránku. Je to jeden segment, který zároveň potvrzuje Alicin požadavek (ack). Mezitím u Alice: segment vystoupá přes L4 do prohlížeče.“
- Simulátor zjednodušuje: „Stránka se vejde do jednoho segmentu.“

#### Krok 13: Otázka: co potvrdí Alice? (tip)
- Ohnisko: tip. Vpravo: Alice.
- Vidí: stav před událostí: odpověď (délka např. 200 bajtů, v rentgenu) je v Alici, ještě nepotvrzená. Přehledová tabulka čísel: Alice seq 1 + délka požadavku; SRV1 seq 1, odeslal 200 B.
- Text: „Alice přijala 200 bajtů stránky. TCP potvrzuje číslem bajtu, který **čeká dál**.“
- **Tip:** „Jaké potvrzovací číslo (ack) pošle Alice?“ Volby: **1** / **200** / **201**. Správně: 201 (první nepřijatý bajt). Důvod při nesouladu: „Ack neříká ‚kolik jsem dostala‘, ale ‚od kterého bajtu čekám dál‘. Dostala bajty 1 až 200, čeká 201.“

#### Krok 14: ACK (vyhodnotí tip z kroku 13)
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: segment ACK: seq (Alice) 1 + délka požadavku, ack = 201. Text vyhodnotí tip jednou větou.
- Text: „Tvůj tip: <volba>. Skutečnost: ack 201. Mezitím u SRV1: potvrzení přijato, data jsou ‚doručena‘ a SRV1 je může zapomenout.“
- Note: „Potvrzování je to, co dělá TCP spolehlivým. Nepotvrzená data pošle odesílatel znovu (volitelná část F).“

#### Krok 15: Ukončení: Alice posílá FIN
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: segment **FIN, ACK**. Stav Alice **FIN_WAIT** (v tabulce Spojení; na netstat se ukáže `FIN_WAIT_2`/`TIME_WAIT` až později).
- Text: „Stránka je přenesená, Alice spojení ukončuje: ‚já už nic nepošlu‘. Mezitím u SRV1: web ví, že klient skončil.“
- Simulátor zjednodušuje: „FIN posílá první Alice; ve skutečnosti může kterákoli strana.“

#### Krok 16: SRV1: ACK + FIN
- Ohnisko: rentgen. Vpravo: SRV1 → Alice („Teď Alice“).
- Vidí: SRV1 odpoví **FIN, ACK** (potvrdí Aliciin FIN a zároveň ukončí svůj směr). Stav SRV1 `LAST_ACK` (jen ve tabulce Spojení).
- Text: „SRV1 potvrzuje a také končí. Mezitím u Alice: čeká na poslední potvrzení.“
- Simulátor zjednodušuje: „Ve skutečnosti jsou ACK a FIN často dva segmenty; tady je spojíme.“

#### Krok 17: Poslední ACK a TIME_WAIT
- Ohnisko: terminál. Vpravo: Alice.
- Vidí: Alice pošle ACK; SRV1 spojení uzavře (CLOSED, zmizí z netstat). Alice jde do **TIME_WAIT** (odpočet).
- Dělá (terminál): na Alici `netstat -an`: `TCP 192.168.1.10:49731  192.168.2.10:80  TIME_WAIT`; na SRV1 řádek zmizel, zůstalo `LISTENING`.
- Text: „Spojení skončilo. Alice ještě chvíli čeká (TIME_WAIT): kdyby se její poslední ACK ztratilo, SRV1 pošle FIN znovu a Alice ho musí umět potvrdit.“
- Note: „TIME_WAIT na straně, která zavírá první, je normální výpis `netstat` po každé stránce. Neznamená to chybu.“

#### Krok 18: Celé spojení na jednom obrázku
- Ohnisko: topologie (časová osa). Vpravo: Alice (obě strany).
- Vidí: časová osa: DNS dotaz a odpověď (UDP, 2 segmenty), SYN, SYN-ACK, ACK, GET, odpověď, ACK, FIN, FIN-ACK, ACK. Klik na segment skočí na příslušný krok v rentgenu.
- Dělá: spočítá a vybarví, které segmenty jsou **spojení** (TCP: řízení), které **data** (HTTP) a které **jsou UDP** (DNS).
- Text: „Takhle vypadá jedna stránka: dva segmenty pro DNS, tři pro spojení, dva pro data a potvrzení, tři až čtyři pro ukončení. Žádný z nich není ‚webová stránka celá‘: stránka je obsah jednoho z nich.“
- Konec jádra (kroky 0–18). Návaznost: zde může učitel skončit.

### Část D: Socket a multiplex

#### Krok 19: Otázka: dvě spojení najednou (tip)
- Ohnisko: tip. Vpravo: Alice.
- Vidí: stav před událostí: Alice otevřela **druhý tab prohlížeče** a v obou tabech načítá stránku z `www.skola.lan`. Jsou dvě spojení ze stejné IP adresy na stejný cílový port 80 (SYN a handshake jsou za námi, zrychleně; tabulka Spojení ukazuje obě spojení ESTABLISHED). Ještě se neposílají data.
- Text: „Alice má dvě otevřená spojení k tomuhle serveru, stejná IP adresa a stejný cílový port 80. Přijde segment s daty. SRV1 musí vědět, který tab (spojení) to je.“
- **Tip:** „Podle čeho SRV1 rozliší dvě spojení od Alice?“ Volby: **podle cílového portu (80)** / **podle zdrojového portu klienta** / **podle sekvenčního čísla**. Správně: zdrojový port.
  Důvod při nesouladu: „Cílový port i IP adresy mají obě spojení stejné. Rozliší je jediné: zdrojový port klienta, který OS při otevírání každého spojení vybral jiný.“

#### Krok 20: Dvě spojení, dva zdrojové porty (vyhodnotí tip z kroku 19)
- Ohnisko: terminál. Vpravo: SRV1.
- Dělá (terminál): na SRV1 `netstat -an`: řádky `192.168.2.10:80  192.168.1.10:49732  ESTABLISHED` a `192.168.2.10:80  192.168.1.10:49733  ESTABLISHED` a stále jeden `LISTENING` na portu 80.
- Text: „Tvůj tip: <volba>. Skutečnost: zdrojové porty 49732 a 49733. Mezitím u SRV1: každé spojení je jednoznačné čtveřicí (IP a port Alice, IP a port serveru). Na portu 80 naslouchá pořád jen jedna aplikace, spojení má víc.“
- Note: „Spojení určuje čtveřice (zdrojová IP, zdrojový port, cílová IP, cílový port) a protokol. Ne jen cílový port.“
- Aha 3.

#### Krok 21: Bob se připojí
- Ohnisko: topologie. Vpravo: SRV1.
- Vidí: Bob (192.168.2.20) otevře stránku taky, zrychleně (handshake + GET). Segment `192.168.2.20:51200 → 192.168.2.10:80` letí jen přes SW2 (bez routeru, srovnání s Alicí).
- Dělá (terminál): na SRV1 `netstat -an`: tři spojení ESTABLISHED; všechna mají místní socket `192.168.2.10:80`, liší se vzdálený socket.
- Text: „Další klient, stejný cílový port 80. Mezitím u SRV1: třetí spojení, stejný port. Server si pamatuje socket každého klienta zvlášť.“

#### Krok 22: SRV1 předá data správné aplikaci (demultiplex)
- Ohnisko: vrstvy. Vpravo: SRV1.
- Vidí: segment dojede do SRV1. V L4 se zobrazí tabulka spojení: **cílový port 80** → webová služba; **zdrojový socket** → které spojení v ní. Student ho přetáhne nebo klikne na řádek.
- Text: „Takhle SRV1 pozná, kam segment patří: podle cílového portu vybere aplikaci (web nebo DNS) a podle zdrojového socketu spojení.“
- Note: „Multiplex a demultiplex (Michalovo L4 b): víc spojení a víc aplikací sdílí jednu IP adresu a jednu síťovou kartu.“

#### Krok 23: Otázka: co odpoví SRV1 na port 8080? (tip)
- Ohnisko: tip. Vpravo: SRV1.
- Vidí: stav před událostí: segment SYN od Alice s cílovým portem **8080** leží u SRV1. Tabulka Naslouchání: UDP 53, TCP 80; 8080 tam není.
- Text: „Alice zkusí vlastní adresu `http://www.skola.lan:8080`. Na tomhle portu SRV1 nic nenaslouchá.“
- **Tip:** „Co odpoví SRV1?“ Volby: **nic (segment zahodí)** / **odmítne (RST)** / **spojení naváže, ale odpoví chybou**. Správně: RST.
  Důvod při nesouladu: „Systém SRV1 ví, že tam nikdo nenaslouchá, a hned to klientovi řekne segmentem RST. Žádné spojení, žádné čekání. (Firewall by mohl segment zahodit mlčky, ale ten tu není.)“

#### Krok 24: RST: zavřený port (vyhodnotí tip z kroku 23)
- Ohnisko: rentgen. Vpravo: Alice.
- Vidí: segment **RST, ACK** od SRV1 k Alici; v prohlížeči „spojení odmítnuto“. Terminál `netstat -an` na SRV1 se nezmění.
- Text: „Tvůj tip: <volba>. Skutečnost: RST. Mezitím u Alice: spojení se ani nenavázalo. Port není ‚otevřený‘ ani ‚zavřený‘ sám o sobě: záleží, jestli na něm někdo naslouchá.“
- Note: „Port není fyzická díra v počítači. Je to číslo v hlavičce. ‚Otevřený‘ port = program na něm naslouchá.“

### Část E: UDP × TCP

#### Krok 25: Srovnání: dva protokoly
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: vedle sebe hlavička UDP (8 B: porty, délka, checksum) a hlavička TCP (20 B a víc: porty, seq, ack, příznaky, okno, checksum), zvýrazněné rozdíly. Tabulka vlastností: nespojovaný / spojovaný; nespolehlivý / spolehlivý (potvrzování, retransmise, pořadí).
- Dělá: přiřadí k dvěma sloupcům příklady (stažení souboru, web, DNS dotaz, hlasový hovor, online hra, e-mail). Je tu pár otázek, ne jedna správná odpověď; svůj výběr si porovná s výsledkem.
- Text: „UDP posílá zprávu a nestará se o ni. TCP naváže spojení, potvrzuje, ztracené pošle znovu a složí data ve správném pořadí. Každý je dobrý na něco jiného.“
- Note: „Nespolehlivý neznamená špatný: nižší režie a nižší zpoždění. DNS dotaz je krátký a když se ztratí, aplikace ho pošle znovu sama.“

#### Krok 26: Co dělá transportní vrstva
- Ohnisko: vrstvy. Vpravo: Alice.
- Vidí: blok vrstev Alice, u L4 dva popisky podle prezentace (rozh. 49): **a)** spolehlivé doručení dat (TCP; UDP ne): potvrzení příjmu, ztracená data se pošlou znovu, velká data se rozdělí a u příjemce složí ve správném pořadí; **b)** doručení správné aplikaci podle portu. Ke každému popisku odkaz na krok, kde se to dělo (a: 7–14; b: 3, 4, 20, 22).
- Text: „Vrstva L4 dělá dvě věci. Spolehlivost nabízí jen TCP, rozlišení aplikací podle portu umí TCP i UDP. Kdo se o to stará: operační systém.“
- Konec části E. Dál je volitelná část F.

### Část F: Ztráta segmentu (volitelná)

#### Krok 27: Alice posílá znovu GET
- Ohnisko: topologie. Vpravo: Alice.
- Vidí: nové spojení (49734, handshake rychle). Alice pošle GET; segment letí dolů, po kabelu a **na kabelu mezi R1 a SW2 zmizí** (červený záblesk, štítek „ztraceno“). Alice spustí časovač (odpočet 1 s).
- Text: „Na kabelu se něco stalo a segment se ztratil. Alice o tom neví: zkouší dál. Odpočítává čas, jak dlouho má na potvrzení čekat.“
- Simulátor zjednodušuje: „Ztráta je naplánovaná scénářem; v reálné síti nevíme, kde a proč.“

#### Krok 28: Otázka: co udělá Alice? (tip)
- Ohnisko: tip. Vpravo: Alice.
- Vidí: stav před událostí: segment je ztracený, SRV1 o něm neví, časovač u Alice dobíhá, ACK nepřišel.
- Text: „Čas vypršel a potvrzení nepřišlo.“
- **Tip:** „Co Alice udělá?“ Volby: **pošle stejný segment znovu** / **pošle nový, jiný segment** / **dál čeká bez konce** / **vypíše chybu a spojení ukončí**. Správně: pošle stejný segment znovu.
  Důvod při nesouladu: „TCP po timeoutu posílá znovu stejná data se stejným sekvenčním číslem. Vzdát to může až po několika neúspěšných pokusech.“

#### Krok 29: Timeout a retransmise (vyhodnotí tip z kroku 28)
- Ohnisko: rentgen. Vpravo: SRV1.
- Vidí: stejný segment (seq 1, stejná data), příznak „retransmise“ u segmentu v rentgenu. Tentokrát projde a SRV1 odpoví (kroky 12, 14 zrychleně).
- Text: „Tvůj tip: <volba>. Skutečnost: Alice segment poslala znovu. SRV1 ho dostane poprvé, takže pro něj je to první pokus.“
- Note: „Spolehlivost TCP se skládá z potvrzování a opakovaného odeslání. Odesílatel si data pamatuje, dokud nedostane ACK.“
- Simulátor zjednodušuje: „Hodnotu timeoutu fixuje scénář; v reálu se počítá z měření odezvy a při opakované ztrátě se zdvojnásobuje.“

#### Krok 30: Stránka dorazila, spojení běží
- Ohnisko: topologie. Vpravo: Alice.
- Vidí: odpověď, ACK, spojení ESTABLISHED. Počítadlo „Segmentů celkem / z toho opakovaných“.
- Text: „Stránka je v prohlížeči. Student by ve stránce nepoznal, že se segment ztratil. Poznal by to na zpoždění.“

#### Krok 31: A co UDP? DNS dotaz se ztratí
- Ohnisko: terminál. Vpravo: Alice.
- Vidí: DNS dotaz (UDP) se ztratí na stejném kabelu. Žádný ACK, žádný timeout na L4. Po vypršení času **aplikace** (nslookup) pošle dotaz znovu.
- Dělá (terminál): `nslookup www.skola.lan` → `DNS request timed out. timeout was 2 seconds.` a po druhém pokusu odpověď.
- Text: „UDP nic nepotvrzuje a sám nic neopakuje. Ztrátu si ošetří až aplikace: nslookup po dvou vteřinách zkusí znovu. Za spolehlivost tu odpovídá program, ne transportní vrstva.“
- Note: „Proto je DNS po UDP rychlé a nekomplikované. Když je to potřeba, DNS jede i po TCP (velké odpovědi, přenosy zón).“

## „Aha“ chvíle

1. **Dotaz DNS letí bez navazování** (krok 3): student tipoval „nejdřív spojení“; UDP pošle zprávu a nestará se.
2. **Tři segmenty a tabulka Spojení: ESTABLISHED** (kroky 7–10): spojení není kabel, je to záznam v obou počítačích a domluvená čísla.
3. **Dvě spojení z jedné IP na jeden port se liší jen zdrojovým portem** (krok 20): proto klient dostává náhodný zdrojový port.
4. **ack 201, ne 200** (krok 14): potvrzuje se, co čekám dál.
5. **Port není díra, jde o to, jestli na něm někdo naslouchá** (krok 24).
6. **Ztracená data pošle znovu TCP, ztracený DNS dotaz až aplikace** (kroky 29 a 31): rozdíl mezi spolehlivým a nespolehlivým přenosem vidět na vlastní oči.

## Miskoncepce a jak je scénář vyvrací

| Miskoncepce | Kde se vyvrací |
|---|---|
| „Port je díra v počítači, kterou je potřeba otevřít.“ | Kroky 1, 23–24: port je číslo; ‚naslouchá‘ = běží tam program. Zavřený port odpoví RST. |
| „UDP je horší než TCP.“ | Kroky 3–4, 25, 31: DNS přes UDP je rychlé a stačí; ztrátu řeší aplikace. |
| „Handshake je jen formalita.“ | Kroky 7–10: bez něj nejsou domluvená čísla a spojení neexistuje (ESTABLISHED jen po třetím segmentu). |
| „Spojení je cesta (kabel), kterou si TCP zarezervuje.“ | Krok 10 a 18: spojení je záznam na koncích, R1 o něm neví; každý segment jde jako samostatný paket. |
| „HTTP a TCP je totéž; stránka putuje celá.“ | Kroky 11–12: HTTP je text v datech TCP segmentu; segment je jen kus cesty. |
| „DNS je součást internetu jako drát.“ | Kroky 1–5: je to aplikace, běží na SRV1 jako program, má port 53. |
| „Server rozliší klienty podle IP adresy.“ | Kroky 19–22: stejná IP, stejný cílový port, rozhodne zdrojový port. |
| „Ack = kolik bajtů jsem dostal.“ | Kroky 13–14: ack je číslo bajtu, který čekám dál. |
| „TIME_WAIT je chyba.“ | Krok 17: normální stav po zavření. |
| „Spolehlivý = rychlý.“ | Kroky 25, 27–29: spolehlivost stojí režii a čas (SYN, potvrzení, timeout). |

## Rentgen: co student najde

- UDP datagram: zdrojový port, cílový port, délka, kontrolní součet (8 B). DNS: hlavička, typ A, odpověď s IP.
- TCP segment: porty, **seq**, **ack**, příznaky (SYN, ACK, PSH, FIN, RST), velikost okna (jen zobrazená), kontrolní součet. Relativní i absolutní čísla.
- HTTP: stavový řádek, hlavička `Host`, tělo. Označeno „data aplikační vrstvy“.
- Socket v hlavičce rentgenu: `IP:port → IP:port`.
- Porovnání po průchodu R1: IP a porty se nemění, MAC ano (připomenutí úrovně 3).

## Terminál: kdy a proč

Terminál je volitelný; kroky ho jen doporučují. Přibývají příkazy `nslookup` a `netstat -an` (Windows i SRV1).

| Krok | Zařízení | Příkaz | Co student zjistí |
|---|---|---|---|
| 1 | Alice, SRV1 | `ipconfig /all`, `netstat -an` | DNS server; LISTENING 53 a 80 |
| 5 | Alice | `nslookup www.skola.lan` | DNS server a jméno → IP |
| 10 | Alice, SRV1 | `netstat -an` | ESTABLISHED, oba směry |
| 17 | Alice, SRV1 | `netstat -an` | TIME_WAIT u Alice; u SRV1 nic |
| 20 | SRV1 | `netstat -an` | dvě spojení, jeden LISTENING |
| 21 | SRV1 | `netstat -an` | tři spojení, lišící se vzdálený socket |
| 31 | Alice | `nslookup www.skola.lan` | timeout a druhý pokus (UDP bez ACK) |

Pozn.: `netstat -a -n -p tcp -o` (Michalova prezentace) je v simulátoru zjednodušeno na `netstat -an`; přepínače `-p tcp` a `-o` (PID) vyzkouší student až v reálném terminálu (úkol níže).

## Kontrolní otázky (konec úrovně)

1. Co je socket? Jak se liší dvě spojení Alice k SRV1:80?
   Očekávaná odpověď: socket = IP:port; spojení se liší zdrojovým portem klienta (čtveřice).
2. Proč má TCP handshake tři kroky a co se v nich domlouvá?
   Očekávaná odpověď: obě strany musí poslat svůj počáteční sekvenční číslo a dostat potvrzení; SYN, SYN-ACK, ACK.
3. Čím se liší UDP a TCP? K čemu hodí se každý?
   Očekávaná odpověď: UDP nespojovaný, nespolehlivý, nízká režie (DNS, hlas); TCP spojovaný, spolehlivý (web, e-mail, soubory).
4. Co je v rámci s HTTP odpovědí na jednotlivých vrstvách?
   Očekávaná odpověď: rámec (L2) → IP paket → TCP segment → HTTP data.
5. Co znamená `LISTENING`, `ESTABLISHED` a `TIME_WAIT`?
   Očekávaná odpověď: program čeká na spojení; spojení běží; po zavření spojení čeká strana, která zavírala první.
6. Jak pozná server, kterému programu předat příchozí segment?
   Očekávaná odpověď: cílový port vybere aplikaci; zdrojový socket (IP + port klienta) vybere spojení.
7. Co udělá TCP, když se segment ztratí? A co UDP?
   Očekávaná odpověď: po timeoutu pošle stejný segment znovu (nepotvrzená data); UDP nic, případně aplikace.
8. Co se stane, když klient pošle SYN na port, kde nikdo nenaslouchá?
   Očekávaná odpověď: odpověď RST, spojení se nenaváže.
9. Jaká je role DNS? Přes jaký protokol a port běžně jede?
   Očekávaná odpověď: překlad jmen na IP adresy; UDP, port 53.
10. Proč je v simulátoru ack 201 po přijetí 200 bajtů?
    Očekávaná odpověď: ack = další očekávaný bajt.

Kontrolní úkol (k Michalově ukázce webserveru v Pythonu, prezentace „4. aplikační vrstva“):
Student spustí vlastní Python webserver (socket, bind, listen, accept), v `cmd` zadá `netstat -a -n -p tcp -o` a najde
řádek `LISTENING` s portem svého serveru. Potom se přes prohlížeč připojí a najde `ESTABLISHED` a po zavření `TIME_WAIT`.
Odpoví: Který řádek odpovídá `listen()` a který `accept()`? Jaký zdrojový port dostal prohlížeč? Jak to sedí na kroky 1, 10, 17, 20?

## Vazba na maturitu IVT a Michalovy prezentace

- **Maturita IVT, okruh 12 Počítačové sítě:** ISO/OSI a TCP/IP (vrstvy L4 a L7: kroky 3–4, 22, 26), adresace MAC / IP / port (porty, socket:
  kroky 3, 20–22), příkazy pro zjišťování konfigurace (`nslookup`, `netstat -an`: kroky 1, 5, 10, 17, 20).
- **Maturita IVT, okruh 15 Internetové technologie:** DNS (části A, kroky 3–5, 31), WWW (HTTP GET a odpověď: kroky 11–14), klient–server
  (krok 1, D). E-mail (SMTP, port 25) simulátor neukazuje; student ho může dohledat z tabulky známých portů (kroky 1, 25).
- **Michalovy prezentace:** „3. TCP/IP – L4“ (porty 22 / 53 / 25 / 80 / 443, socket IP:port, multiplex, UDP × TCP, three-way handshake,
  `netstat -a -n -p tcp -o`) a „4. aplikační vrstva“ (DNS, HTTP, vlastní webserver v Pythonu: kontrolní úkol). Simulátor nekopíruje
  příklad seznam.cz (privátní adresy bez NAT, rozh. 5; seznam.cz přijde s NAT v úrovni 5).
- **CCNA (ITN):** TCP × UDP, three-way handshake, porty a sockety, `netstat`, DNS, HTTP (stavový řádek, GET).

## Testovací kritéria pro implementaci

- Každý krok má `focus` a `rightNode`; text kroku mluví o tom uzlu, jehož sloupec je vpravo (rozh. 57). Při přechodu na jiný uzel
  se nadpis sloupce zvýrazní („Teď Alice“).
- Tipy: 2, 6, 13, 19, 23, 28 jsou samostatné kroky se stavem před událostí; nadpis „Otázka: …“; žádný text před tipem neprozrazuje výsledek.
- Segmenty: DNS dotaz a odpověď = UDP, porty 52114 ↔ 53; handshake = tři segmenty (SYN, SYN-ACK, ACK) s relativními čísly 0 / 0,1 / 1,1;
  GET a odpověď s ack = 1 + délka; ukončení čtyři příznakové segmenty (FIN, ACK+FIN, ACK) podle kroků 15–17.
- `netstat -an`: stavy LISTENING / ESTABLISHED / TIME_WAIT odpovídají tabulce Spojení v daném kroku.
- Ztráta (F): retransmise má stejné seq a data jako ztracený segment; UDP dotaz se na L4 neopakuje.

## Otevřené otázky (pro projektanta a orchestrátora)

- **O1:** Topologie sítě 2: SW2 mezi R1, Bobem a SRV1 (návrh), nebo jiné řešení? Má dopad na krok 21 (Bob bez routeru).
- **O2:** Absolutní ISN a porty (parametry scénáře): potvrdit nebo změnit; velikost okna a volby TCP jen zobrazit.
- **O3:** Zakončení: ACK+FIN v jednom segmentu (krok 16) je v pořádku jako zjednodušení? A zda ukazovat `FIN_WAIT`/`LAST_ACK` jen v tabulce Spojení, ne v `netstat` (kde se dočasně objeví).
- **O4:** RST pro zavřený port (krok 24): u Linuxu RST; u firewallu ticho. Stačí RST?
- **O5:** Krok 31: výpis Windows `nslookup` při timeoutu (`DNS request timed out. timeout was 2 seconds.`): ověřit proti skutečnému výpisu.
- **O6:** HTTP odpověď v jednom segmentu (zjednodušení) vs. dva segmenty pro ukázku skládání dat ve správném pořadí (Michalovo L4 a): možná doplnit do kroku 12 jako volbu.
