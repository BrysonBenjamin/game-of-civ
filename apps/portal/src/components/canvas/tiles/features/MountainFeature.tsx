"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { axialToWorld } from "../../design/DesignTokens";
import { heightStampVert, heightStampFrag } from "../shaders/heightStamp";
import { useHeightmap } from "../systems/HeightmapContext";

interface MountainFeatureProps {
  q: number;
  r: number;
  baseElevation: number;
}

export default function MountainFeature({ q, r, baseElevation }: MountainFeatureProps) {
  const heightmap = useHeightmap();
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [wx, , wz] = useMemo(() => axialToWorld(q, r, 0), [q, r]);

  const uniforms = useMemo(() => {
    if (!heightmap) return null;
    return {
      u_heightmap:   { value: heightmap.texture },
      u_worldOffset: { value: new THREE.Vector2(wx, wz) },
      u_worldMin:    { value: heightmap.worldMin },
      u_worldMax:    { value: heightmap.worldMax },
      u_elevScale:   { value: 1.2 },
      u_terrainColor:{ value: new THREE.Color("#5B5B5B") },
    };
  }, [heightmap, wx, wz]);

  if (!heightmap || !uniforms) return null;

  return (
    // Peak dome mesh sits above the base tile cylinder
    <mesh position={[0, baseElevation, 0]} rotation={[0, Math.PI / 6, 0]}>
      <sphereGeometry args={[0.85, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={heightStampVert}
        fragmentShader={heightStampFrag}
        uniforms={uniforms}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
