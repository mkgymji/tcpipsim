# Modelové situace: zadání pro studenty a poznámky učitele

Pracovní návrh didaktika k rozh. 66–68. Texty ve zdroji jsou psané tak, aby šly přenést do simulátoru
(oslovení „ty“, odrážky, tučná klíčová slova, bloky do ~3 řádků; rozh. 67). Části označené **Pro učitele**
studentovi simulátor neukazuje.

Předpoklad: topologie z úrovní 3–4 (Alice 192.168.1.10/24, brána R1 192.168.1.1, SW1, Cyril, síť 2 se
SRV1 192.168.2.10 a jménem `www.skola.lan`, DNS server 192.168.2.10). Terminál: `ipconfig /all`, `ping`,
`tracert`, `nslookup`, `arp -a`, `netstat`; na SRV1 `ss -tuln`. Nastavení uzlu se dělá v dialogu
(IP, maska, brána, DNS), ne příkazem.

Společné pravidlo nápověd: **3 úrovně, každou si student otevře sám**, další je zamčená, dokud neotevře
předchozí. Otevření nápovědy se jen eviduje (bez trestu), vyhodnocení ho zmíní („použil jsi 2 nápovědy“).

---

## Pořadí a čas (45minutová hodina, dvojice u jednoho PC)

| Pořadí | Úloha | Čas | Poznámka |
|---|---|---|---|
| 1 | **4** Nastav Alici | 8 min | Rozběh: jen konfigurace, bez chyby. Ukáže, že čtyři údaje mají každý svou roli. |
| 2 | **1** Odpojený kabel | 5 min | Nejkratší, první „diagnostika“: kde začít (L1). |
| 3 | **5** Chybějící brána | 8 min | Navazuje na 4: stejná konfigurace, ale chybí jedna věc. |
| 4 | **7** IP mimo síť | 8 min | Dvojice 5 a 7 si ukáže rozdíl: „žádná brána“ × „špatná síť“. |
| 5 | **10** Web neodpovídá | 8 min | Poprvé problém nad L3. |
| | **Celkem** | **37 min** | Zbývá ~8 min na rozbor v plénu (viz „Co z toho plyne“ níže). |

- **Stihne se 5 úloh** (4, 1, 5, 7, 10), pokud dvojice neotvírá všechny nápovědy. Realisticky 4–5.
- **Domácí práce:** **11** Nastav DNS (krátká, navazuje na 4), **3** Konflikt IP (nejnáročnější, potřebuje
  čas na přemýšlení) a **13** Síť nejde jako závěrečná úloha. U 13 se každému losuje jiná chyba, takže se
  nedá opsat; doporučuji ji dát jako samostatnou práci a ke kontrole poslat výpis terminálu.
- Pokud je hodina zkrácená: 4, 1, 5, 7.
- **Návrh pořadí pro seminář 4. ročníku:** 4 → 1 → 5 → 7 (vždy přibývá jedna znalost) → 10 → doma 11, 3, 13.
  Úloha 11 a 4 jsou dvě verze téhož; 11 je krátká proto, že student už dialog nastavení umí.

---

## Úloha 4: Nastav Alici

**Zadání.**
- Alice přišla do školy a dostala nový počítač. Je zapojený do sítě, ale **nemá žádné nastavení**.
- Nastav jí IP adresu, masku, bránu a DNS server tak, aby otevřela `http://www.skola.lan`.

**Cíl (co musí fungovat).** Alice otevře `www.skola.lan` na SRV1. Správné hodnoty: 192.168.1.10, maska
255.255.255.0, brána 192.168.1.1, DNS 192.168.2.10. (Student je zjistí z plánku sítě v zadání a z toho, co
vidí na Cyrilovi; viz níže.)

**Výukový cíl a „aha“.**
- Každý ze čtyř údajů odpovídá na jednu otázku: **IP** = kdo jsem, **maska** = kdo je „u nás“,
  **brána** = kudy ven, **DNS** = jak z jména udělat adresu.
- Aha: když jeden údaj vynechá, vždy selže něco jiného (to si student zkusí vědomě v úloze 5 a 11).
- Vrstva: L3 (IP, maska, brána), L7 (DNS).

