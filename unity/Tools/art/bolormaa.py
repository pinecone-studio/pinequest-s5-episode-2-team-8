# Guide Bolormaa: a full-body sprite (8 poses × 2 frames) and her faces (13 expressions × mouth open × blink),
# written to Resources/Art as bolormaa_body / bolormaa_faces, with the layout in Resources/Data/bolormaa.json.
#   python3 unity/Tools/art/bolormaa.py [preview_dir]
import json
import os
import sys

import numpy as np

from pix import Canvas, hexc, save, sheet

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources')
W, H = 64, 112
HX, HY = 32, 26                      # the middle of her face
FW, FH, FX, FY = 26, 22, HX - 13, HY - 8  # the face overlay: its size and where it sits on the body

OUT = '#2a1620'
SKIN, SKIN_S, SKIN_D, BLUSH = '#f6cfab', '#e3a982', '#c98462', '#f4978c'
HAIR, HAIR_M, HAIR_L, HAIR_HI = '#24151d', '#3b2230', '#5d3a4c', '#8a5c72'
DEEL, DEEL_S, DEEL_D, DEEL_L = '#3f8ae0', '#2c67b4', '#1f4b8a', '#86bdf5'
GOLD, GOLD_D, GOLD_L = '#f3c14b', '#c4881f', '#ffe08a'
SASH, SASH_D, SASH_L = '#f2842c', '#c25a16', '#ffb066'
CUFF, CUFF_D = '#e2463e', '#a82c2a'
BOOT, BOOT_D, BOOT_L = '#b5342c', '#6e1d1c', '#de5a4c'
CORAL, SILVER, WHITE = '#ff6b57', '#dfe5ee', '#fffaf0'
IRIS, IRIS_D, IRIS_L = '#5a3220', '#2e1810', '#a8673e'
MOUTH, TONGUE = '#8e2f3a', '#e8737a'

# arms: (shoulder, elbow, wrist) for the left and right arm as you look at her; None = the idle arm
IDLE_L, IDLE_R = ((22, 45), (19, 58), (19, 71)), ((42, 45), (45, 58), (45, 71))
POSES = {
    'idle':  [dict(L=IDLE_L, R=IDLE_R), dict(L=IDLE_L, R=IDLE_R, bob=-1)],
    'talk':  [dict(L=IDLE_L, R=((42, 45), (48, 57), (52, 50))), dict(L=IDLE_L, R=((42, 45), (48, 57), (53, 48)), bob=-1)],
    'wave':  [dict(L=IDLE_L, R=((42, 45), (49, 39), (50, 27))), dict(L=IDLE_L, R=((42, 45), (49, 39), (55, 29)), bob=-1)],
    'point': [dict(L=IDLE_L, R=((42, 45), (51, 47), (58, 44))), dict(L=IDLE_L, R=((42, 45), (51, 47), (59, 43)), bob=-1)],
    'cheer': [dict(L=((22, 45), (15, 37), (13, 26)), R=((42, 45), (49, 37), (51, 26))), dict(L=((22, 45), (14, 36), (11, 25)), R=((42, 45), (50, 36), (53, 25)), hop=-3)],
    'think': [dict(L=((22, 45), (21, 56), (30, 59)), R=((42, 45), (46, 55), (37, 40)), hand_front=True), dict(L=((22, 45), (21, 56), (30, 59)), R=((42, 45), (46, 55), (37, 40)), hand_front=True, bob=-1)],
    'clasp': [dict(L=((22, 45), (20, 56), (29, 63)), R=((42, 45), (44, 56), (35, 63))), dict(L=((22, 45), (20, 56), (29, 63)), R=((42, 45), (44, 56), (35, 63)), bob=-1)],
    'proud': [dict(L=((22, 45), (14, 53), (21, 61)), R=((42, 45), (50, 53), (43, 61))), dict(L=((22, 45), (14, 53), (21, 61)), R=((42, 45), (50, 53), (43, 61)), bob=-1)],
}
FACES = ['neutral', 'happy', 'laugh', 'wink', 'surprised', 'think', 'sad', 'proud', 'tease', 'excited', 'worried', 'shy', 'curious']
POSE_FOR = {'neutral': 'idle', 'happy': 'talk', 'laugh': 'cheer', 'wink': 'wave', 'surprised': 'clasp', 'think': 'think', 'sad': 'clasp',
            'proud': 'proud', 'tease': 'point', 'excited': 'cheer', 'worried': 'clasp', 'shy': 'clasp', 'curious': 'think'}


