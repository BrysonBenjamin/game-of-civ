'use client';

import { type ReactNode } from 'react';
import { EffectComposer } from '@react-three/postprocessing';
import { TiltShift } from '@/visuals/post-processing/TiltShift';
import { OutlineEffect } from '@/visuals/post-processing/OutlineEffect';

interface StageProps {
  children: ReactNode;
}

export function Stage({ children }: StageProps) {
  return (
    <>
      {/* Parchment-tinted sky for Age of Discovery feel */}
      <color attach="background" args={['#C8B898']} />
      <fogExp2 attach="fog" args={['#C8B898', 0.0006]} />

      {/* Golden-hour sun — warm primary light */}
      <directionalLight
        color="#FFF0D0"
        intensity={1.4}
        position={[100, 200, 80]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={800}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />

      {/* Warm earth fill — ochre ground bounce */}
      <directionalLight color="#8A6A3A" intensity={0.25} position={[-50, 40, -80]} />

      {/* Soft ambient so nothing is fully black */}
      <ambientLight color="#ffffff" intensity={0.5} />

      {children}

      <EffectComposer>
        <TiltShift />
        <OutlineEffect />
      </EffectComposer>
    </>
  );
}
