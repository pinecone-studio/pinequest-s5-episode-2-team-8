# The story mode's places, painted as pixel-art panoramas in four parallax layers:
#   story_<id>_0 sky (320×180, still), _1 far mountains (480 wide), _2 the middle (640), _3 the ground you walk on (960).
# The view is 320×180; the ground band people walk on is y 118–172 of the near layer.
#   python3 unity/Tools/art/story_bg.py [preview_dir] [only_id]
import math
import os
import random
import sys

import numpy as np

from pix import BAYER4, Canvas, hexc, mix, save, shade

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources', 'Art')
VW, VH = 320, 180
WIDTHS = [320, 480, 640, 960]


# ---------------------------------------------------------------- building blocks
def sky(c, stops, seed=1):
    """A vertical gradient through colour stops [(y, colour)], with ordered dithering between the bands."""
    ys, xs = np.mgrid[0:c.h, 0:c.w]
    for (y0, c0), (y1, c1) in zip(stops, stops[1:]):
        for y in range(int(y0), min(c.h, int(y1) + 1)):
            t = (y - y0) / max(1, (y1 - y0))
            steps = 4
            k = min(steps - 1, int(t * steps)); f = t * steps - k
            ca, cb = mix(c0, c1, k / steps), mix(c0, c1, (k + 1) / steps)
            row = np.where(BAYER4[y % 4, np.arange(c.w) % 4] < f, 1, 0)
            c.a[y, :] = np.where(row[:, None] == 1, np.array(cb), np.array(ca))


def stars(c, n, top, bottom, seed=3, col='#fff6dc'):
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.randrange(c.w), r.randrange(top, bottom)
        b = r.random()
        if b > 0.93:
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                c.px(x + dx, y + dy, mix(col, '#9fb6ff', 0.3) if (dx or dy) else col)
        else:
            c.px(x, y, mix(tuple(c.a[y, x][:3]) + (255,), hexc(col), 0.35 + b * 0.6))


def disc(c, x, y, r, col, halo=None, halo_r=0, craters=False):
    if halo:
        for i, rr in enumerate(range(int(halo_r), int(r), -max(2, int((halo_r - r) / 4)))):
            c.ellipse(x, y, rr, rr, mix(halo, (255, 255, 255, 255), 0) [:3] + (40 + i * 30,), dither=None)
    c.ellipse(x, y, r, r, col)
    c.ellipse(x - r * 0.25, y - r * 0.25, r * 0.7, r * 0.7, shade(col, 0.25), only_on=True)
    if craters:
        rr = random.Random(9)
        for _ in range(6):
            a, d = rr.random() * 6.28, rr.random() * r * 0.6
            c.ellipse(x + math.cos(a) * d, y + math.sin(a) * d, 1.5 + rr.random() * 1.5, 1.2 + rr.random(), shade(col, -0.15), only_on=True)


def cloud(c, x, y, w, h, col, light, shadow, seed=0):
    r = random.Random(seed)
    puffs = [(x + r.uniform(-w / 2, w / 2), y + r.uniform(-h / 3, h / 4), r.uniform(h * 0.5, h)) for _ in range(int(w / 6) + 3)]
    for px_, py_, rr in puffs:
        c.ellipse(px_, py_, rr * 1.3, rr * 0.7, shadow)
    for px_, py_, rr in puffs:
        c.ellipse(px_, py_ - 1, rr * 1.2, rr * 0.6, col)
    for px_, py_, rr in puffs:
        c.ellipse(px_ - rr * 0.3, py_ - rr * 0.35, rr * 0.7, rr * 0.3, light)
    c.rect(int(x - w / 2 - 4), int(y + h * 0.35), int(w + 8), 2, shadow, dither=0.5)


