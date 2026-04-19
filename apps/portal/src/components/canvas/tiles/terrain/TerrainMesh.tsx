"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "@/store/useGameStore";
import { useHeightmap } from "../systems/HeightmapContext";
import { useSplatmap } from "../systems/SplatmapContext";
import { buildTerrainNodeMaterial } from "../shaders/terrainNode";
import { worldToHex } from "../core/worldToHex";
import { sampleHeight } from "../systems/HeightmapSystem";
import type { HeightmapResult } from "../systems/HeightmapSystem";

interface TerrainMeshProps {
  onTileClick: (hexId: string, unitIds: string[]) => void;
}

/**
 * Build terrain geometry with heights pre-baked from the CPU heightmap.
 * Adds a `vHeight` Float32 attribute for use by the TSL colorNode (snow cap,
 * fog-of-war detection). Normals are computed from the displaced surface.
 */
function buildTerrainGeo(
  worldMin: THREE.Vector2,
  worldMax: THREE.Vector2,
  heightmap: HeightmapResult,
  segsX = 150,
  segsZ = 150,
): THREE.BufferGeometry {
  const nx = segsX + 1;
  const nz = segsZ + 1;
  const positions = new Float32Array(nx * nz * 3);
  const uvs       = new Float32Array(nx * nz * 2);
  const heights   = new Float32Array(nx * nz);
  const indices: number[] = [];

  const rangeX = worldMax.x - worldMin.x;
  const rangeZ = worldMax.y - worldMin.y;

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const vi = iz * nx + ix;
      const u  = ix / segsX;
      const v  = iz / segsZ;
      const wx = worldMin.x + u * rangeX;
      const wz = worldMin.y + v * rangeZ;
      const h  = sampleHeight(wx, wz, heightmap);

      positions[vi * 3 + 0] = wx;
      positions[vi * 3 + 1] = h;
      positions[vi * 3 + 2] = wz;

      uvs[vi * 2 + 0] = u;
      uvs[vi * 2 + 1] = v;

      heights[vi] = h;
    }
  }

  for (let iz = 0; iz < segsZ; iz++) {
    for (let ix = 0; ix < segsX; ix++) {
      const a = iz * nx + ix;
      const b = iz * nx + ix + 1;
      const c = (iz + 1) * nx + ix;
      const d = (iz + 1) * nx + ix + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv",       new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("vHeight",  new THREE.BufferAttribute(heights, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export default function TerrainMesh({ onTileClick }: TerrainMeshProps) {
  const map       = useGameStore((s) => s.state.map);
  const heightmap = useHeightmap();
  const splatmap  = useSplatmap();
  const meshRef   = useRef<THREE.Mesh>(null);

  const geo = useMemo(() => {
    if (!heightmap) return null;
    return buildTerrainGeo(heightmap.worldMin, heightmap.worldMax, heightmap);
  }, [heightmap]);

  const matResult = useMemo(() => {
    if (!heightmap || !splatmap) return null;
    return buildTerrainNodeMaterial(heightmap.texture, splatmap.texture);
  }, [heightmap, splatmap]);

  if (!geo || !matResult) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      material={matResult.material}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        const hexId = worldToHex(e.point.x, e.point.z, map);
        if (hexId) {
          const tile = map[hexId];
          onTileClick(hexId, tile?.unitIds ?? []);
        }
      }}
    />
  );
}
