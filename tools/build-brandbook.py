"""Buduje brandbook BIFOR (brandbook.html) z realnych plików logo.

Czyta assets/img/logo/*.svg, więc dokument zawsze pokazuje aktualny znak.
Użycie: python tools/build-brandbook.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "assets" / "img" / "logo"

C = {
    "violet": "#6F5BD8", "violet_dark": "#4D3BB3", "violet_soft": "#EDE9FA",
    "mint": "#2ED3C0", "mint_deep": "#0F9C8C",
    "ink": "#1E1A30", "ink2": "#5F5A75", "line": "#E6E2EE", "paper": "#F7F5FB",
    "good": "#3E9E63", "warn": "#B98424", "crit": "#C9506F",
}


def parse_logo():
    s = (LOGO / "bifor-logo.svg").read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    d = re.search(r'<path fill="[^"]*" d="([^"]+)"', s).group(1)
    rect = re.search(r"(<rect [^/]*/>)", s).group(1)
    rect = re.sub(r'\s*fill="[^"]*"', "", rect)
    tr = re.search(r'<g transform="(translate\([^)]+\))">', s).group(1)
    return vb, d, rect, tr


def parse_sygnet():
    s = (LOGO / "bifor-sygnet.svg").read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    inner = s[s.index("<rect width="):s.rindex("</svg>")]
    inner = inner.replace('fill="#6F5BD8"', 'fill="var(--sy-bg)"')
    inner = inner.replace('fill="#FFFFFF"', 'fill="var(--sy-letter)"')
    inner = inner.replace('fill="#2ED3C0"', 'fill="var(--sy-cursor)"')
    return vb, inner.strip()


VB, D, CURSOR, TR = parse_logo()
SVB, SYGNET = parse_sygnet()

# Logo jako <symbol>: kolory sterowane zmiennymi, więc jeden kształt obsługuje
# wszystkie warianty i nie rozjedzie się między nimi.
DEFS = f"""<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <symbol id="wm" viewBox="{VB}">
    <g transform="{TR}">
      <path fill="var(--wm-letter, currentColor)" d="{D}"/>
      <g fill="var(--wm-cursor, {C['mint']})">{CURSOR}</g>
    </g>
  </symbol>
  <symbol id="sy" viewBox="{SVB}">{SYGNET}</symbol>
