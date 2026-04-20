import * as THREE from 'three';
import { useMemo } from 'react';
import { hexNeighbours } from '@civ/logic';
import { axialToWorld } from '@civ/math';

// Extracted from engine payload shape
interface SplineManagerProps {
  mapData: Record<string, any>; // Represents the parsed Record<HexId, Tile> payload
  worldScale: number;
}

export function SplineManager({ mapData, worldScale }: SplineManagerProps) {
  const tubes = useMemo(() => {
    const rawIds = Object.keys(mapData);
    if (!rawIds.length) return [];

    const riverEdges = new Set<string>();

    for (const hexId of rawIds) {
      const tile = mapData[hexId];
      if (tile.baseTerrain === "ocean") continue;

      for (const nId of hexNeighbours(tile.coord)) {
        const nTile = mapData[nId];
        if (nTile?.baseTerrain === "ocean") {
          const edgeId = hexId < nId ? `${hexId}|${nId}` : `${nId}|${hexId}`;
          riverEdges.add(edgeId);
        }
      }
    }

    if (riverEdges.size === 0) return [];

    // Derive world positions 
    const pts: THREE.Vector3[] = [];
    for (const edgeId of riverEdges) {
      const [aId, bId] = edgeId.split("|");
      const a = mapData[aId];
      const b = mapData[bId];
      
      const [ax, az] = axialToWorld(a.coord.q, a.coord.r, worldScale);
      const [bx, bz] = axialToWorld(b.coord.q, b.coord.r, worldScale);
      
      pts.push(new THREE.Vector3((ax + bx) / 2, 0.05, (az + bz) / 2));
    }

    pts.sort((a, b) => a.x - b.x);
    if (pts.length < 2) return [];

    const spline = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    return [new THREE.TubeGeometry(spline, 32, 0.05, 4, false)];
  }, [mapData, worldScale]);

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh key={i} geometry={geo} position={[0, 0.05, 0]}>
          <meshStandardMaterial color="#1A4A7A" roughness={0.1} metalness={0.3} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
