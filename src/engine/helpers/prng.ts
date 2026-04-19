/**
 * @module PRNG
 * @description Deterministic pseudo-random number generator.
 *
 * Math.random() is STRICTLY FORBIDDEN in /src/engine/.
 * All randomness must use this module and thread the nextSeed
 * back into GameState.randomSeed.
 *
 * Algorithm: Mulberry32 — fast, deterministic, 32-bit state.
 */

export interface PRNGResult {
  /** A value in [0, 1). */
  readonly value: number;
  /** The next seed to store in GameState.randomSeed. */
  readonly nextSeed: number;
}

/**
 * Generate the next pseudo-random number from a seed.
 * 
 * Usage:
 * ```ts
 * const { value, nextSeed } = nextRandom(state.randomSeed);
 * // use `value` for your logic
 * // store `nextSeed` in the returned state
 * ```
 */
export function nextRandom(seed: number): PRNGResult {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const raw = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return {
    value: raw,
    nextSeed: (seed + 1) | 0,
  };
}

/**
 * Generate a random integer in [min, max] (inclusive).
 */
export function randomInt(
  seed: number,
  min: number,
  max: number
): { value: number; nextSeed: number } {
  const { value, nextSeed } = nextRandom(seed);
  return {
    value: min + Math.floor(value * (max - min + 1)),
    nextSeed,
  };
}

/**
 * Pick a random element from an array.
 */
export function randomPick<T>(
  seed: number,
  items: readonly T[]
): { value: T; nextSeed: number } {
  const { value, nextSeed } = randomInt(seed, 0, items.length - 1);
  return { value: items[value], nextSeed };
}
