/**
 * @module Economy
 * @description Standardized resource check and mutation helpers.
 *
 * LLM INSTRUCTIONS: Use these functions for any treasury operations.
 * Never manually compare or subtract resource fields.
 */

import type { Player, Treasury, YieldModifier } from "../types";

/** Check whether a player can afford a given cost. */
export function canAfford(
  player: Player,
  cost: Partial<Treasury>
): boolean {
  if (cost.matter && player.treasury.matter < cost.matter) return false;
  if (cost.energy && player.treasury.energy < cost.energy) return false;
  if (cost.data && player.treasury.data < cost.data) return false;
  if (cost.credits && player.treasury.credits < cost.credits) return false;
  return true;
}

/** Deduct a cost from a player's treasury. Returns the updated Player. */
export function deductCost(
  player: Player,
  cost: Partial<Treasury>
): Player {
  return {
    ...player,
    treasury: {
      matter: player.treasury.matter - (cost.matter ?? 0),
      energy: player.treasury.energy - (cost.energy ?? 0),
      data: player.treasury.data - (cost.data ?? 0),
      credits: player.treasury.credits - (cost.credits ?? 0),
    },
  };
}

/** Add yield values to a player's treasury. Returns the updated Player. */
export function addYield(
  player: Player,
  yields: YieldModifier
): Player {
  return {
    ...player,
    treasury: {
      matter: Math.max(0, player.treasury.matter + yields.matter),
      energy: Math.max(0, player.treasury.energy + yields.energy),
      data: Math.max(0, player.treasury.data + yields.data),
      credits: Math.max(0, player.treasury.credits + yields.credits),
    },
  };
}

/** Sum two YieldModifiers together. */
export function sumYields(a: YieldModifier, b: YieldModifier): YieldModifier {
  return {
    matter: a.matter + b.matter,
    energy: a.energy + b.energy,
    data: a.data + b.data,
    credits: a.credits + b.credits,
  };
}

/** Scale a YieldModifier by a multiplier. */
export function scaleYields(
  yields: YieldModifier,
  multiplier: number
): YieldModifier {
  return {
    matter: Math.floor(yields.matter * multiplier),
    energy: Math.floor(yields.energy * multiplier),
    data: Math.floor(yields.data * multiplier),
    credits: Math.floor(yields.credits * multiplier),
  };
}
