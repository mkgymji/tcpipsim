# UI: vizuální jazyk a rozvržení

Stav: návrh v2 (iterace 1, sjednoceno podle `docs/rozhodnuti.md` 1–16), autor kreativec. Prototyp úrovně 1: `prototypes/uroven1.html`
(snímek `prototypes/uroven1.png`, 1400x900); prototyp ještě ukazuje obálky L5 a L6 a 16 kroků, platí tento dokument. Číselné hodnoty kontrastu jsou spočítané skriptem (vzorec WCAG 2.x).

## 0. Zásady
- Srozumitelnost před efekty. Animace vysvětluje, nezdobí; jde zpomalit, krokovat a vrátit.
- Nic důležitého jen barvou: každá vrstva má barvu + zkratku (L1..L7) + tvar značky + název PDU.
- Barvy vrstev jsou stejné všude: sloupec vrstev, obálky, rentgen, legenda, sekvenční diagram.
- Obálky mají jen L4 (segment), L3 (paket) a L2 (rámec, včetně konce rámce). L7 je blok „data“ bez obálky; L5 a L6 se zobrazují jen ve sloupci vrstev (rozhodnutí 1).
- Bez externích fontů, CDN a obrázků ze sítě (offline ve škole). Systémová písma. Žádná emoji; ikony jsou inline SVG nebo CSS.
- Čistě HTML/CSS/JS bez build kroku; barvy a velikosti jako CSS proměnné (`:root`), aby šly přepnout téma a velikost písma.

## 1. Rozvržení obrazovky
Cílový rozměr 1280x720 a víc (projektor), návrh ladíme na 1400x900. Pevná mřížka, nic se nepřekrývá.

```
+----------------------------------------------------------------------------------+
| tcpipsim  Úroveň 1: Barvičky - PC A posílá zprávu PC B        [ISO/OSI (7)|TCP/IP (4)] |
+----------------------------------------------------------------------+-----------+
| TOPOLOGIE (výška ~150 px)                                            | VYSVĚTLIVKA|
|   [PC A] ================ kabel ================ [PC B]              | Krok 4/10  |
+----------------------------------------------------------------------+ krátký text|
| VÝTAH                                                                | (max 2     |
| PC A (odesílatel)   ZPRÁVA V OBÁLKÁCH        PC B (příjemce)         |  věty)     |
| [L7 Aplikační ]     +--L2 rámec----------+   [L7 Aplikační ]         +-----------+
| [L6 Prezent.  ]     | +--L3 paket------+ |   [L6 Prezent.  ]         | RENTGEN   |
| [L5 Relační   ]     | | +--L4 segment+ | |   [L5 Relační   ]         | (úroveň 2+|
| [L4 Transport.]     | | |  L7 data   | | |   [L4 Transport.]         |  klik na  |
| [L3 Síťová    ]     | | +------------+ | |   [L3 Síťová    ]         |  obálku)  |
| [L2 Linková   ]>    | +----------------+ |   [L2 Linková   ]         +-----------+
| [L1 Fyzická   ]     +-- konec rámce -----+   [L1 Fyzická   ]         | TERMINÁL  |
+----------------------------------------------------------------------+ (později) |
| [< Zpět] [|| Pauza] [Vpřed >]  [=====o--------] krok 4 z 10    Rychlost 1x  +/-   |
+----------------------------------------------------------------------------------+
```

