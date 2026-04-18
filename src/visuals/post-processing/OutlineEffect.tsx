'use client';

import { Bloom } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

// Blooms any saffron (#FFB81C) mesh whose emissive intensity > 0.
// Targets high-luminance pixels — saffron on dark backgrounds clears the 0.4 threshold.
export function OutlineEffect() {
  return (
    <Bloom
      luminanceThreshold={0.4}
      luminanceSmoothing={0.9}
      intensity={1.5}
      blendFunction={BlendFunction.SCREEN}
      kernelSize={KernelSize.MEDIUM}
    />
  );
}
