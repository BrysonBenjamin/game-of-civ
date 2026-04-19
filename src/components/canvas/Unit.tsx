"use client";

import { useMemo } from "react";
import type { Unit as UnitType } from "@/engine/types";
import { parseHexKey } from "@/engine/types";

const HEX_SIZE = 1;

/** Convert axial (q, r) to world-space (x, z) for flat-top hexes. */
function axialToWorld(q: number, r: number): [number, number, number] {
  const x = HEX_SIZE * (3 / 2) * q;
  const z = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, 0.4, z];
}

interface UnitMeshProps {
  unit: UnitType;
  color: string;
  selected: boolean;
  onClick: () => void;
}

/**
 * Placeholder 3D mesh for a game unit.
 * WARRIOR → box, SETTLER → cylinder, ARCHER → cone, SCOUT → sphere, default → sphere.
 */
export default function UnitMesh({ unit, color, selected, onClick }: UnitMeshProps) {
  const position = useMemo(() => {
    const coord = parseHexKey(unit.position);
    return axialToWorld(coord.q, coord.r);
  }, [unit.position]);

  const geometry = useMemo(() => {
    switch (unit.type_id) {
      case "WARRIOR":
        return <boxGeometry args={[0.3, 0.3, 0.3]} />;
      case "SETTLER":
        return <cylinderGeometry args={[0.15, 0.15, 0.35, 8]} />;
      case "ARCHER":
        return <coneGeometry args={[0.18, 0.4, 8]} />;
      case "SCOUT":
        return <sphereGeometry args={[0.18, 12, 12]} />;
      default:
        return <sphereGeometry args={[0.18, 12, 12]} />;
    }
  }, [unit.type_id]);

  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {geometry}
      <meshStandardMaterial
        color={color}
        emissive={selected ? "#facc15" : "#000000"}
        emissiveIntensity={selected ? 0.6 : 0}
      />
    </mesh>
  );
}