**Nápovědy.**
1. **Obecná:** Podívej se na Cyrila. Je ve stejné síti jako Alice. Které jeho údaje budou u Alice stejné a které jiné?
2. **Směr:** Maska a brána budou stejné jako u Cyrila. IP musí být ze stejné sítě, ale **jiná**. DNS server hledej tam, kde je web.
3. **Skoro řešení:** IP 192.168.1.*x* (x volné číslo, jen ne 1 a ne Cyrilovo), maska 255.255.255.0, brána 192.168.1.1, DNS 192.168.2.10.

**Co zkusit v terminálu (pořadí).**
1. Na Cyrilovi `ipconfig /all`: opiš si masku, bránu a DNS.
2. Nastav Alici (dialog), pak `ipconfig /all`: sedí hodnoty?
3. `ping 192.168.1.1`: dosáhne Alice na bránu?
4. `ping 192.168.2.10`: dosáhne na server (přes bránu)?
5. `nslookup www.skola.lan`: funguje DNS?
6. Otevři `http://www.skola.lan`.

**Vyhodnocení.**
- **Funguje:** „Alice má všechny čtyři údaje a stránka se otevřela. Každý údaj odpověděl na jinou otázku: **IP** (kdo jsem), **maska** (kdo je u nás), **brána** (kudy ven), **DNS** (jak najít server podle jména).“
- **IP stejná jako Cyrilova:** „Alice má stejnou IP jako Cyril. To je konflikt adres: v jedné síti musí být každá IP **jen jednou**. Zvol jinou.“ (Ukázka na úlohu 3.)
- **IP z jiné sítě (např. 192.168.2.10):** „IP adresa není z tvé sítě (192.168.1.0/24). Alice by si myslela, že je v síti 2.“ (Detail viz úloha 7.)
- **Špatná maska:** „Maska určuje, které adresy Alice považuje za sousedy. Porovnej ji s Cyrilovou.“
- **Chybí brána:** „Alice se dostane k Cyrilovi, ale ne ven. Chybí jí brána; viz úloha 5.“
- **Chybí DNS:** „`ping 192.168.2.10` funguje, jméno ne. Alice nezná DNS server; viz úloha 11.“

**Kontrolní otázka.** Který z těch čtyř údajů bys mohl vynechat, kdyby Alice chtěla jen poslat zprávu Cyrilovi
ve stejné síti? (Odpověď: bránu a DNS; stačí IP a maska. Navíc zprávu pošle po IP, jméno nepotřebuje.)

**Odhad času:** 8 min (dvojice), 10 min bez nápověd.

---

## Úloha 1: Odpojený kabel

**Zadání.**
- Alice ráno zapnula počítač a **nic nefunguje**: ani web, ani ping na Cyrila. Nastavení má podle všeho v pořádku.
- Zjisti, kde je problém, a oprav ho.

**Cíl.** Alice znovu dosáhne na bránu (`ping 192.168.1.1` projde) a otevře `www.skola.lan`.

**Výukový cíl a „aha“.**
- Aha: **než začneš zkoumat IP a DNS, ověř, jestli je vůbec připojený kabel.** Nahoře nic nepomůže, když dole nejde signál.
- Vrstva: **L1** (médium, kabel).
- Terminál ukáže `Media disconnected`, ne chybu adresy: počítač o síti vůbec neví.

**Nápovědy.**
1. **Obecná:** Pomůže tahle chyba zkoumat adresy? Vrať se k tomu, na jaké vrstvě mohl problém vzniknout; projdi vrstvy zdola.
2. **Směr:** Začni `ipconfig` na Alici. Co píše u síťového rozhraní místo IP adresy?
3. **Skoro řešení:** Rozhraní hlásí `Media disconnected`. Podívej se v topologii na kabel mezi Alicí a přepínačem SW1 a zapoj ho.

**Co zkusit v terminálu.**
1. `ipconfig` na Alici: vidíš `Media disconnected` (nebo prázdné nastavení)?
2. `ping 192.168.1.1`: neprojde.
3. V topologii najdi přerušený kabel, klikni, zapoj.
4. `ipconfig` znovu: rozhraní má zase IP.
5. `ping 192.168.1.1`, pak web.

