// @deprecated — use TerrainRug.tsx (continuous rug renderer).
// Kept for debug comparison: append ?debug to the URL to show this alongside the rug.
import { useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';
import {
  storage,
  instanceIndex,
  color,
  mix,
  normalWorld,
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
  clamp,
  smoothstep,
  varying,
} from 'three/tsl';
import { HexConstants } from './constants';
import { TERRAIN_BAKE_RESOLUTION } from './renderer/compute/HeightmapCompute';

interface TileGridProps {
  mapBuffer: Float32Array;
  count: number;
  heightmapTexture?: any;
  normalTexture?: any;
  splatTexture?: any;
  biomeNormalArray?: any;
}

// Hex Colors mapping from terrainTypeId
// 1 = Plains, 2 = Grassland, 3 = Tundra, 4 = Desert, 5 = Ocean, 6 = Snow
const PLAINS     = color('#8fbc5a');
const GRASSLAND  = color('#5da84e');
const TUNDRA     = color('#7a9a8a');
const DESERT     = color('#d4b96a');
const OCEAN      = color('#2a6ec4');
const SNOW       = color('#d0dde8');

export default function TileGrid({
  mapBuffer,
  count,
  heightmapTexture,
  normalTexture,
  splatTexture,
  biomeNormalArray,
}: TileGridProps) {
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
    try {
      // Read the vec4 from the storage buffer using instanceIndex
    const tileData   = storage(bufferAttr, 'vec4', count).element(instanceIndex);
    const qNode      = tileData.x;
    const rNode      = tileData.y;
    const typeIdNode = tileData.z;
    // ─── POSITION DISPLACEMENT ───
    const radius  = float(HexConstants.SIZE);
    const sqrt3   = float(Math.sqrt(3));
    
    // Flat-Top Hex Projection:
    // x = size * 3/2 * q
    // z = size * sqrt(3) * (r + q / 2)
    const px = mul(radius, mul(float(1.5), qNode));
    const pzTerm = add(rNode, mul(qNode, float(0.5)));
    const pz = mul(mul(radius, sqrt3), pzTerm);

    // ─── UV COORDINATES ───
    // Map axial (q, r) → heightmap UV [0, 1].
    // Clamp center UV inward by one texel to prevent edge bleed on neighbor reads.
    const TEXEL  = float(1.0 / TERRAIN_BAKE_RESOLUTION);
    const HMAP_W = float(TERRAIN_BAKE_RESOLUTION);
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
      const h = texture(heightmapTexture, uv0).g;
      heightVar = varying(h, 'vHeight');
      aoVar = varying(float(1.0), 'vAO');
    }

    if (normalTexture) {
      const sampledNormal = texture(normalTexture, uv0).xyz
        .mul(float(2.0))
        .sub(float(1.0))
        .normalize();

      normalVar = varying(sampledNormal, 'vDerivedNormal');
    }

    // ─── FINAL VERTEX POSITION ───
    const heightDisplacement = mul(heightVar, float(HexConstants.ELEV_SCALE));
    const finalPosition = add(positionLocal, vec3(px, heightDisplacement, pz));

    // ─── TERRAIN BASE COLOR ───
    let baseColor: any = color('#000');
    
    if (splatTexture) {
      // Find continuous exact UV 
      const radiusF = float(HexConstants.SIZE);
      const sqrt3F  = float(Math.sqrt(3));
      
      const wX = finalPosition.x;
      const wZ = finalPosition.z;
      
      const qFloat = div(mul(float(2.0/3.0), wX), radiusF);
      const rFloat = div(sub(mul(div(sqrt3F, float(3.0)), wZ), mul(float(1.0/3.0), wX)), radiusF);
      
      // Match SplatTexture's 64x64 format mathematically from axial float positions!
      // array layout: row = r, index = col + floor(row/2), which maps exactly to (q + q_offset)
      const qOffsetFrag = div(rFloat, float(2.0)).floor();
      const splatU = div(add(qFloat, qOffsetFrag), float(64.0));
      const splatV = div(rFloat, float(64.0));
      
      // Fix UV boundary edge constraints 
      const uvFrag = vec2(splatU, splatV);
      
      const splat = texture(splatTexture, uvFrag);
      
      const pVec = vec3(PLAINS as any);
      const gVec = vec3(GRASSLAND as any);
      const dVec = vec3(DESERT as any);
      const oVec = vec3(OCEAN as any);
      
      baseColor = add(
        add(mul(pVec, splat.r), mul(gVec, splat.g)),
        add(mul(dVec, splat.b), mul(oVec, splat.a))
      ) as any;
    } else {
      baseColor = select(equal(typeIdNode, 1), PLAINS,
        select(equal(typeIdNode, 2), GRASSLAND,
        select(equal(typeIdNode, 3), TUNDRA,
        select(equal(typeIdNode, 4), DESERT,
        select(equal(typeIdNode, 5), OCEAN,
        select(equal(typeIdNode, 6), SNOW, OCEAN))))));
    }

    // ─── Step B: Biome-Driven PBR Properties ───
    // Ocean: mirror-like (low rough, high metal). Snow/Tundra: sparkle/frozen.
    // Everything else: matte tactile land.
    const isOcean = equal(typeIdNode, float(5.0)) as any;

    const roughnessNode = select(isOcean, float(0.05),
      select(equal(typeIdNode, float(6.0)), float(0.40),
      select(equal(typeIdNode, float(3.0)), float(0.60), float(0.85)))) as any;

    const metalnessNode = select(isOcean, float(0.80), float(0.0)) as any;

    // ─── MATERIAL ASSEMBLY ───
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.flatShading = false;
    mat.wireframe = false;
    mat.positionNode  = finalPosition;
    mat.normalNode    = normalVar;

    const biomeColorNode = vec3(baseColor as any);
    const isFlatGround = smoothstep(float(0.7), float(0.9), normalWorld.y);
    const cliffColor = color('#4a3b2c');
    const terrainColor = mix(cliffColor, biomeColorNode, isFlatGround);

    mat.colorNode     = terrainColor as any;
    mat.roughnessNode = roughnessNode as any;
    mat.metalnessNode = metalnessNode as any;
    mat.aoNode        = aoVar;

    return mat;
    } catch (e: any) {
      console.error("MATERIAL NODE CRASH:", e);
      document.body.innerHTML = `<h1 style="color:red;z-index:9999;position:absolute;">${e.message}<br/>${e.stack}</h1>`;
      return new THREE.MeshBasicMaterial({ color: 'red' });
    }
  }, [bufferAttr, count, heightmapTexture, normalTexture, splatTexture, biomeNormalArray]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, materialNode, count]} castShadow receiveShadow>
      {/* Flat-top hex: Cylinder with 6 radial segments, radius 1.0 */}
      <cylinderGeometry args={[HexConstants.SIZE, HexConstants.SIZE, 0.5, 6]} />
    </instancedMesh>
  );
}
