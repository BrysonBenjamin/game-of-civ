import { create } from "zustand";
import type {
  GameState,
  Command,
  Tile,
  BaseTerrainType,
  TerrainFeature,
  Unit,
  Player,
  HexId,
  YieldModifier,
} from "@civ/logic";
import { hexKey, UNIT_TEMPLATES, ZERO_YIELD } from "@civ/logic";
import { produceNextState } from "@civ/logic";

// ─── Terrain colour palettes (for canvas) ────────────────────────────────────

export const BASE_TERRAIN_COLORS: Record<BaseTerrainType, string> = {
  plains:    "#8fbc5a",
  grassland: "#5da84e",
  tundra:    "#7a9a8a",
  desert:    "#d4b96a",
  ocean:     "#2a6ec4",
  snow:      "#d0dde8",
};

export const FEATURE_TINT: Record<TerrainFeature, string | null> = {
  none:       null,
  woods:      "#2d6a2e",
  rainforest: "#1a5c1a",
  marsh:      "#6b7a5a",
  mountains:  "#6b6b6b",
  hills:      "#a89060",
  reef:       "#40b0a0",
};

/** Resolve a tile's display colour: feature tint if present, else base terrain. */
export function tileColor(tile: Tile): string {
  const tint = FEATURE_TINT[tile.feature];
  return tint ?? BASE_TERRAIN_COLORS[tile.baseTerrain];
}

// ─── Default yields per baseTerrain + feature ────────────────────────────────

const BASE_YIELDS: Record<BaseTerrainType, YieldModifier> = {
  plains:    { matter: 2, energy: 1, data: 0, credits: 0 },
  grassland: { matter: 3, energy: 0, data: 0, credits: 0 },
  tundra:    { matter: 1, energy: 0, data: 0, credits: 1 },
  desert:    { matter: 0, energy: 2, data: 0, credits: 1 },
  ocean:     { matter: 1, energy: 0, data: 0, credits: 2 },
  snow:      { matter: 0, energy: 0, data: 1, credits: 0 },
};

const FEATURE_YIELD_BONUS: Record<TerrainFeature, YieldModifier> = {
  none:       ZERO_YIELD,
  woods:      { matter: 1, energy: 0, data: 0, credits: 0 },
  rainforest: { matter: 1, energy: 0, data: 1, credits: 0 },
  marsh:      { matter: 0, energy: 0, data: 0, credits: 0 },
  mountains:  { matter: 0, energy: 1, data: 0, credits: 0 },
  hills:      { matter: 0, energy: 1, data: 0, credits: 1 },
  reef:       { matter: 1, energy: 0, data: 0, credits: 1 },
};

function combineYields(base: YieldModifier, bonus: YieldModifier): YieldModifier {
  return {
    matter: base.matter + bonus.matter,
    energy: base.energy + bonus.energy,
    data: base.data + bonus.data,
    credits: base.credits + bonus.credits,
  };
}

// ─── Map generator ───────────────────────────────────────────────────────────

function generateHexMap(width: number, height: number): Record<HexId, Tile> {
  const baseTerrains: BaseTerrainType[] = [
    "plains", "grassland", "desert", "tundra", "snow",
  ];
  const features: TerrainFeature[] = [
    "none", "woods", "hills", "none", "rainforest", "none",
  ];
  const map: Record<HexId, Tile> = {};

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const isEdge =
        q === 0 || r === 0 || q === width - 1 || r === height - 1;

      // Deterministic terrain gen
      const baseSeed = (q * 7 + r * 13) % baseTerrains.length;
      const featSeed = (q * 11 + r * 3) % features.length;

      const baseTerrain: BaseTerrainType = isEdge
        ? "ocean"
        : baseTerrains[baseSeed];
      const feature: TerrainFeature = isEdge
        ? "none"
        : baseTerrain === "ocean"
          ? "none"
          : features[featSeed];

      const yields = combineYields(
        BASE_YIELDS[baseTerrain],
        FEATURE_YIELD_BONUS[feature]
      );

      const hexId = hexKey({ q, r });
      map[hexId] = {
        hex_id: hexId,
        coord: { q, r },
        baseTerrain,
        feature,
        yields,
        ownerId: null,
        improvement: null,
        unitIds: [],
        cityId: null,
      };
    }
  }
  return map;
}

