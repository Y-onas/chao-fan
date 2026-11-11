"""Extracts photographic food assets from the restaurant reference photos.

Run with `npm run assets` (needs: pip install pillow numpy scipy opencv-python-headless).
Outputs to public/assets/food. Every asset comes from the owner's own photos in
assets-src/references; replace a reference or tweak a box below and re-run.
"""
import os
import cv2
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'assets-src', 'references')
OUT = os.path.join(ROOT, 'public', 'assets', 'food')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def load(name):
    im = cv2.imread(os.path.join(REF, name), cv2.IMREAD_COLOR)
    assert im is not None, name
    return im


TOPDOWN = load('bowl-topdown-instagram.jpg')
BLACKBOWL = load('chicken-chaofan-black-bowl.webp')
SAUCEBOWLS = load('chaofan-sauce-bowls.webp')


def save_rgba(name, bgr, alpha, size=None, quality=90):
    rgba = np.dstack([bgr, alpha]).astype(np.uint8)
    if size:
        rgba = cv2.resize(rgba, size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, name), rgba, [cv2.IMWRITE_WEBP_QUALITY, quality])


def save_gray(name, g, size=None):
    g = np.clip(g, 0, 255).astype(np.uint8)
    if size:
        g = cv2.resize(g, size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, name), g, [cv2.IMWRITE_WEBP_QUALITY, 92])


def square_pad(bgr, alpha, pad=0.06):
    """Crop to the alpha bbox and pad to a square so meshes can stay 1:1."""
    ys, xs = np.where(alpha > 8)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    bgr, alpha = bgr[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    h, w = alpha.shape
    s = int(max(h, w) * (1 + pad * 2))
    ob = np.zeros((s, s, 3), np.uint8)
    oa = np.zeros((s, s), np.uint8)
    oy, ox = (s - h) // 2, (s - w) // 2
    ob[oy:oy + h, ox:ox + w] = bgr
    oa[oy:oy + h, ox:ox + w] = alpha
    # bleed edge colour into transparent texels so mip-mapping does not halo
    inv = oa < 10
    if inv.any():
        idx = ndimage.distance_transform_edt(inv, return_distances=False, return_indices=True)
        ob = ob[idx[0], idx[1]]
    return ob, oa


def relief(alpha, detail_bgr=None, dome=1.0, detail=0.25):
    """Height map: rounded dome from the silhouette plus luminance micro-detail."""
    a = (alpha > 127).astype(np.uint8)
    d = ndimage.distance_transform_edt(a)
    d = d / max(d.max(), 1)
    h = np.sqrt(d) * dome
    if detail_bgr is not None:
        lum = cv2.cvtColor(detail_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        lum = lum - cv2.GaussianBlur(lum, (0, 0), 6)
        h = h + lum * detail * (d > 0)
    h = cv2.GaussianBlur(h.astype(np.float32), (0, 0), 1.2)
    h = (h - h.min()) / max(h.max() - h.min(), 1e-6)
    return h * 255


def grabcut(img, poly, band=22, core=26):
    h, w = img.shape[:2]
    m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(m, [np.array(poly, np.int32)], 1)
    k = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    outer = cv2.dilate(m, k(band))
    inner = cv2.erode(m, k(core))
    gc = np.full((h, w), cv2.GC_BGD, np.uint8)
    gc[outer > 0] = cv2.GC_PR_BGD
    gc[m > 0] = cv2.GC_PR_FGD
    gc[inner > 0] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, gc, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    out = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
    return largest(out)


def largest(mask):
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = (lab == (np.argmax(sizes) + 1))
    keep = ndimage.binary_fill_holes(keep)
    return keep.astype(np.uint8)


def soften(mask, smooth=2.0, feather=1.2):
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), smooth)
    m = (m > 0.5).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), feather)
    return (np.clip(m, 0, 1) * 255).astype(np.uint8)


