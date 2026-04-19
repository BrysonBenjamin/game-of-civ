"use client";

/**
 * @module EntityFactory
 * @description Registry-driven entity renderer.
 *
 * Subscribes to the Zustand store and spawns/despawns visual entities
 * based on the game state. Uses VisualRegistry for visual configs.
 *
 * DESIGN RULE: This component contains NO game logic. It only maps
 * state → visuals. The engine is the source of truth for position, health, etc.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "@/store/useGameStore";
import { axialToWorld, tileElevation, Palette } from "./design/DesignTokens";
import { getUnitVisual, getBuildingVisual } from "./design/VisualRegistry";
import type { GeometryType } from "./design/VisualRegistry";
import { parseHexKey } from "@/engine/types";
import type { Unit, City } from "@/engine/types";

// ─── Geometry Factory ────────────────────────────────────────────────────────

function GeometryByType({ type }: { type: GeometryType }) {
  switch (type) {
    case "box":
      return <boxGeometry args={[1, 1, 1]} />;
    case "cylinder":
      return <cylinderGeometry args={[0.5, 0.5, 1, 8]} />;
    case "cone":
      return <coneGeometry args={[0.5, 1, 8]} />;
    case "sphere":
      return <sphereGeometry args={[0.5, 16, 16]} />;
    case "dodecahedron":
      return <dodecahedronGeometry args={[0.5]} />;
    default:
      return <sphereGeometry args={[0.5, 16, 16]} />;
  }
}

// ─── Player Color Resolution ─────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  p1: Palette.player1,
  p2: Palette.player2,
  p3: Palette.player3,
  p4: Palette.player4,
};

function playerColor(playerId: string): string {
  return PLAYER_COLORS[playerId] ?? Palette.compassGold;
}

// ─── Unit Entity Mesh ────────────────────────────────────────────────────────

interface UnitEntityProps {
  unit: Unit;
  isSelected: boolean;
  tileFeatureMap: Record<string, string>; // hex_id → feature
}

function UnitEntity({ unit, isSelected, tileFeatureMap }: UnitEntityProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const visual = getUnitVisual(unit.type_id);
  const color = playerColor(unit.owner_id);

  // Target position from state
  const targetPos = useMemo(() => {
    const coord = parseHexKey(unit.position);
    const feature = (tileFeatureMap[unit.position] ?? "none") as import("@/engine/types").TerrainFeature;
    const elevation = tileElevation(feature);
    return axialToWorld(coord.q, coord.r, elevation + visual.yOffset);
  }, [unit.position, visual.yOffset, tileFeatureMap]);

  // Smooth lerp movement
  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.x += (targetPos[0] - meshRef.current.position.x) * 0.12;
    meshRef.current.position.y += (targetPos[1] - meshRef.current.position.y) * 0.12;
    meshRef.current.position.z += (targetPos[2] - meshRef.current.position.z) * 0.12;
  });

  return (
    <mesh
      ref={meshRef}
      position={targetPos}
      scale={visual.scale as unknown as THREE.Vector3Tuple}
    >
      <GeometryByType type={visual.geometry} />
      <meshStandardMaterial
        color={color}
        roughness={visual.material.roughness}
        metalness={visual.material.metalness}
        flatShading={visual.material.flatShading ?? true}
        emissive={isSelected ? Palette.compassGold : "#000000"}
        emissiveIntensity={isSelected ? 0.5 : 0}
      />
    </mesh>
  );
}

// ─── City Entity Mesh ────────────────────────────────────────────────────────

interface CityEntityProps {
  city: City;
  tileFeatureMap: Record<string, string>;
}

function CityEntity({ city, tileFeatureMap }: CityEntityProps) {
  const visual = getBuildingVisual("CITY_CENTER");
  const color = playerColor(city.owner_id);

  const position = useMemo(() => {
    const coord = parseHexKey(city.position);
    const feature = (tileFeatureMap[city.position] ?? "none") as import("@/engine/types").TerrainFeature;
    const elevation = tileElevation(feature);
    return axialToWorld(coord.q, coord.r, elevation + visual.yOffset);
  }, [city.position, visual.yOffset, tileFeatureMap]);

  // Scale city based on population
  const popScale = 1 + city.population * 0.05;

  return (
    <mesh
      position={position}
      scale={[
        (visual.scale[0] as number) * popScale,
        (visual.scale[1] as number) * popScale,
        (visual.scale[2] as number) * popScale,
      ]}
    >
      <GeometryByType type={visual.geometry} />
      <meshStandardMaterial
        color={color}
        roughness={visual.material.roughness}
        metalness={visual.material.metalness}
        flatShading
        emissive={Palette.compassGold}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

// ─── Entity Factory ──────────────────────────────────────────────────────────

export default function EntityFactory() {
  const units = useGameStore((s) => s.state.units);
  const cities = useGameStore((s) => s.state.cities);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const map = useGameStore((s) => s.state.map);

  // Build a lightweight lookup for tile features
  const tileFeatureMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const key in map) {
      m[key] = map[key].feature;
    }
    return m;
  }, [map]);

  return (
    <group>
      {/* Units */}
      {units.map((unit) => (
        <UnitEntity
          key={unit.unit_id}
          unit={unit}
          isSelected={unit.unit_id === selectedUnitId}
          tileFeatureMap={tileFeatureMap}
        />
      ))}

      {/* Cities */}
      {cities.map((city) => (
        <CityEntity
          key={city.city_id}
          city={city}
          tileFeatureMap={tileFeatureMap}
        />
      ))}
    </group>
  );
}
