/**
 * @module DesignTokens
 * @description Global design token foundation for the entire visual layer.
 *
 * DESIGN RULE: All colors, scales, and material settings must be sourced
 * from this file. Never hardcode visual values in components.
 */

import * as THREE from "three";

// ─── Palette ─────────────────────────────────────────────────────────────────

export const Palette = {
  /** Unexplored tile base — aged parchment */
  parchment:     "#F5E6C8",
  /** Parchment shadow — darker aged paper */
  parchmentDark: "#D4C49A",
  /** Ink brown — strokes, borders, headings */
  inkBrown:      "#2C1A0E",
  /** Ocean deep — map blue */
  mapBlue:       "#1A4A7A",
  /** Ocean shallow / hover overlay */
  mapBlueLight:  "#2E6BAA",
  /** Selection, CTA, compass rose — replaces saffron */
  compassGold:   "#C9A227",
  /** Grassland / matter resource */
  mapGreen:      "#4A6A2A",
  /** Combat / danger */
  mapRed:        "#8B2A1A",
  /** Desert / plains accent */
  oliveYellow:   "#A08030",
  /** Snow / offWhite */
  snowWhite:     "#D8E4E8",
  /** Deep shadow — canvas ground */
  abyss:         "#1A1008",
  /** Data — deep teal */
  dataCyan:      "#2A6A8A",
  /** Energy — warm amber */
  energyAmber:   "#C08020",
  /** Matter — forest green */
  matterGreen:   "#3A7030",
  /** Combat — deep crimson */
  combatRose:    "#8B2A1A",
  /** Off-white — secondary text */
  offWhite:      "#EDE0C8",

  /** Player colors — vivid but historically grounded */
  player1: "#2A5AA0",
  player2: "#8B2A1A",
  player3: "#2A7040",
  player4: "#7A4A1A",
} as const;

// ─── UI Scale (Base 4px) ─────────────────────────────────────────────────────

export const UIScale = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

// ─── 3D Material Templates ──────────────────────────────────────────────────

export interface MaterialPreset {
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly flatShading?: boolean;
  readonly transparent?: boolean;
  readonly opacity?: number;
}

export const Materials = {
  unit: {
    color: Palette.compassGold,
    roughness: 0.6,
    metalness: 0.15,
    flatShading: true,
  } satisfies MaterialPreset,

  building: {
    color: Palette.compassGold,
    roughness: 0.5,
    metalness: 0.25,
    flatShading: true,
  } satisfies MaterialPreset,

  tile: {
    color: "#808080",
    roughness: 0.8,
    metalness: 0.0,
    flatShading: true,
  } satisfies MaterialPreset,

  selectionGlow: {
    color: Palette.compassGold,
    roughness: 1.0,
    metalness: 0.0,
    emissive: Palette.compassGold,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.7,
  } satisfies MaterialPreset,

  fog: {
    color: Palette.parchment,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.6,
  } satisfies MaterialPreset,

  pathLine: {
    color: Palette.dataCyan,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.5,
  } satisfies MaterialPreset,
} as const;

// ─── Hex Grid Constants ──────────────────────────────────────────────────────

export const HexConstants = {
  SIZE: 1,
  HEIGHT: 0.2,
  featureElevation: {
    none:       1,
    woods:      1,
    rainforest: 1,
    marsh:      1,
    hills:      2,
    mountains:  3,
    reef:       1,
  } as const,
} as const;

/**
 * Convert axial (q, r) to world-space (x, y, z) for flat-top hexes.
 * Centralized here — import from DesignTokens, not from individual components.
 */
export function axialToWorld(q: number, r: number, y: number = 0): [number, number, number] {
  const x = HexConstants.SIZE * (3 / 2) * q;
  const z = HexConstants.SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, y, z];
}

// ─── Terrain Colors ──────────────────────────────────────────────────────────

import type { BaseTerrainType, TerrainFeature } from "@/engine/types";

export const TerrainColors: Record<BaseTerrainType, string> = {
  plains:    "#8BA850",
  grassland: "#4A8A3A",
  tundra:    "#6A8A78",
  desert:    "#D4A850",
  ocean:     "#1A4A7A",
  snow:      "#C8D8E0",
};

export const FeatureTint: Record<TerrainFeature, string | null> = {
  none:       null,
  woods:      "#2D5A2E",
  rainforest: "#1A4C1A",
  marsh:      "#5B6A4A",
  mountains:  "#5B5B5B",
  hills:      "#988050",
  reef:       "#309080",
};

/** Resolve a tile's display color: feature tint if present, else base terrain. */
export function resolveTileColor(baseTerrain: BaseTerrainType, feature: TerrainFeature): string {
  return FeatureTint[feature] ?? TerrainColors[baseTerrain];
}

/** Get tile elevation based on feature. */
export function tileElevation(feature: TerrainFeature): number {
  return HexConstants.HEIGHT * HexConstants.featureElevation[feature];
}

// ─── Lighting Preset ─────────────────────────────────────────────────────────

export const LightingPreset = {
  // Reduced ambient so directional shadows read clearly
  ambient: { intensity: 0.35 },
  // 35° sun elevation from south-west — deep angled diorama shadows
  directional: {
    position: [10, 8, 3] as [number, number, number],
    intensity: 2.0,
    color: "#FFE8C0",
  },
  // Warm sky, cooler ground — painterly AO-like fill
  hemisphere: { sky: "#B8C8E0", ground: "#7A5A28", intensity: 0.55 },
  fog: { color: "#C8B898", near: 35, far: 70 },
} as const;
