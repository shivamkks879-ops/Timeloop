// Skia-based renderer for the game world. Draws:
// - Animated dot-grid background with soft cyan bloom
// - Tiles (solids, doors, plates, spikes, goal portal)
// - Echoes (semi-transparent purple ghosts with trailing tint)
// - Player robot (rounded chassis + glowing visor)
// - Time-remaining flash when timer is low
//
// Camera fits the whole level into the canvas with letterboxing.

import React, { useMemo } from "react";
import {
  Canvas,
  Group,
  Rect,
  RoundedRect,
  Circle,
  Path,
  Skia,
  Blur,
  vec,
  LinearGradient,
} from "@shopify/react-native-skia";

import { COLORS, SIM } from "./constants";
import type { EngineState } from "./engine";
import { PLAYER_W, PLAYER_H } from "./engine";

interface Props {
  state: EngineState;
  width: number;
  height: number;
  timeLow: boolean;
}

export function GameRenderer({ state, width, height, timeLow }: Props) {
  // Compute camera fit
  const worldW = state.width * SIM.TILE;
  const worldH = state.height * SIM.TILE;
  const scale = Math.min(width / worldW, height / worldH);
  const drawW = worldW * scale;
  const drawH = worldH * scale;
  const offX = (width - drawW) / 2;
  const offY = (height - drawH) / 2;

  // Draw tiles once per state change
  const tileNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const t = state.tiles[y][x];
        if (t === ".") continue;
        const px = x * SIM.TILE;
        const py = y * SIM.TILE;
        if (t === "#") {
          nodes.push(
            <Group key={`s${x},${y}`}>
              <RoundedRect
                x={px + 1}
                y={py + 1}
                width={SIM.TILE - 2}
                height={SIM.TILE - 2}
                r={3}
                color="#1B2030"
              />
              <RoundedRect
                x={px + 1}
                y={py + 1}
                width={SIM.TILE - 2}
                height={SIM.TILE - 2}
                r={3}
                color={COLORS.cyan}
                style="stroke"
                strokeWidth={1}
                opacity={0.5}
              />
            </Group>
          );
        } else if (t === "^") {
          // Spikes - triangle path
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
          // Goal portal - cyan ring with pulsing core
          nodes.push(
            <Group key={`g${x},${y}`}>
              <Circle
                cx={px + SIM.TILE / 2}
                cy={py + SIM.TILE / 2}
                r={SIM.TILE / 2 - 2}
                color={COLORS.cyan}
                style="stroke"
                strokeWidth={2}
              >
                <Blur blur={3} />
              </Circle>
              <Circle
                cx={px + SIM.TILE / 2}
                cy={py + SIM.TILE / 2}
                r={SIM.TILE / 4}
                color={COLORS.white}
                opacity={0.85}
              >
                <Blur blur={4} />
              </Circle>
            </Group>
          );
        } else if (t === "P") {
          const pressed = state.platesPressed.has(`${x},${y}`);
          nodes.push(
            <Group key={`p${x},${y}`}>
              <RoundedRect
                x={px + 2}
                y={py + SIM.TILE - 8}
                width={SIM.TILE - 4}
                height={6}
                r={2}
                color={pressed ? COLORS.green : COLORS.cyan}
              >
                <Blur blur={2} />
              </RoundedRect>
              <RoundedRect
                x={px + 2}
                y={py + SIM.TILE - 8}
                width={SIM.TILE - 4}
                height={6}
                r={2}
                color={pressed ? COLORS.green : COLORS.cyan}
                opacity={0.9}
              />
            </Group>
          );
        } else if (t === "D") {
          const open = state.platesPressed.size > 0;
          nodes.push(
            <Group key={`d${x},${y}`} opacity={open ? 0.2 : 1}>
              <Rect x={px + 6} y={py} width={SIM.TILE - 12} height={SIM.TILE} color={COLORS.purple}>
                <Blur blur={open ? 6 : 2} />
              </Rect>
              <Rect x={px + 10} y={py + 2} width={SIM.TILE - 20} height={SIM.TILE - 4} color={COLORS.white} opacity={0.4} />
            </Group>
          );
        }
      }
    }
    return nodes;
  }, [state.tiles, state.height, state.width, state.platesPressed]);

  // Player + echoes
  const echoes = state.echoes.map((e, i) => (
    <ActorSprite key={`e${i}`} x={e.x} y={e.y} facing={e.facing} color={COLORS.purple} opacity={0.55} echo />
  ));

  return (
    <Canvas style={{ width, height }}>
      {/* Background gradient */}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={["#0A0B10", "#12142A"]}
        />
      </Rect>
      {/* Timer-low vignette */}
      {timeLow ? (
        <Rect x={0} y={0} width={width} height={height} color={COLORS.red} opacity={0.08} />
      ) : null}

      {/* World layer - scale + translate */}
      <Group transform={[{ translateX: offX }, { translateY: offY }, { scale }]}>
        {/* Dark grid backdrop */}
        <Rect x={0} y={0} width={worldW} height={worldH} color="#0E1120" />
        <Rect x={0} y={0} width={worldW} height={worldH} color={COLORS.cyan} opacity={0.03} />
        {tileNodes}
        {echoes}
        {state.player.alive ? (
          <ActorSprite
            x={state.player.x}
            y={state.player.y}
            facing={state.player.facing}
            color={COLORS.white}
            opacity={1}
          />
        ) : null}
      </Group>
    </Canvas>
  );
}

function ActorSprite({
  x,
  y,
  facing,
  color,
  opacity,
  echo,
}: {
  x: number;
  y: number;
  facing: number;
  color: string;
  opacity: number;
  echo?: boolean;
}) {
  const w = PLAYER_W;
  const h = PLAYER_H;
  const visorColor = echo ? COLORS.purple : COLORS.cyan;
  return (
    <Group opacity={opacity}>
      {/* Soft outer glow */}
      <RoundedRect x={x - 2} y={y - 2} width={w + 4} height={h + 4} r={10} color={visorColor} opacity={0.25}>
        <Blur blur={6} />
      </RoundedRect>
      {/* Chassis */}
      <RoundedRect x={x} y={y} width={w} height={h} r={8} color={color} />
      {/* Visor */}
      <RoundedRect
        x={x + 3 + (facing > 0 ? 2 : 0)}
        y={y + 6}
        width={w - 6}
        height={8}
        r={3}
        color={visorColor}
      >
        <Blur blur={2} />
      </RoundedRect>
      {/* Foot line */}
      <Rect x={x + 3} y={y + h - 3} width={w - 6} height={2} color="#0A0B10" opacity={0.4} />
    </Group>
  );
}
