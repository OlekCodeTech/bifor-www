"""Buduje jednoplikowy podgląd strony BIFOR dla klienta.

Łączy index.html, dolacz.html, regulamin.html i polityka-prywatnosci.html
w jedną stronę (przełączanie widoków po #hash), wkleja CSS, JS i zdjęcia
(data URI), więc plik działa bez serwera.

Użycie:
  python tools/build-preview.py                 -> export/bifor-podglad.html
  python tools/build-preview.py --artifact OUT  -> dodatkowo wersja bez <html>/<head> pod Artifact
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def between(s, start, end):
    i = s.index(start)
    j = s.index(end, i)
    return s[i:j + len(end)]


def data_uri(path):
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


index = read("index.html")
dolacz = read("dolacz.html")

# --- treść strony głównej (bez skryptów podpinanych plikami)
body = index[index.index("<body>") + len("<body>"):index.index("</body>")]
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

# ikona używana tylko w widoku formularza
ok_symbol = re.search(r'<symbol id="i-ok".*?</symbol>', dolacz, re.S).group(0)
body = body.replace("</defs>", "    " + ok_symbol + "\n  </defs>", 1)

# --- widok formularza
join = between(dolacz, '<main id="main" class="join">', "</main>")
join = join.replace('<main id="main" class="join">', '<main id="dolacz-view" class="join" hidden>')

# --- widoki dokumentów prawnych
def legal_view(src, view_id, rename=None):
    html = read(src)
    main = between(html, '<main id="main" class="legal">', "</main>")
    # w podglądzie hash nazywa widok, więc kotwica o tej samej nazwie
    # musi dostać inną — inaczej przeglądarka skacze w środek dokumentu
    for old, new in (rename or {}).items():
        main = main.replace(f'id="{old}"', f'id="{new}"').replace(f'href="#{old}"', f'href="#{new}"')
    return main.replace('<main id="main" class="legal">', f'<main id="{view_id}" class="legal" hidden>')


views = join \
    + "\n\n" + legal_view("regulamin.html", "regulamin-view", {"regulamin": "konto"}) \
    + "\n\n" + legal_view("polityka-prywatnosci.html", "polityka-view", {"prywatnosc": "prywatnosc-czesc"})
body = body.replace("</main>", "</main>\n\n" + views, 1)

# --- linki między podstronami -> kotwice
body = body.replace('href="dolacz.html"', 'href="#dolacz"')
body = body.replace('href="regulamin.html"', 'href="#regulamin"')
body = body.replace('href="polityka-prywatnosci.html#cookies"', 'href="#cookies"')
body = body.replace('href="polityka-prywatnosci.html"', 'href="#polityka-prywatnosci"')
body = body.replace('href="polityka-cookies.html"', 'href="#cookies"')
body = re.sub(r'href="index\.html#([\w-]+)"', r'href="#\1"', body)
body = body.replace('href="index.html"', 'href="#top"')

# --- zdjęcia jako data URI
body = re.sub(r'src="(assets/img/[^"]+)"', lambda m: f'src="{data_uri(ROOT / m.group(1))}"', body)

router = """
(function () {
  'use strict';
  var views = {
    home: document.getElementById('main'),
    join: document.getElementById('dolacz-view'),
    regulamin: document.getElementById('regulamin-view'),
    polityka: document.getElementById('polityka-view')
  };
  // kotwice wewnątrz dokumentu polityki
  var POLITYKA_ANCHORS = ['polityka-prywatnosci', 'prywatnosc-czesc', 'cookies', 'dostawcy'];
  // kotwice wewnątrz regulaminu
  var REGULAMIN_ANCHORS = ['regulamin', 'konto', 'grafik', 'abonament'];

  function viewFor(h) {
    if (h === 'dolacz') return 'join';
    if (POLITYKA_ANCHORS.indexOf(h) !== -1) return 'polityka';
    if (REGULAMIN_ANCHORS.indexOf(h) !== -1) return 'regulamin';
    return 'home';
  }

  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var v = viewFor(h);
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; });

    // Przeglądarka sama skacze do elementu o tym id (np. #regulamin jest i nazwą
    // widoku, i kotwicą w dokumencie), więc ustawiamy pozycję po jej skoku.
    var topOnly = !h || h === 'top' || h === 'main' || h === 'dolacz' ||
                  h === 'regulamin' || h === 'polityka-prywatnosci';
    var el = topOnly ? null : document.getElementById(h);
    setTimeout(function () {
      window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY - 88 : 0);
    }, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
"""

css = read("assets/css/style.css") + "\n[id]{scroll-margin-top:88px}\n"
js = "\n".join(read(f"assets/js/{n}.js") for n in ("main", "film", "form")) + router

head = f"""<title>BIFOR</title>
<meta name="description" content="BIFOR — wszystkie ustalenia wydarzenia w jednym miejscu. Podgląd strony.">
<link rel="icon" href="{data_uri(ROOT / 'assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
{css}
</style>
<script>document.documentElement.classList.add('js')</script>"""

inner = f"{head}\n{body}\n<script>\n{js}\n</script>\n"

out = ROOT / "export" / "bifor-podglad.html"
out.parent.mkdir(exist_ok=True)
out.write_text(
    '<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + head + "\n</head>\n<body>" + body + "\n<script>\n" + js + "\n</script>\n</body>\n</html>\n",
    encoding="utf-8",
)
print(f"{out}  ({out.stat().st_size / 1024:.0f} KB)")

if "--artifact" in sys.argv:
    art = Path(sys.argv[sys.argv.index("--artifact") + 1])
    art.parent.mkdir(parents=True, exist_ok=True)
    art.write_text(inner, encoding="utf-8")
    print(f"{art}  ({art.stat().st_size / 1024:.0f} KB)")
