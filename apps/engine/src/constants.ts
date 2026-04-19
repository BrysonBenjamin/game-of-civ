export const HexConstants = {
  SIZE: 1.0,
  ELEV_SCALE: 0.5,
  WATER_LEVEL: 0.08,
  BASE_LAND_ELEV: 100
};

// Flat-Top Axial to World Math
export function axialToWorld(q: number, r: number): [number, number] {
  const x = HexConstants.SIZE * (3 / 2) * q;
  const z = HexConstants.SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  return [x, z];
}
