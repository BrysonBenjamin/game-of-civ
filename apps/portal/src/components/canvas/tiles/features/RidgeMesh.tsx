"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useSplines } from "../systems/SplineContext";

// Renders Catmull-Rom ridge splines as tube meshes above mountain chains.
export default function RidgeMesh() {
  const splines = useSplines();

  const tubes = useMemo(() => {
    if (!splines?.ridgeSplines.length) return [];
    return splines.ridgeSplines.map((curve, i) => {
      const geo = new THREE.TubeGeometry(curve, 24, 0.08, 5, false);
      return { geo, key: i };
    });
  }, [splines]);

  if (!tubes.length) return null;

  return (
    <group>
      {tubes.map(({ geo, key }) => (
        <mesh key={key} geometry={geo} position={[0, 0.6, 0]}>
          <meshStandardMaterial color="#5B5555" roughness={0.9} metalness={0.0} flatShading />
        </mesh>
      ))}
    </group>
  );
}
