import { useMemo, useRef } from 'react';
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
  equal
} from 'three/tsl';
import { HexConstants } from './constants';

interface TileGridProps {
  mapBuffer: Float32Array;
  count: number;
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

export default function TileGrid({ mapBuffer, count }: TileGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
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
    
    // Add displacement to geometry
    const finalPosition = positionLocal.add(vec3(px, 0.0, pz));

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
  }, [bufferAttr, count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, materialNode, count]} castShadow receiveShadow>
      {/* Flat-top hex: Cylinder with 6 radial segments, radius 1.0 */}
      <cylinderGeometry args={[HexConstants.SIZE, HexConstants.SIZE, 0.5, 6]} />
    </instancedMesh>
  );
}
