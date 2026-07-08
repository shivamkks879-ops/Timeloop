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


# ==========================================================================
# Tablet screenshots (Google Play requires at least 1 image each for 7-inch
# and 10-inch tablets when targeting tablets). Both sizes MUST have the
# same aspect ratio and long edge ≤ 3840px. We render high-res landscape
# hero images that combine a mock game scene + tagline + branding — this
# ensures the store listing looks polished even before you upload real
# gameplay captures.
# ==========================================================================


def _draw_starfield_bg(img, seed=42, star_count=None, gradient=("dark", "cool")):
    """Fill `img` with the signature deep-space gradient + parallax stars."""
    W, H = img.size
    if star_count is None:
        star_count = int((W * H) / 6000)
    px = img.load()
    for x in range(W):
        t = x / W
        r = int(10 + 22 * t)
        g = int(11 + 15 * t)
        b = int(16 + 58 * t)
        for y in range(H):
            fy = 1 - abs((y / H) - 0.5) * 0.28
            px[x, y] = (int(r * fy), int(g * fy), int(b * fy), 255)
    import random
    random.seed(seed)
    d = ImageDraw.Draw(img)
    for _ in range(star_count):
        sx = random.randint(0, W - 1)
        sy = random.randint(0, H - 1)
        rr = random.uniform(0.7, 2.6)
        a = int(random.uniform(90, 220))
        hue = random.choice([
            (255, 255, 255),
            (0, 229, 255),
            (178, 102, 255),
            (180, 200, 255),
        ])
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=(*hue, a))


def _draw_mock_robot(d, cx, cy, scale=1.0, echo=False, face_right=True):
    """Vector "robot" character consistent with the in-game Skia render.
    `echo=True` draws a semi-transparent purple ghost version."""
    body_main = (240, 245, 255, 255) if not echo else (157, 0, 255, 200)
    body_shade = (74, 84, 104, 255) if not echo else (90, 0, 128, 200)
    visor = (0, 229, 255, 255) if not echo else (224, 160, 255, 200)
    face = 1 if face_right else -1

    def sx(dx):
        return cx + dx * scale * face

    def sy(dy):
        return cy + dy * scale

    def rx(a, b):
        """Return (min, max) after mirror so rectangle coords remain sorted."""
        pa, pb = sx(a), sx(b)
        return (min(pa, pb), max(pa, pb))

    # Ambient glow
    glow_layer = Image.new("RGBA", d._image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    x0, x1 = rx(-24, 24)
    gd.rounded_rectangle(
        [x0, sy(-32), x1, sy(32)],
        radius=int(14 * scale),
        fill=(visor[0], visor[1], visor[2], 60),
    )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=8 * scale))
    d._image.alpha_composite(glow_layer)
    # Legs
    d.line([sx(-8), sy(6), sx(-8), sy(24)], fill=body_shade, width=int(4 * scale))
    d.line([sx(8), sy(6), sx(8), sy(24)], fill=body_shade, width=int(4 * scale))
    # Body
    x0, x1 = rx(-14, 14)
    d.rounded_rectangle(
        [x0, sy(-10), x1, sy(14)],
        radius=int(6 * scale),
        fill=body_main,
    )
    # Visor stripe
    x0, x1 = rx(-12, 12)
    d.rounded_rectangle(
        [x0, sy(-8), x1, sy(12)],
        radius=int(5 * scale),
        outline=visor,
        width=max(1, int(1.5 * scale)),
    )
    # Head
    x0, x1 = rx(-8, 8)
    d.ellipse([x0, sy(-24), x1, sy(-8)], fill=body_main)
    # Facing-side visor sweep
    x0, x1 = rx(-3, 9)
    d.ellipse(
        [x0, sy(-22), x1, sy(-10)],
        fill=(visor[0], visor[1], visor[2], 140),
    )
    # Eye (facing side)
    x0, x1 = rx(1, 7)
    d.rounded_rectangle(
        [x0, sy(-18), x1, sy(-14)],
        radius=int(1.5 * scale),
        fill=(255, 255, 255, 255),
    )
    # Antenna
    d.line([sx(0), sy(-24), sx(3), sy(-32)], fill=visor, width=int(2 * scale))
    x0, x1 = rx(1.5, 4.5)
    d.ellipse([x0, sy(-33.5), x1, sy(-30.5)], fill=visor)


