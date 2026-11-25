# Scénář úrovně 2: Adresy

Text pro implementaci. Stav: implementováno v `uroven2-adresy.js` (iterace 2, po kontrole čtyř rolí).
Platí `docs/rozhodnuti.md` (hlavně 8, 13–16, 23–37) a `docs/spec/ethernet.md`. Texty v uvozovkách jsou
texty simulátoru (oslovení „ty“). Terminál vypisuje anglicky (rozhodnutí 10). Číslování kroků a texty
odpovídají `uroven2-adresy.js`; při změně upravit oba soubory.

## Cíl a nová myšlenka

Obálka nese adresu a **každá vrstva má vlastní druh adresy**: linková MAC (kdo je na drátě v téhle
síti), síťová IP (které rozhraní v síti), transportní port (která aplikace v počítači). Každá vrstva
u příjemce kontroluje jen svou adresu. IP adresa + port = **socket**.

Druhá, na ní stavěná část: **hub** rozešle všechno všem, **switch** se z provozu učí a posílá
rámec jen tam, kde cíl je (a neznámý cíl rozešle jako hub: flooding).

Výukové cíle: viz `docs/didaktika.md`, úroveň 2.

## Uzly a prostředí

Tři PC a jedno zařízení uprostřed; úroveň začíná s **hubem**, po kroku 9 student zařízení **vymění za
switch** (stejné kabely, stejné porty Fa0/1–Fa0/3).

| Uzel | Kabel do portu | MAC | IP (192.168.1.0/24) | Aplikace |
|---|---|---|---|---|
| Alice (PC1) | `Fa0/1` | `02:00:00:00:00:01` | 192.168.1.10 | „zprávy“ (klient, zdrojový port 49152) |
| Bob (PC2) | `Fa0/2` | `02:00:00:00:00:02` | 192.168.1.20 | „zprávy“ naslouchá na UDP 5000, „poznámky“ na UDP 6000 |
| Cyril (PC3) | `Fa0/3` | `02:00:00:00:00:03` | 192.168.1.30 | žádná se zprávou nepracuje |

- Hub i switch mají porty v Cisco stylu `Fa0/1–3` (rozhodnutí 34: výměna hub → switch nic
  nepřejmenuje; v kroku 0 věta „Fa0/1 = Cisco název portu (FastEthernet 0/1)“).
- Zpráva 1: „Ahoj, Bobe!“ (Alice 49152 → Bob 5000, UDP). Odpověď: „Ahoj, Alice!“ (Bob 5000 → Alice 49152).
  Zpráva 2: „Sejdeme se v 16:00“ (Alice 49152 → Bob 6000). Samé ASCII, aby bajty = znaky.
- Aplikace „zprávy“ je z úrovně 1 stejná, jen teď má port. Zdrojový port 49152 přidělil Alice operační
  systém deterministicky od 49152 (rozhodnutí 28; rentgen: „Simulátor zjednodušuje: Windows volí číslo
  náhodně z rozsahu 49152–65535.“).
- Předvyplněná ARP tabulka (`initial_state.arp_cache`): Alice zná Boba (192.168.1.20 → `02:…:02`),
  Bob zná Alici (192.168.1.10 → `02:…:01`; Bob ji potřebuje pro odpověď, ARP cache se z přijatého
  provozu sama nevytváří, viz `docs/spec/arp.md`). Cyril: prázdná. MAC tabulka switche: prázdná.
- **Simulátor zjednodušuje (rozhodnutí 14, 26):** „Alice Bobovu MAC adresu už zná (počítače spolu dřív
  mluvily, ARP tabulka je předvyplněná); jak ji zjistí, uvidíš v úrovni 3.“ Zobrazit v kroku 4 a u
  `arp -a`; že byl switch právě zapnut, říká krok 10. Další zjednodušení: IP adresu Boba Alice „zná“
  (jak ji zjistí z názvu, ukáže úroveň 4, DNS); maska se jen ukazuje, nepočítá se (úroveň 3);
  kolize na hubu se nemodelují (rozhodnutí 8); bity bez preambule (rozhodnutí 16).
