# The people of Нутаг (drawn by hero.py): Guide Bolormaa and every villager you talk to, as clear, friendly video-game
# characters with grown-up proportions. For each character this writes folk_<id>_body (rows = poses, 2 breathing frames,
# the face left blank) and folk_<id>_faces (14 expressions × mouth shut/open × eyes open/blinking). A face is only the
# pixels that differ from the blank face, so the hair, hat and glasses stay on top of it. The layout goes to Data/folk.json.
#   python3 unity/Tools/art/folk.py [preview_dir]
import json
import os
import sys

import numpy as np
from PIL import Image

import hero

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets', 'Resources')
POSES = ['idle', 'talk', 'cheer', 'think', 'wave', 'point', 'proud']
FACES = ['neutral', 'happy', 'laugh', 'wink', 'surprised', 'think', 'sad', 'proud', 'tease', 'excited', 'worried', 'shy', 'curious', 'stern']
POSE_FOR = {'neutral': 'idle', 'happy': 'talk', 'laugh': 'cheer', 'wink': 'wave', 'surprised': 'idle', 'think': 'think', 'sad': 'idle', 'proud': 'proud',
            'tease': 'point', 'excited': 'cheer', 'worried': 'think', 'shy': 'idle', 'curious': 'think', 'stern': 'proud'}
WARM, TAN, BROWN, LIGHT = '#f6c9a2', '#e2ad84', '#c98e66', '#ffdcc2'
BLACK_HAIR, GREY_HAIR = ('#2a1a24', '#6a5a8a'), ('#c9c6cf', '#ffffff')
FOLK = {
    'bolormaa': dict(skin=LIGHT, iris='#8a4a2a', hair=BLACK_HAIR, deel='#3d8bff', trim='#ffd34a', sash='#ff8a1f', cuff='#ff5a5a', boots='#e8402e', scarf='#4fc3ff', hairdo='braids', fem=True, sig='hip'),
    'emee': dict(skin=WARM, iris='#6a4a3a', hair=GREY_HAIR, deel='#8f5bd6', trim='#ffd34a', sash='#ffcf4a', cuff='#5a2f8f', boots='#7a4a2a', scarf='#7fd3ff', hairdo='bun', glasses=True, fem=True, short=True, elder=True, sig='clasp'),
    'zasuul': dict(skin=TAN, iris='#5a3a2a', hair=BLACK_HAIR, deel='#ffc21a', trim='#d83a2a', sash='#2f6fdb', cuff='#d83a2a', boots='#3a2a24', scarf='#7fd3ff', hairdo='short', hat='mongol', mustache=True, sig='herald'),
    'general': dict(skin=BROWN, iris='#4a2a1a', hair=BLACK_HAIR, deel='#3f8f4a', trim='#ffd34a', sash='#3a2a24', cuff='#ffd34a', boots='#3a2a24', hairdo='short', hat='loovuuz', mustache=True, broad=True, medal=True, sig='cross'),
    'historian': dict(skin=WARM, iris='#6a3a8a', hair=BLACK_HAIR, deel='#a35bd6', trim='#ffffff', sash='#ffcf4a', cuff='#ffffff', boots='#7a4a2a', hairdo='bun', glasses=True, fem=True, prop='scroll', sig='hold'),
    'herder': dict(skin=TAN, iris='#5a3a2a', hair=BLACK_HAIR, deel='#9a5a2e', trim='#ffd34a', sash='#2fa35a', cuff='#2fa35a', boots='#3a2a24', hairdo='short', hat='mongol', prop='uurga', sig='hold'),
    'fisher': dict(skin=BROWN, iris='#4a3a2a', hair=GREY_HAIR, deel='#1fb0a8', trim='#ffffff', sash='#2a5fb8', cuff='#2a5fb8', boots='#4a3424', hairdo='short', hat='cap', beard=True, elder=True, prop='rod', sig='hold'),
    'farmer': dict(skin=WARM, iris='#6a3a2a', hair=('#3a1e14', '#7a5a4a'), deel='#3fbf5f', trim='#ffd34a', sash='#ff6fa8', cuff='#ff6fa8', boots='#e8402e', hairdo='braids', hat='flower', fem=True, prop='bucket', sig='hold'),
    'teacher': dict(skin=LIGHT, iris='#3a5a8a', hair=('#2a1810', '#6a4e40'), deel='#3d8bff', trim='#ffffff', sash='#ffffff', cuff='#ffffff', boots='#3a2a24', scarf='#ff5a8a', hairdo='bob', glasses=True, fem=True, prop='book', sig='hold'),
    'trainer': dict(skin=TAN, iris='#5a3a2a', hair=BLACK_HAIR, deel='#ffb51a', trim='#3a2a24', sash='#d83a2a', cuff='#d83a2a', boots='#3a2a24', hairdo='short', hat='loovuuz', prop='whip', sig='hold'),
    'archer': dict(skin=BROWN, iris='#4a2a1a', hair=BLACK_HAIR, deel='#e8402e', trim='#ffd34a', sash='#3a2a24', cuff='#ffd34a', boots='#3a2a24', hairdo='short', hat='mongol', medal=True, prop='bow', sig='hold'),
    'craftsman': dict(skin=BROWN, iris='#4a3a2a', hair=GREY_HAIR, deel='#8a5a33', trim='#ffd34a', sash='#2f6fdb', cuff='#2f6fdb', boots='#4a3424', hairdo='short', hat='mongol', mustache=True, elder=True, broad=True, prop='hammer', sig='hold'),
}
FW_U, FH_U = 40, 38       # the face overlay, in the head's own units (scaled by hero.F)


