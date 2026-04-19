"use client";

import { useMemo, useState, useRef } from "react";
import * as THREE from "three";
import type { BaseTerrainType, TerrainFeature } from "@/engine/types";
import {
  axialToWorld,
  tileElevation,
  HexConstants,
  Palette,
  TerrainColors,
} from "../../design/DesignTokens";
import { hexTileVert, hexTileFrag } from "../shaders/hexTile";
import { biomeBlendVert, biomeBlendFrag } from "../shaders/biomeBlend";
import MountainFeature from "../features/MountainFeature";
import HillFeature from "../features/HillFeature";
import { useSplatmap } from "../systems/SplatmapContext";

// Ordered palette array for the biomeBlend shader (index = BIOME_ENCODE id)
const BIOME_PALETTE = [
  new THREE.Color(0, 0, 0),                       // 0 = unused
  new THREE.Color(TerrainColors.plains),           // 1
  new THREE.Color(TerrainColors.grassland),        // 2
  new THREE.Color(TerrainColors.tundra),           // 3
  new THREE.Color(TerrainColors.desert),           // 4
  new THREE.Color(TerrainColors.ocean),            // 5
  new THREE.Color(TerrainColors.snow),             // 6
];

export interface BaseTileProps {
  q: number;
  r: number;
  baseTerrain: BaseTerrainType;
  color: string;
  feature: TerrainFeature;
  isOwned: boolean;
  fogFactor: number;
  onClick: () => void;
}

export default function BaseTile({ q, r, baseTerrain, color, feature, isOwned, fogFactor, onClick }: BaseTileProps) {
  const [hovered, setHovered] = useState(false);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const splatmap = useSplatmap();

  const [wx, , wz] = useMemo(() => axialToWorld(q, r, 0), [q, r]);
  const elevation = tileElevation(feature);

  // Splatmap uniforms — used when the splatmap is available
  const splatUniforms = useMemo(() => {
    if (!splatmap) return null;
    return {
      u_splatmap:    { value: splatmap.texture },
      u_worldOffset: { value: new THREE.Vector2(wx, wz) },
      u_worldMin:    { value: splatmap.worldMin },
      u_worldMax:    { value: splatmap.worldMax },
      u_fogFactor:   { value: fogFactor },
      u_hovered:     { value: false },
      u_biomeColors: { value: BIOME_PALETTE },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splatmap]);

  // Fallback uniforms for hexTile shader
  const fallbackUniforms = useMemo(
    () => ({
      u_terrainColor: { value: new THREE.Color(color) },
      u_fogFactor:    { value: fogFactor },
      u_hovered:      { value: false },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Sync mutable uniforms each render
  if (matRef.current) {
    const u = matRef.current.uniforms;
    if (splatUniforms) {
      u.u_fogFactor.value = fogFactor;
      u.u_hovered.value   = hovered;
    } else {
      u.u_terrainColor.value.set(color);
      u.u_fogFactor.value = fogFactor;
      u.u_hovered.value   = hovered;
    }
  }

  return (
    <group position={[wx, 0, wz]}>
      <mesh
        rotation={[0, Math.PI / 6, 0]}
        position={[0, elevation / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry
          args={[HexConstants.SIZE * 0.95, HexConstants.SIZE * 0.95, elevation, 6]}
        />
        {splatUniforms ? (
          <shaderMaterial
            ref={matRef}
            vertexShader={biomeBlendVert}
            fragmentShader={biomeBlendFrag}
            uniforms={splatUniforms}
          />
        ) : (
          <shaderMaterial
            ref={matRef}
            vertexShader={hexTileVert}
            fragmentShader={hexTileFrag}
            uniforms={fallbackUniforms}
          />
        )}
      </mesh>

      {isOwned && (
        <mesh
          rotation={[-Math.PI / 2, 0, Math.PI / 12]}
          position={[0, elevation + 0.01, 0]}
        >
          <ringGeometry args={[HexConstants.SIZE * 0.75, HexConstants.SIZE * 0.85, 6]} />
          <meshBasicMaterial color={Palette.compassGold} transparent opacity={0.25} />
        </mesh>
      )}

      {feature === "mountains" && fogFactor > 0.74 && (
        <MountainFeature q={q} r={r} baseElevation={elevation} />
      )}
      {feature === "hills" && fogFactor > 0.74 && (
        <HillFeature q={q} r={r} baseTerrain={baseTerrain} baseElevation={elevation} />
      )}
    </group>
  );
}
