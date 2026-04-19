import * as THREE from "three";
import { noise2, falloff } from "@civ/math";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld } from "../../design/DesignTokens";

export const HEIGHTMAP_SIZE  = 256;
export const ELEV_SCALE      = 0.5;   // world units per full G channel
export const WATER_LEVEL     = 0.08;  // between ocean (0) and land base (0.196)
export const BASE_LAND_ELEV  = 100;   // uint8 base for all non-ocean tiles → 0.196 wu

const FEATURE_ELEVATION_BONUS: Record<string, number> = {
  none:       0,
  woods:      12,
  rainforest: 12,
  marsh:      4,
  hills:      55,
  mountains:  155,  // total = 255, height = 0.5 wu (mountain peak)
  reef:       8,
};

const BIOME_IDS: Record<string, number> = {
  plains:    1,
  grassland: 2,
  tundra:    3,
  desert:    4,
  ocean:     5,
  snow:      6,
};

export interface HeightmapResult {
  texture: THREE.DataTexture;
  data: Uint8Array;
  worldMin: THREE.Vector2;
  worldMax: THREE.Vector2;
}

// Flat with soft edge — stays at 1.0 until 60% then smoothly drops to 0.
// Ensures adjacent land hexes merge into a continuous flat surface.
function flatFalloff(dist: number): number {
  if (dist < 0.60) return 1.0;
  const t = (dist - 0.60) / 0.40;
  return 1 - t * t * (3 - 2 * t);
}

// Standard Gaussian falloff for feature bumps (mountains, hills).
// noise2 and falloff are imported from @civ/math.

export function buildHeightmap(map: Record<HexId, Tile>): HeightmapResult {
  const tiles = Object.values(map);

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const tile of tiles) {
    const [x, , z] = axialToWorld(tile.coord.q, tile.coord.r);
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  const pad = 2;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;

  // RGBA8: R=biomeId, G=elevation(0-255), B=featureId, A=unused
  const data = new Uint8Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE * 4);

  // Voronoi distance tracker for biome ID (nearest tile wins)
  const biomeDistSq = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE).fill(Infinity);

  // ── Pass 1: Wide flat base stamp for all non-ocean tiles ─────────────────
  // Radius large enough that adjacent hexes (≈19 texels apart) are fully in
  // each other's flat zone (< 0.60 × radius), creating continuous flat land.
  const BASE_R = Math.max(10, Math.round((HEIGHTMAP_SIZE / Math.max(rangeX, rangeZ)) * 3.2));

  for (const tile of tiles) {
    if (tile.baseTerrain === "ocean") continue;

    const [wx, , wz] = axialToWorld(tile.coord.q, tile.coord.r);
    const cx = Math.round(((wx - minX) / rangeX) * (HEIGHTMAP_SIZE - 1));
    const cz = Math.round(((wz - minZ) / rangeZ) * (HEIGHTMAP_SIZE - 1));
    const biomeId = BIOME_IDS[tile.baseTerrain] ?? 0;

    for (let dz = -BASE_R; dz <= BASE_R; dz++) {
      for (let dx = -BASE_R; dx <= BASE_R; dx++) {
        const px = cx + dx;
        const pz = cz + dz;
        if (px < 0 || px >= HEIGHTMAP_SIZE || pz < 0 || pz >= HEIGHTMAP_SIZE) continue;

        const distSq = dx * dx + dz * dz;
        const dist   = Math.sqrt(distSq) / BASE_R;
        if (dist > 1.0) continue;

        const w       = flatFalloff(dist);
        const stamped = Math.round(BASE_LAND_ELEV * w);

        const idx = (pz * HEIGHTMAP_SIZE + px) * 4;
        if (stamped > data[idx + 1]) {
          data[idx + 1] = stamped;
        }

        // Voronoi: nearest tile center determines biome ID
        if (distSq < biomeDistSq[pz * HEIGHTMAP_SIZE + px]) {
          biomeDistSq[pz * HEIGHTMAP_SIZE + px] = distSq;
          data[idx] = biomeId;
        }
      }
    }
  }

  // ── Pass 2: Narrow Gaussian feature bumps on top of flat base ────────────
  const FEAT_R = Math.max(5, Math.round((HEIGHTMAP_SIZE / Math.max(rangeX, rangeZ)) * 1.2));

  for (const tile of tiles) {
    if (tile.baseTerrain === "ocean") continue;
    const bonus = FEATURE_ELEVATION_BONUS[tile.feature] ?? 0;
    if (bonus === 0) continue;

    const [wx, , wz] = axialToWorld(tile.coord.q, tile.coord.r);
    const cx = Math.round(((wx - minX) / rangeX) * (HEIGHTMAP_SIZE - 1));
    const cz = Math.round(((wz - minZ) / rangeZ) * (HEIGHTMAP_SIZE - 1));

    for (let dz = -FEAT_R; dz <= FEAT_R; dz++) {
      for (let dx = -FEAT_R; dx <= FEAT_R; dx++) {
        const px = cx + dx;
        const pz = cz + dz;
        if (px < 0 || px >= HEIGHTMAP_SIZE || pz < 0 || pz >= HEIGHTMAP_SIZE) continue;

        const dist = Math.sqrt(dx * dx + dz * dz) / FEAT_R;
        if (dist > 1.0) continue;

        const n       = noise2(px * 0.08, pz * 0.08) * 0.12;
        const w       = falloff(dist + n);
        // Raise from base toward (base + bonus) at center
        const stamped = Math.min(255, Math.round(BASE_LAND_ELEV + bonus * w));

        const idx = (pz * HEIGHTMAP_SIZE + px) * 4;
        if (stamped > data[idx + 1]) {
          data[idx + 1] = stamped;
        }
        // Feature flag in B channel
        if (w > 0.4) data[idx + 2] = 1;
      }
    }
  }

  const texture = new THREE.DataTexture(
    data,
    HEIGHTMAP_SIZE,
    HEIGHTMAP_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.needsUpdate = true;

  return {
    texture,
    data,
    worldMin: new THREE.Vector2(minX, minZ),
    worldMax: new THREE.Vector2(maxX, maxZ),
  };
}