**Vyhodnocení.**
- **Funguje:** „Kabel byl odpojený: **L1 (fyzická vrstva)**. Příznak byl `Media disconnected`. Jakmile není signál, počítač nemá s čím pracovat; adresy ani DNS nedostanou šanci.“
- **Student začal měnit IP / bránu / DNS:** „Nastavení Alice bylo v pořádku, měnil jsi věc, která nebyla rozbitá. Rozhodující stopa byla v `ipconfig`: `Media disconnected`. Příště nejdřív zkontroluj výpis a pak teprve zasahuj.“ (Změny se vrátí do původního stavu, aby se nenasčítaly chyby.)
- **Zapojil kabel jinému zařízení:** „Tenhle kabel patří někomu jinému. Alice je pořád odpojená; zkontroluj ji znovu `ipconfig`em.“

**Kontrolní otázka.** Proč nestačí odpojenou Alici „opravit“ nastavením IP adresy? Co všechno je pod L3?

**Odhad času:** 5 min.

---

## Úloha 5: Chybějící brána

**Zadání.**
- Alice se dostane na Cyrila, ale **na server `www.skola.lan` ne**. Přitom IP, maska i DNS vypadají v pořádku.
- Zjisti, co jí chybí, a oprav to.

**Cíl.** Alice pingne na SRV1 (192.168.2.10) a otevře web.

**Výukový cíl a „aha“.**
- Aha: **„v naší síti“ a „jinam“ jsou dvě různé cesty.** Na sousedy Alice mluví přímo, ale na všechno ostatní musí vědět, komu má paket předat (brána).
- Vrstva: **L3** (směrování; bez brány Alice nemá, komu předat paket pro cizí síť).
- Typický příznak: `ping` Cyrila projde, `ping` SRV1 selže s „Destination host unreachable“ (bez brány v tabulce není žádná trasa); `netstat -nr` ukáže jen místní síť.

**Nápovědy.**
1. **Obecná:** Co funguje a co ne? Pokus se rozdělit síť na „u nás“ a „jinde“. Co se mění, když cíl není ve stejné síti?
2. **Směr:** Podívej se na `ipconfig /all` a porovnej s Cyrilovým. Které políčko je u Alice prázdné?
3. **Skoro řešení:** Doplň výchozí bránu 192.168.1.1 (adresa R1 na straně sítě 1).

**Co zkusit v terminálu.**
1. `ping 192.168.1.20` (Cyril): projde.
2. `ping 192.168.2.10` (SRV1): selže.
3. `ipconfig /all`: chybí **Default Gateway**.
4. `netstat -nr`: vidíš jen trasu do vlastní sítě.
5. Doplň bránu a zopakuj `ping 192.168.2.10`, pak `tracert 192.168.2.10`.

**Vyhodnocení.**
- **Funguje:** „Chyběla **brána**. Alice uměla mluvit jen s adresami ve své síti. Cizí síť (192.168.2.0/24) neznala, tak ji neměla komu předat. Teď posílá pakety pro cizí síť na R1 a ten je předává dál (`tracert` ukáže první skok 192.168.1.1).“
- **Zadal bránu v jiné síti (např. 192.168.2.1):** „Brána musí být **v tvé síti**. Alice musí bránu umět najít přímo (ARP), proto nemůže být jinde než v 192.168.1.0/24.“
- **Zadal vlastní IP jako bránu:** „Brána je jiné zařízení než Alice. Hledej adresu routeru.“
- **Zadal bránu Cyrila:** „Cyril je počítač, ne router; pakety dál neposílá. Brána je ten, kdo spojuje sítě.“
- **Změnil masku na 255.255.0.0:** „Teď Alice považuje 192.168.2.10 za souseda, ale ARP dotaz tam nikdo neodpoví. Zdánlivě opraveno, ve skutečnosti rozbito jinak.“ (Jen pokud simulátor takový stav vyhodnotí; jinak vynechat.)

