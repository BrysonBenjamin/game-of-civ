export type HexId = string; // Format: "q,r"
export type HexCoordinate = { q: number; r: number };
export type BaseTerrainType = "plains" | "grassland" | "tundra" | "desert" | "ocean" | "snow";
export type TerrainFeature = "none" | "woods" | "rainforest" | "marsh" | "mountains" | "hills" | "reef";

export interface YieldModifier {
  readonly matter: number;
  readonly energy: number;
  readonly data: number;
  readonly credits: number;
}

export interface Tile {
  readonly hex_id: HexId;
  readonly coord: HexCoordinate;
  readonly baseTerrain: BaseTerrainType;
  readonly feature: TerrainFeature;
  readonly yields: YieldModifier;
  readonly ownerId: string | null;
  readonly improvement: string | null;
  readonly unitIds: string[];
  readonly cityId: string | null;
}

export interface Unit {
  readonly unit_id: string;
  readonly owner_id: string;
  readonly type_id: string;
  readonly position: HexId;
  readonly movement_remaining: number;
  readonly max_movement: number;
  readonly facing_direction: number;
  readonly current_health: number;
  readonly max_health: number;
  readonly base_strength: number;
  readonly experience_points: number;
  readonly tags: string[];
}
