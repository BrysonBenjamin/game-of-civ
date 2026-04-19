"use client";

/**
 * @module OceanTile
 * @description Animated hex tile for ocean terrain — Gerstner-style wave vertex shader
 * + caustic fragment pattern. Replaces the static BaseTile for baseTerrain === "ocean".
 */

import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { axialToWorld, HexConstants } from "../../design/DesignTokens";

const oceanVert = /* glsl */ `
  uniform float u_time;
  varying vec2  vUv;
  varying vec3  vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Animate only the top face (y is positive on a CylinderGeometry top cap)
    if (pos.y > 0.05) {
      pos.y += sin(pos.x * 3.2 + u_time * 1.4) * 0.018;
      pos.y += sin(pos.z * 2.5 + u_time * 0.9) * 0.012;
      pos.y += sin((pos.x + pos.z) * 1.8 + u_time * 1.1) * 0.009;
    }

    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const oceanFrag = /* glsl */ `
  uniform float u_time;
  uniform float u_fogFactor;

  varying vec2 vUv;

  void main() {
    // Animated caustic pattern
    vec2  uv    = vUv * 5.5;
    float wave  = sin(uv.x * 2.1 + u_time * 1.3) * sin(uv.y * 1.7 + u_time * 0.8);
    float wave2 = sin(uv.x * 3.0 - u_time * 0.6) * sin(uv.y * 2.4 + u_time * 1.0);
    float blend = wave * 0.5 + wave2 * 0.25 + 0.5;

    vec3 deep    = vec3(0.10, 0.29, 0.48);
    vec3 shallow = vec3(0.18, 0.42, 0.67);
    vec3 oceanColor = mix(deep, shallow, clamp(blend * 0.45, 0.0, 1.0));

    // Parchment for unexplored, blended for explored
    vec3 parch = vec3(0.96, 0.90, 0.75);
    vec3 color;
    if (u_fogFactor < 0.25) {
      color = parch;
    } else if (u_fogFactor < 0.75) {
      float t = (u_fogFactor - 0.25) / 0.5;
      // Explored ocean: desaturated blue
      vec3 lum = vec3(dot(oceanColor, vec3(0.299, 0.587, 0.114)) * 0.7);
      color = mix(lum + parch * 0.3, oceanColor, t * 0.5);
    } else {
      color = oceanColor;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface OceanTileProps {
  q: number;
  r: number;
  fogFactor: number;
  onClick: () => void;
}

export default function OceanTile({ q, r, fogFactor, onClick }: OceanTileProps) {
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => axialToWorld(q, r, 0), [q, r]);
  const elevation = HexConstants.HEIGHT;

  const uniforms = useMemo(
    () => ({
      u_time:      { value: 0 },
      u_fogFactor: { value: fogFactor },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync fog factor without recreating the material
  if (matRef.current) {
    matRef.current.uniforms.u_fogFactor.value = fogFactor;
  }

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.u_time.value = clock.elapsedTime;
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh
        rotation={[0, Math.PI / 6, 0]}
        position={[0, elevation / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry
          args={[HexConstants.SIZE * 0.95, HexConstants.SIZE * 0.95, elevation, 6, 4]}
        />
        <shaderMaterial
          ref={matRef}
          vertexShader={oceanVert}
          fragmentShader={oceanFrag}
          uniforms={uniforms}
        />
      </mesh>
    </group>
  );
}