**Kontrolní otázka.** Proč `ping` na Cyrila prošel i bez brány, ale na SRV1 ne? Podle čeho Alice pozná, že cíl je v cizí síti?

**Odhad času:** 8 min.

---

## Úloha 7: IP mimo síť (překlep)

**Zadání.**
- Alice si nastavila IP **ručně** a nefunguje jí nic: ani Cyril, ani brána, ani server.
- Zjisti, co je špatně, a oprav to.

**Cíl.** Alice dosáhne na bránu, na SRV1 a otevře `www.skola.lan`.

**Výukový cíl a „aha“.**
- Aha: **IP adresu musí číst společně s maskou.** Alice má 192.168.**11**.10/24 místo 192.168.**1**.10/24; jedna číslice, a brána (192.168.1.1) je „v cizí síti“.
- Vrstva: **L3** (adresace; adresa nepatří do sítě, ve které je Alice zapojená).
- Rozdíl proti úloze 5: brána tu **je**, ale Alice si ji nemůže najít, protože podle masky není v její síti. Typický příznak: i `ping` na bránu selže, `ping` Cyrila taky.

**Nápovědy.**
1. **Obecná:** Nefunguje ani nejbližší soused. Co musí platit mezi tvojí IP adresou a adresami ostatních, aby šlo mluvit přímo?
2. **Směr:** Porovnej Alicinu IP s adresou brány a s Cyrilovou. Do které sítě patří každá? (Pomůže maska.)
3. **Skoro řešení:** Alicina IP je 192.168.11.10, má být 192.168.1.10. Oprav třetí číslo.

**Co zkusit v terminálu.**
1. `ipconfig /all`: porovnej síť Alice (IP + maska) se sítí brány.
2. `ping 192.168.1.1`: „Destination host unreachable“ nebo timeout.
3. `ping 192.168.1.20` (Cyril): taky ne.
4. Oprav IP a zopakuj ping na bránu, na SRV1, a nakonec web.

**Vyhodnocení.**
- **Funguje:** „Překlep v **IP adrese** (192.168.**11**.10) posadil Alici do jiné sítě, než do které je zapojená. Brána pak byla pro Alici ‚v cizí síti‘, i když fyzicky stojí hned vedle. Při kontrole vždy porovnej **síťovou část** IP, masky a brány.“
- **Změnil bránu na 192.168.11.1:** „To by sedělo k překlepu v Alicině IP, jenže R1 má 192.168.1.1. Zkus zjistit, která adresa je špatná: tahle, nebo Alicina? Co říká zbytek sítě?“
- **Změnil masku na 255.255.0.0:** „Maska byla dobře. Přepsal jsi ji, aby adresy ‚vyšly‘, a rozbil jsi, co bylo správně.“
- **Opravil na jinou IP z 192.168.1.0/24, ale obsazenou (Cyrilovu):** „Adresa je ze správné sítě, ale už ji používá Cyril. Ukázka konfliktu; vyber volnou.“

**Kontrolní otázka.** Maska 255.255.255.0: které části IP adresy 192.168.11.10 jsou síť a která je zařízení? Vyšla by stejná sít při masce 255.255.0.0?

**Odhad času:** 8 min.

---

## Úloha 10: Web neodpovídá

**Zadání.**
- Alice otevře `www.skola.lan`, ale stránka se **nenačte**. Ping na server prochází, jméno se překládá.
- Zjisti, co se děje, a oprav to na straně serveru.

**Cíl.** `www.skola.lan` se načte (webová služba na SRV1 běží na TCP 80).

**Výukový cíl a „aha“.**
- Aha: **síť funguje, počítač je na síti, ale program, který má odpovídat, neběží.** SRV1 pošle zpátky odmítnutí (RST) a spojení se ani nenaváže.
- Vrstva: **L4/L7** (port 80 nikdo nenaslouchá).
- Rozdíl proti úlohám 1–7: spojení se **rychle odmítne** („connection refused“), není to dlouhé čekání (timeout).

