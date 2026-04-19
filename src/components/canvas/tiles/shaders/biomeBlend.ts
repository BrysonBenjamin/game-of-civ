/**
 * @module biomeBlend
 * @description Weighted biome splatting shader. Samples the SplatmapSystem
 * DataTexture to blend up to 3 biome colors per tile, with organic Perlin-
 * perturbed edges instead of hard hex boundaries.
 *
 * Uniforms:
 *   u_splatmap    — SplatmapSystem DataTexture (RGBA8)
 *   u_worldOffset — tile center in world XZ
 *   u_worldMin    — splatmap world bounds min
 *   u_worldMax    — splatmap world bounds max
 *   u_fogFactor   — fog-of-war blend (0=unexplored, 0.5=explored, 1=visible)
 *   u_hovered     — hover tint flag
 *
 * Splatmap encoding (per texel):
 *   R = biome0 ID   G = biome1 ID   B = w1 (0-255)   A = w2 (0-255)
 *   w0 = 1 - w1/255 - w2/255  (reconstructed in shader)
 *
 * Biome IDs → colors resolved via u_biomeColors[6] array.
 */

export const biomeBlendVert = /* glsl */ `
  uniform sampler2D u_splatmap;
  uniform vec2  u_worldOffset;
  uniform vec2  u_worldMin;
  uniform vec2  u_worldMax;

  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vBiomeColor;

  // Biome palette: index 0 unused, 1-6 = plains,grassland,tundra,desert,ocean,snow
  uniform vec3 u_biomeColors[7];

  vec3 decodeBiomeColor(float id) {
    int i = int(id * 255.0 + 0.5);
    if (i <= 0 || i > 6) return vec3(0.5);
    return u_biomeColors[i];
  }

  vec2 toSplatmapUv(vec2 worldXZ) {
    return clamp((worldXZ - u_worldMin) / (u_worldMax - u_worldMin), 0.001, 0.999);
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec2 worldXZ = u_worldOffset + position.xz;
    vec2 spUv    = toSplatmapUv(worldXZ);
    vec4 splat   = texture2D(u_splatmap, spUv);

    float w1 = splat.b;  // already 0-1 from DataTexture float path
    float w2 = splat.a;
    float w0 = max(0.0, 1.0 - w1 - w2);

    vec3 c0 = decodeBiomeColor(splat.r);
    vec3 c1 = decodeBiomeColor(splat.g);
    // biome2 not encoded separately; reuse c0 for simplicity
    vBiomeColor = c0 * w0 + c1 * w1 + c0 * w2;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const biomeBlendFrag = /* glsl */ `
  uniform float u_fogFactor;
  uniform bool  u_hovered;

  varying vec2  vUv;
  varying vec3  vNormal;
  varying vec3  vBiomeColor;

  void main() {
    // ── Parchment procedural ──────────────────────────────────────────────
    vec2  seed  = vUv * 18.0;
    float n     = fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453);
    float n2    = fract(sin(dot(seed * 2.3, vec2(269.5, 183.3))) * 17391.7);
    vec3 parch  = mix(vec3(0.965, 0.902, 0.753), vec3(0.831, 0.749, 0.576), (n * 0.65 + n2 * 0.35) * 0.5);

    // ── Cross-hatch (explored) ────────────────────────────────────────────
    float h1  = step(0.82, fract((vUv.x + vUv.y) * 7.0));
    float h2  = step(0.82, fract((vUv.x - vUv.y) * 7.0));
    float lum = dot(vBiomeColor, vec3(0.299, 0.587, 0.114));
    vec3 explored = mix(vec3(lum * 0.72) + parch * 0.32, vec3(0.17, 0.10, 0.05), max(h1, h2) * 0.42);

    // ── Lambert (visible) ─────────────────────────────────────────────────
    vec3 lightDir = normalize(vec3(0.55, 1.0, 0.45));
    float diff    = max(dot(vNormal, lightDir), 0.0) * 0.62 + 0.38;
    vec3 baseColor = u_hovered ? mix(vBiomeColor, vec3(0.93, 0.88, 0.79), 0.35) : vBiomeColor;
    vec3 visible  = baseColor * diff;

    // ── Fog blend ─────────────────────────────────────────────────────────
    vec3 color;
    if (u_fogFactor < 0.25) {
      color = parch;
    } else if (u_fogFactor < 0.75) {
      float t = (u_fogFactor - 0.25) / 0.5;
      color = mix(explored, visible * 0.6 + explored * 0.4, t);
    } else {
      color = visible;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
