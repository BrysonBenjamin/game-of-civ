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
      <color attach="background" args={['#001F3F']} />
      <fogExp2 attach="fog" args={['#001F3F', 0.0008]} />

      {/* Warm sun — primary shadow caster */}
      <directionalLight
        color="#FFF4E0"
        intensity={1.2}
        position={[100, 200, 100]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={800}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />

      {/* Cool navy fill — softens opposite-side shadows */}
      <directionalLight color="#3A5A8A" intensity={0.3} position={[-50, 80, -80]} />

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
