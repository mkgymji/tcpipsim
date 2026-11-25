# Scénář úrovně 3: Směrování

Text pro implementaci. Stav: návrh didaktika (iterace 3), čeká na sjednocení topologie a adres
orchestrátorem a projektantem. Platí `docs/rozhodnuti.md` (hlavně 5, 13–16, 23–27, 31, 36–38) a
`docs/spec/` (`arp.md`, `ipv4.md`, `icmp.md`, vektor `ping-router`). Texty v uvozovkách jsou texty
simulátoru (oslovení „ty“). Terminál vypisuje anglicky (rozhodnutí 10). Číslování kroků je návrhové;
po schválení se stejně jako u úrovně 2 sjednotí s `.js` scénářem.

## Cíl a nová myšlenka

**Router spojuje sítě a rozhoduje podle cílové IP adresy. MAC adresa se mění po každém skoku, IP adresa
zůstává.** Doručení paketu je řetěz krátkých úseků: na každém úseku nese rámec MAC adresy jen
pro ten úsek; IP adresy říkají, kam paket míří celkově.

Úroveň 2 ukázala „každá vrstva má svou adresu“. Úroveň 3 k tomu přidává otázku, která tam byla schovaná:
**co když příjemce není ve stejné síti?** Odpověď má tři části, které student sám uvidí:
1. odesílatel pozná z masky, že cíl je jinde, a pošle paket **bráně** (rámec míří na MAC brány, paket
   na IP Boba);
2. ARP funguje **jen v jedné síti**: Alice se ptá na MAC brány, ne na MAC Boba;
3. router paket rozbalí do L3, rozhodne podle směrovací tabulky, sníží TTL a zabalí ho do **nového rámce**.

Výukové cíle: viz `docs/didaktika.md`, úroveň 3. Pozn. k didaktice: cíl „nejdelší shoda prefixu“ je tu jen
jednoduše (rozhodování hostitele mezi `/24` a `0.0.0.0/0`, kroky 9 a 17); složitější tabulky přijdou s úrovní 5.

## Parametry scénáře (měnit na jednom místě)

Topologie a adresy sjednocuje orchestrátor s projektantem. Texty níže používají tyto hodnoty;
změna = hledat a nahradit v celém souboru (a v `.js`). Žádný krok na konkrétní hodnotě nezávisí
kromě těch, které jsou výslovně označené (TTL, tip 4).

| Uzel | Rozhraní / port | MAC | IP / prefix | Poznámka |
|---|---|---|---|---|
| Alice (PC) | eth | `02:00:00:00:00:01` | 192.168.1.10/24, brána 192.168.1.1 | síť 1, na SW1 Fa0/1; TTL 128 |
| Cyril (PC) | eth | `02:00:00:00:00:03` | 192.168.1.30/24, brána 192.168.1.1 | síť 1, na SW1 Fa0/3 |
| SW1 (switch) | Fa0/1–Fa0/4 | bez významu | bez IP | Fa0/4 vede k routeru, Fa0/2 je volný; MAC tabulka na začátku prázdná |
| R1 (router) | Gi0/0 | `02:00:00:00:01:01` | 192.168.1.1/24 | do sítě 1, na SW1 Fa0/4; TTL 255 |
| R1 (router) | Gi0/1 | `02:00:00:00:01:02` | 192.168.2.1/24 | do sítě 2, přímý kabel k Bobovi |
| Bob (PC) | eth | `02:00:00:00:00:02` | 192.168.2.20/24, brána 192.168.2.1 | síť 2; TTL 128 |

- Jména a MAC adresy Alice, Bob, Cyril drží rozhodnutí 25 a 39 (Bob se „přestěhoval“: MAC `…:02` zůstala, IP je 192.168.2.20 místo 192.168.1.20; scénář to v kroku 0 řekne: IP adresa patří k síti, MAC ke kartě). MAC routeru podle vektoru
  `ping-router`. Alice a Bob jsou jako v úrovni 1 a 2, takže student ví, „kdo je kdo“.
- Pro čtení očima se MAC značí zkratkou posledních dvou bajtů: Alice `…:00:01`, Bob `…:00:02`,
  R1 Gi0/0 `…:01:01`, R1 Gi0/1 `…:01:02`. Štítky L2 vždy „zdrojová MAC → cílová MAC“ (rozhodnutí 15);
  tady poprvé platí, že cíl nemusí být příjemce zprávy.
- **Cyril je tu pro dvě věci:** vidí ARP broadcast a ignoruje ho (krok 6), a je „soused“, ke kterému Alice
  nepotřebuje bránu (kroky 16–17). Bez Cyrila by Alice neměla co porovnat.
- **Switch SW1 je tu proto, že odpovídá obrázku z prezentací** (LAN → switch → router) a protože student
  už ví, jak se učí. Mezi routerem a Bobem je přímý kabel (jako ve vektoru `ping-router`; za Bobem
  by sám switch nic nového neukázal). Simulátor nezmiňuje křížený kabel (auto-MDI-X).
- **Simulátor zjednodušuje (úroveň celkově):** není NAT (rozhodnutí 5; student se k němu dostane v úrovni 5,
  „proto se tu zatím neotevírá seznam.cz“), nejsou firewally (Windows by v realitě Echo Request z jiné sítě
  blokoval; rozhodnutí 9 a poznámka v `icmp.md`), směrovací tabulky jsou předvyplněné (statické
  směrování), bez IPv6 a bez fragmentace. Výchozí stav: ARP tabulky všech uzlů **prázdné** (to je rozdíl
  proti úrovni 2, kde byly předvyplněné) a MAC tabulka SW1 prázdná. Z toho plyne, že ARP se děje „doopravdy“.
