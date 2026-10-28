# The people of Нутаг as friendly, clear video-game characters: drawn smooth (4× supersampled, then scaled down), with soft
# coloured outlines instead of black, big eyes with coloured irises and shine, gentle two-tone shading, shiny hair, and
# rounded, kid-friendly proportions. This module draws one character; folk.py lays out the sheets.
import math

from PIL import Image, ImageDraw, ImageFilter

SS = 4   # supersampling


def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def darker(c, f=0.35):
    r, g, b = rgb(c) if isinstance(c, str) else c
    return (int(r * (1 - f) * 0.92 + 20 * f), int(g * (1 - f) * 0.85 + 10 * f), int(b * (1 - f) * 0.9 + 30 * f))


def lighter(c, f=0.3):
    r, g, b = rgb(c) if isinstance(c, str) else c
    return (int(r + (255 - r) * f), int(g + (250 - g) * f), int(b + (240 - b) * f))


class Pen:
    """Draws in body units (0..W, 0..H) on a supersampled RGBA image."""
    def __init__(self, w, h, scale):
        self.w, self.h, self.k = w, h, scale * SS
        self.im = Image.new('RGBA', (int(w * self.k), int(h * self.k)), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)

    def P(self, pts): return [(x * self.k, y * self.k) for x, y in pts]

    def ell(self, cx, cy, rx, ry, fill, line=None, lw=1.2):
        box = [(cx - rx) * self.k, (cy - ry) * self.k, (cx + rx) * self.k, (cy + ry) * self.k]
        self.d.ellipse(box, fill=fill, outline=line, width=int(lw * self.k) if line else 0)

    def poly(self, pts, fill, line=None, lw=1.2):
        self.d.polygon(self.P(pts), fill=fill)
        if line: self.d.line(self.P(pts + [pts[0]]), fill=line, width=int(lw * self.k), joint='curve')

    def line(self, pts, col, lw=1.2):
        self.d.line(self.P(pts), fill=col, width=max(1, int(lw * self.k)), joint='curve')

    def capsule(self, a, b, r0, r1, fill, line=None, lw=1.2):
        """A rounded limb from a (radius r0) to b (radius r1), outlined."""
        (x0, y0), (x1, y1) = a, b
        ang = math.atan2(y1 - y0, x1 - x0); nx, ny = -math.sin(ang), math.cos(ang)
        pts = [(x0 + nx * r0, y0 + ny * r0), (x1 + nx * r1, y1 + ny * r1), (x1 - nx * r1, y1 - ny * r1), (x0 - nx * r0, y0 - ny * r0)]
        if line:
            self.ell(x0, y0, r0 + lw * 0.5, r0 + lw * 0.5, line); self.ell(x1, y1, r1 + lw * 0.5, r1 + lw * 0.5, line)
            self.poly([(x + nx * lw * 0.5 * s, y + ny * lw * 0.5 * s) for (x, y), s in zip(pts, (1, 1, -1, -1))], line)
        self.ell(x0, y0, r0, r0, fill); self.ell(x1, y1, r1, r1, fill); self.poly(pts, fill)

    def bez(self, p0, p1, p2, n=16):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]

    def image(self, w, h):
        return self.im.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------- the eyes, brows and mouth: clear and friendly
