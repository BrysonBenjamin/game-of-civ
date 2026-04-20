/**
 * @file src/engine/actions/move.ts
 * @description Player Action: Move a unit to an adjacent hex.
 *
 * LLM INSTRUCTIONS: Use HexMath helpers for all coordinate operations.
 * Check tags[] for movement modifiers before calculating cost.
 */

import type { GameAction, MoveUnitCommand, HexId } from "../types";
import { getActivePlayer } from "../types";
import { HexMath } from "../helpers";

export const MoveAction: GameAction<MoveUnitCommand> = {
  id: "MOVE_UNIT",

  // ── PRE-CONDITION ────────────────────────────────────────────────────────
  validate: (state, params) => {
    const unit = state.units.find((u) => u.unit_id === params.unit_id);
    if (!unit) return { valid: false, reason: `Unit ${params.unit_id} not found.` };

    const activePlayer = getActivePlayer(state);
    if (unit.owner_id !== activePlayer.player_id)
      return { valid: false, reason: `Unit does not belong to active player.` };

    // Berserk rush bonus
    let effectiveMovement = unit.movement_remaining;
    if (unit.tags.includes("berserk_rush")) {
      effectiveMovement += (unit.max_health - unit.current_health) / unit.max_health;
    }
    if (effectiveMovement <= 0)
      return { valid: false, reason: `No movement remaining.` };

    const destTile = state.map[params.target_hex];
    if (!destTile)
      return { valid: false, reason: `Destination ${params.target_hex} is off-map.` };

    if (destTile.feature === "mountains")
      return { valid: false, reason: `Mountains are impassable.` };

    if (destTile.baseTerrain === "ocean" && !unit.tags.includes("double_movement_on_water"))
      return { valid: false, reason: `Ocean is impassable without water movement.` };

    const friendlyOnTile = destTile.unitIds.some((uid) => {
      const u = state.units.find((x) => x.unit_id === uid);
      return u && u.owner_id === unit.owner_id;
    });
    if (friendlyOnTile)
      return { valid: false, reason: `Destination occupied by friendly unit.` };

    const originCoord = HexMath.parseHexKey(unit.position);
    const destCoord = HexMath.parseHexKey(params.target_hex);
    if (!HexMath.isAdjacent(originCoord, destCoord))
      return { valid: false, reason: `Destination not adjacent.` };

    return { valid: true };
  },

  // ── EXECUTION ────────────────────────────────────────────────────────────
  perform: (state, params) => {
    const unitIdx = state.units.findIndex((u) => u.unit_id === params.unit_id);
    const unit = state.units[unitIdx];
    const destTile = state.map[params.target_hex];

    // Movement cost calculation
    let moveCost = 1;
    if (destTile.baseTerrain === "ocean" && unit.tags.includes("double_movement_on_water")) {
      moveCost = 0.5;
    }
    if (
      (destTile.feature === "woods" || destTile.feature === "rainforest") &&
      !unit.tags.includes("ignores_forest_penalty")
    ) {
      moveCost = 2;
    }
    if (destTile.feature === "hills") moveCost = 1.5;
    if (destTile.feature === "marsh") moveCost = 2;

    const originHexId = unit.position;
    const updatedUnits = state.units.map((u, i) =>
      i === unitIdx
        ? {
            ...u,
            position: params.target_hex as HexId,
            movement_remaining: Math.max(0, u.movement_remaining - moveCost),
          }
        : u
    );

    const updatedMap = {
      ...state.map,
      [originHexId]: {
        ...state.map[originHexId],
        unitIds: state.map[originHexId].unitIds.filter((id) => id !== unit.unit_id),
      },
      [params.target_hex]: {
        ...destTile,
        unitIds: [...destTile.unitIds, unit.unit_id],
      },
    };

    const destCoord = HexMath.parseHexKey(params.target_hex);
    return {
      ...state,
      units: updatedUnits,
      map: updatedMap,
      log: [...state.log, `${unit.type_id} moved to (${destCoord.q}, ${destCoord.r}).`],
    };
  },
};
