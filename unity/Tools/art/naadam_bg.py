# The Naadam scenes: the wrestling ground of the stadium (naadam_stadium, 320×180) and the steppe the horse race crosses
# (naadam_race_0..3, parallax layers 320 / 480 / 960 / 1920 wide, with the finish line and its crowd at the far end).
#   python3 unity/Tools/art/naadam_bg.py [preview_dir]
import math
import os
import random
import sys

import numpy as np

from pix import Canvas, hexc, mix, save, shade
from story_bg import cloud, disc, forest, ger, grass_band, horse_sil, range_, ridge, sky, tug

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources', 'Art')
SHIRTS = ['#d8342b', '#2b5bd8', '#f7c646', '#2ea35f', '#ffffff', '#9466e0', '#ff8a1f', '#1fa3a3', '#f06ca8', '#8a5a33']


def mn_flag(c, x, y, w=12, h=8):
    """The flag of Mongolia: red, blue, red, with the yellow Soyombo on the left red stripe."""
    t = w // 3
    c.rect(x, y, t, h, '#c4272f'); c.rect(x + t, y, w - 2 * t, h, '#015197'); c.rect(x + w - t, y, t, h, '#c4272f')
    c.rect(x + t // 2 - 1, y + 1, 2, h - 2, '#f9cf02')


def crowd(c, x0, x1, y0, rows, seed, step=5, size=3):
    r = random.Random(seed)
    for row in range(rows):
        y = y0 + row * (size + 3)
        for x in range(x0 + (row % 2) * 2, x1, step):
            col = r.choice(SHIRTS)
            c.rect(x, y + size - 1, size + 1, size, col)                          # a shirt or deel
            c.rect(x + 1, y, size - 1, size - 1, r.choice(['#e8b48a', '#d8a070', '#c0855a']))   # a face
            if r.random() < 0.35: c.rect(x, y - 1, size + 1, 1, r.choice(['#d8342b', '#2a1c18', '#2b5bd8', '#f7c646']))  # a hat


def stadium():
    c = Canvas(400, 180)   # wide enough for a widescreen without cropping the field
    sky(c, [(0, '#3f86e0'), (50, '#7fb8f0'), (80, '#cfe6f7')])
    for i, (x, y, w) in enumerate([(60, 18, 70), (220, 12, 60), (350, 28, 40)]):
        cloud(c, x, y, w, 7, '#ffffff', '#ffffff', '#cfdcee', i + 80)
    ys = ridge(400, 70, 16, 0.5, 81, peaks=[(300, 10, 70)])
    range_(c, ys, '#7f95b8', '#a7b9d6', '#62789c', haze=('#b4c4dc', 0.3))
    # the stands: three tiers curving round the field, packed with people
    for tier, (top, h, col) in enumerate([(58, 16, '#7a4a26'), (72, 14, '#8a5a33'), (84, 12, '#9a6a3e')]):
        c.rect(0, top, 400, h, col); c.rect(0, top + h - 2, 400, 2, shade(col, -0.3))
        crowd(c, 2, 398, top + 1, 2 if tier else 2, 90 + tier, 5, 3)
    # the officials' pavilion in the middle, roofed like a great ger, with the nine white banners in front
    c.poly([(166, 58), (200, 40), (234, 58)], '#2b5bd8'); c.poly([(166, 58), (200, 40), (200, 58)], '#3f76db')
    c.rect(172, 58, 56, 14, '#f2eee4'); c.rect(172, 58, 56, 2, '#d8342b'); c.rect(196, 62, 8, 10, '#d8342b')
    c.ellipse(200, 40, 3, 2, '#ffd34a')
    for i in range(9):   # the nine white standards
        tug(c, 176 + i * 6, 96, 22)
    for x in (20, 90, 300, 370):
        c.line(x, 40, x, 58, '#4a3a2a'); mn_flag(c, x + 1, 40)
    # the grass field
    grass_band(c, 96, 180, '#5fa83f', '#8fcf63', '#3e7a2a', flowers=('#ffffff', '#ffe14d'), seed=95, density=0.04)
    c.rect(0, 96, 400, 2, '#2e5a20')
    # a low fence with blue and red paint round the field
    for x in range(0, 400, 8):
        c.rect(x, 97, 6, 3, '#2b5bd8' if (x // 8) % 2 else '#d8342b')
    return c


def race_layers():
    """The horse race crosses the open steppe: far mountains, hills with gers and herds, the track, and the finish."""
    L = [Canvas(w, 180) for w in (320, 480, 960, 1920)]
    sky(L[0], [(0, '#2f6fd0'), (70, '#79b6ee'), (130, '#d6ecf7'), (180, '#eef6f7')])
    disc(L[0], 260, 30, 9, '#fffbe0', '#fff4c0', 20)
    for i, (x, y, w) in enumerate([(70, 30, 90), (180, 46, 80), (300, 20, 50)]):
        cloud(L[0], x, y, w, 8, '#ffffff', '#ffffff', '#c6d8ee', i + 100)
    ys = ridge(480, 104, 30, 0.5, 101, peaks=[(120, 18, 70), (380, 24, 60)])
    range_(L[1], ys, '#7a8fb2', '#a5b8d4', '#5e7398', '#eef2f8', 80, haze=('#aebfd8', 0.35))
    ys2 = ridge(960, 124, 14, 0.45, 102)
    range_(L[2], ys2, '#7fae5a', '#a3c977', '#5c8a40')
    r = random.Random(103)
    for x in range(40, 960, 130):
        ger(L[2], x + r.randint(-20, 20), int(ys2[min(959, x)]) + 4, 10, smoke='#ffffff')
    for x in range(80, 960, 90):
        horse_sil(L[2], x, int(ys2[min(959, x)]) + 8, '#7a4a2a', 1.0, grazing=True)
    g = L[3]
    grass_band(g, 126, 180, '#79a84a', '#b3d37e', '#4c7a2e', flowers=('#ffe14d', '#ffffff', '#b77be8'), seed=104, density=0.05)
    # the track: a band of trampled earth the riders gallop along
    for y in range(136, 172):
        t = (y - 136) / 36
        g.a[y, :] = hexc(mix('#c9a46a', '#a8814a', t))
    for x in range(0, 1920, 3):
        if r.random() < 0.6: g.px(x, r.randint(137, 171), '#8a6a3a')
    # the finish: a line of people, flags and the finish post near the end of the track
    fx = 1760
    for i in range(14):
        mn_flag(g, fx - 200 + i * 28, 104, 10, 7); g.line(fx - 200 + i * 28, 104, fx - 200 + i * 28, 126, '#4a3a2a')
    crowd(g, fx - 220, 1920, 114, 2, 105, 4, 3)
    crowd(g, fx - 220, 1920, 172, 1, 106, 4, 3)
    g.rect(fx, 112, 3, 60, '#ffffff'); g.rect(fx, 112, 3, 6, '#d8342b'); g.rect(fx + 3, 112, 14, 8, '#d8342b'); g.rect(fx + 3, 120, 14, 1, '#ffffff')
    for y in range(136, 172, 4): g.rect(fx, y, 3, 2, '#2a1c18')
    for x in (300, 700, 1100, 1500):    # people and gers along the way, watching
        ger(g, x, 126, 22, smoke='#ffffff')
        crowd(g, x + 18, x + 60, 120, 1, x, 5, 3)
    return L


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    out = os.environ.get('ART_OUT', ROOT)
    s = stadium(); save(s, os.path.join(out, 'naadam_stadium.png.bytes'), prev and os.path.join(prev, 'naadam_stadium.png'), 3)
    L = race_layers()
    for i, c in enumerate(L):
        save(c, os.path.join(out, f'naadam_race_{i}.png.bytes'))
    if prev:
        v = Canvas(320, 180)
        for i, c in enumerate(L): v.blit(c, -(c.w - 320) if i == 3 else 0, 0)
        save(v, os.path.join(prev, 'naadam_race.png'), os.path.join(prev, 'naadam_race_x.png'), 3)


if __name__ == '__main__':
    main()
