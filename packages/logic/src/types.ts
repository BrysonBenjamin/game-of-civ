// ═══════════════════════════════════════════════════════════════════════════════
// Game of Civ — State Interface
// Aligned to the Game Design Specification (GDS) + Civ-Vibe Manifesto
//
// Layers:
//   1. World   — Hex grid, terrain, improvements
//   2. Entity  — Units (with vibe-string tags) & Cities
//   3. Player  — Treasury, visibility, tech, diplomacy
//   4. Meta    — Turn clock, action history, global modifiers, PRNG seed
//   5. Command — Discriminated union of all state-mutating intents
//   6. Action  — The LLMable GameAction template
//
// Helper Re-exports:
//   Hex utilities are re-exported from helpers/hexMath.ts for convenience.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Re-exports from Shared Packages ─────────────────────────────────────────
// HexId and HexCoordinate are sourced from @civ/types (the canonical shared
// package). All other types defined in @civ/types are also re-exported so that
// every consumer of "@/engine/types" continues to work without path changes.

export type {
  HexId,
  HexCoordinate,
  BaseTerrainType,
  TerrainFeature,
  YieldModifier,
  Unit,
} from "@civ/types";

// Hex utility functions remain in the helper library.
export {
  hexS,
  hexKey,
  parseHexKey,
  hexDistance,
  hexNeighbours,
  isAdjacent,
  hexRing,
  hexArea,
  HEX_DIRECTIONS,
} from "./helpers/hexMath";

// We need these types for use in this file
import type { HexCoordinate, HexId, BaseTerrainType, TerrainFeature, YieldModifier, Unit } from "@civ/types";

// ─── 1. WORLD LAYER ──────────────────────────────────────────────────────────
// BaseTerrainType, TerrainFeature, YieldModifier, and Tile are sourced from
// @civ/types and re-exported above. Only portal-specific extensions live here.

export const ZERO_YIELD: YieldModifier = { matter: 0, energy: 0, data: 0, credits: 0 };

// ── Improvements ─────────────────────────────────────────────────────────────

export type ImprovementType =
  | "farm"
  | "mine"
  | "solar_array"
  | "data_hub"
  | "trading_post";

export interface Improvement {
  readonly type: ImprovementType;
  readonly health: number;
  readonly maxHealth: number;
  readonly yields: YieldModifier;
}

// ── Tile ─────────────────────────────────────────────────────────────────────
// Portal extends the @civ/types Tile: improvement is a rich Improvement object
// rather than a plain string. All portal code uses this version.

export interface Tile {
  readonly hex_id: HexId;
  readonly coord: HexCoordinate;
  readonly baseTerrain: BaseTerrainType;
  readonly feature: TerrainFeature;
  readonly yields: YieldModifier;
  readonly ownerId: string | null;
  readonly improvement: Improvement | null;
  readonly unitIds: string[];
  readonly cityId: string | null;
}

// ─── 2. ENTITY LAYER ─────────────────────────────────────────────────────────
// Unit is sourced from @civ/types and re-exported above.

/** Open-ended unit type identifier (e.g., "WARRIOR", "SETTLER"). */
export type UnitTypeId = string;

/** Template for spawning units. Pure data, no logic. */
export interface UnitTemplate {
  readonly type_id: UnitTypeId;
  readonly max_health: number;
  readonly base_strength: number;
  readonly max_movement: number;
  readonly tags: string[];
}

export const UNIT_TEMPLATES: Record<string, UnitTemplate> = {
  WARRIOR: { type_id: "WARRIOR", max_health: 100, base_strength: 20, max_movement: 2, tags: [] },
  SETTLER: { type_id: "SETTLER", max_health: 50, base_strength: 0, max_movement: 2, tags: [] },
  ARCHER:  { type_id: "ARCHER",  max_health: 80, base_strength: 25, max_movement: 2, tags: ["ranged_attack"] },
  SCOUT:   { type_id: "SCOUT",   max_health: 60, base_strength: 10, max_movement: 3, tags: ["ignores_forest_penalty"] },
};

// ── Cities ───────────────────────────────────────────────────────────────────

export type BuildingId = string;