def arr(im): return np.asarray(im).astype(np.int16)


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    only = sys.argv[2] if len(sys.argv) > 2 else None
    art = os.environ.get('ART_OUT', os.path.join(ROOT, 'Art'))
    k = hero.SCALE; Wp, Hp = hero.W * k, hero.H * k
    fw, fh = int(FW_U * hero.F * k), int(FH_U * hero.F * k)
    meta = {'W': Wp, 'H': Hp, 'poses': POSES, 'frames': 2, 'faces': FACES, 'faceW': fw, 'faceH': fh, 'poseFor': POSE_FOR, 'folk': {}}
    demo = []
    for fid, c in FOLK.items():
        if only and fid != only: continue
        frames = [hero.person(c, pose, f, None) for pose in POSES for f in range(2)]
        hy = 28 + (3 if c.get('short') else 0)
        fx, fy = int((50 - FW_U / 2 * hero.F) * k), int((hy - 14 * hero.F) * k)
        blank, before = hero.person(c, 'idle', 0, None, snapshot=True)
        cover = np.abs(arr(blank) - arr(before)).max(axis=2) > 6     # what the hair, hat and glasses put over the face
        faces = []
        for e in FACES:
            for talk, blink in ((0, False), (1, False), (0, True), (1, True)):
                fl = hero.face_layer(c, e, talk, blink); comp = before.copy(); comp.alpha_composite(fl)
                keep = (np.asarray(fl)[:, :, 3] > 8) & ~cover
                ca = arr(comp); out = np.zeros_like(ca); out[keep] = ca[keep]
                faces.append(Image.fromarray(out.astype(np.uint8), 'RGBA').crop((fx, fy, fx + fw, fy + fh)))
        sheet = Image.new('RGBA', (Wp * 2, Hp * len(POSES)))
        for i, im in enumerate(frames): sheet.paste(im, ((i % 2) * Wp, (i // 2) * Hp))
        sheet.save(os.path.join(art, f'folk_{fid}_body.png.bytes'), 'PNG', optimize=True)
        fs = Image.new('RGBA', (fw * 4, fh * len(FACES)))
        for i, im in enumerate(faces): fs.paste(im, ((i % 4) * fw, (i // 4) * fh))
        fs.save(os.path.join(art, f'folk_{fid}_faces.png.bytes'), 'PNG', optimize=True)
        bob = {pose: [int(round(((-1.0 if f else 0) + (-5 if pose == 'cheer' and f else 0)) * k)) for f in range(2)] for pose in POSES}
        meta['folk'][fid] = {'bob': bob, 'faceX': fx, 'faceY': fy}
        if prev:
            for pose, ex in (('idle', 'happy'), ('talk', 'laugh'), ('think', 'curious'), ('proud', 'stern')):
                b = frames[POSES.index(pose) * 2].copy(); b.alpha_composite(faces[FACES.index(ex) * 4], (fx, fy + bob[pose][0])); demo.append(b)
        print(fid, 'done', flush=True)
    if not os.environ.get('ART_OUT') and not only:
        with open(os.path.join(ROOT, 'Data', 'folk.json'), 'w') as f: json.dump(meta, f, ensure_ascii=False)
    if prev and demo:
        cols = 8; m = Image.new('RGBA', (Wp * cols, Hp * ((len(demo) + cols - 1) // cols)), (236, 226, 208, 255))
        for i, im in enumerate(demo): m.alpha_composite(im, ((i % cols) * Wp, (i // cols) * Hp))
        m.save(os.path.join(prev, 'folk_hero_demo.png'))


if __name__ == '__main__':
    main()
