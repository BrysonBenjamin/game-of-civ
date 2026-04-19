'use client';

import { DepthOfField } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export function TiltShift() {
  return (
    <DepthOfField
      focusDistance={0.02}
      focalLength={0.15}
      bokehScale={2.0}
      blendFunction={BlendFunction.NORMAL}
    />
  );
}
