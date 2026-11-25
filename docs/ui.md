# UI: vizuální jazyk a rozvržení

Stav: návrh v4 (přidána kap. 12 Úroveň 3: Směrování, prototyp `prototypes/uroven3.html`); v3 (kap. 11 Úroveň 2: Adresy, prototyp `prototypes/uroven2.html`); návrh v2 (iterace 1, sjednoceno podle `docs/rozhodnuti.md` 1–16), autor kreativec. Prototyp úrovně 1: `prototypes/uroven1.html`
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
- **Plocha topologie (nahoře vlevo):** v úrovni 1 dvě PC a kabel; od úrovně 2 hvězda se switchem/hubem (kap. 11.1). Od úrovně 3 roste (scroll/zoom, editor topologie, viz 8). Aktivní zařízení má silný obrys.
- **Výtah (pod topologií):** tři sloupce. Vlevo sloupec vrstev odesílatele (L7 nahoře, L1 dole), uprostřed právě putující zpráva jako blok „data“ s vnořenými obálkami L4, L3, L2 (jen tyto tři; L5 a L6 se uprostřed nekreslí), vpravo sloupec vrstev příjemce. Sloupec vrstev má vždy všech 7 (ISO/OSI) nebo 4 (TCP/IP) řádků; L5–L7 v něm jen svítí jako „zpráva je tady jako data“, bez vlastní obálky. Aktivní vrstva má dvojitý obrys a šipku. Neaktivní/budoucí vrstvy jsou čárkované s bílým pozadím, hotové mají plnou barvu.
- **Přenos jako „U“ (rozhodnutí 38):** prostřední sloupec výtahu má stejnou mřížku 7 stop jako sloupec vrstev (L7 nahoře, L1 dole; v TCP/IP sloučené řádky zaberou víc stop). Blok se zprávou má **spodní hranu u aktivní vrstvy**: při zapouzdření u odesílatele klesá, při rozbalení u příjemce stoupá; když je blok vyšší než místo nad vrstvou, zůstane nahoře a přesahuje dolů (nikdy nad horní okraj). Mezi řádky L1 odesílatele a příjemce vede **pruh „médium (kabel)“**; bity (pásek 0/1, jen schematicky: 12 bitů, se zařízením 8, celý obsah ukazuje rentgen) jedou jen v něm. Když je zpráva na L1, nad pruhem zůstane jen krátká poznámka se šipkou dolů. Na úrovni 2 stojí v pruhu uprostřed zařízení s výškou jen do vrstvy, kterou čte: **hub jen L1, switch L1 a L2**; aktivní řádek zařízení má silný obrys. Rámec ve switchi „vystoupá“ a sedí na jeho věžičce (vidět jen obálka L2 s adresami, obsah zavřený: „uvnitř paket … SW1 ho neotevírá“), pak zase klesne do pruhu. Doplňky pod blokem (socket, doručení, aplikace příjemce) visí pod ním a nesmí překrýt pruh média: aplikace příjemce se ukazují jen při bloku u L4 a výš; ARP tabulka odesílatele (krok 4) je proto v topologii pod kartou PC. **Topologie nahoře je jen mapa „kde v síti jsme“**: bity v ní nejezdí; aktivní kabel se zvýrazní stejně jako pruh média dole (barva L1 se světlým lemem) a popisek odkáže dolů (úroveň 1 nad kabelem „bity jedou po kabelu = pruh „médium“ dole (L1)“, úroveň 2 dole uprostřed „zvýrazněný kabel = pruh „médium“ dole (L1)“). Kabel svítí jen tehdy, když bity jsou na L1, tedy když svítí i pruh dole. V úrovni 1 otevře klik na kabel nahoře i na kabel v pruhu stejný panel Detail „Kabel“. Věžička zařízení v pruhu má v buňkách jména vrstev („L2 Linková“, „L1 Fyzická“), ne PDU, aby nepůsobila jako druhý rámec; jméno zařízení stojí vedle ní (hub nad, switch vlevo od L2). Rámec ve switchi má štítek „rámec ve switchi SW1“ a svislou spojku k řádku L2 věžičky (kontrola 38). Na kroku tipu pruh ukáže jen vstupní úsek (rozhodnutí 31). Posun bloku je animace jen `transform` (600 ms), při kroku vzad, skoku a „Omezit animace“ bez pohybu. Slova „výtah“ a „prostředník“ se studentovi neukazují (rozhodnutí 37).
- **Vysvětlivka (pravý panel nahoře):** číslo kroku, název kroku, max. dvě věty, jednou větou co bude dál. Je `aria-live="polite"`. Pojmy ze slovníku `docs/slovnik.md`; zjednodušení značíme „Simulátor zjednodušuje: ...“.
- **Rentgen (pravý panel uprostřed):** v úrovni 1 jen zašedlý zástupný text (patička „konec rámce“ je vidět, její obsah až v rentgenu). Na úrovni 1 se panel jmenuje „Detail“ (rozhodnutí 20). Od úrovně 2 je to rentgen (návrh v kap. 11.4): po kliknutí na obálku ukáže pole hlavičky (tabulka pole, bajty, hodnota, vysvětlení vybraného pole) a hexdump; zvýrazněné pole se spojí čarou s odpovídající částí obálky. Může se rozšířit na celou výšku pravého sloupce.
- **Terminál (pravý panel dole):** v úrovni 1 jen úzký zástupný pruh. Po otevření (klik na PC nebo scénář) se na úrovni 1 roztáhne nad rentgen jako vysouvací panel (Esc zavře); od úrovně 2 je to okno nad výtahem (kap. 11.5). Písmo monospace, min. 18 px.
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
- **Štítek (úroveň 2):** pod pásek přibude řádek adres, dvě buňky vedle sebe, **zdroj vlevo, cíl vpravo**. Podrobně kap. 11.3 (popisky buněk, tučný poslední bajt, číslování polí). Pořadí „zdroj, cíl“ je vždy stejné; nikdy „odesílatel -> příjemce“ (rozhodnutí 15, za routerem je cílem rámce další skok). Hodnoty jsou ze simulace. Od úrovně 3 přibude TTL u L3.
- **Úroveň 2 a ARP:** MAC adresa cíle je předvyplněná, vysvětlivka řekne „Simulátor zjednodušuje: MAC adresu Boba už PC A zná; jak ji zjistí, uvidíš v úrovni 3“ (rozhodnutí 14). Štítek L2 je proto vyplněný od začátku.
- **Úroveň 3: zprávy bez některé obálky.** Pořadí vnoření zůstává, jen jedna úroveň chybí a chybějící místo je vidět:
  - **ARP:** kolem bloku „ARP zpráva“ je jen obálka L2 (rámec). Obálka L3 ani L4 není. Blok ARP je bílý s tmavým rámem jako „data“, s popiskem „ARP zpráva v rámci“ a v rentgenu EtherType `0x0806`. Ve sloupci vrstev je u L3 a L4 textová poznámka „bez hlavičky L3“; řádky nejsou zvýrazněné jako aktivní (čárkované, stav „čeká“ se nemění na „hotovo“). ARP zpráva se nenazývá paket.
  - **ICMP (ping):** obálky L2 a L3, uvnitř blok „ICMP zpráva“ (bílý s tmavým rámem, popisek „ICMP zpráva v paketu“). Obálka L4 chybí a ve sloupci vrstev u L4 stojí „ICMP nemá porty“; štítek L3 se pozná podle protokolu v rentgenu. ICMP zpráva se nenazývá segment.
  - V obou případech je „díra“ v obálkách zdůrazněná popiskem, ne jen absencí barvy (nic jen barvou).
