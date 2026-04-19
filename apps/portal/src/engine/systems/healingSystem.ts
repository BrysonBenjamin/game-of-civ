/**
 * @module HealingSystem
 * @description Engine System: Unit HP regeneration at end of turn.
 *
 * This is a "Rule" — it runs automatically at end-of-turn.
 * Actions MUST NOT import or call this directly.
 */

import type { GameState, Unit } from "../types";
import { getActivePlayer } from "../types";

const HEAL_PER_TURN = 5;

export function runHealingSystem(state: GameState): GameState {
  const activePlayer = getActivePlayer(state);

  const updatedUnits = state.units.map((unit: Unit) => {
    if (unit.owner_id !== activePlayer.player_id) return unit;
    if (unit.current_health < unit.max_health) {
      const healed = Math.min(unit.max_health, unit.current_health + HEAL_PER_TURN);
      return { ...unit, current_health: healed };
    }
    return unit;
  });

  return { ...state, units: updatedUnits };
}
