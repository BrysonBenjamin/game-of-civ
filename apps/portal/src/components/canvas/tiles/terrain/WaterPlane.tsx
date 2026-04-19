"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useHeightmap } from "../systems/HeightmapContext";
import { waterPlaneVert, waterPlaneFrag } from "../shaders/waterPlane";
import { ELEV_SCALE, WATER_LEVEL } from "../systems/HeightmapSystem";

export default function WaterPlane() {
  const heightmap = useHeightmap();

  const { geo, mat, cx, cz } = useMemo(() => {
    if (!heightmap) return { geo: null, mat: null, cx: 0, cz: 0 };

    const rangeX = heightmap.worldMax.x - heightmap.worldMin.x;
    const rangeZ = heightmap.worldMax.y - heightmap.worldMin.y;

    const g = new THREE.PlaneGeometry(rangeX, rangeZ, 1, 1);
    const m = new THREE.ShaderMaterial({
      vertexShader:   waterPlaneVert,
      fragmentShader: waterPlaneFrag,
      uniforms: {
        u_heightmap:  { value: heightmap.texture },
        u_waterLevel: { value: WATER_LEVEL },
        u_elevScale:  { value: ELEV_SCALE },
        u_worldMin:   { value: heightmap.worldMin },
        u_worldMax:   { value: heightmap.worldMax },
        u_time:       { value: 0 },
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    return {
      geo: g,
      mat: m,
      cx: heightmap.worldMin.x + rangeX * 0.5,
      cz: heightmap.worldMin.y + rangeZ * 0.5,
    };
  }, [heightmap]);

  useFrame((_, delta) => {
    if (mat) mat.uniforms.u_time.value += delta;
  });

  if (!geo || !mat) return null;

  return (
    <mesh
      geometry={geo}
      material={mat}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[cx, WATER_LEVEL, cz]}
    />
  );
}
