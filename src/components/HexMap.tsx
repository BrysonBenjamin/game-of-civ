'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { HEX_SIZE, hexToWorld } from '@/game/hex/types';

interface HexMapProps {
  radius?: number;
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
        const shade =
          (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) % 2 === 0
            ? new THREE.Color(0x4a7c59)
            : new THREE.Color(0x3d6b4a);
        colors.push(shade);
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
      onPointerDown={(e) => {
        e.stopPropagation();
        selectEntity(null);
      }}
    >
      <cylinderGeometry args={[HEX_SIZE * 0.97, HEX_SIZE * 0.97, 0.5, 6]} />
      <meshStandardMaterial color={0x4a7c59} />
    </instancedMesh>
  );
}
