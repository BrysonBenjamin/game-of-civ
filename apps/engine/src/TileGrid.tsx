import { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
  storage,
  instanceIndex,
  color,
  mix,
  positionLocal,
  vec3,
  float,
  add,
  mul,
  select,
  equal,
  texture,
  div
} from 'three/tsl';
import { HexConstants } from './constants';
import { createHeightmapComputeBinding } from './renderer/compute/HeightmapCompute';

interface TileGridProps {
  mapBuffer: Float32Array;
  count: number;
  heightmapTexture?: any;
}

// -----------------------------------------------------------------------------
// TSL Shaders
// -----------------------------------------------------------------------------

// Hex Colors mapping from terrainTypeId
// 1 = Plains, 2 = Grassland, 3 = Tundra, 4 = Desert, 5 = Ocean, 6 = Snow
const PLAINS = color('#8fbc5a');
const GRASSLAND = color('#5da84e');
const TUNDRA = color('#7a9a8a');
const DESERT = color('#d4b96a');
const OCEAN = color('#2a6ec4');
const SNOW = color('#d0dde8');
const PARCHMENT = color('#d2b48c');

export default function TileGrid({ mapBuffer, count, heightmapTexture: initialHeightmapTexture }: TileGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const heightmapTextureRef = useRef<any>(initialHeightmapTexture);
  const computeDispatchedRef = useRef(false);
  const { gl, camera } = useThree();

  // Initialize heightmap compute if not already done
  useEffect(() => {
    if (!computeDispatchedRef.current && gl && (gl as any).computeAsync) {
      const { storeTexture, computeNode } = createHeightmapComputeBinding();
      (gl as any).computeAsync(computeNode).then(() => {
        heightmapTextureRef.current = storeTexture;
        console.log('Heightmap compute shader executed');
      }).catch((err: any) => {
        console.error('Failed to execute heightmap compute:', err);
      });
      computeDispatchedRef.current = true;
    }
  }, [gl]);

  // Create the WebGPU Storage Attribute
  const bufferAttr = useMemo(() => {
    return new THREE.StorageInstancedBufferAttribute(mapBuffer, 4);
  }, [mapBuffer]);
  
  // TSL Materials are compiled once per mount
  const materialNode = useMemo(() => {
    // Read the vec4 from the storage buffer using instanceIndex
    const tileData = storage(bufferAttr, 'vec4', count).element(instanceIndex);

    // x = q, y = r, z = terrainTypeId, w = visibility
    const qNode = tileData.x;
    const rNode = tileData.y;
    const typeIdNode = tileData.z;
    const fogNode = tileData.w;

    // ─── POSITION DISPLACEMENT ───
    // Replicate our axialToWorld math in TSL (Flat-Top)
    const spacing = float(0);
    const radius = float(HexConstants.SIZE);
    const sqrt3 = float(Math.sqrt(3));

    const wNode = mul(radius, sqrt3);
    const hNode = mul(radius, 2.0);
    const wStep = add(wNode, spacing);

    // px = (q * wStep) + (r * wStep * 0.5)
    const px = add(mul(qNode, wStep), mul(rNode, mul(wStep, 0.5)));
    // pz = r * (hNode * 0.75 + spacing * 0.75)
    const pzStep = mul(add(hNode, spacing), 0.75);
    const pz = mul(rNode, pzStep);

    // ─── HEIGHT SAMPLING ───
    // Calculate UV coordinates for heightmap sampling
    // Normalize q and r to [0, 1] range for texture coordinates
    const mapScale = float(256.0);
    const halfScale = div(mapScale, 2.0);

    // u = (q + mapScale/2) / mapScale
    // v = (r + mapScale/2) / mapScale
    const u = div(add(qNode, halfScale), mapScale);
    const v = div(add(rNode, halfScale), mapScale);
    const tileUV = vec3(u, v, 0.0).xy;

    // Sample the heightmap texture
    // The heightmap stores height in the .g channel
    const heightDisplacement = heightmapTextureRef.current
      ? mul(texture(heightmapTextureRef.current, tileUV).g, float(HexConstants.ELEV_SCALE))
      : float(0.0);

    // Add displacement to geometry: pos + (px, height, pz)
    const finalPosition = positionLocal.add(vec3(px, heightDisplacement, pz));

    // ─── COLOR & FOG RESOLUTION ───
    // TSL cond chain for extracting terrain color
    const baseColor = select(equal(typeIdNode, 1), PLAINS,
      select(equal(typeIdNode, 2), GRASSLAND,
      select(equal(typeIdNode, 3), TUNDRA,
      select(equal(typeIdNode, 4), DESERT,
      select(equal(typeIdNode, 5), OCEAN,
      select(equal(typeIdNode, 6), SNOW, OCEAN))))));

    // Fog of War evaluation
    // Unexplored (< 0.25): PARCHMENT
    // Explored (0.25 - 0.75): Mix parchment with desaturated biome (using generic sepia overlay for simplicity)
    // Visible (> 0.75): Full color
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseColorAny = baseColor as any;
    const baseColorVec3 = vec3(baseColor);
    const luminance = baseColorAny.dot(vec3(0.299, 0.587, 0.114));
    const exploredColor = mix(PARCHMENT, vec3(luminance), 0.5);

    // @ts-expect-error deeply nested TSL unions exceed r184 generic limits
    const finalColor = select(
      fogNode.lessThan(0.25),
      PARCHMENT, // Unexplored
      select(
        fogNode.lessThan(0.75),
        mix(exploredColor, baseColorAny, 0.3), // Explored
        baseColorAny // Visible
      )
    ) as any;

    // Apply nodes to a MeshStandardNodeMaterial
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.positionNode = finalPosition;
    mat.colorNode = finalColor;
    mat.roughness = 0.9;

    return mat;
  }, [bufferAttr, count, heightmapTextureRef.current]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, materialNode, count]} castShadow receiveShadow>
      {/* Flat-top hex: Cylinder with 6 radial segments, radius 1.0 */}
      <cylinderGeometry args={[HexConstants.SIZE, HexConstants.SIZE, 0.5, 6]} />
    </instancedMesh>
  );
}