**Nápovědy.**
1. **Obecná:** Co už víš, že funguje? Projdi vrstvy zdola: na které se objeví první věc, která selhává?
2. **Směr:** `ping` i `nslookup` jsou v pořádku. Zbývá jen to, co je nad nimi: je na SRV1 program, který u portu 80 čeká?
3. **Skoro řešení:** Na SRV1 spusť `ss -tuln`. Chybí řádek `tcp LISTEN 0.0.0.0:80`. Spusť webovou službu.

**Co zkusit v terminálu.**
1. Alice: `ping 192.168.2.10` projde, `nslookup www.skola.lan` vrátí 192.168.2.10.
2. Otevři web: chyba „spojení odmítnuto“.
3. SRV1: `ss -tuln`: port 80 není v seznamu (53 UDP ano).
4. Spusť službu na SRV1 (tlačítko / příkaz podle simulátoru).
5. `ss -tuln` znovu a zkus web z Alice.

**Vyhodnocení.**
- **Funguje:** „Na SRV1 nenaslouchala webová služba. Počítač zprávu dostal, ale na port 80 neběžel žádný program, tak odpověděl **RST** (odmítnutí). **Síť byla v pořádku**, chyba byla v aplikaci. Port dokazuje: ping (L3) projde i bez webu.“
- **Student zkoušel měnit nastavení Alice (IP, brána, DNS):** „Alice měla všechno správně: ping a DNS to dokazují. Příznak ‚rychle odmítnuto‘ znamená, že se zpráva dostala až k serveru.“
- **Změnil port, ne službu (např. otevřel 8080):** „Služba běží jinde než na 80. Prohlížeč se bez zadání portu ptá na 80. Buď přesuň službu na 80, nebo napiš `:8080`; ale správně je 80.“
- **Spustil DNS místo webu:** „DNS na UDP 53 už běžel. Chybí **TCP 80**.“

**Kontrolní otázka.** Čím se liší chyba „spojení odmítnuto“ od dlouhého čekání na odpověď (timeout)? Co to říká o tom, jak daleko paket došel?

**Odhad času:** 8 min.

---

## Úloha 11: Podle adresy ano, podle jména ne

**Zadání.**
- Alice má správně IP, masku i bránu. Na `192.168.2.10` se dostane, ale **`www.skola.lan` se nenačte**: počítač hlásí, že jméno nezná.
- Nastav jí DNS server tak, aby otevřela web podle jména.

**Cíl.** `nslookup www.skola.lan` vrátí 192.168.2.10 a web se otevře.

**Výukový cíl a „aha“.**
- Aha: **IP adresa a jméno jsou dvě věci.** Počítače se spojují podle IP, jméno je jen „telefonní seznam“, který se musí někoho zeptat.
- Vrstva: **L7** (DNS jako aplikační služba; dotaz jede po UDP 53).
- Příznak: `ping 192.168.2.10` funguje, `ping www.skola.lan` ne („could not find host“).

**Nápovědy.**
1. **Obecná:** Co funguje, když zadáš adresu, a co když jméno? Co musí počítač umět, aby jméno převedl na adresu?
2. **Směr:** Kdo ví, jakou IP má `www.skola.lan`? Na kterém počítači DNS běží (podívej se, kde naslouchá port UDP 53)?
3. **Skoro řešení:** DNS server je SRV1, 192.168.2.10. Nastav ho v dialogu Alice.

**Co zkusit v terminálu.**
1. `ping 192.168.2.10`: projde.
2. `ping www.skola.lan`: selže (nezná jméno).
3. `ipconfig /all`: DNS server prázdný (nebo špatný).
4. Nastav DNS (dialog), `nslookup www.skola.lan`.
5. `ping www.skola.lan` a otevři web.

**Vyhodnocení.**
- **Funguje:** „Alice se může zeptat DNS serveru (UDP 53), jakou IP má `www.skola.lan`. Bez něj síť funguje, jen nezná jména.“
- **DNS = brána (192.168.1.1):** „R1 DNS nenabízí; dotaz nikdo nezodpoví. DNS server je zařízení, na kterém **běží služba DNS**.“
- **DNS = Alicina vlastní IP:** „Alice na portu 53 nic nenaslouchá. Kdo odpovídá na dotazy?“
- **DNS = 192.168.2.20 (Bob):** „Bob je počítač bez DNS služby.“
- **Zadal IP serveru do prohlížeče a práce prošla:** „Tak to jde i bez DNS, ale úkol byl nastavit jméno.“

