"use client";

import { createContext, useContext, useMemo } from "react";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { buildSplatmap, type SplatmapResult } from "./SplatmapSystem";

const SplatmapContext = createContext<SplatmapResult | null>(null);

interface SplatmapProviderProps {
  map: Record<HexId, Tile>;
  children: React.ReactNode;
}

export function SplatmapProvider({ map, children }: SplatmapProviderProps) {
  const splatmap = useMemo(() => buildSplatmap(map), [map]);
  return (
    <SplatmapContext.Provider value={splatmap}>
      {children}
    </SplatmapContext.Provider>
  );
}

export function useSplatmap(): SplatmapResult | null {
  return useContext(SplatmapContext);
}
