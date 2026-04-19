import type { HexId, Tile } from "@/engine/types";
import { HexConstants } from "../../design/DesignTokens";

// Inverse of axialToWorld for flat-top hexes.
// Returns the nearest HexId in map, or null if out of bounds.
export function worldToHex(x: number, z: number, map: Record<HexId, Tile>): HexId | null {
  const S = HexConstants.SIZE;

  // Fractional axial coordinates
  const fq = (2 / 3) * x / S;
  const fr = (z / S - (Math.sqrt(3) / 2) * fq) / Math.sqrt(3);
  const fs = -fq - fr;

  // Cube-coordinate rounding
  let rq = Math.round(fq);
  let rr = Math.round(fr);
  let rs = Math.round(fs);

  const dq = Math.abs(rq - fq);
  const dr = Math.abs(rr - fr);
  const ds = Math.abs(rs - fs);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // rs not needed for axial

  const hexId = `${rq},${rr}` as HexId;
  return hexId in map ? hexId : null;
}