def arm(c, a, dy, front_hand=True):
    (sx, sy), (ex, ey), (wx, wy) = a
    sy += dy; ey += dy; wy += dy
    c.limb(sx, sy, ex, ey, 4.2, 3.8, DEEL)
    c.limb(ex, ey, wx, wy, 3.8, 3.4, DEEL)
    c.limb(ex, ey, wx, wy, 1.4, 1.2, DEEL_S)                       # a fold down the sleeve
    c.limb(sx, sy - 1, ex, ey - 1, 1.2, 1.0, DEEL_L)               # light along the top of the arm
    # the hoof-shaped cuff (turuu) and the hand
    dx, dyy = wx - ex, wy - ey; n = max(1.0, (dx * dx + dyy * dyy) ** 0.5)
    cx, cy = wx - dx / n * 1.5, wy - dyy / n * 1.5
    c.ellipse(cx, cy, 2.9, 2.9, CUFF); c.ellipse(cx + dx / n * 0.8, cy + dyy / n * 0.8, 1.6, 1.6, CUFF_D)
    c.px(round(cx - 1), round(cy - 2), GOLD)
    if front_hand:
        hx, hy = wx + dx / n * 2.2, wy + dyy / n * 2.2
        c.ellipse(hx, hy, 2.6, 2.6, SKIN); c.px(round(hx + 1), round(hy + 1), SKIN_S); c.px(round(hx - 1), round(hy - 1), '#ffe2c8')


def braid(c, x0, y0, x1, y1, dy):
    y0 += dy; y1 += dy
    c.limb(x0, y0, x1, y1, 2.1, 1.7, HAIR)
    n = 7
    for i in range(n):
        t = (i + 0.5) / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        c.px(round(x) - 1, round(y), HAIR_L); c.px(round(x), round(y) - 1, HAIR_M); c.px(round(x) + 1, round(y) + 1, HAIR_M)
    c.ellipse(x1, y1 + 2, 2.2, 1.6, CORAL); c.px(round(x1), round(y1 + 1), GOLD_L)   # a coral bead tie
    c.limb(x1, y1 + 3, x1 - 1, y1 + 8, 1.6, 0.6, HAIR)                               # the tip


