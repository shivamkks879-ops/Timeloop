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
    # Try a bundled font, fall back to default.
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            int(size * size_frac),
        )
    except Exception:
        font = ImageFont.load_default()
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
    # wordmark
    try:
        font_big = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80
        )
        font_small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34
        )
    except Exception:
        font_big = ImageFont.load_default()
        font_small = ImageFont.load_default()
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


# ---------- main ----------

if __name__ == "__main__":
    import os
    out_dir = "/app/frontend/assets/images"
    os.makedirs(out_dir, exist_ok=True)

    print("Generating icon.png…")
    make_icon().save(f"{out_dir}/icon.png", "PNG", optimize=True)
    print("Generating adaptive-icon.png…")
    make_adaptive_icon_foreground().save(f"{out_dir}/adaptive-icon.png", "PNG", optimize=True)
    print("Generating splash-image.png…")
    make_splash().save(f"{out_dir}/splash-image.png", "PNG", optimize=True)
    print("Generating favicon.png…")
    make_favicon().save(f"{out_dir}/favicon.png", "PNG", optimize=True)
    print("Done.")
