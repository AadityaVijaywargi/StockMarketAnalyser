"""
Regenerates the static brand assets in frontend/public/:

    favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180),
    icon-192.png, icon-512.png, og-image.png (1200x630)

Run from the repo root with any Python that has Pillow:

    python frontend/scripts/generate_brand_assets.py

The mark is the same one the app header draws: the lucide "trending-up"
glyph in white on a rounded brand-red square. PNGs are palette-quantised
and saved with optimize=True, which keeps the Open Graph image well under
the size limits link-preview scrapers enforce.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")

BRAND = (197, 27, 41)        # tailwind `brand`
BRAND_TEXT = (229, 72, 77)   # tailwind `brandText`
BG = (8, 8, 8)               # tailwind `background`
SURFACE = (17, 17, 17)
BORDER = (32, 32, 32)
MUTED = (161, 161, 166)
WHITE = (255, 255, 255)

# lucide trending-up, on its native 24-unit grid
TREND_LINE = [(22, 7), (13.5, 15.5), (8.5, 10.5), (2, 17)]
TREND_HEAD = [(16, 7), (22, 7), (22, 13)]

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#c51b29"/>
  <g transform="translate(4 4)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </g>
</svg>
"""


def draw_mark(size: int, supersample: int = 4) -> Image.Image:
    """The app icon at `size` px, drawn large and downsampled for smooth edges."""
    s = size * supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 7 / 32), fill=BRAND)

    pad = s * 4 / 32
    scale = (s - 2 * pad) / 24
    width = max(1, int(s * 2.4 / 32))

    def pts(points):
        return [(pad + x * scale, pad + y * scale) for x, y in points]

    for line in (TREND_LINE, TREND_HEAD):
        p = pts(line)
        d.line(p, fill=WHITE, width=width, joint="curve")
        r = width / 2
        for x, y in (p[0], p[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def font(names, size):
    for name in names:
        for folder in ("C:/Windows/Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"):
            path = os.path.join(folder, name)
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def og_image() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)

    # Same faint grid as the site hero.
    for x in range(0, w, 64):
        d.line([(x, 0), (x, h)], fill=(20, 20, 20), width=1)
    for y in range(0, h, 64):
        d.line([(0, y), (w, y)], fill=(20, 20, 20), width=1)

    bold = ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
    regular = ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]

    mark = draw_mark(96)
    img.paste(mark, (80, 80), mark)
    d.text((196, 88), "STONKS", font=font(bold, 44), fill=WHITE)
    d.text((198, 140), "AI EQUITY RESEARCH", font=font(bold, 18), fill=MUTED)

    d.text((80, 250), "Institution-grade equity", font=font(bold, 68), fill=WHITE)
    d.text((80, 332), "research for Indian markets", font=font(bold, 68), fill=WHITE)

    d.text(
        (80, 440),
        "Deterministic scoring  ·  Live charts  ·  Cost-aware backtests",
        font=font(regular, 28),
        fill=MUTED,
    )

    pill_font = font(bold, 20)
    label = "NSE & BSE  ·  INVITE-ONLY BETA"
    tw = d.textlength(label, font=pill_font)
    d.rounded_rectangle([80, 520, 80 + tw + 40, 564], radius=22, fill=SURFACE, outline=BORDER, width=2)
    d.text((100, 530), label, font=pill_font, fill=BRAND_TEXT)

    # Brand accent bar along the bottom edge.
    d.rectangle([0, h - 8, w, h], fill=BRAND)
    return img


def save_png(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT, name)
    if img.mode == "RGBA":
        img.save(path, optimize=True)
    else:
        img.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(path, optimize=True)
    print(f"{name:22s} {os.path.getsize(path) / 1024:7.1f} KB")


def main() -> int:
    os.makedirs(OUT, exist_ok=True)

    with open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(FAVICON_SVG)
    print(f"{'favicon.svg':22s} {os.path.getsize(os.path.join(OUT, 'favicon.svg')) / 1024:7.1f} KB")

    draw_mark(48).save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{'favicon.ico':22s} {os.path.getsize(os.path.join(OUT, 'favicon.ico')) / 1024:7.1f} KB")

    # iOS applies its own corner mask and ignores transparency, so the touch
    # icon is a full-bleed square rather than the rounded mark.
    touch = Image.new("RGB", (180, 180), BRAND)
    mark = draw_mark(180)
    touch.paste(mark, (0, 0), mark)
    touch.save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
    print(f"{'apple-touch-icon.png':22s} {os.path.getsize(os.path.join(OUT, 'apple-touch-icon.png')) / 1024:7.1f} KB")

    save_png(draw_mark(192), "icon-192.png")
    save_png(draw_mark(512), "icon-512.png")
    save_png(og_image(), "og-image.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
