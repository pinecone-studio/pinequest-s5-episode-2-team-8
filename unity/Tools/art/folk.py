# The people of Нутаг in a bold sprite style: thick black outlines round every part, flat colours with one shade, big
# expressive faces and confident poses. Guide Bolormaa and every villager you talk to, each with their own clothes, hair,
# hat and the thing they work with. For each character this writes folk_<id>_body (rows = poses, 2 breathing frames) and
# folk_<id>_faces (14 expressions × mouth shut/open × eyes open/blinking), and the layout of all of them in Data/folk.json.
#   python3 unity/Tools/art/folk.py [preview_dir]
import json
import math
import os
import sys

import numpy as np

from pix import Canvas, hexc, mix, save, shade, sheet

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources')
W, H = 80, 136
CX, HY = 40, 26                       # the middle of the body, the middle of the face
FX, FY, FW, FH = CX - 15, HY - 10, 30, 24   # the face overlay
INK = '#140a10'
WHITE, BLUSH, MOUTH, TONGUE = '#ffffff', '#ff8f8f', '#5a1020', '#ff6b7a'
SKINS = {'light': ('#ffd9b8', '#e8a983'), 'warm': ('#f2bf94', '#cf8d66'), 'tan': ('#dba277', '#b2774f'), 'brown': ('#c0855a', '#93603b')}

# ---------------------------------------------------------------- the people
FOLK = {
    'bolormaa': dict(skin='light', deel=('#3d8bff', '#2457c9'), trim='#ffd34a', sash=('#ff8a1f', '#c95a0c'), cuff='#ff4d4d', boots=('#e8402e', '#a3241a'),
                     hair=('#1c1018', '#3e2638'), hairdo='braids', scarf=('#4fc3ff', '#1f8fd6'), fem=True, sig='hip'),
    'emee': dict(skin='warm', deel=('#8f5bd6', '#6237a3'), trim='#ffd34a', sash=('#ffcf4a', '#c99a18'), cuff='#5a2f8f', boots=('#7a4a2a', '#4e2e18'),
                 hair=('#d7d4dd', '#a9a4b2'), hairdo='bun', glasses=True, scarf=('#7fd3ff', '#3a9fd8'), fem=True, short=True, elder=True, sig='clasp'),
    'zasuul': dict(skin='tan', deel=('#ffc21a', '#c98e00'), trim='#d83a2a', sash=('#2f6fdb', '#1d4796'), cuff='#d83a2a', boots=('#2a1c18', '#120a08'),
                   hair=('#1c1018', '#3e2638'), hairdo='short', hat='mongol', mustache=True, scarf=('#7fd3ff', '#3a9fd8'), sig='herald'),
    'general': dict(skin='brown', deel=('#3f8f4a', '#27632f'), trim='#ffd34a', sash=('#2a1c18', '#120a08'), cuff='#ffd34a', boots=('#2a1c18', '#120a08'),
                    hair=('#1c1018', '#3e2638'), hairdo='short', hat='loovuuz', mustache=True, broad=True, medal=True, sig='cross'),
    'historian': dict(skin='warm', deel=('#a35bd6', '#7237a3'), trim='#ffffff', sash=('#ffcf4a', '#c99a18'), cuff='#ffffff', boots=('#7a4a2a', '#4e2e18'),
                      hair=('#1c1018', '#3e2638'), hairdo='bun', glasses=True, fem=True, prop='scroll', sig='hold'),
    'herder': dict(skin='tan', deel=('#9a5a2e', '#6a3a1a'), trim='#ffd34a', sash=('#2fa35a', '#1d6e3a'), cuff='#2fa35a', boots=('#2a1c18', '#120a08'),
                   hair=('#1c1018', '#3e2638'), hairdo='short', hat='mongol', prop='uurga', sig='hold'),
    'fisher': dict(skin='brown', deel=('#1fb0a8', '#127a74'), trim='#ffffff', sash=('#2a5fb8', '#1a3d7a'), cuff='#2a5fb8', boots=('#3a2a1a', '#20160c'),
                   hair=('#e4e1ea', '#b3aebb'), hairdo='short', hat='cap', beard=True, elder=True, prop='rod', sig='hold'),
    'farmer': dict(skin='warm', deel=('#3fbf5f', '#25843d'), trim='#ffd34a', sash=('#ff6fa8', '#c2427e'), cuff='#ff6fa8', boots=('#e8402e', '#a3241a'),
                   hair=('#3a1e14', '#5e3424'), hairdo='braids', hat='flower', fem=True, prop='bucket', sig='hold'),
    'teacher': dict(skin='light', deel=('#3d8bff', '#2457c9'), trim='#ffffff', sash=('#ffffff', '#c9c9d6'), cuff='#ffffff', boots=('#2a1c18', '#120a08'),
                    hair=('#2a1810', '#4e2e20'), hairdo='bob', glasses=True, fem=True, scarf=('#ff5a8a', '#c2305e'), prop='book', sig='hold'),
    'trainer': dict(skin='tan', deel=('#ffb51a', '#c98400'), trim='#2a1c18', sash=('#d83a2a', '#922218'), cuff='#d83a2a', boots=('#2a1c18', '#120a08'),
                    hair=('#1c1018', '#3e2638'), hairdo='short', hat='loovuuz', prop='whip', sig='hipwhip'),
    'archer': dict(skin='brown', deel=('#e8402e', '#a3241a'), trim='#ffd34a', sash=('#2a1c18', '#120a08'), cuff='#ffd34a', boots=('#2a1c18', '#120a08'),
                   hair=('#1c1018', '#3e2638'), hairdo='short', hat='mongol', medal=True, prop='bow', sig='hold'),
    'craftsman': dict(skin='brown', deel=('#8a5a33', '#5e3b1e'), trim='#ffd34a', sash=('#2f6fdb', '#1d4796'), cuff='#2f6fdb', boots=('#3a2a1a', '#20160c'),
                      hair=('#cfcbd6', '#9f9aa8'), hairdo='short', hat='mongol', mustache=True, elder=True, broad=True, prop='hammer', sig='hold'),
}

