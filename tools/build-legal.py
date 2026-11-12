"""Buduje podstrony prawne BIFOR z dokumentów przysłanych przez klienta.

Źródło: content/legal/*.html (dokumenty od BIFOR, wersja 4.2).
Treść przenoszona jest 1:1 — skrypt zmienia tylko oprawę (nawigacja, stopka,
style strony) i poprawia odnośniki między dokumentami.

Użycie: python tools/build-legal.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "legal"

# dokumenty, których klient jeszcze nie przysłał — odnośniki do nich
# zamieniamy na zwykły tekst, żeby na stronie nie było martwych linków
MISSING_DOCS = ("03_Umowa_powierzenia.html", "04_Informacja_sali_o_danych.html")

PAGES = [
    {
        "src": "01_Regulamin_Bifor.html",
        "out": "regulamin.html",
        "title": "Regulamin BIFOR",
        "desc": "Regulamin korzystania z platformy BIFOR — konto, wydarzenia, role i abonament dla sal.",
    },
    {
        "src": "02_Polityka_prywatnosci_i_cookies.html",
        "out": "polityka-prywatnosci.html",
        "title": "Polityka prywatności i cookies",
        "desc": "Jak BIFOR przetwarza dane osobowe, jakich technologii używa i komu powierza dane.",
    },
]

NAV_LINKS = [
    ("index.html#jak-dziala", "Jak działa"),
    ("index.html#funkcje", "Funkcje"),
    ("index.html#role", "Role"),
    ("index.html#dla-kogo", "Dla kogo"),
    ("index.html#faq", "FAQ"),
]


def footer(active):
    def info(href, label):
        cur = ' aria-current="page"' if href == active else ""
        return f'<li><a href="{href}"{cur}>{label}</a></li>'

    return f"""<footer class="ft">
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <a href="index.html" class="logo" aria-label="BIFOR — strona główna">bifor<span></span></a>
        <p>Wszystkie ustalenia wydarzenia. Jedno miejsce.</p>
      </div>
      <div><h4>Produkt</h4><ul><li><a href="index.html#jak-dziala">Jak działa</a></li><li><a href="index.html#funkcje">Funkcje</a></li><li><a href="index.html#role">Role</a></li><li><a href="index.html#realizacja">Realizacja</a></li></ul></div>
      <div><h4>Start</h4><ul><li><a href="dolacz.html">Rozpocznij z BIFOR</a></li><li><a href="index.html#dla-kogo">Dla kogo</a></li><li><a href="index.html#faq">FAQ</a></li></ul></div>
      <div><h4>Informacje</h4><ul>{info('regulamin.html', 'Regulamin')}{info('polityka-prywatnosci.html', 'Polityka prywatności')}{info('polityka-prywatnosci.html#cookies', 'Polityka cookies')}</ul></div>
    </div>
    <div class="ft-bottom"><span>© 2026 BIFOR · TASTEGO sp. z o.o.</span><span><a href="mailto:kontakt@bifor.pl">kontakt@bifor.pl</a> · <a href="tel:+48510400388">510 400 388</a></span></div>
  </div>
</footer>"""


def shell(title, desc, body, active):
    nav = "".join(f'<a href="{h}">{t}</a>' for h, t in NAV_LINKS)
    return f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><!-- podgląd: usunąć przy starcie produkcji -->
<title>{title} — BIFOR</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#6F5BD8">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">Przejdź do treści</a>

<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a href="index.html" class="logo" aria-label="BIFOR — strona główna">bifor<span></span></a>
    <nav class="nav-links" aria-label="Główna nawigacja">{nav}</nav>
    <div class="nav-end">
      <a class="btn btn-primary btn-sm" href="dolacz.html">Rozpocznij z BIFOR</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Otwórz menu"><span></span><span></span></button>
    </div>
  </div>
  <nav class="mnav" id="mnav" hidden aria-label="Menu mobilne">{nav}</nav>
</header>

<main id="main" class="legal">
  <div class="wrap">
{body}
  </div>
</main>

{footer(active)}
<script src="assets/js/main.js"></script>
</body>
</html>
"""


def convert(path):
    """Wyciąga treść dokumentu klienta i poprawia odnośniki."""
    html = path.read_text(encoding="utf-8")
    body = re.search(r"<main>(.*)</main>", html, re.S).group(1)

    # linki wewnątrz polityki prowadziły do pliku po nazwie — na stronie to te same kotwice
    body = body.replace('href="02_Polityka_prywatnosci_i_cookies.html#', 'href="#')

    # dokumenty, których nie mamy: zostaw sam tekst, usuń odnośnik
    for doc in MISSING_DOCS:
        body = re.sub(
            r'<a href="' + re.escape(doc) + r'[^"]*">(.*?)</a>',
            r"\1",
            body,
            flags=re.S,
        )

    # pierwszy nagłówek dokumentu to tytuł strony
    body = body.replace("<h1>", '<h1 class="legal-h1">', 1)
    # stopka dokumentu klienta (dane operatora) — własna klasa, żeby nie zderzała się ze stopką strony
    body = re.sub(r"<footer>(.*?)</footer>", r'<p class="legal-sig">\1</p>', body, flags=re.S)
    return body.strip()


def main():
    assert SRC.is_dir(), f"brak katalogu {SRC}"
    for page in PAGES:
        body = convert(SRC / page["src"])
        out = ROOT / page["out"]
        out.write_text(shell(page["title"], page["desc"], body, page["out"]), encoding="utf-8")
        left = sum(body.count(d) for d in MISSING_DOCS)
        todo = body.count("{{")
        print(f'{page["out"]}: {len(body) // 1024} KB, nierozwiązane odnośniki={left}, pola do uzupełnienia={todo}')

    # Klient przysłał prywatność i cookies jako jeden dokument.
    # Stary adres zostaje i prowadzi do właściwej części, żeby nie psuć linków.
    target = "polityka-prywatnosci.html#cookies"
    (ROOT / "polityka-cookies.html").write_text(
        f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Polityka cookies — BIFOR</title>
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url={target}">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<main class="legal"><div class="wrap">
  <h1 class="legal-h1">Polityka cookies</h1>
  <p>Cookies opisuje wspólny dokument razem z polityką prywatności.</p>
  <p><a class="link" href="{target}">Przejdź do części „Cookies i technologie urządzenia”</a></p>
</div></main>
<script>location.replace("{target}");</script>
</body>
</html>
""",
        encoding="utf-8",
    )
    print("polityka-cookies.html: przekierowanie na " + target)


if __name__ == "__main__":
    main()
