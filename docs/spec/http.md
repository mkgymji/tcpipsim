# HTTP/1.1 (požadavek GET a odpověď 200 OK)

Stav: návrh, iterace 4 (rozhodnutí 59). Autor: projektant. Zdroj: **RFC 9110** (HTTP Semantics),
**RFC 9112** (HTTP/1.1, formát zpráv a spojení). Vektory: `tcp-handshake-http`, `tcp-ztrata-retransmise`.

## 1. Volba pro úroveň 4

- Klient = **curl** (příkaz `curl -v http://www.skola.lan` nebo akce scénáře, `cmd.md` kap. 17).
  Posílá přesně tři hlavičky (Host, User-Agent, Accept), takže rentgen ukáže skutečný požadavek
  bez šumu prohlížeče (Accept-Language, Accept-Encoding, Cookie, Sec-…).
- **Spojení:** HTTP/1.1 je ve výchozím stavu **trvalé** (persistent, RFC 9112 kap. 9.3) — hlavička
  `Connection` se neposílá. Klient z `Content-Length` pozná, že má celé tělo, a protože už nic dalšího
  nechce, **zavře spojení sám** (curl tak skončí). Výsledek: čisté ukončení FIN od klienta, TIME-WAIT
  u Alice (`tcp.md` kap. 8).
  Proč ne `Connection: close`: server by zavíral první a TIME-WAIT by byl na serveru, ne v `netstat`
  u Alice. Proč ne prohlížeč s keep-alive: spojení by zůstalo otevřené a FIN by nepřišel.
- Akce „prohlížeč“ (pokud ji scénář chce): stejné pakety, jen jiný User-Agent a jiné délky.
  Simulátor zjednodušuje: „prohlížeč“ zavře spojení hned po načtení stránky; skutečný ho nechá
  chvíli otevřené pro další požadavky.

## 2. Formát zprávy (RFC 9112 kap. 2–4)

Text v ASCII (tělo v UTF-8). Řádky končí **CRLF** (`\r\n`, bajty `0d 0a`). Struktura:
startovní řádek, hlavičky `Jméno: hodnota`, **prázdný řádek**, tělo.

### 2.1 Požadavek (76 B)

```
GET / HTTP/1.1\r\n
Host: www.skola.lan\r\n
User-Agent: curl/8.9.1\r\n
Accept: */*\r\n
\r\n
```

| Část | Význam | Zdroj |
|---|---|---|
| `GET` | metoda: „pošli mi zdroj“ | RFC 9110 kap. 9.3.1 |
| `/` | cesta (request target) | RFC 9112 kap. 3.2 |
| `HTTP/1.1` | verze | RFC 9112 kap. 2.3 |
| `Host` | jméno serveru z URL; **v HTTP/1.1 povinné** (na jedné IP může být víc webů) | RFC 9112 kap. 3.2, RFC 9110 kap. 7.2 |
| `User-Agent` | kdo se ptá | RFC 9110 kap. 10.1.5 |
| `Accept: */*` | klient vezme jakýkoli typ obsahu | RFC 9110 kap. 12.5.1 |

Simulátor zjednodušuje: verze curl je pevná `8.9.1` (na školním PC bude jiná, ověřit `curl --version`).

### 2.2 Odpověď (249 B = 117 B hlavička + 132 B tělo)

```
HTTP/1.1 200 OK\r\n
Date: Wed, 25 Nov 2026 08:00:00 GMT\r\n
Content-Type: text/html; charset=utf-8\r\n
Content-Length: 132\r\n
\r\n
<!DOCTYPE html>\n
<html><head><meta charset="utf-8"><title>Škola</title></head>\n
<body><h1>Vítej na www.skola.lan</h1></body></html>\n
```

| Část | Význam | Zdroj |
|---|---|---|
| `HTTP/1.1 200 OK` | stavový řádek: verze, kód, text | RFC 9112 kap. 4, RFC 9110 kap. 15.3.1 |
| `Date` | čas vytvoření odpovědi; server s hodinami ho **musí** poslat (2xx–4xx) | RFC 9110 kap. 6.6.1 |
| `Content-Type` | typ těla (MIME) a kódování znaků | RFC 9110 kap. 8.3 |
| `Content-Length` | délka těla **v bajtech** (ne znacích: „Š“ a „í“ mají v UTF-8 po 2 B, 130 znaků = 132 B) | RFC 9110 kap. 8.6, RFC 9112 kap. 6.3 |

Simulátor zjednodušuje: Date je pevný čas simulace; skutečné servery přidávají i `Server`,
`Last-Modified`, `ETag`, `Accept-Ranges`, případně `Connection: keep-alive` (nginx). Do rentgenu
je nepřidávat — student je uvidí ve Wiresharku a nic z nich se nemusí odnaučit.

## 3. Rentgen L7

HTTP se v rentgenu ukáže jako **text po řádcích** (jako Wireshark „Hypertext Transfer Protocol“):
každý řádek zvlášť, `\r\n` viditelně šedě, prázdný řádek zvýrazněný („konec hlaviček“), tělo jako
text s počtem znaků i bajtů. Zvýraznit: metoda + cesta, `Host`, stavový kód, `Content-Length`.
HTTP nemá binární hlavičku s pevnými délkami polí — délky v bitech se u L7 neukazují, jen délka
celé zprávy v bajtech (rozhodnutí 1: L7 bez vlastní obálky).

## 4. Chování

- Klient po navázání TCP pošle požadavek jedním zápisem (jeden segment, PSH). Server odpoví jedním
  zápisem (hlavička + tělo v jednom segmentu, 249 B < MSS 1460).
- Klient čte, dokud nemá `Content-Length` bajtů těla, pak zavře socket (→ FIN).
- Server po přijetí FIN (konec dat od klienta) zavře svůj socket spojení (→ FIN).
- Jiná cesta než `/` → `404 Not Found` (tělo krátký text). Ve vektorech úrovně 4 se nevyskytuje.
- HTTPS (TLS, port 443) mimo rozsah; poznámka v UI: „reálné weby dnes používají HTTPS — obsah
  by v rentgenu byl zašifrovaný“.
