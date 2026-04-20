import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { WebGPURenderer } from 'three/webgpu'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { generateMapBuffer } from '@civ/math'
import TileGrid from './TileGrid'
import ClutterInstanced from './ClutterInstanced'
import { SplineManager } from './terrain/SplineManager'
import { UnitManager } from './entities/UnitManager'
import { InputManager } from './systems/InputManager'
import { createHeightmapComputeBinding } from './renderer/compute/HeightmapCompute'
import { createSplatComputeBinding } from './renderer/compute/SplatCompute'
import type { IpcMessage } from '@civ/protocol'

export default function App() {
  const [mapBuffer, setMapBuffer] = useState<Float32Array | null>(null);
  const [hexCount, setHexCount] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapDataStore, setMapDataStore] = useState<Record<string, any> | null>(null);
  const [unitStore, setUnitStore] = useState<any[] | null>(null);

  const [heightmapTexture, setHeightmapTexture] = useState<any>(null);
  const [splatTexture, setSplatTexture] = useState<any>(null);
  const mapParamsRef = useRef<{buffer: Float32Array, width: number, height: number} | null>(null);

  // Renderer ref — populated by the Canvas gl factory once WebGPU is initialised
  const rendererRef = useRef<any>(null);
  // Guard: ensures computeAsync fires exactly once regardless of INIT_MAP / Canvas ordering
  const heightmapBakedRef = useRef(false);

  // Dispatch the heightmap compute shader. Safe to call from either the gl factory
  // (renderer ready) or the INIT_MAP handler (map data ready) — whichever arrives last
  // will find both conditions satisfied and trigger the single bake.
  const bakeHeightmap = useCallback(() => {
    if (heightmapBakedRef.current || !rendererRef.current || !mapParamsRef.current) return;
    heightmapBakedRef.current = true;
    
    const { storeTexture, computeNode } = createHeightmapComputeBinding();
    const { storeTexture: splatStoreTex, computeNode: splatComputeNode } = createSplatComputeBinding(mapParamsRef.current.buffer, mapParamsRef.current.width, mapParamsRef.current.height);

    Promise.all([
      (rendererRef.current as any).computeAsync(computeNode),
      (rendererRef.current as any).computeAsync(splatComputeNode)
    ])
      .then(() => {
        setHeightmapTexture(storeTexture);
        setSplatTexture(splatStoreTex);
        console.log('[Engine] Compute shaders baked successfully.');
      })
      .catch((err: any) => console.error('[Engine] Compute pass failed:', err));
  }, []);

  // Headless handshake — listen for postMessage commands from a parent frame
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as IpcMessage;
      if (data?.type === 'INIT_MAP') {
        console.log('Engine received INIT_MAP:', data.width, 'x', data.height);
        const { width, height, mapData, units } = data;
        const generatedBuffer = generateMapBuffer(width, height, mapData);
        setMapBuffer(generatedBuffer);
        mapParamsRef.current = { buffer: generatedBuffer, width, height };
        setHexCount(width * height);
        setMapDataStore(mapData);
        setUnitStore(units);
        bakeHeightmap(); // no-op if renderer not ready yet; gl factory will retry
      }
    };
    window.addEventListener('message', handler);

    // -- NATIVE STANDALONE SANDBOX --
    // If the engine is accessed directly without an iframe host, self-dispatch a generated map
    if (window.top === window.self) {
      console.log('[Engine] Standalone mode detected! Generating native sandbox hex grid...');
      const width = 64;
      const height = 64;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockMapData: Record<string, any> = {};
      const biomes = ['plains', 'grassland', 'tundra', 'desert', 'ocean', 'snow'];
      const features = ['woods', 'rainforest', 'none', 'none', 'none', 'none'];
      
      for (let row = 0; row < height; row++) {
        const q_offset = Math.floor(row / 2);
        for (let col = -q_offset; col < width - q_offset; col++) {
          const q = col;
          const r = row;
          const randomBiome = biomes[Math.floor(Math.random() * biomes.length)];
          const randomFeature = features[Math.floor(Math.random() * features.length)];
          mockMapData[`${q},${r}`] = { 
            baseTerrain: randomBiome, 
            visibility: 1.0,
            feature: randomFeature,
            coord: { q, r }
          };
        }
      }
      
      // Dispatch payload to our own listener
      window.postMessage({
        type: 'INIT_MAP',
        width,
        height,
        mapData: mockMapData,
        units: []
      }, '*');
    }

    return () => window.removeEventListener('message', handler);
  }, [bakeHeightmap]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <Canvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gl={async (props: any) => {
          const renderer = new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement, antialias: true });
          await renderer.init();
          
          renderer.toneMapping = ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.2;
          renderer.outputColorSpace = SRGBColorSpace;
          
          rendererRef.current = renderer;
          bakeHeightmap(); // no-op if INIT_MAP hasn't arrived yet; IPC handler will retry
          return renderer;
        }}
        camera={{ position: [24, 60, 120], fov: 45 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[24, 100, 83]}
          intensity={2.0}
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
        >
          <orthographicCamera attach="shadow-camera" args={[-150, 150, 150, -150, 0.1, 500]} />
        </directionalLight>

        {/* Environment lighting — natural HDRI for PBR reflections */}
        <Environment preset="sunset" />

        {/* Instanced Hex Grid injected via message proxy */}
        <InputManager />
        {mapBuffer && <TileGrid mapBuffer={mapBuffer} count={hexCount} heightmapTexture={heightmapTexture} splatTexture={splatTexture} />}
        {mapDataStore && (
          <>
             <ClutterInstanced mapData={mapDataStore} />
             <SplineManager mapData={mapDataStore} worldScale={1.0} />
          </>
        )}
        {unitStore && <UnitManager units={unitStore} worldScale={1.0} />}

        {/* Ground plane for shadow reception */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[24, -0.3, 83]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#111" roughness={1} />
        </mesh>

        <OrbitControls makeDefault target={[24, 0, 83]} />
      </Canvas>
    </div>
  );
}