def body(pose):
    dy = pose.get('bob', 0) + pose.get('hop', 0); hop = pose.get('hop', 0)
    c = Canvas(W, H)
    # hair behind everything: the long back hair
    c.ellipse(HX, HY - 2 + dy, 14, 14, HAIR)
    c.poly([(19, 26 + dy), (45, 26 + dy), (46, 44 + dy), (18, 44 + dy)], HAIR)
    c.poly([(19, 32 + dy), (23, 32 + dy), (22, 44 + dy), (18, 44 + dy)], HAIR_M)
    # back arm (the one behind her body when it crosses)
    # skirt of the deel
    sk = [(24, 61 + dy), (40, 61 + dy), (47, 101 + hop), (17, 101 + hop)]
    c.poly(sk, DEEL)
    c.poly([(24, 61 + dy), (28, 61 + dy), (23, 101 + hop), (17, 101 + hop)], DEEL_S)       # shadow side
    c.poly([(34, 64 + dy), (36, 64 + dy), (35, 101 + hop), (32, 101 + hop)], DEEL_S)       # a fold
    c.poly([(38, 63 + dy), (40, 63 + dy), (45, 101 + hop), (42, 101 + hop)], DEEL_L)       # light side
    c.rect(17, 98 + hop, 31, 3, GOLD); c.rect(17, 100 + hop, 31, 1, GOLD_D)                # the hem
    c.line(41, 50 + dy, 43, 98 + hop, GOLD)                                               # the right side seam with its trim
    # boots (gutal) with turned-up toes
    for bx, flip in ((25, -1), (37, 1)):
        c.rect(bx - 4, 101 + hop, 9, 6, BOOT); c.rect(bx - 4, 101 + hop, 9, 1, BOOT_L)
        c.rect(bx - 4, 106 + hop, 9, 2, BOOT_D)
        tx = bx + (5 if flip > 0 else -5)
        c.poly([(tx, 106 + hop), (tx + flip * 3, 102 + hop), (tx + flip * 3, 104 + hop), (tx + flip, 107 + hop)], BOOT)
        c.px(bx, 103 + hop, GOLD); c.px(bx - 2, 104 + hop, GOLD); c.px(bx + 2, 104 + hop, GOLD)
    # torso
    c.poly([(21, 44 + dy), (43, 44 + dy), (40, 61 + dy), (24, 61 + dy)], DEEL)
    c.ellipse(22, 46 + dy, 3, 3, DEEL); c.ellipse(42, 46 + dy, 3, 3, DEEL)                 # shoulders
    c.poly([(21, 45 + dy), (26, 44 + dy), (27, 61 + dy), (24, 61 + dy)], DEEL_S)
    c.poly([(37, 46 + dy), (41, 45 + dy), (41, 58 + dy), (38, 58 + dy)], DEEL_L, dither=0.5)
    # the deel's flap: from the collar across to her right side, edged in gold, with knot buttons
    c.lines([(31, 42 + dy), (35, 46 + dy), (41, 48 + dy), (44, 49 + dy)], GOLD, 1)
    c.lines([(31, 43 + dy), (35, 47 + dy), (41, 49 + dy)], GOLD_D, 1)
    for bx, by in ((36, 47), (41, 49), (44, 54)):
        c.px(bx, by + dy, GOLD_L); c.px(bx, by + 1 + dy, GOLD_D)
    # sash with its tied ends
    c.rect(23, 58 + dy, 19, 5, SASH); c.rect(23, 58 + dy, 19, 1, SASH_L); c.rect(23, 62 + dy, 19, 1, SASH_D)
    c.poly([(25, 62 + dy), (28, 62 + dy), (27, 73 + dy), (24, 72 + dy)], SASH)
    c.poly([(27, 62 + dy), (28, 62 + dy), (27, 73 + dy), (26, 73 + dy)], SASH_D)
    c.rect(24, 72 + dy, 4, 1, GOLD)
    # a little silver pouch with coral on the sash
    c.rect(36, 63 + dy, 3, 4, SILVER); c.px(37, 64 + dy, CORAL); c.rect(36, 66 + dy, 3, 1, '#9aa3b2')
    # neck and the standing collar
    c.rect(29, 36 + dy, 7, 7, SKIN); c.rect(29, 36 + dy, 7, 3, SKIN_S)
    c.rect(27, 41 + dy, 11, 3, GOLD); c.rect(27, 43 + dy, 11, 1, GOLD_D); c.rect(30, 41 + dy, 5, 1, WHITE)
    # arms (a hand to the chin is drawn later, over the face)
    hf = pose.get('hand_front', False)
    arm(c, pose['L'], dy)
    arm(c, pose['R'], dy, front_hand=not hf)
    # head: face, ears and hair
    c.ellipse(HX, HY + dy, 12, 12, SKIN)
    c.poly([(22, 29 + dy), (42, 29 + dy), (37, 37 + dy), (27, 37 + dy)], SKIN)              # a softer chin
    c.ellipse(HX + 11, HY + 2 + dy, 2, 7, SKIN_S, only_on=True)                            # shade down the far side of the face
    c.ellipse(21, HY + 3 + dy, 2, 3, SKIN); c.ellipse(43, HY + 3 + dy, 2, 3, SKIN_S)       # ears
    c.px(21, HY + 6 + dy, CORAL); c.px(43, HY + 6 + dy, CORAL)                             # coral earrings
    # hair on top: a rounded crown, side-swept bangs and locks framing the face
    c.ellipse(HX, HY - 10 + dy, 13, 7, HAIR)
    bangs = [(19, 20), (21, 13), (27, 10), (35, 10), (42, 13), (45, 21), (44, 23), (41, 18), (38, 21), (35, 17), (31, 20), (28, 16), (24, 21), (21, 18), (20, 27)]
    c.poly([(x, y + dy) for x, y in bangs], HAIR)
    c.poly([(19, 20 + dy), (22, 22 + dy), (22, 36 + dy), (19, 34 + dy)], HAIR)
    c.poly([(45, 20 + dy), (42, 22 + dy), (42, 36 + dy), (45, 34 + dy)], HAIR)
    c.lines([(24, 13 + dy), (29, 11 + dy), (34, 11 + dy)], HAIR_L)                            # shine
    c.lines([(26, 14 + dy), (30, 13 + dy)], HAIR_HI)
    c.lines([(37, 12 + dy), (41, 15 + dy)], HAIR_M)
    c.lines([(28, 17 + dy), (30, 21 + dy)], HAIR_M); c.lines([(35, 18 + dy), (37, 22 + dy)], HAIR_M)
    # a silver hair ornament with coral, on her right
    c.rect(38, 12 + dy, 5, 2, SILVER); c.ellipse(43, 13 + dy, 1.5, 1.5, CORAL); c.px(39, 12 + dy, WHITE)
    # braids over the shoulders, in front
    braid(c, 22, 31, 23, 55, dy)
    braid(c, 42, 31, 41, 55, dy)
    c.outline(OUT)
    if hf:  # the thinking hand rests under her chin, over the outline of the face
        (_, _), (ex, ey), (wx, wy) = pose['R']
        c.ellipse(wx, wy + 1 + dy, 2.8, 2.6, SKIN); c.px(wx - 1, wy + dy, '#ffe2c8'); c.px(wx + 1, wy + 2 + dy, SKIN_S)
        c.lines([(wx - 2, wy + 3 + dy), (wx + 2, wy + 3 + dy)], OUT)
    return c


