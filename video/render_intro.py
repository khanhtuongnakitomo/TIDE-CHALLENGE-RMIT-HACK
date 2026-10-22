"""ResearchVault 90-second motion-graphic introduction.

Renders every frame procedurally with Pillow and encodes with the ffmpeg binary
bundled by imageio-ffmpeg. Usage:

    python video/render_intro.py                 # full render -> video/ResearchVault-intro.mp4
    python video/render_intro.py --preview 3 12  # stills at the given seconds -> video/preview/
"""

import functools
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
DUR = 102.0
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "ResearchVault-intro.mp4")
FONT_DIR = r"C:\Windows\Fonts"

BG = (8, 9, 13)
SEAM = (31, 36, 51)
DOTTED = (48, 55, 76)
EMBER = (252, 80, 0)
FLARE = (255, 119, 0)
GLOW = (255, 160, 64)
VIOLET = (82, 74, 233)
VIOLET_LT = (150, 142, 255)
SULFUR = (245, 242, 142)
INK = (247, 246, 242)
MUTED = (142, 149, 165)
LIME = (184, 255, 1)
CRIMSON = (255, 45, 85)
CARBON = (16, 19, 28)

# Scene windows (seconds)
SCENES = [(0, 7), (7, 17), (17, 31), (31, 41), (41, 62), (62, 84), (84, 95), (95, 102)]
CHAPTERS = SCENES[1:-1]

# ---------------------------------------------------------------------------
# Easing / timing
# ---------------------------------------------------------------------------


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def eo(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def eio(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def eback(x):
    x = clamp(x)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def rise(t, t0, d=0.7, dist=34):
    p = eo((t - t0) / d)
    return p, (1 - p) * dist


def window(t, t0, t1, fade=0.35):
    """Opacity for an element shown in [t0, t1) with fades at both ends."""
    return clamp((t - t0) / fade) * clamp((t1 - t) / fade)


# ---------------------------------------------------------------------------
# Fonts and text sprites
# ---------------------------------------------------------------------------

FONT_FILES = {
    "body": "segoeui.ttf",
    "body_sb": "seguisb.ttf",
    "body_b": "segoeuib.ttf",
    "mono": "consola.ttf",
    "mono_b": "consolab.ttf",
}


@functools.lru_cache(None)
def font(kind, size):
    if kind.startswith("display"):
        f = ImageFont.truetype(os.path.join(FONT_DIR, "bahnschrift.ttf"), size)
        name = "Bold Condensed" if kind == "display" else "SemiBold Condensed"
        try:
            f.set_variation_by_name(name)
        except Exception:
            pass
        return f
    path = os.path.join(FONT_DIR, FONT_FILES[kind])
    if not os.path.exists(path):
        path = os.path.join(FONT_DIR, "segoeui.ttf")
    return ImageFont.truetype(path, size)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def tlen(text, f, tracking):
    if not tracking:
        return f.getlength(text)
    return sum(f.getlength(ch) for ch in text) + tracking * max(0, len(text) - 1)


def hgrad(w, h, c1, c2, c3=None):
    x = np.linspace(0, 1, max(w, 1))[None, :, None]
    a, b = np.array(c1, float), np.array(c2, float)
    if c3 is None:
        row = a + (b - a) * x
    else:
        c = np.array(c3, float)
        row = np.where(x < 0.5, a + (b - a) * (x * 2), b + (c - b) * ((x - 0.5) * 2))
    arr = np.broadcast_to(row, (h, w, 3)).astype(np.uint8)
    return Image.fromarray(np.ascontiguousarray(arr), "RGB")


@functools.lru_cache(None)
def text_img(text, kind, size, color, tracking=0):
    f = font(kind, size)
    asc, desc = f.getmetrics()
    w = int(math.ceil(tlen(text, f, tracking))) + 6
    h = asc + desc + 4
    if color == "grad":
        mask = text_img(text, kind, size, (255, 255, 255), tracking).getchannel("A")
        im = hgrad(mask.width, mask.height, EMBER, FLARE, GLOW).convert("RGBA")
        im.putalpha(mask)
        return im
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not tracking:
        d.text((0, asc), text, font=f, fill=rgba(color), anchor="ls")
    else:
        x = 0.0
        for ch in text:
            d.text((x, asc), ch, font=f, fill=rgba(color), anchor="ls")
            x += f.getlength(ch) + tracking
    return im


@functools.lru_cache(None)
def rich(spans, kind, size, tracking=0):
    """spans: tuple of (text, color) where color may be 'grad'."""
    f = font(kind, size)
    parts = [text_img(t, kind, size, c, tracking) for t, c in spans]
    widths = [tlen(t, f, tracking) + (tracking if i < len(spans) - 1 else 0) for i, (t, _) in enumerate(spans)]
    w = int(sum(widths)) + 8
    h = max(p.height for p in parts)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0.0
    for p, wd in zip(parts, widths):
        im.alpha_composite(p, (int(round(x)), 0))
        x += wd
    return im


@functools.lru_cache(None)
def para(text, kind, size, color, maxw, lead=1.32):
    f = font(kind, size)
    lines, cur = [], ""
    for word in text.split(" "):
        trial = (cur + " " + word).strip()
        if f.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    step = int(size * lead)
    sprites = [text_img(l, kind, size, color) for l in lines]
    w = max(s.width for s in sprites)
    h = step * (len(lines) - 1) + sprites[-1].height
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for i, s in enumerate(sprites):
        im.alpha_composite(s, (0, i * step))
    return im


# ---------------------------------------------------------------------------
# Shapes
# ---------------------------------------------------------------------------

SS = 3


def ss_canvas(w, h):
    big = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    return big, ImageDraw.Draw(big)


def ss_done(big, w, h):
    return big.resize((w, h), Image.LANCZOS)


@functools.lru_cache(None)
def rr_mask(w, h, r):
    big = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=r * SS, fill=255)
    return big.resize((w, h), Image.LANCZOS)


@functools.lru_cache(None)
def rr_ring(w, h, r, bw):
    big = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        [0, 0, w * SS - 1, h * SS - 1], radius=r * SS, outline=255, width=bw * SS
    )
    return big.resize((w, h), Image.LANCZOS)