export interface ProductionQueueItem {
  readonly type_id: string;
  readonly kind: "unit" | "building";
  readonly progress_points: number;
  readonly cost: number;
}

export interface City {
  readonly city_id: string;
  readonly owner_id: string;
  readonly name: string;
  readonly position: HexId;
  readonly population: number;
  readonly production_queue: ProductionQueueItem[];
  readonly territory: HexId[];
  readonly buildings: BuildingId[];
}

// ─── 3. PLAYER LAYER ─────────────────────────────────────────────────────────

export interface Treasury {
  readonly matter: number;
  readonly energy: number;
  readonly data: number;
  readonly credits: number;
}

export type VisibilityState = "unexplored" | "fog_of_war" | "visible";

export interface Player {
  readonly player_id: string;
  readonly name: string;
  readonly color: string;
  readonly isHuman: boolean;
  readonly treasury: Treasury;
  readonly visibility: Record<HexId, VisibilityState>;
  readonly techUnlocks: Record<string, boolean>;
  readonly diplomaticRelations: Record<string, number>;
}

// ─── 4. META LAYER ───────────────────────────────────────────────────────────

export interface ActionRecord {
  readonly turn: number;
  readonly playerId: string;
  readonly command: Command;
}

export type GamePhase = "playing" | "victory" | "defeat";

export interface GameState {
  readonly turn: number;
  readonly activePlayerIndex: number;
  readonly phase: GamePhase;
  readonly players: Player[];
  readonly map: Record<HexId, Tile>;
  readonly units: Unit[];
  readonly cities: City[];
  readonly mapSize: { width: number; height: number };
  readonly actionHistory: ActionRecord[];
  readonly globalModifiers: Record<string, boolean | number>;
  readonly log: string[];
  /**
   * Deterministic PRNG seed. The ONLY source of randomness in the engine.
   * Math.random() is FORBIDDEN. Use helpers/prng.ts instead.
   */
  readonly randomSeed: number;
}

/** Helper to get the active player from state. */
export function getActivePlayer(state: GameState): Player {
  return state.players[state.activePlayerIndex];
}

// ─── 5. COMMANDS (Discriminated Union) ───────────────────────────────────────

export interface MoveUnitCommand {
  readonly type: "MOVE_UNIT";
  readonly unit_id: string;
  readonly target_hex: HexId;
}

export interface FoundCityCommand {
  readonly type: "FOUND_CITY";
  readonly unit_id: string;
  readonly city_name: string;
}

export interface AttackCommand {
  readonly type: "ATTACK";
  readonly attacker_id: string;
  readonly target_id: string;
}

export interface EndTurnCommand {
  readonly type: "END_TURN";
}

export interface BuildImprovementCommand {
  readonly type: "BUILD_IMPROVEMENT";
  readonly hex_id: HexId;
  readonly improvement_type: ImprovementType;
}

export interface AddTagCommand {
  readonly type: "ADD_TAG";
  readonly unit_id: string;
  readonly tag: string;
}

export interface SetGlobalModifierCommand {
  readonly type: "SET_GLOBAL_MODIFIER";
  readonly key: string;
  readonly value: boolean | number;
}

export type Command =
  | MoveUnitCommand
  | FoundCityCommand
  | AttackCommand
  | EndTurnCommand
  | BuildImprovementCommand
  | AddTagCommand
  | SetGlobalModifierCommand;

// ─── 6. GAME ACTION — The LLMable Template ──────────────────────────────────

/**
 * Validation result returned by GameAction.validate().
 * Pre-conditions are checked BEFORE any state mutation.
 */
export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * The standard action template. Every game mechanic exports one of these.
 *
 * LLM INSTRUCTIONS:
 *   1. `id` — must match the Command["type"] string.
 *   2. `validate` — pure logic, no state changes. Return { valid: false, reason } on failure.
 *   3. `perform` — returns a NEW GameState with the mutation applied.
 *      Never import React. Never call Math.random(). Use helpers.
 *
 * @template P — the Command params type (e.g., MoveUnitCommand)
 */
export interface GameAction<P extends { readonly type: string }> {
  readonly id: P["type"];
  readonly validate: (state: GameState, params: P) => ValidationResult;
  readonly perform: (state: GameState, params: P) => GameState;
}
