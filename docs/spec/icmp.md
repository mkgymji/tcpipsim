# ICMP

Stav: návrh, iterace 1. Zdroje: RFC 792 (formáty zpráv), RFC 1122 3.2.2 (hostitel),
RFC 1812 4.3 a 5.3.1 (router).

## 1. Zařazení

ICMP je součást síťové vrstvy, zprávy se ale přenášejí v IP paketu s Protocol = `1`.
Slouží k diagnostice (ping) a k hlášení chyb (nedoručitelnost, vypršení TTL).

## 2. Echo Request / Echo Reply (ping) — pole pro rentgen

| Pole | Délka (bity) | Význam | Hodnota v simulaci |
|---|---|---|---|
| Type | 8 | druh zprávy | `8` Echo Request, `0` Echo Reply |
| Code | 8 | upřesnění | `0` |
| Checksum | 16 | kontrolní součet celé ICMP zprávy (RFC 1071) | počítá se skutečně |
| Identifier | 16 | rozlišení „relací“ pingu | `1` (Windows ping používá 1; Linux PID — zjednodušení) |
| Sequence Number | 16 | pořadové číslo dotazu | od `1`, +1 s každým dotazem |
| Data | proměnná | libovolná data, odpověď je vrací | 32 B `abcdefghijklmnopqrstuvwabcdefghi` (jako Windows `ping`) |

- Hlavička ICMP echo = 8 B. Ping z Windows: ICMP 8 + 32 = 40 B, IP paket 60 B, rámec 74 B.
- **Odpověď** (RFC 792; RFC 1122 3.2.2.6): Type 0, Identifier a Sequence Number zkopírované
  z dotazu, data vrácená celá a beze změny („MUST be entirely included“). IP adresy prohozené.
  Je to **nový IP paket** s výchozím TTL odpovídajícího uzlu (viz `ipv4.md` kap. 3).
- Odpovídá každý L3 uzel včetně routeru (na kteroukoli svou adresu). Simulátor zjednodušuje:
  žádný firewall, který by ICMP blokoval (Windows ve výchozím nastavení Echo Request blokuje!
  — to je reálná past při zkoušení ve škole, vhodné zmínit v didaktice).

Výsledek pro aplikaci `ping` (pro UI, styl Windows): odesláno, přijato, ztraceno; u každé
odpovědi: od koho, bajty (velikost dat = 32), čas (v simulaci orientační), TTL z hlavičky odpovědi.

## 3. Chybové zprávy

Společný formát (RFC 792): Type 8 b, Code 8 b, Checksum 16 b, 32 b nevyužito (nuly),
pak **IP hlavička a začátek dat původního paketu**. RFC 792 vyžaduje alespoň hlavičku + 64 bitů dat;
RFC 1812 4.3.2.3 doporučuje routerům přiložit co nejvíc, aby zpráva nepřesáhla 576 B.
Simulátor: přiloží IP hlavičku + prvních 8 B dat původního paketu (minimum podle RFC 792;
pro rentgen stačí a je přehledné).

| Type | Code | Název | Kdo a kdy posílá |
|---|---|---|---|
| 3 | 0 | Destination Unreachable — network unreachable | router: nemá cestu (RFC 1812 5.2.7.1) |
| 3 | 1 | Destination Unreachable — host unreachable | router: next hop neodpovídá na ARP |
| 3 | 3 | Destination Unreachable — port unreachable | hostitel: UDP port nikdo neposlouchá (další iterace) |
| 11 | 0 | Time Exceeded — TTL exceeded in transit | router: TTL by kleslo na 0 (RFC 1812 5.3.1) |

Pravidla (RFC 1122 3.2.2): ICMP chyba se **neposílá** jako odpověď na jinou ICMP chybu, na
broadcast/multicast cíl ani na fragment jiný než první. Zdrojová IP chybové zprávy z routeru =
adresa rozhraní, kterým zpráva odchází (běžná praxe; RFC 1812 4.3.2.4 — ověřit přesné znění).

Simulátor zjednodušuje: bez omezení četnosti ICMP zpráv (rate limiting), bez Redirect (5),
Source Quench (4, zastaralé) a Timestamp.

## 4. Mimo rozsah této iterace

`tracert` (využívá Time Exceeded, specifikuje se s úrovní 3), Path MTU Discovery, ICMPv6.
