export const HexConstants = {
  SIZE: 1.0,
  ELEV_SCALE: 1.5,
  WATER_LEVEL: -.1,
  BASE_LAND_ELEV: 100,
  GRID_W: 64,
  GRID_H: 64,
  PLATEAU_FRACTION: 0.7,
  TERRAIN_SUBDIVISIONS: 150,
  TERRAIN_NORMAL_SAMPLE_OFFSET: 0.18,
  TERRAIN_NORMAL_UV_EPSILON: 1 / 2048,
  TACTICAL_GRID_WIDTH: 0.03,
} as const;

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  worldWidth: number;
  worldHeight: number;
  mapWidth: number;
  mapHeight: number;
}

// Computes the world-space bounding box of the hex grid using the same
// offset-grid layout as the standalone sandbox generator in App.tsx.
export function computeWorldBounds(width: number, height: number): WorldBounds {
  const SIZE = HexConstants.SIZE;
  const SQRT3 = Math.sqrt(3);
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let row = 0; row < height; row++) {
    const qOffset = Math.floor(row / 2);
    for (let col = -qOffset; col < width - qOffset; col++) {
      const q = col;
      const r = row;
      const x = 1.5 * q * SIZE;
      const z = SQRT3 * (r + q / 2) * SIZE;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  // Add one hex-radius of margin on each side so edge tiles are not clipped
  const margin = HexConstants.SIZE * 1.0;
  minX -= margin; maxX += margin;
  minZ -= margin; maxZ += margin;

  const worldWidth  = maxX - minX;
  const worldHeight = maxZ - minZ;
  return {
    minX, maxX, minZ, maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    worldWidth,
    worldHeight,
    mapWidth: width,
    mapHeight: height,
  };
}

// ─── CPU height sampler ──────────────────────────────────────────────────────
// Mirrors the exact WGSL math in HeightmapCompute.ts so clutter/units can
// read terrain height without a GPU readback.

function _fract(x: number): number { return x - Math.floor(x); }

function _hash(px: number, py: number): [number, number] {
  const p2x = px * 127.1 + py * 311.7;
  const p2y = px * 269.5 + py * 183.3;
  return [
    -1 + 2 * _fract(Math.sin(p2x) * 43758.5453123),
    -1 + 2 * _fract(Math.sin(p2y) * 43758.5453123),
  ];
}

function _noise2(px: number, py: number): number {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = _fract(px),    fy = _fract(py);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const dot = ([hx, hy]: [number, number], ax: number, ay: number) => hx * ax + hy * ay;
  return (
    (1 - uy) * ((1 - ux) * dot(_hash(ix,   iy),   fx,      fy    )
               +     ux  * dot(_hash(ix+1, iy),   fx - 1,  fy    ))
  +      uy  * ((1 - ux) * dot(_hash(ix,   iy+1), fx,      fy - 1)
               +     ux  * dot(_hash(ix+1, iy+1), fx - 1,  fy - 1))
  );
}

function _flatFalloff(dist: number): number {
  if (dist < 0.60) return 1.0;
  const t = (dist - 0.60) / 0.40;
  return 1.0 - t * t * (3.0 - 2.0 * t);
}

// Returns terrain Y in world units (same as GPU vertex displacement).
// worldX / worldZ are Three.js world-space coordinates.
export function sampleHeightCPU(worldX: number, worldZ: number): number {
  const SIZE  = HexConstants.SIZE;
  const SQRT3 = Math.sqrt(3);
  const q = (2 / 3 * worldX) / SIZE;
  const r = (SQRT3 / 3 * worldZ - 1 / 3 * worldX) / SIZE;
  const u = (q + 128) / 256;
  const v = (r + 128) / 256;
  const cx = u * 256;
  const cy = v * 256;
  const dist = Math.hypot(u - 0.5, v - 0.5) * 2;
  const baseLayer = _flatFalloff(dist);
  const bump = _noise2(cx * 0.08, cy * 0.08) * 0.12;
  return Math.min(1.0, baseLayer + bump) * HexConstants.ELEV_SCALE;
}