# ---------------------------------------------------------------- faces
def eye(c, x, y, look=(0, 0), wide=False, star=False, lid=0):
    """An open eye centred at (x, y): lashes, a big iris with two highlights. lid: how far the upper lid comes down."""
    lx, ly = look
    h = 6 if wide else 5
    c.rect(x - 2, y - 2, 5, h, WHITE)
    c.rect(x - 2 + lx, y - 2 + (1 if wide else 0) + ly, 4, h - (2 if wide else 1), IRIS)
    c.rect(x - 1 + lx, y - 1 + (1 if wide else 0) + ly, 2, h - (3 if wide else 2), IRIS_D)
    c.px(x - 2 + lx, y + h - 4 + ly, IRIS_L); c.px(x + 1 + lx, y + h - 4 + ly, IRIS_L)
    if star:
        c.pxs([(x + lx - 1, y + ly), (x + lx, y - 1 + ly), (x + lx + 1, y + ly), (x + lx, y + 1 + ly), (x + lx, y + ly)], GOLD_L)
    else:
        c.px(x - 1 + lx, y - 1 + ly, WHITE); c.px(x + 1 + lx, y + 1 + ly, '#ffe9d6')
    c.rect(x - 3, y - 3, 7, 1, OUT)                                    # upper lash line
    c.px(x + 4, y - 4, OUT) if x > HX else c.px(x - 4, y - 4, OUT)     # the lash flick at the outer corner
    if lid:
        c.rect(x - 2, y - 2, 5, lid, SKIN); c.rect(x - 3, y - 3 + lid, 7, 1, OUT)
    c.rect(x - 1, y + h - 2, 3, 1, SKIN_S)                             # lower lid


def closed(c, x, y, happy=True):
    c.rect(x - 3, y - 3, 7, 6, SKIN)
    if happy:   # ^ ^
        c.pxs([(x - 2, y + 1), (x - 1, y), (x, y - 1), (x + 1, y), (x + 2, y + 1)], OUT)
    else:       # a soft closed line with lashes
        c.pxs([(x - 2, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1), (x + 2, y)], OUT)
        c.px(x + 3, y - 1, OUT) if x > HX else c.px(x - 3, y - 1, OUT)


