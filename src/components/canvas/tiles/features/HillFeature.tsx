"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { axialToWorld, resolveTileColor } from "../../design/DesignTokens";
import type { BaseTerrainType } from "@/engine/types";
import { heightStampVert, heightStampFrag } from "../shaders/heightStamp";
import { useHeightmap } from "../systems/HeightmapContext";

interface HillFeatureProps {
  q: number;
  r: number;
  baseTerrain: BaseTerrainType;
  baseElevation: number;
}

export default function HillFeature({ q, r, baseTerrain, baseElevation }: HillFeatureProps) {
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
      u_elevScale:   { value: 0.5 },
      u_terrainColor:{ value: new THREE.Color(resolveTileColor(baseTerrain, "hills")) },
    };
  }, [heightmap, wx, wz, baseTerrain]);

  if (!heightmap || !uniforms) return null;

  return (
    <mesh position={[0, baseElevation, 0]} rotation={[0, Math.PI / 6, 0]}>
      <sphereGeometry args={[0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
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
