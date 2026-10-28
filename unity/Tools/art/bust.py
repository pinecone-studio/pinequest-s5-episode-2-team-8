# Dialogue portraits in a JRPG pixel-art style: a head-and-shoulders bust with bold black linework, flat cel shading and a
# clear, anime-realistic face. Each bust is drawn smooth at a high resolution (on a 112×144 grid of units), then reduced to
# 56×72 pixels with a limited palette, and the linework is put back as crisp black pixels.
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

UW, UH = 112, 144          # drawing units
PW, PH = 56, 72            # the finished portrait in pixels
K = 8                      # hi-res pixels per unit (the reduction is K*UW/PW = 16 to 1)
INK = (26, 16, 20)


def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Canvas2:
    """Two pictures drawn together: the colours, and the linework alone (to make the pixel outlines crisp)."""
    def __init__(self):
        self.col = Image.new('RGBA', (UW * K, UH * K), (0, 0, 0, 0)); self.c = ImageDraw.Draw(self.col)
        self.ink = Image.new('L', (UW * K, UH * K), 0); self.i = ImageDraw.Draw(self.ink)

    def P(self, pts): return [(x * K, y * K) for x, y in pts]

    def poly(self, pts, fill):
        self.c.polygon(self.P(pts), fill=fill)

    def ell(self, cx, cy, rx, ry, fill):
        self.c.ellipse([(cx - rx) * K, (cy - ry) * K, (cx + rx) * K, (cy + ry) * K], fill=fill)

    def line(self, pts, w=2.0, col=INK):
        """A line of ink: drawn in the colours and kept as linework."""
        self.c.line(self.P(pts), fill=col, width=int(w * K), joint='curve'); self.i.line(self.P(pts), fill=255, width=int(w * K), joint='curve')

    def oline(self, pts, w=2.0):   # an outline round a closed shape
        self.line(pts + [pts[0]], w)

    def oell(self, cx, cy, rx, ry, w=2.0):
        box = [(cx - rx) * K, (cy - ry) * K, (cx + rx) * K, (cy + ry) * K]
        self.c.ellipse(box, outline=INK, width=int(w * K)); self.i.ellipse(box, outline=255, width=int(w * K))


def bez(p0, p1, p2, n=20):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]


