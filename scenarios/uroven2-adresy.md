# Scénář úrovně 2: Adresy

Text pro implementaci. Stav: návrh učitele (iterace 2). Platí `docs/rozhodnuti.md` (hlavně 8, 13, 14, 15,
16) a `docs/spec/ethernet.md`. Texty v uvozovkách jsou texty simulátoru (oslovení „ty“). Terminál
vypisuje anglicky (rozhodnutí 10). Po schválení se k tomuhle souboru přidá `uroven2-adresy.js`.

## Cíl a nová myšlenka

Obálka nese adresu a **každá vrstva má vlastní druh adresy**: linková MAC (kdo je na drátě v téhle
síti), síťová IP (které rozhraní v síti), transportní port (která aplikace v počítači). Každá vrstva
u příjemce kontroluje jen svou adresu. IP adresa + port = **socket**.

Druhá, na ní stavěná část: **hub** rozešle všechno všem, **switch** se z provozu učí a posílá
rámec jen tam, kde cíl je (a neznámý cíl rozešle jako hub: flooding).

Výukové cíle: viz `docs/didaktika.md`, úroveň 2.

## Uzly a prostředí

Tři PC a jedno zařízení uprostřed; úroveň začíná s **hubem**, v kroku 10 student zařízení **vymění za
switch** (stejné kabely, stejné porty).

| Uzel | Kabel do portu | MAC | IP (192.168.1.0/24) | Aplikace |
|---|---|---|---|---|
| Alice (PC A) | 1 / `Fa0/1` | `02:00:00:00:00:01` | 192.168.1.10 | „zprávy“ (klient, zdrojový port 50001) |
| Bob (PC B) | 2 / `Fa0/2` | `02:00:00:00:00:02` | 192.168.1.20 | „zprávy“ naslouchá na UDP 5000, „poznámky“ na UDP 6000 |
| Cyril (PC C) | 3 / `Fa0/3` | `02:00:00:00:00:03` | 192.168.1.30 | žádná se zprávou nepracuje |

- Hub nemá jména portů (v UI „port 1–3“), switch Cisco styl `Fa0/1–3` (slovník: na switchi „port“).
- Zpráva 1: „Ahoj, Bobe!“ (Alice 50001 → Bob 5000, UDP). Odpověď: „Ahoj, Alice!“ (Bob 5000 → Alice 50001).
  Zpráva 2: „Sejdeme se v 16:00“ (Alice 50001 → Bob 6000). Samé ASCII, aby bajty = znaky.
- Aplikace „zprávy“ je z úrovně 1 stejná, jen teď má port. Zdrojový port 50001 přidělil Alice operační
  systém (jedna věta v kroku 2; že je náhodný z rozsahu, ukáže úroveň 4).
- Předvyplněná ARP tabulka (`initial_state.arp_cache`): Alice zná Boba (192.168.1.20 → `02:…:02`),
  Bob zná Alici (192.168.1.10 → `02:…:01`; Bob ji potřebuje pro odpověď, ARP cache se z přijatého
  provozu sama nevytváří, viz `docs/spec/arp.md`). Cyril: prázdná. MAC tabulka switche: prázdná.
- **Simulátor zjednodušuje (rozhodnutí 14):** „MAC adresu Boba už PC A zná; jak ji zjistí, uvidíš
  v úrovni 3.“ Zobrazit v kroku 4 a u `arp -a`. Další zjednodušení: IP adresu Boba Alice „zná“
  (jak ji zjistí z názvu, ukáže úroveň 4, DNS); maska se jen ukazuje, nepočítá se (úroveň 3);
  kolize na hubu se nemodelují (rozhodnutí 8); bity bez preambule (rozhodnutí 16).
