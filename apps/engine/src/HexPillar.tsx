import { useMemo } from 'react'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { color } from 'three/tsl'

/**
 * HexPillar — First Light test geometry.
 */
export default function HexPillar() {
  const material = useMemo(() => {
    const mat = new MeshStandardNodeMaterial();
    mat.colorNode = color(0x228B22);
    mat.roughness = 0.6;
    mat.metalness = 0.0;
    return mat;
  }, []);

  return (
    <group>
      <gridHelper args={[20, 20, 0xff0000, 0xffffff]} />
      <mesh position={[0, 1, 0]} castShadow receiveShadow material={material}>
        <cylinderGeometry args={[2, 2, 2, 6]} />
      </mesh>
    </group>
  );
}
