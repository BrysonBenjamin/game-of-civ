import type * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  Fn, texture, uv,
  vec2, vec3, float,
  mix, smoothstep, select,
  sin, dot, fract, normalize,
  normalLocal, uniform,
} from "three/tsl";
import { ELEV_SCALE } from "../systems/HeightmapSystem";

export interface TerrainNodeMaterialResult {
  material: MeshStandardNodeMaterial;
  fogFactorUniform: { value: number };
}

// Biome color LUT — mirrors the GLSL biomeColor() if-else chain.
// Nested select() compiles to GLSL ternary chains (no dynamic array indexing).
// IDs: plains=1, grassland=2, tundra=3, desert=4, ocean=5, snow=6
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const biomeColorFn = Fn(([encoded]: [any]) => {
  const id = encoded.mul(255.0).add(0.5).floor();
  return select(id.equal(float(1)), vec3(0.545, 0.659, 0.314),
    select(id.equal(float(2)), vec3(0.290, 0.541, 0.228),
    select(id.equal(float(3)), vec3(0.416, 0.541, 0.471),
    select(id.equal(float(4)), vec3(0.831, 0.659, 0.314),
    select(id.equal(float(5)), vec3(0.102, 0.290, 0.478),
    select(id.equal(float(6)), vec3(0.784, 0.847, 0.878),
    vec3(0.35, 0.50, 0.28)))))));
});

/**
 * Build a MeshStandardNodeMaterial for the unified terrain mesh.
 *
 * Expects the geometry to have:
 *   - uv         : 0→1 over world extent (maps to heightmap/splatmap UV)
 *   - vHeight    : float32 per-vertex attribute, pre-baked world-Y elevation
 *   - normal     : computed by geometry.computeVertexNormals() after Y-displacement
 *
 * colorNode pipeline:
 *   splatmap biome blend → snow cap → micro-grain detail → fog-of-war parchment
 *
 * normalNode: procedural micro-perturbation for tactile surface quality.
 */
export function buildTerrainNodeMaterial(
  heightmapTex: THREE.DataTexture,
  splatmapTex: THREE.DataTexture,
): TerrainNodeMaterialResult {
  const uFogFactor = uniform(1.0);

  const texUV       = uv();
  const splatSample = texture(splatmapTex, texUV);

  // Height from heightmap G channel — same data as the pre-baked geometry Y,
  // used here only for snow cap blending (no vertex displacement in the shader).
  const vHeight = texture(heightmapTex, texUV).g.mul(ELEV_SCALE);

  // ── Splatmap biome blend ──────────────────────────────────────────────────
  // R = primary biome ID (encoded), G = secondary biome ID (encoded)
  // B/255 = w1 (secondary weight), A/255 = w2 (tertiary, also primary color)
  const w1 = splatSample.b;
  const w2 = splatSample.a;
  const w0 = float(1.0).sub(w1).sub(w2).clamp(0.0, 1.0);
  const c0 = biomeColorFn(splatSample.r);
  const c1 = biomeColorFn(splatSample.g);
  const biomeBlended = c0.mul(w0).add(c1.mul(w1)).add(c0.mul(w2));

  // ── Snow cap on mountains ─────────────────────────────────────────────────
  // smoothstep(0.38, 0.50) → hills(0.30 wu) get none, mountains(0.50 wu) get full
  const snowBlend = smoothstep(float(0.38), float(0.50), vHeight).mul(0.75);
  const colorWithSnow = mix(biomeBlended, vec3(0.90, 0.93, 0.98), snowBlend);

  // ── Micro-grain procedural detail (simulates tiling surface texture) ──────
  // High-frequency hash noise at UV×40 gives a slight per-texel luminance variation
  // that reads as a tactile grain when the camera zooms close.
  const grainUV = texUV.mul(40.0);
  const grain   = fract(sin(dot(grainUV, vec2(127.1, 311.7))).mul(43758.5453));
  const detailColor = mix(colorWithSnow,
    colorWithSnow.mul(float(0.88).add(grain.mul(0.24))),
    float(0.35));

  // ── Fog-of-war parchment overlay ──────────────────────────────────────────
  // u_fogFactor 0.0 → full unexplored parchment, 1.0 → full terrain detail
  const parchSeed  = texUV.mul(0.7);
  const parchNoise = fract(sin(dot(parchSeed, vec2(127.1, 311.7))).mul(43758.5453));
  const parchColor = mix(vec3(0.965, 0.902, 0.753), vec3(0.831, 0.749, 0.576),
    parchNoise.mul(0.5));
  const finalColor = mix(parchColor, detailColor, uFogFactor);

  // ── Micro-normal perturbation (tactile surface quality) ───────────────────
  // Adds low-amplitude XZ noise to the geometry normal to create micro-faceting
  // that catches specular highlights from the directional light.
  const noiseUV = texUV.mul(80.0);
  const nx = sin(dot(noiseUV, vec2(127.1, 311.7))).mul(0.04);
  const ny = sin(dot(noiseUV, vec2(269.5, 183.3))).mul(0.04);
  const perturbedNormal = normalize(normalLocal.add(vec3(nx, float(0.0), ny)));

  const mat = new MeshStandardNodeMaterial();
  mat.colorNode  = finalColor;
  mat.normalNode = perturbedNormal;
  mat.roughness  = 0.85;
  mat.metalness  = 0.0;

  return { material: mat, fogFactorUniform: uFogFactor };
}
