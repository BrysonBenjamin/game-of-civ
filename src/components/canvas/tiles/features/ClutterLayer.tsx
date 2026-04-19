"use client";

import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "@/store/useGameStore";
import { buildClutterBatches, buildInstancedMesh } from "../systems/ClutterEngine";
import { useHeightmap } from "../systems/HeightmapContext";

// Renders GPU-instanced surface clutter (trees, reeds) for the entire map.
// Placed at HexGrid level to avoid per-tile React component overhead.
export default function ClutterLayer() {
  const map       = useGameStore((s) => s.state.map);
  const heightmap = useHeightmap();
  const groupRef  = useRef<THREE.Group>(null);

  const meshes = useMemo(() => {
    const batches = buildClutterBatches(map, heightmap);
    return batches.map((b) => buildInstancedMesh(b));
  }, [map, heightmap]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    // Clear previous and add new
    while (group.children.length) group.remove(group.children[0]);
    meshes.forEach((m) => group.add(m));
    return () => {
      while (group.children.length) group.remove(group.children[0]);
    };
  }, [meshes]);

  return <group ref={groupRef} />;
}
