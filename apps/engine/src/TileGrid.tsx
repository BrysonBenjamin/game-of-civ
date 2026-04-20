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
  lessThan,
  dot,
  wgslFn,
} from 'three/tsl';
import { HexConstants } from './constants';

interface TileGridProps {
  mapBuffer: Float32Array;
  count: number;
  heightmapTexture?: any;
  splatTexture?: any;
}

// -----------------------------------------------------------------------------
// TSL Shaders
// -----------------------------------------------------------------------------

const hash21 = wgslFn(`
  fn hash21(p: vec2<f32>) -> f32 {
      return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
  }
`);

const jitterColor = wgslFn(`
  fn jitterColor(c: vec3<f32>, jitter: f32) -> vec3<f32> {
      let K = vec4<f32>(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      let p = mix(vec4<f32>(c.bg, K.wz), vec4<f32>(c.gb, K.xy), step(c.b, c.g));
      let q = mix(vec4<f32>(p.xyw, c.r), vec4<f32>(c.r, p.yzx), step(p.x, c.r));
      let d = q.x - min(q.w, q.y);
      let e = 1.0e-10;
      var hsv = vec3<f32>(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      
      hsv.y = clamp(hsv.y + jitter * 0.5, 0.0, 1.0); // Saturation jitter
      hsv.z = clamp(hsv.z + jitter, 0.0, 1.0);       // Value jitter
      
      let K2 = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      let p2 = abs(fract(hsv.xxx + K2.xyz) * 6.0 - K2.www);
      return hsv.z * mix(K2.xxx, clamp(p2 - K2.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), hsv.y);
  }
`);

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

export default function TileGrid({ mapBuffer, count, heightmapTexture, splatTexture }: TileGridProps) {
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
    const fogNode    = tileData.w;

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

    // ── Step B-heroic: Elevation Tint & Procedural Color Jitter ──
    const pNode = vec2(qNode, rNode) as any;
    const rawHash = hash21({ p: pNode }) as any;
    const jitterValue = mul(rawHash, float(0.05)) as any;
    
    // c parameter is vec3, assure uniform structure bypassing node proxy rules
    const cNode = vec3(baseColor as any);
    const jitteredBase = jitterColor({ c: cNode, jitter: jitterValue }) as any;
    
    const snowTint   = smoothstep(float(0.7), float(1.0), heightVar);
    const tintedBase = mix(jitteredBase, SNOW_WHITE, snowTint) as any;

    // ─── FOG OF WAR ───
    // Unexplored (< 0.25): PARCHMENT
    // Explored   (0.25–0.75): desaturated biome overlay
    // Visible    (> 0.75): full tinted color
    const luminance    = dot(tintedBase, vec3(0.299, 0.587, 0.114));
    const exploredBase = mix(PARCHMENT, vec3(luminance), 0.5);

    const finalColor = select(
      lessThan(fogNode, 0.25),
      PARCHMENT,
      select(
        lessThan(fogNode, 0.75),
        mix(exploredBase, tintedBase, 0.3),
        tintedBase
      )
    ) as any;

    // ─── Step B: Height-Aware PBR Properties ───
    const waterLevel = float(HexConstants.WATER_LEVEL);
    const isWater    = lessThan(heightVar, waterLevel) as any;

    // Roughness: deep water ≈ 0.05 (specular glints); land ≈ 0.85 (matte tactile)
    const roughnessNode = select(isWater, float(0.05), float(0.85)) as any;

    // Metalness: water = 1.0 to enhance wet IBL reflection; land = 0.0
    const metalnessNode = select(isWater, float(1.0), float(0.0)) as any;

    // ─── MATERIAL ASSEMBLY ───
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.positionNode  = finalPosition;
    mat.colorNode     = finalColor;
    mat.normalNode    = normalVar;
    mat.roughnessNode = roughnessNode as any;
    mat.metalnessNode = metalnessNode as any;
    mat.aoNode        = aoVar;

    return mat;
    } catch (e: any) {
      console.error("MATERIAL NODE CRASH:", e);
      document.body.innerHTML = `<h1 style="color:red;z-index:9999;position:absolute;">${e.message}<br/>${e.stack}</h1>`;
      return new THREE.MeshBasicMaterial({ color: 'red' });
    }
  }, [bufferAttr, count, heightmapTexture, splatTexture]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, materialNode, count]} castShadow receiveShadow>
      {/* Flat-top hex: Cylinder with 6 radial segments, radius 1.0 */}
      <cylinderGeometry args={[HexConstants.SIZE, HexConstants.SIZE, 0.5, 6]} />
    </instancedMesh>
  );
}
