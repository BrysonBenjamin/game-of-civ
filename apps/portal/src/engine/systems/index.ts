/**
 * @module Systems
 * @description Pipelines all end-of-turn systems in deterministic order.
 *
 * Systems are the "Rules" of the world — they run automatically.
 * Player Actions (Verbs) MUST NOT import systems directly.
 *
 * To add a new system:
 *   1. Create src/engine/systems/mySystem.ts
 *   2. Export a function: (state: GameState) => GameState
 *   3. Add it to the SYSTEM_PIPELINE array below.
 */

import type { GameState } from "../types";
import { runProductionSystem } from "./productionSystem";
import { runGrowthSystem } from "./growthSystem";
import { runHealingSystem } from "./healingSystem";

/** Ordered list of systems to run at end-of-turn. */
const SYSTEM_PIPELINE: readonly ((state: GameState) => GameState)[] = [
  runProductionSystem,  // 1. Gather yields
  runGrowthSystem,      // 2. Population changes
  runHealingSystem,     // 3. Unit healing
];

/**
 * Run all systems in sequence. Each system receives the output of the previous.
 * This is the ONLY function that gameLoop.ts should call.
 */
export function runSystems(state: GameState): GameState {
  return SYSTEM_PIPELINE.reduce((s, system) => system(s), state);
}
