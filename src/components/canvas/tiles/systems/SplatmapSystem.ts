import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld, TerrainColors } from "../../design/DesignTokens";
import { hexNeighbours, parseHexKey } from "@/engine/helpers/hexMath";

const TEXTURE_SIZE = 256;

// Three-biome blend per tile: packed into a DataTexture
// R8G8B8A8: [biome0Id, biome1Id, weight01, weight02]
// Normalized weights: w0 = 1 - w01 - w02, clamped in shader

export interface SplatmapResult {
  texture: THREE.DataTexture;
  worldMin: THREE.Vector2;
  worldMax: THREE.Vector2;
}

// Seeded noise for edge perturbation
function noise2(x: number, y: number): number {
  return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Encode biome name to uint8 ID (must match shader decode)
const BIOME_ENCODE: Record<string, number> = {
  plains: 1, grassland: 2, tundra: 3, desert: 4, ocean: 5, snow: 6,
};

export function buildSplatmap(map: Record<HexId, Tile>): SplatmapResult {
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

  // RGBA: R=biome0Id, G=biome1Id, B=w1(0-255), A=w2(0-255)
  // w0 = 1 - w1 - w2 (reconstructed in shader)
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  // Build world-pos index for fast neighbor lookup
  const worldPos = new Map<HexId, [number, number]>();
  for (const tile of tiles) {
    const [x, , z] = axialToWorld(tile.coord.q, tile.coord.r);
    worldPos.set(tile.hex_id, [x, z]);
  }

  for (const tile of tiles) {
    const [wx, , wz] = axialToWorld(tile.coord.q, tile.coord.r);
    const cx = Math.round(((wx - minX) / rangeX) * (TEXTURE_SIZE - 1));
    const cz = Math.round(((wz - minZ) / rangeZ) * (TEXTURE_SIZE - 1));

    // Collect 3 nearest unique biomes (self + up to 2 neighbors)
    const selfBiome = tile.baseTerrain;
    const neighbours = hexNeighbours(tile.coord);
    const neighborBiomes: string[] = [];
    for (const nId of neighbours) {
      const nTile = map[nId];
      if (nTile && nTile.baseTerrain !== selfBiome) {
        if (!neighborBiomes.includes(nTile.baseTerrain)) {
          neighborBiomes.push(nTile.baseTerrain);
          if (neighborBiomes.length === 2) break;
        }
      }
    }
    while (neighborBiomes.length < 2) neighborBiomes.push(selfBiome);

    const biome0Id = BIOME_ENCODE[selfBiome] ?? 0;
    const biome1Id = BIOME_ENCODE[neighborBiomes[0]] ?? 0;
    const biome2Id = BIOME_ENCODE[neighborBiomes[1]] ?? 0;

    const stampRadius = Math.max(4, Math.round((TEXTURE_SIZE / Math.max(rangeX, rangeZ)) * 1.4));

    for (let dz = -stampRadius; dz <= stampRadius; dz++) {
      for (let dx = -stampRadius; dx <= stampRadius; dx++) {
        const px = cx + dx;
        const pz = cz + dz;
        if (px < 0 || px >= TEXTURE_SIZE || pz < 0 || pz >= TEXTURE_SIZE) continue;

        const dist = Math.sqrt(dx * dx + dz * dz) / stampRadius;
        if (dist > 1.0) continue;

        // Noise-perturbed blend weights at the tile boundary
        const n = noise2(px * 0.1, pz * 0.1) * 0.15;
        const w0raw = smoothstep(0.0, 1.0, 1.0 - dist + n);
        const w1 = (1.0 - w0raw) * 0.6;
        const w2 = (1.0 - w0raw) * 0.4;

        const idx = (pz * TEXTURE_SIZE + px) * 4;
        // Only write if this tile has a stronger weight than current
        const currentW0 = 255 - data[idx + 2] - data[idx + 3];
        const newW0 = Math.round(w0raw * 255);
        if (newW0 > currentW0) {
          data[idx]     = biome0Id;
          data[idx + 1] = biome1Id;
          data[idx + 2] = Math.round(w1 * 255);
          data[idx + 3] = Math.round(w2 * 255);
        }
      }
    }
  }

  const texture = new THREE.DataTexture(
    data,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.needsUpdate = true;

  return {
    texture,
    worldMin: new THREE.Vector2(minX, minZ),
    worldMax: new THREE.Vector2(maxX, maxZ),
  };
}

// Decode a biome ID to its THREE.Color (used by the biomeBlend shader to look up palette)
export const BIOME_COLORS: Record<number, string> = {
  1: TerrainColors.plains,
  2: TerrainColors.grassland,
  3: TerrainColors.tundra,
  4: TerrainColors.desert,
  5: TerrainColors.ocean,
  6: TerrainColors.snow,
};