# arms: shoulder → elbow → wrist, as offsets from the middle of the body (x) and in pixels (y)
DOWN_L, DOWN_R = ((-17, 50), (-20, 68), (-21, 86)), ((17, 50), (20, 68), (21, 86))
HIP_L, HIP_R = ((-17, 50), (-29, 64), (-15, 79)), ((17, 50), (29, 64), (15, 79))
ARMS = {
    'down': (DOWN_L, DOWN_R), 'hip': (HIP_L, ((17, 50), (22, 68), (25, 85))),
    'talk': (HIP_L, ((17, 50), (27, 66), (37, 59))), 'cheer': (((-17, 50), (-25, 34), (-27, 18)), ((17, 50), (25, 34), (27, 18))),
    'think': (((-17, 50), (-19, 68), (-2, 77)), ((17, 50), (22, 68), (7, 44))), 'wave': (DOWN_L, ((17, 50), (26, 36), (28, 20))),
    'point': (HIP_L, ((17, 50), (27, 52), (35, 46))), 'proud': (HIP_L, HIP_R),
    'clasp': (((-17, 50), (-18, 66), (-3, 79)), ((17, 50), (18, 66), (3, 79))),
    'hold': (HIP_L, ((17, 50), (25, 66), (27, 80))), 'cross': (((-17, 50), (-23, 64), (9, 66)), ((17, 50), (23, 64), (-9, 64))),
    'herald': (((-17, 50), (-21, 68), (-21, 86)), ((17, 50), (27, 34), (30, 16))), 'hipwhip': (HIP_L, ((17, 50), (25, 66), (27, 80))),
}
POSES = ['idle', 'talk', 'cheer', 'think', 'wave', 'point', 'proud']
FACES = ['neutral', 'happy', 'laugh', 'wink', 'surprised', 'think', 'sad', 'proud', 'tease', 'excited', 'worried', 'shy', 'curious', 'stern']
POSE_FOR = {'neutral': 'idle', 'happy': 'talk', 'laugh': 'cheer', 'wink': 'wave', 'surprised': 'idle', 'think': 'think', 'sad': 'idle', 'proud': 'proud',
            'tease': 'point', 'excited': 'cheer', 'worried': 'think', 'shy': 'idle', 'curious': 'think', 'stern': 'proud'}


