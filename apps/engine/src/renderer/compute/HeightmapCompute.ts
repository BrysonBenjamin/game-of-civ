import { wgslFn, textureStore, instanceIndex, vec2, float, color } from 'three/tsl';
import * as THREE from 'three';

/**
 * wgslFn strings can define arbitrary WebGPU shader logic, fully executed on the GPU.
 * This translates the @civ/math pseudo-random Gaussian noise and stamp bounds
 * into a parallelized compute shader replacing HeightmapSystem.ts.
 */
export const heightmapComputeShader = wgslFn(`
  fn hash(p: vec2<f32>) -> vec2<f32> {
      var p2 = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p2) * 43758.5453123);
  }

  fn noise2(p: vec2<f32>) -> f32 {
      let i = floor(p);
      let f = fract(p);
      let u = f * f * (3.0 - 2.0 * f);
      return mix(
          mix(dot(hash(i + vec2<f32>(0.0, 0.0)), f - vec2<f32>(0.0, 0.0)), 
              dot(hash(i + vec2<f32>(1.0, 0.0)), f - vec2<f32>(1.0, 0.0)), u.x),
          mix(dot(hash(i + vec2<f32>(0.0, 1.0)), f - vec2<f32>(0.0, 1.0)), 
              dot(hash(i + vec2<f32>(1.0, 1.0)), f - vec2<f32>(1.0, 1.0)), u.x), u.y
      );
  }
  
  fn flatFalloff(dist: f32) -> f32 {
      if (dist < 0.60) {
          return 1.0;
      }
      let t = (dist - 0.60) / 0.40;
      return 1.0 - (t * t * (3.0 - 2.0 * t));
  }

  // Define our output signature targeting a StorageTexture
  fn main(
    storeMap: textureStore_rgba8unorm, 
    coord: vec2<u32>, 
    resolution: f32
  ) {
      let fCoord = vec2<f32>(f32(coord.x), f32(coord.y));
      let uv = fCoord / resolution;
      
      // Simulate pass 1: Base falloff logic
      let dist = length(uv - vec2(0.5, 0.5)) * 2.0; 
      let baseLayer = flatFalloff(dist);
      
      // Simulate pass 2: Noise Gaussian bumps
      let bump = noise2(fCoord * 0.08) * 0.12;
      let height = min(1.0, baseLayer + bump);

      let outputColor = vec4<f32>(uv.x, height, uv.y, 1.0); // R: biome, G: height, B: feature
      
      textureStore(storeMap, coord, outputColor);
  }
`);

export function createHeightmapComputeBinding() {
  const size = 256;
  const storeTexture = new THREE.StorageTexture( size, size );
  // Note: textureStore is a TSL node representing the binding
  // This executes across a 256x256 GPU grid payload
  const computeNode = heightmapComputeShader({
    storeMap: textureStore(storeTexture),
    coord: instanceIndex,
    resolution: float(size)
  }).compute(size * size);
  
  return { storeTexture, computeNode };
}