- **Horní lišta (56 px):** název, aktuální úroveň, přepínač ISO/OSI (7) / TCP/IP (4). Přepínač jde použít i uprostřed animace: stejný stav, jiné popisky (viz 2.3).
- **Plocha topologie (nahoře vlevo):** v úrovni 1 dvě PC a kabel. Od úrovně 3 roste (scroll/zoom, editor topologie, viz 8). Aktivní zařízení má silný obrys.
- **Výtah (pod topologií):** tři sloupce. Vlevo sloupec vrstev odesílatele (L7 nahoře, L1 dole), uprostřed právě putující zpráva jako blok „data“ s vnořenými obálkami L4, L3, L2 (jen tyto tři; L5 a L6 se uprostřed nekreslí), vpravo sloupec vrstev příjemce. Sloupec vrstev má vždy všech 7 (ISO/OSI) nebo 4 (TCP/IP) řádků; L5–L7 v něm jen svítí jako „zpráva je tady jako data“, bez vlastní obálky. Aktivní vrstva má dvojitý obrys a šipku. Neaktivní/budoucí vrstvy jsou čárkované s bílým pozadím, hotové mají plnou barvu.
- **Vysvětlivka (pravý panel nahoře):** číslo kroku, název kroku, max. dvě věty, jednou větou co bude dál. Je `aria-live="polite"`. Pojmy ze slovníku `docs/slovnik.md`; zjednodušení značíme „Simulátor zjednodušuje: ...“.
- **Rentgen (pravý panel uprostřed):** v úrovni 1 jen zašedlý zástupný text (patička „konec rámce“ je vidět, její obsah až v rentgenu). Od úrovně 2 po kliknutí na obálku ukáže pole hlavičky (tabulka pole, bity, hodnota, vysvětlení) a hexdump; zvýrazněné pole se spojí čarou s odpovídající částí obálky. Může se rozšířit na celou výšku pravého sloupce.
- **Terminál (pravý panel dole):** v úrovni 1 jen úzký zástupný pruh. Po otevření (klik na PC nebo scénář) se roztáhne nad rentgen jako vysouvací panel (Esc zavře). Písmo monospace, min. 18 px.
- **Ovládání (spodní lišta, 84 px):** Zpět, Přehrát/Pauza (největší tlačítko, tmavé), Vpřed, posuvník kroků (klikací, tažný), rychlost.
- Od úrovně 3: pod výtahem časová osa (sekvenční diagram) a výtah se přepíná mezi zařízeními na cestě (klik na zařízení v topologii).

## 2. Barvy vrstev

### 2.1 Paleta ISO/OSI, světlé pozadí
Pozadí stránky `#F7F8FA`, panely `#FFFFFF`, text `#14181C`, tlumený text `#4B5563`.
Každá vrstva má dvě barvy: **sytá** (obrys, hlavička štítku, značka; bílý text na ní) a **světlá** (výplň těla; tmavý text na ní).

| Vrstva | Tvar značky | Sytá | Světlá | Bílý text na sytá | Tmavý text `#14181C` na světlé | Sytá na pozadí stránky |
|---|---|---|---|---|---|---|
| L1 Fyzická | obdélník | `#4A5A66` | `#DEE1E3` | 7,13 | 13,58 | 6,71 |
| L2 Linková | čtverec | `#8A5200` | `#EAE0D1` | 6,39 | 13,66 | 6,01 |
| L3 Síťová | kruh | `#00695C` | `#D1E4E2` | 6,61 | 13,51 | 6,22 |
| L4 Transportní | trojúhelník | `#1B5FAA` | `#D6E2F0` | 6,43 | 13,59 | 6,05 |
| L5 Relační | kosočtverec | `#6A3FA0` | `#E4DCEE` | 7,42 | 13,40 | 6,98 |
| L6 Prezentační | pětiúhelník | `#A02C72` | `#EED9E6` | 6,78 | 13,34 | 6,38 |
| L7 Aplikační | šestiúhelník | `#B3301A` | `#F1DAD6` | 6,26 | 13,37 | 5,89 |

Text `#14181C` na pozadí 16,79; `#4B5563` na pozadí 7,11. Všechny dvojice splňují WCAG AA pro běžný text (4,5) a většina i AAA (7) u hlavního textu; sytá barva obrysu proti pozadí a výplni má min. 4,69, tedy i nad 3:1 pro grafické prvky. Poměry se přepočítají skriptem, kdykoli se paleta změní (vzorec: relativní luminance sRGB, `(L1+0,05)/(L2+0,05)`).

Pravidla použití:
- Barvy L5 a L6 se používají jen ve sloupci vrstev, legendě a značkách (tvar + zkratka); obálku v těchto barvách nikdy nekreslit. L7 sytá barva označuje značku a popisek bloku „data“, ne obálku.
- Hlavička štítku obálky: sytá barva, bílý text, tučně. Tělo obálky: světlá barva. Obrys obálky: sytá, 4 px.
- Textový odkaz na vrstvu (např. „segment“ v řádku sloupce): sytá barva tučně, vždy spolu s textem názvu.
- Nikdy nepsat sytou barvou text na světlou výplň jiné vrstvy.