</svg>"""


def wm(h=40, letter=None, cursor=None, cls=""):
    st = []
    if letter:
        st.append(f"--wm-letter:{letter}")
    if cursor:
        st.append(f"--wm-cursor:{cursor}")
    st.append(f"height:{h}px")
    return f'<svg class="wm {cls}" style="{";".join(st)}" role="img" aria-label="BIFOR"><use href="#wm"/></svg>'


def sy(size=88, bg=None, letter=None, cursor=None, cls=""):
    st = [f"width:{size}px", f"height:{size}px"]
    if bg:
        st.append(f"--sy-bg:{bg}")
    if letter:
        st.append(f"--sy-letter:{letter}")
    if cursor:
        st.append(f"--sy-cursor:{cursor}")
    return f'<svg class="sy {cls}" style="{";".join(st)}" role="img" aria-label="BIFOR"><use href="#sy"/></svg>'


# ---------------- sekcje ----------------

variants = [
    ("Podstawowy", "Pierwszy wybór. Białe i bardzo jasne tła.", "#FFFFFF",
     wm(46, C["violet"], C["mint"]), "fiolet #6F5BD8 + mięta #2ED3C0", False),
    ("Na kolorze marki", "Nagłówki, bannery, ekran startowy aplikacji.", C["violet"],
     wm(46, "#FFFFFF", C["mint"]), "biały + mięta #2ED3C0", True),
    ("Na ciemnym", "Stopki, tryb ciemny, prezentacje.", C["ink"],
     wm(46, "#FFFFFF", C["mint"]), "biały + mięta #2ED3C0", True),
    ("Grafitowy", "Dokumenty i materiały, gdzie fiolet byłby zbyt mocny.", "#FFFFFF",
     wm(46, C["ink"], C["mint"]), "grafit #1E1A30 + mięta", False),
    ("Monochrom ciemny", "Faks, grawer, stempel, druk jednokolorowy.", "#FFFFFF",
     wm(46, C["ink"], C["ink"]), "grafit #1E1A30", False),
    ("Monochrom jasny", "Zdjęcia i ciemne tła, gdy mięta ginie.", "#2A2440",
     wm(46, "#FFFFFF", "#FFFFFF"), "biały", True),
]
variant_cards = "".join(
    f'<figure class="vcard"><div class="vprev" style="background:{bg}">{svg}</div>'
    f'<figcaption><b>{name}</b><span>{desc}</span><code>{spec}</code></figcaption></figure>'
    for name, desc, bg, svg, spec, _ in variants)

palette_brand = [
    ("Fiolet BIFOR", C["violet"], "111 91 216", "Kolor główny: logo, przyciski, linki, elementy aktywne."),
    ("Fiolet ciemny", C["violet_dark"], "77 59 179", "Stan po najechaniu, tekst na jasnym fiolecie."),
    ("Fiolet jasny", C["violet_soft"], "237 233 250", "Tła sekcji, podświetlenia, wyróżnione wiersze."),
    ("Mięta", C["mint"], "46 211 192", "Akcent: kursor w logo, drobne wyróżnienia. Nigdy jako tekst."),
    ("Mięta głęboka", C["mint_deep"], "15 156 140", "Mięta tam, gdzie musi być czytelna: tekst, ikony, linie."),
]
palette_neutral = [
    ("Grafit", C["ink"], "30 26 48", "Nagłówki i tekst główny. Zamiast czerni."),
    ("Szary", C["ink2"], "95 90 117", "Tekst pomocniczy, opisy, podpisy."),
    ("Linia", C["line"], "230 226 238", "Ramki, separatory, obrysy kart."),
    ("Papier", C["paper"], "247 245 251", "Tła sekcji i kart na bieli."),
]
palette_status = [
    ("Zielony", C["good"], "62 158 99", "Wykonano, zatwierdzono, opłacono."),
    ("Złoty", C["warn"], "185 132 36", "W trakcie, oczekuje, zbliża się termin."),
    ("Czerwony", C["crit"], "201 80 111", "Brak, błąd, wymaga działania."),
]


def swatches(items):
    return "".join(
        f'<div class="sw"><div class="chip" style="background:{hx}"></div>'
        f'<b>{name}</b><code>{hx}</code><small>RGB {rgb}</small><p>{use}</p></div>'
        for name, hx, rgb, use in items)


donts = [
    ("Nie rozciągaj", 'transform:scaleX(1.45)'),
    ("Nie obracaj", 'transform:rotate(-9deg)'),
    ("Nie zmieniaj kolorów", '--wm-letter:#D2433F;--wm-cursor:#F0A32B'),
    ("Nie dodawaj cienia", 'filter:drop-shadow(3px 4px 2px rgba(0,0,0,.45))'),
    ("Nie ściskaj", 'transform:scaleY(.62)'),
    ("Nie obrysowuj", '-webkit-text-stroke:0;outline:2px dashed #C9506F;outline-offset:7px'),
]
# kolory celowo nie są inline, żeby reguły „czego nie robić” mogły je nadpisać
dont_cards = "".join(
    f'<figure class="dont"><div class="dprev">{wm(34, cls="bad")}</div>'
    f'<figcaption>{label}</figcaption></figure>'.replace('class="wm bad"', f'class="wm bad" data-i="{i}"')
    for i, (label, _) in enumerate(donts))
dont_css = "".join(f'.wm.bad[data-i="{i}"]{{{css}}}' for i, (_, css) in enumerate(donts))

HTML = f"""<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Identyfikacja BIFOR</title>
<meta name="description" content="Księga znaku BIFOR: logotyp, warianty kolorystyczne, sygnet, paleta i typografia.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
/* Układ: wąska kolumna dokumentu, sekcje rozdzielone cienką linią,
   próbki zawsze na realnym tle, na którym mają działać. */