def ridge(w, base, amp, rough, seed, octaves=5, peaks=None):
    """A mountain skyline: y for every x (smaller = higher)."""
    r = random.Random(seed)
    ys = np.full(w, float(base))
    f = 1.0 / w * 2
    a = amp
    for o in range(octaves):
        ph = r.random() * 100
        ys -= a * (np.sin(np.arange(w) * f * math.pi * 2 + ph) * 0.5 + 0.5)
        f *= 2.1; a *= rough
    if peaks:
        for px_, ph, pw in peaks:
            xs = np.arange(w)
            ys -= ph * np.clip(1 - np.abs(xs - px_) / pw, 0, 1) ** 1.6
    return ys


def range_(c, ys, col, light=None, dark=None, snow=None, snow_line=None, light_side=-1, haze=None):
    """Fills a mountain range below a skyline, with lit slopes, shaded slopes and snowy tops."""
    w = c.w
    for x in range(w):
        top = int(ys[x])
        c.a[max(0, top):, x] = hexc(col)
    if light or dark:
        for x in range(1, w - 1):
            top = int(ys[x]); slope = ys[x + 1] - ys[x - 1]
            lit = slope * light_side < 0
            depth = 6 + int(abs(slope) * 3)
            for y in range(max(0, top), min(c.h, top + depth)):
                if light and lit and BAYER4[y % 4, x % 4] < 0.75 - (y - top) / depth * 0.7:
                    c.a[y, x] = hexc(light)
                elif dark and not lit and BAYER4[y % 4, x % 4] < 0.6 - (y - top) / depth * 0.5:
                    c.a[y, x] = hexc(dark)
    if snow:
        for x in range(w):
            top = int(ys[x])
            if top < snow_line:
                end = min(c.h, snow_line + int(3 * math.sin(x * 0.7)))
                for y in range(max(0, top), end):
                    if y < end - 2 or BAYER4[y % 4, x % 4] < 0.5:   # solid snow, broken up only along the snowline
                        c.a[y, x] = hexc(snow) if (x + y) % 9 or y - top < 2 else hexc(shade(snow, -0.12))
    if haze:  # air between you and the mountains: a veil in three soft steps, thicker lower down
        hz = np.array(hexc(haze[0])[:3], float)
        for x in range(w):
            for y in range(max(0, int(ys[x])), c.h):
                t = min(1, max(0, (y - ys[x]) / 40)); f = math.floor(t * 3) / 3 * haze[1] * 1.6
                if f > 0 and c.a[y, x, 3]:
                    c.a[y, x, :3] = (c.a[y, x, :3] * (1 - f) + hz * f).astype(np.uint8)