def layer(c, fn):
    """Draws one part on its own and outlines it, so every part gets its own bold edge where it overlaps another."""
    p = Canvas(W, H); fn(p); p.outline(INK); c.blit(p, 0, 0)


def arm_points(p, side, pose, dy):
    a = ARMS[p['sig'] if pose == 'idle' else pose][0 if side < 0 else 1]
    return [(CX + x, y + dy) for x, y in a]


def draw_arm(c, p, pts, frame):
    (sx, sy), (ex, ey), (wx, wy) = pts
    deel, deel_s = p['deel']; sk, sk_s = SKINS[p['skin']]
    th = 6.5 if p.get('broad') else 5.5
    c.limb(sx, sy, ex, ey, th, th - 0.5, deel)
    c.limb(ex, ey, wx, wy, th - 0.5, th - 1, deel)
    c.limb(sx + 1.5, sy + 1.5, ex + 1.5, ey + 1.5, 2, 1.8, deel_s, only_on=True)
    dx, dy_ = wx - ex, wy - ey; n = max(1.0, math.hypot(dx, dy_)); ux, uy = dx / n, dy_ / n
    c.ellipse(wx - ux * 1, wy - uy * 1, th - 0.5, th - 0.5, p['cuff'])                     # the hoof-shaped cuff
    hx, hy = wx + ux * 4, wy + uy * 4
    c.ellipse(hx, hy, 4.2, 4.2, sk); c.ellipse(hx + 1.2, hy + 1.2, 2, 2, sk_s, only_on=True)
    return hx, hy


def draw_prop(c, p, hand, frame):
    hx, hy = round(hand[0]), round(hand[1]); kind = p.get("prop")
    if kind == 'rod':        # a willow fishing rod with its line
        c.line(hx, hy, hx + 14, hy - 44, '#8a5a2e', 2); c.line(hx + 14, hy - 44, hx + 18, hy - 10, '#e8e8f0')
    elif kind == 'bucket':   # a milk pail
        c.rect(hx - 6, hy + 2, 12, 11, '#c9cfd8'); c.rect(hx - 6, hy + 2, 12, 2, '#ffffff'); c.rect(hx - 5, hy + 3, 10, 2, '#fffaf0')
        c.lines([(hx - 6, hy + 3), (hx, hy - 4), (hx + 6, hy + 3)], '#6a6f78')
    elif kind == 'bow':      # a recurved Mongol bow
        c.lines([(hx + 3, hy - 26), (hx + 9, hy - 18), (hx + 5, hy - 6), (hx + 5, hy + 6), (hx + 9, hy + 18), (hx + 3, hy + 26)], '#8a4a1e', 2)
        c.line(hx + 3, hy - 26, hx + 3, hy + 26, '#f0e6d0')
    elif kind == 'hammer':
        c.line(hx, hy + 4, hx + 4, hy - 16, '#8a5a2e', 2); c.rect(hx - 2, hy - 22, 12, 6, '#7a7f88'); c.rect(hx - 2, hy - 22, 12, 2, '#b8bdc6')
    elif kind == 'scroll':   # an old scroll in Mongol script
        c.rect(hx - 4, hy - 14, 8, 22, '#f6e8c4'); c.rect(hx - 5, hy - 15, 10, 3, '#a8784a'); c.rect(hx - 5, hy + 7, 10, 3, '#a8784a')
        for y in range(hy - 10, hy + 5, 3): c.line(hx - 1, y, hx - 1, y + 2, '#5a3a22')
    elif kind == 'uurga':    # the herder's long lasso pole
        c.line(hx - 2, hy + 20, hx + 6, hy - 60, '#a8784a', 2); c.lines([(hx + 6, hy - 60), (hx + 14, hy - 56), (hx + 12, hy - 46), (hx + 4, hy - 50)], '#e8d8b0')
    elif kind == 'book':
        c.rect(hx - 7, hy - 2, 14, 10, '#d83a2a'); c.rect(hx - 6, hy - 1, 12, 8, '#fffaf0'); c.line(hx, hy - 1, hx, hy + 7, '#c9b89a')
    elif kind == 'whip':     # a horse whip (tashuur)
        c.line(hx, hy, hx + 4, hy + 16, '#5a3a22', 2); c.lines([(hx + 4, hy + 16), (hx + 9, hy + 22 + frame), (hx + 6, hy + 30)], '#2a1c18')


