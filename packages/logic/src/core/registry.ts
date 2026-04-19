/**
 * @module ActionRegistry
 * @description Central registry mapping Command types to GameAction handlers.
 *
 * To register a new action:
 *   1. Create src/engine/actions/MyAction.ts following the GameAction template.
 *   2. Import and add it to this registry.
 *   3. Add the Command variant to types.ts.
 *
 * The stateManager uses this registry instead of a switch statement,
 * making it trivial for LLMs to extend.
 */

import type { GameAction, Command } from "../types";
import { MoveAction } from "../movement/move";
import { FoundCityAction } from "../economy/foundCity";
import { AttackAction } from "../combat/attack";
import { BuildImprovementAction } from "../economy/buildImprovement";
import { AddTagAction } from "./addTag";
import { SetGlobalModifierAction } from "./setGlobalModifier";

/**
 * The Action Registry.
 *
 * Maps each Command["type"] string to its GameAction handler.
 * END_TURN is intentionally excluded — it is a meta-action handled
 * directly by the stateManager (it triggers Systems, not a player action).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, GameAction<any>> = {
  MOVE_UNIT: MoveAction,
  FOUND_CITY: FoundCityAction,
  ATTACK: AttackAction,
  BUILD_IMPROVEMENT: BuildImprovementAction,
  ADD_TAG: AddTagAction,
  SET_GLOBAL_MODIFIER: SetGlobalModifierAction,
};

/** Look up a registered action by command type. Returns undefined for END_TURN. */
export function getAction(
  commandType: Command["type"]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): GameAction<any> | undefined {
  return registry[commandType];
}

/** List all registered action IDs. */
export function listActions(): string[] {
  return Object.keys(registry);
}

/**
 * Register a new action at runtime (for modding / vibe-coded extensions).
 */
export function registerAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: GameAction<any>
): void {
  registry[action.id] = action;
}
