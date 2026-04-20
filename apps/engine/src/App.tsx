import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { WebGPURenderer, MeshStandardNodeMaterial } from 'three/webgpu'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import * as THREE from 'three'
import { float, color } from 'three/tsl'
import { generateMapBuffer } from '@civ/math'
import TileGrid from './TileGrid'
import TerrainRug from './TerrainRug'
import ClutterInstanced from './ClutterInstanced'
import HoverHexOverlay from './HoverHexOverlay'
import { SplineManager } from './terrain/SplineManager'
import { UnitManager } from './entities/UnitManager'
import { InputManager, type HoveredHex } from './systems/InputManager'
import { createHeightmapComputeBinding } from './renderer/compute/HeightmapCompute'
import { createNormalMapComputeBinding } from './renderer/compute/NormalMapCompute'
import { createSplatComputeBinding }     from './renderer/compute/SplatCompute'
import { createBiomeNormalArray }        from './renderer/textures/BiomeNormalArray'
import { createBiomeAlbedoArray }        from './renderer/textures/BiomeAlbedoArray'
import {
  DEFAULT_PLAINS_PALETTE_ID,
  PLAINS_PALETTE_PRESETS,
  getPlainsPalettePreset,
} from './renderer/materials/TerrainRug/plainsPalettes'
import { createTerrainDataTexture }      from './renderer/textures/createTerrainDataTexture'
import { computeWorldBounds, HexConstants, type WorldBounds } from './constants'
import { createSteppedTerrainSampler } from './terrain/steppedTerrain'
import type { IpcMessage } from '@civ/protocol'

const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const SHOW_DEBUG_INSTANCED = SEARCH_PARAMS.has('debug');
const SHOW_LIGHT_DEBUG = SEARCH_PARAMS.has('lightdebug');
const SHOW_TERRAIN_GRID = SEARCH_PARAMS.has('terraingrid');
const SHOW_SPLINE_DEBUG = SEARCH_PARAMS.has('splines');
const SHOW_PLAINS_PALETTE_DEBUG = true;