def body(p, pose, frame):
    c = Canvas(W, H)
    dy = -1 if frame else 0; hop = -3 if pose == 'cheer' and frame else 0; up = dy + hop
    sk, sk_s = SKINS[p['skin']]; deel, deel_s = p['deel']; hair, hair_l = p['hair']
    short = 4 if p.get('short') else 0
    hy = HY + short + up
    # long hair and braids behind the body
    if p.get('hairdo') == 'braids':
        layer(c, lambda q: (q.limb(CX - 13, hy + 4, CX - 16, 70 + up, 3.2, 2.6, hair), q.limb(CX + 13, hy + 4, CX + 16, 70 + up, 3.2, 2.6, hair)))
    # boots: big gutal with turned-up toes
    def boots(q):
        for s in (-1, 1):
            bx = CX + s * 8; b, bd = p['boots']
            q.rect(bx - 7, 112 + hop, 14, 18, b); q.rect(bx - 7, 127 + hop, 14, 4, bd)
            q.poly([(bx + s * 6, 127 + hop), (bx + s * 13, 120 + hop), (bx + s * 12, 125 + hop), (bx + s * 8, 131 + hop)], b)
            q.rect(bx - 6, 116 + hop, 12, 2, p['trim'])
    layer(c, boots)
    # the deel: skirt, then the body, sash and collar
    bw = 3 if p.get('broad') else 0; fw = -2 if p.get('fem') else 0
    def skirt(q):
        q.poly([(CX - 12 - fw, 80 + up), (CX + 12 + fw, 80 + up), (CX + 22 + bw, 116 + short // 2), (CX - 22 - bw, 116 + short // 2)], deel)
        q.poly([(CX - 12 - fw, 80 + up), (CX - 6, 80 + up), (CX - 12, 116 + short // 2), (CX - 22 - bw, 116 + short // 2)], deel_s)
        q.rect(CX - 22 - bw, 112 + short // 2, 45 + 2 * bw, 4, p['trim'])
        q.line(CX + 9, 82 + up, CX + 15, 113, p['trim'])
    layer(c, skirt)
    def torso(q):
        q.poly([(CX - 18 - bw, 47 + up), (CX + 18 + bw, 47 + up), (CX + 13 + fw + bw, 81 + up), (CX - 13 - fw - bw, 81 + up)], deel)
        q.ellipse(CX - 17 - bw, 52 + up, 6, 6, deel); q.ellipse(CX + 17 + bw, 52 + up, 6, 6, deel)
        q.poly([(CX - 18 - bw, 48 + up), (CX - 10, 48 + up), (CX - 9, 81 + up), (CX - 13 - fw - bw, 81 + up)], deel_s)
        q.lines([(CX - 2, 44 + up), (CX + 6, 52 + up), (CX + 15, 55 + up)], p['trim'], 2)     # the flap of the deel
        for bx_, by_ in ((CX + 7, 54), (CX + 13, 57)): q.rect(bx_, by_ + up, 2, 2, p['trim'])
        s, sd = p['sash']; q.rect(CX - 14 - bw, 75 + up, 29 + 2 * bw, 7, s); q.rect(CX - 14 - bw, 80 + up, 29 + 2 * bw, 2, sd)
        if p.get('medal'): q.ellipse(CX - 8, 60 + up, 3, 3, '#ffd34a'); q.rect(CX - 9, 54 + up, 3, 5, '#d83a2a')
    layer(c, torso)
    # arms: the left one first; arms that cross the body are drawn over it
    hands = {}
    for side in (-1, 1):
        pts = arm_points(p, side, pose, up)
        layer(c, lambda q, pts=pts, side=side: hands.__setitem__(side, draw_arm(q, p, pts, frame)))
    # neck, head, ears
    def head(q):
        q.rect(CX - 5, hy + 12, 10, 8, sk); q.rect(CX - 5, hy + 12, 10, 3, sk_s)
        q.ellipse(CX - 14, hy + 2, 3, 4, sk); q.ellipse(CX + 14, hy + 2, 3, 4, sk)
        q.ellipse(CX, hy, 14, 15, sk)
        q.ellipse(CX + 10, hy + 4, 4, 9, sk_s, only_on=True)
    layer(c, head)
    # the collar over the neck
    layer(c, lambda q: (q.rect(CX - 8, 43 + up, 16, 5, p['trim']), q.rect(CX - 6, 43 + up, 12, 2, WHITE)))
    # hair on top
    def hairtop(q):
        do = p.get('hairdo')
        q.ellipse(CX, hy - 9, 15, 7, hair)
        if do in ('braids', 'bob'):
            side = 12 if do == 'bob' else 8
            q.poly([(CX - 15, hy - 8), (CX - 9, hy - 4), (CX - 4, hy - 6), (CX + 1, hy - 3), (CX + 6, hy - 6), (CX + 11, hy - 4), (CX + 15, hy - 8), (CX + 16, hy + side), (CX + 13, hy + side - 2), (CX + 13, hy - 3), (CX - 13, hy - 3), (CX - 13, hy + side - 2), (CX - 16, hy + side)], hair)
        elif do == 'bun':
            q.ellipse(CX, hy - 18, 6, 5, hair)
            q.poly([(CX - 15, hy - 6), (CX, hy - 10), (CX + 15, hy - 6), (CX + 14, hy + 1), (CX + 12, hy - 4), (CX - 12, hy - 4), (CX - 14, hy + 1)], hair)
        else:
            q.poly([(CX - 15, hy - 5), (CX - 6, hy - 9), (CX + 8, hy - 8), (CX + 15, hy - 5), (CX + 14, hy + 2), (CX + 13, hy - 4), (CX - 13, hy - 4), (CX - 14, hy + 2)], hair)
        q.line(CX - 7, hy - 12, CX + 1, hy - 14, hair_l, 2)
    layer(c, hairtop)
    if p.get('hairdo') == 'braids':   # braid ends in front of the shoulders, with coral beads
        def bead(q):
            for s in (-1, 1):
                q.limb(CX + s * 14, hy + 8, CX + s * 16, 66 + up, 2.6, 2.2, hair)
                q.ellipse(CX + s * 16, 68 + up, 2.5, 2.2, '#ff5a3a')
        layer(c, bead)
    # hats
    hat = p.get('hat')
    if hat == 'mongol':    # the traditional hat: an upturned brim, a red crown and a knot on top with red tassels
        def mh(q):
            q.poly([(CX - 15, hy - 9), (CX - 8, hy - 26), (CX + 8, hy - 26), (CX + 15, hy - 9)], '#d83a2a')
            q.poly([(CX - 4, hy - 26), (CX + 4, hy - 26), (CX + 2, hy - 9), (CX - 2, hy - 9)], '#ff6a4a')
            q.ellipse(CX, hy - 28, 3, 3, '#ffd34a')
            q.poly([(CX - 18, hy - 8), (CX + 18, hy - 8), (CX + 15, hy - 14), (CX - 15, hy - 14)], '#2a1c18')
        layer(c, mh)
    elif hat == 'loovuuz':  # a fur hat with ear flaps and a pointed top
        def lh(q):
            q.poly([(CX - 13, hy - 10), (CX, hy - 30), (CX + 13, hy - 10)], '#2f6fdb'); q.ellipse(CX, hy - 31, 2, 2, '#ffd34a')
            q.rect(CX - 17, hy - 13, 34, 7, '#8a5a33'); q.rect(CX - 17, hy - 13, 34, 2, '#b8875a')
            q.poly([(CX - 17, hy - 8), (CX - 13, hy - 8), (CX - 13, hy + 8), (CX - 17, hy + 6)], '#8a5a33'); q.poly([(CX + 17, hy - 8), (CX + 13, hy - 8), (CX + 13, hy + 8), (CX + 17, hy + 6)], '#8a5a33')
        layer(c, lh)
    elif hat == 'cap':
        layer(c, lambda q: (q.ellipse(CX, hy - 11, 14, 7, '#3a5a8a'), q.rect(CX - 14, hy - 11, 28, 4, '#3a5a8a'), q.rect(CX + 4, hy - 8, 16, 3, '#2a3f66')))
    elif hat == 'flower':
        layer(c, lambda q: (q.rect(CX - 14, hy - 10, 28, 3, '#ff6fa8'), q.ellipse(CX + 9, hy - 12, 4, 4, '#ffd34a'), q.ellipse(CX + 9, hy - 12, 2, 2, '#ff8a1f')))
    # glasses, facial hair, scarf (khadag) and props in front
    if p.get('glasses'):
        def gl(q):
            for s in (-1, 1):
                q.ellipse(CX + s * 6, hy + 2, 5, 4.5, INK); q.ellipse(CX + s * 6, hy + 2, 3.8, 3.3, sk)
            q.line(CX - 1, hy + 1, CX + 1, hy + 1, INK)
        p2 = Canvas(W, H); gl(p2); c.blit(p2, 0, 0)
    if p.get('mustache') or p.get('beard'):
        hc = hair if not p.get('elder') else hair
        def fh(q):
            if p.get('beard'): q.poly([(CX - 10, hy + 8), (CX + 10, hy + 8), (CX + 6, hy + 22), (CX, hy + 25), (CX - 6, hy + 22)], hc)
            q.poly([(CX - 9, hy + 9), (CX - 2, hy + 6), (CX + 2, hy + 6), (CX + 9, hy + 9), (CX + 8, hy + 11), (CX + 2, hy + 9), (CX - 2, hy + 9), (CX - 8, hy + 11)], hc)
        layer(c, fh)
    if p.get('scarf'):     # a silk scarf round the neck, its end flying in the wind
        s, sd = p['scarf']; wave = 2 if frame else 0
        def sc(q):
            q.ellipse(CX, 51 + up, 11, 4, s)
            q.poly([(CX + 6, 50 + up), (CX + 22, 46 + up - wave), (CX + 34, 50 + up + wave), (CX + 30, 55 + up), (CX + 20, 53 + up), (CX + 8, 50 + up)], s)
            q.poly([(CX + 20, 53 + up), (CX + 30, 55 + up), (CX + 34, 50 + up + wave), (CX + 36, 57 + up)], sd)
            q.poly([(CX - 6, 53 + up), (CX - 2, 53 + up), (CX - 4, 66 + up), (CX - 9, 64 + up)], s)
        layer(c, sc)
    if p.get('prop') and pose in ('idle',):
        layer(c, lambda q: draw_prop(q, p, hands[1], frame))
    return c


# ---------------------------------------------------------------- faces
def eye(c, x, y, kind, side, p):
    if kind == 'open':
        c.ellipse(x, y, 2.4 if not p.get('elder') else 2, 3.4 if not p.get('elder') else 2.4, INK); c.rect(x - 1, y - 2, 2, 2, WHITE)
        if p.get('fem'): c.line(x - side * 2, y - 3, x + side * 3, y - 5, INK)
    elif kind == 'wide':
        c.ellipse(x, y, 3.2, 4.2, WHITE); c.ellipse(x, y, 3.2, 4.2, INK); c.ellipse(x, y, 2.2, 3.2, WHITE); c.ellipse(x, y + 1, 1.3, 1.5, INK)
    elif kind == 'happy':
        c.lines([(x - 3, y + 1), (x, y - 2), (x + 3, y + 1)], INK, 2)
    elif kind == 'shut':
        c.line(x - 3, y, x + 3, y, INK, 2)
    elif kind == 'half':
        c.ellipse(x, y + 1, 2.4, 2.4, INK); c.line(x - 3, y - 1, x + 3, y - 1, INK, 2); c.px(x - 1, y, WHITE)
    elif kind == 'star':
        c.ellipse(x, y, 2.6, 3.6, INK); c.pxs([(x, y - 2), (x - 1, y), (x + 1, y), (x, y + 1), (x, y)], '#ffe14d')
    elif kind == 'look':
        c.ellipse(x, y, 2.4, 3.4, INK); c.rect(x + 1, y - 2, 2, 2, WHITE)
    elif kind == 'down':
        c.ellipse(x, y + 1, 2.2, 2.6, INK); c.line(x - 3, y - 2, x + 3, y - 2, INK)


def face(p, expr, open_, blink, mask):
    c = Canvas(W, H); sk, sk_s = SKINS[p['skin']]; hy = HY + (4 if p.get('short') else 0)
    c.rect(CX - 13, hy - 6, 27, 22, sk)   # a clean face to draw on (clipped to the skin below)
    eyes = {'neutral': 'open', 'happy': 'open', 'laugh': 'happy', 'wink': 'open', 'surprised': 'wide', 'think': 'look', 'sad': 'down', 'proud': 'half',
            'tease': 'half', 'excited': 'star', 'worried': 'open', 'shy': 'down', 'curious': 'wide', 'stern': 'half'}[expr]
    brow = {'neutral': (0, 0), 'happy': (1, 0), 'laugh': (-1, -1), 'wink': (0, -1), 'surprised': (-3, -3), 'think': (-1, 1), 'sad': (-2, 2), 'proud': (1, -2),
            'tease': (2, -2), 'excited': (-2, -2), 'worried': (-3, 2), 'shy': (-1, 1), 'curious': (0, -3), 'stern': (3, -1)}[expr]
    for s in (-1, 1):
        x = CX + s * 6; y = hy + 2
        k = 'shut' if blink and eyes in ('open', 'look', 'wide', 'star', 'half') else ('happy' if expr == 'wink' and s > 0 else eyes)
        eye(c, x, y, k, s, p)
        bi, bo = brow if not (expr == 'curious' and s < 0) else (0, 0)
        c.line(x - s * 2, y - 6 + bi, x + s * 4, y - 6 + bo, INK, 2)
    mx, my = CX, hy + 9
    if expr in ('laugh', 'excited') or (open_ and expr in ('happy', 'wink', 'proud', 'tease')):
        c.poly([(mx - 5, my - 1), (mx + 5, my - 1), (mx + 3, my + 4), (mx - 3, my + 4)], INK); c.rect(mx - 3, my, 7, 3, MOUTH); c.rect(mx - 2, my + 2, 5, 2, TONGUE); c.rect(mx - 4, my - 1, 9, 1, WHITE)
    elif expr in ('surprised', 'curious'):
        c.ellipse(mx, my + 1, 2.5, 3 if open_ else 2.2, INK); c.ellipse(mx, my + 1, 1.3, 1.8 if open_ else 1, MOUTH)
    elif expr in ('sad', 'worried', 'stern') and not open_:
        c.lines([(mx - 4, my + 2), (mx, my), (mx + 4, my + 2)], INK, 1) if expr != 'stern' else c.line(mx - 4, my + 1, mx + 4, my + 1, INK, 2)
        if expr == 'worried': c.pxs([(mx - 4, my + 1), (mx - 2, my + 2), (mx, my + 1), (mx + 2, my + 2), (mx + 4, my + 1)], INK)
    elif open_:
        c.ellipse(mx, my + 1, 3.5, 2.6, INK); c.ellipse(mx, my + 1.5, 2.3, 1.4, MOUTH)
    elif expr in ('proud', 'tease'):
        c.lines([(mx - 4, my + 1), (mx + 1, my + 2), (mx + 5, my - 1)], INK, 1); c.px(mx + 5, my - 2, INK)
    elif expr == 'think':
        c.line(mx - 1, my + 1, mx + 4, my, INK)
    elif expr == 'shy':
        c.lines([(mx - 2, my + 1), (mx, my + 2), (mx + 2, my + 1)], INK)
    elif expr == 'neutral':
        c.line(mx - 3, my + 1, mx + 3, my + 1, INK)
    else:
        c.lines([(mx - 5, my), (mx - 2, my + 3), (mx + 2, my + 3), (mx + 5, my)], INK, 1)
    if expr in ('happy', 'laugh', 'shy', 'excited', 'wink', 'proud') or p.get('fem') and expr not in ('stern', 'sad', 'worried'):
        for s in (-1, 1): c.ellipse(CX + s * 9, hy + 7, 2.5, 1.5, BLUSH if expr != 'shy' else '#ff6a7a')
    if expr == 'worried': c.pxs([(CX + 13, hy - 4), (CX + 13, hy - 3), (CX + 12, hy - 2), (CX + 13, hy - 2), (CX + 14, hy - 2)], '#7fd3ff')
    c.a[~mask] = 0
    out = Canvas(FW, FH); out.a = c.a[FY + (4 if p.get('short') else 0) - (4 if p.get('short') else 0):FY + FH, FX:FX + FW].copy()
    return out


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    art = os.environ.get('ART_OUT', os.path.join(ROOT, 'Art'))
    meta = {'W': W, 'H': H, 'poses': POSES, 'frames': 2, 'faces': FACES, 'faceX': FX, 'faceY': FY, 'faceW': FW, 'faceH': FH, 'poseFor': POSE_FOR, 'folk': {}}
    demo = []
    for fid, p in FOLK.items():
        frames = [body(p, pose, f) for pose in POSES for f in range(2)]
        base = body(p, 'idle', 0).a; sk = SKINS[p['skin']]
        mask = np.zeros((H, W), bool)
        for col in sk: mask |= np.all(base == hexc(col), axis=2)
        short = 4 if p.get('short') else 0
        if short: mask = np.roll(mask, -short, axis=0)   # faces are drawn at the standard height and moved down with the head
        faces = [face(dict(p, short=False), e, o, b, mask) for e in FACES for (o, b) in ((False, False), (True, False), (False, True), (True, True))]
        save(sheet(frames, 2), os.path.join(art, f'folk_{fid}_body.png.bytes'))
        save(sheet(faces, 4), os.path.join(art, f'folk_{fid}_faces.png.bytes'))
        bob = {pose: [(-1 if f else 0) + (-3 if pose == 'cheer' and f else 0) + short for f in range(2)] for pose in POSES}
        meta['folk'][fid] = {'bob': bob}
        if prev:
            for pose, ex in (('idle', 'happy'), ('talk', 'laugh'), ('think', 'curious'), ('proud', 'stern')):
                b = frames[POSES.index(pose) * 2].copy(); fc = faces[FACES.index(ex) * 4]; b.blit(fc, FX, FY + bob[pose][0]); demo.append(b)
    if not os.environ.get('ART_OUT'):
        with open(os.path.join(ROOT, 'Data', 'folk.json'), 'w') as f: json.dump(meta, f, ensure_ascii=False)
    if prev: save(sheet(demo, 8), os.path.join(prev, 'folk_demo.png'), os.path.join(prev, 'folk_demo_x.png'), 3)


if __name__ == '__main__':
    main()
