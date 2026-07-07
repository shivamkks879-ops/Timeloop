#!/usr/bin/env python3
"""
Generate branded Time Loop Escape assets:
  • icon.png              1024x1024   (main app icon — dark BG + neon glyph)
  • adaptive-icon.png     1024x1024   (Android adaptive foreground only)
  • splash-image.png      1242x1242   (splash artwork — logo centred)
  • favicon.png             48x48    (web favicon)

Design language: neon cyan + purple, dark space background. The glyph is a
stylised "time-loop" — a circular arrow curving back into itself, echoing
the game's rewind mechanic. A subtle "TL" monogram sits at the bottom.
"""

import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# --- Palette ---
BG_TOP = (10, 11, 16, 255)
BG_BOT = (26, 20, 60, 255)
CYAN = (0, 229, 255, 255)
CYAN_SOFT = (0, 229, 255, 90)
PURPLE = (157, 0, 255, 255)
PURPLE_SOFT = (157, 0, 255, 90)
WHITE = (255, 255, 255, 255)


# Font paths (try in order — first that exists is used).
FONT_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
FONT_REG_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]


def _load_font(size, bold=True):
    import os as _os
    candidates = FONT_BOLD_CANDIDATES if bold else FONT_REG_CANDIDATES
    for path in candidates:
        if _os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ---------- helpers ----------

def make_bg(size, radial=True):
    """Solid dark bg with radial-ish glow (approximated with vertical gradient)."""
    img = Image.new("RGBA", (size, size), BG_TOP)
    px = img.load()
    for y in range(size):
        t = y / size
        # blend BG_TOP -> BG_BOT with a bias toward the top so the "sky" stays dark.
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t * 0.9)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t * 0.9)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t * 0.9)
        for x in range(size):
            px[x, y] = (r, g, b, 255)
    return img


