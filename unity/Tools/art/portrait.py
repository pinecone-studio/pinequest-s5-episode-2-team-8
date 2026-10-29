# Story mode portraits: 64×64 busts lit from the upper left, for Temüjin at three ages and the people of his story.
# Each character gets a sheet story_face_<id>: one row per expression, columns = mouth closed, mouth open, blinking.
# The looks follow the sources: Mongol men shaved the crown and wore two braids looped behind the ears (kekül),
# married noblewomen wore the tall boqta headdress, men wore gold earrings, the Kereit were Nestorian Christians.
#   python3 unity/Tools/art/portrait.py [preview_dir]
import json
import os
import sys

from pix import Canvas, mix, save, shade, sheet

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources')
S = 64
EXPRS = ['neutral', 'smile', 'stern', 'sad', 'shout', 'surprised']
OUT = '#1c1016'
EYE_W, EYE_IRIS = '#f3ead8', '#2a1810'
LIP, LIP_D, MOUTH, TEETH = '#b0605a', '#7e3a3a', '#4a1a20', '#f3ead8'

SKINS = {
    'warm': ('#e8b48a', '#c88a64', '#a86a4c', '#f6d0ac'),
    'tan': ('#d8a070', '#b47c52', '#8e5c3c', '#ecc096'),
    'light': ('#f0c49c', '#d29e78', '#b07e5c', '#fcdcbc'),
}
HAIRS = {'black': ('#1e1418', '#3a2a2e', '#5a4448'), 'grey': ('#5a5458', '#8a8488', '#c4bec0'), 'white': ('#a8a2a0', '#d6d0cc', '#f4f0ec')}