:root{{
  --violet:{C['violet']}; --violet-dark:{C['violet_dark']}; --violet-soft:{C['violet_soft']};
  --mint:{C['mint']}; --mint-deep:{C['mint_deep']};
  --ink:{C['ink']}; --ink2:{C['ink2']}; --line:{C['line']}; --paper:{C['paper']};
  --good:{C['good']}; --warn:{C['warn']}; --crit:{C['crit']};
  --sans:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"Geist Mono",ui-monospace,Consolas,monospace;
  --sy-bg:{C['violet']}; --sy-letter:#FFFFFF; --sy-cursor:{C['mint']};
  color-scheme:light;
}}
*{{box-sizing:border-box}}
body{{margin:0;background:#fff;color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}}
h1,h2,h3{{margin:0;font-weight:500;letter-spacing:-.03em;line-height:1.1;text-wrap:balance}}
p{{margin:0}}
code{{font-family:var(--mono);font-size:13px}}
img,svg{{max-width:100%}}
.wrap{{max-width:1020px;margin:0 auto;padding-inline:32px}}
@media(max-width:600px){{.wrap{{padding-inline:18px}}}}
.wm{{display:block;width:auto}}
.sy{{display:block}}

/* okładka */
.cover{{padding:88px 0 56px}}
.cover .wm{{height:72px}}
@media(max-width:600px){{.cover .wm{{height:46px}} .cover{{padding:52px 0 36px}}}}
.cover h1{{font-size:clamp(30px,5vw,52px);margin-top:44px}}
.cover .sub{{color:var(--ink2);font-size:18px;margin-top:16px;max-width:52ch}}
.meta{{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:32px;padding-top:24px;border-top:1px solid var(--line);font-family:var(--mono);font-size:13px;color:var(--ink2)}}

section{{padding:72px 0;border-top:1px solid var(--line)}}
@media(max-width:600px){{section{{padding:48px 0}}}}
.shead{{display:grid;grid-template-columns:1fr 1fr;gap:24px 56px;align-items:start;margin-bottom:40px}}
@media(max-width:760px){{.shead{{grid-template-columns:1fr;gap:14px}}}}
.num{{font-family:var(--mono);font-size:13px;color:var(--ink2)}}
.shead h2{{font-size:clamp(24px,3.2vw,34px);margin-top:10px}}
.shead p{{color:var(--ink2);max-width:48ch}}

/* warianty */
.vgrid{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}}
@media(max-width:860px){{.vgrid{{grid-template-columns:repeat(2,1fr)}}}}
@media(max-width:520px){{.vgrid{{grid-template-columns:1fr}}}}
.vcard{{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}}
.vprev{{height:132px;display:grid;place-items:center;padding:20px}}
.vcard figcaption{{padding:16px 18px;border-top:1px solid var(--line);display:grid;gap:5px}}
.vcard b{{font-weight:500;font-size:15px}}
.vcard span{{color:var(--ink2);font-size:13.5px}}
.vcard code{{color:var(--ink2)}}

/* sygnet */
.sgrid{{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-end}}
.scell{{display:grid;gap:10px;justify-items:center}}
.scell small{{font-family:var(--mono);font-size:11.5px;color:var(--ink2)}}
.round{{border-radius:50%;overflow:hidden}}
.sizes{{display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-top:12px}}

/* pole ochronne */
.clear{{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center}}
@media(max-width:760px){{.clear{{grid-template-columns:1fr}}}}
.clearbox{{background:var(--paper);border-radius:12px;padding:30px;display:grid;place-items:center}}
.cb-inner{{position:relative;padding:27px;outline:1px dashed var(--violet);outline-offset:0}}
.cb-inner::before{{content:"";position:absolute;inset:27px;outline:1px solid var(--line)}}
.rules{{display:grid;gap:0;margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}}
.rules li{{display:grid;grid-template-columns:1fr auto;gap:16px;padding:13px 0;border-bottom:1px solid var(--line);font-size:15px}}
.rules code{{color:var(--ink2);white-space:nowrap}}

/* nie wolno */
.dgrid{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}}
@media(max-width:760px){{.dgrid{{grid-template-columns:repeat(2,1fr)}}}}
@media(max-width:460px){{.dgrid{{grid-template-columns:1fr}}}}
.dont{{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.dprev{{height:104px;display:grid;place-items:center;background:var(--paper);overflow:hidden;color:var(--violet)}}
.dont figcaption{{padding:12px 16px;border-top:1px solid var(--line);font-size:14px;color:var(--crit)}}
{dont_css}

/* kolory */
.swgrid{{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}}
@media(max-width:900px){{.swgrid{{grid-template-columns:repeat(3,1fr)}}}}
@media(max-width:560px){{.swgrid{{grid-template-columns:repeat(2,1fr)}}}}
.sw{{display:grid;gap:3px}}
.sw .chip{{height:84px;border-radius:10px;border:1px solid rgba(30,26,48,.08);margin-bottom:9px}}
.sw b{{font-weight:500;font-size:14.5px}}
.sw code{{color:var(--ink)}}
.sw small{{font-family:var(--mono);font-size:11.5px;color:var(--ink2)}}
.sw p{{font-size:13px;color:var(--ink2);margin-top:4px}}
.subhead{{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);margin:40px 0 18px}}
.note{{margin-top:26px;padding:16px 18px;background:var(--violet-soft);border-radius:10px;font-size:14.5px;max-width:70ch}}

/* typografia */
.type-row{{display:grid;grid-template-columns:120px 1fr;gap:24px;padding:18px 0;border-bottom:1px solid var(--line);align-items:baseline}}
@media(max-width:560px){{.type-row{{grid-template-columns:1fr;gap:6px}}}}
.type-row .lbl{{font-family:var(--mono);font-size:12px;color:var(--ink2)}}
.t-display{{font-size:clamp(26px,4vw,40px);font-weight:500;letter-spacing:-.035em}}
.t-h2{{font-size:24px;font-weight:500;letter-spacing:-.025em}}
.t-body{{font-size:16px;color:var(--ink2);max-width:62ch}}
.t-mono{{font-family:var(--mono);font-size:14px;color:var(--ink2)}}

/* zastosowania */
.apps{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}
@media(max-width:760px){{.apps{{grid-template-columns:1fr}}}}
.app{{border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.app .bar{{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--line)}}
.app .bar .links{{margin-left:auto;display:flex;gap:16px;font-size:13px;color:var(--ink2)}}
.app .body{{padding:22px 18px;font-size:14px;color:var(--ink2);background:#fff}}
.app.violet .bar{{background:var(--violet);border-bottom:0}}
.app.violet .bar .links{{color:rgba(255,255,255,.8)}}
.post{{background:var(--violet);color:#fff;padding:26px;display:grid;gap:16px;min-height:188px;align-content:space-between}}
.post .claim{{font-size:21px;letter-spacing:-.025em;max-width:22ch}}
.post .claim i{{font-style:normal;color:var(--mint)}}
footer{{padding:48px 0 64px;border-top:1px solid var(--line);color:var(--ink2);font-size:14px;display:flex;flex-wrap:wrap;gap:10px 28px;justify-content:space-between}}
@media(prefers-reduced-motion:reduce){{*{{animation:none!important;transition:none!important}}}}
</style>
</head>
<body>
{DEFS}

<header class="cover wrap">
  {wm(72, C['violet'], C['mint'])}
  <h1>Identyfikacja wizualna</h1>
  <p class="sub">Księga znaku BIFOR: jak używać logotypu, kolorów i typografii, żeby marka wyglądała spójnie wszędzie — w aplikacji, na stronie i w mediach społecznościowych.</p>
  <div class="meta"><span>Wersja 1.0</span><span>Listopad 2026</span><span>TASTEGO sp. z o.o.</span><span>kontakt@bifor.pl</span></div>
</header>

<section class="wrap">
  <div class="shead">
    <div><span class="num">01</span><h2>Znak</h2></div>
    <p>Logotyp to słowo <b>bifor</b> z miętowym kursorem. Kursor niesie główną obietnicę produktu: miejsce, w którym wpisujesz ustalenia raz, a system używa ich wszędzie. Nie jest ozdobą i nie można go usuwać.</p>
  </div>
  <div class="vprev" style="background:var(--paper);border-radius:12px;height:200px">{wm(62, C['violet'], C['mint'])}</div>
  <ul class="rules" style="margin-top:34px">
    <li><span>Litery: Geist SemiBold zamieniony na krzywe</span><code>nie skład tekstem</code></li>
    <li><span>Proporcja logotypu, szerokość do wysokości</span><code>3,85 : 1</code></li>
    <li><span>Odstęp kursora od litery „r”</span><code>0,055 em</code></li>
    <li><span>Grubość kursora, zaokrąglone końce</span><code>0,115 em</code></li>
  </ul>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">02</span><h2>Warianty kolorystyczne</h2></div>
    <p>Sześć wersji na wszystkie tła, jakie spotyka marka. Zawsze wybieraj gotowy plik — nie przekolorowuj logotypu samodzielnie.</p>
  </div>
  <div class="vgrid">{variant_cards}</div>
  <p class="note">Mięta zostaje także w wersji na fiolecie i na grafitcie. Znika tylko w monochromie, czyli tam, gdzie technika druku nie pozwala na drugi kolor.</p>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">03</span><h2>Sygnet</h2></div>
    <p>Skrót znaku do kwadratowych i okrągłych kadrów: avatar na Instagramie i Facebooku, ikona aplikacji, favicon. Wszędzie, gdzie pełny logotyp byłby nieczytelny.</p>
  </div>
  <div class="sgrid">
    <div class="scell">{sy(112)}<small>podstawowy</small></div>
    <div class="scell">{sy(112, '#FFFFFF', C['violet'], C['mint'])}<small>jasny</small></div>
    <div class="scell">{sy(112, C['ink'], '#FFFFFF', C['mint'])}<small>ciemny</small></div>
    <div class="scell"><div class="round">{sy(112)}</div><small>avatar IG / FB</small></div>
  </div>
  <div class="sizes">
    {sy(64)}{sy(48)}{sy(32)}{sy(24)}{sy(16)}
    <small style="font-family:var(--mono);font-size:11.5px;color:var(--ink2)">64 · 48 · 32 · 24 · 16 px</small>
  </div>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">04</span><h2>Pole ochronne i rozmiary</h2></div>
    <p>Wokół znaku zostaw wolną przestrzeń równą połowie wysokości litery „b”. Nic w nią nie wchodzi: ani tekst, ani zdjęcie, ani krawędź materiału.</p>
  </div>
  <div class="clear">
    <div class="clearbox"><div class="cb-inner">{wm(54, C['violet'], C['mint'])}</div></div>
    <ul class="rules">
      <li><span>Pole ochronne</span><code>½ wysokości „b”</code></li>
      <li><span>Logotyp, minimum na ekranie</span><code>90 px szerokości</code></li>
      <li><span>Logotyp, minimum w druku</span><code>20 mm szerokości</code></li>
      <li><span>Sygnet, minimum na ekranie</span><code>24 px</code></li>
      <li><span>Sygnet, minimum w druku</span><code>8 mm</code></li>
    </ul>
  </div>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">05</span><h2>Czego nie robić</h2></div>
    <p>Znak ma stałe proporcje i kolory. Każda z tych zmian osłabia rozpoznawalność marki.</p>
  </div>
  <div class="dgrid">{dont_cards}</div>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">06</span><h2>Kolory</h2></div>
    <p>Fiolet identyfikuje BIFOR, mięta jest akcentem. Jasne tło daje lekkość, a zielony, złoty i czerwony mówią wyłącznie o stanie rzeczy w aplikacji.</p>
  </div>
  <p class="subhead">Kolory marki</p>
  <div class="swgrid">{swatches(palette_brand)}</div>
  <p class="subhead">Neutralne</p>
  <div class="swgrid">{swatches(palette_neutral)}</div>
  <p class="subhead">Kolory statusu</p>
  <div class="swgrid">{swatches(palette_status)}</div>
  <p class="note"><b>Mięta a zieleń statusu.</b> To dwa różne kolory o różnych zadaniach. Mięta należy do marki i pojawia się w logo oraz akcentach. Zieleń statusu mówi „wykonano” i żyje tylko w interfejsie. Nie zamieniaj ich miejscami.</p>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">07</span><h2>Typografia</h2></div>
    <p>Jeden krój w całej marce: <b>Geist</b>, uzupełniony o <b>Geist Mono</b> do liczb, dat i oznaczeń technicznych. Dostępny za darmo w Google Fonts.</p>
  </div>
  <div class="type-row"><span class="lbl">Nagłówek<br>Geist Medium</span><span class="t-display">Wszystkie ustalenia wydarzenia</span></div>
  <div class="type-row"><span class="lbl">Śródtytuł<br>Geist Medium</span><span class="t-h2">Jedno wydarzenie, różne role</span></div>
  <div class="type-row"><span class="lbl">Tekst<br>Geist Regular</span><span class="t-body">BIFOR porządkuje cały proces organizacji wydarzenia. Manager, Zamawiający i zaproszone osoby pracują na jednej aktualnej wersji informacji.</span></div>
  <div class="type-row"><span class="lbl">Dane<br>Geist Mono</span><span class="t-mono">EV-2027-0142 · 12.06.2027 · 118 z 140 gości · 44 604 zł</span></div>
</section>

<section class="wrap">
  <div class="shead">
    <div><span class="num">08</span><h2>Zastosowania</h2></div>
    <p>Trzy sytuacje, w których marka pokazuje się najczęściej.</p>
  </div>
  <div class="apps">
    <div class="app">
      <div class="bar">{wm(26, C['violet'], C['mint'])}<span class="links"><span>Jak działa</span><span>Funkcje</span><span>Kontakt</span></span></div>
      <div class="body">Strona internetowa: logotyp podstawowy na bieli.</div>
    </div>
    <div class="app violet">
      <div class="bar">{wm(24, '#FFFFFF', C['mint'])}<span class="links"><span>Kokpit</span><span>Kalendarz</span></span></div>
      <div class="body">Aplikacja: wersja odwrócona na pasku w kolorze marki.</div>
    </div>
    <div class="app">
      <div class="post">
        <div class="claim">Wszystkie ustalenia wydarzenia.<br><i>Jedno miejsce.</i></div>
        {wm(22, '#FFFFFF', C['mint'])}
      </div>
      <div class="body">Post w mediach społecznościowych: znak w rogu, mięta jako akcent w haśle.</div>
    </div>
    <div class="app">
      <div class="bar" style="gap:16px">{sy(44)}<div><b style="font-weight:500">bifor.pl</b><div style="font-size:13px;color:var(--ink2)">Instagram · Facebook</div></div></div>
      <div class="body">Avatar: sygnet w kadrze kwadratowym i okrągłym.</div>
    </div>
  </div>
</section>

<footer class="wrap">
  <span>BIFOR · Identyfikacja wizualna 1.0</span>
  <span>TASTEGO sp. z o.o. · kontakt@bifor.pl · 510 400 388</span>
</footer>
</body>
</html>
"""

out = ROOT / "brandbook.html"
out.write_text(HTML, encoding="utf-8")
print(f"{out}  ({len(HTML) / 1024:.0f} KB)")