def eye(p, cx, cy, iris, kind, side, lashes, look=(0, 0)):
    ink = (58, 34, 40)
    if kind in ('open', 'wide', 'look', 'down', 'star'):
        ry = 7.0 if kind != 'wide' else 7.8; rx = 5.6 if kind != 'wide' else 6.0
        if kind == 'down': ry = 5.4
        p.ell(cx, cy, rx, ry, (255, 255, 255))                                     # the white
        lx, ly = look
        p.ell(cx + lx, cy + 0.8 + ly, rx * 0.78, ry * 0.82, darker(iris, 0.15))   # the iris, darker at the edge
        p.ell(cx + lx, cy + 1.6 + ly, rx * 0.6, ry * 0.62, iris)
        p.ell(cx + lx, cy + 3.4 + ly, rx * 0.42, ry * 0.3, lighter(iris, 0.35))   # light in the bottom of the iris
        p.ell(cx + lx, cy + 1.2 + ly, rx * 0.32, ry * 0.36, (40, 22, 30))         # the pupil
        if kind == 'star':
            st = [(cx + lx + math.cos(a) * (2.6 if i % 2 == 0 else 1.1), cy + 1 + ly + math.sin(a) * (2.6 if i % 2 == 0 else 1.1)) for i, a in enumerate([j * math.pi / 5 - math.pi / 2 for j in range(10)])]
            p.poly(st, (255, 236, 120))
        p.ell(cx - 2.0 + lx, cy - 2.4 + ly, 1.9, 2.1, (255, 255, 255))            # the shine, big
        p.ell(cx + 2.1 + lx, cy + 3.0 + ly, 0.9, 0.9, (255, 255, 255))            # and small
        top = p.bez((cx - rx - 0.6, cy - 0.5), (cx, cy - ry - 2.2), (cx + rx + 0.6, cy - 0.5))
        p.line(top, ink, 1.9)                                                      # the upper lid
        if lashes: p.line([(cx + side * (rx - 0.4), cy - 2.6), (cx + side * (rx + 2.4), cy - 4.6)], ink, 1.3)
        p.line(p.bez((cx - rx * 0.7, cy + ry * 0.92), (cx, cy + ry * 1.08), (cx + rx * 0.7, cy + ry * 0.92)), (170, 110, 110), 0.8)
        if kind == 'down': p.line(p.bez((cx - rx - 0.4, cy - 1.8), (cx, cy - 4.6), (cx + rx + 0.4, cy - 1.8)), ink, 1.6)
    elif kind == 'happy':      # ^ ^ smiling eyes
        p.line(p.bez((cx - 5.5, cy + 2.2), (cx, cy - 5.0), (cx + 5.5, cy + 2.2)), ink, 2.0)
    elif kind == 'shut':       # blinking
        p.line(p.bez((cx - 5.5, cy + 0.6), (cx, cy + 3.2), (cx + 5.5, cy + 0.6)), ink, 1.8)
        if lashes: p.line([(cx + side * 5.2, cy + 0.6), (cx + side * 7.2, cy - 0.8)], ink, 1.2)
    elif kind == 'half':       # proud, knowing
        p.ell(cx, cy + 1.5, 5.4, 5.0, (255, 255, 255)); p.ell(cx, cy + 2.4, 3.8, 3.6, iris); p.ell(cx, cy + 2.4, 1.6, 1.8, (40, 22, 30))
        p.ell(cx - 1.4, cy + 0.8, 1.2, 1.2, (255, 255, 255))
        p.poly([(cx - 6.2, cy - 6), (cx + 6.2, cy - 6), (cx + 6.2, cy - 0.2), (cx - 6.2, cy - 0.2)], None)
        p.line([(cx - 6.0, cy - 0.4), (cx + 6.0, cy - 0.4)], ink, 2.0)


def mouth(p, cx, cy, kind, talk):
    ink, inside, tongue, lip = (90, 40, 50), (150, 50, 70), (240, 120, 130), (220, 120, 120)
    if kind == 'grin' or talk == 2:          # wide open, laughing
        pts = p.bez((cx - 6, cy - 1), (cx, cy + 9), (cx + 6, cy - 1)); p.poly(pts, inside, ink, 1.4)
        p.poly([(cx - 4.2, cy - 0.4), (cx + 4.2, cy - 0.4), (cx + 3.6, cy + 1.2), (cx - 3.6, cy + 1.2)], (255, 255, 255))
        p.ell(cx, cy + 4.2, 2.8, 1.6, tongue)
    elif talk == 1:                          # talking: a small open mouth
        p.ell(cx, cy + 1.4, 3.2, 2.6, inside, ink, 1.2); p.ell(cx, cy + 2.6, 1.8, 0.9, tongue)
    elif kind == 'smile':
        p.line(p.bez((cx - 4.6, cy), (cx, cy + 3.8), (cx + 4.6, cy)), ink, 1.6)
    elif kind == 'o':
        p.ell(cx, cy + 1.4, 2.4, 2.8, inside, ink, 1.2)
    elif kind == 'flat':
        p.line(p.bez((cx - 3.2, cy + 1), (cx, cy + 1.8), (cx + 3.2, cy + 1)), ink, 1.5)
    elif kind == 'sad':
        p.line(p.bez((cx - 3.8, cy + 2.4), (cx, cy - 0.6), (cx + 3.8, cy + 2.4)), ink, 1.5)
    elif kind == 'smug':
        p.line(p.bez((cx - 4, cy + 1), (cx + 1, cy + 3.2), (cx + 5, cy - 1)), ink, 1.6)
    elif kind == 'cat':
        p.line([(cx - 4, cy), (cx - 2, cy + 1.8), (cx, cy + 0.2), (cx + 2, cy + 1.8), (cx + 4, cy)], ink, 1.4)
    elif kind == 'wavy':
        p.line([(cx - 4, cy + 1.4), (cx - 2, cy), (cx, cy + 1.4), (cx + 2, cy), (cx + 4, cy + 1.4)], ink, 1.4)


