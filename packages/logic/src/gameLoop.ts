/**
 * @module GameLoop
 * @description The deterministic per-turn tick.
 *
 * This module delegates ALL work to the Systems pipeline.
 * It exists as a stable API surface — Systems may be added/removed
 * from the pipeline without changing this file.
 *
 * MANIFESTO RULE: This file is RIGID. Never add inline logic here.
 * Create a new System file in /systems/ instead.
 */

import type { GameState } from "./types";
import { getAction } from "./core/registry";
import { runSystems } from "./core/systemRunner";

/**
 * Run all end-of-turn systems.
 * Called by stateManager.endTurn() — do not call from actions.
 */
export function tick(state: GameState): GameState {
  return runSystems(state);
}
