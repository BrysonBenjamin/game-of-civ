"use client";

/**
 * @module Scene
 * @description The root R3F Canvas scene.
 *
 * Mounts:
 *   - Lighting (from DesignTokens)
 *   - HexGrid (terrain with built-in fog-of-war ShaderMaterial)
 *   - EntityFactory (units + cities via Visual Registry)
 *   - SelectionRing, MovePath (interactive effects)
 *   - EffectComposer: N8AO + Bloom + Vignette
 *   - Ground plane + controls
 */

import { Canvas } from "@react-three/fiber";
import { EffectComposer, N8AO, Bloom, Vignette } from "@react-three/postprocessing";
import HexGrid from "./tiles/HexGrid";
import EntityFactory from "./EntityFactory";
import SelectionRing from "./effects/SelectionRing";
import MovePath from "./effects/MovePath";
import CameraRig from "./camera/CameraRig";
import { LightingPreset, Palette } from "./design/DesignTokens";
import { createWebGPURenderer } from "./webgpuRenderer";

// Initial camera position computed from CameraRig defaults (zoom=0.62, yaw=0)
// alt ≈ 14.2, backDist = 14.2/tan(59°) ≈ 8.5, pivot=(6.75,0,11.7)
const INIT_CAM_POS: [number, number, number] = [6.75, 14.2, 3.2];

export default function Scene() {
  return (
    <Canvas
      gl={createWebGPURenderer}
      camera={{ position: INIT_CAM_POS, fov: 45 }}
      style={{ width: "100%", height: "100%" }}
      shadows
    >
      {/* Lighting — sourced from DesignTokens */}
      <ambientLight intensity={LightingPreset.ambient.intensity} />
      <directionalLight
        position={LightingPreset.directional.position}
        intensity={LightingPreset.directional.intensity}
        color={LightingPreset.directional.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />
      <hemisphereLight
        color={LightingPreset.hemisphere.sky}
        groundColor={LightingPreset.hemisphere.ground}
        intensity={LightingPreset.hemisphere.intensity}
      />

      {/* Warm parchment atmospheric fog */}
      <fog
        attach="fog"
        args={[LightingPreset.fog.color, LightingPreset.fog.near, LightingPreset.fog.far]}
      />

      {/* Terrain — fog-of-war handled inside HexGrid via ShaderMaterial */}
      <HexGrid />

      {/* Entities — units & cities via Visual Registry */}
      <EntityFactory />

      {/* Interactive effects */}
      <SelectionRing />
      <MovePath />

      {/* Ground plane — warm earth tone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={Palette.inkBrown} roughness={1} />
      </mesh>

      {/* Post-processing pipeline */}
      <EffectComposer>
        <N8AO aoRadius={1.5} intensity={2.5} screenSpaceRadius />
        <Bloom luminanceThreshold={0.45} intensity={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.35} darkness={0.55} />
      </EffectComposer>

      {/* Civ VI-style camera: WASD pan, Q/E yaw, scroll zoom, right-drag orbit */}
      <CameraRig />
    </Canvas>
  );
}
