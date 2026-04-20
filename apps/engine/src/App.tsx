import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { WebGPURenderer, MeshStandardNodeMaterial } from 'three/webgpu'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import * as THREE from 'three'
import { float, color, mix } from 'three/tsl'
import { generateMapBuffer } from '@civ/math'
import TileGrid from './TileGrid'
import TerrainRug from './TerrainRug'
import ClutterInstanced from './ClutterInstanced'
import { SplineManager } from './terrain/SplineManager'
import { UnitManager } from './entities/UnitManager'
import { InputManager } from './systems/InputManager'
import { createHeightmapComputeBinding } from './renderer/compute/HeightmapCompute'
import { createSplatComputeBinding }     from './renderer/compute/SplatCompute'
import { createNormalMapComputeBinding } from './renderer/compute/NormalMapCompute'
import { createFogTexture }              from './renderer/textures/createFogTexture'
import { createBiomeNormalArray }        from './renderer/textures/BiomeNormalArray'
import { createBiomeAlbedoArray }        from './renderer/textures/BiomeAlbedoArray'
import { computeWorldBounds, sampleHeightCPU, HexConstants, type WorldBounds } from './constants'
import type { IpcMessage } from '@civ/protocol'

// Show the legacy instanced renderer alongside the rug when ?debug is in the URL.
const SHOW_DEBUG_INSTANCED = new URLSearchParams(window.location.search).has('debug');

// Water plane PBR — flat mesh rendered just below WATER_LEVEL so the terrain
// rug dips into it at low elevations, creating a natural shoreline.
function WaterPlane({ bounds }: { bounds: WorldBounds }) {
  const mat = new MeshStandardNodeMaterial();
  mat.colorNode     = color('#1a5fa8') as unknown as THREE.Node;
  mat.roughnessNode = float(0.05)     as unknown as THREE.Node;
  mat.metalnessNode = float(0.8)      as unknown as THREE.Node;
  const waterY = HexConstants.WATER_LEVEL * HexConstants.ELEV_SCALE - 0.01;
  return (
    <mesh
      material={mat as unknown as THREE.Material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[bounds.centerX, waterY, bounds.centerZ]}
    >
      <planeGeometry args={[bounds.worldWidth + 20, bounds.worldHeight + 20]} />
    </mesh>
  );
}

