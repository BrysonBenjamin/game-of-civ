'use client';

import { Bloom } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

// Blooms high-luminance emissive meshes (compass gold selection glow).
// Higher threshold for parchment background — avoids blooming terrain highlights.
export function OutlineEffect() {
  return (
    <Bloom
      luminanceThreshold={0.65}
      luminanceSmoothing={0.85}
      intensity={0.8}
      blendFunction={BlendFunction.SCREEN}
      kernelSize={KernelSize.MEDIUM}
    />
  );
}
