"use client";

import { createContext, useContext, useMemo } from "react";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { buildHeightmap, type HeightmapResult } from "./HeightmapSystem";

const HeightmapContext = createContext<HeightmapResult | null>(null);

interface HeightmapProviderProps {
  map: Record<HexId, Tile>;
  children: React.ReactNode;
}

export function HeightmapProvider({ map, children }: HeightmapProviderProps) {
  const heightmap = useMemo(() => buildHeightmap(map), [map]);
  return (
    <HeightmapContext.Provider value={heightmap}>
      {children}
    </HeightmapContext.Provider>
  );
}

export function useHeightmap(): HeightmapResult | null {
  return useContext(HeightmapContext);
}
