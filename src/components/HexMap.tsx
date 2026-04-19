'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { HEX_SIZE, hexToWorld } from '@/game/hex/types';

interface HexMapProps {
  radius?: number;
}

// Procedural terrain color using hex coordinates as seed — Age of Discovery palette
function terrainColor(q: number, r: number): THREE.Color {
  const s = -q - r;
  // Deterministic hash from cube coordinates
  const h = ((q * 1619 + r * 31337 + s * 6271) & 0x7fffffff) / 0x7fffffff;
  const h2 = ((q * 7919 + r * 4093 + s * 2357) & 0x7fffffff) / 0x7fffffff;
  const distFromCenter = Math.sqrt(q * q + r * r + s * s) / 2;

  // Ocean ring at the outer edge
  if (distFromCenter > 9.5) return new THREE.Color(0x1A4A7A);
  if (distFromCenter > 8.5) return new THREE.Color(0x2E6BAA);

  // Biome palette — Age of Discovery saturated terrain
  const biomes = [
    new THREE.Color(0x4A8A3A),  // grassland — vivid green
    new THREE.Color(0x8BA850),  // plains — golden green
    new THREE.Color(0x5A8A78),  // tundra — muted teal
    new THREE.Color(0xD4A850),  // desert — warm ochre
    new THREE.Color(0x2D5A2E),  // forest — dark green
    new THREE.Color(0x5B5B5B),  // mountains — grey
    new THREE.Color(0x4A8A3A),  // grassland again (weighted)
    new THREE.Color(0x8BA850),  // plains again (weighted)
  ];

  const base = biomes[Math.floor(h * biomes.length)];

  // Subtle shade variation using second hash
  const shade = 0.88 + h2 * 0.24;
  return new THREE.Color(base.r * shade, base.g * shade, base.b * shade);
}

export function HexMap({ radius = 12 }: HexMapProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const selectEntity = useGameStore((s) => s.selectEntity);

  const { count, matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];

    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (Math.abs(q + r) > radius) continue;
        const { x, z } = hexToWorld(q, r);
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.PI / 6;
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
        colors.push(terrainColor(q, r));
      }
    }
    return { count: matrices.length, matrices, colors };
  }, [radius]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    colors.forEach((col, i) => mesh.setColorAt(i, col));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      receiveShadow
      castShadow
      onPointerDown={(e) => {
        e.stopPropagation();
        selectEntity(null);
      }}
    >
      {/* Radius = 1.005× circumradius for sub-pixel overlap — eliminates WebGL seam bleed */}
      <cylinderGeometry args={[HEX_SIZE * 1.005, HEX_SIZE * 1.005, 2, 6]} />
      <meshStandardMaterial
        roughness={0.85}
        metalness={0.0}
        vertexColors
      />
    </instancedMesh>
  );
}
