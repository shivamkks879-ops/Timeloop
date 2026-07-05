// Skia-based renderer for the game world.
//
// Layers (bottom → top):
//   1. Sky gradient + optional low-time vignette
//   2. Level backdrop wash
//   3. Static tiles (solids, spikes, plates, doors, goal, emitters)
//   4. Moving platforms
//   5. Laser beams
//   6. Echoes (semi-transparent purple ghosts, dead ones dimmer)
//   7. Player robot

import React, { useMemo, useRef } from "react";
import {
  Canvas, Group, Rect, RoundedRect, Circle, Path, Skia,
  Blur, vec, LinearGradient,
} from "@shopify/react-native-skia";

import { COLORS, SIM } from "./constants";
import type { EngineState, Actor } from "./engine";
import { PLAYER_W, PLAYER_H } from "./engine";
import { RobotSprite, derivePose, type Pose } from "./character";

interface Props {
  state: EngineState;
  width: number;
  height: number;
  timeLow: boolean;
}

export function GameRenderer({ state, width, height, timeLow }: Props) {
  const worldW = state.width * SIM.TILE;
  const worldH = state.height * SIM.TILE;
  const scale = Math.min(width / worldW, height / worldH);
  const drawW = worldW * scale;
  const drawH = worldH * scale;
  const offX = (width - drawW) / 2;
  const offY = (height - drawH) / 2;

  // Deterministic animation clock — monotonically increases across loops so
  // echo animations replay in phase with the original run.
  const animFrame = state.tick + state.loop * SIM.LOOP_TICKS;

  const tileNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const t = state.tiles[y][x];
        if (t === "." || t === "S") continue;
        const px = x * SIM.TILE;
        const py = y * SIM.TILE;
        if (t === "#") {
          nodes.push(
            <Group key={`s${x},${y}`}>
              <RoundedRect x={px + 1} y={py + 1} width={SIM.TILE - 2} height={SIM.TILE - 2} r={3} color="#1B2030" />
              <RoundedRect x={px + 1} y={py + 1} width={SIM.TILE - 2} height={SIM.TILE - 2} r={3} color={COLORS.cyan} style="stroke" strokeWidth={1} opacity={0.5} />
            </Group>
          );
        } else if (t === "^") {
          const path = Skia.Path.Make();
          path.moveTo(px, py + SIM.TILE);
          path.lineTo(px + SIM.TILE / 4, py + SIM.TILE / 2);
          path.lineTo(px + SIM.TILE / 2, py + SIM.TILE);
          path.lineTo(px + (SIM.TILE * 3) / 4, py + SIM.TILE / 2);
          path.lineTo(px + SIM.TILE, py + SIM.TILE);
          path.close();
          nodes.push(
            <Group key={`sp${x},${y}`}>
              <Path path={path} color={COLORS.red} />
              <Path path={path} color={COLORS.red} style="stroke" strokeWidth={1.5}>
                <Blur blur={2} />
              </Path>
            </Group>
          );
        } else if (t === "G") {
          nodes.push(
            <Group key={`g${x},${y}`}>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 2 - 2} color={COLORS.cyan} style="stroke" strokeWidth={2}>
                <Blur blur={3} />
              </Circle>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 4} color={COLORS.white} opacity={0.85}>
                <Blur blur={4} />
              </Circle>
            </Group>
          );
        } else if (t === "P") {
          const pressed = state.platesPressed.has(`${x},${y}`);
          nodes.push(
            <Group key={`p${x},${y}`}>
              <RoundedRect x={px + 1} y={py + 1} width={SIM.TILE - 2} height={SIM.TILE - 2} r={3} color="#1B2030" />
              <RoundedRect
                x={px + 2}
                y={pressed ? py + SIM.TILE - 6 : py + SIM.TILE - 10}
                width={SIM.TILE - 4}
                height={pressed ? 4 : 8}
                r={2}
                color={pressed ? COLORS.green : COLORS.cyan}
              >
                <Blur blur={pressed ? 4 : 2} />
              </RoundedRect>
            </Group>
          );
        } else if (t === "D") {
          const open = state.platesPressed.size > 0;
          nodes.push(
            <Group key={`d${x},${y}`} opacity={open ? 0.18 : 1}>
              <Rect x={px + 6} y={py} width={SIM.TILE - 12} height={SIM.TILE} color={COLORS.purple}>
                <Blur blur={open ? 6 : 2} />
              </Rect>
              <Rect x={px + 10} y={py + 2} width={SIM.TILE - 20} height={SIM.TILE - 4} color={COLORS.white} opacity={0.35} />
            </Group>
          );
        } else if (t === "<" || t === ">" || t === "n" || t === "v") {
          // Laser emitter: dark box with a glowing eye pointing in its direction.
          const eyeSize = 8;
          let ex = px + SIM.TILE / 2 - eyeSize / 2;
          let ey = py + SIM.TILE / 2 - eyeSize / 2;
          if (t === "<") ex = px + 2;
          if (t === ">") ex = px + SIM.TILE - eyeSize - 2;
          if (t === "n") ey = py + 2;
          if (t === "v") ey = py + SIM.TILE - eyeSize - 2;
          nodes.push(
            <Group key={`e${x},${y}`}>
              <RoundedRect x={px + 2} y={py + 2} width={SIM.TILE - 4} height={SIM.TILE - 4} r={4} color="#2A0A18" />
              <RoundedRect x={px + 2} y={py + 2} width={SIM.TILE - 4} height={SIM.TILE - 4} r={4} color={COLORS.red} style="stroke" strokeWidth={1.5} opacity={0.55} />
              <Rect x={ex} y={ey} width={eyeSize} height={eyeSize} color={COLORS.red}>
                <Blur blur={3} />
              </Rect>
            </Group>
          );
        } else if (t === "~") {
          // Gravity-flip swirl: soft cyan/purple orb.
          nodes.push(
            <Group key={`f${x},${y}`}>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 2 - 4} color={COLORS.purple} opacity={0.35}>
                <Blur blur={6} />
              </Circle>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 3} color={COLORS.cyan} style="stroke" strokeWidth={2} />
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={4} color={COLORS.white} />
            </Group>
          );
        } else if (t === "1" || t === "2") {
          // Portals: cyan (1) / purple (2) glowing rings.
          const ringColor = t === "1" ? COLORS.cyan : COLORS.purple;
          nodes.push(
            <Group key={`t${x},${y}`}>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 2 - 2} color={ringColor} opacity={0.3}>
                <Blur blur={6} />
              </Circle>
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 2 - 4} color={ringColor} style="stroke" strokeWidth={2.5} />
              <Circle cx={px + SIM.TILE / 2} cy={py + SIM.TILE / 2} r={SIM.TILE / 4} color={ringColor} opacity={0.5}>
                <Blur blur={3} />
              </Circle>
            </Group>
          );
        } else if (t === "k") {
          // Golden key
          const cxk = px + SIM.TILE / 2;
          const cyk = py + SIM.TILE / 2;
          nodes.push(
            <Group key={`k${x},${y}`}>
              <Circle cx={cxk} cy={cyk} r={SIM.TILE / 2 - 6} color={COLORS.green} opacity={0.3}>
                <Blur blur={6} />
              </Circle>
              <Circle cx={cxk - 4} cy={cyk - 2} r={5} color={COLORS.green} style="stroke" strokeWidth={2} />
              <Rect x={cxk - 1} y={cyk - 2} width={9} height={2} color={COLORS.green} />
              <Rect x={cxk + 5} y={cyk} width={3} height={3} color={COLORS.green} />
            </Group>
          );
        } else if (t === "L") {
          const unlocked = state.keyCollected;
          nodes.push(
            <Group key={`ld${x},${y}`} opacity={unlocked ? 0.2 : 1}>
              <Rect x={px + 6} y={py} width={SIM.TILE - 12} height={SIM.TILE} color={COLORS.green}>
                <Blur blur={unlocked ? 6 : 2} />
              </Rect>
              <Rect x={px + 10} y={py + 2} width={SIM.TILE - 20} height={SIM.TILE - 4} color={COLORS.white} opacity={0.35} />
            </Group>
          );
        }
      }
    }
    return nodes;
  }, [state.tiles, state.height, state.width, state.platesPressed, state.keyCollected]);

  const platformNodes = state.platforms.map((p) => (
    <Group key={p.def.id}>
      <RoundedRect x={p.px + 1} y={p.py + 1} width={p.pw - 2} height={p.ph - 2} r={4} color="#141E38" />
      <RoundedRect x={p.px + 1} y={p.py + 1} width={p.pw - 2} height={p.ph - 2} r={4} color={COLORS.cyan} style="stroke" strokeWidth={1.5} opacity={0.75}>
        <Blur blur={2} />
      </RoundedRect>
      <Rect x={p.px + 4} y={p.py + 3} width={p.pw - 8} height={2} color={COLORS.cyan} opacity={0.6} />
    </Group>
  ));

  const beamNodes = state.beams.map((b, i) => {
    const isVertical = b.x1 === b.x2;
    const bx = Math.min(b.x1, b.x2) - (isVertical ? 3 : 0);
    const by = Math.min(b.y1, b.y2) - (isVertical ? 0 : 3);
    const bw = isVertical ? 6 : Math.abs(b.x2 - b.x1);
    const bh = isVertical ? Math.abs(b.y2 - b.y1) : 6;
    if (bw <= 0 || bh <= 0) return null;
    return (
      <Group key={`b${i}`}>
        <Rect x={bx} y={by} width={bw} height={bh} color={COLORS.red} opacity={0.85} />
        <Rect x={bx - 2} y={by - 2} width={bw + 4} height={bh + 4} color={COLORS.red} opacity={0.35}>
          <Blur blur={6} />
        </Rect>
      </Group>
    );
  });

  const echoes = state.echoes.map((e, i) => {
    const pose = derivePose(e, "playing", -1, animFrame);
    return (
      <RobotSprite
        key={`e${i}`}
        actor={e}
        frame={animFrame + i * 7}
        pose={pose}
        echo
        echoAlive={e.alive}
      />
    );
  });

  // Track landing tick for the "land" squash pose.
  const landRef = useRef<{ ground: boolean; tick: number }>({ ground: true, tick: -100 });
  const wasGround = landRef.current.ground;
  if (!wasGround && state.player.onGround) {
    landRef.current.tick = animFrame;
  }
  landRef.current.ground = state.player.onGround;

  const playerPose: Pose = derivePose(
    state.player,
    state.status,
    landRef.current.tick,
    animFrame,
  );

  return (
    <Canvas style={{ width, height }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={["#0A0B10", "#12142A"]} />
      </Rect>
      {timeLow ? (
        <Rect x={0} y={0} width={width} height={height} color={COLORS.red} opacity={0.08} />
      ) : null}

      <Group transform={[{ translateX: offX }, { translateY: offY }, { scale }]}>
        <Rect x={0} y={0} width={worldW} height={worldH} color="#0E1120" />
        <Rect x={0} y={0} width={worldW} height={worldH} color={COLORS.cyan} opacity={0.03} />
        {tileNodes}
        {platformNodes}
        {beamNodes}
        {echoes}
        <RobotSprite actor={state.player} frame={animFrame} pose={playerPose} />
      </Group>
    </Canvas>
  );
}

function ActorSprite_LEGACY_UNUSED(_props: {
  x: number; y: number; facing: number; color: string; opacity: number; echo?: boolean; flipped?: boolean;
}) {
  return null;
}

// Keep the compiler happy about the Actor import.
void ({} as Actor);
void ActorSprite_LEGACY_UNUSED;
void PLAYER_H;
void PLAYER_W;
