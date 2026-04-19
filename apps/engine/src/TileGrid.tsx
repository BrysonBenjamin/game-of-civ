import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';
import {
  storage,
  instanceIndex,
  color,
  mix,
  positionLocal,
  vec2,
  vec3,
  float,
  add,
  sub,
  mul,
  div,
  select,
  equal,
  texture,
  normalize,
  clamp,
  smoothstep,
  varying,
} from 'three/tsl';
import { HexConstants } from './constants';

interface TileGridProps {
  mapBuffer: Float32Array;
  count: number;
  heightmapTexture?: any;
}

// -----------------------------------------------------------------------------
// TSL Shaders
// -----------------------------------------------------------------------------

// Hex Colors mapping from terrainTypeId
// 1 = Plains, 2 = Grassland, 3 = Tundra, 4 = Desert, 5 = Ocean, 6 = Snow
const PLAINS     = color('#8fbc5a');
const GRASSLAND  = color('#5da84e');
const TUNDRA     = color('#7a9a8a');
const DESERT     = color('#d4b96a');
const OCEAN      = color('#2a6ec4');
const SNOW       = color('#d0dde8');
const PARCHMENT  = color('#d2b48c');
const SNOW_WHITE = color('#f0f0f0'); // Peak tint target

export default function TileGrid({ mapBuffer, count, heightmapTexture }: TileGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Create the WebGPU Storage Attribute
  const bufferAttr = useMemo(() => {
    return new THREE.StorageInstancedBufferAttribute(mapBuffer, 4);
  }, [mapBuffer]);

  // Recompiles whenever mapBuffer, count, or heightmapTexture (App state) changes.
  // heightmapTexture arrives as null on first render then flips to the baked
  // StorageTexture once App.tsx's computeAsync resolves — that state update causes
  // a re-render here and rebuilds the full node material with live texture reads.
  const materialNode = useMemo(() => {
    // Read the vec4 from the storage buffer using instanceIndex
    const tileData   = storage(bufferAttr, 'vec4', count).element(instanceIndex);
    const qNode      = tileData.x;
    const rNode      = tileData.y;
    const typeIdNode = tileData.z;
    const fogNode    = tileData.w;

    // ─── POSITION DISPLACEMENT ───
    // Replicate axialToWorld math in TSL (Flat-Top)
    const spacing = float(0);
    const radius  = float(HexConstants.SIZE);
    const sqrt3   = float(Math.sqrt(3));
    const wNode   = mul(radius, sqrt3);
    const hNode   = mul(radius, 2.0);
    const wStep   = add(wNode, spacing);
    const px      = add(mul(qNode, wStep), mul(rNode, mul(wStep, 0.5)));
    const pzStep  = mul(add(hNode, spacing), 0.75);
    const pz      = mul(rNode, pzStep);

    // ─── UV COORDINATES ───
    // Map axial (q, r) → heightmap UV [0, 1].
    // Clamp center UV inward by one texel to prevent edge bleed on neighbor reads.
    const TEXEL  = float(1.0 / 256.0);
    const HMAP_W = float(256.0);
    const halfW  = div(HMAP_W, 2.0);

    const uRaw = div(add(qNode, halfW), HMAP_W);
    const vRaw = div(add(rNode, halfW), HMAP_W);
    const uC   = clamp(uRaw, TEXEL, sub(float(1.0), TEXEL));
    const vC   = clamp(vRaw, TEXEL, sub(float(1.0), TEXEL));
    const uv0  = vec2(uC, vC);

    // ─── HEIGHT · NORMAL · AO  (vertex-stage reads promoted via varying()) ───
    // varying() forces node evaluation in vertex stage; the interpolated result
    // is then available to all fragment-stage nodes (colorNode, roughnessNode…)
    // without redundant texture reads.
    let heightVar: any = float(0.0);
    let normalVar: any = vec3(0.0, 1.0, 0.0);
    let aoVar: any     = float(1.0);

    if (heightmapTexture) {
      const htex = heightmapTexture;

      // ── Center sample ──
      const h = texture(htex, uv0).g;

      // ── Four cardinal neighbors — clamped to [0,1] to prevent map-boundary bleed ──
      const uL = clamp(sub(uRaw, TEXEL), float(0.0), float(1.0));
      const uR = clamp(add(uRaw, TEXEL), float(0.0), float(1.0));
      const vD = clamp(sub(vRaw, TEXEL), float(0.0), float(1.0));
      const vU = clamp(add(vRaw, TEXEL), float(0.0), float(1.0));

      const hL = texture(htex, vec2(uL, vC)).g;
      const hR = texture(htex, vec2(uR, vC)).g;
      const hD = texture(htex, vec2(uC, vD)).g;
      const hU = texture(htex, vec2(uC, vU)).g;

      // ── Step A: Normal reconstruction — central-difference ──
      // n = normalize(vec3(hL - hR, 2 / ELEV_SCALE, hD - hU))
      // The Y component (2/ELEV_SCALE) keeps slope steepness accurate to the
      // visual displacement applied to the geometry.
      const yComp     = div(float(2.0), float(HexConstants.ELEV_SCALE));
      const rawNormal = normalize(vec3(sub(hL, hR), yComp, sub(hD, hU)));

      // ── Step C: AO proxy — concavity (Laplacian) darkens valleys ──
      // curvature = avg(neighbors) − center; positive ⇒ concave (valley)
      const avgNeighbors = mul(add(add(add(hL, hR), hD), hU), float(0.25));
      const curvature    = sub(avgNeighbors, h);
      // Valleys (curvature > 0) → ao approaches 0.5; ridges/peaks → ao = 1.0
      const rawAO = clamp(sub(float(1.0), mul(curvature, float(6.0))), float(0.5), float(1.0));

      // Promote to varyings — computed once in vertex stage, interpolated to fragment
      heightVar = varying(h,          'vHeight');
      normalVar = varying(rawNormal,  'vDerivedNormal');
      aoVar     = varying(rawAO,      'vAO');
    }

    // ─── FINAL VERTEX POSITION ───
    const heightDisplacement = mul(heightVar, float(HexConstants.ELEV_SCALE));
    const finalPosition = positionLocal.add(vec3(px, heightDisplacement, pz));

    // ─── TERRAIN BASE COLOR ───
    const baseColor = select(equal(typeIdNode, 1), PLAINS,
      select(equal(typeIdNode, 2), GRASSLAND,
      select(equal(typeIdNode, 3), TUNDRA,
      select(equal(typeIdNode, 4), DESERT,
      select(equal(typeIdNode, 5), OCEAN,
      select(equal(typeIdNode, 6), SNOW, OCEAN))))));

    // ── Step B-heroic: Elevation Tint — peaks shift toward snow/stone white ──
    const snowTint   = smoothstep(float(0.7), float(1.0), heightVar);
    const tintedBase = mix(vec3(baseColor), vec3(SNOW_WHITE), snowTint) as any;

    // ─── FOG OF WAR ───
    // Unexplored (< 0.25): PARCHMENT
    // Explored   (0.25–0.75): desaturated biome overlay
    // Visible    (> 0.75): full tinted color
    const luminance    = tintedBase.dot(vec3(0.299, 0.587, 0.114));
    const exploredBase = mix(PARCHMENT, vec3(luminance), 0.5);

    // @ts-expect-error deeply nested TSL unions exceed r184 generic limits
    const finalColor = select(
      fogNode.lessThan(0.25),
      PARCHMENT,
      select(
        fogNode.lessThan(0.75),
        mix(exploredBase, tintedBase, 0.3),
        tintedBase
      )
    ) as any;

    // ─── Step B: Height-Aware PBR Properties ───
    const waterLevel = float(HexConstants.WATER_LEVEL);
    const isWater    = (heightVar as any).lessThan(waterLevel);

    // Roughness: deep water ≈ 0.05 (specular glints); land ≈ 0.85 (matte tactile)
    const roughnessNode = select(isWater, float(0.05), float(0.85));

    // Metalness: water = 1.0 to enhance wet IBL reflection; land = 0.0
    const metalnessNode = select(isWater, float(1.0), float(0.0));

    // ─── MATERIAL ASSEMBLY ───
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.positionNode  = finalPosition;
    mat.colorNode     = finalColor;
    mat.normalNode    = normalVar;
    mat.roughnessNode = roughnessNode as any;
    mat.metalnessNode = metalnessNode as any;
    mat.aoNode        = aoVar;

    return mat;
  }, [bufferAttr, count, heightmapTexture]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, materialNode, count]} castShadow receiveShadow>
      {/* Flat-top hex: Cylinder with 6 radial segments, radius 1.0 */}
      <cylinderGeometry args={[HexConstants.SIZE, HexConstants.SIZE, 0.5, 6]} />
    </instancedMesh>
  );
}