function paletteSwatch(colorValue: [number, number, number]): string {
  const [r, g, b] = colorValue.map((channel) => Math.round(channel * 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function createFilterableHalfFloatTexture(width: number, height: number, name: string): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Uint16Array(width * height * 4),
    width,
    height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  tex.name = name;
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createFilterableByteTexture(width: number, height: number, name: string): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Uint8Array(width * height * 4),
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.name = name;
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function sphericalToCartesian(azimuthDeg: number, elevationDeg: number, radius: number): [number, number, number] {
  const azimuth = azimuthDeg * (Math.PI / 180);
  const elevation = elevationDeg * (Math.PI / 180);
  const cosElevation = Math.cos(elevation);

  return [
    Math.sin(azimuth) * cosElevation * radius,
    Math.sin(elevation) * radius,
    Math.cos(azimuth) * cosElevation * radius,
  ];
}

function LightDebugPanel({
  azimuth,
  elevation,
  onAzimuthChange,
  onElevationChange,
}: {
  azimuth: number;
  elevation: number;
  onAzimuthChange: (value: number) => void;
  onElevationChange: (value: number) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 20,
        width: 220,
        padding: 12,
        borderRadius: 10,
        background: 'rgba(14, 18, 20, 0.82)',
        color: '#f2efe3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(242, 239, 227, 0.14)',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div style={{ marginBottom: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Light Debug
      </div>

      <label style={{ display: 'block', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Azimuth</span>
          <span>{azimuth.toFixed(0)}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={azimuth}
          onChange={(event) => onAzimuthChange(Number(event.target.value))}
          style={{ width: '100%' }}
        />
      </label>

      <label style={{ display: 'block' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Elevation</span>
          <span>{elevation.toFixed(0)}°</span>
        </div>
        <input
          type="range"
          min={5}
          max={85}
          step={1}
          value={elevation}
          onChange={(event) => onElevationChange(Number(event.target.value))}
          style={{ width: '100%' }}
        />
      </label>
    </div>
  );
}

function PlainsPaletteDebugPanel({
  paletteId,
  onPaletteChange,
}: {
  paletteId: string;
  onPaletteChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
        width: 244,
        padding: 12,
        borderRadius: 10,
        background: 'rgba(14, 18, 20, 0.82)',
        color: '#f2efe3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(242, 239, 227, 0.14)',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div style={{ marginBottom: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Plains Palette
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {PLAINS_PALETTE_PRESETS.map((preset) => {
          const selected = preset.id === paletteId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPaletteChange(preset.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: selected ? '1px solid rgba(255, 244, 194, 0.72)' : '1px solid rgba(242, 239, 227, 0.12)',
                background: selected ? 'rgba(255, 244, 194, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                color: '#f2efe3',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{preset.label}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: paletteSwatch(preset.base),
                    border: '1px solid rgba(0, 0, 0, 0.18)',
                  }}
                />
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: paletteSwatch(preset.shadow),
                    border: '1px solid rgba(0, 0, 0, 0.18)',
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WaterPlane({ bounds }: { bounds: WorldBounds }) {
  const mat = new MeshStandardNodeMaterial();
  mat.colorNode = color('#31485a');
  mat.roughnessNode = float(0.24);
  mat.metalnessNode = float(0.28);
  mat.envMapIntensity = 0.35;
  const waterY = HexConstants.WATER_LEVEL * HexConstants.ELEV_SCALE - 0.01;
  return (
    <mesh
      material={mat as unknown as THREE.Material}
      userData={{ groundPicker: true, waterSurface: true }}
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

  const [heightmapTexture, setHeightmapTexture] = useState<THREE.Texture | null>(null);
  const [normalTexture, setNormalTexture]       = useState<THREE.Texture | null>(null);
  const [splatTexture, setSplatTexture]         = useState<THREE.Texture | null>(null);
  const [worldBounds, setWorldBounds]           = useState<WorldBounds | null>(null);
  const [heightSampler, setHeightSampler] = useState<((worldX: number, worldZ: number) => number) | null>(null);
  const [hoveredHex, setHoveredHex] = useState<HoveredHex | null>(null);
  const [lightAzimuth, setLightAzimuth] = useState<number>(16);
  const [lightElevation, setLightElevation] = useState<number>(48);
  const [plainsPaletteId, setPlainsPaletteId] = useState<string>(
    getPlainsPalettePreset(SEARCH_PARAMS.get('plainspalette') ?? DEFAULT_PLAINS_PALETTE_ID).id,
  );

  const [biomeNormalArray] = useState(() => createBiomeNormalArray());
  const [biomeAlbedoArray] = useState(() => createBiomeAlbedoArray());
  const plainsPalette = useMemo(
    () => getPlainsPalettePreset(plainsPaletteId),
    [plainsPaletteId],
  );

  const rendererRef       = useRef<WebGPURenderer | null>(null);
  const terrainBakedRef   = useRef(false);
  const mapParamsRef      = useRef<{ buffer: Float32Array; width: number; height: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('plainspalette', plainsPaletteId);
    const query = params.toString();
    window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [plainsPaletteId]);

  const handleHoverHexChange = useCallback((coord: HoveredHex | null) => {
    if (
      !coord ||
      !mapDataStore ||
      !Object.prototype.hasOwnProperty.call(mapDataStore, `${coord.q},${coord.r}`)
    ) {
      setHoveredHex(null);
      return;
    }

    setHoveredHex((prev) => (
      prev && prev.q === coord.q && prev.r === coord.r ? prev : coord
    ));
  }, [mapDataStore]);

  const bakeTerrainResources = useCallback(async () => {
    if (terrainBakedRef.current || !rendererRef.current || !mapParamsRef.current) return;
    terrainBakedRef.current = true;

    const renderer = rendererRef.current;
    const { buffer, width, height } = mapParamsRef.current;

    try {
      const terrainTex = createTerrainDataTexture(buffer, width, height);
      const { storeTexture: heightTex, computeNode: heightNode } = createHeightmapComputeBinding(terrainTex, width, height);
      await renderer.computeAsync(heightNode);

      const { storeTexture: normalTex, computeNode: normalNode } = createNormalMapComputeBinding(heightTex as any);
      const { storeTexture: splatTex, computeNode: splatNode } = createSplatComputeBinding(buffer, width, height);
      await renderer.computeAsync(normalNode);
      await renderer.computeAsync(splatNode);

      const heightImage = heightTex.image as { width: number; height: number };
      const normalImage = normalTex.image as { width: number; height: number };
      const sampledHeightTex = createFilterableHalfFloatTexture(
        heightImage.width,
        heightImage.height,
        'terrain-height-sampled',
      );
      const sampledNormalTex = createFilterableHalfFloatTexture(
        normalImage.width,
        normalImage.height,
        'terrain-normal-sampled',
      );
      const sampledSplatTex = createFilterableByteTexture(
        256,
        256,
        'terrain-splat-sampled',
      );
      renderer.initTexture(sampledHeightTex);
      renderer.initTexture(sampledNormalTex);
      renderer.initTexture(sampledSplatTex);
      renderer.copyTextureToTexture(heightTex, sampledHeightTex);
      renderer.copyTextureToTexture(normalTex, sampledNormalTex);
      renderer.copyTextureToTexture(splatTex, sampledSplatTex);

      const bounds = computeWorldBounds(width, height);
      const sampler = createSteppedTerrainSampler({ mapBuffer: buffer, width, height });

      setHeightmapTexture(sampledHeightTex);
      setNormalTexture(sampledNormalTex);
      setSplatTexture(sampledSplatTex);
      setWorldBounds(bounds);
      setHeightSampler(() => sampler);

      console.log('[Engine] Stepped rug resources baked.');
    } catch (err) {
      terrainBakedRef.current = false;
      console.error('[Engine] Terrain resource bake failed:', err);
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as IpcMessage;
      if (data?.type === 'INIT_MAP') {
        console.log('[Engine] INIT_MAP:', data.width, '×', data.height);
        const { width, height, mapData, units } = data;
        const generatedBuffer = generateMapBuffer(width, height, mapData);
        terrainBakedRef.current = false;
        setHeightmapTexture(null);
        setNormalTexture(null);
        setSplatTexture(null);
        setWorldBounds(null);
        setHoveredHex(null);
        setMapBuffer(generatedBuffer);
        mapParamsRef.current = { buffer: generatedBuffer, width, height };
        setHexCount(width * height);
        setMapDataStore(mapData as Record<string, unknown>);
        setUnitStore(units as unknown[]);
        bakeTerrainResources();
      }
    };

    window.addEventListener('message', handler);

    if (window.top === window.self) {
      console.log('[Engine] Standalone sandbox mode.');
      const width = 64;
      const height = 64;
      const mockMapData: Record<string, unknown> = {};

      const lakes = [
        { q: 10, r: 15, radius: 6 },
        { q: 40, r: 35, radius: 7 },
        { q: 25, r: 55, radius: 5 },
      ];

      const explorationCenter = { q: 20, r: 25 };
      const explorationRadius = 18;

      for (let row = 0; row < height; row++) {
        const qOffset = Math.floor(row / 2);
        for (let col = -qOffset; col < width - qOffset; col++) {
        const q = col;
        const r = row;
        const screenCol = col + qOffset;
        const normalizedX = width > 1 ? screenCol / (width - 1) : 0;
        const normalizedY = height > 1 ? row / (height - 1) : 0;

        let isLake = false;
        let lakeMoisture = 0;
        for (const lake of lakes) {
          const dist = Math.hypot(q - lake.q, r - lake.r);
          if (dist <= lake.radius) {
            isLake = true;
            break;
          }

          const moistureFalloff = Math.max(0, 1 - dist / (lake.radius + 8));
          lakeMoisture = Math.max(lakeMoisture, moistureFalloff);
        }

        const distFromCenter = Math.hypot(q - explorationCenter.q, r - explorationCenter.r);
        const visibility = distFromCenter <= explorationRadius ? 1.0 : 0.0;
        const edgeDryness = Math.hypot(normalizedX - 0.5, normalizedY - 0.5) * 2.2;
        const macroMoisture =
          Math.sin(q * 0.14) * 0.55 +
          Math.cos(r * 0.11) * 0.45 +
          Math.sin((q + r) * 0.07) * 0.4 +
          Math.cos((q - r) * 0.09) * 0.25 +
          lakeMoisture * 1.1 -
          edgeDryness * 0.95;
        const baseTerrain = isLake
          ? 'ocean'
          : macroMoisture > 0.55
            ? 'grassland'
            : macroMoisture > -0.1
              ? 'plains'
              : 'desert';

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
  }, [bakeTerrainResources]);

  const rugReady = !!(heightmapTexture && normalTexture && splatTexture && worldBounds);
  const [lightX, lightY, lightZ] = sphericalToCartesian(lightAzimuth, lightElevation, 132);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      {SHOW_LIGHT_DEBUG && (
        <LightDebugPanel
          azimuth={lightAzimuth}
          elevation={lightElevation}
          onAzimuthChange={setLightAzimuth}
          onElevationChange={setLightElevation}
        />
      )}
      {SHOW_PLAINS_PALETTE_DEBUG && (
        <PlainsPaletteDebugPanel
          paletteId={plainsPaletteId}
          onPaletteChange={setPlainsPaletteId}
        />
      )}
      <Canvas
        gl={async (props: Record<string, unknown>) => {
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: true,
          });
          await renderer.init();
          renderer.toneMapping = ACESFilmicToneMapping;
          renderer.toneMappingExposure = .5;
          renderer.outputColorSpace = SRGBColorSpace;
          rendererRef.current = renderer;
          bakeTerrainResources();
          return renderer;
        }}
        camera={{ position: [24, 60, 120], fov: 45 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.24} />
        <directionalLight
          position={[lightX, lightY, lightZ]}
          intensity={1.75}
          castShadow
          shadow-bias={-0.002}
          shadow-normalBias={0.02}
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
        >
          <orthographicCamera attach="shadow-camera" args={[-150, 150, 150, -150, 0.1, 500]} />
        </directionalLight>

        <Environment preset="sunset" />
        <InputManager onHoverHexChange={handleHoverHexChange} />

        {rugReady && (
          <TerrainRug
            heightmapTexture={heightmapTexture!}
            normalTexture={normalTexture!}
            splatTexture={splatTexture!}
            biomeNormalArray={biomeNormalArray}
            biomeAlbedoArray={biomeAlbedoArray}
            bounds={worldBounds!}
            plainsPalette={plainsPalette}
            showGrid={SHOW_TERRAIN_GRID}
          />
        )}

        {rugReady && <WaterPlane bounds={worldBounds!} />}
        {rugReady && hoveredHex && (
          <HoverHexOverlay
            coord={hoveredHex}
            heightSampler={heightSampler ?? undefined}
          />
        )}

        {SHOW_DEBUG_INSTANCED && mapBuffer && (
          <TileGrid
            mapBuffer={mapBuffer}
            count={hexCount}
            heightmapTexture={heightmapTexture}
            normalTexture={normalTexture}
            splatTexture={splatTexture}
            biomeNormalArray={biomeNormalArray}
          />
        )}

        {mapDataStore && (
          <>
            <ClutterInstanced mapData={mapDataStore} heightSampler={heightSampler ?? undefined} />
            {SHOW_SPLINE_DEBUG && <SplineManager mapData={mapDataStore} worldScale={1.0} />}
          </>
        )}
        {unitStore && <UnitManager units={unitStore as never[]} worldScale={1.0} />}

        <OrbitControls makeDefault target={[24, 0, 83]} />
      </Canvas>
    </div>
  );
}
