"use client";

/**
 * @module MovePath
 * @description Dashed line showing path from selected unit to hovered tile.
 *
 * Currently renders a line from the selected unit's position to adjacent
 * tiles that are valid movement targets. This will expand to show full
 * pathfinding results when the pathfinding system is implemented.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useGameStore } from "@/store/useGameStore";
import { axialToWorld, tileElevation, Palette } from "../design/DesignTokens";
import { parseHexKey, hexNeighbours } from "@/engine/types";
import type { TerrainFeature } from "@/engine/types";

export default function MovePath() {
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const units = useGameStore((s) => s.state.units);
  const map = useGameStore((s) => s.state.map);

  const selectedUnit = useMemo(
    () => (selectedUnitId ? units.find((u) => u.unit_id === selectedUnitId) : null),
    [selectedUnitId, units]
  );

  // Compute reachable neighbour positions
  const pathPoints = useMemo(() => {
    if (!selectedUnit || selectedUnit.movement_remaining <= 0) return [];

    const coord = parseHexKey(selectedUnit.position);
    const neighbours = hexNeighbours(coord);

    const lines: [THREE.Vector3, THREE.Vector3][] = [];

    const originTile = map[selectedUnit.position];
    const originFeature: TerrainFeature = originTile?.feature ?? "none";
    const originElev = tileElevation(originFeature);
    const originWorld = axialToWorld(coord.q, coord.r, originElev + 0.15);
    const originVec = new THREE.Vector3(...originWorld);

    for (const nId of neighbours) {
      const tile = map[nId];
      if (!tile) continue;
      if (tile.baseTerrain === "ocean" && !selectedUnit.tags.includes("double_movement_on_water")) continue;
      if (tile.feature === "mountains") continue;

      const nCoord = parseHexKey(nId);
      const nElev = tileElevation(tile.feature);
      const nWorld = axialToWorld(nCoord.q, nCoord.r, nElev + 0.15);
      lines.push([originVec.clone(), new THREE.Vector3(...nWorld)]);
    }

    return lines;
  }, [selectedUnit, map]);

  if (pathPoints.length === 0) return null;

  return (
    <group>
      {pathPoints.map((pair, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pair);
        const mat = new THREE.LineDashedMaterial({
          color: Palette.dataCyan,
          dashSize: 0.15,
          gapSize: 0.1,
          transparent: true,
          opacity: 0.4,
        });
        const lineObj = new THREE.Line(geo, mat);
        lineObj.computeLineDistances();
        return <primitive key={i} object={lineObj} />;
      })}
    </group>
  );
}
