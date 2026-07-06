# Time Loop Escape — PRD

## Product Vision
A 2.5D puzzle platformer for mobile (Android-first) where every level lasts 10 seconds. When the timer hits zero — or the player dies — time rewinds and the run becomes a **Time Echo**: a ghost clone that replays the same button inputs through the same physics.

## Ship Status
* **Phase 1** (Core Mechanics + First Playable) — shipped.
* **Phase 2** (Worlds 2 & 3) — shipped.
* **Phase 3** (Worlds 4 & 5) — shipped.
* **Phase 4** (Worlds 6 & 7) — shipped.
* **Phase 5.1** (Audio pack + Character animations) — shipped.
* **Phase 5.2** (World 8 mechanics + first 5 W8 levels) — shipped.
* **Phase 5.3** (Bulk content push — Worlds 1-4 filled to targets) — shipped.
* **Phase 5.4** (Content push #2 — Worlds 5-7 filled to targets) — shipped.
* **Phase 5.5** (World 8 finish + Boss framework) — shipped. **100/100 levels PASS.**
* **Phase 5.6** (Touch control polish — haptics, dead-zones, one-thumb mode) — shipped.
* **Phase 5.7** (VFX/SFX polish — Skia particles, screen shake, layered SFX) — shipped.
* **Phase 5.8** (Skins + Achievements) — shipped: 6 skin variants + 10 achievements.
* **Phase 5.9 — Production polish pass** — shipped:
  - Grid brightness reduced ~30% (backdrop now recedes so gameplay pops)
  - Spike hazards double-layer red bloom + white inner highlight
  - Landing dust particles (scales with fall speed, hard landings kick shake)
  - Player visual scale 1.35× (collision unchanged → all levels still pass)
  - Button opacity slider (0.4–1.0) + separate Music/SFX toggles
  - Colorblind-safe palette flag stored in save (renderer swap TBD)
  - Animated staggered star reveal on outcome screen
  - Larger, brighter tutorial hint pill
  - Reorganised Settings screen into Audio / Controls / Visuals / Data sections

## Phase 5.5–5.8 additions
* New engine mechanics: `H` boss-locked door — solid until every `B` plate in the level is pressed (persistent across loops).
* World 8 completed: levels 8-6 → 8-16 including mid-boss **The Warden's Gate** (8-8) and final boss **CHRONOS** (8-16).
* Haptics system (`src/game/haptics.ts`) with per-cue profiles (light/medium/heavy impact, selection, success).
* Particle system (`src/game/particles.ts`) — Skia-rendered glow particles for jump dust, portal warp, key pickup, laser death, rewind burst, victory confetti.
* Screen shake on death + rewind (respect toggleable Screen shake setting).
* One-thumb control mode + enlarged hit-slop on all buttons.
* Six robot skin palettes (Prototype, Warden Gold, Verdant Echo, Chrono Wraith, Ember Runner, Chronos Prime) with progression-based unlocks.
* Ten achievements auto-awarded via `recordLevelResult` — First Steps, Learning Time, Gravity Master, Escape Artist, Sharp Reflexes, Time Bender, Chronomancer, Chronos Slain, Perfect Loop, Full Circuit.
* New UI screens: `/skins`, `/achievements`; menu updated with entries.

## Phase 5.2 additions
* New engine mechanics:
  - **Time Rifts** (`R` / `r`) — tiles that toggle solid/passable based on loop parity. `R` is solid on even loops, `r` on odd. Forces multi-loop planning where the same layout is *literally* different geometry between echoes.
  - **Warden Sentries** — patrolling drones defined per level via waypoints + speed. Kill alive actors on contact. Can be **stalled** by dead echo bodies (no combat — cooperative sacrifice mechanic).
  - **Boss Plates** (`B`) — persistent-across-loops trigger plates. Once pressed by any actor in any loop, stays pressed. Foundation for multi-phase boss encounters.
* World 8 · Final Escape (5/16 levels): 8-1 Rift Walker, 8-2 Twin Rifts, 8-3 Warden Patrol, 8-4 Rift and Ruin, 8-5 Rift Locksmith.
* Level Select revamped: scrollable, grouped by world with headered blocks — ready to scale to 100 levels.
* **24/24 levels PASS** automated headless playtest.

## Content shipped
Total: **24 handcrafted levels** across **8 worlds**.

## Phase 5 progress
* Real audio pack via `expo-audio`: 9 SFX (jump/land/rewind/echo/portal/laser/win/die/ui_tap) + 8s synthwave music loop, all bundled locally under `/app/frontend/assets/audio/`. Preloaded at app boot; SFX use `seekTo(0)+play()` on the hot path with zero allocations. Wired into: rewind/echo-create/win/die (already), and new: jump, land, portal, key-pickup, mid-loop laser death, and all UI button taps.
* Character animation frames — Skia vector robot (`character.tsx`) with 8 analytically-derived poses (idle · run · jump · fall · wall_slide · land · victory · dead). Uses monotonic engine tick as animation clock so **Echo animations replay perfectly in phase** with the original run. Includes antenna sway, thruster jets on jump, wall-slide sparks, victory sparkles, dead X eyes.

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

