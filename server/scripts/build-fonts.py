# Builds the static TTFs the PNG renderer needs (resvg can't read WOFF2 or pick variable-font axes).
#   python scripts/build-fonts.py        (needs fontTools: pip install --user fonttools)
# Sources: google/fonts at a pinned commit, SIL OFL 1.1, no Reserved Font Names, so instances keep the family names.
# Output: fonts/*.ttf, fonts/*-OFL.txt, fonts/fonts.json (advance widths + covered code points for render.js).
import json
import os
import urllib.request
from io import BytesIO

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

COMMIT = "9710da1eacb3be272583c3224dcb70f9da6eadbb"  # google/fonts main, 2026-10-02
RAW = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")

SOURCES = {
    "doto": (f"{RAW}/doto/Doto%5BROND%2Cwght%5D.ttf", f"{RAW}/doto/OFL.txt", "Doto-OFL.txt"),
    "mono": (f"{RAW}/martianmono/MartianMono%5Bwdth%2Cwght%5D.ttf", f"{RAW}/martianmono/OFL.txt", "MartianMono-OFL.txt"),
}

# file, source, axes, family, style name, usWeightClass, usWidthClass (4 = semi-condensed 87.5 %, 6 = semi-expanded 112.5 %)
INSTANCES = [
    ("Doto-Black.ttf", "doto", {"wght": 900, "ROND": 0}, "Doto", "Black", 900, 5),
    ("MartianMono-SemiCondensed.ttf", "mono", {"wght": 400, "wdth": 87.5}, "Martian Mono", "SemiCondensed", 400, 4),
    ("MartianMono-SemiCondensedExtraBold.ttf", "mono", {"wght": 800, "wdth": 87.5}, "Martian Mono", "SemiCondensed ExtraBold", 800, 4),
    ("MartianMono-SemiExpandedExtraBold.ttf", "mono", {"wght": 800, "wdth": 112.5}, "Martian Mono", "SemiExpanded ExtraBold", 800, 6),
]

# Kept characters: Latin (basic, Latin-1, Extended-A), Cyrillic, punctuation, currency, arrows. Intersected with each font.
RANGES = [(0x20, 0x7E), (0xA0, 0x17F), (0x400, 0x45F), (0x2010, 0x2027), (0x2030, 0x203A), (0x20A0, 0x20BF), (0x2116, 0x2122), (0x2190, 0x2193), (0x2212, 0x2212)]


def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def set_names(font, family, style):
    name = font["name"]
    ps = (family + "-" + style).replace(" ", "")
    keep = {0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17}
    name.names = [n for n in name.names if n.nameID in keep]
    for nid, value in {1: f"{family} {style}", 2: "Regular", 3: f"{ps};{COMMIT[:7]}", 4: f"{family} {style}", 6: ps, 16: family, 17: style}.items():
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)
    name.names = [n for n in name.names if n.platformID in (1, 3)]


def ranges_of(cps):
    out = []
    for cp in sorted(cps):
        if out and out[-1][1] == cp - 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    src = {}
    for key, (ttf_url, ofl_url, ofl_name) in SOURCES.items():
        src[key] = fetch(ttf_url)
        with open(os.path.join(OUT, ofl_name), "wb") as f:
            f.write(fetch(ofl_url).replace(b"\r\n", b"\n"))
    meta = {"source": f"https://github.com/google/fonts/tree/{COMMIT}/ofl", "faces": {}}
    for file, key, axes, family, style, weight, width in INSTANCES:
        font = instancer.instantiateVariableFont(TTFont(BytesIO(src[key])), axes)
        wanted = {cp for a, b in RANGES for cp in range(a, b + 1)} & set(font.getBestCmap())
        opts = subset.Options()
        opts.layout_features = ["ccmp", "locl", "mark", "mkmk"]  # no ligatures: widths stay strictly monospace
        opts.hinting = False  # resvg ignores hinting
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=wanted)
        sub.subset(font)
        for t in ("STAT", "MVAR", "HVAR", "fvar", "gvar", "avar"):
            if t in font:
                del font[t]
        set_names(font, family, style)
        font["OS/2"].usWeightClass = weight
        font["OS/2"].usWidthClass = width
        font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0b1100001) | 0b1000000  # REGULAR bit only
        font["head"].macStyle = 0
        font.save(os.path.join(OUT, file))
        cmap = font.getBestCmap()
        upm = font["head"].unitsPerEm
        meta["faces"][file] = {
            "family": family,
            "style": style,
            "weight": weight,
            "width": width,
            "advance": font["hmtx"][cmap[ord("0")]][0] / upm,  # em; every glyph shares it (monospace)
            "ranges": ranges_of(cmap),
            "bytes": os.path.getsize(os.path.join(OUT, file)),
        }
        print(f"{file}: {meta['faces'][file]['bytes']} bytes, advance {meta['faces'][file]['advance']}em, {len(cmap)} chars")
    with open(os.path.join(OUT, "fonts.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