// ─── Initial state factory ───────────────────────────────────────────────────

function createInitialState(): GameState {
  const mapWidth = 10;
  const mapHeight = 10;
  const map = generateHexMap(mapWidth, mapHeight);

  const players: Player[] = [
    {
      player_id: "p1",
      name: "Player 1",
      color: "#3b82f6",
      isHuman: true,
      treasury: { matter: 50, energy: 50, data: 0, credits: 100 },
      visibility: {},
      techUnlocks: { can_build_farm: true },
      diplomaticRelations: { p2: 0 },
    },
    {
      player_id: "p2",
      name: "AI Opponent",
      color: "#ef4444",
      isHuman: false,
      treasury: { matter: 50, energy: 50, data: 0, credits: 100 },
      visibility: {},
      techUnlocks: { can_build_farm: true },
      diplomaticRelations: { p1: 0 },
    },
  ];

  const tmplSettler = UNIT_TEMPLATES["SETTLER"];
  const tmplWarrior = UNIT_TEMPLATES["WARRIOR"];

  const units: Unit[] = [
    {
      unit_id: "u1",
      type_id: "SETTLER",
      owner_id: "p1",
      position: hexKey({ q: 3, r: 3 }),
      movement_remaining: tmplSettler.max_movement,
      max_movement: tmplSettler.max_movement,
      facing_direction: 0,
      current_health: tmplSettler.max_health,
      max_health: tmplSettler.max_health,
      base_strength: tmplSettler.base_strength,
      experience_points: 0,
      tags: [...tmplSettler.tags],
    },
    {
      unit_id: "u2",
      type_id: "WARRIOR",
      owner_id: "p1",
      position: hexKey({ q: 4, r: 3 }),
      movement_remaining: tmplWarrior.max_movement,
      max_movement: tmplWarrior.max_movement,
      facing_direction: 0,
      current_health: tmplWarrior.max_health,
      max_health: tmplWarrior.max_health,
      base_strength: tmplWarrior.base_strength,
      experience_points: 0,
      tags: [...tmplWarrior.tags],
    },
    {
      unit_id: "u3",
      type_id: "WARRIOR",
      owner_id: "p2",
      position: hexKey({ q: 7, r: 7 }),
      movement_remaining: tmplWarrior.max_movement,
      max_movement: tmplWarrior.max_movement,
      facing_direction: 0,
      current_health: tmplWarrior.max_health,
      max_health: tmplWarrior.max_health,
      base_strength: tmplWarrior.base_strength,
      experience_points: 0,
      tags: [...tmplWarrior.tags],
    },
    {
      unit_id: "u4",
      type_id: "SETTLER",
      owner_id: "p2",
      position: hexKey({ q: 6, r: 7 }),
      movement_remaining: tmplSettler.max_movement,
      max_movement: tmplSettler.max_movement,
      facing_direction: 0,
      current_health: tmplSettler.max_health,
      max_health: tmplSettler.max_health,
      base_strength: tmplSettler.base_strength,
      experience_points: 0,
      tags: [...tmplSettler.tags],
    },
  ];

  // Place units on the map
  for (const unit of units) {
    if (map[unit.position]) {
      map[unit.position] = {
        ...map[unit.position],
        unitIds: [...map[unit.position].unitIds, unit.unit_id],
      };
    }
  }

  return {
    turn: 1,
    activePlayerIndex: 0,
    phase: "playing",
    players,
    map,
    units,
    cities: [],
    mapSize: { width: mapWidth, height: mapHeight },
    actionHistory: [],
    globalModifiers: {},
    log: ["── Turn 1 ──", "Player 1's turn."],
    randomSeed: 42,
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface GameStore {
  state: GameState;
  selectedUnitId: string | null;
  dispatch: (command: Command) => void;
  selectUnit: (unitId: string | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: createInitialState(),
  selectedUnitId: null,

  dispatch: (command: Command) => {
    set((store) => ({
      state: produceNextState(store.state, command),
    }));
  },

  selectUnit: (unitId: string | null) => {
    set({ selectedUnitId: unitId });
  },

  resetGame: () => {
    set({ state: createInitialState(), selectedUnitId: null });
  },
}));
