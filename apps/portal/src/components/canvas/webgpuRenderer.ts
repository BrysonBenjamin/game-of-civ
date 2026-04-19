import { WebGPURenderer } from "three/webgpu";

/**
 * Factory for R3F Canvas `gl` prop.
 * Uses WebGPURenderer with the WebGL2 backend (`forceWebGL: true`) so
 * MeshStandardNodeMaterial / TSL work without requiring a real WebGPU GPU.
 * The synchronous WebGL2 path means no async renderer.init() is needed,
 * keeping it compatible with R3F's renderer lifecycle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWebGPURenderer(props: any): WebGPURenderer {
  return new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true, forceWebGL: true });
}
