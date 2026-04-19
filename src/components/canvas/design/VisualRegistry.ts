/**
 * @module VisualRegistry
 * @description Maps logical entity types to visual configurations.
 *
 * DESIGN RULE (The "Vibe" Rule):
 *   If an LLM wants to change a unit's look, it must ONLY edit entries
 *   in this file. Never modify React component logic for visual changes.
 *
 * Architecture:
 *   Logical Entity: { type: 'WARRIOR', id: 'u1' }
 *   Visual Manifest: WARRIOR -> { geometry, scale, material, ... }
 */

import type { MaterialPreset } from "./DesignTokens";
import { Materials, Palette } from "./DesignTokens";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GeometryType = "box" | "cylinder" | "cone" | "sphere" | "dodecahedron";

export interface EntityVisualConfig {
  /** Primitive geometry to render. */
  readonly geometry: GeometryType;
  /** Scale [x, y, z] of the geometry. */
  readonly scale: readonly [number, number, number];
  /** Base material preset. Player color overrides `color` at render time. */
  readonly material: MaterialPreset;
  /** Optional material variations for visual diversity. */
  readonly variations?: readonly MaterialPreset[];
  /** Vertical offset above the tile surface. */
  readonly yOffset: number;
}

export interface BuildingVisualConfig {
  readonly geometry: GeometryType;
  readonly scale: readonly [number, number, number];
  readonly material: MaterialPreset;
  readonly yOffset: number;
}

// ─── Unit Visual Registry ────────────────────────────────────────────────────

const unitRegistry: Record<string, EntityVisualConfig> = {
  WARRIOR: {
    geometry: "box",
    scale: [0.35, 0.58, 0.35],
    material: {
      ...Materials.unit,
      color: Palette.compassGold,
    },
    yOffset: 0.40,
  },

  SETTLER: {
    geometry: "cylinder",
    scale: [0.22, 0.52, 0.22],
    material: {
      ...Materials.unit,
      color: Palette.offWhite,
      roughness: 0.7,
    },
    yOffset: 0.40,
  },

  ARCHER: {
    geometry: "cone",
    scale: [0.26, 0.60, 0.26],
    material: {
      ...Materials.unit,
      color: Palette.energyAmber,
    },
    yOffset: 0.44,
  },

  SCOUT: {
    geometry: "sphere",
    scale: [0.26, 0.26, 0.26],
    material: {
      ...Materials.unit,
      color: Palette.dataCyan,
      metalness: 0.3,
    },
    variations: [
      { ...Materials.unit, color: "#00AACC", metalness: 0.3 },
      { ...Materials.unit, color: "#00CCAA", metalness: 0.3 },
    ],
    yOffset: 0.36,
  },
};

// ─── Building / City Visual Registry ─────────────────────────────────────────

const buildingRegistry: Record<string, BuildingVisualConfig> = {
  CITY_CENTER: {
    geometry: "box",
    scale: [0.52, 0.70, 0.52],
    material: {
      ...Materials.building,
      color: Palette.compassGold,
      metalness: 0.3,
    },
    yOffset: 0.38,
  },
};

// ─── Lookup Functions ────────────────────────────────────────────────────────

/** Default fallback visual for unknown unit types. */
const DEFAULT_UNIT_VISUAL: EntityVisualConfig = {
  geometry: "sphere",
  scale: [0.2, 0.2, 0.2],
  material: Materials.unit,
  yOffset: 0.3,
};

const DEFAULT_BUILDING_VISUAL: BuildingVisualConfig = {
  geometry: "box",
  scale: [0.3, 0.3, 0.3],
  material: Materials.building,
  yOffset: 0.25,
};

/** Look up the visual config for a unit type. */
export function getUnitVisual(typeId: string): EntityVisualConfig {
  return unitRegistry[typeId] ?? DEFAULT_UNIT_VISUAL;
}

/** Look up the visual config for a building / city. */
export function getBuildingVisual(buildingId: string): BuildingVisualConfig {
  return buildingRegistry[buildingId] ?? DEFAULT_BUILDING_VISUAL;
}

/**
 * Register a new unit visual at runtime (for vibe-coded extensions).
 * LLMs: Call this to add new unit looks without touching components.
 */
export function registerUnitVisual(
  typeId: string,
  config: EntityVisualConfig
): void {
  unitRegistry[typeId] = config;
}

/**
 * Register a new building visual at runtime.
 */
export function registerBuildingVisual(
  buildingId: string,
  config: BuildingVisualConfig
): void {
  buildingRegistry[buildingId] = config;
}
