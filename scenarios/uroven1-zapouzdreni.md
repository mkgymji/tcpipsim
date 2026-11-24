# Scénář úrovně 1: Barvičky (zapouzdření)

Text pro implementaci. Stav: návrh učitele (iterace 1), texty kroků upravené po kontrole
úrovně 1 (rozhodnuti.md body 17–22). Platné znění je v `uroven1-zapouzdreni.js`; texty závislé
na režimu přepínače mají tvar `{ osi, tcpip }`. Barvy a vzhled upřesní kreativec;
zde jsou pracovní. Texty v uvozovkách jsou texty simulátoru (oslovení „ty“).

## Cíl a nová myšlenka

Student pochopí, že zpráva cestou dolů zásobníkem dostává na každé vrstvě obálku, po drátě jdou jen
bity a příjemce obálky sundává v opačném pořadí.

Výukové cíle: viz `docs/didaktika.md`, úroveň 1.

## Uzly a prostředí

- Dva uzly vedle sebe: **Alice** (odesílá), **Bob** (přijímá). Mezi nimi jeden drát.
- U každého uzlu sloupec vrstev shora dolů (aplikační nahoře, fyzická dole).
- Zpráva: text „Ahoj, Bobe!“ (11 znaků = 11 bajtů v UTF-8, jen ASCII; velikost se nezobrazuje).
- Žádné adresy, žádné protokoly, žádná další zařízení.
- Ovládání: tlačítka Krok vpřed, Krok zpět, Přehrát/Pauza, rychlost; přepínač **ISO/OSI (7) | TCP/IP (4)**;
  přepínač „Barvy | Barvy + písmena“ (přístupnost, viz kreativec); tlačítko „Obnovit“.
- Ke každému kroku vedle animace textová vysvětlivka (max. 2 věty) a v rohu „Simulátor zjednodušuje: ...“,
  pokud se týká.

## Pracovní barvy obálek (podle PDU)

| Vrstva (TCP/IP) | PDU | Barva (pracovní) | Značka navíc (neodkázat jen na barvu) |
|---|---|---|---|
| Aplikační | data | žlutá | písmeno A |
| Transportní | segment | zelená | písmeno T |
| Síťová | paket | modrá | písmeno S |
| Síťového rozhraní | rámec | fialová | písmeno R |
| Fyzická (v ISO/OSI L1) | bity | šedá | 0 1 0 1 |

Mapování na ISO/OSI: aplikační = L7+L6+L5; transportní = L4; síťová = L3; síťového rozhraní = L2+L1.
V ISO/OSI se rámec i bity rozdělí: L2 rámec (fialová), L1 bity (šedá).
Simulátor zjednodušuje: v režimu ISO/OSI se vrstvy 7–5 zobrazí jako jedna skupina „data“
bez vlastních obálek, protože TCP/IP na nich hlavičky nepřidává. (Otázka pro projektanta.)

## Kroky

Každý krok: co student vidí, co dělá, text vysvětlivky.

### Krok 0: Úvod

- Vidí: oba uzly, sloupec vrstev, uprostřed Alice zpráva „Ahoj, Bobe!“ jako bílý obdélník.
- Dělá: nic; tlačítko „Začít“.
- Text: „Alice chce poslat Bobovi zprávu. Podívej se, co s ní udělají vrstvy.“

### Krok 1: Zpráva vzniká v aplikaci

- Vidí: zpráva se objeví v aplikační vrstvě Alice (zvýraznění vrstvy).
- Dělá: může kliknout na vrstvu: zobrazí se rámeček „Co dělá aplikační vrstva“ + „Kdo se stará:
  aplikace“.
- Text: „Zprávu vytvořila aplikace. Na aplikační vrstvě se jí říká data.“

### Krok 2: Obálka transportní vrstvy

- Vidí: data sjedou o vrstvu níž; kolem nich naskočí zelená obálka s písmenem T. Popisek PDU se změní
  z „data“ na „segment“.
