"""Shrink the rendered README PNGs in place (keeps transparency).

Tries a lossless optimize first; only when that is over the size limit does it
fall back to an adaptive palette with error-diffusion dithering.
"""
import os
from PIL import Image

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TARGETS = []
for t in ("light", "dark"):
    TARGETS.append((os.path.join(OUT, f"hero-{t}.png"), 600_000))
    for n in ("quiz", "explain", "dict", "map", "history", "welcome"):
        TARGETS.append((os.path.join(OUT, "screens", f"{n}-{t}.png"), 250_000))


def save(img, tmp):
    img.save(tmp, format="PNG", optimize=True)
    return os.path.getsize(tmp)


for path, limit in TARGETS:
    if not os.path.exists(path):
        continue
    im = Image.open(path).convert("RGBA")
    tmp = path + ".tmp"
    size = save(im, tmp)
    mode = "lossless"
    if size > limit:
        for colors in (256,):
            q = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
            size = save(q, tmp)
            mode = f"palette {colors} dithered"
    os.replace(tmp, path)
    print(f"{os.path.relpath(path, OUT)}: {im.size[0]}x{im.size[1]}, {size} bytes ({mode})")