**Kontrolní otázka.** Proč `ping 192.168.2.10` prošel, a `ping www.skola.lan` ne? Co přesně Alice nevěděla?

**Odhad času:** 5 min. (Krátká, vhodná i jako domácí.)

---

## Úloha 3: Konflikt IP adres (domácí práce, nejtěžší)

**Zadání.**
- Cyril si v učebně stěžuje: web mu **jednou jde a jednou ne**, ping na Alici taky střídavě. Nic se mu nehlásí.
- Zjisti proč a oprav to.

**Cíl.** Stav je stabilní: Cyril i Alice na sebe dosáhnou vždy, ne jen občas.

**Pro učitele (scéna).**
- V síti 1 je navíc **síťová tiskárna PRT1** s ručně zadanou IP **192.168.1.20**, tedy stejnou jako Cyril. Tiskárna na rozdíl od Windows
  duplicitu adres **nezjišťuje** (Windows by si po ARP probe podle RFC 5227 konflikt všimly a ohlásily; tiskárna s pevnou IP
  ne), proto se nic neohlásí a oba stroje odpovídají na ARP o `192.168.1.20`.
- Ověří projektant: chování ARP tabulky při dvou odpovědích (poslední vyhrává, záznam se překrývá).

**Výukový cíl a „aha“.**
- Aha: **IP adresa musí být v síti jedinečná, a stopu najdeš v ARP tabulce:** `arp -a` ukáže jedinou IP, ale její MAC se mění.
- Vrstva: **L2/L3** (vazba IP → MAC, kterou řeší ARP).
- Student si odnese: „Stejná IP, dvě MAC = konflikt.“

**Jak dovést studenta k `arp -a` bez prozrazení.**
- **Příznak jako stopa:** „střídavě funguje“ se nedá vysvětlit nastavením (to je buď správně, nebo ne). Student má napsat hypotézu, proč by něco mohlo **střídat**.
- **Otázka v zadání** (v nápovědě 1): „Co se na cestě od IP adresy k rámci může měnit?“ Odpověď: IP → MAC; tohle zná z úrovně 2.
- **Nápověda 2** nezmiňuje příkaz, jen místo: „IP adresu na rámec překládá tabulka. Kde ji můžeš na Alici zobrazit?“ (Student zná `arp -a` z úrovně 3 a z taháku.)
- **Vyžádané opakování:** zadání říká „zkus `ping` víckrát za sebou a po každém se podívej do stejné tabulky“. Student **sám** uvidí, že řádek `192.168.1.20` mění MAC mezi `…:03` (Cyril) a `…:07` (tiskárna).
- **Nápověda 3** řekne, že se u Cyrila rovná jeho vlastní MAC (z `ipconfig /all`) jen jedna ze dvou MAC: ta druhá patří někomu jinému. Kdo to je? (MAC tabulka na SW1: kterým portem přichází; nebo `ping` do nenastavených uzlů.)

**Nápovědy.**
1. **Obecná:** Chyba, která **střídá** „funguje / nefunguje“, nesedí na špatné nastavení. Co by se na cestě od IP ke správnému zařízení mohlo střídat?
2. **Směr:** IP adresa se překládá na MAC adresu tabulkou. Podívej se na tu tabulku na Alici. Sleduj, jestli se řádek s `192.168.1.20` mění, když zkoušíš ping víckrát za sebou.
3. **Skoro řešení:** Jedna IP má dvě různé MAC. Jedna je Cyrilova (ověř `ipconfig /all`), druhá ne. Najdi na SW1 (MAC tabulka), na kterém portu druhá MAC sedí, a kterému zařízení patří.

**Co zkusit v terminálu (pořadí).**
1. Alice: `ping 192.168.1.20` několikrát po sobě: někdy odpoví, někdy ne.
2. Alice: `arp -a` po každém pingu: řádek pro 192.168.1.20 **mění MAC**.
3. Cyril: `ipconfig /all`: jeho MAC je jedna z nich.
4. SW1: MAC tabulka: druhá MAC je na jiném portu: PRT1.
5. PRT1: změň IP na volnou (např. 192.168.1.50), pak `arp -d` / počkej na vypršení a zkus ping znovu.
6. Alice: `arp -a`: jedna IP, jedna MAC; `ping` vždy projde.

