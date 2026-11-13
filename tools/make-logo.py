"""Buduje logo BIFOR jako krzywe (bez zależności od zainstalowanego fontu).

Logotyp: napis "bifor" w Geist SemiBold zamieniony na ścieżki + miętowy kursor.
Generuje komplet wariantów do assets/img/logo/.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform

OUT = Path(r'C:/Users/olo_p/bifor-www/assets/img/logo')
OUT.mkdir(parents=True, exist_ok=True)
# uwaga: Google Fonts oddało pliki o mylących nazwach — ten zawiera SemiBold
FONT = Path(__file__).parent / "Geist500.ttf"
WORD = "bifor"
TRACKING = -0.028          # lekko zwarty, jak w logotypie na avatarze
CURSOR_GAP = 0.055         # odstęp przed kursorem (w em)
CURSOR_W = 0.46            # szerokość kursora (w em)
CURSOR_H = 0.115           # grubość kursora (w em)

font = TTFont(FONT)
upem = font["head"].unitsPerEm
cmap = font.getBestCmap()
gs = font.getGlyphSet()
hmtx = font["hmtx"]


def glyph_path(name, dx):
    """Ścieżka glifu w układzie SVG (Y w dół), przesunięta o dx."""
    pen = SVGPathPen(gs)
    # odbicie w pionie: font ma Y do góry, SVG w dół
    gs[name].draw(TransformPen(pen, Transform(1, 0, 0, -1, dx, 0)))
    return pen.getCommands()


def word_paths(word, tracking):
    paths, x = [], 0.0
    track = tracking * upem
    for ch in word:
        name = cmap[ord(ch)]
        paths.append(glyph_path(name, x))
        x += hmtx[name][0] + track
    return paths, x - track  # bez trackingu po ostatniej literze


paths, word_w = word_paths(WORD, TRACKING)

# metryki pionowe: wysokość wersalika i x-height z realnych glifów
def bounds(ch):
    bp = BoundsPen(gs)
    gs[cmap[ord(ch)]].draw(bp)
    return bp.bounds  # (xMin, yMin, xMax, yMax)


asc = bounds("b")[3]        # wierzchołek "b" = górna krawędź logotypu
desc = 0                    # "bifor" nie ma znaków podrysowych
xh = bounds("o")[3]

cursor_w = CURSOR_W * upem
cursor_h = CURSOR_H * upem
cursor_x = word_w + CURSOR_GAP * upem
cursor_r = cursor_h / 2     # zaokrąglone końce, jak w oryginale

# kadr: od 0 do końca kursora, od wierzchołka "b" do linii bazowej
W = cursor_x + cursor_w
H = asc
PAD = 0  # logo kadrowane do samego znaku; pole ochronne opisuje brandbook

word_d = " ".join(paths)
cursor = (f'<rect x="{cursor_x:.1f}" y="{-cursor_h:.1f}" '
          f'width="{cursor_w:.1f}" height="{cursor_h:.1f}" rx="{cursor_r:.1f}"/>')

# W SVG baseline = 0, a glify mają ujemne Y (bo odbiliśmy) — przesuwamy w dół o H.
def svg(word_fill, cursor_fill, bg=None, title="BIFOR"):
    rect = f'<rect width="{W:.1f}" height="{H:.1f}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" '
        f'role="img" aria-label="{title}">\n'
        f'  <title>{title}</title>\n'
        f'  {rect}\n'
        f'  <g transform="translate(0 {H:.1f})">\n'
        f'    <path fill="{word_fill}" d="{word_d}"/>\n'
        f'    <g fill="{cursor_fill}">{cursor}</g>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


C = {
    "violet": "#6F5BD8",
    "violet_dark": "#4D3BB3",
    "mint": "#2ED3C0",
    "ink": "#1E1A30",
    "white": "#FFFFFF",
}

variants = {
    "bifor-logo.svg":           svg(C["violet"], C["mint"], None, "BIFOR"),
    "bifor-logo-ink.svg":       svg(C["ink"], C["mint"], None, "BIFOR"),
    "bifor-logo-odwrocone.svg": svg(C["white"], C["mint"], None, "BIFOR"),
    "bifor-logo-mono-czarne.svg": svg(C["ink"], C["ink"], None, "BIFOR"),
    "bifor-logo-mono-biale.svg":  svg(C["white"], C["white"], None, "BIFOR"),
}

for name, data in variants.items():
    (OUT / name).write_text(data, encoding="utf-8")


# ---------- sygnet: "b" + kursor w zaokrąglonym kwadracie ----------
# Do avatarów (Instagram, Facebook), faviconu i ikony aplikacji.
def sygnet(bg, letter_fill, cursor_fill, rounded=True, title="BIFOR"):
    box = 1000
    b_name = cmap[ord("b")]
    b_bounds = bounds("b")
    b_w = b_bounds[2] - b_bounds[0]
    b_h = b_bounds[3]                      # od baseline do wierzchołka

    cur_w, cur_h = 0.46 * upem, 0.115 * upem
    gap = 0.055 * upem
    group_w = b_w + gap + cur_w

    scale = 0.40 * box / b_h               # wysokość "b" = 40% kafelka (zapas na kadr kołowy)
    gw, gh = group_w * scale, b_h * scale
    ox, oy = (box - gw) / 2, (box - gh) / 2 + gh   # oy = baseline

    shape = (f'<rect width="{box}" height="{box}" rx="{box * 0.22:.0f}" fill="{bg}"/>'
             if rounded else f'<rect width="{box}" height="{box}" fill="{bg}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {box} {box}" '
        f'role="img" aria-label="{title}">\n  <title>{title}</title>\n  {shape}\n'
        f'  <g transform="translate({ox:.1f} {oy:.1f}) scale({scale:.4f})">\n'
        f'    <path fill="{letter_fill}" d="{glyph_path(b_name, -b_bounds[0])}"/>\n'
        f'    <rect fill="{cursor_fill}" x="{b_w + gap:.1f}" y="{-cur_h:.1f}" '
        f'width="{cur_w:.1f}" height="{cur_h:.1f}" rx="{cur_h / 2:.1f}"/>\n'
        f'  </g>\n</svg>\n'
    )


sygnety = {
    "bifor-sygnet.svg":        sygnet(C["violet"], C["white"], C["mint"]),
    "bifor-sygnet-jasny.svg":  sygnet(C["white"], C["violet"], C["mint"]),
    "bifor-sygnet-ciemny.svg": sygnet(C["ink"], C["white"], C["mint"]),
    "bifor-sygnet-kwadrat.svg": sygnet(C["violet"], C["white"], C["mint"], rounded=False),
}
for name, data in sygnety.items():
    (OUT / name).write_text(data, encoding="utf-8")
print("sygnety:", ", ".join(sygnety))

meta = {
    "word_width": round(word_w, 1), "height": round(H, 1), "upem": upem,
    "cap_b": round(asc, 1), "x_height": round(xh, 1),
    "cursor": {"x": round(cursor_x, 1), "w": round(cursor_w, 1), "h": round(cursor_h, 1)},
    "ratio_w_h": round(W / H, 3),
}
(OUT / "logo-meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
print(json.dumps(meta, indent=2))
print("warianty:", ", ".join(variants))
