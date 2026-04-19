/**
 * @module hexTile
 * @description Fog-of-war aware GLSL shaders for hex terrain tiles.
 *
 * u_fogFactor uniforms:
 *   0.0  unexplored → procedural parchment texture
 *   0.5  fog_of_war → desaturated ink-on-parchment sketch
 *   1.0  visible    → full terrain color with Lambert diffuse
 */

export const hexTileVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv    = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hexTileFrag = /* glsl */ `
  uniform vec3  u_terrainColor;
  uniform float u_fogFactor;   // 0.0=unexplored  0.5=explored  1.0=visible
  uniform bool  u_hovered;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    // ── Procedural parchment ──────────────────────────────────────────────
    vec2  seed      = vUv * 18.0;
    float noise     = fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453);
    // Layer a second octave for richer texture
    float noise2    = fract(sin(dot(seed * 2.3, vec2(269.5, 183.3))) * 17391.7);
    float n         = noise * 0.65 + noise2 * 0.35;
    vec3  parchLight = vec3(0.965, 0.902, 0.753);
    vec3  parchDark  = vec3(0.831, 0.749, 0.576);
    vec3  parchment  = mix(parchLight, parchDark, n * 0.5);

    // ── Cross-hatch ink pattern (explored) ───────────────────────────────
    float h1      = step(0.82, fract((vUv.x + vUv.y) * 7.0));
    float h2      = step(0.82, fract((vUv.x - vUv.y) * 7.0));
    float hatch   = max(h1, h2);
    vec3  ink     = vec3(0.17, 0.10, 0.05);
    float lum     = dot(u_terrainColor, vec3(0.299, 0.587, 0.114));
    vec3  explored = mix(
      vec3(lum * 0.72) + parchment * 0.32,
      ink,
      hatch * 0.42
    );

    // ── Lambert diffuse (visible) ─────────────────────────────────────────
    vec3  lightDir = normalize(vec3(0.55, 1.0, 0.45));
    float diff     = max(dot(vNormal, lightDir), 0.0) * 0.62 + 0.38;
    vec3  baseColor = u_hovered
      ? mix(u_terrainColor, vec3(0.93, 0.88, 0.79), 0.35)
      : u_terrainColor;
    vec3  visible  = baseColor * diff;

    // ── Three-way blend ───────────────────────────────────────────────────
    vec3 color;
    if (u_fogFactor < 0.25) {
      color = parchment;
    } else if (u_fogFactor < 0.75) {
      // Smooth transition from explored back to visible
      float t = (u_fogFactor - 0.25) / 0.5;
      color = mix(explored, visible * 0.6 + explored * 0.4, t);
    } else {
      color = visible;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
