# A tiny pixel-art toolkit for the hand-built pictures in Resources/Art (Bolormaa, Temüjin, the story mode scenes).
# Every shape is drawn hard-edged (no anti-aliasing), so the pictures stay crisp pixel art when Unity scales them up.
# Needs Pillow and numpy:  python3 -m pip install pillow numpy
import math
import random

import numpy as np
from PIL import Image, ImageDraw

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def hexc(h, a=255):
    """'#rrggbb' or '#rrggbbaa' (or an RGB/RGBA tuple) to an RGBA tuple."""
    if not isinstance(h, str):
        return tuple(int(v) for v in h[:3]) + ((int(h[3]),) if len(h) > 3 else (a,))
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16) if len(h) >= 8 else a)


def mix(c1, c2, t):
    a, b = hexc(c1), hexc(c2)
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def shade(c, f):
    """f < 0 darkens towards a cool shadow, f > 0 lightens towards a warm light."""
    c = hexc(c)
    if f < 0:
        return mix(c, (40, 24, 48, c[3]), -f)
    return mix(c, (255, 246, 222, c[3]), f)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    # ---------------------------------------------------------------- masks
    def _mask(self, draw_fn):
        m = Image.new('L', (self.w, self.h), 0)
        draw_fn(ImageDraw.Draw(m))
        return np.array(m) > 127

    def paint(self, mask, c, only_on=False, dither=None):
        """Paints colour c where mask is set. only_on: only over pixels already drawn (shading inside a shape).
        dither: 0..1, how much of the area gets the colour, spread with a Bayer pattern (soft gradients in pixel art)."""
        c = hexc(c) if isinstance(c, str) else c
        m = mask.copy()
        if only_on:
            m &= self.a[:, :, 3] > 0
        if dither is not None:
            ys, xs = np.mgrid[0:self.h, 0:self.w]
            d = dither if np.ndim(dither) else np.full((self.h, self.w), dither)
            m &= BAYER4[ys % 4, xs % 4] < d
        if c[3] == 255:
            self.a[m] = c
        else:
            al = c[3] / 255.0
            src = np.array(c[:3], float)
            dst = self.a[m][:, :3].astype(float)
            out = dst * (1 - al) + src * al
            self.a[m, :3] = out.astype(np.uint8)
            self.a[m, 3] = np.maximum(self.a[m, 3], c[3])

    # ---------------------------------------------------------------- shapes
    def rect(self, x, y, w, h, c, **k):
        self.paint(self._mask(lambda d: d.rectangle([x, y, x + w - 1, y + h - 1], fill=255)), c, **k)

    def ellipse(self, cx, cy, rx, ry, c, **k):
        self.paint(self._mask(lambda d: d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)), c, **k)

    def poly(self, pts, c, **k):
        self.paint(self._mask(lambda d: d.polygon([tuple(p) for p in pts], fill=255)), c, **k)

    def line(self, x0, y0, x1, y1, c, w=1, **k):
        self.paint(self._mask(lambda d: d.line([x0, y0, x1, y1], fill=255, width=w)), c, **k)

    def lines(self, pts, c, w=1, **k):
        self.paint(self._mask(lambda d: d.line([tuple(p) for p in pts], fill=255, width=w, joint='curve')), c, **k)

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = hexc(c) if isinstance(c, str) else c

    def pxs(self, pts, c):
        for x, y in pts:
            self.px(x, y, c)

    def limb(self, x0, y0, x1, y1, r0, r1, c, **k):
        """A tapered capsule from (x0,y0) radius r0 to (x1,y1) radius r1: arms, legs, braids."""
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 2))
        def f(d):
            for i in range(n + 1):
                t = i / n
                x, y, r = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t
                d.ellipse([x - r, y - r, x + r, y + r], fill=255)
        self.paint(self._mask(f), c, **k)

    def alpha_mask(self):
        return self.a[:, :, 3] > 0

    # ---------------------------------------------------------------- finishing
    def outline(self, c, inner_from=None):
        """A 1px outline round everything drawn. inner_from: also darken edge pixels between two very different colours."""
        c = hexc(c) if isinstance(c, str) else c
        m = self.alpha_mask()
        grow = m.copy()
        grow[1:, :] |= m[:-1, :]; grow[:-1, :] |= m[1:, :]; grow[:, 1:] |= m[:, :-1]; grow[:, :-1] |= m[:, 1:]
        edge = grow & ~m
        self.a[edge] = c

    def blit(self, o, x, y, flip=False):
        src = o.a[:, ::-1] if flip else o.a
        h, w = src.shape[:2]
        for yy in range(h):
            ty = y + yy
            if not 0 <= ty < self.h:
                continue
            for xx in range(w):
                tx = x + xx
                if 0 <= tx < self.w and src[yy, xx, 3] > 0:
                    self.a[ty, tx] = src[yy, xx]

    def copy(self):
        c = Canvas(self.w, self.h); c.a = self.a.copy(); return c

    def image(self):
        return Image.fromarray(self.a, 'RGBA')


def sheet(frames, cols):
    """Packs equally sized canvases into one sheet, left to right, top to bottom."""
    w, h = frames[0].w, frames[0].h
    rows = (len(frames) + cols - 1) // cols
    s = Canvas(w * cols, h * rows)
    for i, f in enumerate(frames):
        s.a[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w:(i % cols + 1) * w] = f.a
    return s


def save(c, path, preview=None, scale=4):
    c.image().save(path, 'PNG', optimize=True)
    if preview:
        im = c.image()
        bg = Image.new('RGBA', im.size, (226, 214, 196, 255)); bg.alpha_composite(im)
        bg.resize((im.width * scale, im.height * scale), Image.NEAREST).save(preview)
