export const HEX_SIZE = 10;

export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

export function hexToWorld(q: number, r: number): { x: number; z: number } {
  // Flat-top formula — matches rotation.y=π/6 geometry in HexMap (vertices at ±x, flat edges at ±z)
  return {
    x: HEX_SIZE * 1.5 * q,
    z: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  };
}
