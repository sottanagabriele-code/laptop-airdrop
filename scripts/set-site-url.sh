#!/usr/bin/env bash
# Cambia l'indirizzo pubblico del sito ovunque sia scritto.
#
# L'URL compare in nove punti (canonical, og:url, og:image, twitter:image,
# JSON-LD, sitemap.xml, robots.txt, README e l'host IndexNow nel workflow).
# Sbagliarne uno significa che i motori di ricerca indicizzano un indirizzo
# e l'anteprima social ne mostra un altro, quindi si cambiano tutti insieme.
#
#   ./scripts/set-site-url.sh laptop.pages.dev
#
set -euo pipefail
cd "$(dirname "$0")/.."

NEW="${1:-}"
if [ -z "$NEW" ]; then
  echo "uso: $0 <nuovo-host>    (es. laptop.pages.dev)" >&2
  exit 1
fi
NEW="${NEW#https://}"; NEW="${NEW#http://}"; NEW="${NEW%/}"

OLD=$(sed -n 's|.*<link rel="canonical" href="https://\([^/"]*\).*|\1|p' index.html | head -1)
if [ -z "$OLD" ]; then
  echo "non trovo l'host attuale nel canonical di index.html" >&2
  exit 1
fi
if [ "$OLD" = "$NEW" ]; then
  echo "gia' impostato su $NEW, niente da fare"
  exit 0
fi

FILES="index.html sitemap.xml robots.txt README.md .github/workflows/pubblica.yml"
for f in $FILES; do
  [ -f "$f" ] && sed -i "s|$OLD|$NEW|g" "$f"
done

# la data della sitemap vale solo se cambia insieme all'indirizzo
sed -i "s|<lastmod>[0-9-]*</lastmod>|<lastmod>$(date -u +%Y-%m-%d)</lastmod>|" sitemap.xml

echo "$OLD -> $NEW"
grep -rn "$NEW" $FILES | sed 's/^/  /'