### 2.2 Rozlišitelnost pro barvoslepé
Barvy jsou voleny různé světlostí i odstínem (hnědá, tmavě zelená, modrá, fialová, purpurová, červená, šedá), ale nespoléháme na ně:
1. **Zkratka L1..L7** v každé značce a štítku (v TCP/IP režimu viz 2.3).
2. **Tvar značky** (tabulka výše): jedinečný pro každou vrstvu, tedy i na černobílém tisku.
3. **Název PDU** vždy vedle názvu vrstvy (bity, rámec, paket, segment, data).
4. **Pořadí**: obálky jsou vnořené vždy ve stejném pořadí, takže pozice vypovídá o vrstvě.
5. Stav (hotovo / aktivní / čeká) se rozlišuje stylem čáry, ne barvou: plný obrys = hotovo, dvojitý silný obrys + šipka = aktivní, čárkovaný = čeká.
Ověření: při implementaci projít snímky filtry deuteranopie/protanopie/tritanopie v Chromiu (DevTools, Rendering, Emulate vision deficiencies) a černobíle.

### 2.3 TCP/IP: sloučení vrstev
Modely se přepínají bez změny barev; sloučená vrstva dostane barvu nejvyššího člena, aby zůstala vazba na ISO/OSI.

| TCP/IP vrstva | Odpovídá | Barva a tvar | Značka | PDU |
|---|---|---|---|---|
| Aplikační | L5+L6+L7 | jako L7 (šestiúhelník) | `L5-7` | data (bez obálky) |
| Transportní | L4 | jako L4 | `L4` | segment |
| Síťová (Internet) | L3 | jako L3 | `L3` | paket (IP datagram) |
| Vrstva síťového rozhraní | L1+L2 | jako L2 (čtverec) | `L1-2` | rámec, bity |

U sloučené vrstvy je vlevo tenký proužek barev členů (L5, L6, L7 resp. L1, L2), aby student viděl, co se sloučilo. Při přepnutí se proužky 300 ms „slijí“ (nebo se okamžitě přepnou při reduced motion). Počet obálek ve středovém panelu je v obou modelech stejný, tři (L4 segment, L3 paket, L2 rámec s koncem rámce) kolem bloku „data“; přepínač mění jen sloupce vrstev a popisky, ne obrázek zprávy. Při přepnutí na TCP/IP vysvětlivka řekne, že L5–L7 tu žádnou hlavičku nepřidávají a jejich úkoly (např. šifrování TLS, kódování znaků) řeší aplikace; v ISO/OSI stejnou větu ukáže při průchodu zprávy L7–L5.

### 2.4 Tmavý motiv (volitelný, `prefers-color-scheme` + ruční přepínač)
Pozadí `#12181F`, panely `#1B232C`, text `#E8EDF2` (15,16 na pozadí). Obálky: hlavička v jasné barvě s tmavým textem `#0E1318`, tělo = tmavá výplň (jasná barva 15 % na pozadí), obrys jasná barva.

| Vrstva | Jasná | Na pozadí `#12181F` | Tmavý text na jasné |
|---|---|---|---|
| L1 | `#9FB3C2` | 8,25 | 8,62 |
| L2 | `#E0A04A` | 7,90 | 8,26 |
| L3 | `#4DC1AE` | 8,12 | 8,49 |
| L4 | `#6FA8F0` | 7,26 | 7,59 |
| L5 | `#B494E6` | 7,07 | 7,39 |
| L6 | `#E88AC0` | 7,51 | 7,85 |
| L7 | `#F08A6E` | 7,28 | 7,61 |

Pro projektor ve třídě je výchozí světlé téma (projektory „vypírají“ tmavé tóny). Tmavé je doplněk.

