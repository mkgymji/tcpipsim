#!/usr/bin/env bash
# Spustí všechny testy: jednotkové testy jádra (node --test) a smoke test stránky
# v headless Chromiu. Použití: tests/run_all.sh [--no-browser]
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
FAIL=0

echo "== Jednotkové testy (node --test)"
mapfile -t TESTS < <(find tests -name '*.test.js' | sort)
if [ ${#TESTS[@]} -eq 0 ]; then
  echo "Žádné testy nenalezeny"; FAIL=1
elif ! node --test "${TESTS[@]}"; then
  FAIL=1
fi

if [ "${1:-}" = "--no-browser" ]; then
  echo "== Smoke test prohlížeče přeskočen (--no-browser)"
else
  echo "== Smoke test: načtení index.html v headless Chromiu"
  BROWSER=""
  for b in chromium chromium-browser google-chrome google-chrome-stable \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if command -v "$b" >/dev/null 2>&1 || [ -x "$b" ]; then BROWSER="$b"; break; fi
  done
  if [ -z "$BROWSER" ]; then
    echo "VAROVÁNÍ: Chromium/Chrome nenalezen, smoke test přeskočen"
  else
    TMP=$(mktemp -d)
    trap 'rm -rf "$TMP"' EXIT
    # file:// + --allow-file-access-from-files: na gaze headless Chromium nenačte
    # http://127.0.0.1 (zamrzne), proto se stránka testuje ze souboru s povolenými moduly.
    # Načte se úroveň 1 (bez adresy), úroveň 2 (#u=2, krok s MAC tabulkou a rentgenem) a úroveň 3
    # (#u=3: krok s routerem a konzolí IOS, krok tracertu s živým výpisem terminálu Windows).
    for HASH in "" "#u=2&k=13&t=SW1&c=show%20mac%20address-table" "#u=3&k=9&t=R1&c=enable&c=show%20ip%20route" \
                "#u=3&k=20&t=PC1&c=tracert%20192.168.2.20" \
                "#u=4&k=21&t=SRV1&c=ss%20-tan" "#u=4&k=31&t=PC1&c=nslookup%20www.skola.lan" \
                "#uloha=4" "#uloha=13&seed=1"; do
      timeout 90 "$BROWSER" --headless --disable-gpu --no-sandbox --no-first-run \
        --user-data-dir="$TMP/profile" --allow-file-access-from-files \
        --enable-logging=stderr --v=0 --virtual-time-budget=5000 \
        --dump-dom "file://$ROOT/index.html$HASH" >"$TMP/dom.html" 2>"$TMP/stderr.txt"
      RC=$?
      PROBLEMS=""
      [ $RC -ne 0 ] && PROBLEMS+="prohlížeč skončil s kódem $RC; "
      grep -q 'data-core="ok"' "$TMP/dom.html" || PROBLEMS+="jádro nenastavilo data-core=ok; "
      grep -q 'data-errors=' "$TMP/dom.html" && PROBLEMS+="stránka zachytila chybu: $(grep -o 'data-last-error="[^"]*"' "$TMP/dom.html"); "
      if grep -E 'CONSOLE.*(Uncaught|Error|CORS|Failed to load)' "$TMP/stderr.txt" >"$TMP/console_err.txt"; then
        PROBLEMS+="chyby v konzoli: $(head -3 "$TMP/console_err.txt"); "
      fi
      if [ -n "$PROBLEMS" ]; then
        echo "SMOKE TEST SELHAL (index.html$HASH): $PROBLEMS"; FAIL=1
      else
        echo "Smoke test OK: index.html$HASH (stránka načtena, jádro běží, konzole bez chyb)"
      fi
    done

    echo "== Test ovládání v prohlížeči (tests/browser/interact.html)"
    timeout 90 "$BROWSER" --headless --disable-gpu --no-sandbox --no-first-run \
      --user-data-dir="$TMP/profile2" --allow-file-access-from-files \
      --virtual-time-budget=30000 \
      --dump-dom "file://$ROOT/tests/browser/interact.html" >"$TMP/interact.html" 2>/dev/null
    sed -n '/<pre/,/<\/pre>/p' "$TMP/interact.html" | sed -e 's/<[^>]*>//g' -e 's/&amp;/\&/g' -e 's/&gt;/>/g' | grep -v '^ok' || true
    # pozor: komentář v interact.html obsahuje text data-result="OK", hledá se atribut prvku #result
    if grep -q 'id="result" data-result="OK"' "$TMP/interact.html"; then
      echo "Test ovládání OK"
    else
      echo "TEST OVLÁDÁNÍ SELHAL"; FAIL=1
    fi
  fi
fi

if [ $FAIL -eq 0 ]; then echo "== VŠE PROŠLO"; else echo "== NĚCO SELHALO"; fi
exit $FAIL
