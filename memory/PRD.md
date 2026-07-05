# Time Loop Escape — PRD

## Product Vision
A 2.5D puzzle platformer for mobile (Android-first) where every level lasts exactly **10 seconds**. When the timer hits zero, time rewinds and the player's previous actions become a **Time Echo** — a ghost clone that replays them. Solving each puzzle means planning cooperation between the live player and one or more past selves.

## Phase 1 — Delivered (this build)

### Gameplay
- Deterministic tick-based engine (60 TPS, 10 s = 600 ticks per loop).
- Player controller with:
  - Jump buffer (7 ticks)
  - Coyote time (7 ticks)
  - Variable jump height (release cuts velocity)
  - Wall slide + wall jump (with 8-tick horizontal lock)
  - Snappy air control, terminal velocity
- Recorded-input echo system: every completed loop becomes a ghost that replays the same button presses through identical physics.
- Interactables: solid walls, spike hazards, pressure plates (walkable), doors (open while any plate is pressed), goal portal.

### Content — World 1 · Learning Time
1. **1-1 First Steps** — pure movement.
2. **1-2 Leap of Faith** — variable jump over a spike pit.
3. **1-3 High Ground** — jump onto a ledge.
4. **1-4 Echo Bridge** — echo holds a plate while player crosses through the door.
5. **1-5 Two Timing** — two doors, both opened by the same held plate.

### UI / UX
- Landscape-locked, safe-area aware.
- **Main menu**: cinematic PLAY / LEVEL SELECT / SETTINGS + stubbed AdMob bar.
- **Level Select**: grid with locks + 1–3 star grades.
- **Gameplay HUD**: neon timer that flashes red under 3 s, echo counter, pause, restart.
- **Touch Controls**: 68 pt left/right D-pad + 92 pt jump button, zero input delay via `onPressIn`/`onPressOut`.
- **Pause**, **Level Complete** (S/A/B/C grade + stars), **Retry**, and **Next** overlays.
- Settings: audio toggle, haptics toggle, reset progress.

### Visuals
- Sci-fi lab palette: cyan primary, purple echoes, deep navy backdrops.
- Skia-rendered game world with rounded chassis + glowing visor character, soft bloom on portals/plates/lasers/echoes.
- Loading + CanvasKit lazy-load on web.

### Monetization (stubbed UI)
- **WATCH AD** (rewarded stub) and **REMOVE ADS** (purchase stub) on the main menu. Both open a modal explaining that real AdMob/IAP is enabled in the release build. `Remove Ads` state is persisted so future levels can respect it.

### Persistence
- `@/src/utils/storage` (AsyncStorage) backed save with per-level completion, best echoes, grade, stars, plus audio/haptics/removeAds prefs.

### Automated Playtest Harness
- `src/game/playtest.ts` runs a hand-authored input script through the exact engine for every level, verifying:
  - Reachable goal
  - No softlocks
  - Echo synchronization (recorded inputs replay identically)
  - Loop timer sanity (loop ends at exactly `LOOP_TICKS`)
  - Grade + star calculation
- Runnable via `node scripts/playtest.js`. All 5 levels currently pass with S grade + 3 stars.

## Modular Architecture (ready for Phase 2+)
```
src/game/
  constants.ts   ← physics tuning, color palette, LOOP_TICKS, MAX_ECHOES
  types.ts       ← LevelDef, PlayerState, EchoRecording, SaveData
  levels.ts      ← level catalogue (add Worlds 2–8 here)
  engine.ts      ← deterministic tick-based physics + echo playback
  renderer.tsx   ← Skia canvas (add new tile types → new draw paths here)
  controls.tsx   ← touch layout (swap for gamepad/keyboard here)
  hud.tsx        ← in-game overlay
  ads.tsx        ← stubbed AdMob/IAP UI (swap in real SDK later)
  save.ts        ← AsyncStorage save/load
  audio.ts       ← Cue-based hook (silent stubs today, real assets later)
  playtest.ts    ← headless solver + verifier
app/
  index.tsx      ← main menu
  levels.tsx     ← level select
  settings.tsx   ← settings
  game/[id].tsx  ← gameplay screen
```

New mechanics (lasers, moving platforms, gravity flip, portals, keys, multi-echoes) are additive: define a new tile char in `types.ts`, handle it in `engine.ts` (collision/effect) and `renderer.tsx` (draw), add levels in `levels.ts`, add a `SOLUTIONS` script in `playtest.ts`.

## Phase 2+ Roadmap (not shipped yet)
- World 2 Lasers, World 3 Moving Platforms, World 4 Gravity Flip, World 5 Teleportation, World 6 Security Factory, World 7 Time Collapse, Final World.
- Real audio pack, replacing `playCue` stubs.
- AdMob SDK + Google Play Billing (Remove Ads IAP).
- Cloud save (Google Play Games / Firebase).
- Achievements + skins.
- Character animation frames (currently static robot).
- Full onboarding + settings depth (accessibility, control layout).

## Known Limitations of Phase 1
- Character sprite is static — no run/jump/fall animation frames yet (planned for polish phase).
- Audio calls are wired but silent (`src/game/audio.ts` `playCue` is intentionally a stub).
- AdMob / IAP flows are UI-only stubs — they log/no-op today.
- 5 levels of 1 world (out of the 100/8-worlds target). Architecture is ready to scale.