- Dělá: může kliknout na obálku (zatím jen text „hlavička transportní vrstvy“; reálný obsah až v rentgenu v pozdějších úrovních).
- Text: „Transportní vrstva přidala svou obálku. Data s obálkou se jmenují segment.“

### Krok 3: Obálka síťové vrstvy

- Vidí: segment sjede dolů, přidá se modrá obálka S. Popisek „paket“. Obálka transportní vrstvy je uvnitř obálky síťové.
- Text: „Síťová vrstva obalila segment další obálkou, výsledek je paket. Do obálky transportní
  vrstvy uvnitř nekouká, bere ji jako data.“

### Krok 4: Obálka vrstvy síťového rozhraní

- Vidí: paket sjede dolů, přidá se fialová obálka R (s drobným zakončením na konci rámce).
  Popisek „rámec“.
- Text: „Vrstva síťového rozhraní přidala poslední obálku. Výsledek je rámec.“
  (V režimu ISO/OSI: „V ISO/OSI to dělá linková vrstva (L2).“)
- Na konci rámce je vidět proužek „konec rámce“ (patička, FCS = kontrola chyb); obsah FCS
  se ukáže až v rentgenu (`docs/rozhodnuti.md` bod 2).

### Krok 5: Z rámce se stanou bity

- Vidí: obálky se v dolní vrstvě rozpadnou na řadu 0 a 1; kolem ní šedá stuha „bity“. Barevné
  proužky ještě chvíli prosvítají (aby šlo pochopit, že jde o stejnou věc, jen zakódovanou).
- Text: „Fyzická vrstva přepsala celý rámec, obálky i zprávu, na bity (0 a 1). Po drátě jede
  všechno, jen už nejde poznat, co je zpráva a co obálka.“ (rozhodnutí 17: původní „obálky se
  neposílají“ vytvářelo miskoncepci)

### Krok 6: Bity jedou po drátě

- Vidí: bity putují po drátě od Alice k Bobovi (animace tečkami); rychlost lze zpomalit.
- Dělá: tlačítkem Pauza zastaví a může kliknout na drát: „Po kabelu jede celý rámec jako bity.
  Kabel nerozlišuje obálky ani zprávu.“
- Text: „Teď jsou bity na drátě. Kabel nic neví o zprávě ani o vrstvách.“

### Krok 7: Bob přijímá bity

- Vidí: bity dorazí do dolní vrstvy Boba a poskládají se zpět do fialového rámce.
- Text (ISO/OSI): „Bob na fyzické vrstvě přijal bity a linková vrstva z nich složila rámec.“
  (TCP/IP): „Bob přijal bity a vrstva síťového rozhraní z nich složila rámec.“

### Krok 8: Sundávání obálek

- Vidí: tři postupné kroky: fialová obálka odlétne (rámec -> paket), modrá odlétne (paket -> segment),
  zelená odlétne (segment -> data). Každá se vrací do správné vrstvy a ta se krátce zvýrazní.
- Dělá: student může u každé obálky kliknout na „Sundat“ (režim „sundávej sám“), jinak se sundávají samy.
- Text (po jednom): „Vrstva síťového rozhraní sundala svou obálku.“ / „Síťová vrstva sundala svou
  obálku.“ / „Transportní vrstva sundala poslední obálku. Zbyla data pro aplikaci.“ Jen v 8a navíc:
  „Obálku čte jen stejná vrstva, jaká ji u odesílatele přidala.“ (ISO/OSI: „Linková vrstva…“)

### Krok 9: Zpráva dorazí

- Vidí: v aplikační vrstvě Boba se objeví bílý obdélník „Ahoj, Bobe!“, stejný jako u Alice.
- Text: „Aplikace u Boba dostala zprávu. Je stejná jako ta, kterou Alice poslala. Cestou se změnily
  jen obálky.“

### Krok 10: Přepnutí ISO/OSI a TCP/IP

- Vidí/dělá: student kdykoli přepne přepínač. Animace se přepne beze změny časování: změní se jen popisky
  a sloupec vrstev (4 nebo 7). Při přepnutí se spojí/rozdělí vrstvy (vizuální skupiny „5–7“
  a „1–2“).