def cutout(src, box, poly, name, out_size, band=18, core=None, dome=1.0, detail=0.3, smooth=2.0, grade=None):
    x0, y0, x1, y1 = box
    crop = src[y0:y1, x0:x1].copy()
    local = [(x - x0, y - y0) for x, y in poly]
    if core is None:
        core = max(4, int(min(x1 - x0, y1 - y0) * 0.12))
    mask = grabcut(crop, local, band=band, core=core)
    # never extend past the hand-drawn outline (prevents box-edge cuts)
    limit = np.zeros_like(mask)
    cv2.fillPoly(limit, [np.array(local, np.int32)], 1)
    limit = cv2.dilate(limit, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    mask = largest(mask & limit)
    alpha = soften(mask, smooth=smooth)
    if grade is not None:
        crop = grade(crop)
    b, a = square_pad(crop, alpha)
    hmap = relief(a, b, dome=dome, detail=detail)
    save_rgba(name + '.webp', b, a, (out_size, out_size))
    save_gray(name + '_h.webp', hmap, (out_size // 2, out_size // 2))
    return b, a


def ellipse_poly(cx, cy, rx, ry, n=28, jitter=0.0):
    pts = []
    for i in range(n):
        t = 2 * np.pi * i / n
        j = 1 + rng.uniform(-jitter, jitter)
        pts.append((cx + np.cos(t) * rx * j, cy + np.sin(t) * ry * j))
    return pts


# ---------------------------------------------------------------- chicken leg
LEG_POLY = [(600, 890), (650, 900), (680, 960), (720, 1010), (800, 1050), (875, 1100), (920, 1160),
            (945, 1240), (947, 1310), (925, 1365), (870, 1398), (800, 1392), (740, 1350), (695, 1275),
            (655, 1190), (625, 1100), (605, 1010), (590, 940)]


def clean_leg(crop):
    # lift the deepest shadows slightly; the phone capture crushed them
    f = crop.astype(np.float32)
    f = 255 * np.power(f / 255, 0.92)
    return np.clip(f * 1.04, 0, 255).astype(np.uint8)


cutout(TOPDOWN, (560, 860, 963, 1420), LEG_POLY, 'chicken-leg', 768, band=24, core=40, dome=1.0, detail=0.35, smooth=3.0,
       grade=clean_leg)

# ---------------------------------------------------------------- fried egg (bright on dark rice)
ex0, ey0, ex1, ey1 = 95, 1212, 740, 1720
egg = TOPDOWN[ey0:ey1, ex0:ex1].copy()
hsv = cv2.cvtColor(egg, cv2.COLOR_BGR2HSV)
lum = hsv[..., 2].astype(np.float32)
sat = hsv[..., 1].astype(np.float32)
bright = ((lum > 150) & (sat < 120)) | ((lum > 150) & (hsv[..., 0] < 30) & (sat >= 120))
bright = bright.astype(np.uint8)
bright[: 1238 - ey0, 430 - ex0: 570 - ex0] = 0  # play-button overlay in the screenshot
bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
bright = cv2.morphologyEx(bright, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
egg_mask = largest(bright)
egg_alpha = soften(egg_mask, smooth=3.0, feather=1.5)
b, a = square_pad(egg, egg_alpha)
# Egg relief: flat white with a raised yolk dome
yolk = cv2.inRange(cv2.cvtColor(b, cv2.COLOR_BGR2HSV), (8, 110, 150), (30, 255, 255))
yolk = largest((yolk > 0).astype(np.uint8))
yd = ndimage.distance_transform_edt(yolk)
yd = np.sqrt(yd / max(yd.max(), 1))
ed = ndimage.distance_transform_edt(a > 127)
ed = np.clip(ed / 18.0, 0, 1)
h = ed * 0.28 + yd * 0.72
h = cv2.GaussianBlur(h.astype(np.float32), (0, 0), 2)
save_rgba('fried-egg.webp', b, a, (768, 768))
save_gray('fried-egg_h.webp', h / max(h.max(), 1e-6) * 255, (384, 384))

# ---------------------------------------------------------------- base-protein pieces
CHICKEN_PIECES = [
    ((392, 508, 510, 614), ellipse_poly(450, 560, 42, 36, jitter=0.12)),
    ((486, 500, 600, 608), ellipse_poly(545, 556, 38, 34, jitter=0.12)),
    ((395, 590, 520, 705), ellipse_poly(457, 647, 45, 42, jitter=0.12)),
]
for i, (box, poly) in enumerate(CHICKEN_PIECES):
    cutout(BLACKBOWL, box, poly, f'chicken-piece-{i + 1}', 256, band=6, core=10, dome=1.0, detail=0.4)


# Beef has no clean reference photo; it is modelled in src/scene/Toppings.tsx instead.

# ---------------------------------------------------------------- house sauce surface (black dish photo)
sx0, sy0, sx1, sy1 = 40, 345, 282, 700
sauce = BLACKBOWL[sy0:sy1, sx0:sx1].copy()
poly = [(55, 360), (120, 340), (200, 340), (262, 380), (282, 440), (270, 510), (240, 560), (232, 640), (210, 690),
        (160, 700), (110, 680), (70, 610), (42, 520), (40, 430)]
m = grabcut(sauce, [(x - sx0, y - sy0) for x, y in poly], band=10, core=24)
# Resample the sauce into a round disc (the 3D cup is round)
ys, xs = np.where(m > 0)
sauce_c = sauce[ys.min():ys.max(), xs.min():xs.max()]
disc = cv2.resize(sauce_c, (512, 512), interpolation=cv2.INTER_CUBIC)
yy, xx = np.mgrid[0:512, 0:512]
r = np.sqrt((xx - 255.5) ** 2 + (yy - 255.5) ** 2) / 256
disc_a = (np.clip((1 - r) * 40, 0, 1) * 255).astype(np.uint8)
save_rgba('house-sauce.webp', disc, disc_a)
lum = cv2.cvtColor(disc, cv2.COLOR_BGR2GRAY).astype(np.float32)
save_gray('house-sauce_h.webp', cv2.GaussianBlur(lum, (0, 0), 3) * np.clip(1 - r, 0, 1) ** 0.3)

# ---------------------------------------------------------------- rice surface texture (texture bombing)
# Source grains: the crisp sauce-bowls photo only, so grain scale and lighting match.
# Grade target: the dark, reddish-brown rice from the dine-in reference photo.
RICE_TARGET_REGIONS = [(183, 1705, 700, 1815), (740, 1460, 950, 1770), (110, 1720, 600, 1800)]
target = np.concatenate([cv2.cvtColor(TOPDOWN[y0:y1, x0:x1], cv2.COLOR_BGR2LAB).reshape(-1, 3)
                         for x0, y0, x1, y1 in RICE_TARGET_REGIONS]).astype(np.float32)
t_mean, t_std = target.mean(0), target.std(0)

RICE_PATCHES = [  # (cx, cy, radius) candidate rice areas of chaofan-sauce-bowls.webp
    (cx, cy, 45) for cx in range(400, 661, 40) for cy in range(420, 621, 40)
] + [(cx, cy, 45) for cx in range(160, 641, 40) for cy in (860, 890)] + [(cx, cy, 45) for cx in range(540, 661, 40) for cy in (690, 730)]
RICE_SCALE = 1.25


def lab_grade(bgr, strength=0.9):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    flat = lab.reshape(-1, 3)
    m, s = flat.mean(0), flat.std(0) + 1e-3
    moved = (lab - m) / s * (t_std * 1.15) + t_mean
    lab = lab * (1 - strength) + moved * strength
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


src_grade = lab_grade(SAUCEBOWLS[380:960, 100:720])
OX, OY = 100, 380
patches = []
src_lum = cv2.cvtColor(SAUCEBOWLS, cv2.COLOR_BGR2GRAY)
# dark meat bits turn into black holes after grading: keep the cleanest candidate windows
dark_frac = [(src_lum[cy - r:cy + r, cx - r:cx + r] < 45).mean() for cx, cy, r in RICE_PATCHES]
order = np.argsort(dark_frac)[:14]
for i in order:
    cx, cy, rad = RICE_PATCHES[i]
    p = src_grade[cy - OY - rad:cy - OY + rad, cx - OX - rad:cx - OX + rad]
    patches.append(cv2.resize(p, None, fx=RICE_SCALE, fy=RICE_SCALE, interpolation=cv2.INTER_CUBIC).astype(np.float32))
print('rice patches dark fraction', np.round(np.array(dark_frac)[order], 3))

S = 1024
acc = np.zeros((S, S, 3), np.float64)
wsum = np.zeros((S, S), np.float64)
for _ in range(900):
    p = np.rot90(patches[rng.integers(len(patches))], rng.integers(4))
    if rng.random() < 0.5:
        p = p[:, ::-1]
    ph, pw = p.shape[:2]
    yy, xx = np.mgrid[0:ph, 0:pw]
    rr = np.sqrt((xx - pw / 2) ** 2 + (yy - ph / 2) ** 2) / (min(ph, pw) / 2)
    base = np.clip(1 - rr, 0, 1)
    # soft-max weights: one patch dominates each texel, seams blend over a few px
    w = (base * rng.uniform(0.5, 1.0)) ** 12
    ys = (np.arange(ph) + rng.integers(S)) % S
    xs = (np.arange(pw) + rng.integers(S)) % S
    acc[np.ix_(ys, xs)] += p * w[..., None]
    wsum[np.ix_(ys, xs)] += w

rice = np.clip(acc / np.maximum(wsum, 1e-12)[..., None], 0, 255).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'rice-albedo.webp'), rice, [cv2.IMWRITE_WEBP_QUALITY, 88])
print('rice coverage min weight', float(wsum.min()))

g = cv2.cvtColor(rice, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
height = cv2.GaussianBlur(g, (0, 0), 1.4) - 0.6 * cv2.GaussianBlur(g, (0, 0), 10)
# central differences with wrap-around keep the normal map tileable
gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 2
gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 2
strength = 5.0
n = np.dstack([-gx * strength, -gy * strength, np.ones_like(gx)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
normal = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
# OpenGL convention (green up): flip Y
normal[..., 1] = 255 - normal[..., 1]
cv2.imwrite(os.path.join(OUT, 'rice-normal.webp'), cv2.cvtColor(normal, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_WEBP_QUALITY, 90])
# roughness: grain highlights = oily sheen = smoother
rough = 0.62 - (g - g.mean()) * 0.9
save_gray('rice-roughness.webp', np.clip(rough, 0.25, 0.9) * 255)

# A small palette of real rice colours for the instanced 3D grains
small = cv2.resize(rice, (64, 64), interpolation=cv2.INTER_AREA).reshape(-1, 3)
lum_s = small.mean(1)
picks = small[np.argsort(lum_s)[np.linspace(400, 4000, 24).astype(int)]]
with open(os.path.join(ROOT, 'src', 'data', 'rice-palette.json'), 'w') as f:
    f.write('[' + ','.join('"#%02x%02x%02x"' % (int(c[2]), int(c[1]), int(c[0])) for c in picks) + ']\n')

print('assets written to', OUT)
for f in sorted(os.listdir(OUT)):
    print(' ', f, os.path.getsize(os.path.join(OUT, f)))
