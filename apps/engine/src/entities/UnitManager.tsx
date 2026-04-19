import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

interface UnitManagerProps {
  units: any[];
  worldScale: number;
}

function EngineUnit({ unit, worldScale }: { unit: any; worldScale: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const targetPos = useMemo(() => {
    const coord = unit.position; // assuming HexId split string logic
    // simplified flat mapping for now, assuming unit.coord exists in payload
    const q = unit.coord?.q ?? 0;
    const r = unit.coord?.r ?? 0;
    const x = worldScale * (3 / 2) * q;
    const z = worldScale * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return new THREE.Vector3(x, 0.4, z);
  }, [unit, worldScale]);

  useFrame(() => {
    if (!meshRef.current) return;
    // Visually lerp to target position on the WebGPU frame without triggering React reconciliations
    meshRef.current.position.lerp(targetPos, 0.12);
  });

  return (
    <mesh ref={meshRef} position={targetPos}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color="#ef4444" roughness={0.3} />
    </mesh>
  );
}

export function UnitManager({ units, worldScale }: UnitManagerProps) {
  if (!units || !units.length) return null;
  return (
    <group>
      {units.map((u) => (
        <EngineUnit key={u.unit_id} unit={u} worldScale={worldScale} />
      ))}
    </group>
  );
}