def brows(c, l, r):
    """Each brow: (dy at the inner end, dy at the outer end), relative to the normal place."""
    for (inner, outer), side in ((l, -1), (r, 1)):
        x0, x1 = HX + side * 3, HX + side * 8
        c.line(x0, HY - 4 + inner, x1, HY - 4 + outer, HAIR_M)


def mouth(c, kind, open_):
    x, y = HX, HY + 8
    if kind == 'smile':
        if open_:
            c.rect(x - 2, y, 5, 3, MOUTH); c.rect(x - 1, y + 2, 3, 1, TONGUE); c.rect(x - 2, y, 5, 1, WHITE)
        else:
            c.pxs([(x - 2, y), (x - 1, y + 1), (x, y + 1), (x + 1, y + 1), (x + 2, y)], MOUTH)
    elif kind == 'grin':     # laughing, wide open
        c.rect(x - 3, y - 1, 7, 4 if open_ else 3, MOUTH); c.rect(x - 2, y - 1, 5, 1, WHITE); c.rect(x - 1, y + (2 if open_ else 1), 3, 1, TONGUE)
    elif kind == 'o':
        c.rect(x - 1, y - 1, 3, 4 if open_ else 3, MOUTH); c.px(x, y, IRIS_D)
    elif kind == 'flat':
        c.rect(x - 1 + (1 if not open_ else 0), y, 3, 1 if not open_ else 2, MOUTH)
    elif kind == 'frown':
        c.pxs([(x - 2, y + 1), (x - 1, y), (x, y), (x + 1, y), (x + 2, y + 1)], MOUTH)
        if open_: c.rect(x - 1, y + 1, 3, 1, MOUTH)
    elif kind == 'smug':
        c.pxs([(x - 2, y + 1), (x - 1, y + 1), (x, y + 1), (x + 1, y), (x + 2, y - 1)], MOUTH)
        if open_: c.rect(x - 1, y + 1, 2, 1, MOUTH)
    elif kind == 'cat':      # :3
        c.pxs([(x - 2, y), (x - 1, y + 1), (x, y), (x + 1, y + 1), (x + 2, y)], MOUTH)
        if open_: c.rect(x - 1, y + 1, 3, 2, MOUTH); c.px(x, y + 2, TONGUE)
    elif kind == 'wavy':
        c.pxs([(x - 2, y + 1), (x - 1, y), (x, y + 1), (x + 1, y), (x + 2, y + 1)], MOUTH)
        if open_: c.rect(x - 1, y + 1, 3, 1, MOUTH)
    elif kind == 'tiny':
        c.rect(x, y, 2, 1, MOUTH)
        if open_: c.rect(x, y + 1, 2, 1, MOUTH)


def blush(c, strong=False):
    for bx in (HX - 8, HX + 6):
        c.rect(bx, HY + 5, 3, 1, BLUSH)
        if strong:
            c.rect(bx - 1, HY + 4, 5, 2, BLUSH, dither=0.6)
            c.px(bx, HY + 6, BLUSH); c.px(bx + 2, HY + 6, BLUSH)


