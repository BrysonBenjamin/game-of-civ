'use client';

import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/canvas/Scene'), {
  ssr: false,
  loading: () => <div className="block w-full flex-1 bg-[#2C1A0E]" />,
});

export function GameCanvas() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <Scene />
    </div>
  );
}

// WebGPU renderer factory — used by Scene.tsx Canvas gl prop.
// forceWebGL=true uses the WebGL2 backend synchronously (no async init),
// while still supporting MeshStandardNodeMaterial and TSL.
export { createWebGPURenderer } from '@/components/canvas/webgpuRenderer';
