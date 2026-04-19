/**
 * @module waterPlane
 * @description Animated water surface shader. Discards fragments over land
 * (terrain height >= water level). Blends deep/shallow/coast colors with
 * animated caustic pattern driven by u_time.
 */

export const waterPlaneVert = /* glsl */ `
  varying vec2 vWorldXZ;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const waterPlaneFrag = /* glsl */ `
  uniform sampler2D u_heightmap;
  uniform float     u_waterLevel;
  uniform float     u_elevScale;
  uniform vec2      u_worldMin;
  uniform vec2      u_worldMax;
  uniform float     u_time;

  varying vec2 vWorldXZ;

  float sampleElev(vec2 worldXZ) {
    vec2 uv = clamp((worldXZ - u_worldMin) / (u_worldMax - u_worldMin), 0.001, 0.999);
    return texture2D(u_heightmap, uv).g * u_elevScale;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float terrainH = sampleElev(vWorldXZ);

    // Discard where terrain is above water (land shows through)
    if (terrainH >= u_waterLevel) discard;

    float depth = u_waterLevel - terrainH;

    // Depth-based color blend: deep → mid → coast
    vec3 deep    = vec3(0.03, 0.08, 0.18);
    vec3 mid     = vec3(0.07, 0.18, 0.35);
    vec3 coast   = vec3(0.18, 0.42, 0.55);

    float d = clamp(depth / (u_waterLevel * 3.0), 0.0, 1.0);
    vec3 waterColor = mix(coast, mix(mid, deep, d), d);

    // Animated caustics
    vec2 uv1 = vWorldXZ * 0.15 + vec2(u_time * 0.04, u_time * 0.03);
    vec2 uv2 = vWorldXZ * 0.12 - vec2(u_time * 0.03, u_time * 0.05);
    float c1 = hash(floor(uv1 * 8.0) / 8.0);
    float c2 = hash(floor(uv2 * 8.0) / 8.0);
    float caustic = (c1 * 0.5 + c2 * 0.5) * 0.08 * (1.0 - d);

    vec3 color = waterColor + caustic;

    // Specular shimmer
    float spec = hash(floor(vWorldXZ * 0.3 + u_time * 0.2)) * 0.06 * (1.0 - d * 0.5);
    color += spec;

    // ── Shoreline foam ────────────────────────────────────────────────────
    // White animated band where water depth < 0.08 wu (near the shore edge).
    float foamMask  = 1.0 - smoothstep(0.0, 0.08, depth);
    // Animated noise breaks the foam into organic patches rather than a solid ring.
    float foamNoise = step(0.55, fract(dot(vWorldXZ * 3.0,
                          vec2(1.618, 2.718)) + u_time * 0.3));
    float foam      = foamMask * (0.7 + foamNoise * 0.3);

    vec3 foamColor  = vec3(0.96, 0.97, 0.98);
    color = mix(color, foamColor, foam);

    gl_FragColor = vec4(color, mix(0.88, 0.65, foamMask));
  }
`;