- Ovládání jako v úrovni 2 (Krok vpřed/zpět, Přehrát, rychlost, Obnovit, rentgen R, terminál `` ` ``/F2,
  ISO/OSI | TCP/IP). Nové: klik na R1 otevře terminál routeru (prompt `R1>`, příkaz `enable` funguje, rozhodnutí 45);
  u routeru a u Alice se ukazuje **tabulka směrování** (panel vedle uzlu).

## Rozvržení „U“ pro router (rozhodnutí 38, návrh)

Principy z rozhodnutí 38 platí: médium je dole (L1), prostřední blok sleduje aktivní vrstvu, zařízení
v pruhu média má výšku do své vrstvy. Pro router to znamená:

```
 Alice                      SW1                    R1                         Bob
 L7 .....                                                                     L7
 L4  (ICMP nemá L4)                                                           L4
 L3 [paket]                                  ┌── L3: rozhodnutí ──┐            L3 [paket]
 L2 [rámec]                  ┌─ L2 ─┐        │   (tabulka, TTL)    │           L2 [rámec]
 L1 ───── médium ──────────── L1 ────── médium ── L1 ┘       └ L1 ── médium ── L1
```

- **Router je „obrácené U“ nad pruhem média:** dva nohy dole (rozhraní Gi0/0 a Gi0/1, každé s vlastním L1
  a L2) a společná hlava nahoře v L3. Výškou sahá do L3, ne výš (router nemá transportní ani aplikační
  vrstvu pro tranzitní provoz). Switch zůstává v L2 (z úrovně 2), hub v L1.
- **Cesta paketu je „U“ s dvěma kopečky:** dolů u Alice po kabelu k SW1 (kopeček do L2), dál po médiu
  k R1, **kopeček do L3** (tam se rozhoduje), dolů druhou nohou, po médiu k Bobovi, nahoru u Boba.
  Stejná skladba pro hub–switch–router zachovává pravidlo „co vystoupá výš, to víc čte“.
- **Střední blok (data / obálky) v routeru:** dole dorazí bity, rámec se složí v L2 (kontrola cílové MAC),
  **hnědá obálka L2 se sundá a zahodí** (animace: odpadne a zmizí), v L3 zůstane jen zelený paket
  s TTL a řádkem tabulky, potom si paket **obleče novou hnědou obálku** (jiné MAC) a klesne na druhou nohu.
  Student vidí, že obálka L2 nejde „dál“; vznikne nová. To je hlavní obraz celé úrovně.
- **Vrstvy nad L3 v routeru jsou šedé** (jako L3–L4 u Cyrila v úrovni 2). Pro tranzitní paket se
  „nahoru“ nechodí; až když je cíl samotný router (ping na 192.168.1.1, krok 6 varianta), vystoupá paket
  k ICMP a router odpoví.
- **ICMP v obrázku:** ping nemá L4 (rozhodnutí 13). U Alice a Boba je řádek L4 vizuálně přeskočený
  s popiskem „ICMP nemá port, jede přímo v IP paketu“. L7 je aplikace `ping`, L3 obálka s `Protocol = 1`.
  Zpráva ICMP není segment (slovník, poznámky).
- **Topologie nahoře** jako v rozhodnutí 38(c): mapa „kde v síti jsme“, aktivní kabel zvýrazněn jako pruh média dole;
  navíc se tu poprvé **vybarví dvě sítě** (síť 1 a síť 2, např. dvěma odlišnými rámečky se štítkem
  „192.168.1.0/24“ a „192.168.2.0/24“). Hranice mezi nimi vede **uvnitř routeru**, ne přes kabel: kabel Gi0/0
  patří do sítě 1, Gi0/1 do sítě 2. Broadcastová doména končí na hranici (krok 6).
- Výška zařízení v pruhu stále vyjadřuje „kam až čte“ (hub L1, switch L2, router L3); legenda se doplní
  o řádek „router“. Student už ví, že hub čte jen bity a switch rámce; nový řádek je „router čte i adresy IP“.
- U kroku se **dvěma rámci** (před a po routeru) se v panelu rentgenu poprvé ukazují **dvě záložky nebo dva
  sloupce vedle sebe**: „Rámec před routerem“ / „Rámec po routeru“; změněná pole se zvýrazní (krok 12).

## Kroky

Číslování `0–25` (UI „Krok n z 25“). Každý krok: co student vidí, co dělá, text vysvětlivky (max. 2–3 věty,
případně „note“ a „Simulátor zjednodušuje“).

**Tip (rozhodnutí 31)** = samostatný krok se stavem **před** událostí; volby se odvozují z topologie; následující krok
ukáže výsledek a vyhodnotí tip jednou větou; přehrávání se na tipu zastaví. Nadpis „Tip: …“. V úrovni 3 jsou
tipy čtyři (3, 5, 11, 13) a dva v dalších částech (16, 18); jsou odlišené od kroků, kde student jen pozoruje.

Doporučené dělení pro učitele: **část A–B (kroky 0–17)** je jádro („router mění MAC, ne IP“), **část C (18–20)** je
navazující scénář o TTL a `tracert`, **část D (21–24)** je diagnostika. Úroveň může být dodána jako jeden scénář
(25 kroků) nebo jako 3 + 2 (rozhodnutí 43: jedna úroveň, skok na začátek části v UI).

### Část A: Ping do jiné sítě

#### Krok 0: Úvod

- Vidí: topologie ze dvou sítí: Alice a Cyril na SW1, R1, Bob za routerem. Dva barevné rámečky (síť 1, síť 2).
  U každého PC jméno, IP a MAC (poslední bajt tučně).
- Dělá: nic; „Začít“.
- Text: „Až dosud byli všichni v jedné síti. Teď je Bob za routerem. Poslat mu zprávu bude složitější než
  Cyrilovi, a ty si ukážeš proč.“
- Note: „Router spojuje sítě. Na jedné straně má adresu z jedné sítě (192.168.1.1), na druhé z druhé (192.168.2.1). Bob se přestěhoval: karta je pořád stejná (MAC …:02), ale IP adresa je teď 192.168.2.20, protože IP patří k síti, MAC ke kartě.“
- Vidí i: tabulka „Co je v rámci / v paketu“ je zatím prázdná (naplní se v krocích 8 a 12).

#### Krok 1: Co o sobě Alice ví

- Vidí: nabídka příkazu `ipconfig` (tlačítko „Spustit za mě“, nebo napíše).
- Dělá: **najde ve výpisu tři údaje** Alice: IPv4 adresu, masku podsítě a výchozí bránu.
- Text: „Kromě adresy IP zná Alice dva údaje navíc: masku a výchozí bránu. Maska říká, jak velká je její síť.
  Brána je router, přes který se dostane ven.“
- Hint: „Výchozí brána je adresa routeru v Alicině síti, ne adresa Boba.“
- Výpis (zkráceně, anglicky): `IPv4 Address. . . : 192.168.1.10`, `Subnet Mask . . . : 255.255.255.0`,
  `Default Gateway . . : 192.168.1.1`. V úrovni 2 byla brána prázdná; teď tam je.
- Napojení na Michalovy prezentace: stejná tabulka údajů jako v prezentaci „Adresace“ (192.168.1.0/24, brána .1).

#### Krok 2: Je Bob „u mě“? (maska)

- Vidí: u Alice se objeví výpočet: vedle sebe dvě adresy v bitech (192.168.1.10 a 192.168.2.20), maska
  255.255.255.0 jako 24 jedniček, síťová část podbarvená, hostitelská část šedá.
- Dělá: **porovná síťovou část** obou adres. U Cyrila (192.168.1.30) stejné porovnání vyjde stejně.
- Text: „Alice porovná síťovou část své adresy s adresou cíle. Maska 255.255.255.0 říká: prvních 24 bitů je síť.
  U Cyrila se shodují, u Boba ne (192.168.1.0 ≠ 192.168.2.0): Bob je v jiné síti.“
- Note: „Adresa sítě = IP adresa AND maska. Zápis 192.168.1.0/24 říká totéž: prvních 24 bitů je síť.“
- Proč zde: bez tohoto kroku je brána nevysvětlená „třetí adresa“. Student musí vidět, že rozhodnutí
  „sám, nebo přes bránu“ je mechanický výpočet z masky, ne hádání.
- Simulátor zjednodušuje: „Maska se tu píše jako /24. Jiné délky masky (/16, /26 …) a podsítě procvičíš v úrovni 5.“

#### Krok 3: Ping vzniká (tip)

- Vidí: Alice napsala (nebo „Spustit za mě“) `ping 192.168.2.20`. Aplikace ping vytvořila ICMP Echo Request,
  síťová vrstva z něj udělala **paket** (zelená obálka L3: zdrojová IP 192.168.1.10, cílová IP 192.168.2.20,
  Protocol 1). Rámec zatím neexistuje, MAC adresy nejsou napsané. L4 přeskočené (ICMP).
- Text: „Alice vytvořila paket pro Boba (192.168.2.20). Teď potřebuje rámec. Kdo bude v rámci uvedený
  jako příjemce?“
- **Terminál (Alice): `ping 192.168.2.20`.** Student ho spustí tady (a výstup uvidí až v kroku 14: ping je
  „rozjetý“, terminál čeká na odpověď). Do doby odpovědi terminál ukazuje `Pinging 192.168.2.20 with 32 bytes of data:`.
- **Tip:** „Čí MAC adresa bude v rámci jako cílová?“ Volby: **MAC Boba** (`…:00:02`) / **MAC brány** (router,
  `…:01:01`) / **broadcast** (`ff:ff:ff:ff:ff:ff`). Správně: MAC brány. Důvod při nesouladu: „Bobovu MAC Alice
  nezjistí (je v jiné síti); rámec musí doručit v její síti, a tam je příjemcem brána.“ (Pozn.: většina
  studentů zvolí Boba; je to nejčastější podoba miskoncepce.)

#### Krok 4: Alice nezná MAC brány (vyhodnotí tip z kroku 3)

- Vidí: Alice si pro rámec potřebuje opsat MAC brány, ale ARP tabulka je prázdná. Paket čeká (fronta).
- Dělá: **`arp -a`** na Alici: prázdná tabulka (jen statické řádky broadcastu; připomínka z úrovně 2).
- Text: „Tvůj tip: <volba>. Skutečnost: MAC brány. Alice posílá paket bráně a ta ho dál doručí. Cíl je Bob, ale
  rámec míří na router. MAC brány Alice zatím nezná, proto se zeptá.“
- Note: „Cílová IP v paketu zůstane Bobova. Cílová MAC v rámci je jen adresa dalšího kroku na cestě (next hop).“
- Simulátor zjednodušuje: „V úrovni 2 byla ARP tabulka předvyplněná. Teď je prázdná, jak to bývá po zapnutí
  počítače.“ (navazuje na rozhodnutí 14.)

#### Krok 5: ARP dotaz (tip)

- Vidí: Alice poslala **ARP dotaz** (rámec s cílovou MAC `ff:ff:ff:ff:ff:ff`, ARP zpráva přímo v rámci,
  EtherType `0x0806`, ne v IP paketu): „Kdo má 192.168.1.1? Řekni to 192.168.1.10.“ Rámec leží na vstupním
  portu Fa0/1 switche SW1. Na výstupech nic.
- Text: „Alice neví MAC adresu brány, a tak se zeptá všech v síti: kdo má 192.168.1.1? Je to dotaz
  adresovaný všem (broadcast).“
- **Tip:** „Kdo ARP dotaz dostane?“ Volby (zaškrtávací, lze víc): **Cyril** / **R1 (Gi0/0)** / **Bob**.
  Správně: Cyril a R1, ne Bob. Důvod při nesouladu: „Broadcast se nepřenáší přes router. Končí na hranici sítě,
  ARP funguje jen v jedné síti.“
- Pozn. pro učitele: tipy na „kdo dostane“ jsou z úrovně 2 (hub, switch) známé; nové je, že tentokrát
  rozhoduje router, ne switch. SW1 broadcast rozešle vždy (nezná cíl, a navíc je cíl broadcast); to je krok z úrovně 2.

#### Krok 6: ARP dotaz dojde jen do sítě 1 (vyhodnotí tip z kroku 5)

- Vidí: SW1 rozešle dotaz na Fa0/3 a Fa0/4 a zapíše si Alici na Fa0/1. Cyril dotaz přijme, vidí, že hledaná
  adresa není jeho, a zahodí ho (štítek „ARP: není pro mě“, žádný nový záznam v jeho ARP tabulce). R1 dotaz
  přijme, hledaná adresa je jeho Gi0/0 (192.168.1.1), zapíše si Alici do své ARP tabulky a chystá odpověď.
  Bob nic neví; u hranice routeru se broadcast zastaví (animace: pruh s popiskem „konec broadcastové domény“).
- Text: „Tvůj tip: <volba>. Skutečnost: Cyril a R1. Cyril dotaz zahodil, protože hledaná adresa není jeho.
  Router odpoví, protože 192.168.1.1 je adresa jeho rozhraní. Bob dotaz nedostal: broadcast se přes router nepřenáší.“
- Note: „ARP se ptá jen v jedné síti. Nikdy se neptá na adresu v jiné síti (za routerem).“
- Hint: „Klikni na Cyrila: `arp -a` ukáže, že si Alici nezapamatoval (zapisuje jen ten, kdo odpovídá).“

#### Krok 7: ARP odpověď

- Vidí: R1 odpoví **unicastem** Alici: „192.168.1.1 je na 02:00:00:00:01:01“. Rámec jde přes SW1 jen na Fa0/1
  (switch Alici zná z kroku 6). Alice si zapíše záznam do ARP tabulky.
- Dělá: **`arp -a`** na Alici: jeden dynamický záznam, **brána** (`192.168.1.1 → 02-00-00-00-01-01`), ne Bob.
- Text: „Router odpověděl přímo Alici (ne všem). Teď Alice ví MAC brány a zapamatovala si ji.“
- Note: „Dotaz byl broadcast (všem), odpověď unicast (jen tazateli).“
- Pozn.: v ARP tabulce Alice není Bob a nikdy nebude. K tomu se vrací krok 15.

#### Krok 8: Rámec s paketem pro Boba míří na bránu

- Vidí: Alice složí rámec; paket čekal ve frontě a teď dostane hnědou obálku. Rámec jde dolů, přes SW1
  (který zná R1 z odpovědi, takže jen na Fa0/4) k R1. Cyril nic nevidí.
- Dělá: v rentgenu **najde čtyři údaje**: L2 cíl = MAC brány (`…:01:01`), L2 zdroj = MAC Alice (`…:00:01`),
  L3 zdroj = 192.168.1.10, L3 cíl = **192.168.2.20 (Bob)**. Tabulka „co je kde“ se naplní.
- Text: „V rámci je cílová MAC adresa brány, v paketu cílová IP adresa Boba. Rámec doručí paket k bráně,
  paket putuje dál k Bobovi.“
- Note: „Dvě různé cílové adresy v jedné zprávě: L2 říká, kam jít teď (příští krok), L3, kam jít nakonec.“
- Poznámka k rozložení: tady začíná „U“ s kopečkem (viz rozvržení výše): rámec klesne na L1, jede po médiu,
  u SW1 vystoupá do L2 a zase klesne.

#### Krok 9: Router: paket vystoupá do L3

- Vidí: rámec dorazí na Gi0/0. V R1 rámec vystoupá do L2 (cílová MAC je moje → přijmu), hnědá obálka se sundá.
  V L3: zelený paket, **TTL 128 → 127**, v panelu routeru **směrovací tabulka**, řádek `192.168.2.0/24 → Gi0/1` zvýrazněný
  jako nalezený. Žádná další vrstva nad L3.
- Dělá: **`show ip route`** na R1: výpis podle IOS (kódy C a L; viz Terminál). Najde řádek, kterým se paket řídí,
  a odpoví, **jaký je další skok** (nic: síť je přímo připojená, cíl je u Gi0/1).
- Text: „Router rámec rozbalil (cílová MAC byla jeho), přečetl cílovou IP adresu 192.168.2.20 a hledá ji ve
  směrovací tabulce. Odpovídá síť 192.168.2.0/24 přes rozhraní Gi0/1. Sníží TTL o 1.“
- Note: „Router rozhoduje podle cílové IP adresy, ne podle MAC. MAC se použila jen k tomu, aby rámec přijal.“
- Simulátor zjednodušuje: „V reálné směrovací tabulce je víc kódů a řádků; tady jsou jen přímo připojené sítě (C)
  a adresy rozhraní routeru (L).“
- Longest prefix match (jednoduše): tabulka routeru má jen dva řádky, které sedí na tvar `/24`; pravidlo
  „vyhrává nejdelší shoda“ se tu ještě netestuje. Poprvé ho vidí student u Alice v kroku 17.

#### Krok 10: Router se ptá Boba (ARP podruhé)

- Vidí: R1 nezná MAC Boba. Paket čeká ve frontě, R1 pošle na Gi0/1 **ARP dotaz** (broadcast do sítě 2: „kdo má 192.168.2.20?“),
  Bob odpoví unicastem, R1 si zapíše záznam. (Jeden krok pro dotaz i odpověď: opakovaný jev, rozhodnutí 36.)
- Text: „Router zná sousední síť, ale MAC adresu Boba ne. Zeptá se přes svou druhou nohu, Gi0/1, a Bob mu
  odpoví. Stejné ARP jako před chvílí, jen v jiné síti.“
- Note: „ARP běží v každé síti zvlášť. Alice se ptala v síti 1 na bránu, router se ptá v síti 2 na Boba.“
- Pozn. pro učitele: tady student vidí, že router je také „hostitel“ ve své síti: chová se k Bobovi jako Alice k bráně.
- Simulátor zjednodušuje: „Skutečný Cisco router by první paket při čekání na ARP zahodil (první ping vyjde `.`); simulátor
  ho drží ve frontě (rozhodnutí 9). Označená „věrnost Cisco“ přijde v úrovni 5.“

#### Krok 11: Nový rámec (tip)

- Vidí: v L3 routeru leží zelený paket (TTL 127, cíl 192.168.2.20), obálka L2 je pryč. Nový rámec ještě
  neexistuje. Tabulka „co je kde“ ukazuje rámec z kroku 8 (zdroj Alice, cíl R1 Gi0/0).
- Text: „Paket je v routeru bez obálky a ví, že jde na Bobovi: MAC Boba už router zná. Jak se bude nový rámec
  lišit od původního?“
- **Tip:** „Která pole se při průchodu routerem změní?“ Zaškrtávací pole (původní hodnoty se ukáží):
  **zdrojová MAC** / **cílová MAC** / **zdrojová IP** / **cílová IP**. Správně: obě MAC, žádná IP.
  Důvod při nesouladu: „Obálku L2 vytváří router znovu pro nový úsek: zdrojem je jeho rozhraní Gi0/1, cílem Bob. Adresy
  IP v paketu se nemění, říkají, odkud kam paket míří celkově.“
- (TTL se tu netipuje, student ho viděl snížit v kroku 9; kontrolní otázka 5.)

#### Krok 12: Nový rámec, nové MAC; IP beze změny (vyhodnotí tip z kroku 11)

- Vidí: paket klesne, dostane novou hnědou obálku, vyrazí z Gi0/1 přímo k Bobovi. Rentgen: dva sloupce
  „před routerem“ (z kroku 8) / „po routeru“: **cílová MAC** `…:01:01` → `…:00:02` (změna), **zdrojová MAC** `…:00:01` → `…:01:02`
  (změna), **zdrojová IP** 192.168.1.10 = 192.168.1.10, **cílová IP** 192.168.2.20 = 192.168.2.20 (beze změny),
  **TTL** 128 → 127 (změna). Kontrolní součet hlavičky se přepočítá (označeno, jen v rentgenu).
- Dělá: v rentgenu **porovná oba rámce** a vyplní si, která pole se změnila.
- Text: „Tvůj tip: <volba>. Skutečnost: MAC adresy se změnily, adresy IP zůstaly. Router pro každý úsek vytvoří nový
  rámec: zdrojová MAC je jeho rozhraní, cílová MAC je další zařízení na cestě.“
- Note: „MAC adresa platí jen v jedné síti, IP adresa v celé cestě. Proto se IP nemění a MAC ano.“
- Aha chvíle číslo 1 celé úrovně (viz níže).
- Simulátor zjednodušuje: „Přepočet kontrolního součtu IP hlavičky je v rentgenu vidět, ale nevysvětluje se.“

#### Krok 13: Bob přijme a odpoví (tip)

- Vidí: Bob přijal rámec (cíl = jeho MAC), rozbalil do L3 (cílová IP je jeho), ICMP Echo Request
  → aplikace `ping` v OS odpovídá. Vzniká **Echo Reply**: nový paket od Boba s výchozím TTL **128** (Bob má
  Windows, jako Alice; reálný Windows používá 128). Odpověď ještě neodešla.
- Text: „Bob přijal Echo Request a odpovídá. Odpověď je nový paket, který Bob odešle s TTL 128. Alice ho uvidí
  po cestě přes router. Jaké TTL v odpovědi uvidí?“
- **Tip:** „Jaké TTL uvidí Alice v odpovědi?“ Volby: **128** / **127** / **126**. Správně: 127. Důvod při nesouladu:
  „Odpověď je nový paket, který má TTL 128, a při cestě zpět projde jedním routerem: 127. TTL z cesty tam se nepřičítá ani
  neodčítá.“
- Pozn.: hodnoty TTL 128 závisí na parametru „TTL PC“ v tabulce parametrů; pokud se použije server s Linuxem (64),
  uvidí student 63 jako ve vektoru `ping-router`.

#### Krok 14: Odpověď se vrací (vyhodnotí tip z kroku 13)

- Vidí: Echo Reply jede opačně: Bob zná MAC brány z ARP (R1 se ho ptal, ARP dotaz byl i pro jeho cache: Bob si tazatele
  zapsal, viz `arp.md`, kap. 4), router zná Alici; **žádné ARP se nekoná**. Router sníží TTL 128 → 127. Alice dostane odpověď.
  Odpověď má zdrojovou IP 192.168.2.20, cílovou 192.168.1.10; MAC adresy se opět mění na každém úseku.
- **Terminál (Alice):** dokončí se výpis `ping`: `Reply from 192.168.2.20: bytes=32 time<1ms TTL=127` (4×, viz Terminál),
  statistika 4 odeslané, 4 přijaté.
- Text: „Tvůj tip: <volba>. Skutečnost: 127. Odpověď je nový paket s TTL 128, router ho snížil o 1. Alice vidí
  v pingu TTL=127.“
- Note: „Přes router se paket vrací stejným způsobem: nový rámec na každém úseku, IP adresy prohozené, TTL −1.“
- Simulátor zjednodušuje: „Animace ukazuje jen první ze čtyř Echo Request. Zbylé tři proběhnou stejně, jen už s naplněnými
  ARP tabulkami; výpis `ping` je ukáže všechny.“

#### Krok 15: ARP tabulky po pingu

- Vidí: tři tabulky vedle sebe (nebo v terminálu): Alice, R1, Bob.
- Dělá: **`arp -a`** na Alici a Bobovi, **`show ip arp`** na R1. Odpoví: **proč Alice nezná MAC adresu Boba?**
- Výsledky: Alice: jen brána (`192.168.1.1 → 02-00-00-00-01-01`). Bob: jen router Gi0/1 (`192.168.2.1 → 02-00-00-00-01-02`).
  R1: dva záznamy, Alice (Gi0/0) a Bob (Gi0/1).
- Text: „Alice nezná MAC adresu Boba a nikdy ji nezjistí: MAC adresy jsou platné jen v jedné síti. Každý
  pozná jen adresy sousedů ve své síti. Router je v obou sítích, a proto zná obě strany.“
- Note: „Z tohoto důvodu nelze přes internet zjistit MAC adresu cizího počítače z jiné sítě.“
- Hint: „Zkus zadat `arp -a` na Cyrilovi: v jeho tabulce není nic, protože s nikým z jiné sítě nemluvil.“

### Část B: Cíl ve stejné síti

#### Krok 16: Ping na souseda (tip)

- Vidí: Alice (se stejnou ARP tabulkou: brána) spouští `ping 192.168.1.30` (Cyril). V L3 paket pro Cyrila
  (cíl 192.168.1.30), rámec ještě neexistuje.
- Text: „Teď Alice pošle ping Cyrilovi, který je ve stejné síti. Kam rámec půjde?“
- **Terminál (Alice): `ping 192.168.1.30`.**
- **Tip:** „Půjde rámec přes router?“ Volby: **Ano, přes bránu** / **Ne, přímo Cyrilovi**. Správně: přímo.
  Důvod při nesouladu: „Maska říká, že Cyril je ve stejné síti (192.168.1.0 = 192.168.1.0). Do stejné sítě se
  posílá přímo, bez brány.“

#### Krok 17: Přímé doručení (vyhodnotí tip z kroku 16)

- Vidí: Alice se ARPem zeptá na Cyrila (jeden krok, jako v 10), rámec pro Cyrila má cílovou MAC Cyrila `…:00:03`, cílová IP
  192.168.1.30. Router nic nevidí (SW1 pošle jen na Fa0/3). V ARP tabulce Alice přibyde Cyril. V panelu Alice se
  zvýrazní **řádek tabulky**, který rozhodl.
- Dělá: **`netstat -nr`** na Alici (výpis Windows, zjednodušený; viz Terminál). Přečte dva řádky:
  `192.168.1.0/24 On-link` a `0.0.0.0/0 → 192.168.1.1`. Odpoví, **který řádek platí pro 192.168.1.30** a **který pro 192.168.2.20**.
- Text: „Tvůj tip: <volba>. Skutečnost: přímo. Alice se podívala do směrovací tabulky. Pro Cyrila platí řádek
  `192.168.1.0/24` (cíl je u mě), pro Boba jen výchozí cesta `0.0.0.0/0` (přes bránu). Když pasují oba řádky, vyhraje delší
  prefix.“
- Note: „Výchozí cesta (0.0.0.0/0) znamená „všechno ostatní“. Alicina výchozí brána je tedy jen řádek v její směrovací tabulce.“
- Simulátor zjednodušuje: „Skutečný `netstat -nr` ve Windows vypíše navíc řádky pro loopback, multicast a broadcast.
  Rozhodování je stejné.“
- Pravidlo „nejdelší shoda prefixu“ (longest prefix match) tu poprvé zazní jako věta: „Když pasuje víc řádků, vyhraje ten
  s delším prefixem.“ Jen jednoduše, bez bitových výpočtů nad rámec kroku 2.

### Část C: TTL a tracert (navazující scénář)

#### Krok 18: Tracert, první sonda (tip)

- Vidí: Alice spustí `tracert 192.168.2.20`. První ICMP Echo Request má **TTL = 1**, leží na vstupu Gi0/0 routeru
  (rámec dorazil, paket v L3 se ještě nezpracoval). Terminál: `Tracing route to 192.168.2.20 over a maximum of 30 hops`.
- Text: „`tracert` posílá pakety s tím nejmenším TTL: první má TTL 1. Co s ním udělá router?“
- **Tip:** „Co udělá router s paketem, který má TTL = 1?“ Volby: **přepošle ho Bobovi** / **zahodí ho** / **zahodí
  ho a ozve se Alici**. Správně: zahodí ho a ozve se Alici. Důvod při nesouladu (přepošle): „TTL se snižuje o 1. Když
  by kleslo na nulu, router paket zahodí.“ (zahodí a mlčí): „Router pošle odesílateli ICMP zprávu Time Exceeded.“
- **Terminál (Alice): `tracert 192.168.2.20`.**
- Napojení na prezentace: `tracert` z prezentací, ukázka cesty k serveru; tady vidí studenti, jak skok po skoku
  vzniká seznam.

#### Krok 19: Time Exceeded

- Vidí: R1 sníží TTL (1 → 0), paket zahodí, pošle Alici **ICMP Time Exceeded** (typ 11, kód 0) v novém paketu:
  zdrojová IP je 192.168.1.1 (adresa rozhraní, odkud zpráva odešla), cílová 192.168.1.10. Alice dostane odpověď a zapíše do
  výpisu první řádek: `1  <1 ms  <1 ms  <1 ms  192.168.1.1`.
- Dělá: v rentgenu **najde Type 11 a v „datech“ ICMP zprávy IP hlavičku původního paketu**, podle níž Alice pozná, kterou
  sondu router zahodil.
- Text: „Tvůj tip: <volba>. Skutečnost: router paket zahodil a poslal Alici zprávu Time Exceeded. Ve zprávě je adresa
  routeru, a tak Alice zná první skok.“
- Note: „TTL chrání síť před nekonečným bloudením paketů (například při smyčce mezi routery). `tracert` toho využívá:
  posílá TTL 1, 2, 3 … a z odpovědí Time Exceeded skládá cestu.“
- Hint: „Adresa z odpovědi je adresa routeru na straně Alice (Gi0/0): ta, ze které odpověď odešla.“
- Simulátor zjednodušuje: „Windows posílá tři sondy na každý skok a čeká. Simulátor animuje jednu, výpis ukáže všechny tři.“

#### Krok 20: Druhá sonda dojde k Bobovi

- Vidí: Alice pošle sondu s **TTL = 2**. R1 ji sníží na 1 a přepošle (jako v kroku 12). Bob odpoví Echo Reply
  (cíl dosažen). Do výpisu přibude řádek `2  <1 ms  <1 ms  <1 ms  192.168.2.20` a `Trace complete.`
- Dělá: přečte výpis `tracert`: **kolik skoků je k Bobovi** (2: router a Bob) a kdo je každý z nich.
- Text: „S TTL 2 prošel paket routerem a dorazil k Bobovi. Seznam adres, které odpověděly, je cesta, kudy paket
  jde.“
- Note: „Cesta zpět může vést jinudy. `tracert` ukazuje jen cestu tam.“ (jen jedna věta, neodbíhat)
- Výpis: viz Terminál.

### Část D: Najdi chybu

Student nic nenastavuje (konfigurace je úroveň 5), ale hledá chybu příkazy, které už zná. Scénář mu dá **dvě rozbité Alice**:
**chybějící bránu** a **špatnou bránu** (192.168.1.254). Chybná maska se záměrně nepoužívá (rozhodnutí 41: skutečný Cisco router
má výchozí proxy ARP, takže by ping se špatnou maskou prošel; maska se vysvětluje v kroku 2). Oprava je tlačítko (rozhodnutí 42).
Obě chyby mají jiný příznak, a to je lekce: hledat po vrstvách zdola nahoru (kabel → adresa, maska, brána → trasa).

#### Krok 21: Chyba 1: chybí výchozí brána

- Vidí: banner „Alice po restartu už nedosáhne na Boba.“ Alice má správnou IP i masku, ale **Default Gateway je prázdná**.
  `ping 192.168.2.20` selže okamžitě, **na drát nevyjde žádný rámec ani ARP dotaz** (příznak: ticho). Výpis (Windows):
  `PING: transmit failed. General failure.` (znění **ověřit při pilotu**, rozhodnutí 46). `ping 192.168.1.1` a `ping 192.168.1.30`
  fungují (síť 1, kabel i switch jsou v pořádku).
- Text: „Do vlastní sítě Alice dosáhne, ven ne. Tentokrát nevyšel z Alice ani ARP dotaz: nemá kam paket poslat.“
- Hint 1: „Funguje ping na Cyrila a na bránu? A na Boba?“
- Hint 2: „V ipconfig zkontroluj řádek Default Gateway.“
- Hint 3: „V animaci nevyjde z Alice žádný rámec. Proč by si Alice nepoložila ani ARP dotaz?“

#### Krok 22: Diagnóza 1 a oprava

- Dělá: vybere příčinu (**kabel** / **maska** / **brána** / **router** / **Bob**), zdůvodní jednou větou: „Bob není v mé síti (maska),
  a protože nemám výchozí bránu, nevím, komu paket předat.“ Příkazy: `ipconfig` (Default Gateway prázdné), `netstat -nr`
  (chybí řádek `0.0.0.0`; zbývá jen `192.168.1.0/24`), `ping 192.168.1.1` (v pořádku).
- Oprava: tlačítko „Oprav bránu“ (nastaví 192.168.1.1). Potom ping projde jako v kroku 14.
- Text: „Bez brány má Alice v tabulce jen svou síť. Pro cíl mimo ni nemá žádný řádek a paket nikam neodejde.“
- Note: „Příznak: z Alice nevyjde nic. Hledej v konfiguraci Alice, ne v síti.“
- Tip pro učitele: nechat studenty napsat postup zdola nahoru: 1. kabel/rozhraní, 2. IP/maska/brána, 3. směrovací tabulka, 4. cíl.

#### Krok 23: Chyba 2: špatná brána (.254)

- Vidí: banner „Jiná Alice, jiná chyba.“ Alice má **Default Gateway 192.168.1.254** (v síti 1 takovou adresu nikdo nemá; správně je .1).
  `ping 192.168.2.20` po chvíli vypíše `Reply from 192.168.1.10: Destination host unreachable.` (4×, 0 přijatých; z `arp.md` kap. 6).
  V animaci vyšle Alice **ARP dotaz na 192.168.1.254** (broadcast, SW1 ho rozešle, Cyril i R1 ho zahodí, protože adresa není jejich),
  odpověď nepřijde, po třech pokusech se ARP vzdá. Paket pro Boba neodešel.
- Text: „Ping na Boba selhal a nic nepřišlo zpátky. Tentokrát Alice nějaký rámec poslala. Podívej se, na koho se ptala.“
- Hint 1: „Zkus `ping 192.168.1.1` a `ping 192.168.1.30`. Funguje?“ (Ano: síť 1 je v pořádku.)
- Hint 2: „Porovnej výchozí bránu v `ipconfig` s adresou routeru, kterou vidíš v topologii.“
- Hint 3: „Podívej se na animaci: na koho se Alice ptala v ARP dotazu? Odpověděl někdo?“
- Důležité: stopa je „ARP dotaz na bránu, která neodpovídá“. Odlišuje se od kroku 21 (nevyšlo nic) i od správného případu
  (ARP na bránu dostane odpověď).

#### Krok 24: Diagnóza 2 a oprava

- Dělá: vybere příčinu (**brána**) a zdůvodní: „Alice posílá paket na adresu, kterou v síti nikdo nemá, a tak nezíská MAC
  dalšího skoku.“ Příkazy: `ipconfig` (brána 192.168.1.254), `arp -a` (u 192.168.1.254 žádný záznam), `netstat -nr`
  (výchozí cesta ukazuje na .254), `ping 192.168.1.254` (nepřijde odpověď).
- Oprava: tlačítko „Oprav bránu“ (192.168.1.254 → 192.168.1.1). Potom ping projde.
- Text: „Výchozí brána musí být adresa routeru v tvé síti. Alice poslala paket na adresu, kterou nemá nikdo, a ARP zůstal bez odpovědi.“
- Note: „Rozdíl obou chyb: chybí brána → z Alice nevyjde nic; špatná brána → ARP dotaz bez odpovědi.“
- Pozn. pro učitele (odkaz na úroveň 5): **chybějící brána na Bobovi** (nemá 192.168.2.1): Alicin Echo Request dojde, odpověď ne;
  Alice vidí `Request timed out`. Chyba je na druhém konci („Chybu opravím tam, kde ji vidím“).

#### Krok 25: Shrnutí: co se mění a co ne

- Vidí: tabulka s dvěma sloupci: **mění se na každém skoku** (zdrojová a cílová MAC, v routeru nová obálka L2, TTL −1,
  kontrolní součet IP hlavičky) a **zůstává** (zdrojová a cílová IP adresa, data). Pod ní: rozhodování hostitele
  (maska → přímo / přes bránu) a routeru (tabulka → rozhraní + next hop → ARP → nový rámec).
- Text: „Paket putuje po úsecích. Na každém úseku má rámec jiné MAC adresy, adresy IP zůstávají. Router se rozhoduje podle cílové
  IP adresy a směrovací tabulky.“
- Note: „Na závěr si zkus odpovědět: kolik různých rámců potkal ping z kroku 3? (Odpověď v kontrolních otázkách.)“
- Hint: „Nezapomeň: ARP se ptá jen v jedné síti, na adresu dalšího skoku, ne na cíl.“

## „Aha“ chvíle

1. **Rentgen před a po routeru** (krok 12): obě MAC se změnily, obě IP zůstaly. Student tipoval zhruba „vše se změní“
   nebo „nic“; vidí, že každá adresa platí v jiném rozsahu (MAC jeden úsek, IP celá cesta).
2. **Cílová MAC je brána, cílová IP je Bob** (krok 8): dvě různé cílové adresy v jedné zprávě.
3. **ARP dotaz se zastaví na routeru** (krok 6), a proto Alice **nezná MAC Boba** (krok 15): MAC adresy z jiných sítí
   nikdy neuvidíme.
4. **Ping na Cyrila nejde přes router, ping na Boba ano** (krok 17): rozhodl ho jediný údaj, maska.
5. **TTL=127** v odpovědi (krok 14), nikoli 128 ani 126: odpověď je nový paket.
6. **Time Exceeded** (krok 19): chyba „router zahodil paket“ je zpráva, která se vrátí, a `tracert` se z ní skládá.
7. **Dvě chyby, dva příznaky** (kroky 21 až 24: ticho × ARP bez odpovědi): kdo ví, co se děje na drátě, pozná chybu z toho, co **nevyšlo** z Alice.

## Miskoncepce a jak je scénář vyvrací

| Miskoncepce | Kde se vyvrací |
|---|---|
| „Router zná celou cestu k cíli.“ | Kroky 9–10: router zná jen své přímo připojené sítě a další krok; rozhodnutí jednoho routeru zobrazuje panel jen pro něj. Pozn.: s jedním routerem se plně neukáže, rozšíření v úrovni 5 (statické trasy). |
| „Alice posílá rámec Bobovi (cílová MAC je Bob).“ | Kroky 3–4 (tip), 8 (rentgen): cílová MAC je brány, cílová IP Boba. |
| „IP adresa se po cestě mění.“ | Krok 12: rentgen před/po, IP beze změny, MAC změněné. |
| „MAC adresa putuje s paketem až k příjemci.“ | Kroky 11–12 (tip, před/po), 15 (Alice Bobovu MAC nezná). |
| „ARP zjistí MAC kteréhokoli počítače (i v internetu).“ | Kroky 5–6 (tip: broadcast se zastaví na routeru), 15. |
| „Brána je cíl, kam paket míří.“ | Krok 8: cíl IP je Bob; brána je jen příjemce rámce. |
| „Maska je číslo, které se píše do nastavení, a nic nedělá.“ | Kroky 2, 16–17 (maska rozhoduje přímo / brána). |
| „Router posílá všem (jako hub).“ | Krok 6: broadcast se zastaví; kroky 9–12: jedno rozhraní podle tabulky. |
| „Router jen přepošle rámec dál.“ | Kroky 9–12: obálka L2 se zahodí a vznikne nová (animace „obálka odpadne“). |
| „TTL se sčítá tam i zpět (nebo odpověď má TTL původního paketu).“ | Kroky 13–14 (tip 128/127/126). |
| „TTL je čas v sekundách.“ | Krok 19: TTL se snižuje po routerech, ne s časem (RFC 791 sekundy, prakticky skoky; poznámka ve slovníku). |
| „`tracert` zná cestu předem.“ | Kroky 18–20: seznam vzniká postupně z odpovědí Time Exceeded. |
| „Chyba v síti je vždy v kabelu / u cíle.“ | Kroky 21–24: obě chyby jsou v konfiguraci Alice (brána chybí, brána špatná) a prozradí se jiným příznakem. |

## Rentgen: co student najde

| Krok | Obálka | Pole, která student najde | Proč |
|---|---|---|---|
| 3 | L3 (IPv4, ICMP) | Zdrojová IP, Cílová IP, Protocol (1 = ICMP), TTL (128) | cíl je Bob; ICMP bez L4 |
| 5 | L2 (ARP) | Cílová MAC `ff:ff:ff:ff:ff:ff`, EtherType `0x0806`, Opcode 1, Sender/Target IP | ARP je přímo v rámci, ne v IP paketu |
| 7 | L2 (ARP) | Opcode 2, Sender MAC = `…:01:01`, cílová MAC rámce = Alice | odpověď unicast |
| 8 | L2 + L3 | cílová MAC = brána, cílová IP = Bob | dvě různé cílové adresy |
| 12 | L2 + L3, před/po | MAC změněné, IP beze změny, TTL −1 | hlavní myšlenka úrovně |
| 14 | L3 (ICMP) | Type 0 (Echo Reply), TTL 128 → 127 | odpověď je nový paket |
| 19 | L3 (ICMP) | Type 11, Code 0, vložená IP hlavička původního paketu | důkaz, kterou sondu router zahodil |

Rentgen ukazuje délku polí v bitech (rozhodnutí 33). Pořadí polí je skutečné (cílová MAC první); štítek obálky
zůstává „zdrojová → cílová“ (rozhodnutí 15). ICMP Time Exceeded přináší v datech IP hlavičku + prvních 8 B původního
paketu (`icmp.md`, kap. 3).

## Terminál: kdy a proč

Terminál je volitelný (student může krok projít i bez něj) a otevírá se tam, kde odpovídá na právě položenou otázku.
Přibývají příkazy `ping`, `tracert`, `netstat -nr` (Windows), `show ip route`, `show ip arp` (IOS).

| Krok | Zařízení | Příkaz | Co student zjistí |
|---|---|---|---|
| 1 | Alice | `ipconfig` | IP, maska a brána (úroveň 2 bránu neukazovala) |
| 3 | Alice | `ping 192.168.2.20` | spustí; výsledek se doplní v kroku 14 |
| 4 | Alice | `arp -a` | prázdná ARP tabulka (stav před ARP) |
| 6 | Cyril | `arp -a` | Cyril si Alici nezapamatoval |
| 7 | Alice | `arp -a` | záznam brány (192.168.1.1), ne Boba |
| 9 | R1 | `show ip route` | přímo připojené sítě C, adresy rozhraní L |
| 14 | Alice | (výstup `ping`) | `TTL=127`, 4 odpovědi |
| 15 | Alice, Bob, R1 | `arp -a`, `arp -a`, `show ip arp` | Alice zná jen bránu, R1 oba |
| 16 | Alice | `ping 192.168.1.30` | ping sousedovi: bez routeru |
| 17 | Alice | `netstat -nr` | dva řádky: síť a výchozí cesta |
| 18 | Alice | `tracert 192.168.2.20` | seznam skoků vzniká |
| 9 | R1 | `show ip interface brief` | (volitelně) rozhraní Gi0/0, Gi0/1 a jejich adresy |
| 21–24 | Alice | `ping`, `ipconfig`, `arp -a`, `netstat -nr` | diagnostika |

Ukázkové výstupy (anglicky; formát **ověřit** na školním PC a v Packet Traceru, jako u `cmd.md`):

```
C:\Users\student>ping 192.168.2.20

Pinging 192.168.2.20 with 32 bytes of data:
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127
Reply from 192.168.2.20: bytes=32 time<1ms TTL=127

Ping statistics for 192.168.2.20:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 0ms, Maximum = 0ms, Average = 0ms
```

```
C:\Users\student>tracert 192.168.2.20

Tracing route to 192.168.2.20 over a maximum of 30 hops

  1    <1 ms    <1 ms    <1 ms  192.168.1.1
  2    <1 ms    <1 ms    <1 ms  192.168.2.20

Trace complete.
```

```
C:\Users\student>netstat -nr

IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      192.168.1.1    192.168.1.10     25
      192.168.1.0    255.255.255.0         On-link     192.168.1.10    281
===========================================================================
```

```
R1#show ip route
Codes: L - local, C - connected, S - static
Gateway of last resort is not set

      192.168.1.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.1.0/24 is directly connected, GigabitEthernet0/0
L        192.168.1.1/32 is directly connected, GigabitEthernet0/0
      192.168.2.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.2.0/24 is directly connected, GigabitEthernet0/1
L        192.168.2.1/32 is directly connected, GigabitEthernet0/1
```

- `Gateway of last resort is not set` je skutečný řádek IOS (výchozí cesta na routeru chybí): „router nemá výchozí
  cestu, a tak o sítích mimo své dvě neví“. V tomto scénáři se nevysvětluje; student se k němu vrátí v úrovni 5.
- Chyby: `Reply from 192.168.1.10: Destination host unreachable.` (krok 21, ARP bez odpovědi; z `arp.md` kap. 6),
  `PING: transmit failed. General failure.` (krok 23, **ověřit**), `Request timed out.` (volitelné rozšíření v kroku 24).
- **Simulátor zjednodušuje:** výpisy bez IPv6 a bez dalších adaptérů; časy `<1 ms` jsou orientační.

## Kontrolní otázky (konec úrovně)

1. Alice posílá ping Bobovi, který je za routerem. Jaká cílová MAC a jaká cílová IP jsou v rámci, který Alice odešle?
   Očekávaná odpověď: cílová MAC je MAC brány (routeru), cílová IP je IP Boba.
2. Jak Alice pozná, že má poslat paket bráně a ne přímo Bobovi? Co by se změnilo u Cyrila?
   Očekávaná odpověď: porovná síťovou část své adresy a cílové adresy podle masky (nebo najde řádek ve směrovací tabulce);
   Bob je v jiné síti, Cyril ve stejné (přímé doručení).
3. Proč Alice nikdy nezná MAC adresu Boba? Na koho se v ARP ptá?
   Očekávaná odpověď: ARP funguje jen v jedné síti (broadcast se přes router nepřenáší); ptá se na MAC adresu brány,
   tedy dalšího skoku.
4. Která pole rámce a paketu se při průchodu routerem změní a která ne?
   Očekávaná odpověď: změní se obě MAC adresy (a TTL, a s ním kontrolní součet hlavičky); zdrojová a cílová IP se nemění.
5. Proč je v odpovědi na ping TTL 127, když Bob odpovídá s TTL 128?
   Očekávaná odpověď: odpověď je nový paket s TTL 128; na cestě zpět ho router sníží o 1. (Podle parametru; u Linuxu 64 → 63.)
6. K čemu slouží TTL a jak z něj vychází `tracert`?
   Očekávaná odpověď: zabraňuje věčnému bloudění paketů; router TTL sníží a při nule paket zahodí a pošle Time Exceeded;
   `tracert` posílá TTL 1, 2, 3 … a z adres odesílatelů těchto zpráv skládá cestu.
7. Kolik různých rámců potkal ping z kroku 3 na cestě tam (ARP nepočítej)? Čím se liší?
   Očekávaná odpověď: dva: Alice → R1 (Gi0/0) a R1 (Gi0/1) → Bob; liší se MAC adresami, paket uvnitř má stejnou IP.
8. Alice nemůže pingnout Boba. Jaké dva příznaky můžeš na síti vidět a co znamenají: (a) Alice se ARPem ptá na adresu,
   kterou nikdo nemá (.254),
   (b) z Alice nevyjde žádný rámec?
   Očekávaná odpověď: (a) špatná brána (adresa, kterou nikdo nemá): ARP dotaz zůstane bez odpovědi; (b) chybí výchozí brána:
   nemá komu paket předat.
9. Co říká `netstat -nr` (resp. `show ip route`) a podle čeho se vybírá řádek, když pasuje víc?
   Očekávaná odpověď: seznam cílových sítí s dalším skokem (nebo „přímo“); vybírá se nejdelší shoda prefixu
   (`/24` před `/0`).

## Vazba na maturitu IVT a Michalovy prezentace

- **Maturita IVT, okruh 12 Počítačové sítě** (rozhodnutí 11): IP adresace a maska (kroky 1–2), brána a její chyby (21–24), brána a směrování
  (kroky 3–12), příkazy pro zjišťování konfigurace (`ipconfig`, `ping`, `tracert`, `arp -a`, `netstat -nr`), úloha routeru
  (hub / switch / router: kroky 6, 9–12). Úroveň 3 pokrývá „jak se chová router“; „co je router“ a srovnání se zařízeními
  úrovně 2 je v krocích 0, 25 a v kontrolních otázkách.
- **Michalovy prezentace:** domácí LAN 192.168.1.0/24 s bránou 192.168.1.1 (parametry scénáře), příkazy `ipconfig`,
  `ping`, `tracert`, `arp -a`, `netstat -nr` (všechny se tu dostanou ke slovu a řeší konkrétní otázku), vrstvy L1–L3 jako
  rozvržení „U“ (router = obrácené U do L3). Scénář nekopíruje obrázky doslova: místo „internetu“ (seznam.cz) je druhá síť
  192.168.2.0/24, protože privátní adresy bez NAT do internetu nepůjdou (rozhodnutí 5); k „seznam.cz“ se student dostane
  s NAT v úrovni 5.
- **CCNA (ITN):** IPv4 adresace, výchozí brána, ARP, směrovací tabulka (C, L), ICMP (Echo, Time Exceeded), `show ip route`;
  základy diagnostiky po vrstvách.

## Testovací kritéria pro implementaci

Platí pro budoucí `scenarios/uroven3-smerovani.js` a trace simulace (jména událostí podle specifikací); hodnoty závisí na
tabulce parametrů.

- Výchozí stav: ARP tabulky Alice, Cyril, Bob, R1 prázdné; MAC tabulka SW1 prázdná; směrovací tabulky podle vektoru
  `ping-router` (Alice a Bob: connected + default; R1: C a L pro obě sítě).
- ARP dotaz Alice: cílová MAC rámce `ff:ff:ff:ff:ff:ff`, EtherType `0x0806`, TPA 192.168.1.1; SW1 ho rozešle na Fa0/3 a Fa0/4
  (ne zpět); Cyril `arp_ignore` bez nového záznamu; Bob žádnou událost; R1 `arp_reply` a záznam Alice.
- Rámec Alice → R1: cílová MAC `02:00:00:00:01:01`, zdrojová `02:00:00:00:00:01`; IP zdroj 192.168.1.10, cíl 192.168.2.20; TTL 128;
  SW1 přepošle jen na Fa0/4 (naučeno z ARP odpovědi); Cyril nic.
- R1: TTL 127; nový rámec zdroj `02:00:00:00:01:02`, cíl `02:00:00:00:00:02`; IP beze změny; kontrolní součet IP přepočítán;
  před tím `arp_request` na Gi0/1 pro 192.168.2.20.
- Echo Reply: IP zdroj 192.168.2.20, cíl 192.168.1.10, TTL 128 u Boba, 127 u Alice; bez ARP (cache naplněné).
- `arp -a` na Alici po pingu: jediný dynamický záznam 192.168.1.1; Bob: 192.168.2.1; `show ip arp` na R1: 2 záznamy.
- Ping na Cyrila: ARP na 192.168.1.30; rámec přímo na `…:00:03`; R1 nezasažen. `netstat -nr` na Alici: přesně dva řádky aktivních cest.
- Tracert: sonda TTL 1 → R1 pošle ICMP 11/0 (zdroj 192.168.1.1, adresa rozhraní, odkud odchází) a nepřepošle; sonda TTL 2 → Bob
  Echo Reply; výpis dvou řádků + `Trace complete.`
- Chyba 1 (bez brány): žádný rámec z Alice, `PING: transmit failed. General failure.` Chyba 2 (brána 192.168.1.254): ARP dotaz na
  192.168.1.254 bez odpovědi (Cyril a R1 zahodí), po 3 pokusech `Destination host unreachable` od 192.168.1.10; paket nikdy neodešel.
  Tlačítko „Oprav bránu“ nastaví 192.168.1.1 a ping projde.
- R1: `traceroute` odmítne hláškou „v této úrovni použij tracert na PC“ (rozhodnutí 45); `enable`, `show ip route`, `show ip arp`,
  `show ip interface brief`, `ping` fungují.
- Kroky tipu (3, 5, 11, 13, 16, 18): žádný výsledek před potvrzením; následující krok vyhodnotí; tip se neukládá ani neblokuje
  „Krok vpřed“; přehrávání se na tipu zastaví. Krok vzad vrátí přesně předchozí stav včetně ARP a MAC tabulek.
- Zápis MAC: Windows pomlčky, Cisco tečky, rentgen dvojtečky.

## Rozhodnuto (dříve otevřené otázky; `docs/rozhodnuti.md` 39–48)

1. Jedna úroveň s částmi A–D a skokem na začátek části v UI (43). 2. Tip v kroku 11 se vyhodnotí v kroku 12 (43). 3. Oprava tlačítkem
„Oprav bránu“ (42). 4. Hlášky Windows a formáty výpisů se ověří při pilotu (46). 5. Bob je PC, TTL 128 → 127 (39). 6. Longest prefix match
jen u Alice (kroky 9, 17). 7. Animace jedné sondy `tracert`, výpis tří časů; jeden router, 2 řádky (44). 8. Slovník: sekce „Doplnění pro úroveň 3“
čeká na schválení projektantem. 9. L4 při pingu přeskočené, šrafované, „ICMP nemá porty“ (47). Router v pruhu média: věž do L3 se dvěma
nohami, starý rámec přerušovaný se zahodí (48).
