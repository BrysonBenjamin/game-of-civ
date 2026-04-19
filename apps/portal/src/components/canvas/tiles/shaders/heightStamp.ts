/**
 * @module heightStamp
 * @description Vertex displacement shader for structural terrain features
 * (hills, mountains). Samples the global heightmap texture to organically
 * raise the top face of a hex cylinder.
 *
 * Uniforms:
 *   u_heightmap   — HeightmapSystem DataTexture (RGBA8)
 *   u_worldOffset — tile center in world XZ (vec2)
 *   u_worldMin    — heightmap world bounds min XZ (vec2)
 *   u_worldMax    — heightmap world bounds max XZ (vec2)
 *   u_elevScale   — world-unit scale for the G channel (0-1 → 0-elevScale)
 *   u_terrainColor — base color blended toward rock/snow at peaks
 */

export const heightStampVert = /* glsl */ `
  uniform sampler2D u_heightmap;
  uniform vec2  u_worldOffset;
  uniform vec2  u_worldMin;
  uniform vec2  u_worldMax;
  uniform float u_elevScale;

  varying vec2  vUv;
  varying vec3  vNormal;
  varying float vHeight;

  vec2 toHeightmapUv(vec2 worldXZ) {
    return clamp((worldXZ - u_worldMin) / (u_worldMax - u_worldMin), 0.001, 0.999);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    vec2 worldXZ = u_worldOffset + pos.xz;
    vec2 hmUv    = toHeightmapUv(worldXZ);

    // G channel = elevation, normalized 0-1 from stored uint8
    float h = texture2D(u_heightmap, hmUv).g;

    // Displace only top face (positive y on CylinderGeometry top cap)
    if (pos.y > 0.05) {
      pos.y += h * u_elevScale;
    }
    vHeight = h;

    // Approximate surface normal via finite differences on heightmap
    float eps = 0.01;
    vec2 hmUvX = toHeightmapUv(worldXZ + vec2(eps * (u_worldMax.x - u_worldMin.x), 0.0));
    vec2 hmUvZ = toHeightmapUv(worldXZ + vec2(0.0, eps * (u_worldMax.y - u_worldMin.y)));
    float hX = texture2D(u_heightmap, hmUvX).g;
    float hZ = texture2D(u_heightmap, hmUvZ).g;

    vec3 tan  = normalize(vec3(eps, (hX - h) * u_elevScale, 0.0));
    vec3 btan = normalize(vec3(0.0, (hZ - h) * u_elevScale, eps));
    vNormal   = normalize(normalMatrix * cross(btan, tan));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const heightStampFrag = /* glsl */ `
  uniform vec3  u_terrainColor;
  uniform float u_elevScale;

  varying vec2  vUv;
  varying vec3  vNormal;
  varying float vHeight;

  void main() {
    vec3 rockColor = vec3(0.44, 0.40, 0.34);
    vec3 snowColor = vec3(0.85, 0.88, 0.90);

    float t = clamp(vHeight / 0.85, 0.0, 1.0);
    vec3 color = mix(u_terrainColor, rockColor, smoothstep(0.25, 0.65, t));
    color      = mix(color,          snowColor, smoothstep(0.65, 1.00, t));

    vec3  lightDir = normalize(vec3(0.55, 1.0, 0.45));
    float diff     = max(dot(vNormal, lightDir), 0.0) * 0.65 + 0.35;

    gl_FragColor = vec4(color * diff, 1.0);
  }
`;
