"""Buduje wersję produkcyjną strony BIFOR pod https://bifor.pl (hosting OVH).

Źródła w repozytorium są wersją podglądową (noindex, adresy GitHub Pages).
Skrypt składa z nich katalog dist/ gotowy do wgrania na serwer:
  - usuwa noindex, wstawia adresy bifor.pl (canonical, og:url, og:image),
  - dopisuje do CSS/JS znacznik wersji (długie cache bez ryzyka starej wersji),
  - kopiuje tylko pliki, do których strona naprawdę się odwołuje,
  - dodaje send.php, .htaccess, robots.txt, sitemap.xml i 404.html,
  - pakuje całość do export/bifor-pl-produkcja.zip.

Użycie: python tools/build-prod.py
"""
import hashlib
import json
import re
import shutil
import sys
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SITE = "https://bifor.pl"
PREVIEW = "https://olekcodetech.github.io/bifor-www"
# klucz IndexNow (Bing i inne wyszukiwarki): plik <klucz>.txt w katalogu głównym potwierdza, że zgłoszenia adresów są nasze
INDEXNOW_KEY = "7a2395e199512a72f27f268166180e9c"

# strona -> adres kanoniczny (None = strona techniczna, zostaje poza indeksem)
PAGES = {
    "index.html": "/",
    "dolacz.html": "/dolacz.html",
    "regulamin.html": "/regulamin.html",
    "polityka-prywatnosci.html": "/polityka-prywatnosci.html",
    "polityka-cookies.html": None,
}

HTACCESS = r"""# BIFOR — bifor.pl
Options -Indexes
DirectoryIndex index.html
AddDefaultCharset UTF-8
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
RewriteEngine On

# --- HTTPS i jedna wersja adresu (bez www) ---
# Certyfikaty Let's Encrypt dla bifor.pl i www.bifor.pl działają od 18.11.2026.
# Przekierowanie rusza tylko wtedy, gdy wszystkie trzy znaki mówią „to nie jest https”
# — dzięki temu nie zapętli się, nawet jeśli serwer podaje tylko część z nich.
RewriteCond %{SERVER_PORT} ^80$
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteRule ^ https://bifor.pl%{REQUEST_URI} [R=301,L]
RewriteCond %{HTTP_HOST} ^www\.bifor\.pl$ [NC]
RewriteRule ^ https://bifor.pl%{REQUEST_URI} [R=301,L]

# krótkie adresy
RewriteRule ^(dolacz|kontakt|prezentacja)/?$ /dolacz.html [R=301,L]
RewriteRule ^regulamin/?$ /regulamin.html [R=301,L]
RewriteRule ^polityka-prywatnosci/?$ /polityka-prywatnosci.html [R=301,L]
</IfModule>

<IfModule mod_headers.c>
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set X-Frame-Options "SAMEORIGIN"
# pliki z numerem wersji w adresie i obrazy mogą leżeć w pamięci przeglądarki długo
<FilesMatch "\.(css|js|woff2|webp|png|svg|jpg)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\.(html|php)$">
Header set Cache-Control "no-cache"
</FilesMatch>
</IfModule>

<IfModule mod_mime.c>
AddType font/woff2 .woff2
AddType image/webp .webp
AddType image/svg+xml .svg
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml application/json text/plain application/xml
</IfModule>
"""

NOT_FOUND = """<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Nie ma takiej strony — BIFOR</title>
<meta name="theme-color" content="#6F5BD8">
<link rel="icon" href="/assets/img/logo/bifor-sygnet.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/style.css{v}">
</head>
<body>
<header class="nav"><div class="wrap nav-in">
  <a href="/" class="logo" aria-label="BIFOR — strona główna"><img src="/assets/img/logo/bifor-logo.svg" alt="BIFOR" width="104" height="27"></a>
  <div class="nav-end" style="display:flex"><a class="btn btn-primary btn-sm" href="/dolacz.html" style="display:inline-flex">Umów prezentację</a></div>
</div></header>
<main class="doc"><div class="wrap"><div class="in">
  <h1>Nie ma takiej strony.</h1>
  <p>Adres mógł się zmienić albo zawiera literówkę.</p>
  <p><a class="btn btn-line" href="/">Wróć na stronę główną</a></p>
</div></div></main>
</body>
</html>
"""