def finish(cv, colours=28):
    """The reduction to pixel art: average down, a small palette, black pixels where the linework is, a black edge round it."""
    small = cv.col.resize((PW, PH), Image.BOX)
    a = np.asarray(small)[:, :, 3]
    rgbim = small.convert('RGB').quantize(colors=colours, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    out = np.dstack([np.asarray(rgbim), np.where(a > 110, 255, 0).astype(np.uint8)])
    ink = np.asarray(cv.ink.resize((PW, PH), Image.BOX)) > 70
    out[ink & (out[:, :, 3] > 0)] = INK + (255,)
    al = out[:, :, 3] > 0; grow = al.copy()
    grow[1:, :] |= al[:-1, :]; grow[:-1, :] |= al[1:, :]; grow[:, 1:] |= al[:, :-1]; grow[:, :-1] |= al[:, 1:]
    out[grow & ~al] = INK + (255,)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


# ---------------------------------------------------------------- the face
def eyes(cv, c, kind, look=(0, 0)):
    iris = rgb(c['iris']); lx, ly = look
    for s in (-1, 1):
        cx, cy = 56 + s * 17, 70
        if kind in ('open', 'wide', 'look', 'down'):
            h = 6.5 if kind != 'wide' else 8.0
            if kind == 'down': h = 5.0
            cv.poly([(cx - 9, cy), (cx - 4, cy - h), (cx + 5, cy - h), (cx + 10, cy - 1), (cx + 5, cy + 4), (cx - 5, cy + 4)], (250, 246, 240))
            cv.ell(cx + lx, cy - 1 + ly, 5.2, 5.8 if kind != 'down' else 4.6, iris)
            cv.ell(cx + lx, cy - 1 + ly, 2.4, 2.8, (24, 12, 10))
            cv.ell(cx - 2 + lx, cy - 3.5 + ly, 1.8, 1.8, (255, 255, 255))
            cv.line([(cx - 10, cy + 1), (cx - 5, cy - h - 0.5), (cx + 5, cy - h - 0.5), (cx + 11, cy - 1)], 3.0)    # the lashes, thick
            cv.line([(cx + s * 9, cy - 1), (cx + s * 12, cy - 3)], 2.0)
            cv.line([(cx - 5, cy + 5), (cx + 5, cy + 5)], 1.2, (150, 90, 70))
        elif kind == 'happy':
            cv.line(bez((cx - 9, cy + 1), (cx, cy - 8), (cx + 9, cy + 1)), 3.0)
        elif kind == 'shut':
            cv.line(bez((cx - 9, cy - 1), (cx, cy + 4), (cx + 9, cy - 1)), 2.6)
        elif kind == 'half':
            cv.poly([(cx - 9, cy), (cx + 10, cy - 1), (cx + 5, cy + 4), (cx - 5, cy + 4)], (250, 246, 240))
            cv.ell(cx, cy + 0.5, 4.6, 3.4, iris); cv.ell(cx, cy + 0.5, 2.0, 2.0, (24, 12, 10))
            cv.line([(cx - 10, cy), (cx + 11, cy - 1.5)], 3.0)


def brows(cv, c, inner, outer):
    col = rgb(c['brow']) if 'brow' in c else INK
    for s in (-1, 1):
        cx = 56 + s * 17
        cv.line([(cx - s * 9, 58 + inner), (cx, 55 + (inner + outer) / 2), (cx + s * 10, 57 + outer)], 3.2, col)


def mouth(cv, c, kind, talk):
    lip, lipl = rgb(c.get('lips', '#d77a68')), rgb(c.get('lipsl', '#f0a08c'))
    cx, cy = 59, 95
    if kind == 'grin' or talk == 2:
        cv.poly(bez((cx - 10, cy - 1), (cx, cy + 12), (cx + 10, cy - 1)), (130, 40, 50)); cv.poly([(cx - 8, cy - 1), (cx + 8, cy - 1), (cx + 7, cy + 2), (cx - 7, cy + 2)], (255, 255, 255))
        cv.line(bez((cx - 10, cy - 1), (cx, cy + 12), (cx + 10, cy - 1)) + [(cx - 10, cy - 1)], 1.8)
    elif talk == 1:
        cv.ell(cx, cy + 1.5, 5, 3.6, (130, 40, 50)); cv.line([(cx - 5, cy), (cx + 5, cy)], 1.6); cv.ell(cx, cy + 3, 2.6, 1.2, (230, 120, 130))
    elif kind in ('smile', 'smug'):
        cv.poly([(cx - 10, cy), (cx + 10, cy - (2 if kind == 'smug' else 0)), (cx + 6, cy + 6), (cx - 6, cy + 6)], lip); cv.poly([(cx - 4, cy + 2.5), (cx + 4, cy + 2.5), (cx + 3, cy + 5), (cx - 3, cy + 5)], lipl)
        cv.line([(cx - 10, cy - 1.5), (cx - 4, cy + 0.5), (cx + 4, cy + 0.5), (cx + 10, cy - (3.5 if kind == 'smug' else 1.5))], 1.8)
    elif kind == 'o':
        cv.ell(cx, cy + 1, 3.6, 4.6, (130, 40, 50)); cv.oell(cx, cy + 1, 3.6, 4.6, 1.6)
    elif kind == 'sad':
        cv.line(bez((cx - 7, cy + 3), (cx, cy - 2), (cx + 7, cy + 3)), 1.8)
    else:   # neutral, flat
        cv.poly([(cx - 8, cy), (cx + 8, cy), (cx + 5, cy + 5), (cx - 5, cy + 5)], lip); cv.poly([(cx - 3, cy + 2), (cx + 3, cy + 2), (cx + 2, cy + 4), (cx - 2, cy + 4)], lipl); cv.line([(cx - 9, cy), (cx + 9, cy)], 1.8)


FACE = {'neutral': ('open', (0, 0), 'flat'), 'happy': ('open', (1, -1), 'smile'), 'laugh': ('happy', (-1, -2), 'grin'), 'wink': ('wink', (0, -2), 'smile'),
        'surprised': ('wide', (-4, -4), 'o'), 'think': ('look', (-2, 1), 'flat'), 'sad': ('down', (-3, 3), 'sad'), 'proud': ('half', (1, -3), 'smug'),
        'tease': ('half', (2, -3), 'smug'), 'excited': ('wide', (-3, -3), 'grin'), 'worried': ('open', (-4, 3), 'sad'), 'shy': ('down', (-1, 1), 'smile'),
        'curious': ('wide', (-1, -4), 'o'), 'stern': ('half', (3, -1), 'flat')}


def bust(c, expr='happy', talk=0, blink=False):
    """One portrait. c: skin, iris, hair (dark, mid, light), deel, panel, trim; hairdo braids | bun | bob | short;
    hat mongol | loovuuz | cap | flower; beard, mustache, glasses, jewels (silver and turquoise), elder, fem."""
    cv = Canvas2(); fem = c.get('fem', False)
    skin, skin_d = rgb(c['skin']), rgb(c['skin_d'])
    hair, hair_d, hair_l = rgb(c['hair'][1]), rgb(c['hair'][0]), rgb(c['hair'][2])
    deel, deel_d, panel, gold = rgb(c['deel']), rgb(c['deel_d']), rgb(c['panel']), rgb(c['trim'])
    do = c.get('hairdo', 'short'); hat = c.get('hat')
    # hair behind: long hair and braids, or a bun
    if do in ('braids', 'bob', 'bun') and fem:
        cv.poly([(18, 50), (28, 18), (56, 8), (86, 18), (98, 50), (100, 110 if do == 'braids' else 92), (90, 128 if do == 'braids' else 100), (24, 128 if do == 'braids' else 100), (14, 110 if do == 'braids' else 92)], hair_d)
    if do == 'braids':
        for s2 in (-1, 1):
            x0 = 56 + s2 * 38; cv.poly([(x0 - 7, 84), (x0 + 7, 84), (x0 + 8, 144), (x0 - 8, 144)], hair)
            for y in range(88, 144, 8): cv.poly([(x0 - 7, y), (x0 + 1, y + 2), (x0 + 7, y + 7), (x0 - 1, y + 5)], hair_l); cv.line([(x0 - 7, y), (x0 + 7, y + 7)], 1.6)
            cv.line([(x0 - 8, 84), (x0 - 8, 144)], 2.0); cv.line([(x0 + 8, 84), (x0 + 8, 144)], 2.0)
    if do == 'bun':
        cv.ell(56, 12, 16, 11, hair); cv.oell(56, 12, 16, 11, 2.2); cv.line([(46, 10), (60, 6)], 1.4, hair_l)
    # the deel: shoulders, a panel of another colour, a high collar with trim and a knot button
    bw = 4 if c.get('broad') else 0
    body = [(2 - bw, 144), (8 - bw, 120), (34, 112), (78, 112), (104 + bw, 120), (110 + bw, 144)]
    cv.poly(body, deel); cv.poly([(2 - bw, 144), (8 - bw, 120), (30, 114), (40, 144)], panel); cv.poly([(80, 144), (92, 116), (104 + bw, 120), (110 + bw, 144)], deel_d)
    cv.oline(body, 2.4)
    if c.get('fur'):   # a fur collar
        fur = rgb(c['fur']); cv.poly([(28, 112), (84, 112), (90, 122), (60, 128), (22, 122)], fur); cv.oline([(28, 112), (84, 112), (90, 122), (60, 128), (22, 122)], 2.0)
    else:
        collar = [(40, 108), (72, 108), (76, 124), (60, 132), (40, 124)]
        cv.poly(collar, deel); cv.line([(40, 108), (40, 124), (60, 132), (76, 124), (72, 108)], 2.4); cv.line([(42, 110), (42, 122), (60, 129), (74, 122)], 2.0, gold)
    cv.line([(60, 130), (62, 144)], 2.0); cv.line([(56, 137), (68, 137)], 3.0, gold); cv.line([(60, 133), (60, 143)], 2.2, gold)
    if c.get('medal'): cv.ell(38, 132, 5, 5, rgb('#ffcf3a')); cv.oell(38, 132, 5, 5, 1.6)
    # the neck and the face (a broader jaw for men)
    jaw = 0 if fem else 4
    cv.poly([(46 - jaw / 2, 96), (70 + jaw / 2, 96), (72 + jaw / 2, 112), (44 - jaw / 2, 112)], skin); cv.poly([(46, 98), (70, 98), (70, 104), (46, 104)], skin_d)
    cv.line([(46 - jaw / 2, 100), (44 - jaw / 2, 112)], 2.0); cv.line([(70 + jaw / 2, 100), (72 + jaw / 2, 112)], 2.0)
    face = [(26, 52), (30, 34), (56, 26), (84, 34), (88, 54), (88 + jaw / 2, 78), (78 + jaw, 98), (64, 108), (50, 108), (36 - jaw, 98), (26 - jaw / 2, 80)]
    cv.poly(face, skin); cv.poly([(76, 60), (88, 54), (88 + jaw / 2, 78), (78 + jaw, 98), (66, 104), (74, 86)], skin_d)
    cv.oline(face, 2.4)
    for s2 in (-1, 1): cv.ell(56 + s2 * 31, 74, 4.5, 8, skin); cv.oell(56 + s2 * 31, 74, 4.5, 8, 2.0)
    # the face itself
    ek, (bi, bo), mk = FACE[expr]
    brows(cv, c, bi + (0 if fem else 1), bo)
    if blink and ek in ('open', 'wide', 'look', 'down', 'half'): eyes(cv, c, 'shut')
    elif ek == 'wink':
        eyes(cv, c, 'open'); cv.poly([(65, 58), (85, 58), (85, 76), (65, 76)], skin); cv.line(bez((64, 71), (73, 63), (82, 71)), 3.0)
    else: eyes(cv, c, ek, (2, -2) if ek == 'look' else (0, 1) if ek == 'down' else (0, 0))
    if c.get('elder'):   # lines of age by the eyes and the mouth
        for s2 in (-1, 1): cv.line([(56 + s2 * 28, 70), (56 + s2 * 30, 74)], 1.2, skin_d); cv.line([(56 + s2 * 10, 90), (56 + s2 * 13, 98)], 1.4, skin_d)
    cv.line([(62, 76), (64, 84), (60, 86)], 1.8)
    if c.get('mark'): cv.ell(40, 84, 1.6, 1.6, INK)
    mouth(cv, c, mk, talk)
    if expr in ('happy', 'laugh', 'shy', 'excited', 'wink'):
        for s2 in (-1, 1): cv.ell(56 + s2 * 20, 86, 6, 3, (236, 140, 120))
    if c.get('mustache') or c.get('beard'):
        if c.get('beard'): cv.poly([(34, 92), (78, 92), (74, 112), (56, 120), (38, 112)], hair); cv.oline([(34, 92), (78, 92), (74, 112), (56, 120), (38, 112)], 2.0); cv.line([(50, 100), (52, 114)], 1.4, hair_l)
        cv.poly([(42, 92), (54, 88), (64, 88), (76, 92), (72, 96), (64, 92), (54, 92), (46, 96)], hair); cv.oline([(42, 92), (54, 88), (64, 88), (76, 92), (72, 96), (64, 92), (54, 92), (46, 96)], 1.6)
    if c.get('glasses'):
        for s2 in (-1, 1): cv.oell(56 + s2 * 17, 69, 11, 9, 2.2)
        cv.line([(50, 68), (62, 68)], 2.0)
    # hair in front
    if fem:
        cv.poly([(24, 56), (26, 30), (44, 14), (56, 12), (54, 26), (44, 40), (34, 56)], hair)
        cv.poly([(56, 12), (72, 14), (90, 30), (92, 58), (82, 50), (76, 34), (60, 24)], hair)
        cv.poly([(56, 18), (48, 30), (40, 44), (42, 52), (50, 38), (58, 26)], hair)
        cv.poly([(60, 22), (70, 30), (78, 42), (74, 48), (66, 34), (60, 28)], hair)
        for pts in ([(26, 30), (40, 18)], [(34, 42), (46, 24)], [(70, 18), (84, 34)], [(80, 46), (74, 30)], [(50, 30), (44, 44)], [(66, 28), (74, 42)]): cv.line(pts, 1.6)
        side = 96 if do in ('braids', 'bob') else 70
        cv.poly([(22, 56), (30, 54), (32, side), (24, side - 4)], hair); cv.poly([(94, 56), (86, 54), (84, side), (92, side - 4)], hair)
        cv.line([(22, 56), (24, side - 4)], 2.0); cv.line([(94, 56), (92, side - 4)], 2.0)
    else:   # short hair: a neat top with a side part
        cv.poly([(24, 52), (26, 30), (40, 16), (60, 12), (80, 16), (92, 32), (92, 52), (84, 40), (64, 34), (44, 36), (32, 44)], hair)
        for pts in ([(36, 24), (48, 34)], [(54, 16), (60, 32)], [(70, 18), (78, 36)]): cv.line(pts, 1.6)
    cv.line([(46, 16), (66, 18), (88, 32)], 1.4, hair_l)
    cv.line([(18 if fem else 24, 52), (28, 18), (56, 8), (86, 18), (98 if fem else 92, 52)], 2.4)
    # hats
    if hat == 'mongol':
        cv.poly([(36, 22), (46, 5), (66, 5), (76, 22)], rgb('#d83a2a')); cv.poly([(52, 5), (60, 5), (58, 22), (54, 22)], rgb('#ff7050')); cv.oline([(36, 22), (46, 5), (66, 5), (76, 22)], 2.2)
        cv.poly([(18, 30), (94, 30), (88, 16), (24, 16)], rgb('#3a2820')); cv.oline([(18, 30), (94, 30), (88, 16), (24, 16)], 2.2); cv.ell(56, 5, 3.4, 3.4, rgb('#ffcf3a')); cv.oell(56, 5, 3.4, 3.4, 1.4)
    elif hat == 'loovuuz':
        cv.poly([(34, 18), (56, 2), (78, 18)], rgb('#2f6fdb')); cv.oline([(34, 18), (56, 2), (78, 18)], 2.2)
        fur = rgb('#8a5a33'); cv.poly([(16, 34), (96, 34), (96, 16), (16, 16)], fur); cv.oline([(16, 34), (96, 34), (96, 16), (16, 16)], 2.2)
        for s2 in (-1, 1): x = 56 + s2 * 38; cv.poly([(x - 6, 30), (x + 6, 30), (x + 6, 74), (x - 6, 74)], fur); cv.oline([(x - 6, 30), (x + 6, 30), (x + 6, 74), (x - 6, 74)], 2.0)
        cv.line([(20, 22), (92, 22)], 1.6, rgb('#c49a6a'))
    elif hat == 'cap':
        cv.poly([(22, 34), (30, 12), (56, 4), (82, 12), (92, 34)], rgb('#3a5a8a')); cv.oline([(22, 34), (30, 12), (56, 4), (82, 12), (92, 34)], 2.2)
        cv.poly([(56, 30), (102, 30), (100, 38), (56, 36)], rgb('#2a3f66')); cv.oline([(56, 30), (102, 30), (100, 38), (56, 36)], 2.0)
    elif hat == 'flower':
        cv.poly([(24, 30), (88, 30), (88, 36), (24, 36)], rgb('#ff6fa8')); cv.oline([(24, 30), (88, 30), (88, 36), (24, 36)], 1.8)
        cv.ell(80, 28, 7, 7, rgb('#ffd34a')); cv.ell(80, 28, 3, 3, rgb('#ff8a1f')); cv.oell(80, 28, 7, 7, 1.6)
    # silver and turquoise jewellery
    if c.get('jewels'):
        silver, turq = rgb('#d6dde6'), rgb('#22b4c8')
        cv.line([(50, 10), (56, 28)], 2.4, silver)
        cv.ell(57, 30, 5, 4.4, silver); cv.ell(57, 30, 3.2, 2.8, turq); cv.oell(57, 30, 5, 4.4, 1.6)
        cv.line([(57, 34), (57, 44)], 2.0, silver); cv.ell(57, 44, 2.2, 2.4, turq); cv.oell(57, 44, 2.2, 2.4, 1.2)
        for s2 in (-1, 1):
            x = 56 + s2 * 36
            cv.poly([(x - 5, 56), (x + 5, 56), (x + 5, 66), (x - 5, 66)], silver); cv.poly([(x - 3, 58), (x + 3, 58), (x + 3, 64), (x - 3, 64)], turq)
            cv.oline([(x - 5, 56), (x + 5, 56), (x + 5, 66), (x - 5, 66)], 1.4)
            for dx in (-3, 0, 3):
                cv.line([(x + dx * 1.3, 66), (x + dx * 1.3, 94)], 2.4, silver); cv.ell(x + dx * 1.3, 74, 2, 2, turq); cv.ell(x + dx * 1.3, 84, 2, 2, turq); cv.ell(x + dx * 1.3, 94, 1.8, 2.2, silver)
    return finish(cv)


WARM, TAN, BROWN, LIGHT = ('#eaa77c', '#c9805a'), ('#d9986c', '#b87850'), ('#c08458', '#9a6440'), ('#f2b890', '#d48e68')
DARK, GREY = ('#2e170e', '#4a2818', '#6e3e26'), ('#8a8690', '#c4c0c8', '#ecebf0')
BLACKH = ('#1c1014', '#2e1c22', '#4a3440')
PEOPLE = {
    'bolormaa': dict(skin=WARM[0], skin_d=WARM[1], iris='#6a3418', brow='#2a1610', hair=DARK, deel='#1f3c94', deel_d='#142a6a', panel='#1f8c90', trim='#d9a33c', hairdo='braids', fem=True, jewels=True, mark=True),
    'emee': dict(skin=WARM[0], skin_d=WARM[1], iris='#5a3a2a', brow='#6a6470', hair=GREY, deel='#6a3fb0', deel_d='#4a2a80', panel='#8f5bd6', trim='#ffcf3a', hairdo='bun', fem=True, glasses=True, elder=True),
    'zasuul': dict(skin=TAN[0], skin_d=TAN[1], iris='#4a2a1a', hair=BLACKH, deel='#e8a812', deel_d='#b07a00', panel='#ffc94a', trim='#d83a2a', hat='mongol', mustache=True),
    'general': dict(skin=BROWN[0], skin_d=BROWN[1], iris='#3a2014', hair=BLACKH, deel='#2f7a3a', deel_d='#1f5428', panel='#3f9a4a', trim='#ffcf3a', hat='loovuuz', mustache=True, broad=True, medal=True),
    'historian': dict(skin=WARM[0], skin_d=WARM[1], iris='#5a2a7a', brow='#2a1610', hair=BLACKH, deel='#8a3fc0', deel_d='#5e2a8a', panel='#ffffff', trim='#ffcf3a', hairdo='bun', fem=True, glasses=True),
    'herder': dict(skin=TAN[0], skin_d=TAN[1], iris='#4a2a1a', hair=BLACKH, deel='#8a4a22', deel_d='#5e3014', panel='#2fa35a', trim='#ffcf3a', hat='mongol'),
    'fisher': dict(skin=BROWN[0], skin_d=BROWN[1], iris='#3a2a1a', brow='#c4c0c8', hair=GREY, deel='#16928c', deel_d='#0e6662', panel='#2a5fb8', trim='#ffffff', hat='cap', beard=True, elder=True),
    'farmer': dict(skin=WARM[0], skin_d=WARM[1], iris='#5a2a1a', brow='#2a1610', hair=('#2a140c', '#4a2414', '#6e3e26'), deel='#2fa34e', deel_d='#1f7034', panel='#ff6fa8', trim='#ffcf3a', hairdo='braids', hat='flower', fem=True),
    'teacher': dict(skin=LIGHT[0], skin_d=LIGHT[1], iris='#2a4a7a', brow='#2a1610', hair=('#1c1014', '#3a2418', '#5a3e30'), deel='#2f6fdb', deel_d='#1f4a96', panel='#ffffff', trim='#ffffff', hairdo='bob', fem=True, glasses=True),
    'trainer': dict(skin=TAN[0], skin_d=TAN[1], iris='#4a2a1a', hair=BLACKH, deel='#e89a12', deel_d='#a86a00', panel='#d83a2a', trim='#3a2820', hat='loovuuz'),
    'archer': dict(skin=BROWN[0], skin_d=BROWN[1], iris='#3a2014', hair=BLACKH, deel='#c8321e', deel_d='#8a2212', panel='#ffcf3a', trim='#ffcf3a', hat='mongol', medal=True),
    'craftsman': dict(skin=BROWN[0], skin_d=BROWN[1], iris='#3a2a1a', brow='#c4c0c8', hair=GREY, deel='#7a4a26', deel_d='#523018', panel='#2f6fdb', trim='#ffcf3a', hat='mongol', mustache=True, elder=True, broad=True, fur='#c8a070'),
}
FACES = ['neutral', 'happy', 'laugh', 'wink', 'surprised', 'think', 'sad', 'proud', 'tease', 'excited', 'worried', 'shy', 'curious', 'stern']


def main():
    import json, os, sys
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources')
    out = os.environ.get('ART_OUT', os.path.join(root, 'Art')); prev = sys.argv[1] if len(sys.argv) > 1 else None
    demo = []
    for pid, c in PEOPLE.items():
        frames = [bust(c, e, talk, blink) for e in FACES for (talk, blink) in ((0, False), (1, False), (0, True), (1, True))]
        sh = Image.new('RGBA', (PW * 4, PH * len(FACES)))
        for i, im in enumerate(frames): sh.paste(im, ((i % 4) * PW, (i // 4) * PH))
        sh.save(os.path.join(out, f'bust_{pid}.png.bytes'), 'PNG', optimize=True)
        demo.append(frames[FACES.index('happy') * 4])
    if not os.environ.get('ART_OUT'):
        with open(os.path.join(root, 'Data', 'bust.json'), 'w') as f: json.dump({'W': PW, 'H': PH, 'faces': FACES, 'cols': 4, 'people': list(PEOPLE)}, f)
    if prev:
        m = Image.new('RGBA', (PW * 6 * 5, PH * 2 * 5), (52, 40, 110, 255))
        for i, im in enumerate(demo): m.alpha_composite(im.resize((PW * 5, PH * 5), Image.NEAREST), ((i % 6) * PW * 5, (i // 6) * PH * 5))
        m.save(os.path.join(prev, 'busts_all.png'))


if __name__ == '__main__':
    main()