def _draw_mock_tile_row(d, W, floor_y, tile_size=64, gap=2):
    """Draw a strip of game floor tiles across the bottom of the scene."""
    x = 0
    while x < W:
        d.rounded_rectangle(
            [x + gap, floor_y + gap, x + tile_size - gap, floor_y + tile_size - gap],
            radius=6,
            fill=(20, 24, 38, 255),
        )
        d.rounded_rectangle(
            [x + gap, floor_y + gap, x + tile_size - gap, floor_y + tile_size - gap],
            radius=6,
            outline=(0, 229, 255, 80),
            width=2,
        )
        x += tile_size


def _draw_portal(d, cx, cy, r=54, color=CYAN):
    """Neon portal ring — used as the "goal" marker in mock scenes."""
    glow = Image.new("RGBA", d._image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - r - 12, cy - r - 12, cx + r + 12, cy + r + 12],
               outline=(color[0], color[1], color[2], 220), width=8)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=14))
    d._image.alpha_composite(glow)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=6)
    d.ellipse([cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4], fill=(255, 255, 255, 220))


def _draw_spikes(d, x0, y_floor, count=4, size=28):
    """Row of red spike hazards, cluster placed on the floor."""
    for i in range(count):
        x = x0 + i * size
        d.polygon(
            [(x, y_floor), (x + size / 2, y_floor - size), (x + size, y_floor)],
            fill=(255, 0, 60, 255),
        )