## 3. Obálka (PDU)
- **Co je obálka a co ne:** obálky jsou jen tři: L4 segment, L3 paket, L2 rámec (hlavička vpředu + patička „konec rámce“ vzadu). Na drátě jsou bity (L1), které obálku nemají, jen mění tvar. L7 je jádro „data“ bez obálky. L5 a L6 žádnou obálku ani blok nemají, protože TCP/IP na nich hlavičky nepřidává (rozhodnutí 1: pravidlo „zjednodušit jen tak, aby se to nemuselo odnaučit“).
- **Vnořování:** zpráva je v jádru, bloku „data“ (bílý box s tmavým rámem, text zprávy, např. „Ahoj, Bobe!“, značka šestiúhelník `L7`, popisek „data“). Každá vrstva při zapouzdření přidá obálku **kolem** předchozí: L4 nejvnitřnější, L2 nejvnější. Pořadí zevnitř je pevné: data, segment (L4), paket (L3), rámec (L2).
- **Průchod L7–L5 v režimu ISO/OSI:** zpráva ve sloupci vrstev projde L7, L6, L5 jako „data“ bez změny tvaru; řádky L5 a L6 se krátce zvýrazní s textem vysvětlivky „V TCP/IP tyhle úkoly řeší aplikace (např. šifrování TLS, kódování znaků), vrstva žádnou hlavičku nepřidává.“ Žádná obálka nevznikne.
- **Štítek (úroveň 1):** pásek na horní hraně obálky: vlevo „L2 Linková“, vpravo název PDU („rámec“). Nic víc. L2 má navíc dole proužek „konec rámce“ (patička, v rentgenu FCS), aby student viděl, že rámec obálku i uzavírá (rozhodnutí 2). Jiné obálky patičku nemají.
- **Štítek (úroveň 2):** pod pásek přibude řádek adres podle vrstvy, písmo monospace 16 px, zdroj vlevo a cíl vpravo:
  - L2: `zdrojová MAC -> cílová MAC`,
  - L3: `zdrojová IP -> cílová IP`,
  - L4 (UDP provoz „zprávy“ z rozhodnutí 13): `zdrojový port -> cílový port`; příznaky TCP až od úrovně 4.
  Nikdy „odesílatel -> příjemce“: za routerem je cílem rámce další skok, ne příjemce (rozhodnutí 15). Hodnoty jsou ze simulace, ne vymyšlené. Od úrovně 3: TTL u L3. Zkratky hlaviček (SA, DA) nejdřív rozepsat. V rentgenu jsou pole ve skutečném pořadí (cílová MAC první), štítek ukazuje pořadí „odkud -> kam“ kvůli čitelnosti; rozdíl vysvětlí poznámka v rentgenu.
- **Úroveň 2 a ARP:** MAC adresa cíle je předvyplněná, vysvětlivka řekne „Simulátor zjednodušuje: MAC adresu Boba už PC A zná; jak ji zjistí, uvidíš v úrovni 3“ (rozhodnutí 14). Štítek L2 je proto vyplněný od začátku.
- **Úroveň 3: zprávy bez některé obálky.** Pořadí vnoření zůstává, jen jedna úroveň chybí a chybějící místo je vidět:
  - **ARP:** kolem bloku „ARP zpráva“ je jen obálka L2 (rámec). Obálka L3 ani L4 není. Blok ARP je bílý s tmavým rámem jako „data“, s popiskem „ARP zpráva v rámci“ a v rentgenu EtherType `0x0806`. Ve sloupci vrstev je u L3 a L4 textová poznámka „bez hlavičky L3“; řádky nejsou zvýrazněné jako aktivní (čárkované, stav „čeká“ se nemění na „hotovo“). ARP zpráva se nenazývá paket.
  - **ICMP (ping):** obálky L2 a L3, uvnitř blok „ICMP zpráva“ (bílý s tmavým rámem, popisek „ICMP zpráva v paketu“). Obálka L4 chybí a ve sloupci vrstev u L4 stojí „ICMP nemá porty“; štítek L3 se pozná podle protokolu v rentgenu. ICMP zpráva se nenazývá segment.
  - V obou případech je „díra“ v obálkách zdůrazněná popiskem, ne jen absencí barvy (nic jen barvou).