- Ovládání jako v úrovni 1 (Krok vpřed/zpět, Přehrát, rychlost, Obnovit), nově **rentgen** (klik na
  obálku, klávesa R), **terminál** (klik na PC nebo switch, `` ` ``/F2) a tlačítko **Vyměnit hub za switch**
  (aktivní v kroku 9). Režim ISO/OSI / TCP/IP zůstává. Štítek L2 vždy „zdrojová MAC → cílová MAC“
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

Číslování `0–18` (UI „Krok n z 18“), stejné jako v `uroven2-adresy.js`. Každý krok: co student vidí,
co dělá, text vysvětlivky (max. 2–3 věty, případně „note“ a „Simulátor zjednodušuje“).

**Tip (rozhodnutí 31)** = samostatný krok se stavem **před** rozhodnutím zařízení: rámec právě dorazil
na vstupní port hubu nebo switche, ale nic dalšího není vidět (žádné rámce na výstupech, žádné
„přijal/zahodil“, žádné vysvětlení výsledku v textu ani ve štítcích). Nadpis karty „Tip: …“, student
vybere porty (nebo odpověď) a dá Vpřed („Potvrdit tip“). Volby jsou porty zařízení kromě vstupního
(ten je zamčený). Následující krok ukáže výsledek a vyhodnotí tip jednou větou („Tvůj tip: … Skutečnost:
… Sedí.“ / „Nesedí: <důvod>“); porty s tipem mají štítek „tip“. Přehrávání se na tipu zastaví. Špatný
tip nic nepenalizuje a nic se neukládá; počet trefených tipů je v dialogu Kontrolní otázky.

### Část A: tři adresy v jedné obálce (hub)

#### Krok 0: Úvod

- Vidí: Alice, Bob a Cyril na hubu (porty Fa0/1–Fa0/3). Zpráva „Ahoj, Bobe!“ u Alice. U každého PC
  jméno, IP a MAC (poslední bajt tučně, rozhodnutí 35).
- Dělá: nic; „Začít“.
- Text: „V úrovni 1 zpráva dostala obálky. Teď se podíváš, co je v obálkách napsané: adresy.“
- Note: „Fa0/1 = Cisco název portu (FastEthernet 0/1). Hub i switch mají porty značené stejně.“
  (rozhodnutí 34)

#### Krok 1: Co o sobě počítač ví

- Vidí: u Alice se nabídne příkaz `ipconfig /all` (tlačítko „Spustit za mě“, nebo ho student napíše).
- Dělá: **najde ve výpisu dvě adresy** Alice: fyzickou adresu (MAC) a IPv4 adresu. Port tam není.
- Text: „Síťová karta má adresu MAC a rozhraní má adresu IP. Port tu nenajdeš: patří aplikaci, ne
  kartě.“
- Hint: „Fyzická adresa je MAC adresa. Ve Windows se zapisuje s pomlčkami.“
- Proč zde: student si dřív než uvidí obálky ověří, že obě adresy opravdu existují na „skutečném“ příkazu
  ze školního PC. Terminál tu slouží jako ověření („to samé uvidíš doma“), ne jako cíl.
- Výpis (zkráceně, anglicky): `Physical Address . . . : 02-00-00-00-00-01`,
  `IPv4 Address. . . . . : 192.168.1.10(Preferred)`, `Subnet Mask . . . . : 255.255.255.0`,
  `Default Gateway . . . :` (prázdná, rozhodnutí 27).

#### Krok 2: Obálka transportní vrstvy: porty

- Vidí: data sjedou na L4, modrá obálka „UDP datagram“ (rozhodnutí 32; ve sloupci vrstev
  „segment / datagram“).
- Dělá: klikne na obálku, v rentgenu **najde pole Zdrojový port a Cílový port** (49152 a 5000).
- Text: „Transportní vrstva napsala do obálky porty. Cílový port 5000 říká, které aplikaci u Boba zpráva
  patří; zdrojový port 49152 je číslo, které operační systém přidělil Alicině aplikaci, aby věděla,
  kam má přijít odpověď.“
- Note: „Port je číslo v obálce transportní vrstvy. Neznamená žádnou díru ani konektor.“
- Pod výtahem: aplikace Boba „zprávy“ (port 5000) a „poznámky“ (port 6000), vyvrací „port = díra“.
- Simulátor zjednodušuje: „UDP si teď jen prohlížíš; jak funguje a čím se liší od TCP, uvidíš v úrovni 4.“
- Rentgen u zdrojového portu: „Simulátor zjednodušuje: Windows volí číslo náhodně z rozsahu
  49152–65535.“ (rozhodnutí 28) a rozbalitelné vysvětlení „dobře známý / registrovaný / dynamický port“.

#### Krok 3: Obálka síťové vrstvy: IP adresy a socket

- Vidí: zelená obálka (paket). Pod obálkou socket `192.168.1.10:49152 → 192.168.1.20:5000`.
- Dělá: v rentgenu **najde Zdrojovou a Cílovou IP adresu a pole Protocol** (hodnota 17 = UDP).
- Text: „Síťová vrstva napsala adresy IP. Adresa IP spolu s portem se jmenuje socket, například
  192.168.1.20:5000.“
- Note: „Pole Protocol (17) říká síťové vrstvě u příjemce, že uvnitř paketu je UDP datagram.“
- Hint: „Obálka rámce bude mít MAC adresy. MAC můžeš v rentgenu a v terminálu vidět v jiném zápisu
  (dvojtečky, pomlčky, tečky), je to pořád jedna adresa.“
- Rentgen v krocích 2–3 ukazuje jen bajty obálek, které už existují (rámec ještě nevznikl).

#### Krok 4: Obálka linkové vrstvy: MAC adresy

- Vidí: hnědá obálka (rámec). Štítek „L2 Linková: 02:…:01 → 02:…:02“. Pod obálkou pruh
  „ARP tabulka Alice: 192.168.1.20 → 02:…:02“ (s vysvětlivkou „IP → MAC, které si počítač pamatuje“).
- Dělá: klikne na obálku; v rentgenu **najde Cílovou MAC, Zdrojovou MAC a EtherType** (`0x0800`:
  uvnitř je IPv4 paket). Může u Alice spustit `arp -a`.
- Text: „Linková vrstva napsala adresy MAC: svou a Bobovu. Bobovu MAC adresu našla v ARP tabulce.“
- **Terminál (Alice): `arp -a`.** Výpis: `192.168.1.20   02-00-00-00-00-02   dynamic` a statické
  řádky broadcastu a multicastu (rozhodnutí 26).
- Simulátor zjednodušuje: „Alice Bobovu MAC adresu už zná (počítače spolu dřív mluvily, ARP tabulka je
  předvyplněná); jak ji zjistí, uvidíš v úrovni 3.“
- Note: „Rámec nese MAC adresy jen pro tuhle síť. Odesílatel a příjemce jsou tu stejní jako Alice a Bob,
  protože jsou ve stejné síti; za routerem to platit nebude.“ (rozhodnutí 15, úroveň 3)
- Detail v rentgenu u pole Zdrojová MAC (rozbalitelný): věta o MAC `02:…` (viz výše).

#### Krok 5: Bity dorazily do hubu (tip)

- Vidí: bity z Alice dorazily po kabelu do hubu, rámec leží na portu Fa0/1 (vstup). Na výstupech nic,
  poznámka „Hub nečte adresy…“ je schovaná.
- Text: „Alice poslala rámec po kabelu jako bity a ty dorazily do hubu na port Fa0/1. Uprostřed je hub.“
- **Tip:** „Které počítače dostanou rámec?“ Volby: Bob (Fa0/2), Cyril (Fa0/3), lze obě.
  Důvod při nesouladu: „hub nečte adresy, a tak bity pošle na všechny ostatní porty.“

#### Krok 6: Hub rozešle všem (vyhodnotí tip z kroku 5)

- Vidí: hub zopakuje rámec na všechny porty kromě toho, odkud přišel; bity jedou k Bobovi i Cyrilovi.
- Text: „Hub nečte žádné adresy. Co přijde na jeden port, pošle na všechny ostatní.“
- Note: „Hub je zařízení fyzické vrstvy: pracuje s bity, ne s rámci. Výška zařízení v pruhu = kam až
  čte: hub jen L1, switch L1 a L2.“ (druhá věta: kontrola 38, N2) (vyvrací „hub = switch“; slovník: hub
  se neoznačuje „opakovač“, rozhodnutí 16)
- Simulátor zjednodušuje: „Bity kreslíme bajt po bajtu, jak se zapisují (karta je vysílá v jiném
  pořadí), a bez synchronizačního úvodu (preambule). Kolizi dvou současně vysílajících počítačů nesimulujeme.“
  (rozhodnutí 8 a 16)

#### Krok 7: Cyril rámec zahodí

- Vidí: u Cyrila přijmou bity jen na L1–L2; rámec se složí a hned zmizí. Vrstvy L3, L4 a aplikace
  zůstanou šedé. U Cyrila v topologii: „cílová 02:…:02 ≠ moje 02:…:03“ a „zahodil“ (rozhodnutí 35).
- Dělá: klikne na Cyrila (výtah ukáže „Rámec Alice → Bob (dostal i Cyril)“) a v rentgenu **porovná
  Cílovou MAC (`…:02`) s MAC Cyrilovy karty (`…:03`)**. Může u Cyrila spustit `arp -a`: žádný
  záznam typu dynamic, jen statické řádky. Poznámka simulátoru: „Cyril nemá žádný záznam typu
  dynamic, žádnou MAC si nezapamatoval. Řádky static (broadcast, multicast) má Windows vždy;
  vysvětlíme je v úrovni 3.“
- Text: „Cyril rámec taky dostal. Jeho síťová karta porovnala cílovou MAC se svou, nesedí a rámec zahodila.
  Operační systém Cyrila o něm nic neví.“
- Note: „MAC adresu kontroluje síťová karta, ne operační systém ani aplikace.“ (Kdo se stará o L2.)
- Hint: „Klikni na Cyrila: uvidíš rámec, který dostal.“
- Poznámka pro učitele: rámec fyzicky do Cyrilovy karty dorazil. Zahodil ho jen filtr podle MAC;
  nejde o tajnost (kdo má Wireshark v promiskuitním režimu, uvidí ho). Neuvádět v hlavním textu;
  vhodné do diskuse (otázka 2).

#### Krok 8: Bob rozbalí a každá vrstva zkontroluje svou adresu (8a, 8b, 8c)

- Vidí: tři postupné kroky jako ve scénáři 1. U každého se v rentgenu vybere pole, které vrstva čte.
- 8a (L2): „Cílová MAC je Bobova, karta rámec přijala a vrstva sundala obálku.“
- 8b (L3): „Cílová IP adresa je Bobova, síťová vrstva sundala obálku.“
- 8c (L4): „Cílový port 5000: operační systém předal zprávu aplikaci „zprávy“.“
  Note: „Každá vrstva zkontrolovala svou adresu: MAC, IP a port.“
- Zpráva se objeví v aplikaci Boba „zprávy“, v „poznámkách“ ne.

#### Krok 9: Bob odpoví, hub zase rozešle všem (tip; rozhodnutí 36)

- Vidí: odpověď „Ahoj, Alice!“ v jednom kroku: adresy prohozené (porty 5000 → 49152, IP `…20 → …10`,
  MAC `…:02 → …:01`), hub ji pošle Alici i Cyrilovi, Cyril ji zahodí. V panelu tabulka „Kdo rámec
  dostal (hub)“ pro obě zprávy. Tlačítko „Vyměnit hub za switch“.
- Text: „Odpověď má v obálkách stejné adresy, jen prohozené. Hub ji poslal všem a Cyril ji zase zahodil.
  Co by mělo dělat chytřejší zařízení uprostřed?“
- Hint: „Tlačítkem „Vyměnit hub za switch“ (nebo krokem vpřed) dáš na stejné místo switch se stejnými
  kabely.“
- **Tip:** „Bude se switch chovat jako hub?“ Ano / Ne / Zatím nevím. Vyhodnotí se v kroku 12
  (flooding): Ano „Sedí, aspoň zatím.“, Ne „Zatím ano: switch nic nezná.“, Zatím nevím „Teď už to
  vidíš.“
- Pozn. pro učitele: socket klienta `192.168.1.10:49152` a serveru `192.168.1.20:5000` je to, co
  jednoznačně určuje „kdo s kým mluví“.

### Část B: switch se učí

#### Krok 10: Prázdná MAC tabulka

- Vidí: hub zmizí, na jeho místě switch se stejnými porty Fa0/1–Fa0/3; u switche panel „MAC
  tabulka“ (prázdná). Alice znovu odešle zprávu 1 („Ahoj, Bobe!“); rámec jede ke switchi.
- Dělá: u switche spustí **`show mac address-table`**: prázdná tabulka (jen záhlaví a `Total Mac
  Addresses for this criterion: 0`). Proč zde: student vidí „před“, aby viděl „po“ v kroku 15.
- Text: „Switch je zařízení linkové vrstvy: čte MAC adresy v rámci. MAC tabulka je zatím prázdná, nic
  nezná.“
- Note: „Alice posílá stejný text „Ahoj, Bobe!“; obálky vzniknou znovu (Identifikace v IP je o 1 vyšší).“
- Simulátor zjednodušuje: „Switch byl právě zapnut, proto nic nezná; počítače se už dřív znaly (ARP
  tabulky zůstaly).“

#### Krok 11: Switch se učí zdrojovou MAC (tip)

- Vidí: rámec leží na Fa0/1 (vstup); do tabulky přibude řádek `02:…:01 → Fa0/1` („nový“);
  v rentgenu je vybraná zdrojová MAC. Na výstupech nic.
- Text: „Rámec dorazil na port Fa0/1. Switch čte zdrojovou MAC a zapíše si: Alice je na portu Fa0/1.“
- Note: „Učí se jen ze zdrojové adresy: tím ví, odkud kdo mluví.“
- **Tip:** „Na které porty switch rámec pošle?“ Fa0/2 / Fa0/3 / oba (Fa0/1 je vstup, zamčený).
  Většina studentů zvolí Fa0/2: nejčastější podoba miskoncepce. Důvod při nesouladu: „Bobovu MAC
  switch zatím nezná, a tak rámec rozešle jako hub.“

#### Krok 12: Cíl je neznámý: flooding (vyhodnotí tipy z kroků 9 a 11)

- Vidí: switch hledá `02:…:02`, nenajde („neznámá cílová MAC → flooding“). Rámec rozešle na Fa0/2
  i Fa0/3. Cyril rámec zahodí jako v kroku 7, Bob ho přijme (zkráceně, zpráva dorazí do „zprávy“).
- Text: „Boba switch zatím nezná, a tak rámec rozešle na všechny ostatní porty. Tomu se říká flooding.
  Cyril rámec zahodil stejně jako u hubu.“
- Note: „Switch se na začátku chová jako hub, protože zatím nic nezná. Pak už ne.“
- Vyhodnocení, např.: „Tvůj tip: Fa0/2. Skutečnost: Fa0/2 i Fa0/3. Nesedí: Bobovu MAC switch zatím
  nezná, a tak rámec rozešle jako hub.“

#### Krok 13: Bob odpoví (tip)

- Vidí: Bob pošle „Ahoj, Alice!“; rámec leží na Fa0/2 (vstup). Do tabulky přibude `02:…:02 → Fa0/2`.
  Na výstupech nic.
- Text: „Bob odpovídá „Ahoj, Alice!“. Rámec dorazil na port Fa0/2 a switch si zapsal Boba.“
- **Tip:** „Na který port switch pošle odpověď?“ Fa0/1 / Fa0/3 / oba (Fa0/2 zamčený). Důvod při
  nesouladu: „Alici switch zná z první zprávy (Fa0/1 v MAC tabulce), a tak odpověď pošle jen tam.“

#### Krok 14: Odpověď jde jen k Alici (vyhodnotí tip z kroku 13)

- Vidí: cíl `02:…:01` v tabulce je („nalezeno“, Fa0/1), switch ho pošle **jen na Fa0/1**. Na lince
  k Cyrilovi se nic neděje.
- Text: „Switch Alici zná, takže odpověď pošle jen na port Fa0/1. Cyril nic nedostal.“
- Note: „Switch se naučil Boba až z jeho odpovědi: zapisuje jen to, odkud rámec přišel.“

#### Krok 15: MAC tabulka po výměně

- Vidí: tabulka u switche se dvěma řádky.
- Dělá: **`show mac address-table` na switchi.** Výpis (Cisco styl, anglicky):
  `1  0200.0000.0001  DYNAMIC  Fa0/1` a `1  0200.0000.0002  DYNAMIC  Fa0/2`, `Total Mac Addresses… 2`.
  Student odpoví: **proč tam není Cyril?** (Nic neodeslal, switch se učí jen ze zdrojové adresy.)
- Text: „V tabulce jsou Alice a Bob. Cyril v ní chybí: nic neodeslal, a switch se učí jen z odesílatelů.“
- Note: „Cisco zapisuje MAC s tečkami (0200.0000.0001); je to pořád stejná adresa.“
- Simulátor zjednodušuje: „Řádek v tabulce po čase vyprší (výchozí 300 s); čas v simulátoru neběží
  jako ve skutečnosti. Panel ukazuje jen MAC a port; switch má i VLAN a typ (viz terminál).“

#### Krok 16: Alice posílá druhou zprávu (tip)

- Vidí: Alice pošle „Sejdeme se v 16:00“ na Bobovu aplikaci „poznámky“ (port 6000); rámec leží na
  Fa0/1 (vstup). Na výstupech nic.
- Text: „Alice posílá Bobovi „Sejdeme se v 16:00“, tentokrát aplikaci „poznámky“ (port 6000). Rámec
  dorazil na port Fa0/1.“
- **Tip:** „Na který port switch rámec pošle?“ s oporou: „Podívej se do MAC tabulky a tipni.“
  Fa0/2 / Fa0/3 / oba. Student se tu typicky trefí (záměr: má použít tabulku). Důvod při nesouladu:
  „Boba switch zná (Fa0/2 v MAC tabulce), a tak rámec pošle jen tam.“

#### Krok 17: Druhá zpráva jde jen k Bobovi (vyhodnotí tip z kroku 16)

- Vidí: switch zná `02:…:02` → Fa0/2, pošle jen tam. Na lince Cyrila nic. U Boba přijme „poznámky“
  (ne „zprávy“).
- Text: „Switch zná Boba, rámec jde jen na Fa0/2. A port 6000 předal zprávu jiné aplikaci než
  předtím.“
- Note: „Rozhoduje se na dvou místech: switch podle MAC (komu poslat rámec), operační systém podle portu
  (kterou aplikaci předat zprávu).“

#### Krok 18: Shrnutí: kdo čte kterou adresu

- Vidí: tabulka „Kdo čte kterou adresu“ s hodnotami z tohoto scénáře: **MAC (L2): síťová karta,
  switch**; **IP (L3): síťová vrstva v operačním systému**; **port (L4): transportní vrstva v OS
  předá aplikaci.** Tabulka zařízení: hub / switch.
- Text: „Každá vrstva má vlastní adresu a čte ji jen sama. MAC říká, kdo je na drátě, IP které rozhraní
  v síti, port která aplikace v počítači.“
- Note: „Na závěr si zkus odpovědět: co se stane s MAC tabulkou, když pošle zprávu Cyril?“ (odpověď
  v kontrolních otázkách, otázka 6).
- Hint: „Všechny tři hlavičky říkají i „co je uvnitř“: EtherType, Protocol a port.“
- Volitelně později (interaktivní simulace): student z Cyrila pošle zprávu Alici a sleduje, jak
  přibude třetí řádek v MAC tabulce; potom vymění switch zpět za hub.

## „Aha“ chvíle

1. **Obálka L2 má jiné adresy než L3 a L4** a každá vrstva čte jen svou (krok 8): nic z toho se nenahrazuje,
   všechno se doplňuje.
2. **Cyril dostane rámec a zahodí ho** (krok 7). Student si dosud myslel, že „co je na drátě, to počítač
   přečte“; ve skutečnosti rozhoduje karta podle MAC.
3. **Stejná zpráva stejným způsobem poprvé „zaplaví“ síť, podruhé jde jen k Bobovi** (kroky 12 vs. 17).
   Student sám vidí, že se switch „naučil“.
4. **Tip nevyšel:** čekal jednu cestu a switch rámec rozeslal (tip v kroku 11, výsledek v kroku 12). Tady se rodí rozdíl
   „switch posílá všem“ (ne) a „posílá jen cíli, když ho zná“.
5. Port rozlišuje aplikace na jednom počítači (kroky 2, 17): `…:5000` ≠ `…:6000`.

## Miskoncepce a jak je scénář vyvrací

| Miskoncepce | Kde se vyvrací |
|---|---|
| „Switch posílá všem.“ | Kroky 10 až 17: po naučení jde rámec na jeden port; flooding jen u neznámého cíle (12). Tipy v 11, 13, 16. |
| „Hub = switch.“ | Kroky 6 vs. 12 a 14: hub rozesílá vždy (fyzická vrstva, bity), switch čte MAC (linková vrstva). Krok 9 je srovnání (tabulka a tip). |
| „Port je díra v počítači.“ | Krok 2 (číslo v obálce) a 17 (dvě aplikace na jednom PC); v kroku 1 port v `ipconfig` není. |
| „IP adresa je adresa počítače.“ | Krok 1: `ipconfig /all` ukazuje IP u rozhraní. Zatím jedna karta, proto jen text v otázce 6; hlubší důkaz až s routerem (úroveň 3). |
| „MAC je adresa v internetu.“ | Poznámka v kroku 4; hlavní vyvrácení v úrovni 3. |
| „Cyril rámec neviděl.“ | Krok 7: rámec dorazil, zahodila ho karta podle MAC. |
| „Switch se zeptá, kdo je kde.“ | Kroky 11, 13 a 15: učí se jen ze zdrojové MAC odeslaných rámců; Cyril v tabulce chybí. |

## Rentgen: co student najde

| Krok | Obálka | Pole, která student najde | Proč |
|---|---|---|---|
| 2 | L4 (UDP) | Zdrojový port, Cílový port | port = adresa aplikace |
| 3 | L3 (IPv4) | Zdrojová IP, Cílová IP, Protocol (17) | IP = adresa rozhraní; Protocol říká, co je uvnitř |
| 4 | L2 (Ethernet II) | Cílová MAC, Zdrojová MAC, EtherType (`0x0800`) | MAC = adresa karty; EtherType říká, co je uvnitř |
| 7 | L2 u Cyrila | Cílová MAC `…:02` ≠ MAC karty `…:03` | proč karta zahodila |
| 9 | všechny | prohozené zdroj a cíl | odpověď |

Pořadí v rentgenu je skutečné (cílová MAC první); štítek obálky zůstává „zdrojová → cílová“ (rozhodnutí 15).
Rentgen ukazuje délku polí v bitech (rozhodnutí 33). Skutečnost, že všechny tři hlavičky říkají „co je
uvnitř“ (EtherType, Protocol, port), se shrne v kroku 18 jednou větou (hint).

## Terminál: kdy a proč

| Krok | Zařízení | Příkaz | Co student zjistí |
|---|---|---|---|
| 1 | Alice | `ipconfig /all` | MAC a IP jsou vlastnosti karty; port tu není |
| 4 | Alice | `arp -a` | odkud zná MAC Boba (předvyplněno, označené zjednodušení) |
| 7 | Cyril | `arp -a` | žádný záznam typu dynamic (jen statické řádky): Cyril si nic nezapamatoval |
| 10 | switch | `show mac address-table` | tabulka je prázdná |
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

V simulátoru je navíc (didaktik, po kontrole) otázka „Co se stane s MAC tabulkou switche, když pošle
zprávu Cyril?“ (odpověď: přibude třetí řádek, Cyrilova MAC na Fa0/3; switch se učí ze zdrojové MAC),
na kterou odkazuje krok 18. V dialogu je jako šestá, otázka o dvou aplikacích jako sedmá.

## Varianta „analogie s dopisem“

V této úrovni se nezapíná (po úrovni 1 se vypíná, viz `uroven1-zapouzdreni.md`). Adresace dopisu
(budova × oddělení) by se plést s MAC/IP/port: „oddělení = port“ je užitečné, ale „adresa budovy“
má dvě podoby (MAC i IP), analogie by tu zmátla.

## Testovací kritéria pro implementaci

Platí pro `scenarios/uroven2-adresy.js` a trace simulace (jména událostí podle `docs/spec/ethernet.md` 4.3).

- Obálky zprávy 1 (rentgen): L4 src 49152, dst 5000; L3 src 192.168.1.10, dst 192.168.1.20, Protocol 17;
  L2 dst `02:00:00:00:00:02`, src `02:00:00:00:00:01`, EtherType `0x0800`.
- Hub: rámec přijatý na Fa0/1 se doručí na Fa0/2 a Fa0/3 (ne zpět na Fa0/1); Cyril: událost `nic_drop`, žádná
  událost v jeho vyšších vrstvách ani v aplikaci; Bob: `app.recv` v aplikaci „zprávy“ (port 5000).
- Odpověď (krok 9): obálky prohozené (src 5000, dst 49152, IP a MAC zrcadlově); Cyril `nic_drop`.
- Switch, krok 11: `mac_learn` (`…:01` → Fa0/1); krok 12: `flood` na Fa0/2 a Fa0/3; Cyril `nic_drop`.
- Krok 13: `mac_learn` (`…:02` → Fa0/2); krok 14: `forward` pouze na Fa0/1; na lince Cyrila žádný nový rámec.
- Kroky tipu (5, 11, 13, 16): rámec na vstupním portu, žádný výstupní rámec, žádné přijal/zahodil ani
  rozhodnutí zařízení; následující krok (6, 12, 14, 17) ukáže výstupy a vyhodnotí tip.
- Krok 15: `show mac address-table` vypíše přesně dva dynamické záznamy (Alice Fa0/1, Bob Fa0/2); Cyril
  v tabulce není.
- Krok 17: zpráva 2: `forward` pouze na Fa0/2; Cyril nic; v aplikaci „poznámky“ přijato, v „zprávy“ nic.
- `arp -a` na Alici: jeden záznam typu dynamic (Bob); na Cyrilovi žádný dynamic, jen statické řádky (rozhodnutí 26); `ipconfig /all` na Alici:
  MAC `02-00-00-00-00-01`, IPv4 192.168.1.10.
- Krok vzad vrátí přesně předchozí stav včetně MAC tabulky (po kroku 11 má 1 řádek, po 13 má 2, po 10 žádný).
- Výměna hub → switch smaže stav hubu a začne s prázdnou MAC tabulkou; „Obnovit“ vrátí hub.
- Tip se nikam neukládá a neblokuje „Krok vpřed“; přehrávání se na kroku tipu zastaví.
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