def _draw_laser_beam(d, x1, y1, x2, y2, width=8):
    """Horizontal or vertical laser hazard."""
    layer = Image.new("RGBA", d._image.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.line([x1, y1, x2, y2], fill=(255, 0, 60, 220), width=width + 10)
    layer = layer.filter(ImageFilter.GaussianBlur(radius=6))
    d._image.alpha_composite(layer)
    d.line([x1, y1, x2, y2], fill=(255, 0, 60, 255), width=width)


def _draw_hud_pill(d, cx, cy, label, value, color=CYAN, w=220, h=54):
    """Compact HUD-style pill for the top of the screenshot."""
    d.rounded_rectangle(
        [cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2],
        radius=h // 2,
        fill=(22, 24, 36, 220),
        outline=color,
        width=2,
    )
    font_lbl = _load_font(int(h * 0.28), bold=True)
    font_val = _load_font(int(h * 0.45), bold=True)
    d.text((cx - w // 2 + 18, cy - h * 0.42), label, font=font_lbl, fill=(180, 200, 230, 230))
    d.text((cx - w // 2 + 18, cy - h * 0.08), value, font=font_val, fill=color)


def make_tablet_screenshot(W, H, scene_key):
    """Render a single Play Store tablet screenshot.

    `scene_key` picks one of the four hand-composed scenes so the store
    can showcase four distinct game moments per tablet size."""
    img = Image.new("RGBA", (W, H), (10, 11, 16, 255))
    _draw_starfield_bg(img, seed={"loop": 42, "puzzle": 84, "jump": 121, "laser": 200}[scene_key])
    d = ImageDraw.Draw(img)

    # Floor row at the bottom quarter
    tile = int(H * 0.075)
    floor_y = int(H * 0.78)
    _draw_mock_tile_row(d, W, floor_y, tile_size=tile)

    # Compose scene-specific gameplay mock
    center_y = floor_y - int(tile * 0.42)  # feet on tile top
    robot_scale = H / 350

    if scene_key == "loop":
        # Player on the right + trailing purple echoes on the left
        for i, ex in enumerate([W * 0.28, W * 0.42, W * 0.56]):
            _draw_mock_robot(d, ex, center_y - i * 4, scale=robot_scale * 0.85, echo=True)
        _draw_mock_robot(d, W * 0.72, center_y, scale=robot_scale)
        tagline_top = "REWIND TIME"
        tagline_sub = "Create Echoes. Solve impossible puzzles."
    elif scene_key == "puzzle":
        # Player + portal on the right
        _draw_mock_robot(d, W * 0.30, center_y, scale=robot_scale)
        _draw_portal(d, W * 0.72, center_y - tile * 0.2, r=int(H * 0.09))
        tagline_top = "100 HANDCRAFTED PUZZLES"
        tagline_sub = "8 worlds. Boss battles. No fillers."
    elif scene_key == "jump":
        # Player mid-air over spikes
        _draw_spikes(d, int(W * 0.44), floor_y, count=6, size=int(H * 0.045))
        # Player rendered ABOVE the floor to imply a jump
        _draw_mock_robot(d, W * 0.58, center_y - int(H * 0.16), scale=robot_scale)
        _draw_mock_robot(d, W * 0.30, center_y, scale=robot_scale * 0.8, echo=True)
        tagline_top = "PRECISION PLATFORMER"
        tagline_sub = "Deterministic physics. 60 FPS. No luck."
    else:  # laser
        # Player dodging a laser beam
        _draw_laser_beam(d, int(W * 0.08), floor_y - int(H * 0.10),
                         int(W * 0.92), floor_y - int(H * 0.10),
                         width=int(H * 0.014))
        _draw_mock_robot(d, W * 0.28, center_y, scale=robot_scale)
        _draw_mock_robot(d, W * 0.72, center_y, scale=robot_scale, face_right=False)
        tagline_top = "8 WORLDS OF CHAOS"
        tagline_sub = "Lasers. Portals. Gravity flips. Time doors."

    # ----- Title banner + branding -----
    d.rectangle([0, 0, W, int(H * 0.32)], fill=(10, 11, 16, 180))

    # Top-left mini glyph
    gsz = int(H * 0.16)
    glyph = draw_loop_glyph(gsz, transparent_bg=True, glow_boost=1.2)
    img.alpha_composite(glyph, (int(W * 0.03), int(H * 0.04)))

    # TIME LOOP ESCAPE wordmark
    wm_font = _load_font(int(H * 0.075), bold=True)
    sub_font = _load_font(int(H * 0.025), bold=True)
    d.text((int(W * 0.03) + gsz + 20, int(H * 0.06)), "TIME LOOP", font=wm_font,
           fill=(255, 255, 255, 245))
    d.text((int(W * 0.03) + gsz + 20, int(H * 0.06) + int(H * 0.075)), "ESCAPE",
           font=wm_font, fill=CYAN)
    d.text((int(W * 0.03) + gsz + 22, int(H * 0.06) + int(H * 0.16)),
           "A neon puzzle platformer", font=sub_font, fill=(150, 165, 195, 230))

    # HUD pills (top-right) — Timer + Echoes
    _draw_hud_pill(d, int(W * 0.82), int(H * 0.10), "TIME", "7.42s", color=CYAN,
                   w=int(W * 0.15), h=int(H * 0.08))
    _draw_hud_pill(d, int(W * 0.82), int(H * 0.22), "ECHO", "2/5", color=PURPLE,
                   w=int(W * 0.15), h=int(H * 0.08))

    # ----- Centre feature tagline -----
    tag_font = _load_font(int(H * 0.11), bold=True)
    sub_tag_font = _load_font(int(H * 0.033), bold=True)

    # Measure to centre.
    def _text_w(s, font):
        try:
            return d.textbbox((0, 0), s, font=font)[2]
        except Exception:
            return len(s) * font.size // 2

    tag_w = _text_w(tagline_top, tag_font)
    d.text(((W - tag_w) // 2, int(H * 0.40)), tagline_top, font=tag_font,
           fill=(255, 255, 255, 255))
    sub_w = _text_w(tagline_sub, sub_tag_font)
    d.text(((W - sub_w) // 2, int(H * 0.52)), tagline_sub, font=sub_tag_font,
           fill=CYAN)

    # Cyan accent bars top & bottom for a polished neon frame
    d.rectangle([0, 0, W, 4], fill=CYAN)
    d.rectangle([0, H - 5, W, H], fill=CYAN)

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

    # ---- Tablet screenshots ----
    # Play Store spec: 320px min, 3840px max side; 16:9 to 9:16 aspect.
    # We use 1920x1080 (7-inch, landscape) and 2732x2048 (10-inch, landscape)
    # which are the two ratios Google explicitly recommends for tablets.
    scenes = ["loop", "puzzle", "jump", "laser"]
    sizes = {"7in": (1920, 1080), "10in": (2732, 2048)}
    ss_dir = f"{store_dir}/screenshots"
    os.makedirs(ss_dir, exist_ok=True)
    for label, (w, h) in sizes.items():
        for idx, scene in enumerate(scenes, start=1):
            out_path = f"{ss_dir}/tablet-{label}-{idx:02d}-{scene}.png"
            print(f"Generating {out_path} ({w}x{h})…")
            im = make_tablet_screenshot(w, h, scene)
            im.convert("RGB").save(out_path, "PNG", optimize=True)
    print("Done.")
