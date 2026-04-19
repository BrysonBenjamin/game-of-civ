"use client";

/**
 * @module SelectionRing
 * @description Compass-gold pulsing glow ring under the selected unit.
 *
 * DESIGN RULE: This component receives only position data as props.
 * It contains NO game logic.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "@/store/useGameStore";
import { axialToWorld, tileElevation, Palette } from "../design/DesignTokens";
import { parseHexKey } from "@/engine/types";
import type { TerrainFeature } from "@/engine/types";

export default function SelectionRing() {
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const units = useGameStore((s) => s.state.units);
  const map = useGameStore((s) => s.state.map);
  const ringRef = useRef<THREE.Mesh>(null);

  const selectedUnit = useMemo(
    () => (selectedUnitId ? units.find((u) => u.unit_id === selectedUnitId) : null),
    [selectedUnitId, units]
  );

  const position = useMemo(() => {
    if (!selectedUnit) return null;
    const coord = parseHexKey(selectedUnit.position);
    const tile = map[selectedUnit.position];
    const feature: TerrainFeature = tile?.feature ?? "none";
    const elevation = tileElevation(feature);
    return axialToWorld(coord.q, coord.r, elevation + 0.05);
  }, [selectedUnit, map]);

  // Pulse animation
  useFrame(({ clock }) => {
    if (!ringRef.current || !position) return;
    const pulse = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.3;
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    ringRef.current.rotation.z = clock.elapsedTime * 0.5;
  });

  if (!position) return null;

  return (
    <mesh
      ref={ringRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.55, 0.75, 6]} />
      <meshBasicMaterial
        color={Palette.compassGold}
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