FACE = {   # eyes, brows (inner, outer lift), mouth
    'neutral': ('open', (0, 0), 'flat'), 'happy': ('open', (0.6, -0.4), 'smile'), 'laugh': ('happy', (-1, -1.4), 'grin'),
    'wink': ('wink', (0, -1), 'cat'), 'surprised': ('wide', (-2.6, -2.6), 'o'), 'think': ('look', (-1.6, 0.8), 'flat'),
    'sad': ('down', (-2.4, 1.8), 'sad'), 'proud': ('half', (0.6, -2.0), 'smug'), 'tease': ('half', (1.2, -2.2), 'cat'),
    'excited': ('star', (-2, -2.2), 'grin'), 'worried': ('open', (-2.8, 2.0), 'wavy'), 'shy': ('down', (-1.2, 0.8), 'smile'),
    'curious': ('wide', (-1.0, -2.6), 'o'), 'stern': ('half', (2.4, -0.6), 'flat'),
}


def face(p, c, hx, hy, expr, talk, blink):
    ek, (bi, bo), mk = FACE[expr]
    iris = rgb(c['iris'])
    for s in (-1, 1):
        cx, cy = hx + s * 9.2, hy + 3.2
        kind = 'shut' if blink and ek in ('open', 'wide', 'look', 'star', 'half', 'down') else ('happy' if ek == 'wink' and s > 0 else ('open' if ek == 'wink' else ek))
        look = (1.6, -1.2) if ek == 'look' else (0, 1.0) if ek == 'down' else (0, 0)
        eye(p, cx, cy, iris, kind, s, c.get('fem', False), look)
        bi2, bo2 = (bi, bo) if not (expr == 'curious' and s < 0) else (0, 0)
        brow = p.bez((cx - s * 4.0, cy - 10.0 + bi2 * 1.2), (cx + s * 0.6, cy - 12.4 + (bi2 + bo2) * 0.6), (cx + s * 6.0, cy - 9.6 + bo2 * 1.2))
        p.line(brow, darker(c['hair'][0], 0.1) if not c.get('elder') else (120, 110, 115), 2.0)
    p.line([(hx - 0.6, hy + 9.6), (hx + 0.8, hy + 10.6)], darker(c['skin'], 0.25), 1.1)   # a little nose
    mouth(p, hx, hy + 15.0, mk, talk)
    if expr in ('happy', 'laugh', 'wink', 'excited', 'shy', 'proud') or c.get('fem'):
        for s in (-1, 1): p.ell(hx + s * 13.4, hy + 11, 3.6, 2.0, (255, 150, 150, 120) if expr != 'shy' else (255, 120, 130, 170))
    if expr == 'worried': p.ell(hx + 17, hy - 6, 1.6, 2.4, (140, 210, 255))


# ---------------------------------------------------------------- the body, part by part: each part gets its own soft outline
W, H, SCALE = 100, 172, 2
F = 0.72          # the head's size against the sample's: taller, more grown-up proportions (a head about a sixth of the height)
ARMS = {   # shoulder → elbow → wrist, as offsets from the middle (x) and in units (y)
    'down': (((-17, 58), (-20, 82), (-21, 104)), ((17, 58), (20, 82), (21, 104))),
    'hip': (((-17, 58), (-29, 76), (-14, 90)), ((17, 58), (20, 82), (22, 103))),
    'talk': (((-17, 58), (-29, 76), (-14, 90)), ((17, 58), (27, 76), (37, 66))),
    'cheer': (((-17, 58), (-24, 40), (-26, 22)), ((17, 58), (24, 40), (26, 22))),
    'wave': (((-17, 58), (-20, 82), (-21, 104)), ((17, 58), (27, 42), (29, 24))),
    'think': (((-17, 58), (-19, 80), (-3, 90)), ((17, 58), (22, 78), (7, 47))),
    'point': (((-17, 58), (-29, 76), (-14, 90)), ((17, 58), (28, 60), (40, 54))),
    'proud': (((-17, 58), (-29, 76), (-14, 90)), ((17, 58), (29, 76), (14, 90))),
    'clasp': (((-17, 58), (-19, 80), (-3, 92)), ((17, 58), (19, 80), (3, 92))),
    'hold': (((-17, 58), (-29, 76), (-14, 90)), ((17, 58), (25, 80), (27, 96))),
    'cross': (((-17, 58), (-22, 74), (9, 76)), ((17, 58), (22, 74), (-9, 74))),
    'herald': (((-17, 58), (-20, 82), (-21, 104)), ((17, 58), (27, 42), (30, 22))),
}