def head(c, p, e, open_, blink):
    sk, sks, skd, skl = SKINS[p.get('skin', 'warm')]
    hair, hairm, hairl = HAIRS[p.get('hair', 'black')]
    age = p.get('age', 'adult'); fem = p.get('fem', False)
    cx, cy = 32, 31
    rx = 12; ry = {'child': 13, 'young': 15, 'adult': 15, 'elder': 15}[age]
    if fem: rx -= 1
    fy = cy - ry + 6           # the hairline: hats sit on it, so the brows and eyes stay in sight
    # ---------------- shoulders and clothes
    deel, deel_d, deel_l = p['deel']
    c.poly([(2, 64), (6, 54), (19, 48), (45, 48), (58, 54), (62, 64)], deel)
    c.poly([(2, 64), (6, 54), (19, 48), (24, 48), (15, 64)], deel_l)            # the lit shoulder
    c.poly([(45, 48), (58, 54), (62, 64), (49, 64)], deel_d)
    if p.get('armor'):   # lamellar armour: rows of small plates laced together, with a gilded edge
        a, ad, al = p['armor']
        c.poly([(4, 64), (7, 55), (21, 50), (43, 50), (57, 55), (60, 64)], a)
        for row in range(51, 64, 3):
            for col in range(6 + (row // 3) % 2 * 2, 60, 4):
                c.rect(col, row, 3, 2, al if col < 28 else ad, only_on=True)
                c.px(col + 1, row, '#e0b04a') if (col + row) % 7 == 0 else None
        c.lines([(7, 55), (21, 50), (43, 50), (57, 55)], '#e0b04a')
    if p.get('pattern'):  # gold cloud pattern woven in the brocade
        for (x, y) in ((12, 56), (22, 60), (44, 57), (52, 61), (34, 62)):
            c.pxs([(x, y), (x + 1, y - 1), (x + 2, y), (x + 1, y + 1), (x + 3, y - 1)], p['pattern'])
    # the collar: fur, or the overlapping deel flap
    if p.get('fur'):
        f, fd, fl = p['fur']
        c.ellipse(32, 51, 17, 5, f)
        for x in range(16, 49, 2):
            c.px(x, 47 + (x % 3), fl); c.px(x + 1, 53 - (x % 2), fd)
    else:
        c.poly([(24, 47), (32, 56), (40, 47)], deel_d)
        c.lines([(24, 47), (32, 55), (38, 48)], p.get('trim', '#e0b04a'))
    if p.get('cross'):     # the Kereit were Nestorian Christians: a small cross on a cord
        c.line(32, 55, 32, 59, '#e0c060'); c.line(30, 57, 34, 57, '#e0c060')
    # ---------------- neck
    c.rect(cx - 5, cy + ry - 4, 10, 10, sk)
    c.rect(cx - 5, cy + ry - 4, 10, 4, skd)
    c.rect(cx + 2, cy + ry - 2, 3, 8, sks)
    # ---------------- back hair / headdress behind the head
    if fem and p.get('braids'):
        c.limb(cx - rx - 1, cy, cx - rx - 2, 60, 3, 2.5, hair); c.limb(cx + rx + 1, cy, cx + rx + 2, 60, 3, 2.5, hair)
        for y in range(cy + 3, 58, 3):
            c.px(cx - rx - 2, y, hairm); c.px(cx + rx + 2, y + 1, hairm)
        c.ellipse(cx, cy - 3, rx + 2, ry, hair)
    # ---------------- the face
    c.ellipse(cx, cy, rx, ry, sk)
    jaw = p.get('jaw', 0)  # a broader, squarer jaw for grown men
    c.poly([(cx - rx + 1, cy + 3), (cx + rx - 1, cy + 3), (cx + rx - 3 + jaw, cy + ry - 3), (cx + 3, cy + ry), (cx - 3, cy + ry), (cx - rx + 3 - jaw, cy + ry - 3)], sk)
    # light and shade: lit forehead and cheekbone on the left, shaded right side and under the jaw
    c.ellipse(cx - 4, fy + 2, 4, 1.5, skl, only_on=True)
    c.ellipse(cx + rx - 1, cy + 2, 3, ry - 2, sks, only_on=True)
    c.ellipse(cx + rx, cy + 3, 1.5, ry - 4, skd, only_on=True)
    c.ellipse(cx - rx + 4, cy + 4, 2.5, 1.5, skl, only_on=True)                     # cheekbone
    c.ellipse(cx + rx - 5, cy + 4, 2.5, 1.5, sks, only_on=True)
    # Soft, warm cheek color ties the narrated cast to Bolormaa's expressive portrait style.
    cheek = mix(sk, '#e88070', 0.2 if fem else 0.12)
    c.ellipse(cx - 6, cy + 7, 2.2, 1.0, cheek, only_on=True)
    c.ellipse(cx + 7, cy + 7, 2.0, 1.0, mix(sks, cheek, 0.55), only_on=True)
    c.ellipse(cx - 3, fy + 2, 2.0, 1.0, skl, only_on=True)
    if fem:
        c.ellipse(cx - rx + 4, cy + 6, 2, 1, mix(sk, '#e88070', 0.35), only_on=True)
        c.ellipse(cx + rx - 4, cy + 6, 2, 1, mix(sks, '#e88070', 0.35), only_on=True)
    if age == 'elder':   # lines of age
        c.line(cx - 7, cy + 5, cx - 6, cy + 9, sks); c.line(cx + 6, cy + 5, cx + 5, cy + 9, skd)
        c.line(cx - 4, cy - 7, cx + 3, cy - 7, sks)
    # ears and gold earrings (worn by men and women alike)
    c.ellipse(cx - rx, cy + 1, 2, 3, sk); c.ellipse(cx + rx, cy + 1, 2, 3, sks)
    c.px(cx - rx, cy + 1, sks)
    if p.get('earring', True):
        c.ellipse(cx - rx, cy + 5, 1, 1.5, '#e8b844'); c.px(cx - rx, cy + 6, '#fff0a0')
    # ---------------- the eyes, brows, nose and mouth
    ey = cy - 1 if age != 'child' else cy
    gap = 5
    br_in, br_out = {'neutral': (0, 0), 'smile': (0, -1), 'stern': (2, -1), 'sad': (-2, 1), 'shout': (2, -1), 'surprised': (-2, -2)}[e]
    for side in (-1, 1):
        x0 = cx + side * gap
        lit = side < 0
        # the socket shadow, the lids and a narrow almond eye with an upward outer corner
        c.rect(x0 - 2 if side > 0 else x0 - 3, ey - 2, 6, 1, sks)
        wide = e == 'surprised'
        if blink:
            c.line(x0 - 2 * (side < 0) - 1, ey, x0 + 2, ey, OUT) if side < 0 else c.line(x0 - 1, ey, x0 + 3, ey, OUT)
        else:
            xa, xb = (x0 - 3, x0 + 1) if side < 0 else (x0 - 1, x0 + 3)
            c.rect(xa, ey - (1 if wide else 0), xb - xa + 1, 2 if not wide else 3, EYE_W)
            ix = x0 - 1 if side < 0 else x0
            c.rect(ix, ey - (1 if wide else 0), 2, 2 if not wide else 3, EYE_IRIS)
            if p.get('fire') and lit:
                c.px(ix, ey, '#ffb060')      # “fire in his eyes”
            else:
                c.px(ix, ey - (1 if wide else 0), '#6a4a3a')
            c.px(ix - 1, ey - 1 - (1 if wide else 0), '#fff6e5')  # a small catchlight in every open eye
            c.line(xa, ey - 1 - (1 if wide else 0), xb, ey - 1 - (1 if wide else 0), OUT)   # the upper lid
            c.px(xb + (1 if side > 0 else 0) if side > 0 else xa - 1, ey - 2 - (1 if wide else 0), OUT)  # outer corner flick
            if e in ('smile',):
                c.line(xa, ey + 1, xb, ey + 1, sks)   # smiling eyes crinkle
        # the brow
        bt = p.get('brow', 1)
        bx0, bx1 = (x0 + 1, x0 - 4) if side < 0 else (x0 - 1, x0 + 4)
        c.line(bx0, ey - 4 + br_in, bx1, ey - 4 + br_out, hair, w=1)
        if bt > 1:
            c.line(bx0, ey - 5 + br_in, bx1 + (1 if side < 0 else -1), ey - 5 + br_out, hair)
    if e in ('stern', 'shout'):
        c.px(cx, ey - 4, sks); c.px(cx, ey - 3, sks)       # the frown line between the brows
    # nose: a lit bridge and a shaded side, nostrils
    c.line(cx - 1, ey + 1, cx - 1, ey + 5, skl); c.line(cx + 1, ey + 1, cx + 1, ey + 6, sks)
    c.pxs([(cx - 2, ey + 7), (cx + 1, ey + 7)], skd); c.px(cx, ey + 7, sks)
    my = ey + 10 if age != 'child' else ey + 9
    beard = p.get('beard')
    # mouth by expression; open = speaking
    if e == 'shout' or (open_ and e == 'surprised'):
        c.rect(cx - 3, my - 1, 7, 4, MOUTH); c.rect(cx - 2, my - 1, 5, 1, TEETH); c.rect(cx - 3, my - 2, 7, 1, LIP)
    elif open_:
        c.rect(cx - 2, my, 5, 2, MOUTH); c.rect(cx - 2, my - 1, 5, 1, LIP); c.rect(cx - 1, my + 2, 3, 1, LIP)
        if e == 'smile': c.rect(cx - 1, my, 3, 1, TEETH)
    elif e == 'smile':
        c.pxs([(cx - 3, my - 1), (cx - 2, my), (cx - 1, my), (cx, my), (cx + 1, my), (cx + 2, my), (cx + 3, my - 1)], LIP_D)
        c.rect(cx - 1, my + 1, 3, 1, LIP)
    elif e == 'sad':
        c.pxs([(cx - 2, my + 1), (cx - 1, my), (cx, my), (cx + 1, my), (cx + 2, my + 1)], LIP_D)
    elif e == 'surprised':
        c.rect(cx - 1, my - 1, 3, 3, MOUTH)
    else:
        c.line(cx - 2, my, cx + 2, my, LIP_D); c.rect(cx - 1, my + 1, 3, 1, LIP)
    c.px(cx, my - 2, sks)  # philtrum
    # ---------------- facial hair
    if beard in ('mustache', 'long', 'goatee', 'white'):
        bc = {'mustache': hair, 'long': hair, 'goatee': hair, 'white': HAIRS['white'][0]}[beard]
        bl = {'mustache': hairm, 'long': hairm, 'goatee': hairm, 'white': HAIRS['white'][2]}[beard]
        c.lines([(cx - 5, my + 1), (cx - 3, my - 2), (cx, my - 2), (cx + 3, my - 2), (cx + 5, my + 1)], bc)   # a drooping moustache
        c.px(cx - 6, my + 2, bc); c.px(cx + 6, my + 2, bc)
        if beard in ('long', 'white'):
            pts = [(cx - rx + 3, cy + 4), (cx - 5, my + 2), (cx + 5, my + 2), (cx + rx - 3, cy + 4), (cx + rx - 4, cy + ry), (cx + 4, cy + ry + 7), (cx, cy + ry + 10), (cx - 4, cy + ry + 7), (cx - rx + 4, cy + ry)]
            c.poly(pts, bc)
            c.rect(cx - 1, my + 1, 3, 2, MOUTH if open_ else LIP_D)
            for i in (-3, 2):   # strands catching the light
                c.line(cx + i, my + 4, cx + i + (1 if i < 0 else -1), cy + ry + 5 - abs(i), bl)
            if p.get('grey'):   # grey coming in at the chin
                c.ellipse(cx, cy + ry + 4, 3, 3, mix(bc, HAIRS['grey'][1], 0.5), only_on=True)
                c.line(cx - 5, my + 4, cx - 4, cy + ry + 1, mix(bc, HAIRS['grey'][1], 0.6))
        if beard == 'goatee':
            c.poly([(cx - 3, my + 3), (cx + 3, my + 3), (cx + 1, cy + ry + 5), (cx - 1, cy + ry + 5)], bc)
    if beard == 'thin':
        c.pxs([(cx - 4, my - 1), (cx - 3, my - 2), (cx - 2, my - 2), (cx + 2, my - 2), (cx + 3, my - 2), (cx + 4, my - 1)], hair)
    # ---------------- hair and hats
    hat = p.get('hat')
    if not fem and hat in (None, 'cap'):
        # kekül: the shaved crown, a forelock, and braids looped behind the ears
        c.ellipse(cx, fy - 2, rx - 1, 5, mix(sk, '#8a9aa0', 0.2), only_on=True)
        c.poly([(cx - 2, fy - 3), (cx + 2, fy - 3), (cx + 1, fy + 3), (cx - 1, fy + 3)], hair)       # forelock
    if not fem and hat in (None, 'cap'):   # the braids, looped and hanging behind the ears
        for side in (-1, 1):
            c.limb(cx + side * (rx + 1), cy - 2, cx + side * (rx + 2), cy + 9, 1.6, 1.2, hair)
            for y in range(cy, cy + 9, 2): c.px(cx + side * (rx + 2), y, hairm)
    if fem:
        c.ellipse(cx, fy - 3, rx + 1, 6, hair)
        c.poly([(cx - rx - 1, fy - 1), (cx - 1, fy - 4), (cx - 1, fy - 1), (cx - rx + 3, fy + 1), (cx - rx + 1, cy + 4), (cx - rx - 1, cy + 4)], hair)   # parted in the middle
        c.poly([(cx + rx + 1, fy - 1), (cx + 1, fy - 4), (cx + 1, fy - 1), (cx + rx - 3, fy + 1), (cx + rx - 1, cy + 4), (cx + rx + 1, cy + 4)], hair)
        c.line(cx - 4, fy - 5, cx - 8, fy - 1, hairl)
    top = cy - ry   # the top of the skull
    if hat == 'cap':      # a child's felt cap with a fur rim
        hc, hd, hl = p.get('hat_col', ('#8a3a2a', '#5e2418', '#b85a40'))
        c.ellipse(cx, fy - 4, rx + 1, 8, hc)
        c.ellipse(cx - 4, fy - 8, 4, 2, hl, only_on=True); c.ellipse(cx + 6, fy - 5, 3, 4, hd, only_on=True)
        c.rect(cx - rx - 2, fy - 3, 2 * rx + 5, 4, '#7a5a3a'); c.rect(cx - rx - 2, fy - 3, 2 * rx + 5, 1, '#a8845a')
        for x in range(cx - rx - 2, cx + rx + 3, 2): c.px(x, fy, '#5a3e26')
        c.ellipse(cx, fy - 12, 1.5, 1.5, '#e04a3a')
    elif hat == 'warrior':   # a fur-brimmed riding hat with a tall red crown and a gilded knob
        c.poly([(cx - rx, fy - 3), (cx - 5, fy - 17), (cx + 5, fy - 17), (cx + rx, fy - 3)], '#a8322a')
        c.poly([(cx - rx, fy - 3), (cx - 5, fy - 17), (cx - 2, fy - 17), (cx - rx + 4, fy - 3)], '#d24a3a')
        c.poly([(cx + rx, fy - 3), (cx + 5, fy - 17), (cx + 3, fy - 17), (cx + rx - 4, fy - 3)], '#7e2420')
        c.ellipse(cx, fy - 18, 2, 2, '#e0b04a'); c.px(cx - 1, fy - 19, '#fff0a0')
        c.rect(cx - rx - 2, fy - 4, 2 * rx + 5, 5, '#5a3e2a'); c.rect(cx - rx - 2, fy - 4, 2 * rx + 5, 1, '#8a6a4a')
        for x in range(cx - rx - 2, cx + rx + 3, 2): c.px(x, fy, '#3e2a1c'); c.px(x + 1, fy - 3, '#9a7a56')
    elif hat == 'helmet':    # an iron helmet with a spike, a plume and a leather neck guard
        c.ellipse(cx, fy - 3, rx + 2, 9, '#6a6e76'); c.rect(cx - rx - 2, fy - 3, 2 * rx + 5, 3, '#6a6e76')
        c.ellipse(cx - 4, fy - 7, 4, 3, '#a8acb4', only_on=True); c.ellipse(cx + 6, fy - 4, 3, 4, '#4a4e56', only_on=True)
        c.line(cx, fy - 12, cx, fy - 17, '#4a4e56'); c.ellipse(cx + 2, fy - 18, 3, 2, '#c03a2a')
        c.rect(cx - rx - 2, fy - 1, 2 * rx + 5, 2, '#b08a3a')
        c.poly([(cx - rx - 2, fy), (cx - rx - 4, cy + 12), (cx - rx + 1, cy + 12), (cx - rx + 1, fy)], '#5a3e2a')
        c.poly([(cx + rx + 2, fy), (cx + rx + 4, cy + 12), (cx + rx - 1, cy + 12), (cx + rx - 1, fy)], '#3e2a1c')
    elif hat == 'khan':      # a white felt hat with a dark fur brim and ear flaps, as in the Yuan court portrait
        c.ellipse(cx, fy - 6, rx + 2, 10, '#f2ece0'); c.rect(cx - rx - 2, fy - 6, 2 * rx + 5, 5, '#f2ece0')
        c.ellipse(cx + 6, fy - 6, 5, 8, '#cfc6b4', only_on=True); c.ellipse(cx - 4, fy - 11, 4, 2, '#ffffff', only_on=True)
        c.rect(cx - rx - 3, fy - 3, 2 * rx + 7, 4, '#3a2a22'); c.rect(cx - rx - 3, fy - 3, 2 * rx + 7, 1, '#5e4a3e')
        for side in (-1, 1):  # ear flaps of fur
            c.poly([(cx + side * (rx + 3), fy), (cx + side * (rx + 4), cy + 9), (cx + side * (rx), cy + 9), (cx + side * (rx), fy)], '#3a2a22')
        c.ellipse(cx, fy - 16, 1.5, 1.5, '#e0b04a')
    elif hat == 'boqta':     # a married noblewoman's tall headdress, with a felt-covered frame
        c.rect(cx - rx - 2, fy - 5, 2 * rx + 5, 6, '#8a2a3a'); c.rect(cx - rx - 2, fy - 5, 2 * rx + 5, 1, '#e0b04a')
        c.poly([(cx - 4, fy - 5), (cx - 3, 0), (cx + 4, 0), (cx + 5, fy - 5)], '#a8323e')
        c.poly([(cx - 4, fy - 5), (cx - 3, 0), (cx - 1, 0), (cx - 1, fy - 5)], '#c84a52')
        for y in range(2, fy - 5, 4): c.px(cx, y, '#e0b04a')
        c.pxs([(cx - rx - 1, fy + 1), (cx + rx + 1, fy + 1)], '#e0b04a')
        c.ellipse(cx - rx - 1, fy + 3, 1.5, 2, '#d8402a'); c.ellipse(cx + rx + 1, fy + 3, 1.5, 2, '#d8402a')
    elif hat == 'fur':       # a round fur hat of a herder
        c.ellipse(cx, fy - 5, rx + 3, 8, '#7a5a3a'); c.rect(cx - rx - 3, fy - 5, 2 * rx + 7, 6, '#7a5a3a')
        c.ellipse(cx - 4, fy - 8, 5, 3, '#9a7a56', only_on=True)
        for x in range(cx - rx - 3, cx + rx + 4, 2): c.px(x, fy, '#5a3e26'); c.px(x + 1, fy - 10 + (x % 3), '#a8845a')
    elif fem and p.get('ornament'):   # silver and coral hair ornaments of a young woman
        c.rect(cx - rx, fy - 4, 2 * rx + 1, 2, '#d8dde6'); c.ellipse(cx, fy - 4, 2, 2, '#e8503a')
        c.ellipse(cx - rx - 1, cy + 2, 1.5, 2, '#e8503a'); c.ellipse(cx + rx + 1, cy + 2, 1.5, 2, '#e8503a')
    c.outline(OUT)


CHARS = {
    # Temüjin as a boy of nine, when Dei Sechen saw “fire in his eyes and light in his face”
    'temujin_child': dict(age='child', skin='warm', deel=('#7a4a2a', '#5a321c', '#a06a40'), fur=('#c8a070', '#8a6a44', '#e8c898'), hat='cap', fire=True),
    # Temüjin at about twenty-two, riding against the Merkits
    'temujin': dict(age='young', skin='warm', deel=('#2e5a9a', '#1e3e6e', '#4a7ac0'), armor=('#4a3426', '#2e1e14', '#6e5038'), hat='warrior', beard='thin', jaw=1, brow=2, fire=True),
    # Chinggis Khaan in 1206
    'chinggis': dict(age='adult', skin='warm', deel=('#2a4a7a', '#1a2e52', '#4a6aa0'), pattern='#e0b04a', fur=('#5a4030', '#3a2a1e', '#8a6a50'), hat='khan', beard='long', grey=True, jaw=2, brow=2, fire=True),
    'borte': dict(age='young', fem=True, skin='light', deel=('#c0392b', '#8a2a20', '#e05a48'), trim='#e0b04a', braids=True, ornament=True),
    'hoelun': dict(age='adult', fem=True, skin='warm', deel=('#3a6a5a', '#244a3e', '#5a8a7a'), fur=('#6a4a34', '#4a3224', '#8e6a50'), hat='boqta', braids=True),
    'yesugei': dict(age='adult', skin='tan', deel=('#6a3a2a', '#4a261a', '#8e5a42'), hat='warrior', beard='mustache', jaw=2, brow=2),
    'dei_sechen': dict(age='elder', skin='tan', deel=('#7a6a3a', '#5a4a24', '#a8925a'), fur=('#e8e0d0', '#b8b0a0', '#ffffff'), hat='fur', beard='white', hair='grey', jaw=1),
    'jamukha': dict(age='young', skin='tan', deel=('#6a3a8a', '#4a2464', '#8e5aae'), hat='fur', beard='thin', jaw=1, brow=2),
    'toghrul': dict(age='elder', skin='tan', deel=('#8a2a2a', '#5e1a1a', '#b04a42'), pattern='#e0b04a', fur=('#3a2a22', '#22180e', '#5e4a3e'), hat='khan', beard='goatee', hair='grey', cross=True, jaw=1),
    'sorkhan_shira': dict(age='elder', skin='tan', deel=('#5a5a4a', '#3e3e32', '#7e7e6a'), hat='fur', beard='white', hair='grey'),
    'boorchu': dict(age='child', skin='tan', deel=('#3a6a3a', '#244a24', '#5a8e5a'), hat='cap', hat_col=('#3a5a8a', '#24406a', '#5a7ab0')),
    'merkit': dict(age='adult', skin='tan', deel=('#2d2a33', '#17151b', '#5a5566'), armor=('#3a3a40', '#22222a', '#5e5e66'), hat='helmet', beard='mustache', jaw=2, brow=2),
}


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    out = os.environ.get('ART_OUT', os.path.join(ROOT, 'Art'))
    for cid, p in CHARS.items():
        frames = []
        for e in EXPRS:
            for open_, blink in ((False, False), (True, False), (False, True)):
                c = Canvas(S, S); head(c, p, e, open_, blink); frames.append(c)
        save(sheet(frames, 3), os.path.join(out, f'story_face_{cid}.png.bytes'))
        if prev:
            save(sheet([frames[i * 3] for i in range(len(EXPRS))], 6), os.path.join(prev, f'face_{cid}.png'), os.path.join(prev, f'face_{cid}_x.png'), 4)
    if not os.environ.get('ART_OUT'):
        with open(os.path.join(ROOT, 'Data', 'story_faces.json'), 'w') as f:
            json.dump({'size': S, 'exprs': EXPRS, 'cols': 3, 'chars': list(CHARS)}, f)


if __name__ == '__main__':
    main()
