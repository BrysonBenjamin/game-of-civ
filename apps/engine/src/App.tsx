import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { WebGPURenderer } from 'three/webgpu'
import { generateMapBuffer } from '@civ/math'
import TileGrid from './TileGrid'
import ClutterInstanced from './ClutterInstanced'
import { SplineManager } from './terrain/SplineManager'
import { UnitManager } from './entities/UnitManager'
import { InputManager } from './systems/InputManager'
import { createHeightmapComputeBinding } from './renderer/compute/HeightmapCompute'
import type { IpcMessage } from '@civ/protocol'

export default function App() {
  const [mapBuffer, setMapBuffer] = useState<Float32Array | null>(null);
  const [hexCount, setHexCount] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapDataStore, setMapDataStore] = useState<Record<string, any> | null>(null);
  const [unitStore, setUnitStore] = useState<any[] | null>(null);
  const heightmapTextureRef = useRef<any>(null);
  // Headless handshake — listen for postMessage commands from a parent frame
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as IpcMessage;
      if (data?.type === 'INIT_MAP') {
        console.log('Engine received INIT_MAP:', data.width, 'x', data.height);
        const { width, height, mapData, units } = data;
        const buffer = generateMapBuffer(width, height, mapData);
        setMapBuffer(buffer);
        setHexCount(width * height);
        setMapDataStore(mapData);
        setUnitStore(units);

        // Initialize heightmap compute binding and store texture
        const { storeTexture } = createHeightmapComputeBinding();
        heightmapTextureRef.current = storeTexture;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <Canvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gl={async (props: any) => {
          const renderer = new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true });
          await renderer.init();
          return renderer;
        }}
        camera={{ position: [4, 4, 4], fov: 45 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 12, 5]}
          intensity={2.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* Environment lighting — city HDRI for PBR reflections */}
        <Environment preset="city" />

        {/* Instanced Hex Grid injected via message proxy */}
        <InputManager />
        {mapBuffer && <TileGrid mapBuffer={mapBuffer} count={hexCount} heightmapTexture={heightmapTextureRef.current} />}
        {mapDataStore && (
          <>
             <ClutterInstanced mapData={mapDataStore} />
             <SplineManager mapData={mapDataStore} worldScale={1.0} />
          </>
        )}
        {unitStore && <UnitManager units={unitStore} worldScale={1.0} />}

        {/* Ground plane for shadow reception */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