class Body:
    def __init__(self, c, scale=SCALE):
        self.c = c; self.k = scale * SS; self.scale = scale
        self.out = Image.new('RGBA', (int(W * self.k), int(H * self.k)), (0, 0, 0, 0))

    def part(self, draw, shade=None, line=None, lw=1.3):
        """One part: its fill, shading kept inside it, and a soft outline (darker than the fill) grown around it."""
        lay = Pen(W, H, self.scale); draw(lay)
        a = lay.im.split()[3]
        if shade:
            from PIL import ImageChops
            sh = Pen(W, H, self.scale); shade(sh); sh.im.putalpha(ImageChops.multiply(sh.im.split()[3], a)); lay.im.alpha_composite(sh.im)
        box = a.getbbox()
        if box is None: return
        if line is not None:   # grow the outline only round this part (filtering the whole picture was far too slow)
            pad = int(lw * self.k) + 2; bx = (max(0, box[0] - pad), max(0, box[1] - pad), min(a.width, box[2] + pad), min(a.height, box[3] + pad))
            grow = a.crop(bx).filter(ImageFilter.MaxFilter(int(lw * self.k) | 1))
            ol = Image.new('RGBA', grow.size, tuple(line[:3]) + (255,)); ol.putalpha(grow)
            self.out.alpha_composite(ol, (bx[0], bx[1]))
        self.out.alpha_composite(lay.im)

    def paste_face(self, c, hx, hy, expr, talk, blink):
        """The face is drawn at the sample's size and scaled to this head, so it stays as clear as it was drawn."""
        tmp = Pen(W, H, self.scale); face(tmp, c, 50, 40, expr, talk, blink)
        k = self.k; box = (int(24 * k), int(14 * k), int(76 * k), int(64 * k))
        crop = tmp.im.crop(box); crop = crop.resize((max(1, int(crop.width * F)), max(1, int(crop.height * F))), Image.LANCZOS)
        self.out.alpha_composite(crop, (int((hx - 26 * F) * k), int((hy - 26 * F) * k)))

    def image(self):
        return self.out.resize((int(W * self.scale), int(H * self.scale)), Image.LANCZOS)