@functools.lru_cache(None)
def card(w, h, r=26, top=(24, 28, 41), bot=(11, 13, 20), border=SEAM, bw=2, alpha=255):
    yy, xx = np.mgrid[0:h, 0:w]
    k = ((xx / max(w, 1)) * 0.45 + (yy / max(h, 1)) * 0.55)[..., None]
    a, b = np.array(top, float), np.array(bot, float)
    arr = (a + (b - a) * k).astype(np.uint8)
    im = Image.fromarray(arr, "RGB").convert("RGBA")
    m = rr_mask(w, h, r)
    if alpha < 255:
        m = m.point(lambda v: v * alpha // 255)
    im.putalpha(m)
    if border:
        im.paste(Image.new("RGBA", (w, h), rgba(border)), (0, 0), rr_ring(w, h, r, bw))
    return im


@functools.lru_cache(None)
def flat(w, h, r, fill, falpha=255, border=None, bw=2):
    im = Image.new("RGBA", (w, h), rgba(fill or BG, 0))
    if fill is not None and falpha:
        im.paste(Image.new("RGBA", (w, h), rgba(fill, falpha)), (0, 0), rr_mask(w, h, r))
    if border:
        im.paste(Image.new("RGBA", (w, h), rgba(border)), (0, 0), rr_ring(w, h, r, bw))
    return im


@functools.lru_cache(None)
def pill(text, fg, bg=None, balpha=40, border=None, size=20, kind="mono_b", tracking=2, padx=18, pady=10):
    f = font(kind, size)
    tw = tlen(text, f, tracking)
    top, bottom = f.getbbox("HXP", anchor="ls")[1], f.getbbox("HXP", anchor="ls")[3]
    th = bottom - top
    w = int(tw + padx * 2)
    h = int(th + pady * 2)
    im = flat(w, h, h // 2, bg if bg else BG, balpha if bg else 0, border).copy()
    d = ImageDraw.Draw(im)
    base = h / 2 - (top + bottom) / 2
    x = padx
    for ch in text:
        d.text((x, base), ch, font=f, fill=rgba(fg), anchor="ls")
        x += f.getlength(ch) + tracking
    return im


@functools.lru_cache(None)
def icon(name, size, color):
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = rgba(color)
    lw = max(2, int(S * 0.085))
    if name == "person":
        d.ellipse([S * 0.32, S * 0.06, S * 0.68, S * 0.42], fill=c)
        d.pieslice([S * 0.12, S * 0.5, S * 0.88, S * 1.26], 180, 360, fill=c)
    elif name == "users":
        for ox, sc in ((-0.17, 0.8), (0.15, 1.0)):
            cx = S * (0.5 + ox)
            r = S * 0.15 * sc
            d.ellipse([cx - r, S * 0.18, cx + r, S * 0.18 + 2 * r], fill=c)
            d.pieslice([cx - S * 0.27 * sc, S * 0.56, cx + S * 0.27 * sc, S * 1.1], 180, 360, fill=c)
    elif name in ("lock", "unlock"):
        d.rounded_rectangle([S * 0.17, S * 0.46, S * 0.83, S * 0.94], radius=S * 0.09, fill=c)
        if name == "lock":
            d.arc([S * 0.3, S * 0.08, S * 0.7, S * 0.62], 180, 360, fill=c, width=lw)
            d.line([S * 0.3 + lw / 2, S * 0.34, S * 0.3 + lw / 2, S * 0.48], fill=c, width=lw)
            d.line([S * 0.7 - lw / 2, S * 0.34, S * 0.7 - lw / 2, S * 0.48], fill=c, width=lw)
        else:
            d.arc([S * 0.52, S * 0.02, S * 0.92, S * 0.56], 180, 360, fill=c, width=lw)
            d.line([S * 0.52 + lw / 2, S * 0.28, S * 0.52 + lw / 2, S * 0.48], fill=c, width=lw)
            d.line([S * 0.92 - lw / 2, S * 0.28, S * 0.92 - lw / 2, S * 0.36], fill=c, width=lw)
        d.ellipse([S * 0.44, S * 0.6, S * 0.56, S * 0.72], fill=(0, 0, 0, 0))
        d.rectangle([S * 0.475, S * 0.68, S * 0.525, S * 0.82], fill=(0, 0, 0, 0))
    elif name == "check":
        d.line([(S * 0.16, S * 0.52), (S * 0.4, S * 0.76), (S * 0.86, S * 0.26)], fill=c, width=int(S * 0.13), joint="curve")
    elif name == "key":
        d.ellipse([S * 0.06, S * 0.3, S * 0.46, S * 0.7], outline=c, width=lw)
        d.line([S * 0.45, S * 0.5, S * 0.94, S * 0.5], fill=c, width=lw)
        d.line([S * 0.78, S * 0.5, S * 0.78, S * 0.7], fill=c, width=lw)
        d.line([S * 0.9, S * 0.5, S * 0.9, S * 0.64], fill=c, width=lw)
    elif name == "doc":
        d.rounded_rectangle([S * 0.2, S * 0.08, S * 0.8, S * 0.92], radius=S * 0.08, outline=c, width=lw)
        for i, wf in enumerate((0.42, 0.42, 0.28)):
            y = S * (0.34 + i * 0.16)
            d.line([S * 0.32, y, S * (0.32 + wf), y], fill=c, width=lw)
    elif name == "building":
        d.polygon([(S * 0.5, S * 0.06), (S * 0.92, S * 0.3), (S * 0.08, S * 0.3)], fill=c)
        for i in range(4):
            x = S * (0.18 + i * 0.2)
            d.rectangle([x, S * 0.38, x + S * 0.08, S * 0.78], fill=c)
        d.rectangle([S * 0.08, S * 0.82, S * 0.92, S * 0.92], fill=c)
    elif name == "flask":
        d.line([S * 0.38, S * 0.1, S * 0.62, S * 0.1], fill=c, width=lw)
        d.polygon([(S * 0.42, S * 0.12), (S * 0.58, S * 0.12), (S * 0.58, S * 0.4), (S * 0.86, S * 0.88),
                   (S * 0.14, S * 0.88), (S * 0.42, S * 0.4)], outline=c, width=lw)
        d.polygon([(S * 0.3, S * 0.62), (S * 0.7, S * 0.62), (S * 0.8, S * 0.84), (S * 0.2, S * 0.84)], fill=c)
    elif name == "circle_o":
        d.ellipse([S * 0.12, S * 0.12, S * 0.88, S * 0.88], outline=c, width=int(S * 0.12))
    elif name == "square":
        d.rectangle([S * 0.16, S * 0.16, S * 0.84, S * 0.84], fill=c)
    elif name == "hexagon":
        pts = [(S * 0.5 + S * 0.4 * math.cos(math.radians(a)), S * 0.5 + S * 0.4 * math.sin(math.radians(a)))
               for a in range(-90, 270, 60)]
        d.polygon(pts, fill=c)
    return im.resize((size, size), Image.LANCZOS)


@functools.lru_cache(None)
def node(size, border, iconname=None, text=None, icol=None, bw=3, fill=CARBON):
    big, d = ss_canvas(size, size)
    S = size * SS
    d.ellipse([0, 0, S - 1, S - 1], fill=rgba(fill))
    d.ellipse([0, 0, S - 1, S - 1], outline=rgba(border), width=bw * SS)
    im = ss_done(big, size, size)
    if iconname:
        ic = icon(iconname, int(size * 0.46), icol or border)
        im.alpha_composite(ic, ((size - ic.width) // 2, (size - ic.height) // 2))
    if text:
        t = text_img(text, "display", int(size * 0.36), icol or INK)
        im.alpha_composite(t, ((size - t.width) // 2 + 2, (size - t.height) // 2 + 2))
    return im


@functools.lru_cache(None)
def emblem(size):
    big, d = ss_canvas(size, size)
    S = size * SS
    grad = hgrad(S, S, EMBER, FLARE).convert("RGBA")
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.24, fill=255)
    grad.putalpha(m)
    big.alpha_composite(grad)
    for i, wf in enumerate((0.6, 0.44, 0.28)):
        y0 = S * (0.27 + i * 0.18)
        d.rounded_rectangle([S * 0.2, y0, S * (0.2 + wf), y0 + S * 0.1], radius=S * 0.05, fill=(255, 255, 255, 255))
    return ss_done(big, size, size)


@functools.lru_cache(None)
def glow_sprite(size, color, strength):
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)
    a = (np.clip(1 - r, 0, 1) ** 2.4 * strength * 255).astype(np.uint8)
    im = Image.new("RGBA", (size, size), rgba(color))
    im.putalpha(Image.fromarray(a, "L"))
    return im


@functools.lru_cache(None)
def sweep_sprite():
    w = 260
    x = np.linspace(-1, 1, w)
    a = np.exp(-(x ** 2) * 18)
    a = (np.broadcast_to(a[None, :], (H, w)) * 120).astype(np.uint8)
    im = Image.new("RGBA", (w, H), rgba(GLOW))
    im.putalpha(Image.fromarray(np.ascontiguousarray(a), "L"))
    return im


def bezier(p0, c, p1, u):
    x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * c[0] + u ** 2 * p1[0]
    y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * c[1] + u ** 2 * p1[1]
    return x, y


def dashed_curve(d, p0, c, p1, color, width, dash=0.03, gap=0.02, ox=0, oy=0):
    u = 0.0
    while u < 1:
        u2 = min(1, u + dash)
        pts = [bezier(p0, c, p1, u + (u2 - u) * k / 6) for k in range(7)]
        d.line([((x - ox) * SS, (y - oy) * SS) for x, y in pts], fill=rgba(color), width=width * SS)
        u = u2 + gap


@functools.lru_cache(None)
def background():
    yy, xx = np.mgrid[0:H, 0:W]
    arr = np.zeros((H, W, 3), float) + np.array(BG, float)
    dots = ((xx % 48) < 2) & ((yy % 48) < 2)
    arr[dots] = arr[dots] * 0.4 + np.array(DOTTED, float) * 0.6
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    vign = np.clip(1 - (r - 0.55) * 0.55, 0.55, 1)[..., None]
    arr *= vign
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


# ---------------------------------------------------------------------------
# Compositing
# ---------------------------------------------------------------------------

G = {"op": 1.0, "dy": 0.0}


def put(fr, im, x, y, op=1.0, anchor="lt"):
    op *= G["op"]
    if op <= 0.004 or im is None:
        return
    w, h = im.size
    if anchor[0] == "m":
        x -= w / 2
    elif anchor[0] == "r":
        x -= w
    if anchor[1] == "m":
        y -= h / 2
    elif anchor[1] == "b":
        y -= h
    y += G["dy"]
    box = (int(round(x)), int(round(y)))
    a = im.getchannel("A")
    if op < 0.996:
        q = op
        a = a.point(lambda v: int(v * q))
    fr.paste(im, box, a)


def put_scaled(fr, im, cx, cy, s, op=1.0):
    if s <= 0.01:
        return
    w, h = max(1, int(im.width * s)), max(1, int(im.height * s))
    put(fr, im.resize((w, h), Image.BILINEAR), cx, cy, op, "mm")


def put_rot(fr, im, cx, cy, angle, s=1.0, op=1.0):
    im2 = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    if abs(s - 1) > 0.01:
        im2 = im2.resize((max(1, int(im2.width * s)), max(1, int(im2.height * s))), Image.BILINEAR)
    put(fr, im2, cx, cy, op, "mm")


def put_crop(fr, im, x, y, frac, op=1.0):
    frac = clamp(frac)
    if frac <= 0.002:
        return
    w = max(1, int(im.width * frac))
    put(fr, im.crop((0, 0, w, im.height)), x, y, op)


# ---------------------------------------------------------------------------
# Shared layout pieces
# ---------------------------------------------------------------------------

LX = 160


def eyebrow(fr, t, text, t0=0.15, y=150):
    p, dy = rise(t, t0)
    bar = flat(36, 4, 2, EMBER)
    put(fr, bar, LX, y + 13 + dy, p)
    put(fr, text_img(text, "mono_b", 22, EMBER, 4), LX + 52, y + dy, p)


def headline(fr, t, lines, t0=0.3, y=190, size=112, lead=1.0, x=LX):
    for i, spans in enumerate(lines):
        p, dy = rise(t, t0 + i * 0.12, 0.8, 46)
        im = rich(spans, "display", size)
        put(fr, im, x, y + i * int(size * lead) + dy, p)
    return y + len(lines) * int(size * lead)


def chrome(fr, gt):
    c0, c1 = CHAPTERS[0][0], CHAPTERS[-1][1]
    op = clamp((gt - c0) / 0.6) * clamp((c1 - gt) / 0.6)
    if op <= 0:
        return
    saved = G["op"], G["dy"]
    G["op"], G["dy"] = 1.0, 0.0
    put(fr, emblem(34), LX, 52, op)
    put(fr, text_img("RESEARCHVAULT", "display", 30, INK, 3), LX + 48, 52, op)
    total = f" / {len(CHAPTERS):02d}"
    for i, (a, b) in enumerate(CHAPTERS):
        o = window(gt, a, b, 0.4) * op
        if o > 0:
            put(fr, rich(((f"{i + 1:02d}", EMBER), (total, MUTED)), "mono_b", 22, 2), W - LX, 58, o, "rt")
    # progress line
    track = flat(W - 2 * LX, 3, 1, SEAM)
    put(fr, track, LX, 1036, op * 0.9)
    frac = clamp((gt - c0) / (c1 - c0))
    if frac > 0.002:
        put(fr, flat(max(2, int((W - 2 * LX) * frac)), 3, 1, EMBER), LX, 1036, op)
    G["op"], G["dy"] = saved


# ---------------------------------------------------------------------------
# Scenes
# ---------------------------------------------------------------------------


def s_brand(fr, t):
    cx = W / 2
    p = eo((t - 0.1) / 0.9)
    put_scaled(fr, emblem(150), cx, 380, 0.4 + 0.6 * eback((t - 0.1) / 0.9), p)
    word = text_img("RESEARCHVAULT", "display", 156, INK, 8)
    put_crop(fr, word, cx - word.width / 2, 480, eio((t - 0.8) / 1.1), clamp((t - 0.8) / 0.3))
    lw = int(560 * eio((t - 1.6) / 0.8))
    if lw > 2:
        put(fr, flat(lw, 4, 2, EMBER), cx, 668, 1, "mt")
    p, dy = rise(t, 2.2, 0.8)
    put(fr, rich((("Research together. Keep participant data under ", INK), ("controlled access.", "grad")),
                 "display_semi", 56), cx, 712 + dy, p, "mt")
    p, dy = rise(t, 3.0, 0.8)
    put(fr, text_img("A RESEARCH PARTICIPATION VAULT  ·  BUILT WITH TIDECLOAK", "mono_b", 22, MUTED, 4),
        cx, 812 + dy, p, "mt")


P_NODE = (1110, 610)
TEAM = [(1650, 400, "ASSISTANT"), (1650, 610, "HEAD RESEARCHER"), (1650, 820, "DATA STEWARD")]


def team_curves():
    out = []
    for x, y, _ in TEAM:
        p0 = (P_NODE[0] + 95, P_NODE[1])
        p1 = (x - 70, y)
        c = ((p0[0] + p1[0]) / 2, (p0[1] + y) / 2 + (y - P_NODE[1]) * -0.35)
        out.append((p0, c, p1))
    return out


@functools.lru_cache(None)
def connections_sprite():
    ox, oy, w, h = 1000, 300, 800, 620
    big, d = ss_canvas(w, h)
    for p0, c, p1 in team_curves():
        dashed_curve(d, p0, c, p1, DOTTED, 3, ox=ox, oy=oy)
    return ss_done(big, w, h), ox, oy


def s_possibility(fr, t):
    eyebrow(fr, t, "THE POSSIBILITY")
    yb = headline(fr, t, [(("Research runs", INK),), (("on ", INK), ("trust.", "grad"))], size=128)
    p, dy = rise(t, 1.0)
    put(fr, para("Participants share their most personal stories. Research teams need to work with them, "
                 "without exposing the people behind the data.", "body", 34, MUTED, 720), LX, yb + 40 + dy, p)
    p, dy = rise(t, 6.6)
    put(fr, rich((("So who should see what, ", INK),), "display_semi", 52), LX, 800 + dy, p)
    p, dy = rise(t, 6.85)
    put(fr, rich((("and who ", INK), ("decides?", "grad")), "display_semi", 52), LX, 862 + dy, p)

    # participant
    p = eo((t - 1.4) / 0.8)
    g = glow_sprite(520, SULFUR, 0.12)
    put(fr, g, P_NODE[0], P_NODE[1], p, "mm")
    put_scaled(fr, node(190, SULFUR, "person"), P_NODE[0], P_NODE[1], 0.7 + 0.3 * eback((t - 1.4) / 0.8), p)
    put(fr, text_img("PARTICIPANT", "mono_b", 18, SULFUR, 3), P_NODE[0], P_NODE[1] + 116, p, "mt")
    put(fr, text_img("Maya Chen · P-014", "body_sb", 24, INK), P_NODE[0], P_NODE[1] + 146, p, "mt")
    # connections
    sp, ox, oy = connections_sprite()
    put_crop(fr, sp, ox, oy, eio((t - 2.2) / 1.0), 1)
    # team
    for i, (x, y, label) in enumerate(TEAM):
        p = eo((t - 2.6 - i * 0.18) / 0.7)
        col = EMBER if i == 0 else INK
        put_scaled(fr, node(128, col, "person", icol=col), x, y, 0.6 + 0.4 * eback((t - 2.6 - i * 0.18) / 0.7), p)
        put(fr, text_img(label, "mono_b", 16, MUTED, 3), x, y + 76, p, "mt")
    # packets
    if t > 3.4:
        curves = team_curves()
        for k, lbl in enumerate(("P-014", "P-019", "P-023")):
            for rep in range(1):
                ph = (t - 3.4 - k * 0.9) / 2.7
                if ph < 0:
                    continue
                u = ph % 1.0
                c = curves[k]
                x, y = bezier(*c, 0.1 + 0.88 * eio(u))
                o = clamp((u - 0.05) / 0.12) * clamp((1 - u) / 0.12)
                put(fr, pill(lbl, SULFUR, CARBON, 235, SULFUR, 17), x, y, o, "mm")


def s_constraint(fr, t):
    eyebrow(fr, t, "THE CONSTRAINT")
    headline(fr, t, [(("Today, access is ", INK), ("all or nothing.", CRIMSON))], size=108)
    py, pw, ph = 360, 780, 480
    lx, rx = LX, LX + pw + 40
    # left panel: shared drive
    p, dy = rise(t, 1.0, 0.8, 50)
    put(fr, card(pw, ph), lx, py + dy, p)
    put(fr, text_img("OPTION A  ·  THE SHARED DRIVE", "mono_b", 20, MUTED, 3), lx + 36, py + 34 + dy, p)
    rows = [("doc", "Study protocols"), ("doc", "Coded interview responses"), ("person", "Participant identities")]
    for i, (ic, label) in enumerate(rows):
        pr, dr = rise(t, 1.5 + i * 0.25, 0.6, 24)
        ry = py + 92 + i * 118 + dy + dr
        put(fr, flat(pw - 72, 96, 18, BG, 200, SEAM), lx + 36, ry, pr * p)
        put(fr, icon(ic, 34, MUTED), lx + 64, ry + 48, pr * p, "lm")
        put(fr, text_img(label, "body_sb", 28, INK), lx + 116, ry + 48, pr * p, "lm")
        pt = eo((t - 2.4 - i * 0.3) / 0.5)
        put_scaled(fr, pill("OPEN TO ALL", CRIMSON, CRIMSON, 30, CRIMSON, 17), lx + pw - 120, ry + 48, 0.7 + 0.3 * eback((t - 2.4 - i * 0.3) / 0.5), pt * p)
    pc, dc = rise(t, 3.6)
    put(fr, text_img("Assistants see everything, identities included.", "body", 28, MUTED), lx, py + ph + 30 + dc, pc)

    # right panel: single gatekeeper
    p, dy = rise(t, 4.6, 0.8, 50)
    put(fr, card(pw, ph), rx, py + dy, p)
    put(fr, text_img("OPTION B  ·  ONE GATEKEEPER", "mono_b", 20, MUTED, 3), rx + 36, py + 34 + dy, p)
    ncx, ncy = rx + 190, py + 236 + dy
    crack = eo((t - 7.4) / 0.4)
    gl = glow_sprite(420, CRIMSON if crack > 0 else EMBER, 0.18 + 0.2 * crack)
    put(fr, gl, ncx, ncy, p, "mm")
    put(fr, node(176, EMBER, "key"), ncx, ncy, p * (1 - crack), "mm")
    put(fr, node(176, CRIMSON, "key"), ncx, ncy, p * crack, "mm")
    put(fr, text_img("HEAD RESEARCHER", "mono_b", 18, MUTED, 3), ncx, ncy + 104, p, "mt")
    labels = ["Protocols", "Coded responses", "Identities"]
    for i, label in enumerate(labels):
        pr = eo((t - 5.2 - i * 0.2) / 0.5) * p
        ry = py + 96 + i * 100 + dy
        lx2 = rx + 420
        for col, o in ((EMBER, 1 - crack), (CRIMSON, crack)):
            sp = gate_line(i, col)
            put_crop(fr, sp, ncx + 92, min(ncy, ry + 40) - 4, eio((t - 5.2 - i * 0.2) / 0.6), pr * o * 0.85)
        put(fr, flat(320, 80, 16, BG, 200, SEAM), lx2, ry, pr)
        put(fr, icon("unlock" if crack > 0.5 else "lock", 30, MUTED if crack < 0.5 else CRIMSON), lx2 + 26, ry + 40, pr, "lm")
        put(fr, text_img(label, "body_sb", 26, INK), lx2 + 72, ry + 40, pr, "lm")
    if t > 7.2:
        s = 1 + 0.6 * (1 - eback((t - 7.2) / 0.5))
        put_rot(fr, pill("SINGLE POINT OF FAILURE", INK, CRIMSON, 235, None, 26, padx=26, pady=14),
                rx + pw / 2 + 20, py + ph - 44 + dy, 3, s, eo((t - 7.2) / 0.3))
    pc, dc = rise(t, 7.9)
    put(fr, text_img("One careless or compromised account changes everything.", "body", 28, MUTED), rx, py + ph + 30 + dc, pc)
    p, dy = rise(t, 10.2)
    put(fr, rich((("Either way, ", INK), ("participants carry the risk.", "grad")), "display_semi", 50),
        W / 2, 942 + dy, p, "mt")


@functools.lru_cache(None)
def gate_line(i, color):
    """Connector from the gatekeeper node edge to row i; sprite origin is (node edge, top of span - 4)."""
    x0, y0 = 0, 236
    x1, y1 = 420 - 190 - 92, 96 + i * 100 + 40
    top = min(y0, y1) - 4
    w, h = x1 - x0 + 4, abs(y1 - y0) + 8
    big, d = ss_canvas(w, h)
    d.line([(x0 * SS, (y0 - top) * SS), (x1 * SS, (y1 - top) * SS)], fill=rgba(color), width=3 * SS)
    return ss_done(big, w, h)


@functools.lru_cache(None)
def halftone_card(w, h):
    yy, xx = np.mgrid[0:h, 0:w]
    k = np.clip((xx / w) * 0.55 + (yy / h) * 0.45, 0, 1)[..., None]
    a, b = np.array(VIOLET, float), np.array(EMBER, float)
    arr = a + (b - a) * k
    cellx, celly = (xx % 12) - 6, (yy % 12) - 6
    dot = (cellx ** 2 + celly ** 2) < (2.2 + 2.4 * k[..., 0]) ** 2
    arr = np.where(dot[..., None], arr * 1.0, arr * 0.62)
    im = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    im.putalpha(rr_mask(w, h, 30))
    return im


TIERS = [
    ("circle_o", SULFUR, "L1  ·  INTERNAL", "Study protocols  ·  open to the assigned team", False),
    ("square", EMBER, "L2  ·  RESTRICTED", "Coded interviews  ·  quorum approval required", False),
    ("hexagon", VIOLET_LT, "L3  ·  HIGHLY RESTRICTED", "Identity mappings  ·  owner and custodian only", False),
    ("users", FLARE, "QEA  ·  GOVERNANCE QUORUM", "2 of 3 admins commit any broader grant", True),
]


def s_platform(fr, t):
    eyebrow(fr, t, "THE PLATFORM")
    yb = headline(fr, t, [(("Meet", INK),), (("ResearchVault.", "grad"),)], size=128)
    p, dy = rise(t, 1.0)
    put(fr, para("A research participation vault where every team member sees only what their work requires, "
                 "and no single admin can widen access alone.", "body", 32, MUTED, 720), LX, yb + 36 + dy, p)
    points = ["Every record sealed to a clearance tier", "Five distinct roles, scoped per study",
              "Broader access needs independent approval"]
    for i, s in enumerate(points):
        pp, dd = rise(t, 4.2 + i * 0.3)
        y = 720 + i * 62 + dd
        put(fr, icon("check", 28, LIME), LX, y + 4, pp)
        put(fr, text_img(s, "body_sb", 28, INK), LX + 46, y - 4, pp)

    cx, cy, cw, ch = 1000, 200, 760, 700
    p, dy = rise(t, 0.8, 0.9, 60)
    put(fr, halftone_card(cw, ch), cx, cy + dy, p)
    put(fr, text_img("CLEARANCE TIERS  ·  SEALED PER RECORD", "mono_b", 20, INK, 3), cx + 40, cy + 36 + dy, p)
    for i, (ic, col, title, detail, gov) in enumerate(TIERS):
        pr, dr = rise(t, 1.5 + i * 0.35 + (0.5 if gov else 0), 0.7, 30)
        ry = cy + 92 + i * 148 + dy + dr
        if gov:
            put(fr, flat(cw - 80, 128, 20, BG, 120, FLARE, 2), cx + 40, ry, pr * p)
        else:
            put(fr, flat(cw - 80, 128, 20, BG, 215, None), cx + 40, ry, pr * p)
        put(fr, icon(ic, 36, col), cx + 72, ry + 30, pr * p)
        put(fr, text_img(title, "display_semi", 40, INK, 1), cx + 130, ry + 20, pr * p)
        put(fr, text_img(detail, "body", 24, MUTED if not gov else INK), cx + 130, ry + 74, pr * p)


BEATS = [1.0, 5.5, 10.0, 14.5, 21.0]
STEPS = ["REQUEST", "PROPOSE", "CO-SIGN", "UNLOCK"]
CAPTIONS = [
    (("Riley requests exactly the scope ", INK), ("her work needs.", "grad")),
    (("The head researcher approves, but ", INK), ("one signature isn't enough.", "grad")),
    (("An independent steward co-signs. ", INK), ("Quorum commits the grant.", "grad")),
    (("Coded responses unlock. ", INK), ("Identities stay sealed.", "grad")),
]


def step_tracker(fr, t):
    y = 300
    xs = [LX + 22 + k * (W - 2 * LX - 44) / 3 for k in range(4)]
    p0 = eo((t - 0.4) / 0.6)
    put(fr, flat(int(xs[-1] - xs[0]), 3, 1, SEAM), xs[0], y, p0, "lm")
    active = max([k for k in range(4) if t >= BEATS[k]] or [-1])
    if active >= 0:
        prev = xs[max(active - 1, 0)]
        cur = prev + (xs[active] - prev) * eio((t - BEATS[active]) / 0.6)
        if cur - xs[0] > 1:
            put(fr, flat(int(cur - xs[0]), 3, 1, EMBER), xs[0], y, p0, "lm")
    for k, x in enumerate(xs):
        pk = eo((t - 0.5 - k * 0.1) / 0.5)
        if k < active:
            put(fr, node(44, EMBER, "check", icol=INK, fill=EMBER), x, y, pk, "mm")
        elif k == active:
            pulse = (t * 1.2) % 1.0
            ring = node(44, EMBER, None, fill=BG)
            put_scaled(fr, flat(44, 44, 22, None, 0, EMBER, 2), x, y, 1 + pulse * 0.8, pk * (1 - pulse) * 0.8)
            put(fr, ring, x, y, pk, "mm")
            put(fr, text_img(str(k + 1), "display", 24, EMBER), x + 1, y + 2, pk, "mm")
        else:
            put(fr, node(44, SEAM, None, fill=BG), x, y, pk, "mm")
            put(fr, text_img(str(k + 1), "display", 24, MUTED), x + 1, y + 2, pk, "mm")
        col = EMBER if k == active else (INK if k < active else MUTED)
        put(fr, text_img(STEPS[k], "mono_b", 18, col, 3), x, y + 34, pk, "mt")


def status_pill(t):
    states = [
        (BEATS[0], pill("REQUESTED", SULFUR, SULFUR, 30, SULFUR, 18)),
        (BEATS[1] + 1.3, pill("PENDING_GOVERNANCE", EMBER, EMBER, 30, EMBER, 18)),
        (BEATS[2] + 1.3, pill("COMMITTED", LIME, LIME, 30, LIME, 18)),
    ]
    out = []
    for i, (ts, im) in enumerate(states):
        te = states[i + 1][0] if i + 1 < len(states) else 1e9
        o = clamp((t - ts) / 0.3) * clamp((te - t) / 0.3 + 1) if t < te else 0
        if t >= te:
            o = clamp(1 - (t - te) / 0.3)
        out.append((im, o))
    return out


REASON = "Thematic coding of interview transcripts P-014, P-019 and P-023."


def request_card(fr, t, x, y, op):
    w, h = 860, 450
    put(fr, card(w, h), x, y, op)
    put(fr, text_img("ACCESS REQUEST  ·  change-001", "mono_b", 20, MUTED, 3), x + 40, y + 38, op)
    for im, o in status_pill(t):
        put(fr, im, x + w - 40, y + 30, op * o, "rt")
    put(fr, flat(w - 80, 2, 1, SEAM), x + 40, y + 92, op)
    put(fr, node(88, EMBER, None, "RP", icol=INK), x + 40, y + 120, op)
    put(fr, text_img("Riley Park", "body_b", 36, INK), x + 150, y + 118, op)
    put(fr, text_img("Research assistant  ·  study-wellbeing-01", "body", 24, MUTED), x + 150, y + 166, op)
    put(fr, text_img("REQUESTED SCOPE", "mono_b", 18, MUTED, 3), x + 40, y + 244, op)
    cx = x + 40
    for im in (pill("RESTRICTED", EMBER, EMBER, 34, EMBER, 18), pill("READ", INK, None, 0, MUTED, 18),
               pill("study-wellbeing-01", MUTED, None, 0, SEAM, 18, tracking=1)):
        put(fr, im, cx, y + 274, op)
        cx += im.width + 14
    put(fr, flat(w - 80, 92, 16, BG, 220, SEAM), x + 40, y + 334, op)
    put(fr, text_img("REASON", "mono_b", 16, MUTED, 3), x + 62, y + 348, op)
    n = int(len(REASON) * clamp((t - BEATS[0] - 0.9) / 2.2))
    if n > 0:
        put(fr, text_img(REASON[:n], "body", 26, INK), x + 62, y + 372, op)
    if BEATS[0] + 0.9 < t < BEATS[0] + 3.6 and (t * 2) % 1 < 0.6:
        tw = font("body", 26).getlength(REASON[:n])
        put(fr, flat(2, 30, 1, EMBER), x + 64 + tw, y + 378, op)


APPROVERS = [("Dr. Sam Taylor", "Head researcher", BEATS[1] + 1.2),
             ("Jordan Lee", "Data steward", BEATS[2] + 1.2)]


def quorum_card(fr, t, x, y, op):
    w, h = 700, 450
    put(fr, card(w, h), x, y, op)
    put(fr, text_img("GOVERNANCE QUORUM  ·  2 OF 3 ADMINS", "mono_b", 20, MUTED, 3), x + 40, y + 38, op)
    count = sum(1 for *_, ts in APPROVERS if t >= ts)
    cols = [MUTED, EMBER, LIME]
    caps = ["Awaiting a governance proposal", "Pending: one approval is not enough", "Committed: independent quorum reached"]
    for c in range(3):
        ts = 0 if c == 0 else APPROVERS[c - 1][2]
        te = APPROVERS[c][2] if c < 2 else 1e9
        o = clamp((t - ts) / 0.3) if c else 1
        o *= clamp(1 - (t - te) / 0.3) if t >= te else 1
        if o <= 0:
            continue
        put(fr, rich(((str(c), cols[c]), (" / 2", MUTED)), "display", 150), x + 40, y + 78, op * o)
        put(fr, text_img(caps[c], "body_sb", 26, cols[c] if c else MUTED), x + 40, y + 250, op * o)
    for i, (name, role, ts) in enumerate(APPROVERS):
        ry = y + 314 + i * 66
        signed = t >= ts
        col = LIME if count == 2 else EMBER
        if signed:
            pulse = clamp((t - ts) / 0.8)
            put_scaled(fr, flat(48, 48, 24, None, 0, col, 2), x + 64, ry + 24, 1 + pulse * 1.4, op * (1 - pulse))
            put(fr, node(48, col, "check", icol=BG, fill=col), x + 64, ry + 24, op, "mm")
        else:
            put(fr, node(48, SEAM, None, fill=BG), x + 64, ry + 24, op, "mm")
        put(fr, rich(((name, INK), ("  ·  " + role, MUTED)), "body_sb", 26), x + 108, ry + 6, op)
        tag = text_img("SIGNED" if signed else "AWAITING", "mono_b", 18, col if signed else MUTED, 3)
        put(fr, tag, x + w - 40, ry + 14, op, "rt")


TILES = [("P-014", "Coded interview response", False), ("P-019", "Coded interview response", False),
         ("P-023", "Coded interview response", False), ("ID-MAP", "Participant identity mapping", True)]


def record_tiles(fr, t, op):
    w, h, gap, y = 375, 440, 33, 400
    for i, (code, sub, ident) in enumerate(TILES):
        pi, di = rise(t, BEATS[3] + 0.3 + i * 0.12, 0.6, 40)
        x = LX + i * (w + gap)
        t_open = BEATS[3] + 1.6 + i * 0.45
        if ident:
            t_open = BEATS[3] + 3.4
            shake = 10 * math.sin((t - t_open) * 46) * clamp(1 - (t - t_open) / 0.5) if t > t_open else 0
            x += shake
        o = pi * op
        opened = 0 if ident else eo((t - t_open) / 0.5)
        denied = eo((t - t_open) / 0.3) if ident else 0
        put(fr, card(w, h), x, y + di, o * (1 - opened))
        put(fr, card(w, h, border=LIME), x, y + di, o * opened)
        if denied:
            put(fr, card(w, h, border=CRIMSON), x, y + di, o * denied)
        tier = pill("L3 · HIGHLY RESTRICTED", VIOLET_LT, VIOLET, 50, VIOLET_LT, 15, tracking=1) if ident else \
            pill("L2 · RESTRICTED", EMBER, EMBER, 34, EMBER, 15, tracking=1)
        put(fr, tier, x + 28, y + 28 + di, o)
        put(fr, text_img(code, "display", 58, INK, 1), x + 28, y + 76 + di, o)
        put(fr, text_img(sub, "body", 22, MUTED), x + 28, y + 146 + di, o)
        icx, icy = x + w / 2, y + 280 + di
        lock_col = VIOLET_LT if ident else MUTED
        put(fr, icon("lock", 84, CRIMSON if denied > 0.5 else lock_col), icx, icy, o * (1 - opened), "mm")
        if opened > 0:
            for k, lw in enumerate((300, 250, 280, 190)):
                put(fr, flat(lw, 12, 6, MUTED, 120), x + 28, y + 218 + k * 30 + di, o * eo((t - t_open - k * 0.08) / 0.4))
        if ident:
            label = pill("403 · STILL SEALED", CRIMSON, CRIMSON, 34, CRIMSON, 17) if denied > 0 else \
                pill("LOCKED", MUTED, None, 0, SEAM, 17)
            put(fr, label, x + 28, y + h - 70 + di, o)
        else:
            put(fr, pill("LOCKED", MUTED, None, 0, SEAM, 17), x + 28, y + h - 70 + di, o * (1 - opened))
            put(fr, pill("DECRYPTED", BG, LIME, 255, None, 17), x + 28, y + h - 70 + di, o * opened)
            if opened > 0:
                put(fr, icon("check", 30, LIME), x + w - 58, y + h - 66 + di, o * opened)


def s_how(fr, t):
    eyebrow(fr, t, "HOW IT WORKS", y=120)
    headline(fr, t, [(("Scope by quorum, ", INK), ("not by admin.", "grad"))], y=152, size=84)
    step_tracker(fr, t)
    stage_op = clamp((BEATS[3] + 0.2 - t) / 0.5)
    if stage_op > 0:
        p, dy = rise(t, 0.8, 0.8, 50)
        request_card(fr, t, LX, 400 + dy, p * stage_op)
        p, dy = rise(t, BEATS[1] - 0.2, 0.8, 50)
        quorum_card(fr, t, LX + 900, 400 + dy, p * stage_op)
    if t > BEATS[3]:
        record_tiles(fr, t, 1)
    for i, spans in enumerate(CAPTIONS):
        o = window(t, BEATS[i] + 0.3, BEATS[i + 1], 0.35)
        if o > 0:
            put(fr, rich(spans, "display_semi", 46), W / 2, 922 + (1 - o) * 14, o, "mt")
    put(fr, text_img("ILLUSTRATIVE INTERFACE  ·  SYNTHETIC DATA", "mono", 16, MUTED, 3), W - LX, 1004,
        clamp((t - 1) / 0.6) * 0.8, "rt")


AUDIENCES = [
    ("person", "FOR PARTICIPANTS", "See your own data.",
     "Know which tier each record sits in and exactly who can reach it."),
    ("flask", "FOR RESEARCH TEAMS", "Start analysis sooner.",
     "Assistants get the scope their task needs, not the whole shared drive."),
    ("building", "FOR INSTITUTIONS", "Accountable by design.",
     "Broader access needs independent approval, never one admin's say-so."),
]


def s_changes(fr, t):
    eyebrow(fr, t, "WHAT CHANGES")
    headline(fr, t, [(("Collaboration without", INK),), (("concentrated power.", "grad"),)], size=112)
    w, h, gap, y = 505, 380, 42, 480
    for i, (ic, tag, title, body) in enumerate(AUDIENCES):
        p, dy = rise(t, 1.2 + i * 0.3, 0.8, 60)
        bob = math.sin((t - i * 0.6) * 1.4) * 4 * p
        x = LX + i * (w + gap)
        yy = y + dy + bob
        put(fr, card(w, h), x, yy, p)
        put(fr, glow_sprite(260, EMBER, 0.16), x + 72, yy + 72, p, "mm")
        put(fr, node(76, EMBER, ic), x + 36, yy + 36, p)
        put(fr, text_img(tag, "mono_b", 18, EMBER, 3), x + 36, yy + 146, p)
        put(fr, text_img(title, "display_semi", 46, INK), x + 36, yy + 180, p)
        put(fr, para(body, "body", 26, MUTED, w - 72), x + 36, yy + 252, p)


def s_end(fr, t):
    cx = W / 2
    word = text_img("RESEARCHVAULT", "display", 124, INK, 6)
    em = emblem(116)
    total = em.width + 34 + word.width
    x0 = cx - total / 2
    p = eo((t - 0.1) / 0.8)
    put_scaled(fr, em, x0 + em.width / 2, 420, 0.5 + 0.5 * eback((t - 0.1) / 0.8), p)
    put_crop(fr, word, x0 + em.width + 34, 420 - word.height / 2 + 6, eio((t - 0.4) / 0.9), clamp((t - 0.4) / 0.3))
    p, dy = rise(t, 1.2, 0.8)
    put(fr, rich((("Scope by quorum, ", INK), ("not by admin.", "grad")), "display_semi", 68), cx, 540 + dy, p, "mt")
    p, dy = rise(t, 1.9, 0.8)
    put(fr, pill("BUILT WITH TIDECLOAK", EMBER, EMBER, 30, EMBER, 22, padx=26, pady=14), cx, 670 + dy, p, "mt")
    p, dy = rise(t, 2.5, 0.8)
    put(fr, text_img("RESEARCH PARTICIPATION VAULT  ·  PROTOTYPE  ·  SYNTHETIC DATA", "mono", 18, MUTED, 4),
        cx, 770 + dy, p * 0.9, "mt")


CAPTURE = os.path.join(HERE, "capture")
FX, FY, FW, FH = 315, 168, 1290, 806
SHOT_LEN = 2.3


@functools.lru_cache(None)
def demo_shots():
    import json

    path = os.path.join(CAPTURE, "shots.json")
    if not os.path.exists(path):
        return []
    with open(path) as fh:
        shots = json.load(fh)
    return [s for s in shots if os.path.exists(os.path.join(CAPTURE, s["name"] + ".png"))][:9]


@functools.lru_cache(None)
def shot_img(name):
    return Image.open(os.path.join(CAPTURE, name + ".png")).convert("RGB")


@functools.lru_cache(None)
def cursor_sprite():
    s = 4
    S = 34 * s
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(2, 2), (2, 26), (8.5, 20), (13, 30), (17, 28.5), (12.5, 18.5), (21, 18.5)]
    d.polygon([(x * s, y * s) for x, y in pts], fill=(255, 255, 255, 255), outline=(8, 9, 13, 255), width=2 * s)
    return im.resize((34, 34), Image.LANCZOS)


@functools.lru_cache(None)
def browser_frame(url):
    im = card(FW + 4, FH + 50, r=18, top=(26, 30, 44), bot=(14, 16, 24), border=SEAM, bw=2).copy()
    d = ImageDraw.Draw(im)
    for i, c in enumerate(((255, 95, 87), (254, 188, 46), (40, 200, 64))):
        d.ellipse([20 + i * 22, 17, 32 + i * 22, 29], fill=rgba(c))
    bar = flat(560, 28, 14, BG, 255, SEAM)
    im.alpha_composite(bar, ((FW + 4 - 560) // 2, 9))
    t = text_img("127.0.0.1:5173" + url, "mono", 16, MUTED, 1)
    im.alpha_composite(t, ((FW + 4 - t.width) // 2, 13))
    return im


def shot_view(shot, u):
    """Zoom 1.0 -> 1.07 toward the click target; returns the frame image and crop window."""
    src = shot_img(shot["name"])
    tgt = shot.get("target")
    tx, ty = (tgt[0] + tgt[2] / 2, tgt[1] + tgt[3] / 2) if tgt else (0.5, 0.5)
    z = 1 + 0.07 * eio(u)
    cw = 1 / z
    x0, y0 = (1 - cw) * tx, (1 - cw) * ty
    box = (int(x0 * src.width), int(y0 * src.height), int((x0 + cw) * src.width), int((y0 + cw) * src.height))
    return src.crop(box).resize((FW, FH), Image.BILINEAR).convert("RGBA"), (x0, y0, cw)


def to_screen(nx, ny, win):
    x0, y0, cw = win
    return FX + (nx - x0) / cw * FW, FY + (ny - y0) / cw * FH


def s_demo(fr, t):
    shots = demo_shots()
    eyebrow(fr, t, "IN THE APP", y=104)
    if not shots:
        return
    p, dy = rise(t, 0.3, 0.8, 50)
    put(fr, browser_frame("/"), FX - 2, FY - 46 + dy, p)
    i = min(int(t / SHOT_LEN), len(shots) - 1)
    u = clamp((t - i * SHOT_LEN) / SHOT_LEN)
    shot = shots[i]
    put(fr, browser_frame(shot["url"]), FX - 2, FY - 46 + dy, p)
    view, win = shot_view(shot, u)
    put(fr, view, FX, FY + dy, p)
    if i > 0 and u < 0.18:
        prev, pwin = shot_view(shots[i - 1], 1.0)
        put(fr, prev, FX, FY + dy, p * (1 - eo(u / 0.18)))
    # cursor travels from the previous target to this one, then clicks
    def centre(s, w):
        tg = s.get("target")
        if not tg:
            return None
        x, y = to_screen(tg[0] + tg[2] / 2, tg[1] + tg[3] / 2, w)
        return clamp(x, FX + 30, FX + FW - 40), clamp(y, FY + 30, FY + FH - 90)

    here = centre(shot, win)
    before = centre(shots[i - 1], win) if i > 0 else (FX + FW * 0.55, FY + FH * 0.6)
    if here is None:
        here = before or (FX + FW * 0.6, FY + FH * 0.55)
    if before is None:
        before = here
    m = eio(clamp((u - 0.1) / 0.45))
    cx = before[0] + (here[0] - before[0]) * m
    cy = before[1] + (here[1] - before[1]) * m - math.sin(math.pi * m) * 40
    if shot.get("target") and u > 0.6:
        r = clamp((u - 0.6) / 0.35)
        put_scaled(fr, flat(40, 40, 20, None, 0, EMBER, 3), here[0], here[1], 0.6 + r * 1.6, p * (1 - r))
    put(fr, cursor_sprite(), cx - 3, cy - 3 + dy, p)
    cap = shot.get("caption", "")
    if cap:
        o = window(u * SHOT_LEN, 0.15, SHOT_LEN + 1, 0.25)
        im = pill(cap, INK, BG, 230, SEAM, 24, kind="body_sb", tracking=0, padx=26, pady=14)
        put(fr, im, W / 2, FY + FH - 30 + dy, p * o, "mb")
    put(fr, text_img("LIVE LOCAL BUILD  ·  SIMULATED GOVERNANCE  ·  SYNTHETIC DATA", "mono", 16, MUTED, 3),
        W - LX, 112, clamp((t - 0.6) / 0.6) * 0.8, "rt")


SCENE_FNS = [s_brand, s_possibility, s_constraint, s_platform, s_how, s_demo, s_changes, s_end]


# ---------------------------------------------------------------------------
# Frame assembly
# ---------------------------------------------------------------------------


def render_frame(gt):
    fr = background().copy()
    G["op"], G["dy"] = 1.0, 0.0
    # drifting ambient glows
    put(fr, glow_sprite(1500, EMBER, 0.16), W * 0.78 + 90 * math.sin(gt / 6), H * 0.18 + 60 * math.cos(gt / 7), 1, "mm")
    put(fr, glow_sprite(1400, VIOLET, 0.16), W * 0.16 + 80 * math.cos(gt / 8), H * 0.9 + 50 * math.sin(gt / 5), 1, "mm")
    chrome(fr, gt)
    for (a, b), fn in zip(SCENES, SCENE_FNS):
        if a <= gt < b or (b == DUR and gt >= a):
            t = gt - a
            dur = b - a
            exit_len = 0.6 if b < DUR else 1.0
            x = 1 - eio((t - (dur - exit_len)) / exit_len)
            G["op"] = x
            G["dy"] = -22 * (1 - x) if b < DUR else 0
            fn(fr, t)
            G["op"], G["dy"] = 1.0, 0.0
    # light sweep at scene boundaries
    for a, _ in SCENES[1:]:
        u = (gt - (a - 0.45)) / 0.9
        if 0 <= u <= 1:
            put(fr, sweep_sprite(), -260 + (W + 520) * eio(u), 0, math.sin(math.pi * u) * 0.9)
    if gt > DUR - 1.0:
        k = clamp((DUR - gt) / 1.0)
        fr = Image.blend(Image.new("RGBA", (W, H), rgba(BG)), fr, k)
    return fr.convert("RGB")


def render_segment(args):
    idx, f0, f1 = args
    path = os.path.join(HERE, f"_part{idx:02d}.mp4")
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
           "-pix_fmt", "yuv420p", "-g", str(FPS * 2), path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(f0, f1):
        proc.stdin.write(render_frame(f / FPS).tobytes())
    proc.stdin.close()
    proc.wait()
    return path


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        out = os.path.join(HERE, "preview")
        os.makedirs(out, exist_ok=True)
        for s in sys.argv[2:]:
            render_frame(float(s)).save(os.path.join(out, f"t{float(s):05.1f}.png"))
        return
    total = int(DUR * FPS)
    workers = max(2, min(8, (os.cpu_count() or 4) - 1))
    chunk = math.ceil(total / workers)
    jobs = [(i, i * chunk, min(total, (i + 1) * chunk)) for i in range(workers) if i * chunk < total]
    with Pool(len(jobs)) as pool:
        parts = pool.map(render_segment, jobs)
    listfile = os.path.join(HERE, "_parts.txt")
    with open(listfile, "w") as fh:
        for p in parts:
            fh.write(f"file '{os.path.basename(p)}'\n")
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", listfile, "-c", "copy", "-movflags", "+faststart", OUT], check=True, cwd=HERE)
    for p in parts:
        os.remove(p)
    os.remove(listfile)
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
