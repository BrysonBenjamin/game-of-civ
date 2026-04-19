import type { Tile, Unit } from "@civ/types";

// Engine → Portal boundary
export type HexClickedEvent = {
  type: "HEX_CLICKED";
  intersectPoint: { x: number; y: number; z: number };
};

// Portal → Engine boundary
export type InitMapEvent = {
  type: "INIT_MAP";
  width: number;
  height: number;
  mapData: Record<string, Tile>;
  units: Unit[];
};

export type InputClickEvent = {
  type: "INPUT_CLICK";
  clientX: number;
  clientY: number;
};

export type UnitMoveEvent = {
  type: "UNIT_MOVE";
  unitId: string;
  targetHexId: string;
};

export type IpcMessage = 
  | HexClickedEvent 
  | InitMapEvent 
  | InputClickEvent 
  | UnitMoveEvent;
