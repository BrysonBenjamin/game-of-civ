import * as THREE from 'three';
import { StorageTexture } from 'three/webgpu';
import { wgslFn, textureStore, texture, instanceIndex, float, vec2, mod, div } from 'three/tsl';
import { HexConstants } from '../../constants';

export const TERRAIN_BAKE_RESOLUTION = 256;

// Bakes the stepped-rug height field into a filtered texture so both the terrain
// displacement and macro normal pass can sample a single continuous surface.
const computeHeightmapShader = wgslFn(`
  fn computeHeightmap(
    storeHeight: texture_storage_2d<rgba16float, write>,
    terrainData: texture_2d<f32>,
    coord: vec2<u32>,
    resolution: f32,
    hexSize: f32,
    plateauStart: f32,
    mapWidth: f32,
    mapHeight: f32
  ) -> void {
    let coordF = vec2<f32>(f32(coord.x), f32(coord.y));
    let uv = (coordF + vec2<f32>(0.5)) / resolution;
    let halfRes = resolution * 0.5;
    let q = uv.x * resolution - halfRes;
    let r = uv.y * resolution - halfRes;
    let worldX = hexSize * 1.5 * q;
    let worldZ = hexSize * sqrt(3.0) * (r + q * 0.5);
    let height = sampleSteppedTerrain(terrainData, worldX, worldZ, hexSize, plateauStart, mapWidth, mapHeight);
    textureStore(storeHeight, coord, vec4<f32>(height, height, height, 1.0));
  }

  fn sampleSteppedTerrain(
    terrainData: texture_2d<f32>,
    worldX: f32,
    worldZ: f32,
    hexSize: f32,
    plateauStart: f32,
    mapWidth: f32,
    mapHeight: f32
  ) -> f32 {
    let q = ((2.0 / 3.0) * worldX) / hexSize;
    let r = (((sqrt(3.0) / 3.0) * worldZ) - (worldX / 3.0)) / hexSize;

    let center = axialRound(q, r);
    let dq = q - center.x;
    let dr = r - center.y;
    let ds = -dq - dr;
    let edgeMetric = max(max(abs(dq), abs(dr)), abs(ds)) * 2.0;
    let rampMask = smoothstep(plateauStart, 1.0, edgeMetric);

    let centerTier = loadTier(terrainData, center.x, center.y, mapWidth, mapHeight, 0.0);
    let neighborOffset = dominantNeighborOffset(dq, dr, ds);
    let neighborTier = loadTier(
      terrainData,
      center.x + neighborOffset.x,
      center.y + neighborOffset.y,
      mapWidth,
      mapHeight,
      centerTier
    );

    return mix(centerTier, neighborTier, rampMask);
  }

  fn axialRound(q: f32, r: f32) -> vec2<f32> {
    let s = -q - r;
    var rq = round(q);
    var rr = round(r);
    var rs = round(s);

    let qDiff = abs(rq - q);
    let rDiff = abs(rr - r);
    let sDiff = abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    } else {
      rs = -rq - rr;
    }

    return vec2<f32>(rq, rr);
  }

  fn loadTier(
    terrainData: texture_2d<f32>,
    q: f32,
    r: f32,
    mapWidth: f32,
    mapHeight: f32,
    fallbackTier: f32
  ) -> f32 {
    let row = i32(round(r));
    let col = i32(round(q)) + i32(floor(r * 0.5));
    if (row < 0 || row >= i32(mapHeight) || col < 0 || col >= i32(mapWidth)) {
      return fallbackTier;
    }

    let texel = textureLoad(terrainData, vec2<i32>(col, row), 0);
    return round(texel.r * 255.0);
  }

  fn dominantNeighborOffset(dq: f32, dr: f32, ds: f32) -> vec2<f32> {
    let aq = abs(dq);
    let ar = abs(dr);
    let aS = abs(ds);

    if (aq >= ar && aq >= aS) {
      return select(vec2<f32>(-1.0, 0.0), vec2<f32>(1.0, 0.0), dq >= 0.0);
    }

    if (ar >= aS) {
      return select(vec2<f32>(0.0, -1.0), vec2<f32>(0.0, 1.0), dr >= 0.0);
    }

    return select(vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0), ds >= 0.0);
  }
`);

export function createHeightmapComputeBinding(terrainDataTexture: THREE.Texture, width: number, height: number) {
  const storeTexture = new StorageTexture(TERRAIN_BAKE_RESOLUTION, TERRAIN_BAKE_RESOLUTION);
  storeTexture.colorSpace = THREE.NoColorSpace;
  storeTexture.wrapS = THREE.ClampToEdgeWrapping;
  storeTexture.wrapT = THREE.ClampToEdgeWrapping;
  storeTexture.minFilter = THREE.LinearFilter;
  storeTexture.magFilter = THREE.LinearFilter;
  storeTexture.type = THREE.HalfFloatType;

  const xNode = mod(instanceIndex, TERRAIN_BAKE_RESOLUTION);
  const yNode = div(instanceIndex, TERRAIN_BAKE_RESOLUTION);

  const computeNode = computeHeightmapShader({
    storeHeight: textureStore(storeTexture),
    terrainData: texture(terrainDataTexture),
    coord: vec2(xNode, yNode),
    resolution: float(TERRAIN_BAKE_RESOLUTION),
    hexSize: float(HexConstants.SIZE),
    plateauStart: float(HexConstants.PLATEAU_FRACTION),
    mapWidth: float(width),
    mapHeight: float(height),
  }).compute(TERRAIN_BAKE_RESOLUTION * TERRAIN_BAKE_RESOLUTION);

  return { storeTexture, computeNode };
}