// CPU-side bilinear height lookup — G channel × ELEV_SCALE
export function sampleHeight(wx: number, wz: number, hm: HeightmapResult): number {
  const rangeX = hm.worldMax.x - hm.worldMin.x;
  const rangeZ = hm.worldMax.y - hm.worldMin.y;

  const u = (wx - hm.worldMin.x) / rangeX;
  const v = (wz - hm.worldMin.y) / rangeZ;

  const fx = Math.max(0, Math.min(HEIGHTMAP_SIZE - 1, u * (HEIGHTMAP_SIZE - 1)));
  const fz = Math.max(0, Math.min(HEIGHTMAP_SIZE - 1, v * (HEIGHTMAP_SIZE - 1)));

  const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, HEIGHTMAP_SIZE - 1);
  const z0 = Math.floor(fz), z1 = Math.min(z0 + 1, HEIGHTMAP_SIZE - 1);
  const tx = fx - x0, tz = fz - z0;

  const g00 = hm.data[(z0 * HEIGHTMAP_SIZE + x0) * 4 + 1];
  const g10 = hm.data[(z0 * HEIGHTMAP_SIZE + x1) * 4 + 1];
  const g01 = hm.data[(z1 * HEIGHTMAP_SIZE + x0) * 4 + 1];
  const g11 = hm.data[(z1 * HEIGHTMAP_SIZE + x1) * 4 + 1];

  const g = g00 * (1 - tx) * (1 - tz) + g10 * tx * (1 - tz)
           + g01 * (1 - tx) * tz       + g11 * tx * tz;

  return (g / 255) * ELEV_SCALE;
}