- Text: „Je to pořád stejná cesta, jen jsou vrstvy rozdělené jinak. ISO/OSI má sedm vrstev, TCP/IP čtyři.“
- Tabulka k rozbalení: TCP/IP | ISO/OSI (viz mapování výše).

## „Aha“ chvíle

1. Kolem zprávy přibývají obálky, ale zpráva uvnitř se nemění (krok 3–4).
2. Po drátě jede celý rámec, obálky i zpráva, ale jako bity; kabel je nerozlišuje (krok 5–6). Student si často představoval, že „po drátě
   jede balíček“.
3. Obálku vrstvy N čte u příjemce jen vrstva N (krok 8). Proto má smysl mít více vrstev.
4. Přepínačem ISO/OSI ↔ TCP/IP se nic nezmění na tom, co se děje, jen jak to nazýváme.

## Režim „zkus to sám“ (volitelný)

Obálky se vytáhnou do zásobníku vedle sloupce a student je přetahuje na správnou vrstvu
v odesílači (a při příjmu v opačném pořadí). Chyba: obálka se vrátí a vysvětlivka řekne, kterou
vrstvu student minul („Nejdřív přijde transportní vrstva, ta je blíž k aplikaci.“). Hodnoty
neukládat; je to jen procvičení.

## Kontrolní otázky (konec úrovně)

1. V jakém pořadí se přidávají obálky u odesílatele a v jakém se sundávají u příjemce?
   Očekávaná odpověď: přidávají se shora dolů (aplikační -> transportní -> síťová -> síťového rozhraní),
   sundávají se zdola nahoru, opačně. Obálka přidaná poslední se sundává první.
2. Jak se jmenují data s obálkou na transportní, síťové a linkové vrstvě? Co jede po drátě?
   Očekávaná odpověď: segment, paket, rámec. Po drátě jedou bity: celý rámec i s obálkami a zprávou.
3. Kolik vrstev má ISO/OSI a kolik TCP/IP? Kam patří aplikační vrstva TCP/IP v ISO/OSI?
   Očekávaná odpověď: 7 a 4; aplikační vrstva TCP/IP odpovídá vrstvám 7, 6 a 5 (aplikační, prezentační, relační).
4. Změnila se zpráva „Ahoj, Bobe!“ cestou? Co se změnilo?
   Očekávaná odpověď: zpráva zůstala stejná; přibyly a zase zmizely obálky (hlavičky vrstev); na drátě se změnila
   podoba na bity.
5. Může vrstva, například síťová, přečíst obálku transportní vrstvy a řídit se jí?
   Očekávaná odpověď: ne, každá vrstva zpracuje jen svou obálku; obsah uvnitř bere jako data, která předá výš.
   (Pro otázku 5 zaznamenat, že na jemné úrovni to platí u modelu, ne u všech zařízení: firewall a NAT
   nahlížejí do vyšších vrstev; tomu se věnuje úroveň 5.)

## Varianta „analogie s dopisem“

Zapíná se přepínačem „Pohled: počítače | dopis“. Stejná animace, jiné obrázky a popisky; po
přepnutí zpět zůstane stejný krok.

| Vrstva | Počítačový pohled | Dopis |
|---|---|---|
| Aplikační | data | obsah dopisu: „Ahoj, Bobe!“ |
| Transportní | segment | obálka s jménem příjemce a oddělení (komu uvnitř budovy to patří) |
| Síťová | paket | velká obálka s adresou budovy (město, ulice) |
| Síťového rozhraní | rámec | pytel pro jeden úsek cesty (např. z pobočky do třídírny) |
| Fyzická | bity | silnice a auto, které nic o obsahu neví |

Kroky odpovídají: Alice napíše dopis, vloží do obálek jednu po druhé, dá na poštu, ta ho převeze, u Boba
se obálky rozbalují v opačném pořadí.

Text: „Na poště také vkládáš dopis do dalších obálek a pytlů. Pytel čte jen ten, kdo ho přebírá;
obsah dopisu čte až adresát.“

### Kde analogie kulhá (zobrazit v rozbalovací nápovědě)

