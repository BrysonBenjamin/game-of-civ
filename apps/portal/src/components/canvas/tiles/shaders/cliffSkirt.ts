/**
 * @module cliffSkirt
 * @description Triplanar mapping shader for vertical cliff-skirt geometry.
 * Samples rock texture from world X or Z axis to prevent top-down UV stretching
 * across the near-vertical faces of cliff edges.
 */

export const cliffSkirtVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 worldPos    = modelMatrix * vec4(position, 1.0);
    vWorldPos        = worldPos.xyz;
    vNormal          = normalize(normalMatrix * normal);
    gl_Position      = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const cliffSkirtFrag = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    // Triplanar mapping — sample rock pattern from world X and Z axes
    vec3 n = abs(vNormal);

    // Procedural rock texture via hash noise on world coords
    vec2 uvX = vWorldPos.zy * 2.5;
    vec2 uvZ = vWorldPos.xy * 2.5;

    float nX = fract(sin(dot(uvX, vec2(127.1, 311.7))) * 43758.5453);
    float nZ = fract(sin(dot(uvZ, vec2(127.1, 311.7))) * 43758.5453);

    vec3 rockLight = vec3(0.52, 0.48, 0.42);
    vec3 rockDark  = vec3(0.28, 0.25, 0.20);

    vec3 cX = mix(rockDark, rockLight, nX);
    vec3 cZ = mix(rockDark, rockLight, nZ);

    // Blend X/Z contributions by how close the normal is to each axis
    float totalW = n.x + n.z + 0.001;
    vec3 color = (cX * n.x + cZ * n.z) / totalW;

    // Lambert diffuse
    vec3 lightDir = normalize(vec3(0.55, 1.0, 0.45));
    float diff    = max(dot(vNormal, lightDir), 0.0) * 0.65 + 0.35;

    gl_FragColor = vec4(color * diff, 1.0);
  }
`;
