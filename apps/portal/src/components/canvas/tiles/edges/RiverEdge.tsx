"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld, tileElevation } from "../../design/DesignTokens";
import { hexNeighbours, parseHexKey } from "@/engine/helpers/hexMath";
import { buildRiverSplines, makeEdgeId } from "../systems/SplineEngine";

interface RiverEdgeProps {
  map: Record<HexId, Tile>;
}

// Carve river channels along any ocean-adjacent non-ocean tile boundary.
// The channel is a thin tube geometry at y=0.05 (water surface).
export default function RiverEdge({ map }: RiverEdgeProps) {
  const tubes = useMemo(() => {
    // Collect candidate river edges: boundary between ocean and non-ocean
    const riverEdges = new Set<ReturnType<typeof makeEdgeId>>();
    for (const tile of Object.values(map)) {
      if (tile.baseTerrain === "ocean") continue;
      for (const nId of hexNeighbours(tile.coord)) {
        const nTile = map[nId];
        if (nTile?.baseTerrain === "ocean") {
          riverEdges.add(makeEdgeId(tile.hex_id, nId));
        }
      }
    }

    const splines = buildRiverSplines([...riverEdges], map);
    return splines.map((curve, i) => ({
      geo: new THREE.TubeGeometry(curve, 32, 0.05, 4, false),
      key: i,
    }));
  }, [map]);

  if (!tubes.length) return null;

  return (
    <group>
      {tubes.map(({ geo, key }) => (
        <mesh key={key} geometry={geo} position={[0, 0.05, 0]}>
          <meshStandardMaterial color="#1A4A7A" roughness={0.1} metalness={0.3} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