def person(c, pose='idle', frame=0, expr='happy', talk=0, blink=False, snapshot=False):
    b = Body(c); X = 50; up = -1.0 if frame else 0; hop = -5 if pose == 'cheer' and frame else 0; dy = up + hop
    sk = rgb(c['skin']); skd = darker(sk, 0.18); deel = rgb(c['deel']); deeld = darker(deel, 0.22); trim = rgb(c['trim'])
    hair, hairl = rgb(c['hair'][0]), rgb(c['hair'][1]); OL = lambda col: darker(col, 0.5)
    hx, hy = X, 28 + dy + (3 if c.get('short') else 0)
    H_ = lambda dx, dy_: (hx + dx * F, hy + dy_ * F)       # a point on the head, in the sample's head units
    arms = ARMS[c['sig'] if pose == 'idle' else pose]
    do = c.get('hairdo'); long_ = do in ('braids', 'bob', 'long')
    if do in ('braids', 'long', 'bob', 'bun'):
        b.part(lambda p: p.ell(hx, hy - 2 * F, 25.5 * F, 24 * F, hair), line=OL(hair))   # the back of the hair, framing the face
    # tall boots (gutal) with turned-up toes
    def boots(p):
        for s2 in (-1, 1):
            bx = X + s2 * 7.5
            p.poly([(bx - 5, 134 + hop), (bx + 5, 134 + hop), (bx + 5, 163 + hop), (bx + s2 * 8.5, 161 + hop), (bx + s2 * 9.5, 168 + hop), (bx - 5, 168 + hop)], rgb(c['boots']))
    b.part(boots, lambda p: [p.poly([(X + s2 * 7.5 - 5, 161 + hop), (X + s2 * 7.5 + 5, 161 + hop), (X + s2 * 7.5 + 5, 168 + hop), (X + s2 * 7.5 - 5, 168 + hop)], darker(rgb(c['boots']), 0.25)) for s2 in (-1, 1)] + [p.line([(X + s2 * 7.5 - 4, 140 + hop), (X + s2 * 7.5 + 4, 140 + hop)], trim, 1.2) for s2 in (-1, 1)], OL(rgb(c['boots'])))
    # the deel: a long skirt to the shins, a fitted body, the sash and the flap with its trim
    bw = 3 if c.get('broad') else 0; fw = -1.5 if c.get('fem') else 0
    skirt = [(X - 11 - bw - fw, 92 + dy), (X + 11 + bw + fw, 92 + dy), (X + 20 + bw, 138 + hop * 0.3), (X + 14, 141 + hop * 0.3), (X, 142 + hop * 0.3), (X - 14, 141 + hop * 0.3), (X - 20 - bw, 138 + hop * 0.3)]
    b.part(lambda p: p.poly(skirt, deel), lambda p: (p.poly([(X - 11 - bw, 92 + dy), (X - 5, 92 + dy), (X - 8, 143), (X - 22 - bw, 139)], deeld), p.poly([(X - 21, 134 + hop * 0.3), (X + 21, 134 + hop * 0.3), (X + 21, 144), (X - 21, 144)], trim), p.line([(X + 8, 94 + dy), (X + 13, 137)], trim, 1.4)), OL(deel))
    torso = [(X - 17 - bw, 54 + dy), (X + 17 + bw, 54 + dy), (X + 11 + bw + fw, 93 + dy), (X - 11 - bw - fw, 93 + dy)]
    def tor(p):
        p.poly(torso, deel); p.ell(X - 16 - bw, 59 + dy, 6, 6, deel); p.ell(X + 16 + bw, 59 + dy, 6, 6, deel)
    def tors(p):
        p.poly([(X - 24, 52 + dy), (X - 7, 52 + dy), (X - 7, 95 + dy), (X - 24, 95 + dy)], deeld)
        p.line([(X - 2, 52 + dy), (X + 6, 61 + dy), (X + 16, 64 + dy)], trim, 1.8)
        sa = rgb(c['sash']); p.poly([(X - 14, 86 + dy), (X + 14, 86 + dy), (X + 14, 94 + dy), (X - 14, 94 + dy)], sa); p.poly([(X - 14, 91 + dy), (X + 14, 91 + dy), (X + 14, 94 + dy), (X - 14, 94 + dy)], darker(sa, 0.2))
        if c.get('medal'): p.ell(X - 8, 68 + dy, 3, 3, (255, 205, 60))
    b.part(tor, tors, OL(deel))
    # the arms, with cuffs and hands
    def arm(side):
        (sx, sy), (ex, ey), (wx, wy) = [(X + ax, ay + dy) for ax, ay in arms[0 if side < 0 else 1]]
        def dr(p):
            p.capsule((sx, sy), (ex, ey), 5.6 + bw * 0.4, 5.0, deel); p.capsule((ex, ey), (wx, wy), 5.0, 4.5, deel)
        ang = math.atan2(wy - ey, wx - ex)
        def sh(p):
            p.capsule((sx + 1.6, sy + 1.6), (ex + 1.6, ey + 1.6), 2.4, 2.1, deeld)
            p.capsule((wx - math.cos(ang) * 2.6, wy - math.sin(ang) * 2.6), (wx, wy), 5.4, 5.4, rgb(c['cuff']))
        b.part(dr, sh, OL(deel))
        hx2, hy2 = wx + math.cos(ang) * 5, wy + math.sin(ang) * 5
        b.part(lambda p: (p.ell(hx2, hy2, 4.4, 4.6, sk), p.ell(hx2 - side * 2.8, hy2 - 1.8, 1.9, 1.9, sk)), lambda p: p.ell(hx2 + 1.2, hy2 + 1.4, 2.8, 2.8, skd), OL(sk), 1.1)
        return hx2, hy2
    hands = {s2: arm(s2) for s2 in (-1, 1)}
    # neck, ears and head
    b.part(lambda p: p.poly([(hx - 4.4, hy + 10), (hx + 4.4, hy + 10), (hx + 4.4, 56 + dy), (hx - 4.4, 56 + dy)], sk), lambda p: p.poly([(hx - 4.4, hy + 10), (hx + 4.4, hy + 10), (hx + 4.4, hy + 15), (hx - 4.4, hy + 15)], skd), OL(sk))
    b.part(lambda p: (p.ell(*H_(-21, 5), 4.5 * F, 6 * F, sk), p.ell(*H_(21, 5), 4.5 * F, 6 * F, sk)), None, OL(sk), 1.1)
    def headf(p):
        p.ell(hx, hy, 22 * F, 20.5 * F, sk)
        p.poly(p.bez(H_(-20, 6), H_(0, 30), H_(20, 6)), sk)
    b.part(headf, lambda p: p.ell(*H_(16, 6), 7 * F, 16 * F, skd), OL(sk), 1.2)
    b.part(lambda p: p.poly([(hx - 8, 51 + dy), (hx + 8, 51 + dy), (hx + 7, 56 + dy), (hx - 7, 56 + dy)], trim), None, OL(trim), 1.0)   # the collar
    before = b.out.copy() if snapshot else None   # the picture before the hair and hat go on (for the face overlays)
    if expr: b.paste_face(c, hx, hy, expr, talk, blink)
    # hair on top: a rounded crown with a shine and a soft scalloped fringe above the brows, thin locks framing the face
    def hairf(p):
        crown = p.bez(H_(-24, -1), H_(0, -42), H_(24, -1))
        fringe = [H_(24, -1), H_(18, -10), H_(12, -7), H_(6, -12), H_(0, -8), H_(-6, -12), H_(-12, -7), H_(-18, -10), H_(-24, -1)] if long_ \
            else [H_(24, -3), H_(16, -13), H_(8, -11), H_(0, -14), H_(-8, -11), H_(-16, -13), H_(-24, -3)]
        p.poly(crown + fringe[1:-1], hair)
        if long_:
            for s2 in (-1, 1): p.capsule(H_(s2 * 21, -6), H_(s2 * 21.5, 20 if do == 'bob' else 13), 3.6 * F, 2.6 * F, hair)
        if do == 'bun': p.ell(*H_(0, -25), 9 * F, 7.5 * F, hair)
    b.part(hairf, lambda p: (p.line(p.bez(H_(-15, -16), H_(-3, -24), H_(11, -18)), hairl, 2.6), p.line(p.bez(H_(-9, -19), H_(-4, -21), H_(1, -20)), lighter(hairl, 0.4), 1.2)), OL(hair), 1.3)
    if do == 'braids':
        def br(p):
            for s2 in (-1, 1): p.capsule(H_(s2 * 19, 12), (hx + s2 * 15, 84 + dy), 3.4, 2.8, hair)
        b.part(br, lambda p: [p.line([(hx + s2 * 14.5 - 1.6, y), (hx + s2 * 14.5 + 1.6, y + 2.4)], hairl, 1.0) for s2 in (-1, 1) for y in range(int(hy + 12), int(82 + dy), 5)], OL(hair), 1.1)
        b.part(lambda p: [p.ell(hx + s2 * 15, 87 + dy, 3, 2.5, (255, 80, 70)) for s2 in (-1, 1)], None, OL((255, 80, 70)), 1.0)
    # hats
    hat = c.get('hat')
    if hat == 'mongol':    # the traditional hat: a red crown with a gold knot and red tassels, an upturned dark brim
        b.part(lambda p: (p.poly([H_(-16, -14), H_(-8, -34), H_(8, -34), H_(16, -14)], (216, 58, 42)), p.ell(*H_(0, -36), 3.4 * F, 3.4 * F, (255, 205, 60))),
               lambda p: (p.poly([H_(-4, -34), H_(4, -34), H_(3, -14), H_(-3, -14)], (255, 110, 80)), p.line([H_(0, -33), H_(-6, -20)], (180, 30, 30), 1.0), p.line([H_(0, -33), H_(6, -20)], (180, 30, 30), 1.0)), OL((216, 58, 42)), 1.2)
        b.part(lambda p: p.poly([H_(-26, -11), H_(26, -11), H_(23, -20), H_(-23, -20)], (52, 36, 32)), lambda p: p.line([H_(-22, -18), H_(22, -18)], (90, 70, 60), 1.0), OL((52, 36, 32)), 1.1)
    elif hat == 'loovuuz':  # a fur hat with ear flaps and a blue pointed top
        b.part(lambda p: (p.poly([H_(-18, -16), H_(0, -36), H_(18, -16)], (47, 111, 219)), p.ell(*H_(0, -37), 2.6 * F, 2.6 * F, (255, 205, 60))), None, OL((47, 111, 219)), 1.2)
        b.part(lambda p: (p.poly([H_(-26, -20), H_(26, -20), H_(26, -9), H_(-26, -9)], (138, 90, 51)), p.capsule(H_(-24, -12), H_(-25, 14), 4.6 * F, 4 * F, (138, 90, 51)), p.capsule(H_(24, -12), H_(25, 14), 4.6 * F, 4 * F, (138, 90, 51))),
               lambda p: p.line([H_(-24, -17), H_(24, -17)], (190, 150, 100), 1.6), OL((138, 90, 51)), 1.2)
    elif hat == 'cap':
        b.part(lambda p: (p.ell(*H_(0, -16), 23 * F, 13 * F, (58, 90, 138)), p.poly([H_(2, -10), H_(30, -8), H_(28, -3), H_(2, -5)], (42, 63, 102))), lambda p: p.ell(*H_(-6, -22), 8 * F, 4 * F, (90, 122, 170)), OL((58, 90, 138)), 1.2)
    elif hat == 'flower':
        b.part(lambda p: (p.poly([H_(-23, -15), H_(23, -15), H_(23, -10), H_(-23, -10)], (255, 111, 168)), p.ell(*H_(13, -16), 5 * F, 5 * F, (255, 211, 74)), p.ell(*H_(13, -16), 2.2 * F, 2.2 * F, (255, 138, 31))), None, OL((255, 111, 168)), 1.0)
    # glasses, moustache and beard (grey for the elders)
    if c.get('glasses'):
        gp = Pen(W, H, SCALE)
        for s2 in (-1, 1): gp.ell(*H_(s2 * 9.2, 3.6), 7.6 * F, 7.2 * F, None, (60, 40, 50), 1.1)
        gp.line([H_(-2, 3), H_(2, 3)], (60, 40, 50), 1.0); b.out.alpha_composite(gp.im)
    if c.get('beard'):
        b.part(lambda p: p.poly([H_(-15, 10), H_(15, 10), H_(10, 30), H_(0, 36), H_(-10, 30)], hair), lambda p: p.line([H_(-3, 18), H_(-2, 30)], hairl, 1.2), OL(hair), 1.1)
    if c.get('mustache') or c.get('beard'):
        b.part(lambda p: p.poly([H_(-11, 14), H_(-3, 10), H_(3, 10), H_(11, 14), H_(10, 17), H_(3, 14), H_(-3, 14), H_(-10, 17)], hair), None, OL(hair), 1.0)
    # what they work with, in the right hand
    prop = c.get('prop')
    if prop and pose == 'idle':
        hx2, hy2 = hands[1]
        if prop == 'rod': b.part(lambda p: (p.line([(hx2, hy2), (hx2 + 10, hy2 - 52)], (138, 90, 46), 2.0), p.line([(hx2 + 10, hy2 - 52), (hx2 + 15, hy2 - 18)], (230, 230, 240), 0.8)), None, (90, 60, 30), 0.8)
        elif prop == 'bucket': b.part(lambda p: (p.poly([(hx2 - 7, hy2 + 3), (hx2 + 7, hy2 + 3), (hx2 + 6, hy2 + 16), (hx2 - 6, hy2 + 16)], (200, 207, 216)), p.line(p.bez((hx2 - 7, hy2 + 3), (hx2, hy2 - 6), (hx2 + 7, hy2 + 3)), (100, 106, 116), 1.2)), lambda p: p.poly([(hx2 - 6, hy2 + 4), (hx2 + 6, hy2 + 4), (hx2 + 6, hy2 + 7), (hx2 - 6, hy2 + 7)], (255, 252, 240)), (90, 96, 106), 1.1)
        elif prop == 'bow': b.part(lambda p: (p.line(p.bez((hx2 + 2, hy2 - 30), (hx2 + 14, hy2), (hx2 + 2, hy2 + 30)), (138, 74, 30), 2.4), p.line([(hx2 + 2, hy2 - 30), (hx2 + 2, hy2 + 30)], (240, 230, 208), 0.7)), None, (80, 40, 20), 0.8)
        elif prop == 'hammer': b.part(lambda p: (p.line([(hx2, hy2 + 4), (hx2 + 3, hy2 - 18)], (138, 90, 46), 2.2), p.poly([(hx2 - 4, hy2 - 24), (hx2 + 10, hy2 - 24), (hx2 + 10, hy2 - 17), (hx2 - 4, hy2 - 17)], (122, 127, 136))), lambda p: p.line([(hx2 - 3, hy2 - 23), (hx2 + 9, hy2 - 23)], (184, 189, 198), 1.2), (70, 60, 50), 1.0)
        elif prop == 'scroll': b.part(lambda p: (p.poly([(hx2 - 5, hy2 - 16), (hx2 + 5, hy2 - 16), (hx2 + 5, hy2 + 10), (hx2 - 5, hy2 + 10)], (246, 232, 196)), p.ell(hx2, hy2 - 17, 6.5, 2.4, (168, 120, 74)), p.ell(hx2, hy2 + 11, 6.5, 2.4, (168, 120, 74))), lambda p: [p.line([(hx2 - 1, y), (hx2 - 1, y + 2.5)], (90, 58, 34), 0.9) for y in range(int(hy2 - 12), int(hy2 + 6), 4)], (120, 80, 50), 1.0)
        elif prop == 'uurga': b.part(lambda p: (p.line([(hx2 - 3, hy2 + 24), (hx2 + 6, hy2 - 58)], (168, 120, 74), 2.0), p.line(p.bez((hx2 + 6, hy2 - 58), (hx2 + 19, hy2 - 54), (hx2 + 5, hy2 - 43)), (232, 216, 176), 1.2)), None, (100, 70, 40), 0.8)
        elif prop == 'book': b.part(lambda p: p.poly([(hx2 - 8, hy2 - 2), (hx2 + 8, hy2 - 2), (hx2 + 8, hy2 + 10), (hx2 - 8, hy2 + 10)], (216, 58, 42)), lambda p: (p.poly([(hx2 - 7, hy2 - 1), (hx2 + 7, hy2 - 1), (hx2 + 7, hy2 + 8), (hx2 - 7, hy2 + 8)], (255, 250, 240)), p.line([(hx2, hy2 - 1), (hx2, hy2 + 8)], (200, 184, 154), 0.8)), (130, 30, 20), 1.0)
        elif prop == 'whip': b.part(lambda p: (p.line([(hx2, hy2), (hx2 + 4, hy2 + 18)], (90, 58, 34), 2.0), p.line(p.bez((hx2 + 4, hy2 + 18), (hx2 + 14, hy2 + 22 + frame * 2), (hx2 + 8, hy2 + 34)), (42, 28, 24), 1.2)), None, (40, 26, 20), 0.6)
    if c.get('scarf'):   # a small silk neckerchief, its two ends swinging a little
        sc = rgb(c['scarf']); wv = 1.2 if frame else 0
        b.part(lambda p: (p.ell(hx, 54 + dy, 10, 3.8, sc), p.poly([(hx + 2, 54 + dy), (hx + 8, 54 + dy), (hx + 9 + wv, 64 + dy), (hx + 4 + wv, 65 + dy)], sc), p.poly([(hx - 1, 55 + dy), (hx + 4, 55 + dy), (hx + 2 - wv, 63 + dy), (hx - 3 - wv, 62 + dy)], sc)),
               lambda p: p.poly([(hx + 5, 58 + dy), (hx + 9 + wv, 64 + dy), (hx + 6 + wv, 65 + dy)], darker(sc, 0.2)), OL(sc), 1.0)
    if snapshot: return b.image(), before.resize((int(W * b.scale), int(H * b.scale)), Image.LANCZOS)
    return b.image()


def face_layer(c, expr, talk, blink):
    """Only the face (eyes, brows, nose, mouth, blush) on a clear picture, where the standing pose's head is."""
    b = Body(c); b.paste_face(c, 50, 28 + (3 if c.get('short') else 0), expr, talk, blink); return b.image()
