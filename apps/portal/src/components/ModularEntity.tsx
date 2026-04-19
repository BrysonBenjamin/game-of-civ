'use client';
/* eslint-disable react-compiler/react-compiler */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hexToWorld } from '@/game/hex/types';
import type { GameEntity } from '@/store/gameStore';
import type { VisualManifest } from '@/visuals/factory/AssetLoader';

interface ModularEntityProps {
  entity: GameEntity;
  manifest: VisualManifest;
}

const LERP_SPEED = 8;

export function ModularEntity({ entity, manifest }: ModularEntityProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3());

  const { x, z } = hexToWorld(entity.hexQ, entity.hexR);
  targetPos.current.set(x, manifest.yOffset, z);

  useFrame((_state, dt) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, LERP_SPEED * dt);
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow scale={manifest.baseScale}>
        <boxGeometry args={[4, 8, 4]} />
        <meshStandardMaterial
          color={entity.isSelected ? manifest.selectionColor : '#4a7c59'}
          emissive={entity.isSelected ? manifest.selectionColor : '#000000'}
          emissiveIntensity={entity.isSelected ? manifest.glowIntensity : 0}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}
