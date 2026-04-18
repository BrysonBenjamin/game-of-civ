export const HEX_SIZE = 10;

export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

export function hexToWorld(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    z: HEX_SIZE * 1.5 * r,
  };
}
