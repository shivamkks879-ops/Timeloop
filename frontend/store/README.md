# Play Store Assets — Time Loop Escape

All Play Store submission assets live in this directory.

## Included files
| File | Purpose | Dimensions |
|------|---------|-----------|
| `feature-graphic.png` | Play Store Feature Graphic | 1024 × 500 |
| `promo-banner.png` | Cross-promo banner | 1200 × 300 |
| `icon-512.png` | Play Store hi-res icon | 512 × 512 |
| `STORE_LISTING.md` | App title, descriptions, keywords, category |
| `RELEASE_NOTES.md` | v1.0.0 "What's New" copy |
| `PRIVACY.md` | Privacy policy (host this on your website) |
| `TERMS.md` | Terms & Conditions (host this on your website) |

## App icons in-app
`assets/images/icon.png` — 1024 × 1024 main icon
`assets/images/adaptive-icon.png` — 1024 × 1024 Android adaptive foreground
`assets/images/splash-image.png` — 1242 × 1242 splash artwork
`assets/images/favicon.png` — 48 × 48 web favicon

## Regenerating all assets
```bash
cd /app/frontend
python3 scripts/gen-branding.py
```

This regenerates every icon + banner + splash in a single pass from the
Python-Skia branding script (`scripts/gen-branding.py`).

## Screenshots
Live phone / tablet screenshots must be captured **on the built APK**
after installing on a real device. The Play Store requires:
- **2 – 8 phone screenshots** at 1080 × 1920 (portrait) or 1920 × 1080 (landscape).
  This game is landscape-only so use 1920 × 1080.
- **1 – 8 7-inch tablet screenshots** at 1200 × 1920 or 1920 × 1200.
- **1 – 8 10-inch tablet screenshots** at 1600 × 2560 or 2560 × 1600.

Recommended shots (all landscape):
1. Main menu — the hero card with the 100 LEVELS badge.
2. Gameplay level 1-1 (First Steps) — clean tutorial layout.
3. Portal / gravity level (e.g. 5-1) — showcasing mechanics variety.
4. Final boss (8-16 · CHRONOS) — the endgame teaser.
5. Level Select — grid grouped by world.
6. Skins gallery — 6 unlockable robot skins.
7. Achievements — 10 collectible goals.
8. Statistics — lifetime metrics dashboard.

Capture these on device via **Volume-Down + Power** (Android) once you
install the release APK from the Emergent Publish build.