export default function App() {
  const [mapBuffer, setMapBuffer]       = useState<Float32Array | null>(null);
  const [hexCount,  setHexCount]        = useState<number>(0);
  const [mapDataStore, setMapDataStore] = useState<Record<string, unknown> | null>(null);
  const [unitStore, setUnitStore]       = useState<unknown[] | null>(null);

  // Baked GPU textures (null until compute completes)
  const [heightmapTexture, setHeightmapTexture] = useState<THREE.Texture | null>(null);
  const [splatTexture,     setSplatTexture]     = useState<THREE.Texture | null>(null);
  const [normalTexture,    setNormalTexture]    = useState<THREE.Texture | null>(null);
  const [fogTexture,       setFogTexture]       = useState<THREE.DataTexture | null>(null);
  const [worldBounds,      setWorldBounds]      = useState<WorldBounds | null>(null);

  // Height sampler: CPU-side replica of the heightmap WGSL for clutter Y-placement
  const [heightSampler, setHeightSampler] = useState<((worldX: number, worldZ: number) => number) | null>(null);

  // Created synchronously — no compute pass needed
  const [biomeNormalArray] = useState(() => createBiomeNormalArray());
  const [biomeAlbedoArray] = useState(() => createBiomeAlbedoArray());

  const rendererRef         = useRef<WebGPURenderer | null>(null);
  const heightmapBakedRef   = useRef(false);
  const mapParamsRef        = useRef<{ buffer: Float32Array; width: number; height: number } | null>(null);

  const bakeHeightmap = useCallback(async () => {
    if (heightmapBakedRef.current || !rendererRef.current || !mapParamsRef.current) return;
    heightmapBakedRef.current = true;

    const renderer = rendererRef.current;
    const { buffer, width, height } = mapParamsRef.current;
    const count = width * height;

    try {
      // Step 1: Heightmap (normal map reads from this, so must be sequential)
      const { storeTexture: heightTex, computeNode: heightNode } = createHeightmapComputeBinding();
      await renderer.computeAsync(heightNode);

      // Step 2: Splat + Normal map in parallel (both only read from heightTex)
      const { storeTexture: splatTex, computeNode: splatNode } =
        createSplatComputeBinding(buffer, width, height);
      const { storeTexture: normalTex, computeNode: normalNode } =
        createNormalMapComputeBinding(heightTex);

      await Promise.all([
        renderer.computeAsync(splatNode),
        renderer.computeAsync(normalNode),
      ]);

      // Step 3: CPU-side resources (no GPU wait needed)
      const fogTex  = createFogTexture(buffer, count);
      const bounds  = computeWorldBounds(width, height);
      const sampler = (worldX: number, worldZ: number) => sampleHeightCPU(worldX, worldZ);

      setHeightmapTexture(heightTex);
      setSplatTexture(splatTex);
      setNormalTexture(normalTex);
      setFogTexture(fogTex);
      setWorldBounds(bounds);
      setHeightSampler(() => sampler);

      console.log('[Engine] All compute passes baked.');
    } catch (err) {
      console.error('[Engine] Compute pass failed:', err);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as IpcMessage;
      if (data?.type === 'INIT_MAP') {
        console.log('[Engine] INIT_MAP:', data.width, '×', data.height);
        const { width, height, mapData, units } = data;
        const generatedBuffer = generateMapBuffer(width, height, mapData);
        // Log fog values to verify visibility encoding
        const fogSamples = Array.from(generatedBuffer.slice(3, Math.min(generatedBuffer.length, 100), 4));
        console.log('[Engine] Fog values (first 25):', fogSamples.slice(0, 25));
        setMapBuffer(generatedBuffer);
        mapParamsRef.current = { buffer: generatedBuffer, width, height };
        setHexCount(width * height);
        setMapDataStore(mapData as Record<string, unknown>);
        setUnitStore(units as unknown[]);
        bakeHeightmap();
      }
    };
    window.addEventListener('message', handler);

    // Native standalone sandbox
    if (window.top === window.self) {
      console.log('[Engine] Standalone sandbox mode.');
      const width = 64, height = 64;
      const mockMapData: Record<string, unknown> = {};
      const landBiomes = ['plains', 'grassland', 'tundra', 'desert', 'snow'];

      // Three lake centers
      const lakes = [
        { q: 10, r: 15, radius: 6 },
        { q: 40, r: 35, radius: 7 },
        { q: 25, r: 55, radius: 5 },
      ];

      // Exploration radius: inner = explored, outer = unexplored
      const explorationCenter = { q: 20, r: 25 };
      const explorationRadius = 18;

      for (let row = 0; row < height; row++) {
        const qOffset = Math.floor(row / 2);
        for (let col = -qOffset; col < width - qOffset; col++) {
          const q = col;
          const r = row;

          // Check if this tile is in a lake
          let isLake = false;
          for (const lake of lakes) {
            const dist = Math.hypot(q - lake.q, r - lake.r);
            if (dist <= lake.radius) {
              isLake = true;
              break;
            }
          }

          // Visibility: explored within radius, unexplored outside
          const distFromCenter = Math.hypot(q - explorationCenter.q, r - explorationCenter.r);
          const visibility = distFromCenter <= explorationRadius ? 1.0 : 0.0;

          const baseTerrain = isLake ? 'ocean' : landBiomes[Math.floor(Math.random() * landBiomes.length)];

          mockMapData[`${col},${row}`] = {
            baseTerrain,
            visibility,
            feature: 'none',
            coord: { q: col, r: row },
          };
        }
      }
      window.postMessage({ type: 'INIT_MAP', width, height, mapData: mockMapData, units: [] }, '*');
    }

    return () => window.removeEventListener('message', handler);
  }, [bakeHeightmap]);

  // All textures must be ready before rendering the rug
  const rugReady = !!(heightmapTexture && splatTexture && normalTexture && fogTexture && worldBounds);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <Canvas
        gl={async (props: Record<string, unknown>) => {
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: true,
          });
          await renderer.init();
          renderer.toneMapping        = ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.2;
          renderer.outputColorSpace   = SRGBColorSpace;
          rendererRef.current = renderer;
          bakeHeightmap();
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

        <Environment preset="sunset" />
        <InputManager />

        {/* Continuous terrain rug */}
        {rugReady && (
          <TerrainRug
            heightmapTexture={heightmapTexture!}
            normalTexture={normalTexture!}
            splatTexture={splatTexture!}
            fogTexture={fogTexture!}
            biomeNormalArray={biomeNormalArray}
            biomeAlbedoArray={biomeAlbedoArray}
            bounds={worldBounds!}
          />
        )}

        {/* Ocean water plane — flat mesh beneath the terrain */}
        {rugReady && <WaterPlane bounds={worldBounds!} />}

        {/* Legacy instanced renderer — visible only with ?debug in URL */}
        {SHOW_DEBUG_INSTANCED && mapBuffer && (
          <TileGrid
            mapBuffer={mapBuffer}
            count={hexCount}
            heightmapTexture={heightmapTexture}
            splatTexture={splatTexture}
            biomeNormalArray={biomeNormalArray}
          />
        )}

        {/* Clutter, splines, and units — positioned on terrain surface */}
        {mapDataStore && (
          <>
            <ClutterInstanced mapData={mapDataStore} heightSampler={heightSampler ?? undefined} />
            <SplineManager mapData={mapDataStore} worldScale={1.0} />
          </>
        )}
        {unitStore && <UnitManager units={unitStore as never[]} worldScale={1.0} />}

        <OrbitControls makeDefault target={[24, 0, 83]} />
      </Canvas>
    </div>
  );
}
