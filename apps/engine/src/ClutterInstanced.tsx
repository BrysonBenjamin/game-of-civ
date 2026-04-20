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

export default function ClutterInstanced({ mapData }: { mapData: Record<string, any> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const treeBatch = useMemo(() => {
    const instances: ClutterInstance[] = [];
    const tiles = Object.values(mapData);

    let seedBase = 0;
    for (const tile of tiles) {
      seedBase += 1;
      
      const feat = tile.feature;
      // Only processing woods based on prompt scope (rainforest can be appended iteratively)
      if (feat === 'woods' || feat === 'rainforest') {
        const [cx, cz] = axialToWorld(tile.coord.q, tile.coord.r, HexConstants.SIZE);
        
        // 3 hero trees, 2 edge trees
        const total = 5;
        for (let i = 0; i < total; i++) {
          const isHero = i < 3;
          const spread = isHero ? 0.30 : 0.62;
          const angle = seededRand(seedBase + i * 3) * Math.PI * 2;
          const radius = seededRand(seedBase + i * 3 + 1) * spread;
          const rot = seededRand(seedBase + i * 3 + 2) * Math.PI * 2;
          const scl = isHero
            ? 0.85 + seededRand(seedBase + i * 3 + 2) * 0.30
            : 0.50 + seededRand(seedBase + i * 3 + 2) * 0.30;
          
          instances.push({
            position: new THREE.Vector3(cx + Math.cos(angle) * radius, 0, cz + Math.sin(angle) * radius),
            rotation: rot,
            scale: scl,
          });
        }
      }
    }
    return instances;
  }, [mapData]);

  // Set the Instance Matrices dynamically using an Object3D generator
  useLayoutEffect(() => {
    if (!meshRef.current || treeBatch.length === 0) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    treeBatch.forEach(({ position, rotation, scale }, i) => {
      dummy.position.copy(position);
      // Lift geometry pivot explicitly for trees mapping to ClutterEngine format
      dummy.position.y += 0.225;
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
      {/* Flat shading standard material mimicking ClutterEngine */}
      <meshStandardMaterial color="#1e5c1e" roughness={0.85} flatShading={true} />
    </instancedMesh>
  );
}
