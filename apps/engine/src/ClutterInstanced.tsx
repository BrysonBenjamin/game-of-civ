import { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { HexConstants } from './constants';
import { axialToWorld } from '@civ/math';

function seededRand(seed: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

interface ClutterInstance {
  position: THREE.Vector3;
  rotation: number;
  scale: number;
}

interface ClutterInstancedProps {
  mapData: Record<string, unknown>;
  // CPU terrain sampler — when present, trees are lifted to the terrain surface.
  // Provided by App.tsx once the heightmap compute pass completes.
  heightSampler?: (worldX: number, worldZ: number) => number;
}

export default function ClutterInstanced({ mapData, heightSampler }: ClutterInstancedProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const treeBatch = useMemo(() => {
    const instances: ClutterInstance[] = [];
    const tiles = Object.values(mapData) as Array<{
      feature: string;
      coord: { q: number; r: number };
    }>;

    let seedBase = 0;
    for (const tile of tiles) {
      seedBase += 1;
      const feat = tile.feature;
      if (feat === 'woods' || feat === 'rainforest') {
        const [cx, cz] = axialToWorld(tile.coord.q, tile.coord.r, HexConstants.SIZE);
        const total = 5; // 3 hero trees + 2 edge trees
        for (let i = 0; i < total; i++) {
          const isHero = i < 3;
          const spread = isHero ? 0.30 : 0.62;
          const angle  = seededRand(seedBase + i * 3)     * Math.PI * 2;
          const radius = seededRand(seedBase + i * 3 + 1) * spread;
          const rot    = seededRand(seedBase + i * 3 + 2) * Math.PI * 2;
          const scl    = isHero
            ? 0.85 + seededRand(seedBase + i * 3 + 2) * 0.30
            : 0.50 + seededRand(seedBase + i * 3 + 2) * 0.30;
          const tx = cx + Math.cos(angle) * radius;
          const tz = cz + Math.sin(angle) * radius;
          const ty = heightSampler ? heightSampler(tx, tz) : 0;
          instances.push({ position: new THREE.Vector3(tx, ty, tz), rotation: rot, scale: scl });
        }
      }
    }
    return instances;
  }, [mapData, heightSampler]);

  useLayoutEffect(() => {
    if (!meshRef.current || treeBatch.length === 0) return;
    const mesh  = meshRef.current;
    const dummy = new THREE.Object3D();
    treeBatch.forEach(({ position, rotation, scale }, i) => {
      dummy.position.copy(position);
      dummy.position.y += 0.225; // lift to tree base from geometry pivot
      dummy.rotation.set(0, rotation, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [treeBatch]);

  if (treeBatch.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, treeBatch.length]} castShadow receiveShadow>
      <coneGeometry args={[0.28, 0.45, 5]} />
      <meshStandardMaterial color="#1e5c1e" roughness={0.85} flatShading={true} />
    </instancedMesh>
  );
}