def face(expr, open_, blink, skin):
    c = Canvas(W, H)
    c.rect(HX - 10, HY - 6, 21, 18, SKIN, dither=0)  # nothing: the overlay only draws what changes
    L, R = (HX - 5, HY + 1), (HX + 5, HY + 1)
    e = dict(look=(0, 0), wide=False, star=False, lid=0)
    br = ((0, 0), (0, 0)); m = 'smile'; bl = False; eyes = 'open'
    if expr == 'neutral': m = 'flat'
    elif expr == 'happy': br = ((1, 0), (1, 0)); bl = True
    elif expr == 'laugh': eyes = 'happy'; m = 'grin'; bl = True; br = ((-1, -1), (-1, -1))
    elif expr == 'wink': eyes = 'wink'; m = 'cat'; bl = True
    elif expr == 'surprised': e.update(wide=True); br = ((-2, -2), (-2, -2)); m = 'o'
    elif expr == 'think': e.update(look=(1, -1)); br = ((-1, -1), (1, 0)); m = 'flat'
    elif expr == 'sad': e.update(lid=2, look=(0, 1)); br = ((-2, 1), (-2, 1)); m = 'frown'
    elif expr == 'proud': e.update(lid=2); br = ((0, -2), (0, -2)); m = 'smug'; bl = True
    elif expr == 'tease': e.update(lid=1); br = ((1, 0), (0, -2)); m = 'cat'
    elif expr == 'excited': e.update(star=True, wide=True); m = 'grin'; bl = True; br = ((-2, -1), (-2, -1))
    elif expr == 'worried': br = ((-2, 1), (-2, 1)); m = 'wavy'; e.update(look=(-1, 0))
    elif expr == 'shy': e.update(look=(0, 1), lid=1); m = 'tiny'; bl = 'strong'
    elif expr == 'curious': e.update(look=(1, 0), wide=True); br = ((0, 0), (0, -3)); m = 'o'
    # skin under the eyes, brows and mouth, so any expression can go over any other
    c.rect(HX - 10, HY - 7, 21, 4, SKIN); c.rect(HX - 9, HY - 3, 19, 7, SKIN); c.rect(HX - 4, HY + 6, 9, 5, SKIN)
    c.px(HX, HY + 5, SKIN_S)  # the nose
    brows(c, *br)
    if blink and eyes == 'open':
        closed(c, *L, happy=False); closed(c, *R, happy=False)
    elif eyes == 'happy':
        closed(c, *L); closed(c, *R)
    elif eyes == 'wink':
        eye(c, *L, **e); closed(c, *R)
    else:
        eye(c, *L, **e); eye(c, *R, **e)
    mouth(c, m, open_)
    if bl: blush(c, bl == 'strong')
    if expr == 'worried': c.pxs([(HX + 10, HY - 6), (HX + 10, HY - 5), (HX + 10, HY - 3)], '#9fd8ff')   # a sweat drop
    if expr == 'think': c.pxs([(HX + 11, HY - 9), (HX + 12, HY - 10)], OUT)
    c.a[~skin] = 0   # only over her skin: the bangs, ears and hair stay as they are
    out = Canvas(FW, FH); out.a = c.a[FY:FY + FH, FX:FX + FW].copy()
    return out


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    poses = list(POSES)
    frames = [body(p) for name in poses for p in POSES[name]]
    base = body(POSES['idle'][0]).a
    skin = np.zeros((H, W), bool)
    for col in (SKIN, SKIN_S):
        skin |= np.all(base == hexc(col), axis=2)
    faces = [face(e, o, b, skin) for e in FACES for (o, b) in ((False, False), (True, False), (False, True), (True, True))]
    art = os.path.join(ROOT, 'Art')
    save(sheet(frames, 2), os.path.join(art, 'bolormaa_body.png.bytes'), prev and os.path.join(prev, 'bolormaa_body.png'), 3)
    save(sheet(faces, 4), os.path.join(art, 'bolormaa_faces.png.bytes'), prev and os.path.join(prev, 'bolormaa_faces.png'), 6)
    meta = {'W': W, 'H': H, 'poses': poses, 'frames': 2, 'faces': FACES, 'faceW': FW, 'faceH': FH, 'faceX': FX, 'faceY': FY,
            'bob': {n: [p.get('bob', 0) + p.get('hop', 0) for p in POSES[n]] for n in poses}, 'poseFor': POSE_FOR}
    with open(os.path.join(ROOT, 'Data', 'bolormaa.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False)
    if prev:  # a preview of every pose with a face on it
        demo = []
        for i, name in enumerate(poses):
            for j in range(2):
                b = frames[i * 2 + j].copy(); ex = [k for k, v in POSE_FOR.items() if v == name][0]
                fc = faces[FACES.index(ex) * 4]; dy = POSES[name][j].get('bob', 0) + POSES[name][j].get('hop', 0)
                b.blit(fc, FX, FY + dy); demo.append(b)
        save(sheet(demo, 8), os.path.join(prev, 'bolormaa_demo.png'), os.path.join(prev, 'bolormaa_demo_x.png'), 4)


if __name__ == '__main__':
    main()
