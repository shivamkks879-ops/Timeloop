// Lightweight Skia particle system.
//
// Particles are rendered as small glowing circles that fade out over their
// lifetime. All particle state is stored in a module-level array so the
// game loop can push new bursts cheaply from a ref, without triggering
// React re-renders for every spawn.
//
// A render frame passes the current `tick` (monotonically increasing) to
// `getLiveParticles` which returns only the still-alive particles. Dead
// particles are pruned lazily.
//
// This intentionally does NOT participate in the deterministic simulation —
// particles are pure eye candy and can be dropped freely on slow devices.

import { useMemo } from "react";

export interface Particle {
  id: number;
  x: number;              // pixel world coord
  y: number;
  vx: number;             // pixels per tick
  vy: number;
  gravity: number;        // per tick
  bornAt: number;         // frame stamp (ms based)
  life: number;           // ms lifetime
  radius: number;
  color: string;
}

let PARTICLES: Particle[] = [];
let NEXT_ID = 1;
// Reduced from 220 → 120. On phone-sized viewports the difference is
// invisible (particles overlap heavily anyway) but the draw-call count
// drops by ~45%, which keeps 60 FPS solid on mid-range Android.
const MAX_PARTICLES = 120;

export function spawnBurst(opts: {
  x: number;
  y: number;
  color: string;
  count?: number;
  speed?: number;
  life?: number;
  radius?: number;
  gravity?: number;
  spread?: number;   // 0..1 (0 = symmetric ring, 1 = full random)
}) {
  const count = opts.count ?? 12;
  const speed = opts.speed ?? 3.2;
  const life = opts.life ?? 520;
  const radius = opts.radius ?? 3;
  const gravity = opts.gravity ?? 0.25;
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
    const spd = speed * (0.6 + Math.random() * 0.8);
    PARTICLES.push({
      id: NEXT_ID++,
      x: opts.x,
      y: opts.y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      gravity,
      bornAt: now,
      life,
      radius: radius + Math.random() * 1.5,
      color: opts.color,
    });
  }
  if (PARTICLES.length > MAX_PARTICLES) {
    PARTICLES.splice(0, PARTICLES.length - MAX_PARTICLES);
  }
}

export function clearParticles() {
  PARTICLES = [];
}

export function getLiveParticles(now: number): Particle[] {
  const alive: Particle[] = [];
  for (const p of PARTICLES) {
    if (now - p.bornAt < p.life) alive.push(p);
  }
  PARTICLES = alive;
  return alive;
}

// A no-op hook that renderers can call to declare intent; kept for future
// wiring of a subscription model. Currently the renderer just reads from
// `getLiveParticles(Date.now())` each frame.
export function useParticles() {
  return useMemo(() => ({ spawnBurst, clearParticles }), []);
}
