/**
 * @file src/engine/actions/buildImprovement.ts
 * @description Player Action: Place an improvement on an owned tile.
 *
 * LLM INSTRUCTIONS: Use Economy helpers for any cost checks.
 */

import type { GameAction, BuildImprovementCommand, Improvement, YieldModifier, ImprovementType } from "../types";
import { ZERO_YIELD, getActivePlayer } from "../types";

const IMPROVEMENT_YIELDS: Record<ImprovementType, YieldModifier> = {
  farm:         { matter: 2, energy: 0, data: 0, credits: 0 },
  mine:         { matter: 1, energy: 1, data: 0, credits: 1 },
  solar_array:  { matter: 0, energy: 3, data: 0, credits: 0 },
  data_hub:     { matter: 0, energy: 0, data: 3, credits: 0 },
  trading_post: { matter: 0, energy: 0, data: 0, credits: 3 },
};

const IMPROVEMENT_HEALTH = 100;

export const BuildImprovementAction: GameAction<BuildImprovementCommand> = {
  id: "BUILD_IMPROVEMENT",

  validate: (state, params) => {
    const tile = state.map[params.hex_id];
    if (!tile) return { valid: false, reason: `Tile ${params.hex_id} not found.` };

    const activePlayer = getActivePlayer(state);
    if (tile.ownerId !== activePlayer.player_id)
      return { valid: false, reason: `Tile is not in your territory.` };
    if (tile.improvement !== null)
      return { valid: false, reason: `Tile already has an improvement.` };
    if (tile.baseTerrain === "ocean")
      return { valid: false, reason: `Cannot improve ocean tiles.` };
    if (tile.feature === "mountains")
      return { valid: false, reason: `Cannot improve mountain tiles.` };

    return { valid: true };
  },

  perform: (state, params) => {
    const tile = state.map[params.hex_id];
    const improvementYields = IMPROVEMENT_YIELDS[params.improvement_type] ?? ZERO_YIELD;

    const newImprovement: Improvement = {
      type: params.improvement_type,
      health: IMPROVEMENT_HEALTH,
      maxHealth: IMPROVEMENT_HEALTH,
      yields: improvementYields,
    };

    const updatedTileYields: YieldModifier = {
      matter: tile.yields.matter + improvementYields.matter,
      energy: tile.yields.energy + improvementYields.energy,
      data: tile.yields.data + improvementYields.data,
      credits: tile.yields.credits + improvementYields.credits,
    };

    return {
      ...state,
      map: {
        ...state.map,
        [params.hex_id]: { ...tile, improvement: newImprovement, yields: updatedTileYields },
      },
      log: [...state.log, `${params.improvement_type} built at ${params.hex_id}.`],
    };
  },
};