**Vyhodnocení.**
- **Funguje:** „Dvě zařízení měla **stejnou IP**. Na ARP dotaz odpovídalo to, které bylo rychlejší, a Alice si do tabulky zapsala jeho MAC. Tiskárna konflikt nehlídá, proto se nic nehlásilo. Viníka jsi našel podle MAC v `arp -a`.“
- **Změnil IP Cyrilovi (místo tiskárně):** „Funguje, ale změnil jsi stroj, který nebyl viník. Cyril měl tuhle adresu přidělenou správně, tiskárna si ji vzala sama. V praxi bys zkontroloval, kdo adresu měl mít, než ji změníš. (Alternativa: nahlas to, ať se IP tiskárny nastaví nebo rezervuje.)“
- **Změnil IP Alici:** „Alice neměla chybu. Konflikt je mezi Cyrilem a tiskárnou, tvoje změna ho jen skryje u Alice. Ping z Boba by střídal dál.“
- **Vyřadil kabel tiskárny:** „Konflikt zmizel, ale tiskárna je mimo provoz. To je obejití, ne oprava. Změň jí adresu.“
- **Změnil IP tiskárně na obsazenou jinou (např. 192.168.1.10, Alice):** „Teď je konflikt s Alicí. Vyber adresu, kterou nikdo nemá.“

**Kontrolní otázka.** Proč `arp -a` ukazuje jednu IP s jednou MAC, a přesto se MAC mění? Jak by se konflikt choval na počítači s Windows? (Windows by konflikt ohlásily.)

**Odhad času:** 12–15 min (proto domácí práce, nebo první úloha druhé hodiny).

---

## Úloha 13: Síť nejde (souhrnná)

**Zadání.**
- Alice nemůže otevřít `http://www.skola.lan`. **Neříkáme, proč.** Chyba je jedna z těch, které jsi už viděl.
- Najdi příčinu, oprav ji a napiš, na které vrstvě byla.

**Cíl.** Web se načte a student **napíše**: co bylo špatně a na jaké vrstvě (jednou větou).

**Pro učitele.**
- Při spuštění se **náhodně** vybere jedna z úloh 1, 3, 5, 7, 10, 11 (seed zobrazit, ať jde zopakovat a zkontrolovat doma).
- Vyhodnocení srovná: (a) opravil správně, (b) pojmenoval správnou vrstvu, (c) kolik zbytečných zásahů.
- Student se sám naučí **kontrolní seznam** (níže); simulátor ho má ukázat až po pokusu, ne při zadání.

**Výukový cíl a „aha“.**
- Aha: **nehádej, jdi od L1 nahoru a na každé vrstvě udělej jeden test.** Stejný příznak (web nejde) mají různé příčiny na různých vrstvách.
- Hodnocení je za postup, ne za rychlost.

**Nápovědy.**
1. **Obecná:** Nehádej. Rozděl problém na vrstvy a začni zdola. Které věci musí fungovat, než vůbec jde otevřít web?
2. **Směr:** Použij seznam: kabel, vlastní IP, soused, brána, vzdálená IP, jméno, služba. Zastav se na prvním kroku, který selže.
3. **Skoro řešení:** Řekne, **na které vrstvě** chyba je (např. „L3: zkontroluj IP a bránu“), ne přesnou chybu.

**Postup od L1 nahoru (kontrolní seznam).**

