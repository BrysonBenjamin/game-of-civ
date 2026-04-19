"use client";

/**
 * @module HexGrid
 * @description Terrain grid orchestrator — unified mesh architecture.
 *
 * DESIGN RULE: This component renders TERRAIN ONLY.
 * Units, cities, and effects are handled by EntityFactory and effects/.
 */

import { useCallback } from "react";
import { useGameStore } from "@/store/useGameStore";
import { HeightmapProvider } from "./systems/HeightmapContext";
import { SplatmapProvider } from "./systems/SplatmapContext";
import { SplineProvider } from "./systems/SplineContext";
import RidgeMesh from "./features/RidgeMesh";
import ClutterLayer from "./features/ClutterLayer";
import TerrainMesh from "./terrain/TerrainMesh";
import WaterPlane from "./terrain/WaterPlane";

export default function HexGrid() {
  const state          = useGameStore((s) => s.state);
  const dispatch       = useGameStore((s) => s.dispatch);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectUnit     = useGameStore((s) => s.selectUnit);

  const handleTileClick = useCallback(
    (hexId: string, unitIds: string[]) => {
      if (selectedUnitId && unitIds.length === 0) {
        dispatch({ type: "MOVE_UNIT", unit_id: selectedUnitId, target_hex: hexId });
        selectUnit(null);
      } else if (unitIds.length > 0) {
        const firstUnitId = unitIds[0];
        selectUnit(firstUnitId === selectedUnitId ? null : firstUnitId);
      }
    },
    [selectedUnitId, dispatch, selectUnit]
  );

  return (
    <HeightmapProvider map={state.map}>
    <SplatmapProvider map={state.map}>
    <SplineProvider map={state.map}>
      <group>
        <TerrainMesh onTileClick={handleTileClick} />
        <WaterPlane />
        <RidgeMesh />
        <ClutterLayer />
      </group>
    </SplineProvider>
    </SplatmapProvider>
    </HeightmapProvider>
  );
}