def version_of(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def faq_items(html):
    """Pytania i odpowiedzi z sekcji FAQ strony głównej — do danych strukturalnych."""
    items = []
    for q, a in re.findall(r"<details[^>]*><summary>(.*?)<i></i></summary><div class=\"ans\">(.*?)</div></details>", html, re.S):
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", a)).strip()
        items.append({"@type": "Question", "name": q.strip(), "acceptedAnswer": {"@type": "Answer", "text": text}})
    assert len(items) >= 8, "nie znalazłem pytań FAQ na stronie głównej"
    return items


def schema(html):
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": SITE + "/#organizacja",
                "name": "BIFOR",
                "legalName": "TASTEGO sp. z o.o.",
                "url": SITE + "/",
                "logo": SITE + "/assets/img/logo/bifor-sygnet-kwadrat.svg",
                "email": "kontakt@bifor.pl",
                "telephone": "+48510400388",
                "sameAs": ["https://www.instagram.com/bifor.pl/", "https://www.facebook.com/biforpl"],
            },
            {
                "@type": "WebSite",
                "@id": SITE + "/#strona",
                "url": SITE + "/",
                "name": "BIFOR",
                "inLanguage": "pl-PL",
                "publisher": {"@id": SITE + "/#organizacja"},
            },
            {"@type": "FAQPage", "@id": SITE + "/#faq", "mainEntity": faq_items(html)},
            {
                "@type": "SoftwareApplication",
                "name": "BIFOR",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "System do zarządzania przyjęciami dla sal weselnych, restauracji, hoteli i obiektów eventowych.",
                "url": SITE + "/",
                "publisher": {"@id": SITE + "/#organizacja"},
            },
        ],
    }
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def build_page(name, canonical, versions):
    html = (ROOT / name).read_text(encoding="utf-8")

    if canonical is not None:
        html, n = re.subn(r'<meta name="robots" content="noindex, nofollow">(<!--.*?-->)?\n', "", html)
        assert n == 1, f"{name}: nie znalazłem znacznika noindex"
        url = SITE + canonical
        html = html.replace("<title>", f'<link rel="canonical" href="{url}">\n<title>', 1)
        if 'property="og:url"' not in html:
            html = html.replace("<title>", f'<meta property="og:url" content="{url}">\n<title>', 1)
    html = html.replace(PREVIEW + "/", SITE + "/")
    assert "github.io" not in html, f"{name}: został adres podglądu"

    # strona główna pod adresem katalogu, nie /index.html
    html = html.replace('href="index.html#', 'href="./#').replace('href="index.html"', 'href="./"')

    for ref, v in versions.items():
        html = html.replace(f'"{ref}"', f'"{ref}?v={v}"')
    if name == "index.html":
        html = html.replace("</head>", schema(html) + "\n</head>", 1)
    return html


def referenced(text):
    """Ścieżki plików z assets/, do których odwołuje się HTML lub CSS."""
    found = set(re.findall(r'assets/[\w./-]+\.(?:css|js|svg|webp|png|jpg|woff2)', text))
    return found


def main():
    # czyścimy zawartość, nie sam katalog — bywa otwarty w eksploratorze albo terminalu
    DIST.mkdir(exist_ok=True)
    for child in DIST.iterdir():
        shutil.rmtree(child) if child.is_dir() else child.unlink()

    css = ROOT / "assets/css/style.css"
    versions = {"assets/css/style.css": version_of(css)}
    for js in sorted((ROOT / "assets/js").glob("*.js")):
        versions[f"assets/js/{js.name}"] = version_of(js)

    refs = set()
    for name, canonical in PAGES.items():
        html = build_page(name, canonical, versions)
        (DIST / name).write_text(html, encoding="utf-8")
        refs |= referenced(html)

    # czcionki i obrazy wskazane w CSS (ścieżki względem assets/css/)
    css_text = css.read_text(encoding="utf-8")
    refs |= {"assets/" + m for m in re.findall(r'url\("?\.\./([\w./-]+)"?\)', css_text)}
    refs |= {"assets/img/og.png", "assets/img/logo/bifor-sygnet-kwadrat.svg", "assets/img/logo/bifor-logo.svg", "assets/img/logo/bifor-sygnet.svg"}

    missing = [r for r in sorted(refs) if not (ROOT / r).is_file()]
    assert not missing, "brak plików: " + ", ".join(missing)
    for r in sorted(refs):
        dst = DIST / r
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / r, dst)

    shutil.copyfile(ROOT / "send.php", DIST / "send.php")
    (DIST / f"{INDEXNOW_KEY}.txt").write_text(INDEXNOW_KEY, encoding="utf-8")
    # przeglądarki i Google pytają o /favicon.ico w katalogu głównym
    shutil.copyfile(ROOT / "assets" / "img" / "logo" / "favicon.ico", DIST / "favicon.ico")
    (DIST / ".htaccess").write_text(HTACCESS, encoding="utf-8", newline="\n")
    (DIST / "404.html").write_text(NOT_FOUND.replace("{v}", "?v=" + versions["assets/css/style.css"]), encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /send.php\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8", newline="\n")

    today = date.today().isoformat()
    urls = "".join(
        f"  <url><loc>{SITE}{c}</loc><lastmod>{today}</lastmod></url>\n" for c in PAGES.values() if c is not None
    )
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n",
        encoding="utf-8", newline="\n",
    )

    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    out = ROOT / "export" / "bifor-pl-produkcja.zip"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            z.write(p, p.relative_to(DIST).as_posix())
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None, "uszkodzone archiwum"
        count = len(z.namelist())

    size = sum(p.stat().st_size for p in files)
    print(f"dist/: {len(files)} plików, {size / 1024 / 1024:.1f} MB")
    print(f"{out.relative_to(ROOT)}: {count} plików, {out.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