- Ovládání jako v úrovni 1 (Krok vpřed/zpět, Přehrát, rychlost, Obnovit), nově **rentgen** (klik na
  obálku, klávesa R), **terminál** (klik na PC nebo switch, `` ` ``/F2) a tlačítko **Vyměnit hub za switch**
  (aktivní od kroku 10). Režim ISO/OSI / TCP/IP zůstává. Štítek L2 vždy „zdrojová MAC → cílová MAC“
  (rozhodnutí 15); v rentgenu pole ve skutečném pořadí (cílová MAC první).

### Proč MAC `02:00:00:00:00:0x` a vysvětlení

Rozhodnutí: adresy ve scénáři **nevysvětlovat v krocích**, jen jedna věta v rentgenu u pole „Zdrojová
MAC“ (rozbalitelný detail, ne v hlavní vysvětlivce): „Adresy 02:… jsou vymyšlené pro simulátor
(lokálně spravované). Skutečná karta má první tři bajty podle výrobce (OUI).“ Zdůvodnění: význam bitu
U/L je CCNA detail, který na úrovni 2 odvádí pozornost (student má pochopit, že MAC je adresa
na L2, ne k čemu slouží bity prvního bajtu); ale zamlčet to nejde, student si všimne, že
adresy jsou „moc hezké“, a první věta ho uklidní, že jsou záměrně vymyšlené. Díky tvaru `…:0x`
se adresy dají číst očima a poznat, čí rámec je kde. Nepravdivé nic neříkáme. Poznámka pro vývojáře: úroveň 1
má v `.js` jiné MAC (`02:a1:1c:e0:00:01`); doporučuji sjednotit obě úrovně na `02:00:00:00:00:0x`
(úroveň 1 MAC nezobrazuje, změna je bez dopadu na texty).

Zápis MAC se liší podle prostředí: rentgen a štítky `02:00:00:00:00:01`, Windows terminál
`02-00-00-00-00-01`, Cisco `0200.0000.0001`. Jedna adresa, tři zápisy; hint v kroku 3 (viz níže) to řekne.

## Kroky

Číslování `0–17` (UI „Krok n z 17“). Každý krok: co student vidí, co dělá, text vysvětlivky (max. 2 věty,
případně „note“ a „Simulátor zjednodušuje“). **Predikce** = student před krokem klikem odpoví; simulace
ukáže skutečnost a vysvětlivka srovná („Čekal jsi… / Je to jinak, protože…“); špatná předpověď nic
nepenalizuje a nic se neukládá.

### Část A: tři adresy v jedné obálce (hub)

#### Krok 0: Úvod

- Vidí: Alice, Bob a Cyril na hubu. Zpráva „Ahoj, Bobe!“ u Alice.
- Dělá: nic; „Začít“.
- Text: „V úrovni 1 zpráva dostala obálky. Teď se podíváš, co je v obálkách napsané: adresy.“

#### Krok 1: Co o sobě počítač ví

- Vidí: u Alice se otevře terminál a nabídne příkaz `ipconfig /all` (tlačítko „Spustit za mě“, nebo ho
  student napíše).
- Dělá: **najde ve výpisu dvě adresy** Alice: fyzickou adresu (MAC) a IPv4 adresu. Port tam není.
- Text: „Síťová karta má adresu MAC a rozhraní má adresu IP. Port tu nenajdeš: patří aplikaci, ne
  kartě.“
- Hint: „Fyzická adresa je MAC adresa. Ve Windows se zapisuje s pomlčkami.“
- Proč zde: student si dřív než uvidí obálky ověří, že obě adresy opravdu existují na „skutečném“ příkazu
  ze školního PC. Terminál tu slouží jako ověření („to samé uvidíš doma“), ne jako cíl.
- Výpis (zkráceně, anglicky): `Physical Address . . . : 02-00-00-00-00-01`,
  `IPv4 Address. . . . . : 192.168.1.10`, `Subnet Mask . . . . : 255.255.255.0`.

#### Krok 2: Obálka transportní vrstvy: porty

- Vidí: data sjedou na L4, zelená obálka (segment). Štítek „L4 Transportní“, vedle „UDP“.
- Dělá: klikne na obálku, v rentgenu **najde pole Zdrojový port a Cílový port** (50001 a 5000).
- Text: „Transportní vrstva napsala do obálky porty. Cílový port 5000 říká, které aplikaci u Boba zpráva
  patří; zdrojový port 50001 je číslo, které operační systém přidělil Alicině aplikaci, aby věděla,
  kam má přijít odpověď.“
- Note: „Port je číslo v obálce transportní vrstvy. Neznamená žádnou díru ani konektor.“
- Detail u Boba (klik na vrstvu aplikační): „Aplikace ‚zprávy‘ naslouchá na portu 5000, aplikace
  ‚poznámky‘ na portu 6000. Podle portu operační systém pozná, které z nich zprávu předat.“ (vyvrací
  „port = díra“, dvě aplikace na jednom PC)
- Simulátor zjednodušuje: „UDP si teď jen prohlížíš; jak funguje a čím se liší od TCP, uvidíš v úrovni 4.“

#### Krok 3: Obálka síťové vrstvy: IP adresy a socket

- Vidí: modrá obálka (paket). Nad bloky se na chvíli spojí „IP adresa + port“ do dvojice
  `192.168.1.10:50001 → 192.168.1.20:5000`.
- Dělá: v rentgenu **najde Zdrojovou a Cílovou IP adresu a pole Protocol** (hodnota 17 = UDP).
- Text: „Síťová vrstva napsala adresy IP. Adresa IP spolu s portem se jmenuje socket, například
  192.168.1.20:5000.“
- Note: „Pole Protocol (17) říká síťové vrstvě u příjemce, že uvnitř paketu je UDP segment.“
  (projektantovo zpřesnění: vrstva čte z hlavičky i údaj „co je uvnitř“; obsah sám nečte)
- Hint: „Obálka rámce bude mít MAC adresy. MAC můžeš v rentgenu a v terminálu vidět v jiném zápisu
  (dvojtečky, pomlčky, tečky), je to pořád jedna adresa.“

#### Krok 4: Obálka linkové vrstvy: MAC adresy

- Vidí: fialová obálka (rámec). Štítek „L2 Linková: 02:…:01 → 02:…:02“. Pod obálkou pruh
  „ARP tabulka Alice: 192.168.1.20 → 02:…:02“.
- Dělá: klikne na obálku; v rentgenu **najde Cílovou MAC, Zdrojovou MAC a EtherType** (`0x0800`:
  uvnitř je IPv4 paket). Může otevřít terminál u Alice a spustit `arp -a`.
- Text: „Linková vrstva napsala adresy MAC: svou a Bobovu. Bobovu MAC adresu našla v ARP tabulce.“
- **Terminál (Alice): `arp -a`.** Proč zde: student se přirozeně ptá, odkud Alice Bobovu MAC zná.
  Výpis: `192.168.1.20   02-00-00-00-00-02   dynamic`.
- Simulátor zjednodušuje: „MAC adresu Boba už PC A zná; jak ji zjistí, uvidíš v úrovni 3.“
- Note: „Rámec nese MAC adresy jen pro tuhle síť. Odesílatel a příjemce jsou tu stejní jako Alice a Bob,
  protože jsou ve stejné síti; za routerem to platit nebude.“ (rozhodnutí 15, úroveň 3)
- Detail v rentgenu u pole Zdrojová MAC (rozbalitelný): věta o MAC `02:…` (viz výše).

#### Krok 5: Bity jedou k hubu

- Vidí: bity z Alice po kabelu do hubu.
- Text: „Zbývá poslat rámec. Je to hub, bity prostě jedou dál.“
- Predikce (klik, před krokem 6): „Které počítače dostanou rámec? Bob / Cyril / oba.“

#### Krok 6: Hub rozešle všem

- Vidí: hub zopakuje rámec na všechny porty kromě toho, odkud přišel; bity jedou k Bobovi i Cyrilovi.
- Text: „Hub nečte žádné adresy. Co přijde na jeden port, pošle na všechny ostatní.“
- Note: „Hub je zařízení fyzické vrstvy: pracuje s bity, ne s rámci.“ (vyvrací „hub = switch“; slovník: hub
  se neoznačuje „opakovač“, rozhodnutí 16)
- Simulátor zjednodušuje: „Na hubu by dva počítače vysílající současně způsobily kolizi; tu
  nesimulujeme.“ (rozhodnutí 8)

#### Krok 7: Cyril rámec zahodí

- Vidí: u Cyrila přijmou bity jen na L1–L2; rámec se složí a hned zmizí. Vrstvy L3, L4 a aplikace
  zůstanou šedé. U Boba stejný příjem pokračuje.
- Dělá: klikne na rámec u Cyrila a v rentgenu **porovná Cílovou MAC (`…:02`) s MAC Cyrilovy karty
  (`…:03`)**. Může u Cyrila spustit `arp -a`: `No ARP Entries Found.` (Cyril o rámci nic neví, nic
  se nenaučil.)
- Text: „Cyril rámec taky dostal. Jeho síťová karta porovnala cílovou MAC se svou, nesedí a rámec zahodila.
  Operační systém Cyrila o něm nic neví.“
- Note: „MAC adresu kontroluje síťová karta, ne operační systém ani aplikace.“ (Kdo se stará o L2.)
- Poznámka pro učitele: rámec fyzicky do Cyrilovy karty dorazil. Zahodil ho jen filtr podle MAC;
  nejde o tajnost (kdo má Wireshark v promiskuitním režimu, uvidí ho). Neuvádět v hlavním textu;
  vhodné do diskuse (otázka 3).

#### Krok 8: Bob rozbalí a každá vrstva zkontroluje svou adresu (8a, 8b, 8c)

- Vidí: tři postupné kroky jako ve scénáři 1. U každého se zvýrazní pole obálky, které vrstva čte.
- 8a (L2): „Cílová MAC je Bobova, karta rámec přijala a vrstva sundala obálku.“
- 8b (L3): „Cílová IP adresa je Bobova, síťová vrstva sundala obálku.“
- 8c (L4): „Cílový port 5000: operační systém předal zprávu aplikaci ‚zprávy‘.“
- Dělá: u každého kroku může kliknout na zvýrazněné pole.
- Text (po 8c): „Každá vrstva zkontrolovala svou adresu: MAC, IP a port. Teprve potom zpráva dorazila.“
  (Zpráva se objeví v aplikaci Boba „zprávy“, v „poznámkách“ ne; ta je šedá.)

#### Krok 9: Bob odpoví

- Vidí: Bob pošle „Ahoj, Alice!“; v obálkách jsou adresy prohozené: porty 5000 → 50001, IP
  `…20 → …10`, MAC `…:02 → …:01`. Rámec jede přes hub k Alici i Cyrilovi, Cyril ho opět zahodí
  (zkrácená animace, bez rozbalování u Cyrila).
- Dělá: **v rentgenu porovná** zdrojové a cílové pole s předchozí zprávou.
- Text: „Odpověď má v obálkách stejné adresy, jen prohozené: odesílatel a příjemce si vyměnili role.“
- Pozn. pro učitele: socket klienta `192.168.1.10:50001` a serveru `192.168.1.20:5000` je to, co
  jednoznačně určuje „kdo s kým mluví“.

#### Krok 10: Shrnutí hubu a výměna za switch

- Vidí: tabulka „Kdo rámec dostal“ (Bob: přijal, Cyril: zahodil, Alice: zdroj) pro obě zprávy. Tlačítko
  „Vyměnit hub za switch“.
- Text: „Hub poslal oba rámce všem a Cyril je dvakrát zbytečně zahazoval. Co by měl dělat chytřejší
  prostředník?“
- Predikce: „Bude se switch chovat jako hub? Ano / ne / zatím nevím.“ (jen zaznamenat do vysvětlivky;
  student ji potvrdí kroky 11–16.)

### Část B: switch se učí

#### Krok 11: Prázdná MAC tabulka

- Vidí: hub zmizí, na jeho místě switch s portem 1 (Alice), 2 (Bob), 3 (Cyril); u switche
  panel „MAC tabulka“ (prázdná). Alice znovu odešle zprávu 1 („Ahoj, Bobe!“), obálky už hotové.
- Dělá: u switche otevře terminál a spustí **`show mac address-table`**: prázdná tabulka (jen
  záhlaví a `Total Mac Addresses for this criterion: 0`). Proč zde: student vidí „před“, aby viděl
  „po“ v kroku 15.
- Text: „Switch je zařízení linkové vrstvy: čte MAC adresy v rámci. MAC tabulka je zatím prázdná, nic
  nezná.“
- **Predikce (klik):** „Na které porty switch rámec pošle? Fa0/2 / Fa0/3 / oba.“ (Fa0/1 se nenabízí:
  tam rámec přišel.) Většina studentů zvolí Fa0/2: je to nejčastější podoba miskoncepce.

#### Krok 12: Switch se učí zdrojovou MAC

- Vidí: rámec přijde na Fa0/1; do tabulky přibude řádek `02:…:01 → Fa0/1`; zvýrazní se zdrojová MAC
  rámce.
- Text: „Switch čte zdrojovou MAC rámce a zapíše si: Alice je na portu Fa0/1.“
- Note: „Učí se jen ze zdrojové adresy: tím ví, odkud kdo mluví.“

#### Krok 13: Cíl je neznámý: flooding

- Vidí: switch hledá `02:…:02`, nenajde. Rámec rozešle na Fa0/2 i Fa0/3 (kromě Fa0/1). Cyril rámec
  zahodí jako v kroku 7, Bob ho přijme (zkrácená animace bez rozbalování; zpráva dorazí do „zprávy“).
- Text: „Boba switch zatím nezná, a tak rámec rozešle na všechny ostatní porty. Tomu se říká flooding.“
- Note: „Flooding je výjimka pro neznámou cílovou MAC, ne běžné chování. Cyril rámec zahodil stejně
  jako u hubu.“ (srovnat s predikcí z kroku 11: „čekal jsi jeden port, switch ale cíl zatím neznal“)

#### Krok 14: Bob odpoví: switch už zná Alici

- Vidí: Bob pošle „Ahoj, Alice!“. Na Fa0/2 přijde rámec se zdrojem `02:…:02`: do tabulky přibude
  `02:…:02 → Fa0/2`. Cíl `02:…:01` v tabulce je (Fa0/1), switch ho pošle **jen na Fa0/1**.
  Na lince k Cyrilovi se nic neděje.
- **Predikce (před krokem):** „Na který port switch pošle odpověď?“ (Fa0/1 / Fa0/3 / oba.)
- Text: „Teď switch Alici zná, takže odpověď pošle jen na port Fa0/1. Cyril nic nedostal.“
- Note: „Switch se naučil Boba až z jeho odpovědi: zapisuje jen to, odkud rámec přišel.“

#### Krok 15: MAC tabulka po výměně

- Vidí: tabulka u switche se dvěma řádky.
- Dělá: **`show mac address-table` na switchi.** Výpis (Cisco styl, anglicky):
  `1  0200.0000.0001  DYNAMIC  Fa0/1` a `1  0200.0000.0002  DYNAMIC  Fa0/2`, `Total Mac Addresses… 2`.
  Student odpoví: **proč tam není Cyril?** (Nic neodeslal, switch se učí jen ze zdrojové adresy.)
- Text: „V tabulce jsou Alice a Bob. Cyril v ní chybí: nic neodeslal, a switch se učí jen z odesílatelů.“
- Note: „Cisco zapisuje MAC s tečkami (0200.0000.0001); je to pořád stejná adresa.“
- Simulátor zjednodušuje: „Řádek v tabulce po čase vyprší (výchozí 300 s); čas v simulátoru neběží
  jako ve skutečnosti. Ve skutečné síti jsou v tabulce i další sloupce (VLAN).“

#### Krok 16: Druhá zpráva jde jen k Bobovi

- Vidí: Alice pošle „Sejdeme se v 16:00“ na Bobovu aplikaci „poznámky“ (port 6000). Switch zná
  `02:…:02` → Fa0/2, pošle jen tam. Na lince Cyrila nic. U Boba přijme „poznámky“ (ne „zprávy“).
- **Predikce:** „Na který port tentokrát?“ (Fa0/2 / Fa0/3 / oba.) Student se tu typicky už trefí.
- Text: „Switch už zná Boba, rámec jde jen na Fa0/2. A port 6000 předal zprávu jiné aplikaci než
  předtím.“
- Note: „Rozhoduje se na dvou místech: switch podle MAC (komu poslat rámec), operační systém podle portu
  (kterou aplikaci předat zprávu).“

#### Krok 17: Shrnutí: kdo čte kterou adresu

- Vidí: obrázek „obálka a adresy“ s hodnotami z tohoto scénáře, každá adresa vedle zařízení, které ji
  čte: **MAC (L2): síťová karta, switch**; **IP (L3): síťová vrstva v operačním systému**; **port (L4):
  operační systém předá aplikaci.** Tabulka zařízení: hub / switch.
- Text: „Každá vrstva má vlastní adresu a čte ji jen sama. MAC říká, kdo je na drátě, IP rozhraní v síti,
  port aplikaci v počítači.“
- Volitelně („zkus to sám“): student z Cyrila pošle zprávu Alici a sleduje, jak přibyde třetí řádek
  v MAC tabulce; potom vymění switch zpět za hub a ověří, že se chová jako na začátku.

## „Aha“ chvíle

1. **Obálka L2 má jiné adresy než L3 a L4** a každá vrstva čte jen svou (krok 8): nic z toho se nenahrazuje,
   všechno se doplňuje.
2. **Cyril dostane rámec a zahodí ho** (krok 7). Student si dosud myslel, že „co je na drátě, to počítač
   přečte“; ve skutečnosti rozhoduje karta podle MAC.
3. **Stejná zpráva stejným způsobem poprvé „zaplaví“ síť, podruhé jde jen k Bobovi** (kroky 13 vs. 16).
   Student sám vidí, že se switch „naučil“.
4. **Predikce nevyšla:** čekal jednu cestu a switch rámec rozeslal (krok 13). Tady se rodí rozdíl
   „switch posílá všem“ (ne) a „posílá jen cíli, když ho zná“.
5. Port rozlišuje aplikace na jednom počítači (kroky 2, 16): `…:5000` ≠ `…:6000`.

## Miskoncepce a jak je scénář vyvrací

| Miskoncepce | Kde se vyvrací |
|---|---|
| „Switch posílá všem.“ | Kroky 11 až 16: po naučení jde rámec na jeden port; flooding jen u neznámého cíle (13). Predikce v 11, 14, 16. |
| „Hub = switch.“ | Kroky 6 vs. 13 a 14: hub rozesílá vždy (fyzická vrstva, bity), switch čte MAC (linková vrstva). Krok 10 je srovnání. |
| „Port je díra v počítači.“ | Krok 2 (číslo v obálce) a 16 (dvě aplikace na jednom PC); v kroku 1 port v `ipconfig` není. |
| „IP adresa je adresa počítače.“ | Krok 1: `ipconfig /all` ukazuje IP u rozhraní. Zatím jedna karta, proto jen text v otázce 6; hlubší důkaz až s routerem (úroveň 3). |
| „MAC je adresa v internetu.“ | Poznámka v kroku 4; hlavní vyvrácení v úrovni 3. |
| „Cyril rámec neviděl.“ | Krok 7: rámec dorazil, zahodila ho karta podle MAC. |
| „Switch se zeptá, kdo je kde.“ | Kroky 12 a 15: učí se jen ze zdrojové MAC odeslaných rámců; Cyril v tabulce chybí. |

## Rentgen: co student najde

| Krok | Obálka | Pole, která student najde | Proč |
|---|---|---|---|
| 2 | L4 (UDP) | Zdrojový port, Cílový port | port = adresa aplikace |
| 3 | L3 (IPv4) | Zdrojová IP, Cílová IP, Protocol (17) | IP = adresa rozhraní; Protocol říká, co je uvnitř |
| 4 | L2 (Ethernet II) | Cílová MAC, Zdrojová MAC, EtherType (`0x0800`) | MAC = adresa karty; EtherType říká, co je uvnitř |
| 7 | L2 u Cyrila | Cílová MAC `…:02` ≠ MAC karty `…:03` | proč karta zahodila |
| 9 | všechny | prohozené zdroj a cíl | odpověď |

Pořadí v rentgenu je skutečné (cílová MAC první); štítek obálky zůstává „zdrojová → cílová“ (rozhodnutí 15).
Skutečnost, že všechny tři hlavičky říkají „co je uvnitř“ (EtherType, Protocol, port), se shrne
v kroku 17 jednou větou v Detailu (projektantovo zpřesnění z úrovně 1).

## Terminál: kdy a proč

| Krok | Zařízení | Příkaz | Co student zjistí |
|---|---|---|---|
| 1 | Alice | `ipconfig /all` | MAC a IP jsou vlastnosti karty; port tu není |
| 4 | Alice | `arp -a` | odkud zná MAC Boba (předvyplněno, označené zjednodušení) |
| 7 | Cyril | `arp -a` | `No ARP Entries Found.`: Cyril nic nezachytil |
| 11 | switch | `show mac address-table` | tabulka je prázdná |
| 15 | switch | `show mac address-table` | dva řádky, Cyril chybí |

Terminál je vždy volitelný (student může krok projít i bez něj) a otevírá se až v místě, kde odpovídá
na otázku, kterou si student právě položil. Žádné další příkazy (ping, netstat) v této úrovni.

## Kontrolní otázky (konec úrovně)

1. Jak se jmenuje adresa, kterou používá linková, síťová a transportní vrstva, a co která z nich
   identifikuje?
   Očekávaná odpověď: MAC (síťovou kartu v místní síti), IP (rozhraní v síti), port (aplikaci
   v počítači). Doplnit: spolu IP a port tvoří socket.
2. Alice posílá Bobovi zprávu přes hub. Proč ji dostane i Cyril a co s ní udělá?
   Očekávaná odpověď: hub rozešle bity na všechny porty; Cyrilova síťová karta porovná cílovou MAC se
   svou, nesedí a rámec zahodí (operační systém o něm neví).
3. Co přesně dělá switch s rámcem? Jak se jeho tabulka plní a co udělá, když cílovou MAC nezná?
   Očekávaná odpověď: z každého rámce si zapíše zdrojovou MAC a port, kudy přišel; podle tabulky pošle rámec
   jen na port cíle; nezná-li cíl, rozešle ho na všechny ostatní porty (flooding).
4. Kdy se switch chová jako hub a čím se od hubu liší?
   Očekávaná odpověď: při neznámé cílové MAC (a u broadcastu). Hub vždy posílá všem a adresy nečte
   (L1); switch čte MAC adresy (L2), učí se a poznané cíle obsluhuje jednotlivě.
5. Proč není Cyril v MAC tabulce, i když dostal rámec?
   Očekávaná odpověď: nic neodeslal a switch se učí jen ze zdrojových adres.
6. Bob má dvě aplikace, které čekají na zprávy (porty 5000 a 6000). Podle čeho se rozhodne, které
   zprávu předá? Proč by tu nestačily jen MAC a IP?
   Očekávaná odpověď: podle cílového portu v obálce transportní vrstvy; MAC a IP jsou stejné pro oba
   (jde o stejný počítač), rozlišuje je až port.

## Varianta „analogie s dopisem“

V této úrovni se nezapíná (po úrovni 1 se vypíná, viz `uroven1-zapouzdreni.md`). Adresace dopisu
(budova × oddělení) by se plést s MAC/IP/port: „oddělení = port“ je užitečné, ale „adresa budovy“
má dvě podoby (MAC i IP), analogie by tu zmátla.

## Testovací kritéria pro implementaci

Platí pro `scenarios/uroven2-adresy.js` a trace simulace (jména událostí podle `docs/spec/ethernet.md` 4.3).

- Obálky zprávy 1 (rentgen): L4 src 50001, dst 5000; L3 src 192.168.1.10, dst 192.168.1.20, Protocol 17;
  L2 dst `02:00:00:00:00:02`, src `02:00:00:00:00:01`, EtherType `0x0800`.
- Hub: rámec přijatý na portu 1 se doručí na porty 2 a 3 (ne zpět na 1); Cyril: událost `nic_drop`, žádná
  událost v jeho vyšších vrstvách ani v aplikaci; Bob: `app.recv` v aplikaci „zprávy“ (port 5000).
- Odpověď: obálky prohozené (src 5000, dst 50001, IP a MAC zrcadlově); Cyril `nic_drop`.
- Switch, krok 12: `mac_learn` (`…:01` → Fa0/1); krok 13: `flood` na Fa0/2 a Fa0/3; Cyril `nic_drop`.
- Krok 14: `mac_learn` (`…:02` → Fa0/2), `forward` pouze na Fa0/1; na lince Cyrila žádný nový rámec.
- Krok 15: `show mac address-table` vypíše přesně dva dynamické záznamy (Alice Fa0/1, Bob Fa0/2); Cyril
  v tabulce není.
- Krok 16: zpráva 2: `forward` pouze na Fa0/2; Cyril nic; v aplikaci „poznámky“ přijato, v „zprávy“ nic.
- `arp -a` na Alici: jeden záznam (Bob); na Cyrilovi `No ARP Entries Found.`; `ipconfig /all` na Alici:
  MAC `02-00-00-00-00-01`, IPv4 192.168.1.10.
- Krok vzad vrátí přesně předchozí stav včetně MAC tabulky (po kroku 12 má 1 řádek, po 14 má 2, po 11 žádný).
- Výměna hub → switch smaže stav hubu a začne s prázdnou MAC tabulkou; „Obnovit“ vrátí hub.
- Predikce se nikam neukládá a neblokuje „Krok vpřed“.
- Zápis MAC v terminálu Windows s pomlčkami, na switchi Cisco s tečkami, v rentgenu s dvojtečkami.

## Otevřené otázky pro projektanta

1. Hodnota 17 v poli Protocol a EtherType `0x0800` — v pořádku podle `docs/spec/ipv4.md`; UDP (`docs/spec/udp.md`)
   doplní zdrojový a cílový port, délku a kontrolní součet. Jsou v rentgenu u UDP v úrovni 2 všechna čtyři pole,
   nebo se kontrolní součet jen označí? (Návrh: všechna čtyři, student hledá jen porty.)
2. `arp -a` na Windows u předvyplněného záznamu: typ „dynamic“ (návrh) nebo „static“? Skutečný Windows
   po předchozí komunikaci ukazuje „dynamic“; předvyplněním simulujeme to.
3. Přijímá Bob odpověď od Cyrila z hubu stejně? (Nepodstatné.) Dále: je v pořádku, že Bob zná MAC Alice
   předem, i když ARP cache se z přijatého UDP nevytváří (arp.md)? (Návrh: ano, předvyplněno kvůli odpovědi,
   stejné zjednodušení jako u Alice.)
4. Zápis `show mac address-table` (Cisco IOS 15.x, sloupce Vlan / Mac Address / Type / Ports) a
   `Total Mac Addresses for this criterion` — ověřit formát výpisu.
5. Mají PC v kroku 1 ukázat i Default Gateway? (Návrh: prázdné/„nenastaveno“, brána až v úrovni 3.)
