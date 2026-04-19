'use client';

import { Canvas } from '@react-three/fiber';
import { Stage } from '@/components/Stage';
import { HexMap } from '@/components/HexMap';
import { CameraController } from '@/components/CameraController';
import { EntityFactory } from '@/visuals/factory/EntityFactory';

export function Scene() {
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
      camera={{ fov: 35, near: 1, far: 5000 }}
      shadows
      gl={{ antialias: true }}
    >
      <Stage>
        <HexMap radius={12} />
        <EntityFactory />
        <CameraController />
      </Stage>
    </Canvas>
  );
}