def larch(c, x, y, h, col, light, dark, snow=None):
    """A Siberian larch / pine: a narrow triangle of drooping tiers."""
    tiers = max(3, h // 3)
    for i in range(tiers):
        ty = y - h + i * h / tiers
        tw = 1 + (i + 1) * h / tiers * 0.38
        c.poly([(x, ty), (x + tw, ty + h / tiers + 1.5), (x - tw, ty + h / tiers + 1.5)], col)
        c.line(int(x - tw * 0.7), int(ty + h / tiers + 1), int(x - 1), int(ty + h / tiers * 0.4), light)
        c.line(int(x + 1), int(ty + h / tiers * 0.5), int(x + tw * 0.8), int(ty + h / tiers + 1), dark)
    c.line(x, y - 1, x, y + 1, dark)
    if snow:
        c.px(x, y - h, snow)


def forest(c, ys_fn, x0, x1, density, hmin, hmax, cols, seed):
    r = random.Random(seed)
    xs = sorted(r.uniform(x0, x1) for _ in range(int((x1 - x0) * density)))
    for x in xs:
        y = ys_fn(x) + r.uniform(0, 4)
        larch(c, int(x), int(y), r.randint(hmin, hmax), *cols)


def ger(c, x, y, s, felt='#efe6d3', shade_='#c9bb9f', door='#d8582c', roof_band='#3f6fb8', smoke=None, lit=False, night=False):
    """A ger seen from the side: felt walls, a domed roof with its ropes, the orange door and a crown. s = width."""
    hh = max(3, int(s * 0.38)); rh = max(2, int(s * 0.2))
    wall = (x - s // 2, y - hh, s, hh)
    fc = shade(felt, -0.35) if night else felt; sc = shade(shade_, -0.35) if night else shade_
    c.rect(*wall, fc)
    c.rect(x - s // 2, y - hh, max(1, s // 6), hh, sc)
    # the roof: a low dome, a rounded cone that meets the crown ring (toono)
    c.ellipse(x, y - hh, s / 2 + 1, rh + 1, fc)
    c.rect(x - s // 2 - 1, y - hh, s + 2, 1, fc)
    c.ellipse(x - s * 0.3, y - hh - rh * 0.2, s * 0.22, rh * 0.8, sc, only_on=True)
    c.rect(x - max(1, s // 10), y - hh - rh - 1, max(2, s // 5) + 1, 2, shade(fc, -0.3))
    if s >= 14:
        for k in (-2, -1, 1, 2):   # the roof ropes running down from the crown
            c.line(x + k * s // 10, y - hh - rh + 1, x + k * s // 4, y - hh - 1, shade(fc, -0.12))
    if s >= 14:
        c.rect(x - s // 2, y - hh, s, 1, roof_band if not night else shade(roof_band, -0.4))       # the band round the top of the wall
        c.rect(x - s // 2, y - max(2, hh // 2), s, 1, shade(sc, -0.1))                          # a girth rope
    dw = max(2, s // 6); dh = max(2, int(hh * 0.75))
    c.rect(x + s // 10, y - dh, dw, dh, '#ffb347' if lit else door)
    if lit:
        c.rect(x + s // 10 - 1, y - 1, dw + 2, 1, '#ffcf6a', dither=0.6)
    c.rect(x - s // 2, y, s, 1, '#00000055')
    if smoke:   # a thin curl of smoke from the crown, fading as it rises and drifts
        r = random.Random(x)
        for i in range(5):
            c.ellipse(x + i * i * 0.5 + r.uniform(-0.5, 0.5), y - hh - rh - 3 - i * 3.5, 0.8 + i * 0.45, 0.6 + i * 0.35, smoke + format(max(18, 110 - i * 22), '02x'))


def tug(c, x, y, h, hair='#f4f1ea', pole='#6b4a2b', night=False):
    """A white standard (tug): a pole with a trident top and nine horse-tail tassels."""
    c.line(x, y, x, y - h, pole)
    c.pxs([(x - 2, y - h), (x - 2, y - h + 1), (x + 2, y - h), (x + 2, y - h + 1), (x, y - h - 2), (x - 1, y - h + 2), (x + 1, y - h + 2)], '#d9c27a')
    hc = shade(hair, -0.4) if night else hair
    for i in range(-2, 3):
        c.line(x + i, y - h + 3, x + i * 1.6 + 1, y - h + 10 + abs(i), hc)
    c.ellipse(x, y - h + 4, 2.5, 1.5, hc)


def horse_sil(c, x, y, col, s=1.0, grazing=False, flip=False):
    """A small horse seen from the side, a few pixels tall: for herds far away."""
    d = -1 if flip else 1
    c.rect(x - int(4 * s), y - int(5 * s), int(8 * s), int(3 * s), col)
    for lx in (-3, -2, 2, 3):
        c.line(x + int(lx * s), y - int(3 * s), x + int(lx * s), y, col)
    if grazing:
        c.line(x + d * int(4 * s), y - int(4 * s), x + d * int(6 * s), y - int(1 * s), col); c.px(x + d * int(6 * s), y - 1, col)
    else:
        c.line(x + d * int(4 * s), y - int(5 * s), x + d * int(6 * s), y - int(8 * s), col); c.rect(x + d * int(6 * s) - (1 if d < 0 else 0), y - int(9 * s), 2, 2, col)
    c.line(x - d * int(4 * s), y - int(5 * s), x - d * int(5 * s), y - int(2 * s), col)


def fire(c, x, y, s=1):
    c.ellipse(x, y - 2, 16 * s, 6 * s, '#ffb05a28'); c.ellipse(x, y - 2, 9 * s, 4 * s, '#ffc46a30')
    c.ellipse(x, y + 1, 4 * s, 1.5 * s, '#3a2516')
    c.poly([(x - 3 * s, y), (x, y - 7 * s), (x + 3 * s, y)], '#e8541e')
    c.poly([(x - 2 * s, y), (x, y - 5 * s), (x + 2 * s, y)], '#ffb347')
    c.poly([(x - 1 * s, y), (x, y - 3 * s), (x + 1 * s, y)], '#fff2a8')


def grass_band(c, y0, y1, base, light, dark, flowers=(), seed=5, density=0.05, night=False):
    """The steppe from y0 down to y1: a gradient of greens with tufts, darker and bigger nearer to you."""
    r = random.Random(seed)
    for y in range(y0, min(c.h, y1)):
        t = (y - y0) / max(1, y1 - y0)
        col = mix(light, base, min(1, t * 1.6)) if t < 0.6 else mix(base, dark, (t - 0.6) / 0.4 * 0.6)
        c.a[y, :] = col
    for _ in range(int(c.w * (y1 - y0) * density)):
        x, y = r.randrange(c.w), r.randrange(y0, min(c.h, y1))
        t = (y - y0) / max(1, y1 - y0); hgt = 1 + int(t * 4)
        tuft = shade(base, -0.25 - t * 0.2) if r.random() < 0.6 else shade(light, 0.15)
        for k in range(hgt):
            c.px(x + (k % 2 if t > 0.5 else 0), y - k, tuft)
        if flowers and r.random() < 0.08 + t * 0.06:
            c.px(x + 1, y - hgt, r.choice(flowers))


def river(c, ys, widths, col, light, dark, shimmer, seed=2):
    """A river flowing across: its middle line ys[x] and width widths[x], lighter towards the far bank with shimmer lines."""
    r = random.Random(seed)
    for x in range(c.w):
        y0, w = ys[x], widths[x]
        for y in range(int(y0 - w / 2), int(y0 + w / 2) + 1):
            if 0 <= y < c.h:
                t = (y - (y0 - w / 2)) / max(1, w)
                c.a[y, x] = hexc(light) if t < 0.18 else hexc(col) if t < 0.75 else hexc(dark)
        if int(y0 - w / 2) - 1 >= 0: c.a[int(y0 - w / 2) - 1, x] = hexc(shade(dark, -0.2))
    for _ in range(c.w // 3):
        x = r.randrange(c.w); y = int(ys[x] + r.uniform(-0.3, 0.3) * widths[x]); L = r.randint(2, 6)
        c.line(x, y, x + L, y, shimmer)


def reflection(c, x, ys, w, col, light):
    """A long shimmering reflection of the sun or moon on the water below x."""
    for k in range(0, 40, 2):
        for x_ in range(int(x - w / 2), int(x + w / 2)):
            if 0 <= x_ < c.w:
                y = int(ys[x_] - 4 + k * 0.25)
                if BAYER4[y % 4, x_ % 4] < 0.5 and abs(x_ - x) < w / 2 - k * 0.15:
                    c.px(x_, y, light if k < 10 else col)


def reeds(c, x0, x1, y, col, light, seed=4, h=10):
    r = random.Random(seed)
    for x in range(x0, x1, 2):
        hh = r.randint(h // 2, h)
        lean = r.choice((-1, 0, 1))
        c.line(x, y, x + lean, y - hh, col)
        if r.random() < 0.3:
            c.rect(x + lean, y - hh - 2, 1, 3, light)


def rock(c, x, y, s, col, light, dark):
    c.ellipse(x, y - s * 0.4, s, s * 0.6, col)
    c.ellipse(x - s * 0.3, y - s * 0.6, s * 0.5, s * 0.3, light, only_on=True)
    c.rect(int(x - s), int(y - 1), int(s * 2), 1, dark)


def tent_raft(c, x, y):
    """A raft of logs pulled up on the bank (they crossed the Khilok on rafts)."""
    for i in range(4):
        c.rect(x, y - i * 2, 18, 2, '#5a3f2a' if i % 2 else '#6e5034')
    c.line(x + 2, y - 7, x + 2, y + 1, '#3a2516'); c.line(x + 15, y - 7, x + 15, y + 1, '#3a2516')


def cart(c, x, y, col='#6e5034', wool=False):
    """A two-wheeled cart (a wool cart, like the one Temüjin hid in)."""
    c.rect(x - 9, y - 9, 18, 5, col); c.rect(x - 9, y - 9, 18, 1, shade(col, 0.2))
    if wool:
        c.ellipse(x, y - 11, 9, 4, '#ece2cc'); c.ellipse(x - 3, y - 12, 4, 2, '#fff8ea')
    c.ellipse(x - 4, y - 3, 3.5, 3.5, '#3a2516'); c.ellipse(x - 4, y - 3, 1.5, 1.5, col)
    c.line(x + 9, y - 6, x + 18, y - 4, col)


# ---------------------------------------------------------------- the scenes
def layers():
    return [Canvas(w, VH) for w in WIDTHS]


def scene_onon1206():
    """Spring 1206, the source of the Onon: the Great Khural raises the white standard. Morning, gold and blue."""
    L = layers()
    sky(L[0], [(0, '#3f78c9'), (60, '#7fb2e6'), (110, '#f3d9a6'), (180, '#f7c98a')])
    disc(L[0], 250, 70, 10, '#fff2c4', '#ffe7a8', 26)
    for i, (x, y, w) in enumerate([(60, 30, 70), (170, 22, 50), (290, 40, 60), (110, 55, 40)]):
        cloud(L[0], x, y, w, 8, '#fdf5ea', '#ffffff', '#e8c9a8', i)
    ys = ridge(480, 108, 34, 0.5, 11, peaks=[(150, 22, 60), (330, 14, 50)])
    range_(L[1], ys, '#7c8fb4', '#a9b8d4', '#62739a', '#eef2f8', 84, haze=('#b9c4dc', 0.35))
    ys2 = ridge(640, 124, 18, 0.45, 12)
    range_(L[2], ys2, '#5f8a5a', '#86ab6c', '#456b48')
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 4, 0, 640, 0.18, 6, 11, ('#2f5a3a', '#4c7b4c', '#203f2a'), 13)
    gy = 128
    for x in range(40, 620, 26):  # rows of gers of the gathered peoples, far off
        ger(L[2], x + (x * 7) % 9, gy - 2 + (x // 26) % 3, 9, smoke='#ffffff')
    g = L[3]
    grass_band(g, 112, 180, '#7aa64f', '#a9c977', '#4f7a35', flowers=('#f7e26b', '#ffffff', '#e86a8a'), seed=21)
    ys_r = np.array([134 + 4 * math.sin(x * 0.012) for x in range(960)]); wr = np.array([9 + 2 * math.sin(x * 0.03) for x in range(960)])
    river(g, ys_r, wr, '#5b9bd8', '#a8d4f2', '#3f74b3', '#e6f4ff')
    for x in (120, 300, 470, 650, 820):  # the great camp, close by
        ger(g, x, 158, 30, smoke='#ffffff', roof_band='#c0392b' if x == 470 else '#3f6fb8')
    tug(g, 520, 160, 40); tug(g, 545, 160, 34)                       # the nine-tailed white standard of the new state
    for x in (420, 600, 700):
        horse_sil(g, x, 170, '#5a3f2a', 1.6, grazing=x != 600)
    return L


def scene_night_raid():
    """About 1184, the Buura steppe by the Khilok river: a night attack on the Merkit camp under a full moon."""
    L = layers()
    sky(L[0], [(0, '#060a1c'), (70, '#14204a'), (130, '#2b3a6e'), (180, '#3d3f6e')])
    stars(L[0], 260, 0, 120, 4)
    disc(L[0], 240, 46, 14, '#f4f0d8', '#c8d4ff', 34, craters=True)
    cloud(L[0], 120, 60, 80, 6, '#2d3966', '#4b5a8f', '#1a2348', 7)
    ys = ridge(480, 118, 28, 0.5, 21)
    range_(L[1], ys, '#1c2546', '#3a4a7c', '#121831')
    ys2 = ridge(640, 132, 12, 0.5, 22)
    range_(L[2], ys2, '#18213b', '#2c3a64', '#0f1528')
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 3, 0, 640, 0.12, 5, 9, ('#0f1a24', '#1d2d3c', '#081018'), 23)
    g = L[3]
    grass_band(g, 120, 180, '#28354a', '#3b4a66', '#151d2b', seed=24, night=True)
    ys_r = np.array([128 + 3 * math.sin(x * 0.01) for x in range(960)]); wr = np.array([7 + 2 * math.sin(x * 0.02 + 1) for x in range(960)])
    river(g, ys_r, wr, '#22355e', '#5a74b0', '#16234a', '#c8d4ff')
    reflection(g, 720, ys_r, 18, '#8fa6e0', '#f4f0d8')
    tent_raft(g, 40, 146); tent_raft(g, 70, 150)                    # the rafts they crossed on
    reeds(g, 0, 160, 140, '#1d2b3a', '#3a5068', 5)
    for x, lit in ((300, True), (360, False), (440, True), (560, True), (640, False), (760, True), (880, True)):
        ger(g, x, 150 + (x // 40) % 5, 28, lit=lit, night=True, smoke='#6a7088')
    for x in (400, 600, 820):
        fire(g, x, 164)
    return L


def scene_birth():
    """1162, Delüün Boldog on the Onon: the evening Temüjin was born. A warm sunset over the river and the hill."""
    L = layers()
    sky(L[0], [(0, '#2b2d6e'), (50, '#7a4a8c'), (95, '#e3708a'), (135, '#f9b25e'), (180, '#ffd98a')])
    disc(L[0], 120, 118, 16, '#fff0b8', '#ffc56e', 38)
    for i, (x, y, w) in enumerate([(220, 40, 90), (60, 60, 60), (290, 75, 50)]):
        cloud(L[0], x, y, w, 7, '#f59a8a', '#ffd0a0', '#9a4a7a', i + 30)
    ys = ridge(480, 126, 30, 0.5, 31, peaks=[(300, 18, 70)])
    range_(L[1], ys, '#7a4a7a', '#c97a7a', '#5a3466', haze=('#c47e8e', 0.3))
    ys2 = ridge(640, 138, 16, 0.5, 32, peaks=[(330, 22, 60)])   # Delüün Boldog, the spleen-shaped hill
    range_(L[2], ys2, '#5a4a5e', '#a86a5e', '#3e3046')
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 3, 380, 640, 0.15, 5, 10, ('#2f2a3a', '#5a4050', '#1e1a26'), 33)
    ger(L[2], 330, int(ys2[330]) + 2, 16, lit=True, smoke='#d9b8c0', felt='#f0d6c0', shade_='#b88a8a')
    g = L[3]
    grass_band(g, 126, 180, '#6a6a3e', '#b0905a', '#3e3a26', flowers=('#ffd27a',), seed=34)
    ys_r = np.array([142 + 6 * math.sin(x * 0.008 + 2) for x in range(960)]); wr = np.array([10 + 3 * math.sin(x * 0.02) for x in range(960)])
    river(g, ys_r, wr, '#c9708a', '#ffd0a0', '#7a3e66', '#fff0c8')
    reflection(g, 180, ys_r, 24, '#f9b25e', '#fff0b8')
    reeds(g, 600, 760, 160, '#3e3a26', '#8a6a3e', 35, 12)
    for x in (480, 520, 860):
        horse_sil(g, x, 172, '#2e2224', 1.5, grazing=True, flip=x > 500)
    return L


def scene_onggirat():
    """About 1171, the Onggirat land between Mount Chekcher and Mount Chikhurkhu: Dei Sechen's camp on a bright summer day."""
    L = layers()
    sky(L[0], [(0, '#2f6fd0'), (80, '#6fb0ee'), (150, '#cfe7f7'), (180, '#e8f3f7')])
    disc(L[0], 60, 30, 9, '#fffbe0', '#fff4c0', 20)
    for i, (x, y, w) in enumerate([(140, 34, 90), (250, 52, 70), (40, 70, 50), (300, 20, 40)]):
        cloud(L[0], x, y, w, 9, '#ffffff', '#ffffff', '#c6d8ee', i + 40)
    ys = ridge(480, 116, 20, 0.45, 41, peaks=[(110, 40, 55), (360, 46, 60)])   # Chekcher and Chikhurkhu
    range_(L[1], ys, '#6f86a8', '#9cb2cf', '#566c90', haze=('#a9bed8', 0.35))
    ys2 = ridge(640, 132, 8, 0.4, 42)
    range_(L[2], ys2, '#7fae5a', '#a3c977', '#5c8a40')
    for x in (200, 240, 270, 420):
        ger(L[2], x, int(ys2[x]) + 3, 12, smoke='#ffffff')
    g = L[3]
    grass_band(g, 120, 180, '#79a84a', '#b3d37e', '#4c7a2e', flowers=('#ffe14d', '#ffffff', '#b77be8', '#ff7a7a'), seed=44, density=0.07)
    for x, s in ((380, 34), (450, 26), (520, 30)):
        ger(g, x, 158, s, smoke='#ffffff')
    for x in (120, 160, 700, 760, 800):
        horse_sil(g, x, 168, '#7a4a2a', 1.6, grazing=x % 3 != 0, flip=x > 500)
    for x in (620, 660, 680):
        horse_sil(g, x, 166, '#f2eee4', 1.2, grazing=True)
    return L


def scene_yellow_steppe():
    """1171, Shira Ke'er, the Yellow Steppe: Yesügei shares a meal with Tatars at dusk. Dark clouds gather."""
    L = layers()
    sky(L[0], [(0, '#1e1a3a'), (50, '#4a2a5a'), (100, '#9a3e4e'), (140, '#d9744a'), (180, '#e9a95a')])
    disc(L[0], 260, 128, 14, '#ffb070', '#e8603a', 30)
    for i, (x, y, w) in enumerate([(80, 30, 120), (220, 45, 110), (300, 20, 80), (150, 65, 70)]):
        cloud(L[0], x, y, w, 10, '#3a2a4a', '#6a3e5a', '#1a1428', i + 50)
    ys = ridge(480, 132, 14, 0.5, 51)
    range_(L[1], ys, '#5a3446', '#8a4a50', '#3e2234')
    ys2 = ridge(640, 140, 6, 0.4, 52)
    range_(L[2], ys2, '#8a5a3a', '#b9804a', '#5e3a26')
    g = L[3]
    grass_band(g, 130, 180, '#b48a4a', '#d9b06a', '#6e4a2a', seed=54)   # dry yellow grass
    for x, s in ((400, 30), (470, 24)):
        ger(g, x, 158, s, felt='#d9c09a', shade_='#a07a5a', lit=True, smoke='#7a5a6a')
    fire(g, 440, 166, 1.3)
    horse_sil(g, 330, 168, '#3a2420', 1.7)
    return L


def scene_autumn_onon():
    """The 1170s, the upper Onon below the Khentii forests: Hö'elün and her children live alone. Grey autumn light."""
    L = layers()
    sky(L[0], [(0, '#5c6a86'), (70, '#8e9bb0'), (140, '#c9c4b8'), (180, '#d9cdb4')])
    for i, (x, y, w) in enumerate([(60, 26, 120), (200, 40, 140), (300, 64, 90), (130, 70, 80)]):
        cloud(L[0], x, y, w, 10, '#b4b8c4', '#d6d8de', '#7c8296', i + 60)
    ys = ridge(480, 112, 30, 0.5, 61, peaks=[(240, 26, 80)])   # the Khentii, Burkhan Khaldun among them
    range_(L[1], ys, '#5d6a74', '#8a96a0', '#46525c', '#e6e9ee', 92, haze=('#9aa4ae', 0.3))
    ys2 = ridge(640, 128, 16, 0.5, 62)
    range_(L[2], ys2, '#6a6a4a', '#8e8a5a', '#4e4e36')
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 4, 0, 640, 0.35, 7, 13, ('#a8782e', '#d9a64a', '#6e4a1e'), 63)   # larches turn gold in autumn
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 8, 0, 640, 0.1, 6, 11, ('#2e4a3a', '#466a50', '#1e3226'), 64)
    g = L[3]
    grass_band(g, 118, 180, '#8a8450', '#b1a66a', '#5a5232', flowers=('#d9a64a', '#a8442a'), seed=65)
    ys_r = np.array([146 + 5 * math.sin(x * 0.01 + 1) for x in range(960)]); wr = np.array([12 + 3 * math.sin(x * 0.025) for x in range(960)])
    river(g, ys_r, wr, '#6a8aa8', '#a9bccd', '#4a6680', '#dde6ee')
    reeds(g, 0, 960, 140, '#6e6a3a', '#b9a65a', 66, 9)
    ger(g, 240, 132, 26, felt='#d9d0bc', smoke='#c9c9cc')                # the family's lone ger
    for x in (120, 520, 780):
        rock(g, x, 172, 7, '#7a7a74', '#a6a69e', '#4a4a46')
    forest(g, lambda x: 128, 600, 960, 0.06, 18, 30, ('#a8782e', '#d9a64a', '#6e4a1e'), 67)
    return L


def scene_tayichiud_night():
    """The Tayichi'ud camp by the Onon on the night of the Red Circle feast: Temüjin's escape."""
    L = layers()
    sky(L[0], [(0, '#05070f'), (90, '#111a33'), (150, '#22284a'), (180, '#2a2a44')])
    stars(L[0], 220, 0, 130, 71)
    disc(L[0], 70, 40, 7, '#e8e4cc', '#9aa8d8', 18, craters=True)
    ys = ridge(480, 120, 26, 0.5, 72)
    range_(L[1], ys, '#141c34', '#26345c', '#0c1224')
    ys2 = ridge(640, 132, 12, 0.5, 73)
    range_(L[2], ys2, '#111a2c', '#1e2c48', '#090e1a')
    forest(L[2], lambda x: ys2[int(min(639, max(0, x)))] + 4, 0, 640, 0.25, 7, 12, ('#0b1520', '#16263a', '#060c14'), 74)
    g = L[3]
    grass_band(g, 120, 180, '#1e2a3a', '#2e3e52', '#111824', seed=75, night=True)
    ys_r = np.array([160 + 3 * math.sin(x * 0.012) for x in range(960)]); wr = np.array([14 + 2 * math.sin(x * 0.03) for x in range(960)])
    river(g, ys_r, wr, '#1a2a4a', '#3e5684', '#0f1a34', '#9fb0dc')
    reeds(g, 560, 960, 152, '#14202c', '#2e4458', 76, 14)
    for x, lit in ((90, True), (170, True), (260, False), (340, True)):
        ger(g, x, 140, 28, lit=lit, night=True, smoke='#4a5068')
    for x in (130, 300):
        fire(g, x, 150)
    cart(g, 470, 146, '#4a3a2a', wool=True)
    return L


SCENES = {
    'onon1206': scene_onon1206, 'night_raid': scene_night_raid, 'birth': scene_birth, 'onggirat': scene_onggirat,
    'yellow_steppe': scene_yellow_steppe, 'autumn_onon': scene_autumn_onon, 'tayichiud_night': scene_tayichiud_night,
}


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    only = sys.argv[2] if len(sys.argv) > 2 else None
    out = os.environ.get('ART_OUT', ROOT)
    for sid, fn in SCENES.items():
        if only and sid != only:
            continue
        L = fn()
        for i, c in enumerate(L):
            save(c, os.path.join(out, f'story_{sid}_{i}.png.bytes'))
        if prev:  # how it looks with the camera at the start of the stage
            v = Canvas(VW, VH)
            for i, c in enumerate(L):
                v.blit(c, 0, 0)
            save(v, os.path.join(prev, f'story_{sid}.png'), os.path.join(prev, f'story_{sid}_x.png'), 3)


if __name__ == '__main__':
    main()
