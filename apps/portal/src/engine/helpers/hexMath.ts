/**
 * @module HexMath
 * @description Global hex-grid utility library.
 *
 * LLM INSTRUCTIONS: Use these functions instead of writing raw hex math.
 * If you need a hex operation that doesn't exist here, request that a
 * human developer adds it, then use it.
 */

// ─── Core Types (defined here to avoid circular imports) ─────────────────────

/** Axial coordinate system for hex tiles (q + r + s = 0, s is derived). */
export interface HexCoordinate {
  readonly q: number;
  readonly r: number;
}

/** Unique string key from axial coordinates. */
export type HexId = string;

// ─── Coordinate Conversion ───────────────────────────────────────────────────

/** Derive the implicit third cube axis: s = -q - r */
export function hexS(coord: HexCoordinate): number {
  return -coord.q - coord.r;
}

/** Create a unique string key from axial coordinates. */
export function hexKey(coord: HexCoordinate): HexId {
  return `${coord.q},${coord.r}`;
}

/** Parse a HexId string back into axial coordinates. */
export function parseHexKey(key: HexId): HexCoordinate {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

// ─── Direction & Neighbours ──────────────────────────────────────────────────

/** The six axial-direction offsets. */
export const HEX_DIRECTIONS: readonly HexCoordinate[] = [
  { q: +1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: +1 },
  { q: 0, r: -1 },
  { q: +1, r: -1 },
  { q: -1, r: +1 },
];

/** Return the six neighbour HexIds of a coordinate. */
export function hexNeighbours(coord: HexCoordinate): HexId[] {
  return HEX_DIRECTIONS.map((d) =>
    hexKey({ q: coord.q + d.q, r: coord.r + d.r })
  );
}

/** Check if two hex coordinates are adjacent (distance === 1). */
export function isAdjacent(a: HexCoordinate, b: HexCoordinate): boolean {
  return hexDistance(a, b) === 1;
}

// ─── Distance ────────────────────────────────────────────────────────────────

/** Manhattan (cube) distance between two axial hexes. */
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}

// ─── Rings & Areas ───────────────────────────────────────────────────────────

/** Return all HexIds at exactly `radius` distance from `center`. */
export function hexRing(center: HexCoordinate, radius: number): HexId[] {
  if (radius === 0) return [hexKey(center)];

  const results: HexId[] = [];
  // Start at direction 4 (q: +1, r: -1) scaled by radius
  let current: HexCoordinate = {
    q: center.q + HEX_DIRECTIONS[4].q * radius,
    r: center.r + HEX_DIRECTIONS[4].r * radius,
  };

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(hexKey(current));
      current = {
        q: current.q + HEX_DIRECTIONS[i].q,
        r: current.r + HEX_DIRECTIONS[i].r,
      };
    }
  }
  return results;
}

/** Return all HexIds within `radius` distance from `center` (inclusive). */
export function hexArea(center: HexCoordinate, radius: number): HexId[] {
  const results: HexId[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (
      let r = Math.max(-radius, -q - radius);
      r <= Math.min(radius, -q + radius);
      r++
    ) {
      results.push(hexKey({ q: center.q + q, r: center.r + r }));
    }
  }
  return results;
}