- **Zjednodušení označit:** pod obálkou ikona „i“ s textem „Simulátor zjednodušuje: skutečná hlavička má víc polí, klikni na obálku (rentgen)“.
- **Bity na drátě:** L1 neobaluje, ale mění tvar: rámec včetně konce rámce se rozloží na pruh čtverečků 0/1, v monospace, barva `L1` (#4A5A66) na bílém, 3 px rámeček pásu. Pruh putuje po médiu dole mezi řádky L1 (rozhodnutí 38, kap. 1), ne po kabelu v topologii; zobrazuje jen prvních 12 bitů (se zařízením 8), za nimi „…“ (celé jsou v rentgenu). Zbarvení bitů nezachová barvy vnitřních obálek (na drátě už vrstvy nejsou rozeznatelné, to je didaktický bod); případně se při pauze na drátě ukáže poloprůhledný obrys rámce. Označená zjednodušení (bez zkratek, po kontrole úrovně 1): krok 5 „ukazujeme jen začátek rámce a bity bajt po bajtu, jak se zapisují (karta je vysílá v jiném pořadí). Kontrolní číslo v patičce se nepočítá.“; krok 6 „signál na drátě není doslova 0 a 1 … Před rámcem jede ještě synchronizační úvod (preambule), ten nekreslíme. Animace je zpomalená.“
- **Rozbalení:** přijímač obálky sundává opačně: L2 první. Rozbalení L2 odstraní hlavičku i patičku („konec rámce“ zmizí spolu s hlavičkou). Sundaná obálka na okamžik zůstane vedle sloupce vrstvy (vyblednutá, 600 ms) s popiskem „hlavičku (a u L2 i patičku) přečetla vrstva L2 a odstranila“. Pořadí: rámec -> paket -> segment -> data. Blok „data“ u příjemce se už nesundává, jen se předá aplikaci.

## 4. Animace
Kroky jsou diskrétní (udělej-to-teď); animace jen vysvětluje přechod mezi kroky. Čas při rychlosti 1x:

| Co | Pohyb | Doba | Poznámka |
|---|---|---|---|
| Zapouzdření na vrstvě (jen L4, L3, L2) | nová obálka „narůstá“ kolem stávající (scale 0,92 -> 1 + fade), hlavička se vysune; u L2 přibude i konec rámce | 700 ms | zvýrazní se řádek vrstvy; průchod L7–L5 je jen posun zvýraznění (300 ms), bez obálky |
| Přechod mezi vrstvami v sloupci | zvýrazněný obrys sjede o řádek níž | 300 ms | |
| Převod na bity | rámec (hlavička, data, konec rámce) se „rozpadne“ na pruh čtverečků | 600 ms | |
| Přenos po kabelu | pruh bitů se posouvá po médiu mezi řádky L1 (u odpovědi zprava doleva) | 1500 ms | doba pevná kvůli čitelnosti, ne úměrná délce kabelu |
| Posun bloku k aktivní vrstvě („U“) | blok sjede / vyjede k nové vrstvě (jen transform) | 600 ms | při kroku vzad, skoku a omezení animací bez pohybu |
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
| `` ` `` nebo `F2` | terminál vybraného zařízení (úroveň 2+); `Esc` zavře okno |
| `1`..`5` (úroveň 2) | vybere pole v rentgenu podle čísla; `Enter` na portu = zapnout/vypnout tip |
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
- Kabel: plná čára 6 px `#14181C`; port/rozhraní popsané písmem (`Fa0/1`, `Gi0/0` od úrovně 3, rozhodnutí 40).
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
| 6 | Bity jedou po kabelu | pruh putuje po kabelu |
| 7 | Příjemce přijímá bity | bity se složí zpět do rámce |
| 8 | Sundávání obálek | tři dílčí kroky: L2 (hlavička i patička), L3, L4; indikátor „8a, 8b, 8c“ |
| 9 | Zpráva dorazí | blok „data“ u L7 příjemce |
| 10 | Přepnutí ISO/OSI a TCP/IP | jen sloupce a popisky (viz 2.3) |

Krok 8 se v čítači počítá jako jeden krok (podkroky se krokují šipkami a ukazují se jako 8a až 8c); posuvník má tedy 11 pozic.

## 10. Otevřené otázky
- Vyřešeno rozhodnutími: počet kroků úrovně 1 (0–10, rozhodnutí 3), obálky L5 a L6 se nekreslí (rozhodnutí 1).
- Zda podkroky 8a–8c počítat do čítače zvlášť (návrh: ne, viz 9); potvrdí vývojář a didaktik.
- Skutečný test barev na školním projektoru: pilot v semináři.

## 11. Úroveň 2: Adresy

Prototyp `prototypes/uroven2.html` (stav: krok 6 z 12, SW1 floodoval první rámec, rentgen ukazuje Ethernet hlavičku). Snímky:
`prototypes/uroven2.png` (1400x900), `prototypes/uroven2-720.png` (1280x720), varianty `uroven2-predikce.png`, `uroven2-terminal-windows.png`, `uroven2-terminal-cisco-720.png`.
Stavy prototypu se přepínají v URL: `#s=flood|pred|drop` a `#t=win|cisco`. Čísla kroků v prototypu (6 z 12) jsou ilustrační, pořadí podle scénáře úrovně 2.
Scénář: Alice (PC A, `192.168.1.10`, MAC `02:00:00:00:00:01`) posílá UDP zprávu „Ahoj, Bobe!“ Bobovi (`.20`, `...:02`); třetí je Cyril (`.30`, `...:03`); porty 49152 -> 5000. Konvence adres (rozhodnutí 13, 14, 15).

### 11.1 Topologie se 3 PC a switchem; výtah jen pro dvojici
- **Plocha topologie** je na úrovni 2 vyšší (300 px při 900 px výšky okna, 256 px při 720), výtah pod ní zůstává (428 px / 300 px). Zbytek rozvržení kap. 1 se nemění.
- **Hvězda:** Alice vlevo, SW1 uprostřed, Bob a Cyril vpravo pod sebou. Kabely jsou vodorovné (porty switche jsou ve stejné výšce jako PC), takže se nekříží a po kabelu se dá kreslit rámec. Pod ikonou PC jméno, IP (mono) a stavová „pilulka“ s textem a symbolem (odesílatel, rámec přichází, přijal s fajfkou, zahodil s křížkem v kruhu); nikdy jen barva.
- **Výtah je vždy jen pro jednu dvojici odesílatel -> příjemce.** Sloupce vrstev mají jen tato dvě PC (hlavička „Alice, odesílatel“ / „Bob, příjemce“), uprostřed rámec Alice -> Bob. Dvojice ve výtahu má v topologii dvojitý obrys (vysvětlí popisek „dvojitý obrys = dvojice ve výtahu“). Změna dvojice: klik na jiné PC jako odesílatele (Shift+klik jako příjemce) nebo výběr ve scénáři. Cyril, který není ve dvojici, nemá sloupec; co s rámcem udělá, ukazuje jeho pilulka a rentgen (po kliknutí na Cyrila se výtah přepne na dvojici Alice -> Cyril a ukáže jeho L2 jako „zahazuje“). Proč ne tři sloupce: 3 x 7 řádků se nevejdou ani při 900 px a odvádějí pozornost od zapouzdření.
- **Co je ve výtahu při průchodu switchem:** jen obálka L2 s adresami; obsah rámce zůstane zavřený („uvnitř paket … SW1 ho neotevírá“). Switch nemá sloupec 7 vrstev, protože čte jen L2; v pruhu média dole stojí jako věžička L1–L2, hub jen L1 (rozhodnutí 38, kap. 1).
- **Switch (karta SW1 uprostřed topologie):** hlavička (ikona, název, „switch, čte jen L1-L2“), **mini sloupec vrstev jen se dvěma řádky L2 Linková a L1 Fyzická** (stejné barvy a značky jako ve výtahu; aktivní řádek má dvojitý obrys) a pod ním MAC tabulka (11.2). Řádek L3 a výš ve switchi není, proto je jasné, že IP adresu ani port nečte. Výtah v titulku prostředního sloupce říká „SW1 čte pole 1 a 2“ (čísla polí sedí na štítek obálky a rentgen, 11.3, 11.4).
- **Porty** jsou čtvercové štítky na okraji karty (`Fa0/1`, `Fa0/2`, `Fa0/3`, 16 px tučně) s druhým řádkem stavu: `vstup` (světlá výplň L2, rámec přišel), `ven` (silnější obrys, rámec odešel), u předpovědi `klik`. Stav se pozná textem a obrysem, ne barvou.
- **Bity na kabelu:** malý štítek „bity“ s šipkou ve směru jízdy v barvě L1 (po kabelu jedou bity, ne rámec: kontrola 38, M1; pod 1360 px šířky / 820 px výšky jen šipka). Kabel je zvýrazněný stejně jako pruh média dole; bity samotné jedou jen v pruhu média mezi řádky L1 (rozhodnutí 38). Kabel ke switchi: jeden štítek; po rozeslání jeden štítek na každém výstupním kabelu.
- **Flooding vs. cílené přeposlání** (rozlišení bez barvy):
  - flooding: rámec vstoupí na Fa0/1, switch ho „rozdělí“ (animace 400 ms: kopie vyjedou současně) na všechny ostatní porty; vedle karty text „neznámá cíl. MAC -> flooding“, na kabelech výstupních portů štítky „rámec“; každý výstup má vlastní koncové PC se stavem;
  - cílené přeposlání: štítek „rámec“ je jen na jednom výstupním kabelu, ostatní kabely jsou prázdné a jejich port má stav `-` (bez šipky) s textem „nic neposlal“;
  - switch nikdy neposílá zpět na příchozí port: port `vstup` se při předpovědi nedá vybrat (tečkovaný obrys).
  - Hub (úroveň 2 přepínač hub/switch): karta bez MAC tabulky a bez mini sloupce L2; mini sloupec má jen L1 Fyzická a text „opakuje bity na všechny porty“; flooding je u něj vždy.
- **Cyril zahazuje rámec:** na jeho kabelu rámec dojede, v jeho pilulce „zahodil“ (křížek v kruhu), 700 ms po dojezdu štítek rámce vybledne a nad Cyrilem se na chvíli ukáže „cílová MAC není moje (…:02), zahazuji“. Ve výtahu dvojice Alice -> Cyril je totéž ve sloupci Cyril: řádek L2 s křížkem a textem místo předávání výš. Bob rámec „přijal“ (fajfka), pak vystoupí zbytek jeho výtahu.
- Při výšce okna do 820 px se v řádcích výtahu skryje druhý řádek „kdo se stará“ (síťová karta, OS) a zobrazí se po najetí/kliknutí na řádek.

### 11.2 MAC tabulka switche
- Tabulka je **živá část karty SW1** (ne popup): záhlaví „MAC tabulka SW1“ (tmavý pruh), sloupce MAC adresa a Port, řádek na záznam, 15 px mono. Seřazeno podle času přidání. Kapacita: 4 řádky, víc se rolují.
- **Nový záznam:** tučný 4 px černý obrys řádku, světlá výplň L2 a štítek **„nový“** (text, ne jen zvýraznění). Zvýraznění trvá do konce kroku a při krokování zpět zmizí spolu se záznamem. Aktualizace portu (host se přestěhoval) má štítek „změna“.
- **Hledání cíle:** pod záznamy je řádek s čárkovanou horní čarou „…:02 ?“ (hledaná cílová MAC). Pokud ji tabulka zná, v řádku je port a štítek „nalezeno“, jinak „?“ a text vysvětlivky „v tabulce není -> flooding“. Pořadí kroků: 1. rámec přijde na Fa0/1, 2. učení (zdrojová MAC), 3. hledání cíle, 4. rozeslání/přeposlání. Každý má vlastní krok s tím, co se v tabulce zvýrazní.
- Spojení s rentgenem: v kroku učení se zdrojová MAC (pole 2) v rentgenu i ve štítku obálky zvýrazní stejným obrysem jako řádek tabulky; v kroku hledání pole 1.
- `Stárnutí` (300 s) se v úrovni 2 nekreslí (označit zjednodušení v dalším kroku scénáře); úroveň 3 přidá sloupec stáří.
- Terminál `show mac address-table` (11.5) vypíše týž obsah ve formátu Cisco (`0200.0000.0001`), student ho má porovnat s tabulkou.

### 11.3 Štítky obálek s adresami
- Každá obálka (L2, L3, L4) má pod páskem „L? Vrstva / PDU“ **dvě bílé buňky vedle sebe**: zdroj, cíl. V každé buňce je nahoře popisek 15 px („zdroj MAC (Alice)“, „cíl MAC (Bob)“; L3 „zdroj IP“, „cíl IP“; L4 „zdrojový port“, „cílový port“) a pod ním hodnota mono 16 px. Obrys buňky má sytou barvu vrstvy, text je černý.
- **Čitelnost MAC:** 17 znaků je dlouhých, proto je **poslední bajt tučně a černě, ostatní bajty tlumeně** (`02:00:00:00:00:`**`02`**). Studenti pak rozlišují hosty podle posledního bajtu a nemusí číst celé. Totéž u IP (poslední oktet tučně), porty celé tučně. GUI vždy píše MAC s dvojtečkami; terminály mají vlastní formát (Windows pomlčky, Cisco tečky po 4 znacích, viz 11.5) a rozdíl se vysvětlí u terminálu, ne ve štítku.
- Při výšce okna do 820 px (1280x720) se popisky skryjí a mezi buňky se vloží šipka `->`: „02:..:01 -> 02:..:02“; v obou rozvrženích je zdroj vlevo.
- **Číslo pole:** v pravém horním rohu buňky je černý čtvereček s číslem pole podle rentgenu (1 cílová MAC, 2 zdrojová MAC; v rentgenu 3 EtherType atd.). Štítek ukazuje pořadí „zdroj, cíl“ kvůli čtení zleva doprava, rentgen skutečné pořadí rámce (cíl první); rozdíl je napsán pod rentgenem a čísla polí propojují obě místa.
- **Vybrané pole** (kliknuté v rentgenu nebo ve štítku) má 3 px černý obrys (`outline`), v rentgenu stejný obrys řádku.
- Do štítku se nikdy nepíše „odesílatel / příjemce“. Ve štítku L2 jsou jména v závorce jen pro čtenáře („Alice“, „Bob“); jsou to jména zařízení, ne role.
- Obálky mají v tomto rozvržení výšku podle obsahu; L5 a L6 se nekreslí (rozhodnutí 1). U úrovně 2 je blok „data“ označen „L7 data (obsah zprávy)“.

### 11.4 Rentgen
- Pravý sloupec: nahoře vysvětlivka (kap. 1), pod ní karta **„Rentgen: rámec L2 (Ethernet II)“**. Šířka sloupce 420 px (380 px pod 1360 px) kvůli hexdumpu. Karta nahrazuje „Detail“ z úrovně 1; v ní jsou:
  1. **Záložky obálek** (rámec L2, paket L3, segment L4) se značkou vrstvy a barvou vrstvy; aktivní má plnou barvu a bílý text. Klik na obálku ve výtahu nebo klávesa `R` vybere záložku. Rentgen paketu a segmentu má stejnou stavbu (pole IPv4, UDP podle `docs/spec`).
  2. **Tabulka polí v pořadí v rámci:** číslo (černý čtvereček), pole, velikost v bajtech (u příznaků a bitů se doplní sloupec bitů), hodnota (mono). Pole, která čte aktuálně aktivní zařízení (switch: pole 1 a 2), mají **tlustou svislou čáru vlevo** a v legendě je napsáno „Silná čára vlevo = pole, které čte switch“ (text, ne jen barva). Vybraný řádek: světlá výplň vrstvy, černý obrys 3 px.
  3. **Hexdump:** 8 bajtů na řádek (ne 16, kvůli šířce), offset vlevo; zobrazí se začátek (hlavička), „… data rámce = paket L3“, konec (data, výplň, FCS) – ostatní se sbalí. Bajty vybraného pole: sytá barva vrstvy, bílý tučný text, 3 px spodní čára; ostatní bajty hlavičky L2: světlá výplň a hnědá spodní čára; obsah paketu (L3): světlá zelená a zelená čára; výplň: šedá s tečkovanou čárou; FCS: dvojitá čára a „--“ (nepočítá se, zjednodušení). Odlišení je i tvarem čáry (plná, tečkovaná, dvojitá), ne jen barvou. Bajty se nepřepisují na ASCII (zjednodušení).
  4. **Vysvětlení vybraného pole** pod hexdumpem, 1-2 věty: „1 Cílová MAC: komu je rámec určen na tomto kabelu. Podle ní SW1 vybírá port; je v rámci první.“ Pod ním poznámka o pořadí (11.3).
- **Propojení pole a bajtů:** najetí myší na řádek tabulky, na bajty v hexdumpu nebo na buňku štítku zvýrazní **totéž pole na všech třech místech** (řádek tabulky, bajty, buňka štítku). Kliknutí pole zafixuje; `1`..`5` vybere pole z klávesnice; `Esc` zruší výběr. Nepoužívá se spojovací čára přes celou obrazovku (zbytečně křižuje výtah); propojení nese číslo pole a shodný obrys.
- **Zvýraznění důležitých polí:** pole, na kterých podle scénáře záleží (cílová MAC při hledání v tabulce switche, zdrojová MAC při učení; na L3 TTL a IP adresy; na L4 porty), se při příslušném kroku vyberou automaticky a vysvětlivka na ně odkáže číslem („pole 2“).
- **Rozměry:** na výšce 720 px zmizí legenda i řádek „… data“ v hexdumpu, tabulka má řádek 26 px.

### 11.5 Terminál
- **Otevření:** klik na PC nebo switch v topologii (nebo `F2`) vybere zařízení; **tlačítko „Terminál“** se objeví v jeho kartě a otevře **okno nad výtahem** přes celou šířku levého sloupce. Topologie nad ním zůstává vidět, aby šlo hned sledovat účinek příkazů (živá MAC tabulka). Pravý panel zůstává. Zavření: tlačítko „Zavřít Esc“ v záhlaví a klávesa `Esc`; přehrávání se otevřením neruší (krokování ovládacími tlačítky funguje dál, klávesy ne, dokud je kurzor v okně).
- **Společné:** monospace systémový font 18 px (16 px při výšce do 820 px), kurzor viditelný, 4 px černý rámeček okna, záhlaví 44 px se jménem zařízení, štítkem druhu terminálu (text) a tlačítkem Zavřít. Terminál si zachová historii příkazů zařízení po dobu scénáře; šipka nahoru jako v shellu.
- **Windows (PC):** pozadí `#0C0C0C`, text `#CCCCCC` (kontrast 12,6), prompt `C:\Users\Alice>` bíle, kurzor podtržítko, záhlaví světle šedé `#E4E6E9` s tmavým textem a štítkem „Windows“. Příkazy úrovně 2: `ipconfig /all` (Physical Address s pomlčkami `02-00-00-00-00-01`), `arp -a`. Hlášky anglicky podle rozhodnutí 10 s českou poznámkou simulátoru pod výpisem.
- **Cisco IOS (switch):** pozadí námořnická modř `#081F33`, text `#E6F4EA` (kontrast 15), prompt `SW1#` žlutě (`#FFE9A8`), kurzor plný blok, záhlaví `#0F3A5C` s bílým textem a štítkem „Cisco IOS“. Příkazy úrovně 2: `show mac address-table` (formát `0200.0000.0001`, Type DYNAMIC, Ports Fa0/1). Stejné okno je pro hub nedostupné (hub nemá konzoli).
- **Odlišení bez kopírování grafiky:** liší se barva pozadí, prompt, tvar kurzoru, zápis MAC a textový štítek druhu; žádná loga ani prvky oken Windows nebo Cisco. Zvýrazněná hodnota (MAC adresa, na kterou se ptáme) má obrácené barvy.
- **Projektor:** tmavé okno je v jinak světlém UI nejtmavší plocha; v nastavení volba „Světlý terminál“ (černý text na bílé, stejné zalamování).

### 11.6 Předpověď studenta „na který port switch pošle rámec?“
- Kdy: po kroku, kdy rámec dorazil na Fa0/1 a switch se naučil zdrojovou MAC, před krokem „hledání cíle“. Vysvětlivka změní titulek na „Předpověz: kam SW1 rámec pošle?“, ovládání Vpřed zůstává (předpověď lze přeskočit šipkou vpravo).
- **Interakce:** porty `Fa0/2` a `Fa0/3` mají čárkovaný obrys a text `klik`; klik (nebo Enter na portu zaostřeném Tabem) zapne/vypne **tip**: port dostane silný obrys, černý štítek „tip“ nad okrajem a vnější kroužek. Víc portů je možné (flooding). Port `Fa0/1` (příchozí) není volitelný (tečkovaný obrys, text „vstup“). Potvrzení: `Enter` nebo tlačítko Vpřed s popiskem „Potvrdit tip“ (kontrola se spustí až po potvrzení).
- **Vyhodnocení** po rozeslání: vysvětlivka ukáže jedním řádkem „Tvůj tip: Fa0/2. Skutečnost: Fa0/2 i Fa0/3.“ Porty s tipem si ponechají štítek „tip“ vedle stavu `ven`; port, který student neoznačil a switch ho použil, žádný štítek nemá (rozdíl je vidět i v textu řádku). Neúspěch nehodnotíme červeně ani bodem; je to otázka k přemýšlení. Pro učitele: počet správných tipů se vypisuje v pravém panelu „Kontrolní otázky“.
- Totéž později: u cíleného přeposlání (Bob už v tabulce) se otázka opakuje a správný tip je jediný port.

### 11.7 Co se mění ve stávajících částech
- **Plocha topologie** (kap. 1): v úrovni 1 přibude jen kabel; od úrovně 2 hvězda a karta switche. Kreslení rámce je stejné (kap. 3, 4); přibyla jedna animace: rozdělení rámce ve switchi (400 ms, `transform`+`opacity`), při 0,25x až 4x se násobí stejně. Reduced motion: místo rozdělení se jen krátce zvýrazní porty `ven`.
- **Barvy:** nic nové; MAC tabulka a terminály používají jen neutrální barvy a L2 (světlá), čísla polí jsou černá.
- **Ikony** (kap. 7): switch je v topologii jako karta s ikonou 42x36 px. Značka nejvyšší vrstvy (L2) je mini řádek v kartě.
- **Rozvržení při menší výšce** (do 820 px): topologie 256 px, výtah 300 px, řádky vrstev 33 px bez řádku „kdo se stará“, štítek obálky v jednom řádku se šipkou. Minimální písmo zůstává 15 px.

### 11.8 Otevřené otázky úrovně 2
- Počet kroků a jejich pořadí určí scénář didaktika (kap. 11 má jen ilustrativní krok 6 z 12).
- Zda má Shift+klik pro volbu příjemce stačit, nebo přidat výběr dvojice rozbalovacím seznamem (pro dotykový projektor).
- Jméno zařízení vs. role: ve scénáři zůstávají Alice, Bob, Cyril; kontrola s didaktikem (didaktika.md kap. úroveň 2).
- Hub vs. switch: přepínač v topologii (jedna karta se jménem „SW1“ / „HUB1“) a vlastní návrh karty hubu (jen L1) se dopracuje spolu se scénářem.
- Test čitelnosti MAC (tučný poslední bajt) na školním projektoru: pilot.

## 12. Úroveň 3: Směrování
Prototyp: `prototypes/uroven3.html`, stavy přes adresu `#s=router|pred|arp|ping|tracert|lpm` a terminál `&t=win|cisco`.
Snímky 1400x900 a 1280x720 jsou v `tmp/u3/` (`<stav>_900.png`, `<stav>_720.png`, `term-win_*`, `term-cisco_*`), hlavní stav `prototypes/uroven3.png` a `prototypes/uroven3-720.png`.
Platí kap. 1–11 (paleta, rozh. 31, 37, 38). Nic z toho se nemění, přibývá router, druhá síť a tři druhy zpráv (ARP, ICMP, data).
V textu pro studenty se nepoužívá „výtah“ ani „prostředník“ (rozh. 37); spodní panel se jmenuje „Vrstvy“.

### 12.1 Rozvržení
Stejná mřížka jako úroveň 2 (topologie nahoře, vrstvy dole, vysvětlivka + karta vpravo, ovládání dole). Změny:
- **Topologie je vyšší** (316 px při 900, 244 px při 720) a má tři části zleva doprava: síť 1 (Alice, SW1), karta R1, síť 2 (Bob).
- **Sloupce vrstev jsou užší** (192 px, při šířce do 1360 px 170 px), protože uprostřed je věž routeru. Popisek řádku je dvouřádkový: název vrstvy a pod ním název PDU (data, datagram, paket, rámec, bity); při 720 px je to 36 px na řádek, písmo 15–16 px.
- **Pravý spodní panel** je podle kroku: „Rámec před a za R1“ (porovnání), „Shoda po bitech“ (nejdelší shoda), rentgen (ARP, ICMP) nebo „Sondy“ (tracert).
- **Spodní panel vlevo má přepínač „Vrstvy | Časová osa“.** Časová osa (sekvenční diagram) se otevře sama u tracertu; u ostatních kroků jde zapnout ručně. Důvod: tracert je o pořadí zpráv v čase, ne o vrstvách jednoho zařízení.

### 12.2 Dvě sítě v topologii
- Každá síť je **podbarvená oblast s přerušovaným okrajem a štítkem** „SÍŤ 192.168.1.0/24 (brána .1)“ a „SÍŤ 192.168.2.0/24“. Barva oblastí je neutrální (světle šedomodrá, světle hnědošedá), aby se nepletla s barvami vrstev; sítě se odliší i **šrafováním** a textem štítku, ne jen odstínem.
- Router R1 stojí **mezi oblastmi** jako karta, která oblasti překrývá o pár pixelů: „je v obou sítích“. Rozhraní jsou v hlavičce karty: vlevo Fa0/0 s 192.168.1.1 (patří do sítě 1), vpravo Fa0/1 s 192.168.2.1 (síť 2). Štítek „vstup“ / „výstup“ u rozhraní (text, ne jen barva).
- Zařízení v topologii ukazují jméno a IP; MAC se v topologii nekreslí (nevešla by se, je ve vrstvách a v kartě porovnání).
- Aktivní kabel je tlustší a nese štítek rámce; pod ním jeho **TTL** (`TTL 127`) mono písmem.

### 12.3 Tvar U s routerem (rozh. 38)
Pruh média dole se vším, co leží v cestě: u switche věž do L2, u routeru **věž do L3** (L1, L2, L3 nad sebou, aktivní řádek je horní). Obálka (paket) stojí nad věží a její spodní hrana končí u aktivního řádku, stejně jako u switche.
- **Vlevo od věže R1 šipka nahoru, vpravo šipka dolů.** Tím se vidí „U s odbočkou“: rámec vystoupá L1 → L2 → L3, router rozhodne, nový rámec klesne L3 → L2 → L1.
- Vlevo u šipky štítek **„starý rámec“** (přerušovaný okraj = už rozbalen, zahozen), vpravo **„nový rámec“** (plný, tlustší okraj). Nad věží paket, který jimi prošel.
- Šipka nahoru a dolů jsou dvě stejné značky, ne animace; při přehrávání po nich putuje bod jako po kabelu (rychlost podle posuvníku, jde krokovat).
- Před věží stojí malá věž SW1 (L2) v přerušovaném stylu = už je za námi.
- Zasekne-li se animace na kroku (pauza), stav musí jít přečíst ze statického obrázku: proto jsou „starý“ a „nový“ rozlišeny tvarem okraje, ne pohybem.

### 12.4 „MAC se změnila, IP zůstala“
Karta **„Rámec před a za R1“** (pravý panel, 380–420 px) má dvě skupiny polí, každá v barvě své vrstvy (obálka L2 = hnědá, L3 = zelená, značka vrstvy vlevo nahoře):
- **L2 rámec („platí jen na jednom kabelu“)**: cílová MAC, zdrojová MAC. Hodnota před (síť 1) → hodnota za (síť 2).
- **L3 paket („platí na celé cestě“)**: zdrojová IP, cílová IP, TTL.
- Změněné pole: tlustý černý obrys buňky + černý štítek **„jiná“** (u TTL „−1“). Nezměněné: běžný obrys + štítek **„stejná“ s fajfkou** (symbol z SVG, ne emoji). Nic jen barvou: text, tvar štítku a tloušťka obrysu.
- Pod tím věta tučně: **„MAC se změnila, IP zůstala.“** a drobně přesnost: „V IP hlavičce se mění jen TTL (a s ním kontrolní součet hlavičky).“
- Za MAC je v závorce, komu patří („R1 Fa0/0 → Bob“), protože cílová MAC před R1 je MAC brány, ne Boba (rozh. 15: štítek je vždy „zdroj → cíl“ na tomto kabelu).
- Totéž je vidět i ve středu: paket nad věží má vlevo „starý rámec“ a vpravo „nový rámec“; kliknutí na štítek otevře rentgen toho rámce (kap. 11.4).
- Navržené MAC rozhraní R1: Fa0/0 `02:00:00:00:00:11`, Fa0/1 `02:00:00:00:00:12` (konvence z rozh. 25 zůstává, poslední bajt tučně).

### 12.5 Karta routeru, směrovací tabulka, TTL
- **Hlavička karty:** ikona R1 (kruh se čtyřmi šipkami, jiný tvar než switch), rozhraní vlevo a vpravo.
- **Směrovací tabulka R1:** sloupce Typ (C = připojená síť, S = ruční trasa, S* = výchozí trasa), Síť (cíl) s prefixem, Kam (rozhraní), Shoda. Sloupec **Shoda** se objeví až v kroku, kdy R1 vybírá (u tipu je schovaný, kap. 12.9). Hodnoty: „ne“, „24 bitů“.
- **Vybraný řádek:** tlustý černý obrys + světle zelená výplň + černý štítek „24 bitů“ ve sloupci Shoda; ostatní řádky bez zvýraznění.
- **Nejdelší shoda (LPM)** je samostatný detailní krok (`#s=lpm`): tabulka má víc řádků, které se shodují (192.168.2.0/24, 192.168.0.0/16, 0.0.0.0/0), a v pravém panelu karta **„Shoda po bitech“**: cíl ve dvojkové soustavě a pod ním každý prefix, **podbarvené shodné bity** + podtržení a štítek „24 bitů: vítěz“ / „16 bitů“ / „0 bitů“ / „ne: shoda jen 22 z 24“. Podbarvení se opírá o text s číslem, ne jen o barvu. Základní tabulka (2 řádky) zůstává; řádky S a S* se přidávají až scénářem (prototyp je ukazuje jako ukázku).
- **ARP tabulka R1** pod směrovací; nový řádek má obrys a štítek „nový řádek“ v záhlaví tabulky.
- **TTL** je vidět na třech místech: ve štítku paketu nad věží (`TTL 128 → 127`, přeškrtnutá stará hodnota, černý štítek „−1“ a věta „R1 sníží TTL o 1“), pod aktivním kabelem v topologii a v kartě porovnání. TTL se snižuje právě v kroku, kdy paket stojí v L3 routeru (ne dřív, ne později).
- Výchozí TTL ukázky je 128 (Windows), takže ping po jednom skoku ukáže `TTL=127`, shodně s výstupem příkazu ping.

### 12.6 ARP: dotaz všem, odpověď jednomu (`#s=arp`)
ARP je **služební zpráva**, ne zpráva uživatele: odliší se čtyřmi věcmi.
1. Štítek na kabelu je **„ARP“** (ne „rámec“), pod kabelem popisek **„všem“** (u odpovědi „jen Alici“). U dotazu se štítek zkopíruje na všechny výstupní kabely (rozeslání), u odpovědi je jen jeden.
2. Obálka L2 má **tečkovaný vnitřek** místo zelené obálky L3: uvnitř rámce je bílý blok „ARP dotaz: kdo má 192.168.1.1?“ s textem „bez IP paketu: ARP jede přímo v rámci“. Obálka L3 se tedy nekreslí.
3. Cílová MAC `FF:FF:FF:FF:FF:FF` má černý štítek **„všem“** (broadcast); u odpovědi je cílová MAC konkrétní a štítek chybí.
4. Ve sloupci vrstev odesílatele je L3 se dvěma řádky „paket / čeká na MAC“: vidět, že paket čeká, než se zeptá ARP. Na straně příjemce (R1) jsou L4–L7 „router nečte“.
Rentgen ARP dotazu: pole rámce (cíl, zdroj, EtherType 0x0806) a pole ARP zprávy (Operace 1 = dotaz, Odesílatel IP/MAC, Hledá IP, Hledaná MAC = nuly „neznámá“, přerušovaný řádek). Poznámka „odpověď půjde unicastem“.
Do ARP tabulky R1 přibude řádek v okamžiku příjmu dotazu (R1 se naučí Alici ze zdroje dotazu).

### 12.7 Ping: ICMP bez L4 (`#s=ping`)
- Na zdroji se ve sloupci vrstev **řádek L4 přeskočí**: tečkovaný okraj, šrafování, text „bez portů“ (ne jen barva). Paket vzniká v L3.
- Uvnitř zeleného rámu paketu je **přerušovaný pruh „L4: žádný segment, ICMP nemá porty“** s ikonou L4 a pod ním blok „ICMP Echo request (typ 8) přímo uvnitř IP paketu“. Obálka L4 (modrá) se nekreslí, ICMP je zde součást paketu.
- Ve štítku paketu je vedle TTL i **„protokol 1“** (pole IP hlavičky, které říká „uvnitř je ICMP“).
- Rentgen: skupina „L3 IPv4 hlavička“ (TTL, Protokol zvýrazněn, zdrojová a cílová IP) a skupina „ICMP (uvnitř paketu)“ (Typ 8 = Echo request, Identifikátor, pořadí) a **přerušovaný řádek „Zdrojový a cílový port: žádné, ICMP je nemá“**. Studenti uvidí prázdné místo tam, kde u UDP byly porty.
- Echo reply je stejný vzhled s Typem 0 a prohozenými adresami.

### 12.8 Tracert: sondy a Time Exceeded (`#s=tracert`)
Použije se **časová osa** (SVG sekvenční diagram, tři svislé osy Alice, R1, Bob, čas shora dolů, viewBox 880x276, vejde se bez posunu při 720 px).
- Každý skok je **blok „sonda n“**: šipka Echo request vpravo, černý štítek **TTL n** pod začátkem šipky. U R1 je rámeček s tvarem: **křížek „TTL 1 → 0: zahodit“** nebo **šipka „TTL 2 → 1: přeposlat“**. Tvar rozlišuje, nejen text.
- **Time Exceeded** je šipka zpět vlevo, tučný zelený popisek „Time Exceeded (typ 11)“ a pod ní drobně „odpověď od 192.168.1.1: tak se R1 prozradil“. Echo reply od cíle je stejná šipka zpět s popiskem „Echo reply“.
- Odpovědi se **kreslí postupně** (nepřítomná = ještě se nestala), ne jako přerušované čáry (přerušované = „čeká“ podle kap. 2.2, nepoužije se na odpovědi). Aktuální šipka je tlustší s černým obrysem a štítkem „teď“.
- Při více routerech přibývají osy (max. 4 uzly na šířku), sondy dalšího skoku jdou pod sebe; pokud se nevejdou, diagram se posouvá svisle, aktuální řádek zůstane vidět.
- Vpravo karta **„Sondy“**: řádky #, TTL, Odpověděl (IP a jméno), Zpráva (Time Exceeded (typ 11) / Echo reply (typ 0)); aktuální řádek má obrys. Poznámka: „Windows pošle na každý skok 3 sondy; simulátor kreslí první, výpis v terminálu má všechny tři.“ (Simulátor zjednodušuje.)
- Topologie nahoře dál ukazuje, kde sonda právě je (štítek „rámec“ + `TTL 2` pod kabelem).

### 12.9 Tipy (rozh. 31) na úrovni 3 (`#s=pred`)
Krok před rozhodnutím routeru ukazuje stav PŘED událostí: paket je v L3 routeru, **TTL zůstává 128**, směrovací tabulka **bez sloupce Shoda a bez zvýraznění**, pravý panel jen „Rámec, který dorazil k R1“ (jedna hodnota, ne dvojice před/za), žádný „nový rámec“, ARP tabulka R1 ještě nemá Boba.
Nadpis karty „Tip: Co R1 s paketem udělá?“, volby **Fa0/0 zpět, Fa0/1, zahodí** (odvozené z topologie; vstupní rozhraní se nabízí jako „zpět“, protože ta chyba je typická; „zahodí“ = nemá trasu). Rozhraní Fa0/1 v kartě R1 je přerušované a nese „klik“; vstupní Fa0/0 je zamčené „vstup“. Přehrávání se zastaví. Další krok vyhodnotí tip jednou větou („Tvůj tip: Fa0/1. Skutečnost: Fa0/1. Souhlasí.“).

### 12.10 Terminál
- **Windows (PC Alice):** `tracert 192.168.2.20` s výstupem se třemi časy na řádek (`<1 ms`), řádek „Trace complete.“, hlavička „Tracing route to … over a maximum of 30 hops:“; také `ping`, `arp -a`, `ipconfig /all` (ipconfig tentokrát s Default Gateway 192.168.1.1, rozh. 27).
- **IOS (R1):** `show ip route` s kódy „C - connected, S - static (zkráceno)“, řádek „Gateway of last resort“ a řádky tras; řádek, který právě vybral R1, je v terminálu **podbarven světle** a v textu vypsán celý. Dále `show ip arp`, `show ip interface brief`.
- Stejný vzhled okna jako úroveň 2 (kap. 11.5): Windows tmavá s bílým textem, IOS tmavě modrá; záhlaví s druhem („Windows“ / „Cisco IOS“) a tlačítkem Zavřít (Esc). Monospace min. 16 px při 720 px, 18 px při 900.
- Řádek `L` (local) z reálného IOS se v simulátoru nevypisuje: „Simulátor zjednodušuje: bez řádků typu L.“

### 12.11 Čitelnost a rozměry
Ověřeno snímky 1400x900 a 1280x720: nic se nepřekrývá, nic neuniká z okna (tělo stránky má `grid-template-columns:minmax(0,1fr)`, protože bez toho se širší obsah promítl za okraj okna). Při 720 px se skrývá: MAC u zařízení v topologii (vždy), podnadpisy sloupců vrstev, záhlaví sloupců a vysvětlující druhá věta v kartě porovnání. Nejmenší písmo 15 px, kromě šedých pomocných popisků všude tmavý text. Písmo MAC v kartě porovnání má mírně stažený řez (`letter-spacing:-.04em`), aby se 17 znaků vešlo do buňky na šířku 380 px; na Windows s Consolas je pohodlně.

### 12.12 Implementace (iterace 3, po opravách podle rozhodnutí 49–55): odchylky od návrhu
Platí rozhodnutí 39–55; prototyp je jen vizuální vzor. Rozhraní routeru jsou Gi0/0 a Gi0/1, MAC `02:00:00:00:01:01` a `…:01:02` (rozh. 39, 40); body 12.13.1 a 12.13.2 níže jsou tím rozhodnuté.
- **Topologie** má i Cyrila (síť 1: Alice nahoře, Cyril dole, SW1 s MAC tabulkou). U PC jméno, IP, MAC jako „MAC …:01“ (poslední bajt tučně, rozh. 35 a 53; při 720 px skrytá), výchozí brána a ARP tabulka (zkráceně `…1.1 → …01:01`). V krocích části D před diagnózou se brána Alice neukazuje (rozh. 51). Výška 316 px (900) a 264 px (720).
- **Směrovací tabulka R1** ukazuje i řádky L (cmd.md kap. 12.3; při 720 px skryté). Sloupec Shoda jen v kroku, kdy router vybírá. `show ip route` vypisuje i řádky L (návrh 12.10 „bez řádků L“ neplatí).
- **Věže v pruhu média** pro zařízení na cestě vybrané dvojice (Alice → Bob: SW1 a R1, Alice → Cyril: jen SW1); v kroku tipu 16 vždy obě zařízení (rozh. 51). Pod věží R1 jsou nohy Gi0/0 a Gi0/1. Blok sedí u aktivní vrstvy (rozh. 52); u odesílatele a příjemce může věže zakrýt, v routeru stojí nad věží (paket i rámec kompaktně). Krok 12 končí novým rámcem ve věži R1 se štítky „starý rámec“ / „nový rámec“.
- **Nadpis prostředního sloupce a popisek pod posuvníkem** ukazují skutečnou zprávu („ARP dotaz · Alice → všem“, rozh. 50).
- **Řádek L4 u pingu** (rozh. 47): šrafovaný, tečkovaný, štítek „bez portů“ na horním okraji (celé znění „ICMP nemá porty“ je v obálce a v rentgenu). U ARP jsou L3 a L4 jen neaktivní, bez štítku (D9). PDU ve sloupci vrstev je od rozhodnutí 49 obecně „segment“.
- **Pravý panel:** karta kroku (Maska, Rámec před a za R1, Tabulky po kroku, Sondy tracert, Shrnutí) a pod ní rentgen. Karta „Rámec před a za R1“ má hlavní větu nahoře a jedno pole na řádek, vejde se při 720 px. Sondy: jeden řádek = jeden skok, tři značky sond. Časová osa (12.8) a karta „Shoda po bitech“ se v iteraci 3 nedělají.
- **Tipy** 3, 5, 11, 13, 16, 18, 22a, 24a (rozh. 43, 51); volby ze scénáře se správnou odpovědí, kterou test ověřuje proti simulaci. Kroky 22 a 24: a = tip, b = vyhodnocení s tlačítkem „Oprav bránu“, c = po opravě.
- **Části A–D:** tlačítka s popiskem „Části:“ (nápověda v titulku) v hlavičce vysvětlivky. Ve vysvětlivce je pořadí: text, tip, výzva k terminálu, „Simulátor zjednodušuje“, poznámka, nápovědy (rozh. 54).
- Písmo 14 px jen v hustých tabulkách topologie a v rentgenu (rozh. 53); čipy TTL, štítky věží, jiná/stejná a pilulky 15 px.

### 12.13 Otevřené body k rozhodnutí (1–3 rozhodnuté: rozh. 39, 49)
1. **MAC rozhraní R1** (`…:11` a `…:12`): potvrdit s projektantem.
2. **Výchozí TTL 128** (Windows) místo 64: potvrdit s projektantem a didaktikem (sedí s výstupem ping `TTL=127`).
3. **Název PDU u L4** v řádku vrstvy: „datagram“ pro UDP, „segment“ pro TCP, „bez portů“ pro ICMP (úroveň 2 měla „segment / datagram“, v užším sloupci se nevejde). Dopad na rozh. 32.
4. **Tip na routeru** má tři volby včetně „zahodí“ a „zpět“: potvrdí didaktik.
5. **Řádky S a S*** v ukázkové tabulce jsou jen demonstrace nejdelší shody; obsah tabulky pro scénář určí didaktik (např. výchozí trasa až s úrovní 5).
6. **Přepínač „Vrstvy | Časová osa“**: v prototypu je jen vykreslený, ne funkční.

## 13. Ohnisko a role panelů (rozhodnutí 56, úrovně 1–3)

**Role panelů** rozliší barva záhlaví + ikona + slovo (ne jen barva). Barvy jsou neutrální a nepletou
se s paletou vrstev L1–L7 (tokeny `--role-*` v `css/app.css`):

| Panel | Záhlaví | Ikona | Slovo |
|---|---|---|---|
| Vysvětlivka | tmavý pruh (ink) s „Krok N z M“ | i | Krok |
| Tip / otázka | celá karta žlutá #FFE28A, pruh tmavě okrový #6B4E00 | ? | „Ptám se tebe: …“ |
| Rentgen | ocelově modrá #2F4A6B (ne L4 #1B5FAA, ne L1 #4A5A66) | lupa | „Rentgen: …“ |
| Terminál | černé (Windows), tmavě modré (Cisco IOS) | >_ | název okna (např. „Konzole: R1“) |
| Detail (úroveň 1) | světle šedé #E4E6E9 | i | Detail |

Kontrast textu: #14181C na žluté 14:1, bílá na #2F4A6B 9:1. Na kroku tipu se karta při kroku vpřed
jednou krátce zvětší a zakývá (0,5 s); při „Omezit animace“ / `prefers-reduced-motion` bez animace.
Tlačítko Vpřed říká „Potvrdit tip“, jakmile student něco vybral (bez výběru dál „Vpřed“: tip lze
přeskočit).

**Ohnisko kroku** (`js/ui/focus.js`, `stepFocus(step, view, {termOpen})`, bez DOM): `tip` | `rentgen` |
`topologie` | `vrstvy` | `terminal`. Výchozí pravidlo: krok tipu → tip; krok s vybraným polem rentgenu
(`xray.fields`) → rentgen; krok, kde se mění tabulka (záznam `mac_learn`, `arp_learn`) → topologie;
jinak vrstvy (blok). Scénář pravidlo přepíše polem `focus` u kroku (úroveň 3: kroky 2 a 15 s kartou
masky / ARP tabulek → `rentgen` = pravý dolní panel). Otevřený terminál překrývá sloupec vrstev, proto
ohnisko „vrstvy“ při otevřeném terminálu patří terminálu; `focus: 'terminal'` bez otevřeného okna
spadne na „vrstvy“.

Zobrazení (`applyFocus()` v `js/main.js`): panel ohniska dostane atribut `data-focus` → rámeček
4 px v barvě role (`outline`, nic neposune) a štítek „Sleduj tady“ (u karet v záhlaví nebo na vlastním
řádku, u topologie a vrstev na horní hraně rámu, nic nepřekryje). Ostatní panely mají `opacity: .82`
(šedý text #4B5563 si drží AA 4,5:1). Otevřený terminál se netlumí. Stav je i v
`<html data-step-focus>` (testy). Testy: `tests/ui/focus.test.js` (tip → tip, pole rentgenu → rentgen
ve všech krocích úrovní 1–3), `tests/browser/interact.html` (žlutá karta, rámeček, štítek, záhlaví na
jeden řádek, ztlumení při 1280×720).

**Odkazové čipy v textu kroku** (bod c, `js/ui/chips.js` bez DOM, obsluha v `js/main.js`). Text nebo
poznámka kroku ve scénáři smí obsahovat značku `{{druh:cíl|popisek}}`; vykreslí se jako tlačítko
„→ popisek“ v barvě role cíle:

| Značka | Barva čipu | Cíl (zvýrazní se) | Klik |
|---|---|---|---|
| `{{rentgen:ip.ttl\|TTL}}` | ocelově modrý rámeček | řádek pole v rentgenu (id pole z `wire/fields.js`), jinak celý panel | vybere pole a přepne záložku |
| `{{rentgen:mask\|…}}`, `arp`, `PC1.route` | ocelově modrý | karta v pravém panelu s `data-target` | ukáže kartu |
| `{{topo:SW1.mac\|MAC tabulka}}`, `R1.route`, `R1.arp`, `PC1.arp`, `SW1` | ink, tečkovaný rámeček | prvek topologie s `data-target` / uzel | posune k němu |
| `{{term:PC1\|terminál}}` (cíl smí chybět) | černý | otevřené okno terminálu, jinak karta uzlu | otevře terminál uzlu |

Najetí myší i fokus klávesnicí (čip je `<button>`, Tab + Enter) dá cíli přerušovaný rámeček 3 px
(`.chip-hl`, `outline`, nic neposune); odjetí ho zruší. Čip má `aria-label` „TTL: ukázat v rentgenu“ /
„…: ukázat v topologii“ / „…: otevřít terminál“, šipka je `aria-hidden`. Čipy jsou v úrovni 2 v krocích 4,
11, 15, v úrovni 3 v krocích 2, 9, 12, 13, 14, 15, 17, 19 (i v .md scénářů). Testy:
`tests/ui/chips.test.js` (syntaxe, HTML, každý čip míří na pole, které v kroku rentgen ukazuje, na
kartu, kterou krok zobrazí, na existující uzel a tabulku), `tests/browser/interact.html` (v každém
kroku s čipem: aria-label, zvýraznění při najetí, klik vybere pole / otevře terminál, cíl v DOM existuje).

**720p bez překryvů popisků** (měří `layoutCheck()` v `tests/browser/interact.html` při 1280×720):
štítek sítě 1 je nad středem sítě (ne nad Alicí, kde je štítek „odesílatel“), štítek „ARP“ má nad
tabulkou ARP vlastní místo (nepřekryje „brána …“), karty PC se nepřekrývají ani s legendou, řádek L4
„Transportní / segment“ se vejde do výšky řádku a přeskočená L4 (ICMP) má místo „segment“ text
„bez portů“. Role sloupce se v úzkém sloupci (úrovně 2 a 3 do 1360 px) a vedle štítku „Teď Bob“
zkrátí na „odesílatel ↓“ / „příjemce ↑“ místo oříznutí „zdola nah…“.
