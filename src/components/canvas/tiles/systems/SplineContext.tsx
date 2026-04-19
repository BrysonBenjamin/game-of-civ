"use client";

import { createContext, useContext, useMemo } from "react";
import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { buildRidgeSplines } from "./SplineEngine";

interface SplineData {
  ridgeSplines: THREE.CatmullRomCurve3[];
}

const SplineContext = createContext<SplineData | null>(null);

interface SplineProviderProps {
  map: Record<HexId, Tile>;
  children: React.ReactNode;
}

export function SplineProvider({ map, children }: SplineProviderProps) {
  const data = useMemo<SplineData>(
    () => ({ ridgeSplines: buildRidgeSplines(map) }),
    [map]
  );
  return <SplineContext.Provider value={data}>{children}</SplineContext.Provider>;
}

export function useSplines(): SplineData | null {
  return useContext(SplineContext);
}
