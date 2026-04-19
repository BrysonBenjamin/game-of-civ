"use client";

import type { BaseTerrainType, TerrainFeature } from "@/engine/types";
import { resolveTileColor } from "../../design/DesignTokens";
import BaseTile from "../biomes/BaseTile";
import OceanTile from "../biomes/OceanTile";

interface TileSelectorProps {
  hexId: string;
  q: number;
  r: number;
  baseTerrain: BaseTerrainType;
  feature: TerrainFeature;
  isOwned: boolean;
  fogFactor: number;
  onClick: () => void;
}

export default function TileSelector({
  hexId,
  q,
  r,
  baseTerrain,
  feature,
  isOwned,
  fogFactor,
  onClick,
}: TileSelectorProps) {
  if (baseTerrain === "ocean") {
    return <OceanTile q={q} r={r} fogFactor={fogFactor} onClick={onClick} />;
  }

  return (
    <BaseTile
      q={q}
      r={r}
      baseTerrain={baseTerrain}
      color={resolveTileColor(baseTerrain, feature)}
      feature={feature}
      isOwned={isOwned}
      fogFactor={fogFactor}
      onClick={onClick}
    />
  );
}
