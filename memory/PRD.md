# Time Loop Escape — PRD

## Product Vision
A 2.5D puzzle platformer for mobile (Android-first) where every level lasts 10 seconds. When the timer hits zero — or the player dies — time rewinds and the run becomes a **Time Echo**: a ghost clone that replays the same button inputs through the same physics. Solve each puzzle by planning cooperation between the live player and one or more past selves.

## Ship Status
* **Phase 1** (Core Mechanics + First Playable) — shipped.
* **Phase 2** (Worlds 2 & 3) — shipped.

## Content shipped

### World 1 · Learning Time (5 levels)
1-1 First Steps · 1-2 Leap of Faith · 1-3 High Ground · 1-4 Echo Bridge · 1-5 Two Timing

### World 2 · Lasers (3 levels)
2-1 First Beam · 2-2 Twin Beams · 2-3 Gated Beam
Every alive actor overlapping a beam dies. Corpses (dead echoes) remain in place and continue to block, so the player intentionally sacrifices runs to create permanent shields.

### World 3 · Moving Platforms (3 levels)
3-1 Rolling Bridge (always-oscillating) · 3-2 Escort Service (plate-triggered) · 3-3 Full Circle (plate + door)
Platforms carry any actor whose feet rest on their top surface each tick.

Total: **11 handcrafted levels**, all validated by the automated playtest harness.

## Engine Features
* Fixed 60 TPS tick-based deterministic engine.
* Player controller: jump buffer, coyote time, variable jump, wall slide, wall jump (with input lock).
* AABB tile collision with proper edge-inclusive fix (no more 0.5 px hover on floor).
* Recorded-input echo system with dead-echo persistence.
* Lasers: horizontal + vertical beams, blocked by tiles / platforms / any actor (alive OR dead).
* Moving platforms: waypoint-defined, "always" oscillation or "plate" triggered; actors carried via `standingOn` delta.
* Death mid-loop → converts run into next echo. Only exhausting `maxEchoes` ends the game.
* Grading: S / A / B / C based on echoes used vs. `parEchoes` → 3 / 2 / 1 stars.

## Automated Playtest Harness
`node scripts/playtest.js` runs a hand-authored solution through the exact engine for every level. Verifies:
* Reachable goal (level completable)
* No softlocks (bounded by `maxEchoes`)
* Echo synchronization (recorded inputs replay identically each loop)
* Loop timer sanity (`LOOP_TICKS = 600`)
* Grade + star calculation

Current run: **all 11 levels PASS with S grade + 3 stars.**

## UI / UX
* Landscape-locked (`expo-screen-orientation`), safe-area aware.
* Main menu, level select (with lock + star grades), gameplay HUD (timer, echo counter, pause, restart), pause / retry / next overlays, settings.
* Touch controls: 68 pt D-pad + 92 pt jump, `onPressIn`/`onPressOut` for zero input delay.
* Neon sci-fi look: cyan platforms, purple echoes, red lasers/hazards, white robot with glowing visor.

## Monetization (STUBBED)
`WATCH AD` (rewarded) and `REMOVE ADS` (IAP) live on the menu; they open a modal explaining the release-build behaviour and log/no-op today. `removeAds` state is persisted so post-purchase code paths can be tested.

## Audio (STUBBED / silent)
`playCue(cue)` is called at all the right moments (jump, land, echo create, rewind, portal, laser, win, die, ui tap) but currently no-ops. Real assets swap in during polish without touching gameplay code.

## Persistence
`@/src/utils/storage` (AsyncStorage) backed save with per-level completion, best echoes, grade, stars, plus audio / haptics / removeAds preferences.

## Modular Architecture
```
src/game/
  constants.ts   ← tuning + palette
  types.ts       ← LevelDef, PlayerState, Laser, MovingPlatformDef, EchoRecording, SaveData
  levels.ts      ← level catalogue (add worlds by appending)
  engine.ts      ← physics + echoes + lasers + platforms
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

Adding a new mechanic remains a bounded 4-file change (types + engine + renderer + level + solution) — no legacy rewrites required.

## Phase 3+ Roadmap
* Worlds 4–8 (gravity flip, portals, security factory, time collapse, final escape).
* Real audio pack, character animation frames.
* AdMob SDK + Google Play Billing.
* Cloud save (Google Play Games / Firebase).
* Achievements + unlockable robot skins.
* Full onboarding, accessibility depth, custom control layouts.

## Known Limitations
* 11 of the 100/8-worlds target are shipped. Architecture is ready to scale.
* Character sprite is static (no per-state animation frames yet).
* Audio calls wired but silent.
* AdMob / IAP UI are stubs — release build hookup happens pre-Play-Store.
