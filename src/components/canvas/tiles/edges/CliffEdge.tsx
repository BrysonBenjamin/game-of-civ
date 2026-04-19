"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld, tileElevation, HexConstants } from "../../design/DesignTokens";
import { hexNeighbours } from "@/engine/helpers/hexMath";
import { cliffSkirtVert, cliffSkirtFrag } from "../shaders/cliffSkirt";

const CLIFF_THRESHOLD = 0.25;  // minimum elevation delta (world units) to spawn a skirt

interface CliffEdgeProps {
  map: Record<HexId, Tile>;
}

// Generates vertical triangle-strip "skirts" between tiles with large elevation deltas.
export default function CliffEdge({ map }: CliffEdgeProps) {
  const { geometry, material } = useMemo(() => {
    const positions: number[] = [];
    const normals: number[]   = [];
    const indices: number[]   = [];
    let vi = 0;

    const HEX_R = HexConstants.SIZE * 0.95;

    // Pre-compute world positions
    const worldPos = new Map<HexId, THREE.Vector3>();
    for (const tile of Object.values(map)) {
      const [x, , z] = axialToWorld(tile.coord.q, tile.coord.r, 0);
      worldPos.set(tile.hex_id, new THREE.Vector3(x, 0, z));
    }

    const processedEdges = new Set<string>();

    for (const tile of Object.values(map)) {
      const elevA = tileElevation(tile.feature);
      const posA  = worldPos.get(tile.hex_id)!;

      for (const nId of hexNeighbours(tile.coord)) {
        const nTile = map[nId];
        if (!nTile) continue;

        const edgeKey = tile.hex_id < nId ? `${tile.hex_id}|${nId}` : `${nId}|${tile.hex_id}`;
        if (processedEdges.has(edgeKey)) continue;
        processedEdges.add(edgeKey);

        const elevB = tileElevation(nTile.feature);
        const delta = Math.abs(elevA - elevB);
        if (delta < CLIFF_THRESHOLD) continue;

        const posB = worldPos.get(nId)!;
        const mid = posA.clone().add(posB).multiplyScalar(0.5);

        // Edge midpoint, extended slightly toward each tile
        const toB = posB.clone().sub(posA).normalize();
        const edgeDir = new THREE.Vector3(-toB.z, 0, toB.x);

        const high = elevA > elevB ? elevA : elevB;
        const low  = elevA > elevB ? elevB : elevA;

        // Two quads form the skirt at the shared edge — one strip per half-edge
        for (const side of [-1, 1]) {
          const p = mid.clone().addScaledVector(edgeDir, side * HEX_R * 0.45);

          const topY    = high;
          const bottomY = low;

          const p0 = [p.x, topY,    p.z];
          const p1 = [p.x, bottomY, p.z];
          const nb = [0, 0, side];  // approximate outward normal

          positions.push(...p0, ...p1);
          normals.push(...nb, ...nb);
          if (side === -1) {
            indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
          }
          vi += 2;
        }
      }
    }

    if (!positions.length) return { geometry: null, material: null };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal",   new THREE.Float32BufferAttribute(normals, 3));
    if (indices.length) geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      vertexShader:   cliffSkirtVert,
      fragmentShader: cliffSkirtFrag,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat };
  }, [map]);

  if (!geometry || !material) return null;

  return <mesh geometry={geometry} material={material} />;
}
