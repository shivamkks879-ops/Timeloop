# Time Loop Escape — PRD

## Product Vision
A 2.5D puzzle platformer for mobile (Android-first) where every level lasts 10 seconds. When the timer hits zero — or the player dies — time rewinds and the run becomes a **Time Echo**: a ghost clone that replays the same button inputs through the same physics.

## Ship Status
* **Phase 1** (Core Mechanics + First Playable) — shipped.
* **Phase 2** (Worlds 2 & 3) — shipped.
* **Phase 3** (Worlds 4 & 5) — shipped.
* **Phase 4** (Worlds 6 & 7) — shipped.

## Content shipped

### World 1 · Learning Time (5 levels)
1-1 First Steps · 1-2 Leap of Faith · 1-3 High Ground · 1-4 Echo Bridge · 1-5 Two Timing

### World 2 · Lasers (3 levels)
2-1 First Beam · 2-2 Twin Beams · 2-3 Gated Beam

### World 3 · Moving Platforms (3 levels)
3-1 Rolling Bridge · 3-2 Escort Service · 3-3 Full Circle

### World 4 · Gravity Flip (2 levels)
4-1 Upside Down · 4-2 Return Trip
The `~` swirl toggles the actor's gravity direction on contact (with 20-tick cooldown). Physics — gravity, jump velocity, jump-cut, wall slide, ground detection, standing-on-platform — all respect the flipped direction. Echoes replay flips deterministically.

### World 5 · Teleport Portals (2 levels)
5-1 First Warp · 5-2 Portal Bypass
The `1` and `2` tiles form a portal pair. Overlapping either teleports the actor to the paired tile with a 20-tick cooldown to prevent oscillation. Works for the player and echoes alike.

**Total: 15 handcrafted levels**, all validated by the automated playtest harness (S grade + 3 stars every run).

## Engine Features
* Fixed 60 TPS tick-based deterministic engine.
* Player controller: jump buffer, coyote time, variable jump, wall slide, wall jump.
* AABB tile + platform collision with proper edge-inclusive check.
* Lasers: horizontal + vertical beams; alive actors overlapping the beam die; dead echoes stay in place as permanent blockers.
* Moving platforms: waypoint-defined; "always" oscillation or "plate"-triggered; actors carried via `standingOn` delta.
* **Gravity flip**: per-actor `gravityDir` (`1` down / `-1` up); flip tiles + cooldown; ground detection and jump direction respect gravity.
* **Portal teleport**: paired `1`/`2` tiles with cooldown; deterministic across recordings.
* Death mid-loop → converts run into next echo. Game-over only on exhausted echo budget.
* Grading: S / A / B / C based on echoes used vs. `parEchoes` → 3 / 2 / 1 stars.

## Automated Playtest Harness
`node scripts/playtest.js` runs the exact engine with hand-authored solutions per level. All 15 levels currently pass with S grade.

## UI / UX
* Landscape-locked, safe-area aware.
* Neon sci-fi palette; robot visor flips to the top when gravity flips (visual continuity).
* Cyan portal (1) + purple portal (2), cyan/white gravity-flip swirl, purple echoes.
* Main menu, level select (locks + star grades), gameplay HUD, pause / retry / next overlays, settings.
* Touch controls: 68 pt D-pad + 92 pt jump with zero input delay.

## Monetization (STUBBED) & Audio (STUBBED)
Menu bar shows WATCH AD + REMOVE ADS (modal explanations, log/no-op today). `playCue` hooks fire at all game events but produce no sound. Both are ready for polish-phase swap-in without gameplay code changes.

## Modular Architecture
```
src/game/
  constants.ts   ← tuning + palette
  types.ts       ← LevelDef, PlayerState, Laser, MovingPlatformDef, EchoRecording, SaveData
  levels.ts      ← level catalogue (5 worlds so far)
  engine.ts      ← physics + echoes + lasers + platforms + gravity flip + portals
  renderer.tsx   ← Skia layers (tiles → platforms → beams → echoes → player)
  controls.tsx   ← touch input
  hud.tsx        ← in-game overlay
  ads.tsx        ← stubbed AdMob/IAP UI
  save.ts        ← AsyncStorage save/load
  audio.ts       ← Cue-based hook (silent today)
  playtest.ts    ← headless solver + verifier
app/
  index.tsx      ← main menu
  levels.tsx     ← level select
  settings.tsx   ← settings
  game/[id].tsx  ← gameplay screen
```

## Phase 4+ Roadmap
* World 6 Security Factory (keys + locked doors + guard patterns).
* World 7 Time Collapse (many echoes, layered puzzles).
* World 8 Final Escape (mastery combo of all mechanics).
* Real audio pack, character animation frames.
* AdMob SDK + Google Play Billing wiring.
* Cloud save, achievements, unlockable robot skins.
* Fill out 100-level content target.

## Known Limitations
* 15 of 100 target levels shipped; architecture is ready to scale.
* Character sprite is static (no run/jump animation frames yet).
* Audio calls wired but silent.
* AdMob / IAP UI are stubs.

s + locked doors + guard patterns).
* World 7 Time Collapse (many echoes, layered puzzles).
* World 8 Final Escape (mastery combo of all mechanics).
* Real audio pack, character animation frames.
* AdMob SDK + Google Play Billing wiring.
* Cloud save, achievements, unlockable robot skins.
* Fill out 100-level content target.

## Known Limitations
* 15 of 100 target levels shipped; architecture is ready to scale.
* Character sprite is static (no run/jump animation frames yet).
* Audio calls wired but silent.
* AdMob / IAP UI are stubs.