- **Zjednodušení označit:** pod obálkou ikona „i“ s textem „Simulátor zjednodušuje: skutečná hlavička má víc polí, klikni na obálku (rentgen)“.
- **Bity na drátě:** L1 neobaluje, ale mění tvar: rámec včetně konce rámce se rozloží na pruh čtverečků 0/1, v monospace, barva `L1` (#4A5A66) na bílém, 3 px rámeček pásu. Pruh putuje po kabelu; zobrazuje jen prvních asi 24 bitů, za nimi „...“ (celé jsou v rentgenu). Zbarvení bitů nezachová barvy vnitřních obálek (na drátě už vrstvy nejsou rozeznatelné, to je didaktický bod); případně se při pauze na drátě ukáže poloprůhledný obrys rámce. Označená zjednodušení (bez zkratek, po kontrole úrovně 1): krok 5 „ukazujeme jen začátek rámce a bity bajt po bajtu, jak se zapisují (karta je vysílá v jiném pořadí). Kontrolní číslo v patičce se nepočítá.“; krok 6 „signál na drátě není doslova 0 a 1 … Před rámcem jede ještě synchronizační úvod (preambule), ten nekreslíme. Animace je zpomalená.“
- **Rozbalení:** přijímač obálky sundává opačně: L2 první. Rozbalení L2 odstraní hlavičku i patičku („konec rámce“ zmizí spolu s hlavičkou). Sundaná obálka na okamžik zůstane vedle sloupce vrstvy (vyblednutá, 600 ms) s popiskem „hlavičku (a u L2 i patičku) přečetla vrstva L2 a odstranila“. Pořadí: rámec -> paket -> segment -> data. Blok „data“ u příjemce se už nesundává, jen se předá aplikaci.

## 4. Animace
Kroky jsou diskrétní (udělej-to-teď); animace jen vysvětluje přechod mezi kroky. Čas při rychlosti 1x:

| Co | Pohyb | Doba | Poznámka |
|---|---|---|---|
| Zapouzdření na vrstvě (jen L4, L3, L2) | nová obálka „narůstá“ kolem stávající (scale 0,92 -> 1 + fade), hlavička se vysune; u L2 přibude i konec rámce | 700 ms | zvýrazní se řádek vrstvy; průchod L7–L5 je jen posun zvýraznění (300 ms), bez obálky |
| Přechod mezi vrstvami v sloupci | zvýrazněný obrys sjede o řádek níž | 300 ms | |
| Převod na bity | rámec (hlavička, data, konec rámce) se „rozpadne“ na pruh čtverečků | 600 ms | |
| Přenos po kabelu | pruh bitů se posouvá od A k B | 1500 ms | doba pevná kvůli čitelnosti, ne úměrná délce kabelu |
| Rozbalení | obálka se zmenší a odsune do strany; u L2 hlavička i patička společně | 700 ms | |
| Přepnutí ISO/OSI <-> TCP/IP | sloučení/rozdělení řádků | 300 ms | |

- **Rychlost:** 0,25x, 0,5x, 1x, 2x, 4x (násobí všechny doby, hodnota vidět v ovládání). Výchozí 1x; v režimu „krok po kroku“ (pauza) se animace přehraje jednou po stisku Vpřed a čeká.
- **Krok vzad:** animace v opačném směru (obálka se zmenšuje, bity se vracejí), stejně dlouhá; stav po animaci je přesně stav předchozího kroku (jádro je deterministické, UI jen zobrazuje stav; animace nikdy nemění stav). Tlačítko Zpět při kroku 1 neaktivní (viditelně: světlejší obrys + `aria-disabled`).
- **Přeskakování:** posuvník skočí na krok bez animace (jen přepne stav); při rychlém mačkání šipek se rozdělaná animace dokončí okamžitě (skip), ne ve frontě.
- **Pauza:** zmrazí aktuální animaci; Vpřed/Zpět během pauzy dokončí aktuální a udělá jeden krok.
- **Kroky se pojmenovávají:** v panelu a pod posuvníkem „Krok 4 z 10: zapouzdření na L2“. Kroky úrovně 1 jsou 0–10 podle scénáře (tabulka v kap. 9); číslo „z 10“ je poslední krok, krok 0 je úvod.
- **`prefers-reduced-motion: reduce`:** žádné posuny, růst ani pohyb bitů; změna stavu se provede okamžitě a krátce (200 ms, bez pohybu) zvýrazní okrajem obálky/řádku. Přehrávání (autoplay) je stále možné, ale po jednom kroku za zvolený interval. Celkové chování nesmí záviset na animaci: vše je i v textu vysvětlivky. Ruční přepínač „Omezit animace“ v nastavení má stejný efekt.
- Animují se jen `transform` a `opacity` (výkon na školních PC). Žádné blikání víc než 1x za sekundu.

## 5. Čitelnost na projektoru
- Nejmenší písmo v UI **15 px** (vedlejší popisky, jen doplněk); základní text **18 px**; vysvětlivka **19-20 px**; štítky obálek 17 px tučně; nadpisy panelů 17-22 px. V nastavení škálování 100/125/150 % (jedna CSS proměnná `--scale`, `font-size` na `html`).
- Žádný text pod 4,5:1 (viz 2). Žádný šedý text na šedém; tlumený text je `#4B5563` na bílé nebo `#F7F8FA`.
- Čáry: obrysy obálek a řádků **3-4 px**, aktivní **6 px + vnější 3 px kroužek**, kabel 6 px, jemné rámování panelů 2 px (`#9AA5B1`). Minimum čáry nikdy pod 2 px.
- Tlačítka min. 52 px vysoká (terč pro prst/ukazatel); mezi kliknutelnými prvky min. 8 px.
- Písmo systémové: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`; monospace `ui-monospace, Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace`. Na školních Windows tedy Segoe UI/Consolas.
- Fokus viditelný: obrys 3 px `#0B57D0` s odstupem 2 px (kontrast 6,9 na bílé).
- Rozvržení se při menší šířce nemění na zalamování; pod 1100 px se pravý panel přesune pod výtah (scroll).

## 6. Klávesové zkratky
| Klávesa | Akce |
|---|---|
| `->` / `<-` | krok vpřed / vzad |
| mezerník | přehrát / pauza |
| `Home` / `End` | na začátek / na konec |
| `+` / `-` | rychlost rychleji / pomaleji |
| `T` | přepnout ISO/OSI <-> TCP/IP |
| `R` | rentgen vybrané obálky (úroveň 2+) |
| `Tab` / `Shift+Tab` | procházení obálek a vrstev; `Enter` = rentgen |
| `` ` `` nebo `F2` | terminál (později); `Esc` zavře panel |
| `?` | nápověda s přehledem zkratek |
Zkratky se nespouští, když je kurzor v textovém poli (terminál). Mezerník na tlačítku nesmí dělat dvě věci (tlačítko Pauza a globální mezerník = totéž). Každé tlačítko má text i zkratku v `<kbd>`.

## 7. Ikony zařízení
Inline SVG v `viewBox="0 0 64 56"`, tah `#14181C` 4 px, výplň bílá/světle modrá `#D6E2F0`, bez gradientů a stínů, vždy s textovým popiskem pod ikonou (název + volitelně IP). Konvence podle Cisco (router = kruh, switch = čtverec), kresba vlastní, jednodušší, žádné kopie Cisco grafiky.

| Zařízení | Tvar | SVG (obsah) |
|---|---|---|
| PC | monitor | `<rect x="6" y="4" width="52" height="34" rx="4" fill="#fff" stroke="#14181C" stroke-width="4"/><rect x="13" y="11" width="38" height="20" fill="#D6E2F0"/><path d="M24 38v8h16v-8M16 50h32" fill="none" stroke="#14181C" stroke-width="4" stroke-linecap="round"/>` |
| Server | věž, 3 přihrádky | `<rect x="14" y="3" width="36" height="50" rx="4" fill="#fff" stroke="#14181C" stroke-width="4"/><path d="M14 20h36M14 36h36" stroke="#14181C" stroke-width="4"/><circle cx="23" cy="12" r="2.5" fill="#14181C"/><circle cx="23" cy="28" r="2.5" fill="#14181C"/><circle cx="23" cy="44" r="2.5" fill="#14181C"/>` |
| Hub | šestiúhelník, šipky všemi směry | `<polygon points="18,6 46,6 60,28 46,50 18,50 4,28" fill="#fff" stroke="#14181C" stroke-width="4"/><path d="M20 28h24M38 22l6 6-6 6M26 22l-6 6 6 6" fill="none" stroke="#14181C" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` |
| Switch | čtverec s dvěma šipkami | `<rect x="6" y="6" width="52" height="44" rx="4" fill="#fff" stroke="#14181C" stroke-width="4"/><path d="M14 22h36M42 15l8 7-8 7M50 36H14M22 29l-8 7 8 7" fill="none" stroke="#14181C" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` |
| Router | kruh se čtyřmi šipkami | `<circle cx="32" cy="28" r="24" fill="#fff" stroke="#14181C" stroke-width="4"/><path d="M32 10v36M14 28h36M26 16l6-6 6 6M26 40l6 6 6-6M20 22l-6 6 6 6M44 22l6 6-6 6" fill="none" stroke="#14181C" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` |

- Hub se v popiscích ani v nápovědě nenazývá „opakovač“ (repeater je jiné zařízení); správně „hub“, vysvětlení „rozeslá bity na všechny ostatní porty“. Kolize se nekreslí (rozhodnutí 8; označit jako zjednodušení).
- Zařízení se v topologii rozlišují tvarem a popiskem, ne barvou. Barva ikony je neutrální (vrstvy nesou barvu). Zařízení, které čte jen do vrstvy X (hub L1, switch L2, router L3), má pod ikonou drobnou značku nejvyšší vrstvy (např. čtverec `L2`) a nad kabely jen tyto vrstvy ve výtahu aktivní.
- Kabel: plná čára 6 px `#14181C`; port/rozhraní popsané písmem (`Fa0/1`, `G0/0` od úrovně 3).
- Aktivní/vybrané zařízení: obrys 6 px + kroužek; stav chyby (ztráta paketu): výrazný křížek v kruhu a text, ne jen červená.

## 8. Editor topologie (návrh pro pozdější úrovně)
- Paleta zařízení vlevo v ploše topologie (5 ikon). Přetažení myší/dotykem do plochy, mřížka 20 px s přichytáváním.
- Kabel: klik na port zařízení, tažení ke druhému zařízení; neplatné spojení (hub - zařízení, které už nemá volný port) vrátí zpět s textovou hláškou.
- Výběr zařízení: panel vlastností (název, IP, maska, brána) v pravém sloupci místo rentgenu. Smazání: `Delete`. Zpět/znovu: `Ctrl+Z` / `Ctrl+Y`.
- Vše dostupné i z klávesnice (Tab mezi zařízeními, šipky posun o krok mřížky).

## 9. Úroveň 1 v jedné větě
Student klikne Vpřed a vidí, jak zpráva „Ahoj, Bobe!“ (data) dostává obálky L4 (segment), L3 (paket) a L2 (rámec s koncem rámce), jak se z rámce stanou bity, jak putují drátem a jak je PC B v opačném pořadí rozbalí (L2 sundá hlavičku i patičku). Všechny pojmy jsou vždy na obrazovce nazvané (vrstva + PDU), nic se nemusí hádat z barvy.

Kroky úrovně 1 (podle `scenarios/uroven1-zapouzdreni.md`, 0–10, rozhodnutí 3):

| Krok | Co se děje | Co UI ukáže |
|---|---|---|
| 0 | Úvod | oba uzly, zpráva jako blok „data“ |
| 1 | Zpráva vzniká v aplikaci | blok „data“ u L7 odesílatele (L5–L7 jen zvýrazněné) |
| 2 | Obálka L4 | segment: data sjedou, kolem nich obálka L4 |
| 3 | Obálka L3 | paket: kolem segmentu obálka L3 |
| 4 | Obálka L2 | rámec: obálka L2 + proužek „konec rámce“ |
| 5 | Z rámce se stanou bity | rozpad na pruh 0/1 |
| 6 | Bity jedou po drátě | pruh putuje po kabelu |
| 7 | Příjemce přijímá bity | bity se složí zpět do rámce |
| 8 | Sundávání obálek | tři dílčí kroky: L2 (hlavička i patička), L3, L4; indikátor „8a, 8b, 8c“ |
| 9 | Zpráva dorazí | blok „data“ u L7 příjemce |
| 10 | Přepnutí ISO/OSI a TCP/IP | jen sloupce a popisky (viz 2.3) |

Krok 8 se v čítači počítá jako jeden krok (podkroky se krokují šipkami a ukazují se jako 8a až 8c); posuvník má tedy 11 pozic.

## 10. Otevřené otázky
- Vyřešeno rozhodnutími: počet kroků úrovně 1 (0–10, rozhodnutí 3), obálky L5 a L6 se nekreslí (rozhodnutí 1).
- Zda podkroky 8a–8c počítat do čítače zvlášť (návrh: ne, viz 9); potvrdí vývojář a didaktik.
- Skutečný test barev na školním projektoru: pilot v semináři.
