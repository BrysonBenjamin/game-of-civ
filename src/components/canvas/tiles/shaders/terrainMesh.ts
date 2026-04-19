/**
 * @module terrainMesh
 * @description Unified terrain mesh shader. Vertex stage displaces in world Y
 * from the global heightmap. Fragment stage blends biome colors via splatmap
 * with fog-of-war parchment/ink overlay.
 *
 * Geometry contract: position.xz = world XZ, uv = 0→1 over heightmap extent.
 */

// Biome colors hard-coded in the shader to avoid dynamic uniform array indexing.
// Keep in sync with TerrainColors in DesignTokens.ts.
const BIOME_GLSL = /* glsl */ `
  vec3 biomeColor(float encodedId) {
    int id = int(encodedId * 255.0 + 0.5);
    if (id == 1) return vec3(0.545, 0.659, 0.314); // plains
    if (id == 2) return vec3(0.290, 0.541, 0.228); // grassland
    if (id == 3) return vec3(0.416, 0.541, 0.471); // tundra
    if (id == 4) return vec3(0.831, 0.659, 0.314); // desert
    if (id == 5) return vec3(0.102, 0.290, 0.478); // ocean
    if (id == 6) return vec3(0.784, 0.847, 0.878); // snow
    return vec3(0.35, 0.50, 0.28);                 // fallback green
  }
`;

export const terrainMeshVert = /* glsl */ `
  uniform sampler2D u_heightmap;
  uniform float     u_elevScale;
  uniform float     u_waterLevel;
  uniform vec2      u_worldMin;
  uniform vec2      u_worldMax;
  uniform sampler2D u_splatmap;

  varying vec3  vWorldPos;
  varying vec3  vNormal;
  varying float vHeight;
  varying vec3  vBiomeColor;

  ${BIOME_GLSL}

  float sampleElev(vec2 puv) {
    return texture2D(u_heightmap, clamp(puv, 0.001, 0.999)).g * u_elevScale;
  }

  void main() {
    float h   = sampleElev(uv);
    vec3  pos = vec3(position.x, h, position.z);

    // Analytical normal via 4-sample finite difference
    float ts  = 1.0 / 256.0;
    float hL  = sampleElev(uv + vec2(-ts, 0.0));
    float hR  = sampleElev(uv + vec2( ts, 0.0));
    float hD  = sampleElev(uv + vec2(0.0, -ts));
    float hU  = sampleElev(uv + vec2(0.0,  ts));

    vec2  range   = u_worldMax - u_worldMin;
    float stepX   = range.x / 256.0;
    float stepZ   = range.y / 256.0;
    vec3  tanX    = normalize(vec3(2.0 * stepX, hR - hL, 0.0));
    vec3  tanZ    = normalize(vec3(0.0, hU - hD, 2.0 * stepZ));
    vNormal       = normalize(cross(tanZ, tanX));

    // Splatmap biome blend (primary + up to one neighbour)
    vec4 splat = texture2D(u_splatmap, clamp(uv, 0.001, 0.999));
    float w1   = splat.b;   // normalized 0-1
    float w2   = splat.a;
    float w0   = max(0.0, 1.0 - w1 - w2);
    vec3 c0    = biomeColor(splat.r);
    vec3 c1    = biomeColor(splat.g);
    vBiomeColor = c0 * w0 + c1 * w1 + c0 * w2;

    vWorldPos   = pos;
    vHeight     = h;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const terrainMeshFrag = /* glsl */ `
  uniform float u_fogFactor;
  uniform float u_waterLevel;

  varying vec3  vWorldPos;
  varying vec3  vNormal;
  varying float vHeight;
  varying vec3  vBiomeColor;

  void main() {
    // Ocean bed — water plane covers this at runtime
    if (vHeight < u_waterLevel) {
      gl_FragColor = vec4(0.06, 0.08, 0.12, 1.0);
      return;
    }

    // ── Snow cap on mountains (peak ≈ 0.5 wu with ELEV_SCALE=0.5) ─────────
    // smoothstep(0.38, 0.50) → hills(0.30) get none, mountains(0.50) get full
    float snowBlend = smoothstep(0.38, 0.50, vHeight);
    vec3 baseColor  = mix(vBiomeColor, vec3(0.90, 0.93, 0.98), snowBlend * 0.75);

    // ── Lambert diffuse ───────────────────────────────────────────────────
    vec3  lightDir = normalize(vec3(0.6, 0.9, 0.4));
    float diff     = max(dot(vNormal, lightDir), 0.0) * 0.70 + 0.30;

    // ── Parchment procedural (fog-of-war unexplored) ──────────────────────
    vec2  seed  = vWorldPos.xz * 0.7;
    float n     = fract(sin(dot(seed, vec2(127.1, 311.7))) * 43758.5453);
    float n2    = fract(sin(dot(seed * 2.3, vec2(269.5, 183.3))) * 17391.7);
    vec3  parch = mix(vec3(0.965, 0.902, 0.753), vec3(0.831, 0.749, 0.576),
                      (n * 0.65 + n2 * 0.35) * 0.5);

    // ── Cross-hatch (explored / fog-of-war) ──────────────────────────────
    float h1    = step(0.82, fract((vWorldPos.x + vWorldPos.z) * 0.35));
    float h2    = step(0.82, fract((vWorldPos.x - vWorldPos.z) * 0.35));
    float lum   = dot(baseColor, vec3(0.299, 0.587, 0.114));
    vec3 explored = mix(vec3(lum * 0.72) + parch * 0.32,
                        vec3(0.17, 0.10, 0.05),
                        max(h1, h2) * 0.42);

    vec3 visible = baseColor * diff;

    // ── Three-way fog blend ───────────────────────────────────────────────
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
