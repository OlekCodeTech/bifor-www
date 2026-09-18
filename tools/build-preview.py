"""Buduje jednoplikowy podgląd strony BIFOR dla klienta.

Łączy index.html i dolacz.html w jedną stronę (przełączanie widoków po #hash),
wkleja CSS, JS i zdjęcia (data URI), więc plik działa bez serwera.

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

# --- widok formularza i widok polityk
join = between(dolacz, '<main id="main" class="join">', "</main>")
join = join.replace('<main id="main" class="join">', '<main id="dolacz-view" class="join" hidden>')
doc_view = (
    '<main id="polityka-view" class="doc" hidden><div class="wrap"><div class="in">'
    '<h1 id="docTitle">Polityka prywatności</h1>'
    "<p>Treść zostanie opublikowana przed uruchomieniem strony.</p>"
    '<p><a class="link" href="#top">← Wróć na stronę główną</a></p>'
    "</div></div></main>"
)
body = body.replace("</main>", "</main>\n\n" + join + "\n\n" + doc_view, 1)

# --- linki między podstronami -> kotwice
body = body.replace('href="dolacz.html"', 'href="#dolacz"')
body = re.sub(r'href="index\.html#([\w-]+)"', r'href="#\1"', body)
body = body.replace('href="index.html"', 'href="#top"')
body = body.replace('href="polityka-prywatnosci.html" target="_blank" rel="noopener"', 'href="#polityka-prywatnosci"')
body = body.replace('href="polityka-prywatnosci.html"', 'href="#polityka-prywatnosci"')
body = body.replace('href="polityka-cookies.html"', 'href="#polityka-cookies"')

# --- zdjęcia jako data URI
body = re.sub(r'src="(assets/img/[^"]+)"', lambda m: f'src="{data_uri(ROOT / m.group(1))}"', body)

router = """
(function () {
  'use strict';
  var views = { home: document.getElementById('main'), join: document.getElementById('dolacz-view'), doc: document.getElementById('polityka-view') };
  function route() {
    var h = decodeURIComponent(location.hash.slice(1));
    var v = h === 'dolacz' ? 'join' : (h === 'polityka-prywatnosci' || h === 'polityka-cookies') ? 'doc' : 'home';
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== v; });
    if (v === 'doc') document.getElementById('docTitle').textContent = h === 'polityka-cookies' ? 'Polityka cookies' : 'Polityka prywatności';
    if (v !== 'home' || !h || h === 'top' || h === 'main') { window.scrollTo(0, 0); return; }
    var el = document.getElementById(h);
    if (el) setTimeout(function () { window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 88); }, 0);
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