| # | Vrstva | Test | Když selže |
|---|---|---|---|
| 1 | **L1** kabel | `ipconfig`: není `Media disconnected`? | Úloha 1: zapoj kabel. |
| 2 | **L3** moje adresa | `ipconfig /all`: IP a maska jsou ze správné sítě? | Úloha 7: oprav IP. |
| 3 | **L2/L3** sousedi | `ping` Cyril; `arp -a`: každá IP má **jednu** MAC? | Úloha 3: konflikt IP; hledej druhou MAC. |
| 4 | **L3** brána | `ping 192.168.1.1`: dosáhnu na bránu? Je brána v `ipconfig`? | Úloha 5: doplň bránu. |
| 5 | **L3** cizí síť | `ping 192.168.2.10`, `tracert`: dojde to až k serveru? | Přesun na routery (jiné úlohy, zatím mimo). |
| 6 | **L7** jméno | `nslookup www.skola.lan` | Úloha 11: nastav DNS. |
| 7 | **L4/L7** služba | web po portu 80; na SRV1 `ss -tuln` | Úloha 10: spusť službu. |

**Co zkusit (pořadí).** Student postupuje podle seznamu; doporučené nástroje: `ipconfig /all`, `ping`, `arp -a`, `tracert`, `nslookup`, `ss -tuln`.

**Vyhodnocení.**
- **Funguje:** „Opraveno: **{chyba}** na vrstvě **{L}**. Tvůj postup: {kroky}. Použil jsi {n} zásahů, {k} z nich zbytečných.“ + odkaz na odpovídající úlohu pro zopakování.
- **Správná oprava, špatně určená vrstva:** „Oprava sedí, ale vrstvu pojmenuj znovu. {chyba} je na {L}, protože {důvod}.“
- **Opravil jinou věc, než byla chyba:** „Přenastavil jsi {co}, ale příčina je jinde. Podívej se, kterou kontrolu v seznamu jsi přeskočil.“ (Stav se vrátí do původního.)
- **Víc než 3 zbytečné zásahy:** „Zkus příště nic neměnit, dokud neověříš každý bod seznamu.“

**Kontrolní otázka.** Proč seznam začíná u kabelu a končí u služby? Co by se stalo, kdybys začal DNS a chyba byla v kabelu?

**Odhad času:** 10–15 min na jednu chybu. Doporučení: domácí práce (každý student jiná chyba, výpis terminálu odevzdat).

---

## Co z toho plyne (rozbor v plénu, 5–8 min)

- **Příznak × vrstva**, tabulka na tabuli:

| Příznak | Příčina | Vrstva |
|---|---|---|
| `Media disconnected` | odpojený kabel | L1 |
| nejde ani soused ani brána, adresa ze špatné sítě | překlep v IP | L3 |
| soused ano, cizí síť ne | chybí brána | L3 |
| střídavě ano/ne, jedna IP, dvě MAC | konflikt IP | L2/L3 |
| IP ano, jméno ne | chybí / špatný DNS | L7 |
| „spojení odmítnuto“ | služba neběží | L4/L7 |

- Otázka do pléna: „Který příznak vás nejvíc zmátl a proč?“

---

## Poznámky k implementaci a otevřené otázky

- **PRT1 (tiskárna):** v topologii úrovně 3–4 zatím není. Jde o nový uzel v síti 1 (připojený k SW1) s vlastní MAC a nepříliš složitým chováním (odpovídá na ARP a ping, bez detekce duplicity). Potřebuje rozhodnutí vývojáře / projektanta.
- **Chování ARP při konfliktu:** střídání MAC v tabulce Alice (kdo odpoví poslední) je v simulátoru deterministické? Pro studenta je vhodné, aby střídání bylo předvídatelné (např. tiskárna přepíše po každém druhém pingu), ale ne uměle pravidelné. Ověří projektant (RFC 826, 5227).
- **Příkaz pro spuštění služby na SRV1** (úloha 10) a pro ARP tabulku (`arp -d`): jsou v cmd.md? Pokud ne, dodat jako tlačítko.
- **Text „Destination host unreachable“ vs. „Request timed out“** v úlohách 5 a 7: ověřit u projektanta, co Windows skutečně vypisují (v 5 bez brány jde o chybu od lokálního stroje, v 7 podobně, ale záleží na verzi).
- **Zpětný stav po špatném zásahu:** navrhuji, aby simulátor při špatně určené chybě vrátil nastavení zpět (jinak se chyby sčítají). Rozhodne vývojář.
- **Odhady času** jsou odhady; ověřit pilotem se studenty-testery.