def draw_loop_glyph(size, transparent_bg=False, glow_boost=1.0):
    """
    Draw the signature "time-loop" glyph — a thick circular arc with a
    trailing arrowhead. Multiple blurred passes give a strong neon bloom.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    r_outer = size * 0.36
    r_inner = size * 0.28

    # Big cyan ring — 300° arc so there's a visible "gap" that reads as motion.
    start_deg, end_deg = 40, 340

    # Outer bloom
    bloom = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    for width_off, alpha_scale in [(24, 0.35), (14, 0.55), (6, 0.9)]:
        bd.arc(
            [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
            start_deg, end_deg,
            fill=(CYAN[0], CYAN[1], CYAN[2], int(220 * alpha_scale * glow_boost)),
            width=width_off,
        )
    bloom = bloom.filter(ImageFilter.GaussianBlur(radius=size * 0.02))
    img.alpha_composite(bloom)

    # Sharp inner cyan ring
    d.arc(
        [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
        start_deg, end_deg,
        fill=CYAN, width=int(size * 0.028),
    )

    # Purple counter-ring inside (echo motif)
    purple_ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(purple_ring)
    pd.arc(
        [cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner],
        200, 500,
        fill=(PURPLE[0], PURPLE[1], PURPLE[2], 200),
        width=int(size * 0.018),
    )
    purple_ring_blur = purple_ring.filter(ImageFilter.GaussianBlur(radius=size * 0.012))
    img.alpha_composite(purple_ring_blur)
    img.alpha_composite(purple_ring)

    # Arrow tip on the cyan ring — points inward, punctuating the loop.
    tip_angle = math.radians(end_deg)
    tip_x = cx + math.cos(tip_angle) * r_outer
    tip_y = cy - math.sin(tip_angle) * r_outer   # PIL Y goes DOWN, arc goes CCW
    arrow = size * 0.06
    # rotated triangle
    forward = (math.cos(tip_angle + math.pi / 2), -math.sin(tip_angle + math.pi / 2))
    sideL = (math.cos(tip_angle), -math.sin(tip_angle))
    p1 = (tip_x + forward[0] * arrow, tip_y + forward[1] * arrow)
    p2 = (tip_x - sideL[0] * arrow * 0.8, tip_y - sideL[1] * arrow * 0.8)
    p3 = (tip_x + sideL[0] * arrow * 0.8, tip_y + sideL[1] * arrow * 0.8)
    d.polygon([p1, p2, p3], fill=CYAN)

    # White core dot — the "loop anchor"
    core_r = size * 0.045
    d.ellipse(
        [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
        fill=WHITE,
    )
    core_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cgd = ImageDraw.Draw(core_glow)
    cgd.ellipse(
        [cx - core_r * 2.5, cy - core_r * 2.5, cx + core_r * 2.5, cy + core_r * 2.5],
        fill=(255, 255, 255, 140),
    )
    core_glow = core_glow.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    img.alpha_composite(core_glow)
    d.ellipse(
        [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
        fill=WHITE,
    )

    if transparent_bg:
        return img

    bg = make_bg(size)
    bg.alpha_composite(img)
    return bg


def add_wordmark(img, text, y_frac=0.86, size_frac=0.06):
    """Overlay a small letter-spaced wordmark near the bottom of the icon."""
    size = img.size[0]
    d = ImageDraw.Draw(img)
    font = _load_font(int(size * size_frac), bold=True)
    tw = d.textlength(text, font=font)
    d.text(
        ((size - tw) / 2, size * y_frac),
        text,
        font=font,
        fill=(255, 255, 255, 220),
    )
    return img


# ---------- generators ----------

def make_icon():
    """Main app icon — big, saturated, works at 48px and 512px."""
    img = draw_loop_glyph(1024, transparent_bg=False, glow_boost=1.1)
    add_wordmark(img, "TIME LOOP", y_frac=0.83, size_frac=0.058)
    return img


def make_adaptive_icon_foreground():
    """
    Adaptive-icon foreground: transparent BG, glyph safely inside the
    inner 66% (Android crops the outer 33% for round/squircle masks).
    """
    size = 1024
    # Work in a "safe zone" of 66% — draw at 66% and paste centred.
    inner = 680
    inner_img = draw_loop_glyph(inner, transparent_bg=True, glow_boost=1.0)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(inner_img, ((size - inner) // 2, (size - inner) // 2))
    return out


def make_splash():
    """Splash image — big centred logo + wordmark. BG handled by expo-splash-screen."""
    size = 1242
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glyph = draw_loop_glyph(int(size * 0.55), transparent_bg=True, glow_boost=1.2)
    gx = (size - glyph.size[0]) // 2
    gy = int(size * 0.20)
    img.alpha_composite(glyph, (gx, gy))
    font_big = _load_font(80, bold=True)
    font_small = _load_font(34, bold=True)
    d = ImageDraw.Draw(img)
    tw = d.textlength("TIME LOOP", font=font_big)
    d.text(((size - tw) / 2, int(size * 0.80)), "TIME LOOP",
           font=font_big, fill=(255, 255, 255, 240))
    tw2 = d.textlength("ESCAPE", font=font_big)
    d.text(((size - tw2) / 2, int(size * 0.86)), "ESCAPE",
           font=font_big, fill=CYAN)
    tw3 = d.textlength("A PUZZLE PLATFORMER", font=font_small)
    d.text(((size - tw3) / 2, int(size * 0.93)), "A PUZZLE PLATFORMER",
           font=font_small, fill=(120, 130, 150, 220))
    return img


def make_favicon():
    return make_icon().resize((48, 48), Image.LANCZOS)


def make_feature_graphic():
    """Play Store Feature Graphic (1024 × 500). Landscape hero banner
    showing the loop glyph on the left and the wordmark + tagline on the
    right, all on the signature deep-space gradient with a scattering of
    stars for depth."""
    W, H = 1024, 500

    # Background — horizontal gradient dark-purple → dark-blue.
    img = Image.new("RGBA", (W, H), (10, 11, 16, 255))
    px = img.load()
    for x in range(W):
        t = x / W
        r = int(10 + 20 * t)
        g = int(11 + 15 * t)
        b = int(16 + 55 * t)
        for y in range(H):
            # subtle vertical falloff
            fy = 1 - abs((y / H) - 0.5) * 0.3
            px[x, y] = (int(r * fy), int(g * fy), int(b * fy), 255)

    # Star field
    import random
    random.seed(42)
    d = ImageDraw.Draw(img)
    for _ in range(140):
        sx = random.randint(0, W - 1)
        sy = random.randint(0, H - 1)
        rr = random.uniform(0.6, 2.2)
        a = int(random.uniform(90, 220))
        hue = random.choice([(255, 255, 255), (0, 229, 255), (178, 102, 255)])
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(*hue, a))

    # Loop glyph on the left (transparent overlay so it composites over the bg)
    glyph_size = 380
    glyph = draw_loop_glyph(glyph_size, transparent_bg=True, glow_boost=1.3)
    gx = 60
    gy = (H - glyph_size) // 2
    img.alpha_composite(glyph, (gx, gy))

    # Right-side wordmark + tagline
    font_big = _load_font(76, bold=True)
    font_med = _load_font(76, bold=True)
    font_small = _load_font(22, bold=True)
    font_tiny = _load_font(18, bold=False)

    tx = 500
    d.text((tx, 130), "TIME LOOP", font=font_big, fill=(255, 255, 255, 240))
    d.text((tx, 210), "ESCAPE", font=font_med, fill=CYAN)
    d.text(
        (tx, 305),
        "8 WORLDS · 100 PUZZLES",
        font=font_small,
        fill=(180, 190, 210, 230),
    )
    d.text(
        (tx, 340),
        "Rewind time. Cooperate with your echoes.",
        font=font_tiny,
        fill=(140, 150, 180, 230),
    )
    d.text(
        (tx, 365),
        "A neon puzzle platformer.",
        font=font_tiny,
        fill=(140, 150, 180, 230),
    )

    # Cyan accent bar bottom-left
    d.rectangle([0, H - 4, W, H], fill=CYAN)

    return img


def make_promo_banner():
    """Compact promotional banner (1200 × 300) — same treatment but wider."""
    W, H = 1200, 300
    img = Image.new("RGBA", (W, H), (10, 11, 16, 255))
    px = img.load()
    for x in range(W):
        t = x / W
        r = int(10 + 22 * t)
        g = int(11 + 16 * t)
        b = int(16 + 60 * t)
        for y in range(H):
            fy = 1 - abs((y / H) - 0.5) * 0.3
            px[x, y] = (int(r * fy), int(g * fy), int(b * fy), 255)
    import random
    random.seed(84)
    d = ImageDraw.Draw(img)
    for _ in range(80):
        sx = random.randint(0, W - 1)
        sy = random.randint(0, H - 1)
        rr = random.uniform(0.6, 2.0)
        a = int(random.uniform(90, 220))
        hue = random.choice([(255, 255, 255), (0, 229, 255), (178, 102, 255)])
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(*hue, a))
    gs = 220
    glyph = draw_loop_glyph(gs, transparent_bg=True, glow_boost=1.2)
    img.alpha_composite(glyph, (40, (H - gs) // 2))
    big = _load_font(60, bold=True)
    sml = _load_font(20, bold=False)
    d.text((320, 80), "TIME LOOP ESCAPE", font=big, fill=(255, 255, 255, 240))
    d.text((320, 155), "REWIND. COOPERATE. ESCAPE.", font=sml, fill=CYAN)
    d.text((320, 190), "8 worlds · 100 handcrafted puzzles", font=sml, fill=(150, 160, 190, 220))
    d.rectangle([0, H - 3, W, H], fill=CYAN)
    return img


# ---------- main ----------

if __name__ == "__main__":
    import os
    out_dir = "/app/frontend/assets/images"
    store_dir = "/app/frontend/store"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(store_dir, exist_ok=True)

    print("Generating icon.png…")
    make_icon().save(f"{out_dir}/icon.png", "PNG", optimize=True)
    print("Generating adaptive-icon.png…")
    make_adaptive_icon_foreground().save(f"{out_dir}/adaptive-icon.png", "PNG", optimize=True)
    print("Generating splash-image.png…")
    make_splash().save(f"{out_dir}/splash-image.png", "PNG", optimize=True)
    print("Generating favicon.png…")
    make_favicon().save(f"{out_dir}/favicon.png", "PNG", optimize=True)
    print("Generating feature-graphic.png (Play Store 1024x500)…")
    make_feature_graphic().save(f"{store_dir}/feature-graphic.png", "PNG", optimize=True)
    print("Generating promo-banner.png (1200x300)…")
    make_promo_banner().save(f"{store_dir}/promo-banner.png", "PNG", optimize=True)
    # Also emit a 512x512 icon variant for Play Store listing.
    print("Generating icon-512.png (Play Store)…")
    make_icon().resize((512, 512), Image.LANCZOS).save(
        f"{store_dir}/icon-512.png", "PNG", optimize=True
    )
    print("Done.")