- **Co jede po drátě.** Dopis cestuje jako předmět; v síti se přenáší signál, tedy bity, a „dopis“
  se na druhé straně znovu poskládá. Po drátě se nepřenáší žádný předmět.
- **Kdo obaluje.** U dopisu obaluje víc lidí na různých místech; v počítači všechny vrstvy běží uvnitř
  jednoho uzlu a obálky jsou jen posloupnost bajtů v paměti.
- **Rychlost a počet.** Síťová zpráva se obvykle dělí na mnoho malých částí, které jedou zvlášť;
  dopis je jeden kus.
- **Doručení.** Pošta slibuje doručit a při ztrátě reklamuješ; IP nic neslibuje, o spolehlivosti
  rozhoduje až TCP (úroveň 4).
- **Hloubka obálek.** U pošty je „pytel“ jednorázový, v síti se rámec na každém routeru rozbalí
  a paket se obalí novým rámcem (viz úroveň 3); switch rámec přepošle beze změny. Analogie tento mechanismus neukáže.
- **Čas.** Dopis jde dny, bity jdou zlomek sekundy; animace čas zrychluje.

Použití: analogie slouží jen k první orientaci; po úrovni 1 se vypíná a kontrolní otázky se kladou
v počítačovém pohledu.

## Testovací kritéria pro implementaci

- Po sekvenci kroků 1–9 je u Boba data identická s daty Alice (porovnání řetězců).
- Počet obálek: v režimu TCP/IP 3 (T, S, R), v režimu ISO/OSI 3 (L4, L3, L2); v ISO/OSI se vrstvy 7–5 nezobrazí jako obálky.
- Přepnutí režimu uprostřed animace nezmění krok.
- Krok vzad vrátí přesně předchozí stav.
- Význam barev je čitelný i v režimu „Barvy + písmena“ a při čtení bez barev (kontrola kreativce).

## Otevřené otázky pro projektanta

1. ISO/OSI: vrstvy 7–5 jako jedna skupina bez obálek (návrh), nebo tři obálky?
2. Zobrazit FCS (patičku) rámce už zde, nebo jen v rentgenu?
3. Zda kontrolní otázka 5 (nahlížení do vyšších vrstev) nepatří raději až do úrovně 5.

**Odpovědi projektanta (2026-11-24)**

1. Projektant: jedna skupina „data“ bez obálek (rozhodnutí bod 1). TCP/IP má čtyři vrstvy
   (RFC 1122, kap. 1.1.3), relační a prezentační funkce dělá aplikace a hlavičku nepřidávají.
   Počet obálek v obou režimech je 3 (L4, L3, L2), jak říkají testovací kritéria. Věta
   „Simulátor zjednodušuje“ u tohoto bodu není nutná, je to realita, stačí vysvětlivka.
2. Projektant: zde, jako proužek „konec rámce“ (rozhodnutí bod 2); obsah FCS v rentgenu.
   Opraveno v kroku 4 (původní text tvrdil, že se FCS ukáže až v rentgenu).
3. Projektant: otázku 5 nechat v úrovni 1, je to správná vlastnost vrstvového modelu (RFC 1122
   kap. 1.1.3, princip vrstvení). Poznámku pro učitele zpřesnit: zařízení, která nahlížejí výš,
   než je jejich vrstva (firewall, NAT, který mění porty, L3 switch), se probírají v úrovni 5;
   studentovi v úrovni 1 stačí odpověď „ne, každá vrstva zpracuje svou hlavičku“. Jedno zpřesnění,
   které nic neodnaučí: vrstva čte z hlavičky i údaj „co je uvnitř“ (EtherType, Protocol, port),
   aby věděla, které vyšší vrstvě obsah předat; obsah samotný nečte. Hodí se do rentgenu v úrovni 2.

**Další věcné opravy projektanta v tomto scénáři:** „Ahoj, Bobe!“ má 11 znaků, ne 10; analogie
s dopisem: rámec se rozbaluje a obaluje novým na každém **routeru**, ne na každém zařízení
(switch rámec nemění).
